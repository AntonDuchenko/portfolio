import { Mesh, PlaneGeometry } from 'three';
import { GATE_Z } from '../config';
import { M } from './materials';
import { scene } from './stage';

/* The ground: three 170 × 80 m strips along the route, a height field on a grid.

   Objects stand on the *rendered* surface (surfaceY), not on the height function: between
   grid vertices the mesh is flat triangles, and anything placed on the smooth function
   floated up to 0.8 m where a triangle dipped below it. The grid is dense along the path
   (a vertex at the edge of the flat band, ±2.2 m, and every 1–1.5 m while the shoulders
   rise), so the ground under the path is exactly flat and the edges follow the relief. */

const SEG_LEN = 80, SEG_N = 3, ROWS = 20, ROW = SEG_LEN / ROWS, TERR_A = 1.1;
const step = (a: number, b: number, d: number) => Array.from({ length: Math.round((b - a) / d) + 1 }, (_, i) => a + i * d);
const XS = [...step(-85, -15, 5), -12, -10, -8.5, -7.2, -6, -5, -4, -3, -2.2, 0,
  2.2, 3, 4, 5, 6, 7.2, 8.5, 10, 12, ...step(15, 85, 5)];
// strip i covers z ∈ [zc − 40, zc + 40], zc = 40 − 80 i; its first vertex row is at zc − 40
const stripCentre = (i: number) => 40 - i * SEG_LEN;

const noise = (x: number, z: number) => Math.sin(x * .13 + z * .07) + Math.sin(x * .31 - z * .19) * .5 +
  Math.sin(x * .07 + z * .23) * .8 + Math.sin(z * .41 + x * .05) * .3;

/** The height function the grid samples. Flat within 2.2 m of the path. */
function heightAt(x: number, z: number) {
  const amp = Math.min(1, Math.max(0, (Math.abs(x) - 2.2) / 5));
  // near the tavern the ground flattens, and under the building it sinks —
  // otherwise it ends up a centimetre from the floor and z-fights (hard rule 1)
  const near = Math.min(1, Math.max(0, (z - (GATE_Z + 5)) / 15));
  const sink = z < GATE_Z + .2 ? -1.8 * Math.min(1, (GATE_Z + .2 - z) / 2.5) : 0;
  return noise(x, -z) * amp * near * TERR_A + sink;
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

export function buildTerrain() {
  for (let i = 0; i < SEG_N; i++) {
    const zc = stripCentre(i);
    const g = new PlaneGeometry(1, SEG_LEN, XS.length - 1, ROWS), p = g.attributes.position;
    for (let v = 0; v < p.count; v++) {
      const x = XS[v % XS.length];
      p.setX(v, x); p.setZ(v, heightAt(x, zc - p.getY(v)));
    }
    g.computeVertexNormals();
    const m = new Mesh(g, M.earth);
    m.rotation.x = -Math.PI / 2; m.position.z = zc; scene.add(m);
  }
  const path = new Mesh(new PlaneGeometry(3.4, 181), M.path);
  path.rotation.x = -Math.PI / 2; path.position.set(0, .05, -40.5); scene.add(path);  // ends at GATE_Z+1
}
