import {
  Box3, BufferAttribute, BufferGeometry, InstancedMesh, type Material, Matrix4, Mesh, type Object3D
} from 'three';
import { loadGLTF } from '../loaders/gltf';
import { Q } from '../quality';

/* Kit models, built by scripts/assets/build.mjs: one .glb per kit, each model is a root
   node named by its key (see scripts/assets/manifest.json for tris and bounds). */

const KITS = ['forest', 'village', 'props'] as const;
type Kit = typeof KITS[number];

const roots = {} as Record<Kit, Object3D>;

export async function loadKits() {
  const loaded = await Promise.all(KITS.map(k => loadGLTF(`${import.meta.env.BASE_URL}${Q.models}${k}.glb`)));
  KITS.forEach((k, i) => { roots[k] = loaded[i].scene; roots[k].updateMatrixWorld(true); });
}

function source(kit: Kit, name: string) {
  const o = roots[kit]?.getObjectByName(name);
  if (!o) throw new Error(`model ${kit}/${name} not found`);
  return o;
}

/** A fresh copy of a model (geometry and materials shared with the kit). */
export function model(kit: Kit, name: string): Object3D {
  const o = source(kit, name).clone(true);
  o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
  return o;
}

export interface Part { geometry: BufferGeometry; material: Material }

/** The model's meshes with their transforms (relative to the model root) baked in. */
export function parts(kit: Kit, name: string): Part[] {
  const root = source(kit, name), inv = new Matrix4().copy(root.matrixWorld).invert(), out: Part[] = [];
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    const geometry = dequantized(o.geometry as BufferGeometry)
      .applyMatrix4(new Matrix4().multiplyMatrices(inv, o.matrixWorld));
    out.push({ geometry, material: o.material as Material });
  });
  return out;
}

// meshopt stores positions/normals as normalized Int16/Int8 and puts the dequantization
// into the node transform. Baking a transform into such an attribute clamps it to
// [-1, 1] — convert to float first.
function dequantized(src: BufferGeometry) {
  const g = src.clone();
  for (const name of ['position', 'normal']) {
    const a = g.getAttribute(name);
    if (!a || a.array instanceof Float32Array) continue;
    const f = new Float32Array(a.count * 3);
    for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); }
    g.setAttribute(name, new BufferAttribute(f, 3));
  }
  return g;
}

export function bounds(ps: Part[]) {
  const b = new Box3();
  for (const p of ps) { p.geometry.computeBoundingBox(); b.union(p.geometry.boundingBox!); }
  return b;
}

/** One InstancedMesh per part — a model with bark + leaves is two draw calls. */
export function instanced(ps: Part[], count: number) {
  return ps.map(p => new InstancedMesh(p.geometry, p.material, count));
}

/** A kit material by name (shared, not a copy). */
export function kitMaterial(kit: Kit, name: string): Material {
  let found: Material | undefined;
  roots[kit].traverse(o => {
    if (found || !(o instanceof Mesh)) return;
    const ms = (Array.isArray(o.material) ? o.material : [o.material]) as Material[];
    found = ms.find(m => m.name === name);
  });
  if (!found) throw new Error(`material ${kit}/${name} not found`);
  return found;
}
