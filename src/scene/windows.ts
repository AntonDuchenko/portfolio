import { type BufferGeometry, Float32BufferAttribute, FrontSide, MeshBasicMaterial } from 'three';
import { time } from './stage';

/* The lit windows: curtains drawn back, a room glowing behind them. The kit's glass was one
   flat warm colour and read as a yellow card. Every pane is the same material: the glass
   meshes carry their own 0…1 coordinates across the window (`pane`, from the glass's
   bounds — the kit's UVs point into an atlas), and a window's look (curtain colour, how
   far they are drawn, whether someone walks past) comes from a hash of its place on the
   2 m grid, so the batching that merges them changes nothing.
   - the room: warm, brighter low (the fire and the candles are down there), flickering;
   - curtains: a drape on each side hanging from a pelmet, gathered by a tie-back 40 % up,
     folds bunched at the tie-back, the room's light coming through the cloth;
   - now and then the shadow of someone crossing the room passes the gap.
   Front side only, as before: from inside the hall the windows show the night. */

const GLSL = /* glsl */`
uniform float uTime;
varying vec2 vPane;
varying vec3 vWinW;
float wHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float sq(float x) { return x * x; }
vec3 windowColour(vec2 p, vec3 w) {
  vec3 cell = floor(vec3(w.x / 2., w.y / 3.12, w.z / 2.) + .5);
  float s = wHash(cell), s2 = wHash(cell + 7.1);
  float flick = .93 + .05 * sin(uTime * 6.1 + s * 40.) + .03 * sin(uTime * 13.7 + s * 17.);
  // the room: about the glass's old colour, brighter low and in the middle
  vec3 room = vec3(1., .42, .095) * (.68 + .3 * (1. - p.y)) * (.9 + .2 * exp(-sq((p.x - .5) / .3))) * flick;
  // someone walking past, in about half the windows: a soft dark figure crossing the gap
  float walk = fract(uTime / (9. + 6. * s2) + s);
  if (s2 > .45 && walk < .22) {
    float px = mix(-.25, 1.25, walk / .22);
    float body = exp(-sq((p.x - px) / .085)) * smoothstep(.05, .3, p.y) * (1. - smoothstep(.72, .86, p.y));
    float head = exp(-dot((p - vec2(px, .78)) / vec2(.07, .065), (p - vec2(px, .78)) / vec2(.07, .065)));
    room *= 1. - .55 * clamp(body + head, 0., 1.);
  }
  // curtains: the drape's inner edge, narrowest at the tie-back
  float tie = .4, open = .12 + .1 * s;
  float above = smoothstep(tie, 1., p.y), below = smoothstep(tie, 0., p.y);
  float edge = open + .2 * pow(above, .8) + .1 * below;
  float side = min(p.x, 1. - p.x);
  float cloth = smoothstep(edge + .015, edge - .015, side);
  float pelmet = step(.9 - .025 * abs(sin(p.x * 18.)), p.y);
  // folds, bunched at the tie-back: the stripes follow the drape's width
  float folds = .72 + .28 * sin(side / max(edge, .05) * 11. + s * 6.);
  vec3 dye = s < .5 ? vec3(.62, .1, .06) : s < .8 ? vec3(.7, .42, .1) : vec3(.22, .36, .14);
  vec3 through = room * dye * 1.5 * folds * (.75 + .25 * smoothstep(0., edge, edge - side));
  return mix(room, through, max(cloth, pelmet));
}`;

let glass: MeshBasicMaterial | null = null;
/** the shared glass material (lazily: it is built from the first window) */
export function windowGlass() {
  if (glass) return glass;
  glass = new MeshBasicMaterial({ side: FrontSide });
  glass.customProgramCacheKey = () => 'window';
  glass.onBeforeCompile = sh => {
    sh.uniforms.uTime = time;
    sh.vertexShader = 'attribute vec2 pane;\nvarying vec2 vPane;\nvarying vec3 vWinW;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPane = pane;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWinW = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = GLSL + '\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = windowColour(vPane, vWinW);');
  };
  return glass;
}

const done = new WeakSet<BufferGeometry>();
/** gives a glass geometry its 0…1 coordinates across the window (its plane is local xy) */
export function addPane(g: BufferGeometry) {
  if (done.has(g)) return;
  done.add(g);
  g.computeBoundingBox();
  const b = g.boundingBox!, pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
  const w = b.max.x - b.min.x || 1, h = b.max.y - b.min.y || 1;
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - b.min.x) / w;
    uv[i * 2 + 1] = (pos.getY(i) - b.min.y) / h;
  }
  g.setAttribute('pane', new Float32BufferAttribute(uv, 2));
}
