"""FastAPI 백엔드. 세션 = 서버 메모리. 프론트는 S3/CloudFront(로컬 개발 시 여기서 서빙)."""
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import engine
import llm
import rag
from schemas import ChatIn, ChoiceIn

app = FastAPI(title="차원문 너머 — MBTI 게임")

# CloudFront /api/* 오리진 라우팅이면 same-origin이라 CORS 불필요하지만,
# EC2 직접 호출 개발 단계를 위해 허용. 배포 후 도메인으로 좁혀도 됨.
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


def _choices(scene: dict) -> list[dict]:
    # 점수 정보(attr/score/reason)는 클라이언트에 노출하지 않음
    return [{"key": c["key"], "label": c["label"]} for c in scene["choices"]]


@app.get("/health")
def health():
    return {"ok": True, "llm": llm.GAME_LLM}


@app.post("/api/game/start")
def start():
    s = engine.create_session()
    narration = llm.narrate(rag.scene_chunks(0), prev_reason=None)
    return {
        "session_id": s.id,
        "step": 1,
        "total": engine.BRANCHES,
        "narration": narration,
        "choices": _choices(engine.get_scene(0)),
    }


@app.post("/api/game/choice")
def choice(body: ChoiceIn):
    try:
        s = engine.get_session(body.session_id)
        record = engine.apply_choice(s, body.choice)
    except engine.GameError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if s.step < engine.BRANCHES:
        narration = llm.narrate(rag.scene_chunks(s.step), prev_reason=record.reason)
        return {
            "done": False,
            "step": s.step + 1,
            "total": engine.BRANCHES,
            "narration": narration,
            "choices": _choices(engine.get_scene(s.step)),
        }

    s.mbti = engine.decide_mbti(s.scores)
    reasons = [
        f"[{'전투' if r.kind == 'combat' else '일상'}] {r.reason}" for r in s.history
    ]
    s.report = llm.report(s.mbti, reasons, rag.mbti_chunks(s.mbti))
    return {
        "done": True,
        "epilogue": engine.STORY["epilogue"],
        "mbti": s.mbti,
        "scores": s.scores.model_dump(),
        "report": s.report,
    }


@app.post("/api/chat")
def chat(body: ChatIn):
    try:
        s = engine.get_session(body.session_id)
    except engine.GameError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if s.mbti is None:
        raise HTTPException(status_code=400, detail="게임을 먼저 완료해주세요.")
    answer = llm.qa(s.mbti, body.question, rag.mbti_chunks(s.mbti, body.question))
    return {"answer": answer}


# 로컬 개발용 프론트 서빙 (배포 시엔 S3/CloudFront가 담당, 있어도 무해)
app.mount("/", StaticFiles(directory=Path(__file__).parent / "frontend", html=True))
