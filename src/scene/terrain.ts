import { BufferAttribute, BufferGeometry, Color, type Material, Mesh, MeshStandardMaterial, Vector4 } from 'three';
import { GATE_Z, JETTY, MOD, TAV_END, TAV_HW, WING } from '../config';
import { look } from '../theme/themes';
import { BAND, BROOK, BROOK_GLSL, brookCut, brookValley } from './brookShape';
import { SNOW } from './snow';
import { scene } from './stage';

/* The ground: four 170 × 80 m strips along the route and past the tavern, a height field
   on a grid.

   Objects stand on the *rendered* surface (surfaceY), not on the height function: between
   grid vertices the mesh is flat triangles, and anything placed on the smooth function
   floated up to 0.8 m where a triangle dipped below it. The grid is dense along the path
   (a vertex at the edge of the flat band, ±2.2 m, and every 1–1.5 m while the shoulders
   rise), so the ground under the path is exactly flat and the edges follow the relief.
   Rows run every 4 m, and every 0.3 m across the brook's band (brookShape.ts): its channel
   is 2–4 m wide. */

const SEG_LEN = 80, SEG_N = 4, ROWS = 20, ROW = SEG_LEN / ROWS, TERR_A = 1.1;
const step = (a: number, b: number, d: number) => Array.from({ length: Math.round((b - a) / d) + 1 }, (_, i) => a + i * d);
const XS = [...step(-85, -15, 5), -12, -10, -8.5, -7.2, -6, -5, -4, -3, -2.2, 0,
  2.2, 3, 4, 5, 6, 7.2, 8.5, 10, 12, ...step(15, 85, 5)];
// strip i covers z ∈ [zc − 40, zc + 40], zc = 40 − 80 i; its first vertex row is at zc − 40
const stripCentre = (i: number) => 40 - i * SEG_LEN;
const BROOK_ROW = .3;
/** a strip's vertex rows, ascending z */
function stripRows(i: number) {
  const z0 = stripCentre(i) - SEG_LEN / 2, z1 = z0 + SEG_LEN;
  const rows = [...step(z0, z1, ROW), ...step(BAND.from, BAND.to, BROOK_ROW).filter(z => z > z0 && z < z1)];
  return [...new Set(rows.map(z => +z.toFixed(4)))].sort((a, b) => a - b);
}
const ROWS_OF = Array.from({ length: SEG_N }, (_, i) => stripRows(i));

const noise = (x: number, z: number) => Math.sin(x * .13 + z * .07) + Math.sin(x * .31 - z * .19) * .5 +
  Math.sin(x * .07 + z * .23) * .8 + Math.sin(z * .41 + x * .05) * .3;

/** The height function the grid samples. Flat within 2.2 m of the path (in front of the
 *  door), flat in a yard around the building, rising into a wooded slope behind it; the
 *  brook's channel cut into a level valley (so its water stays level). */
function heightAt(x: number, z: number) {
  const band = z > GATE_Z - 2 ? Math.min(1, Math.max(0, (Math.abs(x) - 2.2) / 5)) : 1;
  // the yard: flat around the building and its side wing, the relief returns over ~10 m
  const dx = Math.max(0, Math.abs(x) - (x > 0 ? WING.x1 : TAV_HW) - 2), dz = Math.max(0, z - (GATE_Z + 4), TAV_END - 3 - z);
  const yard = Math.min(1, Math.hypot(dx, dz) / 10);
  // behind the tavern the ground climbs, so the view ends in a wooded rise, not a horizon
  const rise = Math.max(0, GATE_Z - 25 - z) * .07;
  // under the building only, the ground sinks below the floor (hard rule 1). It used to
  // sink across the whole width behind the facade line, which left the tavern standing at
  // the edge of an empty plain. Grid vertices inside the footprint: x 0, ±2.2; the ones on
  // the wall lines (x ±3, z GATE_Z) stay at 0, so the walls meet the ground.
  const under = Math.abs(x) < TAV_HW - .3 && z < GATE_Z - .3 && z > TAV_END + .3 ? -.5 : 0;
  return noise(x, -z) * band * yard * TERR_A * (1 - brookValley(x, z)) + rise + under - brookCut(x, z);
}

/** Height of the rendered ground at (x, z): the triangle the point falls in, exactly as
 *  buildTerrain splits each cell (a–b–d below the diagonal, b–c–d above it; a at the
 *  cell's low x and z, b up z, c across, d up x). */
export function surfaceY(x: number, z: number) {
  const i = Math.min(SEG_N - 1, Math.max(0, Math.floor((SEG_LEN - z) / SEG_LEN)));
  const rows = ROWS_OF[i], zz = Math.min(rows[rows.length - 1], Math.max(rows[0], z));
  let ix = 0;
  while (ix < XS.length - 2 && x > XS[ix + 1]) ix++;
  let iy = 0, hi = rows.length - 1;                  // rows[iy] ≤ z < rows[iy + 1]
  while (hi - iy > 1) { const mid = (iy + hi) >> 1; if (rows[mid] <= zz) iy = mid; else hi = mid; }
  const u = Math.min(1, Math.max(0, (x - XS[ix]) / (XS[ix + 1] - XS[ix]))), v = (zz - rows[iy]) / (rows[iy + 1] - rows[iy]);
  const h = (cx: number, cy: number) => heightAt(XS[cx], rows[cy]);
  const ha = h(ix, iy), hb = h(ix, iy + 1), hc = h(ix + 1, iy + 1), hd = h(ix + 1, iy);
  return u + v <= 1 ? ha + u * (hd - ha) + v * (hb - ha) : hc + (1 - u) * (hb - hc) + (1 - v) * (hd - hc);
}

/** The path's centre line: a gentle meander around the camera line (x = 0, which stays on
 *  the path: half-width ≥ 1.15 m, swing ≤ 0.6 m), straight for the last 16 m so it meets
 *  the door. PATH_GLSL below is the same curve. */
export function pathX(z: number) {
  const k = Math.min(1, Math.max(0, (z - (GATE_Z + 4)) / 12));
  return (Math.sin(z * .043 + 1.1) * .42 + Math.sin(z * .117 + .3) * .18) * k;
}

/* The ground and the path are one surface: the path is painted by the terrain shader from
   the world position (no second plane, nothing to z-fight). Dark dirt close to the ground's
   value, two wheel ruts, moss along the middle, ragged edges that wander along the walk;
   the ground gets broad light/dark patches, moss, and a trodden verge by the path. */
const f = (v: number) => v.toFixed(2);              // a number as a GLSL float
const MAX_LAMPS = 10;                               // the uniform array's fixed size (the walk has 7)
const lamps = { value: Array.from({ length: MAX_LAMPS }, () => new Vector4(0, 0, 0, 0)) };   // w 0: unused (the default w is 1)
/** a warm pool on the ground at (x, z), `r` m across each way — set before the first frame */
export function addGroundLight(x: number, z: number, r: number, k: number) {
  const free = lamps.value.find(l => l.w <= 0);
  if (!free) throw new Error(`terrain: more than ${MAX_LAMPS} ground lights`);
  free.set(x, z, r, k);
}
/* the painted light (see WINDOW_LIGHT below): needs `uGate` declared */
const LIGHT_GLSL = /* glsl */`
// light from a lit opening in a wall facing +z (x, z of its foot): a pool on the ground in
// front of it, widening as it goes out, brightest about reach / 2 from the wall
float spill(vec2 p, vec2 at, float w, float reach) {
  float dz = p.y - at.y;
  if (dz < 0.) return 0.;
  float a = (p.x - at.x) / (w + dz * .45), b = (dz - reach * .5) / (reach * .55);
  return exp(-a * a - b * b);
}
uniform float uDoor;
// lanterns away from the house (waylights.ts): x, z, radius, strength; strength 0 = unused
uniform vec4 uLamps[${MAX_LAMPS}];
float lampLight(vec2 p) {
  float k = 0.;
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    vec4 l = uLamps[i];
    if (l.w <= 0.) continue;
    vec2 d = (p - l.xy) / l.z;
    k += l.w * exp(-dot(d, d));
  }
  return k;
}
vec3 windowLight(vec2 p) {
  float k = spill(p, vec2(-${f(MOD)}, uGate), .75, 2.4) + spill(p, vec2(${f(MOD)}, uGate), .75, 2.4)   // ground floor
    + .3 * (spill(p, vec2(-${f(MOD)}, uGate + ${f(JETTY)}), 1., 5.) + spill(p, vec2(${f(MOD)}, uGate + ${f(JETTY)}), 1., 5.))   // upper storey
    + .45 * spill(p, vec2(${f(WING.x0 + 3)}, ${f(WING.z0)}), .35, 2.)                         // the wing's window
    + 1.6 * uDoor * spill(p, vec2(0., uGate), .5, 4.5)                                      // the hall, door open
    + lampLight(p);
  return vec3(1., .48, .17) * k;
}`;
const PATH_GLSL = /* glsl */`
varying vec3 vTerrW;
uniform float uGate, uLitter, uSnow;
uniform vec3 uSnowCol;
uniform vec3 uLeafA, uLeafB, uLeafC, uLeafD;
float th(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tn(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(th(i), th(i + vec2(1, 0)), f.x), mix(th(i + vec2(0, 1)), th(i + vec2(1, 1)), f.x), f.y);
}
float pathX(float z) {
  float k = clamp((z - (uGate + 4.)) / 12., 0., 1.);
  return (sin(z * .043 + 1.1) * .42 + sin(z * .117 + .3) * .18) * k;
}
${BROOK_GLSL}
${LIGHT_GLSL}`;
const PAINT_GLSL = /* glsl */`
{
  vec2 w = vTerrW.xz;
  float sx = w.x - pathX(w.y), ax = abs(sx), side = sx < 0. ? -1. : 1.;
  float edge = 1.15 + tn(vec2(w.y * .45, side * 7.3)) * .5 + tn(w * 2.3) * .18;
  // the brook: no track down its banks (the bridge carries it over), wet dark soil at the
  // water's edge
  float bd = abs(w.y - brookZ(w.x)), bh = brookHalf(w.x), bEdge = (bh * .55 + bh + ${BROOK.bank.toFixed(2)}) * .5;
  float banks = 1. - smoothstep(bh + ${BROOK.bank.toFixed(2)}, bh + ${(BROOK.bank + .6).toFixed(2)}, bd);
  float wet = 1. - smoothstep(bEdge - .05, bEdge + .5, bd);
  float onPath = (1. - smoothstep(edge - .3, edge + .12, ax)) * smoothstep(uGate + .3, uGate + .9, w.y) * (1. - banks);
  float grain = tn(w * 7.) * .6 + tn(w * 19.) * .4;
  vec3 dirt = vec3(.064, .056, .045) * (.8 + .4 * grain);
  float rut = exp(-pow((ax - .55) / .17, 2.)) * (.6 + .4 * tn(vec2(w.y * .8, side)));
  dirt *= 1. - .38 * rut;
  float mid = (1. - smoothstep(.12, .32, ax)) * (.4 + .6 * tn(vec2(w.y * 1.7, 3.1)));
  dirt = mix(dirt, vec3(.036, .046, .03), mid * .55);
  float patchN = tn(w * .11) * .65 + tn(w * .37) * .35;
  vec3 ground = diffuseColor.rgb * (.55 + .8 * patchN);
  ground = mix(ground, ground * vec3(.78, 1.12, .72), smoothstep(.5, .75, tn(w * .23 + 9.)));
  float verge = (1. - smoothstep(edge, edge + 1.2, ax)) * step(uGate, w.y) * (1. - banks);
  ground = mix(ground, dirt * .8, verge * .35);
  vec3 col = mix(ground, dirt, onPath);
  col = mix(col, dirt * .55, wet * .75);
  // snow (the theme's, 0 = none): a blanket with a few thin patches, trodden on the track —
  // grey-white, the ruts dark where the wheels cut through to the mud; down the banks to the
  // ice (every snowy theme freezes the brook)
  if (uSnow > 0.) {
    float cover = uSnow * smoothstep(.25, .55, tn(w * .09 + 2.) * .7 + tn(w * .6) * .3 + .3);
    vec3 snow = uSnowCol * (.88 + .2 * tn(w * 1.7));
    vec3 trodden = mix(snow * .78, dirt * 1.3, .25 + .65 * rut);
    col = mix(mix(col, snow, cover), trodden, onPath * uSnow);
  }
  // fallen leaves (the theme's litter, 0 = none): four layers of leaf shapes, one leaf per
  // cell of a turned and scaled grid each, of many sizes and four colours; heaped in slow
  // drifts and piled along the track's edges, few on the track and dark there (trodden into
  // the mud). Where a leaf would be smaller than a few pixels the layers give way to their
  // average tint: drawn there, they shimmered as single-colour confetti.
  if (uLitter > 0.) {
    float heap = smoothstep(.3, .75, tn(w * .13 + 4.) * .7 + tn(w * .5 + 1.) * .3);
    float e = (ax - edge - .25) / .6, piled = exp(-e * e) * step(uGate, w.y);
    float keep = uLitter * clamp(.2 + .85 * heap + .45 * piled, 0., 1.) * mix(1., .25 - .2 * rut, onPath);
    float sharp = 1. - smoothstep(.012, .03, length(fwidth(w)));      // metres per pixel
    vec3 avg = (uLeafA + uLeafB + uLeafC + uLeafD) * .2;
    col = mix(col, avg * mix(1., .6, onPath), keep * .6 * (1. - sharp));
    for (int L = 0; L < 4; L++) {
      if (sharp <= 0.) break;
      float fl = float(L), ang = fl * 1.7 + .4, sc = 2.6 + fl * .6;
      vec2 r = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * w;
      vec2 q = r * sc + fl * vec2(.37, .61), cell = floor(q), f = fract(q) - .5;
      if (th(cell + 7.) > keep) continue;
      vec2 c = vec2(th(cell + 1.), th(cell + 2.)) * .24 - .12;
      float a = th(cell + 3.) * 6.283, s = sin(a), k = cos(a), size = .45 + .9 * th(cell + 4.);
      float aspect = .14 + .1 * th(cell + 6.);
      vec2 d = (f - c) / size; d = vec2(k * d.x + s * d.y, -s * d.x + k * d.y);
      // pointed at both ends, a midrib down its length
      float leafD = length(vec2(d.x / .36, d.y / (aspect * (1. - .7 * abs(d.x) / .36))));
      if (leafD > 1. || abs(d.x) > .36) continue;
      float pick = th(cell + 5.);
      vec3 leaf = pick < .3 ? uLeafA : pick < .55 ? uLeafD : pick < .8 ? uLeafB : uLeafC;
      leaf *= (.6 + .65 * th(cell + 9.)) * (1. - .3 * leafD) * (1. - .25 * (1. - smoothstep(0., .02, abs(d.y))));
      leaf = mix(leaf, vec3(dot(leaf, vec3(.33))) * .55, onPath * .7);     // wet and trodden on the track
      col = mix(col, leaf, (1. - smoothstep(.82, 1., leafD)) * sharp);
    }
  }
  diffuseColor.rgb = col;
}`;

/* The lit windows are unlit panes (no light source: every light is paid for by every pixel),
   so the ground in front of them got nothing — on snow the house stood on an even blue-white.
   Their light is painted instead, as emission in proportion to the ground's own colour, the
   way light falls on it: faint on the dark earth, a warm pool on snow. The open door pours
   the hall's light out (`doorSpill`, set with the door's angle). */
const WINDOW_LIGHT = 3.2;
export const doorSpill = { value: 0 };

const earth = new MeshStandardMaterial({ roughness: 1 });
earth.color.setRGB(.04, .048, .035);              // linear; darker than before — the mist is lighter now
earth.onBeforeCompile = sh => {
  sh.uniforms.uGate = { value: GATE_Z };
  sh.uniforms.uDoor = doorSpill;
  sh.uniforms.uLamps = lamps;
  // the theme's fallen leaves: their colours lit like the ground (×3, dimmed by night)
  const leaf = (i: number) => ({ value: new Color(look.leaves?.[i] ?? 0).multiplyScalar(.09) });
  sh.uniforms.uLitter = { value: look.litter ?? 0 };
  sh.uniforms.uSnow = { value: look.snow ?? 0 };
  sh.uniforms.uSnowCol = { value: SNOW };
  sh.uniforms.uLeafA = leaf(0); sh.uniforms.uLeafB = leaf(2); sh.uniforms.uLeafC = leaf(3); sh.uniforms.uLeafD = leaf(1);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vTerrW;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvTerrW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\n' + PATH_GLSL)
    .replace('#include <color_fragment>', '#include <color_fragment>\n' + PAINT_GLSL)
    .replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * windowLight(vTerrW.xz) * ${WINDOW_LIGHT.toFixed(2)};`);
};

/** The painted light on another material standing on the ground (the snow banks, frost.ts),
 *  so it takes the windows' and lanterns' pools like the terrain under it. */
export function groundLit(m: Material) {
  const before = m.onBeforeCompile.bind(m), key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => key() + '|groundLit';
  m.onBeforeCompile = (sh, r) => {
    before(sh, r);
    Object.assign(sh.uniforms, { uGate: { value: GATE_Z }, uDoor: doorSpill, uLamps: lamps });
    sh.vertexShader = 'varying vec3 vLitW;\n' + sh.vertexShader
      .replace('#include <project_vertex>', '#include <project_vertex>\nvLitW = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = 'varying vec3 vLitW;\nuniform float uGate;\n' + LIGHT_GLSL + '\n' + sh.fragmentShader
      .replace('#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * windowLight(vLitW.xz) * ${WINDOW_LIGHT.toFixed(2)};`);
  };
}

export function buildTerrain() {
  for (const rows of ROWS_OF) {
    const nx = XS.length, pos = new Float32Array(nx * rows.length * 3), idx: number[] = [];
    rows.forEach((z, r) => XS.forEach((x, c) => pos.set([x, heightAt(x, z), z], (r * nx + c) * 3)));
    for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < nx - 1; c++) {
      const a = r * nx + c, b = a + nx, d = a + 1;
      idx.push(a, b, d, b, b + 1, d);                // faces up (counter-clockwise from above)
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    scene.add(new Mesh(g, earth));
  }
}
