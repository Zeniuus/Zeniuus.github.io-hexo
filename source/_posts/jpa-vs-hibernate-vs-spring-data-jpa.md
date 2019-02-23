---
title: JPA, Hibernate, 그리고 Spring Data JPA의 차이점
date: 2019-02-24 00:43:42
categories:
  - Develop
---
## 개요

Spring 프레임워크는 어플리케이션을 개발할 때 필요한 수많은 강력하고 편리한 기능을 제공해준다. 하지만 많은 기술이 존재하는 만큼 Spring 프레임워크를 처음 사용하는 사람이 Spring 프레임워크에 대한 정확한 이해를 하기는 매우 어렵다.
<br />

내가 특히 오랜 기간동안 혼란스러워했던 부분은 JPA와 관련된 개념이었다. JPA 관련 서적을 읽을 때에는 분명 `EntityManager`를 통해 entity CRUD를 했는데, 실제 어플리케이션 코드를 보니 `EntityManager`는 찾아볼 수 없고 웬 `Repository` 인터페이스라는 놈만 쓰이고 있었다. 덕분에 내 안에서는 JPA, Hibernate, Repository에 대한 개념이 뒤섞이게 되었고, 개념을 바로 잡는 데에 꽤나 많은 노력을 기울여야만 했다.
<br />

개인적으로 나는 사용하는 기술에 대해 정확한 개념을 가지고 있는 것이 좋은 코드의 시작점이라 생각한다. 그래서 이러한 개념의 혼동을 줄이는 데에 조금이나마 도움이 되기 위해 이번 글에서는 JPA, Hibernate, 그리고 Spring Data JPA(Repository)의 차이점에 대해 서술하였다.
<br />

## JPA는 기술 명세이다

JPA는 Java Persistence API의 약자로, **자바 어플리케이션에서 관계형 데이터베이스를 사용하는 방식을 정의한 인터페이스**이다. 여기서 중요하게 여겨야 할 부분은, JPA는 말 그대로 **인터페이스**라는 점이다. JPA는 특정 기능을 하는 **라이브러리가 아니다**. 마치 일반적인 백엔드 API가 클라이언트가 어떻게 서버를 사용해야 하는지를 정의한 것처럼, JPA 역시 자바 어플리케이션에서 관계형 데이터베이스를 어떻게 사용해야 하는지를 정의하는 한 방법일 뿐이다.
<br />

JPA는 단순히 명세이기 때문에 구현이 없다. JPA를 정의한 `javax.persistence` 패키지의 대부분은 `interface`, `enum`, `Exception`, 그리고 각종 `Annotation`으로 이루어져 있다. 예를 들어, JPA의 핵심이 되는 `EntityManager`는 아래와 같이 `javax.persistence.EntityManager` 라는 파일에 `interface`로 정의되어 있다.

{% codeblock lang:Java %}
package javax.persistence;

import ...

public interface EntityManager {

    public void persist(Object entity);

    public <T> T merge(T entity);

    public void remove(Object entity);

    public <T> T find(Class<T> entityClass, Object primaryKey);

    // More interface methods...
}
{% endcodeblock %}
<br />

## Hibernate는 JPA의 구현체이다

Hibernate는 **JPA라는 명세의 구현체**이다. 즉, 위에서 언급한 `javax.persistence.EntityManager	`와 같은 인터페이스를 직접 구현한 라이브러리이다. **JPA와 Hibernate는 마치 자바의 interface와 해당 interface를 구현한 class와 같은 관계**이다.

![JPA와 Hibernate의 상속 및 구현 관계](/images/jpa_hibernate_repository/jpa_hibernate_relationship.png)

위 사진은 JPA와 Hibernate의 상속 및 구현 관계를 나타낸 것이다. JPA의 핵심인 `EntityManagerFactory`, `EntityManager`, `EntityTransaction`을 Hibernate에서는 각각 `SessionFactory`, `Session`, `Transaction`으로 상속받고 각각 `Impl`로 구현하고 있음을 확인할 수 있다.
<br />

"Hibernate는 JPA의 구현체이다"로부터 도출되는 중요한 결론 중 하나는 **JPA를 사용하기 위해서 반드시 Hibernate를 사용할 필요가 없다**는 것이다. Hibernate의 작동 방식이 마음에 들지 않는다면 언제든지 DataNucleus, EclipseLink 등 다른 JPA 구현체를 사용해도 되고, 심지어 본인이 직접 JPA를 구현해서 사용할 수도 있다. 다만 그렇게 하지 않는 이유는 단지 Hibernate가 굉장히 성숙한 라이브러리이기 때문일 뿐이다.
<br />

## Spring Data JPA는 JPA를 쓰기 편하게 만들어놓은 모듈이다

필자는 Spring으로 개발하면서 단 한 번도 `EntityManager`를 직접 다뤄본 적이 없다. DB에 접근할 필요가 있는 대부분의 상황에서는 `Repository`를 정의하여 사용했다. 아마 다른 분들도 다 비슷할 것이라 생각한다. 이 `Repository`가 바로 Spring Data JPA의 핵심이다.
<br />

Spring Data JPA는 Spring에서 제공하는 모듈 중 하나로, 개발자가 JPA를 더 쉽고 편하게 사용할 수 있도록 도와준다. 이는 **JPA를 한 단계 추상화시킨 `Repository`라는 인터페이스를 제공함으로써 이루어진다**. 사용자가 `Repository` 인터페이스에 정해진 규칙대로 메소드를 입력하면, Spring이 알아서 해당 메소드 이름에 적합한 쿼리를 날리는 구현체를 만들어서 Bean으로 등록해준다.
<br />

Spring Data JPA가 JPA를 추상화했다는 말은, **Spring Data JPA의 `Repository`의 구현에서 JPA를 사용하고 있다**는 것이다. 예를 들어, `Repository` 인터페이스의 기본 구현체인 `SimpleJpaRepository`의 코드를 보면 아래와 같이 내부적으로 `EntityManager`을 사용하고 있는 것을 볼 수 있다.

{% codeblock lang:Java %}
package org.springframework.data.jpa.repository.support;

import ...

public class SimpleJpaRepository<T, ID> implements JpaRepositoryImplementation<T, ID> {

    private final EntityManager em;

    public Optional<T> findById(ID id) {

        Assert.notNull(id, ID_MUST_NOT_BE_NULL);

        Class<T> domainType = getDomainClass();

        if (metadata == null) {
            return Optional.ofNullable(em.find(domainType, id));
        }

        LockModeType type = metadata.getLockModeType();

        Map<String, Object> hints = getQueryHints().withFetchGraphs(em).asMap();

        return Optional.ofNullable(type == null ? em.find(domainType, id, hints) : em.find(domainType, id, type, hints));
    }

    // Other methods...
}
{% endcodeblock %}
<br />

## 요약 - 셋을 혼동하지 말고 사용하자

아래 사진은 위의 내용을 요약하여 JPA, Hibernate, 그리고 Spring Data JPA의 전반적인 개념을 그림으로 표현한 것이다.

![JPA, Hibernate, Spring Data JPA의 전반적인 그림](/images/jpa_hibernate_repository/overall_design.png)

특히 JPA와 Spring Data JPA는 똑같이 JPA가 들어가서 처음 접하는 사람은 상당히 헷갈릴 수 있다. 이 세 개념의 차이점을 정확히 인지하고 숙지하고 있으면 개발이 한층 편해질 것이다.
<br />

## 레퍼런스

* [JBoss Hibernate docs](http://docs.jboss.org/hibernate/orm/5.4/userguide/html_single/Hibernate_User_Guide.html)
