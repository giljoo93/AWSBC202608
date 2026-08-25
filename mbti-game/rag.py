"""로컬 RAG — storyboard/mbti_kb JSON에서 관련 청크만 골라 프롬프트 재료로 반환."""
import json
import re
from pathlib import Path

from engine import STORY

KB = json.loads((Path(__file__).parent / "data" / "mbti_kb.json").read_text(encoding="utf-8"))

# ponytail: 키워드 매칭 검색 — KB가 파일 2개 규모라 임베딩 불필요. 문서 수십 개로 늘면 임베딩 도입.


def scene_chunks(step: int) -> str:
    """장면 연출용: 해당 장면의 intro+context (step 0이면 프롤로그 포함)."""
    scene = STORY["scenes"][step]
    parts = []
    if step == 0:
        parts.append(STORY["prologue"])
    if scene.get("intro"):
        parts.append(scene["intro"])
    parts.append(scene["context"])
    return "\n\n".join(parts)


def _type_chunk(t: str) -> str:
    info = KB["types"][t]
    return (
        f"[{t}] {info['summary']}\n"
        f"강점: {', '.join(info['strengths'])}\n"
        f"주의점: {', '.join(info['cautions'])}"
    )


def mbti_chunks(mbti: str, question: str | None = None) -> str:
    """결과지/Q&A용: 판정 타입 + 4속성 + 4축 설명. 질문 속 다른 타입 언급 시 해당 청크 추가."""
    parts = [_type_chunk(mbti)]
    parts += [KB["attributes"][ch] for ch in mbti]
    parts += list(KB["axes"].values())
    if question:
        for t in KB["types"]:
            if t != mbti and re.search(t, question, re.IGNORECASE):
                parts.append(_type_chunk(t))
    return "\n\n".join(parts)
