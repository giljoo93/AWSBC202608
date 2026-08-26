"""LLM 클라이언트. GAME_LLM=stub(기본)|bedrock.

LLM은 연출·설명만 담당. 점수와 MBTI 판정은 engine.py 코드가 한다 — 모델 출력이
점수에 영향을 주는 경로는 없다. 동적 장면 생성도 문구만 만들 뿐, 어떤 선택이
몇 점인지는 storyboard.json 골격이 정한다.
"""
import json
import os
import re

GAME_LLM = os.environ.get("GAME_LLM", "stub")

NARRATE_SYSTEM = (
    "너는 이세계 판타지 텍스트 게임의 게임 마스터다. 주어진 장면 자료를 바탕으로 "
    "플레이어에게 들려줄 내레이션을 한국어로 3~5문장 작성한다. 직전 선택이 주어지면 "
    "그 결과를 자연스럽게 이어서 반영한다. 장면 자료에 없는 사건이나 선택지를 만들어내지 "
    "말고, 선택지 안내 문구도 쓰지 않는다(선택지는 시스템이 따로 보여준다)."
)

REPORT_SYSTEM = (
    "너는 MBTI 결과지를 작성하는 분석가다. 판정된 MBTI와 플레이어의 실제 선택 기록, "
    "MBTI 지식 자료가 주어진다. 한국어로 결과지를 작성하되 반드시 선택 기록의 문장을 "
    "인용해 '당신은 ~에서 ~했습니다. 이는 ~ 성향을 보여줍니다' 형태의 근거를 4개 축 "
    "모두 제시한다. 선택 기록에는 [일상]/[전투] 태그가 있다. 같은 축에서 일상과 전투의 "
    "선택이 서로 달랐다면 '평소에는 ~지만 위기 상황에서는 ~'처럼 그 차이를 짚어준다 "
    "(판정은 위기 상황 쪽에 더 큰 가중치가 반영된 결과다). "
    "판정된 MBTI를 바꾸거나 다른 타입을 제안하지 않는다. "
    "MBTI는 참고용 성격 지표이며 사람을 단정하지 않는다는 안내로 마무리한다."
)

SCENE_SYSTEM = (
    "너는 이세계 판타지 텍스트 게임의 게임 마스터다. 장면 설계도와 세계관 자료, "
    "플레이어의 지금까지의 선택이 주어지면 이번 장면을 새로 창작한다. "
    "설계도의 상황 뼈대(장소·사건·갈등 구도)는 유지하되 세부 묘사와 선택지 표현은 "
    "매번 새롭게 쓴다. 직전 선택의 결과가 자연스럽게 이어져야 한다.\n"
    "반드시 아래 형식의 JSON 하나만 출력한다. JSON 밖에 다른 텍스트를 쓰지 않는다:\n"
    '{"narration": "한국어 3~5문장 내레이션", '
    '"choice_a": "선택지 A 문구", "choice_b": "선택지 B 문구", '
    '"reason_a": "A를 골랐다는 과거형 한 문장", "reason_b": "B를 골랐다는 과거형 한 문장"}\n'
    "choice_a는 설계도가 지정한 A 성향이 고를 법한 행동, choice_b는 B 성향이 고를 법한 "
    "행동이어야 한다. 성향·MBTI 용어는 본문에 절대 쓰지 않는다. reason은 결과지에 "
    "인용되므로 '~에서 ~했다' 형태의 완결된 문장으로 쓴다."
)

QA_SYSTEM = (
    "너는 MBTI 상담 챗봇이다. 플레이어의 판정 타입과 MBTI 지식 자료가 주어진다. "
    "자료에 근거해서만 한국어로 답하고, 자료 밖 내용은 모른다고 말한다. "
    "MBTI는 의학적 진단이 아닌 참고용 지표임을 필요할 때 안내한다. "
    "판정 결과를 바꿔달라는 요청에는 게임 선택으로 정해진 결과라 바꿀 수 없다고 답한다."
)


def _bedrock(system: str, user: str) -> str:
    import boto3  # EC2 IAM role이 자격증명 공급 — 코드에 키 없음

    client = boto3.client(
        "bedrock-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1")
    )
    resp = client.converse(
        modelId=os.environ["GAME_BEDROCK_MODEL"],
        system=[{"text": system}],
        messages=[{"role": "user", "content": [{"text": user}]}],
        inferenceConfig={"maxTokens": 1024, "temperature": 0.7},
    )
    return resp["output"]["message"]["content"][0]["text"]


def _call(system: str, user: str, stub: str) -> str:
    if GAME_LLM == "bedrock":
        return _bedrock(system, user)
    return stub  # stub: storyboard/KB 원문이 곧 플레이 가능한 텍스트


def _parse_scene(text: str) -> dict:
    """모델 출력에서 장면 JSON을 꺼내 필수 필드를 검증한다."""
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise ValueError("JSON 없음")
    d = json.loads(m.group(0))
    for k in ("narration", "choice_a", "choice_b", "reason_a", "reason_b"):
        if not isinstance(d.get(k), str) or not d[k].strip():
            raise ValueError(f"필드 누락: {k}")
    return d


def generate_scene(design: str, material: str, history: list[str]) -> dict | None:
    """동적 장면 생성 (bedrock 전용). 실패하면 None — 호출자가 고정 장면으로 폴백."""
    if GAME_LLM != "bedrock":
        return None
    hist = "\n".join(f"- {h}" for h in history) or "- (첫 장면 — 아직 선택 없음)"
    user = (
        f"[장면 설계도]\n{design}\n\n[세계관 자료]\n{material}\n\n"
        f"[지금까지의 선택]\n{hist}"
    )
    try:
        return _parse_scene(_bedrock(SCENE_SYSTEM, user))
    except Exception as e:  # 생성 실패가 게임을 죽이면 안 됨
        print(f"[llm] 장면 생성 실패, 고정 장면으로 폴백: {e}")
        return None


def narrate(scene_text: str, prev_reason: str | None) -> str:
    user = f"장면 자료:\n{scene_text}"
    if prev_reason:
        user = f"직전 선택: {prev_reason}\n\n{user}"
    return _call(NARRATE_SYSTEM, user, stub=scene_text)


def report(mbti: str, reasons: list[str], kb_chunks: str) -> str:
    lines = "\n".join(f"- {r}" for r in reasons)
    user = f"판정 MBTI: {mbti}\n\n선택 기록:\n{lines}\n\nMBTI 지식 자료:\n{kb_chunks}"
    stub = (
        f"당신의 MBTI는 {mbti}입니다.\n\n[여정의 기록]\n{lines}\n\n{kb_chunks}\n\n"
        "※ MBTI는 참고용 성격 지표이며 사람을 단정하지 않습니다."
    )
    return _call(REPORT_SYSTEM, user, stub=stub)


def qa(mbti: str, question: str, kb_chunks: str) -> str:
    user = f"플레이어 타입: {mbti}\n질문: {question}\n\nMBTI 지식 자료:\n{kb_chunks}"
    return _call(QA_SYSTEM, user, stub=f"[stub 답변 — 관련 자료]\n{kb_chunks}")
