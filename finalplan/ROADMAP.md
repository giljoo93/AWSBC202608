# MBTI 분기 게임 — 전체 로드맵

챗봇형 텍스트 게임. 플레이어가 이세계 판타지 스토리를 진행하며 8개 분기점(일상 4 +
전투 4)에서 선택을 하고, 서버는 선택마다 MBTI 8속성 점수를 근거와 함께 누적한다. 게임 종료 시 점수로
MBTI를 판정하고, LLM이 결과지를 생성하며, 이후 플레이어는 자기 MBTI에 대해 LLM에
자유 질문할 수 있다.

## 확정된 설계 결정 (2026-08-25)

| 항목 | 결정 |
|---|---|
| 코드 | 완전 신규 (기존 ai-text-game은 참고만) |
| 테마 | 이세계 판타지 모험 (용사 소환 서사) |
| 분기 수 | 8개 — 축당 2회: 일상 분기(1점) + 전투 분기(2점). 유저 요청 이력: 12 → 4(가독성) → 8(정확도·전투 요소 추가). 축 합계 3점이라 동점 불가 |
| RAG | EC2 로컬 검색 — storyboard/MBTI 지식 JSON을 코드로 청크 검색 후 프롬프트 주입 |
| 세션 점수 | EC2 서버 프로세스 메모리 (dict). DB 없음 |
| LLM | Bedrock (Claude) — 내레이션 연출, 결과지 생성, MBTI Q&A |
| 프론트 | S3 정적 웹 + CloudFront 배포, 챗 UI |

## 아키텍처

```
[플레이어 브라우저]
      │ HTTPS
[CloudFront] ── [S3 버킷: 정적 챗 UI (index.html + js)]
      │ /api/* → EC2 (CORS 또는 CloudFront 오리진 라우팅)
[EC2: FastAPI 백엔드]
      ├─ sessions: { session_id: {scores: {E,I,S,N,T,F,J,P}, history[], step} }  ← 인메모리
      ├─ engine: 분기 진행 + 점수 적용 + MBTI 판정
      ├─ rag: data/storyboard.json + data/mbti_kb.json 로컬 청크 검색
      └─ llm: Bedrock InvokeModel (IAM role, 자격증명 코드 없음)
```

## 핵심 데이터 모델

```python
# 세션당 1개, 서버 메모리 상주
scores = {"E": 0, "I": 0, "S": 0, "N": 0, "T": 0, "F": 0, "J": 0, "P": 0}
history = [  # 결과지 근거 자료
    {"branch": 1, "axis": "EI", "choice": "A", "attr": "E",
     "reason": "소환 직후 낯선 주민들에게 먼저 다가가 말을 걸었다"},
]
```

- 선택 1회 = 해당 속성에 +1(일상) 또는 +2(전투), 근거 문장 기록. 점수 규칙은
  storyboard.json에 정적 정의 (LLM이 점수를 매기지 않음 — 정당성은 데이터에, 연출은 모델에).
- 전투 가중치 근거: 고압·위기 상황의 선택이 평온한 상황보다 본성을 더 강하게 드러낸다.
- 판정: 축별 합산 비교 `E>I → E` 등 4글자 조합. 축 합계 3점(1+2)이라 동점 없음.

## 게임 플로우

```
POST /api/game/start          → session_id + 프롤로그 + 분기1 (LLM 연출)
POST /api/game/choice ×8      → 점수 적용 → 다음 장면+분기 (RAG 청크 + LLM 연출)
(8번째 선택 후 자동)           → MBTI 판정 → LLM 결과지 (history 근거 인용)
POST /api/chat                → 판정된 MBTI + mbti_kb RAG 기반 자유 Q&A
```

## Phase 및 Task

| Phase | Task | 내용 | 선행 |
|---|---|---|---|
| **0. 설계** | [T01](tasks/T01-story-branches.md) | 스토리 + 8분기(일상4+전투4) + 점수 근거표 (storyboard.json) | — |
| | [T02](tasks/T02-schemas-engine.md) | 스키마 + MBTI 점수 엔진 + 세션 메모리 | T01 |
| **1. 백엔드** | [T03](tasks/T03-rag.md) | MBTI 지식베이스 + 로컬 RAG 검색 | T01 |
| | [T04](tasks/T04-bedrock-client.md) | Bedrock LLM 클라이언트 + 프롬프트 | — |
| | [T05](tasks/T05-fastapi-server.md) | FastAPI 서버 (start/choice/result/chat) | T02~T04 |
| **2. 프론트** | [T06](tasks/T06-frontend.md) | 정적 챗 UI (S3 배포용) | T05 |
| **3. 배포** | [T07](tasks/T07-deploy-aws.md) | EC2 + S3 + CloudFront + IAM | T05, T06 |
| **4. 검증** | [T08](tasks/T08-playtest.md) | 플레이테스트 + 점수 밸런스 | T07 |

## 역할 분담

- **유저 (바이브코더)**: 점수 근거표 검수(T01), 플레이테스트(T08), AWS 콘솔 작업(T07 — 학습 목적 직접 수행)
- **Claude**: 스토리 초안, 전체 코드, 프롬프트, 배포 스크립트 초안

## 원칙

- 점수는 코드가, 서사는 모델이. LLM 출력이 점수에 영향을 주지 않는다.
- 서버 재시작 시 세션 소멸 허용 (인메모리 설계의 의도된 한계 — 부트캠프 범위).
- T05 로컬 완주(12분기 → 결과지) 전 배포 작업 금지.
