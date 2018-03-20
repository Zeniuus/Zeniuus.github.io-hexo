---
title: Github Pages와 Jekyll로 블로그 만들기
date: 2017-06-22 17:30:00
categories:
  - Develop
---
첫 포스트에서는 이 블로그와 같은 블로그를 만드는 법을 알아보겠습니다.

이 블로그는 Github에서 제공하는 Github Pages라는 서비스와 Jekyll이라는 블로그 지향적인 정적 사이트 생성기를 사용하여 제작되었는데요, 마크업 언어로 파일을 작성하여 Github repo에 올리기만 하면 자동으로 Jekyll이 이를 랜더링하여 정적 웹사이트를 완성해줍니다. 쉽게 이야기하면, 여러분들이 markdown 형식의 글만 작성하면 복잡하게 html / css 파일을 작성하거나 서버를 직접 돌리지 않고도 Github와 Jekyll이 자동으로 여러분들만의 예쁘고 깔끔한 블로그를 만들어준다는 것입니다.

사실 Github Pages 자체에서 Jekyll을 사용하여 웹사이트를 랜더링하기 때문에 여러분들의 컴퓨터에 굳이 Jekyll을 설치하지 않아도 되지만, 충분한 공부가 되기 위해 이번 포스팅에서는 Jekyll을 설치한 후 여러분들의 첫 블로그를 만들어보도록 하겠습니다.
<br />
<br />
1. Jekyll 설치

	우선 Jekyll을 설치해보도록 하겠습니다. 아래의 커맨드를 shell에 입력하여 Jekyll을 설치합니다.

	    gem install jekyll

	이 과정에서 여러가지 오류가 생길 수 있습니다.

	`ruby 2.1.0` 이상이 필요하다고 한다면, `brew`로 `ruby`를 설치해주시거나
	
	    brew install ruby
	
	혹은 이미 설치되어 있다면 `brew`로 `ruby` 버전을 업그레이드 해주시면 됩니다.
	
	    brew upgrade ruby

	또한, 아래와 같이 permission이 없다는 에러가 발생할 수 있습니다.
	
	    ERROR:  While executing gem ...(Gem::FilePermissionError) 
	    You don't have write permissions for the /Library/Ruby/Gems/2.0.0 directory. 

	이럴 경우에는 sudo 권한을 주어 업그레이드 하면 됩니다.
<br />
<br />
2. Jekyll project 생성

	이제 새로운 Jekyll project를 생성해보도록 하겠습니다. 아래의 코드를 실행하여 `new-my-blog`라는 폴더에 Jekyll project를 생성합니다.

		jekyll new my-new-blog

	이 때 `my-new-blog`라는 폴더는 없어도 됩니다.

	여기서도 오류가 발생할 수 있습니다.

	한 가지 가능한 오류는 `bundler`에 대한 dependency error입니다.

		Dependency Error: Yikes! It looks like you don't have bundler or one of its dependencies installed.
		In order to use Jekyll as currently configured, you'll need to install this gem.
		The full error message from Ruby is: 'cannot load such file -- bundler'
		If you run into trouble, you can find helpful resources at https://jekyllrb.com/help/! 

	이럴 경우에는 단순히 `bundler`를 설치해주시면 됩니다.

		gem install bundler

	이 때도 permission이 필요하다는 오류가 발생할 수 있습니다. 그러면 위와 마찬가지로 sudo 권한을 주시면 됩니다.
<br />
<br />
3. Jekyll server 실행

	우선 생성한 `my-new-blog` project 폴더로 이동합니다.

		cd my-new-blog

	아래의 커맨드를 실행하여 `localhost:4000`으로 블로그 서버를 실행합니다.

		jekyll serve

	이제 `localhost:4000`을 통해 접속할 수 있습니다.
<br />
<br />
4. Github Pages와 연동

	이제 방금 생성된 Jekyll project를 Github Pages와 연동해보도록 하겠습니다.

	우선 Github에 접속하여 새로운 repo를 만드는데, 이름을 반드시 `[자신의 아이디].github.io`로 생성해야 합니다. 반드시요!

	repo를 생성하셨으면 해당 repo를 자신의 컴퓨터로 clone해 옵니다.

		git clone https://github.com/[자신의 아이디]/[자신의 아이디].github.io.git

	그 다음 위의 2번에서 만든 jekyll project 폴더에 있는 내용물을 모두 clone한 저장소로 복사-붙여넣기 합니다.

	이제 로컬 저장소로 이동하여 로컬 저장소에 있는 파일들을 github에 push해 줍니다.

		git add . // 해당 repo의 모든 파일을 track합니다.
		git commit -m "initial commit" // add된 파일을 commit 합니다.
		git push -u origin master // origin의 master branch를 upstream branch로 지정하고 push합니다.

	이제 Github Pages와 로컬 Jekyll project가 연동되었습니다. `[자신의 아이디].github.io`에 접속하시면 3번에서 `localhost:4000`에 접속하여 확인했던 블로그와 동일한 화면을 볼 수 있습니다.
