# pane-mod 설치 절차

이 문서는 pane-mod를 설치하는 절차를 정리한 것입니다. 사람이 직접 설치할 때와 AI(Claude Code 등)에게 설치를 맡길 때 모두 이 순서를 따릅니다.

## 1. 설치 전에 확인할 것

| 항목 | 확인 방법 | 조건 |
|---|---|---|
| Claude Code | `claude --version` | 2.1.292 이상에서 만들고 시험했습니다. 버전이 낮으면 `claude update`로 올립니다. `claude` 명령이 없으면 설치를 멈추고 <https://claude.com/claude-code> 안내를 따릅니다. |
| 터미널 | 사용 중인 터미널 확인 | 스프라이트는 kitty graphics protocol의 유니코드 placeholder 방식을 지원하는 터미널에서만 그림으로 보입니다. Ghostty와 cmux에서 확인했고, 공식 문서에 따르면 kitty 0.28 이상에서도 그려집니다. **Orca에서는 현재 버전(1.4.221) 기준으로 보이지 않습니다**(7장 참고). 그림을 그릴 수 없는 터미널에서는 pane-mod가 스프라이트 자리를 스스로 없애고 글자 정보만 표시합니다. |
| 기존 statusLine | `~/.claude/settings.json`의 `statusLine` | pane-mod는 statusLine을 대체하려고 만들었습니다. 두 가지를 함께 쓸지 정합니다. |
| 스프라이트와 소리 파일 | 직접 준비한 폴더 | 저장소에는 이 파일들이 들어 있지 않습니다. 파일이 없어도 설치와 실행에는 문제가 없으며, 스프라이트와 소리만 생략됩니다. 직접 준비한 폴더가 있다면 2장의 `spriteDir`, `soundDir`에 그 경로를 지정합니다. |
| 같은 자리에 그리는 다른 mod | 개발용 mod(`--plugin-dir`로 로드한 작업 사본 등)나 입력창 위 band를 쓰는 다른 플러그인 | 같은 band(`AbovePrompt`)에 그리는 mod가 둘이면 화면이 겹칩니다. |

## 2. 설치 중에 정할 설정

설치 화면이 아래 스물아홉 항목을 묻습니다. 항목은 세 묶음으로 나뉩니다. 무엇을 화면에 노출할지, 스프라이트와 소리를 어떻게 쓸지, 승인 창 아래에 한 줄을 붙일지를 차례로 정합니다. 답하지 않은 항목은 기본값을 씁니다. 셸에서 설치할 때는 고른 값마다 `--config 키=값`으로 넘깁니다.

### 2-1. 노출할 항목

| 키 | 선택지 | 기본값 | 설명 |
|---|---|---|---|
| `layout` | `auto`, `band`, `pane`, `hint` | `auto` | HUD를 그리는 위치입니다. `auto`는 전체 화면 보기에서 오른쪽 pane을, 그 밖에서는 band를 씁니다. `hint`는 band와 pane 없이 입력창 아래 힌트 줄 끝에 한 줄 정보만 붙입니다. |
| `bandWithPane` | `off`, `line` | `off` | pane이 보이는 동안 band를 비워 둘지, 한 줄 요약을 둘지 정합니다. |
| `showSession` | `true`, `false` | `true` | pane 첫 카드의 session 행(프로젝트, branch, 모드, 턴 수, 스타일)과 band 1행입니다. |
| `showNow` | `true`, `false` | `true` | pane 첫 카드의 now 행(작업 상태 배지와 경과 시간, 지금 실행 중인 도구)과 band의 상태 행입니다. |
| `showTasks` | `true`, `false` | `true` | tasks 카드(Claude의 작업 목록)입니다. pane에만 있습니다. |
| `showModel` | `true`, `false` | `true` | 모델 카드의 첫 행(모델, effort 게이지)과 band 2행입니다. |
| `showUsage` | `true`, `false` | `true` | 모델 카드의 게이지(context, 5h와 pace, 7d)와 band 3행입니다. |
| `showTotals` | `true`, `false` | `true` | 모델 카드의 비용(세션 비용)과 토큰·캐시 적중률 행입니다. pane에만 있습니다. |
| `showContext` | `true`, `false` | `false` | context 카드(md 파일, hooks, 도구, MCP, skills, commands 수)와 band 4행입니다. 세션 중에 거의 바뀌지 않아 기본으로 꺼 둡니다. |
| `showRecent` | `true`, `false` | `true` | recent 카드(이 세션에서 최근에 쓴 skill과 MCP 도구)입니다. pane에만 있으며, 쓴 것이 없으면 그리지 않습니다. |
| `showChanges` | `true`, `false` | `true` | changes 카드(파일을 고친 가장 최근 턴이 고친 파일과, 추가하고 삭제한 줄 수)입니다. 파일 행을 누르면 pane 전체에 diff가 열립니다. pane에만 있으며, 고친 파일이 없으면 그리지 않습니다. |
| `showLog` | `true`, `false` | `true` | log 카드(작업 로그, 상세, 파일 열기)입니다. pane에만 있습니다. |
| `logTurns` | `0`, 5 이상 | `50` | 세션마다 로그에 보관하는 최근 턴 수입니다. `0`이면 모든 턴을 보관합니다. |
| `logSessions` | `0`, 1 이상 | `30` | 로그를 보관하는 세션 수입니다. 가장 최근에 저장한 세션부터 남기며, `0`이면 세션 수를 제한하지 않습니다. |
| `logDays` | `0`, 1 이상 | `14` | 마지막으로 저장한 뒤 로그를 보관하는 날수입니다. `0`이면 기간을 제한하지 않습니다. 로그 파일의 위치와 정리 방식은 README의 "로그 보관"에 있습니다. |
| `agents` | `summary`, `list`, `off` | `summary` | HUD에 서브에이전트를 표시하는 방식입니다. `summary`는 상태별 개수를 한 줄로 보여 줍니다(`↳ subagents 5  ● running 2  ◐ waiting 1  ✓ done 1  ✗ failed 1`). `list`는 에이전트마다 한 줄씩 보여 줍니다(이름과 타입, 작업 설명, 경과 시간, 도구 호출 수, 현재 도구). `off`는 표시하지 않습니다. 어느 쪽을 골라도 입력창 아래의 Claude Code 작업 목록은 그대로 표시됩니다. mod가 그 목록을 제어할 수 없기 때문입니다. |
| `paneOrder` | `tasks`, `agents`, `context`, `recent`, `changes`, `log`를 쉼표나 공백으로 구분한 순서 | `tasks,agents,context,recent,changes,log` | pane에서 첫 카드와 모델 카드 아래에 놓는 카드의 순서입니다. 모르는 이름과 중복된 이름은 무시하고, 적지 않은 카드는 기본 순서대로 뒤에 붙이므로 순서 때문에 카드가 사라지지는 않습니다. `log`를 마지막에 두지 않으면 휠로 로그를 넘길 수 없고, 버튼과 `o` / `n` 키로만 넘깁니다. |
| `sessionColor` | `auto`, 테마 키, `#rrggbb` | `auto` | pane 첫 카드의 테두리와 세션 이름의 색입니다. `auto`는 `/color`로 고른 색을 따르고, 고른 색이 없으면 흐린 노랑을 씁니다. 다른 값을 적으면 `/color`와 관계없이 그 색으로 고정합니다. |
| `modelColor` | 테마 키, `#rrggbb` | `claude` | 모델 카드의 테두리 색입니다. |
| `cardColor` | 테마 키, `#rrggbb` | `subtle` | 나머지 카드(tasks, subagents, context, recent, changes, log)의 테두리 색입니다. |
| `barFilled` | 폭이 한 칸인 문자 하나 | `▰` | 모든 게이지(effort, ctx, 5h, 7d)에서 채워진 칸을 그리는 문자입니다. 이모지, 전각 문자, 공백, 제어 문자는 받지 않습니다. |
| `barEmpty` | 폭이 한 칸인 문자 하나 | `▱` | 모든 게이지에서 빈칸을 그리는 문자입니다. 조건은 `barFilled`와 같습니다. |

색 설정에 쓸 수 있는 테마 키 목록은 README의 "설정" 절에 있습니다. `paneOrder`, 색 설정, 게이지 문자처럼 직접 적는 값은 설치 화면이 검사하지 않습니다. mod가 값을 읽을 때 올바르지 않은 부분을 기본값으로 바꾸므로, 값을 잘못 적어도 HUD는 그대로 그려집니다.

### 2-2. 스프라이트와 소리

| 키 | 선택지 | 기본값 | 설명 |
|---|---|---|---|
| `sprite` | `true`, `false` | `true` | 스프라이트 표시 여부입니다. 그림을 그릴 수 없는 터미널에서는 pane-mod가 스프라이트를 스스로 숨기므로 대부분 그대로 두면 됩니다. 켜 두어도 프레임 파일이 없으면 스프라이트를 생략합니다. |
| `animate` | `true`, `false` | `true` | 스프라이트 애니메이션 여부입니다. 끄면 각 동작의 첫 프레임에 머뭅니다. |
| `spriteSource` | `auto`, `file`, `bytes` | `auto` | 프레임을 터미널에 보내는 방식입니다. `auto`는 Ghostty와 kitty에는 PNG 파일 경로를(터미널이 직접 읽음), 그 밖의 터미널에는 PNG 데이터를 보냅니다. 대부분 `auto` 그대로 두면 됩니다. |
| `spriteDir` | 폴더 경로 | (빈 값) | 직접 준비한 스프라이트 폴더입니다. 비워 두면 플러그인 폴더의 `assets/`를 찾습니다(저장소에는 들어 있지 않습니다). |
| `sound` | `true`, `false` | `true` | 상태가 바뀔 때 소리를 재생합니다(macOS). 소리 파일이 없는 상태에서는 소리를 내지 않습니다. |
| `soundDir` | 폴더 경로 | (빈 값) | 직접 준비한 소리 폴더입니다. 비워 두면 플러그인 폴더의 `assets/sounds/`를 찾습니다(저장소에는 들어 있지 않습니다). |

`spriteDir`와 `soundDir`에는 절대 경로나 `~/`로 시작하는 경로를 적습니다. 폴더는 다음 구조를 따라야 합니다. 없는 폴더나 비어 있는 폴더는 오류 없이 건너뜁니다.

```text
<spriteDir>/idle/*.png       # 턴 사이 (프레임이 없는 동작은 idle의 프레임을 빌려 씁니다)
<spriteDir>/working/*.png    # 모델 턴 진행 중
<spriteDir>/complete/*.png   # 턴 완료 (지금은 꺼져 있음)
<soundDir>/working/          # 모델 턴 시작 (.caf, .wav, .aif, .aiff, .mp3, .m4a, .aac)
<soundDir>/idle/             # 턴 종료
```

프레임은 이름 순서로 재생하므로 `frame_001.png`, `frame_002.png`처럼 번호를 0으로 채웁니다. 프레임 크기와 변환 방법은 [docs/sprite-states.md](docs/sprite-states.md)의 "스프라이트 제작 규격"을 따릅니다.

### 2-3. 알림

| 키 | 선택지 | 기본값 | 설명 |
|---|---|---|---|
| `alerts` | `true`, `false` | `true` | 승인 창이 열리면 그 아래에 한 줄을 붙여, 언제부터 기다렸는지와 떠 있는 한도 경고(context·5h 80%·90%, 리셋 전 5h 도달 예측)를 적습니다. toast나 소리로 부르지는 않습니다. |

설치한 뒤에도 `/plugin configure pane-mod@pane-mod`로 바꿀 수 있습니다. 셸에서는 `claude plugin configure pane-mod@pane-mod`로 현재 값을 확인하고, `--values-stdin`에 JSON 객체를 넘겨 값을 저장할 수 있습니다. 바꾼 값은 `/reload-plugins`를 실행하거나 Claude Code를 다시 시작하면 적용됩니다.

## 3. 설치하기

설치 범위(scope)는 `user`를 권장합니다. 모든 프로젝트에서 쓰게 됩니다.

### 방법 A: Claude Code 입력창에서

Claude Code를 터미널에서 실행하고 입력창에 다음 한 줄을 입력합니다. `--marketplace`에는 GitHub `owner/repo`, git URL, 로컬 폴더 경로를 줄 수 있습니다.

```
/plugin install pane-mod --marketplace taehwan0/pane-mod
```

화면은 다음 순서로 진행됩니다.

1. `Add marketplace?`: 마켓플레이스(플러그인을 받아 오는 곳)를 등록할지 묻습니다. `y`로 수락합니다. 이미 등록한 마켓플레이스라면 이 질문은 나오지 않습니다.
2. 플러그인 정보와 설치 범위: `user`를 고르고 Enter를 누릅니다.
3. 설정 화면: 2장의 세 묶음을 차례로 정합니다. 노출할 섹션과 서브에이전트 표시 방식(2-1), 스프라이트와 소리 사용 여부와 직접 준비한 폴더(2-2), 알림(2-3)입니다. 바꾸지 않을 항목은 기본값 그대로 둡니다.
4. `Installed pane-mod. Plugin is now active.`가 나오면 끝입니다. mod는 그 세션에서 바로 동작합니다.

### 방법 B: 셸에서 두 줄로

```
claude plugin marketplace add taehwan0/pane-mod
claude plugin install pane-mod@pane-mod
```

저장소를 clone했다면 첫 줄에 GitHub 대신 그 폴더의 경로(`~/work/pane-mod` 등)를 줄 수 있습니다. 로컬 폴더를 등록하면 파일을 고친 뒤 `/reload-plugins`만으로 다시 읽습니다.

셸 명령은 설정 화면을 띄우지 않습니다. 2장에서 기본값과 다르게 고른 항목만 `--config`로 넘기고, 지정하지 않은 항목은 기본값을 씁니다. `--config`는 여러 번 쓸 수 있습니다. 예를 들어 context 섹션을 켜고, log 섹션을 끄고, 서브에이전트를 한 줄씩 보이고, 직접 준비한 스프라이트 폴더를 쓰려면 다음과 같이 설치합니다.

```
claude plugin install pane-mod@pane-mod \
  --config showContext=true --config showLog=false \
  --config agents=list --config spriteDir="$HOME/.config/pane-mod/sprites"
```

셸에서 설치하면, 이미 실행 중인 세션은 Claude Code를 다시 시작해야 확실하게 적용됩니다.

### 설치하지 않고 한 세션에서만 써 보기

저장소를 clone한 뒤 그 폴더를 지정해서 실행합니다.

```
claude --plugin-dir ~/work/pane-mod
```

pane-mod가 이미 설치되어 있어도 끌 필요는 없습니다. 이렇게 실행한 세션에서는 clone한 사본이 설치본을 대신하고, 다른 세션은 계속 설치본으로 동작합니다.

다만 clone한 사본은 설치본과 다른 이름(`pane-mod@inline`)으로 실행되므로, 설치할 때 고른 설정을 쓰지 않고 모든 항목을 기본값으로 실행합니다. 로그 폴더는 설치본과 같기 때문에, 로그 보관 한도를 바꿔 두었거나 제한 없이 보관하고 있다면 기본 한도(50턴, 30세션, 14일)에 따라 오래된 로그가 지워질 수 있습니다. 설치본과 같은 설정으로 실행하려면 `~/.claude/settings.json`의 `pluginConfigs["pane-mod@pane-mod"].options` 값을 `pane-mod@inline` 아래에 옮겨 적은 파일을 따로 만들고, `--settings`로 넘깁니다. `~/.claude/settings.json`은 고치지 않습니다.

```json
{ "pluginConfigs": { "pane-mod@inline": { "options": { "logTurns": 0, "logSessions": 0, "logDays": 0 } } } }
```

```
claude --plugin-dir ~/work/pane-mod --settings ~/.config/pane-mod/dev-settings.json
```

## 4. 설치 확인

1. `claude plugin list`에 다음과 같은 항목이 있는지 확인합니다.

   ```
   ❯ pane-mod@pane-mod
     Version: 1.1.0
     Scope: user
     Status: ✔ enabled
   ```

2. 오른쪽 pane이나 입력창 위(노란 줄 아래)에 HUD가 보이는지 확인합니다. 전체 화면 보기가 아니면 pane 대신 입력창 위에 그려집니다. 첫 프롬프트를 보내기 전에는 권한 모드가 `mode --`로 표시됩니다.

## 5. 기존 statusLine 정리 (선택)

pane-mod로 statusLine을 대체하려면 `~/.claude/settings.json`에서 `statusLine` 항목을 지웁니다. mod는 설정 파일을 바꾸지 않으므로, 이 단계는 사용자가 직접 하거나 사용자의 동의를 받아서 진행합니다. 되돌릴 수 있도록 지우기 전의 값을 기록해 둡니다.

## 6. 업데이트와 삭제

| 작업 | 방법 |
|---|---|
| 업데이트 | GitHub에서 설치했다면 `claude plugin update pane-mod@pane-mod`로 최신 버전을 받은 뒤 Claude Code를 다시 시작합니다. 로컬 폴더를 마켓플레이스로 등록했다면, 파일을 고친 뒤 실행 중인 세션에서 `/reload-plugins`를 입력합니다. |
| 설정 변경 | `/plugin configure pane-mod@pane-mod`, `/config`, Claude에게 요청, `claude plugin configure … --values-stdin` 중 하나를 씁니다. 자세한 방법은 README의 "설정 바꾸기"에 있습니다. |
| 잠시 끄기 | `claude plugin disable pane-mod@pane-mod` (다시 켤 때는 `enable`) |
| 삭제 | `claude plugin uninstall pane-mod@pane-mod` |
| 마켓플레이스 등록 삭제 | `claude plugin marketplace remove pane-mod` |

삭제하면 HUD가 사라지고, 플러그인 데이터 폴더(`~/.claude/plugins/data/pane-mod-pane-mod/`)의 작업 로그도 함께 지워집니다. 로그를 남기려면 삭제하기 전에 그 폴더를 다른 곳에 복사해 둡니다. 지웠던 statusLine을 다시 쓰려면 5장에서 기록해 둔 값을 `settings.json`에 되돌려 넣습니다.

## 7. 문제가 생겼을 때

| 증상 | 해결 |
|---|---|
| 마켓플레이스를 찾지 못함 | 경로를 확인합니다. `claude plugin marketplace list`로 이미 등록되어 있는지 봅니다. 폴더에 `.claude-plugin/marketplace.json`이 있어야 합니다. |
| 이미 설치되어 있다고 나옴 | 다시 설치하지 않습니다. `claude plugin list`로 버전과 상태를 확인합니다. |
| 목록에는 있지만 상태가 disabled | `claude plugin enable pane-mod@pane-mod`로 켜고 Claude Code를 다시 시작합니다. |
| `/plugin`을 쓸 수 없음 | `/plugin install …`은 터미널에서 실행한 Claude Code의 입력창 전용입니다. 방법 B의 셸 명령을 씁니다. |
| 스프라이트가 보이지 않고 글자 HUD만 있음 | 먼저 프레임 파일이 있는지 확인합니다. 스프라이트 폴더(`spriteDir`, 비워 두었다면 플러그인 폴더의 `assets/`)의 `idle/`에 PNG가 있어야 합니다. `spriteDir`을 지정하지 않았다면 파일이 없는 것이 정상입니다. 파일을 넣은 뒤 `/reload-plugins`를 실행합니다. |
| 스프라이트 자리가 비어 있음 | 먼저 터미널이 kitty 그래픽을 그리는지 확인합니다(아래 명령). 그림이 나오면 `spriteSource`를 `bytes`로 바꿔 봅니다. 그림이 나오지 않으면 그 터미널은 지원하지 않는 것이므로 `sprite`를 `false`로 바꿉니다. |
| 소리가 나지 않음 | 소리 폴더(`soundDir`, 비워 두었다면 플러그인 폴더의 `assets/sounds/`)의 `working/`, `idle/`에 소리 파일이 있는지, `sound`가 `true`인지 확인합니다. macOS가 아니면 소리는 나지 않습니다. |
| Orca에서 스프라이트가 안 보임 | Orca 쪽 제약이라 지금은 해결할 수 없습니다. Orca 1.4.221의 터미널(xterm.js)에서 확인한 결과, kitty 이미지를 직접 배치하는 방식(`a=T`)은 그리지만 ① Claude Code가 보내는 kitty 그래픽 지원 질의에 응답하지 않고 ② Claude Code가 그림을 그리는 유니코드 placeholder 방식(`U=1`, `U+10EEEE`)을 지원하지 않습니다(□로 표시됨). pane-mod는 이 경우 스프라이트를 숨기고 글자 HUD만 표시합니다. Orca가 두 기능을 지원하면 설정 변경 없이 스프라이트가 나타납니다. |
| HUD가 두 개이거나 겹쳐 보임 | 같은 band에 그리는 다른 mod(개발용 mod 포함)가 함께 로드된 경우입니다. 하나만 남깁니다. |
| 서브에이전트가 두 번 보임 | 입력창 아래 목록은 Claude Code 자체 목록입니다. HUD 쪽을 `agents=summary`나 `off`로 바꿉니다. |

### 터미널이 kitty 그래픽을 그리는지 확인하는 명령

터미널 안에서 실행합니다. 그림이 그려지면 그 터미널은 kitty 그래픽(데이터 직접 전송)을 지원합니다. 명령 안의 `$HOME/sprite.png`는 가지고 있는 아무 PNG 파일의 경로로 바꿔서 실행합니다.

```
python3 -c "import base64,sys;d=base64.b64encode(open('$HOME/sprite.png','rb').read()).decode();c=[d[i:i+4096] for i in range(0,len(d),4096)];[sys.stdout.write(('\x1b_Gf=100,a=T,t=d,c=10,r=5,m=%d;'%(i<len(c)-1) if i==0 else '\x1b_Gm=%d;'%(i<len(c)-1))+x+'\x1b\\\\') for i,x in enumerate(c)];print()"
```

## 8. AI가 설치를 맡을 때의 규칙

AI에게 "설치해 줘"라고 맡길 때 AI가 지켜야 할 규칙입니다. 단계별 절차는 [AGENTS.md](AGENTS.md)의 "설치를 요청받았을 때"에 있습니다.

1. **요청받았을 때만 설치합니다.** 이 문서를 읽었다는 사실만으로 설치하지 않습니다.
2. **무엇을 설치하는지 먼저 한 줄로 알립니다.** 예: "pane-mod(v1.1.0)를 user 범위로 설치합니다. 오른쪽 pane(화면이 pane을 붙일 수 없으면 입력창 위)에 HUD가 생기고, 스프라이트 폴더를 지정하면 스프라이트가 표시됩니다."
3. **1장의 확인 항목을 점검합니다.** `claude` 명령이 없으면 멈추고, Claude Code를 대신 설치하지 않습니다.
4. **2장의 설정을 세 묶음으로 나눠 사용자에게 묻습니다.** 노출할 항목(2-1), 스프라이트와 소리, 직접 준비한 폴더(2-2), 알림(2-3)을 기본값과 함께 보여 주고, 바꿀 항목만 답받습니다. `agents`(`summary` / `list` / `off`)와 노출할 섹션은 반드시 묻습니다. 사용자가 답하지 않은 항목은 기본값을 씁니다.
5. **방법 B의 셸 명령으로 설치하고, 고른 값을 `--config`로 넘깁니다.** `/plugin …`과 `/plugin configure …`는 사람이 입력창에 입력하는 명령이므로 AI가 도구로 실행할 수 없습니다. 필요하면 사용자에게 입력해 달라고 요청합니다.
6. **설정 파일을 손으로 고쳐서 설치하지 않습니다.** 5장의 statusLine 정리만 예외이며, 이것도 사용자가 동의했을 때만 합니다.
7. **권한 요청이 거부되면 우회하지 않습니다.** 멈추고 사용자에게 알립니다.
8. **설치한 뒤 4장의 방법으로 확인하고, 언제부터 적용되는지 알립니다.**
