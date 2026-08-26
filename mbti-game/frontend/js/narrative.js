/* 내레이션 파서 — 비주얼 노벨의 ADV / NVL 구분을 텍스트에서 끌어낸다.
 *
 * NVL(narration) : 화자가 없는 서술. 명찰 없음, 명조체, 차분한 색
 * ADV(dialogue)  : 큰따옴표로 묶인 인물의 말. 명찰 있음, 강조색
 *
 * 스토리 원문에 화자 메타데이터가 없으므로 큰따옴표와 이름 목록으로 추론한다.
 * 추론에 실패하면 화자 없는 대사로 떨어뜨린다 — 틀린 이름을 붙이는 것보다 낫다.
 */
import { STORY } from "./data.js";

const QUOTE = /"([^"]+)"/g;
const LOOKBACK = 40; // 따옴표 앞에서 화자 이름을 찾을 범위

/* 따옴표 뒤에 공백 없이 이 글자가 붙으면 간접인용이다 — 별도 대사로 떼지 않는다.
   예: 레온은 "…하자"고 제안한다 / 시엔은 "…움직이자"며 맞선다 */
const INDIRECT = /^[고라며면은는이가을를도만]/;

/** 따옴표 앞 문맥에서 화자를 찾는다. 끝나는 위치가 가장 뒤인 이름이 이긴다.
 *  끝이 같으면 더 긴 이름을 택한다 — "궁정 마법사"가 "마법사"에 지지 않도록. */
function speakerFor(before) {
  const tail = before.slice(-LOOKBACK);
  let best = null;
  let bestEnd = -1;

  for (const name of STORY.speakers) {
    const at = tail.lastIndexOf(name);
    if (at === -1) continue;
    const end = at + name.length;
    if (end > bestEnd || (end === bestEnd && name.length > (best?.length ?? 0))) {
      best = name;
      bestEnd = end;
    }
  }
  return best;
}

/**
 * @returns {Array<{type:'narration'|'dialogue', speaker:?string, text:string}>}
 *          narration 의 text 에는 간접인용 따옴표가 그대로 남는다 (render 에서 인라인 강조)
 */
export function parse(text) {
  const out = [];

  for (const para of text.split(/\n{2,}/)) {
    let cursor = 0;
    let m;
    QUOTE.lastIndex = 0;

    while ((m = QUOTE.exec(para)) !== null) {
      const after = para.slice(m.index + m[0].length);

      // 간접인용이면 서술의 일부로 남겨두고 넘어간다
      if (INDIRECT.test(after)) continue;

      const before = para.slice(cursor, m.index).trim();
      if (before) out.push({ type: "narration", speaker: null, text: before });

      out.push({
        type: "dialogue",
        speaker: speakerFor(para.slice(0, m.index)),
        text: m[1].trim(),
      });
      cursor = m.index + m[0].length;
    }

    const rest = para.slice(cursor).trim();
    if (rest) out.push({ type: "narration", speaker: null, text: rest });
  }

  return merge(out);
}

/** 연속된 내레이션은 한 덩어리로 합친다 — 말풍선이 잘게 쪼개지면 읽기 나빠진다 */
function merge(segments) {
  const out = [];
  for (const seg of segments) {
    const prev = out[out.length - 1];
    if (seg.type === "narration" && prev?.type === "narration") {
      prev.text += " " + seg.text;
    } else {
      out.push({ ...seg });
    }
  }
  return out;
}
