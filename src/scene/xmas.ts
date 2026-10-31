import {
  AdditiveBlending, BoxGeometry, CanvasTexture, Color, DynamicDrawUsage, type Group, InstancedMesh, Line, LineBasicMaterial,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, OctahedronGeometry, PlaneGeometry, BufferGeometry,
  SphereGeometry, TorusGeometry, Vector3
} from 'three';
import { camera } from '../camera/camera';
import { GATE_Z, JETTY, STOREY } from '../config';
import { look } from '../theme/themes';
import { model } from './assets';
import { scene } from './stage';
import { surfaceY } from './terrain';

/* Christmas and New Year (the theme's `decor`): a string of coloured bulbs under the jetty,
   a wreath on the upper storey, a decorated tree in the yard with a star. Facade coordinates
   (z relative to GATE_Z, as in tavern.ts). The bulbs are one instanced mesh, their glows
   one instanced mesh of camera-facing quads (additive, coloured per bulb), the wire one line:
   three draw calls for every light. Placement is fixed — no draw from the layout's random
   stream, so the rest of the scene stays where it is. Hard rules: the garland hangs from the
   jetty deck's underside (y 3.0) and passes the lantern posts (x ±1, arms up to 2.97) at its
   hanging points; the wreath's back touches the plaster. */

const COLOURS = [0xff3b30, 0x2fd158, 0xffc93c, 0x3c8cff].map(c => new Color(c));
const DECK = { y: STOREY - .12, z: JETTY + .15 };      // the jetty deck's underside and front edge

interface Bulb { p: Vector3; c: Color; ph: number; s?: number }
const bulbs: Bulb[] = [];
let lamps: InstancedMesh | null = null, glows: InstancedMesh | null = null;

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.2, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

/** the garland: a sagging wire between hanging points, bulbs every ~22 cm along it */
function garland(wire: Vector3[]) {
  const hang = [-3.15, -2.05, -1, 0, 1, 2.05, 3.15], sag = .16;
  for (let k = 0; k < hang.length - 1; k++) {
    const a = hang[k], b = hang[k + 1], n = Math.round((b - a) / .05);
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = a + (b - a) * u, y = DECK.y - .01 - sag * 4 * u * (1 - u);
      wire.push(new Vector3(x, y, DECK.z + .01));
    }
    const m = Math.round((b - a) / .22);
    for (let i = 1; i < m; i++) {
      const u = i / m;
      bulbs.push({ p: new Vector3(a + (b - a) * u, DECK.y - .05 - sag * 4 * u * (1 - u), DECK.z + .01), c: COLOURS[bulbs.length % 4], ph: bulbs.length * 1.7 });
    }
  }
}

/** a pine in the yard with bulbs on a spiral over its crown and a star on top */
function tree(at: [number, number], front: Group) {
  const [x, z] = at, s = .63;                        // Pine_2: 7.1 m → 4.5 m
  const t = model('forest', 'pine_b');
  t.scale.setScalar(s); t.position.set(x, surfaceY(x, GATE_Z + z) - GATE_Z * 0 - .05, z);
  front.add(t);
  // the crown, measured on the model: from 1.2 m up to 7.0 m, 2.8 m reach at its foot
  const y0 = 1.2, y1 = 7, r0 = 2.6;
  for (let i = 0; i < 46; i++) {
    const u = (i + .5) / 46, y = y0 + (y1 - .5 - y0) * u, r = r0 * (1 - (y - y0) / (y1 - y0)) * .92;
    const a = i * 2.39996;                          // golden angle: an even spiral
    bulbs.push({ p: new Vector3(x + Math.cos(a) * r * s, t.position.y + y * s, z + Math.sin(a) * r * s), c: COLOURS[i % 4], ph: i * 2.3, s: 1.8 });   // seen from farther: bigger
  }
  const star = new Mesh(new OctahedronGeometry(.16), new MeshBasicMaterial({ color: new Color(0xffd36a) }));
  star.scale.set(1, 1.3, .45);
  star.position.set(x, t.position.y + y1 * s + .08, z); front.add(star);   // 8 cm into the tip
  bulbs.push({ p: star.position.clone(), c: new Color(0xffd36a).multiplyScalar(2), ph: 0, s: 2.5 });
}

/** the wreath: centred on the upper storey's middle module, its back on the plaster */
function wreath(front: Group) {
  const green = new MeshStandardMaterial({ color: new Color().setRGB(.03, .07, .035), roughness: 1 });
  const red = new MeshStandardMaterial({ color: new Color().setRGB(.35, .02, .02), roughness: .7 });
  const R = .34, tube = .09, wall = JETTY + .09, y = STOREY + 1.15;
  const ring = new Mesh(new TorusGeometry(R, tube, 8, 24), green);
  ring.position.set(0, y, wall + tube); front.add(ring);
  for (let i = 0; i < 9; i++) {                     // berries in threes round the ring
    const a = (i / 9) * Math.PI * 2 + .3, b = new Mesh(new SphereGeometry(.035, 6, 4), red);
    b.position.set(Math.cos(a) * R, y + Math.sin(a) * R, wall + tube * 2 - .01); front.add(b);
  }
  const bow = new Mesh(new BoxGeometry(.26, .12, .05), red);
  bow.position.set(0, y - R, wall + tube * 2); front.add(bow);
}

export function buildXmas(front: Group) {
  const d = look.decor;
  if (!d) return;
  const wire: Vector3[] = [];
  if (d.garland) garland(wire);
  if (d.tree) tree(d.tree, front);
  if (d.wreath) wreath(front);
  if (wire.length) front.add(new Line(new BufferGeometry().setFromPoints(wire), new LineBasicMaterial({ color: 0x0b0b08 })));

  lamps = new InstancedMesh(new SphereGeometry(.03, 8, 6), new MeshBasicMaterial(), bulbs.length);
  glows = new InstancedMesh(new PlaneGeometry(.34, .34), new MeshBasicMaterial({
    map: glowTexture(), transparent: true, depthWrite: false, blending: AdditiveBlending
  }), bulbs.length);
  glows.instanceMatrix.setUsage(DynamicDrawUsage);
  const o = new Object3D();
  bulbs.forEach((b, i) => {
    o.position.copy(b.p).add(new Vector3(0, 0, GATE_Z)); o.scale.setScalar(b.s ?? 1); o.updateMatrix();
    lamps!.setMatrixAt(i, o.matrix); lamps!.setColorAt(i, b.c);
    glows!.setColorAt(i, b.c.clone().multiplyScalar(.5));
  });
  for (const m of [lamps, glows]) { m.frustumCulled = false; scene.add(m); }
}

/** the glows face the camera and twinkle, slowly, each bulb on its own phase */
const o = new Object3D();
export function updateXmas(t: number, inside: number) {
  if (!glows) return;
  glows.visible = inside < .99;
  bulbs.forEach((b, i) => {
    o.position.copy(b.p).add(new Vector3(0, 0, GATE_Z));
    o.quaternion.copy(camera.quaternion);
    o.scale.setScalar((b.s ?? 1) * (.75 + .25 * Math.sin(t * 1.7 + b.ph)));
    o.updateMatrix(); glows!.setMatrixAt(i, o.matrix);
  });
  glows.instanceMatrix.needsUpdate = true;
}
