import { Color, type Material, type MeshStandardMaterial, Object3D } from 'three';
import { GATE_Z, TAV_END, TAV_HW, WING } from '../config';
import { Q } from '../quality';
import { rand, random, side } from '../random';
import { bounds, instanced, parts } from './assets';
import { night } from './forest';
import { fires } from './lights';
import { fireTex, sprite } from './sprites';
import { scene } from './stage';
import { pathX, surfaceY } from './terrain';

/* Undergrowth from the Nature kit: bushes, ferns and tall wispy grass along the walk and in
   the tavern's yard, and small clusters of glowing mushrooms at the path's edge — warm
   points that lead the eye to the door (the "lit path" reference), in the forest's own
   vocabulary rather than garden lamps. Static, laid from just behind the start to the
   tavern; one draw call per model part (6). Bases sink into the ground (hard rule 1). */

interface Item { x: number; z: number; s: number; sy?: number }

function lay(name: string, items: Item[], material?: (m: Material) => Material) {
  if (!items.length) return;
  const ps = parts('forest', name), b = bounds(ps);
  ps.forEach(p => night(p.material));
  const meshes = instanced(ps, items.length), o = new Object3D();
  if (material) meshes.forEach(m => { m.material = material(m.material); });
  items.forEach((it, i) => {
    o.position.set(it.x, surfaceY(it.x, it.z) - .03 - b.min.y * (it.sy ?? it.s), it.z);
    o.rotation.set(0, rand(0, 6.28), 0);
    o.scale.set(it.s, it.sy ?? it.s, it.s); o.updateMatrix();
    for (const m of meshes) m.setMatrixAt(i, o.matrix);
  });
  for (const m of meshes) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); scene.add(m); }
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
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + recolor)
      .replace('#include <normal_fragment_maps>', LIT_FROM_ABOVE);
  };
  return g;
}
// the plain bush wears the twisted tree's red leaves: keep their pattern (the texture's
// brightness) in a dark night green, a little darker than the ferns (lit from above, the
// whole bush catches the sky light)
const greenBush = (m: Material) =>
  foliage(m, 'diffuseColor.rgb = vec3(dot(diffuseColor.rgb, vec3(.75, .2, .05))) * vec3(.08, .11, .065);');
// the flowering bush: leaves a shade darker than the ferns' night tint (a copy — the window
// boxes keep the untinted leaves under their lanterns), the flowers dimmed and cooled
const flowerBush = (m: Material) => {
  const g = foliage(m);
  g.color.multiply(new Color(m.name === 'Flowers' ? 0x707690 : 0x3a4a46));
  return g;
};

// the mushrooms' caps glow warm: the texture drives the emission, so the pale caps light
// up and the stems stay dark
function glowing(m: Material) {
  const g = (m as MeshStandardMaterial).clone();
  g.emissive = new Color().setRGB(1, .5, .2);
  g.emissiveMap = g.map;
  g.emissiveIntensity = 1.4;
  return g;
}

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

  // glowing mushrooms: a cluster every ~6–9 m at the path's edge, denser near the door
  const lights: { x: number; y: number; z: number }[] = [];
  for (let z = z1 + 1; z < z0; z += rand(5.5, 9) * (z < GATE_Z + 25 ? .7 : 1)) {
    const cx = pathX(z) + side() * rand(1.5, 2.6), k = 2 + Math.floor(random() * 3);
    for (let j = 0; j < k; j++) shroom.push({ x: cx + rand(-.3, .3), z: z + rand(-.3, .3), s: rand(.35, .6) });
    lights.push({ x: cx, y: surfaceY(cx, z) + .22, z });
  }

  lay('bush', bush.filter(p => !yard(p.x, p.z)), greenBush);
  lay('flowers', bloom.filter(p => !yard(p.x, p.z)), flowerBush);
  lay('fern', fern.filter(p => !yard(p.x, p.z)));
  lay('tallgrass', tall);
  lay('mushroom', shroom, glowing);

  // their glow: small flickering halos, batched with the other flames (no extra draw call)
  for (const l of lights) {
    const sp = sprite(fireTex, .45, .35);
    sp.position.set(l.x, l.y, l.z); scene.add(sp);
    fires.push({ light: null, sp, phase: rand(0, 10), outside: true });
  }
}
