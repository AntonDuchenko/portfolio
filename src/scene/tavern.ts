import {
  Box3, BoxGeometry, CanvasTexture, FrontSide, Group, type Material, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  NormalBlending, type Object3D
} from 'three';
import {
  D, DOOR_H, DOOR_HINGE_Z, DOOR_W, FLOOR_Y, GATE_Z, MOD, STOREY, TAV_END, TAV_H, TAV_HW, TAV_LEN, WALL_IN
} from '../config';
import { rand } from '../random';
import { kitMaterial, model } from './assets';
import { kitBox } from './kitbox';
import { fires, RescaledPointLight } from './lights';
import { box, M } from './materials';
import { fireTex, type GlowSprite, smokeTex, sprite } from './sprites';
import { scene } from './stage';

/* The tavern, built from Medieval Village kit modules on its 2 m grid (see config.ts).
   Module facts (measured, scripts/assets/manifest.json):
   - walls: x −1…1, y 0…3.12; outside face z = 0, inside face z = −0.2, beams to +0.09/−0.31
   - Corner_Exterior_Wood: 0.21 × 3 × 0.24, centred
   - Wall_BottomCover (used as lintel and tie beam): x −1…1, y ±0.12, z −0.31…0.12
   - Door_8_Flat: hinge edge at x ≈ 0, 1.12 × 2.1 (y 0.04…2.14), z ±0.05
   - Roof_RoundTiles_6x14: ridge ≈ +4.9 above the wall top, eaves −0.78 at x ±4.12 */

const SIGN_X = -2, SIGN_Y = 2.8, SIGN_Z = 1.1;
const CHIMNEY = { x: -2.2, d: 6 };                       // above the hearth
const HEARTH_D = 6;
const LANTERN_HEAD = { y: .34, z: .8 };                   // Lantern_Wall head centre, model space

/** world positions that audio attaches to */
export const HEARTH_POS = { x: -1.75, y: 1.1, z: D(HEARTH_D) };
export const SIGN_POS = { x: SIGN_X, y: SIGN_Y, z: GATE_Z + SIGN_Z };
export const DOOR_POS = { x: 0, y: 1.2, z: GATE_Z };

/** door leaves; they open inward */
export const leaves: { pivot: Group; dir: number }[] = [];
export const setDoor = (angle: number) => leaves.forEach(l => l.pivot.rotation.y = -l.dir * angle);

const smokes: { sp: GlowSprite; base: number; phase: number; speed: number; y: number }[] = [];

// warm lit windows; front side only, so from inside the hall they show the night
let glass: Material | null = null;
function village(name: string, x: number, y: number, z: number, ry = 0, parent: Object3D = scene) {
  const o = model('village', name);
  o.position.set(x, y, z); o.rotation.y = ry;
  glass ??= new MeshBasicMaterial({ color: 0xffb45e, side: FrontSide });
  o.traverse(c => {
    if (c instanceof Mesh && (c.material as Material).name === 'MI_WindowGlass') c.material = glass;
  });
  parent.add(o); return o;
}
function prop(name: string, x: number, y: number, z: number, ry = 0, parent: Object3D = scene) {
  const o = model('props', name);
  o.position.set(x, y, z); o.rotation.y = ry; parent.add(o); return o;
}

function signTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#2b1d10'; x.fillRect(0, 0, 512, 256);
  x.fillStyle = '#d8b877'; x.font = 'bold 92px Georgia'; x.textAlign = 'center';
  x.fillText('TAVERN', 256, 150);
  x.strokeStyle = '#8a6a34'; x.lineWidth = 6; x.strokeRect(16, 16, 480, 224);
  const t = new CanvasTexture(c); t.colorSpace = 'srgb'; return t;
}

/** street lantern / post lantern: Lantern_Wall with its light and flame at the head */
export function lantern(parent: Object3D, x: number, y: number, z: number, ry: number,
  light: { color: number; range: number; power: number; outside?: boolean }, worldOffset = { x: 0, y: 0, z: 0 }) {
  prop('Lantern_Wall', x, y, z, ry, parent);
  const hx = x + Math.sin(ry) * LANTERN_HEAD.z, hz = z + Math.cos(ry) * LANTERN_HEAD.z, hy = y + LANTERN_HEAD.y;
  const l = new RescaledPointLight(light.color, light.range);
  l.position.set(hx + worldOffset.x, hy + worldOffset.y, hz + worldOffset.z); scene.add(l);
  const sp = sprite(fireTex, .45, .85); sp.position.set(hx, hy, hz); parent.add(sp);
  fires.push({ light: l, sp, phase: rand(0, 10), power: light.power, outside: light.outside });
}

/* ── facade ──────────────────────────────────────────────────────── */
export function buildFacade() {
  const front = new Group(); front.position.z = GATE_Z; scene.add(front);
  const half = DOOR_W / 2;

  // ground floor: stone with windows either side of the door module
  for (const s of [-1, 1]) {
    village('Wall_UnevenBrick_Window_Wide_Flat', s * MOD, 0, 0, 0, front);
    village('Window_Wide_Flat1', s * MOD, 0, 0, 0, front);
  }
  // door module (x −1…1): posts on the module seams, front and inside, cut to the lintel
  // so the lintel rests on them instead of overlapping (hard rule 1)
  for (const s of [-1, 1]) for (const z of [0, -WALL_IN]) {
    const p = village('Corner_Exterior_Wood', s * 1, 0, z, 0, front); p.scale.y = DOOR_H / 3;
  }
  const lintel = village('Wall_BottomCover', 0, DOOR_H + .12, 0, 0, front); lintel.scale.x = 1.105;
  front.add(kitBox(MOD, .24, WALL_IN, { mat: 'MI_Plaster', tile: 2 }, 0, DOOR_H + .24 + .12, -WALL_IN / 2));
  village('Wall_BottomCover', 0, STOREY - .12, 0, 0, front);                      // top beam
  // sill: dark wood under the leaves, top exactly at the floor (0.06); the floor starts
  // at the inside face, so the two top faces touch without overlapping
  front.add(kitBox(DOOR_W, .5, .5, { mat: 'MI_WoodTrim', strip: 'dark' }, 0, FLOOR_Y - .25, .05));

  // upper floor and gable
  for (const s of [-1, 1]) {
    village('Wall_Plaster_Window_Wide_Round', s * MOD, STOREY, 0, 0, front);
    village('Window_Wide_Round1', s * MOD, STOREY, 0, 0, front);
  }
  village('Wall_Plaster_WoodGrid', 0, STOREY, 0, 0, front);
  village('Roof_Front_Brick6', 0, TAV_H, 0, 0, front);
  // corner posts cover the wall ends; 10–12 cm proud of both faces (hard rule 1)
  for (const s of [-1, 1]) for (const y of [0, STOREY]) {
    const p = village('Corner_Exterior_Wood', s * TAV_HW, y, 0, 0, front); p.scale.y = STOREY / 3;
  }

  // chimney over the hearth: its base sits below the roof surface at its low edge
  const ridge = TAV_H + 4.89, slope = 5.67 / 4.12;
  const cx = CHIMNEY.x, lowEdge = Math.abs(cx) + .475, base = ridge - lowEdge * slope - .1;
  village('Prop_Chimney', cx, base, -CHIMNEY.d, 0, front);
  const smokeY = base + 3.3;
  for (let i = 0; i < 7; i++) {
    const sp = sprite(smokeTex, rand(1.2, 2.4), rand(.16, .3));
    sp.material.blending = NormalBlending;
    sp.position.set(cx + rand(-.3, .3), smokeY + i * 1.6, GATE_Z - CHIMNEY.d);
    scene.add(sp); smokes.push({ sp, base: smokeY, phase: rand(0, 10), speed: rand(.3, .6), y: i * 1.6 });
  }

  // street lanterns on the door posts: back plate 5 cm inside the post face (hard rule 3)
  for (const s of [-1, 1])
    lantern(front, s * 1, 1.55, .07, 0, { color: 0xffa348, range: 14, power: 1.5, outside: true }, { x: 0, y: 0, z: GATE_Z });

  // sign: bar out of the wall → crossbar resting on it → two hangers → sign
  const barY = 3.35, signW = 1.1, signH = .55;
  front.add(box(.06, .06, SIGN_Z + .35, M.iron, SIGN_X, barY, (SIGN_Z + .35) / 2 - .05));
  front.add(box(signW - .1, .05, .05, M.iron, SIGN_X, barY - .05, SIGN_Z));
  const hangTop = barY - .075, signTop = SIGN_Y + signH / 2;
  for (const s of [-1, 1]) front.add(box(.03, hangTop - signTop + .02, .03, M.iron,
    SIGN_X + s * (signW / 2 - .1), (hangTop + signTop) / 2, SIGN_Z));
  const wood = kitMaterial('village', 'MI_WoodTrim');
  const sign = new Mesh(new BoxGeometry(signW, signH, .06),
    [wood, wood, wood, wood, new MeshStandardMaterial({ map: signTexture(), roughness: 1 }), wood]);
  sign.position.set(SIGN_X, SIGN_Y, SIGN_Z); front.add(sign);

  // door leaves: Door_8_Flat squeezed to half the opening, hinges mid-wall. The model
  // spans x −0.05…1.07 from its hinge, so the far edge (1.07) is what must reach the
  // centre — scaling by the full 1.12 left an 8 cm gap. The right leaf is mirrored
  // (scale.x = −1) so the ring handle stays on the outside.
  const leafH = (DOOR_H - .03 - FLOOR_Y) / 2.1;
  for (const s of [-1, 1]) {
    const p = new Group(); p.position.set(s * half, FLOOR_Y - .04 * leafH, DOOR_HINGE_Z); front.add(p);
    const leaf = model('village', 'Door_8_Flat');
    leaf.scale.set(-s * half / 1.07, leafH, 1);
    p.add(leaf);
    leaves.push({ pivot: p, dir: s });
  }
  return front;
}

export function updateSmoke(dt: number) {
  for (const s of smokes) {
    s.y += s.speed * dt;
    if (s.y > 12) { s.y = 0; s.sp.position.x = CHIMNEY.x + rand(-.3, .3); }
    s.sp.position.y = s.base + s.y;
    s.sp.material.opacity = Math.max(0, .26 * (1 - s.y / 12));
  }
}

/* ── hall ────────────────────────────────────────────────────────── */
/** Returns the hall group; its floor top is at FLOOR_Y, flush with the sill. */
export function buildHall() {
  const tav = new Group(); scene.add(tav);
  const n = TAV_LEN / MOD;

  // side walls: stone ground floor, plaster upper floor, windows in every other module
  // except where the hearth stands
  for (let k = 0; k < n; k++) {
    const z = GATE_Z - MOD / 2 - k * MOD, d = MOD / 2 + k * MOD;
    for (const s of [-1, 1]) {
      const ry = s * Math.PI / 2, x = s * TAV_HW;
      const hearthHere = s < 0 && Math.abs(d - HEARTH_D) < MOD;
      const win = k % 2 === 1 && !hearthHere;
      village(win ? 'Wall_UnevenBrick_Window_Wide_Flat' : 'Wall_UnevenBrick_Straight', x, 0, z, ry, tav);
      if (win) village('Window_Wide_Flat1', x, 0, z, ry, tav);
      village(k % 2 === 1 ? 'Wall_Plaster_Window_Wide_Flat' : 'Wall_Plaster_Straight', x, STOREY, z, ry, tav);
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
  village('Roof_RoundTiles_6x14', 0, TAV_H, GATE_Z - TAV_LEN / 2, 0, tav);

  // floor: 2×2 planks starting at the inside face of the facade (the sill covers the rest)
  for (let k = 0; k < n; k++) for (const x of [-MOD, 0, MOD])
    village('Floor_WoodDark', x, FLOOR_Y - .01, GATE_Z - WALL_IN - MOD / 2 - k * MOD, 0, tav);

  // tie beams every 2 m; their ends go 0.2 m into the side walls (hard rule 3)
  const BEAM_Y = 4.6;
  for (let d = 2; d < TAV_LEN; d += MOD) for (const x of [-MOD, 0, MOD])
    village('Wall_BottomCover', x, BEAM_Y, D(d), 0, tav);
  const beamBottom = BEAM_Y - .12;

  // hearth on the left wall: the stone mass goes 0.1 m into the wall
  tav.add(kitBox(.9, 3.4, 2.4, { mat: 'MI_UnevenBrick', tile: 1.6 }, -TAV_HW + WALL_IN + .35, FLOOR_Y + 1.7, D(HEARTH_D)));
  const firebox = new Mesh(new BoxGeometry(.2, 1.1, 1.4), new MeshStandardMaterial({ color: 0x0b0806, roughness: 1 }));
  firebox.position.set(-TAV_HW + WALL_IN + .9, FLOOR_Y + .55, D(HEARTH_D)); tav.add(firebox);
  const hearth = new RescaledPointLight(0xff8a3c, 18, 2);
  // light just in front of the firebox (its face is at x −1.8): the stone front face
  // (x −2.0) then only gets grazing light instead of a blown-out 1/d² hot spot
  hearth.position.set(-1.7, .8, D(HEARTH_D)); tav.add(hearth);
  const hearthFire = sprite(fireTex, .7, .9);
  hearthFire.position.set(-1.72, .5, D(HEARTH_D)); tav.add(hearthFire);
  fires.push({ light: hearth, sp: hearthFire, phase: rand(0, 10), power: 2.4 });

  // bar at the back: cabinets as the counter, a plank top resting on them,
  // bottle shelves on the back wall (1 cm into the wall), barrels in a holder
  const BAR_D = 12.2;
  for (const x of [-1.36, 0, 1.36]) prop('Cabinet', x, FLOOR_Y, D(BAR_D), 0, tav);
  tav.add(kitBox(4.3, .06, .5, { mat: 'MI_WoodTrim', strip: 'dark' }, 0, FLOOR_Y + 1.03, D(BAR_D)));
  const backIn = TAV_END + WALL_IN;
  for (const x of [-1.2, 1.2]) for (const y of [1.5, 2.3]) prop('Shelf_Small_Bottles', x, y, backIn - .02, 0, tav);
  prop('Barrel_Holder', -2.1, FLOOR_Y, D(13.2), 0, tav);
  for (const x of [-1.5, -.5, .5, 1.5]) prop('Stool', x, FLOOR_Y, D(BAR_D - .7), rand(0, 6.28), tav);

  // barrels and a crate by the door, clear of the opening leaves (free edge |x| ≤ 1.06)
  for (const s of [-1, 1]) prop('Barrel', s * 2.3, FLOOR_Y, D(1), rand(0, 6.28), tav);
  prop('Crate_Wooden', 2.2, FLOOR_Y, D(1.9), .3, tav);

  // long tables along the walls, benches on the aisle side; the aisle stays clear
  for (const [s, d] of [[-1, 2.9], [-1, 9.4], [1, 3.2], [1, 7.6]]) {
    const x = s * 2.0, z = D(d);
    prop('Table_Large', x, FLOOR_Y, z, Math.PI / 2, tav);
    prop('Bench', s * 1.15, FLOOR_Y, z, Math.PI / 2, tav);
    const top = FLOOR_Y + .81;
    prop('CandleStick', x, top, z, rand(0, 6.28), tav);
    prop('Candle_1', x, top + .1, z, 0, tav);
    const f = sprite(fireTex, .16, .8); f.position.set(x, top + .27, z); tav.add(f);
    fires.push({ light: null, sp: f, phase: rand(0, 10) });
    for (let i = 0; i < 3; i++) prop('Mug', x + rand(-.3, .3), top, z + rand(-1.1, 1.1), rand(0, 6.28), tav);
  }

  // chandeliers over the aisle, hanging from the tie beams: top of the chain at the
  // beam's underside (hard rule 3); candles ring at −1.1 below it
  for (const d of [4, 8]) {
    const c = prop('Chandelier', 0, 0, D(d), 0, tav);
    const top = beamBottom + .01;                   // chain end 1 cm into the beam
    c.position.y = top - new Box3().setFromObject(c).max.y;
    const ringY = top - 1.1;
    // dRef 1.6: at 2 the plaster walls read brighter than the prototype hall (94 vs ~70)
    const l = new RescaledPointLight(0xffa348, 16, 1.6); l.position.set(0, ringY, D(d)); tav.add(l);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const sp = sprite(fireTex, .18, .85); sp.position.set(Math.cos(a) * .55, ringY + .2, D(d) + Math.sin(a) * .55); tav.add(sp);
      fires.push({ light: i === 0 ? l : null, sp, phase: rand(0, 10), power: 1.8 });
    }
  }
  return { tav, beamBottom };
}
