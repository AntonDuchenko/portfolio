import {
  AdditiveBlending, type BufferGeometry, CanvasTexture, Color, DynamicDrawUsage, ExtrudeGeometry, Group,
  InstancedMesh, type Material, Mesh, MeshBasicMaterial, type MeshStandardMaterial, Object3D, PlaneGeometry,
  Raycaster, Shape, SphereGeometry, Vector3
} from 'three';
import { camera } from '../camera/camera';
import { D, FLOOR_Y, GATE_Z, JETTY, STOREY } from '../config';
import { look } from '../theme/themes';
import { model } from './assets';
import { berries, bow, GOLD, hash, parcel, pieces, RED, sprig, sprigs } from './evergreen';
import { MANTEL } from './hall';
import { scene } from './stage';
import { addShadow } from './shadows';
import { addGroundLight, surfaceY } from './terrain';

/* Christmas and New Year (the theme's `decor`). Outside: a fir garland with coloured bulbs
   under the jetty, a wreath on the upper storey, a decorated pine in the left yard with a
   star and parcels under it. Inside (`decor.hall`): a garland along the mantel, a wreath on
   the chimney breast, a small tree by the bar.

   Draw calls: the sprigs and the painted pieces merge with the building (two materials,
   evergreen.ts); every bulb is one instanced mesh, their glows another (camera-facing
   additive quads, coloured per bulb, twinkling); a tree is its bark and its needles, a
   star one mesh. No draw from the layout's random stream.

   Hard rules: the garland hangs from the jetty deck's underside (y 3.0), the mantel's from
   the shelf; the wreaths' backs touch their walls. Tree bulbs sit on the crown itself: a ray
   from outside finds the needles (a cone round the trunk left a third of them in the air
   between the tiers). */

const COLOURS = [0xff3b30, 0x2fd158, 0xffc93c, 0x3c8cff].map(c => new Color(c));
const STAR = new Color(0xffd36a);
const DECK = { y: STOREY - .12, z: JETTY + .15 };      // the jetty deck's underside and front edge (facade coordinates)

interface Bulb { p: Vector3; c: Color; ph: number; s: number }   // world position
const bulbs: Bulb[] = [];
let glows: InstancedMesh | null = null;

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.2, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

/* ── evergreen shapes ────────────────────────────────────────────── */

/** A fir rope along a polyline: sprigs every 2 cm, swept along it and splayed out round it
 *  like a bottle brush (about `r` thick each way). */
function rope(path: Vector3[], r: number, seed: number) {
  const gs: BufferGeometry[] = [], t = new Vector3(), side = new Vector3(), up = new Vector3();
  let k = seed * 1000;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], n = Math.max(1, Math.round(a.distanceTo(b) / .022));
    t.subVectors(b, a).normalize();
    side.set(0, 1, 0).cross(t).normalize(); up.crossVectors(t, side);
    for (let j = 0; j < n; j++, k++) {
      const roll = hash(k) * 6.283, splay = .55 + .35 * hash(k + 5);
      const out = side.clone().multiplyScalar(Math.cos(roll)).addScaledVector(up, Math.sin(roll));
      const dir = t.clone().multiplyScalar(hash(k + 9) < .5 ? 1 : -1).multiplyScalar(Math.cos(splay)).addScaledVector(out, Math.sin(splay));
      gs.push(sprig(a.clone().lerp(b, j / n), dir, r / Math.sin(splay) * (.8 + .3 * hash(k + 3)), hash(k + 7) * 3));
    }
  }
  return gs;
}

/** points along a line that sags `sag` m between hanging points (coordinates along it):
 *  `at(u, drop)` is the point at u, `drop` below the hanging height; about 8 cm apart */
function swag(hang: number[], sag: number, at: (u: number, s: number) => Vector3) {
  const pts: Vector3[] = [];
  for (let k = 0; k < hang.length - 1; k++) {
    const a = hang[k], b = hang[k + 1], n = Math.max(2, Math.round((b - a) / .08));
    for (let i = k ? 1 : 0; i <= n; i++) {
      const u = i / n;
      pts.push(at(a + (b - a) * u, sag * 4 * u * (1 - u)));
    }
  }
  return pts;
}

/** A wreath of radius R in the xy plane (facing +z), its back on z = 0: four rings of
 *  sprigs following the circle, berries in threes, a bow at the bottom. */
function wreath(R: number, seed: number) {
  const fir: BufferGeometry[] = [], painted: BufferGeometry[] = [];
  for (let ring = 0; ring < 4; ring++) for (let i = 0; i < 30; i++) {
    const k = seed * 1000 + ring * 50 + i, a = (i + ring * .37) / 30 * Math.PI * 2, rr = R + (ring - 1.5) * .055;
    const base = new Vector3(Math.cos(a) * rr, Math.sin(a) * rr, .045 + ring * .012);
    const dir = new Vector3(-Math.sin(a), Math.cos(a), 0)
      .add(new Vector3(Math.cos(a), Math.sin(a), 0).multiplyScalar((ring - 1.5) * .35))
      .add(new Vector3(0, 0, .15 + .25 * hash(k)));
    fir.push(sprig(base, dir, .14 + .05 * hash(k + 1), hash(k + 2) * 3));
  }
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + .5;
    painted.push(...berries(new Vector3(Math.cos(a) * R, Math.sin(a) * R, .14), i + seed));
  }
  painted.push(...bow(new Vector3(0, -R - .02, .15), 1.5));
  return { fir, painted };
}

/* ── trees ───────────────────────────────────────────────────────── */

const ray = new Raycaster();
/** `n` points on the needles of a tree (world), on a golden-angle spiral up its crown:
 *  `y0`…`y1` the crown's height on the unscaled model, `reach` its radius at the foot. */
function onCrown(tree: Object3D, n: number, crown: { y0: number; y1: number; reach: number }, s: number) {
  tree.updateWorldMatrix(true, true);
  const foot = new Vector3().setFromMatrixPosition(tree.matrixWorld), out: Vector3[] = [], far = crown.reach * s * 1.6;
  for (let i = 0; i < n; i++) {
    const y = foot.y + (crown.y0 + (crown.y1 - crown.y0) * (i + .5) / n) * s;
    for (let tries = 0; tries < 4; tries++) {
      const a = i * 2.39996 + tries * .8, d = new Vector3(-Math.cos(a), 0, -Math.sin(a));
      ray.set(new Vector3(foot.x - d.x * far, y, foot.z - d.z * far), d); ray.far = far;
      const hit = ray.intersectObject(tree, true)[0];
      if (!hit || !((hit.object as Mesh).material as Material).name.startsWith('Leaves')) continue;   // a gap: the trunk
      out.push(hit.point.addScaledVector(d, -.012));                                                  // just proud of the needles
      break;
    }
  }
  return out;
}

function starGeometry(r: number) {
  const sh = new Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .42 : r;
    if (i) sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return new ExtrudeGeometry(sh, { depth: r * .25, bevelEnabled: false }).translate(0, 0, -r * .125);
}
let starMat: MeshBasicMaterial | null = null;

// Pine_2, measured on the model: crown from 1.2 m to its tip at 7.0 m, 2.8 m reach at its
// foot; bulbs from 1.3 to 6.4 (off the ragged foot and the thin tip)
const PINE = { h: 7.1, tip: 7, crown: { y0: 1.3, y1: 6.4, reach: 2.8 } };

interface TreeAt {
  /** where it stands, in its parent's space */
  x: number; ground: number; z: number;
  /** height, m */
  h: number;
  bulbs: number;
  /** the hall's copy of the materials: the forest's are night-tinted and take snow */
  warm: boolean;
}
/** a decorated pine: bulbs on its crown, a star 8 cm into its tip */
function decoratedTree(parent: Object3D, { x, ground, z, h, bulbs: n, warm }: TreeAt) {
  const s = h / PINE.h, t = model('forest', 'pine_b');
  t.scale.setScalar(s); t.position.set(x, ground - .05, z);
  if (warm) t.traverse(c => { if (c instanceof Mesh) c.material = indoors(c.material as MeshStandardMaterial); });
  parent.add(t);
  onCrown(t, n, PINE.crown, s).forEach((p, i) => bulbs.push({ p, c: COLOURS[i % 4], ph: i * 2.3, s: h * .4 }));
  const r = .045 * h, star = new Mesh(starGeometry(r), starMat ??= new MeshBasicMaterial({ color: STAR }));
  star.position.set(x, ground - .05 + PINE.tip * s + r * .81 - .08, z);   // the lower points 8 cm into the tip
  parent.add(star);
  star.updateWorldMatrix(true, false);
  bulbs.push({ p: new Vector3().setFromMatrixPosition(star.matrixWorld), c: STAR.clone().multiplyScalar(2), ph: 0, s: h * .55 });
}

const warmed = new Map<Material, MeshStandardMaterial>();
/** the tree's kit material for the hall: untinted (the lanterns light it) and snow-free */
function indoors(m: MeshStandardMaterial) {
  let w = warmed.get(m);
  if (!w) {
    w = m.clone();                                    // a clone drops the shader hooks (night recolour, snow)
    w.color.setRGB(.8, .85, .8);
    warmed.set(m, w);
  }
  return w;
}

/* ── outside ─────────────────────────────────────────────────────── */

/** the garland: a fir rope sagging between hanging points under the jetty deck, a bow at
 *  each, bulbs along its lower edge every ~22 cm */
function garland(fir: BufferGeometry[], painted: BufferGeometry[]) {
  const hang = [-3.15, -2.05, -1, 0, 1, 2.05, 3.15], sag = .16, r = .11;
  const z = DECK.z + .04, top = DECK.y - r + .01;                    // the rope's top 1 cm into the deck
  fir.push(...rope(swag(hang, sag, (x, d) => new Vector3(x, top - d, z)), r, 1));
  for (const x of hang) painted.push(...bow(new Vector3(x, top - .02, z + r + .02), 1.1));
  for (let k = 0; k < hang.length - 1; k++) {
    const a = hang[k], b = hang[k + 1], m = Math.round((b - a) / .22);
    for (let i = 1; i < m; i++) {
      const u = i / m;
      bulbs.push({ p: new Vector3(a + (b - a) * u, top - sag * 4 * u * (1 - u) - r * .8, GATE_Z + z + r * .5), c: COLOURS[bulbs.length % 4], ph: bulbs.length * 1.7, s: 1 });
    }
  }
}

/** the yard tree (facade coordinates), parcels under its lowest boughs on the path side */
function yardTree(front: Group, [x, z]: [number, number], painted: BufferGeometry[]) {
  const ground = surfaceY(x, GATE_Z + z);
  decoratedTree(front, { x, ground, z, h: 4.5, bulbs: 46, warm: false });
  addGroundLight(x + .3, GATE_Z + z + .4, 2.3, .45);             // its bulbs' glow on the snow
  addShadow({ x, z: GATE_Z + z, rx: 1.9, k: .45 });
  const gifts: [number, number, [number, number, number], number, number][] = [
    [.6, .5, [.38, .26, .32], 0x8e1a1a, GOLD], [-.15, .8, [.28, .2, .28], 0x1f5a2c, 0xd8d0c0],
    [.85, -.15, [.3, .34, .26], 0xb8902e, 0x8e1414], [.25, .95, [.22, .16, .2], 0x2a4a8a, GOLD]
  ];
  for (const [dx, dz, size, hex, ribbon] of gifts) {
    painted.push(...parcel({ x: x + dx, ground: surfaceY(x + dx, GATE_Z + z + dz), z: z + dz, size, hex, ribbon, ry: dx * 2 }));
    addShadow({ x: x + dx, z: GATE_Z + z + dz, rx: size[0] * .75, rz: size[2] * .75, ry: dx * 2, k: .55 });
  }
}

/* ── inside ──────────────────────────────────────────────────────── */

/** The mantel garland, the breast's wreath and a small tree by the bar, at the back on the
 *  right: clear of the table (d ≤ 9), the stools (d 11.5) and the post (|x| ≤ 0.65). Their
 *  own group, kept out of the hall's static batch: the facade hides them until the door
 *  opens, and drawn behind it all the walk they cost five draw calls for nothing. */
const hallDecor = new Group();
function hall() {
  const tav = hallDecor; scene.add(tav); tav.visible = false;
  const fir: BufferGeometry[] = [], painted: BufferGeometry[] = [];
  const hang = [-1.3, -.43, .43, 1.3].map(dz => MANTEL.z + dz), r = .08, x = MANTEL.front + .02, top = MANTEL.top - r + .03;
  fir.push(...rope(swag(hang, .15, (z, d) => new Vector3(x, top - d, z)), r, 2));
  for (const z of hang) painted.push(...bow(new Vector3(x + r + .02, top - .02, z), .9, RED, Math.PI / 2));   // facing the room
  const breast = wreath(.3, 3);
  const place = (g: BufferGeometry) => g.rotateY(Math.PI / 2).translate(MANTEL.breast, 2.45, MANTEL.z);
  fir.push(...breast.fir.map(place)); painted.push(...breast.painted.map(place));
  decoratedTree(tav, { x: 1.95, ground: FLOOR_Y, z: D(10.4), h: 2, bulbs: 26, warm: true });
  painted.push(...parcel({ x: 1.6, ground: FLOOR_Y, z: D(9.95), size: [.26, .2, .24], hex: 0x8e1a1a, ribbon: GOLD, ry: .4 }),
    ...parcel({ x: 2.3, ground: FLOOR_Y, z: D(9.9), size: [.22, .26, .2], hex: 0x1f5a2c, ribbon: 0xd8d0c0, ry: -.3 }));
  tav.add(sprigs(fir), pieces(painted));
}

export function buildXmas(front: Group) {
  const d = look.decor;
  if (!d) return;
  const fir: BufferGeometry[] = [], painted: BufferGeometry[] = [];
  if (d.garland) garland(fir, painted);
  if (d.tree) yardTree(front, d.tree, painted);
  if (d.wreath) {
    // centred on the upper storey's middle module, its back on the plaster (z JETTY + 0.09)
    const w = wreath(.34, 4), place = (g: BufferGeometry) => g.translate(0, STOREY + 1.15, JETTY + .09);
    fir.push(...w.fir.map(place)); painted.push(...w.painted.map(place));
  }
  if (fir.length) front.add(sprigs(fir));
  if (painted.length) front.add(pieces(painted));
  if (d.hall) hall();

  const lamps = new InstancedMesh(new SphereGeometry(.03, 8, 6), new MeshBasicMaterial(), bulbs.length);
  const g = new InstancedMesh(new PlaneGeometry(.34, .34), new MeshBasicMaterial({
    map: glowTexture(), transparent: true, depthWrite: false, blending: AdditiveBlending
  }), bulbs.length);
  g.instanceMatrix.setUsage(DynamicDrawUsage);
  const o = new Object3D();
  bulbs.forEach((b, i) => {
    o.position.copy(b.p); o.scale.setScalar(b.s); o.updateMatrix();
    lamps.setMatrixAt(i, o.matrix); lamps.setColorAt(i, b.c);
    g.setColorAt(i, b.c.clone().multiplyScalar(.5));
  });
  for (const m of [lamps, g]) { m.frustumCulled = false; scene.add(m); }
  glows = g;
}

/** the glows face the camera and twinkle, slowly, each bulb on its own phase; the hall's
 *  dressing shows once the door is `open` */
const o = new Object3D();
export function updateXmas(t: number, open: boolean) {
  const g = glows;
  if (!g) return;
  hallDecor.visible = open;
  bulbs.forEach((b, i) => {
    o.position.copy(b.p);
    o.quaternion.copy(camera.quaternion);
    o.scale.setScalar(b.s * (.75 + .25 * Math.sin(t * 1.7 + b.ph)));
    o.updateMatrix(); g.setMatrixAt(i, o.matrix);
  });
  g.instanceMatrix.needsUpdate = true;
}
