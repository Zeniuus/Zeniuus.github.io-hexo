---
title: Jekyll 블로그 커스터마이징 예시
date: 2017-06-26 21:10:00
categories:
  - Develop
---

안녕하세요, 이번 포스트에서는 지난 포스트에서 배운 Jekyll project의 파일 구조를 바탕으로 실제로 제 Jekyll 블로그를 어떻게 커스터마이징하는지를 보여드리도록 하겠습니다. 파일 구조에 대한 원론적인 이해도 중요하지만, 이를 실제로 어떻게 활용하는지를 보여주는 것 또한 굉장히 도움이 될 것이라고 생각합니다.

이번에 제가 변경할 것은, 아래 사진에서 보이는 블로그 상단의 메뉴바의 항목들을 변경하려고 하는 것입니다.

![blog layout](https://zeniuus.github.io/assets/images/jekyll_customizingexample/original_layout.png)

일단 About은 아무런 쓸모가 없으며, RSS는 제가 뭔지 모르고, Archive는 글을 항목별로 보여주지 못하기 때문에 너무 광범위한 메뉴라고 생각됩니다. 그래서 저는 1. 메뉴바에서 About과 RSS를 지우고, 2. Archive 메뉴를 Develop이라는 메뉴로 바꾼 후, 3. 'develop' tag를 가지고 있는 놈들만 Develop 메뉴에서 보여줄 예정입니다.

<br />
1. 우선 메뉴바에서 About과 RSS 항목을 삭제해보도록 하겠습니다. 그러면 일단 저 항목을 생성하는 파일이 무엇인지 찾아야합니다. 그러기 위해서, 지난 시간에 배웠던 지식인 '블로그의 가장 첫 화면은 project 폴더의 `index.html`이 생성한다'를 활용하여 `index.html` 파일을 확인해보도록 하겠습니다.

	![index.html](https://zeniuus.github.io/assets/images/jekyll_customizingexample/index_html.png)

	네, 파일의 시작이 `<h1>Zeniuus의 블로그</h1>`인 것을 보아 여기에는 상단 메뉴바를 생성하는 코드가 없군요. 그러면 이 파일이 레이아웃으로 사용하고 있는 `default.html`을 확인해보도록 하겠습니다.

	![default.html](https://zeniuus.github.io/assets/images/jekyll_customizingexample/default_html.png)

	여기에 `<html>` tag가 있는 것을 보아하니 이 코드 중 하나가 범인이겠군요. 분명 `index.html`의 코드가 삽입되는 \{\{ content \}\} 위의 부분인 `header.html` 또는 `aside.html` 중 하나일 것 같은데, 이름을 보아하니 `aside.html`은 블로그 왼쪽의 사진이 있는 부분을 생성하는 부분이고, `header.html`이 저희가 고치기를 원하는 메뉴바와 관련된 코드인 것 같습니다. 그러면 `header.html`을 보도록 할까요?

	![header.html](https://zeniuus.github.io/assets/images/jekyll_customizingexample/header_html_original.png)

	보시면 \{&#37; &#37;\}로 감싸져서 `<a>` tag를 생성하는 부분과 RSS라는 내용을 가진 `<a>` tag를 생성하고 있습니다. 저희가 제대로 찾은 것 같군요. 일단 한번 RSS 항목만 지워보도록 하겠습니다. 아래 사진과 같이 주석처리를 해주시거나 삭제하시면 됩니다.

	![header.html 수정](https://zeniuus.github.io/assets/images/jekyll_customizingexample/header_html_fixed.png)

	이제 저장을 하고 `Jekyll serve`로 서버를 실행시켜서 확인해볼까요?

	![RSS 메뉴 삭제](https://zeniuus.github.io/assets/images/jekyll_customizingexample/layout_rss_removed.png)

	와우! 저희가 생각하는 대로 잘 삭제되었습니다.

	그럼 이제 About 메뉴도 삭제해보도록 하겠습니다. 다시 한번 `header.html`의 코드를 잘 보시면, `<a>` tag가 조건부로 생성되고 있음을 느낌상 알 수 있습니다. 파이썬 문법이랑 비슷하다고 생각한다면, 대충 site.pages라는 변수에 대해 iteration을 하는데 각각의 항목의 active 변수가 true면 `<a>` tag를 생성하는 것 같죠? 그러면 느낌대로 한번 해보겠습니다.

	일단 site.pages라는 변수가 어떻게 생성되는지 잘 모르겠으니까, 약간의 구글링을 통해서 알아봅시다. [Jekyll 사이트 다큐멘테이션](http://jekyllrb-ko.github.io/docs/pages/)이 잘 되어있더군요. 저 링크를 들어가서 확인하시면, `파일명.html` 혹은 `폴더명/index.html`으로 파일을 만들면 새로운 페이지가 생긴다는 것을 알 수 있습니다. 그래서 project 폴더를 뜯어봤더니 About.md와 Archive.md가 있음을 확인했습니다. 둘 중 About.md 파일을 열어보겠습니다.

	![About.md](https://zeniuus.github.io/assets/images/jekyll_customizingexample/about_md_original.png)

	보시면 YAML 헤더에 active 변수가 정의되어있음을 알 수 있습니다. 그러면 이 변수를 지워보도록 하겠습니다.

	![About.md 수정](https://zeniuus.github.io/assets/images/jekyll_customizingexample/about_md_fixed.png)

	이제 다시 한번 블로그에 들어가볼까요?

	![About 메뉴 삭제](https://zeniuus.github.io/assets/images/jekyll_customizingexample/layout_about_removed.png)

	원하는 대로 About 메뉴가 잘 삭제된 것을 확인할 수 있습니다.

2. 다음으로 Archive 메뉴를 Develop으로 바꿔보도록 하겠습니다. 여기에는 크게 두 가지 방법이 있을 수 있는데, 기존에 존재하는 `archive.md` 파일을 수정하여 `develop.md` 파일을 생성하던지, 아니면 새롭게 `develop.html` 파일을 생성하여 `archive.md`의 active 변수를 제거하고 `develop.html` 파일에 active 변수를 지정해주는 것입니다. 저는 후자의 방법을 택했습니다.

	그러면 앞의 Jekyll 사이트에서 본 page 생성 방법을 참고하여, Jekyll project 폴더에 `develop`이라는 폴더를 만들고 그 안에 `index.html` 파일을 생성하도록 하겠습니다.

	일단 내용은 3번에서 채우도록 할테니, YAML 헤더 부분만 채워넣도록 하죠. project 폴더에 있는 `index.html`의 내용물을 참고하여 아래와 같이 헤더를 작성합니다. 

	![Develop index.html 헤더](https://zeniuus.github.io/assets/images/jekyll_customizingexample/develop_index_html_header.png)

	이제 저장하고 `Jekyll serve`를 한 후 localhost에 접속하시면 다음과 같이 상단 메뉴바가 바뀐 것을 확인할 수 있습니다.

	![Archive 메뉴 develop으로 변경](https://zeniuus.github.io/assets/images/jekyll_customizingexample/layout_change_archive_to_develop.png)

3. 마지막으로, 새롭게 생긴 Develop 메뉴에서 Develop이라는 태그를 가진 놈들만을 모아서 보여주도록 하겠습니다. 여기서 이야기하는 태그란, 여러분들의 포스트의 YAML 헤더에 정의되어 있는 tags 변수입니다.

	이번에도 2번에서와 마찬가지로 적절히 기존의 `index.html`을 참고하여 Develop 메뉴를 위한 새로운 `index.html`을 작성해도록 하겠습니다. 모든 post에 대해서 만일 각각의 post가 'Develop'이란 tag를 tags에 가지고 있을 경우에만 글의 제목과 미리보기를 제공하고자 합니다. 그래서 아래 사진과 같이 for문과 if문을 활용하여 코드를 작성하였습니다.

	![Develop index.html](https://zeniuus.github.io/assets/images/jekyll_customizingexample/develop_index_html.png)

	이를 저장하고 다시 한번 localhost에 접속해보면 다음과 같이 develop 메뉴가 바뀌어있음을 확인할 수 있습니다.

	![develop 메뉴 글 보여주기](https://zeniuus.github.io/assets/images/jekyll_customizingexample/layout_develop_menu.png)

<br />
지금까지 일부분이지만 블로그의 디자인을 바꿔보는 연습을 해보았습니다. 저는 아직 post.excerpt가 뭔지 모르고, \{&#37; &#37;\}을 어떻게 사용하는지도 정확히 모릅니다. 하지만 기존 개발 지식으로 직접 하나하나 수정해보면서 어떤 부분이 어떤 작용을 하는지는 논리적으로 유추하고 대략적으로 파악할 수 있습니다. 위에서 보신 바와 같이 크게 어려운 작업이 아니니 여러분들도 여러분들만의 블로그를 만들 수 있었으면 좋겠습니다.


