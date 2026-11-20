// Sinh bộ ảnh SVG gốc cho gạch phòng và thẻ bài, rồi ghi vào client/public/media/ và manifest.json.
//
//   node tools/generate-art.mjs        (hoặc: npm run art)
//
// Ảnh gạch được vẽ ở góc xoay 0: tường có khoảng hở đúng tại các cạnh có cửa (theo `doors` trong
// server/src/data/tiles.js), nên đổi cửa của một gạch rồi chạy lại script là ảnh tự khớp.
// Sửa bố cục một phòng: xem bảng ROOMS. Sửa hình trên thẻ: xem bảng GLYPHS.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import nodePath from 'node:path';
import { TILES } from '../server/src/data/tiles.js';
import { CARDS } from '../server/src/data/index.js';

const MEDIA = nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), '../client/public/media');
const S = 512;
const WALL = 24;
const DOOR_A = 192;
const DOOR_B = 320;

// ---------------------------------------------------------------- tiện ích

function makeRng(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), h | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Làm sáng (amt > 0) hoặc tối (amt < 0) một màu hex.
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const [r, g, b] = [ch(n >> 16), ch((n >> 8) & 255), ch(n & 255)];
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const f = (n) => Math.round(n * 10) / 10;
const attrs = (o) => Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => ` ${k}="${v}"`).join('');
const rect = (x, y, w, h, fill, o = {}) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}"${attrs(o)}/>`;
const circ = (cx, cy, r, fill, o = {}) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"${attrs(o)}/>`;
const line = (x1, y1, x2, y2, stroke, w = 2, o = {}) =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${stroke}" stroke-width="${w}"${attrs(o)}/>`;
const poly = (pts, fill, o = {}) => `<polygon points="${pts.map((p) => p.map(f).join(',')).join(' ')}" fill="${fill}"${attrs(o)}/>`;
const group = (inner, transform) => `<g transform="${transform}">${inner}</g>`;
const SHADOW = { fill: '#000', opacity: 0.35 };

// ---------------------------------------------------------------- nền sàn

const FLOORS = {
  wood(r, base = '#4b3425', plank = 46) {
    let out = rect(0, 0, S, S, base);
    for (let y = 0, row = 0; y < S; y += plank, row++) {
      let x = -r() * 120;
      while (x < S) {
        const w = 110 + r() * 120;
        out += rect(x, y, w - 2, plank - 2, shade(base, (r() - 0.5) * 0.07));
        out += line(x + 8, y + plank * (0.3 + r() * 0.4), x + w - 12, y + plank * (0.3 + r() * 0.4), shade(base, -0.05), 1, { opacity: 0.6 });
        x += w;
      }
      out += line(0, y, S, y, shade(base, -0.12), 2);
    }
    return out;
  },
  stone(r, base = '#3d3b3a', size = 86) {
    let out = rect(0, 0, S, S, shade(base, -0.08));
    for (let y = 0, row = 0; y < S; y += size, row++) {
      let x = row % 2 ? -size / 2 : 0;
      while (x < S) {
        const w = size * (0.8 + r() * 0.5);
        out += rect(x + 2, y + 2, w - 4, size - 4, shade(base, (r() - 0.5) * 0.08), { rx: 5 });
        x += w;
      }
    }
    return out;
  },
  checker(r, a = '#4a4441', b = '#2a2625', n = 6) {
    let out = rect(0, 0, S, S, a);
    const s = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      out += rect(i * s, j * s, s, s, shade((i + j) % 2 ? b : a, (r() - 0.5) * 0.03));
    }
    return out;
  },
  carpet(r, base = '#4a1f24') {
    let out = rect(0, 0, S, S, shade(base, -0.06));
    out += rect(44, 44, S - 88, S - 88, base);
    out += rect(60, 60, S - 120, S - 120, 'none', { stroke: shade(base, 0.12), 'stroke-width': 3 });
    out += rect(70, 70, S - 140, S - 140, 'none', { stroke: shade(base, 0.06), 'stroke-width': 1.5, 'stroke-dasharray': '10 8' });
    return out;
  },
  ground(r, base = '#3a3024', fleck = '#4a3d2c') {
    let out = rect(0, 0, S, S, base);
    for (let i = 0; i < 90; i++) out += circ(r() * S, r() * S, 3 + r() * 16, shade(fleck, (r() - 0.5) * 0.1), { opacity: 0.5 });
    return out;
  },
};

// ---------------------------------------------------------------- đồ vật (nhìn từ trên xuống)

const P = {
  rug: (x, y, w, h, c = '#5c2328') =>
    rect(x, y, w, h, c, { rx: 6 }) + rect(x + 10, y + 10, w - 20, h - 20, 'none', { stroke: shade(c, 0.16), 'stroke-width': 3, rx: 3 }),
  roundRug: (cx, cy, r, c = '#5c2328') =>
    circ(cx, cy, r, c) + circ(cx, cy, r - 12, 'none', { stroke: shade(c, 0.16), 'stroke-width': 3 }) + circ(cx, cy, r * 0.45, shade(c, -0.06)),
  table: (x, y, w, h, c = '#6b4a2f') =>
    rect(x + 6, y + 8, w, h, '#000', { rx: 6, opacity: 0.35 }) + rect(x, y, w, h, c, { rx: 6 }) + rect(x + 6, y + 6, w - 12, h - 12, shade(c, 0.05), { rx: 3 }),
  roundTable: (cx, cy, r, c = '#6b4a2f') => circ(cx + 5, cy + 7, r, '#000', { opacity: 0.35 }) + circ(cx, cy, r, c) + circ(cx, cy, r - 7, shade(c, 0.05)),
  chair: (cx, cy, c = '#52361f') => rect(cx - 13, cy - 13, 26, 26, '#000', { rx: 5, opacity: 0.3, transform: 'translate(3 4)' }) + rect(cx - 13, cy - 13, 26, 26, c, { rx: 5 }),
  bed(x, y, w, h, head = 'N', c = '#6d2a33') {
    const pillow = { N: [x + 12, y + 10, w - 24, 34], S: [x + 12, y + h - 44, w - 24, 34], W: [x + 10, y + 12, 34, h - 24], E: [x + w - 44, y + 12, 34, h - 24] }[head];
    return rect(x + 6, y + 8, w, h, '#000', { rx: 8, opacity: 0.35 }) + rect(x, y, w, h, '#3a2a1e', { rx: 8 }) +
      rect(x + 6, y + 6, w - 12, h - 12, c, { rx: 6 }) + rect(...pillow, '#d8cdb6', { rx: 8 });
  },
  // Kệ sách / kệ hàng: dir 'h' nằm ngang, 'v' nằm dọc.
  shelf(x, y, w, h, r, palette = ['#7a2d2d', '#2f5d50', '#8a6a2b', '#3b4a6b', '#5b3a5e']) {
    let out = rect(x + 4, y + 6, w, h, '#000', { opacity: 0.35 }) + rect(x, y, w, h, '#33241a');
    const horizontal = w >= h;
    const length = horizontal ? w : h;
    for (let p = 5; p < length - 8;) {
      const t = 7 + r() * 9;
      const c = palette[Math.floor(r() * palette.length)];
      out += horizontal ? rect(x + p, y + 4, t, h - 8, c) : rect(x + 4, y + p, w - 8, t, c);
      p += t + 2;
    }
    return out;
  },
  crate: (x, y, s, c = '#6a4c2c') =>
    rect(x + 5, y + 6, s, s, '#000', { opacity: 0.35 }) + rect(x, y, s, s, c) + rect(x + 5, y + 5, s - 10, s - 10, 'none', { stroke: shade(c, -0.12), 'stroke-width': 4 }) +
    line(x + 5, y + 5, x + s - 5, y + s - 5, shade(c, -0.12), 4),
  barrel: (cx, cy, r, c = '#5d3f25') =>
    circ(cx + 4, cy + 6, r, '#000', { opacity: 0.35 }) + circ(cx, cy, r, c) + circ(cx, cy, r - 5, 'none', { stroke: '#2a1c12', 'stroke-width': 3 }) + circ(cx, cy, r * 0.45, shade(c, 0.07)),
  candle: (cx, cy) => circ(cx, cy, 26, '#f2b84b', { opacity: 0.16 }) + circ(cx, cy, 13, '#f2b84b', { opacity: 0.25 }) + circ(cx, cy, 6, '#e9dfc6') + circ(cx, cy, 2.5, '#ffd978'),
  pillar: (cx, cy, r = 24) => circ(cx + 5, cy + 7, r, '#000', { opacity: 0.4 }) + circ(cx, cy, r, '#6a6660') + circ(cx, cy, r - 7, '#857f76') + circ(cx, cy, r - 15, '#6f6a63'),
  plant(cx, cy, r, rng, c = '#2f5a35') {
    let out = circ(cx + 4, cy + 6, r, '#000', { opacity: 0.3 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      out += circ(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * (0.42 + rng() * 0.2), shade(c, (rng() - 0.5) * 0.14));
    }
    return out + circ(cx, cy, r * 0.3, shade(c, 0.1));
  },
  coffin: (cx, cy, deg = 0) => group(
    poly([[-22, -62], [22, -62], [34, -30], [20, 64], [-20, 64], [-34, -30]], '#000', { opacity: 0.4, transform: 'translate(5 7)' }) +
    poly([[-22, -62], [22, -62], [34, -30], [20, 64], [-20, 64], [-34, -30]], '#3b2a1d') +
    poly([[-15, -52], [15, -52], [24, -28], [13, 54], [-13, 54], [-24, -28]], '#4d382a') + rect(-3, -34, 6, 44, '#8a7a55') + rect(-13, -22, 26, 6, '#8a7a55'),
    `translate(${cx} ${cy}) rotate(${deg})`),
  // Cầu thang: các bậc xếp theo chiều dọc.
  stairs(x, y, w, h, c = '#6b4a2f') {
    let out = rect(x - 8, y, 8, h, '#2a1c12') + rect(x + w, y, 8, h, '#2a1c12');
    const steps = 9;
    for (let i = 0; i < steps; i++) out += rect(x, y + (i * h) / steps, w, h / steps - 3, shade(c, -0.14 + (i / steps) * 0.2));
    return out;
  },
  glow: (cx, cy, r, c = '#ff7a2a') => circ(cx, cy, r, c, { opacity: 0.12 }) + circ(cx, cy, r * 0.6, c, { opacity: 0.18 }) + circ(cx, cy, r * 0.3, c, { opacity: 0.3 }),
  cobweb(corner) {
    const [sx, sy] = [[1, 1], [-1, 1], [-1, -1], [1, -1]][corner];
    const ox = sx > 0 ? WALL : S - WALL;
    const oy = sy > 0 ? WALL : S - WALL;
    let out = '';
    for (const a of [0, 22, 45, 68, 90]) {
      const rad = (a * Math.PI) / 180;
      out += line(ox, oy, ox + sx * Math.cos(rad) * 96, oy + sy * Math.sin(rad) * 96, '#cfc8bb', 1.2, { opacity: 0.45 });
    }
    for (const d of [34, 62, 90]) {
      out += `<path d="M ${ox + sx * d} ${oy} Q ${ox + sx * d * 0.62} ${oy + sy * d * 0.62} ${ox} ${oy + sy * d}" fill="none" stroke="#cfc8bb" stroke-width="1.2" opacity="0.45"/>`;
    }
    return out;
  },
  mirror: (x, y, w, h) => rect(x, y, w, h, '#8a7340') + rect(x + 3, y + 3, w - 6, h - 6, '#9fb6bd') + rect(x + 3, y + 3, (w - 6) * 0.4, (h - 6) * 0.4, '#d6e5e8', { opacity: 0.6 }),
  bench: (x, y, w, h) => rect(x + 4, y + 5, w, h, '#000', { opacity: 0.35, rx: 3 }) + rect(x, y, w, h, '#4c3422', { rx: 3 }) + rect(x, y, w, 5, '#5f432c', { rx: 2 }),
  hole: (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#050403"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#1d130d" stroke-width="5"/>`,
};

// ---------------------------------------------------------------- bố cục từng phòng
// Mỗi phòng: floor = [loại sàn, ...tham số], draw(r) trả về chuỗi SVG các đồ vật.
// Vùng an toàn: tránh giữa các cạnh có cửa; tên phòng do giao diện vẽ đè ở góc trên bên trái.

const ROOMS = {
  'entrance-hall': { floor: ['checker', '#55504b', '#2b2826'], draw: () =>
    P.rug(196, 120, 120, 330, '#5c2328') + P.pillar(110, 150) + P.pillar(402, 150) + P.pillar(110, 370) + P.pillar(402, 370) +
    // Cửa chính đã khoá ở tường phía nam.
    rect(186, S - WALL - 4, 140, WALL + 4, '#3a2415') + rect(190, S - WALL, 64, WALL - 4, '#5a3a22') + rect(258, S - WALL, 64, WALL - 4, '#5a3a22') +
    circ(248, S - 12, 4, '#c9a24a') + circ(264, S - 12, 4, '#c9a24a') },
  foyer: { floor: ['checker', '#4f4a46', '#262322'], draw: () =>
    P.roundRug(256, 256, 104, '#4f2126') + P.pillar(104, 104, 20) + P.pillar(408, 104, 20) + P.pillar(104, 408, 20) + P.pillar(408, 408, 20) + P.candle(256, 256) },
  'grand-staircase': { floor: ['wood', '#4b3425'], draw: () =>
    P.stairs(150, 40, 212, 250) + rect(196, 290, 120, 200, '#5c2328') + rect(206, 290, 100, 200, 'none', { stroke: '#7d3a3f', 'stroke-width': 3 }) +
    P.pillar(128, 310, 16) + P.pillar(384, 310, 16) + P.candle(90, 420) + P.candle(422, 420) },
  'upper-landing': { floor: ['wood', '#503727'], draw: () =>
    rect(210, 30, 92, 452, '#4f2126', { opacity: 0.9 }) + rect(30, 210, 452, 92, '#4f2126', { opacity: 0.9 }) +
    rect(196, 196, 120, 120, '#1a120d') + P.stairs(206, 204, 100, 104) + P.candle(92, 92) + P.candle(420, 420) },
  'basement-landing': { floor: ['stone', '#3a3836'], draw: () =>
    rect(196, 196, 120, 120, '#0d0b0a') + P.stairs(206, 204, 100, 104, '#55504a') + P.crate(60, 60, 54) + P.crate(96, 108, 40) + P.barrel(420, 410, 30) + P.barrel(376, 436, 22) },

  'dining-room': { floor: ['wood', '#4a3223'], draw: () =>
    P.rug(110, 170, 250, 220, '#3f2a45') + P.table(150, 220, 170, 120) +
    [180, 235, 290].map((x) => P.chair(x, 196) + P.chair(x, 364)).join('') + P.chair(124, 280) + P.chair(346, 280) +
    P.candle(200, 280) + P.candle(270, 280) + P.shelf(70, 440, 200, 30, makeRng('dining')) },
  'game-room': { floor: ['carpet', '#22382c'], draw: () =>
    rect(166, 190, 200, 120, '#000', { opacity: 0.35, rx: 10, transform: 'translate(6 8)' }) + rect(166, 190, 200, 120, '#4a2f1c', { rx: 10 }) + rect(178, 202, 176, 96, '#1f6b45', { rx: 4 }) +
    [[180, 204], [266, 202], [352, 204], [180, 296], [266, 298], [352, 296]].map(([x, y]) => circ(x, y, 7, '#0b0a09')).join('') +
    circ(240, 250, 5, '#e9dfc6') + circ(300, 240, 5, '#b13a2e') + circ(312, 262, 5, '#d6a531') + line(200, 320, 330, 340, '#c9a26a', 3) +
    P.roundTable(86, 250, 30) + P.chair(86, 204) + P.chair(86, 296) },
  attic: { floor: ['wood', '#3a2a20', 54], draw: (r) =>
    P.crate(360, 50, 70) + P.crate(400, 124, 50) + P.crate(300, 60, 46) + P.cobweb(0) + P.cobweb(1) +
    rect(250, 240, 120, 70, '#000', { opacity: 0.35, rx: 8, transform: 'translate(5 7)' }) + rect(250, 240, 120, 70, '#4d3320', { rx: 8 }) + rect(250, 268, 120, 8, '#8a7340') + rect(304, 262, 14, 20, '#c9a24a') +
    line(0, 170, S, 170, '#1d130d', 14, { opacity: 0.45 }) + line(0, 350, S, 350, '#1d130d', 14, { opacity: 0.45 }) + P.barrel(410, 420, 26) + circ(120 + r() * 20, 300, 3, '#cfc8bb', { opacity: 0.4 }) },
  'master-bedroom': { floor: ['carpet', '#3c2340'], draw: () =>
    P.bed(300, 170, 170, 190, 'E', '#7a2a36') + rect(416, 120, 46, 40, '#4c3422', { rx: 4 }) + rect(416, 370, 46, 40, '#4c3422', { rx: 4 }) + P.candle(439, 140) + P.candle(439, 390) +
    P.roundRug(190, 266, 70, '#5c2328') + P.shelf(110, 446, 250, 34, makeRng('wardrobe'), ['#3a2a1e', '#4c3422', '#2e2118']) + P.mirror(40, 420, 10, 60) },
  crypt: { floor: ['stone', '#34363a'], draw: () =>
    P.coffin(100, 256, 0) + P.coffin(412, 256, 0) + rect(60, 60, 80, 16, '#55585c') + rect(372, 60, 80, 16, '#55585c') + rect(60, 436, 80, 16, '#55585c') + rect(372, 436, 80, 16, '#55585c') +
    P.candle(180, 150) + P.candle(332, 150) + P.candle(180, 362) + P.candle(332, 362) + P.cobweb(1) + P.cobweb(3) },
  'ritual-chamber': { floor: ['stone', '#2f2c30'], draw: () =>
    circ(256, 236, 120, 'none', { stroke: '#8b1a1a', 'stroke-width': 6 }) + circ(256, 236, 104, 'none', { stroke: '#8b1a1a', 'stroke-width': 2 }) +
    poly([0, 2, 4, 1, 3].map((i) => [256 + Math.sin((i * 2 * Math.PI) / 5) * 104, 236 - Math.cos((i * 2 * Math.PI) / 5) * 104]), 'none', { stroke: '#8b1a1a', 'stroke-width': 4 }) +
    [0, 1, 2, 3, 4].map((i) => P.candle(256 + Math.sin((i * 2 * Math.PI) / 5) * 120, 236 - Math.cos((i * 2 * Math.PI) / 5) * 120)).join('') +
    P.table(176, 420, 160, 56, '#3d3a3d') + circ(256, 448, 12, '#8b1a1a') },
  'servants-quarters': { floor: ['wood', '#46342a'], draw: () =>
    P.bed(40, 40, 76, 130, 'N', '#4a5560') + P.bed(396, 40, 76, 130, 'N', '#4a5560') + P.bed(40, 342, 76, 130, 'S', '#4a5560') + P.bed(396, 342, 76, 130, 'S', '#4a5560') +
    P.rug(190, 196, 132, 120, '#4a4130') + P.crate(124, 60, 38, '#55402b') + P.crate(350, 414, 38, '#55402b') },
  'abandoned-room': { floor: ['wood', '#3b2e27'], draw: () =>
    P.hole(150, 330, 46, 30) + P.hole(360, 170, 34, 24) + P.cobweb(0) + P.cobweb(1) + P.cobweb(2) + P.cobweb(3) +
    group(P.chair(0, 0, '#4a3524') + line(-13, -18, 13, -18, '#4a3524', 6), 'translate(330 350) rotate(32)') +
    group(rect(-60, -8, 120, 16, '#2a1e16') , 'translate(190 150) rotate(-18)') + rect(380, 400, 70, 50, '#55504a', { opacity: 0.5, rx: 4 }) },
  'mirror-gallery': { floor: ['wood', '#33251e'], draw: () =>
    rect(206, 0, 100, S, '#4f2126') + rect(216, 0, 80, S, 'none', { stroke: '#7d3a3f', 'stroke-width': 2 }) +
    [70, 190, 310, 430].map((y) => P.mirror(WALL, y - 44, 12, 88) + P.mirror(S - WALL - 12, y - 44, 12, 88)).join('') +
    [130, 250, 370].map((y) => P.candle(70, y) + P.candle(442, y)).join('') },

  conservatory: { floor: ['stone', '#44463f'], draw: (r) =>
    circ(256, 266, 72, '#6f6a63') + circ(256, 266, 60, '#2c5560') + circ(256, 266, 44, '#35697a') + circ(256, 266, 12, '#857f76') +
    P.plant(420, 100, 44, r) + P.plant(430, 220, 34, r) + P.plant(424, 340, 40, r) + P.plant(410, 432, 40, r) + P.plant(300, 440, 34, r) +
    P.plant(180, 444, 38, r) + P.plant(80, 430, 40, r) + P.plant(380, 60, 26, r, '#3d6a2f') },
  ballroom: { floor: ['wood', '#59402c', 34], draw: () =>
    circ(256, 256, 150, 'none', { stroke: '#2a1c12', 'stroke-width': 8 }) + circ(256, 256, 138, '#6b4e36', { opacity: 0.55 }) +
    poly([[256, 130], [282, 230], [382, 256], [282, 282], [256, 382], [230, 282], [130, 256], [230, 230]], '#3a2718', { opacity: 0.8 }) +
    circ(256, 256, 26, '#c9a24a', { opacity: 0.5 }) + P.glow(256, 256, 120, '#f2b84b') +
    P.pillar(90, 90, 18) + P.pillar(422, 90, 18) + P.pillar(90, 422, 18) + P.pillar(422, 422, 18) },
  bedroom: { floor: ['carpet', '#2d3a4a'], draw: () =>
    P.bed(186, 36, 140, 190, 'N', '#48607a') + rect(120, 44, 50, 44, '#4c3422', { rx: 4 }) + rect(342, 44, 50, 44, '#4c3422', { rx: 4 }) + P.candle(145, 66) +
    P.rug(176, 250, 160, 90, '#5a4a36') + P.shelf(150, 446, 212, 34, makeRng('dresser'), ['#3a2a1e', '#4c3422']) },
  nursery: { floor: ['wood', '#5a4532'], draw: () =>
    P.roundRug(270, 290, 88, '#3d5a6b') + rect(40, 180, 90, 150, '#000', { opacity: 0.3, rx: 6, transform: 'translate(5 7)' }) + rect(40, 180, 90, 150, '#d8cdb6', { rx: 6 }) +
    rect(50, 190, 70, 130, '#9fb6bd', { rx: 4 }) + [0, 1, 2, 3, 4, 5].map((i) => line(40, 198 + i * 24, 130, 198 + i * 24, '#d8cdb6', 3)).join('') +
    rect(240, 262, 24, 24, '#b13a2e') + rect(270, 286, 24, 24, '#d6a531') + rect(292, 258, 24, 24, '#3b6e8a') + circ(330, 320, 14, '#7a9a4a') +
    group(rect(-34, -12, 68, 24, '#8a6a4a', { rx: 12 }) + circ(-20, 0, 14, '#a07c58'), 'translate(390 430) rotate(-20)') },
  'creaky-hallway': { floor: ['wood', '#3f2d22', 38], draw: (r) =>
    Array.from({ length: 9 }, () => line(40 + r() * 430, 40 + r() * 430, 60 + r() * 430, 44 + r() * 430, '#120c08', 3, { opacity: 0.7 })).join('') +
    P.hole(390, 400, 26, 14) + P.candle(80, 80) },
  'dusty-hallway': { floor: ['wood', '#4a4038'], draw: (r) =>
    Array.from({ length: 60 }, () => circ(30 + r() * 450, 30 + r() * 450, 6 + r() * 26, '#b8ab90', { opacity: 0.05 })).join('') +
    [0, 1, 2, 3, 4].map((i) => `<ellipse cx="${200 + i * 28}" cy="${330 - i * 34 + (i % 2) * 22}" rx="9" ry="16" fill="#1d1612" opacity="0.5" transform="rotate(38 ${200 + i * 28} ${330 - i * 34})"/>`).join('') +
    P.table(60, 60, 70, 40, '#55402b') + P.cobweb(1) },
  'wine-cellar': { floor: ['stone', '#383331'], draw: (r) =>
    [44, 432].map((x) => rect(x, 60, 36, 392, '#2a1c12') + Array.from({ length: 12 }, (_, i) => circ(x + 18, 78 + i * 32, 11, shade('#3d1220', r() * 0.1)) + circ(x + 18, 78 + i * 32, 4, '#1a0a10')).join('')).join('') +
    P.barrel(150, 150, 34) + P.barrel(150, 230, 34) + P.barrel(362, 300, 34) + P.barrel(362, 380, 34) + P.candle(256, 256) },
  'furnace-room': { floor: ['stone', '#3a3432'], draw: () =>
    P.glow(430, 256, 190) + rect(392, 160, 96, 192, '#1c1917', { rx: 6 }) + rect(404, 176, 60, 160, '#2b2623', { rx: 4 }) + rect(404, 220, 22, 72, '#ff7a2a') + rect(408, 232, 12, 48, '#ffd27a') +
    line(440, 160, 440, WALL, '#55504a', 16) + line(470, 352, 470, S - WALL, '#55504a', 12) +
    [[300, 400, 20], [326, 420, 16], [282, 430, 14], [312, 444, 18], [344, 446, 12]].map(([x, y, s]) => circ(x, y, s, '#141211')).join('') },
  tower: { floor: ['stone', '#42403d', 70], draw: () =>
    [200, 150, 100, 50].map((rad, i) => circ(256, 256, rad, i % 2 ? '#4a4844' : '#3a3836', { stroke: '#22201e', 'stroke-width': 4 })).join('') +
    [0, 45, 90, 135].map((a) => line(256 + Math.cos((a * Math.PI) / 180) * 200, 256 + Math.sin((a * Math.PI) / 180) * 200, 256 - Math.cos((a * Math.PI) / 180) * 200, 256 - Math.sin((a * Math.PI) / 180) * 200, '#22201e', 3)).join('') +
    rect(196, 0, 120, WALL, '#7c97a8') + rect(196, S - WALL, 120, WALL, '#7c97a8') + rect(196, WALL, 120, 60, '#9fb6bd', { opacity: 0.12 }) + rect(196, S - WALL - 60, 120, 60, '#9fb6bd', { opacity: 0.12 }) },
  garden: { floor: ['ground', '#27351f', '#35482a'], draw: (r) =>
    rect(206, 0, 100, S, '#55504a') + Array.from({ length: 11 }, (_, i) => rect(212 + (i % 2) * 44, i * 48 + 4, 42, 40, shade('#6a655d', (r() - 0.5) * 0.08), { rx: 6 })).join('') +
    [[90, 110], [70, 250], [100, 400], [420, 120], [440, 280], [410, 410]].map(([x, y]) => P.plant(x, y, 38, r, '#2c4a2a') + circ(x - 10, y - 8, 6, '#8b1a1a') + circ(x + 12, y + 6, 5, '#b8ab90')).join('') +
    circ(150, 330, 16, '#2a1c12') + [0, 60, 130, 200, 290].map((a) => line(150, 330, 150 + Math.cos((a * Math.PI) / 180) * 60, 330 + Math.sin((a * Math.PI) / 180) * 60, '#2a1c12', 5)).join('') },

  kitchen: { floor: ['checker', '#6a6358', '#3a352f', 8], draw: () =>
    rect(WALL, 60, 70, 400, '#4c3a2a') + rect(WALL + 6, 66, 58, 388, '#8a8378') +
    rect(34, 90, 50, 90, '#2b2826', { rx: 4 }) + [[48, 110], [70, 110], [48, 150], [70, 150]].map(([x, y]) => circ(x, y, 9, '#141211') + circ(x, y, 4, '#b13a2e')).join('') +
    rect(36, 330, 46, 80, '#55606a', { rx: 6 }) + circ(59, 346, 5, '#22201e') +
    P.table(190, 220, 150, 100) + circ(230, 256, 16, '#e9dfc6') + circ(300, 286, 16, '#e9dfc6') + rect(256, 240, 40, 8, '#9aa3a8') + P.chair(264, 344) + P.chair(264, 196) },
  storeroom: { floor: ['wood', '#42311f'], draw: () =>
    P.crate(40, 150, 76) + P.crate(60, 240, 60) + P.crate(40, 380, 84) + P.crate(140, 410, 56) + P.crate(396, 140, 70) + P.crate(410, 226, 54) +
    P.barrel(420, 420, 36) + P.barrel(350, 440, 28) + P.barrel(230, 440, 30) + P.crate(300, 250, 44, '#55402b') },
  larder: { floor: ['stone', '#3d3a36'], draw: (r) =>
    P.shelf(WALL, 50, 40, 412, r, ['#8a6a2b', '#7a2d2d', '#b8ab90', '#4a6a3a', '#5d3f25']) + P.shelf(S - WALL - 40, 50, 40, 412, r, ['#8a6a2b', '#7a2d2d', '#b8ab90', '#4a6a3a', '#5d3f25']) +
    [[150, 160, 30], [180, 210, 24], [350, 330, 32], [320, 380, 22]].map(([x, y, s]) => circ(x + 4, y + 6, s, '#000', { opacity: 0.3 }) + circ(x, y, s, '#8a7a5a') + circ(x, y, 6, '#5d5038')).join('') +
    P.barrel(160, 380, 28) + P.crate(330, 130, 46) },
  study: { floor: ['carpet', '#263a30'], draw: (r) =>
    P.shelf(60, WALL, 392, 36, r) + P.shelf(S - WALL - 36, 80, 36, 330, r) + P.table(170, 210, 170, 90, '#5a3a22') +
    rect(196, 228, 56, 40, '#e9dfc6', { transform: 'rotate(-6 224 248)' }) + rect(270, 236, 30, 40, '#7a2d2d') + P.candle(318, 226) + P.chair(256, 330) + P.roundRug(120, 400, 46, '#5c2328') },
  vault: { floor: ['checker', '#4a4d50', '#3a3d40', 4], draw: () =>
    rect(150, 340, 212, 150, '#000', { opacity: 0.4, rx: 8, transform: 'translate(6 0)' }) + rect(150, 340, 212, 150, '#5a6066', { rx: 8 }) + rect(166, 356, 180, 120, '#454a4f', { rx: 4 }) +
    circ(256, 416, 34, '#6b7178') + circ(256, 416, 22, '#3a3d40') + [0, 60, 120].map((a) => line(256 - Math.cos((a * Math.PI) / 180) * 34, 416 - Math.sin((a * Math.PI) / 180) * 34, 256 + Math.cos((a * Math.PI) / 180) * 34, 416 + Math.sin((a * Math.PI) / 180) * 34, '#9aa3a8', 4)).join('') +
    P.crate(50, 150, 64, '#5a4a2a') + circ(82, 182, 14, '#c9a24a') + [[400, 180], [424, 200], [396, 214], [430, 170]].map(([x, y]) => circ(x, y, 9, '#c9a24a') + circ(x, y, 5, '#e6c76a')).join('') +
    [60, 110, 400, 450].map((x) => line(x, 300, x, 320, '#22201e', 0)).join('') },
  'sewing-room': { floor: ['wood', '#553f2e'], draw: () =>
    P.table(WALL + 10, 170, 80, 180, '#6b4a2f') + rect(52, 220, 44, 70, '#2b2826', { rx: 6 }) + circ(74, 236, 8, '#9aa3a8') +
    [[60, 190, '#7a2d2d'], [84, 192, '#3b6e8a'], [64, 322, '#d6a531'], [88, 326, '#4a6a3a']].map(([x, y, c]) => circ(x, y, 9, c) + circ(x, y, 3, '#e9dfc6')).join('') +
    `<ellipse cx="300" cy="250" rx="34" ry="24" fill="#000" opacity="0.3" transform="translate(5 7)"/><ellipse cx="300" cy="250" rx="34" ry="24" fill="#b8ab90"/>` + circ(300, 250, 10, '#8a7a5a') +
    [[200, 400, '#7a2d2d'], [240, 410, '#3b4a6b'], [280, 398, '#5b3a5e']].map(([x, y, c]) => rect(x, y, 30, 70, c, { rx: 15, transform: `rotate(70 ${x + 15} ${y + 35})` })).join('') + P.rug(190, 190, 220, 130, '#4a4130').replace('<rect', '<rect opacity="0.5"') },
  workshop: { floor: ['wood', '#4f3a26'], draw: () =>
    P.table(60, WALL + 8, 392, 64, '#5a4630') + [90, 140, 190].map((x) => line(x, 44, x + 30, 80, '#9aa3a8', 5)).join('') + rect(260, 44, 60, 16, '#7a2d2d') + circ(390, 64, 16, '#9aa3a8') + circ(390, 64, 5, '#22201e') +
    P.table(190, 220, 140, 100, '#6b5338') + circ(260, 270, 34, '#b9c0c4') + circ(260, 270, 8, '#22201e') +
    [0, 1, 2, 3].map((i) => rect(70 + i * 5, 330 + i * 14, 90, 12, shade('#c9a26a', -i * 0.05), { transform: `rotate(-8 115 ${336 + i * 14})` })).join('') +
    Array.from({ length: 30 }, (_, i) => circ(200 + ((i * 53) % 150), 330 + ((i * 29) % 50), 2.5, '#d9bc8a', { opacity: 0.7 })).join('') },

  library: { floor: ['carpet', '#3a2620'], draw: (r) =>
    P.shelf(60, WALL, 392, 36, r) + P.shelf(S - WALL - 36, 80, 36, 320, r) + P.shelf(90, 150, 200, 30, r) + P.shelf(90, 230, 200, 30, r) +
    P.roundTable(350, 300, 44) + P.chair(350, 240) + rect(332, 288, 36, 26, '#e9dfc6', { transform: 'rotate(12 350 300)' }) + P.candle(372, 316) + P.shelf(200, 440, 220, 30, r) },
  chapel: { floor: ['stone', '#45423f'], draw: () =>
    rect(206, 0, 100, S, '#4f2126', { opacity: 0.85 }) +
    [110, 170, 230, 290, 350, 410].map((y) => P.bench(44, y - 12, 140, 24) + P.bench(328, y - 12, 140, 24)).join('') +
    P.candle(196, 70) + P.candle(316, 70) + P.candle(196, 442) + P.candle(316, 442) +
    rect(40, 44, 10, 40, '#7c97a8', { opacity: 0.7 }) + rect(462, 44, 10, 40, '#b13a2e', { opacity: 0.7 }) },
  gym: { floor: ['wood', '#5c4631', 30], draw: () =>
    rect(150, 200, 220, 170, '#2d4a5a', { rx: 6 }) + rect(160, 210, 200, 150, 'none', { stroke: '#4a6f84', 'stroke-width': 3 }) +
    rect(70, WALL + 6, 300, 30, '#2b2826') + [100, 160, 220, 280, 340].map((x) => rect(x - 18, WALL + 12, 8, 18, '#6b7178') + rect(x + 10, WALL + 12, 8, 18, '#6b7178') + line(x - 10, WALL + 21, x + 10, WALL + 21, '#9aa3a8', 4)).join('') +
    circ(80, 300, 30, '#000', { opacity: 0.35 }) + circ(76, 294, 30, '#6a2a22') + circ(76, 294, 8, '#22201e') + circ(430, 80, 22, '#8a6a2b') + circ(430, 80, 12, '#c9a24a', { opacity: 0.6 }) },
  tunnel: { floor: ['ground', '#2e2822', '#3d352c'], draw: (r) =>
    Array.from({ length: 10 }, (_, i) => rect(20 + i * 50, 200, 16, 112, '#3a2a1e')).join('') + line(0, 218, S, 218, '#6b7178', 6) + line(0, 294, S, 294, '#6b7178', 6) +
    Array.from({ length: 14 }, () => { const top = r() < 0.5; return circ(40 + r() * 430, top ? 50 + r() * 90 : 372 + r() * 90, 12 + r() * 26, shade('#4a443d', (r() - 0.5) * 0.1)); }).join('') +
    rect(100, WALL, 20, 160, '#33241a') + rect(392, WALL, 20, 160, '#33241a') + rect(100, 328, 20, 160, '#33241a') + rect(392, 328, 20, 160, '#33241a') },

  // ---- Phòng bổ sung
  'ancestral-hall': { floor: ['wood', '#4a2e22'], draw: () =>
    P.table(WALL + 6, 150, 70, 212, '#5a1f1a') + rect(WALL + 14, 160, 54, 192, '#7a2d22', { rx: 3 }) +
    [180, 220, 260, 300, 340].map((y) => rect(WALL + 22, y - 14, 16, 30, '#c9a24a', { rx: 3 }) + rect(WALL + 25, y - 10, 10, 22, '#3a1a12')).join('') +
    circ(WALL + 56, 256, 14, '#8a7340') + [250, 256, 262].map((x) => line(WALL + 56 + (x - 256), 256, WALL + 56 + (x - 256) * 2, 236, '#b8ab90', 2)).join('') +
    P.candle(WALL + 50, 176) + P.candle(WALL + 50, 336) + P.rug(150, 196, 200, 120, '#5c2328') +
    [[200, 256], [260, 256], [320, 256]].map(([x, y]) => circ(x, y, 18, '#3a2a3a') + circ(x, y, 12, '#4d3a4d')).join('') + P.cobweb(2) },
  'doll-room': { floor: ['wood', '#5a4232'], draw: (r) =>
    P.shelf(60, WALL, 392, 34, r, ['#d8cdb6', '#b13a2e', '#8a6a4a', '#3b6e8a', '#e9dfc6']) + P.shelf(S - WALL - 34, 80, 34, 340, r, ['#d8cdb6', '#b13a2e', '#8a6a4a', '#e9dfc6']) +
    P.roundRug(220, 250, 80, '#6b3a4a') +
    [[180, 220, 0], [250, 200, 30], [270, 290, -40], [190, 300, 70]].map(([x, y, a]) => group(
      `<ellipse cx="0" cy="12" rx="14" ry="20" fill="#7a2d2d"/>` + circ(0, -14, 13, '#e9dfc6') + circ(-4, -16, 2.5, '#151211') + circ(4, -16, 2.5, '#151211'), `translate(${x} ${y}) rotate(${a})`)).join('') +
    rect(80, 400, 80, 60, '#000', { opacity: 0.3, rx: 6, transform: 'translate(5 7)' }) + rect(80, 400, 80, 60, '#d8cdb6', { rx: 6 }) + rect(88, 408, 64, 44, '#9fb6bd', { rx: 4 }) + P.cobweb(2) },
  'dry-well': { floor: ['stone', '#36332f'], draw: (r) =>
    circ(260, 262, 92, '#000', { opacity: 0.35 }) + circ(256, 256, 90, '#5a554e') + circ(256, 256, 74, '#6a655d') + circ(256, 256, 62, '#050403') +
    circ(256, 256, 62, 'none', { stroke: '#1d130d', 'stroke-width': 6 }) + line(150, 170, 362, 170, '#4c3422', 12) + rect(244, 170, 24, 60, '#3a2415') + line(256, 230, 256, 250, '#b8ab90', 3) +
    Array.from({ length: 12 }, () => circ(60 + r() * 390, 360 + r() * 110, 6 + r() * 14, shade('#4a443d', (r() - 0.5) * 0.12))).join('') + P.cobweb(2) + P.cobweb(3) },
  courtyard: { floor: ['ground', '#2c3a22', '#3a4a2c'], draw: (r) =>
    rect(206, 0, 100, S, '#55504a') + rect(0, 206, S, 100, '#55504a') + circ(256, 256, 76, '#55504a') +
    P.plant(256, 256, 62, r, '#2f4a2a') + circ(256, 256, 16, '#3a2a1e') +
    [[100, 100], [412, 100], [100, 412], [412, 412]].map(([x, y]) => P.plant(x, y, 46, r, '#2c4a2a')).join('') +
    [[150, 380], [380, 150]].map(([x, y]) => P.bench(x - 40, y - 10, 80, 20)).join('') },
  'music-room': { floor: ['wood', '#4d3626', 34], draw: () =>
    rect(90, 46, 200, 120, '#000', { opacity: 0.35, rx: 10, transform: 'translate(6 8)' }) + path('M 90 56 Q 90 46 100 46 L 280 46 Q 290 46 290 56 L 290 120 Q 250 166 160 166 L 100 166 Q 90 166 90 156 Z', { fill: '#151211' }) +
    rect(96, 140, 180, 22, '#e9dfc6') + Array.from({ length: 13 }, (_, i) => rect(102 + i * 13, 140, 7, 13, '#151211')).join('') + P.chair(186, 196, '#3a2415') +
    path('M 380 350 Q 420 300 410 230 L 440 230 L 440 440 L 380 440 Z', { fill: '#8a7340' }) + [0, 1, 2, 3, 4].map((i) => line(392 + i * 10, 330 - i * 20, 392 + i * 10, 440, '#e9dfc6', 1.5)).join('') +
    P.roundRug(220, 350, 70, '#3f2a45') + group(path('M -50 -12 Q -10 -30 50 -6 L 50 6 Q -10 30 -50 12 Z', { fill: '#7a4a2a' }) + line(-46, 0, 56, 0, '#d6a531', 1.5), 'translate(220 350) rotate(-25)') + P.candle(80, 440) },
  bathroom: { floor: ['checker', '#7a7670', '#4a4743', 10], draw: () =>
    rect(150, 340, 212, 130, '#000', { opacity: 0.35, rx: 50, transform: 'translate(6 8)' }) + rect(150, 340, 212, 130, '#d8d4ca', { rx: 50 }) + rect(166, 356, 180, 98, '#6a1a1a', { rx: 40 }) +
    path('M 190 380 Q 230 370 260 400 Q 300 420 330 400', stroke(3, '#8b1a1a')) + rect(244, 446, 24, 20, '#9aa3a8') +
    rect(WALL + 6, 90, 70, 60, '#d8d4ca', { rx: 8 }) + `<ellipse cx="${WALL + 41}" cy="120" rx="22" ry="16" fill="#9aa3a8"/>` + circ(WALL + 41, 122, 4, '#22201e') + P.mirror(WALL, 70, 8, 100) +
    rect(400, 80, 60, 74, '#d8d4ca', { rx: 24 }) + rect(408, 54, 44, 30, '#d8d4ca', { rx: 6 }) +
    [[300, 260, 10], [320, 300, 6], [280, 310, 7]].map(([x, y, s]) => circ(x, y, s, '#8b1a1a', { opacity: 0.7 })).join('') },
  'collapsed-corridor': { floor: ['wood', '#3e2e24', 40], draw: (r) =>
    poly([[WALL, 60], [190, 120], [210, 200], [150, 300], [180, 420], [WALL, 470]], '#2b2420') +
    poly([[S - WALL, 40], [330, 150], [360, 250], [310, 330], [350, 470], [S - WALL, 480]], '#2b2420') +
    Array.from({ length: 22 }, () => { const left = r() < 0.5; return rect(left ? 40 + r() * 140 : 320 + r() * 150, 60 + r() * 400, 14 + r() * 26, 10 + r() * 16, shade('#6a5a4a', (r() - 0.5) * 0.15), { transform: `rotate(${Math.round(r() * 90)} 256 256)`, opacity: 0.9 }); }).join('') +
    group(rect(-130, -9, 260, 18, '#4c3422'), 'translate(256 230) rotate(28)') + P.hole(280, 380, 30, 18) + P.cobweb(0) },
  laundry: { floor: ['stone', '#47463f', 64], draw: () =>
    [[90, 380], [180, 430]].map(([x, y]) => circ(x + 5, y + 7, 46, '#000', { opacity: 0.35 }) + circ(x, y, 46, '#6b7178') + circ(x, y, 36, '#3b4a6b') + circ(x - 10, y - 8, 10, '#d6e5e8', { opacity: 0.4 })).join('') +
    line(60, 90, 360, 90, '#b8ab90', 2) + line(60, 150, 360, 150, '#b8ab90', 2) +
    [[90, 90, '#d8cdb6'], [150, 90, '#7a2d2d'], [230, 90, '#3b6e8a'], [300, 90, '#d8cdb6'], [110, 150, '#5b3a5e'], [200, 150, '#d8cdb6'], [280, 150, '#4a6a3a']].map(([x, y, c]) => rect(x - 22, y, 44, 34, c, { opacity: 0.9 })).join('') +
    [[380, 400], [440, 330]].map(([x, y]) => `<ellipse cx="${x + 4}" cy="${y + 6}" rx="36" ry="28" fill="#000" opacity="0.3"/><ellipse cx="${x}" cy="${y}" rx="36" ry="28" fill="#8a6a3a"/><ellipse cx="${x}" cy="${y}" rx="26" ry="18" fill="#d8cdb6"/>`).join('') },
  'cold-room': { floor: ['checker', '#7f8a90', '#5d686e', 6], draw: (r) =>
    [70, 140, 370, 440].map((x) => line(x, 40, x, 470, '#9aa3a8', 6)).join('') +
    [[70, 100], [70, 260], [140, 180], [140, 380], [370, 140], [370, 330], [440, 230], [440, 420]].map(([x, y]) =>
      `<ellipse cx="${x + 4}" cy="${y + 6}" rx="18" ry="34" fill="#000" opacity="0.35"/><ellipse cx="${x}" cy="${y}" rx="18" ry="34" fill="#7a3a3a"/><ellipse cx="${x}" cy="${y}" rx="10" ry="22" fill="#b86a6a"/>` + line(x, y - 34, x, y - 44, '#d6e5e8', 3)).join('') +
    Array.from({ length: 40 }, () => circ(30 + r() * 450, 30 + r() * 450, 3 + r() * 10, '#e6f2f6', { opacity: 0.18 })).join('') + P.glow(256, 256, 160, '#9fd6e8') },
  'rotten-balcony': { floor: ['wood', '#3a2b20', 52], draw: (r) =>
    rect(0, 0, S, 120, '#14181f') + Array.from({ length: 18 }, () => circ(r() * S, r() * 110, 1.5, '#e9dfc6', { opacity: 0.7 })).join('') + circ(420, 60, 26, '#e9dfc6', { opacity: 0.8 }) +
    rect(0, 112, S, 14, '#2a1c12') + Array.from({ length: 16 }, (_, i) => rect(10 + i * 32, 120, 8, 24, '#2a1c12')).join('') + rect(0, 140, S, 10, '#2a1c12') +
    P.hole(150, 260, 50, 28) + P.hole(370, 330, 38, 22) + P.hole(240, 420, 22, 14) +
    group(rect(-60, -10, 120, 20, '#2a1e16'), 'translate(150 330) rotate(24)') + P.plant(70, 400, 30, r, '#2f3a22') },
};

// ---------------------------------------------------------------- gạch phòng

function walls(doors, id) {
  const c = '#120e0c';
  const edge = '#2c2420';
  let out = '';
  // Mỗi cạnh là một dải tường; cạnh có cửa thì chừa khoảng hở ở giữa và vẽ bậc cửa.
  const sides = [
    (a, b) => rect(a, 0, b - a, WALL, c) + line(a, WALL, b, WALL, edge, 3),
    (a, b) => rect(S - WALL, a, WALL, b - a, c) + line(S - WALL, a, S - WALL, b, edge, 3),
    (a, b) => rect(a, S - WALL, b - a, WALL, c) + line(a, S - WALL, b, S - WALL, edge, 3),
    (a, b) => rect(0, a, WALL, b - a, c) + line(WALL, a, WALL, b, edge, 3),
  ];
  const sill = [
    rect(DOOR_A, 0, DOOR_B - DOOR_A, WALL, '#7a5c36'), rect(S - WALL, DOOR_A, WALL, DOOR_B - DOOR_A, '#7a5c36'),
    rect(DOOR_A, S - WALL, DOOR_B - DOOR_A, WALL, '#7a5c36'), rect(0, DOOR_A, WALL, DOOR_B - DOOR_A, '#7a5c36'),
  ];
  for (let d = 0; d < 4; d++) {
    if (doors.includes(d)) out += sill[d] + sides[d](0, DOOR_A) + sides[d](DOOR_B, S);
    else out += sides[d](0, S);
  }
  return out;
}

function tileSvg(tile) {
  const room = ROOMS[tile.id];
  if (!room) throw new Error(`Chưa có bố cục cho gạch ${tile.id} – thêm vào bảng ROOMS.`);
  const r = makeRng(tile.id);
  const [kind, ...args] = room.floor;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
<defs><radialGradient id="v" cx="50%" cy="50%" r="72%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.62"/></radialGradient></defs>
${FLOORS[kind](r, ...args)}
${room.draw(r)}
<rect width="${S}" height="${S}" fill="url(#v)"/>
${walls(tile.doors, tile.id)}
</svg>
`;
}

// ---------------------------------------------------------------- thẻ bài

const INK = '#e7dcc3';
const stroke = (w = 6, c = INK) => ({ fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
const path = (d, o) => `<path d="${d}"${attrs(o)}/>`;

// Hình vẽ ở giữa thẻ, trong khung 200×200 (gốc toạ độ ở góc trên trái).
const GLYPHS = {
  // --- Điềm báo
  'om-leather-journal': () => rect(48, 30, 104, 140, '#5a3a22', { rx: 8 }) + rect(48, 30, 16, 140, '#3a2415', { rx: 6 }) + rect(126, 30, 10, 140, '#8a7340') + circ(131, 100, 9, '#c9a24a') + rect(78, 60, 36, 6, INK, { opacity: 0.5 }),
  'om-porcelain-mask': () => `<ellipse cx="100" cy="100" rx="56" ry="72" fill="${INK}"/><ellipse cx="78" cy="88" rx="13" ry="8" fill="#151211"/><ellipse cx="122" cy="88" rx="13" ry="8" fill="#151211"/>` +
    path('M 84 136 Q 100 146 116 136', stroke(4, '#8b1a1a')) + path('M 120 40 L 112 70 L 124 84', stroke(2, '#151211')),
  'om-ritual-knife': () => group(poly([[0, -80], [14, -10], [0, 0], [-14, -10]], '#c7ccd0') + line(0, -76, 0, -6, '#8f979c', 2) + rect(-26, 0, 52, 10, '#8a7340', { rx: 3 }) + rect(-8, 10, 16, 56, '#3a2415', { rx: 4 }) + circ(0, 72, 9, '#8b1a1a'), 'translate(100 104) rotate(35)'),
  'om-engraved-ring': () => circ(100, 116, 46, 'none', { stroke: '#c9a24a', 'stroke-width': 14 }) + poly([[100, 36], [122, 58], [100, 80], [78, 58]], '#8b1a1a') + poly([[100, 44], [112, 58], [100, 70], [88, 58]], '#c0392b'),
  'om-stray-dog': () => poly([[52, 60], [70, 20], [88, 62]], INK) + poly([[148, 60], [130, 20], [112, 62]], INK) + `<ellipse cx="100" cy="98" rx="52" ry="48" fill="${INK}"/><ellipse cx="100" cy="128" rx="28" ry="24" fill="#b8ab90"/>` +
    circ(80, 90, 7, '#151211') + circ(120, 90, 7, '#151211') + `<ellipse cx="100" cy="116" rx="10" ry="7" fill="#151211"/>` + path('M 100 124 L 100 136 M 88 140 Q 100 148 112 140', stroke(3, '#151211')),
  'om-crystal-orb': () => poly([[62, 172], [138, 172], [124, 146], [76, 146]], '#5a3a22') + circ(100, 92, 60, '#3b5d7a') + circ(100, 92, 60, 'none', { stroke: '#9fb6bd', 'stroke-width': 3 }) + circ(80, 70, 16, '#d6e5e8', { opacity: 0.5 }) +
    path('M 70 104 Q 100 80 130 110 Q 104 126 70 104', { fill: '#d6e5e8', opacity: 0.25 }),
  'om-cracked-skull': () => circ(100, 84, 58, INK) + rect(72, 120, 56, 44, INK, { rx: 8 }) + `<ellipse cx="78" cy="92" rx="15" ry="18" fill="#151211"/><ellipse cx="122" cy="92" rx="15" ry="18" fill="#151211"/>` +
    poly([[100, 108], [92, 128], [108, 128]], '#151211') + [84, 96, 108, 120].map((x) => line(x, 144, x, 164, '#151211', 3)).join('') + path('M 96 26 L 108 48 L 98 60 L 110 76', stroke(3, '#151211')),
  'om-silver-necklace': () => path('M 40 40 Q 100 170 160 40', { ...stroke(5, '#c7ccd0'), 'stroke-dasharray': '4 9' }) + poly([[100, 110], [124, 140], [100, 178], [76, 140]], '#c7ccd0') + poly([[100, 124], [112, 140], [100, 160], [88, 140]], '#3b6e8a'),
  'om-girl-in-mirror': () => `<ellipse cx="100" cy="100" rx="62" ry="82" fill="#8a7340"/><ellipse cx="100" cy="100" rx="52" ry="72" fill="#7c97a8"/>` + circ(100, 84, 18, '#151211', { opacity: 0.75 }) +
    path('M 68 168 Q 70 110 100 108 Q 130 110 132 168 Z', { fill: '#151211', opacity: 0.75 }) + path('M 62 60 L 86 40', stroke(4, '#d6e5e8')),
  // --- Vật phẩm
  'it-fire-axe': () => group(rect(-7, -84, 14, 168, '#6b4a2f', { rx: 5 }) + path('M 7 -78 L 58 -92 Q 72 -54 58 -18 L 7 -34 Z', { fill: '#b13a2e' }) + path('M 50 -90 Q 66 -54 52 -20', stroke(5, '#c7ccd0')), 'translate(92 104) rotate(20)'),
  'it-old-revolver': () => rect(40, 66, 110, 22, '#55585c', { rx: 5 }) + rect(92, 62, 40, 34, '#3d4043', { rx: 8 }) + path('M 118 88 L 150 88 L 162 158 L 128 158 Z', { fill: '#5a3a22' }) + path('M 100 96 Q 104 118 122 114', stroke(5, '#55585c')) + rect(40, 58, 8, 10, '#55585c'),
  'it-first-aid': () => rect(34, 56, 132, 104, INK, { rx: 12 }) + rect(76, 38, 48, 22, 'none', { stroke: INK, 'stroke-width': 8, rx: 8 }) + rect(88, 78, 24, 60, '#b13a2e') + rect(70, 96, 60, 24, '#b13a2e'),
  'it-calming-tea': () => path('M 46 96 L 134 96 Q 134 160 90 160 Q 46 160 46 96 Z', { fill: INK }) + path('M 134 106 Q 166 106 160 130 Q 154 146 130 142', stroke(8)) + `<ellipse cx="90" cy="96" rx="44" ry="9" fill="#6b4a2f"/>` +
    path('M 70 78 Q 60 60 72 46 M 92 78 Q 82 58 94 40 M 114 78 Q 104 60 116 46', stroke(4, '#b8ab90')) + `<ellipse cx="96" cy="172" rx="62" ry="8" fill="#b8ab90"/>`,
  'it-charm': () => path('M 70 20 Q 100 60 100 80 M 130 20 Q 100 60 100 80', stroke(4, '#8b1a1a')) + poly([[100, 76], [140, 100], [140, 146], [100, 170], [60, 146], [60, 100]], '#8b1a1a') +
    poly([[100, 90], [128, 106], [128, 140], [100, 156], [72, 140], [72, 106]], '#5c1010') + circ(100, 123, 14, '#c9a24a') + circ(100, 123, 6, '#151211'),
  'it-soft-shoes': () => path('M 30 120 Q 30 86 62 88 L 96 104 Q 150 108 166 132 Q 172 150 150 152 L 44 152 Q 30 150 30 120 Z', { fill: '#5a3a22' }) + path('M 34 146 L 160 146', stroke(6, '#2a1c12')) +
    path('M 76 100 L 92 116 M 92 100 L 104 116', stroke(3, INK)) + path('M 36 72 q 8 -14 18 0 M 62 60 q 8 -14 18 0', stroke(3, '#b8ab90')),
  'it-magnifier': () => circ(84, 84, 50, '#9fb6bd', { opacity: 0.35 }) + circ(84, 84, 50, 'none', { stroke: '#c9a24a', 'stroke-width': 10 }) + line(122, 122, 170, 170, '#6b4a2f', 16, { 'stroke-linecap': 'round' }) + path('M 56 70 Q 64 52 84 50', stroke(4, '#d6e5e8')),
  'it-leather-gloves': () => path('M 62 170 L 62 96 Q 56 60 66 58 Q 74 58 76 88 L 80 44 Q 82 34 90 36 Q 96 38 94 86 L 100 36 Q 104 28 110 32 Q 114 36 110 86 L 120 50 Q 126 44 130 50 Q 132 58 124 100 L 140 84 Q 150 80 152 90 Q 150 100 128 132 L 124 170 Z', { fill: '#5a3a22' }) +
    rect(58, 150, 70, 22, '#3a2415', { rx: 5 }),
  'it-strong-liquor': () => rect(88, 20, 24, 44, '#3d5a3a') + rect(84, 14, 32, 12, '#8a7340', { rx: 3 }) + path('M 88 60 Q 62 76 62 104 L 62 172 Q 62 180 70 180 L 130 180 Q 138 180 138 172 L 138 104 Q 138 76 112 60 Z', { fill: '#3d5a3a' }) +
    rect(70, 110, 60, 44, INK, { rx: 3 }) + path('M 86 122 L 114 142 M 114 122 L 86 142', stroke(4, '#151211')),
  'it-bone-dice': () => group(rect(-40, -40, 80, 80, INK, { rx: 12 }) + circ(-18, -18, 8, '#151211') + circ(18, 18, 8, '#151211'), 'translate(76 84) rotate(-14)') +
    group(rect(-34, -34, 68, 68, '#b8ab90', { rx: 10 }) + circ(0, 0, 8, '#151211'), 'translate(134 138) rotate(18)'),
  // --- Sự kiện
  'ev-whispers': () => [0, 1, 2].map((row) => [0, 1, 2].map((col) => rect(20 + col * 44 + (row % 2) * 16, 50 + row * 36, 40, 32, '#5a524b', { rx: 2 })).join('')).join('') +
    path('M 150 70 Q 172 100 150 130 M 164 54 Q 196 100 164 146', stroke(5)) + circ(132, 100, 6, INK),
  'ev-rotten-floor': () => [0, 1, 2, 3].map((i) => rect(24, 36 + i * 34, 152, 30, shade('#5a3a22', i % 2 ? 0.03 : -0.02))).join('') + poly([[70, 70], [112, 62], [140, 96], [120, 140], [76, 132], [56, 100]], '#050403') +
    path('M 70 70 L 58 54 M 140 96 L 160 90 M 76 132 L 64 150', stroke(3, '#151211')),
  'ev-cold-hand': () => path('M 70 180 L 70 110 Q 54 100 50 82 Q 54 74 64 84 L 74 96 L 74 40 Q 80 30 86 40 L 88 88 L 92 30 Q 98 20 104 30 L 104 88 L 110 36 Q 116 28 122 38 L 120 92 L 128 56 Q 134 50 140 58 L 134 126 L 130 180 Z', { fill: '#9fb6bd' }) +
    path('M 150 40 l 10 -10 M 158 60 l 14 -4 M 40 50 l -10 -8', stroke(3, '#d6e5e8')),
  'ev-portrait': () => rect(34, 22, 132, 156, '#8a7340', { rx: 4 }) + rect(48, 36, 104, 128, '#2a2320') + `<ellipse cx="100" cy="96" rx="30" ry="38" fill="#6b5d4c"/>` + path('M 60 164 Q 64 132 100 130 Q 136 132 140 164 Z', { fill: '#3a2a3a' }) +
    `<ellipse cx="88" cy="90" rx="7" ry="5" fill="${INK}"/><ellipse cx="112" cy="90" rx="7" ry="5" fill="${INK}"/>` + circ(91, 90, 3, '#151211') + circ(115, 90, 3, '#151211'),
  'ev-quiet-moment': () => circ(100, 70, 46, '#f2b84b', { opacity: 0.18 }) + path('M 100 34 Q 118 60 100 82 Q 82 60 100 34 Z', { fill: '#f2b84b' }) + path('M 100 52 Q 108 66 100 78 Q 92 66 100 52 Z', { fill: '#fff1c2' }) +
    rect(84, 84, 32, 80, INK, { rx: 4 }) + `<ellipse cx="100" cy="170" rx="44" ry="10" fill="#8a7340"/>`,
  'ev-lights-out': () => path('M 76 60 L 124 60 L 136 120 L 64 120 Z', { fill: '#3a352f' }) + rect(90, 120, 20, 44, '#3a352f') + `<ellipse cx="100" cy="168" rx="36" ry="8" fill="#3a352f"/>` +
    path('M 20 50 Q 60 30 90 46 M 14 86 Q 50 70 70 84 M 130 40 Q 160 28 184 44 M 140 90 Q 166 80 188 92', stroke(5, '#9fb6bd')) + path('M 100 44 q 6 -14 -4 -24', stroke(3, '#b8ab90')),
  'ev-trapdoor': () => rect(30, 40, 140, 130, '#5a3a22') + rect(44, 54, 112, 102, '#050403') + poly([[44, 54], [156, 54], [136, 20], [64, 20]], '#6b4a2f') + [80, 100, 120].map((x) => line(x, 22, x - (100 - x) * 0.3, 52, '#3a2415', 3)).join('') +
    circ(100, 34, 7, 'none', { stroke: '#c9a24a', 'stroke-width': 4 }),
  'ev-music-box': () => rect(40, 96, 120, 70, '#5a3a22', { rx: 6 }) + poly([[40, 96], [160, 96], [150, 56], [50, 56]], '#6b4a2f') + rect(52, 110, 96, 6, '#c9a24a') + path('M 160 130 L 180 130 L 180 110', stroke(5, '#c9a24a')) + circ(180, 106, 6, '#c9a24a') +
    path('M 84 44 L 84 14 L 108 8 L 108 38', stroke(4)) + circ(78, 44, 7, INK) + circ(102, 38, 7, INK),
  'ev-familiar-scent': () => [0, 72, 144, 216, 288].map((a) => `<ellipse cx="100" cy="62" rx="16" ry="30" fill="${INK}" transform="rotate(${a} 100 92)"/>`).join('') + circ(100, 92, 14, '#c9a24a') +
    path('M 100 122 Q 92 150 100 184', stroke(5, '#4a6a3a')) + path('M 98 150 Q 70 140 64 158 Q 84 166 98 150 Z', { fill: '#4a6a3a' }),
  'ev-bite': () => path('M 40 70 Q 100 30 160 70', stroke(5, '#8b1a1a')) + path('M 40 130 Q 100 170 160 130', stroke(5, '#8b1a1a')) +
    [52, 76, 100, 124, 148].map((x, i) => poly([[x - 10, 66 - Math.abs(2 - i) * -6 - 14 + Math.abs(2 - i) * 6], [x + 10, 66 - 14 + Math.abs(2 - i) * 6], [x, 92]], INK) + poly([[x - 10, 148 - Math.abs(2 - i) * 6], [x + 10, 148 - Math.abs(2 - i) * 6], [x, 110]], INK)).join(''),
  'ev-hidden-drawer': () => rect(36, 30, 128, 150, '#5a3a22', { rx: 6 }) + rect(48, 42, 104, 36, '#6b4a2f', { rx: 3 }) + circ(100, 60, 6, '#c9a24a') + rect(48, 134, 104, 36, '#6b4a2f', { rx: 3 }) + circ(100, 152, 6, '#c9a24a') +
    rect(48, 88, 104, 36, '#050403') + poly([[40, 104], [160, 104], [176, 132], [24, 132]], '#7a5636') + rect(24, 132, 152, 10, '#5a3a22') + circ(100, 138, 6, '#c9a24a') + path('M 84 100 l 6 -12 l 8 8 l 8 -14', stroke(3, '#f2b84b')),
  'ev-waking-nightmare': () => path('M 20 100 Q 100 20 180 100 Q 100 180 20 100 Z', { fill: INK }) + circ(100, 100, 40, '#8b1a1a') + `<ellipse cx="100" cy="100" rx="12" ry="34" fill="#151211"/>` + circ(86, 84, 8, INK, { opacity: 0.6 }) +
    path('M 30 60 L 44 74 M 64 34 L 72 54 M 100 24 L 100 44 M 136 34 L 128 54 M 170 60 L 156 74', stroke(4)),
  // --- Thẻ bổ sung
  'om-black-cat': () => `<ellipse cx="100" cy="128" rx="48" ry="44" fill="#151211"/>` + circ(100, 74, 36, '#151211') + poly([[70, 54], [74, 20], [92, 46]], '#151211') + poly([[130, 54], [126, 20], [108, 46]], '#151211') +
    `<ellipse cx="86" cy="72" rx="8" ry="10" fill="#d6c34a"/><ellipse cx="114" cy="72" rx="8" ry="10" fill="#d6c34a"/><ellipse cx="86" cy="72" rx="2.5" ry="8" fill="#151211"/><ellipse cx="114" cy="72" rx="2.5" ry="8" fill="#151211"/>` +
    path('M 146 150 Q 182 140 172 100 Q 168 84 156 92', stroke(10, '#151211')) + path('M 60 84 L 30 78 M 60 92 L 32 96 M 140 84 L 170 78 M 140 92 L 168 96', stroke(2, INK)),
  'om-funeral-portrait': () => rect(40, 24, 120, 150, '#151211', { rx: 4 }) + rect(52, 36, 96, 126, '#6b6560') + `<ellipse cx="100" cy="88" rx="26" ry="32" fill="#4a4540"/>` +
    path('M 64 162 Q 68 128 100 126 Q 132 128 136 162 Z', { fill: '#3a3632' }) + path('M 40 24 L 80 24 L 40 64 Z', { fill: '#151211' }) + path('M 120 24 L 160 24 L 160 64 Z', { fill: '#151211' }) +
    path('M 40 60 L 76 24 M 124 24 L 160 60', stroke(6, INK)) + rect(80, 174, 40, 14, '#8b1a1a', { rx: 3 }),
  'om-dead-hairpin': () => group(rect(-5, -10, 10, 140, '#c9a24a', { rx: 4 }) + path('M -5 126 L 0 142 L 5 126 Z', { fill: '#c9a24a' }), 'translate(108 40) rotate(28)') +
    group([0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-18" rx="11" ry="20" fill="#d8cdb6" transform="rotate(${a})"/>`).join('') + circ(0, 0, 10, '#8b1a1a'), 'translate(78 66)') +
    path('M 68 90 Q 60 120 70 150 M 84 92 Q 80 130 92 160', stroke(3, '#8b1a1a')),
  'it-hell-coin': () => circ(100, 100, 70, '#c9a24a') + circ(100, 100, 58, 'none', { stroke: '#8a7340', 'stroke-width': 4 }) + rect(84, 84, 32, 32, '#2b2114') +
    [[100, 54], [146, 100], [100, 146], [54, 100]].map(([x, y]) => rect(x - 8, y - 8, 16, 16, '#8a7340', { rx: 2, transform: `rotate(45 ${x} ${y})` })).join('') + path('M 60 70 Q 70 50 96 44', stroke(4, '#f2d78a')),
  'it-rusty-machete': () => group(path('M -14 -90 Q 30 -60 26 30 L -8 40 Q -2 -30 -14 -90 Z', { fill: '#8a7a6a' }) + path('M 6 -40 L 10 -20 M -2 -60 L 6 -50 M 14 0 L 20 14', stroke(5, '#7a3a1a')) +
    rect(-14, 40, 30, 10, '#3a2415', { rx: 3 }) + rect(-10, 50, 22, 50, '#5a3a22', { rx: 6 }) + circ(1, 64, 3, '#c9a24a') + circ(1, 84, 3, '#c9a24a'), 'translate(96 96) rotate(30)'),
  'ev-chandelier': () => line(100, 10, 100, 50, INK, 4) + path('M 40 90 Q 100 130 160 90', stroke(6, '#c9a24a')) + path('M 60 70 Q 100 100 140 70', stroke(5, '#c9a24a')) + circ(100, 56, 10, '#c9a24a') +
    [40, 70, 100, 130, 160].map((x, i) => rect(x - 4, (i % 2 ? 76 : 86) - 18, 8, 18, INK) + circ(x, (i % 2 ? 76 : 86) - 24, 5, '#f2b84b')).join('') +
    [[60, 150], [100, 168], [140, 152], [84, 180], [122, 186]].map(([x, y]) => poly([[x, y - 8], [x + 6, y], [x, y + 8], [x - 6, y]], '#d6e5e8')).join('') + path('M 30 130 L 50 120 M 170 130 L 150 120', stroke(4)),
  'ev-ghost-wedding': () => path('M 60 180 Q 62 90 80 70 Q 100 50 120 70 Q 138 90 140 180 Q 120 166 100 180 Q 80 166 60 180 Z', { fill: INK, opacity: 0.85 }) +
    path('M 64 80 Q 100 20 136 80 L 150 160 Q 100 120 50 160 Z', { fill: '#d6e5e8', opacity: 0.35 }) + circ(88, 92, 5, '#151211') + circ(112, 92, 5, '#151211') +
    rect(84, 128, 32, 32, '#8b1a1a') + path('M 92 136 L 108 136 M 92 144 L 108 144 M 92 152 L 108 152 M 100 132 L 100 156', stroke(2, '#c9a24a')),
  'ev-paper-effigy': () => poly([[100, 20], [126, 42], [118, 70], [82, 70], [74, 42]], INK) + circ(90, 46, 4, '#8b1a1a') + circ(110, 46, 4, '#8b1a1a') + path('M 92 60 Q 100 64 108 60', stroke(2, '#8b1a1a')) +
    poly([[70, 76], [130, 76], [150, 176], [50, 176]], '#b13a2e') + poly([[70, 76], [40, 130], [54, 136], [80, 96]], '#d6a531') + poly([[130, 76], [160, 130], [146, 136], [120, 96]], '#d6a531') +
    [100, 120, 140, 160].map((y) => line(60 + (y - 76) * 0.1, y, 140 - (y - 76) * 0.1, y, '#7a1a1a', 2)).join('') + path('M 150 30 Q 170 40 166 60 M 160 56 L 166 62 L 172 54', stroke(3, INK)),
  'ev-rats': () => [[60, 80, -20], [130, 70, 15], [90, 140, 5], [150, 140, -30]].map(([x, y, a]) => group(
    `<ellipse cx="0" cy="0" rx="30" ry="18" fill="#5a524b"/>` + `<ellipse cx="28" cy="-2" rx="12" ry="9" fill="#5a524b"/>` + circ(20, -14, 6, '#7a6e64') + circ(34, -4, 2.5, '#8b1a1a') +
    path('M -28 4 Q -50 10 -56 -6', stroke(3, '#b8a090')), `translate(${x} ${y}) rotate(${a})`)).join(''),
  'ev-mold': () => rect(20, 20, 160, 160, '#4a443d', { rx: 6 }) + [[60, 60, 30], [120, 80, 40], [80, 130, 34], [150, 150, 22], [40, 150, 18]].map(([x, y, s]) =>
    circ(x, y, s, '#3d5a2f', { opacity: 0.85 }) + circ(x + s * 0.3, y - s * 0.2, s * 0.5, '#5a7a3a', { opacity: 0.8 }) + circ(x - s * 0.3, y + s * 0.3, s * 0.25, '#7a9a4a')).join(''),
  'ev-weeping': () => rect(44, 20, 112, 166, '#5a3a22', { rx: 4 }) + line(100, 24, 100, 182, '#3a2415', 4) + circ(92, 104, 5, '#c9a24a') + circ(108, 104, 5, '#c9a24a') +
    rect(100, 24, 54, 158, '#050403', { opacity: 0.6 }) + circ(122, 90, 4, INK) + circ(136, 90, 4, INK) + path('M 120 98 Q 118 120 122 136 M 136 98 Q 138 116 134 132', stroke(2.5, '#9fb6bd')),
  'ev-slide-down': () => poly([[14, 70], [186, 130], [186, 170], [14, 110]], '#5a3a22') + [0, 1, 2, 3].map((i) => line(14 + i * 43, 70 + i * 15, 14 + i * 43, 110 + i * 15, '#3a2415', 3)).join('') +
    circ(70, 60, 14, INK) + path('M 70 74 L 90 100 M 80 86 L 60 104 M 90 100 L 112 104 M 90 100 L 96 124', stroke(7)) + path('M 130 50 L 170 70 M 140 36 L 180 56', stroke(4, '#9fb6bd')),
  'ev-cold-breath': () => path('M 40 180 Q 40 110 80 100 Q 120 96 124 140 L 124 180 Z', { fill: '#3a352f' }) + circ(84, 74, 30, '#3a352f') +
    path('M 140 40 Q 170 50 160 70 Q 150 86 170 98 M 130 60 Q 150 70 140 88 Q 132 104 150 114', stroke(5, '#9fb6bd')) + `<ellipse cx="158" cy="44" rx="16" ry="10" fill="#9fb6bd" opacity="0.4"/>`,
  'ev-broken-mirror': () => `<ellipse cx="100" cy="100" rx="62" ry="82" fill="#8a7340"/><ellipse cx="100" cy="100" rx="52" ry="72" fill="#7c97a8"/>` +
    path('M 100 100 L 70 40 M 100 100 L 140 52 M 100 100 L 152 112 M 100 100 L 120 170 M 100 100 L 64 160 M 100 100 L 50 92', stroke(3, '#151211')) +
    poly([[100, 100], [140, 52], [152, 112]], '#d6e5e8', { opacity: 0.35 }) + poly([[160, 170], [176, 150], [182, 176]], '#9fb6bd') + poly([[30, 172], [44, 160], [40, 184]], '#9fb6bd'),
  'ev-overturned-bowl': () => `<ellipse cx="100" cy="150" rx="78" ry="16" fill="#5a3a22"/>` + path('M 46 146 Q 50 80 100 78 Q 150 80 154 146 Z', { fill: INK }) + path('M 50 120 L 150 120', stroke(5, '#3b6e8a')) +
    [[34, 160], [168, 158], [150, 172], [56, 174]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="3" fill="${INK}"/>`).join('') + line(70, 30, 140, 70, '#c9a24a', 4) + line(80, 24, 150, 60, '#c9a24a', 4),
  'ev-sleep-paralysis': () => rect(20, 130, 160, 40, '#4a5560', { rx: 8 }) + rect(24, 116, 50, 24, '#d8cdb6', { rx: 8 }) + circ(50, 112, 16, INK) +
    path('M 90 128 Q 80 60 110 40 Q 150 30 160 70 Q 168 110 150 130 Z', { fill: '#151211' }) + circ(118, 66, 5, '#8b1a1a') + circ(140, 64, 5, '#8b1a1a') + path('M 96 110 Q 70 120 60 112', stroke(6, '#151211')),
  'ev-possessed-doll': () => circ(100, 52, 30, INK) + path('M 72 40 Q 100 10 128 40 L 128 30 Q 100 0 72 30 Z', { fill: '#5a3a22' }) + circ(88, 52, 6, '#151211') + circ(112, 52, 6, '#151211') +
    path('M 92 68 Q 100 74 108 68', stroke(2.5, '#8b1a1a')) + path('M 60 84 L 140 84 L 156 150 L 44 150 Z', { fill: '#7a2d2d' }) + path('M 70 150 L 62 186 M 130 150 L 142 186', stroke(10, INK)) +
    path('M 60 90 L 30 120 M 140 90 L 172 70', stroke(9, INK)) + path('M 150 180 l 10 -4 M 40 186 l -10 -2', stroke(3, '#b8ab90')),
};

const CARD_STYLE = {
  omen: { bg: '#241a2e', edge: '#7c5ba6', label: 'ĐIỀM BÁO' },
  item: { bg: '#18261f', edge: '#4f9a78', label: 'VẬT PHẨM' },
  event: { bg: '#2b2114', edge: '#c9963a', label: 'SỰ KIỆN' },
};

function cardSvg(card) {
  const glyph = GLYPHS[card.id];
  if (!glyph) throw new Error(`Chưa có hình cho thẻ ${card.id} – thêm vào bảng GLYPHS.`);
  const st = CARD_STYLE[card.type];
  const W = 300;
  const H = 300;
  const corner = (x, y, sx, sy) => path(`M ${x} ${y + sy * 34} L ${x} ${y} L ${x + sx * 34} ${y}`, stroke(3, st.edge));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><radialGradient id="g" cx="50%" cy="45%" r="65%"><stop offset="0%" stop-color="${shade(st.bg, 0.12)}"/><stop offset="100%" stop-color="${shade(st.bg, -0.05)}"/></radialGradient></defs>
<rect width="${W}" height="${H}" rx="16" fill="url(#g)"/>
<rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="11" fill="none" stroke="${st.edge}" stroke-width="2.5" opacity="0.9"/>
${corner(20, 20, 1, 1)}${corner(W - 20, 20, -1, 1)}${corner(20, H - 20, 1, -1)}${corner(W - 20, H - 20, -1, -1)}
<circle cx="${W / 2}" cy="${H / 2}" r="112" fill="#000" opacity="0.22"/>
<g transform="translate(50 50)">${glyph()}</g>
</svg>
`;
}

// Chỉ riêng hình minh hoạ, nền trong suốt. Giao diện tô đen nó thành hình bóng ở đầu thẻ.
function glyphSvg(card) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${GLYPHS[card.id]()}</svg>\n`;
}

// ---------------------------------------------------------------- ghi file

mkdirSync(nodePath.join(MEDIA, 'tiles'), { recursive: true });
mkdirSync(nodePath.join(MEDIA, 'cards'), { recursive: true });

const manifestPath = nodePath.join(MEDIA, 'manifest.json');
let manifest = { images: { tiles: {}, cards: {} }, audio: { music: {}, sfx: {} } };
try {
  manifest = { ...manifest, ...JSON.parse(readFileSync(manifestPath, 'utf8')) };
} catch {
  // Chưa có manifest: tạo mới.
}
manifest.images = {
  ...manifest.images,
  tiles: { ...manifest.images?.tiles },
  cards: { ...manifest.images?.cards },
  glyphs: { ...manifest.images?.glyphs },
};
mkdirSync(nodePath.join(MEDIA, 'glyphs'), { recursive: true });

for (const tile of TILES) {
  writeFileSync(nodePath.join(MEDIA, 'tiles', `${tile.id}.svg`), tileSvg(tile));
  manifest.images.tiles[tile.id] = `tiles/${tile.id}.svg`;
}
for (const card of CARDS) {
  writeFileSync(nodePath.join(MEDIA, 'cards', `${card.id}.svg`), cardSvg(card));
  manifest.images.cards[card.id] = `cards/${card.id}.svg`;
  writeFileSync(nodePath.join(MEDIA, 'glyphs', `${card.id}.svg`), glyphSvg(card));
  manifest.images.glyphs[card.id] = `glyphs/${card.id}.svg`;
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Đã vẽ ${TILES.length} gạch và ${CARDS.length} thẻ vào ${nodePath.relative(process.cwd(), MEDIA)}`);
