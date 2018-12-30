---
title: Spring + JUnit - 테스트에서 @PostConstruct 비활성화 하기
date: 2018-12-30 11:28:08
categories:
  - Develop
---
## 개요
이번 글은 테스트를 돌릴 때 `@PostConstruct`와 `@PreDestroy` hook을 비활성화하는 방법에 대한 글이다.
<br/>

## 문제 상황
아래와 같이 batch job을 `@PostConstruct`과 `ScheduledExecutorService`를 활용하여 띄운다고 해보자.
```
@Component
class SomeBatchJob {
    private val executor = Executors.newSingleThreadScheduledExecutor()

    @PostConstruct
    fun start() {
        executor.scheduleWithFixedDelay({
            run() 
        }, 0, 60L, TimeUnit.MINUTES)
    }

    fun run() {
        // do some batch job
    }

    @PreDestroy
    fun end() {
        executor.shutdown()
        executor.awaitTermination(60L, TimeUnit.MINUTES)
    }
}
```

이제 이 batch job의 로직을 테스트하고 싶다. 그러면 `@PostConstruct`에 의해 실행되는 batch job이 테스트에 영향을 미칠 수 있기 때문에 당연히 이를 비활성화하고 싶을 것이다.
<br />

내가 가장 먼저 떠올린 방법은 여태까지 해왔던 대로 `@Primary` 어노테이션을 사용해서 bean을 덮어쓰는 것이였다. 그래서 `SomeBatchJob`을 상속받은 `SomeBatchJobMock`을 만들어 `start()`와 `end()`가 아무런 작업도 하지 않도록 override한 후 테스트 configuration에 `@Primary` 어노테이션을 활용해 bean을 덮어썼다.
```
@Component
class SomeBatchJobMock : SomeBatchJob() {
    override fun start() {}
    override fun end() {}
}
```
```
@Configuration
class TestConfiguration {
    @Primary
    @Bean
    fun someBatchJobMock(): SomeBatchJob {
        return SomeBatchJobMock()
    }
}
```
```
@RunWith(SpringRunner::class)
@SpringBootTest(
    classes = [TestConfiguration::class]
)
class SomeBatchJobTest {
    @Test
    fun test() {
        // test logic here
    }
}
```

하지만 테스트를 돌려보면 `SomeBatchJob.start()`가 실행되는 것을 확인할 수 있다. 어떻게 된 일일까?
<br/>

## @Primary 어노테이션 작동 방식
필자는 이것 때문에 굉장한 삽질을 했는데, 결국 이는 `@Primary` 어노테이션의 작동 방식을 오해하고 있었기 때문이었다. 결론부터 말하자면 `@Primary` 어노테이션은 동일한 타입의 다른 bean을 덮어쓰는 것이 아니다. Bean scanning에 의해 발견되는 모든 bean은 `@Primary` 어노테이션과는 무관하게 일단 `ApplicationContext`에 등록이 된다. 이 때문에 `SomeBatchJob`과 `SomeBatchJobMock`의 `start()`가 둘 다 실행된 것이다. 이는 `SomeBatchJob`과 `SomeBatchJobMock`의 `start()`에 break point를 걸고 디버깅 모드로 실행해서 알게 된 사실이다.
<br />

그러면 `@Primary` 어노테이션의 역할은 무엇일까? 이는 docs를 보면 금방 알 수 있다.
> Indicates that a bean should be given preference when multiple candidates are qualified to autowire a single-valued dependency. If exactly one ‘primary’ bean exists among the candidates, it will be the autowired value.

즉, 위의 예제에 대입해서 설명하면, 다른 bean에서 `SomeBatchJob` 타입의 bean을 주입받으면 항상 `SomeBatchJobMock`이 주입된다는 의미이다. 따라서 당연히 `@Primary` 어노테이션으로는 `@PostConstruct` hook을 막을 수는 없다.
<br/>

## Dependency를 바꿔서 해결
일단 bean이 등록이 되면 `@PostConstruct`는 반드시 실행이 된다. 따라서 mock 하려는 기능은 애초에 bean scanning 단계에서 걸리지 않는 bean에 있거나, bean scanning에 걸린다면 `@PostConstruct` 어노테이션이 붙은 메소드 안에 있으면 안 된다.
<br />

그러면 어떻게 해야할까? 크게 두 가지 방법이 있다.
1. 기존의 bean은 bean scanning에 걸리지 않게 설정하고, `start()`와 `end()`를 아무 동작도 하지 않도록 override한 mock bean을 하나 만들어 테스트에서 사용한다.
2. `@PostConstruct`를 사용하지 않는다. 대신, 해당 bean을 주입받은 다른 bean에서 `start()`와 `end()`를 호출한다. 즉, `A.a()`를 mock 하려면 `A`를 주입받는 `B`라는 bean을 만들고 `@PostConstruct`가 붙은 `B.b()`에서 `A.a()`를 호출한다. 이후 테스트에서는 `B.b()`를 아무 동작도 하지 않도록 mock 한다.
<br />

필자는 이미 수많은 테스트가 작성된 프로젝트에서 작업을 하고 있었기 때문에, 테스트 설정을 바꾸는 1번 대신 2번 방법을 선택했다. 최종적으로 바뀐 의존성을 먼저 보여주자면 아래 그림과 같다.

![의존성 변화](/images/spring_junit_disable_postconstruct_in_test/bean_dependency_graphs.png)

원래는 `SomeBatchJob`의 `start()`에 batch job을 띄우는 로직이 있었다. 근데 `SomeBatchJob`을 mock 할 수는 없다. 왜냐면 만약 `SomeBatchJob`에 다른 의존성이 있을 경우 `SomeBatchJob`을 mock 하면 다른 의존성이 주입이 안 되면서 `run()` 메소드가 제대로 돌아가지 않을 것이기 때문이다. 따라서 `run()` 로직에 대해 제대로 테스트를 돌릴 수 없을 것이다.
<br />

그래서 일단 테스트 할 batch job의 비즈니스 로직과 “batch job을 띄운다”는 로직을 서로 다른 bean이 가지도록 분리시켰다. `start()`와 `end()`는 `BatchJobExecutor`의 `executeJobs()`와 `shutdownJobs()`로 로직을 옮기고 `BatchJobExecutor`가 `SomeBatchJob`을 주입받아 `executeJobs()`에서 `SomeBatchJob`을 띄우도록 했다.
```
interface BatchJob {
    fun run()
}
```
```
@Component
class SomeBatchJob : BatchJob {
    override fun run() {
        // do some batch job
    }
}
```
```
@Component
class BatchJobExecutor(
    private val batchJobs: List<BatchJob>
) {
    private val executor = Executors.newSingleThreadScheduledExecutor()

    fun executeJobs() {
        batchJobs.forEach {
            executor.scheduleWithFixedDelay({
                it.run()
            }, 0, 60L, TimeUnit.MINUTES)
        }
    }

    @PreDestroy
    fun shutdownJobs() {
        executor.shutdown()
        executor.awaitTermination(60L, TimeUnit.MINUTES)
    }
}
```

문제는 `BatchJobExecutor.executeJobs()`에다가 `@PostConstruct`를 달아도 안 된다. Mock을 한다고 해도 bean이 `ApplicationContext`에 등록돼서 job이 뜰 것이기 때문이다.
<br />

그래서 bean을 하나 더 만들었다. `BatchJobExecutor`을 주입받아서 `executeJobs()`를 실행시켜주는 `BatchJobExecutorRunner`을 새로 정의했다. `BatchJobExecutorRunner`는 생성될 때 `BatchJobExecutor.executeJobs()`를 호출해준다.
```
@SpringBootApplication
class SampleApplication {
    @Bean
    fun batchJobExecutorRunner(batchJobExecutor: BatchJobExecutor): BatchJobExecutor {
        batchJobExecutor.executeJobs()
        return batchJobExecutor
    }
}
```

이제 테스트를 돌릴 때 `BatchJobExecutor`을 mock 해주고 `executeJobs()`와 `shutdownJobs()`를 아무 동작도 하지 않도록 override 해주면 batch job이 뜨지 않는다.
```
@Component
class BatchJobExecutorMock(
    private val batchJobs: List<BatchJob>
) : BatchJobExecutor(batchJobs) {
    override fun executeJobs() {}
    override fun shutdownJobs() {}
}
```
```
@Configuration
class TestConfiguration {
    @Primary
    @Bean
    fun batchJobExecutorMock(batchJobExecutorMock: BatchJobExecutorMock): BatchJobExecutor {
        return batchJobExecutorMock
    }
}
```
```
@RunWith(SpringRunner::class)
@SpringBootTest(
    classes = [TestConfiguration::class]
)
class SomeBatchJobTest {
    @Test
    fun test() {
        // test logic here
    }
}
```
<br/>

## 결론
* `@Primary`는 bean을 덮어쓰는게 아니다. `@Primary`의 존재 여부와는 관계 없이 모든 bean은 우선 bean scanning을 통해 `ApplicationContext`에 등록된다.
* 특정 타입의 bean을 주입할 때 같은 타입의 bean이 여러 개 있을 경우, `@Primary` 어노테이션이 붙은 bean이 우선순위를 가지고 주입된다.
* 프레임워크가 평소에 잘 돌아간다고 아무 생각 없이 막 갖다 쓰지 말고 docs 한 번쯤은 읽어보자.