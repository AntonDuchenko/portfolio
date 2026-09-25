import {
  Color, DynamicDrawUsage, type InstancedMesh, type Material, MeshStandardMaterial, NormalBlending, Object3D
} from 'three';
import { GATE_Z } from '../config';
import { Q } from '../quality';
import { rand, random, side } from '../random';
import { bounds, instanced, parts } from './assets';
import { type GlowSprite, mistTex, sprite } from './sprites';
import { scene } from './stage';
import { surfaceY } from './terrain';

// The forest is finite (route 0 → GATE_Z): instances behind the camera are
// re-placed ahead of it, never past GATE_Z + 4.
// Draw calls: pine_a and pine_b are bark + leaves (2 each), snag and rock one each → 6.
const SPREAD = 122, AHEAD = 190, BEHIND = 14;

interface Placement { x: number; y: number; z: number; h: number; w: number; rx?: number; ry?: number; rz?: number }
interface Field { meshes: InstancedMesh[]; count: number; place: (z: number) => Placement; data: Placement[] }

const dummy = new Object3D(), fields: Field[] = [];
const mists: { sp: GlowSprite; drift: number; phase: number }[] = [];

function write(f: Field, i: number) {
  const d = f.data[i];
  dummy.position.set(d.x, d.y, d.z); dummy.rotation.set(d.rx || 0, d.ry || 0, d.rz || 0);
  dummy.scale.set(d.w, d.h, d.w); dummy.updateMatrix();
  for (const m of f.meshes) m.setMatrixAt(i, dummy.matrix);
}
// The Nature kit is painted for daylight; the prototype's forest was near-black
// (bark 0x1d1f26). Multiply the kit colours down into a cold night tone.
const NIGHT_TINT: Record<string, number> = {
  Leaves_Pine: 0x4f6166, Bark_NormalTree: 0x5d5a66, Bark_DeadTree: 0x6e6e78, Rocks: 0x565c66,
  PathRocks: 0xa4a2a6, Grass: 0x3f4d4a
};
const tinted = new Set<Material>();
export function night(m: Material) {
  const tint = NIGHT_TINT[m.name];
  if (tint === undefined || tinted.has(m) || !(m instanceof MeshStandardMaterial)) return;
  m.color.multiply(new Color(tint)); tinted.add(m);
}

let startZ = 0;

function field(name: string, count: number, place: (z: number, size: Size) => Placement) {
  const ps = parts('forest', name), b = bounds(ps);
  ps.forEach(p => night(p.material));
  // horizontal reach from the trunk and height of the unscaled model
  const size = { reach: Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z), height: b.max.y };
  const meshes = instanced(ps, count);
  const f: Field = { meshes, count, place: z => place(z, size), data: new Array<Placement>(count) };
  for (const m of meshes) { m.frustumCulled = false; m.instanceMatrix.setUsage(DynamicDrawUsage); scene.add(m); }
  for (let i = 0; i < count; i++) {
    // spread over SPREAD metres from just behind the start; anything that would land
    // past GATE_Z + 4 (inside the tavern) is kept at scale 0 and never re-placed
    const z = startZ + 10 - random() * SPREAD;
    f.data[i] = f.place(z);
    if (z < GATE_Z + 4) f.data[i].w = f.data[i].h = 0;
    write(f, i);
  }
  for (const m of meshes) m.instanceMatrix.needsUpdate = true;
  fields.push(f); return f;
}
interface Size { reach: number; height: number }

// Kit pines are bushy: at the base the crown reaches ~3.5 m from the trunk. Trunks are
// pushed out by that reach so branch tips stay CLEAR m from the camera line.
const CLEAR = 1.2;

/** startZ — where the walk begins (it depends on the narration length). */
export function buildForest(start: number) {
  startZ = start;
  const n = (count: number) => Math.round(count * Q.forest);
  for (const name of ['pine_a', 'pine_b']) field(name, n(105), (z, m) => {
    const h = rand(5, 13), s = h / m.height;
    const x = side() * (m.reach * s + CLEAR + rand(0, 30));
    return { x, z, y: surfaceY(x, z), h: s, w: s, ry: rand(0, 6.28), rz: rand(-.05, .05) };
  });
  // bare snags: slim trunk, branches only high up, so they may stand close to the path
  field('snag', n(80), (z, m) => {
    const x = side() * rand(2.3, 18), s = rand(6, 12) / m.height;
    return { x, z, y: surfaceY(x, z) - .1, h: s, w: s, ry: rand(0, 6.28), rz: rand(-.07, .07) };
  });
  field('rock', n(170), (z, m) => {
    const x = side() * rand(.3, 7), w = rand(.15, .5), s = w / m.reach;
    return { x, z, y: surfaceY(x, z) - w * .4, h: s * rand(.6, 1), w: s, rx: rand(-.3, .3), ry: rand(0, 6.28), rz: rand(-.3, .3) };
  });

  for (let i = 0; i < Q.mist; i++) {
    const sp = sprite(mistTex, rand(14, 26), rand(.1, .22));
    sp.material.blending = NormalBlending;
    const z = startZ + 10 - random() * SPREAD;
    sp.position.set(rand(-16, 16), rand(.3, 1.6), z);
    sp.visible = z > GATE_Z + 4;
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
        const nz = camZ - AHEAD + random() * 12;
        if (nz > GATE_Z + 4) { f.data[i] = f.place(nz); write(f, i); dirty = true; }
      }
    }
    if (dirty) for (const m of f.meshes) m.instanceMatrix.needsUpdate = true;
  }
}
