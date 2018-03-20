---
title: Git Rebase (2)
date: 2018-01-27 17:50:00
categories:
  - Develop
---
안녕하세요, 이번 포스팅에서는 지난 포스팅에 이어서 `git rebase`에 대해 조금 더 탐구해보도록 하겠습니다. 지난 포스팅이 `git rebase`의 개념과 작동 원리에 초점을 맞췄다면, 이번 포스팅은 구체적인 예시를 통해 `git rebase`의 더 다양하고 강력한 기능들을 어떻게 사용할 수 있는지에 초점을 맞춰서 작성했습니다.

# 과거의 커밋 수정하기

`git rebase`를 자주 사용하는 용도 중 하나는 **과거의 커밋을 수정하는 것**입니다. 이 때 '과거의 커밋'은 현재 HEAD가 있는 커밋, 즉 `git commit --amend`를 통해 고칠 수 있는 커밋 뿐만이 아니라 현재 커밋부터 맨 처음 커밋까지의 모든 커밋을 의미합니다. 여러 커밋을 하면서 작업하는 도중에 빠뜨린 내용이 있을 때 `git rebase`가 없다면 새로운 커밋을 추가해야 해서 커밋 히스토리에 같은 기능의 커밋이 두 개 이상이 될 테지만, `git rebase`를 사용한다면 같은 기능의 커밋을 한개로 유지할 수 있습니다.

그러면 어떻게 과거의 커밋을 수정하는 것인지 알아보겠습니다. 대략적인 작업의 흐름은 아래와 같습니다.

1. 수정하고 싶은 커밋으로 HEAD를 이동시킨다.
2. 커밋을 수정한다.
3. 다시 원래 branch로 HEAD를 돌려놓는다.

설명만 들으면 간단하죠? git을 조금 써보신(그리고 `git rebase`는 모르는) 분들이시라면 아래와 같이 생각하실 수도 있습니다.

1. 수정하고 싶은 커밋으로 HEAD를 이동시킨다. => `$ git checkout [commit]`
2. 커밋을 수정한다. => `$ git add [files]` + `$ git commit --amend`
3. 다시 원래 branch로 HEAD를 돌려놓는다. => `git checkout [branch]`

하지만 위 방법은 생각대로 작동하지 않습니다. 왜냐하면 **`git commit --amend`를 통해 커밋을 수정하면 기존 커밋이 수정되는 것이 아니라 새로운 커밋이 생성되기 때문에, 커밋 히스토리에 새로운 가지가 자라나게 됩니다.**

따라서, 과거의 히스토리를 고치고 싶은 경우에는 반드시 `git rebase`를 사용해야만 합니다. 그럼 `git rebase`로 어떻게 과거의 커밋을 고칠 수 있는지 알아보겠습니다.

`git rebase`는 **'Interactive mode'** 라는 모드를 지원하는데요, 이 모드에서는 `git rebase`를 통해 커밋의 base를 재정의할 때 각 커밋들에 대해 추가적인 작업을 할 지에 대해 지정할 수 있습니다. 추가적인 작업에는 커밋 메세지 수정, 커밋을 통해 변경된 파일 내용 수정, 커밋 적용 포기, 이전 커밋과 같은 커밋으로 합치기 등이 있습니다. 이 중 '커밋을 통해 변경된 파일 내용 수정' 옵션을 사용하면 과거의 커밋을 수정할 수 있습니다.

그러면 실제로 `git rebase`의 interactive mode를 통해 과거의 커밋을 바꿔보도록 하겠습니다. 우선 `git log --graph`를 통해 이 블로그 레포지토리의 커밋 히스토리를 확인해봅시다.

![Zeniuus의 블로그 커밋 히스토리](https://zeniuus.github.io/assets/images/git_rebase_example/blog_repo_commit_history.png)

만약 제가 이전 Python3 context manager 글에 오타가 있어서 수정해야 한다고 해보죠. 그러면 head 위치의 커밋까지 포함하여 4개 전의 커밋을 수정해야 하니까 아래와 같이 `git rebase`의 interactive mode를 켜보도록 합시다.

    $ git rebase -i head~4

이 커맨드를 조금 더 분석해보도록 하겠습니다. 이전 시간에서 `git rebase`의 작동 원리에 대해서 배울 때에는 `git rebase master dev`라는 2개의 인자를 가진 명령어를 사용했습니다. 하지만 지금은 인자가 head~4 하나죠? 만약 `git rebase`에 인자를 하나만 주면, 이는 두 번째 인자로 HEAD를 준 것과 동일한 효과를 보입니다. 즉 위의 명령어는 **"head부터 head~4까지의 커밋을 head~4에 다시 적용시켜라"** 라는 의미입니다. 여기에 **"interactive mode를 통해 커밋이 적용될 때 부가 옵션을 줄 것이다"라는 것을 `-i`라는 옵션을 통해 추가한 것**이죠.

위의 커맨드를 입력하면 아래와 같은 vim 창이 뜰 것입니다.

![git rebase interactive mode (1)](https://zeniuus.github.io/assets/images/git_rebase_example/git_rebase_interactive_mode_1.png)

창 맨 위쪽에는 "[이 커밋에 적용할 액션] [커밋 해시] [커밋 메세지]"의 구조로 되어 있고, 아래 Commands에는 각 커밋에 적용할 수 있는 옵션과 옵션에 대한 설명이 있습니다. 현재 각 커밋 앞에 pick이 적혀있는 것을 보니 default로는 특별한 변화 없이 새 base에 모든 커밋을 동일하게 적용시킬 것입니다.

아무것도 수정하지 않은 상태에서 `:q`나 수정한 뒤 `:wq`를 통해 vim을 종료하면 vim을 통해 지정한 옵션을 바탕으로 `git rebase`를 진행합니다. 만약 지금 상태에서 vim을 종료하면 default에서 아무런 변화도 주지 않았으니 HEAD~4부터 HEAD까지의 커밋을 HEAD~4에 다시 적용할 것입니다. 즉, 아무 변화도 없는 것이죠. 확인을 위해 한번씩 해보셔도 좋을 것 같습니다.

이제 본격적으로 과거의 커밋을 수정해보도록 하겠습니다. Commands의 설명을 보면, 수정을 하고 싶을 때 사용하는 옵션은 "e" 또는 "edit"이라고 되어있군요. 따라서 Python3 context manager 포스팅의 오타를 수정하기 위해 아래 사진과 같이 `2297f8e` 커밋 앞의 "pick"을 "edit"으로 바꾸고 :wq를 통해 vim을 빠져나오겠습니다.

![git rebase interactive mode (2)](https://zeniuus.github.io/assets/images/git_rebase_example/git_rebase_interactive_mode_2.png)

그러면 아래 사진과 같은 화면이 뜹니다.

![git rebase edit (1)](https://zeniuus.github.io/assets/images/git_rebase_example/git_rebase_edit_1.png)

딱 우리가 "edit"을 입력했던 `2297f8e` 커밋에서 HEAD가 멈춰있습니다. 그리고 설명을 읽어보면, 너는 이제 커밋을 amend 할 수 있고, 고칠만큼 고친 이후에는 `git rebase --continue`를 실행하라고 돼있습니다.

그러면 설명대로 한번 진행해보겠습니다. 파일에서 오타를 수정하고 `git add .`와 `git commit --amend`를 통해 현재 커밋을 덮어씌웁니다.

![git rebase edit (2)](https://zeniuus.github.io/assets/images/git_rebase_example/git_rebase_edit_2.png)

짜잔~ 이제 커밋이 잘 수정되었으니 `git rebase --continue`를 통해 나머지 커밋들에 대해서도 rebase를 진행하...려고 할 때! conflict가 뜰 수도 있습니다.

![git rebase edit (3)](https://zeniuus.github.io/assets/images/git_rebase_example/git_rebase_edit_3.png)

그럴 땐 당황하지 않고 적당히 conflict를 해소해준 뒤, 다시 `git rebase --continue`를 통해 rebase를 다시 실행시키면 됩니다.

![git rebase edit (4)](https://zeniuus.github.io/assets/images/git_rebase_example/git_rebase_edit_4.png)

짜잔~ 정상적으로 잘 수정되었습니다. 커밋 히스토리를 확인해보셔도 커밋이 삐죽 튀어나오는 일 없이 깔끔하게 이전 커밋만 변경되었을 것입니다.

# 커밋 이곳저곳으로 옮기기

지금까지 배운 `git rebase`로는 "branch A에는 없는 branch B의 커밋을 branch A로 옮긴다" 였습니다. 엄밀하게 말하자면 branch 뿐만 아니라 임의의 커밋과 커밋 사이의 rebase가 가능합니다. 물론 이정도로도 `git rebase`를 모르기 전보다 훨씬 많은 일을 할 수 있습니다. 하지만, 이는 어디까지다 두 브랜치 사이에서 커밋이 왔다갔다 하는 정도입니다. 만약 branch A에는 없는 branch B의 커밋을 branch C로 옮기고 싶다면, 현재 알고 있는 지식으로는 상당히 힘든 일이 되겠죠. 대충 생각해봐도 `git rebase`를 최소 3번 이상 사용해야 할 것이고, 사용법도 굉장히 까다로울 것입니다.

여기서 등장하는 것이 바로 `--onto` 옵션입니다. 이는 정확히 위에서 설명한 일을 쉽게 할 수 있도록 만들어줍니다. 지금까지의 `git rebase`에서는 **[base를 다시 정하고 싶은 커밋을 결정하는 일]** 과 **[해당 커밋들을 다시 적용할 base를 결정하는 일]**, 이 두 가지가 한번에 결정되었죠. 하지만 `--onto` 옵션을 사용한다면 **이 두 가지의 일을 완벽하게 분리할 수 있습니다.** 따라서 더 정교한 rebase가 가능해집니다.

`git rebase` manual에 나와있는 예시를 통해 조금 더 자세하게 알아보도록 하겠습니다. 현재 작업하는 레포지토리의 커밋 히스토리 모습이 아래 사진과 같은 상황이라고 해보겠습니다.

![master, next, topic 브랜치가 있는 커밋 히스토리](https://zeniuus.github.io/assets/images/git_rebase_example/three_branch_commit_history.png)

master 브랜치는 실제 릴리즈가 된 브랜치고, next 브랜치에서는 다음에 릴리즈 할 기능을 구현하고 있고, topic 브랜치는 그러한 기능 중 하나일 것입니다. 그런데 이 때 topic 브랜치에서 구현하던 기능을 급하게 master에 merge 해야하는 상황이 생길 수 있습니다. 이런 상황에서 `--onto` 옵션을 활용한 rebase를 하면 깔끔하게 topic 브랜치에서 구현한 기능을 master로 옮길 수 있습니다.

    $ git rebase --onto master next topic

위의 명령어를 입력하면 아래와 같이 next 브랜치는 그대로 남아있고, topic 브랜치에서 구현한 기능만 master 브랜치로 옮겨가게 됩니다.

![--onto 옵션을 활용한 rebase](https://zeniuus.github.io/assets/images/git_rebase_example/git_rebase_with_onto_option.png)

위의 커맨드를 조금 더 분석해보면 아래와 같은 구조로 되어있음을 알 수 있습니다.

    $ git rebase --onto [newbase] [upstream] [branch]

`--onto [newbase]`가 없었다면 upstream에는 없는 branch의 커밋들이 upstream에 적용이 되었을 테지만, `--onto` 옵션을 사용했으므로 이 커밋들이 upstream이 아닌 newbase 브랜치에 적용되게 됩니다. 위에서 언급한대로 "base를 다시 정하고 싶은 커밋을 결정하는 일과 해당 커밋들을 다시 적용할 base를 결정하는 일을 분리"할 수 있게 된 것이죠.

# Git Rebase를 사용하면 안되는 경우

아마 가장 중요한 섹션이 아닐까 싶습니다. 이렇게 강력하고 다양한 상황에서 사용될 수 있는 `git rebase`이지만, 절대 사용해서는 안될 상황이 있습니다. 바로 ***여러명이 협업하고 있는 레포지토리에 이미 push한 경우***이죠.

push를 한 이후에 `git rebase`를 사용하면 커밋 히스토리가 변경되기 때문에 remote와 상당히 많은 conflict가 뜨게 됩니다. 따라서 보통 push한 커밋을 `git rebase`로 변경한 이후에는 강제로 커밋 히스토리를 덮어 씌우도록 force push를 하게 되죠(`git push [--force | -f]`).

만일 remote가 혼자 작업하는 레포지토리라면 큰 상관이 없습니다. 다른 곳에서 같은 레포지토리를 remote로 사용하고 있다고 하더라도 지우고 다시 clone을 받으면 되니까요. 하지만 여러명이 작업할 때에는 새로 clone을 받기가 힘듭니다. 그러면 `git pull`을 통해 여러분들이 rebase로 덮어 씌운 새로운 커밋 히스토리를 다운받게 될텐데, 이렇게 되면 `git pull`을 받은 모든 사람들의 로컬 레포지토리가 엉망진창이 됩니다. 자세한 사항은 [git-scm 홈페이지](https://git-scm.com/book/ko/v1/Git-%EB%B8%8C%EB%9E%9C%EC%B9%98-Rebase%ED%95%98%EA%B8%B0#Rebase%EC%9D%98-%EC%9C%84%ED%97%98%EC%84%B1)에 이보다 잘 설명할 수 없을 정도로 깔끔하게 정리되어 있으니 한번씩 꼭 읽어보시기 바랍니다.

또한, 한글판에는 없지만 [영문판](https://git-scm.com/book/en/v2/Git-Branching-Rebasing/#_rebase_rebase)에는 위와 같은 경우에 대한 solution도 제공하고 있습니다. 간략하게 결론만 설명하자면, `git rebase`와 `git push --force`를 통해 커밋 히스토리가 새롭게 쓰여진 remote를 pull 받을 때 `git pull`이 아닌 `git pull --rebase`를 사용하면 "상당수의 경우" 깔끔하게 자동으로 merge가 된다고 합니다.
