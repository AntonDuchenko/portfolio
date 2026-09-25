import { Mesh, PlaneGeometry } from 'three';
import { GATE_Z } from '../config';
import { M } from './materials';
import { scene } from './stage';

const SEG_LEN = 80, SEG_N = 3, TERR_A = 1.1;

const noise = (x: number, z: number) => Math.sin(x * .13 + z * .07) + Math.sin(x * .31 - z * .19) * .5 +
  Math.sin(x * .07 + z * .23) * .8 + Math.sin(z * .41 + x * .05) * .3;

/** One global height function: terrain, trees and rocks all sample it. */
export function terrainY(x: number, z: number) {
  const amp = Math.min(1, Math.max(0, (Math.abs(x) - 2.2) / 5));
  // near the tavern the ground flattens, and under the building it sinks —
  // otherwise it ends up a centimetre from the floor and z-fights (hard rule 1)
  const near = Math.min(1, Math.max(0, (z - (GATE_Z + 5)) / 15));
  const sink = z < GATE_Z + .2 ? -1.8 * Math.min(1, (GATE_Z + .2 - z) / 2.5) : 0;
  return noise(x, -z) * amp * near * TERR_A + sink;
}

export function buildTerrain() {
  for (let i = 0; i < SEG_N; i++) {
    const m = new Mesh(new PlaneGeometry(170, SEG_LEN, 34, 20), M.earth);
    m.rotation.x = -Math.PI / 2; m.position.z = 40 - i * SEG_LEN; scene.add(m);
    const z = 40 - i * SEG_LEN, p = m.geometry.attributes.position;
    for (let v = 0; v < p.count; v++) p.setZ(v, terrainY(p.getX(v), z - p.getY(v)));
    p.needsUpdate = true; m.geometry.computeVertexNormals();
  }
  const path = new Mesh(new PlaneGeometry(3.4, 181), M.path);
  path.rotation.x = -Math.PI / 2; path.position.set(0, .05, -40.5); scene.add(path);  // ends at GATE_Z+1
}
