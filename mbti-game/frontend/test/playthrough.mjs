/* 헤드리스 플레이스루 — dist/index.html 을 jsdom 에 올리고 8분기를 실제로 클릭한다.
 * 브라우저 없이 "게임이 처음부터 끝까지 돌아가는가"를 검증한다. */
import { JSDOM } from "jsdom";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* dist/index.html 을 대상으로 한다 — 단일 파일 빌드가 곧 배포본과 같은 코드이므로.
   먼저 `py finalplan/build-single-file.py` 로 빌드해 두어야 한다. */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.resolve(HERE, "..", "dist", "index.html");

const errors = [];

const dom = await JSDOM.fromFile(FILE, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  beforeParse(win) {
    // jsdom 미구현 API 스텁
    win.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    win.Element.prototype.scrollIntoView = function () {};
    win.addEventListener("error", (e) => errors.push("window.error: " + e.message));
    const origErr = win.console.error;
    win.console.error = (...a) => { errors.push("console.error: " + a.join(" ")); origErr(...a); };
  },
});

const { window } = dom;
const doc = window.document;
const $ = (s) => doc.querySelector(s);
const $$ = (s) => [...doc.querySelectorAll(s)];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, label, timeout = 15000) {
  const t0 = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - t0 > timeout) throw new Error(`타임아웃: ${label}`);
    await sleep(50);
  }
}

let advSeen = 0;
const spriteSeen = [];
let chapters = [];
const log = [];
const ok = (m) => log.push("  ✓ " + m);
const bad = (m) => log.push("  ✗ " + m);

try {
/* ── 타이틀 ─────────────────────────────────────────────── */
await until(() => $(".title-main"), "타이틀 화면");
ok(`타이틀: "${$(".title-main").textContent}"`);
if ($("#hud").classList.contains("hidden")) ok("타이틀에서 HUD 숨김");
else bad("타이틀에서 HUD가 보임");

const startBtn = await until(() => $(".primary"), "시작 버튼");
ok(`시작 버튼: "${startBtn.textContent}"`);
startBtn.click();

/* ── 8분기 ──────────────────────────────────────────────── */
const picks = "ABBAABBA".split("");

for (let i = 0; i < 8; i += 1) {
  await until(() => $$(".choice").length === 2 && !$$(".choice")[0].disabled, `분기 ${i + 1} 선택지`);

  const chap = $(".chapter-name")?.textContent ?? "(없음)";
  chapters.push(chap);

  const nvl = $$(".block.nvl").length;
  const adv = $$(".block.adv").length;
  advSeen += adv;
  const dots = $$(".dot").length;
  const now = $$(".dot.now").length;

  if (dots !== 8) bad(`분기 ${i + 1}: 진행 점이 ${dots}개 (8이어야 함)`);
  if (now !== 1) bad(`분기 ${i + 1}: 현재 표시 점이 ${now}개 (1이어야 함)`);
  if (nvl === 0) bad(`분기 ${i + 1}: 서술 블록 없음`);

  // 대사가 있는 장면이면 그 인물의 입상이 무대에 서 있어야 한다
  const sprites = $$("#stage .sprite");
  if (adv > 0) {
    if (!sprites.length) bad(`분기 ${i + 1}: 대사가 ${adv}개인데 입상이 없음`);
    else spriteSeen.push(sprites[sprites.length - 1].dataset.key);
  }

  const btn = $$(".choice").find((b) => b.dataset.key === picks[i]);
  if (!btn) { bad(`분기 ${i + 1}: 선택지 ${picks[i]} 없음`); break; }
  log.push(`  · 제${i + 1}장 "${chap}" — 서술 ${nvl} / 대사 ${adv} → ${picks[i]} 선택`);
  btn.click();

  if ($$(".choice").some((b) => !b.disabled)) bad(`분기 ${i + 1}: 클릭 후 버튼이 비활성화되지 않음`);
}

/* ── 결과 ───────────────────────────────────────────────── */
await until(() => $(".card-type"), "MBTI 결과 카드", 20000);
const mbti = $(".card-type").textContent.replace(/\s/g, "");
ok(`결과 카드: ${mbti}`);
if (mbti !== "ISFJ") bad(`ABBAABBA → ISFJ 여야 하는데 ${mbti}`);

const wins = $$(".axis-end.win").map((e) => e.textContent).join("");
ok(`축 승자: ${wins}`);
if (wins !== mbti) bad(`축 승자(${wins})와 판정(${mbti}) 불일치`);

if ($$(".axis").length === 4) ok("축 막대 4개");
else bad(`축 막대가 ${$$(".axis").length}개`);

await until(() => $(".chatbox input"), "질문 입력창");
ok("Q&A 입력창 활성화");

/* ── Q&A ────────────────────────────────────────────────── */
const answered = () => $$(".block.nvl:not(.typing-wrap)").length;
const before = answered();

const input = $(".chatbox input");
input.value = "TF 축이 뭐야?";
input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter" }));

await until(() => $(".typing-wrap"), "Q&A 로딩 표시");
ok("Q&A 로딩 인디케이터 표시됨");
await until(() => !$(".typing-wrap") && answered() > before, "Q&A 응답");
ok("Q&A 응답 렌더링됨");
if ($$(".block.me").length < 1) bad("질문이 내 말풍선으로 남지 않음");
else ok("질문이 내 말풍선으로 표시됨");

/* ── 백로그 ─────────────────────────────────────────────── */
$("#backlog-btn").click();
await until(() => !$("#backlog").hidden, "백로그 열림");
const rows = $$(".backlog-row").length;
ok(`백로그 ${rows}개 항목`);
if (rows < 8) bad(`백로그 항목이 ${rows}개 — 8분기 기록이 남지 않음`);
if ($$(".backlog-row.mine").length < 8) bad("내 선택 기록이 부족함");
$("[data-close]").click();
await until(() => $("#backlog").hidden, "백로그 닫힘");
ok("백로그 닫힘");

} catch (e) {
  bad("중단: " + e.message);
}

/* ── 결과 출력 ──────────────────────────────────────────── */
console.log("\n===== 헤드리스 플레이스루 =====");
console.log(log.join("\n"));
console.log("\n장 제목:", chapters.join(" → "));
console.log("대사(ADV) 블록 누적:", advSeen);
console.log("무대에 선 인물:", spriteSeen.join(", ") || "(없음)");

const fails = log.filter((l) => l.startsWith("  ✗"));
if (errors.length) {
  console.log("\n⚠ 콘솔/런타임 오류:");
  errors.forEach((e) => console.log("   " + e));
}
console.log(`\n결과: ${fails.length === 0 && errors.length === 0 ? "전부 통과 ✓" : `실패 ${fails.length}건, 오류 ${errors.length}건`}`);
window.close();
process.exit(fails.length || errors.length ? 1 : 0);
