# T02 — 스키마 + MBTI 점수 엔진 + 세션 메모리

선행: T01

## 목표

MBTI 8속성 점수 구조와 게임 진행 상태를 코드로 구조화. 선택 → 점수 적용 → 판정까지
LLM 개입 없이 순수 코드로 동작.

## 산출물

- `schemas.py` — pydantic 모델: `Session`, `Scores`, `ChoiceRecord`, API 요청/응답
- `engine.py` — 진행 로직

## 핵심 구조

```python
# engine.py
SESSIONS: dict[str, Session] = {}  # ponytail: 인메모리 전역 dict, 재시작 시 소멸 — 영속 필요해지면 S3 덤프 추가

class Scores(BaseModel):
    E: int = 0; I: int = 0; S: int = 0; N: int = 0
    T: int = 0; F: int = 0; J: int = 0; P: int = 0

def apply_choice(session, choice):        # storyboard의 attr/score/reason만 사용
    setattr(s := session.scores, choice.attr, getattr(s, choice.attr) + choice.score)
    session.history.append(ChoiceRecord(...))
    session.step += 1

def decide_mbti(scores) -> str:           # 축 합계 3점(일상1+전투2)이라 동점 없음
    return ("E" if scores.E > scores.I else "I") + \
           ("S" if scores.S > scores.N else "N") + \
           ("T" if scores.T > scores.F else "F") + \
           ("J" if scores.J > scores.P else "P")
```

## 작업 내용

1. storyboard.json 로드 + 장면 조회 (`get_scene(step)`)
2. 세션 생성(`uuid4`) / 조회 / 선택 적용 / step==branches(8) 시 판정
3. 잘못된 choice key, 없는 session_id, 종료 후 choice 호출 → 명시적 에러

## 완료 기준

- [x] `test_game.py`: 8회 선택 시뮬레이션 → 기대 MBTI 일치 assert (LLM 불필요) — 통과
- [x] 극단 케이스: 전부 A → ESTJ / 전부 B → INFP 통과
- [x] 가중치 케이스: 일상 E(1점) + 전투 I(2점) → I 판정 (전투 우세) 통과
