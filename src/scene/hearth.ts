import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, CircleGeometry, CylinderGeometry, Mesh,
  Group, MeshStandardMaterial, type Object3D, PlaneGeometry, Points, ShaderMaterial
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash } from './evergreen';
import { scene, time } from './stage';

/* The fire in the hall's hearth: the recess had a glow and a light but nothing burning —
   from the aisle it read as a lit hole. Now: charred logs with embers glowing in their
   cracks, an ember bed under them, tongues of flame and a few sparks going up the chimney.
   - logs and bed: kit-free meshes, one material each, their glow flickering (`updateHearth`);
   - flames: three crossed cards, one draw call, a shader shapes each tongue from scrolling
     noise (no texture), additive, so the cards never show their edges;
   - sparks: points rising and fading, positions computed in the shader from their seeds.
   The existing point light and glow sprite (hall.ts) still light the room. */

function emberTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = '#000'; x.fillRect(0, 0, 128, 128);
  x.lineCap = 'round';
  for (let i = 0; i < 60; i++) {                    // cracks glowing between the charred scales
    const a = hash(i) * 6.28, l = 6 + 18 * hash(i + 1), px = hash(i + 2) * 128, py = hash(i + 3) * 128;
    x.strokeStyle = `rgba(255,${110 + 90 * hash(i + 4)},30,${.5 + .5 * hash(i + 5)})`; x.lineWidth = 1 + 2.5 * hash(i + 6);
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  const t = new CanvasTexture(c); t.colorSpace = 'srgb'; return t;
}

const FLAME_VS = /* glsl */`
attribute float seed;
varying vec2 vUv;
varying float vSeed;
void main() { vUv = uv; vSeed = seed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const FLAME_FS = /* glsl */`
uniform float uTime, uPower;
varying vec2 vUv;
varying float vSeed;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 p = vUv;
  float t = uTime * 1.6 + vSeed * 7.;
  float n = n2(vec2(p.x * 4. + vSeed * 3., p.y * 3. - t * 1.7)) * .65 + n2(vec2(p.x * 9., p.y * 7. - t * 3.1)) * .35;
  // tongues: narrower going up, licking sideways with the noise
  float w = .46 * pow(1. - p.y, .6) * (.5 + .7 * n);
  float x = abs(p.x - .5 - (n - .5) * .22 * p.y);
  float body = (1. - smoothstep(w * .35, w, x)) * (1. - smoothstep(.45, 1., p.y + .35 * n)) * smoothstep(0., .06, p.y);
  vec3 col = mix(vec3(.75, .13, .01), vec3(1., .58, .18), smoothstep(.3, .95, body * (1. - p.y * .7)));
  gl_FragColor = vec4(col * body * uPower, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const SPARK_VS = /* glsl */`
attribute vec3 seed;
uniform float uTime;
varying float vFade;
void main() {
  float life = 1.6 + seed.z, age = mod(uTime + seed.x * 9., life) / life;
  vec3 p = position + vec3(sin(uTime * 2. + seed.y * 9.) * .05 * age + (seed.y - .5) * .2 * age, age * 1.3, cos(uTime * 1.7 + seed.x * 7.) * .05 * age);
  vFade = (1. - age) * smoothstep(0., .1, age);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_PointSize = 22. / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const SPARK_FS = /* glsl */`
varying float vFade;
void main() {
  float d = length(gl_PointCoord - .5);
  gl_FragColor = vec4(vec3(1., .55, .15) * (1. - smoothstep(.1, .5, d)) * vFade * 1.4, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

let logs: MeshStandardMaterial | null = null;
const flamePower = { value: .6 };
// its own group, out of the hall's batch: hidden until the door opens (drawn behind the
// facade all the walk, it cost five draw calls for nothing)
const fire = new Group();

/** soot inside the recess, 1.5 cm off the stone (hard rule 1): the fire light blew the bare
 *  stone out to white, and the flames, added onto it, could not show */
function soot(parent: Object3D, y: number, z: number, r: Recess) {
  const mid = (r.back + r.face) / 2, d = r.face - r.back;
  const plane = (w: number, h: number, px: number, py: number, pz: number, ry: number, rx = 0) =>
    new PlaneGeometry(w, h).rotateX(rx).rotateY(ry).translate(px, py, pz);
  parent.add(new Mesh(mergeGeometries([
    plane(r.w, r.h, r.back + .015, y + r.h / 2, z, Math.PI / 2),                                     // the back
    ...[-1, 1].map(s => plane(d, r.h, mid, y + r.h / 2, z + s * (r.w / 2 - .015), s < 0 ? 0 : Math.PI)),   // the sides
    plane(d, r.w, mid, y + r.h - .015, z, 0, Math.PI / 2)                                            // under the lintel, facing down
  ]), new MeshStandardMaterial({ color: 0x120c08, roughness: 1 })));
}

/** the recess: its back's and face's x, the opening's width (along z) and height */
export interface Recess { back: number; face: number; w: number; h: number }

/** the fire on the hearth's floor at (x, y, z), world coordinates, in its recess; the logs
 *  lie along z, the opening's width */
export function buildHearthFire({ x, y, z }: { x: number; y: number; z: number }, recess: Recess) {
  const parent = fire; fire.visible = false; scene.add(fire);
  soot(parent, y, z, recess);
  const embers = emberTexture();
  logs = new MeshStandardMaterial({ color: 0x0a0705, roughness: 1, emissive: 0xff5a14, emissiveMap: embers, emissiveIntensity: .8 });
  const log = (r: number, len: number, lx: number, ly: number, lz: number, rx: number, ry: number) =>
    new CylinderGeometry(r, r * .9, len, 7, 1).rotateX(Math.PI / 2 + rx).rotateY(ry).translate(lx, ly, lz);
  parent.add(new Mesh(mergeGeometries([
    log(.06, .68, x - .06, y + .055, z - .02, 0, .08),
    log(.055, .62, x + .07, y + .05, z + .03, 0, -.1),
    log(.05, .58, x, y + .15, z, .25, .35)                    // across the two, resting on them
  ]), logs));
  const bed = new Mesh(new CircleGeometry(.27, 16).rotateX(-Math.PI / 2).translate(x, y + .012, z),
    new MeshStandardMaterial({ color: 0x0c0806, roughness: 1, emissive: 0xff4a10, emissiveMap: embers, emissiveIntensity: 1.2 }));
  parent.add(bed);

  const cards = [0, 1, 2].map(i => {
    const g = new PlaneGeometry(.64, .7).translate(0, .35, 0).rotateY(i * Math.PI / 3).translate(x, y + .05, z);
    g.setAttribute('seed', new BufferAttribute(new Float32Array(g.attributes.position.count).fill(i * .37), 1));
    return g;
  });
  parent.add(new Mesh(mergeGeometries(cards), new ShaderMaterial({
    uniforms: { uTime: time, uPower: flamePower }, vertexShader: FLAME_VS, fragmentShader: FLAME_FS,
    transparent: true, depthWrite: false, blending: AdditiveBlending
  })));

  const n = 26, pos = new Float32Array(n * 3), seeds = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos.set([x + (hash(i) - .5) * .3, y + .15, z + (hash(i + 50) - .5) * .5], i * 3);
    seeds.set([hash(i + 100), hash(i + 150), hash(i + 200)], i * 3);
  }
  const sparks = new BufferGeometry();
  sparks.setAttribute('position', new BufferAttribute(pos, 3)); sparks.setAttribute('seed', new BufferAttribute(seeds, 3));
  parent.add(new Points(sparks, new ShaderMaterial({
    uniforms: { uTime: time }, vertexShader: SPARK_VS, fragmentShader: SPARK_FS,
    transparent: true, depthWrite: false, blending: AdditiveBlending
  })));
}

/** the embers breathe and the flames flare with the fire's flicker; seen once the door is `open` */
export function updateHearth(t: number, open: boolean) {
  fire.visible = open;
  if (!logs) return;
  const f = .8 + .12 * Math.sin(t * 5.3) + .08 * Math.sin(t * 11.1);
  logs.emissiveIntensity = .75 * f;
  flamePower.value = .55 + .15 * Math.sin(t * 7.7) * Math.sin(t * 3.1);
}
