---
title: Spring Data JPA - Projection 이모저모
date: 2018-12-25 18:18:30
categories:
  - Develop
---
## 개요
요즘 회사에서 Spring으로 백엔드 개발을 하고 있는데, 너무 자동으로 돌아가는게 많아서 고생을 하고 있다. 이번 포스팅에서는 Spring Data JPA의 Projection 기능을 쓰면서 새롭게 알게된 사실들을 기록해두려고 한다.
<br />

## Projection Basic
우선 Projection이 무슨 기능인지 간단하게 살펴보자. 아래와 같이 `Student` 엔티티를 정의했다고 해보자. 참고로 필자는 Kotlin만 사용해서 Java는 쓸 줄 모른다…

```
@Entity
data class Student(
    @get:Id
    @get:GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Int? = null,

    @get:Column(length = 32, nullable = false)
    var name: String,

    @get:Column(nullable = false)
    var grade: Int,
    ...
)
```

그리고 `Student`의 Repository를 하나 선언하고 적절히 쿼리 메소드를 선언하면 우리는 별 다른 노력 없이 `Student`에 대해 쿼리를 날릴 수 있다.

```
interface StudentRepository : JpaRepository<Student, Int> {
    fun findById(id: Int): Student?
}
```

여기서 다음과 같은 상황을 생각해보자. 우리의 비즈니스 로직이 점차 복잡해져서 `Student` 모델에 여러가지 field가 추가되어 `Student` 모델이 꽤나 비대해졌다. 이 때, 학생의 이름만을 나열하는 페이지를 만들고 싶다. 이러한 상황에서 우리는 결코 Student 엔티티의 모든 field를 DB에서 가져오고 싶지는 않을 것이다.
<br />

이럴 때 사용하는 것이 바로 projection이다. Projection을 사용하면 엔티티의 일부 field만을 project(수학에서 말하는 투사? 투영?과 같은 느낌이다)하여 가져올 수 있다.
<br />

사용법은 아주 간단하다. 우선, 아래와 같이 projection interface를 정의한 후, 가져오고 싶은 field 이름만 적는다. 이 때 주의해야 할 점은, **field 명이 반드시 일치해야 한다**는 것이다.
```
interface StudentNameOnly {
    val id: Int
    val name: String
}
```
그리고 Repository에서 해당 projection interface를 리턴 타입으로 가지는 쿼리 메소드를 작성하면 끝이다.
```
interface StudentRepository : JpaRepository<Student, Int> {
    fun findById(id: Int): Student?
    fun findAllNameOnlyProjectionBy(): List<StudentNameOnly>
}
```
이제 `val students: List<StudentNameOnly> = studentRepository.findAllNameOnlyProjectionBy()` 라고 메소드를 호출하면 우리는 우리의 관심사인 학생의 이름만을 가지고 작업을 할 수 있다.
<br />

## Projection with Custom Query
위의 `Student` 모델에 더해서, 각 학생의 과목별 시험 성적을 저장하는 모델이 있다고 생각해보자.

```
enum class Course {
    MA, // Mathematics
    CS, // Computer Science,
    PH, // Physics,
    ...
}

@Entity
data class StudentTestScore(
    @get:Id
    @get:GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Int? = null,

    @get:ManyToOne(fetch = FetchType.LAZY)
    @get:JoinColumn(name = "student_id", nullable = false)
    var student: Student?,

    @get:Column(length = 32, nullable = false)
    @get:Enumerated(EnumType.STRING)
    var course: Course,

    @get:Column(nullable = false)
    var score: Int,
    ...
)
```

이 때, 각 학생마다 모든 과목의 시험 점수의 평균을 구하고 싶다. 그러면 우리는 `GROUP BY`를 활용한 쿼리 메소드를 작성하여 사용하고 싶을 것이다. 그런데 문제는, `GROUP BY`는 Spring Data JPA에서 지원을 해주지 않는다. 그러면 우리는 어쩔 수 없이 `@Query` annotation을 사용해서 커스텀 쿼리를 작성해야 하는데, 문제는 이러한 커스텀 쿼리의 결과값을 어떻게 받아올 수 있냐는 점이다.
<br />

바로 여기서 다시 한번 projection을 사용할 수 있다. 우선 우리가 쿼리의 결과값으로 받을 projecition interface를 정의한다.
```
interface StudentAverageTestScore {
    studentId: Int
    averageScore: Int
}
```
그 다음은 `StudentAverageTestScore`을 리턴 타입으로 가지는 커스텀 쿼리 메소드를 만들기만 하면 된다.
```
interface StudentTestScoreRepository : JpaRepository<StudentTestScore, Int> {
    fun findStudentAverageTestScores(): List<StudentAverageTestScore>
}
```
여기서 반드시 유의해야 할 점은, 커스텀 쿼리의 `SELECT` 절에서의 column 명과 projection interface의 field 명이 일치해야 한다는 점이다. Spring Data JPA는 여기서도 마찬가지로 column 명과 정확히 일치하는 projection interface의 field 명으로 쿼리 결과를 매핑하여 결과값을 생성하므로 꼭 이 둘을 일치시키도록 유의해야 한다. JPQL로는 해본적이 없긴 한데, [Stack Overflow](https://stackoverflow.com/questions/51609025/spring-data-jpa-getting-a-projection-from-an-entity-with-a-query#answer-51609585)에 따르면 JPQL 에서도 마찬가지로 projection interface의 field 명과 쿼리 결과의 column 명을 일치시켜야 한다고 한다.
<br />

이제 아래 코드와 같이 학생의 평균 시험 점수를 가지고 비즈니스 로직을 짤 수 있다.
```
val studentAverageTestScores = studentTestScoreRepository.findStudentAverageTestScores()
studentAverageTestScores.map { // it: StudentAverageTestScore
    // business logic
}
```
<br />

## Projection에 관련된 몇 가지 실험
사실 위에는 projection과 관련된 기본적인 지식이었다. 여기서부터는 내가 projection을 사용하다가 삽질하면서 배운, projection을 사용할 때 유의해야 할 몇 가지 주의사항들이다.

### Projection은 실제로 쿼리가 줄어드는가?
위에서 `Student`와 `StudentNameOnly`의 경우, 우리는 비대한 `Student` 모델의 모든 정보를 들고 오는 대신 관심있는 `name` field만 들고 왔었다. 여기서 드는 한 가지 의문은, 실제로 Hibernate가 날리는 쿼리의 양이 줄어들었냐는 점이다. 이를 확인하기 위해 아래와 같이 간단하게 테스트를 짜고 Hibernate가 생성한 쿼리를 확인해보았다.
```
@RunWith(SpringRunner::class)
@SpringBootTest
class SampleApplicationTest {
    @Autowired
    lateinit var studentRepository: StudentRepository

    @Test
    fun `Student 이름만 조회`() {
        val student = studentRepository.save(Student(
            name = "학생",
            grade = 2
        ))
        val studentsNameOnly = studentRepository.findAllNameOnlyProjectionBy()
        Assert.assertEquals(1, studentsNameOnly.size)
        Assert.assertEquals(student.name, studentsNameOnly[0].name)
    }
}
```
쿼리 결과는 아래와 같았다.
```
2018-12-25 17:11:07.973 DEBUG 43952 --- [           main] org.hibernate.SQL                        : 
    select
        student0_.id as col_0_0_,
        student0_.name as col_1_0_ 
    from
        Student student0_
```
Hibernate가 생성한 쿼리 역시 정확하게 projection에 필요한 field인 `id`와 `name`만을 가져오는 것을 확인할 수 있다. 즉, 실제로 projection을 사용하면 쿼리를 줄일 수 있다. DB 쪽은 아직 공부를 안 해서 잘 모르긴 한데, 성능상 이득이 충분히 있을 수 있지 않을까...?

### Projection 결과 객체는 영속성이 유지되고 있을까?
회사에서 아무 생각 없이 projection을 쓰고 있던 와중, 다른 개발자분이 projection 결과값에 대해서 영속성이 유지되는지 질문하셨다. 갑자기 궁금해진 나는 당장 테스트해보기로 했다.
```
@RunWith(SpringRunner::class)
@SpringBootTest
class SampleApplicationTest {
    @Autowired
    lateinit var studentRepository: StudentRepository

    @Autowired
    lateinit var entityManager: EntityManager

    @Test
    fun `StudentNameOnly 영속성 확인`() {
        studentRepository.save(Student(
            name = "학생",
            grade = 2
        ))
        val studentNameOnly = studentRepository.findAllNameOnlyProjectionBy()[0]
        entityManager.contains(studentNameOnly)
    }
}
```
좀 억지 코드이기는 하지만, 영속성이 유지되는지 확인할 방법이 잘 떠오르지 않아서 일단 이렇게 처리했다. `entityManager.contains(studentNameOnly)`에서 Exception이 발생하면 영속성이 유지되지 않는 것이고 Exception이 발생하지 않으면 영속성이 유지되는 것이라고 볼 수 있다. 돌려본 결과, `java.lang.IllegalArgumentException: Not an entity` Exception이 던져졌다. 즉, projection 결과에 대해서는 영속성이 유지되지 않는다. 이 말은 projection 결과를 바꿔도 자동으로 DB에 반영되지 않을 것이라는 뜻이다.
<br />

결과론적으로 본다면 사실 당연한 이야기인게, `StudentNameOnly` 인터페이스에는 `@Entity` annotation이 달리지도 않았으니 엔티티 매니저 팩토리가 엔티티 매니저를 만들 때 `StudentNameOnly` 타입 객체의 영속성을 유지할 저장 공간을 생성하지도 않을 것 같다. 아무튼 혹시 모르는 사항을 확인했다는 점에서 굉장히 만족스러운 테스트였다.

### Projection에서 eager loading을 하려면?
결론부터 말하면, projection에서는 eager loading이 아닌게 없다. 원래 Hibernate는  기본적으로 lazy loading을 하도록 설정한 후 `@EntityGraph` 등 명시적으로 eager loading을 할 수 있는데, projection을 하면 어떤 설정하에 있던 간에 eager loading을 하는 것으로 보인다.

아래는 이를 확인한 테스트 코드이다. 우선 간단한 테스트를 위해 `StudentTestScoreStudentOnly` projection interface를 생성한다.
```
interface StudentTestScoreStudentOnly {
    var student: Student?
}

```
이후 `StudentTestScoreRepository`에 해당 interface를 리턴 타입으로 가지는 쿼리 메소드를 하나 선언한다.
```
interface StudentTestScoreRepository : JpaRepository<StudentTestScore, Int> {
    fun findStudentAverageTestScores(): List<StudentAverageTestScore>
    fun findStudentOnlyById(id: Int): StudentTestScoreStudentOnly?
}
```
이후 연관된 entity를 조회하는 테스트를 짠다.
```
@RunWith(SpringRunner::class)
@SpringBootTest
class SampleApplicationTest {
    @Autowired
    lateinit var studentRepository: StudentRepository

    @Autowired
    lateinit var studentTestScoreRepository: StudentTestScoreRepository

    @Test
    fun `projection에서 eager loading 여부 확인`() {
        val student = studentRepository.save(Student(
            name = "학생",
            grade = 2
        ))
        val studentTestScore = studentTestScoreRepository.save(StudentTestScore(
            student = student,
            course = "Computer Science",
            score = 100
        ))

        val studentTestScores = studentTestScoreRepository.findAll()
        Assert.assertEquals(studentTestScore.id, studentTestScores[0].id)
        Assert.assertEquals(student.id, studentTestScores[0].student?.id) // 일반적인 엔티티 조회에서 연관된 엔티티 접근
        val studentTestScoreStudentOnly = studentTestScoreRepository.findStudentOnlyById(studentTestScore.id!!)
        Assert.assertEquals(student.id, studentTestScoreStudentOnly?.student?.id) // Projection에서 연관된 엔티티 접근
    }
}
```
아래는 쿼리 결과다.
```
2018-12-25 18:04:36.383 DEBUG 47722 --- [           main] org.hibernate.SQL                        : 
    select
        studenttes0_.id as id1_1_,
        studenttes0_.course as course2_1_,
        studenttes0_.score as score3_1_,
        studenttes0_.student_id as student_4_1_ 
    from
        StudentTestScore studenttes0_
2018-12-25 18:04:36.396 DEBUG 47722 --- [           main] org.hibernate.SQL                        : 
    select
        student0_.id as id1_0_0_,
        student0_.grade as grade2_0_0_,
        student0_.name as name3_0_0_ 
    from
        Student student0_ 
    where
        student0_.id=?
2018-12-25 18:04:36.396 TRACE 47722 --- [           main] o.h.type.descriptor.sql.BasicBinder      : binding parameter [1] as [INTEGER] - [1]
2018-12-25 18:04:36.524 DEBUG 47722 --- [           main] org.hibernate.SQL                        : 
    select
        student1_.id as id1_0_,
        student1_.grade as grade2_0_,
        student1_.name as name3_0_ 
    from
        StudentTestScore studenttes0_ 
    inner join
        Student student1_ 
            on studenttes0_.student_id=student1_.id 
    where
        studenttes0_.id=?
2018-12-25 18:04:36.526 TRACE 47722 --- [           main] o.h.type.descriptor.sql.BasicBinder      : binding parameter [1] as [INTEGER] - [1]
```
위의 쿼리를 보면 테스트 실행 도중 총 3개의 `SELECT` 쿼리가 발생한 것을 알 수 있다. 첫 번째와 세 번째 쿼리는 각각 레포지토리를 통해서 `studentTestScores`와 `studentTestScoreStudentOnly`를 가져올 때 발생한 쿼리고, 두 번째 쿼리는 `Assert.assertEquals(student.id, studentTestScores[0].student?.id)`가 실행될 때 프록시 객체에 접근하면서 연관된 엔티티를 가져올 때 발생한 쿼리다. 반면, `Assert.assertEquals(student.id, studentTestScoreStudentOnly?.student?.id)`가 실행될 때는 어떤 쿼리도 실행되지 않았다. 즉, 이미 `Student`를 가져왔다는 뜻이다. 이는 세 번째 쿼리에서 Student를 조인해서 가져온 부분에서 다시 한 번 확인할 수 있다. 따라서, projection을 쓸 때 예상치 못한 쿼리가 날라가지 않도록 주의해야 한다.
<br />

## 결론
Projection이 편리하다고 막 쓰지 말고, 이런 저런 불편한 점과 유의해야 할 점들이 있으니 신경써서 사용하자.