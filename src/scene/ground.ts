import { Object3D } from 'three';
import { GATE_Z } from '../config';
import { Q } from '../quality';
import { rand, random, side } from '../random';
import { bounds, instanced, parts } from './assets';
import { night } from './forest';
import { scene } from './stage';
import { pathX, surfaceY } from './terrain';

/* The path dressed with the Nature kit: flat stepping stones here and there along the
   trodden middle, pebbles and short grass along the edges, all following the path's
   meander (pathX). The path itself is painted on the terrain (terrain.ts). Static — the
   walk only looks ahead, so it is laid from just behind the start to the tavern. Four
   draw calls (one per model). Everything sinks 2 cm into the ground (hard rule 1). */

const SINK = .02;
const groundY = (x: number, z: number) => surfaceY(x, z);

interface Item { x: number; z: number; s: number; sy?: number }

function lay(name: string, items: Item[]) {
  const ps = parts('forest', name), b = bounds(ps);
  ps.forEach(p => night(p.material));
  const meshes = instanced(ps, items.length), o = new Object3D();
  items.forEach((it, i) => {
    o.position.set(it.x, groundY(it.x, it.z) - SINK - b.min.y * it.s, it.z);
    o.rotation.set(0, rand(0, 6.28), 0);
    o.scale.set(it.s, it.sy ?? it.s, it.s); o.updateMatrix();
    for (const m of meshes) m.setMatrixAt(i, o.matrix);
  });
  for (const m of meshes) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); scene.add(m); }
}

export function buildGround(startZ: number) {
  const z0 = startZ + 12, z1 = GATE_Z + 1.4;               // the path ends at GATE_Z + 1
  const stones: [Item[], Item[]] = [[], []], pebbles: Item[] = [], grass: Item[] = [];
  // stepping stones: runs of them with bare dirt between (a solid line of stones read as
  // a pavement), wandering a little around the middle, sometimes a smaller one beside it
  for (let z = z0; z > z1; z -= rand(.7, 1.1)) {
    const keep = random() < .55, big = random() < .6, small = random() < .4 * Q.forest;
    const px = pathX(z);
    if (keep) stones[big ? 0 : 1].push({ x: px + rand(-.6, .6), z, s: rand(.55, .8) });
    if (keep && small) stones[1].push({ x: px + side() * rand(.85, 1.1), z: z - rand(.2, .5), s: rand(.4, .5) });
  }
  const len = z0 - z1, n = (per: number) => Math.round(len * per * Q.forest);
  for (let i = n(1.4); i--;) { const z = rand(z1, z0); pebbles.push({ x: pathX(z) + side() * rand(1.1, 2.6), z, s: rand(.5, 1.1) }); }
  // grass reaches into the ragged edge of the path
  for (let i = n(3.4); i--;) {
    const z = rand(z1 + .5, z0), x = pathX(z) + side() * rand(1.2, 5);
    grass.push({ x, z, s: rand(.35, .6), sy: rand(.2, .45) });
  }
  lay('stone_a', stones[0]); lay('stone_b', stones[1]); lay('pebble', pebbles); lay('grass', grass);
}
