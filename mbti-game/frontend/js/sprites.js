/* 등장인물 입상(sprite) — 절차적 실루엣.
 *
 * 실제 일러스트(assets/cast/<key>.webp)가 준비되기 전까지 쓰는 대역이다.
 * 얼굴을 그리지 않는 역광 실루엣이라, 나중에 실사풍 이미지로 바꿔도 톤이 이어진다.
 *
 * 좌표계는 200×340 흉상. 바닥(y=340)에 붙고 위쪽이 머리다.
 */

/* 모든 인물이 공유하는 몸통 — 어깨에서 아래로 퍼지는 사다리꼴 */
const BODY = "M14,340 C14,254 54,208 100,208 C146,208 186,254 186,340 Z";
const HEAD = '<circle cx="100" cy="150" r="41"/>';
const NECK = '<rect x="86" y="182" width="28" height="30" rx="8"/>';

/* 인물별 머리 장식 — 실루엣만으로 누구인지 구분되게 하는 유일한 단서 */
const CROWN = {
  // 뾰족하고 구부러진 마법사 모자 + 챙
  mage:
    '<path d="M44,120 C58,66 78,26 116,10 C130,44 138,84 156,120 Z"/>' +
    '<ellipse cx="100" cy="122" rx="80" ry="15"/>',

  // 투구 + 뒤로 흐르는 깃털 장식
  knight:
    '<path d="M57,158 C57,98 143,98 143,158 L143,178 L57,178 Z"/>' +
    '<path d="M100,104 C122,62 142,48 158,42 C148,74 138,96 126,112 Z"/>' +
    '<rect x="72" y="128" width="56" height="9" rx="4" fill="#000" opacity=".55"/>',

  // 깊은 후드 + 등 뒤의 활
  archer:
    '<path d="M50,168 C50,96 150,96 150,168 C128,142 72,142 50,168 Z"/>' +
    '<path d="M168,120 C196,168 196,246 168,294" fill="none" stroke-width="7"/>' +
    '<path d="M168,120 L168,294" fill="none" stroke-width="3" opacity=".6"/>',

  // 헝클어진 머리
  bandit:
    '<path d="M60,140 L70,104 L82,132 L94,96 L106,130 L118,100 L130,134 L142,110 ' +
    'L146,150 C126,120 74,120 60,140 Z"/>',

  // 긴 수염 + 굽은 어깨
  elder:
    '<path d="M76,172 C66,232 84,272 100,280 C116,272 134,232 124,172 Z"/>' +
    '<path d="M62,128 C70,102 130,102 138,128 C120,116 80,116 62,128 Z"/>',

  // 뿔 + 등 뒤의 날개
  demon:
    '<path d="M64,124 C48,92 40,60 46,34 C66,54 78,88 84,116 Z"/>' +
    '<path d="M136,124 C152,92 160,60 154,34 C134,54 122,88 116,116 Z"/>' +
    '<path d="M186,196 C214,214 226,266 214,318 C190,286 160,266 140,258 Z"/>' +
    '<path d="M14,196 C-14,214 -26,266 -14,318 C10,286 40,266 60,258 Z"/>',
};

/**
 * 인물 실루엣 SVG 마크업을 만든다.
 * @param {string} shape  CROWN 의 키
 * @param {string} accent 림라이트 색
 */
export function silhouette(shape, accent) {
  const id = `sp-${shape}`;
  const shapes = (CROWN[shape] ?? "") + HEAD + NECK + `<path d="${BODY}"/>`;

  return `
<svg viewBox="0 0 200 340" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
  <defs>
    <linearGradient id="${id}-g" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#06050a"/>
      <stop offset="58%" stop-color="#0d0b13"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
    <filter id="${id}-b" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
  </defs>
  <g fill="${accent}" stroke="${accent}" filter="url(#${id}-b)" opacity=".3">${shapes}</g>
  <g fill="url(#${id}-g)" stroke="url(#${id}-g)">${shapes}</g>
</svg>`;
}

export const SHAPES = Object.keys(CROWN);
