import {
  type BufferGeometry, ConeGeometry, CylinderGeometry, DynamicDrawUsage, IcosahedronGeometry,
  InstancedMesh, type Material, NormalBlending, Object3D
} from 'three';
import { GATE_Z } from '../config';
import { rand, side } from '../random';
import { M } from './materials';
import { type GlowSprite, mistTex, sprite } from './sprites';
import { scene } from './stage';
import { terrainY } from './terrain';

// The forest is finite (route 0 → GATE_Z): instances behind the camera are
// re-placed ahead of it, never past GATE_Z + 4.
const SPREAD = 122, AHEAD = 190, BEHIND = 14;

interface Placement { x: number; y: number; z: number; h: number; w: number; rx?: number; ry?: number; rz?: number }
interface Field { mesh: InstancedMesh; count: number; place: (z: number) => Placement; data: Placement[] }

const dummy = new Object3D(), fields: Field[] = [];
const mists: { sp: GlowSprite; drift: number; phase: number }[] = [];

function write(f: Field, i: number) {
  const d = f.data[i];
  dummy.position.set(d.x, d.y, d.z); dummy.rotation.set(d.rx || 0, d.ry || 0, d.rz || 0);
  dummy.scale.set(d.w, d.h, d.w); dummy.updateMatrix(); f.mesh.setMatrixAt(i, dummy.matrix);
}
function field(geo: BufferGeometry, mat: Material, count: number, place: Field['place']) {
  const mesh = new InstancedMesh(geo, mat, count); mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage); scene.add(mesh);
  const f: Field = { mesh, count, place, data: new Array(count) };
  for (let i = 0; i < count; i++) { f.data[i] = place(-Math.random() * SPREAD); write(f, i); }
  mesh.instanceMatrix.needsUpdate = true; fields.push(f); return f;
}

export function buildForest() {
  const pineGeo = new ConeGeometry(1, 1, 7, 1); pineGeo.translate(0, .5, 0);
  const trunkGeo = new CylinderGeometry(.6, 1, 1, 6, 1); trunkGeo.translate(0, .5, 0);
  field(pineGeo, M.bark, 210, z => {
    const x = side() * rand(2.8, 34), h = rand(5, 13);
    return { x, z, y: terrainY(x, z) - .2, h, w: h * rand(.12, .19), ry: rand(0, 6.28), rz: rand(-.05, .05) };
  });
  field(trunkGeo, M.bark, 80, z => {
    const x = side() * rand(2.3, 18), h = rand(6, 12);
    return { x, z, y: terrainY(x, z) - .25, h, w: rand(.12, .3), ry: rand(0, 6.28), rz: rand(-.07, .07) };
  });
  field(new IcosahedronGeometry(1, 0), M.rock, 170, z => {
    const x = side() * rand(.3, 7), w = rand(.15, .5);
    return { x, z, y: terrainY(x, z) - w * .4, h: w * rand(.6, 1), w, rx: rand(0, 6.28), ry: rand(0, 6.28), rz: rand(0, 6.28) };
  });

  for (let i = 0; i < 14; i++) {
    const sp = sprite(mistTex, rand(14, 26), rand(.1, .22));
    sp.material.blending = NormalBlending;
    sp.position.set(rand(-16, 16), rand(.3, 1.6), -Math.random() * SPREAD);
    scene.add(sp); mists.push({ sp, drift: rand(-.25, .25), phase: rand(0, 10) });
  }
}

export function updateMists(dt: number, t: number, camZ: number, inside: number) {
  for (const m of mists) {
    m.sp.position.x += m.drift * dt;
    m.sp.position.y = 1 + Math.sin(t * .25 + m.phase) * .35;
    m.sp.material.opacity = Math.max(0, (.16) * (1 - inside));
    if (m.sp.position.z > camZ + 20) {
      const nz = camZ - rand(60, AHEAD);
      if (nz > GATE_Z + 4) m.sp.position.z = nz; else m.sp.visible = false;
    }
  }
}

export function updateForest(camZ: number) {
  for (const f of fields) {
    let dirty = false;
    for (let i = 0; i < f.count; i++) {
      if (f.data[i].z > camZ + BEHIND) {
        const nz = camZ - AHEAD + Math.random() * 12;
        if (nz > GATE_Z + 4) { f.data[i] = f.place(nz); write(f, i); dirty = true; }
      }
    }
    if (dirty) f.mesh.instanceMatrix.needsUpdate = true;
  }
}
