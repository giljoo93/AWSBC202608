# T04 — Bedrock LLM 클라이언트 + 프롬프트

선행: 없음 (T01~T03과 병렬 가능)

## 목표

Bedrock 호출 1개 모듈 + 용도별 프롬프트 3종. LLM은 연출만, 점수·판정은 절대 안 함.

## 산출물

- `llm.py` — boto3 `bedrock-runtime` Converse API 래퍼 (자격증명 코드 없음, IAM role)
- 프롬프트 3종 (llm.py 내 상수)

## 프롬프트 3종

| 용도 | 입력 | 출력 |
|---|---|---|
| 장면 연출 | scene context(RAG) + 직전 선택 | 내레이션 3~5문장 + 선택지 2개 재진술. 선택지 문구·개수 변경 금지 |
| 결과지 | 판정 MBTI + history(reason 12개) + mbti_chunks | 타입 설명 + "당신은 ~에서 ~했다" 근거 인용 결과지 |
| Q&A | 판정 MBTI + 질문 + mbti_chunks | KB 근거로만 답변. 의학적/단정적 표현 금지 안내 포함 |

## 환경 변수

```
AWS_REGION=us-east-1
GAME_BEDROCK_MODEL=<콘솔에서 액세스 활성화한 모델 id>
```

## 완료 기준

- [x] 선택지는 LLM 출력이 아니라 storyboard에서 서버가 직접 반환 — 문구 변조 구조적으로 불가 (육안 확인 불필요해짐)
- [x] `GAME_LLM=stub` 모드 — storyboard/KB 원문 반환으로 LLM 없이도 플레이 가능
- [ ] 실 Bedrock 호출 1회 확인 — EC2 배포 시 (T07에서 수행)
