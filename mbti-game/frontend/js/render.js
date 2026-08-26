/* 렌더링 계층 — DOM 조작은 전부 여기 모은다.
 * 이 파일은 데이터가 어디서 왔는지(목/실서버) 알지 못한다.
 *
 * 비주얼 노벨 관례를 따른다:
 *   NVL — 화자 없는 서술. 명조체, 명찰 없음
 *   ADV — 큰따옴표 대사. 명찰 있음, 강조색
 */
import { parse } from "./narrative.js";
import { silhouette } from "./sprites.js";
import { STORY } from "./data.js";

const $ = (sel) => document.querySelector(sel);

const el = {
  bgA: $("#bg-a"),
  bgB: $("#bg-b"),
  hud: $("#hud"),
  chapter: $("#chapter"),
  dots: $("#dots"),
  log: $("#log"),
  controls: $("#controls"),
  stage: $("#stage"),
  judging: $("#judging"),
  curtain: $("#curtain"),
  backlog: $("#backlog"),
  backlogBody: $("#backlog-body"),
  backlogBtn: $("#backlog-btn"),
};

let bgFront = el.bgA;
const history = []; // 백로그 원본

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? 0 : ms));

/* ── 실제 이미지 자동 감지 ──────────────────────────────────
 * assets/ 에 파일을 넣기만 하면 자동으로 쓰이고, 없으면 절차적 대역이 남는다.
 * 코드 수정 없이 이미지를 한 장씩 채워넣을 수 있게 하기 위한 장치. */

const probes = new Map();

/* 단일 파일 빌드에서는 이미지가 data URI 로 인라인된다 (window.__ASSETS).
   분리 배포(S3)에서는 상대 경로 그대로 쓰인다. */
function assetUrl(path) {
  return globalThis.__ASSETS?.[path] ?? path;
}

function probe(path) {
  const url = assetUrl(path);
  if (!probes.has(url)) {
    probes.set(url, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    }));
  }
  return probes.get(url);
}

/* ── 배경 ───────────────────────────────────────────────── */

export function setBackground(bg) {
  if (!bg) return;
  const back = bgFront === el.bgA ? el.bgB : el.bgA;

  back.style.setProperty("--bg-deep", bg.deep);
  back.style.setProperty("--bg-mid", bg.mid);
  back.style.setProperty("--bg-glow", bg.glow);
  back.dataset.scene = bg.key;

  const path = `assets/bg/${bg.key}.webp`;
  back.style.backgroundImage = "";
  probe(path).then((ok) => {
    // 그 사이 다른 장면으로 넘어갔으면 무시
    if (ok && back.dataset.scene === bg.key) {
      back.style.backgroundImage = `url("${assetUrl(path)}")`;
    }
  });

  back.classList.add("on");
  bgFront.classList.remove("on");
  bgFront = back;
}

/* ── 등장인물 입상 ──────────────────────────────────────────
 * 대사가 나오면 그 인물이 무대에 선다. 서술로 돌아가면 어두워진 채 남는다.
 * (비주얼 노벨에서 말하지 않는 인물을 어둡게 두는 관례) */

function castOf(name) {
  if (!name) return null;
  const canonical = STORY.castAlias?.[name] ?? name;
  const c = STORY.cast?.[canonical];
  return c ? { ...c, name: canonical } : null;
}

export function showSpeaker(name) {
  const c = castOf(name);
  if (!c) return dimStage();

  const current = el.stage.querySelector(".sprite.on");
  if (current?.dataset.key === c.key) {
    current.classList.add("speaking");
    return;
  }

  el.stage.querySelectorAll(".sprite").forEach((old) => {
    old.classList.remove("on", "speaking");
    setTimeout(() => old.remove(), 600);
  });

  const sprite = document.createElement("div");
  sprite.className = "sprite";
  sprite.dataset.key = c.key;
  sprite.dataset.side = c.side;
  sprite.style.setProperty("--accent", c.accent);
  sprite.innerHTML = silhouette(c.silhouette, c.accent);
  el.stage.appendChild(sprite);

  // 실제 일러스트가 있으면 실루엣을 대체한다
  const path = `assets/cast/${c.key}.webp`;
  probe(path).then((ok) => {
    if (!ok || !sprite.isConnected) return;
    const img = document.createElement("img");
    img.src = assetUrl(path);
    img.alt = "";
    sprite.replaceChildren(img);
  });

  requestAnimationFrame(() => sprite.classList.add("on", "speaking"));
}

export function dimStage() {
  el.stage.querySelectorAll(".sprite").forEach((s) => s.classList.remove("speaking"));
}

export function clearStage() {
  el.stage.querySelectorAll(".sprite").forEach((s) => {
    s.classList.remove("on", "speaking");
    setTimeout(() => s.remove(), 600);
  });
}

/* ── 장면 전환 ──────────────────────────────────────────── */

/** 암전 → 장 제목 → 밝아짐. 게임의 "챕터가 넘어간다"는 감각을 만든다 */
export async function chapterTransition(step, total, title, bg) {
  el.curtain.classList.add("on");
  clearStage();
  await wait(520);

  el.log.replaceChildren();
  setBackground(bg);

  const card = document.createElement("div");
  card.className = "chapter-card";
  card.innerHTML =
    `<span class="chapter-no">제 ${step} 장 · ${total}장 중</span>` +
    `<span class="chapter-name"></span>`;
  card.querySelector(".chapter-name").textContent = title;
  el.log.appendChild(card);

  el.curtain.classList.remove("on");
  await wait(reduced ? 0 : 1100);
}

/* ── 본문 ───────────────────────────────────────────────── */

/** 간접인용 따옴표를 인라인으로 강조한다 */
function withInlineQuotes(node, text) {
  const parts = text.split(/("[^"]+")/);
  parts.forEach((p) => {
    if (p.startsWith('"') && p.endsWith('"') && p.length > 2) {
      const em = document.createElement("em");
      em.className = "quote";
      em.textContent = p;
      node.appendChild(em);
    } else if (p) {
      node.appendChild(document.createTextNode(p));
    }
  });
}

/** 문장 단위로 나눠 순차 페이드인 */
function paint(node, text, startIndex = 0) {
  if (reduced) { withInlineQuotes(node, text); return 0; }

  const sentences = text.split(/(?<=[.!?…])\s+/).filter(Boolean);
  sentences.forEach((s, i) => {
    const span = document.createElement("span");
    span.className = "sentence";
    span.style.animationDelay = `${(startIndex + i) * 150}ms`;
    withInlineQuotes(span, s + " ");
    node.appendChild(span);
  });
  return sentences.length;
}

function push(node) {
  el.log.appendChild(node);
  requestAnimationFrame(() =>
    node.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "end" })
  );
  return node;
}

/** 서술 — NVL 스타일 */
export function narrationBlock(text, cls = "") {
  const d = document.createElement("div");
  d.className = "block nvl " + cls;
  paint(d, text);
  history.push({ speaker: null, text });
  return push(d);
}

/** 대사 — ADV 스타일 (명찰 있음) */
export function dialogueBlock(speaker, text) {
  showSpeaker(speaker);

  const d = document.createElement("div");
  d.className = "block adv";
  if (speaker) {
    const plate = document.createElement("span");
    plate.className = "plate";
    plate.textContent = speaker;
    const c = castOf(speaker);
    if (c) plate.style.setProperty("--plate", c.accent);
    d.appendChild(plate);
  }
  const body = document.createElement("p");
  body.className = "adv-text";
  paint(body, text);
  d.appendChild(body);
  history.push({ speaker, text });
  return push(d);
}

/** 장면 본문 전체 — 파서가 나눈 대로 NVL/ADV를 섞어 출력 */
export function scene(text) {
  let delayUnits = 0;
  for (const seg of parse(text)) {
    if (seg.type === "dialogue") {
      dialogueBlock(seg.speaker, seg.text);
    } else {
      dimStage();
      const d = document.createElement("div");
      d.className = "block nvl";
      delayUnits += paint(d, seg.text, delayUnits);
      history.push({ speaker: null, text: seg.text });
      push(d);
    }
  }
}

/** 플레이어의 선택 */
export function playerLine(text) {
  const d = document.createElement("div");
  d.className = "block me";
  d.textContent = text;
  history.push({ speaker: "당신", text });
  return push(d);
}

export function systemLine(text, cls = "") {
  const d = document.createElement("div");
  d.className = "block system " + cls;
  d.textContent = text;
  return push(d);
}

export function typing() {
  const d = document.createElement("div");
  d.className = "block nvl typing-wrap";
  d.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
  push(d);
  return { done: () => d.remove() };
}

/* 탭하면 페이드인을 건너뛴다 */
el.log.addEventListener("click", () => {
  el.log.querySelectorAll(".sentence").forEach((s) => {
    s.style.animation = "none";
    s.style.opacity = "1";
  });
});

/* ── 백로그 ─────────────────────────────────────────────── */

export function initBacklog() {
  el.backlogBtn.onclick = () => toggleBacklog(true);
  el.backlog.addEventListener("click", (e) => {
    if (e.target === el.backlog || e.target.dataset.close !== undefined) toggleBacklog(false);
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") toggleBacklog(false);
  });
}

function toggleBacklog(on) {
  if (on) {
    el.backlogBody.replaceChildren();
    if (!history.length) {
      const p = document.createElement("p");
      p.className = "backlog-empty";
      p.textContent = "아직 기록이 없습니다.";
      el.backlogBody.appendChild(p);
    }
    history.forEach((h) => {
      const row = document.createElement("div");
      row.className = "backlog-row" + (h.speaker === "당신" ? " mine" : "");
      if (h.speaker) {
        const n = document.createElement("span");
        n.className = "backlog-name";
        n.textContent = h.speaker;
        row.appendChild(n);
      }
      const t = document.createElement("p");
      t.textContent = h.text;
      row.appendChild(t);
      el.backlogBody.appendChild(row);
    });
  }
  el.backlog.hidden = !on;
  if (on) el.backlogBody.scrollTop = el.backlogBody.scrollHeight;
}

/* ── HUD ────────────────────────────────────────────────── */

export function showHud(on) {
  el.hud.classList.toggle("hidden", !on);
}

export function setChapter(title) {
  el.chapter.textContent = title ?? "";
}

export function progress(step, total, sceneMeta) {
  el.dots.replaceChildren();
  for (let i = 1; i <= total; i += 1) {
    const d = document.createElement("span");
    d.className = "dot";
    if (sceneMeta[i - 1]?.kind === "combat") d.classList.add("combat");
    if (i < step) d.classList.add("done");
    if (i === step) d.classList.add("now");
    el.dots.appendChild(d);
  }
  el.dots.setAttribute("aria-valuenow", String(Math.min(step, total)));
  el.dots.setAttribute("aria-valuemax", String(total));
}

/* ── 컨트롤 ─────────────────────────────────────────────── */

export function clearControls() {
  el.controls.replaceChildren();
}

export function titleButton(label, onClick) {
  const b = document.createElement("button");
  b.className = "primary";
  b.textContent = label;
  b.onclick = onClick;
  el.controls.replaceChildren(b);
  return b;
}

export function choices(list, onPick) {
  const hint = document.createElement("p");
  hint.className = "choice-hint";
  hint.textContent = "당신의 선택은";

  const buttons = list.map((c) => {
    const b = document.createElement("button");
    b.className = "choice";
    b.dataset.key = c.key;
    const label = document.createElement("span");
    label.className = "choice-label";
    label.textContent = c.label;
    b.appendChild(label);
    b.onclick = () => {
      buttons.forEach((x) => { x.disabled = true; });
      b.classList.add("picked");
      detach();
      onPick(c);
    };
    return b;
  });

  el.controls.replaceChildren(hint, ...buttons);

  const onKey = (e) => {
    if (!el.backlog.hidden) return;
    const hit = buttons.find((b) => b.dataset.key.toLowerCase() === e.key.toLowerCase());
    if (hit && !hit.disabled) hit.click();
  };
  window.addEventListener("keydown", onKey);
  const detach = () => window.removeEventListener("keydown", onKey);
  return detach;
}

export function chatInput(onSend) {
  const wrap = document.createElement("div");
  wrap.className = "chatbox";
  const input = document.createElement("input");
  input.placeholder = "내 MBTI에 대해 물어보기…";
  input.setAttribute("aria-label", "질문 입력");
  const btn = document.createElement("button");
  btn.textContent = "보내기";

  const fire = () => {
    const q = input.value.trim();
    if (!q) return;
    input.value = "";
    btn.disabled = true;
    onSend(q, () => { btn.disabled = false; input.focus(); });
  };
  btn.onclick = fire;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") fire(); });

  wrap.append(input, btn);
  el.controls.replaceChildren(wrap);
  input.focus();
}

/* ── 판정 연출 ──────────────────────────────────────────── */

export function judging(on) {
  el.judging.hidden = !on;
}

/* ── 결과 카드 ──────────────────────────────────────────── */

const AXES = [["E", "I"], ["S", "N"], ["T", "F"], ["J", "P"]];
const AXIS_NAME = { EI: "에너지 방향", SN: "인식 방식", TF: "판단 기준", JP: "생활 양식" };

export function mbtiCard(mbti, scores) {
  const card = document.createElement("div");
  card.className = "card";

  const crest = document.createElement("div");
  crest.className = "card-crest";
  crest.textContent = "◈";

  const type = document.createElement("div");
  type.className = "card-type";
  type.textContent = mbti.split("").join(" ");

  const label = document.createElement("div");
  label.className = "card-label";
  label.textContent = "여덟 번의 선택이 말해주는 당신";
  card.append(crest, type, label);

  const bars = [];
  AXES.forEach(([a, b], i) => {
    const row = document.createElement("div");
    row.className = "axis";

    const name = document.createElement("span");
    name.className = "axis-name";
    name.textContent = AXIS_NAME[a + b];

    const track = document.createElement("div");
    track.className = "axis-track";

    const left = document.createElement("span");
    left.className = "axis-end";
    left.textContent = a;
    const right = document.createElement("span");
    right.className = "axis-end";
    right.textContent = b;

    const sum = scores[a] + scores[b] || 1;
    const pct = (scores[a] / sum) * 100;
    (scores[a] >= scores[b] ? left : right).classList.add("win");

    const bar = document.createElement("div");
    bar.className = "axis-bar" + (scores[b] > scores[a] ? " flip" : "");
    const l = document.createElement("i");
    l.className = "l";
    const r = document.createElement("i");
    r.className = "r";
    bar.append(l, r);
    bars.push([l, r, pct, i]);

    track.append(left, bar, right);
    row.append(name, track);
    card.appendChild(row);
  });

  push(card);

  requestAnimationFrame(() =>
    setTimeout(() => bars.forEach(([l, r, pct, i]) => {
      setTimeout(() => {
        l.style.width = `${pct}%`;
        r.style.width = `${100 - pct}%`;
      }, reduced ? 0 : i * 180);
    }), reduced ? 0 : 260)
  );

  return card;
}
