---
title: Python3 Context Manager
date: 2017-12-29 22:11:00
categories:
  - Develop
---
안녕하세요, 이번 시간에는 Python3의 context manager라는 것을 배워보도록 하겠습니다.

## Python에서 파일 사용

아마 여러분들은 이미 Python에서 파일을 열고, 읽거나 쓰고, 다시 닫는 데에 굉장히 익숙하실 것입니다. 바로 아래와 같은 코드를 통해 Python에서 파일에 대한 작업을 수행할 수 있습니다.

    f = open('file_name', 'w') # '쓰기' 버전으로 파일 열기

    f.write('The first line!') # 'file_name'이라는 파일에 쓰기

    f.close() # 파일 닫기

여기서 주의할 점은 파일의 사용이 끝나면 반드시 **파일을 닫아야 한다는 점**입니다. 그렇지 않으면 리소스가 낭비되고 파일에 예측 불가능한 작업이 이루어질 수도 있죠. 하지만, 프로젝트의 규모가 커지고 로직이 복잡해질수록 연 모든 파일을 관리하며 닫는 일은 쉽지 않은 일입니다.

## Context manager를 활용해 파일 자동 닫기

그래서 있는 것이 바로 Python의 context manager라는 것입니다. 백문이불여일견이니 아래의 코드를 보면서 설명해드리도록 하겠습니다.

    with open('file_name', 'w') as f:
        f.write('The first line!')

짜잔~ 이 코드는 아까 처음에 보여드렸던 `open()`과 `close()`로 둘러쌓인 코드와 '거의' 같은 일을 합니다. **`with`의 scope를 벗어나는 순간 `f`를 자동으로 닫아줍니다.** 하지만, 위 코드는 단순히 파일을 닫아주는 것 이상의 역할을 합니다. 사실, 위의 코드는 아래와 동등한 코드입니다.

    f = open('file_name', 'w')
    try:
        f.write('The first line!')
    finally:
        f.close()

이와 같이 'with'와 'open()'을 함께 사용한다면 **`f.write()`를 할 때의 예외처리**도 함께 할 수 있게 됩니다.

이와 같이 **특정 작업(여기서는 `f`에 대한 작업)의 context(`f`를 열고 닫기 또는 예외처리)를 관리해주는 object**을 **context manager**라고 부릅니다. Python3 공식 documentation에서의 context manager에 대한 설명은 아래와 같습니다.

> A context manager is an object that defines the runtime context to be established when executing a with statement. The context manager handles the entry into, and the exit from, the desired runtime context for the execution of the block of code.

즉, 특정 행동을 할 때 항상 일정한 런타임 환경을 만들어주기 위해 특정 행동에의 진입과 종료를 관리해주는 친구가 바로 context manager이라는 것이죠.

제가 구글링을 하다 본 가장 마음에 드는 설명은 context manager를 아래와 같이 표현한 것이었습니다.

> Of all of the most commonly used Python constructs, context managers are neck-and-neck with decorators in a "Things I use but don't really understand how they work" contest.

## Context manager 만들기

만약 파일에 대한 작업과 같이 어떤 작업을 하기 전후에 항상 실행되어야 하는 일이 있을 경우 `open()`과 같이 여러분들만의 context manager을 만들어서 사용하시면 이를 자동으로 처리할 수 있습니다.

Context manager을 만드는 방법에는 크게 두 가지 방법이 있는데, 첫 번째는 바로 **`Class`를 만들고 `__enter__`와 `__exit__`을 정의하는 것**입니다.

    Class MyContextManager(object):
        def __enter__(self):
            pre_processing()
            return something
        def __exit__(self):
            post_processing()

    with MyContextManager() as something:
        # pre_processing() is already executed
        do_your_work()
    # post_processing() executes
    # right after escaping the
    # scope of with statement

`with` 문과 같이 사용하면 `with` 문에 진입할 때 `__enter__`가 실행되면서 `__enter__` 함수의 리턴 값을 `as`로 받을 수 있습니다. 또한, `with` 문 안쪽이 실행되는 동안 예외가 발생하거나 `with` 문을 탈출하면 `__exit__`이 실행됩니다.

두 번째 방법은 **`contextlib`라는 Python의 built-in library를 사용하는 것**입니다.

    from contextlib import contextmanager

    @contextmanager
    def my_context_manager():
        pre_processing()
        yield something
        post_processing()

    with my_context_manager() as something:
        # pre_processing() is already executed
        do_your_work()
    # post_processing() executes
    # right after escaping the
    # scope of with statement

특정 함수에 `contextlib` 모듈의 `@contextmanager` decorator를 사용하고 `yield`를 사용하면 `yield` 전은 `with` 문에 진입할 때, `yield` 후는 `with` 문을 탈출할 때 실행됩니다.

저는 Python에서 `sqlite3` 모듈의 `connection`을 관리하는 용도로 context manager를 처음 사용했는데, 확실히 개발자로 하여금 로직에 집중하게 해주고 코드가 간결해지는 효과를 느꼈습니다. 여러분들도 항상 작업의 context를 관리할 필요가 있을 때에는 context manager을 사용하길 권장해드립니다.
