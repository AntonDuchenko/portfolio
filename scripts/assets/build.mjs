// Builds public/models/{forest,village,props}.glb from the Quaternius kits.
//
//   node scripts/assets/build.mjs
//
// Each kit becomes ONE .glb (shared textures are stored once). Every model is a root
// node named by its key below; the scene clones nodes by name (src/scene/assets.ts).
// Steps: weld → per-material simplification → merge → dedup/prune → textures to
// 1K WebP → meshopt compression. Budgets from CLAUDE.md are checked at the end and
// the build fails if one is exceeded. A manifest with tris and bounds per model is
// written next to this script — use it for placement numbers (hard rules 1–3).

import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  dedup, getBounds, mergeDocuments, meshopt, prune, textureCompress, weld
} from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'public/models');
const TEX_MAX = 1024;

const NATURE = 'Stylized Nature MegaKit[Standard]/glTF';
const VILLAGE = 'Medieval Village MegaKit[Standard]/Medieval Village MegaKit[Standard]/glTF';
const PROPS = 'Fantasy Props MegaKit[Standard]/Exports/glTF';

/* key: { src, tris: {material: target triangles}, budget } */
const KITS = {
  forest: {
    dir: NATURE,
    dropNormalMaps: true,          // night + fog: normal maps are invisible at forest distance
    items: {
      pine_a: { src: 'Pine_5', tris: { Bark_NormalTree: 140, Leaves_Pine: 1040 }, budget: 1200 },
      pine_b: { src: 'Pine_2', tris: { Bark_NormalTree: 420, Leaves_Pine: 760 }, budget: 1200 },
      snag: { src: 'DeadTree_3', tris: { Bark_DeadTree: 1180 }, budget: 1200 },
      rock: { src: 'Rock_Medium_2', budget: 250 }
    }
  },
  village: {
    dir: VILLAGE,
    items: Object.fromEntries([
      'Wall_UnevenBrick_Straight', 'Wall_UnevenBrick_Window_Wide_Flat',
      'Wall_Plaster_Straight', 'Wall_Plaster_Window_Wide_Flat', 'Wall_Plaster_Window_Wide_Round',
      'Wall_Plaster_WoodGrid', 'Corner_Exterior_Wood', 'Wall_BottomCover', 'Door_8_Flat',
      'Window_Wide_Flat1', 'Window_Wide_Round1',
      'Roof_RoundTiles_6x10', 'Roof_RoundTiles_6x8', 'Roof_Front_Brick6',
      'Prop_Chimney', 'Floor_WoodDark', 'HoleCover_Straight'
    ].map(n => [n, { src: n }]))
  },
  props: {
    dir: PROPS,
    items: Object.fromEntries([
      'Table_Large', 'Bench', 'Stool', 'Chair_1', 'Barrel', 'Barrel_Holder', 'Cabinet',
      'Shelf_Small_Bottles', 'Shelf_Simple', 'Mug', 'Candle_1', 'CandleStick', 'Chandelier',
      'Lantern_Wall', 'Bottle_1', 'Crate_Wooden', 'Table_Plate', 'Peg_Rack', 'Cauldron'
    ].map(n => [n, { src: n }]))
  }
};

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const triCount = prim => {
  const i = prim.getIndices();
  return (i ? i.getCount() : prim.getAttribute('POSITION').getCount()) / 3;
};
function nodeTris(node) {
  let n = 0;
  node.traverse(c => { const m = c.getMesh(); if (m) for (const p of m.listPrimitives()) n += triCount(p); });
  return n;
}

// Leaves are hundreds of separate alpha cards and bark has thin branches: plain edge
// collapse cannot remove islands, so it stalls far above the budget. Step up:
// collapse + prune small islands, then vertex clustering (sloppy) as the last resort.
function simplifyTo(prim, target) {
  const pos = prim.getAttribute('POSITION').getArray();
  const src = new Uint32Array(prim.getIndices().getArray());
  const want = target * 3;
  let [out] = MeshoptSimplifier.simplify(src, pos, 3, want, .08, ['Prune']);
  if (out.length > want) [out] = MeshoptSimplifier.simplifySloppy(src, pos, 3, null, want, 1);
  prim.getIndices().setArray(pos.length / 3 > 65535 ? out : new Uint16Array(out));
}

async function loadItem(dir, key, item) {
  const doc = await io.read(join(ROOT, dir, `${item.src}.gltf`));
  await doc.transform(weld());
  if (item.tris) {
    await MeshoptSimplifier.ready;
    for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
      const target = item.tris[prim.getMaterial()?.getName()];
      const have = triCount(prim);
      if (!target || have <= target) continue;
      // error bound is generous on purpose: the target count is what matters
      simplifyTo(prim, target);
    }
  }
  // wrap everything under one node named by the key
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const wrap = doc.createNode(key);
  for (const child of scene.listChildren()) { scene.removeChild(child); wrap.addChild(child); }
  scene.addChild(wrap);
  return doc;
}

async function buildKit(name, kit) {
  const target = new Document();
  target.createBuffer();
  const main = target.createScene(name);
  target.getRoot().setDefaultScene(main);
  for (const [key, item] of Object.entries(kit.items)) {
    const src = await loadItem(kit.dir, key, item);
    mergeDocuments(target, src);
  }
  // collect every merged scene's roots into the main scene
  for (const s of target.getRoot().listScenes()) {
    if (s === main) continue;
    for (const n of s.listChildren()) { s.removeChild(n); main.addChild(n); }
    s.dispose();
  }
  // one buffer
  const [buffer, ...rest] = target.getRoot().listBuffers();
  for (const b of rest) {
    for (const a of target.getRoot().listAccessors()) if (a.getBuffer() === b) a.setBuffer(buffer);
    b.dispose();
  }
  if (kit.dropNormalMaps) {
    for (const m of target.getRoot().listMaterials()) m.setNormalTexture(null);
  }
  await target.transform(
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX_MAX, TEX_MAX], quality: 85 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' })
  );

  // budgets and manifest
  const manifest = {}, errors = [];
  for (const node of main.listChildren()) {
    const key = node.getName(), item = kit.items[key];
    const b = getBounds(node), tris = nodeTris(node);
    manifest[key] = {
      src: item.src, tris,
      min: b.min.map(v => +v.toFixed(3)), max: b.max.map(v => +v.toFixed(3))
    };
    if (item.budget && tris > item.budget) errors.push(`${name}/${key}: ${tris} tris > ${item.budget}`);
  }
  for (const t of target.getRoot().listTextures()) {
    const s = t.getSize();
    if (s && Math.max(...s) > TEX_MAX) errors.push(`${name}: texture ${t.getName()} ${s.join('x')} > ${TEX_MAX}`);
  }
  mkdirSync(OUT, { recursive: true });
  await io.write(join(OUT, `${name}.glb`), target);
  return { manifest, errors };
}

const all = {}, failures = [];
for (const [name, kit] of Object.entries(KITS)) {
  const { manifest, errors } = await buildKit(name, kit);
  all[name] = manifest; failures.push(...errors);
  const tris = Object.values(manifest).reduce((s, m) => s + m.tris, 0);
  console.log(`${name}.glb: ${Object.keys(manifest).length} models, ${tris} tris`);
  for (const [k, m] of Object.entries(manifest)) console.log(`  ${k.padEnd(34)} ${String(m.tris).padStart(6)}`);
}
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), 'manifest.json'), JSON.stringify(all, null, 1) + '\n');
if (failures.length) { console.error('\nBudget exceeded:\n  ' + failures.join('\n  ')); process.exit(1); }
