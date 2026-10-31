import { Color, type Material } from 'three';
import { look } from '../theme/themes';

/* Snow on whatever faces up (the theme's `snow`, winter): pine boughs, rocks, roofs, bushes.
   Laid over a material's own shader edits (foliage, recolour), never instead of them: the
   world-space normal decides how much of the surface is white — from a 30° slope up to
   flat. The normal is read before foliage bends it upwards, so bushes keep their sides.
   Outside only: the hall's floors and tables never get it (the caller picks materials). */

export const SNOW = new Color().setRGB(.26, .29, .36);   // linear, moonlit: blue-white, not paper-white

const GLSL = (amount: number, from: number) => `
{
  float snowUp = inverseTransformDirection(normal, viewMatrix).y;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${SNOW.r.toFixed(3)}, ${SNOW.g.toFixed(3)}, ${SNOW.b.toFixed(3)}),
    smoothstep(${from.toFixed(2)}, ${(from + .35).toFixed(2)}, snowUp) * ${amount.toFixed(2)});
}`;

const done = new WeakSet<Material>();
/** `from`: the cosine of the steepest slope that holds snow (0.5 = 60°; roofs hold it
 *  steeper — their tiles are cut in steps) */
export function snowy(m: Material, from = .5) {
  const amount = look.snow ?? 0;
  if (!amount || done.has(m)) return;
  done.add(m);
  const before = m.onBeforeCompile.bind(m), key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => key() + `|snow${amount}${from}`;
  m.onBeforeCompile = (sh, r) => {
    before(sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + GLSL(amount, from));
  };
  m.needsUpdate = true;
}
