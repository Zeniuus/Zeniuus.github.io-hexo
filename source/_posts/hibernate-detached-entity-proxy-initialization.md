---
title: Hibernate Detached 엔티티 프록시의 초기화
date: 2019-10-27 17:30:38
categories:
  - Develop
---
## 문제 상황

Spring + Hibernate + Spring Data JPA 환경에서 다음과 같은 상황이 있었다.
{% codeblock lang:Kotlin %}
fun doSomeTask(transactionTemplate: TransactionTemplate, entityRepository: EntityRepository) {
  val entity = transactionTemplate.execute {
    entityRepository.findById(entityId)
  }
  serializableTransactionTemplate.execute {
    /* Do some task */
  }
  println(entity.otherEntity.field) /* LazyInitializtionException? */
}
{% endcodeblock %}

나는 `println(entity.otherEntity.field)`에서 분명 `LazyInitializationException`이 뜰 것이라고 기대했다. 왜냐하면 이미 `entity`를 가져온 `EntityManager`는 `transactionTemplate.execute {}`가 끝나는 시점에 닫혔을 것이기 때문이다. 실제로 로그에 남아있는 내용도 내가 예상한 `EntityManager`의 라이프사이클과 같았다.
```
2019-10-26 14:29:38.550 DEBUG 84541 --- [  restartedMain] o.s.orm.jpa.JpaTransactionManager        : Opened new EntityManager [SessionImpl(1800396726<open>)] for JPA transaction
2019-10-26 14:29:38.555 DEBUG 84541 --- [  restartedMain] o.s.orm.jpa.JpaTransactionManager        : Exposing JPA transaction as JDBC [org.springframework.orm.jpa.vendor.HibernateJpaDialect$HibernateConnectionHandle@17d82972]
2019-10-26 14:29:39.824 DEBUG 84541 --- [  restartedMain] o.s.orm.jpa.JpaTransactionManager        : Found thread-bound EntityManager [SessionImpl(1800396726<open>)] for JPA transaction
2019-10-26 14:29:39.825 DEBUG 84541 --- [  restartedMain] o.s.orm.jpa.JpaTransactionManager        : Participating in existing transaction
Hibernate: 
    select
        ...
    from
        entity entiity0_ 
    where
        entity0_.id=?
2019-10-26 14:29:40.481 DEBUG 84541 --- [  restartedMain] o.s.orm.jpa.JpaTransactionManager        : Initiating transaction commit
2019-10-26 14:29:40.481 DEBUG 84541 --- [  restartedMain] o.s.orm.jpa.JpaTransactionManager        : Committing JPA transaction on EntityManager [SessionImpl(1800396726<open>)]
2019-10-26 14:29:40.487 DEBUG 84541 --- [  restartedMain] o.s.orm.jpa.JpaTransactionManager        : Closing JPA EntityManager [SessionImpl(1800396726<open>)] after transaction
```

그러면 `entity`는 detached 상태가 되고, `println` 절에서 `entity.otherEntity.field`에 접근할 때 아직 `otherEntity`가 초기화되지 않은 상황이기 때문에 `LazyInitializationException`이 났어야 한다.

하지만 실제로는 오류가 발생하지 않고 데이터가 잘 가져와졌다. 왜일까?
<br>
## EntityManager의 라이프사이클

`TransactionTemplate.execute()`은 Spring에서 명시적으로 트랜잭션 범위를 관리할 때 사용하는 도구이다. 이 함수의 구현을 보면 대략 다음과 같이 생겼다 :
{% codeblock lang:Java %}
/* TransactionTemplate.java */
/* pseudo-code */
public <T> T execute(TransactionCallback<T> action) throws TransactionException {
  TransactionStatus status = this.transactionManager.getTransaction(this);
  T result;
  try {
    result = action.doInTransaction(status);
  }
  catch (Throwable ex) {
    rollbackOnException(status, ex);
    throw ex;
  }
  this.transactionManager.commit(status);
  return result;
}
{% endcodeblock %}
정리하면,

1. `PlatformTransactionManager`에서 트랜잭션을 하나 가져오고,
2. 그 안에서 코드를 실행한다.
3. 성공하면 커밋, 실패하면 롤백한다.

위 코드를 보면 `PlatformTransactionManager`의 구현체로 어떤 것을 사용하느냐에 따라 `TransactionTemplate.execute()`의 동작 방식이 달라진다는 사실을 알 수 있다. 타다 서버에서는 JPA를 사용하고 있기 때문에 이미 Bean 설정으로 `PlatformTransactionManager`의 구현체를 `JpaTransactionManager`로 설정해놓은 상황이다. `JpaTransactionManager`은 트랜잭션이 생성될 때 이미 해당 쓰레드에 바인딩 된 `EntityManager`가 없을 경우 새로운 `EntityManager`을 만들어주고, 트랜잭션이 종료(커밋/롤백)될 때 `EntityManager`을 닫아주는 역할을 한다.

코드를 통해 좀 더 자세히 들여다보자. 우선 트랜잭션을 열고 `EntityManager`을 만드는 코드이다. `TransactionTemplate.execute()`가 호출하는 `PlatformTransactionManager.getTransaction()`은 `JpaTransactionManager.doGetTransaction()`과 `JpaTransactionManager.doBegin()`에게 트랜잭션 생성과 시작을 위임한다. 이 때 `JpaTransactionManager.doBegin()`은 트랜잭션에 달린 `EntityManager`가 없으면 새로 만들어준다.
{% codeblock lang:Java %}
/* JpaTransactionManager.java */
/* pseudo-code */
protected void doBegin(Object transaction, TransactionDefinition definition) {
  JpaTransactionObject txObject = (JpaTransactionObject) transaction;
  if (!txObject.hasEntityManagerHolder()) {
    EntityManager newEm = createEntityManagerForTransaction();
    txObject.setEntityManagerHolder(new EntityManagerHolder(newEm), true);
  }
}
{% endcodeblock %}

다음은 `EntityManager`가 어떻게 닫히는지 살펴보자. `TransactionTemplate.execute()` 내에서 `PlatformTransactionManager.commit()`(혹은 `rollback()`)이 호출되면 최종적으로 `JpaTransactionManager.doCleanupAfterCompletion()` 함수가 호출된다. 이 함수에서 트랜잭션에 달려있는 `EntityManager`을 닫게 된다.
{% codeblock lang:Java %}
/* JpaTransactionManager.java */
/* pseudo-code */
protected void doCleanupAfterCompletion(Object transaction) {
  JpaTransactionObject txObject = (JpaTransactionObject) transaction;
  if (txObject.isNewEntityManagerHolder()) {
    EntityManager em = txObject.getEntityManagerHolder().getEntityManager();
    EntityManagerFactoryUtils.closeEntityManager(em);
  }
}
{% endcodeblock %}

정리하면, **`JpaTransactionManager`가 `EntityManager`의 라이프사이클을 트랜잭션과 동일하게 관리해준다**(참고 : 한 쓰레드에서 여러 트랜잭션이 열릴 경우에는 `EntityManager`의 라이프사이클이 트랜잭션의 라이프사이클과 일치하지 않을 수 있다).

1. 트랜잭션을 시작할 때 `EntityManager`을 만들고 트랜잭션에 붙여준다.
2. 트랜잭션을 종료할 때 트랜잭션에 붙어있는 `EntityManager`을 제거한다.

이는 `@Transactional` 어노테이션을 활용한 선언적 트랜잭션 관리에서도 마찬가지로 적용된다.
<br>
## Detached 엔티티 프록시의 초기화

`EntityManager`가 닫히면 해당 `EntityManager`의 persistence context에 들어있는 모든 엔티티가 detached 상태로 변한다고 한다. 이는 맞는 말이다. 하지만 이번 문제를 해결하려고 디버그 모드를 사용하여 이리저리 코드를 탐색한 결과 흥미로운 사실을 발견했다.

Hibernate의 `EntityManager` 구현체인 `SessionImpl`은 내부적으로 `StatefulPersistenceContext`라는 클래스를 `PersistenceContext`의 구현체로 사용한다. 방금 전에 살펴보았던 `JpaTransactionManager.doCleanupAfterCompletion()` 함수에서는 `EntityManagerFactoryUtils.closeEntityManager(em)`을 호출하는데, 이 함수를 타고 들어가다 보면 `SessionImpl.cleanupOnClose()`라는 함수를 호출하고, 이 함수는 내부적으로 다시 `StatefulPersistenceContext.clear()` 함수를 호출한다. 즉, **`EntityManager`가 닫힐 때 persistence context를 clear 한다**는 이야기이다. 그러면 `StatefulPersistenceContext.clear()`가 어떤 일을 하는지 알아보자.
{% codeblock lang:Java %}
/* StatefulPersistenceContext.java */
/* pseudo-code */
public void clear() {
  for ( Object o : proxiesByKey.values() ) {
    ((HibernateProxy) o).getHibernateLazyInitializer().unsetSession();
  }
}
{% endcodeblock %}

**persistence context가 닫힐 때에는 해당 context 내의 아직 initialized 되지 않은 프록시가 있으면 `EntityManager`을 다 떼어내는 작업을 한다.** 여기서 "떼어내는 작업(`((HibernateProxy) o).getHibernateLazyInitializer().unsetSession();`)"의 구현을 좀 더 살펴보자.
{% codeblock lang:Java %}
/* AbstractLazyInitializer.java */
/* pseudo-code */
public final void unsetSession() {
  prepareForPossibleLoadingOutsideTransaction();
  session = null;
  readOnly = false;
  readOnlyBeforeAttachedToSession = null;
}

protected void prepareForPossibleLoadingOutsideTransaction() {
  if ( session != null ) {
    allowLoadOutsideTransaction = session.getFactory().getSessionFactoryOptions().isInitializeLazyStateOutsideTransactionsEnabled();

    if ( allowLoadOutsideTransaction && sessionFactoryUuid == null ) {
      sessionFactoryUuid = session.getFactory().getUuid();
    }
  }
}
{% endcodeblock %}

`isInitializeLazyStateOutsideTransactionsEnabled` 옵션이 true로 세팅되어 있을 경우, **`EntityManager`을 프록시로부터 떼어낼 때 lazy initializer에게 현재 `EntityManagerFactory`의 id를 저장**해놓는다. 이렇게 되면 **나중에 transaction 바깥에 있는 detached 상태에서 프록시에 접근하더라도 `EntityManagerFactory`에서 `EntityManager`을 만들어 프록시를 초기화할 수 있다.**
{% codeblock lang:Java %}
/* AbstractLazyInitializer.java */
/* pseudo-code */
public final void initialize() throws HibernateException {
  if ( !initialized ) {
    if ( allowLoadOutsideTransaction ) {
      permissiveInitialization();
    }
  }
}

protected void permissiveInitialization() {
  if ( session == null ) {
    if ( sessionFactoryUuid == null ) {
      throw new LazyInitializationException( "could not initialize proxy [" + entityName + "#" + id + "] - no Session" );
    }
    SessionFactoryImplementor sf = (SessionFactoryImplementor)
        SessionFactoryRegistry.INSTANCE.getSessionFactory( sessionFactoryUuid );
    SharedSessionContractImplementor session = (SharedSessionContractImplementor) sf.openSession();
    session.beginTransaction();
    target = session.immediateLoad( entityName, id );
    session.getTransaction().commit();
    session.close();
  }
}
{% endcodeblock %}

정리하면, `EntityManager`가 닫힐 때 엔티티 프록시에서 `EntityManager`가 떨어져 나가는데, 이 때 `SessionFactoryOptions.isInitializeLazyStateOutsideTransactionsEnabled()`가 true로 설정되어 있으면 `EntityManagerFactory`에 대한 레퍼런스를 저장해놓는다. 그리고 프록시에 접근이 일어날 때 해당 `EntityManagerFactory`에서 새로운 `EntityManager`와 트랜잭션을 만들고, 그 안에서 프록시를 초기화한다.

`SessionFactoryOptions.isInitializeLazyStateOutsideTransactionsEnabled()`는 Hibernate의 `hibernate.enable_lazy_load_no_trans` property를 통해 조절할 수 있다. 내가 문제 상황의 코드를 실행했던 환경에서는 위 설정이 true로 되어있었기 때문에 `LazyInitializationException`이 발생하지 않았던 것이다. 실제로 `hibernate.enable_lazy_load_no_trans` 설정을 false로 변경한 후 다시 실행시켜보았더니 `LazyInitializationException`이 발생했다.
<br>
## enable_lazy_load_no_trans 설정은 안티 패턴이다

하지만 이와 같은 수단은 [이 사이트](https://vladmihalcea.com/the-hibernate-enable_lazy_load_no_trans-anti-pattern/)에 나와있듯이 `LazyInitializationException`을 피해가기 위한 편법에 불가하다. N+1 문제를 방지할 수 없는 것은 물론이고, 프록시를 초기화할 때마다 새로운 `EntityManager`와 트랜잭션을 열고 닫고를 반복해야 하고, 이에 따라 JDBC 커넥션도 점유했다 반납했다를 반복하게 된다. 이는 리소스 낭비다. 이런 옵션이 필요한 상황이 있다면 트랜잭션과 `EntityManager`가 닫히기 전에 원하는 엔티티를 미리 초기화해놓는 방식으로 해결해야 할 것이다.
