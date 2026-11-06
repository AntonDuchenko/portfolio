import {
  BufferAttribute, BufferGeometry, Color, type Group, Mesh, MeshStandardMaterial, NormalBlending, Object3D
} from 'three';
import { GATE_Z } from '../config';
import { look } from '../theme/themes';
import { instanced, parts } from './assets';
import { BRIDGE, BROOK, brookZ, deckSlope, deckY, waterEdge } from './brookShape';
import { hash } from './evergreen';
import { night } from './forest';
import { kitBox } from './kitbox';
import { addShadow } from './shadows';
import { MOON_DIR } from './sky';
import { SNOW } from './snow';
import { type GlowSprite, mistTex, sprite } from './sprites';
import { scene, time } from './stage';
import { surfaceY } from './terrain';

/* The brook (its course: brookShape.ts) — the water, the footbridge that carries the path
   over it, and its banks.

   The water: one ribbon along the course, its edges sunk under the banks. A lit material,
   dark and glossy, its normal rippled by noise flowing downstream; it reflects the misty
   sky by Fresnel (bright at a glance along it, dark straight down) and the moon as a
   glittering path. Autumn floats the season's leaves on it. Winter freezes it over, as a
   brook freezes: open water only where the current is quickest (under the bridge, below two
   stones in riffles), a white lip where the ice ends, a rim of clear dark ice round the
   opening and patches swept bare, snow on the rest; steam rising off the open water.
   The bridge: a humpback, kit planks along an arc on two stringers, handrails; laid in the
   facade's group, so it merges into its batch (no draw call of its own), and the building's
   night grade and snow reach it. The banks: reeds at the water's edge, stones, a few in the
   stream. Three draw calls in all (water, reeds, stones). No draw from the layout's random
   stream: placement is a hash of position. */

const WATER_GLSL = /* glsl */`
uniform float uWaterTime, uIce, uLeaves;
uniform vec3 uMoonDir, uSnowCol, uLeafA, uLeafB, uLeafC;
varying vec2 vBrook;
varying vec3 vBrookW;
float bh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bn(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(bh(i), bh(i + vec2(1, 0)), f.x), mix(bh(i + vec2(0, 1)), bh(i + vec2(1, 1)), f.x), f.y);
}
// the ripples' height: long swells along the flow, small chop on top
float ripple(vec2 q) { return bn(q * vec2(1.4, 2.4)) * .6 + bn(q * vec2(4.3, 6.1) + 7.) * .3 + bn(q * vec2(9., 11.) + 3.) * .1; }`;

/* Winter's open water. The stream runs towards +x. Centre x and half-length in m; half-width
   and offset across in the ribbon's units (±1 = its sunk edges, the water shows to ~±.7). */
const ICE_WINDOWS: readonly (readonly [number, number, number, number])[] = [
  [0, 2.8, .5, 0],                                   // under the bridge
  [6.4, 1.6, .3, .1],                                // below the stone at x 5.2
  [-10.2, 1.9, .34, -.08]                            // below the stone at x −11
];
const f2 = (v: number) => v.toFixed(2);

const COLOUR = /* glsl */`
float flow = uWaterTime * .55;
vec2 q = vec2(vBrook.x - flow, vBrook.y * 1.6);
// e: how far out of the nearest window, 1 at its edge; the edge ragged
float e = 9.;
${ICE_WINDOWS.map(([x, len, wid, off]) => `e = min(e, length(vec2((vBrook.x - ${f2(x)}) / ${f2(len)}, (vBrook.y - ${f2(off)}) / ${f2(wid)})));`).join('\n')}
e += (bn(vBrook * vec2(2.5, 9.)) - .5) * .3;
float water = mix(1., 1. - smoothstep(.9, .93, e), uIce);
float lip = uIce * smoothstep(.9, .93, e) * (1. - smoothstep(.96, 1., e));
float bare = uIce * (1. - lip) * max(1. - smoothstep(1.05, 1.35, e), smoothstep(.66, .76, bn(vBrook * vec2(.7, 2.2) + 11.)) * .85);
float crack = 1. - smoothstep(0., .035, abs(bn(vBrook * vec2(2.2, 4.)) - .5));
vec3 ice = mix(uSnowCol * (.86 + .18 * bn(vBrook * 3.)), vec3(.02, .03, .045) + uSnowCol * .4 * crack, bare);
ice = mix(ice, uSnowCol * 1.05, lip);
diffuseColor.rgb = mix(ice, vec3(.005, .008, .012), water);
// the season's leaves drifting down, turning slowly
float leaf = 0.;
if (uLeaves > 0.) for (int L = 0; L < 2; L++) {
  float fl = float(L);
  vec2 r = vec2(vBrook.x - flow * (.85 + .1 * fl), vBrook.y * 1.3) * (2.4 + fl * .9) + fl * 5.3;
  vec2 cell = floor(r), f = fract(r) - .5;
  if (bh(cell) > .32) continue;
  float a = bh(cell + 1.) * 6.283 + uWaterTime * (.2 + .3 * bh(cell + 2.)), s = sin(a), k = cos(a);
  vec2 d = f - (vec2(bh(cell + 3.), bh(cell + 4.)) * .3 - .15);
  d = vec2(k * d.x + s * d.y, -s * d.x + k * d.y) / (.6 + .4 * bh(cell + 5.));
  float e = length(vec2(d.x / .3, d.y / (.14 * (1. - .7 * abs(d.x) / .3))));
  if (e > 1. || abs(d.x) > .3) continue;
  float pick = bh(cell + 6.);
  vec3 c = pick < .4 ? uLeafA : pick < .75 ? uLeafB : uLeafC;
  float m = (1. - smoothstep(.8, 1., e)) * water;
  diffuseColor.rgb = mix(diffuseColor.rgb, c * (.7 + .5 * bh(cell + 7.)), m); leaf = max(leaf, m);
}
float wet = water * (1. - leaf);
// the ripples' slope, by differences: the surface's normal in the world
float e2 = .04;
vec2 grad = vec2(ripple(q + vec2(e2, 0.)) - ripple(q - vec2(e2, 0.)), ripple(q + vec2(0., e2)) - ripple(q - vec2(0., e2))) / (2. * e2);
vec3 nW = normalize(vec3(-grad.x * .2, 1., -grad.y * .2 / 1.6));`;

const NORMAL = /* glsl */`
normal = normalize(mix(normal, normalize((viewMatrix * vec4(nW, 0.)).xyz), wet));`;

const ROUGH = /* glsl */`
roughnessFactor = mix(mix(mix(.8, .12, bare), .06, water), .85, leaf);`;

// the sky in the water (and, flat and fainter, in clear ice): the mist at the horizon, dark
// overhead, the moon's glitter
const EMISSIVE = /* glsl */`
{
  vec3 n = normalize(mix(vec3(0., 1., 0.), nW, water));
  vec3 V = normalize(cameraPosition - vBrookW), R = reflect(-V, n);
  float F = .02 + .98 * pow(1. - max(dot(n, V), 0.), 5.);
  vec3 horizon = vec3(.03, .04, .06);
  #ifdef USE_FOG
  horizon = fogColor;
  #endif
  vec3 sky = mix(horizon * .8, vec3(.0035, .006, .016), smoothstep(0., .4, R.y));
  sky += vec3(1.7, 1.8, 2.1) * (pow(max(dot(R, uMoonDir), 0.), 900.) * 1.1 + pow(max(dot(R, uMoonDir), 0.), 60.) * .03);
  totalEmissiveRadiance += sky * F * (water + bare * .5 * (1. - water)) * (1. - leaf);
}`;

function water() {
  const xs: number[] = [];
  for (let x = -85; x <= 85.01; x += Math.abs(x) < 16 ? .5 : Math.abs(x) < 30 ? 1 : 2.5) xs.push(x);
  const pos = new Float32Array(xs.length * 6), uv = new Float32Array(xs.length * 4), idx: number[] = [];
  xs.forEach((x, i) => {
    const z = brookZ(x), w = waterEdge(x) + .6;      // the edges sunk under the banks
    pos.set([x, BROOK.water, z - w, x, BROOK.water, z + w], i * 6);
    uv.set([x, -1, x, 1], i * 4);
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3)); g.setAttribute('brook', new BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new MeshStandardMaterial({ roughness: .06, metalness: 0 });
  const leaf = (i: number) => ({ value: new Color(look.leaves?.[i] ?? 0).multiplyScalar(.09) });
  m.customProgramCacheKey = () => 'brook';
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, {
      uWaterTime: time, uIce: { value: look.brook === 'ice' ? 1 : 0 }, uLeaves: { value: look.leaves ? 1 : 0 },
      uMoonDir: { value: MOON_DIR }, uSnowCol: { value: SNOW }, uLeafA: leaf(0), uLeafB: leaf(2), uLeafC: leaf(3)
    });
    sh.vertexShader = 'attribute vec2 brook;\nvarying vec2 vBrook;\nvarying vec3 vBrookW;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBrook = brook;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvBrookW = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = WATER_GLSL + '\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + COLOUR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + ROUGH)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + NORMAL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + EMISSIVE);
  };
  const mesh = new Mesh(g, m);
  mesh.frustumCulled = false;                        // 170 m long: its bounds always hold the camera's view
  scene.add(mesh);
}

/** The humpback footbridge on the path (x 0), in facade coordinates: planks laid along a
 *  circular arc on two stringers whose ends rest in the banks (hard rule 3), handrails on
 *  posts standing on the planks. The curved parts are straight pieces on the arc's tangent. */
function bridge(front: Group) {
  const { half, width } = BRIDGE, z0 = BROOK.z - GATE_Z, n = 14;
  const dark = { mat: 'MI_WoodTrim', strip: 'dark' } as const, light = { mat: 'MI_WoodTrim', strip: 'light' } as const;
  /** a box `len` long laid along the arc at s, its centre `lift` above the deck */
  const along = (w: number, h: number, len: number, s: number, x: number, lift: number, surface: typeof dark | typeof light) => {
    const b = kitBox(w, h, len, surface, x, deckY(s) + lift, z0 + s);
    b.rotation.x = -Math.atan(deckSlope(s)); return b;
  };
  const piece = 2 * half / n;
  for (const side of [-1, 1]) for (let i = 0; i < n; i++)                                  // stringers, tops under the planks
    front.add(along(.16, .2, piece + .03, -half + piece * (i + .5), side * .78, -.1, dark));
  for (let s = -half + .12, i = 0; s < half - .1; s += .25, i++) {                         // planks, 3 cm gaps, a little uneven
    const p = along(width, .06, .22, s, (hash(i) - .5) * .05, .03 + (hash(i + 9) - .5) * .01, light);
    p.rotation.y = (hash(i + 3) - .5) * .04; front.add(p);
  }
  const deck = .06, h = .92, from = -half + .2, span = 2 * half - .4;
  for (const side of [-1, 1]) {
    for (const s of [from, -half / 2, 0, half / 2, -from]) front.add(kitBox(.1, h, .1, dark, side * .95, deckY(s) + deck + h / 2, z0 + s));
    for (let i = 0; i < n; i++) {
      const s = from + span * (i + .5) / n, len = span / n + .03;
      front.add(along(.08, .08, len, s, side * .95, deck + h - .04, dark));                  // the handrail
      front.add(along(.07, .07, len, s, side * .95, deck + .48, dark));                      // the middle rail
    }
  }
}

/** reeds along both edges of the water, stones on the banks and a few in the stream */
function banks() {
  const reeds: Object3D[] = [], stones: Object3D[] = [];
  const at = (x: number, side: number, off: number) => { const z = brookZ(x) + side * (waterEdge(x) + off); return { z, y: surfaceY(x, z) }; };
  for (let x = -26, i = 0; x < 26; x += .3 + .25 * hash(i), i++) for (const side of [-1, 1]) {
    const k = i * 2 + (side + 1) / 2;
    if (Math.abs(x) < 1.5 || hash(k + 1) < .35) continue;                                    // the bridge; gaps
    const { z, y } = at(x, side, (hash(k + 2) - .4) * .35), o = new Object3D();
    o.position.set(x, y - .03, z); o.rotation.y = hash(k + 3) * 6.28;
    const s = .45 + .3 * hash(k + 4); o.scale.set(s, s * (1.1 + .6 * hash(k + 5)), s);
    reeds.push(o);
  }
  for (let x = -24, i = 0; x < 24; x += .9 + 1.4 * hash(i + 50), i++) {
    const side = hash(i + 51) < .5 ? -1 : 1;
    if (Math.abs(x) < 1.8) continue;
    const { z, y } = at(x, side, (hash(i + 52) - .3) * .5), o = new Object3D(), s = .25 + .3 * hash(i + 53);
    o.position.set(x, y - s * .25, z); o.rotation.set((hash(i + 54) - .5) * .5, hash(i + 55) * 6.28, (hash(i + 56) - .5) * .5);
    o.scale.setScalar(s); stones.push(o);
    addShadow({ x, z, rx: s * .62, k: .6 });
  }
  for (const [x, dz, s] of [[5.2, -.3, .32], [8.8, .25, .38], [-6.4, .1, .3], [-11, -.35, .36]]) {   // in the stream
    const o = new Object3D(), z = brookZ(x) + dz;
    o.position.set(x, BROOK.water - s * .45, z); o.rotation.set(.2, x, -.15); o.scale.setScalar(s); stones.push(o);
  }
  for (const [name, list] of [['tallgrass', reeds], ['edge_rock', stones]] as const) {
    const ps = parts('forest', name);
    ps.forEach(p => night(p.material));
    for (const m of instanced(ps, list.length)) {
      list.forEach((o, i) => { o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
      m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); scene.add(m);
    }
  }
}

/** steam off winter's open water: mist puffs rising from each window and fading, recycled */
interface Puff { sp: GlowSprite; x: number; z: number; y: number; speed: number }
const puffs: Puff[] = [];
const STEAM_TOP = 2.6;                               // m over the water where a puff has faded out

function steam() {
  ICE_WINDOWS.forEach(([cx, len, , off], w) => {
    for (let i = 0; i < 4; i++) {
      const k = w * 10 + i + 70, x = cx + (hash(k) - .5) * len, z = brookZ(x) + off * (waterEdge(x) + .6);
      const sp = sprite(mistTex, 1.8 + hash(k + 1), 0);
      sp.material.blending = NormalBlending;        // batched with the forest's mist
      scene.add(sp); puffs.push({ sp, x, z, y: STEAM_TOP * i / 4, speed: .2 + .15 * hash(k + 2) });
    }
  });
}

export function updateBrook(dt: number) {
  for (const p of puffs) {
    p.y += p.speed * dt;
    if (p.y > STEAM_TOP) p.y = 0;
    const u = p.y / STEAM_TOP, s = p.sp.userData.base * (.6 + .8 * u);
    p.sp.position.set(p.x + u * .4, BROOK.water + .1 + p.y, p.z);   // drifting downstream
    p.sp.scale.set(s, s * .55, 1);                   // low and wide: it hugs the water
    p.sp.material.opacity = 1.4 * Math.sin(Math.PI * u);   // the texture's own alpha is .3 at most
  }
}

export function buildBrook(front: Group) {
  water();
  bridge(front);
  banks();
  if (look.brook === 'ice') steam();
}
