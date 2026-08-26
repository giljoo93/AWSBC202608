"""frontend/ 를 단일 HTML 파일로 묶는다.

산출물 두 개:
  dist/index.html    — 완전한 HTML. 브라우저로 바로 열거나 공유(USB/이메일)용
  dist/artifact.html — doctype/head/body 없는 본문만. 아티팩트 퍼블리시용

배포는 여전히 분리된 파일을 S3에 올리는 쪽이 맞다 — 캐시 정책을 파일별로 나눌 수
있기 때문 (finalplan/frontend-render-draft.md 5절).

ES 모듈을 번들러 없이 묶기 위해, 각 모듈을 IIFE 로 감싸 이름 충돌을 막는다.
(api.js 와 render.js 가 둘 다 AXES 를 선언하고 있어 단순 이어붙이기는 실패한다.)

실행: 프로젝트 루트에서  py finalplan/build-single-file.py
"""
import base64
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "mbti-game" / "frontend"
DIST = SRC / "dist"

# 의존 순서 (앞의 것이 뒤의 것에 쓰인다)
ORDER = ["data", "narrative", "sprites", "api", "render", "app"]

IMPORT_RE = re.compile(
    r'import\s+(?:\*\s+as\s+(?P<ns>\w+)|\{(?P<names>[^}]*)\})\s+from\s+"\./(?P<mod>[\w-]+)\.js";',
    re.S,
)
EXPORT_RE = re.compile(
    r'^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+(\w+)', re.M
)

FONT_LINKS = "\n".join([
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700'
    '&family=Gowun+Dodum&display=swap" rel="stylesheet">',
])

SCRIPT_TAG = '<script type="module" src="js/app.js"></script>'
STYLE_TAG = '<link rel="stylesheet" href="css/style.css">'


def analyse(body):
    """모듈 본문에서 import 를 걷어내고, 무엇을 들여오고 내보내는지 알아낸다."""
    deps = []
    for m in IMPORT_RE.finditer(body):
        deps.append({
            "mod": m.group("mod"),
            "ns": m.group("ns"),
            "names": [n.strip() for n in (m.group("names") or "").split(",") if n.strip()],
        })
    stripped = IMPORT_RE.sub("", body)
    exports = EXPORT_RE.findall(stripped)
    stripped = re.sub(r"^export\s+", "", stripped, flags=re.M)
    return stripped, deps, exports


def bundle():
    chunks = ["const __m = {};"]

    for mod in ORDER:
        body, deps, exports = analyse((SRC / "js" / f"{mod}.js").read_text(encoding="utf-8"))

        head = []
        for d in deps:
            if d["ns"]:
                head.append("const %s = __m.%s;" % (d["ns"], d["mod"]))
            elif d["names"]:
                head.append("const { %s } = __m.%s;" % (", ".join(d["names"]), d["mod"]))

        ret = "return { %s };" % ", ".join(exports) if exports else "return {};"
        inner = "\n".join(head) + "\n" + body + "\n" + ret
        chunks.append("__m.%s = (() => {\n%s\n})();" % (mod, inner))

    return "(() => {\n" + "\n\n".join(chunks) + "\n})();"


def assets_blob():
    """assets/ 의 이미지를 data URI 로 인라인한다 — 단일 파일이 정말 단일 파일이 되도록.
    분리 배포(S3)에서는 이 블록이 없고 상대 경로가 그대로 쓰인다."""
    table = {}
    for sub in ("bg", "cast"):
        for f in sorted((SRC / "assets" / sub).glob("*.webp")):
            b64 = base64.b64encode(f.read_bytes()).decode()
            table[f"assets/{sub}/{f.name}"] = f"data:image/webp;base64,{b64}"

    if not table:
        return "", 0

    nl = chr(10)
    lines = ("," + nl).join(f'  "{k}": "{v}"' for k, v in table.items())
    total = sum(len(v) for v in table.values())
    blob = "globalThis.__ASSETS = {" + nl + lines + nl + "};" + nl
    return blob, total


def body_of(html):
    body = html.split("<body>", 1)[1].rsplit("</body>", 1)[0]
    return body.replace(SCRIPT_TAG, "").strip()


def main():
    html = (SRC / "index.html").read_text(encoding="utf-8")
    css = (SRC / "css" / "style.css").read_text(encoding="utf-8")
    assets, asset_bytes = assets_blob()
    js = assets + bundle()

    DIST.mkdir(parents=True, exist_ok=True)
    if assets:
        n = assets.count("data:image/webp")
        print(f"이미지 {n}장 인라인 ({asset_bytes / 1024:,.0f} KB base64)")

    # 1) 완전한 HTML
    full = html.replace(STYLE_TAG, "<style>\n" + css + "\n</style>")
    full = full.replace(SCRIPT_TAG, "<script>\n" + js + "\n</script>")
    (DIST / "index.html").write_text(full, encoding="utf-8")

    # 2) 아티팩트용 — 퍼블리시 때 doctype/head/body 가 씌워지므로 내용만 넣는다
    art = "\n".join([
        "<title>차원문 너머</title>",
        FONT_LINKS,
        "<style>",
        css,
        "</style>",
        body_of(html),
        "<script>",
        js,
        "</script>",
    ])
    (DIST / "artifact.html").write_text(art, encoding="utf-8")

    for name in ("index.html", "artifact.html"):
        p = DIST / name
        print(f"wrote {p.relative_to(ROOT)} ({p.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
