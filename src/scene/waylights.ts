import { type BufferGeometry, type Group, Vector3 } from 'three';
import { GATE_Z } from '../config';
import { look } from '../theme/themes';
import { bow, pieces } from './evergreen';
import { kitBox } from './kitbox';
import { addShadow } from './shadows';
import { fires } from './lights';
import { fireTex, sprite } from './sprites';
import { lightUp, prop } from './tavern';
import { addGroundLight, pathX, surfaceY } from './terrain';
import { BROOK, brookZ, dry, waterEdge } from './brookShape';

/* Lanterns along the walk (the theme's `wayLights`: winter, which has no fireflies). Without
   them the walk had nothing warm between the torch and the tavern's windows — the night
   look leads the eye to the door with warm points. A tall post at the path's edge every
   ~10 m, on alternating sides, carrying the kit's wall lantern on its face towards the
   walker; the glass lit like the facade's, a flame and a halo in the mist (batched with the
   other glows) and a warm pool painted on the snow (terrain.ts) — no light source: every
   light is paid for by every pixel. Laid in the facade's group, so they merge into its
   batch (no draw call of their own). Christmas ties a bow on every post. */

export interface Spot { x: number; z: number }

// from the path's centre line: beyond the verge — at 2 m the posts swept past the frame's
// edge, their wood blazing in the torchlight
const EDGE = 2.6;
const POST = { w: .16, h: 2.55, sink: .1 };            // its top 13 cm above the lantern's arm (2.32)
const HEAD = { y: 1.24, z: .8 };                     // the lantern's head over its ground, out from the plate
// Lantern_Wall reaches 1.42 m above its origin (the arm on top), its head hangs 0.34 up
const MOUNT = HEAD.y - .34;
const STEP = 10.5, MAX = 7;                          // m apart; at most (the ground-light budget, terrain.ts)

/** where the posts stand: from 9 m ahead of the start to 13 m before the facade (the
 *  yard's own lanterns take over there), evenly, on alternating sides. Pure: the walk's
 *  start decides it (the narration's length sets the walk). */
export function wayLightSpots(startZ: number): Spot[] {
  if (!look.wayLights) return [];
  const from = startZ - 9, to = GATE_Z + 13, n = Math.min(MAX, Math.round((from - to) / STEP) + 1);
  return Array.from({ length: Math.max(0, n) }, (_, i) => {
    let z = n > 1 ? from - (from - to) * i / (n - 1) : from;
    const x = pathX(z) + (i % 2 ? -1 : 1) * EDGE;
    // off the brook's banks: back along the path to firm ground (a lamp by the bridge)
    if (!dry(x, z, BROOK.bank + .4)) { const c = brookZ(x); z = c + Math.sign(z - c || 1) * (waterEdge(x) + BROOK.bank + .4); }
    return { x: pathX(z) + (i % 2 ? -1 : 1) * EDGE, z };
  });
}

/** false within `r` m of a post or its lantern's pool, for what is strewn along the path */
export const clearOf = (spots: readonly Spot[], r = .8) => (x: number, z: number) =>
  spots.every(p => Math.hypot(x - p.x, z - p.z - HEAD.z / 2) > r + HEAD.z / 2);

export function buildWayLights(front: Group, spots: readonly Spot[]) {
  const ribbons: BufferGeometry[] = [];
  for (const { x, z } of spots) {
    const ground = surfaceY(x, z), lz = z - GATE_Z;   // facade coordinates
    front.add(kitBox(POST.w, POST.h, POST.w, { mat: 'MI_WoodTrim', strip: 'dark' }, x, ground - POST.sink + POST.h / 2, lz));
    // the plate 5 cm inside the post's face (hard rule 3)
    lightUp(prop('Lantern_Wall', x, ground + MOUNT, lz + POST.w / 2 - .05, 0, front));
    const head = new Vector3(x, ground + HEAD.y, lz + POST.w / 2 - .05 + HEAD.z);
    const flame = sprite(fireTex, .45, .85); flame.position.copy(head); front.add(flame);
    fires.push({ light: null, sp: flame, phase: x * 7.1 + z, outside: true });
    const halo = sprite(fireTex, 2.4, .17); halo.position.copy(head); front.add(halo);
    addGroundLight(x, z + HEAD.z, 1.7, 1);
    addShadow({ x, z, rx: .32, k: .55 });
    if (look.decor) ribbons.push(...bow(new Vector3(x, ground + .8, lz + POST.w / 2 + .02), 1.1));   // under the plate
  }
  if (ribbons.length) front.add(pieces(ribbons));
}
