import {
  CanvasTexture, Color, DoubleSide, DynamicDrawUsage, InstancedMesh, MeshStandardMaterial, Object3D, PlaneGeometry
} from 'three';
import { GATE_Z } from '../config';
import { Q } from '../quality';
import { rand } from '../random';
import { look } from '../theme/themes';
import { scene } from './stage';
import { pathX, surfaceY } from './terrain';

/* Falling leaves (the theme's `falling`, autumn): small leaf cards drifting down around the
   walk, swaying and tumbling, in the season's leaf colours. They live in a band that moves
   with the camera (26 m ahead to 2 m behind), so a few dozen fill the whole walk. One draw
   call; the motion is a function of time and each leaf's own constants, like the fireflies'. */

const BAND = 28, HIGH = 7;

function leafTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = '#fff';
  x.beginPath(); x.moveTo(32, 4);                    // a pointed oval leaf with a stem
  x.bezierCurveTo(54, 16, 56, 40, 32, 58); x.bezierCurveTo(8, 40, 10, 16, 32, 4); x.fill();
  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(32, 8); x.lineTo(32, 62); x.stroke();
  return new CanvasTexture(c);
}

interface Leaf { x: number; z: number; y: number; fall: number; sway: number; spin: number; ph: number }
let mesh: InstancedMesh | null = null;
const leaves: Leaf[] = [], o = new Object3D();

export function buildLeaves() {
  const n = Math.round((look.falling ?? 0) * Q.forest);
  if (!n || !look.leaves) return;
  const mat = new MeshStandardMaterial({ map: leafTexture(), alphaTest: .5, side: DoubleSide, roughness: 1 });
  mesh = new InstancedMesh(new PlaneGeometry(.11, .11), mat, n);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  const cols = look.leaves.map(c => new Color(c).multiplyScalar(.5));   // night: half the day colour
  for (let i = 0; i < n; i++) {
    leaves.push({ x: rand(-9, 9), z: rand(0, BAND), y: rand(0, HIGH), fall: rand(.35, .7), sway: rand(.4, 1), spin: rand(1, 3), ph: rand(0, 6.28) });
    mesh.setColorAt(i, cols[i % cols.length]);
  }
  scene.add(mesh);
}

export function updateLeaves(t: number, camZ: number, inside: number) {
  if (!mesh) return;
  mesh.visible = inside < .99;
  leaves.forEach((l, i) => {
    const z = camZ + 2 - ((camZ + 2 - l.z) % BAND + BAND) % BAND;     // wraps ahead of the camera
    const drop = (l.y - t * l.fall) % HIGH, h = drop < 0 ? drop + HIGH : drop;
    const x = pathX(z) + l.x + Math.sin(t * l.sway + l.ph) * .5;
    const ground = z > GATE_Z ? surfaceY(x, z) : 0;
    o.position.set(x, ground + .05 + h, z);
    o.rotation.set(Math.sin(t * l.spin + l.ph) * 1.2, t * l.spin * .7 + l.ph, Math.cos(t * l.spin * .8 + l.ph));
    o.scale.setScalar(h < .1 ? h * 10 : 1);         // melt into the ground instead of popping
    o.updateMatrix(); mesh!.setMatrixAt(i, o.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}
