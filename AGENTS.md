# AGENTS.md

이 문서는 pane-mod 저장소에서 작업하는 AI 코딩 에이전트(Claude Code, Codex 등)를 위한 지침입니다. 기능과 사용법은 [README.md](README.md)에, 설치 절차는 [INSTALL.md](INSTALL.md)에 있습니다.

pane-mod는 Claude Code의 **mod**(함수형 hook 플러그인)입니다. 오른쪽 side pane과 입력창 위의 band(또는 입력창 아래 힌트 줄)에 HUD를 그리고, 사용자가 지정한 스프라이트를 세션 상태에 맞춰 움직입니다. 빌드 단계는 없습니다. Claude Code가 `hooks/register.tsx`를 그대로 읽어서 실행합니다.

## Claude Code와의 호환

- Claude Code(v2.1.277 이상)는 이 파일을 프로젝트 지침으로 직접 읽습니다. 그래서 이 저장소에는 `CLAUDE.md`를 따로 두지 않습니다.
- 작업 디렉터리나 그 상위 디렉터리에 `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md` 중 하나가 생기면, 기본 설정에서는 Claude Code가 이 파일 대신 그 파일만 읽습니다. 이런 파일을 꼭 추가해야 한다면 첫 줄에 `@AGENTS.md`를 넣어서 이 파일을 함께 읽게 합니다.
- 자세한 규칙은 [How Claude remembers your project: AGENTS.md](https://code.claude.com/docs/en/memory#agents-md)에 있습니다.

## 설치를 요청받았을 때

설치는 사용자의 Claude Code 설정을 바꿉니다. 이 문서를 읽었다는 이유만으로 설치하지 말고, 사용자가 설치를 요청했을 때만 아래 순서를 따릅니다. 각 설정의 자세한 설명은 [INSTALL.md](INSTALL.md) 2장에 있습니다.

1. **무엇을 설치하는지 먼저 한 줄로 알립니다.** 예: "pane-mod(v1.0.0)를 user 범위로 설치합니다. 오른쪽 pane(화면이 pane을 붙일 수 없으면 입력창 위)에 HUD가 생기고, 스프라이트 폴더를 지정하면 스프라이트가 표시됩니다."
2. **Claude Code를 확인합니다.** `claude --version`을 실행합니다. 2.1.292 이상이어야 하며, 버전이 낮으면 `claude update`를 제안합니다. `claude` 명령이 없으면 여기서 멈추고 <https://claude.com/claude-code>를 안내합니다. Claude Code를 대신 설치하지 않습니다.
3. **이미 설치되어 있는지 확인합니다.** `claude plugin list`에 `pane-mod@pane-mod`가 있으면 다시 설치하지 않습니다. 상태가 disabled이면 한 줄로 알린 뒤 `claude plugin enable pane-mod@pane-mod`를 실행합니다. 설정만 바꾸려는 경우에는 아래 "설정 변경을 요청받았을 때"를 따릅니다.
4. **설정을 고르게 합니다.** 아래 세 묶음을 기본값과 함께 한 번에 보여 주고, 바꿀 항목만 답받습니다. 노출할 항목(첫 번째 묶음)은 반드시 묻습니다. 사용자가 답하지 않은 항목은 기본값을 씁니다.

   | 묶음 | 키와 기본값 |
   |---|---|
   | 노출할 항목 (INSTALL.md 2-1) | `layout=auto`, `bandWithPane=off`, `showSession`·`showNow`·`showTasks`·`showModel`·`showUsage`·`showTotals`·`showRecent`·`showLog`=`true`, `showContext=false`, `agents=summary`, `logTurns=50`, `logSessions=30`, `logDays=14`(셋 다 `0`이면 제한 없음), `paneOrder=tasks,agents,context,recent,log`, `sessionColor=auto`, `modelColor=claude`, `cardColor=subtle`, `barFilled=▰`, `barEmpty=▱` |
   | 스프라이트와 소리 (INSTALL.md 2-2) | `sprite=true`, `animate=true`, `spriteSource=auto`, `sound=true`, `spriteDir`·`soundDir`=빈 값(플러그인 폴더의 `assets/`를 찾으며, 저장소에는 들어 있지 않음) |
   | 알림 (INSTALL.md 2-3) | `alerts=true` |

   사용자가 직접 준비한 폴더를 지정하면, 설치하기 전에 그 폴더가 있는지와 하위 폴더 구조(아래 "asset" 절)를 `ls`로 확인하고 결과를 알려 줍니다. 폴더가 없거나 비어 있어도 설치는 진행할 수 있으며, 이 경우 스프라이트나 소리가 생략된다는 점을 함께 알립니다. 경로는 `~`를 풀어서 절대 경로로 넘깁니다.
5. **셸에서 설치합니다.** 기본값과 다르게 고른 항목만 `--config`로 넘깁니다. `claude plugin install`은 설정 화면을 띄우지 않으므로, 고른 값은 `--config`로만 전달됩니다.

   ```sh
   claude plugin marketplace add taehwan0/pane-mod   # GitHub 저장소, 또는 clone한 폴더의 경로
   claude plugin install pane-mod@pane-mod --config agents=list --config showContext=true --config spriteDir=/Users/me/.config/pane-mod/sprites
   ```

   사용자가 직접 설치하겠다고 하면, 터미널에서 실행한 Claude Code의 입력창에 `/plugin install pane-mod --marketplace taehwan0/pane-mod`를 입력하라고 안내합니다. 이때는 설정 화면이 열리고, 사용자가 세 묶음을 직접 고릅니다.
6. **확인하고 적용 시점을 알립니다.** `claude plugin list`에서 `Status: ✔ enabled`를 확인합니다. 셸에서 설치했다면 새로 시작한 세션부터 확실하게 적용됩니다. 마지막으로 `/pane-mod`(pane 열기)와 `/pane-mod auto|band|pane|hint`(레이아웃 바꾸기)를 안내합니다.

다음 규칙을 지킵니다.

- `/plugin …`, `/reload-plugins`, `/pane-mod …`는 사람이 입력창에 입력하는 명령입니다. AI가 도구로 실행할 수 없으므로, 필요하면 사용자에게 입력해 달라고 요청합니다. AI가 실행할 수 있는 것은 `claude plugin …` 셸 명령입니다.
- `~/.claude/settings.json`을 손으로 고쳐서 설치하거나 설정하지 않습니다. statusLine 정리(INSTALL.md 5장)는 사용자가 동의했을 때만 진행합니다.
- 권한 요청이 거부되면 우회하지 않고, 멈춘 뒤 사용자에게 알립니다.
- 설치가 실패하면 INSTALL.md 7장의 표에서 증상을 찾습니다.

## 설정 변경을 요청받았을 때

pane-mod의 설정은 모두 `plugin.json`의 `userConfig`에 있습니다. 설정을 바꾸는 별도의 `/pane-mod` 하위 명령은 지금은 두지 않습니다. `/plugin configure`, `/config`와 같은 일을 하는 경로가 두 개가 되기 때문입니다. 사용자가 "context 섹션을 보이게 해 줘"처럼 설정 변경을 요청하면 다음 순서를 따릅니다.

1. **요청을 키와 값으로 옮깁니다.**

   | 요청 예시 | 키와 값 |
   |---|---|
   | md 파일, hooks, 도구 수(context 섹션)를 보이게 하거나 숨기기 | `showContext=true` / `false` |
   | session, now, tasks, model, usage, totals, recent, log 섹션을 숨기기 | `showSession`, `showNow`, `showTasks`, `showModel`, `showUsage`, `showTotals`, `showRecent`, `showLog` 중 해당 키를 `false` |
   | 로그에 보관할 턴 수, 세션 수, 날수 바꾸기, 제한 없이 보관하기 | `logTurns`(5 이상), `logSessions`(1 이상), `logDays`(1 이상)에 숫자. 제한을 없앨 때는 `0` |
   | 서브에이전트를 한 줄씩 보이기, 개수만 보이기, 숨기기 | `agents=list` / `summary` / `off` |
   | HUD를 입력창 위에만, 오른쪽 pane에만, 화면에 맞춰 그리기 | `layout=band` / `pane` / `auto` |
   | band와 pane 없이 입력창 아래 힌트 줄에 한 줄 정보만 두기 | `layout=hint` |
   | pane이 보일 때 입력창 위에 한 줄 요약도 두기 | `bandWithPane=line` |
   | 스프라이트를 끄거나 켜기, 움직이지 않게 하기 | `sprite=false` / `true`, `animate=false` |
   | 그림 대신 빈칸이 보이는 터미널 | `spriteSource=bytes`. 그래도 보이지 않으면 `sprite=false` |
   | 소리 끄기, 승인 창 아래 한 줄 끄기 | `sound=false`, `alerts=false` |
   | 직접 준비한 스프라이트나 소리 폴더 쓰기, 원래 폴더로 되돌리기 | `spriteDir` / `soundDir`에 절대 경로, 되돌릴 때는 빈 문자열(`""`) |
   | pane 아래쪽 카드의 순서 바꾸기(예: log를 tasks 위로) | `paneOrder`에 `tasks`, `agents`, `context`, `recent`, `log`를 원하는 순서로 적은 값(예: `log,tasks`). 적지 않은 카드는 기본 순서대로 뒤에 붙습니다. `log`가 마지막이 아니면 휠로 로그를 넘길 수 없다는 점을 함께 알립니다. |
   | 첫 카드의 색을 `/color`와 관계없이 고정하기, `/color`를 다시 따르기 | `sessionColor`에 테마 키나 `#rrggbb`, 되돌릴 때는 `auto` |
   | 모델 카드나 나머지 카드의 테두리 색 바꾸기 | `modelColor` / `cardColor`에 테마 키나 `#rrggbb`(기본값은 `claude` / `subtle`) |
   | 게이지 문자 바꾸기 | `barFilled` / `barEmpty`에 폭이 한 칸인 문자 하나(기본값은 `▰` / `▱`) |

2. **현재 값을 확인합니다.** `claude plugin configure pane-mod@pane-mod --json`을 실행합니다. `inputs`에는 기본값까지 반영된 현재 값이, `choices`에는 고를 수 있는 값이 있습니다. 바꿀 키, 지금 값, 새 값을 한 줄로 알립니다(예: "`showContext`: false → true").
3. **폴더를 지정할 때는 먼저 확인합니다.** 이 CLI는 폴더가 있는지 검사하지 않습니다. `ls`로 폴더와 하위 폴더 구조(아래 "asset" 절)를 확인하고 결과를 알려 줍니다. 폴더가 없거나 비어 있으면 그 부분이 생략된다는 점을 함께 알립니다. 경로는 `~`를 풀어서 절대 경로로 넘깁니다.
4. **셸 명령으로 저장합니다.** 바꿀 키만 JSON 객체로 넘기며, 값은 한 줄 문자열로 적습니다. 허용되지 않는 값이면 `Failed to save configuration: … must be one of: …`처럼 이유가 출력되므로, 그 내용을 사용자에게 전합니다.

   ```sh
   echo '{"showContext":"true","agents":"list"}' | claude plugin configure pane-mod@pane-mod --values-stdin
   ```

5. **적용 방법을 안내합니다.** 저장하면 CLI가 `Restart Claude Code to apply it.`라고 안내합니다. 실행 중인 세션에서는 사용자에게 `/reload-plugins`를 입력해 달라고 요청하고, 그래도 바뀌지 않으면 Claude Code를 다시 시작하라고 안내합니다.

다음 경우에는 셸 명령 대신 사용자가 직접 바꾸도록 안내합니다.

- **사용자가 직접 바꾸고 싶어 할 때**: 입력창에 `/plugin configure pane-mod@pane-mod`(전체 설정 화면)나 `/config`(pane-mod 행)를 입력하라고 안내합니다. 이 경로로 바꾸면 Claude Code가 mod를 새 값으로 다시 로드합니다.
- **이번 세션에서만 레이아웃을 바꾸고 싶을 때**: `/pane-mod auto`, `/pane-mod band`, `/pane-mod pane`, `/pane-mod hint`를 안내합니다. 이 명령은 설정을 저장하지 않습니다.
- **`--plugin-dir`로 로드한 작업 사본일 때**: 설치된 플러그인이 아니므로 `/config`의 pane-mod 행에서 바꾸도록 안내합니다.

어느 경우에도 `~/.claude/settings.json`을 손으로 고치지 않습니다.

## mod 공식 문서

mod를 만들거나 고칠 때는 아래 공식 문서를 기준으로 삼습니다. 이벤트 이름과 `$` 메서드를 기억이나 다른 플러그인의 사례로 추측하지 말고, 문서와 타입 선언에서 확인한 뒤에 코드를 작성합니다.

| 단계 | 문서 | 읽어야 하는 상황 |
|---|---|---|
| 개요 | [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview) | mod가 무엇이고 어디에서 동작하는지(터미널, Desktop, `claude -p`), 무엇에 접근할 수 있는지 확인할 때 |
| 만들기 (create) | [Create a mod](https://code.claude.com/docs/en/plugins/mods/create) | 파일 구성, `--plugin-dir`로 로드하고 다시 읽는 과정, 버전별 타입 선언, `claude plugin validate`의 정적 분석 규칙을 확인할 때 |
| 구현 (build) | [Draw in the interface](https://code.claude.com/docs/en/plugins/mods/interface) | band(`AbovePrompt`)와 pane, 버튼과 입력, `$.state`·`$.store`로 상태를 유지하는 방법을 확인할 때 |
| 구현 (build) | [React to events](https://code.claude.com/docs/en/plugins/mods/events) | `next`의 사용법, matcher, `.catch`, mod 실행 순서, 설정 hook 이벤트(`classic.*`)를 확인할 때 |
| 구현 (build) | [Use the mods API](https://code.claude.com/docs/en/plugins/mods/api) | 명령, 타이머(`$.clock`), 파일, 프로세스, 모델 호출을 쓸 때 |
| 구현 (build) | [Interface gallery](https://code.claude.com/docs/en/plugins/mods/gallery) | `Text`, `Button`, `Markdown`, `Code` 같은 요소가 터미널에서 어떻게 보이는지 확인할 때 |
| 테스트 (test) | [Test a mod](https://code.claude.com/docs/en/plugins/mods/test) | `claude-code/testing` 테스트 키트, stub, `mock.clock`, `$.ui.mount`로 그림을 검사하는 방법을 확인할 때 |
| 문제 해결 (troubleshoot) | [Troubleshoot a mod](https://code.claude.com/docs/en/plugins/mods/troubleshoot) | mod가 아무 일도 하지 않거나, hook이 건너뛰어지거나, 그림이 거부될 때 |
| 레퍼런스 | [Mods reference](https://code.claude.com/docs/en/plugins/mods/reference) | 이벤트, `$`의 네임스페이스와 메서드, render site, 요소, 시간·크기 제한, 명령 목록을 찾을 때 |
| 조직 관리 | [Manage mods for your organization](https://code.claude.com/docs/en/plugins/mods/admin) | managed settings가 mod 로드를 막고 있는지 확인할 때 |

- 페이지 URL 끝에 `.md`를 붙이면 Markdown 원문을 받을 수 있습니다. 전체 문서의 색인은 <https://code.claude.com/docs/llms.txt>에 있습니다.
- 이벤트와 메서드는 Claude Code 버전마다 바뀔 수 있습니다. 문서와 타입 선언이 서로 다르면 **지금 설치된 Claude Code가 만들어 준 타입 선언**(`.claude-plugin/types/claude-code/index.d.ts`)을 따릅니다. 이 파일은 매우 크므로 `'tool.call'`, `Pane: {`처럼 찾으려는 이름으로 검색한 뒤 해당 선언만 읽습니다.
- 이 문서의 내용은 2026-10-10에 Claude Code 2.1.296 기준으로 위 문서들과 대조했습니다.

## 구조

### mod의 구조 (공식 문서 기준)

mod는 hooks module을 가진 플러그인입니다. 필수 파일은 세 개이며, `$.state`를 쓰는 mod에는 타입 계약 파일이 하나 더 필요합니다.

```text
<mod>/
├── .claude-plugin/
│   └── plugin.json       # 플러그인 manifest (필수). userConfig와 types 경로를 적습니다.
├── hooks/
│   ├── hooks.json        # { "modules": ["./register.tsx"] } (필수). 이 파일 기준의 상대 경로 하나를 적습니다.
│   └── register.tsx      # hooks module (필수). register(on, options)를 export합니다.
├── types/
│   └── index.d.ts        # $.state 값의 계약. $.state를 쓸 때 필요하며 plugin.json의 "types"로 지정합니다.
└── **/*.test.ts(x)       # claude plugin test가 실행하는 테스트 (선택)
```

mod를 이해하는 데 필요한 개념은 다음과 같습니다.

- **`register(on, options)`**: mod가 로드될 때 한 번 호출됩니다. `options`에는 `plugin.json`에 선언한 `userConfig` 값이 기본값과 함께 들어옵니다.
- **`on(event, matcher?, hook)`**: hook을 등록합니다. matcher는 `{ component: 'AbovePrompt' }`처럼 이벤트의 필드로 대상을 거르는 조건입니다. 반환값의 `.catch(handler)`로 hook이 실패했을 때의 처리를 지정합니다.
- **hook `($, e, next)`**: `$`는 mods API이고, `e`는 읽기 전용 이벤트 입력이며, `next(e)`는 뒤에 있는 hook과 Claude Code의 기본 동작을 실행한 뒤 결과를 돌려줍니다. hook은 이벤트를 관찰하거나(`next(e)`), 고쳐서 넘기거나(`next({ ...e, ... })`), `next`를 부르지 않고 직접 응답할 수 있습니다.
- **그리기**: `ui.render` hook은 render site(`AbovePrompt`, `Pane` 등)에 그릴 요소 트리를 반환합니다. 요소는 `$.ui.resolve(e)`로 얻습니다.
- **상태의 수명**: 모듈 변수는 mod를 다시 로드할 때마다 초기화됩니다. `$.state`는 세션 동안 유지되지만 `/clear`, `/resume`, `/branch`를 실행하면 기본값으로 돌아갑니다. `$.store`는 모든 세션이 공유하는 저장소이며, 전체 용량은 4 MiB입니다. `$.fs`로는 파일 하나를 4 MiB까지 읽고 쓸 수 있으며, 파일을 지우는 메서드는 없습니다.

### pane-mod의 현재 구조

```text
pane-mod/
├── .claude-plugin/
│   ├── plugin.json          # 이름, 버전(1.0.0), userConfig 28개, types 경로
│   ├── marketplace.json     # 이 폴더를 마켓플레이스로 등록합니다 (source: "./").
│   └── types/               # Claude Code가 mod를 로드할 때 만드는 타입 선언 (git 제외)
├── hooks/
│   ├── hooks.json           # { "modules": ["./register.tsx"] }
│   ├── register.tsx         # hooks module: 데이터 수집, asset 폴더 탐색, 스프라이트와 소리, 알림, 작업 로그, band와 pane 그리기
│   └── format.ts            # $를 쓰지 않는 순수 함수: 게이지, 색, 시간 표기, git HEAD 해석, 프레임·소리 파일 목록, 로그 변환과 로그 줄의 상한(LOG_CAPS), 로그 파일 이름과 보관 한도에 따른 정리 대상(`sweepOf`), 로그 검색(`logMatches`), 힌트 줄의 한 줄 정보(`hintTail`), 카드 순서와 색·게이지 문자 설정 검사
├── types/index.d.ts         # 공유 타입과 $.state 계약 (snap, frame, logOffset, logOpen, logQuery)
├── tests/pane-mod.test.tsx  # claude-code/testing 기반 테스트 79개
├── assets/                  # 선택 사항인 로컬 스프라이트·소리 폴더 (git 제외, 저장소에는 없음. 아래 "asset" 참고)
├── docs/sprite-states.md    # 구분할 수 있는 상태, 필요한 스프라이트, 스프라이트 제작 규격
├── docs/demo.gif            # README "사례"의 데모 화면 (화면 녹화를 1.5배속 GIF로 변환)
├── tsconfig.json            # .claude-plugin/types/tsconfig.json을 extends합니다.
├── README.md                # 기능, 설정, 레이아웃, 알림, 표시 항목, 이 mod가 컴퓨터에서 하는 일 (한국어, 기준 문서)
├── README.en.md             # README의 영어판
├── INSTALL.md               # 설치 절차, 문제 해결, AI가 설치를 맡을 때의 규칙
├── AGENTS.md                # 이 문서
└── LICENSE                  # MIT
```

`hooks/register.tsx`는 위에서부터 다음 순서로 구성되어 있습니다.

1. **상수**: 갱신 주기(`FRAME_MS` 80ms, `FAST_MS` 2초, `SLOW_MS` 15초), 스프라이트 크기, 로그 보관(`logTurns`·`logSessions`·`logDays`의 기본값, 로그 파일 폴더 `KEPT_FOLDER`와 파일 하나에 봉인하는 줄 수 `LOG_PART`, 파일을 지우는 `REMOVER`), 알림 기준(`ALERT_MARKS`) 등을 정의합니다. 로그 줄 하나에 담는 항목의 개수와 길이 상한은 `format.ts`의 `LOG_CAPS`에 있습니다.
2. **`$.state` atom**: `snap`, `frame`, `logOffset`, `logOpen`, `logQuery`(로그 검색어)를 정의합니다. 타입은 `types/index.d.ts`의 `PluginState['pane-mod']`에 선언되어 있습니다.
3. **모듈 변수**: 설정값, 레이아웃 상태, 진행 중인 턴(`tally`: 개수, 도구별 호출 수, skill, MCP 도구, 서브에이전트, 실패한 호출, 승인 요청, 거부), 턴이 끝난 뒤에도 실행 중인 서브에이전트(`pendingAgents`), 알림, 작업 로그 등을 담습니다. mod를 다시 로드하면 초기화됩니다.
4. **`$`를 받는 최상위 함수**: 수집(`gatherSlow`, `gatherFast`, `refresh`), asset 탐색(`findAssets`), 스프라이트(`sourceOf`, `showFrame`, `setMotion`, `startPlayer`), 소리(`soundsOf`, `clipOf`, `playFor`), 로그(`syncLog`, `saveLog`: 세션 파일을 쓰고 보관 한도를 넘은 파일을 정리, `removeKept`: `/bin/rm`으로 지우고 실행할 수 없으면 파일을 비움, `foundLog`·`findLog`: 로그 검색, `openLogFile`), 알림(`raiseAlert`, `noteDialog`), pane(`openPane`, `closePane`, `applyLayout`)으로 나뉩니다.
5. **`register`**: `options`를 모듈 변수에 반영하고 hook을 등록합니다.
6. **그리기 함수**: band와 pane이 함께 쓰는 표시(`gauge`: 두 색 `▰▱` 게이지(문자는 `barFilled`·`barEmpty` 설정), `effortMark`, `statusMark`: ` ● WORKING ` 배지), band의 행(`placeRow`, `modelRow`, `usageRow`, `contextRow`, `statusRow`, `agentList`, `compactRow`), pane의 카드(`identityCard`: 오른쪽에 스프라이트를 품은 pane 폭의 첫 카드, `modelCard`, `tasksCard`, `agentsCard`, `contextCard`, `recentCard`: 최근에 쓴 skill과 MCP 도구, `logSection`)를 만듭니다. 모델 카드 아래의 카드는 Pane의 `ui.render` hook이 `paneOrder` 순서로 늘어놓습니다. 카드는 `Box`의 `borderStyle: 'round'`로 그리고 테두리 색은 `sessionColor`·`modelColor`·`cardColor` 설정(모듈 변수 `sessionBorder`, `modelBorder`, `cardBorder`)을 따르며, 카드 안의 행은 `columns - CARD_INSET` 폭으로 그립니다.

HUD에 표시하는 값은 다음 순서로 갱신됩니다. `session.start`는 먼저 `findAssets`로 스프라이트 폴더의 프레임 목록을 만들고, 2초 주기의 타이머를 등록합니다. 그러면 `refresh`가 값을 수집해서 `Snapshot` 하나로 묶고 `$.state`의 `snap`에 씁니다. `snap`이 바뀌면 이 값을 읽는 `ui.render` hook이 band와 pane을 다시 그립니다. 스프라이트는 이와 별도로 80ms 주기의 타이머가 `$.ui.blit`을 호출해서 프레임 그림만 교체합니다.

`claude plugin validate .`가 보고하는 hook은 다음 25개입니다.

| 역할 | hook |
|---|---|
| 시작과 설정 | `session.start`(asset 폴더 탐색, 타이머 등록, `/pane-mod` 명령 등록), `classic.SessionStart`(세션 이름), `prompt.compose`(출력 스타일), `classic.UserPromptSubmit`(권한 모드, 세션 이름) |
| 턴과 스프라이트 | `turn.start`·`turn.complete`(working과 idle 전환, 작업 로그 기록, 토큰 합계, 서브에이전트가 끝난 방식), `session.end`(진행 중인 턴을 중단된 줄로 저장), `turn.step`(effort), `tool.call`(지금 실행 중인 도구, 턴별 작업 집계: 도구별 호출 수, skill, MCP 도구, 작업 목록), `agent.spawn`(서브에이전트, 턴 로그의 서브에이전트 목록) |
| 명령 출력 행 | `session.append{door=command}`(`/effort`, `/rename`, `/color`가 남기는 행 읽기) |
| 승인 창 아래 한 줄과 작업 로그 | `classic.PermissionRequest`(승인 대기, 승인 요청 기록), `classic.Notification`(약 6초 뒤의 승인 알림), `classic.PostToolUse`, `classic.PostToolUseFailure`(실패한 호출 기록), `classic.PermissionDenied`(거부된 호출 기록), `ui.render{component=ToolProgress}`(승인 뒤 실행이 시작된 호출) |
| Claude의 작업 목록 | `classic.TaskCreated`, `classic.TaskCompleted` |
| band와 힌트 줄 | `ui.render{component=AbovePrompt}`, `ui.render{component=PromptHint}`(`layout=hint`일 때 한 줄 정보) |
| pane과 `/pane-mod` | `command.run{command=pane-mod}`, `ui.render{component=Pane, requestId=pane-mod}`, `ui.scroll{requestId=pane-mod}`(로그 휠 스크롤), `ui.close{id=pane-mod}` |

## 개발 절차

### 로드와 다시 읽기

- 작업 사본은 `claude --plugin-dir .`로 로드합니다. 이렇게 로드하면 파일을 저장할 때마다 hooks module을 다시 읽습니다. Claude가 파일을 고쳤다면 그 턴이 끝날 때 다시 읽습니다. 다시 읽으면 `register`와 `session.start`가 다시 실행되고 모듈 변수는 초기화됩니다.
- 설치한 플러그인은 버전별로 캐시된 사본으로 실행되므로, 개발할 때는 설치본이 아니라 `--plugin-dir`로 작업 사본을 로드합니다. 설치본에 반영하는 방법은 INSTALL.md 6장을 따릅니다.
- 이름이 같은 플러그인은 하나만 로드됩니다(`another plugin of that name loads first`). 설치된 pane-mod가 있다면 개발하는 동안 `claude plugin disable pane-mod@pane-mod`로 잠시 꺼 둡니다.
- 이 저장소를 고칠 때는 다른 폴더에 사본을 만들어 작업하지 말고, 이 저장소의 파일을 직접 고칩니다. mod를 새로 만드는 스킬이나 도구가 별도의 작업 폴더를 쓰더라도 마찬가지입니다.

### 검사

작업을 마치기 전에 다음 세 가지를 모두 실행하고 통과하는지 확인합니다.

```sh
tsc -p . --noUnusedLocals   # 타입 검사
claude plugin validate .    # manifest 검사와 정적 분석
claude plugin test .        # 테스트
```

- `tsc`는 `.claude-plugin/types/`가 있어야 동작합니다. 이 폴더는 Claude Code가 대화형 세션에서 `--plugin-dir`로 이 mod를 로드할 때 만들어 주며, git에는 포함되지 않습니다. 폴더가 없다면 `claude --plugin-dir .`로 한 번 실행했다가 종료합니다. TypeScript는 `target: es2023`을 지원하는 버전이어야 합니다(6.0.3은 통과했고, 5.2.2는 이 target을 거부했습니다).
- `claude plugin validate .`의 출력에서 `hooks:`, `calls:`, `env reads:`, `state reads:`, `state writes:` 행을 확인합니다. 새로운 `$` 호출이나 환경 변수 읽기를 추가했다면 README의 "이 mod가 컴퓨터에서 하는 일" 절도 함께 고칩니다.
- `claude plugin test .`는 `tests/pane-mod.test.tsx`를 실행하며, 지금은 79개가 모두 통과합니다. 테스트 하나의 시간 제한은 5초입니다.

### 정적 분석 규칙

Claude Code는 hooks module의 소스를 정적으로 분석해서 hook과 `$` 호출을 찾습니다. 다음 규칙을 어기면 `validate`가 실패하거나 hook이 등록되지 않습니다.

- `$` 호출은 `$.store.get(...)`처럼 네임스페이스와 메서드를 모두 적습니다. `$`나 `$.ui`를 변수에 담거나, 구조 분해하거나, 계산된 이름으로 접근하지 않습니다.
- `$`를 인자로 받는 함수는 **같은 파일의 최상위**에 선언합니다. 메서드, hook 안에서 정의한 함수, 다른 파일에서 가져온 함수에 `$`를 넘기면 실패합니다. `claude-code`에서 가져온 `read`, `update`만 예외입니다. 그래서 이 저장소는 `$`를 쓰는 코드를 `register.tsx`에 두고, `$`가 필요 없는 순수 함수를 `format.ts`에 둡니다.
- `on`에 넘기는 이벤트 이름은 문자열 리터럴로 적습니다. 변수나 반복문으로 hook을 등록하지 않습니다.
- `register` 안에서 `on`이라는 이름을 다시 선언하지 않습니다.
- import는 파일 맨 위의 정적 `import` 선언만 씁니다. 플러그인 폴더 안의 파일(상대 경로)과 `claude-code`만 가져올 수 있으며, `require`와 동적 `import()`는 쓸 수 없습니다.
- hook 하나의 실행 시간은 10초, `.catch` 처리기의 실행 시간은 1초로 제한됩니다. 이벤트를 통과시키는 hook에는 기존 코드처럼 `.catch(($, e, next) => next(e))`를 붙여서, hook이 실패하더라도 Claude Code의 기본 동작이 그대로 진행되게 합니다. `validate`가 `gating hook without .catch`를 보고하면 이 처리가 빠진 것입니다.

### 테스트 작성

- 테스트는 `claude-code/testing`의 `test`, `expect`, `mock`을 씁니다. 테스트 안의 `$`는 Claude Code의 역할을 하며, `$.tool.call(...)`, `$.turn.complete(...)`처럼 이벤트를 발생시킵니다.
- mod가 호출하는 mods API에는 `on('fs.read', ...)`처럼 stub으로 응답합니다. mods API의 stub은 `{ value }`를 반환하고, `tool.call` 같은 이벤트의 stub은 그 이벤트의 결과를 반환합니다. stub은 테스트가 `$`를 처음 호출하기 전에 모두 등록해야 합니다.
- 이 저장소의 테스트는 파일 상단의 `world()` helper로 엔진 전체(`fs`, `env`, `clock`, `session`, `ui`, `audio`, `process` 등)를 stub으로 대신합니다. 새 테스트도 이 helper를 쓰고, 필요한 stub만 추가합니다. 같은 이름의 stub을 두 번 등록하지 말고, 테스트별 차이는 `paneWorld()`가 돌려주는 객체로 줍니다.
- `world()`가 보여 주는 폴더 목록은 `ui.folders`입니다. 기본값은 플러그인 폴더의 `assets/`에 프레임이 있는 상태(`idle` 36개, `working` 29개, `complete` 22개)이고 소리는 없습니다. 소리가 필요한 테스트는 `listening(ui)`로 소리 폴더를 추가하며, 재생된 소리는 `ui.played`에 쌓입니다. asset이 없는 경우는 `folders: {}`로, 목록에는 있지만 읽을 수 없는 파일은 `unreadable`로 시험합니다.
- 로그 파일은 `ui.files`(경로별 내용과 수정 시각)에 쌓이고, `fs.read`, `fs.list`도 이 객체를 읽습니다. 미리 보관된 로그는 `keep(ui, '<세션 ID>', 기록, 수정 시각)`으로 넣고, 저장된 내용은 `savedOf`, `textsOf`, `keptNames`로 확인합니다. 데이터 폴더는 `CLAUDE_PLUGIN_DATA`(`DATA`)입니다.
- mod가 실행한 명령은 `ui.ran`에 쌓이며, `/bin/rm`은 `ui.files`에서 그 파일을 지웁니다. 명령을 실행할 수 없는 환경(Desktop 앱)은 `ui.noProcess = true`로 시험합니다.
- `session.start`는 테스트에서 자동으로 실행되지 않습니다. 필요하면 테스트에서 직접 발생시킵니다.
- 타이머는 `mock.clock(on)`으로 대체하고, `clock.advance(ms)`로 시간을 진행합니다.
- 그림은 `$.ui.mount({ component: 'AbovePrompt', ... })`처럼 render site를 그린 뒤 `find`, `press`로 검사합니다.
- 테스트는 실제 asset 파일을 읽지 않습니다(`fs.read`, `fs.list`, `audio.play`를 stub으로 처리합니다). 그래서 asset이 없는 clone에서도 통과합니다. 새 테스트도 asset 파일에 의존하지 않게 작성합니다.
- 테스트에서 절대 경로를 쓸 때는 `/Users/...`처럼 실제 macOS 경로를 씁니다. 엔진은 `/home/...` 같은 경로를 네트워크 위치로 보고 `Image`의 `file` 소스를 거부합니다.

### 문제 해결

1. 먼저 `claude plugin validate .`를 실행합니다. 이벤트 이름의 오타, manifest 오류, 읽을 수 없는 모듈을 세션 없이 찾아낼 수 있습니다.
2. `--plugin-dir`로 로드한 세션에서는 모듈 로드나 hook이 실패하면 transcript에 흐린 줄이 한 줄 남습니다. 예를 들면 `pane-mod: tool.call hook skipped: threw ...`, `pane-mod: ui.render (AbovePrompt) refused: <이유>; the engine drew its own`, `reload failed, the previous version stays loaded: <이유>` 같은 줄입니다.
3. 그 밖의 세션에서는 이런 내용이 debug log에만 남습니다. 로그 파일을 저장소 밖에 쓰도록 실행한 뒤, 다른 터미널에서 이 mod의 줄만 걸러서 봅니다. 정상적으로 로드되었다면 `hooks module pane-mod@inline loaded (...); events: ...` 줄이 있습니다.

   ```sh
   claude --debug-file /tmp/pane-mod-debug.log --plugin-dir .
   tail -f /tmp/pane-mod-debug.log | grep pane-mod
   ```

4. 증상별 원인은 [Troubleshoot a mod](https://code.claude.com/docs/en/plugins/mods/troubleshoot)에서 찾습니다. 이 mod에서 자주 확인하는 경우는 다음과 같습니다.
   - band나 pane이 비어 있거나 Claude Code의 기본 화면이 보이면, hook이 반환한 트리가 검증을 통과하지 못한 것입니다. `refused:` 뒤에 적힌 이유를 확인합니다.
   - 값이 다시 로드할 때마다 초기화되면, 그 값을 모듈 변수 대신 `$.state`나 `$.store`에 둡니다.
   - `/clear`나 `/resume` 뒤에 값이 기본값으로 돌아가면, `classic.SessionStart` hook에서 저장된 값을 다시 읽습니다.
   - 스프라이트가 보이지 않고 글자 HUD만 있으면, 먼저 스프라이트 폴더에 PNG가 있는지 확인합니다(아래 "asset" 절). 프레임이 있는데도 보이지 않으면 터미널이 지원하는지 확인합니다(INSTALL.md 7장).

## asset (git 관리 대상이 아닙니다)

pane-mod는 스프라이트와 소리를 배포하지 않습니다. 사용자는 `spriteDir`, `soundDir`로 자기 폴더를 지정하며, 플러그인 폴더의 `assets/`는 clone해서 쓰는 사람을 위한 선택 사항인 로컬 폴더입니다. `assets/`는 `.gitignore`에 들어 있으므로 저장소에 커밋하지 않습니다. 캐릭터 리소스(README의 "사례"에 나오는 스프라이트 같은 것)는 배포하기 전에 권리 관계를 확인해야 하고(README "라이선스"), 바이너리 파일은 저장소의 크기를 키우기 때문입니다.

- `git add -f`로 asset을 강제로 추가하지 않습니다. 커밋하기 전에 `git status`에 `assets/`가 나타나지 않는지 확인합니다.
- 새로 clone한 저장소에는 asset이 없습니다. 이 상태에서도 `validate`와 `test`는 통과하고, 실제 세션에서도 오류 없이 글자 HUD만 표시됩니다.

### 폴더 구조

mod는 아래 구조로 asset을 찾습니다. 스프라이트 폴더는 `spriteDir` 설정이 가리키는 폴더이고, 비어 있으면 플러그인 폴더의 `assets/`입니다. 소리 폴더는 `soundDir` 설정이 가리키는 폴더이고, 비어 있으면 플러그인 폴더의 `assets/sounds/`입니다.

| 경로 | 내용 | 코드와의 관계 |
|---|---|---|
| `<스프라이트 폴더>/idle/*.png` | 턴 사이(idle)의 동작, 반복 재생. | `findAssets`가 `spriteFrames`로 PNG 파일을 이름 순서로 모읍니다. |
| `<스프라이트 폴더>/working/*.png` | 모델 턴이 진행되는 동안(working)의 동작, 반복 재생. | 같음 |
| `<스프라이트 폴더>/complete/*.png` | 턴 완료 동작. 지금은 `register.tsx`의 `IS_CHEERING`으로 꺼져 있습니다. | 같음 |
| `<소리 폴더>/{idle,working}/` | 상태별 소리. 폴더 안의 파일 하나를 무작위로 재생합니다. | `soundFiles`가 확장자(`.caf`, `.wav`, `.aif`, `.aiff`, `.mp3`, `.m4a`, `.aac`)로 파일을 거릅니다. |

- 프레임 수는 코드에 적지 않고, 폴더에 든 PNG 수로 정합니다. 이름 순서로 재생하므로 번호는 `frame_001.png`처럼 0으로 채웁니다. 프레임은 220×218 RGBA PNG이며, 제작 규격과 ffmpeg 변환 명령은 [docs/sprite-states.md](docs/sprite-states.md)의 "스프라이트 제작 규격"에 있습니다.
- `spriteDir`, `soundDir`는 `directory` 타입의 `userConfig`입니다. `folderOf`가 `~`를 `HOME`으로 풀고, 상대 경로는 홈 폴더 기준으로 읽습니다.
- `$.audio.play`의 `{ asset }`은 플러그인 폴더 안의 파일만 받습니다. 그래서 `soundDir`의 소리는 `clipOf`가 bytes로 읽어 `{ base64, mime }`으로 재생합니다. 플러그인 폴더의 `assets/sounds/`에 둔 소리는 `{ asset: 'assets/sounds/...' }`로 재생합니다.
- 폴더는 세션이 시작될 때 한 번 읽습니다(mod를 다시 로드할 때 포함). 파일을 바꾼 뒤에는 `/reload-plugins`가 필요합니다.
- 새 동작을 추가하면 `hooks/format.ts`의 `Motion` 타입과 `MOTIONS`, `register.tsx`의 `findAssets`를 함께 고칩니다.

### 파일이 없을 때의 동작

이미지나 소리 파일이 없으면 그 부분을 생략하고, 오류를 내지 않습니다. 이 동작을 고칠 때도 다음 규칙을 유지합니다.

- 프레임이 없는 동작은 `framesFor`가 `idle`, `working`, `complete` 순서로 다른 동작의 프레임을 빌립니다. 어느 동작에도 프레임이 없으면 band와 pane이 스프라이트와 그 여백을 그리지 않습니다. 빈 자리를 남기지 않고, 그 폭을 글자 HUD에 돌려줍니다.
- 목록에는 있지만 읽을 수 없는 프레임은 `withoutFrame`으로 빼고 다음 프레임을 씁니다. 남은 프레임이 없으면 스프라이트를 생략합니다.
- 소리 폴더가 없거나 비어 있는 상태에서는 소리를 내지 않습니다. 읽거나 재생할 수 없는 소리는 `dropClip`으로 빼서 다시 고르지 않습니다.
- asset을 다루는 `$` 호출은 모두 `.catch`로 실패를 처리해서 hook 밖으로 오류가 나가지 않게 합니다. 오류가 hook 밖으로 나가면 transcript에 `hook skipped` 줄이 남고, `ui.render`가 실패하면 Claude Code가 자기 화면을 대신 그립니다.
- 이 동작은 `tests/pane-mod.test.tsx`의 asset 관련 테스트(`with no frame and no clip found ...` 등)가 검사합니다. 동작을 바꾸면 이 테스트도 함께 고칩니다.

## 작업 규칙

- **언어**: README, INSTALL, `docs/`, 이 문서는 한국어 합니다체로 씁니다. README.en.md는 README의 영어판이며, README를 고치면 영어판의 같은 내용도 함께 고칩니다. 코드의 식별자와 주석(JSDoc 포함)은 영어로 쓰고, 기존 주석의 문체를 따릅니다. 커밋 메시지는 `feat: ...`처럼 Conventional Commits 접두어 뒤에 한국어로 씁니다.
- **pane의 마지막 카드**: 첫 카드와 모델 카드 아래의 카드는 `paneOrder`(`paneOrderOf`가 읽은 순서)대로 그리며, 기본 순서에서는 로그 카드가 pane 트리의 맨 끝에 옵니다. `ui.scroll` hook은 pane 맨 아래의 `logRowsOf`행(테두리 두 줄, 제목, 검색칸, 줄 또는 찾지 못했다는 행, 상세, 버튼 행)을 로그 영역으로 보므로, 로그 카드의 행 구성을 바꾸면 `logRowsOf`도 함께 고칩니다. 다른 카드는 폭에 따라 줄을 바꿔서 높이를 정확히 알 수 없으므로, `paneOrder`의 마지막이 `log`가 아니면 `logHeight`를 0으로 두어 휠은 언제나 pane을 스크롤하고, 로그는 `▲ older` / `▼ newer` 버튼과 `o` / `n` 키로만 넘깁니다. 이 규칙을 유지하려면 새 카드를 추가할 때 `PANE_CARDS`의 기본 순서에서 `log`보다 앞에 넣습니다.
- **`$`를 쓰는 코드와 순수 함수의 분리**: `$`가 필요 없는 계산은 `hooks/format.ts`에서 export하고, `tests/`에서 직접 단위 테스트합니다.
- **상태**: 다시 로드한 뒤에도 남아야 하는 값은 `$.state`(세션 동안)나 `$.store`(세션 사이)에 둡니다. 다만 작업 로그처럼 세션 사이에 쌓이는 큰 데이터는 `$.store`의 전체 용량(4 MiB)을 넘을 수 있으므로, 데이터 폴더의 파일(`sessions/`, README "로그 보관")에 둡니다. `$.state`에 키를 추가하면 `types/index.d.ts`의 `PluginState['pane-mod']`에도 선언합니다. 계약에 없는 키는 `validate`가 거부합니다.
- **설정(`userConfig`)을 추가하거나 바꿀 때**: `plugin.json`, `register`의 `options` 처리, README의 "설정" 표, INSTALL.md 2장의 묶음별 표와 항목 수(지금은 "스물여덟 항목"), 이 문서의 "설치를 요청받았을 때" 4단계 표와 "설정 변경을 요청받았을 때" 1단계 표를 함께 고칩니다. 새 항목은 노출할 항목, 스프라이트와 소리, 알림 중 알맞은 묶음에 넣습니다.
- **버전을 올릴 때**: `plugin.json`의 `version`, INSTALL.md의 버전 표기(4장의 출력 예시, 8장의 안내 문구), 이 문서의 버전 표기(구조 트리, "설치를 요청받았을 때" 1단계)를 함께 고칩니다.
- **동작이나 외부 접근이 바뀔 때**: README에서 해당하는 절(레이아웃, 알림, 스프라이트 동작, 표시 항목과 출처, 이 mod가 컴퓨터에서 하는 일)을 고칩니다.
- **사용자 설정 파일**: mod와 에이전트 모두 `~/.claude/settings.json`을 고치지 않습니다. statusLine 정리는 사용자가 동의했을 때만 진행합니다(INSTALL.md 5장).
- **설치를 요청받았을 때**: 이 문서의 "설치를 요청받았을 때" 절차를 따릅니다. INSTALL.md 8장은 같은 규칙을 사람이 읽기 쉽게 요약한 것이므로, 절차를 바꾸면 두 곳을 함께 고칩니다.
