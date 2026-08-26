"""frontend/js/data.js 생성기.

storyboard.json + mbti_kb.json 을 읽어 프론트 목 데이터로 변환한다.
장면 제목·배경 팔레트·등장인물 목록처럼 화면에만 필요한 정보를 여기서 덧붙인다.

실행: 프로젝트 루트에서  py finalplan/gen-frontend-data.py
"""
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "mbti-game" / "data"
OUT = ROOT / "mbti-game" / "frontend" / "js" / "data.js"

# 장면별 화면 정보 — (배경키, deep, mid, glow, 장 제목)
SCENES = [
    ("plaza",         "#3b2f6b", "#8b6fb8", "#f0c46a", "소환 광장"),
    ("forest-fork",   "#12301f", "#2f6b45", "#9fd9a0", "속삭이는 숲"),
    ("goblin-ambush", "#4a1f14", "#a3472a", "#ffb257", "첫 실전"),
    ("captive",       "#2a2620", "#6b5a42", "#d9b877", "포로의 심판"),
    ("bridge-troll",  "#1b2733", "#3f6076", "#8fc7e8", "협곡의 다리"),
    ("castle-gate",   "#17131f", "#3a2c52", "#a86ede", "마왕성 앞에서"),
    ("grand-hall",    "#2b0f18", "#7a1f33", "#ff7a8a", "대회랑"),
    ("demon-lord",    "#0d0a14", "#5a1050", "#ff4d7d", "옥좌의 마왕"),
]
PROLOGUE = ("summon", "#0e1024", "#2b3a7a", "#8fb6ff", "차원문")
ENDING = ("dawn", "#2a1c2e", "#8a5a6b", "#ffd9a0", "알테리아의 아침")

# 등장인물 — 화자 추론 대상이자 입상(sprite) 정의
# key      : 이미지 파일명 (assets/cast/<key>.webp)
# accent   : 입상 림라이트 색 + 명찰 강조색
# silhouette: 이미지가 없을 때 쓸 절차적 실루엣 모양 (js/sprites.js)
# side     : 화면 어느 쪽에 세울지
CAST = {
    "궁정 마법사": {"key": "mage",   "accent": "#a86ede", "silhouette": "mage",   "side": "right"},
    "레온":        {"key": "leon",   "accent": "#8fc7e8", "silhouette": "knight", "side": "left"},
    "시엔":        {"key": "sien",   "accent": "#9fd9a0", "silhouette": "archer", "side": "right"},
    "젊은 도적":   {"key": "bandit", "accent": "#d9b877", "silhouette": "bandit", "side": "left"},
    "촌장":        {"key": "elder",  "accent": "#e0b070", "silhouette": "elder",  "side": "right"},
    "마왕":        {"key": "demon",  "accent": "#ff4d7d", "silhouette": "demon",  "side": "right"},
}

# 화자 추론용 이름 목록 — 부분 일치는 narrative.js 가 "끝 위치 + 길이"로 해결한다
SPEAKERS = list(CAST) + ["마법사"]


def bg(t):
    return {"key": t[0], "deep": t[1], "mid": t[2], "glow": t[3], "title": t[4]}


def build():
    sb = json.loads((DATA / "storyboard.json").read_text(encoding="utf-8"))
    kb = json.loads((DATA / "mbti_kb.json").read_text(encoding="utf-8"))

    scenes = []
    for i, s in enumerate(sb["scenes"]):
        scenes.append({
            "step": i + 1,
            "axis": s["axis"],
            "kind": s["kind"],
            "intro": s.get("intro") or "",
            "context": s["context"],
            "bg": bg(SCENES[i]),
            "choices": [
                {
                    "key": c["key"], "label": c["label"],
                    "attr": c["attr"], "score": c["score"], "reason": c["reason"],
                }
                for c in s["choices"]
            ],
        })

    return {
        "meta": sb["meta"],
        "speakers": SPEAKERS,
        "cast": CAST,
        # "마법사"로 잡혀도 궁정 마법사와 같은 인물이다
        "castAlias": {"마법사": "궁정 마법사"},
        "prologue": sb["prologue"],
        "prologueBg": bg(PROLOGUE),
        "epilogue": sb["epilogue"],
        "endingBg": bg(ENDING),
        "scenes": scenes,
        "kb": kb,
    }


def main():
    payload = build()
    with io.open(OUT, "w", encoding="utf-8") as f:
        f.write("// 자동 생성 — finalplan/gen-frontend-data.py\n")
        f.write("// 원본: mbti-game/data/storyboard.json + mbti_kb.json\n")
        f.write("// 직접 수정하지 말 것. 스토리가 바뀌면 생성기를 다시 돌린다.\n")
        f.write("export const STORY = ")
        json.dump(payload, f, ensure_ascii=False, indent=1)
        f.write(";\n")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
