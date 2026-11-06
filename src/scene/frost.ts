import { type BufferGeometry, ConeGeometry, type Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GATE_Z, JETTY, TAV_END, TAV_H, TAV_HW, TAV_LEN, WING } from '../config';
import { Q } from '../quality';
import { look } from '../theme/themes';
import { hash } from './evergreen';
import { SNOW } from './snow';
import { scene } from './stage';
import { groundLit, pathX, surfaceY } from './terrain';
import { dry } from './brookShape';

/* Winter's frost (the theme's `snow`): icicles along the eaves, snow banks along the track
   and drifts against the walls. Snow lay on everything that faces up, yet nothing hung
   from the roofs and the snow met the track flat, as if painted on.

   Icicles: thin cones on the main roof's side eaves (the front 9 m, which the path sees)
   and the side wing's front eave, mostly short with a few long ones and gaps between —
   one merged mesh in the facade's group (one draw call). Measured eaves (manifest.json):
   Roof_RoundTiles_6x14 has its eaves at x ±4.125, 0.782 below its origin, its front end
   at z +7.83 (× the jetty stretch); Roof_RoundTiles_4x4, turned to run along x and
   squashed to 0.62, has its front eave 2.757 in front of its centre, 0.516 × 0.62 down.
   Banks and drifts: low flattened mounds sunk into the ground, in the snow's colour and
   lit by the windows' and lanterns' painted light like the ground under them
   (terrain.ts `groundLit`) — one more draw call. No draw from the layout's random stream. */

const ROOF = { x: 4.125, drop: .782, front: 7.829 };
const WING_EAVE = { z: 2.757, drop: .516 * .62, x0: 2.95, x1: 7.7 };
const LANTERN_X = WING.x0 + 2.05;                   // the wing's door lantern (tavern.ts): its arm reaches the eave

/** a row of icicles hanging from y along x (or z), tips down, tops 2 cm into the eave */
function row(out: BufferGeometry[], seed: number, from: number, to: number, at: (u: number) => [number, number, number], skip = (_u: number) => false) {
  for (let u = from, i = 0; u < to; u += .07 + .05 * hash(seed + i), i++) {
    const k = seed * 1000 + i;
    if (hash(k) < .22 || skip(u)) continue;                      // gaps along the eave
    const len = .07 + .46 * hash(k + 1) ** 2.5, r = .014 + .03 * hash(k + 2) * (.4 + len * 1.4);
    const [x, y, z] = at(u);
    out.push(new ConeGeometry(r, len, 5, 1).rotateX(Math.PI).translate(x, y + .02 - len / 2, z));
  }
}

function icicles(front: Group) {
  const gs: BufferGeometry[] = [];
  const sz = (TAV_LEN + JETTY) / TAV_LEN, centre = -TAV_LEN / 2 + JETTY / 2, y = TAV_H - ROOF.drop;
  const front0 = centre + ROOF.front * sz;                          // facade coordinates
  for (const s of [-1, 1]) row(gs, s + 2, front0 - 9, front0 - .05, z => [s * (ROOF.x - .04), y, z]);
  const zc = (WING.z0 + WING.z1) / 2 - GATE_Z;
  row(gs, 7, WING_EAVE.x0 + .1, WING_EAVE.x1 - .05, x => [x, WING.h - WING_EAVE.drop, zc + WING_EAVE.z - .04],
    x => Math.abs(x - LANTERN_X) < .25);
  const ice = new MeshStandardMaterial({ color: 0x9fb4d0, roughness: .2, metalness: 0 });
  ice.emissive.setRGB(.01, .015, .025);                             // a cold sheen where the moon misses them
  front.add(new Mesh(mergeGeometries(gs), ice));
}

/** a low mound: an ellipsoid sunk into the ground so only its gentle top shows */
function mound(x: number, z: number, rx: number, ry: number, rz: number, turn: number) {
  return new SphereGeometry(1, 12, 6).scale(rx, ry, rz).rotateY(turn).translate(x, surfaceY(x, z) - ry * .5, z);
}

function banks(startZ: number) {
  const gs: BufferGeometry[] = [], step = .6 / Q.forest;
  // along the track: the snow pushed aside by the cart, from the walk's start to the yard
  for (let z = startZ + 6, i = 0; z > GATE_Z + 10; z -= step + .3 * hash(i), i++) {
    const turn = Math.atan(pathX(z - .5) - pathX(z + .5));
    for (const s of [-1, 1]) {
      const k = i * 2 + (s + 1) / 2;
      if (!dry(pathX(z) + s * 1.5, z, .6)) continue;               // no bank across the brook (the bridge)
      // long, low and overlapping, so they run together into one bank (shorter ones read
      // as a row of snowballs)
      gs.push(mound(pathX(z) + s * (1.5 + .18 * hash(k + 11)), z + (hash(k + 13) - .5) * .3,
        .38 + .12 * hash(k + 17), .05 + .04 * hash(k + 19), .95 + .4 * hash(k + 23), turn));
    }
  }
  // against the walls the wind piles it: the hall's left side and the wing's outer side
  for (let z = GATE_Z - 1.4, i = 0; z > TAV_END + 1; z -= 1.15, i++)
    gs.push(mound(-TAV_HW - .2, z, .42 + .1 * hash(i + 40), .2 + .08 * hash(i + 41), .75, 0));
  for (let z = WING.z0 - .3, i = 0; z > WING.z1; z -= 1.1, i++)
    gs.push(mound(WING.x1 + .22, z, .4, .18 + .07 * hash(i + 60), .7, 0));
  const snow = new MeshStandardMaterial({ roughness: 1 });
  snow.color.copy(SNOW);
  groundLit(snow);
  scene.add(new Mesh(mergeGeometries(gs), snow));
}

export function buildFrost(front: Group, startZ: number) {
  if (!look.snow) return;
  icicles(front);
  banks(startZ);
}
