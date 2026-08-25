# T05 — FastAPI 서버

선행: T02, T03, T04

## 목표

엔진+RAG+LLM을 묶는 HTTP API. 게임 상태는 전부 서버 메모리.

## 산출물

- `server.py`
- `requirements.txt` (fastapi, uvicorn, boto3, pydantic — 이상 4개, 추가 금지)

## 엔드포인트

| 메서드 | 경로 | 동작 |
|---|---|---|
| POST | `/api/game/start` | 세션 생성 → 프롤로그+분기1 연출 반환 `{session_id, narration, choices}` |
| POST | `/api/game/choice` | `{session_id, choice}` → 점수 적용 → 다음 장면 연출. 8번째면 판정+결과지 반환 `{done: true, mbti, report, scores}` |
| POST | `/api/chat` | `{session_id, question}` → 판정 MBTI 기반 Q&A. 판정 전이면 400 |
| GET | `/health` | 배포 확인용 |

## 작업 내용

1. CORS: CloudFront 도메인 허용 (개발 중 `*`, 배포 시 축소)
2. 검증: 존재하지 않는 session/choice, 종료된 게임 재선택 → 4xx + 명확한 메시지
3. 점수는 응답에 노출하되 게임 중에는 숨김 (choices 응답에 scores 미포함, done 시에만)

## 완료 기준

- [x] 로컬 stub으로 start→choice×8→chat 전 구간 완주 — test_game.py TestClient 통과
- [ ] 결과지에 history reason 인용 확인 (실 Bedrock 1회) — EC2 배포 시 (T07에서 수행)
