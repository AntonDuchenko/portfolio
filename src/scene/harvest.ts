import { type Group, type Object3D, Raycaster, Vector3 } from 'three';
import { D, GATE_Z } from '../config';
import { look } from '../theme/themes';
import { addShadow } from './shadows';
import { prop } from './tavern';
import { surfaceY } from './terrain';

/* Autumn's harvest (the theme's `harvest`): two crates just unloaded from the hand cart,
   stacked in front of the barrels, one on the crate in the left corner of the yard and one
   on the crate inside the door. (The yard's barrel of apples is laid by the facade, in a
   barrel's place.) Each stands on what carries it: rays down find that support's top and
   its slope (hard rule 3), no guessed heights. (On the cart's bed, tipped 12°, a crate sat
   below its high sides, out of sight from the path.) All of them wear props-kit materials
   the building already has: no draw call of their own once merged. Fixed placement, no
   draw from the layout's random stream. */

const down = new Raycaster(), DOWN = new Vector3(0, -1, 0);
const HALF = .25;                                    // the crates' half length along x, about

/** the height of `support`'s top under (x, z) in `space`'s coordinates (a group placed
 *  without rotation or scale), or null if the ray misses it */
function topOf(space: Object3D, support: Object3D, x: number, z: number) {
  space.updateWorldMatrix(true, true);
  down.set(new Vector3(x, 10, z).add(space.position), DOWN);
  const hit = down.intersectObject(support, true)[0];
  return hit ? hit.point.y - space.position.y : null;
}

/** `name` on top of the model `on` (found by name in `space`) at (x, z), turned `ry` and
 *  tilted along x to the support's slope */
function stack(space: Group, on: string, name: string, x: number, z: number, ry: number) {
  const support = space.getObjectByName(on);
  const lo = support && topOf(space, support, x - HALF, z), hi = support && topOf(space, support, x + HALF, z);
  if (lo == null || hi == null) { console.warn(`harvest: no ${on} under ${name} at ${x}, ${z}`); return; }
  const o = prop(name, x, (lo + hi) / 2 - .01, z, ry, space);   // 1 cm into the support (hard rule 1)
  o.rotation.z = Math.atan2(hi - lo, 2 * HALF);
}

/** `name` on the ground at (x, z), facade coordinates */
function onGround(front: Group, name: string, x: number, z: number, ry: number) {
  addShadow({ x, z: GATE_Z + z, rx: .45, rz: .3, ry, k: .5 });   // its contact shadow (shadows.ts)
  return prop(name, x, surfaceY(x, GATE_Z + z) - .01, z, ry, front);
}

export function buildHarvest(front: Group, tav: Group) {
  if (!look.harvest) return;
  // in front of the barrels (3.95, 1.3; r 0.35), corners 0.15 clear of them; the apples
  // below: the carrots stand above their crate's rim, the apples do not
  const base = onGround(front, 'FarmCrate_Apple', 4.75, 1.85, .3);
  base.name = 'unloaded';
  stack(front, 'unloaded', 'FarmCrate_Carrot', 4.75, 1.87, .15);
  stack(front, 'Crate_Wooden', 'FarmCrate_Apple', -3.55, 1.45, .4);   // the left corner of the yard
  stack(tav, 'Crate_Wooden', 'FarmCrate_Apple', 2.1, D(1.9), .3);     // inside the door, on the right
}
