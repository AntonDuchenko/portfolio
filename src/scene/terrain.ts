import { Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { GATE_Z, TAV_END, TAV_HW, WING } from '../config';
import { scene } from './stage';

/* The ground: four 170 × 80 m strips along the route and past the tavern, a height field
   on a grid.

   Objects stand on the *rendered* surface (surfaceY), not on the height function: between
   grid vertices the mesh is flat triangles, and anything placed on the smooth function
   floated up to 0.8 m where a triangle dipped below it. The grid is dense along the path
   (a vertex at the edge of the flat band, ±2.2 m, and every 1–1.5 m while the shoulders
   rise), so the ground under the path is exactly flat and the edges follow the relief. */

const SEG_LEN = 80, SEG_N = 4, ROWS = 20, ROW = SEG_LEN / ROWS, TERR_A = 1.1;
const step = (a: number, b: number, d: number) => Array.from({ length: Math.round((b - a) / d) + 1 }, (_, i) => a + i * d);
const XS = [...step(-85, -15, 5), -12, -10, -8.5, -7.2, -6, -5, -4, -3, -2.2, 0,
  2.2, 3, 4, 5, 6, 7.2, 8.5, 10, 12, ...step(15, 85, 5)];
// strip i covers z ∈ [zc − 40, zc + 40], zc = 40 − 80 i; its first vertex row is at zc − 40
const stripCentre = (i: number) => 40 - i * SEG_LEN;

const noise = (x: number, z: number) => Math.sin(x * .13 + z * .07) + Math.sin(x * .31 - z * .19) * .5 +
  Math.sin(x * .07 + z * .23) * .8 + Math.sin(z * .41 + x * .05) * .3;

/** The height function the grid samples. Flat within 2.2 m of the path (in front of the
 *  door), flat in a yard around the building, rising into a wooded slope behind it. */
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
  return noise(x, -z) * band * yard * TERR_A + rise + under;
}

/** Height of the rendered ground at (x, z): the triangle the point falls in, exactly as
 *  PlaneGeometry splits each cell (a–b–d below the diagonal, b–c–d above it). */
export function surfaceY(x: number, z: number) {
  const i = Math.min(SEG_N - 1, Math.max(0, Math.floor((SEG_LEN - z) / SEG_LEN)));
  const z0 = stripCentre(i) - SEG_LEN / 2;
  let ix = 0;
  while (ix < XS.length - 2 && x > XS[ix + 1]) ix++;
  const fy = Math.min(ROWS, Math.max(0, (z - z0) / ROW)), iy = Math.min(ROWS - 1, Math.floor(fy));
  const u = Math.min(1, Math.max(0, (x - XS[ix]) / (XS[ix + 1] - XS[ix]))), v = fy - iy;
  const h = (cx: number, cy: number) => heightAt(XS[cx], z0 + cy * ROW);
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
const PATH_GLSL = /* glsl */`
varying vec3 vTerrW;
uniform float uGate;
float th(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tn(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(th(i), th(i + vec2(1, 0)), f.x), mix(th(i + vec2(0, 1)), th(i + vec2(1, 1)), f.x), f.y);
}
float pathX(float z) {
  float k = clamp((z - (uGate + 4.)) / 12., 0., 1.);
  return (sin(z * .043 + 1.1) * .42 + sin(z * .117 + .3) * .18) * k;
}`;
const PAINT_GLSL = /* glsl */`
{
  vec2 w = vTerrW.xz;
  float sx = w.x - pathX(w.y), ax = abs(sx), side = sx < 0. ? -1. : 1.;
  float edge = 1.15 + tn(vec2(w.y * .45, side * 7.3)) * .5 + tn(w * 2.3) * .18;
  float onPath = (1. - smoothstep(edge - .3, edge + .12, ax)) * smoothstep(uGate + .3, uGate + .9, w.y);
  float grain = tn(w * 7.) * .6 + tn(w * 19.) * .4;
  vec3 dirt = vec3(.064, .056, .045) * (.8 + .4 * grain);
  float rut = exp(-pow((ax - .55) / .17, 2.)) * (.6 + .4 * tn(vec2(w.y * .8, side)));
  dirt *= 1. - .38 * rut;
  float mid = (1. - smoothstep(.12, .32, ax)) * (.4 + .6 * tn(vec2(w.y * 1.7, 3.1)));
  dirt = mix(dirt, vec3(.036, .046, .03), mid * .55);
  float patchN = tn(w * .11) * .65 + tn(w * .37) * .35;
  vec3 ground = diffuseColor.rgb * (.55 + .8 * patchN);
  ground = mix(ground, ground * vec3(.78, 1.12, .72), smoothstep(.5, .75, tn(w * .23 + 9.)));
  float verge = (1. - smoothstep(edge, edge + 1.2, ax)) * step(uGate, w.y);
  ground = mix(ground, dirt * .8, verge * .35);
  diffuseColor.rgb = mix(ground, dirt, onPath);
}`;

const earth = new MeshStandardMaterial({ roughness: 1 });
earth.color.setRGB(.04, .048, .035);              // linear; darker than before — the mist is lighter now
earth.onBeforeCompile = sh => {
  sh.uniforms.uGate = { value: GATE_Z };
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vTerrW;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvTerrW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\n' + PATH_GLSL)
    .replace('#include <color_fragment>', '#include <color_fragment>\n' + PAINT_GLSL);
};

export function buildTerrain() {
  for (let i = 0; i < SEG_N; i++) {
    const zc = stripCentre(i);
    const g = new PlaneGeometry(1, SEG_LEN, XS.length - 1, ROWS), p = g.attributes.position;
    for (let v = 0; v < p.count; v++) {
      const x = XS[v % XS.length];
      p.setX(v, x); p.setZ(v, heightAt(x, zc - p.getY(v)));
    }
    g.computeVertexNormals();
    const m = new Mesh(g, earth);
    m.rotation.x = -Math.PI / 2; m.position.z = zc; scene.add(m);
  }
}
