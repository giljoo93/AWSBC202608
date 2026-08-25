# 차원문 너머 — MBTI 분기 게임

이세계 판타지 스토리의 4개 분기 선택으로 MBTI를 판정하는 챗봇형 게임.
설계 문서: `../finalplan/ROADMAP.md` + `tasks/T01~T08`.

점수·판정은 코드(`engine.py`)가, 연출·결과지·Q&A는 LLM(Bedrock)이 담당.
LLM 출력은 점수에 영향을 주지 못한다.

## 로컬 실행 (AWS 불필요 — stub 모드)

```
py -m pip install -r requirements.txt
py test_game.py                       # 엔진+서버 자체 점검
py -m uvicorn server:app --port 8000  # → http://localhost:8000 브라우저 플레이
```

## 파일 구조

| 파일 | 역할 |
|---|---|
| `data/storyboard.json` | 스토리 + 4분기 + 점수 근거표 (코드 수정 없이 분기 추가 가능) |
| `data/mbti_kb.json` | MBTI 지식베이스 (16타입/8속성/4축) |
| `schemas.py` | pydantic 모델 |
| `engine.py` | 점수 엔진 + 인메모리 세션 |
| `rag.py` | 로컬 청크 검색 (장면/MBTI) |
| `llm.py` | Bedrock 클라이언트 — `GAME_LLM=stub\|bedrock` |
| `server.py` | FastAPI (start/choice/chat/health) |
| `API.md` | **프론트 팀원용 JSON 계약서** — 요청/응답 폼 전부 |
| `frontend/index.html` | 챗 UI 참고 구현 (API.md 계약대로 동작) — S3 업로드 대상 |
| `deploy/` | EC2 스크립트 + systemd + 콘솔 체크리스트 |

## 배포

`deploy/README.md` 체크리스트 순서대로 (IAM → Bedrock → EC2 → S3 → CloudFront).
환경 변수는 `deploy/gamesvc.service`에서 관리 — `GAME_BEDROCK_MODEL`만 교체하면 됨.
