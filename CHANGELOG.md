# 변경 기록

pane-mod의 버전별 변경 사항을 최신 버전부터 적습니다. 버전 번호는 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다. 기능을 추가하면 minor 버전을, 문제만 고치면 patch 버전을 올립니다. 설치본을 새 버전으로 바꾸는 방법은 [INSTALL.md](INSTALL.md) 6장에 있습니다.

## 1.2.0 (2026-11-11)

Claude Code 2.1.297부터 2.1.322까지의 mod 변경점을 반영했습니다. 이제 Claude Code 2.1.319 이상이 필요합니다.

### 추가

- subagents 카드의 행을 누르면 그 서브에이전트의 **transcript를 메인 화면에** 띄웁니다(`$.ui.view`). 보고 있는 서브에이전트는 이름에 밑줄이 그어지고, 그 행을 다시 누르거나 목록 위의 `m: ◀ main conversation`을 누르면 메인 대화로 돌아갑니다. `agents: list`이면 band의 행도 누를 수 있습니다. 끝난 서브에이전트와 따로 뜬 tmux 서버에서 도는 teammate는 Claude Code가 transcript를 열어 주지 않으므로 누를 수 없습니다.
- 플러그인의 `settings.json`으로 Claude Code의 `subagentStatusLine`을 지정해서, 입력창 아래 **서브에이전트 패널의 행**을 band의 행과 같은 내용(이름과 타입, 작업 설명, 경과 시간, 도구 호출 수, 실행 중인 도구, 토큰 수)으로 그립니다. mod가 데이터 폴더의 `subagents/<세션 ID>.jsonl`에 행을 쓰고, `scripts/subagent-rows.sh`가 그 파일을 출력합니다. 사용자 설정에 `subagentStatusLine`이 있으면 그 설정이 우선하고, `agents: off`이면 패널은 기본 행을 그립니다. agent teams의 teammate 행에는 Claude Code가 이 설정을 적용하지 않습니다.
- 설정 `colorTheme`(기본값 `default`)으로 HUD의 **색 테마**를 고릅니다. `darcula`, `one-dark`, `github-dark`는 IntelliJ의 Darcula, Atom의 One Dark, GitHub의 어두운 테마의 색조로 WORKING 배지, 프로젝트와 branch, 게이지, effort, 권한 모드, 서브에이전트·작업·로그의 표시, 바뀐 줄 수, 카드 테두리를 그립니다. 초록은 여유, 빨강은 한도 근처처럼 색이 뜻하는 바는 어느 테마에서나 같습니다. 설정 항목은 모두 30개입니다.

### 변경

- pane의 바탕을 칠하지 않고 터미널의 배경색을 그대로 씁니다(`$.ui.open`의 `backgroundColor: 'transparent'`).
- 끝난 뒤 `SendMessage`로 다시 실행된 서브에이전트의 행은 경과 시간과 도구 호출 수를 새 실행부터 셉니다. 자기 백그라운드 작업을 기다리다 그 작업이 끝나서 깨어난 서브에이전트는 끝난 적이 없으므로 처음 실행부터 이어서 셉니다.
- `modelColor`와 `cardColor`의 기본값을 `claude`·`subtle`에서 `auto`로 바꿨습니다. `auto`는 색 테마의 색을 따르며, 기본 테마에서는 전과 같은 색입니다. 색을 적어 둔 경우에는 테마와 관계없이 그 색을 씁니다.
- 기본 테마에서 권한 모드 `acceptEdits`와 로그의 거절 표시(`⊘`)는 effort xhigh와 같은 주황(`#ffa726`)으로, 권한 모드 `plan`은 완료 표시와 같은 초록(`#66bb6a`)으로 맞췄습니다. 테마마다 색의 역할 수를 줄이기 위한 변경이며, 색의 차이는 거의 보이지 않습니다.
- `Text`의 deprecated된 `bold` 대신 `weight`를 씁니다.
- 필요한 Claude Code 버전을 2.1.292에서 2.1.319로 올렸습니다. `weight`(2.1.299), `$.ui.view`(2.1.300), 플러그인 폴더의 스크립트를 가리키는 `subagentStatusLine`(2.1.319)이 이 버전부터 동작합니다.

### 수정

- Claude Code 2.1.299부터 `turn.start`가 서브에이전트와 teammate의 턴에도 발생하면서 생긴 문제를 고쳤습니다. 메인 턴이 끝날 때 백그라운드 서브에이전트가 남아 있으면 스프라이트가 `working`에 머물렀고, 메인 턴이 없는 동안 teammate의 턴이 시작되면 다음 메인 턴의 로그 줄이 teammate의 프롬프트를 제목으로 기록했습니다. 이제 서브에이전트와 teammate의 턴은 스프라이트와 작업 로그에 영향을 주지 않습니다.
- 백그라운드 서브에이전트나 셸의 완료 알림으로 시작된 턴은 로그 줄의 제목에 알림에서 태그만 뺀 내용(작업 ID, 도구 호출 ID, 출력 파일 경로)을 적었습니다. 이제 알림의 요약(`Agent "…" finished` 등)을 제목으로 씁니다. 알림과 함께 보낸 프롬프트가 있으면 그 프롬프트를 씁니다.

### 문서

- README에 "서브에이전트 보기", "서브에이전트 패널의 행", "색 테마" 절을 추가했습니다. "이 mod가 컴퓨터에서 하는 일"에는 스크립트 실행과 행 파일의 쓰기·삭제를 적었습니다. README.en.md에도 같은 내용을 반영했습니다.
- INSTALL.md 2장의 설정 표에 `colorTheme`을 추가하고, 7장에 서브에이전트 패널의 문제 해결을 추가했습니다.
- AGENTS.md를 Claude Code 2.1.322의 문서와 타입 선언에 맞춰 고쳤습니다.

## 1.1.0 (2026-10-13)

### 추가

- pane에 **changes 카드**를 추가했습니다. Edit·Write로 파일을 고친 가장 최근 턴의 파일 목록과, 파일마다 추가하거나 삭제한 줄 수를 보여 줍니다. 그 턴 안에서 원래 내용으로 되돌린 파일은 목록에서 뺍니다.
- changes 카드의 행을 누르거나 숫자 키(`1`~`9`)를 누르면 pane 전체에 그 파일의 **diff**를 보여 줍니다. `w`로 바뀐 부분과 전체 파일을 오가고, `p`·`n`으로 이전 파일과 다음 파일로 넘어가며, `b`로 카드 화면으로 돌아갑니다.
- 설정 `showChanges`(기본값 `true`)를 추가했습니다. 설정 항목은 모두 29개입니다.

### 변경

- `paneOrder`의 기본값에 `changes`를 추가했습니다(`tasks,agents,context,recent,changes,log`). `paneOrder`를 직접 정해 두었다면, changes 카드는 적어 둔 카드들 뒤에 다른 카드와 함께 기본 순서대로 붙습니다.
- diff를 만들려고, Edit·Write가 끝난 뒤 그 파일을 한 번 다시 읽습니다. 512 KiB가 넘는 파일은 줄 수 대신 `?`를 적고 diff를 그리지 않습니다.

### 수정

- 환경 변수 `CLAUDE_PLUGIN_DATA`가 다른 플러그인의 데이터 폴더를 가리키면, 그 폴더에 로그를 쓰던 문제를 고쳤습니다. Claude Code의 Bash 도구 안에서 Claude Code를 다시 실행했을 때 이런 일이 생겼습니다. 이제는 이름이 `pane-mod-`로 시작하는 폴더만 따르고, 그 밖에는 `~/.claude/plugins/data/pane-mod-pane-mod`를 씁니다.

### 문서

- README 맨 위에 데모 화면과 빠른 시작을 두고, 자세한 설명은 아래로 옮겼습니다.
- `--plugin-dir`로 작업 사본을 실행할 때 설치본을 끄라는 안내를 뺐습니다. 작업 사본은 그 세션에서만 설치본을 대신합니다.
- 작업 사본은 설치할 때 고른 설정 대신 기본값으로 실행되면서도 설치본과 같은 로그 폴더를 씁니다. 그래서 기본 보관 한도에 따라 로그가 지워지지 않도록, 설정을 `--settings` 파일로 넘기는 방법을 INSTALL.md 3장에 적었습니다.
- 이 변경 기록(CHANGELOG.md)을 추가했습니다.

## 1.0.0 (2026-10-12)

첫 공개 버전입니다.

- 프로젝트, 모델과 effort, 사용량과 한도, 컨텍스트, Claude의 작업, 서브에이전트, 작업 로그를 pane의 카드로 보여 줍니다. 화면에 따라 입력창 위의 band나 힌트 줄 한 줄로도 그립니다.
- 세션별 작업 로그를 파일로 보관하고, 검색, 상세 보기, Markdown 파일 열기를 지원합니다.
- 승인 창 아래 한 줄에 기다린 시각과 사용 한도 경고를 보여 줍니다. toast나 소리로 알리지는 않습니다.
- 사용자가 지정한 idle·working 스프라이트를 움직이고, 상태별 소리를 재생합니다.
