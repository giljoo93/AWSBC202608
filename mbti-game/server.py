"""FastAPI 백엔드. 세션 = 서버 메모리. 프론트는 S3/CloudFront(로컬 개발 시 여기서 서빙).

장면 모드:
- 고정(기본): storyboard.json 장면 그대로, LLM은 내레이션 연출만.
- 동적: GAME_LLM=bedrock이면 장면마다 스토리 KB 검색 + LLM이 장면·선택지 문구를
  새로 생성. 점수 골격은 storyboard 원본 유지. GAME_SCENE_MODE=static으로 끌 수 있음.
"""
import os
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


def _design(scene: dict) -> str:
    """장면 생성용 설계도 — 상황 뼈대 + 각 선택지가 드러내야 할 성향."""
    a, b = scene["choices"]
    kind = "전투(위기)" if scene.get("kind") == "combat" else "일상"
    frame = " ".join(p for p in (scene.get("intro"), scene["context"]) if p)
    return (
        f"{scene['act']}막 · {kind} 장면\n"
        f"상황 뼈대: {frame}\n"
        f"선택 A가 드러내야 할 성향: {rag.KB['attributes'][a['attr']]}\n"
        f"선택 B가 드러내야 할 성향: {rag.KB['attributes'][b['attr']]}"
    )


def _scene_payload(s, step: int) -> tuple[str, dict]:
    """한 장면 준비 — 동적 생성 성공 시 그 결과, 실패·stub 시 고정 스토리."""
    base = engine.get_scene(step)
    history = [r.reason for r in s.history]
    if llm.GAME_LLM == "bedrock" and os.environ.get("GAME_SCENE_MODE") != "static":
        gen = llm.generate_scene(_design(base), rag.story_chunks(step, history), history)
        if gen:
            engine.store_generated(s, step, gen)
            return gen["narration"], engine.scene_for(s, step)
    narration = llm.narrate(
        rag.scene_chunks(step), prev_reason=history[-1] if history else None
    )
    return narration, base


@app.get("/health")
def health():
    return {
        "ok": True,
        "llm": llm.GAME_LLM,
        "kb_story": bool(rag.KB_STORY),
        "kb_mbti": bool(rag.KB_MBTI),
    }


@app.post("/api/game/start")
def start():
    s = engine.create_session()
    narration, scene = _scene_payload(s, 0)
    return {
        "session_id": s.id,
        "step": 1,
        "total": engine.BRANCHES,
        "narration": narration,
        "choices": _choices(scene),
    }


@app.post("/api/game/choice")
def choice(body: ChoiceIn):
    try:
        s = engine.get_session(body.session_id)
        engine.apply_choice(s, body.choice)  # 선택 기록은 s.history에 쌓인다
    except engine.GameError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if s.step < engine.BRANCHES:
        narration, scene = _scene_payload(s, s.step)
        return {
            "done": False,
            "step": s.step + 1,
            "total": engine.BRANCHES,
            "narration": narration,
            "choices": _choices(scene),
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
