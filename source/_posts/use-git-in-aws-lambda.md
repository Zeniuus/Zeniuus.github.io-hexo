---
title: 삽질기 - AWS Lambda를 활용하여 Github에 자동으로 커밋하기
date: 2018-10-20 18:28:45
categories:
  - Develop
---
이번 글은 AWS Lambda 배포 과정 삽질기다. 삽질의 포인트를 요약해보자면 아래와 같다.
<br/>

* AWS Lambda로 Cron job scheduling 하기
* YAML로 작성된 파일의 내용을 유지하며 일부만 변경하기
* AWS Lambda 환경에서 git 사용하기
<br/>

상황은 대충 이렇다. 지금 인턴으로 다니고 있는 회사(Lablup)에서는 주기적으로 회사의 Docker hub에 이미지를 업데이트 한다. 내가 해야하는 일은 이 업데이트를 캐치하여 Github 레포지토리에 저장된 Docker 이미지 목록(yaml) 파일을 같이 업데이트 하는 것이었다.
<br/>

이 할 일을 잘 분석해보면 “어떻게 이미지 업데이트를 캐치할 것인가?”라는 선택 문제와 “변경사항을 반영하여 yaml 재작성하기”, “Github 레포지토리에 push 하기”라는 구현 문제로 나눌 수 있다.
<br/>

## 이미지 업데이트 캐치하기 - AWS Lambda + Amazon CloudWatch
이미지 업데이트 캐치에는 크게 Docker hub에서 제공하는 웹훅을 사용하는 방법과 크론을 돌리는 방법이 있었다.
<br/>

Docker hub에서 제공하는 웹훅에 대한 내용은 [공식 다큐멘테이션](https://docs.docker.com/docker-hub/webhooks/)에 잘 나와있다. 많은 경우에 사용하는 일반적인 해법이기도 하다. 하지만 이번 경우에는 크게 도움이 되지 않을 것이라고 나는 판단했다. 왜냐하면 웹훅 설정을 레포지토리별로 해야하는데, 우리 회사에서는 관리하는 레포지토리가 너무 많았기 때문이다. 언어 / 프레임워크별로 존재하는 레포지토리에 하나하나 웹훅을 걸기도 귀찮았을 뿐더러, 웹훅을 사용하면 이후에 추가될 레포지토리에도 매번 웹훅 설정을 해줘야 하는게 문제였다.
<br/>

따라서 나는 다른 솔루션인 크론을 돌리는 것을 선택했다. 불필요한 리소스 낭비가 있긴 하겠지만 어차피 정말 짧아봤자 한 시간에 한 번 정도 돌리기 때문에 애초에 과금이 될 정도의 리소스를 사용하지 않을 것 같았다.
<br/>

그러면 남은 문제는 크론을 어디서 돌리냐는 것이었다. 회사에는 아직 다른 크론잡이 없어서 이거 하나 돌리자고 인스턴스를 파는 건 굉장히 오버스러운 일이었다. 다행히 사수(?) 포지션에 계시는 회사분께서 AWS Lambda로 크론잡을 돌릴 수 있다는 귀띔을 해주셨고, 내가 생각하기에도 AWS Lambda 정도가 딱 맞는 툴인 것 같아 AWS Lambda를 쓰기로 했다.
<br/>

AWS Lambda로 크론 설정을 하는 것은 간단하다. Lambda의 트리거를 설정할 때 CloudWatch Events를 고르고, 원하는 대로 cron 표현식을 작성해주기만 하면 된다.
<br/>

## YAML 재작성하기
이제 구현을 해야 하는데, 생각 외로 시간을 많이 잡아먹었던 부분은 YAML 설정 파일을 재작성하는 부분이었다. 처음 생각할 때는 그냥 Docker hub에서 이미지랑 태그, 해시 전부 fetch 하고 적절히 파싱해서 dictionary로 만든 다음 YAML parser로 덮어쓰면 되겠다! 했는데, 이게 불가능했다. 그 이유는 기존 YAML이 변수를 사용하거나, 레거시 설정이 있거나, 지우면 안 될 것 같은 주석이 있었기 때문이다. 근데 YAML parser로 이 파일을 읽어들이면 이런 것들이 싹 날라갔다. 대표님께서는 이야기를 들으시더니 “YAML parser 조금만 뜯으면 되겠네요 ㅎㅎ” 하시고 넘어가셨는데... 아직 나한테는 좀 무리인 작업이었다.
<br/>

그래서 어쩔 수 없이 선택한 방법은 무식하게 정규 표현식으로 덮어쓸 수 있는 부분만 찾아서 위치를 기억하고 읽어들인 후 덮어쓸 string을 손수 만들어서 replace 하는 것이었다. 정규 표현식에 엄청 능숙하지는 않아 꽤나 삽질을 했지만, 그래도 여전히 정규 표현식의 강력한 힘을 느낄 수 있었다.
<br/>

## AWS Lambda에서 git 커맨드 사용하기
그리고 내가 가장 많은 삽질을 한 부분은 바로 변경 사항을 커밋하고 푸시하는 부분이었다. 이게 왜 어렵냐고 생각할 수 있는데, AWS Lambda가 사용하는 베이스 이미지에 git executable이 깔려있지 않았다. 그 말은 git executable을 사용하는 라이브러리를 쓰기 위해서는 직접 AWS Lambda에 git executable을 깔아야 한다. 바로 이 부분에서 엄청난 삽질을 했다.
<br/>

알아본 결과, 대부분은 해결책으로 AWS Lambda가 베이스 이미지로 사용하는 이미지에 git executable을 설치하는 방법을 제시했다. 사실 지금 생각해서는 이 방법이 제일 깔끔했을 것 같은데, 나는 AWS를 많이 쓴 적이 없어서 베이스 이미지를 바꾸면 뭔가 회사의 다른 AWS 프로젝트에 문제가 생길 수도 있지 않을까 걱정이 되어서 일단 이 방법을 빼버렸다.
<br/>

첫 번째로 시도한 방법은 git executable을 업로드 할 zip 폴더에 같이 넣어서 압축하는 방법이었다. 이 방법은 git executable의 용량이 너무 큰 관계로 업로드가 안 되는 바람에 실패했다. S3에 올리면 대용량의 소스코드를 업로드 할 수 있다니 참고하도록 하자. 나는 S3 파는 게 귀찮아서 그냥 다른 방법을 시도했다.
<br/>

두 번째 방법은 git executable을 아예 쓰지 않고 커밋과 푸시를 하는 것이었다. 여기에는 git executable을 쓰지 않고 pure Python으로 작성된 git 구현체인 [Dulwich](https://github.com/dulwich/dulwich)라는 라이브러리를 사용했다. 이 방법을 사용하니 다행히도 금방 커밋과 푸시를 할 수 있었다. 이제 기분 좋게 프로젝트를 푸시하려는데, 생각해보니 우리 회사 프로젝트에는 당연히 마스터 브랜치에 프로텍션이 걸려있었다. 따라서 인증이 필요한 상태인데, 찾아보니 이 라이브러리는 아직 개발이 진행중이라 몇몇 기능이 빠져있었고, ssh를 사용한 인증도 그 중 하나였다. 나는 울며 겨자먹기로 커밋을 되돌리는 수 밖에 없었다.
<br/>

마지막으로 시도하여 성공한 방법은 git executable을 코드 실행시에 임시로 설치하는 것이었다. 파이썬에는 [git_lambda](https://github.com/bcongdon/git_lambda)라는 프로젝트가, Node.js에는 [lambda-git](https://github.com/pimterry/lambda-git)이라는 프로젝트가 있다. 이 프로젝트를 사용하면 코드 실행시에 임시로 git executable을 AWS Lambda가 돌아가는 머신에 설치하고 PATH에 임시 git 설치 경로를 추가해준다. 나는 파이썬으로 프로젝트를 구현하고 있었기 때문에 `git_lambda` 를 사용했고, 테스트 결과 git executable이 잘 작동하는 것을 확인했다.
<br/>

그런데 이상한 일이 발생했다. 실제로 프로젝트에서 커밋과 푸시를 하는 로직을 구현했더니 갑자기 `bad git executable` 이라는 오류가 찍히면서 코드 실행이 안 되는 것이다. stdout으로 찍어서 확인해보니 handler 함수의 첫 줄 조차 실행이 되지 않았다.
<br/>

원인은 내가 사용한 git 라이브러리의 import 시점에 있었다. 나는 `dulwich`  대신 [GitPython](https://github.com/gitpython-developers/GitPython)이라는 git 라이브러리를 사용했는데, 이놈이 import를 할 때부터 git executable을 사용하는 것이 문제였다. import 시점을 `git_lambda` 셋업 이후로 변경해주니 더 이상 `bad git executable` 오류가 뜨지 않았다.
<br/>

마지막 피날레는 github 인증 문제였다. 로컬에서 ssh를 사용한 푸시가 잘 되는 것을 확인하고 AWS Lambda에 배포해서 테스트를 해봤더니, 이번에는 ssh executable이 없단다(...) 좀 찾아보다가 AWS Lambda용 ssh executable을 못 찾은 나는 결국 Github token으로 인증 방식을 바꾸었다. 이럴거면 나는 뭐하러 `dulwich` 에서 `GitPython` 으로 옮긴 것인가...
<br/>

## AWS Lambda에서 돌아갈 프로젝트의 Dependency 설치 시 유의사항
마지막으로 프로젝트를 AWS Lambda에 배포하기 위해 의존성 설치를 할 때의 꿀팁을 적어보겠다. [AWS 공식 홈페이지](https://docs.aws.amazon.com/ko_kr/lambda/latest/dg/lambda-python-how-to-create-deployment-package.html)를 보면 프로젝트가 다른 라이브러리에 의존하고 있는 경우 의존하는 라이브러리를 같은 폴더 루트에 두고 압축하여 배포하라고 되어있다. 문제는 이들을 설치할 때의 환경이 AWS Lambda가 돌아가는 환경과 다를 수 있다는 것이다. 나만 하더라도 macOS에서 설치했으니까 Linux 환경과 다를 수 있다. 이게 문제가 되는 경우는 의존하는 라이브러리가 바이너리 파일을 설치하는 경우이다. 이 경우 바이너리 포멧이 달라 프로젝트가 AWS Lambda 환경에서 돌아가지 않을 수 있다.
<br/>

따라서 어떻게 해야 하나면, 압축 뿐만 아니라 의존성 설치 자체를 AWS Lambda의 베이스 이미지와 동일한 환경에서 해야한다. 이를 쉽게 하는 방법은 바로 docker을 사용하는 것이다. [해당 블로그 포스트](https://binx.io/blog/2017/10/20/how-to-install-python-binaries-in-aws-lambda/)에 Python 3.6으로 작성된 프로젝트의 패키지를 Docker container 안에서 빌드하고 빼내는 과정이 잘 정리되어 있다. 나도 이 블로그 포스트를 보고 쉽게 패키지를 빌드할 수 있었다. 다른 언어로 작성되어 있어도 Dockerfile의 베이스로 할 이미지를 정하는 부분과 패키지 설치 부분 코드만 적절히 바꾸면 쉽게 따라할 수 있을 것이다.
<br/>
