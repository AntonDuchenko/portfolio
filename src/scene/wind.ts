import type { Material } from 'three';
import { sound } from '../theme/themes';
import { time } from './stage';

/* Wind in the plants: needles, leaves, bushes, ferns and grass sway, more towards their tips,
   each plant on its own phase (its root's place), with a faster flutter on top. A storm
   howled in winter while not a needle moved. The gusts follow the same slow curve as the
   wind one hears (audio/scene.ts: .55 + .45·sin(.13 t)·sin(.041 t)), on the run's clock,
   and the season's wind scales them (autumn ×1.3, winter ×1.2). Vertex shader only: no
   draw call, nothing on the CPU. The hall's tree is a copy of the material, and stands
   still indoors. */

const GLSL = (height: number, reach: number) => /* glsl */`
{
  vec3 root = vec3(0.);
  #ifdef USE_INSTANCING
  root = instanceMatrix[3].xyz;
  #endif
  root = (modelMatrix * vec4(root, 1.)).xyz;
  float t = uWindTime, gust = .55 + .45 * sin(t * .13) * sin(t * .041);
  float bend = clamp(position.y / ${height.toFixed(2)}, 0., 1.5); bend *= bend * gust * ${reach.toFixed(3)};
  float flutter = sin(t * 7. + dot(position, vec3(3.1, 1.7, 2.3)) + root.x) * .12;
  transformed.x += (sin(t * 1.4 + root.x * .37 + root.z * .23) * .65 + sin(t * 2.9 + root.x * .9) * .25 + flutter) * bend;
  transformed.z += (sin(t * 1.1 + root.z * .31 + root.x * .17) * .45 + flutter * .8) * bend * .7;
}`;

const STRENGTH = sound.wind ?? 1;
const done = new WeakSet<Material>();
/** `height`: the model's height (m, unscaled), `reach`: how far its tip swings at a full gust */
export function windy(m: Material, height: number, reach: number) {
  if (done.has(m)) return;
  done.add(m);
  const r = reach * STRENGTH;
  const before = m.onBeforeCompile.bind(m), key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => key() + `|wind${height}${r}`;
  m.onBeforeCompile = (sh, rr) => {
    before(sh, rr);
    sh.uniforms.uWindTime = time;
    sh.vertexShader = 'uniform float uWindTime;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + GLSL(height, r));
  };
  m.needsUpdate = true;
}
