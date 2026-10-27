import { Box3, Group } from 'three';
import { D, FLOOR_Y, GATE_Z, JETTY, MOD, STOREY, TAV_END, TAV_H, TAV_HW, TAV_LEN, WALL_IN, WING } from '../config';
import { rand } from '../random';
import { kitBox } from './kitbox';
import { fires, RescaledPointLight } from './lights';
import { fireTex, sprite } from './sprites';
import { scene } from './stage';
import { HEARTH_D, lantern, prop, village } from './tavern';

/* The hall behind the door (references: beamed timber taverns lit by lanterns over the
   tables, a hearth with a mantel, a stocked bar). Kit modules on the 2 m grid, see config.ts. */

const BEAM_Y = 4.6, BEAM_BOTTOM = BEAM_Y - .12;     // tie beams (Wall_BottomCover, y ±0.12)
const WALL_X = TAV_HW - WALL_IN;                    // inside face of the side walls
const RAIL_Y = 2.9;                                 // underside of the walls' storey rail (raycast)
const HEARTH_W = 2.4;
const wood = { mat: 'MI_WoodTrim', strip: 'dark' } as const;

/** Returns the hall group; its floor top is at FLOOR_Y, flush with the sill. */
export function buildHall() {
  const tav = new Group(); scene.add(tav);
  shell(tav);
  timberFrame(tav);
  hearth(tav);
  bar(tav);
  tables(tav);
  chandeliers(tav);
  return { tav, beamBottom: BEAM_BOTTOM };
}

function shell(tav: Group) {
  const n = TAV_LEN / MOD;

  // side walls: stone ground floor, plaster upper floor, windows in every other module
  // except where the hearth stands or the side wing covers the wall. The front upper
  // module is stretched forward under the jettied gable.
  for (let k = 0; k < n; k++) {
    const z = GATE_Z - MOD / 2 - k * MOD, d = MOD / 2 + k * MOD;
    for (const s of [-1, 1]) {
      const ry = s * Math.PI / 2, x = s * TAV_HW;
      const hearthHere = s < 0 && Math.abs(d - HEARTH_D) < MOD;
      const winged = s > 0 && z + MOD / 2 > WING.z1 && z - MOD / 2 < WING.z0;
      const win = k % 2 === 1 && !hearthHere && !winged;
      village(win ? 'Wall_UnevenBrick_Window_Wide_Flat' : 'Wall_UnevenBrick_Straight', x, 0, z, ry, tav);
      if (win) village('Window_Wide_Flat1', x, 0, z, ry, tav);
      const ext = k === 0 ? JETTY : 0;
      const upper = village(k % 2 === 1 && !winged ? 'Wall_Plaster_Window_Wide_Flat' : 'Wall_Plaster_Straight', x, STOREY, z + ext / 2, ry, tav);
      upper.scale.x = (MOD + ext) / MOD;
      if (k % 2 === 1 && !winged) village('Window_Wide_Flat1', x, STOREY, z, ry, tav);
    }
  }
  // back wall, back gable, back corner posts
  for (const x of [-MOD, 0, MOD]) {
    village('Wall_UnevenBrick_Straight', x, 0, TAV_END, Math.PI, tav);
    village('Wall_Plaster_Straight', x, STOREY, TAV_END, Math.PI, tav);
  }
  village('Roof_Front_Brick6', 0, TAV_H, TAV_END, Math.PI, tav);
  for (const s of [-1, 1]) for (const y of [0, STOREY]) {
    const p = village('Corner_Exterior_Wood', s * TAV_HW, y, TAV_END, 0, tav); p.scale.y = STOREY / 3;
  }
  // the roof runs out over the jettied gable: stretched by JETTY (3.6 %), front edge forward
  const roof = village('Roof_RoundTiles_6x14', 0, TAV_H, GATE_Z - TAV_LEN / 2 + JETTY / 2, 0, tav);
  roof.scale.z = (TAV_LEN + JETTY) / TAV_LEN;

  // floor: 2×2 planks starting at the inside face of the facade (the sill covers the rest)
  for (let k = 0; k < n; k++) for (const x of [-MOD, 0, MOD])
    village('Floor_WoodDark', x, FLOOR_Y - .01, GATE_Z - WALL_IN - MOD / 2 - k * MOD, 0, tav);

  // tie beams every 2 m (z −0.31…+0.12 of their line); their ends go 0.2 m into the side walls (hard rule 3)
  for (let d = 2; d < TAV_LEN; d += MOD) for (const x of [-MOD, 0, MOD])
    village('Wall_BottomCover', x, BEAM_Y, D(d), 0, tav);
}

/* A post under every tie-beam end with a curved brace up to the beam: the long plaster
   walls read as timber bays (review: the hall read as a pale box lit like daylight).
   Posts stand on the module seams, 9 cm clear of the window frames either side; none
   behind the chimney breast. */
function timberFrame(tav: Group) {
  const postX = WALL_X + .02 - .105, faceX = postX - .105;     // Corner_Exterior_Wood: 0.21 × 3 × 0.24, back 2 cm into the plaster
  const h = BEAM_BOTTOM - FLOOR_Y + .02;                        // 1 cm into the floor and into the beam
  for (let d = MOD; d < TAV_LEN; d += MOD) for (const s of [-1, 1]) {
    if (s < 0 && Math.abs(d - HEARTH_D) < HEARTH_W / 2 + .12) continue;
    const post = village('Corner_Exterior_Wood', s * postX, FLOOR_Y - .01, D(d), 0, tav);
    post.scale.set(1, h / 3, .9);                               // ±0.11: under the beam (−0.12…+0.31)
    // Roof_Support2 (0.68 tall, reaches 0.77 from its back): back 1 cm into the post, top 1 cm into the beam
    village('Roof_Support2', s * (faceX + .01), BEAM_BOTTOM + .01 - .066, D(d), -s * Math.PI / 2, tav);
  }
}

/* Hearth on the left wall, built as a real recess: back slab (0.1 m into the wall), two
   jambs and a lintel leave a 1.4 × 1.1 m opening 0.4 m deep. Faces that meet are buried
   inside the stone, none is exposed coplanar (hard rule 1). */
function hearth(tav: Group) {
  const stone = { mat: 'MI_UnevenBrick', tile: 1.6 } as const, hz = D(HEARTH_D), w = HEARTH_W;
  const back = -WALL_X - .1, face = back + .9, open = { w: 1.4, h: 1.1 };
  tav.add(kitBox(.5, 3.4, w, stone, back + .25, FLOOR_Y + 1.7, hz));                           // back slab
  for (const s of [-1, 1])                                                                      // jambs
    tav.add(kitBox(.4, open.h, (w - open.w) / 2, stone, face - .2, FLOOR_Y + open.h / 2, hz + s * (open.w / 2 + (w - open.w) / 4)));
  tav.add(kitBox(.4, 3.4 - open.h, w, stone, face - .2, FLOOR_Y + open.h + (3.4 - open.h) / 2, hz));   // lintel
  // light 10 cm in front of the opening: lights the recess and the room, the stone
  // front faces only get grazing light (a lit face this close blew out to white)
  const fire = new RescaledPointLight(0xff8a3c, 18, 2);
  fire.position.set(face + .1, .7, hz); tav.add(fire);
  const flame = sprite(fireTex, .7, .9);
  flame.position.set(face - .22, .45, hz); tav.add(flame);
  fires.push({ light: fire, sp: flame, phase: rand(0, 10), power: 2.4 });

  // timber mantel shelf over the opening, wider than the breast, back 2 cm into the
  // stone; a candle and two bottles on it
  const shelfY = FLOOR_Y + open.h + .3, top = shelfY + .05, x = face + .13;
  tav.add(kitBox(.3, .1, w + .3, wood, x, shelfY, hz));
  prop('CandleStick', x, top, hz - .75, 2.2, tav);
  prop('Candle_1', x, top + .1, hz - .75, 0, tav);
  candleFlame(tav, x, top + .27, hz - .75);
  for (const dz of [.62, .78]) prop('Bottle_1', x + rand(-.04, .04), top, hz + dz, rand(0, 6.28), tav);
}

/* Bar across the back: cabinets as the counter, a plank top resting on them, bottle
   shelves on the back wall (1 cm into the wall), kegs in holders at both ends, stools. */
function bar(tav: Group) {
  const BAR_D = 12.2;
  for (const x of [-1.36, 0, 1.36]) prop('Cabinet', x, FLOOR_Y, D(BAR_D), 0, tav);
  tav.add(kitBox(4.3, .06, .5, wood, 0, FLOOR_Y + 1.03, D(BAR_D)));
  const backIn = TAV_END + WALL_IN;
  for (const x of [-1.2, 1.2]) for (const y of [1.5, 2.3]) prop('Shelf_Small_Bottles', x, y, backIn - .02, 0, tav);
  for (const s of [-1, 1]) prop('Barrel_Holder', s * 2.1, FLOOR_Y, D(13.2), 0, tav);
  for (const x of [-1.5, -.5, .5, 1.5]) prop('Stool', x, FLOOR_Y, D(BAR_D - .7), rand(0, 6.28), tav);

  // barrels and a crate by the door, clear of the opening leaves (free edge |x| ≤ 1.06)
  // and of the first post (the crate's corner reaches x 2.63)
  for (const s of [-1, 1]) prop('Barrel', s * 2.3, FLOOR_Y, D(1), rand(0, 6.28), tav);
  prop('Crate_Wooden', 2.1, FLOOR_Y, D(1.9), .3, tav);
}

/* Long tables along the walls, benches on the aisle side; the aisle (|x| < 0.83) stays
   clear. Laid with a candle, two plates on the aisle half and mugs on the wall half.
   Lanterns hang over the front tables from wall brackets, on solid wall (not a window):
   arm 2 cm under the storey rail, the lantern 0.8 m out. They light the walls in pools;
   at the back tables a pair framed the poster next to the post's own lanterns (review). */
const TABLES: readonly { side: number; d: number; lamp?: number }[] = [
  { side: -1, d: 2.9, lamp: 1 }, { side: -1, d: 9.4 }, { side: 1, d: 3.2, lamp: 3 }, { side: 1, d: 7.6 }
];
function tables(tav: Group) {
  for (const { side: s, d, lamp } of TABLES) {
    const x = s * 2.0, z = D(d), top = FLOOR_Y + .81;
    prop('Table_Large', x, FLOOR_Y, z, Math.PI / 2, tav);
    prop('Bench', s * 1.15, FLOOR_Y, z, Math.PI / 2, tav);
    prop('CandleStick', x, top, z, rand(0, 6.28), tav);
    prop('Candle_1', x, top + .1, z, 0, tav);
    candleFlame(tav, x, top + .27, z);
    for (const dz of [-.75, .75]) prop('Table_Plate', x - s * .22, top, z + dz + rand(-.1, .1), 0, tav);
    for (let i = 0; i < 3; i++) prop('Mug', x + s * rand(.12, .3), top, z + rand(-1.1, 1.1), rand(0, 6.28), tav);
    if (lamp !== undefined)
      lantern(tav, s * (WALL_X - .02), RAIL_Y - .02 - 1.42, D(lamp), -s * Math.PI / 2, { color: 0xffa348, range: 7, power: 2.8 });
  }
}

function candleFlame(tav: Group, x: number, y: number, z: number) {
  const f = sprite(fireTex, .16, .8); f.position.set(x, y, z); tav.add(f);
  fires.push({ light: null, sp: f, phase: rand(0, 10) });
}

/* Chandeliers over the aisle, hanging from the tie beams: top of the chain at the beam's
   underside (hard rule 3); candles ring at −1.1 below it. Flames only: lit from the middle
   of the room the walls read evenly, as by day, and their two lights went to the wall
   lanterns (every light is paid for by every pixel, the forest's included). */
function chandeliers(tav: Group) {
  for (const d of [4, 8]) {
    const c = prop('Chandelier', 0, 0, D(d), 0, tav);
    const top = BEAM_BOTTOM + .01;                  // chain end 1 cm into the beam
    c.position.y = top - new Box3().setFromObject(c).max.y;
    const ringY = top - 1.1;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const sp = sprite(fireTex, .18, .85); sp.position.set(Math.cos(a) * .55, ringY + .2, D(d) + Math.sin(a) * .55); tav.add(sp);
      fires.push({ light: null, sp, phase: rand(0, 10) });
    }
  }
}
