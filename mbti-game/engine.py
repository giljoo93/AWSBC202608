"""분기 진행 + MBTI 점수 엔진. LLM 무관, 순수 코드."""
import json
import uuid
from pathlib import Path

from schemas import ChoiceRecord, Scores, Session

DATA = Path(__file__).parent / "data"
STORY = json.loads((DATA / "storyboard.json").read_text(encoding="utf-8"))
BRANCHES: int = STORY["meta"]["branches"]

# ponytail: 인메모리 전역 dict, 재시작 시 소멸 — 영속 필요해지면 S3 덤프 추가
SESSIONS: dict[str, Session] = {}


class GameError(ValueError):
    """클라이언트 잘못(없는 세션/선택지, 종료된 게임)."""


def create_session() -> Session:
    s = Session(id=uuid.uuid4().hex)
    SESSIONS[s.id] = s
    return s


def get_session(session_id: str) -> Session:
    try:
        return SESSIONS[session_id]
    except KeyError:
        raise GameError("세션이 없습니다. 게임을 다시 시작해주세요.") from None


def get_scene(step: int) -> dict:
    return STORY["scenes"][step]


def store_generated(session: Session, step: int, gen: dict) -> None:
    """LLM이 생성한 장면을 세션에 저장.

    문구(label/reason)만 생성 결과로 바꾸고, 점수 골격(attr/score)은 반드시
    원본 storyboard 값을 유지한다 — 판정 공정성은 코드가 지킨다.
    """
    base = get_scene(step)
    session.gen_scenes[step] = {
        **base,
        "choices": [
            {**base["choices"][0], "label": gen["choice_a"], "reason": gen["reason_a"]},
            {**base["choices"][1], "label": gen["choice_b"], "reason": gen["reason_b"]},
        ],
    }


def scene_for(session: Session, step: int) -> dict:
    """이 세션이 실제로 본 장면 — 생성본이 있으면 그것, 없으면 고정 스토리."""
    return session.gen_scenes.get(step) or get_scene(step)


def apply_choice(session: Session, key: str) -> ChoiceRecord:
    if session.step >= BRANCHES:
        raise GameError("이미 종료된 게임입니다.")
    scene = scene_for(session, session.step)
    choice = next((c for c in scene["choices"] if c["key"] == key), None)
    if choice is None:
        raise GameError(f"잘못된 선택지입니다: {key}")
    attr = choice["attr"]
    setattr(session.scores, attr, getattr(session.scores, attr) + choice["score"])
    record = ChoiceRecord(
        branch=scene["id"], axis=scene["axis"], kind=scene.get("kind", "daily"),
        choice=key, attr=attr, reason=choice["reason"],
    )
    session.history.append(record)
    session.step += 1
    return record


def decide_mbti(s: Scores) -> str:
    # 축당 1회라 동점 없음
    return (
        ("E" if s.E > s.I else "I")
        + ("S" if s.S > s.N else "N")
        + ("T" if s.T > s.F else "F")
        + ("J" if s.J > s.P else "P")
    )
