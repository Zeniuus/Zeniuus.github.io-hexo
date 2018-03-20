---
title: Jekyll로 만든 블로그에 테마 적용하기
date: 2017-06-22 20:25:00
categories:
  - Develop
---
[지난 포스팅](http://zeniuus.github.io/posts/blog-with-github-pages-and-jekyll-apply-theme/)에서는 새 Jekyll project를 생성하고 이를 Github Pages와 연동하는 것까지 해보았습니다. 이번 포스팅에서는 블로그를 예쁘게 꾸미는 것을 해보겠습니다. 예쁘게 꾸미는 것이라고 하니까 거창하게 들리겠지만, 그냥 수없이 많은 테마 중 하나를 골라서 적용하는 것 뿐입니다.

가장 먼저 해야할 것은 역시 테마를 고르는 것이겠죠? 개발자의 목숨줄인 구글을 통해서 원하는 테마를 검색합니다. 제 블로그에 적용된 테마는 [jekyllthemes.org](http://jekyllthemes.org/)라는 사이트에서 찾은 '[voyager](http://jekyllthemes.org/themes/voyager/)'란 테마입니다. 테마를 고르셨으면 해당 테마의 소스 파일을 다운받습니다.

이제 테마를 적용해볼텐데, 굉장히 간단합니다. 이전 포스트에서 만든 로컬의 [자신의 Github 아이디].github.io repo 내용물을 싹 날려버리고 다운받은 테마 소스 파일을 그대로 복사-붙여넣기 한 다음 `git add` - `git commit` - `git push`를 해주시면 됩니다. 만약 `git push`를 할 때 오류가 뜬다면 가장 쉬운 해결 방법은 Github에서 repo를 날리고 새로 생성한 후 push하는 것입니다. 물론 해결 방법이 따로 있겠지만, 저희는 초보 개발자니까요 :)

이제 다시 [자신의 Github 아이디].github.io에 접속하면 테마가 적용된 것을 볼 수 있습니다. 바로 접속할 시 변경사항이 반영되지 않았을 수도 있으니, 혹시 변화가 없으신 분들은 잠시 후에(제법 깁니다 - 10초 넘게) 다시 시도해보시면 테마가 정상적으로 적용된 것을 확인할 수 있을 것입니다.

다음 포스트에서는 적용한 테마를 입맛대로 커스터마이징하는 방법에 대해서 포스팅하겠습니다.
