import { Object3D } from 'three';
import { GATE_Z } from '../config';
import { Q } from '../quality';
import { rand, side } from '../random';
import { bounds, instanced, parts } from './assets';
import { night } from './forest';
import { scene } from './stage';
import { terrainY } from './terrain';

/* The path dressed with the Nature kit: flat stepping stones along the trodden middle,
   pebbles and short grass along the edges. Static — the walk only looks ahead, so it is
   laid from just behind the start to the tavern. Four draw calls (one per model),
   ~35k triangles on a ~70 m walk (stones are clusters of cobbles, 230–350 tris each).
   Everything sinks 2 cm into the ground: bases never lie on the path plane (hard rule 1). */

const PATH_HW = 1.7, PATH_Y = .05, SINK = .02;
const groundY = (x: number, z: number) => Math.abs(x) < PATH_HW ? PATH_Y : terrainY(x, z);

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
  // stepping stones: one every ~0.9 m, wandering a little around the middle, sometimes
  // a smaller one beside it
  for (let z = z0; z > z1; z -= rand(.7, 1.1)) {
    stones[Math.random() < .6 ? 0 : 1].push({ x: rand(-.7, .7), z, s: rand(.6, .85) });
    if (Math.random() < .4 * Q.forest) stones[1].push({ x: side() * rand(.9, 1.25), z: z - rand(.2, .5), s: rand(.4, .55) });
  }
  const len = z0 - z1, n = (per: number) => Math.round(len * per * Q.forest);
  for (let i = n(1.4); i--;) pebbles.push({ x: side() * rand(1.2, 2.6), z: rand(z1, z0), s: rand(.5, 1.1) });
  for (let i = n(3); i--;) {
    const z = rand(z1 + .5, z0), x = side() * rand(1.55, 5);
    grass.push({ x, z, s: rand(.35, .6), sy: rand(.2, .45) });
  }
  lay('stone_a', stones[0]); lay('stone_b', stones[1]); lay('pebble', pebbles); lay('grass', grass);
}
