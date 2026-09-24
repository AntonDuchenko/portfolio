import { BoxGeometry, CanvasTexture, Group, Mesh, MeshStandardMaterial, NormalBlending } from 'three';
import { D, DOOR_H, DOOR_W, GATE_Z, TAV_END, TAV_H, TAV_HW, TAV_LEN } from '../config';
import { rand } from '../random';
import { fires, RescaledPointLight } from './lights';
import { box, cyl, M } from './materials';
import { fireTex, type GlowSprite, smokeTex, sprite } from './sprites';
import { scene } from './stage';

const FW = 9.4, FH = 9;                                   // facade half-width and height
const SIGN_X = -DOOR_W / 2 - 2.6;

/** world positions that audio attaches to */
export const HEARTH_POS = { x: -TAV_HW + 2, y: 1.1, z: D(7) };
export const SIGN_POS = { x: SIGN_X, y: 4.5, z: GATE_Z + 2.1 };
export const DOOR_POS = { x: 0, y: 2.3, z: GATE_Z };

/** door leaves; they open inward */
export const leaves: { pivot: Group; dir: number }[] = [];
export const setDoor = (angle: number) => leaves.forEach(l => l.pivot.rotation.y = -l.dir * angle);

const smokes: { sp: GlowSprite; base: number; phase: number; speed: number; y: number }[] = [];

function signTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#2b1d10'; x.fillRect(0, 0, 512, 256);
  x.fillStyle = '#d8b877'; x.font = 'bold 92px Georgia'; x.textAlign = 'center';
  x.fillText('ТАВЕРНА', 256, 150);
  x.strokeStyle = '#8a6a34'; x.lineWidth = 6; x.strokeRect(16, 16, 480, 224);
  return new CanvasTexture(c);
}

/* ── facade ──────────────────────────────────────────────────────── */
export function buildFacade() {
  const front = new Group(); front.position.z = GATE_Z; scene.add(front);
  // stone plinth, timber frame above.
  // The plinth has the door cut out too: a solid one blocked the door with stone (hard rule 2).
  for (const s of [-1, 1]) {
    const w = FW - DOOR_W / 2, cx = s * (DOOR_W / 2 + w / 2);
    front.add(box(w, 1.3, 1, M.stone, cx, .65, 0));
    front.add(box(w, FH - 1.3, 1, M.plaster, cx, 1.3 + (FH - 1.3) / 2, 0));
  }
  front.add(box(DOOR_W + .6, FH - DOOR_H - 1.3 + 1.3, 1, M.plaster, 0, DOOR_H + (FH - DOOR_H) / 2, 0));
  // timber frame
  for (const x of [-7.6, -4.8, 4.8, 7.6]) front.add(box(.3, FH - 1.3, .14, M.beam, x, 1.3 + (FH - 1.3) / 2, .56));
  for (const y of [4.9, FH - .25]) front.add(box(FW * 2, .34, .14, M.beam, 0, y, .56));
  for (const s of [-1, 1]) front.add(box(.34, 4, .14, M.beam, s * (DOOR_W / 2 + .35), DOOR_H / 2 + .4, .56));
  // diagonal braces
  for (const s of [-1, 1]) {
    const b = box(.26, 3.2, .13, M.beam, s * 6.2, 3, .57); b.rotation.z = s * .55; front.add(b);
    const b2 = box(.26, 2.4, .13, M.beam, s * 6.2, 7, .57); b2.rotation.z = -s * .5; front.add(b2);
  }
  // warm windows
  for (const [x, y, w, h] of [[-6.4, 3.2, 1.5, 1.7], [6.4, 3.2, 1.5, 1.7],
    [-6.4, 6.9, 1.3, 1.4], [0, 6.9, 1.3, 1.4], [6.4, 6.9, 1.3, 1.4]]) {
    front.add(box(w + .3, h + .3, .2, M.beam, x, y, .5));
    front.add(box(w, h, .1, M.glass, x, y, .62));
    front.add(box(.1, h, .14, M.beam, x, y, .66));
  }
  // roof
  for (const s of [-1, 1]) {
    const r = box(FW + 1.4, .5, 20, M.roof, s * (FW / 2 + .2), FH + 2.1, -9);
    r.rotation.z = -s * .62; front.add(r);
  }
  front.add(box(.8, .7, 20, M.roof, 0, 14.1, -9));
  front.add(box(FW * 2 + 1.6, .45, 1, M.beam, 0, FH + .35, .3));
  // chimney and smoke
  front.add(box(1.4, 4.2, 1.4, M.stone, -5.6, FH + 3.2, -4));
  for (let i = 0; i < 7; i++) {
    const sp = sprite(smokeTex, rand(2, 4), rand(.16, .3));
    sp.material.blending = NormalBlending;
    sp.position.set(-5.6 + rand(-.6, .6), FH + 5.5 + i * 2.4, GATE_Z - 4);
    scene.add(sp); smokes.push({ sp, base: FH + 5.5, phase: rand(0, 10), speed: rand(.35, .7), y: i * 2.4 });
  }
  // threshold: a dark wooden sill right under the door, no light steps
  front.add(box(DOOR_W + .5, .5, 1.2, M.wood, 0, -.19, .1));   // top exactly at 0.06, like the floor
  // street lanterns: bracket → link → body touch each other (hard rule 3)
  for (const s of [-1, 1]) {
    const x = s * (DOOR_W / 2 + .9), y = 3.3;
    front.add(box(.1, .1, 1.05, M.iron, x, y + .6, .62));    // bracket from the wall
    front.add(box(.05, .4, .05, M.iron, x, y + .4, 1.1));     // link down to the body
    front.add(box(.42, .5, .42, M.iron, x, y, 1.1));
    const l = new RescaledPointLight(0xffa348, 14); l.position.set(x, y, GATE_Z + 1.1); scene.add(l);
    const sp = sprite(fireTex, .9, .85); sp.position.set(x, y, 1.1); front.add(sp);
    fires.push({ light: l, sp, phase: rand(0, 10), power: 1.5, outside: true });
  }

  // sign on a bracket
  front.add(box(.14, .14, 2.2, M.iron, SIGN_X, 6.2, 1.1));
  front.add(box(.14, 1.1, .14, M.iron, SIGN_X, 5.7, 2.1));
  const sign = new Mesh(new BoxGeometry(2.4, 1.2, .12),
    [M.beam, M.beam, M.beam, M.beam,
      new MeshStandardMaterial({ map: signTexture(), roughness: 1 }), M.beam]);
  sign.position.set(SIGN_X, 4.5, 2.1); front.add(sign);

  // door leaves, opening inward
  for (const s of [-1, 1]) {
    const LH = DOOR_H - .08;
    const p = new Group(); p.position.set(s * DOOR_W / 2, .08, 0); front.add(p);
    p.add(box(DOOR_W / 2, LH, .3, M.wood, -s * DOOR_W / 4, LH / 2, 0));
    for (let i = 0; i < 3; i++) p.add(box(.08, LH - .25, .36, M.beam, -s * (.32 + i * .56), LH / 2, 0));
    p.add(box(DOOR_W / 2 - .15, .26, .4, M.iron, -s * DOOR_W / 4, 1.1, 0));
    p.add(box(DOOR_W / 2 - .15, .26, .4, M.iron, -s * DOOR_W / 4, 3.3, 0));
    leaves.push({ pivot: p, dir: s });
  }
}

export function updateSmoke(dt: number) {
  for (const s of smokes) {
    s.y += s.speed * dt;
    if (s.y > 18) { s.y = 0; s.sp.position.x = -5.6 + rand(-.6, .6); }
    s.sp.position.y = s.base + s.y;
    s.sp.material.opacity = Math.max(0, .26 * (1 - s.y / 18));
  }
}

/* ── hall ────────────────────────────────────────────────────────── */
/** Returns the hall group (offset y −0.24 so the floor is flush with the ground). */
export function buildHall() {
  const tav = new Group(); scene.add(tav);
  tav.position.y = -.24;
  const midZ = (GATE_Z + TAV_END) / 2;
  tav.add(box(TAV_HW * 2, .7, TAV_LEN, M.floor, 0, -.05, midZ));          // floor top at 0.3
  for (let i = 0; i < 14; i++) tav.add(box(TAV_HW * 2, .02, .05, M.wood, 0, .31, GATE_Z - 1 - i * 1.35));
  for (const s of [-1, 1]) tav.add(box(.9, TAV_H, TAV_LEN, M.plaster, s * TAV_HW, TAV_H / 2, midZ));
  tav.add(box(TAV_HW * 2, .9, TAV_LEN, M.beam, 0, TAV_H, midZ));
  tav.add(box(TAV_HW * 2, TAV_H, .9, M.plaster, 0, TAV_H / 2, TAV_END));
  // ceiling beams and wall posts
  for (let i = 1; i <= 7; i++) {
    const z = D(i * (TAV_LEN / 8));
    tav.add(box(TAV_HW * 2, .36, .32, M.beam, 0, TAV_H - .5, z));
    for (const s of [-1, 1]) tav.add(box(.3, TAV_H, .3, M.beam, s * (TAV_HW - .4), TAV_H / 2, z));
  }

  // hearth on the left wall
  tav.add(box(.8, 3.4, 4, M.stone, -TAV_HW + .9, 1.7, D(7)));
  tav.add(box(.5, 2, 2.6, M.beam, -TAV_HW + 1.5, 1.3, D(7)));
  const hearth = new RescaledPointLight(0xff8a3c, 18);
  hearth.position.set(-TAV_HW + 2, 1.5, D(7)); tav.add(hearth);
  const hearthFire = sprite(fireTex, 2.2, .9);
  hearthFire.position.set(-TAV_HW + 2, 1.3, D(7)); tav.add(hearthFire);
  fires.push({ light: hearth, sp: hearthFire, phase: rand(0, 10), power: 2.4 });

  // bar at the back wall
  const BAR_Z = TAV_END + 2.6;
  tav.add(box(13, 1.15, .9, M.plank, 0, .88, BAR_Z));
  tav.add(box(13.4, .12, 1.1, M.beam, 0, 1.5, BAR_Z));
  for (let i = 0; i < 5; i++) tav.add(box(.24, 1.1, .24, M.wood, -5.4 + i * 2.7, .85, BAR_Z + .3));
  // shelves with bottles
  for (let i = 0; i < 3; i++) {
    tav.add(box(11, .12, .5, M.plank, 0, 2.1 + i * .9, TAV_END + .75));
    for (let j = 0; j < 14; j++)
      tav.add(cyl(.07, .09, rand(.3, .5), M.wood, -5 + j * .77, 2.4 + i * .9, TAV_END + .75, 6));
  }
  // barrels behind the bar and along the walls
  function barrel(x: number, y: number, z: number, lying?: boolean) {
    const b = cyl(.44, .5, 1.1, M.wood, x, y + .55, z, 10);
    if (lying) { b.rotation.z = Math.PI / 2; b.position.set(x, y + .5, z); }
    tav.add(b);
    for (const dy of [.18, .92]) {
      const r = cyl(.51, .51, .07, M.iron, x, y + dy, z, 10);
      if (lying) { r.rotation.z = Math.PI / 2; r.position.set(x + (dy - .55) * 1.05, y + .5, z); }
      tav.add(r);
    }
  }
  barrel(-6.2, .3, BAR_Z - 1.4, true); barrel(-6.2, 1.3, BAR_Z - 1.4, true);
  barrel(6.2, .3, BAR_Z - 1.4, true);
  for (const s of [-1, 1]) { barrel(s * (TAV_HW - 1.3), .3, D(3.4)); barrel(s * (TAV_HW - 1.3), .3, D(4.8)); }
  // bar stools
  for (let i = 0; i < 6; i++) {
    const x = -5 + i * 2;
    tav.add(cyl(.26, .24, .1, M.plank, x, 1.05, BAR_Z + 1.5, 8));
    for (let j = 0; j < 3; j++) {
      const a = j / 3 * Math.PI * 2;
      tav.add(cyl(.05, .06, .75, M.wood, x + Math.cos(a) * .17, .68, BAR_Z + 1.5 + Math.sin(a) * .17, 6));
    }
  }

  // tables along the sides, the centre aisle stays clear
  function tavTable(x: number, z: number, r: number) {
    tav.add(cyl(r, r, .12, M.plank, x, 1.05, z, 12));
    tav.add(cyl(.16, .22, .75, M.wood, x, .68, z, 8));
    tav.add(cyl(.5, .5, .1, M.wood, x, .35, z, 8));
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + rand(-.2, .2), d = r + .62;
      const sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d;
      tav.add(cyl(.24, .22, .09, M.plank, sx, .78, sz, 8));
      for (let j = 0; j < 3; j++) {
        const b = j / 3 * Math.PI * 2;
        tav.add(cyl(.045, .055, .48, M.wood, sx + Math.cos(b) * .15, .54, sz + Math.sin(b) * .15, 6));
      }
    }
    // candle and mugs
    tav.add(cyl(.07, .09, .12, M.iron, x, 1.17, z, 8));
    tav.add(cyl(.045, .045, .26, M.paper, x, 1.36, z, 6));
    const f = sprite(fireTex, .26, .8); f.position.set(x, 1.54, z); tav.add(f);
    fires.push({ light: null, sp: f, phase: rand(0, 10) });
    for (let i = 0; i < 3; i++) {
      const a = rand(0, 6.28);
      tav.add(cyl(.07, .08, .16, M.plank, x + Math.cos(a) * r * .6, 1.19, z + Math.sin(a) * r * .6, 7));
    }
  }
  for (const [x, z, r] of [[-5.4, D(4), .95], [5.4, D(4.6), .85], [-5.8, D(9), .9],
    [5.7, D(9.4), .95], [-5.3, D(14), .85], [5.4, D(14.3), .9]]) tavTable(x, z, r);

  // hanging lanterns over the aisle, exactly on the ceiling beams: d is a multiple of
  // TAV_LEN/8. The chain reaches into the beam (hard rule 3).
  for (const [d, withLight] of [[5, true], [10, false], [15, true]] as const) {
    const g = new Group(); g.position.set(0, 0, D(d)); tav.add(g);
    g.add(box(.06, 1.35, .06, M.iron, 0, TAV_H - .92, 0));      // chain into the beam
    g.add(box(.46, .55, .46, M.iron, 0, TAV_H - 1.8, 0));
    g.add(box(.56, .08, .56, M.beam, 0, TAV_H - 1.48, 0));
    const sp = sprite(fireTex, .9, .85); sp.position.set(0, TAV_H - 1.85, 0); g.add(sp);
    let l: RescaledPointLight | null = null;
    if (withLight) { l = new RescaledPointLight(0xffa348, 16); l.position.set(0, TAV_H - 1.85, D(d)); tav.add(l); }
    fires.push({ light: l, sp, phase: rand(0, 10), power: 1.8 });
  }
  return tav;
}
