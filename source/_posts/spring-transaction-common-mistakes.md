---
title: Spring Transaction 사용 시 주의할 점
date: 2020-01-16 23:03:44
categories:
  - Develop
---
## 개요

최근 몇 달 간 내가 Spring에서 트랜잭션을 사용할 때 겪었던 여러 문제 상황에 대해서 이야기하려고 한다.
<br>

## 트랜잭션 안에서 트랜잭션을 새로 여는 경우

트랜잭션 안에서 새로운 트랜잭션을 열 때의 동작 방식, 혹은 propagation behavior에 대해 Spring은 다양한 옵션을 제공하고 있다. 일반적으로 사용할 수 있는 옵션은 `TransactionDefinition.PROPAGATION_REQUIRED`와 `TransactionDefinition.PROPAGATION_REQUIRES_NEW`이다.

### PROPAGATION_REQUIRED를 사용할 때 주의사항

Spring이 기본값으로 사용하는 propagation behavior는 `PROPAGTION_REQUIRED`이다. 이 옵션을 사용하면 어떤 트랜잭션 안에서 `TransactionTemplate`을 통해 트랜잭션을 열려고 시도할 경우, `AbstractPlatformTransactionManager.getTransaction()`는 이미 열려있는 기존 트랜잭션을 반환한다. 즉, **새로운 트랜잭션이 열리는 게 아니라 기존 트랜잭션에 참여**하게 된다.

이로 인해 발생하는 눈여겨 볼만한 특징에는 두 가지가 있다. 첫 번째 포인트는 **안쪽 트랜잭션이 롤백되면 바깥쪽 트랜잭션도 롤백된다**는 것이다. 이는 코드 상으로 분리되어 보이는 두 트랜잭션이 사실 한 트랜잭션 안에서 실행되고 있기 때문이다.

{% codeblock lang:Kotlin %}
transactionTemplate.execute {
  val person = Person(name = "Suhwan Jee")
  personRepository.save(person) /* Spring Data JPA */

  try {
    transactionTemplate.execute {
      throw Exception("some unexpected exception")
    }
  } catch (e: Exception) {
  }
}
{% endcodeblock %}

위 코드가 실행되더라도 `Person(name = "Suhwan Jee")`은 DB에 저장되지 않는다. 안쪽 트랜잭션에서 예외가 던져지면 해당 쓰레드에 rollback only mark가 남는다. 그리고 바깥쪽 트랜잭션이 커밋되려고 하면 이 rollback only mark 때문에 `UnexpectedRollbackException` 예외가 던져지면서 트랜잭션이 커밋되지 않고 롤백된다.

두 번째는 **내부 트랜잭션을 열 때 사용한 `TransactionDefinition`이 적용되지 않는다**는 점이다. 예를 들어, 아래와 같이 트랜잭션을 연다고 해보자.

{% codeblock lang:Kotlin %}
val serializableTxTemplate = TransactionTemplate().apply {
  transactionManager = transactionTemplate.transactionManager
  isolationLevel = TransactionDefinition.ISOLATION_SERIALIZABLE
}

transactionTemplate.execute {
  println("hihi 1")

  serializableTxTemplate.execute {
    println("hihi 2")
  }
}
{% endcodeblock %}

여기서 기대하는 동작 방식은 `println("hihi 2")`가 isolation level이 `SERIALIZABLE`인 환경에서 실행되는 것이다. 하지만 앞서 말했듯이 `println("hihi 1")`과 `printlln("hihi 2")`가 다른 트랜잭션에서 실행되는 것처럼 보이지만, 두 코드는 사실 같은 트랜잭션 안에서 실행된다. 따라서 위 코드를 실행해도 `println("hihi 2")`는 `REPEATABLE READ` isolation level인 환경에서 실행된다.

**완전히 새롭고 독립적인 트랜잭션을 열기 위해서는 안쪽 트랜잭션의 propagation behavior를 `PROPAGATION_REQUIRES_NEW`로 지정해줘야 한다.** 바로 아래와 같이 말이다.

{% codeblock lang:Kotlin %}
val serializableTxTemplate = TransactionTemplate().apply {
  transactionManager = transactionTemplate.transactionManager
  isolationLevel = TransactionDefinition.ISOLATION_SERIALIZABLE
  propagationBehavior = TransactionDefinition.PROPAGATION_REQUIRES_NEW
}

transactionTemplate.execute {
  println("hihi 1")

  serializableTxTemplate.execute { /* 정말 새로운 트랜잭션이 열린다. */
    println("hihi 2")
  }
}
{% endcodeblock %}

이러면 `serializableTxTemplate.execute {}`는 기대한 대로 새로운 physical connection에서 새로운 entity manager를 가지고 isolation level이 `SERIALIZABLE`인 새로운 트랜잭션을 연다. 두 트랜잭션은 이제 롤백도 독립적으로 이루어진다(물론 안쪽 트랜잭션에서 예외가 던져졌을 때는 바깥쪽 트랜잭션에서 try-catch로 감싸야 바깥쪽 트랜잭션이 롤백되지 않는다).

하지만 완전히 새로운 트랜잭션이 열리기 때문에 주의해야 할 점도 생긴다. 일단 connection pool의 connection을 한 개 더 차지한다. 또한, 독립적으로 열린 두 트랜잭션 사이에 데드락이 걸릴 수 있다. 두 트랜잭션은 entity manager를 공유하지 않기 때문에 persistence context 역시 공유하지 않고, 이로 인한 쿼리 실행의 비효율이 발생할 수 있다.
<br>

## TransactionSynchronization.afterCommit()을 사용하는 경우

종종 어플리케이션을 작성하다 보면 반드시 DB에 커밋이 되고 난 이후에 어떤 행동을 하고 싶은 경우가 있다. 대표적으로 notification이 있다. 이 경우 보통  `TransactionSynchronization.afterCommit()`을 사용한다. 하지만 이때도 역시 주의해야 할 점이 몇 가지 있다.

### 새로운 트랜잭션을 열 때 주의사항

트랜잭션 Synchronization 중 `afterCommit()`과 관련된 코드는 `AbstractPlatformTransactionManager.processCommit()`에서 찾아볼 수 있다. 함수의 흐름을 대강 이야기하자면 아래와 같다.

1. 실제 commit을 수행한다(`AbstractPlatformTransactionManager.doCommit()`)
2. after commit을 수행한다(`TransactionSynchronization.afterCommit()`).
3. after completion을 수행한다(`TransactionSynchronization.afterCompletion()`).
4. 트랜잭션 리소스를 정리한다(`AbstractPlatformTransactionManager.cleanupAfterCompletion()`).

여기서 중요한 사실은, 4번에서 트랜잭션 리소스가 정리되기 전까지 기존 트랜잭션에서 사용한 여러가지 리소스, 즉 `TransactionDefinition`, entity manager, physical connection은 여전히 살아있는 상태다. 그래서 **`afterCommit()` 안에서 트랜잭션을 열면 기존의 physical connection 위에서, 기존의 entity manager를 가지고, 기존의 `TransactionDefinition` 를 사용해서 트랜잭션이 열린다.** 그래서 트랜잭션 안에서 트랜잭션을 열려고 하는 상황과 동일하게 `TransactionDefinition`이 제대로 동작하지 않는다. 이 문제는 마찬가지로 `PROPAGATION_REQUIRES_NEW`를 사용하면 해결할 수 있다.

`afterCommit()` 안에서 트랜잭션을 여는 것이 위의 트랜잭션 안에서 트랜잭션을 새로 여는 경우와 다른 점은, 이미 **기존 트랜잭션이 커밋되었다는 사실**이다. 즉, `afterCommit()` 안에서 새로운 트랜잭션을 열려고 하면 실제로 DB에서 새로운 트랜잭션이 열린다. 따라서 `afterCommit()` 안에서의 트랜잭션이 롤백되더라도 기존 트랜잭션은 롤백되지 않는다.

### JPA를 사용할 때 주의사항

이번에는 JPA를 사용하는 경우 헷갈리는 점이다. **기존 트랜잭션에서 가져온 entity를 `afterCommit()` 안에서 접근해서 lazy load** 하려고 하면 어떻게 될까?

{% codeblock lang:Kotlin %}
transactionTemplate.execute {
  val person = personRepository.findFirstByName("Suhwan Jee") /* Spring Data JPA */

  TransactionSynchronizationManager.registerSynchronization(object : TransactionSynchronization {
    override fun afterCommit() {
      println(person.home.address) /* What happens? */
    }
  })
}
{% endcodeblock %}

정답은 **"잘 된다"**다. 이는 **entity를 lazy load 할 수 없게 되는 시점이 `cleanupAfterCompletion()`이기 때문**이다. `cleanupAfterCompletion()`에서 `JpaTransactionManager`는 entity manager와 persistence context를 닫고, persistence context의 entity를 detached 상태로 만든다. 이 때 entity는 lazy loading을 할 수 없는 상태로 빠진다(자세한 내용은 [이전 블로그 글](/2019/10/27/hibernate-detached-entity-proxy-initialization/)에 나와있다). 따라서 `cleanupAfterCompletion()` 이전에 호출되는 `afterCommit()` 내부에서는 기존 트랜잭션에서 불러온 entity에 안전하게 접근하고 lazy load 할 수 있다.
<br>

## Spring Reactor와 함께 사용하는 경우

Spring에서 설계한 트랜잭션 관리는 기본적으로 `ThreadLocal`을 사용한 thread-bounded 시스템이다. 따라서 쓰레드가 휙휙 바뀌는 Project Reactor(혹은 RxJava)와 Spring 트랜잭션 관리를 함께 이용할 때 여러가지 문제가 발생할 수 있다(물론 최근에 [reactive transaction](https://spring.io/blog/2019/05/16/reactive-transactions-with-spring)을 위한 업데이트가 있긴 했지만, 항상 최신 버전의 framework를 사용하는 것은 쉽지 않은 일이다).

### JPA를 사용할 때 주의사항

Reactor에서 특정 작업 후 `map()` 같은 함수를 활용해서 다른 작업을 하면 일반적으로 그 작업은 `map()`를 호출한 쓰레드와는 다른 쓰레드에서 실행된다. 즉, **트랜잭션이 종료된 환경에서 실행**된다. 따라서 Hibernate를 사용하는 경우, 이런 상황에서 기존 트랜잭션의 entity에 잘못 접근하면 `LazyInitializationException`이 발생할 수 있다.

{% codeblock lang:Kotlin %}
return transactionTemplate.execute {
  val person = personRepository.findById("personId")
  Mono.fromCallable {
    someHeavyJob(person)
  }
    .subscribeOn(Schedulers.elastic())
    .map {
      doSomething(person) /* might throw LazyInitializationException! */
    }
}!!
{% endcodeblock %}

이 경우 몇 가지 해결책이 있는데, 1. 트랜잭션이 종료된 이후에 사용할 entity를 트랜잭션이 종료되기 전에 미리 loading 해놓거나 2. `Mono.map()` 안에서 트랜잭션을 새로 열고 새로운 entity를 가져와서 사용하면 된다. 아래는 2번 해결책에 대한 코드다.

{% codeblock lang:Kotlin %}
return transactionTemplate.execute {
  val person = personRepository.findById("personId")
  Mono.fromCallable {
    someHeavyJob(person)
  }
    .subscribeOn(Schedulers.elastic())
    .map {
      transactionTemplate.execute {
        val reloadedPerson = personRepository.findById("personId")
        doSomething(reloadedPerson)
      }
    }
}!!
{% endcodeblock %}

### block()을 호출할 때 주의사항

다른 문제 상황 중 하나는 **`block()`을 호출할 때 데드락이 발생**하는 상황이다. 아래와 같이 `Mono.block()`을 호출하는 코드가 있다고 해보자.

{% codeblock lang:Kotlin %}
return serializableTxTemplate.execute {
  val person = personRepository.findById("personId")
  Mono.fromCallable {
    someHeavyJob(person)
  }
    .subscribeOn(Schedulers.elastic())
    .map { result ->
      serializableTxTemplate.execute {
        val reloadedPerson = personRepository.findById("personId")
        updatePersonStatus(reloadedPerson, result) /* person을 수정한다. */
      }!!
    }
    .block()!!
}!!
{% endcodeblock %}

위 코드를 실행하면 person에 대해 데드락이 발생한다. 우선 2번째 줄에서 메인 쓰레드의 트랜잭션이 S lock을 잡는다. 이후 `Schedulers.elastic()`의 쓰레드의 트랜잭션이 10번째 줄에서 X lock을 잡으려고 할 때, 이미 person에는 S lock이 걸려있는 상태이므로 대기 상태에 빠진다. 하지만 S lock이 풀리는 일은 없다. 왜냐하면 S lock을 잡고 있는 메인 쓰레드는 `Schedulers.elastic()`의 쓰레드가 종료되기를 기다리고 있기 때문이다.

이 부분에 대한 해결책은 의외로 간단하다. `block()`을 트랜잭션 바깥에서 하면 된다.

{% codeblock lang:Kotlin %}
val resultMono = serializableTxTemplate.execute {
  val person = personRepository.findById("personId")
  Mono.fromCallable {
    someHeavyJob(person)
  }
    .subscribeOn(Schedulers.elastic())
    .map { result ->
      serializableTxTemplate.execute {
        val reloadedPerson = personRepository.findById("personId")
        updatePersonStatus(reloadedPerson, result) /* person을 수정한다. */
      }!!
    }
}!!
return resultMono.block()!!
{% endcodeblock %}

이러면 `Mono.map()` 함수 내부에서 `updatePersonStatus()`가 실행될 때 person에는 아무런 lock도 잡혀있지 않은 상태다. 따라서 `Schedulers.elastic()` 쓰레드는 정상적으로 person의 상태를 수정하고 종료되고, 메인 쓰레드 역시 정상적으로 `resultMono`의 결과물을 반환하고 종료된다.
<br>

## 정리

트랜잭션을 예측 가능하게 사용하는 것은 어플리케이션 개발에서 매우 중요하다. Spring에서 트랜잭션을 어떻게 관리하는지를 잘 파악하고, 관련된 기술 역시 잘 파악해서 의도치 못한 장애가 발생하는 것을 막도록 하자.
