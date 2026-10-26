import { Object3D } from 'three';
import { GATE_Z } from '../config';
import { Q } from '../quality';
import { rand, side } from '../random';
import { bounds, instanced, parts } from './assets';
import { night } from './forest';
import { scene } from './stage';
import { pathX, surfaceY } from './terrain';

/* The path dressed with the Nature kit: pebbles and short grass along the edges, following
   the path's meander (pathX). The path itself — a dark rutted track — is painted on the
   terrain (terrain.ts); the kit's pale stepping stones on it read as a cartoon pavement
   and are gone. Static — the walk only looks ahead, so it is laid from just behind the
   start to the tavern. Two draw calls (one per model). Everything sinks 2 cm into the
   ground (hard rule 1). */

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
  const pebbles: Item[] = [], grass: Item[] = [];
  const len = z0 - z1, n = (per: number) => Math.round(len * per * Q.forest);
  for (let i = n(1.4); i--;) { const z = rand(z1, z0); pebbles.push({ x: pathX(z) + side() * rand(1.1, 2.6), z, s: rand(.5, 1.1) }); }
  // grass reaches into the ragged edge of the path
  for (let i = n(3.4); i--;) {
    const z = rand(z1 + .5, z0), x = pathX(z) + side() * rand(1.2, 5);
    grass.push({ x, z, s: rand(.35, .6), sy: rand(.2, .45) });
  }
  lay('pebble', pebbles); lay('grass', grass);
}
