# API 계약서 — 프론트엔드 팀원용

백엔드와 프론트는 **JSON으로만** 통신한다. 이 문서의 폼이 유일한 계약이며,
`frontend/index.html`은 이 계약대로 만든 참고 구현이다 (그대로 써도, 새로 만들어도 됨).

## 전체 데이터 흐름

```
[프론트] --JSON 요청--> [백엔드 EC2/FastAPI] --JSON 요청--> [Bedrock Converse API]
[프론트] <--JSON 응답-- [백엔드]             <--JSON 응답-- [Bedrock]
```

- 프론트는 Bedrock을 직접 호출하지 않는다. 항상 백엔드 경유.
- `Content-Type: application/json`. 모든 POST 바디는 JSON.
- 게임 진행 순서: `start` 1회 → `choice` 8회 → (8번째 응답이 결과) → `chat` 자유 횟수.

---

## 1. POST `/api/game/start` — 게임 시작

요청 바디: `{}` (빈 JSON)

응답 200:
```json
{
  "session_id": "f3a1c9…",
  "step": 1,
  "total": 8,
  "narration": "기말고사를 앞둔 평범한 대학생인 당신…",
  "choices": [
    { "key": "A", "label": "주민들에게 먼저 다가가 말을 건다" },
    { "key": "B", "label": "한발 물러나 조용히 상황을 관찰한다" }
  ]
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| session_id | string | 이후 모든 요청에 그대로 전달. 서버 메모리 키 — 새로고침하면 잃어버리므로 JS 변수로 유지 |
| step | int | 현재 분기 번호 (1부터) |
| total | int | 전체 분기 수 (8). `step / total`로 진행도 렌더링 |
| narration | string | 내레이션 본문. 개행(`\n`) 포함 가능 — `white-space: pre-wrap` 권장 |
| choices | array | 항상 2개. `key`를 버튼 값으로, `label`을 버튼 문구로 렌더링 |

## 2. POST `/api/game/choice` — 선택 제출 (×8)

요청 바디:
```json
{ "session_id": "f3a1c9…", "choice": "A" }
```
`choice`는 직전 응답 `choices[].key` 중 하나 ("A" 또는 "B").

응답 200 — 진행 중 (`done: false`):
```json
{
  "done": false,
  "step": 2,
  "total": 8,
  "narration": "왕궁에서 지도와 침공 보고를 받은 당신은…",
  "choices": [
    { "key": "A", "label": "…" },
    { "key": "B", "label": "…" }
  ]
}
```

응답 200 — 8번째 선택, 게임 종료 (`done: true`):
```json
{
  "done": true,
  "epilogue": "당신의 선택대로 나아간 끝에…",
  "mbti": "ISFJ",
  "scores": { "E": 1, "I": 2, "S": 3, "N": 0, "T": 1, "F": 2, "J": 3, "P": 0 },
  "report": "당신의 MBTI는 ISFJ입니다. …"
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| done | bool | **렌더링 분기 기준.** false면 narration+choices, true면 결과 화면 |
| epilogue | string | 엔딩 내레이션 |
| mbti | string | 판정 결과 4글자 |
| scores | object | 8속성 정수. 축 쌍 (E,I) (S,N) (T,F) (J,P) — 쌍 합은 항상 3. 게이지 바: `E/(E+I)*100%` |
| report | string | LLM 생성 결과지 (근거 인용 포함, 개행 있음) |

`done: true` 이후부터 `/api/chat` 사용 가능. 프론트는 이 시점에 질문 입력창 활성화.

## 3. POST `/api/chat` — 결과 Q&A

요청 바디:
```json
{ "session_id": "f3a1c9…", "question": "INTJ랑 잘 맞아?" }
```

응답 200:
```json
{ "answer": "ISFJ인 당신은…" }
```

## 4. GET `/health` — 상태 확인

응답 200: `{ "ok": true, "llm": "bedrock" }`

---

## 에러 폼 (모든 엔드포인트 공통)

상태코드 4xx + 바디:
```json
{ "detail": "세션이 없습니다. 게임을 다시 시작해주세요." }
```

| 상황 | 코드 | detail |
|---|---|---|
| 없는/만료된 session_id | 400 | 세션이 없습니다. 게임을 다시 시작해주세요. |
| 잘못된 choice 값 | 400 | 잘못된 선택지입니다: X |
| 종료된 게임에 choice | 400 | 이미 종료된 게임입니다. |
| 게임 완료 전 chat | 400 | 게임을 먼저 완료해주세요. |
| 요청 바디 형식 오류 | 422 | (FastAPI 자동 검증 메시지) |

프론트 처리: `res.ok` false면 `detail`을 사용자에게 표시하고 재시작 유도.
서버 재시작 시 세션 소멸(인메모리) — "다시 시작" 흐름은 필수.

---

## 참고: 백엔드 ↔ Bedrock JSON (프론트는 몰라도 됨)

백엔드가 Bedrock Converse API에 보내는 요청 JSON:
```json
{
  "modelId": "<GAME_BEDROCK_MODEL>",
  "system": [{ "text": "너는 이세계 판타지 텍스트 게임의 게임 마스터다…" }],
  "messages": [{ "role": "user", "content": [{ "text": "장면 자료:\n…" }] }],
  "inferenceConfig": { "maxTokens": 1024, "temperature": 0.7 }
}
```

Bedrock 응답 JSON에서 백엔드가 추출하는 경로:
```json
{ "output": { "message": { "content": [{ "text": "생성된 내레이션…" }] } } }
```
→ `output.message.content[0].text`만 꺼내 위 응답 폼의 `narration`/`report`/`answer`에 넣는다.
점수·판정(`scores`, `mbti`)은 Bedrock 응답과 무관하게 백엔드 코드가 계산한다.
