---
title: Kotlin Coroutine의 Structured Concurrency 구현 상세
date: 2022-01-21 14:34:48
categories:
  - Develop
---
## 개요

Kotlin coroutine의 structured concurrency의 동작 방식을 다시 살펴보자.

- parent가 어떤 이유로든 취소되면, parent의 모든 children이 취소된다.
- child에서 exception이 던져져서 취소되면, exception은 parent로 전파되어서 parent를 취소시킨다. child가 명시적인 취소로 인해 취소되면 parent로 취소가 전파되지 않는다.

이 글은 Kotlin coroutine에서 위와 같은 structured concurrency를 어떻게 구현했는지를 설명하는 글이다. coroutine의 API와 동작 방식에 대해 어느 정도 익숙하다는 전제 하에 작성된 글이어서, 글의 내용이 이해가 되지 않는다면 [Kotlin coroutine proposal](https://github.com/Kotlin/KEEP/blob/master/proposals/coroutines.md)과 [공식 가이드 문서](https://kotlinlang.org/docs/coroutines-guide.html)를 먼저 읽는 것이 도움이 될 것이다.

이 글에서 참고한 코드는 Kotlin 1.5.30 버전과 kotlinx coroutines core 1.5.2 버전을 사용하였다.
<br>

## structured concurrency를 위한 트리 구성

structured concurrency의 동작 방식을 보면, coroutine이 내부적으로 트리 구조(부모-자식)의 형태로 관리가 되고 있음을 추측할 수 있다. 이 트리 구조가 무엇으로 구성되어 있고, 또 어떤 방식으로 구성되는지 알아보자.

실제 내부 구현을 까보면, structured concurrency를 구현하기 위한 기반 요소는 크게 두 가지이다.

- `Job`(interface) - structured concurrency에서 가장 중요한 요소로, 보통 **coroutine과 1대1로 형성되어 위에서 언급한 트리 구조를 형성한다.** 각 job은 취소의 전파에 따라 자신과 대응되는 coroutine을 적절히 취소시킨다.
- `CoroutineScope`(interface) - CoroutineScope.coroutineContext에는 coroutine의 실행을 위한 여러가지 정보가 담기지만, **가장 중요한 것은 coroutine의 `Job`을 저장하는 것이다. `Job`은 하나의 `CoroutineContext.Element`이고, `CoroutineScope.coroutineContext`에는 반드시 `Job`이 포함되어 있어야만 한다.** 이는 아래와 같이 javadoc에도 명시되어 있다.

    *"...By convention, the context of a scope should contain an instance of a job to enforce the discipline of structured concurrency with propagation of cancellation.”(CoroutineScope.kt)*

이제 coroutine 시작 시 `Job`의 트리가 어떤 과정을 통해 구성되는지 알아보자. 아래는 각종 coroutine 클래스의 기반 구현을 제공하는 `AbstractCoroutine`의 구현 중 일부이다.

```kotlin
@InternalCoroutinesApi
public abstract class AbstractCoroutine<in T>(
    parentContext: CoroutineContext, /* ---- (1) */
    initParentJob: Boolean,
    active: Boolean
) : JobSupport, ... {

    init {
        /*
         * Setup parent-child relationship between the parent in the context and the current coroutine.
         * It may cause this coroutine to become _cancelling_ if the parent is already cancelled.
         * It is dangerous to install parent-child relationship here if the coroutine class
         * operates its state from within onCancelled or onCancelling
         * (with exceptions for rx integrations that can't have any parent)
         */
        if (initParentJob) initParentJob(parentContext[Job]) /* ---- (2) */
    }
    ...
}

@Deprecated(level = DeprecationLevel.ERROR, message = "This is internal API and may be removed in the future releases")
public open class JobSupport constructor(active: Boolean) : Job {
    ...
    protected fun initParentJob(parent: Job?) {
        assert { parentHandle == null }
        if (parent == null) {
            parentHandle = NonDisposableHandle
            return
        }
        parent.start() /* make sure the parent is started */
        @Suppress("DEPRECATION")
        val handle = parent.attachChild(this) /* ---- (3) */
        parentHandle = handle
        /* now check our state _after_ registering (see tryFinalizeSimpleState order of actions) */
        if (isCompleted) {
            handle.dispose()
            parentHandle = NonDisposableHandle /* release it just in case, to aid GC */
        }
    }
    ...
}
```

coroutine이 실행될 때 발생하는 일을 간단하게 정리하면 다음과 같다.

1. coroutine 객체가 생성될 때, constructer param으로 "부모의 coroutine context”(`parentContext`)를 받는다.
2. `parentContext`에서 부모의 Job을 빼온다(`parentContext[Job]`).
3. 자신의 job을 부모의 child로 붙인다(`val handle = parent.attachChild(this)`).

**즉, 자식 coroutine이 생성될 때 자신의 Job을 부모의 Job에 자식으로 붙이는 방식을 통해 트리 구조가 형성된다.**

위의 동작 자체는 간단하지만, 이 코드만 봐서는 structured concurrency의 자세한 동작에 대해 알 수 없는 중요한 요소가 두 가지 있다.

1. "부모의 coroutine context”인 `parentContext`에는 어떤 값이 주입되는가? - `parentContext[Job]`에 무엇이 담겨 있느냐에 따라서 부모 `Job`이 무엇인지가 달라지고, 결과적으로 `Job` 트리의 구성이 달라질 수 있다.
2. `Job` 트리에서 각 `Job`의 실행 순서는 어떻게 결정되는가? - 예를 들어 `launch {}`는 자신의 내부에서 실행된 coroutine의 종료를 기다리지 않는 반면, `coroutineScope {}`는 자신의 내부에서 실행된 coroutine이 모두 종료될 때까지 다음 코드를 실행하지 않는다. 둘의 동작 방식의 차이는 어디서 비롯되는가?

이 두 가지에 본격적으로 알아보기 전에, Kotlin에서 coroutine과 `Job`, `CoroutineScope`과의 관계를 어떻게 추상화했는지를 살펴보도록 하자. 내부 코드를 읽고 이해하는 데 큰 도움을 준다.
<br>

## AbstractCoroutine - coroutine은 CoroutineScope이며 Job이다

coroutine 클래스의 기반 클래스인 `AbstractCoroutine`의 구현을 보자.

```kotlin
public abstract class AbstractCoroutine<in T>(
    parentContext: CoroutineContext,
    initParentJob: Boolean,
    active: Boolean
) : JobSupport(active), Job, Continuation<T>, CoroutineScope
```

코드를 보면 `AbstractCoroutine`이 `Job`과 `CoroutineScope` 인터페이스를 모두 구현하고 있음을 알 수 있다. 이것의 의미는 아래와 같다.

- **`CoroutineScope` - coroutine은 자기 자신이 scope가 되어 자신의 code block 안에서 자식 coroutine을 실행할 수 있다. 또한, 자신의 coroutine context를 자식 coroutine에게 전달할 수 있다(e.g. 위에서 본 `parentContext` 주입 등).**
- **`Job` - coroutine은 structured concurrency를 위한 트리의 노드 그 자체이다.**

즉, 위에서 언급했던 coroutine의 structured concurrency를 위한 모든 동작을 사실은 coroutine이 전부 수행하고 있는 것이다. 이 추상화는 `Job` 객체나 `CoroutineScope` 객체를 별도로 관리해야 할 필요를 없애기 때문에 코드를 훨씬 단순하게 만든다. 예를 들어, 위에서 보았던 `val handle = parent.attachChild(this)` 코드를 보자. `AbstractCoroutine`은 별도의 `Job`을 만들어서 parent에 전달하는 대신, 자기 자신(`this`)을 parent에게 붙일 수 있다.

어차피 coroutine에 모든 역할을 때려 넣을 거면 애초부터 `Job`과 `CoroutineScope`이라는 개념을 만들지 않아도 되었던 것 아니냐고 생각할 수 있다. 그럴 수도 있는데, 이러한 구현은 복잡한 시스템이 자기 자신을 보다 분명하게 표현하도록 도와준다. `Job`과 `CoroutineScope`라는 인터페이스 없이 `AbstractCoroutine`에 모든 구현을 때려 넣었다면 structured concurrency를 위한 tree라는 개념과 coroutine 실행의 scope이라는 개념이 코드 상에 제대로 드러나지 않았을 것이고, 각 개념을 달성하기 위한 코드가 한데 뒤섞여 코드를 이해하기 매우 어려웠을 것이다. `Job`과 `JobSupport` mixin, 그리고 `CoroutineScope`을 통해 명시적으로 개념을 분리하고, 이를 구현의 편의를 위해 하나로 다시 합친 덕분에 코드가 훨씬 깔끔해졌다.
<br>

## coroutine tree의 구성

이제 본론으로 돌아가서, 우선 `parentContext`가 무엇인지, 그리고 coroutine 실행 시 coroutine tree(이제부터 `Job` tree 대신 coroutine tree라고 하겠다)가 어떻게 구성되는지로 돌아가보자.

Kotlin에서 제공하는 primitive coroutine builder에는 크게 3가지가 있는데, 아래와 같이 분류할 수 있다.

- `CoroutineScope`의 extension function - `launch {}`, `async {}` 등
- suspending function - `withContext {}`, `coroutineScope {}` 등
- root coroutine builder - `runBlocking {}` 등

위 3가지 종류의 coroutine builder는 구현이 서로 다르기 때문에, 각각의 구현을 살펴보아야 한다.
<br>

### CoroutineScope의 extension function인 coroutine builder

`launch {}`와 `async {}`는 반환하는 객체가 `Job`인지 `Deferred`인지를 제외하고는 구현이 비슷해서, `launch {}`의 구현만 살펴보겠다.

```kotlin
public fun CoroutineScope.launch(
    context: CoroutineContext = EmptyCoroutineContext,
    start: CoroutineStart = CoroutineStart.DEFAULT,
    block: suspend CoroutineScope.() -> Unit
): Job {
    val newContext = newCoroutineContext(context) /* ---- (1) */
    val coroutine = if (start.isLazy)
        LazyStandaloneCoroutine(newContext, block) else
        StandaloneCoroutine(newContext, active = true) /* ---- (2) */
    coroutine.start(start, coroutine, block) /* ---- (3)*/
    return coroutine
}

private open class StandaloneCoroutine(
    parentContext: CoroutineContext, /* ---- (4) */
    active: Boolean
) : AbstractCoroutine<Unit>(parentContext, initParentJob = true, active = active) {
    override fun handleJobException(exception: Throwable): Boolean {
        handleCoroutineException(context, exception)
        return true
    }
}
```

1. 새 coroutine에 사용할 context를 만든다.
2. 1의 coroutine context를 사용하여 새로운 `StandaloneCoroutine` 객체를 만든다.
3. 2의 coroutine을 시작한다.

여기서 `parentContext`, 즉 (4)에는 어떤 값이 담겨 있는가? (2)를 보면 `newContext`가 `parentContext`로 넘어오는 것을 알 수 있다. 이제 `newCoroutineContext()` 구현을 살펴보자.

```kotlin
@ExperimentalCoroutinesApi
public actual fun CoroutineScope.newCoroutineContext(context: CoroutineContext): CoroutineContext {
    val combined = coroutineContext + context /* ---- (5) */
    val debug = if (DEBUG) combined + CoroutineId(COROUTINE_ID.incrementAndGet()) else combined
    return if (combined !== Dispatchers.Default && combined[ContinuationInterceptor] == null)
        debug + Dispatchers.Default else debug
}
```

`launch {}` 호출 시 `context` param에 아무것도 넘겨주지 않는다면, (5)에서 더해지는 두 context의 내용물은 다음과 같다.

- `coroutineContext` - `launch {}`의 receiver `CoroutineScope`의 `coroutineContext`
- `context` - `EmptyCoroutineContext`

즉, **`parentContext`는 `launch {}`의 receiver `CoroutineScope`의 `coroutineContext`이다.**

그렇다면 "`launch {}`의 receiver `CoroutineScope`"은 어떻게 결정되는가? 이는 (3)의 `start()`가 어떻게 구현되어 있는지를 통해 확인할 수 있다.

```kotlin
/* AbstractCoroutine.start()의 구현 */
public fun <R> start(start: CoroutineStart, receiver: R, block: suspend R.() -> T) { /* ---- (6) */
    start(block, receiver, this)
}
```

(6)을 보면 (3)에서 전달한 coroutine이 block의 receiver `CoroutineScope`이 되는 것을 알 수 있다. 즉, `launch {}`의 인자로 넘긴 block의 receiver는 `launch {}`로 인해 생성된 coroutine 그 자체이다. 부모 coroutine이 이 구현과 동일한 방법으로 시작되었다고 가정하면, "`launch {}`의 receiver `CoroutineScope`”는 부모 coroutine이 된다. **따라서 `parentContext`는 부모 coroutine의 context가 된다.**

이제 결론까지 마지막 한 가지만 남았다. 부모 coroutine의 `context[Job]` 에는 무엇이 들어 있는가? 이는 `AbstractCoroutine`의 구현을 보면 알 수 있다.

```kotlin
@InternalCoroutinesApi
public abstract class AbstractCoroutine<in T>(
    parentContext: CoroutineContext,
    initParentJob: Boolean,
    active: Boolean
) : JobSupport(active), Job, Continuation<T>, CoroutineScope {
    ...
    /**
     * The context of this coroutine that includes this coroutine as a [Job].
     */
    @Suppress("LeakingThis")
    **public final override val context: CoroutineContext = parentContext + this /* ---- (7) */

    /**
     * The context of this scope which is the same as the [context] of this coroutine.
     */
    **public override val coroutineContext: CoroutineContext get() = context /* ---- (8) */
    ...
}
```

(7)의 `val context: CoroutineContext = parentContext + this`에서 `this`는 `Job`으로의 `this`이다. 그리고 (8)에서 `coroutineContext`에 이 `context`를 그대로 노출하는 것을 알 수 있다. 즉, **`coroutineContext[Job]`에는 coroutine 자기 자신이 들어 있다.**

이제 위의 내용들을 다시 정리해보자.

1. 자식 coroutine은 `parentContext[Job]`에 자기 자신을 자식으로 붙인다.
2. 자식 coroutine은 `parentContext` param으로 `launch {}`의 receiver `CoroutineScope.coroutineContext`을 받는다.
3. `launch {}`의 receiver `CoroutineScope`는 부모 coroutine이다.
4. `AbstractCoroutine.coroutineContext[Job]`에는 자기 자신이 담겨 있다.

따라서, **`launch {}`로 coroutine을 실행하면 부모 - 자식 관계 그대로 coroutine tree가 형성된다.** 결론은 매우 직관적이고, 간단하다.

예시를 통해 확인해보자. 아래는 coroutine 코드 예제와 해당 예제를 coroutine tree로 치환한 것이다.

```kotlin
runBlocking { /* coroutine 1 */
    launch { /* coroutine 2 */
        launch { /* coroutine 3 */
            launch { /* coroutine 4 */
            }
        }
        launch { /* coroutine 5 */
        }
    }
}
```

<img src="/images/kotlin-coroutine-structured-concurrency/coroutine-tree.png" alt="coroutine tree" style="width: 400px;"/>
<br>

### suspending function인 coroutine builder

다음은 suspending function인 `withContext {}`와 `coroutineScope {}`이다. 둘 역시 구현이 비슷한데, 여기서는 구현이 간단한 `coroutineScope {}`만 살펴보겠다.

```kotlin
/* Note: CoroutineScope의 extension function이 아님을 기억하자. */
public suspend fun <R> coroutineScope(block: suspend CoroutineScope.() -> R): R {
    contract {
        callsInPlace(block, InvocationKind.EXACTLY_ONCE)
    }
    return suspendCoroutineUninterceptedOrReturn { uCont ->
        val coroutine = ScopeCoroutine(uCont.context, uCont) /* ---- (1) */
        coroutine.startUndispatchedOrReturn(coroutine, block) /* ---- (2) */
    }
}

internal open class ScopeCoroutine<in T>(
    context: CoroutineContext, /* ---- (3) */
    @JvmField val uCont: Continuation<T> /* unintercepted continuation */
) : AbstractCoroutine<T>(context, true, true), CoroutineStackFrame { /* ---- (4) */
    ...
}
```

핵심 구현 자체는 매우 간단하다.

1. coroutine을 만든다.
2. coroutine을 실행한다.

(1), (3), (4)를 보면 `uCont.context`가 `parentContext`가 됨을 알 수 있다. 그렇다면 `uCont`는 무엇인가? `suspendCoroutineUninterceptedOrReturn()`의 구현을 보자.

```kotlin
/**
 * Obtains the current continuation instance inside suspend functions and either suspends
 * currently running coroutine or returns result immediately without suspension.
 * ...
 */
@SinceKotlin("1.3")
@InlineOnly
@Suppress("UNUSED_PARAMETER", "RedundantSuspendModifier")
public suspend inline fun <T> suspendCoroutineUninterceptedOrReturn(crossinline block: (Continuation<T>) -> Any?): T {
    contract { callsInPlace(block, InvocationKind.EXACTLY_ONCE) }
    throw NotImplementedError("Implementation of suspendCoroutineUninterceptedOrReturn is intrinsic")
}
```

구현이 intrinsic이라 볼 수는 없지만, javadoc을 통해 `uCont`가 부모 coroutine임을 유추할 수 있다.* 즉, `launch {}`와 동일하게 부모 coroutine의 `context`를 `parentContext`로 받는다. 따라서, `coroutineScope {}`에서도 `launch {}`와 동일하게 부모 - 자식 관계를 그대로 유지하며 coroutine tree가 구성된다.

\* 이 부분을 보다 잘 이해하기 위해서는 1. [Kotlin coroutine이 내부적으로 CPS로 동작하는 메커니즘](https://github.com/Kotlin/KEEP/blob/master/proposals/coroutines.md#continuation-passing-style)과 2. `AbstractCoroutine`이 `Continuation`의 역할도 맡는다는 것을 알아야 한다. 이 부분을 설명하기에는 글이 너무 길어질 듯하여 생략한다.
<br>

### runBlocking {}의 동작

그렇다면 `runBlocking {}`과 같은 함수로 인해 실행되는 root coroutine은 어떤 `Job`의 자식으로 실행되는가? `runBlocking {}`의 구현을 보자.

```kotlin
@Throws(InterruptedException::class)
public fun <T> runBlocking(context: CoroutineContext = EmptyCoroutineContext, block: suspend CoroutineScope.() -> T): T {
    contract {
        callsInPlace(block, InvocationKind.EXACTLY_ONCE)
    }
    val currentThread = Thread.currentThread()
    val contextInterceptor = context[ContinuationInterceptor]
    val eventLoop: EventLoop?
    val newContext: CoroutineContext
    if (contextInterceptor == null) {
        /* create or use private event loop if no dispatcher is specified */
        eventLoop = ThreadLocalEventLoop.eventLoop
        newContext = GlobalScope.newCoroutineContext(context + eventLoop)
    } else {
        /* See if context's interceptor is an event loop that we shall use (to support TestContext) */
        /* or take an existing thread-local event loop if present to avoid blocking it (but don't create one) */
        eventLoop = (contextInterceptor as? EventLoop)?.takeIf { it.shouldBeProcessedFromContext() }
            ?: ThreadLocalEventLoop.currentOrNull()
        newContext = GlobalScope.newCoroutineContext(context)
    }
    val coroutine = BlockingCoroutine<T>(newContext, currentThread, eventLoop)
    coroutine.start(CoroutineStart.DEFAULT, coroutine, block)
    return coroutine.joinBlocking()
}
```

보면 `newContext`가 `GlobalScope.newCoroutineContext()`에 의해 만들어지는 것을 알 수 있다. 이 함수의 구현은 위에서 살펴본 적이 있다.

```kotlin
@ExperimentalCoroutinesApi
public actual fun CoroutineScope.newCoroutineContext(context: CoroutineContext): CoroutineContext {
    val combined = coroutineContext + context
    val debug = if (DEBUG) combined + CoroutineId(COROUTINE_ID.incrementAndGet()) else combined
    return if (combined !== Dispatchers.Default && combined[ContinuationInterceptor] == null)
        debug + Dispatchers.Default else debug
}
```

이 두 함수의 구현을 토대로 역추적을 해보면, `newContext`에는 `eventLoop` element 밖에 없는 것을 알 수 있다. 즉, `Job`이 없는 것이다. 실제로 `runBlocking {}`으로 만들어진 `BlockingCoroutine`의  parent를 디버거로 찍어 보면 null임을 알 수 있다. 대신, `runBlocking {}`으로 만들어진 `BlockingCoroutine`은 `eventLoop`의 종료로 관리된다. 이는 `BlockingCoroutine.joinBlocking()` 함수의 구현을 보면 알 수 있다.

```kotlin
@Suppress("UNCHECKED_CAST")
fun joinBlocking(): T {
    registerTimeLoopThread()
    try {
        eventLoop?.incrementUseCount()
        try {
            while (true) {
                @Suppress("DEPRECATION")
                if (Thread.interrupted()) throw InterruptedException().also { cancelCoroutine(it) }
                val parkNanos = eventLoop?.processNextEvent() ?: Long.MAX_VALUE
                /* note: process next even may loose unpark flag, so check if completed before parking */
                if (isCompleted) break
                parkNanos(this, parkNanos)
            }
        } finally { /* paranoia */
            eventLoop?.decrementUseCount()
        }
    } finally { /* paranoia */
        unregisterTimeLoopThread()
    }
    /* now return result */
    val state = this.state.unboxState()
    (state as? CompletedExceptionally)?.let { throw it.cause }
    return state as T
}
```

while문 안 쪽을 잘 보면 `isCompleted`가 true일 때, 즉 event loop의 queue가 비었을 때 종료됨을 알 수 있다. 즉, `runBlocking {}`으로 실행된 coroutine은 부모 coroutine 없이(따라서 부모 `Job` 없이) 실행된다.
<br>

## coroutine tree에서 각 coroutine이 실행되는 순서

이제 coroutine tree가 어떻게 구성되는지를 확인했으니, 만들어진 tree를 기반으로 coroutine이 어떤 순서로 실행되는지를 알아보자.

여기서도 tree 구성 방식 때와 유사하게 coroutine builder를 두 가지로 나누어서 보아야 한다.

- `CoroutineScope`의 extension function - `launch {}`, `async {}` 등
- suspending function - `withContext {}`, `coroutineScope {}` 등
<br>

### CoroutineScope의 extension function - fire-and-forget

**`launch {}`나 `async {}`는 fire-and-forget 방식으로 동작한다.** 아래의 `launch {}` 구현을 보자.

```kotlin
public fun CoroutineScope.launch(
    context: CoroutineContext = EmptyCoroutineContext,
    start: CoroutineStart = CoroutineStart.DEFAULT,
    block: suspend CoroutineScope.() -> Unit
): Job {
    val newContext = newCoroutineContext(context)
    val coroutine = if (start.isLazy)
        LazyStandaloneCoroutine(newContext, block) else
        StandaloneCoroutine(newContext, active = true)
    **coroutine.start(start, coroutine, block) // not a suspending function**
    return coroutine
}
```

함수 구현에 blocking call이 없고, `launch {}` 자체가 suspending function이 아니기 때문에 suspending point도 없다. 따라서 coroutine을 실행시킨 뒤에 멈추지 않고 이후의 코드를 실행한다. 이 coroutine이 실행되는 것을 기다리거나 적절히 종료시키는 것은 이 coroutine의 조상 중 누군가의 책임이 된다. 예를 들어, `runBlocking {}`을 사용한다면 `runBlocking {}`의 event loop가 해당 책임을 지게 된다.
<br>

### suspending function - 자식 coroutine이 끝날 때까지 suspend

한편, `withContext {}`나 `coroutineScope {}`은 suspending function이다. **이 둘은 자식 coroutine이 모두 종료될 때까지 기다리도록(suspend 하도록) 구현되어 있다.**

```kotlin
public suspend fun <R> coroutineScope(block: suspend CoroutineScope.() -> R): R {
    contract {
        callsInPlace(block, InvocationKind.EXACTLY_ONCE)
    }
    return suspendCoroutineUninterceptedOrReturn { uCont ->
        val coroutine = ScopeCoroutine(uCont.context, uCont)
        coroutine.startUndispatchedOrReturn(coroutine, block) /* ---- (1) */
    }
}
```

여기서 (1)의 구현을 보자.

```kotlin
internal fun <T, R> ScopeCoroutine<T>.startUndispatchedOrReturn(receiver: R, block: suspend R.() -> T): Any? {
    return undispatchedResult({ true }) {
        block.startCoroutineUninterceptedOrReturn(receiver, this)
    }
}

private inline fun <T> ScopeCoroutine<T>.undispatchedResult(
    shouldThrow: (Throwable) -> Boolean,
    startBlock: () -> Any?
): Any? {
    val result = try {
        startBlock()
    } catch (e: Throwable) {
        CompletedExceptionally(e)
    }
    /*
     * We're trying to complete our undispatched block here and have three code-paths:
     * (1) Coroutine is suspended.
     * Otherwise, coroutine had returned result, so we are completing our block (and its job).
     * (2) If we can't complete it or started waiting for children, we suspend.
     * (3) If we have successfully completed the coroutine state machine here,
     *     then we take the actual final state of the coroutine from makeCompletingOnce and return it.
     *
     * shouldThrow parameter is a special code path for timeout coroutine:
     * If timeout is exceeded, but withTimeout() block was not suspended, we would like to return block value,
     * not a timeout exception.
     */
    if (result === COROUTINE_SUSPENDED) return COROUTINE_SUSPENDED /* (1) */
    val state = makeCompletingOnce(result)
    if (state === COMPLETING_WAITING_CHILDREN) return COROUTINE_SUSPENDED /* (2) */
    return if (state is CompletedExceptionally) { /* (3) */
        when {
            shouldThrow(state.cause) -> throw recoverStackTrace(state.cause, uCont)
            result is CompletedExceptionally -> throw recoverStackTrace(result.cause, uCont)
            else -> result
        }
    } else {
        state.unboxState()
    }
}
```

필자도 정확한 메커니즘을 파악하진 못했지만, 함수 내부의 javadoc의 (2)를 보면 children을 기다리고 있으면 suspend 한다는 내용이 언급되어 있다. 이를 신뢰한다면 `coroutineScope {}`은 자식 coroutine이 모두 종료될 때까지 suspend 되는 것을 알 수 있다. `withContext {}` 역시 `ScopeCoroutine`이나 `ScopeCoroutine`을 상속받은 `DispatchedCoroutine`을 사용하므로 `coroutineScope {}`와 동일하게 동작함을 알 수 있다.
<br>

## 정리

이 글에서 알아본 내용을 정리하면 다음과 같다.

1. coroutine == `CoroutineScope` == `Job`
2. structured concurrency를 구현하기 위해 coroutine을 실행할 때 job의 tree(== coroutine의 tree)를 만들어 관리한다.
3. coroutine 내에서 coroutine builder(`launch {}`, `async {}`, `coroutineScope {}`, `withContext {}`)를 통해 coroutine을 실행하면 부모 - 자식 형태 그대로 coroutine tree가 생성된다. `runBlocking {}`은 특수하게 parent `Job` 없이 실행되고, 대신 event loop를 통해 자기 자신과 자식 coroutine의 실행을 추적하고 관리한다.
4. `launch {}`와 `async {}`로 실행된 coroutine은 별다른 실행 순서가 없다. 반면, `coroutineScope {}`, `withContext {}`로 실행된 coroutine은 자식 coroutine이 모두 종료될 때까지 suspend 된다.
