---
title: Python3 Useful Tips - 1
date: 2018-01-13 15:15:00
categories:
  - Develop
---
안녕하세요, 이번 포스팅에서는 Python3을 사용하실 때 유용하게 사용할 수 있는 팁에 대해서 작성해보고자 합니다.

이번 글은 비정규 시리즈로 작성할 생각을 하고 있는데요, 앞으로 개발을 하면서 Python3에 대한 유용한 팁들을 배울 때마다 [Python3 Useful Tips] 시리즈의 글을 작성할 예정입니다.

오늘 소개해드릴 팁은 Python3의 `defaultdict`와 `namedtuple`과 관련된 이야기입니다..

# `defaultdict`

`dict` 자료구조는 타 Collections 자료구조(`list`, `set`...)에 비해서 key가 있다는 큰 차이가 있기에 특정 상황에서 굉장히 유용하게 사용될 수 있죠. 예를 들면 `list`는 index만으로 데이터에 접근해야하기 때문에 코드의 가독성이 떨어지는 경우가 종종 있는데, 이럴 때 `dict`를 사용하면 가독성도 높이고 편하게 데이터를 저장할 수 있습니다.

하지만 가끔가다 불편한 점이 있는데, 한 가지 예시 상황을 보여드리도록 하겠습니다. 예를 들어, 사람과 소속 단체의 `tuple`의 `list`가 있다고 합시다. 이 때 각 동아리에 어떤 사람들이 들어있는지 `list`로 정리하고 싶습니다. 이런 경우 `dict`을 쓰면 아주 편리하게 코드를 작성할 수 있죠.

    people_group_tuples = [('Zeniuus', 'SPARCS'), ...]
    group_member_dict = {}

    for pair in people_group_tuples:
        group_member_dict[pair[1]].append(pair[0])

하지만, 위의 코드는 실행시키자마자 오류가 날 것입니다. 왜냐하면 **`group_member_dict`에 'SPARCS'라는 key를 가진 key-value pair가 없기 때문**입니다. 따라서 `group_member_dict[pair[1]]`은 `KeyError`을 띄울 것입니다.

이 오류를 해결하려면 아래와 같이 코드를 수정해야 할 것입니다.

    people_group_tuples = [('Zeniuus', 'SPARCS'), ...]
    group_member_dict = {}

    for pair in people_group_tuples:
        # key가 없으면 key-value pair을 만들어준다.
        if group not in group_member_dict:
            group_member_dict[pair[1]] = []
        group_member_dict[pair[1]].append(pair[0])

이제 문제 없이 코드가 실행될 것입니다. 하지만 좀 지저분해보이죠?

이를 깔끔하게 해결할 수 있는 방법이 바로 `collections.defaultdict`를 사용하는 것입니다. `defaultdict`는 `dict` class를 상속받아 구현된 subclass인데요, **key에 해당하는 pair가 없는 경우 KeyError을 띄우지 않고 default로 지정해놓은 값을 key에 배정한 다음 해당 명령을 수행**합니다. 구체적으로는 key에 해당하는 값이 없을 경우 `__missing__(key)`라는 함수를 실행하여 key에 default 값을 지정해줍니다.

그러면 `defaultdict`를 활용하여 위 코드를 바꿔볼까요?

    from collections import defaultdict

    people_group_tuples = [('Zeniuus', 'SPARCS'), ...]
    group_member_dict = defaultdict(list)

    for pair in people_group_tuples:
        group_member_dict[pair[1]].append(pair[0])

위와 같이 `defaultdict(list)`로 `defaultdict`를 만들면 key가 없을 때 자동으로 해당 key에 `list()`(= `[]`)를 assign한 후 `.append(pair[0])`를 실행합니다. 굉장히 코드가 깔끔해졌죠?

`defaultdict()`를 생성할 때 인자로 넘기는 값은 인자를 받지 않는 함수입니다. 이는 `__missing__(key)`에서 사용되는데, **인자 없이 이 함수를 실행시킨 return 값을 key에 대한 default 값으로 지정**해줍니다. `list`의 경우 인자 없이 실행했을 때(`list()`) return 값이 empty list(= `[]`)이기 때문에 default 값으로 empty list가 들어가게 됩니다.

만약 `defaultdict()`에 아무 인자도 넣지 않고 실행한다면 해당되는 value가 없는 key에 대한 access가 일어났을 때 `dict`와 동일하게 `KeyError`을 띄우게 됩니다.

# `namedtuple`

`collections.namedtuple`은 **`tuple` 자료구조의 각 값에 접근할 때 index가 아닌 key로 접근을 가능하게 해주는 자료구조**입니다. 간단한 설명만 들어도 굉장히 좋아보이죠? 코드의 가독성이 ***매우*** 좋아집니다. `dict`를 사용하지 않고 간단하게 `tuple`의 형태를 유지하면서 `dict`처럼 사용하는 것이죠.

간단한 예시를 들어보겠습니다. 사람의 이름, 성별, 이메일 `tuple`의 `list`를 가지고 여러가지 작업을 해야 하는 상황이면, 아래와 같이 `namedtuple`을 사용할 수 있습니다.

    from collections import namedtuple

    Person = namedtuple('Person', ['name', 'gender'])
    people_list = [Person('Zeniuus', 'male'), ...]

    def person_str(person):
        # 기존 tuple과 같이 index 접근도 가능하고 field 접근도 가능하다.
        return f'{person[0]} is {person.gender}.'

    for person in people_list:
        print(person_str(person))

`namedtuple`을 사용하면 기존 `tuple`처럼 `tuple_[i]`와 같은 접근도 가능하고, `tuple_.field_name`과 같이 field 접근도 가능합니다.


오늘은 `collecitons` library에 속한 몇 가지 좋은 툴을 알아봤는데, 좀 더 자세한 사항은 [Python3 공식 documentation](https://docs.python.org/3.3/library/collections.html)을 참고해주시기 바랍니다.
