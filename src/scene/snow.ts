import { Color, type Material } from 'three';
import { GATE_Z, JETTY, STOREY, TAV_END, TAV_HW } from '../config';
import { look } from '../theme/themes';

/* Snow on whatever faces up (the theme's `snow`, winter): pine boughs, rocks, roofs, bushes.
   Laid over a material's own shader edits (foliage, recolour), never instead of them: the
   world-space normal decides how much of the surface is white — from a 30° slope up to
   flat. The normal is read before foliage bends it upwards, so bushes keep their sides.

   `outdoors`: for the kit materials the facade shares with the hall (barrels, crates, the
   cart, beams, the sign): the world position decides too — no snow inside the hall's
   walls, nor under the jetty (to 20 cm past its edge), whose deck keeps the door, the
   sills, the bench and the garland dry. */

export const SNOW = new Color().setRGB(.26, .29, .36);   // linear, moonlit: blue-white, not paper-white

const OUTDOORS = /* glsl */`
varying vec3 vSnowW;
float snowOutdoors(vec3 p) {
  bool hall = abs(p.x) < ${TAV_HW.toFixed(2)} && p.z < ${GATE_Z.toFixed(2)} && p.z > ${TAV_END.toFixed(2)};
  bool jetty = abs(p.x) < ${(TAV_HW + .2).toFixed(2)} && p.z < ${(GATE_Z + JETTY + .35).toFixed(2)} && p.y < ${(STOREY - .1).toFixed(2)};
  return hall || jetty ? 0. : 1.;
}`;
// after project_vertex: `transformed` is the model-space position (instancing applied here)
const WORLD_POS = /* glsl */`
{
  vec4 snowW = vec4(transformed, 1.);
  #ifdef USE_INSTANCING
  snowW = instanceMatrix * snowW;
  #endif
  vSnowW = (modelMatrix * snowW).xyz;
}`;

const GLSL = (amount: number, from: number, outdoors: boolean) => `
{
  float snowUp = inverseTransformDirection(normal, viewMatrix).y;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${SNOW.r.toFixed(3)}, ${SNOW.g.toFixed(3)}, ${SNOW.b.toFixed(3)}),
    smoothstep(${from.toFixed(2)}, ${(from + .35).toFixed(2)}, snowUp) * ${amount.toFixed(2)}${outdoors ? ' * snowOutdoors(vSnowW)' : ''});
}`;

const done = new WeakSet<Material>();
/** `from`: the cosine of the steepest slope that holds snow (0.5 = 60°; roofs hold it
 *  steeper — their tiles are cut in steps) */
export function snowy(m: Material, from = .5, outdoors = false): void {
  const amount = look.snow ?? 0;
  if (!amount || done.has(m)) return;
  done.add(m);
  const before = m.onBeforeCompile.bind(m), key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => key() + `|snow${amount}${from}${outdoors ? 'out' : ''}`;
  m.onBeforeCompile = (sh, r) => {
    before(sh, r);
    if (outdoors) {
      sh.vertexShader = 'varying vec3 vSnowW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + WORLD_POS);
      sh.fragmentShader = OUTDOORS + '\n' + sh.fragmentShader;
    }
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + GLSL(amount, from, outdoors));
  };
  m.needsUpdate = true;
}
