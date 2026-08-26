# AWSBC202608 — 차원문 너머 (MBTI 분기 게임)

이세계 판타지 스토리의 8개 분기 선택으로 MBTI를 판정하는 챗봇형 게임.
S3+CloudFront(프론트) / EC2 FastAPI(백엔드) / Bedrock(LLM) 구성.

## 저장소 구조

| 경로 | 내용 |
|---|---|
| [`presentation/deck.html`](presentation/deck.html) | **최종 발표 슬라이드** (브라우저로 열기 — ←/→ 진행, F 전체화면) |
| [`finalplan/`](finalplan/ROADMAP.md) | 설계 문서 — 로드맵 + 태스크(T01~T08) |
| [`finalplan/T06-ui-draft.md`](finalplan/T06-ui-draft.md) | **UI 설계** — 화면 상태·레이아웃·컴포넌트 |
| [`mbti-game/frontend/`](mbti-game/frontend/README.md) | **웹 게임 프론트엔드** — 백엔드 없이 바로 플레이 가능 |
| [`mbti-game/frontend/FILES.md`](mbti-game/frontend/FILES.md) | 프론트 **파일별 설명문** |
| [`mbti-game/`](mbti-game/README.md) | 게임 전체 코드 (백엔드·프론트·데이터·배포) |
| [`mbti-game/API.md`](mbti-game/API.md) | **프론트 팀원용 JSON 계약서** — 요청/응답 폼 전부 여기에 |
| [`mbti-game/deploy/deploy-guide.html`](mbti-game/deploy/deploy-guide.html) | AWS 콘솔 배포 가이드 (비개발자용, 브라우저로 열기) |

## 빠른 시작

- 로컬 실행·테스트: `mbti-game/README.md`
- 프론트 개발: `mbti-game/frontend/README.md` — 백엔드 없이 바로 플레이 가능한 프로토타입
- JSON 계약: `mbti-game/API.md`
- AWS 배포: `mbti-game/deploy/deploy-guide.html` 순서대로
