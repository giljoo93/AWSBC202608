# 파일 설명문 — frontend/

각 파일이 무엇을 하고, 언제 손대야 하고, 무엇에 의존하는지.
실행 방법과 전체 개요는 [`README.md`](README.md).

---

## 의존 관계

화살표는 "가져다 쓴다"는 뜻이다. 순환 참조 없음.

```
data.js ──┬──> narrative.js ──┐
          │                   ├──> render.js ──> app.js
          ├──> sprites.js ────┘                    ▲
          └──> api.js ───────────────────────────-─┘
```

설계 원칙 하나만 지키면 된다:

- **`app.js`** 는 언제 무엇을 할지만 안다 (상태 머신)
- **`api.js`** 는 데이터가 어디서 오는지만 안다 (목 / 실서버)
- **`render.js`** 는 화면에 어떻게 그릴지만 안다 (DOM 전담)

세 파일은 서로의 사정을 모른다. 그래서 백엔드를 붙일 때 `api.js` 한 줄만 바꾸면 된다.

---

## 진입점

### `index.html` — 66줄

마크업 뼈대만 있고 로직은 없다. 비어 있는 컨테이너들을 순서대로 쌓아둔 것이 전부다.

| 요소 | 역할 |
|---|---|
| `#bg-a` `#bg-b` | 배경 2겹. 번갈아 쓰며 크로스페이드 |
| `#stage` | 등장인물 입상이 서는 무대 |
| `.bg-grain` `.bg-veil` `.bg-vignette` | 질감 · 가독성 어둠 · 비네트 (고정 장식) |
| `#hud` | 상단 — 장 제목 · 진행도 점 · 기록 버튼 |
| `#log` | 본문이 쌓이는 영역 |
| `#controls` | 하단 — 선택지 버튼 / 질문 입력창 |
| `#curtain` | 장 전환 암전 |
| `#judging` | 판정 연출 오버레이 |
| `#backlog` | 지난 기록 패널 |

**손댈 때**: 새 화면 영역을 추가할 때만. 내용 변경은 `render.js` 쪽이다.
id 를 바꾸면 `render.js` 의 `el` 객체도 같이 고쳐야 한다.

### `js/app.js` — 140줄 · 상태 머신

게임의 흐름을 담당한다. DOM 도 fetch 도 직접 하지 않는다.

```
idle ──[시작]──> playing ──×8──> judging ──> result ──> qa
                    └─ 에러 ──> 재시작 안내
```

| 함수 | 언제 |
|---|---|
| `titleScreen()` | 최초 진입 · 재시작 |
| `begin()` | 시작 버튼 |
| `enterScene(d)` | 분기 하나를 화면에 올린다 (암전 → 장 제목 → 본문 → 선택지) |
| `pick(choice)` | 선택지 클릭 |
| `finish(d)` | 8번째 선택 후 결과 화면 |
| `fail(err)` | 모든 에러 경로 |

진행 중 새로고침을 막는 `beforeunload` 도 여기 있다 — 세션이 서버 메모리에만 있어서
새로고침하면 8분기가 날아가기 때문이다.

**손댈 때**: 화면 흐름 자체가 바뀔 때.

---

## 데이터

### `js/api.js` — 177줄 · 데이터 계층

화면이 데이터를 얻는 **유일한 통로**. 목과 실서버가 **같은 응답 폼**을 돌려준다.

```js
export const USE_MOCK = true;   // ← false 로 바꾸면 실서버
```

| 내보내는 것 | 설명 |
|---|---|
| `startGame()` | `POST /api/game/start` 와 같은 폼 |
| `sendChoice(id, key)` | `POST /api/game/choice` 와 같은 폼 |
| `askQuestion(id, q)` | `POST /api/chat` 과 같은 폼 |
| `backgroundForStep(n)` | 서버가 `background` 를 안 줄 때의 폴백 |
| `TOTAL` `TITLE` `TITLE_BG` `SCENE_META` | 화면이 쓰는 상수 |

목 모드에서는 브라우저 안에서 점수 누적과 MBTI 판정까지 한다 —
규칙은 백엔드 `engine.py` 와 같다 (일상 1점 / 전투 2점, 축 합 3점이라 동점 불가).
`think()` 로 0.7~1.6초 지연을 넣는 것은 **로딩 UI 를 실제 조건에서 확인하기 위해서**다.

**손댈 때**: 백엔드 연결(`USE_MOCK`), 엔드포인트 주소 변경.

### `js/data.js` — 532줄 · **자동 생성, 직접 수정 금지**

`finalplan/gen-frontend-data.py` 가 만든다. 원본은 백엔드의 JSON 두 개다.

```
data/storyboard.json  +  data/mbti_kb.json
              ↓  gen-frontend-data.py
          js/data.js
```

스토리가 바뀌면 생성기를 다시 돌린다. 담고 있는 것:

- 프롤로그 · 8장면 · 에필로그 원문과 선택지
- 장면별 배경 팔레트 3색 + 장 제목 (`bg`)
- 등장인물 정의 (`cast`) — 이미지 키 · 강조색 · 실루엣 모양 · 서는 쪽
- MBTI 지식베이스 (`kb`) — 결과지와 Q&A 목 응답에 쓰인다

실서버를 붙이면 스토리 부분은 서버 응답이 대신하고, `bg` 와 `kb` 만 계속 쓰인다.

---

## 렌더링

### `js/render.js` — 501줄 · DOM 전담

데이터가 목에서 왔는지 서버에서 왔는지 **알지 못한다.** 그래서 백엔드를 붙여도 안 바뀐다.

| 묶음 | 함수 |
|---|---|
| 배경 | `setBackground(bg)` — 2겹 크로스페이드 |
| 입상 | `showSpeaker(name)` `dimStage()` `clearStage()` |
| 전환 | `chapterTransition(step, total, title, bg)` — 암전 → 장 제목 |
| 본문 | `scene(text)` `narrationBlock()` `dialogueBlock()` `playerLine()` `systemLine()` `typing()` |
| HUD | `showHud()` `setChapter()` `progress()` |
| 컨트롤 | `choices()` `titleButton()` `chatInput()` |
| 그 외 | `mbtiCard()` `judging()` `initBacklog()` |

두 가지가 여기 숨어 있다:

**이미지 자동 감지** — `probe()` 가 실행 중에 파일 존재를 확인한다.
있으면 이미지, 없으면 CSS 그라디언트 / SVG 실루엣. **코드 수정 없이 한 장씩 교체 가능.**

**백로그** — `history` 배열이 모든 서술·대사·선택을 쌓는다.
장이 넘어갈 때 `#log` 를 비우지만 기록은 여기 남는다.

### `js/narrative.js` — 85줄 · 서술/대사 파서

비주얼 노벨의 **ADV / NVL** 구분을 텍스트에서 끌어낸다.

| | NVL (서술) | ADV (대사) |
|---|---|---|
| 화자 | 없음 | 명찰로 표시 |
| 판별 | 그 외 전부 | 큰따옴표로 묶인 부분 |

스토리 원문에 화자 메타데이터가 없어서 **큰따옴표 + 이름 목록**으로 추론한다.
까다로운 두 경우를 처리한다:

- `궁정 마법사` 가 `마법사` 에 지지 않게 — 끝 위치가 같으면 긴 이름을 택한다
- `레온은 "…하자"고 제안한다` — 따옴표 뒤에 조사가 붙으면 **간접인용**이므로
  대사로 떼지 않고 서술 안에 인라인으로 남긴다

현재 스토리 기준 대사 5개 전부 화자 판별 성공, 미상 0개.

**손댈 때**: 새 등장인물 추가 (실제로는 `gen-frontend-data.py` 의 `CAST` 에 넣으면 된다).

### `js/sprites.js` — 77줄 · 인물 실루엣

`assets/cast/<key>.webp` 가 없을 때 쓰는 **대역**. 200×340 흉상 SVG 를 만든다.
몸통·머리는 공통이고 머리 장식만 인물마다 다르다 (모자 · 투구 · 후드 · 헝클어진 머리 · 수염 · 뿔).

얼굴을 그리지 않는 역광 실루엣이라, 실제 일러스트로 바뀌어도 톤이 이어진다.

### `css/style.css` — 794줄

| 구역 | 내용 |
|---|---|
| `:root` | 색 · 글꼴 · 레이아웃 토큰. **여기만 바꿔도 전체 톤이 바뀐다** |
| 배경 | `.bg-layer` `.bg-grain` `.bg-veil` `.bg-vignette` `.curtain` |
| 입상 | `.stage` `.sprite` — 말하는 인물은 밝게, 아니면 어둡게 |
| HUD | `.hud` `.dot` — 전투 분기는 마름모 |
| 본문 | `.block.nvl` `.block.adv` `.plate` `.block.me` `.block.system` |
| 전환 | `.chapter-card` |
| 컨트롤 | `.choice` `.primary` `.chatbox` |
| 결과 | `.card` `.axis-bar` |
| 백로그 | `.backlog` |

글꼴은 Google Fonts — 서술·대사에 **고운바탕(명조)**, UI 에 **고운돋움**.
`prefers-reduced-motion` 을 존중해 모든 연출을 끌 수 있다.

---

## 에셋

### `assets/ART-DIRECTION.md`

배경 10장 + 인물 6명을 **한 사람이 그린 것처럼** 만들기 위한 규격서.
팔레트 곡선 · 구도 규칙 · 파일 규격 · 검수 체크리스트.

이미지는 Bedrock `stable-image-control-sketch` 에 **구도 스케치를 코드로 그려 넣어** 만들었고,
이미 생성이 끝나 `assets/` 에 들어 있다. 별도 실행 없이 그대로 쓰면 된다.

> ⚠️ 생성 스크립트는 **의도적으로 저장소에 넣지 않았다** — 호출 1건마다 AWS 요금이
> 발생하는 코드라(장당 $0.07) 모르고 실행하는 사고를 막기 위해서다.
> 다시 만들어야 하면 `ART-DIRECTION.md` 7절을 보고 계정 소유자와 합의한 뒤 진행할 것.

### `assets/bg/` — 배경 10장 (800KB)

`summon` `plaza` `forest-fork` `goblin-ambush` `captive`
`bridge-troll` `castle-gate` `grand-hall` `demon-lord` `dawn`

파일명은 `data.js` 의 `bg.key` 와 정확히 일치해야 한다.

### `assets/cast/` — 인물 6명 (552KB, 알파 채널)

`mage` `leon` `sien` `bandit` `elder` `demon`
(`elder` `demon` 은 아직 대사가 없어 화면에 나오지 않는다 — 스토리에 대사를 넣으면 바로 등장)

---

## 도구

### `test/playthrough.mjs` — 156줄

브라우저 없이 jsdom 으로 **8분기를 실제로 클릭해 완주**한다.

```bash
py ../../finalplan/build-single-file.py   # dist/index.html 생성
cd test && npm install && npm test
```

검증: 타이틀 → 8분기 → 장 제목 → 진행도 → 입상 등장 → 판정(`ABBAABBA` → ISFJ)
→ 축 승자와 판정 일치 → Q&A 왕복 → 백로그 누적.

### `../../finalplan/gen-frontend-data.py`

`js/data.js` 생성기. 스토리·등장인물·팔레트가 바뀌면 여기를 고치고 다시 돌린다.

### `../../finalplan/build-single-file.py`

`dist/index.html` (완전한 단일 파일) 과 `dist/artifact.html` (본문만) 을 만든다.
ES 모듈을 IIFE 로 감싸 이름 충돌을 막고, 이미지를 data URI 로 인라인한다.

> 배포는 **분리된 파일 그대로** S3 에 올리는 쪽이 맞다 — 파일별로 캐시 정책을 나눌 수 있기 때문.
> 단일 파일은 공유·테스트용이다.

### `index.legacy.html`

이전 단일 파일 참고 구현. 보존용이며 **배포 대상이 아니다.**

---

## 자주 하는 작업

| 하려는 것 | 고칠 파일 |
|---|---|
| 색·글꼴·여백 바꾸기 | `css/style.css` 의 `:root` |
| 문구 바꾸기 | `js/app.js` (타이틀·시스템 메시지) |
| 스토리 바꾸기 | 백엔드 `data/storyboard.json` → 생성기 재실행 |
| 등장인물 추가 | `gen-frontend-data.py` 의 `CAST` → 생성기 재실행 |
| 백엔드 연결 | `js/api.js` 의 `USE_MOCK = false` |
| 이미지 교체 | `assets/bg/` `assets/cast/` 에 같은 이름으로 덮어쓰기 (코드 수정 불필요) |
| 화면 흐름 변경 | `js/app.js` |
| 새 화면 요소 | `index.html` + `css/style.css` + `js/render.js` |
