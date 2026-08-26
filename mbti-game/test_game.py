"""엔진 + 서버(stub) 자체 점검. 실행: py test_game.py — LLM/AWS 불필요."""
import engine


def run_game(keys: list[str]) -> engine.Session:
    s = engine.create_session()
    for k in keys:
        engine.apply_choice(s, k)
    return s


def test_engine():
    # 축 순서: EI(1) SN(1) EI(2) TF(1) SN(2) JP(1) TF(2) JP(2) — 괄호는 점수
    s = run_game(["A"] * 8)
    assert engine.decide_mbti(s.scores) == "ESTJ", s.scores
    assert s.scores.E == 3 and s.scores.S == 3  # 일상1 + 전투2
    s = run_game(["B"] * 8)
    assert engine.decide_mbti(s.scores) == "INFP", s.scores
    # 가중치: 일상에서 E(1점), 전투에서 I(2점) → I 승리
    s = run_game(["A", "B", "B", "A", "A", "A", "B", "A"])
    assert engine.decide_mbti(s.scores) == "ISFJ", s.scores
    assert s.scores.E == 1 and s.scores.I == 2
    assert len(s.history) == 8 and all(r.reason for r in s.history)
    assert [r.kind for r in s.history].count("combat") == 4  # 전투 분기 4개 기록

    # 에러 경로
    try:
        engine.apply_choice(s, "A")
        raise AssertionError("종료된 게임에 선택 허용됨")
    except engine.GameError:
        pass
    try:
        engine.get_session("없는id")
        raise AssertionError("없는 세션 통과")
    except engine.GameError:
        pass
    try:
        engine.apply_choice(engine.create_session(), "C")
        raise AssertionError("잘못된 선택지 통과")
    except engine.GameError:
        pass


def test_dynamic_scene():
    """생성 장면: 문구만 바뀌고 점수 골격은 원본 유지, 파서는 불량 출력 거부."""
    import llm

    s = engine.create_session()
    gen = {
        "narration": "새로 쓴 내레이션",
        "choice_a": "새 A 문구", "choice_b": "새 B 문구",
        "reason_a": "광장에서 먼저 인사를 건넸다", "reason_b": "광장에서 조용히 지켜보았다",
    }
    engine.store_generated(s, 0, gen)
    scene = engine.scene_for(s, 0)
    assert scene["choices"][0]["label"] == "새 A 문구"
    assert scene["choices"][0]["attr"] == "E" and scene["choices"][0]["score"] == 1  # 골격 유지
    record = engine.apply_choice(s, "A")
    assert record.reason == "광장에서 먼저 인사를 건넸다"  # 결과지 인용은 생성 문구
    assert s.scores.E == 1
    assert engine.scene_for(s, 1) == engine.get_scene(1)  # 생성 없으면 원본

    d = llm._parse_scene('앞말\n{"narration":"n","choice_a":"a","choice_b":"b",'
                         '"reason_a":"ra","reason_b":"rb"}\n뒷말')
    assert d["choice_a"] == "a"
    for bad in ("JSON 아님", '{"narration":"n"}', '{"narration":""}'):
        try:
            llm._parse_scene(bad)
            raise AssertionError(f"불량 출력 통과: {bad}")
        except (ValueError, KeyError):
            pass


def test_server_stub():
    from fastapi.testclient import TestClient
    import server

    client = TestClient(server.app)
    assert client.get("/health").json()["ok"] is True

    d = client.post("/api/game/start").json()
    sid = d["session_id"]
    assert d["step"] == 1 and len(d["choices"]) == 2 and d["narration"]
    assert "attr" not in str(d["choices"])  # 점수 정보 미노출

    for i in range(8):
        d = client.post(
            "/api/game/choice", json={"session_id": sid, "choice": "A"}
        ).json()
    assert d["done"] is True and d["mbti"] == "ESTJ", d
    assert d["scores"]["E"] == 3 and d["scores"]["I"] == 0
    assert "당신의 MBTI는 ESTJ" in d["report"]

    r = client.post("/api/chat", json={"session_id": sid, "question": "INTJ랑 잘 맞아?"})
    assert r.status_code == 200 and "INTJ" in r.json()["answer"]

    # 판정 전 chat 차단
    d2 = client.post("/api/game/start").json()
    r = client.post("/api/chat", json={"session_id": d2["session_id"], "question": "?"})
    assert r.status_code == 400


if __name__ == "__main__":
    test_engine()
    test_dynamic_scene()
    test_server_stub()
    print("OK: engine + 동적 장면 + server(stub) 전 구간 통과")
