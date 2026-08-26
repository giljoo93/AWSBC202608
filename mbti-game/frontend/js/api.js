/* API 계층 — 화면은 이 파일만 통해 데이터를 얻는다.
 *
 * USE_MOCK = true  : 백엔드 없이 브라우저 안에서 전부 처리 (현재 프로토타입 모드)
 * USE_MOCK = false : 실제 EC2 백엔드 호출. 응답 폼은 mbti-game/API.md 계약과 동일
 *
 * 백엔드가 붙으면 이 파일의 플래그 하나만 바꾸면 되고,
 * render.js / app.js 는 손대지 않는다.
 */
import { STORY } from "./data.js";

export const USE_MOCK = false;
const API_BASE = ""; // CloudFront 배포 시 same-origin

/* ── 실서버 호출 ─────────────────────────────────────────── */

async function post(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "요청에 실패했습니다.");
  return data;
}

/* ── 목 세션 ─────────────────────────────────────────────── */

const AXES = [["E", "I"], ["S", "N"], ["T", "F"], ["J", "P"]];
const sessions = new Map();

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
/* 실제 Bedrock 호출 지연을 흉내낸다 — 로딩 UI를 실제 조건에서 확인하기 위해서 */
const think = () => delay(700 + Math.random() * 900);

function newSession() {
  const id = Math.random().toString(16).slice(2) + Date.now().toString(16);
  sessions.set(id, {
    id,
    step: 0,
    scores: { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 },
    history: [],
    mbti: null,
  });
  return sessions.get(id);
}

function getSession(id) {
  const s = sessions.get(id);
  if (!s) throw new Error("세션이 없습니다. 게임을 다시 시작해주세요.");
  return s;
}

/* 서버 stub 모드와 동일하게, 장면 원문이 곧 내레이션이다 */
function narrationOf(scene, withPrologue) {
  const parts = [];
  if (withPrologue) parts.push(STORY.prologue);
  if (scene.intro) parts.push(scene.intro);
  parts.push(scene.context);
  return parts.join("\n\n");
}

function publicChoices(scene) {
  // 점수 정보(attr/score/reason)는 화면에 노출하지 않는다 — 서버와 동일한 원칙
  return scene.choices.map((c) => ({ key: c.key, label: c.label }));
}

function decideMbti(scores) {
  return AXES.map(([a, b]) => (scores[a] >= scores[b] ? a : b)).join("");
}

function buildReport(mbti, history) {
  const t = STORY.kb.types[mbti];
  const lines = history
    .map((h) => `· [${h.kind === "combat" ? "전투" : "일상"}] ${h.reason}`)
    .join("\n");
  return (
    `당신의 MBTI는 ${mbti}입니다.\n${t.summary}\n\n` +
    `[ 여정의 기록 ]\n${lines}\n\n` +
    `[ 강점 ]\n${t.strengths.map((x) => `· ${x}`).join("\n")}\n\n` +
    `[ 살펴볼 점 ]\n${t.cautions.map((x) => `· ${x}`).join("\n")}\n\n` +
    `※ 이 결과는 놀이를 위한 참고 지표입니다. 사람을 네 글자로 단정하지 않습니다.\n` +
    `※ 현재는 목 데이터입니다 — 실제 결과지는 백엔드 연결 후 LLM이 생성합니다.`
  );
}

/* ── 공개 API — 실서버와 목이 같은 폼을 반환한다 ──────────── */

export async function startGame() {
  if (!USE_MOCK) return post("/api/game/start");
  await think();
  const s = newSession();
  const scene = STORY.scenes[0];
  return {
    session_id: s.id,
    step: 1,
    total: STORY.meta.branches,
    narration: narrationOf(scene, true),
    choices: publicChoices(scene),
    background: scene.bg,
  };
}

export async function sendChoice(sessionId, choiceKey) {
  if (!USE_MOCK) return post("/api/game/choice", { session_id: sessionId, choice: choiceKey });
  await think();

  const s = getSession(sessionId);
  if (s.mbti) throw new Error("이미 종료된 게임입니다.");

  const scene = STORY.scenes[s.step];
  const picked = scene.choices.find((c) => c.key === choiceKey);
  if (!picked) throw new Error(`잘못된 선택지입니다: ${choiceKey}`);

  s.scores[picked.attr] += picked.score;
  s.history.push({
    branch: s.step + 1, axis: scene.axis, kind: scene.kind,
    choice: picked.key, attr: picked.attr, reason: picked.reason,
  });
  s.step += 1;

  if (s.step < STORY.meta.branches) {
    const next = STORY.scenes[s.step];
    return {
      done: false,
      step: s.step + 1,
      total: STORY.meta.branches,
      narration: narrationOf(next, false),
      choices: publicChoices(next),
      background: next.bg,
    };
  }

  await think(); // 결과지 생성은 가장 느린 호출이다
  s.mbti = decideMbti(s.scores);
  return {
    done: true,
    epilogue: STORY.epilogue,
    mbti: s.mbti,
    scores: { ...s.scores },
    report: buildReport(s.mbti, s.history),
    background: STORY.endingBg,
  };
}

export async function askQuestion(sessionId, question) {
  if (!USE_MOCK) return post("/api/chat", { session_id: sessionId, question });
  await think();

  const s = getSession(sessionId);
  if (!s.mbti) throw new Error("게임을 먼저 완료해주세요.");

  const t = STORY.kb.types[s.mbti];
  const axis = Object.entries(STORY.kb.axes)
    .find(([k]) => question.includes(k)) || null;
  const extra = axis ? `\n\n${axis[1]}` : "";

  return {
    answer:
      `[목 응답 — 백엔드 연결 전]\n\n` +
      `${s.mbti}: ${t.summary}${extra}\n\n` +
      `실제로는 이 질문이 Bedrock으로 전달되고, MBTI 지식베이스를 근거로 답변이 생성됩니다.`,
  };
}

/* 장면 번호로 배경을 얻는다 — 서버가 background 를 안 주는 경우의 폴백 */
export function backgroundForStep(step) {
  const scene = STORY.scenes[step - 1];
  return scene ? scene.bg : STORY.prologueBg;
}

/* 타이틀 화면 배경 — 소환 직전의 도서관 */
export const TITLE_BG = STORY.prologueBg;

/* 엔딩 배경 — 서버 응답에는 background 가 없으므로 프론트가 채운다 */
export const ENDING_BG = STORY.endingBg;

export const SCENE_META = STORY.scenes.map((s) => ({ kind: s.kind, axis: s.axis }));
export const TOTAL = STORY.meta.branches;
export const TITLE = STORY.meta.title;
