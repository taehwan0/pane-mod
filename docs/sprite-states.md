# 스프라이트 상태 후보

pane-mod가 구분할 수 있는 Claude Code 상태와, 상태별로 필요한 스프라이트를 정리한 문서입니다. 지금 코드가 쓰는 동작은 `idle`, `working`, `complete` 세 가지이며, 나머지는 앞으로 추가할 수 있는 후보입니다. 스프라이트를 준비하거나 새 동작을 추가할 때 "필요한 스프라이트 목록"과 "스프라이트 제작 규격"을 참고합니다.

근거는 Claude Code 2.1.292의 mod 타입 선언(`claude-code.d.ts`)과 공식 hooks 문서(<https://code.claude.com/docs/en/hooks>)입니다. 실제 세션에서 확인하지 않은 신호는 "확인 필요"로 표시했습니다.

## 현재 사용 중인 상태

| 상태 | 스프라이트 | 신호 | 비고 |
|---|---|---|---|
| 턴 사이 | `idle` (반복) | `turn.complete` 이후 | 기본 상태입니다. |
| 작업 중 | `working` (반복) | `turn.start` → `turn.complete` (진행 중인 턴 id로 추적) | 턴 안의 세부 단계를 구분하지 않습니다. 모델 턴을 열지 않는 단발 명령(`/effort` 등)에서는 idle을 유지합니다. |
| 턴 완료 | `complete` (1회) | `turn.complete`의 `reason: 'answer'` | **꺼져 있습니다.** `IS_CHEERING`으로 다시 켤 수 있습니다. |

## 추가 후보 상태

### 1. 작업 중 세부 단계 (working을 나누는 후보)

| 후보 | 신호 | 진입 | 해제 | 신뢰도 |
|---|---|---|---|---|
| `think` | `Spinner.mode === 'thinking'` | Spinner 렌더에서 mode가 바뀔 때 | 다른 mode로 바뀔 때 | 엔진 고유 이벤트 |
| `respond` | `Spinner.mode === 'responding'` | 같음 | 같음 | 엔진 고유 이벤트 |
| `request` | `Spinner.mode === 'requesting'` | 같음 | 같음 | 엔진 고유 이벤트 |
| `search` | `tool.call`의 `tool`이 Read, Grep, Glob, WebSearch, WebFetch | 도구 호출 시 | 다음 mode 변경 또는 다음 도구 호출 | 엔진 고유 이벤트 |
| `edit` | `tool.call`의 `tool`이 Edit, Write, NotebookEdit | 같음 | 같음 | 엔진 고유 이벤트 |
| `run` | `tool.call`의 `tool`이 Bash | 같음 | 같음 | 엔진 고유 이벤트 |
| `delegate` | `tool.call`의 `tool`이 Agent, 또는 `agent.spawn` | 같음 | 같음 | 엔진 고유 이벤트 |

- `Spinner.mode`에는 `tool-input`(도구 인자 생성)과 `tool-use`(도구 실행)도 있습니다. `tool-use`는 위의 도구별 후보로 나누는 편이 더 구체적입니다.
- 세부 단계는 짧게는 1초 안에 바뀝니다. 스프라이트가 너무 자주 바뀌어 보이면, 한 동작을 최소 몇 프레임은 유지하는 규칙이 필요합니다.

### 2. 사용자 응답을 기다리는 상태

| 후보 | 신호 | 진입 | 해제 | 신뢰도 |
|---|---|---|---|---|
| `ask` | `classic.Notification`의 `notification_type: 'permission_prompt'` | 알림 수신 | 다음 `tool.call`, `turn.complete`, `prompt.submit` 중 먼저 오는 것 | 확인 필요 |
| `ask` | `ui.render { component: 'AskUserQuestion' }` | 질문 대화상자 렌더 | 같음 | 엔진 고유 이벤트 |
| `ask` | `notification_type`: `elicitation_dialog`, `elicitation_url_dialog` | 알림 수신 | 같음 | 확인 필요 |
| `ask` (서브에이전트) | `notification_type: 'agent_needs_input'` | 알림 수신 | 해당 에이전트의 상태 변화 | 확인 필요 |

- 사용자가 무언가 해야 하는 상태이므로 **우선순위가 가장 높아야 합니다.**
- `classic.PermissionRequest`는 대화상자를 띄우기 전, 권한을 판단하는 단계에서 발생합니다. 그래서 "승인 대기" 표시에는 `permission_prompt` 알림이 더 정확합니다.
- 해제 신호는 추정입니다. 승인한 뒤 `tool.call`이 다시 발생하는지는 실제 세션에서 확인해야 합니다.

### 3. 입력 중

| 후보 | 신호 | 진입 | 해제 | 신뢰도 |
|---|---|---|---|---|
| `listen` | `PromptHint.isDraft` | 입력창에 글자가 생길 때 | 입력창이 비거나 프롬프트를 보낼 때 | 엔진 고유 이벤트 |

- idle일 때만 적용하는 것을 권장합니다. 작업 중에 다음 프롬프트를 미리 입력하는 경우에는 working을 유지하는 편이 자연스럽습니다.

### 4. 턴이 끝난 결과

| 후보 | 신호 | 표시 방식 | 신뢰도 |
|---|---|---|---|
| `complete` | `reason: 'answer'` | 한 번 재생하고 몇 초 뒤 idle | 엔진 고유 이벤트 (현재 꺼짐) |
| `error` | `reason: 'error'`, `classic.StopFailure` | 몇 초 표시한 뒤 idle | `reason`은 엔진 고유, `StopFailure`는 확인 필요 |
| `stop` | `reason: 'aborted'` (사용자가 중단) | 짧게 표시한 뒤 idle, 또는 바로 idle | 엔진 고유 이벤트 |
| `refuse` | `reason: 'refusal'` | error와 같이 처리해도 됩니다. | 엔진 고유 이벤트 |

`classic.StopFailure`는 오류 종류를 알려 줍니다(`rate_limit`, `overloaded`, `authentication_failed`, `billing_error`, `server_error`, `max_output_tokens` 등). 오류 종류마다 다른 스프라이트를 쓸 수도 있지만, 처음에는 `error` 하나로 충분합니다.

### 5. 세션 이벤트

| 후보 | 신호 | 진입 | 해제 | 신뢰도 |
|---|---|---|---|---|
| `compact` | `session.compact` hook (`next(e)` 호출 전과 후) | `next` 호출 전 | `next`가 끝난 뒤 | 엔진 고유 이벤트 |
| `tired` | `usage().rateLimits`의 `five_hour`가 90% 이상 | 갱신 주기(2초)마다 판단 | 90% 미만 | 엔진 고유 이벤트 |
| `switch` | `classic.PostModelSwitch` | 알림 수신 | 몇 초 뒤 | 확인 필요 |

- `session.compact`는 서브에이전트 자신의 압축에도 발생합니다. `agentId`가 없는 것만 처리해야 합니다.
- `tired`는 상태라기보다 경고에 가깝습니다. idle과 working 대신 쓰기보다는, 같은 동작에 다른 색이나 표시를 덧붙이는 방법도 있습니다.

### 6. 서브에이전트

| 후보 | 신호 | 비고 |
|---|---|---|
| `team` | `$.agent.list()`에 `running` 상태가 2개 이상 | 메인 스프라이트를 바꾸기보다 목록 행에 작은 표시를 붙이는 편이 나을 수 있습니다. |

서브에이전트 상태(`pending`, `running`, `waiting`, `idle`, `completed`, `failed`, `killed`)는 지금 목록 행의 기호로 표시하고 있습니다.

## 여러 상태가 겹칠 때의 우선순위 (제안)

```
ask > error·stop (몇 초) > compact > 세부 작업(think·search·edit·run·delegate·respond) > working > listen > idle
```

예를 들어 작업 중에 권한 대화상자가 뜨면 `ask`를 보여 주고, 승인 뒤에는 원래의 작업 단계로 돌아갑니다.

## 필요한 스프라이트 목록

| 우선순위 | 스프라이트 | 쓰이는 상태 | 재생 | 코드 지원 |
|---|---|---|---|---|
| 필수 | `idle` | 턴 사이 | 반복 | 있음 |
| 필수 | `working` | 작업 중(세부 단계가 없을 때의 기본값) | 반복 | 있음 |
| 높음 | `ask` | 권한 승인, 질문, MCP 입력 요청 | 반복 | 없음 |
| 높음 | `error` | API 오류, 거절 | 1회 후 유지 | 없음 |
| 중간 | `think` | thinking | 반복 | 없음 |
| 중간 | `listen` | 입력 중 | 반복 | 없음 |
| 중간 | `compact` | 대화 압축 | 반복 | 없음 |
| 선택 | `complete` | 턴 완료 | 1회 후 유지 | 있음(꺼짐) |
| 선택 | `stop` | 사용자 중단 | 1회 후 유지 | 없음 |
| 선택 | `search` / `edit` / `run` / `delegate` | 도구별 작업 | 반복 | 없음 |
| 선택 | `respond` | 답변 출력 | 반복 | 없음 |
| 선택 | `tired` | 5시간 한도 90% 이상 | 반복 | 없음 |

## 스프라이트 제작 규격

아래 규격으로 만들면 크기와 위치가 흔들리지 않는 스프라이트를 설정만으로 연결할 수 있습니다.

- **원본**: 투명 배경의 RGBA PNG 프레임입니다. GIF나 동영상이라면 먼저 프레임별 PNG로 풉니다.
- **기준 영역**: 모든 동작의 원본에 같은 경계 상자를 정하고, 그 상자로 잘라 냅니다. 캐릭터의 불투명 영역이 모든 프레임에서 이 상자 안에 들어와야 동작이 바뀌어도 크기와 위치가 일정합니다. 스프라이트 칸은 band에서 10×5칸, pane에서 12×6칸이고 터미널 칸의 가로세로 비율이 약 1:2이므로, 상자는 정사각형에 가깝게 잡습니다.
- **크기**: 220×218 PNG를 권장합니다. 더 큰 그림도 그려지지만, 프레임마다 보내는 데이터가 늘어납니다.
- **재생 속도**: 12.5fps(80ms)를 권장합니다. 코드가 80ms 간격으로 프레임을 넘기므로, 다른 속도로 만든 프레임은 빠르거나 느리게 보입니다.
- **반복 여부**: "반복" 동작은 마지막 프레임이 첫 프레임으로 자연스럽게 이어져야 합니다. "1회 후 유지" 동작은 마지막 프레임이 정지 자세로 보기 좋아야 합니다.
- **변환**: 기준 영역으로 잘라 220×218로 줄인 뒤 `<spriteDir>/<상태>/frame_NNN.png`(001부터)에 둡니다. 저장소를 clone해서 쓴다면 플러그인 폴더의 `assets/<상태>/`에 두어도 되며, 이 폴더는 git에 커밋하지 않습니다(`.gitignore`의 `assets/`). 변환에는 다음과 같은 ffmpeg 명령을 쓸 수 있습니다. `W:H:X:Y`는 기준 영역의 폭, 높이, 왼쪽 위 좌표입니다.

  ```
  ffmpeg -i frame_001.png -vf "crop=W:H:X:Y,scale=220:218:flags=lanczos" -pix_fmt rgba -compression_level 9 <spriteDir>/<상태>/frame_001.png
  ```

  README의 "사례"에 나오는 스프라이트는 1280×720 원본에서 686×680 영역(`crop=686:680:297:0`)을 잘라 만들었습니다.

- **프레임 수**: 코드에 적지 않습니다. mod가 세션을 시작할 때 동작 폴더의 PNG 파일을 이름 순서로 읽고, 그 수만큼 재생합니다. 폴더에 프레임이 없는 동작은 `idle`의 프레임을 빌려 쓰고, 어느 폴더에도 프레임이 없으면 스프라이트를 생략합니다.
- **코드 연결**: 새 동작을 추가하려면 `hooks/format.ts`의 `Motion` 타입과 `MOTIONS` 표에 상태 이름과 반복 여부를 추가하고, `hooks/register.tsx`의 `findAssets`가 그 폴더도 읽게 합니다. 그다음 `hooks/register.tsx`에서 신호를 받아 `setMotion`을 호출하면 됩니다.
