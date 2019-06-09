---
title: Lock으로 이해하는 Transaction의 Isolation Level
date: 2019-06-09 21:07:14
thumbnail: /images/transaction-isolation-level-and-lock/mysql-logo.png
categories:
  - Develop
---

## 개요

내게 transaction의 isolation level은 개발할 때 항상 큰 찝찝함을 남기게 하는 요소였다. row를 읽기만 할 때는 `REPEATABLE READ`로, row를 삽입 / 수정 / 삭제할 때는 `SERIALIZABLE`로 isolation level을 지정했지만, 사실 왜 그렇게 해야 하는지도, 이게 정확히 맞는 isolation level인지도 몰랐다. 그냥 회사의 다른 분들이 그런 패턴으로 구현해서 대충 따라 했던 것이다.

그래서 이번 글에서는 transaction의 isolation level에 대해서 파헤쳐 본 내용을 정리했다. 해당 글은 다음과 같은 내용을 포함한다.

- Transaction의 정의 및 ACID 원칙
- InnoDB 엔진이 활용하는 lock 소개
- Transaction의 isolation level 별 locking strategy

\* 아래 설명에서는 쉬운 설명을 위해 몇 가지 부정확한 설명을 언급한 경우가 있다. 해당 경우에는 별도로 표시(\*)하고 해당 섹션의 하단에 설명을 적어놓았다.

<br />

## Transaction이란 무엇인가?

### Transaction의 정의

Transaction이란, **데이터베이스의 데이터를 조작하는 작업의 단위(unit of work)**이다. 가장 많이 드는 예시는 은행에서의 송금이다. 송금은 1. 보내는 사람의 계좌에서 돈을 빼고, 2. 받는 사람의 계좌에 돈을 추가하는 두 가지 행위가 묶인 한 작업이다.

transaction은 흔히 이론적으로 ACID 원칙을 보장해야 한다고 한다. ACID는 각각 Atomicity(원자성), Consistency(일관성), Isolation(독립성), Durability(영구성)를 뜻한다. 각 원칙은 다음과 같은 성질을 의미한다 :

- Atomicity: transaction의 작업이 부분적으로 성공하는 일이 없도록 보장하는 성질이다. 송금하는 사람의 계좌에서 돈은 빠져나갔는데 받는 사람의 계좌에 돈이 들어오지 않는 일은 없어야 한다.
- Consistency: transaction이 끝날 때 DB의 여러 제약 조건에 맞는 상태를 보장하는 성질이다. 송금하는 사람의 계좌 잔고가 0보다 작아지면 안 된다.
- Isolation: transaction이 진행되는 중간 상태의 데이터를 다른 transaction이 볼 수 없도록 보장하는 성질이다. 송금하는 사람의 계좌에서 돈은 빠져나갔는데 받는 사람의 계좌에 돈이 아직 들어가지 않은 DB 상황을 다른 transaction이 읽으면 안 된다.
- Durability: transaction이 성공했을 경우 해당 결과가 영구적으로 적용됨을 보장하는 성질이다. 한 번 송금이 성공하면 은행 시스템에 장애가 발생하더라도 송금이 성공한 상태로 복구할 수 있어야 한다.

### ACID 원칙은 완벽히 지켜지지 않는다 - Transaction의 Isolation Level

하지만, 실제로는 **ACID 원칙은 종종 지켜지지 않는다**. 왜냐하면 **ACID 원칙을 strict 하게 지키려면 동시성이 매우 떨어지기 때문**이다.

그렇기 때문에 DB 엔진은 ACID 원칙을 희생하여 동시성을 얻을 수 있는 방법을 제공한다. 바로 **transaction의 isolation level**이다. **Isolation 원칙을 덜 지키는 level을 사용할수록 문제가 발생할 가능성은 커지지만 동시에 더 높은 동시성을 얻을 수 있다**. ANSI/ISO SQL standard 에서 정의한 isolation level은 `READ UNCOMMITTED`, `READ COMMITTED`, `REPEATABLE READ`, `SERIALIZABLE`이다.

DB 엔진은 isolation level에 따라 서로 다른 locking 전략을 취한다. 요컨대, **isolation level이 높아질수록 더 많이, 더 빡빡하게 lock을 거는 것**이다. 따라서 각각의 isolation level을 언제 사용해야 하는지, 혹은 각 isolation level의 위험성은 무엇인지 알기 위해서는 각 isolation level 별 locking 전략을 파악해야 한다.

각 isolation level 별 locking 전략을 살펴보기 전에, 우선 InnoDB 엔진이 어떤 종류의 lock을 사용하는지 알아보자.
<br />

## InnoDB의 lock

InnoDB는 transaction의 ACID 원칙과 동시성을 최대한 보장하기 위해 다양한 종류의 lock을 사용한다. 그중에서 transaction isolation level을 이해하는 데에 필요한 내용만을 소개하도록 하겠다.

### Row-level lock

가장 기본적인 lock은 **테이블의 row마다 걸리는 row-level lock**이다. 여기에는 크게 shared lock과 exclusive lock의 두 종류가 있다.

**Shared lock(S lock)은 read에 대한 lock**이다. 일반적인 `SELECT` 쿼리는 lock을 사용하지 않고 DB를 읽어 들인다. 하지만 `SELECT ... FOR SHARE` 등 일부 `SELECT` 쿼리는 read 작업을 수행할 때 InnoDB가 각 row에 S lock을 건다.

**Exclusive lock(X lock)은 write에 대한 lock**이다. `SELECT ... FOR UPDATE`나 `UPDATE`, `DELETE` 등의 수정 쿼리를 날릴 때 각 row에 걸리는 lock이다.

S lock과 X lock을 거는 규칙은 다음과 같다 :

- 여러 transaction이 동시에 한 row에 S lock을 걸 수 있다. 즉, 여러 transaction이 동시에 한 row를 읽을 수 있다.
- S lock이 걸려있는 row에 다른 transaction이 X lock을 걸 수 없다. 즉, 다른 transaction이 읽고 있는 row를 수정하거나 삭제할 수 없다.
- X lock이 걸려있는 row에는 다른 transaction이 S lock과 X lock 둘 다 걸 수 없다. 즉, 다른 transaction이 수정하거나 삭제하고 있는 row는 읽기, 수정, 삭제가 전부 불가능하다.

요약하자면, **S lock을 사용하는 쿼리끼리는 같은 row에 접근 가능**하다. 반면, **X lock이 걸린 row는 다른 어떠한 쿼리도 접근 불가능**하다. "Shared"와 "exclusive"라는 이름의 의미와 정확히 일치한다.

### Record lock

Record lock은 row가 아니라 **DB의 index record에 걸리는 lock**이다. 여기도 row-level lock과 마찬가지로 S lock과 X lock이 있다.

Record lock의 예시를 들어보겠다. `c1`이라는 column을 가진 테이블 `t`가 있다고 하자. 이때 한 transaction에서

{% codeblock lang:SQL %}
(Query 1 in transaction A)
SELECT c1 FROM t WHERE c1 = 10 FOR UPDATE;
{% endcodeblock %}

라는 쿼리를 실행했다. 그러면 `t.c1`의 값이 10인 index에 X lock이 걸린다. 이때, 다른 transaction에서

{% codeblock lang:SQL %}
(Query 2 in transaction B)
DELETE FROM t WHERE c1 = 10;
{% endcodeblock %}

라는 쿼리를 실행하려고 하면, 이 query 2는 우선 `t.c1 = 10`인 index record에 X lock을 걸려고 시도한다. 하지만 해당 index record에는 이미 transaction A가 query 1을 실행할 때 X lock을 건 상태이다. 따라서 query 2는 transaction A가 commit 되거나 rollback 되기 전까지 `t.c1 = 10`인 row를 삭제할 수 없다. 이는 `DELETE` 뿐만 아니라 `INSERT`나 `UPDATE` 쿼리도 마찬가지이다.

### Gap lock

Gap lock은 **DB index record의 gap에 걸리는 lock**이다. 여기서 **gap이란 index 중 DB에 실제 record가 없는 부분**이다.

예를 들어 설명해보겠다. `id` column만 있는 테이블이 있고, `id` column에 index가 걸려있다고 하자. 현재 테이블에는 `id = 3`인 row와 `id = 7`인 row가 있다. 그러면 DB와 index table은 아래 그림과 같은 상태일 것이다.

{% codeblock %}
    Index table               Database
-------------------          ---------
| id  | row addr  |          |  id   |
-------------------          ---------
|  3  | addr to 3 |--------->|   3   |
|  7  | addr to 7 |--------->|   7   |
-------------------          ---------
{% endcodeblock %}

그러면 현재 `id <= 2`, `4 <= id <= 6`, `8 <= id`에 해당하는 부분에는 index record가 없다. 이 부분이 바로 index record의 gap이다.

그리고 gap lock은 이러한 gap에 걸리는 lock이다. 즉, gap lock은 해당 gap에 접근하려는 다른 쿼리의 접근을 막는다. Record lock이 해당 index를 타려는 다른 쿼리의 접근을 막는 것과 동일하다. 둘의 차이점이라면 **record lock이 이미 존재하는 row가 변경되지 않도록 보호**하는 반면, **gap lock은 조건에 해당하는 새로운 row가 추가되는 것을 방지하기 위함**이다.

Gap lock의 예시를 들어보겠다. `c1`이라는 column 하나가 있는 테이블 `t`가 있다. 여기에는 `c1 = 13`, `c1 = 17`이라는 두 row가 있다. 이 상태에서 한 transaction에서

{% codeblock lang:SQL %}
(Query 1 in transaction A)
`SELECT c1 FROM t WHERE c1 BETWEEN 10 and 20 FOR UPDATE;`
{% endcodeblock %}

라는 쿼리를 실행했다. 그러면 `t.c1`의 값이 10과 20 사이인 gap에 lock이 걸린다. 즉, `10 <= id <= 12`, `14 <= id <= 16`, `18 <= id <= 20`에 해당하는 gap에 lock이 걸린다. 이 상태에서 다른 transaction이 `t.c1 = 15`인 row를 삽입하려고 하면 gap lock 때문에 transaction A가 commit 되거나 rollback 될 때까지 삽입되지 않는다. `INSERT` 뿐만 아니라 `UPDATE`, `DELETE` 쿼리도 마찬가지이다.

Gap은 한 index 값일 수도, 여러 index 값일 수도, 혹은 아예 아무 값도 없을 수도 있다.

### Lock이 해제되는 타이밍

Transaction이 진행되는 동안, InnoDB 엔진은 위에서 언급한 것처럼 실행되는 쿼리에 맞는 수많은 lock을 DB에 걸게 된다. 이러한 **lock은 모두 transaction이 commit 되거나 rollback 될 때 함께 unlock** 된다.
<br />

## Transaction Isolation Level

이제 각 transaction isolation level에 대해 알아볼 준비가 되었다. 하지만 그 전에 한 가지 용어를 설명하고 넘어가야 한다. 바로 consistent read이다.

### Consistent Read

**Consistent read란 read(=`SELECT`) operation을 수행할 때 현재 DB의 값이 아닌 특정 시점의 DB snapshot을 읽어오는 것**이다. 물론 **이 snapshot은 commit 된 변화만이 적용된 상태를 의미**한다.

Consistent read는 어떤 방법을 통해 이루어질까? 가장 단순한 방법은 읽어온 row에 lock을 걸어 다른 transaction이 할 수 없도록 하는 방법일 것이다. 하지만 InnoDB 엔진은 consistent read를 하기 위해 lock을 사용하지 않는다. 왜냐하면 동시성이 매우 떨어지기 때문이다.

InnoDB 엔진은 실행했던 쿼리의 log를 통해 consistent read를 지원한다. **InnoDB 엔진은 각 쿼리를 실행할 때마다 실행한 쿼리의 log를 차곡차곡 저장한다. 그리고 나중에 consistent read를 할 때 이 log를 통해 특정 시점의 DB snapshot을 복구하여 가져온다.** 이 방식은 비록 복구하는 비용이 발생하긴 하지만, lock을 활용하는 방식보다 높은 동시성을 얻을 수 있다.
<br />

이제 각 transaction isolation level에서 InnoDB가 어떻게 lock을 활용하는지 알아보자.

\* 소개되는 isolation level의 순서는 MySQL reference에 있는 순서와 동일하다.

### REPEATABLE READ

`REPEATABLE READ`는 **반복해서 read operation을 수행하더라도 읽어 들이는 값이 변화하지 않는 정도의 isolation을 보장하는 level**이다.

**`REPEATABLE READ` transaction은 처음으로 read(`SELECT`) operation을 수행한 시간을 기록한다. 그리고 그 이후에는 모든 read operation마다 해당 시점을 기준으로 consistent read를 수행한다.** 그러므로 transaction 도중 다른 transaction이 commit 되더라도 새로이 commit 된 데이터는 보이지 않는다. 첫 read 시의 snapshot을 보기 때문이다.

일반적인 non-locking `SELECT` 외에 lock을 사용하는 `SELECT`나 `UPDATE`, `DELETE` 쿼리를 실행할 때, **`REPEATABLE READ` transaction은 gap lock을 활용**한다\*. 즉, 내가 조작을 가하려고 하는 row의 **후보군**을 다른 transaction이 건들지 못하도록 한다. 여기에 대해서는 아래의 `REPEATABLE READ` vs `READ COMMITTED` 항목에서 다시 다룬다.

<br />
\* Gap lock뿐만 아니라 next-key lock 역시 활용한다. 또한, unique index와 unique search condition을 가진 쿼리에 대해서는 gap lock을 걸지 않는다. 다른 말로 표현하자면, `WHERE` 조건대로 index를 탔을 때 반드시 row가 하나 이하만 걸릴 수 있는 쿼리에 대해서는 gap lock을 걸지 않는다. 어차피 row의 후보군이 하나 이하이기 때문이다.

### READ COMMITTED

`READ COMMITTED`는 **commit 된 데이터만 보이는 수준의 isolation을 보장하는 level**이다.

`REPEATABLE READ` transaction이 첫 read operation을 기준으로 consistent read를 수행하는 반면, **`READ COMMITTED` transaction은 read operation 마다 DB snapshot을 다시 뜬다.** 그렇기 때문에 다른 transaction이 commit 한 다음에 다시 read operation을 수행하면, `REPEATABLE READ`와는 다르게 `READ COMMITTED` transaction은 해당 변화를 볼 수 있다.

"엥? Commit 된 데이터만 보는 건 당연한 거 아니야?" 혹은 "아니, `SELECT` 쿼리마다 snapshot을 다시 뜨면 다음 read에서 복구할 필요가 없는데 snapshot을 왜 뜨는 거야?"라는 생각이 들 수도 있다. 뒤의 `READ UNCOMMITTED` 부분에서 추가로 설명하겠지만, 실제 DB에는 아직 commit 되지 않은 쿼리도 적용된 상태다. **따라서 commit 된 데이터만을 읽어오기 위해서는 아직 commit 되지 않은 쿼리를 복구하는 과정이 필요하다. 즉, consistent read를 수행해야 한다.**

일반적인 non-locking `SELECT` 외에 lock을 사용하는 `SELECT`나 `UPDATE`, `DELETE` 쿼리를 실행할 때, **`READ COMMITTED` transaction은 record lock만 사용하고 gap lock은 사용하지 않는다.** 따라서 phantom read가 일어날 수 있다.

### REPEATABLE READ vs READ COMMITTED

Phantom read가 일어나는 상황을 자세히 알아보자. `c1` column이 있는 table `t`가 있다. 현재 `t`에는 `t.c1 = 13`인 row와 `t.c1 = 17`인 row가 존재한다. 여기서 `READ COMMITTED` transaction A와 transaction B가 아래와 같이 쿼리를 실행하려고 한다.

{% codeblock lang:SQL %}
(Transaction A - READ COMMITTEED)
(1) SELECT c1 FROM t WHERE c1 BETWEEN 10 and 20 FOR UPDATE;
(2) SELECT c1 FROM t WHERE c1 BETWEEN 10 and 20 FOR UPDATE;
(3) COMMIT;
{% endcodeblock %}

{% codeblock lang:SQL %}
(Transaction B - READ COMMITTED)
(1) INSERT INTO t VALUES(15);
(2) COMMIT;
{% endcodeblock %}

두 transaction이 다음과 같은 순서로 실행되었다고 해보자.

{% codeblock lang:SQL %}
(A-1) SELECT c1 FROM t WHERE c1 BETWEEN 10 and 20 FOR UPDATE;
(B-1) INSERT INTO t VALUES(15);
(B-2) COMMIT;
(A-2) SELECT c1 FROM t WHERE c1 BETWEEN 10 and 20 FOR UPDATE;
(A-3) COMMIT;
{% endcodeblock %}

(A-1)번 쿼리가 실행된 경우, 당연히 쿼리 결과는 `t.c1 = 13`인 row와 `t.c1 = 17`인 row 2개일 것이다. 그렇다면 lock은 어떻게 걸려있을까? `READ COMMITTED` transaction은 record lock만 걸고 gap lock은 사용하지 않는다. 따라서 (1)번 쿼리가 실행된 직후 걸려있는 lock은 `t.c1 = 13`과 `t.c1 = 17`에 대한 record lock이다.

이 때 transaction B가 `t.c1 = 15`인 row를 삽입하려고 한다((B-1)번 쿼리). Transaction A는 gap lock을 걸지 않았기 때문에 transaction B는 자유롭게 `t.c1 = 15`인 row를 삽입할 수 있다. 이 상태에서 transaction B는 commit 했다((B-2)번 쿼리).

이제 다시 transaction A가 (2)번 query를 실행한다. 그러면 transaction A의 isolation level은 `READ COMMITTED`이기 때문에 새롭게 snapshot을 갱신해온다. 이 과정에서 transaction B가 삽입한 `t.c1 = 15`인 row를 읽어 들인다. 이것이 바로 phantom row이다.

만약 transaction A의 isolation level이 `REPEATABLE READ`이었다고 하자. 그러면 (B-1)번 쿼리가 실행될 때 `t.c1 = 15`인 gap에 gap lock이 걸려있었을 것이다. 따라서 transaction B는 transaction A가 commit 되어 lock을 해제할 때까지 기다리고, phantom read는 일어나지 않는다. 즉, 내가 업데이트 하려는 `10 <= t.c1 <= 20`에 해당하는 row의 **후보군**이 변화하는 일이 없다.

### READ UNCOMMITTED

`READ UNCOMMITTED` transaction은 기본적으로 `READ COMMITTED` transaction과 동일하다. 대신, **`SELECT` 쿼리를 실행할 때 아직 commit 되지 않은 데이터를 읽어올 수 있다**. 예를 들어, 다음과 같은 상황이 가능하다. 

1. Transaction A에서 row를 삽입했다.
2. `READ UNCOMMITTED` transaction B가 해당 row를 읽는다.
3. Transaction A가 rollback 된다.

이 경우, transaction B는 실제로 DB에 한 번도 commit 되지 않은, 존재하지 않는 데이터를 읽어 들였다. 이러한 현상을 **dirty read**라고 한다.

이것이 가능한 이유는 InnoDB 엔진이 transaction을 commit 하는 방법 때문이다. **InnoDB 엔진은 일단 실행된 모든 쿼리를 DB에 적용한다.** 그것이 아직 commit 되지 않았어도 적용한다. 즉, **특별히 log를 보고 특정 시점의 snapshot을 복구하는 consistent read를 하지 않고 그냥 해당 시점의 DB를 읽으면 dirty read가 된다**. 아래는 해당 내용을 언급한 MySQL reference의 내용이다.

> InnoDB uses an optimistic mechanism for commits, so that changes can be written to the data files before the commit actually occurs. This technique makes the commit itself faster, with the tradeoff that more work is required in case of a rollback.

### SERIALIZABLE

`SERIALIZABLE` transaction은 기본적으로 `REPEATABLE READ`와 동일하다. 대신, **`SELECT` 쿼리가 전부 `SELECT ... FOR SHARE`로 자동으로 변경**된다\*.

이는 `REPEATABLE READ`에서 막을 수 없는 몇 가지 상황을 방지할 수 있다. 예를 들어, [Ditto 님의 블로그에서 소개된 상황](https://blog.sapzil.org/2017/04/01/do-not-trust-sql-transaction/)에서 각 transaction을 모두 `SERIALIZABLE`로 실행한다고 하자.

{% codeblock lang:SQL %}
(A-1) SELECT state FROM account WHERE id = 1;
(B-1) SELECT state FROM account WHERE id = 1;
(B-2) UPDATE account SET state = ‘rich’, money = money * 1000 WHERE id = 1;
(B-3) COMMIT;
(A-2) UPDATE account SET state = ‘rich’, money = money * 1000 WHERE id = 1;
(A-3) COMMIT;
{% endcodeblock %}
(출처 : [Ditto 님 블로그](https://blog.sapzil.org/2017/04/01/do-not-trust-sql-transaction/))

우선, (A-1)번 `SELECT` 쿼리가 `SELECT ... FOR SHARE`로 바뀌면서 `id = 1` 인 row에 S lock이 걸린다. 그리고 (B-1)번 `SELECT` 쿼리 역시 `id = 1`인 row에 S lock을 건다. 그 상황에서 transaction A와 B가 각각 2번 `UPDATE` 쿼리를 실행하려고 하면 row에 X lock을 걸려고 시도할 것이다. 하지만 이미 해당 row에는 S lock이 걸려있다. 따라서 deadlock 상황에 빠지고, 두 transaction 모두 timeout으로 실패할 것이다. 따라서 money는 1로 안전하게 남아있다.

이 경우에서 알 수 있듯이, `SERIALIZABLE` isolation level은 데이터를 안전하게 보호할 수는 있지만 **굉장히 쉽게 deadlock에 걸릴 수 있다**. 따라서 `SERIALIZABLE` isolation level은 deadlock이 걸리지 않는지 신중하게 계산하고 사용해야 한다.

<br />
\* AUTOCOMMIT이 꺼져있을 때만 그렇다.

### SERIALIZABLE이 아니면 `UPDATE`, `DELETE`에 주의하라

한 가지 주의해야 할 점은 **DML, 즉 `UPDATE`나 `DELETE`는 consistent read의 적용을 받지 않는다**는 것이다. 즉, 같은 WHERE 조건을 사용하더라도, 내가 수정하려고 `SELECT` 쿼리로 읽어온 row와 해당 row들을 수정하기 위해 `UPDATE` 쿼리를 날렸을 때 실제로 수정되는 row가 다를 수 있다.

한 가지 예를 들어보겠다. 다음과 같이 2개의 `REPEATABLE READ` transaction이 실행된다고 하자.

{% codeblock lang:SQL %}
(Transaction A - READ COMMITTED)
(1) SELECT COUNT(c1) FROM t WHERE c1 = 'xyz';
(2) DELETE FROM t WHERE c1 = 'xyz';
(3) COMMIT;
{% endcodeblock %}

{% codeblock lang:SQL %}
(Transaction B - READ COMMITTED)
(1) INSERT INTO t(c1, c2) VALUES('xyz', 1), ('xyz', 2), ('xyz', 3);
(2) COMMIT;
{% endcodeblock %}

두 transaction이 다음과 같은 순서로 실행되었다고 해보자.

{% codeblock lang:SQL %}
(A-1) SELECT COUNT(c1) FROM t WHERE c1 = 'xyz'; // 0
(B-1) INSERT INTO t(c1, c2) VALUES('xyz', 1), ('xyz', 2), ('xyz', 3);
(B-2) COMMIT;
(A-2) DELETE FROM t WHERE c1 = 'xyz'; // 3 rows deleted
(A-3) COMMIT;
{% endcodeblock %}

처음에 테이블 `t`이 비어있었다면 (A-1)번 쿼리의 의 실행 결과는 0이다. 이 때 실행된 쿼리는 non-locking `SELECT` 쿼리이므로 lock은 걸려있지 않다. 덕분에 transaction B는 자유롭게 `t.c1 = 'xyz'`인 row를 삽입할 수 있다. 따라서 분명 (A-1)번 쿼리에서는 `t.c1 = 'xyz'`인 row가 0개였고 같은 `WHERE` 조건으로 `DELETE` 쿼리를 실행했음에도 불구하고 (A-2)번 쿼리는 3개의 row를 삭제한다.

만약 위 상황처럼 **consistent read에는 보이지 않는 row에 `UPDATE`와 `DELETE` 쿼리로 영향을 준 경우, 그 시점 이후로는 해당 row가 transaction에서 보이기 시작**한다.

이 상황에 대한 예를 들어보겠다. Transaction A가 다음과 같이 쿼리를 실행한다고 해보자.

{% codeblock lang:SQL %}
(Transaction A - REPEATABLE READ)
(1) SELECT COUNT(c1) FROM t WHERE c1 = 'abc'; // 0
// Transaction B inserted 3 rows where c2 = 'abc' and committed
(2) UPDATE t SET c1 = 'cba' WHERE c1 = 'abc'; // 3 rows updated
(3) SELECT COUNT(c1) FROM t WHERE c1 = 'cba'; // 3
{% endcodeblock %}

그리고 transaction B가 (1)번과 (2)번 쿼리 사이에 `c2 = 'abc'`인 row를 몇 개 삽입했다고 하자. 그러면 아까 전 예시와 동일하게 (2)번 쿼리는 (1)번 쿼리에서는 보이지 않았던 row를 수정할 것이다. 그러면 이 순간부터 transaction A에서는 이 row들이 보이기 시작한다. 따라서 (3)번 쿼리의 결과는 3이 된다.

만약 두 예시에서 transaction isolation level이 `SERIALIZABLE`이었다면 어땠을까? 앞서 모든 `SELECT` 쿼리는 `SELECT ... FOR SHARE`로 자동으로 변경된다고 했다. 따라서 두 예시 모두에서 (A-1)번 쿼리는 record S lock을 걸었을 것이다. 그러면 transaction B에서 `UPDATE` 쿼리를 실행할 때 X lock을 걸려고 할 때, 이미 해당 record에는 S lock이 걸려있으므로 수정되지 않고 대기 상태로 빠질 것이다\*. 따라서 transaction A의 (2)번 쿼리는 안전하게 (1)번 쿼리에서 본 row만 수정한다.

<br />
\* 이 부분은 `t.c1` column에 index가 걸려있는 상황을 가정한 상황이다. 하지만, 필자가 index가 걸려있지 않은 column에 대해서 테스트 했을 때에도 transaction B가 대기 상태로 빠졌다. 이때 걸려있는 lock을 확인해보니, transaction A가 primary key 때문에 생성된 index에 lock을 건 것을 확인할 수 있었다. 추측하건대, `WHERE` 조건에 index가 없는 column만 포함될 locking `SELECT`를 할 경우 해당하는 row의 primary key index에 lock을 거는 것으로 보인다.
<br />

## 결론

InnoDB 엔진은 사용자가 적절히 isolation을 희생하면서 동시성을 높일 수 있도록 여러 isolation level을 제공한다. 하지만 이 과정에서 의문의 버그가 터지지 않도록 각 isolation level을 잘 이해하고 고민하여 isolation level을 선택해야 한다.
<br />

## refs

- [https://ko.wikipedia.org/wiki/ACID](https://ko.wikipedia.org/wiki/ACID)
- [https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-transaction-model.html](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-transaction-model.html)
- [https://www.letmecompile.com/mysql-innodb-lock-deadlock/](https://www.letmecompile.com/mysql-innodb-lock-deadlock/)
- [https://blog.sapzil.org/2017/04/01/do-not-trust-sql-transaction/](https://blog.sapzil.org/2017/04/01/do-not-trust-sql-transaction/)
- [https://jupiny.com/2018/11/30/mysql-transaction-isolation-levels/](https://jupiny.com/2018/11/30/mysql-transaction-isolation-levels/)
