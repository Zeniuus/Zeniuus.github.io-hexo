---
title: Deep Dive into pip - 1
date: 2018-10-24 22:08:06
ca:
---
# Intro

최근 회사에서 새 프로젝트에 기여를 하기 위해 테스트를 돌리는 와중, `import error` 가 뜬 적이 있었다. 다른 프로젝트에서는 전부 PATH를 추가하지 않아도 테스트 파일이 프로젝트 모듈들을 잘 import 했는데, 새로 clone 받은 이 프로젝트에서만 테스트 파일에서 프로젝트 모듈을 import 하지 못하고 있었다. 잠깐 고민하던 나는 기존 프로젝트와 새 프로젝트의 차이는 단순히 clone을 받았느냐, 아니면 설치 스크립트로 깔았느냐라는 점을 깨닫고 설치 스크립트를 열심히 뒤져보았고, 아래의 두 줄이 clone 받은 프로젝트에서 테스트가 돌아가지 않는 원인이라고 추측했다.

```
pip install -U -q pip setuptools
pip install -U -r requirements-dev.txt
```

해당 두 줄을 실행하고 다시 테스트를 돌려보니 테스트가 잘 실행되었다. 하지만, 나는 도저히 무슨 일이 일어났는지 이해할 수 없었다. `-q` 옵션은 대략 `--quiet` 의 약자일 것이라고 쳐도, `-U` 옵션은 무엇이며, 왜 저 두 줄을 실행했더니 갑자기 `from ai.backend.kernel.base import pipe_out` 이 동작하게 된 것인가? `$PATH` 를 추가할 것 같진 않아 보이는데...
<br/>

맨날 pip를 쓰지만 위 두 줄을 이해할 수 없다는 데에 충격을 받은 나는 저 두 줄이 무슨 일을 하는지 알기 위해 열심히 구글링을 했다. 그런데, 생각보다 간단하게 잘 정리된 글이 없었기 때문에 나는 pip, setuptools 등의 공식 다큐를 거의 통째로 읽다시피 해야만 했다. 아직도 완벽하게 이해된 것은 아니지만, pip와 관련된 정리된 글이 없기 때문에 내가 공부한 것을 쉽게 읽을 수 있도록 정리하여 글로 남기기로 했다.
<br/>

이 글의 난이도는 몇몇 프로젝트를 통해 pip와 virtualenv(+ maybe pyenv)를 써보았지만, 직접 큰 프로젝트를 구성해보거나 프로젝트를 배포해본 적이 없는 사람들에게 적절하...다고는 자신할 수 없고, 그 정도가 되게끔 글을 작성하도록 노력했다. 자주 사용되는 pip의 옵션이라던지, pip 관련 자료를 찾다보면 튀어나오는 `setup.py` 나 `setuptools` , 혹은 `sdist` 나 `bdist_wheel` 등의 키워드가 무엇인지에 대해 서술한다.
<br/>

\* 쓰다보니 길어져서 여러 포스트로 나누어서 작성하게 되었다.
<br/>

# pip basics

역시 가장 핵심이 되는 pip에서부터 이야기를 시작해보겠다.

## requirements.txt

다들 알다시피 pip는 파이썬 패키지 매니저다. 주로 사용하는 커맨드는 아래의 3개일 것이다.

1. `$ pip install [package-name]` : 패키지 설치하기
2. `$ pip install -r requirements.txt` : 프로젝트의 모든 의존성 설치하기
3. `$ pip freeze > requirements.txt` : 프로젝트의 모든 의존성 저장하기

각 커맨드에 대한 설명은 굳이 하지 않아도 될 것이라고 생각한다. 다만, requirements.txt에 대해서는 한 마디를 하고 넘어가고 싶다. 파이썬 프로젝트를 조금 해본 사람이라면 requirements.txt가 의존성이 명시된 파일이라는 것은 알겠지만, 정확히 어떤 포맷인지는 모를 수 있다. requirements.txt의 포맷은 단 한 줄로 요약할 수 있다.

> requirements.txt의 각 줄은 `pip install`의 인자이다. 

이 한 줄만 기억하면 된다.
<br/>

공식 홈페이지에서는 requirements.txt 파일의 여러가지 사용법에 대해 명시하고 있다.

1. 의존하는 패키지의 버전을 제한할 수 있다. 이 때 버전을 제한하기 위해 ==, >, >=, <, <=, ~= 등의 이항연산자를 사용하는데, 이러한 문법을 requirement specifier 라고 지칭한다([Glossary — Python Packaging User Guide](https://packaging.python.org/glossary/#term-requirement-specifier) 침고). 다른 연산자는 딱 보면 알겠지만, ~=는 조금 생소할 수 있다. PEP 40에 따르면 ~=은 compatible release operator로,
```
package_a ~= V.N
```
    은
```
package_a >= V.N, == V.*
```
	과 동일하다. 즉 상위 버전을 유지하면서 latest version을 다운받으라는 의미이다. 더 상세한 설명은 [PEP 440](https://www.python.org/dev/peps/pep-0440/#compatible-release)을 참고하도록 하자.
2. VCS 서버 상의 원격 프로젝트를 설치할 수 있다. 이 기능은, 예를 들어 오리지널 패키지에 버그가 생겼을 때 자신이 직접 folk하여 버그를 수정한 후 수정한 버전의 패키지를 사용하고 싶을 때 유용하다. requirements.txt 파일에 아래와 같이 추가하면 된다.
```
git+https://myvcs.com/some_dependency@sometag#egg=SomeDependency
```
	점차 시니어 개발자가 되면서 프로젝트 커스터마이징이 능숙해지면 매우 쓸모있는 기능일 것 같다는 생각이 든다.
<br/>

## pip with virtualenv

직접적으로 관련이 있는 것은 아니지만, pip를 이야기할 때 virtualenv를 빼놓고 이야기할 수 없을 것 같다. virtualenv는 파이썬을 위한 가상 실행 환경을 제공해준다. 조금만 개발을 해보았다면 왜 virtualenv가 필요한지 자연스럽게 알게 될 것이다. 같은 머신에서 여러가지 프로젝트를 같이 작업할 때, virtualenv를 사용하므로써 의존성을 프로젝트마다 잘 관리할 수 있게 된다. virtualenv가 없다면 의존하는 패키지의 버전이 꼬여 프로젝트가 정상적으로 돌아가기 힘들 것이다. 만약 지금까지 몇 개의 파이썬 프로젝트를 진행했지만 virtualenv를 처음 들어봤거나 virtualenv를 사용하지 않았다면 바로 지금이 설치할 시간이다.
<br/>

virtualenv의 원리에 대해서 자세하게 설명할 생각은 없지만, 간단하게 설명하고 넘어가고자 한다. virtualenv는 가상 환경을 생성, 제공, 삭제할 수 있는 툴이다. 가상 환경은 단순하게 하나의 폴더로 구성되어 있다. 특정 가상환경을 사용하려고 하는 경우 virtualenv는 환경변수인 PATH를 해당 폴더로 변경하여 해당 폴더에 설치된 패키지만 인식할 수 있도록 한다. pip를 통해 설치되는 모든 패키지 역시 이 폴더에 설치되어 독립된 가상 환경 밖에서는 보이지 않는다. 
<br/>

개인적으로 생각하는 virtualenv를 사용했을 때의 또 하나의 장점은 `pip freeze > requirements.txt` 가 불필요한 의존성을 추가하지 않는다는 것이다. 프로젝트를 시작할 때 가상 환경을 하나 실행시켜두고 거기에만 의존성을 설치하면 나중에 requirements.txt 파일을 생성할 때 불필요한 의존성이 포함되지 않는다.
<br/>

다만 virtualenv는 약간 불편한 점이 있는데, 직접 shell을 켜서 
```
$ source [생성한 가상 환경 이름]/bin/activate
```
를 하고, 가상환경을 끌 때는
```
$ deactivate
```
를 입력해줘야 한다는 점이다. 만약 가상환경을 켜고 끄는 것을 까먹고 pip로 의존성을 관리하면 나중에 이유도 모르고 의존성이 꼬이는 일이 생길 수 있다. 따라서 pip로 무언가를 설치하거나 삭제할 때에는 현재 활성화 되어있는 가상 환경이 무엇인지 잘 체크해야 한다.
<br/>

하지만 이러한 불편함을 한 방에 해결해주는 도구가 있다. 바로 [smartcd](https://github.com/cxreg/smartcd)라는 툴이다. 해당 툴은 `cd` 커맨드에 훅을 걸어 쉘 스크립트를 실행할 수 있는 도구이다. 따라서 프로젝트 폴더에 들어갈 때 가상 환경을 activate 해주는 훅을 걸고, 폴더에서 나갈 때 deactivate 해주는 훅을 걸어놓으면 아주 편하게 가상 환경을 관리할 수 있다! 써보면 정말 편리한, 필자가 강력 추천하는 툴이다.
<br/>

## 뜬금없는 -e 옵션
다시 처음으로 돌아가서, 그렇다면 처음 보았던 그 커맨드는 무슨 뜻인가?
```
pip install -U -q pip setuptools
pip install -U -r requirements-dev.txt
```
[pip 공식 다큐멘테이션](https://pip.pypa.io/en/stable/reference/pip_install/#options) 통해 `-U` 옵션이 `--upgrade` 옵션이고, `-q` 옵션이 `--quiet` 옵션이라는 것은 알아냈다. 그런데 문제는 requirements-dev.txt의 내용이었다. 
```
-e .[dev]
```
달랑 위의 한 줄 만이 있을 뿐이었다. 해당 디렉토리에 ‘dev’라는 이름이 들어간 파일은 requirements-dev.txt 하나 밖에 없었다.
<br/>

열심히 다큐를 읽어본 결과, `-e` 옵션이 editable install을 위한 옵션이라는 것을 알았다. 그런데 적혀있는 설명이라고는 달랑 아래 한 줄 이었다.

> “Editable” installs are fundamentally “setuptools develop mode” installs. 

나는 눈물을 머금고 setuptools에 대해서 검색하러 갈 수 밖에 없었다.
<br/>

(다음 내용은 setuptools에 대한 내용입니다.)
<br/>
