---
title: JS - Promise와 Generator을 활용한 async programming
date: 2018-04-18 22:53:17
categories:
  - Develop
---
이번 글에서는 최근 JavaScript를 공부하면서 가장 인상 깊었던 부분인 Promise와 Generator을 활용한 비동기 프로그래밍 구현에 대해서 정리해보았다. 글의 목적이 Promise와 Generator을 설명하는 것이 아니기 때문에 이 둘에 대한 설명은 빼고 바로 본론으로 들어가겠다.
<br />

## Generator의 제어권을 Promise에게!

Promise와 Generator를 활용한 비동기 프로그래밍의 핵심은 바로 **yield를 호출해 멈춘 Generator을 Promise가 제어하도록 하는 것**이다.
<br />

해당 방식으로 구현한 코드의 예시를 들어보겠다. 내가 url에 GET request를 날린 후 response가 오면 데이터를 화면에 노출시키는 로직을 구현하고 싶다고 해보자. 일반적으로 Promise만 사용할 경우 대략적으로 아래와 같이 구현할 것이다 :

```
axios.get('http://some-url/resources')
  .then(res => {
    renderData(res.data);
  });
```
<br/>

이를 Generator을 활용하면 아래와 같이 리팩토링할 수 있다.

```
function* main() {
  const res = yield axios.get('http://some-url/resources');
  renderData(res.data);
}

const iter = main();
const request = iter.next().value; /* axios.get(...)을 받는다. */
request.then(res => {
  iter.next(res); /* iter에 res를 넘겨주면서 iter을 재실행시킨다. */
});
```
<br />

우선 리팩토링한 코드의 작동 원리에 대해서 설명을 해보겠다.
1. `iter.next().value`를 실행하면 `iter`가 `yield axios.get(…)`까지 실행되면서 `axios.get(…)`을 외부로 넘겨준다.
2. `iter`가 넘겨준 `axios.get(…)`이라는 Promise가 `request`에 할당된다.
3. `axios.get(…)`이 resolve 되면 `iter.next(res.data)`를 통해 `iter`의 `res`에 axios의 결과값인 `res`가 할당되면서 `iter`가 다시 시작된다.
4. `iter` 내부에서 `renderData(res.data)`를 통해 HTTP request로 가져온 데이터를 렌더링한다.
<br />

그런데 잠깐, 코드가 더 길어지고 복잡해졌는데 리팩토링이라고?
<br />

여기서 눈여겨봐야 할 부분은 코드의 지저분함이 아니다. 가장 중요한 부분은 `main` generator의 형태이다.

```
function* main() {
  const res = yield axios.get('http://some-url/resources');
  renderData(res.data);
}
```
<br />

리팩토링 전에는 분명 Promise를 활용한 비동기식 방식으로 서버의 데이터를 받아와 화면에 렌더링했는데, 리팩토링 후에는 마치 **동기적으로 작동하는 것처럼** 코드가 변경되었다.
<br />

이것이 Promise와 Generator을 활용한 비동기식 프로그래밍의 강력한 장점이다. Promise는 우리를 콜백 지옥으로부터 벗어나게 해준 아주 고마운 친구지만, 여전히 사람의 동기식 사고방식과는 다르다. 하지만 여기에 Generator가 함께한다면 비동기적 구현을 동기적 구현으로 추상화시킬 수 있다. 이는 코드의 가독성을 매우 높혀주고 개발자가 코드를 짜는 데에 매우 큰 도움을 준다.
<br />

## Generator 자동 제어

하지만 위 코드의 문제점이 하나 있다. 바로 `iter`이 멈출 때마다 `iter`가 yield한 Promise에 `.then()`을 붙여 `iter.next(res)`를 호출해줘야 한다는 점이다. 이 작업을 손으로 일일이 해줬던 것이 위의 리팩토링한 코드가 지저분하게 느껴졌던 이유였다.
<br />

이를 해결하는 방법은 Promise에 의해 제어되는 형태의 Generator를 실행시켜주는 helper function을 구현하는 것이다. 이 helper function은 Generator가 생성한 Iterator가 yield한 무언가(Promise가 아닐 수도 있다!)가 귀결될 때까지 기다린 후 귀결된 값을 그대로 다시 Generator에 돌려주면 될 것이다.
<br />

아래는 위의 설명을 그대로 구현한 `run`이라는 helper function이다.

```
function run(generator, ...args) {
  const iter = generator(args);
  function resumeIter(prevRes) {
    const next = iter.next(prevRes);
    if (next.done) return Promise.resolve(next.value);
    Promise.resolve(next.value)
      .then(res => {
        resumeIter(res);
      });
  }

  resumeIter();
}
```
<br />

`run`이 있으면 위의 리팩토링된 코드를 다시 리팩토링할 수 있다.

```
function* main() {
  const res = yield axios.get('http://some-url/resources');
  renderData(res.data);
}

run(main);
```
<br />

이제 이 코드에서 비동기성이라고는 찾아볼 수 없게 되었다. 완벽하게 동기적으로 추상화시켰다. 그것도 매우 깔끔하게!
<br />

물론 위의 `run`은 *매우* 비효율적이고 문제가 많은 코드이다. 발생한 error도 처리하지 않고, 여러개의 generator을 동시에 처리하지도 못하며, 여러개의 Promise를 병렬적으로 실행시키지도 못한다. 하지만 이는 해당 기능들을 추가하면 되는 문제이다. 예를 들어 아래는 Iterator가 yield한 Promise가 reject 된 경우를 추가로 처리하는 `run`이다.

```
function run(generator, ...args) {
  const iter = generator(args)
  function fulfilledHandler(res) {
    const next = iter.next(res);
    if (next.done) return Promise.resolve(next.value);
    Promise.resolve(next.value)
      .then(fulfilledHandler, rejectedHandler);
  }

  function rejectedHandler(err) {
    const next = iter.throw(err);
    if (next.done) return Promise.resolve(next.value);
    Promise.resolve(next.value)
      .then(fulfilledHandler, rejectedHandler);
  }

  return fulfilledHandler();
}
```
<br />

## async와 await과의 비교

위의 `main` Generator의 코드를 다시 잘 보자.

```
function* main() {
  const res = yield axios.get('http://some-url/resources');
  renderData(res.data);
}
```

이거 어디서 많이 보던 코드 아닌가?

```
async function main() {
  const res = await axios.get('http://some-url/resources');
  renderData(res.data);
}
```

그렇다. ES8의 `async`, `await`과 형태가 완전 똑같다. 실제로 이 둘의 ES6 polyfill 구현에서 generator가 사용되는 것을 보았다. 이건 내 추측이긴 한데, 아마 ES8에서 `async`, `await`이 동일한 원리로 구현되어 있는 것이 아닐까 싶다.
<br />

사실 위의 Promise + Generator을 활용한 비동기 프로그래밍의 동기식 프로그래밍으로의 추상화는 알아봤자 이미 `async`, `await`이 나왔기 때문에 큰 의미가 없을지도 모른다. 하지만 내가 정말 애용하던 `async`와 `await`의 작동 원리를 공부한 것만으로도 충분히 재미있었고, 무엇보다 Generator를 위와 같은 방식으로 사용할 생각을 했다는 사실 자체가 나에게는 아주 인상 깊었다.
<br />