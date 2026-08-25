# T03 — MBTI 지식베이스 + 로컬 RAG 검색

선행: T01

## 목표

LLM 호출 전 관련 지식 청크를 골라 프롬프트에 주입하는 로컬 검색. 외부 벡터 DB 없음.

## 산출물

- `data/mbti_kb.json` — MBTI 지식베이스
- `rag.py` — 검색 함수 2개

## mbti_kb.json 구성

```json
{
  "attributes": {"E": "외향 — 에너지를 외부 교류에서 얻음. ...", "I": "...", ...8개},
  "types": {"INTJ": {"summary": "...", "strengths": [...], "cautions": [...]}, ...16개},
  "axes": {"EI": "에너지 방향 축 설명", "SN": "...", "TF": "...", "JP": "..."}
}
```

## 검색 함수

```python
def scene_chunks(step) -> str:
    # 내레이션용: 해당 장면 context + 직전 1~2 장면 요약 반환

def mbti_chunks(mbti: str, question: str | None) -> str:
    # 결과지/Q&A용: 판정된 타입 + 4속성 설명 반환.
    # 질문에 다른 타입/축 키워드 있으면 해당 청크 추가 (단순 키워드 매칭)
```

# ponytail: 키워드 매칭 검색 — KB가 파일 2개 규모라 임베딩 불필요. KB가 문서 수십 개로 늘면 임베딩 검색 도입.

## 완료 기준

- [x] 16타입 × 8속성 × 4축 전부 채워짐 → `mbti-game/data/mbti_kb.json`
- [x] 질문 속 타입 언급 시 해당 청크 추가 — test_game.py에서 INTJ 포함 assert 통과
