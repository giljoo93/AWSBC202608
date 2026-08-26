"""검색 계층 — 프롬프트에 넣을 재료(청크)를 고른다.

두 가지 모드가 한 파일에 있다:
- 로컬(기본): data/*.json에서 키워드 매칭. AWS 없이 동작.
- Bedrock Knowledge Base: 환경 변수에 KB id를 넣으면 S3 벡터 검색을 사용.
    GAME_KB_STORY — 스토리 세계관 KB (게임 중 장면 생성 재료)
    GAME_KB_MBTI  — MBTI 지식 KB (결과지·Q&A 재료, 팀원 자료)
  KB 검색이 실패해도 게임이 죽지 않도록 항상 로컬 재료로 폴백한다.
"""
import json
import os
import re
from pathlib import Path

from engine import STORY

KB = json.loads((Path(__file__).parent / "data" / "mbti_kb.json").read_text(encoding="utf-8"))

KB_STORY = os.environ.get("GAME_KB_STORY", "")
KB_MBTI = os.environ.get("GAME_KB_MBTI", "")


def _retrieve(kb_id: str, query: str, n: int = 4) -> str:
    """Bedrock KB 벡터 검색 — 상위 n개 청크를 이어붙여 반환. 실패 시 빈 문자열."""
    import boto3  # EC2 IAM role이 자격증명 공급

    try:
        client = boto3.client(
            "bedrock-agent-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1")
        )
        resp = client.retrieve(
            knowledgeBaseId=kb_id,
            retrievalQuery={"text": query[:900]},
            retrievalConfiguration={"vectorSearchConfiguration": {"numberOfResults": n}},
        )
        return "\n\n".join(r["content"]["text"] for r in resp["retrievalResults"])
    except Exception as e:  # KB 장애가 게임을 죽이면 안 됨
        print(f"[rag] KB 검색 실패({kb_id}): {e}")
        return ""


# ── 게임 중: 장면 재료 ────────────────────────────────────────

def scene_chunks(step: int) -> str:
    """장면 연출용 로컬 재료: 해당 장면의 intro+context (step 0이면 프롤로그 포함)."""
    scene = STORY["scenes"][step]
    parts = []
    if step == 0:
        parts.append(STORY["prologue"])
    if scene.get("intro"):
        parts.append(scene["intro"])
    parts.append(scene["context"])
    return "\n\n".join(parts)


def story_chunks(step: int, history_reasons: list[str]) -> str:
    """장면 생성 재료: 스토리 KB 검색 결과 + 로컬 원문.

    검색 쿼리에 플레이어의 최근 선택을 섞는다 — 선택이 다르면 검색되는
    세계관 청크가 달라지고, 생성되는 장면도 따라 달라진다.
    """
    local = scene_chunks(step)
    if not KB_STORY:
        return local
    scene = STORY["scenes"][step]
    kind = "전투 위기 상황" if scene.get("kind") == "combat" else "일상 상황"
    query = f"{scene['act']}막 {kind}, {scene['axis']} 갈림길. " + " ".join(history_reasons[-3:])
    found = _retrieve(KB_STORY, query)
    return f"{found}\n\n{local}" if found else local


# ── 게임 후: MBTI 재료 ────────────────────────────────────────

def _type_chunk(t: str) -> str:
    info = KB["types"][t]
    return (
        f"[{t}] {info['summary']}\n"
        f"강점: {', '.join(info['strengths'])}\n"
        f"주의점: {', '.join(info['cautions'])}"
    )


def mbti_chunks(mbti: str, question: str | None = None) -> str:
    """결과지/Q&A용: 로컬 기본 지식 + (설정 시) 팀 MBTI KB 검색 결과."""
    parts = [_type_chunk(mbti)]
    parts += [KB["attributes"][ch] for ch in mbti]
    parts += list(KB["axes"].values())
    if question:
        for t in KB["types"]:
            if t != mbti and re.search(t, question, re.IGNORECASE):
                parts.append(_type_chunk(t))
    if KB_MBTI:
        found = _retrieve(KB_MBTI, f"MBTI {mbti} {question or '성격 특징과 강점'}")
        if found:
            parts.append(f"[팀 지식베이스 자료]\n{found}")
    return "\n\n".join(parts)
