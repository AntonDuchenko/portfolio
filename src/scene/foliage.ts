import type { Material, MeshStandardMaterial } from 'three';

/* Foliage materials for leaf-card models (bushes, broadleaf crowns). Lit by their own
   normals, the cards facing away from the moon went black and the plants read as paper
   cut-outs; lit as if every leaf faced up (85 %), they shade like one leafy mass and keep
   the texture's detail. Darker towards the roots (the model's own height, 0 at its ground
   line → `fade` m): with the light from above the base was as bright as the crown and the
   plant sat on the ground like a cut-out laid over it. Matte: facing up, a gloss caught the
   moon as a grey haze. `recolor` is GLSL run on diffuseColor after the texture. */

const LIT_FROM_ABOVE = '#include <normal_fragment_maps>\nnormal = normalize(mix(normal, (viewMatrix * vec4(0., 1., 0., 0.)).xyz, .85));';

export function foliage(m: Material, recolor = '', fade = .8) {
  const g = (m as MeshStandardMaterial).clone();
  g.roughness = 1;
  g.metalness = 0;
  g.customProgramCacheKey = () => `foliage${fade}${recolor}`;   // the default key is the hook's source, alike for all
  g.onBeforeCompile = sh => {
    sh.vertexShader = 'varying float vFoliageY;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFoliageY = position.y;');
    sh.fragmentShader = 'varying float vFoliageY;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + recolor
        + `\ndiffuseColor.rgb *= mix(.3, 1., smoothstep(-.05, ${fade.toFixed(2)}, vFoliageY));`)
      .replace('#include <normal_fragment_maps>', LIT_FROM_ABOVE);
  };
  return g;
}

/** GLSL: the texture's brightness (red-weighted: works for green and red leaf textures)
 *  times a linear colour */
export const tinted = (r: number, g: number, b: number) =>
  `diffuseColor.rgb = vec3(dot(diffuseColor.rgb, vec3(.75, .2, .05))) * vec3(${r}, ${g}, ${b});`;
