---
title: Spring Boot Auto-Configuration
date: 2022-11-27 16:17:31
categories:
  - Develop
---
## Auto-configuration이란?

### 정의

우선 auto-configuration의 정의부터 살펴보자. [Spring Boot Reference의 Auto-configuration 섹션](https://docs.spring.io/spring-boot/docs/3.0.0/reference/htmlsingle/#using.auto-configuration)에서는 auto-configuration에 대해 다음과 같이 설명한다.

> Spring Boot auto-configuration attempts to automatically configure your Spring application based on the jar dependencies that you have added. For example, if `HSQLDB` is on your classpath, and you have not manually configured any database connection beans, then Spring Boot auto-configures an in-memory database.

그리고, Spring Boot 3.0.0부터 추가된 `@AutoConfiguration`의 javadoc에는 아래와 같이 적혀 있다.

> Indicates that a class provides configuration that can be automatically applied by Spring Boot. Auto-configuration classes are regular @Configuration with the exception that Configuration#proxyBeanMethods() proxyBeanMethods is always false.

대충 `Spring Boot가 자동(auto)으로 적용해주는 configuration` 정도로 요약할 수 있을 것 같다. 좀 더 명확한 정의가 있었으면 좋겠어서 조금 찾아 보았지만, 이것 이상으로 정확한 정의는 찾지 못했다.
<br />

### Configuration vs. Auto-configuration

`@Configuration`이 이미 존재함에도 불구하고 auto-configuration이라는 개념을 만들어야 했던 이유는 무엇일까? 이는 Spring Boot가 최대한의 기능 지원을 자동으로, 스마트하게 해주기 위함으로 보인다. 일반적인 configuration의 경우, `@ComponentScan`에 걸리면 무조건 적용되고, 그렇지 않으면 적용되지 않는다. 하지만 Spring Boot가 필요로 했던 기능은 아래와 같은 것들이었다.

- 사용자가 RDB를 사용하는 경우, DataSource 타입의 bean이 존재하지 않으면 자동으로 하나 만들어 주고 싶다.
- 사용자가 Redis를 사용하는 경우에만 Redis 관련 bean을 application context에 등록하고 싶다.

즉, **Spring Boot는 조건부로 적용되는 configuration을 원했던 것이다. 그리고 auto-configuration은 정확히 이 기능을 제공한다.**

다음 섹션에서는 auto-configuration이 조건부로 적용되는 원리에 대해 자세하게 파헤쳐 보겠다.
<br />

## Auto-configuration이 적용되는 원리

### 사용법

위에서 언급한 대로, Spring Boot를 사용하는 어플리케이션에서 일반적인 configuration은 `@ComponentScan`에 걸리게 설정해야 적용된다. `@ComponentScan`에 걸리지 않는 패키지 경로에 위치한다면 configuration에서 정의한 bean은 application context에 등록되지 않는다.

한편, auto-configuration은 `@ComponentScan`과는 별도의 메커니즘으로 적용된다. auto-configuration은 아래 4개의 조건을 만족하면 적용된다.

1. 아무 configuration 클래스에 `@EnableAutoConfiguration`이 적용되어 있다.
2. `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`(Spring Boot 2.6 이하는 `META-INF/spring.factories`) 파일에 대상 auto-configuration이 적혀 있다.
3. 대상 auto-configuration이 명시적으로 exclude 되어 있지 않다.
4. 대상 auto-configuration의 class-level `@Conditional` 조건들이 만족된다.

이렇게 적용 대상이 된 auto-configuration의 bean method 중 method-level `@Conditional`이 만족되는 것들만 application context에 적용된다.
<br />

### 원리

Auto-configuration이 적용되는 과정은 아래와 같다.

1. `@EnableAutoConfiguration`이 적용되어 있다면, application context 구성 단계에서 해당 어노테이션에 붙어 있는 `@Import(AutoConfigurationImportSelector.class)` 메타 어노테이션에 의해 `AutoConfigurationImportSelector`가 실행된다.
    
    ```java
    /* ConfigurationClassParser.doProcessConfigurationClass() */
    @Nullable
    protected final SourceClass doProcessConfigurationClass(
        ConfigurationClass configClass, SourceClass sourceClass, Predicate<String> filter)
        throws IOException {
        /* Recursively process any member (nested) classes first */
        /* 코드 생략 */
    
        /* Process any @PropertySource annotations */
        /* 코드 생략 */
    
        /* Process any @ComponentScan annotations */
        /* 코드 생략 */
    
        /* Process any @Import annotations */
        processImports(configClass, sourceClass, getImports(sourceClass), filter, true);
    
        /* 후략 */
    }
    ```
    
    `sourceClass`에 `@EnableAutoConfiguration`이 달린 configuration(보통 `@SpringBootApplication`)이 들어오면, `getImports(sourceClass)`에서 `AutoConfigurationImportSelector`가 가져와져서 적용된다.
    
2. `AutoConfigurationImportSelector`는 적용할 auto-configuration 목록을 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 파일에서 읽어 들인다.
    
    ```java
    /* AutoConfigurationImportSelector.getCandidateConfigurations() */
    protected List<String> getCandidateConfigurations(AnnotationMetadata metadata, AnnotationAttributes attributes) {
        List<String> configurations = ImportCandidates.load(AutoConfiguration.class, getBeanClassLoader())
            .getCandidates();
        Assert.notEmpty(configurations,
            "No auto configuration classes found in "
                + "META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports. If you "
                + "are using a custom packaging, make sure that file is correct.");
        return configurations;
    }
    
    /* ImportCandidates.load() */
    public static ImportCandidates load(Class<?> annotation, ClassLoader classLoader) {
        Assert.notNull(annotation, "'annotation' must not be null");
        ClassLoader classLoaderToUse = decideClassloader(classLoader);
        String location = String.format(LOCATION, annotation.getName()); /* LOCATION == "META-INF/spring/%s.imports" */
        Enumeration<URL> urls = findUrlsInClasspath(classLoaderToUse, location);
        List<String> autoConfigurations = new ArrayList<>();
        while (urls.hasMoreElements()) {
          URL url = urls.nextElement();
          autoConfigurations.addAll(readAutoConfigurations(url));
        }
        return new ImportCandidates(autoConfigurations);
    }
    ```
    
3. 명시적으로 exclude 된 auto-configuration을 제외시킨다.
    
    ```java
    /* AutoConfigurationImportSelector.getAutoConfigurationEntry() */
    protected AutoConfigurationEntry getAutoConfigurationEntry(AnnotationMetadata annotationMetadata) {
        /* 전략 */
        List<String> configurations = getCandidateConfigurations(annotationMetadata, attributes); /* 2번에서 가져온 auto-configuration 목록 */
        configurations = removeDuplicates(configurations);
        Set<String> exclusions = getExclusions(annotationMetadata, attributes);
        checkExcludedClasses(configurations, exclusions);
        configurations.removeAll(exclusions);
        /* 후략 */
    }
    
    /* AutoConfigurationImportSelector.getExclusions() */
    protected Set<String> getExclusions(AnnotationMetadata metadata, AnnotationAttributes attributes) {
        Set<String> excluded = new LinkedHashSet<>();
        excluded.addAll(asList(attributes, "exclude"));
        excluded.addAll(asList(attributes, "excludeName"));
        excluded.addAll(getExcludeAutoConfigurationsProperty());
        return excluded;
    }
    ```
    
4. class-level `@Conditional` 어노테이션을 확인하여 조건이 만족되지 않은 auto-configuration을 제외시킨다.
    
    ```java
    /* ConfigurationClassParser.processConfigurationClass() */
    protected void processConfigurationClass(ConfigurationClass configClass, Predicate<String> filter) throws IOException {
        if (this.conditionEvaluator.shouldSkip(configClass.getMetadata(), ConfigurationPhase.PARSE_CONFIGURATION)) {
          return;
        }
    
        /* 후략 */
    }
    
    /* ConditionEvaluator.shouldSkip() */
    public boolean shouldSkip(@Nullable AnnotatedTypeMetadata metadata, @Nullable ConfigurationPhase phase) {
        if (metadata == null || !metadata.isAnnotated(Conditional.class.getName())) {
          return false;
        }
        
        /* 중략 */
    
        List<Condition> conditions = new ArrayList<>();
        
        /* 중략 */
    
        for (Condition condition : conditions) {
          ConfigurationPhase requiredPhase = null;
          if (condition instanceof ConfigurationCondition) {
            requiredPhase = ((ConfigurationCondition) condition).getConfigurationPhase();
          }
          if ((requiredPhase == null || requiredPhase == phase) && !condition.matches(this.context, metadata)) {
            return true;
          }
        }
    
        return false;
    }
    ```
    
5. auto-configuration에서 정의한 각 bean을 application context에 등록한다. 이 때 method-level `@Conditional`이 만족되지 않은 bean은 등록되지 않는다.

> 💡 configuration과 auto-configuration이 적용되는 전체 과정은 `ConfigurationClassPostProcessor.processConfigBeanDefinitions()` 에서 보다 상세하게 살펴볼 수 있다.

### 예시 - DataSourceAutoConfiguration

Spring Boot Starter에 정의된 auto-configuration 중 하나인 `DataSourceAutoConfiguration`를 예시로 들어 살펴보자.

```java
package org.springframework.boot.autoconfigure.jdbc;

/**
 * {@link EnableAutoConfiguration Auto-configuration} for {@link DataSource}.
 *
 * @author Dave Syer
 * @author Phillip Webb
 * @author Stephane Nicoll
 * @author Kazuki Shimizu
 * @since 1.0.0
 */
@AutoConfiguration(before = SqlInitializationAutoConfiguration.class)
@ConditionalOnClass({ DataSource.class, EmbeddedDatabaseType.class })
@ConditionalOnMissingBean(type = "io.r2dbc.spi.ConnectionFactory")
@EnableConfigurationProperties(DataSourceProperties.class)
@Import(DataSourcePoolMetadataProvidersConfiguration.class)
public class DataSourceAutoConfiguration {

    @Configuration(proxyBeanMethods = false)
    @Conditional(EmbeddedDatabaseCondition.class)
    @ConditionalOnMissingBean({ DataSource.class, XADataSource.class })
    @Import(EmbeddedDataSourceConfiguration.class)
    protected static class EmbeddedDatabaseConfiguration {
  
    }
  
    /* 후략 */
}
```

Class-level 어노테이션을 살펴보면 아래의 어노테이션이 달려 있다.

- `@AutoConfiguration(before = SqlInitializationAutoConfiguration.class)` - 이는 auto-configuration이 적용되는 순서를 지정한 것이다. `@AutoConfigureBefore` 및 `@AutoConfigureAfter`와 동일한 효과를 낸다.
    
    Auto-configuration이 적용되는 순서가 중요한 이유는, `@ConditionalOnMissingBean`과 같이 특정 bean이 application context에 등록되어 있는지 여부에 따라 auto-configuration의 실행 여부가 판단될 때가 많기 때문이다. 이는 [Auto-configuration은 실행되는 순서가 중요하다 섹션](/2022/11/27/spring-boot-auto-configuration/#Auto-configuration은-실행되는-순서가-중요하다)에서 조금 더 깊이 다룬다.
    
- `@ConditionalOnClass({ DataSource.class, EmbeddedDatabaseType.class })` - 이는 `DataSource`와 `EmbeddedDatabaseType` 클래스가 classpath에 존재하는 경우에만 auto-configuration을 적용하겠다는 의미다. 이 조건 덕분에 JDBC를 사용하는 경우에만 이 auto-configuration을 적용시킬 수 있다.
- `@ConditionalOnMissingBean(type = "io.r2dbc.spi.ConnectionFactory")` - 이 조건 덕분에 r2dbc를 사용하는 경우 이 auto-configuration을 적용시키지 않을 수 있다.
- `@EnableConfigurationProperties(DataSourceProperties.class)` - auto-configuration과는 관계 없는 어노테이션이므로 설명을 생략한다.
- `@Import(DataSourcePoolMetadataProvidersConfiguration.class)` - 이 auto-configuration이 적용될 수 있는 상황인 경우, `DataSourcePoolMetadataProvidersConfiguration` 역시 적용한다.
    
    이는 동일한 `@Conditional`을 여러 auto-configuration에 복사해서 적거나 [META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports](https://github.com/spring-projects/spring-boot/blob/v3.0.0/spring-boot-project/spring-boot-autoconfigure/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports) 파일에 클래스를 적어야 하는 등의 번거로움을 줄여준다.
    

또한, 위 클래스는 spring-boot-autoconfigure 모듈의 [META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports](https://github.com/spring-projects/spring-boot/blob/v3.0.0/spring-boot-project/spring-boot-autoconfigure/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports) 파일에 명시되어 있는 것을 확인할 수 있다.
<br />

### 잡담

Spring Boot 2.7.0부터 `@AutoConfiguration` 어노테이션이 등장했음에도 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 파일에서 auto-configuration을 읽어오는 게 이상하다고 생각했는데, 실행 속도를 위해 이런 구조로 만들지 않았을까 싶다. `@ComponentScan`에 걸리지 않아도 동작해야 하는 auto-configuration 특성 상 이를 scanning으로 찾아내려면 모든 classpath의 클래스를 전부 scan해야 하는데, 이는 너무 비효율적이다. 그래서 적용할 auto-configuration 목록을 명시적으로 제공하는 방법을 택한 듯 하다. 
<br />

## Auto-configuration 사용 시 주의사항

다음은 auto-configuration 사용 시 일반적으로 주의해야 하는 사항과, 필자가 auto-configuration을 사용하면서 겪은 trouble shooting을 기록한 것이다.

### Auto-configuration은 실행되는 순서가 중요하다

`@ConditionalOnBean`의 javadoc에는 아래와 같은 내용이 명시되어 있다.

> The condition can only match the bean definitions that have been processed by the application context so far and, as such, it is strongly recommended to use this condition on auto-configuration classes only.

이 중 지금 집중해야 하는 부분은 `The condition can only match the bean definitions that have been processed by the application context so far`이다. 이 내용에 따르면, `@ConditionalOnBean`과 `@ConditionalOnMissingBean`의 evalutation 결과는 auto-configuration가 어떤 순서로 처리되느냐에 따라 달라진다. 즉, **동일한 목록의 auto-configuration을 처리하더라도 처리 순서에 따라 application context에 등록되는 bean 목록이 달라질 수 있다는 것**이다.

따라서, 특히나 custom auto-configuration을 제작하여 사용하는 경우, auto-configuration의 처리 순서를 신중하게 제어해야 한다. 아래의 어노테이션을 통해 auto-configuration의 처리 순서를 제어할 수 있다.

- `@AutoConfiguration`, `@AutoConfigureBefore`, `@AutoConfigureAfter`
- `@AutoConfigureOrder`
<br />

### Auto-configuration은 @ComponentScan에 걸리면 안 된다

`Auto-configuration은 실행되는 순서가 중요하다`와 이어지는 내용이다. auto-configuration은 애플리케이션 개발자가 구성한 application context의 형태에 따라 조건부로 적용되는 것이 매우 중요하다. 따라서, **auto-configuration은 애플리케이션 개발자가 정의한 bean이 모두 application context에 등록된 이후에 처리되어야만 한다.** 위에서 살펴 본 `ConfigurationClassParser.doProcessConfigurationClass()`의 pseudo code를 다시 살펴 보자.

```java
/* ConfigurationClassParser.doProcessConfigurationClass() */
@Nullable
protected final SourceClass doProcessConfigurationClass(
    ConfigurationClass configClass, SourceClass sourceClass, Predicate<String> filter)
    throws IOException {
    /* Recursively process any member (nested) classes first */

    /* Process any @PropertySource annotations */

    /* Process any @ComponentScan annotations */

    /* Process any @Import annotations */

    /* Process any @ImportResource annotations */
    
    /* Process individual @Bean methods */

    /* Process default methods on interfaces */

    /* 후략 */
}
```

이 코드에 따르면, 애플리케이션 개발자가 정의한 `@Component` / `@Configuration`이 `@ComponentScan` 어노테이션 처리 단계에서 먼저 처리되고(`@Configuration` 역시 `@Component` 메타 어노테이션이 달려 있어서 `@ComponentScan`에 걸린다), 그 다음 `@Import` 단계에서 `AutoConfigurationImportSelector`에 의해 auto-configuration이 처리됨을 알 수 있다. 이 덕분에 애플리케이션 개발자가 정의한 bean이 application context에 모두 등록된 이후에 auto-configuration이 처리되는 것을 보장할 수 있다.

하지만 만약 auto-configuration이 `@ComponentScan`에 걸리는 패키지 경로에 존재하면 어떻게 될까? auto-configuration이 애플리케이션 개발자가 정의한 bean들과 뒤섞여서 처리되기 때문에 `@ConditionalOnBean`과 `@ConditionalOnMissingBean`이 잘못 evaluate 될 수 있다. 이로 인해 중복된 타입의 bean이 존재하거나 반대로 실행되어야 하는 코드가 실행되지 않는 등 application context가 의도와는 다르게 잘못 구성될 수 있다.

`@SpringBootApplication`의 메타 어노테이션으로 달려 있는 `@ComponentScan`에는 기본적으로 `AutoConfigurationExcludeFilter`가 적용되어 있다. 이로 인해 auto-configuration이 `@ComponentScan`에 걸리는 문제를 방지할 수 있다.

```java
/* 전략 */
@ComponentScan(excludeFilters = { @Filter(type = FilterType.CUSTOM, classes = TypeExcludeFilter.class),
    @Filter(type = FilterType.CUSTOM, classes = AutoConfigurationExcludeFilter.class) })
public @interface SpringBootApplication {
    /* 생략 */
}
```

하지만 만약 별도의 `@ComponentScan`을 사용하는 경우, 특히나 custom auto-configuration이 `@ComponentScan`에 걸리지 않게 해야 한다. 이는 [Spring Boot Reference에도 주의사항으로 명시되어 있다.](https://docs.spring.io/spring-boot/docs/3.0.0/reference/htmlsingle/#features.developing-auto-configuration.locating-auto-configuration-candidates)

> Auto-configurations must be loaded *only* by being named in the imports file. Make sure that they are defined in a specific package space and that they are never the target of component scanning. Furthermore, auto-configuration classes should not enable component scanning to find additional components. Specific `@Import`s should be used instead.

개인적인 의견으로, `@ComponentScan`에 `AutoConfigurationExcludeFilter`가 default로 적용되어 있어야 하는 게 아닌가 싶다.
<br />

### `@EnableAutoConfiguration`을 auto-configuration에 달면 안 된다

Spring Boot Reference를 보면, [특정 auto-configuration을 disable하기 위해 `@EnableAutoConfiguration`의 `exclude` / `excludeName` attribute를 사용할 수 있다](https://docs.spring.io/spring-boot/docs/3.0.0/reference/htmlsingle/#using.auto-configuration.disabling-specific)고 한다. 이때 `@EnableAutoConfiguration(exclude = [...])`를 auto-configuration에 달면 cyclic dependency가 발생한다.

```kotlin
@EnableAutoConfiguration(exclude = [DataSourceAutoConfiguration::class.java])
class MyDataSourceAutoConfiguration {
}
```

위와 같이 정의한 경우, 아래와 같이 cyclic dependency가 발생한다.

1. `@SpringBootApplication`에 달려 있는 `@EnableAutoConfiguration`에 의해 `AutoConfigurationImportSelector`가 실행됨.
2. `AutoConfigurationImportSelector`에 의해 `MyDataSourceAutoConfiguration`가 처리됨.
3. `MyDataSourceAutoConfiguration`에 달려 있는 `@EnableAutoConfiguration`에 의해 `AutoConfigurationImportSelector`가 실행됨.
    
    → 2번 과정으로 되돌아감.
    

따라서, 한 auto-configuration이 다른 auto-configuration을 disable 시키고 싶은 경우, `@ImportAutoConfiguration`을 사용하도록 하자. `@ImportAutoConfiguration`은 `AutoConfigurationImportSelector`를 실행시키지 않아서 cyclic dependency가 발생하지 않는다.

### Spring Boot 2.7 이상 버전에서 하위 호환이 깨지는 문제

마지막은 특정 버전에서만 발생하는 문제이다. 많은 기술들이 Spring Boot integration을 제공하기 위해 auto-configuration을 사용한다. 이때, 이 integration이 지원하는 버전이 2.7 이상인지 미만인지를 잘 살펴봐야 한다. 2.7 이전과 이후를 기점으로 auto-configuration 목록을 조회하는 방법이 달라졌기 때문이다.

- ~ 2.6 - `META-INF/spring.factories`
- 2.7~ - `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`

따라서, 라이브러리가 제공하는 auto-configuration이 잘 동작하지 않는다 싶다면 자신이 사용하는 Spring Boot 버전과 라이브러리가 지원하는 Spring Boot 버전이 맞는지를 잘 확인해 보자.
<br>

## Reference

- https://docs.spring.io/spring-boot/docs/3.0.0/reference/htmlsingle
