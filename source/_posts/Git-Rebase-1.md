---
title: Git Rebase (1)
date: 2018-01-21 19:45:00
categories:
  - Develop
---
안녕하세요, 이번 포스팅과 다음 포스팅에서는 git을 처음 배우는 사람들이 가장 어려워한다는 `git rebase`에 대해서 알아보도록 하겠습니다. 이번 포스팅은 git에 대해 어느 정도 지식이 있는 사람이 보기에 적합할 것 같습니다. 적어도 커밋이 무엇인지, 브랜치가 무엇인지에 대한 정확한 개념이 잡혀있어야 합니다.

# 왜 Git Rebase를 알아야 하는가?

git을 처음 배우면 보통 `git add`와 `git commit`을 중점적으로 배우게 되는데, 이 이외의 것을 배우려고는 잘 하지 않죠. 왜냐하면 여기까지만 배워도 새로운 "버전"을 만드는 일은 충분히 해낼 수 있기 때문입니다. 이 외에 배워봤자 `git reset` 정도일까요?

하지만, 사람은 실수를 정말 많이 하는 동물이죠. 언제나 여러분들이 한 커밋이 완벽하고 고칠 점이 없을 리가 없습니다. 지난 커밋을 취소하거나 수정하고 싶을 때도 있고, 잘못된 브랜치에 커밋해서 다른 브랜치로 커밋을 옮기고 싶을 경우도 있을 것입니다.

이와 같이 이미 해버린 커밋을 수정하는 데에 유용하게 사용되는 커맨드가 바로 `git rebase` 입니다. `git rebase`로는 위에서 언급했던 것처럼 이전 커밋을 수정하고, 커밋을 다른 브랜치로 옮기는 일을 할 수 있습니다. 그 이상으로 브랜치를 깔끔하게 유지하고, 브랜치를 이어붙이는 등 커밋에 관련된 여러분들이 상상하는 대부분의 것을 할 수 있습니다. 그렇기 때문에 협업을 할 때에는 반드시 `git rebase`를 알아야 하고, 또 `git rebase`를 잘 쓸 수 있어야 비로소 git의 기능을 잘 활용하는 것이라고 생각합니다.

# Git Rebase로 Merge하기

그럼 도대체 `git rebase`가 무엇을 하는 커맨드일까요? 이를 알아보기 전에, 실제로 `git rebase`를 많이 활용하는 상황을 한번 살펴보도록 하겠습니다.

`git rebase`가 유용하게 사용되는 첫 번째 사용처는 바로 merge 입니다. 앞서 말씀드린대로 `git rebase`를 사용하여 merge를 한다면 `git merge`로 merge하는 것보다 커밋 히스토리가 훨씬 깔끔하게 남기 때문에 다른 사람들의 작업을 보기가 편해집니다.

만약에 아래와 같은 두 개의 브랜치를 merge한다고 합시다.

![Merge 전 두 개의 브랜치](/images/git_rebase_example/git_two_branches.png)

두 개의 브랜치를 merge하기 위해서 보통

    $ git checkout master
    $ git merge dev

를 하겠죠? 그러면 아래와 같이 두 개의 브랜치를 3-way merging을 통해 merge하게 됩니다.

![git merge를 통한 merge](/images/git_rebase_example/git_merging_with_git_merge.png)

많이들 보시던 브랜치의 모양이죠? `git merge`를 통해 merge를 하면 이런 식으로 2개의 커밋을 포인팅하는 새로운 커밋이 생기고 이를 브랜치가 가리키게 됩니다.

이게 무엇이 문제냐 하면, 만약 여러명이 작업을 하고 있는 경우에 계속 `git merge`를 통해서 할 경우에 아래와 같이 지저분한 커밋 히스토리가 생기게 됩니다.

![지저분한 커밋 히스토리](/images/git_rebase_example/git_dirty_commit_history.png)

이러면 다른 사람이 이 레포지토리에서 작업을 하려고 할 때 무슨 의도로 저런 작업들을 한건지 파악하기 힘들겠죠?

여기가 바로 `git rebase`가 빛을 발할 때입니다. 만약

    $ git rebase master dev

혹은

    $ git checkout dev
    $ git rebase master

의 커맨드를 통해 merge를 했다면, 결과적으로 레포지토리에 남는 커밋 히스토리는 아래와 같은 모양을 띕니다.

![git rebase를 통한 merge 1](/images/git_rebase_example/git_merging_with_git_rebase_1.png)

이 다음에 fast-forward를 시키기 위해

    $ git checkout master
    $ git merge dev

를 하면!

![git rebase를 통한 merge 2](/images/git_rebase_example/git_merging_with_git_rebase_2.png)

짜잔~ 깔끔한 커밋 히스토리가 남게 되었습니다.

# Git Rebase는 무엇인가?

`git rebase`는 어떻게 이런 깔끔한 커밋 히스토리를 남길 수 있었을까요?

**`git rebase`는 말 그대로 커밋의 base를 다시(re) 정하는 작업**입니다. 우리가 입력했던

    $ git rebase master dev

라는 명령어를 풀어서 설명하자면 **"master와 dev 브랜치의 공통 조상 커밋부터 dev 브랜치까지의 모든 커밋의 base를 master 브랜치의 위치로 바꾸어라"**라는 의미인 것이죠. 그렇기 때문에 **master와 dev의 공통 조상 커밋인 C1부터 dev에만 있었던 C4, C5 커밋들이 master 브랜치가 가리키고 있던 C3을 base로 하여 다시 적용된 것**입니다.

조금 더 정확하고 자세하게 설명하자면, 위의 명령어가 입력된 순간 다음과 같은 일이 일어납니다.

1. `git checkout dev`를 통해 dev 브랜치로 HEAD를 이동시킵니다.
2. master 브랜치와 dev 브랜치의 공통 조상인 C1부터 dev 브랜치까지의 모든 커밋에 대해 diff를 적용하여 각 커밋을 통해 변경된 점을 로컬에 저장합니다.
3. `git reset --hard master`을 통해 dev를 master 브랜치로 이동시킵니다.
4. 로컬에 저장했던 각 커밋을 하나하나 dev에 적용시킵니다.

아직 git에 익숙하지 않아 `git reset --hard master`와 같은 명령어가 익숙치 않으신 분들을 위해서 조금 풀어쓰자면 아래와 같은 내용입니다.

1. 내가 옮기고 싶은 커밋들이 있는 브랜치(여기서는 dev 브랜치)로 이동합니다.
2. 커밋을 옮겨갈 목적지 브랜치(여기서는 master 브랜치)에는 없는, 이 브랜치에서만 있었던 변경사항 커밋들(여기서는 C4, C5)을 로컬에 저장합니다.
3. 현재 브랜치를 옮겨갈 브랜치와 동일한 상태로 만듭니다. (`git reset --hard master`)
4. 로컬에 저장했던 각 커밋을 하나하나 dev에 적용시킵니다.

만약 4번을 진행하는 동안 master 브랜치와 conflict가 뜬다면 rebase가 중지되고 직접 conflict를 해소해야 합니다. 해소한 이후에는 `git rebase --continue` 명령어를 입력하면 다시 rebase가 진행됩니다.

하는 작업은 꽤 복잡하지만, 모두 ***"커밋의 베이스를 다시 정한다"***라는 목적을 이루기 위한 작업들이니 각 단계에서 하는 일을 하나하나 이해해 나간다면 그렇게 어려운 작업은 아닐 것이라고 생각합니다.

다음 포스팅에서는 `git rebase`의 작동 원리에 대해서 조금 더 정확하게 알아보고, 제가 실제로 `git rebase`를 유용하게 써먹었던 다양한 상황을 예시를 통해 알아보도록 하겠습니다.
