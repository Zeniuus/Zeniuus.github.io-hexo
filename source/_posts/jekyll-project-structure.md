---
title: Jekyll project 폴더 파일 구조 파헤치기
date: 2017-06-23 01:00:00
categories:
  - Develop
---
이번 포스팅에서는 Jekyll로 만들어진 블로그를 커스터마이징 하기 위해 Jekyll project의 파일 구조를 분석하고 YAML 헤더에 대해서 알아보겠습니다. HTML에 대한 기본 지식이 어느정도 있다고 가정하고 포스팅을 작성하였습니다. 하지만 없어도 상관 없을 것 같습니다. 글이 길어질 것 같습니다만, 새로운 것을 공부하기 위해서는 최소한의 시간 투자는 반드시 필요하다고 생각합니다. 최대한 이해하기 쉽게 작성하였으니 끝까지 읽어주시면 감사하겠습니다.

[Jekyll 홈페이지](http://jekyllrb-ko.github.io/docs/structure/)에 들어가서 보면, Jekyll project의 기본적인 파일 구조가 아래와 같이 생겼다고 말하고 있습니다.

	.
	├── _config.yml
	├── _drafts
	|   ├── begin-with-the-crazy-ideas.textile
	|   └── on-simplicity-in-technology.markdown
	├── _includes
	|   ├── footer.html
	|   └── header.html
	├── _layouts
	|   ├── default.html
	|   └── post.html
	├── _posts
	|   ├── 2007-10-29-why-every-programmer-should-play-nethack.textile
	|   └── 2009-04-26-barcamp-boston-4-roundup.textile
	├── _data
	|   └── members.yml
	├── _site
	├── .jekyll-metadata
	└── index.html

하지만 봐도 무슨 말인지 잘 모르겠습니다. 그래서 이것저것 만져보면서 직접 어떤 구조로 되어있는지 확인해보았습니다.

그 결과, 가벼운 커스터마이징을 위해 우리가 알아야 할 것은 아래의 5가지라는 것을 알아냈습니다.

	.
	├── _config.yml
	├── _includes
	|   ├── footer.html
	|   └── header.html
	├── _layouts
	|   ├── default.html
	|   └── post.html
	├── _posts
	|   ├── 2007-10-29-why-every-programmer-should-play-nethack.textile
	└── index.html

여전히 많고 복잡해보이지만, HTML을 조금 다뤄보신 분이시라면 크게 어렵지 않을 것입니다. `.yml`이 무슨 확장자인지 몰라도 전혀 문제 없습니다. 이제 하나하나의 역할을 살펴보도록 하겠습니다.

1. `_config.yml`

    여러 setting들이 기록되어 있는 파일입니다. 우리가 앞서 Jekyll server을 돌리기 위해 `jekyll serve`를 실행시켰는데, 이 때 추가적인 옵션을 하나도 주지 않은 이유가 이 `_config.yml` 파일 안에 설정이 기록되어 있기 때문입니다.

    파일을 열어보시면 아래와 같이 작성되어 있을 것입니다. 작성되어있는 내용은 테마마다 다를 수 있습니다.

    ![_config.yml 이미지](/images/jekyll_directorystructure/config.png)

	여기서 잘 보시면 주석으로 Site settings, Build settings, Posts settings, Theme settings라는 항목들이 있는데, 우리는 블로그의 많은 것을 커스터마이즈 하지 않을 것이므로 Site settings가 뭔지만 알면 됩니다.

	이 Site settings에서는 다른 파일들에서 사용될 변수를 지정할 수 있습니다. 이들 변수는 다른 Jekyll project를 구성하는 파일에서 \{ \{ site.[변수명] \} \}과 같이 참조될 수 있습니다. 예를 들어서, 위의 제 블로그의 `_config.yml`에 정의되어있는 `title`이라는 변수를 다른 html 파일에서 사용하고 싶다면 \{ \{ site.title \} \}이라고 쓰면 사용할 수 있습니다.


2. `_layouts`

	여러분들이 마크업 언어로 작성할 포스트들이 삽입될, 블로그의 디자인과 직접적으로 연결된 레이아웃을 지정하는 파일이 저장된 폴더입니다. 우리가 가장 많이 손볼 폴더라는 뜻이죠. 덕분에 설명도 제일 깁니다. 길다고 스킵하지 마시고 다 읽어주세요!

	제가 다운받은 테마에는 `compress.html`, `default.html`, `page.html`, `post.html`까지 총 4가지 파일이 있었습니다. 여러분들이 다운받은 테마는 다른 이름 / 다른 개수의 파일이 있을 수 있습니다.

	그 중 `post.html` 파일을 열어보겠습니다. 파일을 열어보면 아래와 같이 작성되어 있음을 확인할 수 있습니다.

	![post.html 이미지](/images/jekyll_directorystructure/layout_post.png)

	보시면 일반적인 html 파일과 몇가지 다른 점이 보입니다.

	1. html, head, body tag가 없습니다. 그 이유는 이 html 파일이 다른 파일에 삽입되는 코드이기 때문입니다.

		맨 위에 - 3개로 위아래가 감싸진 부분이 보이시나요? 그리고 `layout: default`라고 적혀있습니다. 이 말은 이 파일이 `default.html` 파일을 레이아웃으로 사용하고 거기에 content로 삽입되어질 것이라는 의미입니다.

		조금 더 설명하자면, - 3개로 감싸진 부분을 YAML 헤더라고 합니다. Jekyll은 이러한 YAML 헤더가 있는 파일을 특별하게 인식하고 취급합니다. 예를 들어, 이 `post.html`에서는 YAML 헤더에서 레이아웃 파일을 `default.html`로 지정하고 있습니다. 따라서 이 코드는 평범한 html 파일로써 렌더링되는 것이 아니라, `default.html`이라는 다른 레이아웃 파일에 삽입되어져 렌더링 될 것입니다.

		그러면 `default.html` 파일에는 html, head, body tag가 있을까요? 확인해보겠습니다.

		![default.html 이미지](/images/jekyll_directorystructure/layout_default.png)

		`default.html` 파일에 제대로 html, body tag와 \{ \{ content \} \}가 있음을 확인할 수 있습니다(head tag가 없는 것은 뒤의 `_includes` 부분에서 다룹니다). 즉, `default.html` 파일의 이 \{ \{ content \} \} 부분에 `post.html` 파일의 소스코드가 삽입되어 렌더링 될 것입니다.

		자, 그러면 코드 19번째 줄에 있는 \{ \{ content \} \}의 의미도 알 수 있겠죠? 이 post.html 파일 역시 어떤 파일의 레이아웃으로 사용되어 그 파일의 내용물이 \{ \{ content \} \} 부분과 치환될 것이라는 말입니다. 이름이 post.html인 것을 보아 여러분들의 포스트가 \{ \{ content \} \}로 올 것이라는 예상을 할 수 있습니다.

	2. \{ \{ \} \} 안에 page.xxx라는 것들이 자주 보입니다.

		이 두개의 중괄호로 감싸져있는 page.xxx는 이 파일을 레이아웃으로 사용할 파일에서 정의한 변수입니다. 이 부분은 뒤의 `_posts` 부분에서 다시 상세하게 언급하겠습니다.

	3. \{&#37; &#37;\}로 둘러쌓인 무언가가 있습니다.

		한번에 너무 많은 것을 공부하면 두 마리 토끼를 다 놓칠 수 있습니다. 이는 다른 글에서 따로 알아보도록 하겠습니다. 간단한 커스터마이징에는 알 필요 없는 기능입니다.

	정리하자면, `_layouts` 폴더에는 블로그의 레이아웃을 결정하는 여러개의 파일이 들어있습니다.


3. `_includes`

	위의 `default.html` 파일의 소스코드에서 설명하지 않았던 것이 하나 있습니다. 바로 \{ \{ include xxx \} \} 입니다.

	대충 느낌을 보아하니 뭔가 \{ \{ content \} \}랑 비슷한 역할을 할 것 같죠? 맞습니다. 이 \{ \{ include xxx \} \}를 통해 `_includes` 폴더에 있는 파일을 추출하여 사용할 수 있습니다. 그러면 바로 html tag 아래에 포함되어 있는 `head.html` 파일을 한번 확인해볼까요?

	![head.html 이미지](/images/jekyll_directorystructure/include_head.png)

	`head.html` 파일이 YAML 헤더 없이 head tag와 함께 시작하는 것을 확인할 수 있습니다. 위의 `default.html` 파일에 head tag가 없는데, 그 부분에 삽입되면 딱이겠군요. 이런 식으로 자주 사용되는 코드들을 `_includes` 폴더에 따로 저장하고 재사용하면 편리합니다.

		Q : _layouts와 _includes의 차이점을 잘 모르겠어요!
		A : 제가 몰라서 적어놓은 질문입니다. 혹시 아시는 분께서는 메일로 명쾌한 설명 부탁드립니다.

4. `_posts`

	여러분들이 글을 작성하여 저장하는 곳이 바로 이 _posts 폴더입니다. 여기에 여러분들이 마크업 언어(html, markdown 등)로 블로그 포스트를 작성하시면 Jekyll이 자동으로 이를 렌더링하여 예쁜 블로그를 만드는 것입니다.

	여기에 들어가는 글은 기본적으로는 보통의 마크업 언어로 작성하는 대로 작성하시면 되지만, 한 가지 특별한 것이 있습니다. 바로 아래 사진과 같이 파일 맨 위에 YAML 헤더가 있다는 것입니다. 

	![YAML 헤더 이미지](/images/jekyll_directorystructure/post_example.png)

	글을 포스팅할 때 이 헤더가 빠지면 작성한 포스트가 블로그에서 보이지 않습니다. 반드시 넣어주셔야 합니다.

	위 파일의 YAML 헤더를 보면 아까 `_layouts`를 설명할 때 있던 `post.html`이나 `default.html` 파일보다 훨씬 더 많은 무언가가 있습니다. 이들은 각각 자신이 레이아웃으로 사용할 파일들에서 변수로 사용될 수 있습니다. 2번 `_layouts` 항목에서 후에 설명하겠다던 \{ \{ page.xxx \} \}가 바로 이 YAML 헤더에서 정의된 변수를 끌어다가 쓰는 것입니다.

	YAML 헤더에 정의된 여러가지 변수 중 `layout` 변수를 보면 `post.html`이라고 적혀있습니다. 즉, 이 마크다운 파일은 `post.html` 파일을 레이아웃으로 사용한다는 뜻이죠. 아까 위에서 언급한 `post.html`의 \{ \{ content \} \}에 여러분들의 포스트가 올 것이라는 예측이 정확하게 맞았습니다.

	자, 이제 어떤 식으로 페이지가 렌더링되는지 알 수 있습니다. 여러분들이 블로그 글을 마크다운 파일로 작성하신 후 YAML 헤더에 `layout: post.html` 이라고 적으면, 이 포스트는 `post.html`을 이용하여 렌더링됩니다. 그런데 `post.html` 파일에는 `layout: default.html` 이라고 적혀있죠. 따라서 이 포스트를 렌더링하기 위해서는 `default.html`을 레이아웃으로 사용해야 합니다. 즉, 아래와 같은 dependency가 있습니다.

		default.html <-- post.html <-- 여러분들의 포스트.md

	참고로, YAML 헤더에서 정의된 변수들은 그 파일이 레이아웃으로 지정되는 파일에서만 사용될 수 있는 것이 아니라, 그 레이아웃 파일이 레이아웃 파일로 지정하는 파일에서도 사용할 수 있습니다. 즉, 모든 한 파일의 YAML 헤더에서 정의된 변수는 레이아웃 hierarchy에서 그 파일의 상위에 있는 파일이면 모두 사용 가능합니다. 따라서, 제가 이 `.md` 파일에서 지정한 `title` 변수는 두 단계 위의 `default.html` 파일에서도 \{ \{ page.title \} \}을 통해 사용할 수 있습니다.

5. `index.html`

	Jekyll은 project 폴더에서 자동으로 `index.html`이라는 파일을 찾아 블로그의 첫 화면으로 렌더링합니다. 즉, `index.html` 역시 기본적으로는 `_posts`의 포스트와 다르지 않다는 것이죠. 단지 여러분들의 블로그에 들어오는 방문자들이 볼 가장 첫 화면이라는 점을 제외하고 말입니다.

이제까지 Jekyll project 폴더의 가장 기본적인 구조에 대해서 알아보았습니다. 설명을 디테일하게 하려다보니 많이 길어졌네요. 요약을 하자면 다음과 같습니다.

1. `_config.yml`에서 정의된 변수를 다른 파일에서 \{ \{ site.xxx \} \}와 같이 사용할 수 있다.
2. Jekyll은 YAML 헤더라는 놈이 맨 위에 있는 파일을 특별하게 취급한다.
3. YAML 헤더에 정의된 `layout` 변수를 통해 그 파일이 사용될 레이아웃을 지정할 수 있다. 이 때 파일 A에 `layout: B`라고 되어있으면 파일 B의 \{ \{ content \} \}에 A의 코드가 삽입된다.
4. 파일 A에서 YAML 헤더에 정의된 변수들을 파일 A가 레이아웃으로 사용하는 파일 B, C...에서 \{ \{ page.xxx \} \}를 통해 사용할 수 있다.
5. `_includes`에는 자주 사용되는 코드를 저장해놓고 재사용할 수 있다.
6. `index.html`은 블로그 포스트와 거의 똑같다. 딱 하나 다른 점은, Jekyll이 자동으로 블로그 첫 화면으로 만들어준다는 것이다.
7. 마크다운 파일에 YAML 헤더를 붙이지 않으면 블로그 포스트가 보이지 않는다.

가끔 보시면 `site.pages`와 같이 정의하지 않았음에도 막 쓰이는 변수가 있습니다. 이는 아직 설명하지 않은 부분이니, 혹시 내가 온 파일을 뒤져도 못찾은 변수가 사용되고 있다면 Jekyll이 자동으로 생성하신 변수라고 생각하시면 됩니다.

또한, `site.xxx`와 `page.xxx`의 차이를 명확히 구분하시길 바랍니다. `site.xxx`는 `_config.yml`에서 정의된 변수들이고, `page.xxx`는 YAML 헤더에서 정의된 변수들입니다.

설명이 이해가 잘 되지 않는 부분이 있으면 메일로 지적 부탁드립니다.

위의 내용을 숙지했다면 추가적인 설명 없이도 기본적인 블로그의 테마를 조금씩 수정할 수 있을 것입니다. 하지만 초보 개발자에게 응용은 쉽지 않습니다. 우리에게 필요한 것은 concrete한 예시죠. 따라서 다음 포스팅에서는 어떻게 위의 내용을 바탕으로 적용된 테마를 수정할 수 있는지 알아보도록 하겠습니다.

