import {
  CanvasTexture, Color, InstancedMesh, type Material, MeshBasicMaterial, type MeshStandardMaterial, Object3D,
  PlaneGeometry, Vector3
} from 'three';
import { GATE_Z, TAV_END, TAV_HW, WING } from '../config';
import { Q } from '../quality';
import { rand, random, side } from '../random';
import { bounds, instanced, parts } from './assets';
import { night } from './forest';
import { scene } from './stage';
import { pathX, surfaceY } from './terrain';

/* Undergrowth from the Nature kit: bushes, ferns and tall wispy grass along the walk and in
   the tavern's yard, and small clusters of mushrooms at the path's edge (no glow: the warm
   caps and their halos read as odd blobs, removed on review). Static, laid from just behind
   the start to the tavern; one draw call per model part (6) and one for the bushes' contact
   shadows. Bases sink into the ground (hard rule 1). */

interface Item { x: number; z: number; s: number; sy?: number }

/** `rooted`: the model's origin is its ground line and the parts below it are roots and
 *  stray low leaves meant to be buried — it stands on its origin, at the lowest ground
 *  under its footprint (on a slope its downhill edge hung in the air). Otherwise its lowest
 *  point goes to the ground at its centre. (The bushes reach 0.23 below their origin with
 *  1 % of their vertices: stood on that, they hovered 0.2–0.4 m.) Returns the placements. */
function lay(name: string, items: Item[], material?: (m: Material) => Material, rooted = false) {
  if (!items.length) return [];
  const ps = parts('forest', name), b = bounds(ps), r = Math.max(b.max.x, -b.min.x, b.max.z, -b.min.z) * .6;
  ps.forEach(p => night(p.material));
  const meshes = instanced(ps, items.length), o = new Object3D();
  if (material) meshes.forEach(m => { m.material = material(m.material); });
  items.forEach((it, i) => {
    const k = it.sy ?? it.s, d = r * it.s;
    const ground = rooted
      ? Math.min(...[[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]].map(([dx, dz]) => surfaceY(it.x + dx, it.z + dz))) - .06 * k
      : surfaceY(it.x, it.z) - .03 - b.min.y * k;
    o.position.set(it.x, ground, it.z);
    o.rotation.set(0, rand(0, 6.28), 0);
    o.scale.set(it.s, it.sy ?? it.s, it.s); o.updateMatrix();
    for (const m of meshes) m.setMatrixAt(i, o.matrix);
  });
  for (const m of meshes) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); scene.add(m); }
  return items;
}

/* Contact shadows: a soft dark disc on the ground under each bush. Lit from above (see
   foliage) the bushes cast nothing, and with the ground under them as bright as anywhere
   they sat on it like balls. Each disc is tilted to the ground (four samples) and lifted
   2 cm; one draw call. */
function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,.8)'); g.addColorStop(.6, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new CanvasTexture(c);
}
function contactShadows(items: Item[], radius: number) {
  if (!items.length) return;
  const disc = new InstancedMesh(new PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, color: 0x000000,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), items.length);
  const o = new Object3D(), n = new Vector3(), up = new Vector3(0, 1, 0);
  items.forEach((it, i) => {
    const rr = radius * it.s, h = (dx: number, dz: number) => surfaceY(it.x + dx, it.z + dz);
    n.set(h(-rr, 0) - h(rr, 0), 2 * rr, h(0, -rr) - h(0, rr)).normalize();
    o.position.set(it.x, h(0, 0) + .02, it.z);
    o.quaternion.setFromUnitVectors(up, n);
    o.scale.setScalar(rr); o.updateMatrix();
    disc.setMatrixAt(i, o.matrix);
  });
  disc.renderOrder = 1;                              // after the ground, before the leaves' cut-outs blend
  disc.computeBoundingSphere(); scene.add(disc);
}

/** clear of the building and its doorstep, the side wing, and the yard in front of the wing (its
 *  cart and the view of it from the path) */
const yard = (x: number, z: number) => (Math.abs(x) < TAV_HW + .6 && z > TAV_END - .6 && z < GATE_Z + 1.2)
  || (x > 0 && x < WING.x1 + .8 && z > WING.z1 - .8 && z < WING.z0 + .8)
  || (x > WING.x0 && x < WING.x1 + 4 && z > WING.z0 && z < GATE_Z + 9);

// Bushes are alpha-cut leaf cards: lit by their own normals, the cards facing away from
// the moon went black and the bushes read as paper cut-outs. Lit as if every leaf faced up
// (85 %), they shade like one leafy mass and keep the texture's detail.
const LIT_FROM_ABOVE = '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, (viewMatrix * vec4(0., 1., 0., 0.)).xyz, .85));';
function foliage(m: Material, recolor = '') {
  const g = (m as MeshStandardMaterial).clone();
  g.roughness = 1;                                   // facing up, a gloss caught the moon: grey haze
  g.metalness = 0;
  g.customProgramCacheKey = () => 'foliage' + recolor;   // the default key is the hook's source, alike for all
  g.onBeforeCompile = sh => {
    // and darker towards the roots (the model's own height, 0 at its ground line): with the
    // light from above the base was as bright as the crown and the bush sat on the ground
    // like a cut-out laid over it
    sh.vertexShader = 'varying float vFoliageY;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFoliageY = position.y;');
    sh.fragmentShader = 'varying float vFoliageY;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + recolor
        + '\ndiffuseColor.rgb *= mix(.3, 1., smoothstep(-.05, .8, vFoliageY));')
      .replace('#include <normal_fragment_maps>', LIT_FROM_ABOVE);
  };
  return g;
}
// the plain bush wears the twisted tree's red leaves: keep their pattern (the texture's
// brightness) in a dark night green, a little darker than the ferns (lit from above, the
// whole bush catches the sky light)
const greenBush = (m: Material) =>
  foliage(m, 'diffuseColor.rgb = vec3(dot(diffuseColor.rgb, vec3(.75, .2, .05))) * vec3(.05, .07, .042);');
// the flowering bush: leaves a shade darker than the ferns' night tint (a copy — the window
// boxes keep the untinted leaves under their lanterns), the flowers dimmed and cooled
const flowerBush = (m: Material) => {
  const g = foliage(m);
  g.color.multiply(new Color(m.name === 'Flowers' ? 0x606680 : 0x27322f));
  return g;
};

export function buildUndergrowth(startZ: number) {
  const z0 = startZ + 10, z1 = GATE_Z + 2, len = z0 - z1;
  const n = (per: number) => Math.round(len * per * Q.forest);
  const bush: Item[] = [], bloom: Item[] = [], fern: Item[] = [], tall: Item[] = [], shroom: Item[] = [];
  const shrub = (it: Item) => (random() < .3 ? bloom : bush).push(it);
  const along = (min: number, max: number) => { const z = rand(z1, z0); return { x: pathX(z) + side() * rand(min, max), z }; };

  for (let i = n(.45); i--;) shrub({ ...along(3, 15), s: rand(.9, 1.6) });
  for (let i = n(.7); i--;) fern.push({ ...along(2, 11), s: rand(.5, .9) });
  for (let i = n(.9); i--;) { const p = along(1.6, 7); tall.push({ ...p, s: rand(.45, .75), sy: rand(.35, .7) }); }

  // the yard: bushes at the corners and along the side walls, grass at the wall foot
  for (const s of [-1, 1]) {
    shrub({ x: s * (TAV_HW + 1.9), z: GATE_Z + .9, s: rand(1, 1.3) });              // beyond the corner barrels
    for (let i = 0; i < Math.round(4 * Q.forest); i++) shrub({ x: s * (TAV_HW + rand(1, 3.5)), z: GATE_Z - rand(1, 13), s: rand(.9, 1.4) });
    for (let i = 0; i < Math.round(6 * Q.forest); i++) {
      const x = s * (TAV_HW + rand(.35, 1)), z = GATE_Z + rand(.25, .9) - (random() < .5 ? rand(1, 13) : 0);
      if (!yard(x, z)) tall.push({ x, z, s: rand(.35, .55), sy: rand(.3, .5) });
    }
  }

  // grass along the foot of the side wing's outer wall
  for (let i = 0; i < Math.round(5 * Q.forest); i++) tall.push({ x: WING.x1 + rand(.3, .9), z: rand(WING.z1, WING.z0), s: rand(.35, .55), sy: rand(.3, .5) });

  // mushrooms: a small cluster every ~6–9 m at the path's edge
  for (let z = z1 + 1; z < z0; z += rand(5.5, 9)) {
    const cx = pathX(z) + side() * rand(1.5, 2.6), k = 2 + Math.floor(random() * 3);
    for (let j = 0; j < k; j++) shroom.push({ x: cx + rand(-.3, .3), z: z + rand(-.3, .3), s: rand(.35, .6) });
  }

  contactShadows([...lay('bush', bush.filter(p => !yard(p.x, p.z)), greenBush, true),
    ...lay('flowers', bloom.filter(p => !yard(p.x, p.z)), flowerBush, true)], 1.6);
  lay('fern', fern.filter(p => !yard(p.x, p.z)));
  lay('tallgrass', tall);
  lay('mushroom', shroom);
}
