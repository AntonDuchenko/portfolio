import {
  BoxGeometry, type BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, Matrix4, Mesh,
  MeshStandardMaterial, type Object3D, PlaneGeometry, Quaternion, SphereGeometry, TorusGeometry, Vector3
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LIT_FROM_ABOVE } from './foliage';
import { snowy } from './snow';

/* Evergreen decorations: fir sprigs (the window boxes in winter, the Christmas wreaths and
   garlands) and the small painted pieces that go with them (berries, bows, parcels).

   A sprig is two crossed cards of a fir branch painted on a canvas, alpha-cut and lit from
   above like the bushes (foliage.ts): a ring of them reads as one bushy mass, where the
   first wreath — a smooth torus — read as a plastic ring. Everything here wears one of two
   materials (fir, painted with vertex colours), so mergeStatic turns a whole set of
   decorations into two draw calls. Snow only outdoors (snow.ts): these sit in the hall too.
   No draw from the layout's random stream: a sprig's variation is a hash of its index. */

/** a stable pseudo-random number in [0, 1) for an index */
export const hash = (i: number) => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };

function firTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const x = c.getContext('2d')!;
  x.lineCap = 'round';
  // needles in pairs along the stem, swept towards the tip and shorter near it; dense
  // enough that the card stays solid when mipmapped at a distance (thin needles thinned
  // the sprig to its stem)
  for (let i = 0; i < 120; i++) {
    const t = i / 120, y = 250 - t * 238, len = 44 * (1 - t * .5) * (.85 + .3 * hash(i));
    for (const s of [-1, 1]) {
      const a = .8 + .35 * hash(i * 2 + s);
      x.strokeStyle = `hsl(${115 + 25 * hash(i + 300)}, 34%, ${22 + 16 * hash(i * 3 + s + 900)}%)`;
      x.lineWidth = 5;
      x.beginPath(); x.moveTo(64, y); x.lineTo(64 + s * Math.sin(a) * len, y - Math.cos(a) * len); x.stroke();
    }
  }
  x.strokeStyle = '#3e2c1a'; x.lineWidth = 4;
  x.beginPath(); x.moveTo(64, 255); x.lineTo(64, 14); x.stroke();
  const t = new CanvasTexture(c); t.colorSpace = 'srgb'; t.anisotropy = 4;
  return t;
}

let firMat: MeshStandardMaterial | null = null;
/** the fir sprigs' material: night green; the lanterns warm it where they reach */
export function fir() {
  if (firMat) return firMat;
  firMat = new MeshStandardMaterial({ map: firTexture(), alphaTest: .45, side: DoubleSide, roughness: 1 });
  firMat.color.setRGB(.3, .38, .34);
  firMat.customProgramCacheKey = () => 'fir';
  firMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', LIT_FROM_ABOVE); };
  snowy(firMat, .5, true);
  return firMat;
}

let paintMat: MeshStandardMaterial | null = null;
/** berries, bows, parcels: one material, the colour is in the vertices */
export function painted() {
  if (paintMat) return paintMat;
  paintMat = new MeshStandardMaterial({ vertexColors: true, roughness: .55 });
  snowy(paintMat, .5, true);
  return paintMat;
}

/** a geometry in one colour (sRGB hex), ready to merge with the other painted pieces */
export function paint(g: BufferGeometry, hex: number) {
  const c = new Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new Float32BufferAttribute(a, 3));
  return g;
}

const UP = new Vector3(0, 1, 0);
/** One sprig: two crossed cards `len` long from `base` along `dir`, turned `roll` about it.
 *  Width 40 % of the length, like the painted branch. */
export function sprig(base: Vector3, dir: Vector3, len: number, roll: number): BufferGeometry {
  const w = len * .4;
  const a = new PlaneGeometry(w, len).translate(0, len / 2, 0), b = a.clone().rotateY(Math.PI / 2);
  const g = mergeGeometries([a, b]);
  const q = new Quaternion().setFromUnitVectors(UP, dir.clone().normalize())
    .multiply(new Quaternion().setFromAxisAngle(UP, roll));
  return g.applyMatrix4(new Matrix4().compose(base, q, new Vector3(1, 1, 1)));
}

/** a mesh of sprigs (one geometry) */
export const sprigs = (gs: BufferGeometry[]) => new Mesh(mergeGeometries(gs), fir());
/** a mesh of painted pieces (one geometry) */
export const pieces = (gs: BufferGeometry[]) => new Mesh(mergeGeometries(gs), painted());

export const RED = 0x8e1414, GOLD = 0xc99a3a;

/** a cluster of three berries around `at` */
export function berries(at: Vector3, k: number, r = .02): BufferGeometry[] {
  return [0, 1, 2].map(j => {
    const a = j * 2.1 + k;
    return paint(new SphereGeometry(r, 6, 4).translate(at.x + Math.cos(a) * r * 1.3, at.y + Math.sin(a) * r * 1.3, at.z), 0x9a0f12);
  });
}

/** a ribbon bow centred on `at`, facing +z turned `ry` about y: two loops, a knot, two tails */
export function bow(at: Vector3, size: number, hex = RED, ry = 0): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    out.push(paint(new TorusGeometry(.05, .014, 5, 12).scale(1, .62, .5).rotateZ(s * .5)
      .translate(s * .05, .012, 0), hex));
    out.push(paint(new BoxGeometry(.026, .1, .006).rotateZ(s * .35).translate(s * .028, -.055, 0), hex));
  }
  out.push(paint(new SphereGeometry(.02, 6, 4), hex));
  return out.map(g => g.scale(size, size, size).rotateY(ry).translate(at.x, at.y, at.z));
}

export interface Parcel {
  x: number; ground: number; z: number;
  size: [number, number, number];
  /** the paper and the ribbon, sRGB */
  hex: number; ribbon: number;
  ry: number;
}
/** a wrapped parcel standing on `ground` at (x, z): the box, a ribbon both ways, a bow on top */
export function parcel({ x, ground, z, size, hex, ribbon, ry }: Parcel) {
  const [w, h, d] = size, turn = new Matrix4().makeRotationY(ry);
  const out = [
    paint(new BoxGeometry(w, h, d), hex),
    paint(new BoxGeometry(w + .008, h + .008, .035), ribbon),
    paint(new BoxGeometry(.035, h + .008, d + .008), ribbon),
    ...bow(new Vector3(0, h / 2 + .03, 0), .7, ribbon, .6)
  ];
  return out.map(g => g.applyMatrix4(turn).translate(x, ground + h / 2 - .01, z));   // 1 cm into the ground (hard rule 1)
}

export interface WindowBox {
  /** its centre, its soil's height and its length */
  x: number; top: number; z: number; w: number;
  berries: boolean;
  seed: number;
}
/** Window boxes (the theme's `boxes`): fir sprigs fanning up and out of the soil — the
 *  flowers' place in winter — with berries among them if asked. Sprig ends 2 cm into the
 *  soil (hard rule 3). */
export function evergreenBox(parent: Object3D, { x, top, z, w, berries: withBerries, seed }: WindowBox) {
  const gs: BufferGeometry[] = [], red: BufferGeometry[] = [];
  const n = 28;
  for (let i = 0; i < n; i++) {
    const k = seed * 100 + i, u = (i + .5) / n - .5;
    const base = new Vector3(x + u * (w - .12), top - .02, z + (hash(k) - .5) * .14);
    // fan out along the box and up, the front ones leaning out over its edge (+z)
    const dir = new Vector3(u * 1.3 + (hash(k + 7) - .5) * .6, .75 + .6 * hash(k + 3), (hash(k + 5) - .25) * .9);
    gs.push(sprig(base, dir, .3 + .16 * hash(k + 11), hash(k + 13) * 3));
    if (withBerries && i % 3 === 1) red.push(...berries(base.clone().add(dir.normalize().multiplyScalar(.16)), k));
  }
  parent.add(sprigs(gs));
  if (red.length) parent.add(pieces(red));
}
