---
title: Spring Testing - Context Management and Caching
date: 2019-03-27 16:14:46
categories:
  - Develop
---
## 개요

최근 들어 회사에서 테스트 성능이 문제가 된 경우가 몇 번 있었다. 이를 해결하기 위해 [Spring의 Testing 레퍼런스](https://docs.spring.io/spring/docs/current/spring-framework-reference/testing.html)를 정독하며 테스트의 동작 방식에 대해서 파헤쳐보았다. 비록 내가 내린 결론은 테스트 툴을 더 잘 활용하여 빌드 속도를 끌어올리기는 어렵다는 것이었지만, 그래도 내가 모르고 있었던 테스트 작동 방식에 대해서 더 깊이 이해할 수 있었던 좋은 기회였다.<br />
이번 글에서는 Spring에서 intergration test를 위해 제공하는 주요 기능 중의 하나인 **context management 및 caching**에 대해서 정리해보았다.

<br />


## Context Management

**Spring으로 작성된 application의 integration test를 돌리기 위해서는 `ApplicationContext`가 필요**하다. Unit test와는 달리 두 개 이상의 bean이 함께 작동했을 때 의도한 대로 작동하는 지를 확인해야 하기 때문이다. JUnit4를 기반으로 작성된 Spring의 integration test 실행 과정은 다음과 같다 :
1. 테스트 클래스의 instance를 생성한다. 이 때 instance는 no-args constructor를 통해 생성된다.
2. 테스트에 필요한 bean으로 `ApplicationContext`를 구성한다.
3. 2의 테스트 instance에, 1에서 생성한 `ApplicationContext`를 활용하여 필요한 bean을 주입한다.


Spring에서는 `TestContext`라는 프레임워크를 통해 테스트에서 사용할 `ApplicationContext`를 정의할 수 있다. 대표적으로 **`@ContextConfiguration`이라는 annotation을 활용하는 방법**이 있다. 테스트 클래스에 `@ContextConfiguration`을 붙이고 테스트에서 사용할 `@Configuration` 클래스나 `@Component` 클래스을 명시하면 된다. 아래는 Kotlin으로 작성한 예시 코드이다.

{% codeblock lang:Kotlin %}
/* Configuration & Component class definition */
class BeanA {}
class BeanB {}

@Configuration
class ConfigA {
    @Bean
    fun beanA(): BeanA {
        return BeanA()
    }
}

@Configuration
class ConfigB {
    @Bean
    fun beanB(): BeanB {
        return BeanB()
    }
}

@Component
class ComponentC {}

@Component
class ComponentD {}


/* Test code */
@RunWith(SpringRunner::class)
@ContextConfiguration(
    classes = [ConfigA::class, ComponentC::class]
)
class SomeIntegrationTest1 {
    @Autowired
    lateinit var beanA: BeanA

    @Autowired
    lateinit var componentC: ComponentC

    @Test
    fun someTest1() {
        /* some test code */
    }
}
{% endcodeblock %}

위의 예시에 대해서 조금 더 자세히 설명해보자면, 우선 몇 개의 `@Configuration` 클래스 및 `@Component` 클래스를 선언했다.
* `ConfigA` -> `BeanA`를 구성
* `ConfigB` -> `BeanB`를 구성
* `ComponentC`
* `ComponentD`

그리고 `SomeIntegrationTest1`에서는 `@ContextConfiguration` 의 `classes` attribute로 `ConfigA`와 `ComponentC`를 사용하겠다고 지정했다. 그러면 `SomeIntegrationTest1`을 돌릴 때 사용될 `ApplicationContext`는 `ConfigA`와 `ComponentC`만으로 구성되고 `ConfigB`와 `ComponentD`는 사용되지 않는다. 이런 방식으로 **테스트에서 실제로 필요한 bean만 생성하여 사용하고 불필요한 bean을 생성하여 성능이 저하되는 것을 방지**할 수 있다.

`@ContextConfiguration` 클래스의 `classes` attribute에는 다음과 같은 type의 class가 올 수 있다.
* `@Configuration` 클래스
* `@Component`, `@Service`, `@Repository` 등 stereotype 클래스
* 그 외 `@Bean` 메소드를 포함한 아무 클래스

<br />


## Context Caching

방금 전 상황에서는 테스트 클래스가 하나였다. 하지만 이제 테스트 클래스가 100개가 있다고 해보자. 당연히 CI를 하려면 전체 빌드를 돌려야 하고, 테스트 클래스 100개를 전부 다 돌려야 할 것이다. 이 때 `ApplicationContext` 생성 전략을 어떻게 취하면 될까?<br />
우선, 가장 쉬운 방법은 각 테스트를 돌릴 때마다 새로운 `ApplicationContext`를 생성하는 방법이 있다. 하지만 이 방법은 최악의 성능을 보일 것이다. `ApplicationContext`를 생성하는 데에 테스트 당 20~30초만 걸려도 전체 빌드를 돌리는 데에 1시간이 걸리는 기적을 볼 수 있다.<br />
그렇다고 하나 이상의 테스트에서 사용되는 모든 bean으로 구성된 `ApplicationContext` 한 번만 만들어서 전체 테스트에 대해 재사용하는 것 역시 좋지 않은 방법이다. 우선, 이는 몇 개의 테스트만 돌려보고 싶은 상황을 고려하지 않은 전략이다. 한 개의 테스트만 돌릴 것인데 다른 테스트에서 필요한 bean을 생성하는 것은 분명한 리소스 낭비이다. 또한, 테스트가  `ApplicationContext`를 오염시키는 경우 다음 테스트를 돌릴 때에는 어쩔 수 없이 새 `ApplicationContext`를 만들어야 하는데, 이 때 다시 수많은 bean을 생성해야 하므로 굉장히 오랜 시간이 걸릴 것이다.<br />
**Spring은 이러한 문제를 해결하기 위해 context caching 기능을 지원**한다. Spring `TestContext` 프레임워크는 한 번 `ApplicationContext`가 만들어지면 이를 캐시에 저장한다. 그리고 다른 테스트를 돌릴 때 **가능한 경우** 재사용한다. 여기서 **가능한 경우**란,
1. 같은 bean의 조합을 필요로 하고
2. 이전 테스트에서 `ApplicationContext`가 오염되지 않은 경우

를 의미한다. 물론 **context caching은 한 test suite 내에서만, 즉 한 JVM에서 실행되는 테스트 클래스에 대해서만 동작**한다.<br />
그렇다면 Spring `TestContext` 프레임워크는 두 테스트 클래스가 같은 bean의 조합을 필요로 하는지 어떻게 판별할까? 이 질문은 곧 context caching에서의 cache key가 무엇으로 구성되는 지와 동일하다. **Spring `TestContext` 프레임워크는 테스트 클래스의 여러 configuration으로 이 key를 구성**한다.
* `locations` (from `@ContextConfiguration`)
* `classes` (from `@ContextConfiguration`)
* `contextInitializerClasses` (from `@ContextConfiguration`)
* `contextCustomizers` (from `ContextCustomizerFactory`)
* `contextLoader` (from `@ContextConfiguration`)
* `parent` (from `@ContextHierarchy`)
* `activeProfiles` (from `@ActiveProfiles`)
* `propertySourceLocations` (from `@TestPropertySource`)
* `propertySourceProperties` (from `@TestPropertySource`)
* `resourceBasePath` (from `@WebAppConfiguration`)

여기서 놓치기 쉬운 점은 **어떤 bean을 mock으로 처리했느냐(Mockito의 `@MockBean`을 사용했느냐)가 `ApplicationContext` 재사용 여부에 영향을 미친다는 것**이다. Mockito의 `@MockBean`을 사용할 경우 `contextCustomizers`에 `MockitoContextCustomizer`가 추가되는데, 이 때문에 테스트 클래스에서 `@MockBean` 처리한 bean의 조합이 달라질 경우 cache key가 달라지게 된다. 따라서 비록 같은 `@ContextConfiguration` `classes` attributes를 가졌다고 하더라도 `@MockBean`의 조합이 달라지면 Spring `TestContext`는 `ApplicationContext`를 재사용하지 않는다.<br/>
(생각해보면 이는 당연한 일인데, 어떤 bean을 mocking 하는 일은 해당 bean을 변형시키는 일이라서 `ApplicationContext`가 오염되는 것과 마찬가지이기 때문이다.)<br />
아래는 위의 context caching 규칙을 예시를 통해 정리한 것이다. 아까 Context Management 부분에서 정의한 `ConfigA`, `ConfigB`, `ComponentC`, `ComponentD`가 정의되어 있다고 가정하자.<br />
{% codeblock lang:Kotlin %}
@RunWith(SpringRunner::class)
@ContextConfiguration(
    classes = [ConfigA::class]
)
class TestClass1 {
    @Test
    fun test() {
        /* some test code */
    }
}

@RunWith(SpringRunner::class)
@ContextConfiguration(
    classes = [ConfigA::class]
)
class TestClass2 {
    @Test
    fun test() {
        /* some test code */
    }
}

@RunWith(SpringRunner::class)
@ContextConfiguration(
    classes = [ConfigA::class]
)
class TestClass3 {
    @Autowired
    lateinit var beanA: BeanA

    @Test
    fun test() {
        /* some test code */
    }
}
{% endcodeblock %}
* 위 3개 테스트를 함께 돌리면 `ApplicationContext`는 한 번만 생성되고 3개 테스트에 대해서 모두 재사용된다. `@ContextConfiguration` 구성이 모두 같기 때문이다.

{% codeblock lang:Kotlin %}
@RunWith(SpringRunner::class)
@ContextConfiguration(
    classes = [ConfigA::class]
)
class TestClass4 {
    @Test
    fun test() {
        /* some test code */
    }
}

@RunWith(SpringRunner::class)
@ContextConfiguration(
    classes = [ConfigB::class]
)
class TestClass5 {
    @Test
    fun test() {
        /* some test code */
    }
}

@RunWith(SpringRunner::class)
@ContextConfiguration(
    classes = [ComponentC::class]
)
class TestClass6 {
    @Test
    fun test() {
        /* some test code */
    }
}

@RunWith(SpringRunner::class)
@ContextConfiguration(
    classes = [ComponentD::class]
)
class TestClass7 {
    @Test
    fun test() {
        /* some test code */
    }
}
{% endcodeblock %}
* 위 4개의 테스트를 함께 돌리면 매번 새 `ApplicationContext`를 생성한다. `@ContextConfiguration` 구성이 모두 다르기 때문이다.

{% codeblock lang:Kotlin %}
@RunWith(SpringRunner::class)
@ContextConfiguration(
    classes = [ConfigA::class, ConfigB::class]
)
class TestClass8 {
    @Test
    fun test() {
        /* some test code */
    }
}

@RunWith(SpringRunner::class)
@ContextConfiguration(
    classes = [ConfigA::class, ConfigB::class]
)
class TestClass9 {
    @MockBean
    lateinit var beanA: BeanA

    @Test
    fun test() {
        /* some test code */
    }
}

@RunWith(SpringRunner::class)
@ContextConfiguration(
    classes = [ConfigA::class, ConfigB::class]
)
class TestClass10 {
    @MockBean
    lateinit var beanB: BeanB

    @Test
    fun test() {
        /* some test code */
    }
}

@RunWith(SpringRunner::class)
@ContextConfiguration(
    classes = [ConfigA::class, ConfigB::class]
)
class TestClass11 {
    @MockBean
    lateinit var beanA: BeanA

    @MockBean
    lateinit var beanB: BeanB

    @Test
    fun test() {
        /* some test code */
    }
}
{% endcodeblock %}
* 위 4개 테스트를 함께 돌리면 매번 새 `ApplicationContext`를 생성한다. `@ContextConfiguration` 구성은 같지만 `@MockBean` 처리된 bean의 구성이 모두 다르기 때문이다.

<br />


## 결론
Spring `TestContext` 프레임워크의 `ApplicationContext` 생성 전략을 잘 파악하고 성능이 최대한 잘 나오도록 유의하여 사용하자.

<br />


## 레퍼런스
* [Spring framework reference - Testing](https://docs.spring.io/spring/docs/current/spring-framework-reference/testing.html)

