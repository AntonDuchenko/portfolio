import {
  Box3, CanvasTexture, Color, FrontSide, Group, type Material, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  NormalBlending, type Object3D, PlaneGeometry
} from 'three';
import {
  D, DOOR_H, DOOR_HINGE_Z, DOOR_W, FLOOR_Y, GATE_Z, JETTY, MOD, STOREY, TAV_END, TAV_H, TAV_HW, TAV_LEN, WALL_IN, WING
} from '../config';
import { jitter, rand } from '../random';
import { model } from './assets';
import { night } from './forest';
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
const CHIMNEY = { x: -1, d: 6 };                         // above the hearth (x −2.1), near the ridge
const HEARTH_D = 6;
const LANTERN_HEAD = { y: .34, z: .8 };                   // Lantern_Wall head centre, model space

/** world positions that audio attaches to */
export const HEARTH_POS = { x: -2.1, y: .6, z: D(HEARTH_D) };        // inside the recess
export const SIGN_POS = { x: SIGN_X, y: SIGN_Y, z: GATE_Z + SIGN_Z };
export const DOOR_POS = { x: 0, y: 1.2, z: GATE_Z };

/** door leaves; they open inward */
export const leaves: { pivot: Group; dir: number }[] = [];
export const setDoor = (angle: number) => leaves.forEach(l => l.pivot.rotation.y = -l.dir * angle);

const smokes: { sp: GlowSprite; x: number; base: number; phase: number; speed: number; y: number }[] = [];

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

/* The painted boards: the hanging sign and the gold-lettered board over the door share one
   canvas (the sign on top, the board below), so both faces draw as one merged mesh. */
const BOARD = { w: 1024, h: 768, sign: [0, 0, 1024, 512], over: [0, 512, 1024, 220] } as const;
function boardTexture() {
  const c = document.createElement('canvas'); c.width = BOARD.w; c.height = BOARD.h;
  const x = c.getContext('2d')!, j = (a: number, b: number) => a + jitter() * (b - a);   // not the layout stream
  const panel = ([px, py, pw, ph]: readonly number[], text: string, size: number, spacing: number) => {
    x.fillStyle = '#21160c'; x.fillRect(px, py, pw, ph);
    x.globalAlpha = .18; x.strokeStyle = '#4a3420'; x.lineWidth = 2;   // grain
    for (let i = 0; i < 26; i++) {
      const gy = py + 8 + i * (ph - 16) / 26 + j(-3, 3);
      x.beginPath(); x.moveTo(px, gy); x.bezierCurveTo(px + pw * .3, gy + j(-6, 6), px + pw * .7, gy + j(-6, 6), px + pw, gy); x.stroke();
    }
    x.globalAlpha = 1;
    const gold = x.createLinearGradient(0, py, 0, py + ph);
    gold.addColorStop(0, '#f6dd96'); gold.addColorStop(.5, '#d2a64e'); gold.addColorStop(1, '#9c6e24');
    x.strokeStyle = gold; x.lineWidth = 7; x.strokeRect(px + 18, py + 18, pw - 36, ph - 36);
    x.lineWidth = 2; x.strokeRect(px + 32, py + 32, pw - 64, ph - 64);
    x.font = `bold ${size}px Georgia, 'Times New Roman', serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.letterSpacing = `${spacing}px`;
    const fit = Math.min(1, (pw - 130) / x.measureText(text).width);             // inside the border
    x.font = `bold ${Math.floor(size * fit)}px Georgia, 'Times New Roman', serif`;
    const ty = py + ph / 2 + size * fit * .06;
    x.fillStyle = '#0b0703'; x.fillText(text, px + pw / 2 + 3, ty + 4);                   // cut shadow
    x.fillStyle = gold; x.fillText(text, px + pw / 2, ty);
  };
  panel(BOARD.sign, 'TAVERN', 190, 10);
  panel(BOARD.over, 'ALE · STEW · BEDS', 120, 8);
  const t = new CanvasTexture(c); t.colorSpace = 'srgb'; t.anisotropy = 4; return t;
}
let boardFace: MeshStandardMaterial | null = null;
/** a board: dark planks with the painted face 1 cm in front of them */
function board(region: readonly number[], w: number, h: number, x: number, y: number, z: number, parent: Object3D) {
  parent.add(kitBox(w, h, .04, { mat: 'MI_WoodTrim', strip: 'dark' }, x, y, z));
  boardFace ??= new MeshStandardMaterial({ map: boardTexture(), roughness: .75 });
  const g = new PlaneGeometry(w - .02, h - .02), uv = g.attributes.uv;
  const [px, py, pw, ph] = region;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, (px + uv.getX(i) * pw) / BOARD.w, 1 - (py + (1 - uv.getY(i)) * ph) / BOARD.h);
  const face = new Mesh(g, boardFace); face.position.set(x, y, z + .03); parent.add(face);
}

// Lantern_Wall is one atlas material: the glass is the pale part of the texture, so the
// flame inside never showed through it and the lanterns read as unlit. Emission driven by
// the texture lights the glass warm and leaves the dark iron dark. One shared copy.
let litLantern: MeshStandardMaterial | null = null;
function lightUp(o: Object3D) {
  o.traverse(c => {
    if (!(c instanceof Mesh)) return;
    litLantern ??= (() => {
      const m = (c.material as MeshStandardMaterial).clone();
      m.emissive = new Color().setRGB(1, .5, .18); m.emissiveMap = m.map; m.emissiveIntensity = .6;
      return m;
    })();
    c.material = litLantern;
  });
}

/** street lantern / post lantern: Lantern_Wall with its light and flame at the head */
export function lantern(parent: Object3D, x: number, y: number, z: number, ry: number,
  light: { color: number; range: number; power: number; outside?: boolean }, worldOffset = { x: 0, y: 0, z: 0 }) {
  lightUp(prop('Lantern_Wall', x, y, z, ry, parent));
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
  for (const s of [-1, 1]) {                                                        // ground corner posts
    const p = village('Corner_Exterior_Wood', s * TAV_HW, 0, 0, 0, front); p.scale.y = STOREY / 3;
  }

  // The upper floor is jettied: the whole storey and the gable stand JETTY forward, on a
  // plank deck carried by joists out of the ground floor, with carved brackets at the
  // corners — the front reads in depth and throws a shadow line over the door.
  // Deck: from the top beam's face (z 0.12) to 6 cm proud of the upper beams, top at the
  // storey line (the upper walls stand on it), wide enough to cap the corner posts.
  const wood = { mat: 'MI_WoodTrim', strip: 'dark' } as const;
  const deck = { z0: .12, z1: JETTY + .15, y0: STOREY - .12 };
  front.add(kitBox(2 * TAV_HW + .3, STOREY - deck.y0, deck.z1 - deck.z0, wood, 0, (deck.y0 + STOREY) / 2, (deck.z0 + deck.z1) / 2));
  // joists: 2 cm into the stone (or the beam over the door), ends 8 cm past the deck; none
  // at x ±1, where the lanterns' arms reach up to 2.97
  for (const x of [0, .45, 1.5, 2.05, 2.6]) for (const s of x ? [-1, 1] : [1]) {
    const z0 = Math.abs(x) < 1 ? .1 : -.02, z1 = deck.z1 + .08;
    front.add(kitBox(.12, .14, z1 - z0, wood, s * x, deck.y0 - .07, (z0 + z1) / 2));
  }
  // corner brackets (Roof_Support2: 0.68 tall, 0.77 deep from its origin): on the posts'
  // front faces, tops 1 cm into the deck, squeezed to its depth
  for (const s of [-1, 1]) {
    const b = village('Roof_Support2', s * TAV_HW, deck.y0 - .06, .12, 0, front);
    b.scale.z = (deck.z1 - .12) / .77;
  }

  const up = new Group(); up.position.z = JETTY; front.add(up);
  for (const s of [-1, 1]) {
    village('Wall_Plaster_Window_Wide_Round', s * MOD, STOREY, 0, 0, up);
    village('Window_Wide_Round1', s * MOD, STOREY, 0, 0, up);
    village('WindowShutters_Wide_Round_Open', s * MOD, STOREY, 0, 0, up);
  }
  village('Wall_Plaster_WoodGrid', 0, STOREY, 0, 0, up);
  // behind its open lattice: a dimly lit attic window instead of a hole into the roof space.
  // Inside the wall's thickness (faces at +0.09 / −0.31), front side only.
  const attic = new Mesh(new PlaneGeometry(1.9, 2.9), new MeshBasicMaterial({ color: 0x6b3f1a }));
  attic.position.set(0, STOREY + 1.56, -.1); up.add(attic);
  village('Roof_Front_Brick6', 0, TAV_H, 0, 0, up);
  // corner posts cover the wall ends; 10–12 cm proud of both faces (hard rule 1)
  for (const s of [-1, 1]) {
    const p = village('Corner_Exterior_Wood', s * TAV_HW, STOREY, 0, 0, up); p.scale.y = STOREY / 3;
  }

  // chimney over the hearth. The kit chimney's base is cut for a roof falling to its −x
  // (1.21 over 0.95, this roof 1.38): its low edge sits 10 cm under the roof surface, the
  // high edge 20 cm. Close to the ridge, so its top (12.2) shows above it (11.1) from the
  // path — at x −2.2 the gable hid it. (Stretching it instead steepened the cut base and
  // lifted its high edge 0.4 m off the tiles.)
  const ridge = TAV_H + 4.89, slope = 5.67 / 4.12;
  const cx = CHIMNEY.x, lowEdge = Math.abs(cx) + .475, base = ridge - lowEdge * slope - .1;
  village('Prop_Chimney', cx, base, -CHIMNEY.d, 0, front);
  smoke(cx, base + 3.28, GATE_Z - CHIMNEY.d, 7);

  // street lanterns on the door posts: back plate 5 cm inside the post face (hard rule 3)
  for (const s of [-1, 1])
    lantern(front, s * 1, 1.55, .07, 0, { color: 0xffa348, range: 14, power: 1.5, outside: true }, { x: 0, y: 0, z: GATE_Z });

  // the board over the door, between the lanterns: its back 1 cm into the lintel's face,
  // bottom 7 cm above the opening (it never covers the doorway, see the poster mask)
  board(BOARD.over, 1.68, .38, 0, DOOR_H + .07 + .19, .13, front);

  // window boxes under the ground-floor windows: planks 2 cm into the stone, under the
  // sill (0.94), each with three flowering bushes standing in the soil (their stray low
  // leaves go into the box)
  for (const s of [-1, 1]) {
    front.add(kitBox(1.5, .2, .28, wood, s * MOD, .83, .16));
    for (const dx of [-.48, 0, .48]) {
      const f = model('forest', 'flowers'), k = rand(.3, .36);
      f.traverse(c => { if (c instanceof Mesh) night(c.material as Material); });
      f.scale.setScalar(k); f.position.set(s * MOD + dx, .93 - .03, .16); f.rotation.y = rand(0, 6.28);   // origin = its ground
      front.add(f);
    }
  }

  // window light spilling into the mist: soft halos in front of the lit windows (batched
  // with the other glows, no draw call of their own)
  for (const s of [-1, 1]) for (const [y, z, size] of [[1.73, .6, 2.3], [STOREY + 1.88, JETTY + .5, 2]]) {
    const g = sprite(fireTex, size, .1); g.position.set(s * MOD, y, z); front.add(g);
  }

  // the yard: barrels and a crate at the corners (outside the corner posts), a bench under
  // the right window, shortened so it stays clear of the doorway. Bases 2 cm into the ground.
  prop('Barrel', -3.45, -.02, .58, .4, front);
  prop('Crate_Wooden', -3.55, -.02, 1.45, .25, front);
  prop('Barrel', 3.45, -.02, .58, 1.3, front);
  prop('Barrel', 3.95, -.02, 1.3, 2.1, front);
  const bench = prop('Bench', 2.1, -.01, .5, 0, front); bench.scale.x = .75;            // 1.06…3.14

  buildWing(front);

  // sign, hung from the jetty: a bar out of the upper wall (4 cm into the plaster) →
  // crossbar resting on it → two hangers → the board. (A strut under the bar read as a
  // cross from the path: the bar and anything in its plane are seen edge-on.)
  const barY = STOREY + .3, signW = 1.1, signH = .55, bar0 = JETTY - .04, bar1 = SIGN_Z + .35;
  front.add(box(.06, .06, bar1 - bar0, M.iron, SIGN_X, barY, (bar0 + bar1) / 2));
  front.add(box(signW - .1, .05, .05, M.iron, SIGN_X, barY - .05, SIGN_Z));
  const hangTop = barY - .075, signTop = SIGN_Y + signH / 2;
  for (const s of [-1, 1]) front.add(box(.03, hangTop - signTop + .02, .03, M.iron,
    SIGN_X + s * (signW / 2 - .1), (hangTop + signTop) / 2, SIGN_Z));
  board(BOARD.sign, signW, signH, SIGN_X, SIGN_Y, SIGN_Z - .02, front);

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

// the kit's ivy is a bright day green; at night, half as bright (one shared copy)
let ivy: MeshStandardMaterial | null = null;
function shaded(o: Object3D) {
  o.traverse(c => {
    if (!(c instanceof Mesh)) return;
    ivy ??= (() => { const m = (c.material as MeshStandardMaterial).clone(); m.color.multiplyScalar(.5); return m; })();
    c.material = ivy;
  });
}

/* The side wing (reference: the lower annex beside a jettied house): one low stone storey
   on the right, set back from the facade, with an arched door, a small lit window and a
   gabled roof whose ridge runs along the facade under the hall's eaves. Kit walls squeezed
   to WING.h and sunk 10 cm into the ground; the roof's left end stops inside the hall's
   wall (x 2.95, between its faces 2.8 and 3.0), never through into the hall. In facade
   coordinates (z relative to GATE_Z). */
const WING_ROOF = { x0: 2.95, x1: 7.7, sy: .62 };      // Roof_RoundTiles_4x4: ridge 3.73 → 2.31 above the walls
export const WING_RIDGE = WING.h + 3.73 * WING_ROOF.sy;
function buildWing(front: Group) {
  const z0 = WING.z0 - GATE_Z, z1 = WING.z1 - GATE_Z, zc = (z0 + z1) / 2, sink = .1;
  const wall = (name: string, x: number, z: number, ry: number) => {
    const o = village(name, x, -sink, z, ry, front); o.scale.y = (WING.h + sink) / STOREY; return o;
  };
  // front: the arched door (Door_4_Round is one leaf, hinge 0.55 left of the opening's
  // centre) and a thin round window
  for (const n of ['Wall_UnevenBrick_Door_Round', 'DoorFrame_Round_Brick']) wall(n, WING.x0 + 1, z0, 0);
  wall('Door_4_Round', WING.x0 + 1 - .55, z0, 0);
  wall('Wall_UnevenBrick_Window_Thin_Round', WING.x0 + 3, z0, 0);
  wall('Window_Thin_Round1', WING.x0 + 3, z0, 0);
  // the outer side and the back
  wall('Wall_UnevenBrick_Window_Thin_Round', WING.x1, zc + 1, Math.PI / 2);
  wall('Window_Thin_Round1', WING.x1, zc + 1, Math.PI / 2);
  wall('Wall_UnevenBrick_Straight', WING.x1, zc - 1, Math.PI / 2);
  for (const x of [WING.x0 + 1, WING.x0 + 3]) wall('Wall_UnevenBrick_Straight', x, z1, Math.PI);
  for (const z of [z0, z1]) wall('Corner_Exterior_Wood', WING.x1, z, 0);
  // roof: ridge along x, the 4 m span over the wing's depth; the gable closes the outer end
  const roof = village('Roof_RoundTiles_4x4', (WING_ROOF.x0 * 2.82 + WING_ROOF.x1 * 2.74) / 5.56, WING.h, zc, Math.PI / 2, front);
  roof.scale.set(1, WING_ROOF.sy, (WING_ROOF.x1 - WING_ROOF.x0) / 5.56);
  village('Roof_Front_Brick4', WING.x1, WING.h, zc, Math.PI / 2, front).scale.y = WING_ROOF.sy;
  // a kitchen chimney on the back slope, its high edge just behind the ridge. Its cut base
  // falls to its −x (1.21 over 0.95): turned so that side faces down the back slope and
  // widened ×1.25 along it to this flatter roof (pitch 0.96); low edge 10 cm under the
  // tiles, high edge 2 cm. On the ridge, across the cut, its wedge hung over the roof.
  const pitch = (3.73 + .52) * WING_ROOF.sy / 2.76, wide = 1.25;
  const cx = WING.x1 - 1.2, hi = zc - .05, cz = hi - .45 * wide, lo = cz - .5 * wide;
  const base = WING_RIDGE - (zc - lo) * pitch - .1;
  village('Prop_Chimney2', cx, base, cz, -Math.PI / 2, front).scale.x = wide;
  smoke(cx, base + 3.1, GATE_Z + cz, 5);
  // light at the door: a lantern on the wall between door and window, glass lit, no light
  // source of its own (the facade lanterns light the yard); back plate in the stone
  const lx = WING.x0 + 2.05, ly = 1.2;
  lightUp(prop('Lantern_Wall', lx, ly, z0 + .02, 0, front));
  const flame = sprite(fireTex, .45, .85); flame.position.set(lx, ly + LANTERN_HEAD.y, z0 + .02 + LANTERN_HEAD.z); front.add(flame);
  fires.push({ light: null, sp: flame, phase: rand(0, 10), outside: true });
  for (const [x, z] of [[WING.x0 + 3, z0 + .5], [WING.x1 + .5, zc + 1]]) {
    const g = sprite(fireTex, 1.6, .08); g.position.set(x, 1.6, z); front.add(g);
  }
  // ivy hanging from the eaves of the wing's outer side and from the hall's storey line on
  // the left, backs 4 cm into the stone
  for (const v of [village('Prop_Vine1', WING.x1 + .03, WING.h - .1, zc - 1, Math.PI / 2, front),
    village('Prop_Vine2', -TAV_HW - .03, STOREY - .2, -1.1, -Math.PI / 2, front)]) shaded(v);
  // a hand cart parked along the wing, shafts on the ground pointing away from the door
  village('Prop_Wagon', WING.x0 + 2.3, -.02, z0 + 1.5, -Math.PI / 2 + .08, front);
}

/** a column of chimney smoke, its sprites recycled from `y` upwards */
function smoke(x: number, y: number, z: number, n: number) {
  for (let i = 0; i < n; i++) {
    const sp = sprite(smokeTex, rand(1.2, 2.4), rand(.16, .3));
    sp.material.blending = NormalBlending;
    sp.position.set(x + rand(-.3, .3), y + i * 1.6, z);
    scene.add(sp); smokes.push({ sp, x, base: y, phase: rand(0, 10), speed: rand(.3, .6), y: i * 1.6 });
  }
}

export function updateSmoke(dt: number) {
  for (const s of smokes) {
    s.y += s.speed * dt;
    if (s.y > 12) { s.y = 0; s.sp.position.x = s.x + jitter() * .6 - .3; }
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

  // tie beams every 2 m; their ends go 0.2 m into the side walls (hard rule 3)
  const BEAM_Y = 4.6;
  for (let d = 2; d < TAV_LEN; d += MOD) for (const x of [-MOD, 0, MOD])
    village('Wall_BottomCover', x, BEAM_Y, D(d), 0, tav);
  const beamBottom = BEAM_Y - .12;

  // hearth on the left wall, built as a real recess: back slab (0.1 m into the wall),
  // two jambs and a lintel leave a 1.4 × 1.1 m opening 0.4 m deep. Faces that meet are
  // buried inside the stone, none is exposed coplanar (hard rule 1).
  const stone = { mat: 'MI_UnevenBrick', tile: 1.6 } as const, hz = D(HEARTH_D);
  const back = -TAV_HW + WALL_IN - .1, face = back + .9, open = { w: 1.4, h: 1.1 };
  tav.add(kitBox(.5, 3.4, 2.4, stone, back + .25, FLOOR_Y + 1.7, hz));                          // back slab
  for (const s of [-1, 1])                                                                      // jambs
    tav.add(kitBox(.4, open.h, (2.4 - open.w) / 2, stone, face - .2, FLOOR_Y + open.h / 2, hz + s * (open.w / 2 + (2.4 - open.w) / 4)));
  tav.add(kitBox(.4, 3.4 - open.h, 2.4, stone, face - .2, FLOOR_Y + open.h + (3.4 - open.h) / 2, hz));   // lintel
  // light 10 cm in front of the opening: lights the recess and the room, the stone
  // front faces only get grazing light (a lit face this close blew out to white)
  const hearth = new RescaledPointLight(0xff8a3c, 18, 2);
  hearth.position.set(face + .1, .7, hz); tav.add(hearth);
  const hearthFire = sprite(fireTex, .7, .9);
  hearthFire.position.set(face - .22, .45, hz); tav.add(hearthFire);
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
