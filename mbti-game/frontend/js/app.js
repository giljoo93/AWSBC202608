/* 상태 머신 — idle → playing ×8 → judging → result → qa
 * 데이터는 api.js 에서만, DOM 은 render.js 에서만 온다. */

import { startGame, sendChoice, askQuestion, backgroundForStep,
         SCENE_META, TOTAL, TITLE, TITLE_BG, ENDING_BG, USE_MOCK } from "./api.js";
import * as ui from "./render.js";

let sessionId = null;
let step = 0;
let playing = false;
let detachKeys = null;

/* 진행 중 새로고침 = 세션 소멸. 인메모리 설계의 대가라 미리 막는다 */
window.addEventListener("beforeunload", (e) => {
  if (!playing) return;
  e.preventDefault();
  e.returnValue = "";
});

ui.initBacklog();

/* ── 타이틀 ─────────────────────────────────────────────── */

function titleScreen() {
  playing = false;
  const screen = document.createElement("div");
  screen.className = "title-screen";
  screen.innerHTML = `
    <div class="title-mark">◈</div>
    <h1 class="title-main"></h1>
    <div class="title-rule"></div>
    <p class="title-sub">여덟 번의 선택이 당신을 말한다</p>
    <p class="title-note">
      진행 중 새로고침하면 처음부터 시작됩니다.${
        USE_MOCK ? "<br>현재 목 데이터로 동작하는 프로토타입입니다." : ""}
    </p>`;
  screen.querySelector(".title-main").textContent = TITLE;

  document.querySelector("#log").replaceChildren(screen);
  ui.setBackground(TITLE_BG);
  ui.showHud(false);
  ui.titleButton("여정을 시작한다", begin);
}

/* ── 진행 ───────────────────────────────────────────────── */

async function begin() {
  ui.clearControls();
  ui.showHud(true);

  try {
    const d = await startGame();
    sessionId = d.session_id;
    playing = true;
    await enterScene(d);
  } catch (e) {
    fail(e);
  }
}

/** 한 분기를 화면에 올린다 — 암전 → 장 제목 → 본문 → 선택지 */
async function enterScene(d) {
  step = d.step;
  const bg = d.background ?? backgroundForStep(d.step);

  ui.setChapter(bg.title ?? "");
  ui.progress(d.step, d.total ?? TOTAL, SCENE_META);
  await ui.chapterTransition(d.step, d.total ?? TOTAL, bg.title ?? "", bg);

  ui.scene(d.narration);
  detachKeys = ui.choices(d.choices, pick);
}

async function pick(choice) {
  detachKeys?.();
  ui.playerLine(choice.label);
  ui.clearControls();

  const last = step >= TOTAL;
  const wait = last ? null : ui.typing();
  if (last) ui.judging(true);

  try {
    const d = await sendChoice(sessionId, choice.key);
    wait?.done();

    if (d.done) {
      ui.judging(false);
      return finish(d);
    }
    await enterScene(d);
  } catch (e) {
    wait?.done();
    ui.judging(false);
    fail(e);
  }
}

/* ── 결과 ───────────────────────────────────────────────── */

function finish(d) {
  playing = false;
  step = TOTAL + 1;

  const endBg = d.background ?? ENDING_BG;
  ui.setChapter(endBg?.title ?? "여정의 끝");
  ui.progress(TOTAL + 1, TOTAL, SCENE_META);
  ui.setBackground(endBg);
  document.querySelector("#log").replaceChildren();

  ui.scene(d.epilogue);
  ui.mbtiCard(d.mbti, d.scores);
  ui.narrationBlock(d.report);
  ui.systemLine("이제 당신의 MBTI에 대해 무엇이든 물어볼 수 있습니다.");

  ui.chatInput(async (q, done) => {
    ui.playerLine(q);
    const wait = ui.typing();
    try {
      const r = await askQuestion(sessionId, q);
      wait.done();
      ui.narrationBlock(r.answer);
    } catch (e) {
      wait.done();
      ui.systemLine("⚠ " + e.message, "error");
    }
    done();
  });
}

/* ── 에러 ───────────────────────────────────────────────── */

function fail(err) {
  playing = false;
  detachKeys?.();
  ui.systemLine("⚠ " + err.message, "error");
  ui.systemLine("세션은 서버 메모리에만 유지됩니다. 처음부터 다시 시작해주세요.");
  ui.titleButton("처음부터 다시", titleScreen);
}

titleScreen();
