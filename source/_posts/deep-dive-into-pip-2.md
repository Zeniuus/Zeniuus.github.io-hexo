---
title: Deep Dive into pip - 2
date: 2018-10-30 01:33:16
categories:
  - Develop
---
[지난 포스트](/2018/10/24/deep-dive-into-pip-1/)에서는 pip의 기본에 대해서 알아보았다. 주로 requirements.txt에 대한 이야기를 했었는데, 우리가 막힌 부분은 `pip install` 의 `-e` 옵션에 대한 부분이었다.
<br/>

이번 포스트에서는 지난 포스트에 이어서 `pip install -e .` 가 어떤 의미인지 알아볼 것이다. 그렇게 하기 위해서 우리는 setuptools에 대해서 알아야 한다.
<br/>

# setuptools: Preview

## Basic

[setuptools 공식 다큐멘테이션](https://setuptools.readthedocs.io/en/latest/setuptools.html)에 따르면, setuptools는 파이썬의 `distutils` 이라는 라이브러리를 기반으로 개발자들이 자신들의 파이썬 패키지를 쉽게 배포할 수 있도록 도와주는 파이썬 라이브러리이다. pip와 함께 사용되기는 하지만, pip는 패키지를 다운받는 툴인 반면 setuptools는 패키지를 배포하는 툴이기 때문이기 때문에 어느 의미로는 pip와 정 반대의 역할이라고도 볼 수 있겠다. setuptools를 사용하면 자신의 패키지로부터 쉽게 sdist나 egg, wheel을 만들고 이를 업로드하여 배포할 수 있다.
<br/>

setuptools를 쓰는 방법은 간단하다. 프로젝트 root에 `setup.py` 파일을 만들고, 아래와 같이 `setup.py` 안에서 `setuptools.setup` 을 적절한 옵션과 함께 호출해주기만 하면 된다. 
```
# setup.py
from setuptools import setup

setup(**kwargs)
```
이후 콘솔에서 `python setup.py [args]` 를 입력하면 자동으로 cli option에 맞게 배포 파일을 생성해준다. 예를 들어,
```
$ python setup.py sdist bdist_wheel
```
을 입력하면 자동으로 source distribution tar 파일과 wheel binary 파일을 생성해준다.
<br/>

## sdist? egg? bdist_wheel?

이 용어들에 대해서 아는 사람도 있겠지만, 모르는 독자도 있을테니 갑자기 튀어나온 sdist, egg, bdist_wheel 등의 용어에 대해서 짚고 넘어가도록 하겠다.<br/><br/>자신의 프로젝트를 배포할 때, 여러가지 방법으로 배포를 할 수 있을 것이다. 소스를 통째로 배포할 수도 있고, 하나의 파일로 압축하여 배포할 수도 있을 것이다. sdist, egg, wheel은 모두 이러한 배포 포맷들이다.<br/><br/>배포 포맷은 크게 두 가지 형태로 나눌 수 있는데, 소스 코드를 통째로 배포하는 sdist와 프로젝트를 빌드한 결과물만을 배포하는 bdist가 있다.<br/>

### sdist

sdist는 source distribution의 약자이다. 이 포맷은 말 그대로 소스 코드 자체를 배포하는 방식으로, `python setup.py sdist` 를 실행하면 프로젝트 소스의 루트 디렉토리를 통째로 압축한 파일이 생성된다. 압축 파일은 default로 tar.gz 포맷이며, 옵션을 통해 다양한 포맷으로 압축할 수 있다.

### bdist

bdist는 built distribution의 약자이다. 기본적으로 binary package를 만드는 것과 유사하나, 그 결과물이 항상 binary는 아니고 단순히 소스 코드와 바이트 코드만을 포함할 수도 있다고 한다. sdist와의 결정적인 차이는 빌드 혹은 컴파일이 미리 되어있느냐의 차이인데, 이 말은 `python setup.py bdist` 를 실행한 결과물은 즉시 실행 / 사용 가능한 파일이라는 뜻이다. 예를 들어, 윈도우에서 `python setup.py bdist` 를 실행하면 executable installer가 튀어나오고, macOS에서 실행시키면 패키지가 설치된 virtualenv가 튀어나온다.

### egg, wheel

egg와 wheel은 각각 bdist의 배포 포맷이다. 각 포맷의 디테일에 대해서는 나도 정확히 공부해보지는 않았으므로 넘어가도록 하겠다. 다만, 요즘은 wheel이 de facto standard 라고 한다.
<br/>

# setuptools: In Detail

아까 위에서 가장 간단한 `setup.py` 파일을 보았다. `setup()` 한 줄로 되어있는 파일이었다. 물론 이 `setup.py` 로도 충분히 프로젝트를 배포할 수 있지만, 당연히 유저는 프로젝트를 배포할 때 많은 정보를 포함하고 싶을 것이다. 이를 위해 `setup()` 함수는 다양한 option을 kwargs 형태로 지원한다.
<br/>

사실 이번 시리즈의 목적은 setuptools를 완전 정복하는 것이 아니라 `pip install -e .` 가 무엇인지를 설명하기 위한 시리즈이기 때문에, setuptools가 지원하는 수많은 옵션들을 전부 설명하지는 않을 것이다. 주로 사용되는 옵션이나 `pip install -e .` 을 설명하는데 필요한 선까지만 설명을 할 것이다.

## setuptools Options

### metadata 관련

metadata 관련 옵션은 말 그대로 프로젝트의 메타데이터를 지정할 수 있는 옵션이다. 예를 들면, 프로젝트의 이름, 버전, 저자, 공식 홈페이지 등을 지정할 수 있다. 공식 다큐멘테이션에서는 아래와 같은 예시를 들고 있다.
```
# setup.py
from setuptools import setup, find_packages

setup(
    name="HelloWorld",
    version="0.1",
    author="Me",
    author_email="me@example.com",
    description="This is an Example Package",
    license="PSF",
    keywords="hello world example examples",
    url="http://example.com/HelloWorld/",   # project home page, if any
    project_urls={
        "Bug Tracker": "https://bugs.example.com/HelloWorld/",
        "Documentation": "https://docs.example.com/HelloWorld/",
        "Source Code": "https://code.example.com/HelloWorld/",
    }

    # could also include long_description, download_url, classifiers, etc.
    # ...
)
```

### entry_points

`entry_points` 는 배포한 프로젝트를 다운받은 뒤 별도의 세팅 없이 바로 스크립트를 실행할 수 있도록 해주는 옵션이다. 예를 들어 아래와 같이 `entry_points` 를 지정했다고 하자.
```
# setup.py
from setuptools import setup

setup(
    # other arguments here...
    entry_points={
        'console_scripts': [
            'foo = my_package.some_module:main_func',
            'bar = other_module:some_func',
        ],
        'gui_scripts': [
            'baz = my_package_gui:start_func',
        ]
    }
)
```
그러면 이 프로젝트를 설치할 경우 자동으로 `foo`, `bar`, 그리고 `baz` 라는 실행 가능한 entry point가 생긴다. 여기서 말하는 entry point란, non-Windows에서는 스크립트, 즉 Unix 계열에서 따진다면 bash에서 실행할 수 있는 스크립트이며, Windows에서는 .exe 파일을 뜻한다. `entry_points` 의 멋진 점은 운영체제에 알맞은 entry point를 자동으로 생성해준다는 점이다.

### install_requires, extras_require

`install_requires` 및 `extra_requires` 는 requirements.txt와 동일하게 프로젝트의 의존성을 관리할 수 있다. 심지어 의존하는 패키지의 버전을 명시하기 위해 requirements.txt와 동일한 requirement specifier을 사용한다.
<br/>

`install_requires` 는 프로젝트가 항상 필요로 하는 의존성을 나열하는 데에 쓰인다. 반면 `extra_requires` 는 특별한 상황마다 추가적으로 필요한 의존성을 나열할 수 있다. 예를 들어, ci 환경에서 필요한 별도의 패키지를 `extra_requires` 에 ci라는 항목으로 나열하고, ci 환경에서만 이를 추가적으로 설치할 수 있다. `extra_requires` 에 선언한 추가적인 의존성은 그냥 설치하면 설치되지 않고, 설치한다고 지정을 해 주어야 비로소 설치된다.
<br/>

아래는 `install_requires` 와 `extra_requires` 의 사용 예시이다.
```
# Project A's setup.py
from setuptools import setup

setup(
    name="Project-A",
    install_requires=["aiohttp"],
    extras_require={
        'PDF':  ["ReportLab>=1.2", "RXP"],
        'reST': ["docutils>=0.3"],
    },
    ...
)
```
```
# Project B's setup.py
from setuptools import setup

setup(
    name="Project-B",
    install_requires=["Project-A[PDF]"],
    ...
)
```
이렇게 하고 프로젝트 B를 설치하면 `aiohttp` 와 `ReportLab>=1.2`, 그리고 `RXP` 가 설치된다.
<br/>

## setup.cfg

파이썬 프로젝트를 몇 번 다뤄본 사람이면 `setup.py` 말고 `setup.cfg` 라는 비슷한 이름의 파일을 본 적이 있을 것이다. setuptools는 `setup.py` 대신 `setup.cfg` 라는 configuration 파일로 대신 `setuptools.setup()` 의 옵션을 지정하는 것을 허용한다. `setup.cfg` 포맷에 맞게 옵션을 작성하고 `setup.py` 와 같이 프로젝트 루트에 두면 자동으로 setuptools가 `setup.cfg` 파일을 찾아서 설정을 오버라이드 한다. 포맷에 대해서는 공식 홈페이지에 상세히 설명되어 있으니 굳이 여기서 짚고 넘어가지는 않겠다.
<br/>

사실 왜 굳이 `setup.cfg` 파일을 따로 생성하는 것을 지원하는지는 모르겠다. 공식 홈페이지에서는 
> This approach not only allows automation scenarios but also reduces boilerplate code in some cases.
이라고만 나와있고 별 다른 특별한 use case를 설명해주지는 않는다. 다만 개인적으로는 configuration 파일을 따로 두는게 뭔가 마음이 편하긴 한 것 같다.
<br/>

## setuptools Develop Mode

다음과 같은 상황을 생각해보자. 내가 클라이언트와 서버 프로젝트를 별도로 작성하고 있다. 당연히 두 프로젝트는 서로에 대한 의존성을 어느 정도 가지며, 하나의 기능을 개발하기 위해서 두 프로젝트를 동시에 수정해야 하는 경우도 있을 것이다.  이 때 integration test를 돌린다고 해보자. 그러면 두 프로젝트를 같은 폴더에 넣은 테스트 전용 프로젝트를 따로 파지 않은 이상, 코드를 수정하고 integration test를 돌리려고 할 때마다 각 프로젝트를 배포해야 한다. 굉장히 번거롭기 짝이 없다. 꼭 클라이언트와 서버 모델의 경우 뿐만이 아니다. 작업이 조금만 커지면 두 개 이상의 연관된 프로젝트를 동시에 다뤄야 하는 경우가 일상 다반사다. 이러한 경우 어떻게 다수의 프로젝트에 걸친 개발을 할 수 있을까?
<br/>

이를 위해 setuptools는 코드를 로컬에 임시로 배포할 수 있는 develop mode를 지원한다. Develop mode를 통해 프로젝트를 로컬에 배포하면, setuptools는 소스코드를 PATH directory에 복사하지 않고 프로젝트가 설치된 폴더를 참조하게만 설정한다. 따라서, 마치 `pip install` 을 통해 패키지를 설치한 것과 같은 효과를 내지만 소스코드를 수정할 때마다 즉시 반영되는 것이다(C extention 등의 파일은 다시 빌드해야 한다). 그래서 ‘develop mode’이다.
<br/>

사용법은 간단하다. 위에서 구성한 `setup.py` 파일만 있으면 된다. 그 이후에는 `python setup.py develop` 을 콘솔에 입력하기만 하면 된다. 그러면 실제로 `site-packages` 폴더에 설치되는 대신 `.egg-link` 라는, 프로젝트 소스 코드를 링킹해주는 파일을 생성한다. 반대로 삭제는 `python setup.py develop --uninstall` 을 입력하면 된다.
<br/>

# 다시, pip install -e .

이제 정말 `pip install -e .` 라는 커맨드가 무엇인지 이해할 준비가 다 되었다. 다시 한번 pip의 공식 다큐멘테이션으로 돌아가보자.

## pip -e option

공식 다큐멘테이션에 따르면 pip의 `-e` 옵션은 editable 옵션으로, 기본적으로 setuptools의 develop mode와 동일하다. 다만 pip의 editable mode를 사용하면 생성되는 egg-info 파일이 프로젝트 루트에 상대적으로 생성된다는 점에서 egg-info 파일이 커맨드를 실행한 폴더에 상대적으로 생성되는 setuptools의 develop mode 보다 장점이 있다고 한다. 정말 소소하기 그지 없는 장점이다...
<br/>

pip의 `-e` 옵션을 통해 로컬 혹은 VCS 프로젝트를 로컬에 설치할 수 있는데, 각각의 설치 방법은 아래와 같다.
```
$ pip install -e path/to/project # Install local project
$ pip install -e git+http://repo/my_project.git#egg=SomeProject # Install VCS project
```

또한, 프로젝트 뒤에 `extra_requires` 에 작성된 feature을 명시함으로써 추가적인 의존성을 설치할 수 있다. 예를 들어, 아까 위에서 든 프로젝트 A가 있다고 하자. 이 때 프로젝트 A를 PDF 및 reST feature을 사용할 수 있도록 설치하려면 아래와 같이 커맨드를 입력하면 된다.
```
$ pip install -e .[PDF,reST]
```
<br/>

# 글을 맺으며

지금까지 pip와 setuptools에 대해서 꽤나 날림으로 알아보았다. 현재 내 개인 프로젝트에 `setup.py` 를 추가하고 있는 중인데, 확실히 로컬에서 개발하기에 편해진 느낌이 있다. 일단 소소하게는 패키지 바깥에 정의된 테스트 파일에서 프로젝트 파일들을 import 할 때 더 이상 오류가 나지 않는 점이 마음에 든다. 앞으로 다양한 옵션들을 이것저것 테스트 해볼텐데, 편한 사용법이 있으면 또 다른 포스트로 정리할 것이다.
<br/>

## Reference
- [pip 공식 다큐멘테이션 - User Guide](https://pip.pypa.io/en/stable/user_guide/)
- [pip 공식 다큐멘테이션 - Reference (pip install)](https://pip.pypa.io/en/stable/reference/pip_install/)
- [setuptools 공식 다큐멘테이션](https://setuptools.readthedocs.io/en/latest/setuptools.html)
