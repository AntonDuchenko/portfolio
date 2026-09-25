import { BufferAttribute, type BufferGeometry, type Material, Matrix4, Mesh, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* Static batching: every plain mesh under `root` (walls, beams, props, kit boxes) is baked
   into root space and merged with the others that share its material, so the tavern
   draws as one call per material instead of one per module part.

   Left alone: anything under `keep` (door leaves — they move), sprites, instanced
   meshes, multi-material meshes (the sign) and mirrored meshes (negative scale flips the
   winding, merging would turn them inside out). */

function asFloat(g: BufferGeometry, name: string) {
  const a = g.getAttribute(name);
  if (!a || (a.array instanceof Float32Array && !a.normalized)) return;
  const n = a.itemSize, f = new Float32Array(a.count * n);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) f[i * n + k] = a.getComponent(i, k);
  g.setAttribute(name, new BufferAttribute(f, n));
}

export function mergeStatic(root: Object3D, keep: Object3D[] = []) {
  root.updateMatrixWorld(true);
  const toRoot = new Matrix4().copy(root.matrixWorld).invert();
  const skip = new Set<Object3D>();
  for (const k of keep) k.traverse(o => skip.add(o));

  const groups = new Map<string, { material: Material; geos: BufferGeometry[]; meshes: Object3D[] }>();
  root.traverse(o => {
    if (!(o instanceof Mesh) || skip.has(o) || (o as { isInstancedMesh?: boolean }).isInstancedMesh) return;
    if (Array.isArray(o.material) || o.matrixWorld.determinant() < 0) return;
    const g = (o.geometry as BufferGeometry).clone();
    for (const name of Object.keys(g.attributes)) asFloat(g, name);
    if (!g.index) return;                                  // all kit and box geometry is indexed
    g.applyMatrix4(new Matrix4().multiplyMatrices(toRoot, o.matrixWorld));
    g.morphAttributes = {};
    const sig = (o.material as Material).uuid + '|' + Object.keys(g.attributes).sort().join(',');
    let grp = groups.get(sig);
    if (!grp) groups.set(sig, grp = { material: o.material as Material, geos: [], meshes: [] });
    grp.geos.push(g); grp.meshes.push(o);
  });

  let before = 0, after = 0;
  for (const { material, geos, meshes } of groups.values()) {
    before += meshes.length;
    const merged = meshes.length > 1 ? mergeGeometries(geos, false) : null;
    if (!merged) { after += meshes.length; continue; }     // single, or incompatible attributes
    for (const m of meshes) m.removeFromParent();
    const mesh = new Mesh(merged, material);
    mesh.name = `merged:${material.name || material.type}`;
    root.add(mesh);
    after++;
  }
  return { before, after };
}
