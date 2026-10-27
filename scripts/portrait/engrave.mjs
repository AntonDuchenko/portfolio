// Engraves the WANTED poster's portrait from a photo: public/portrait.webp, ink lines on a
// transparent ground, so the poster's and the hero frame's parchment shows through.
//
//   node scripts/portrait/engrave.mjs <photo> [--preview <png>]
//
// The photo is never committed or published — only the engraving (the owner's choice: the
// portrait on the site is a drawing made from his photo, not the photo).
//
// Steps: the wall is found by growing from the photo's border over wall-coloured pixels; the
// crop is fitted to the head; tone = the person's luminance, stretched and locally contrasted;
// then three families of engraved lines whose width follows the tone (horizontal lines bent
// by the shading, cross-hatching at 40° and −40° only in the shadows), faded out in an oval
// vignette so the shirt dissolves into the paper, as in old engraved portraits.

import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const OUT = 'public/portrait.webp';
const W = 1120, H = 1254;                      // 1 : 1.12, the poster's face box and the hero frame
const INK = '#2e2010';
const LINES = 150;                             // horizontal lines over the height: ~9 px apart at full size

const [photo, ...rest] = process.argv.slice(2);
if (!photo) throw new Error('usage: node scripts/portrait/engrave.mjs <photo> [--preview <png>]');
const previewAt = rest[0] === '--preview' ? rest[1] : null;

/* ── source: luminance, wall mask ──────────────────────────────────── */
const { data: rgb, info } = await sharp(photo).raw().toBuffer({ resolveWithObject: true });
const sw = info.width, sh = info.height, ch = info.channels;

const lum = new Float32Array(sw * sh);
for (let p = 0; p < sw * sh; p++) lum[p] = (.2126 * rgb[p * ch] + .7152 * rgb[p * ch + 1] + .0722 * rgb[p * ch + 2]) / 255;

// the wall: grown from the border over neutral grey pixels, a small change in brightness per
// step. Grey, because skin and the shirt are warm and hair is dark (R−G: wall 2…9, skin
// 23…40); stepwise, because the wall's light falls off across the frame (0.48 → 0.60) — one
// wall colour left its lit side counted as the person, off-centre and without an outline
const greyWall = p => Math.abs(rgb[p * ch] - rgb[p * ch + 1]) < 14 && Math.abs(rgb[p * ch + 2] - rgb[p * ch + 1]) < 12 && lum[p] > .38;
const wall = new Uint8Array(sw * sh), queue = [];
for (let x = 0; x < sw; x++) for (const y of [0, sh - 1]) queue.push(y * sw + x);
for (let y = 0; y < sh; y++) for (const x of [0, sw - 1]) queue.push(y * sw + x);
for (const p of queue.splice(0)) if (greyWall(p)) { wall[p] = 1; queue.push(p); }
while (queue.length) {
  const p = queue.pop(), x = p % sw, y = (p - x) / sw;
  for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
    if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue;
    const q = ny * sw + nx;
    if (wall[q] || !greyWall(q) || Math.abs(lum[q] - lum[p]) > .05) continue;
    wall[q] = 1; queue.push(q);
  }
}

/* ── crop: fitted to the head ──────────────────────────────────────── */
const rowSpan = y => {
  let a = -1, b = -1;
  for (let x = 0; x < sw; x++) if (!wall[y * sw + x]) { if (a < 0) a = x; b = x; }
  return a < 0 ? null : [a, b];
};
let top = 0;
while (top < sh && !(rowSpan(top) && rowSpan(top)[1] - rowSpan(top)[0] > 8)) top++;
const headRows = [];
for (let y = top; y < top + (sh - top) * .25; y++) { const s = rowSpan(y); if (s) headRows.push(s); }
const widths = headRows.map(([a, b]) => b - a).sort((a, b) => a - b);
const headW = widths[widths.length >> 1];
// the face's axis from the lower head rows (temples, ears): the hair above can lean aside
const lowerHead = headRows.slice(headRows.length >> 1);
const cx = lowerHead.reduce((s, [a, b]) => s + (a + b) / 2, 0) / lowerHead.length;
const cw = headW * 2.4, chh = cw * H / W;                      // crop size in photo pixels
const crop = { x: cx - cw / 2, y: top - chh * .07, k: cw / W };  // k: photo px per output px

/* ── tone ──────────────────────────────────────────────────────────── */
// stretch the head's luminance (2nd…98th percentile: hair to lit skin; the shirt would skew
// it), then local contrast against a blur
const headLum = [];
for (let y = Math.max(0, top); y < Math.min(sh, top + chh * .7); y++)
  for (let x = Math.max(0, Math.floor(crop.x)); x < Math.min(sw, crop.x + cw); x++) if (!wall[y * sw + x]) headLum.push(lum[y * sw + x]);
headLum.sort((a, b) => a - b);
const lo = headLum[Math.floor(headLum.length * .02)], hi = headLum[Math.floor(headLum.length * .98)];
const norm = Float32Array.from(lum, v => Math.min(1, Math.max(0, (v - lo) / (hi - lo))));
const blurred = async (f, sigma) => {
  const u8 = Uint8Array.from(f, v => Math.round(v * 255));
  // extractChannel: sharp hands a blurred single channel back as three
  const out = await sharp(u8, { raw: { width: sw, height: sh, channels: 1 } }).blur(sigma).extractChannel(0).raw().toBuffer();
  return Float32Array.from(out, v => v / 255);
};
const soft = await blurred(norm, headW * .07);                  // the shading, without the detail
const light = await blurred(norm, headW * .15);                 // the photo's side light across the face
const mask = await blurred(Float32Array.from(wall, w => 1 - w), 1.2);
const detail = await blurred(norm, .7);                         // JPEG noise out

const sample = (f, x, y) => {                                    // bilinear, photo space; outside = wall
  if (x < 0 || y < 0 || x > sw - 1 || y > sh - 1) return f === mask ? 0 : 1;
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  return (f[y0 * sw + x0] * (1 - fx) + f[y0 * sw + x1] * fx) * (1 - fy) + (f[y1 * sw + x0] * (1 - fx) + f[y1 * sw + x1] * fx) * fy;
};
const smoothstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** ink darkness 0…1 at an output point */
function tone(ox, oy) {
  const x = crop.x + ox * crop.k, y = crop.y + oy * crop.k;
  const m = sample(mask, x, y);
  if (m <= 0) return 0;
  const d = sample(detail, x, y), s = sample(soft, x, y);
  // the side light mostly taken out against the mirrored point (the photo's cheeks are 0.29
  // and 0.61: one drowned in hatching, the other blank paper), some local contrast back
  const l = sample(light, x, y), mirror = sample(light, 2 * cx - x, y);
  const v = Math.min(1, Math.max(0, d + .7 * (d - s) + .7 * ((l + mirror) / 2 - l)));
  // a thin contour where the figure meets the wall, so the lit side keeps its edge
  const e = Math.abs(sample(mask, x + crop.k * 2, y) - sample(mask, x - crop.k * 2, y)) +
    Math.abs(sample(mask, x, y + crop.k * 2) - sample(mask, x, y - crop.k * 2));
  // oval vignette around the head, and the shirt fading into the paper towards the bottom
  const r = Math.hypot((ox - W / 2) / (W * .5), (oy - H * .42) / (H * .56));
  const fade = (1 - smoothstep(.8, 1.02, r)) * (1 - smoothstep(H * .68, H * .96, oy));
  // 0.82: the brightest skin still gets a fine line instead of blank paper
  return fade * Math.min(1, m * (1 - .82 * v) ** 1.5 + .5 * e);
}

/* ── lines ─────────────────────────────────────────────────────────── */
const paths = [];
/** one family of parallel lines at `angle`, `gap` px apart; width follows the tone above `from` */
function family(angle, gap, from, maxW, bend = 0) {
  const dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy, ny = dx;
  const reach = Math.hypot(W, H);
  for (let u = -reach / 2; u < reach / 2; u += gap) {
    let upper = [], lower = [];
    const flush = () => {
      if (upper.length > 1) paths.push('M' + upper.concat(lower.reverse()).map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z');
      upper = []; lower = [];
    };
    for (let s = -reach / 2; s < reach / 2; s += 2) {
      let x = W / 2 + nx * u + dx * s, y = H / 2 + ny * u + dy * s;
      if (x < 0 || y < 0 || x > W || y > H) { flush(); continue; }
      // bend the line with the shading, so the lines run round the face
      if (bend) { const sh2 = sample(soft, crop.x + x * crop.k, crop.y + y * crop.k); x += nx * bend * (sh2 - .5); y += ny * bend * (sh2 - .5); }
      const t = (tone(x, y) - from) / (1 - from);
      const w = t > 0 ? maxW * t : 0;
      if (w < .5) { flush(); continue; }
      upper.push([x - nx * w / 2, y - ny * w / 2]); lower.push([x + nx * w / 2, y + ny * w / 2]);
    }
    flush();
  }
}
const gap = H / LINES;
family(-.12, gap, .04, gap * .9, gap * 3);                      // the engraving's main lines, bent round the form
family(.7, gap * 1.15, .5, gap * .7);                           // cross-hatching in the shadows
family(-.7, gap * 1.3, .74, gap * .6);                          // and once more in the deepest ones

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path fill="${INK}" d="${paths.join('')}"/></svg>`;
const png = await sharp(Buffer.from(svg)).png().toBuffer();
await sharp(png).webp({ quality: 80, alphaQuality: 85, effort: 6 }).toFile(OUT);
console.log(`${OUT}: crop ${crop.x.toFixed(0)},${crop.y.toFixed(0)} ${cw.toFixed(0)}×${chh.toFixed(0)} px of the photo, ${paths.length} strokes`);

// a look at it on the poster's parchment (dev only)
if (previewAt) {
  const paper = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#e5d4ad"/><stop offset=".6" stop-color="#cdb88c"/><stop offset="1" stop-color="#bda478"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  writeFileSync(previewAt, await sharp(Buffer.from(paper)).composite([{ input: png }]).png().toBuffer());
}
