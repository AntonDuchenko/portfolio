import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { camera } from '../camera/camera';
import { fog, scene } from './stage';

/* The night sky: one sphere around the camera, drawn first and at the far plane, so every
   tree and roof stands in front of it and the moon hides behind branches (the old moon
   was a soft additive sprite, a warm blob rather than a moon).
   - gradient: the fog colour at the horizon (the ground fades into it seamlessly) up to a
     dark zenith;
   - stars: one hashed point per lit cell of a 3D grid on the view direction, twinkling;
   - moon: a crisp disc with soft maria and a cool halo, in a fixed direction ahead-right of
     the walk (it moves with the camera, as a moon does). One draw call. */

// ahead and to the right: the carried torch glows top-left, the two must not overlap
const MOON_DIR = new Vector3(60, 62, -170).normalize();

const vertexShader = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;                                  // the sphere is centred on the camera
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;                             // depth 1: behind everything
}`;

const fragmentShader = /* glsl */`
uniform vec3 uHorizon, uZenith, uMoonDir, uMoon;
uniform float uTime, uNight;
varying vec3 vDir;
float hash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, smoothstep(-.02, .5, h));
  // stars: fade out towards the misty horizon
  vec3 g = d * 230., cell = floor(g), f = fract(g) - .5;
  float r = hash(cell);
  if (r > .982) {
    float k = (r - .982) / .018;
    float tw = .55 + .45 * sin(uTime * (.8 + 2.4 * k) + r * 61.);
    col += vec3(.7, .8, 1.) * smoothstep(.26, .02, length(f)) * (.35 + 1.4 * k * k) * tw
      * smoothstep(.06, .35, h) * uNight;
  }
  // the moon: halo first, then the disc over it
  float c = dot(d, uMoonDir);
  col += uMoon * (pow(max(c, 0.), 1400.) * .22 + pow(max(c, 0.), 90.) * .045) * uNight;
  float disc = smoothstep(.99952, .99962, c);
  if (disc > 0.) {
    vec3 t1 = normalize(cross(uMoonDir, vec3(0, 1, 0))), t2 = cross(t1, uMoonDir);
    vec2 q = vec2(dot(d, t1), dot(d, t2)) * 1100.;        // ±31 across the disc
    float maria = smoothstep(.45, .75, noise(q * .09 + 3.) * .7 + noise(q * .22) * .3);
    col = mix(col, uMoon * (1. - .28 * maria), disc * uNight);
  }
  gl_FragColor = vec4(col, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const uHorizon = { value: new Color() }, uTime = { value: 0 }, uNight = { value: 1 };
const material = new ShaderMaterial({
  uniforms: {
    uHorizon, uTime, uNight,
    uZenith: { value: new Color().setRGB(.0035, .006, .016) },
    uMoonDir: { value: MOON_DIR },
    uMoon: { value: new Color().setRGB(1.7, 1.8, 2.1) }
  },
  vertexShader, fragmentShader, side: BackSide, depthWrite: false, fog: false
});

const dome = new Mesh(new SphereGeometry(300, 32, 16), material);
dome.renderOrder = -1;                              // first among the opaque objects
dome.frustumCulled = false;

export function buildSky() { scene.add(dome); }

/** Follows the camera; the horizon tracks the fog colour (it warms as we go inside). */
export function updateSky(t: number, inside: number) {
  dome.position.copy(camera.position);
  uHorizon.value.copy(fog.color);
  uTime.value = t;
  uNight.value = 1 - inside;
}
