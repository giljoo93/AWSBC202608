from pydantic import BaseModel, Field


class Scores(BaseModel):
    E: int = 0
    I: int = 0
    S: int = 0
    N: int = 0
    T: int = 0
    F: int = 0
    J: int = 0
    P: int = 0


class ChoiceRecord(BaseModel):
    branch: int
    axis: str
    kind: str            # "daily" | "combat"
    choice: str          # "A" | "B"
    attr: str            # "E".."P"
    reason: str          # 결과지 인용용 근거 문장


class Session(BaseModel):
    id: str
    step: int = 0        # 완료한 분기 수 (0~4)
    scores: Scores = Field(default_factory=Scores)
    history: list[ChoiceRecord] = Field(default_factory=list)
    mbti: str | None = None
    report: str | None = None


# --- API 요청/응답 ---

class ChoiceIn(BaseModel):
    session_id: str
    choice: str


class ChatIn(BaseModel):
    session_id: str
    question: str
