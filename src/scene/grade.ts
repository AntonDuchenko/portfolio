import type { Material } from 'three';
import { kitMaterials } from './assets';

/* Night grade for the building and its props. The Village and Props kits are painted for
   daylight: by the lanterns the facade's wood came out a saturated orange, evenly bright,
   and the house read as pasted onto the night (the forest's kit got its night tint long
   ago, forest.ts). Outside, these materials lose a third of their saturation and darken
   to a cool grey; the lanterns and windows still warm what they reach. The materials are
   the hall's too, so the grade follows the visitor, not the surface: `nightGrade` is
   1 − inside, and the room warms back to its own colours as the camera goes in (from
   the door the hall is seen a little cooler, as eyes coming in from the dark would). */

export const nightGrade = { value: 1 };

const GLSL = /* glsl */`
{
  float l = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
  vec3 graded = mix(vec3(l), diffuseColor.rgb, .62) * vec3(.62, .66, .76);
  diffuseColor.rgb = mix(diffuseColor.rgb, graded, uNightGrade);
}`;

function grade(m: Material) {
  const before = m.onBeforeCompile.bind(m), key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => key() + '|grade';
  m.onBeforeCompile = (sh, r) => {
    before(sh, r);
    sh.uniforms.uNightGrade = nightGrade;
    sh.fragmentShader = 'uniform float uNightGrade;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + GLSL);
  };
  m.needsUpdate = true;
}

/** every material of the building kits (call once, before anything is drawn) */
export function gradeBuildingKits() {
  for (const m of [...kitMaterials('village'), ...kitMaterials('props')]) grade(m);
}
