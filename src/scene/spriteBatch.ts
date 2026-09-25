import {
  type Blending, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, type Object3D, PlaneGeometry,
  ShaderMaterial, Sprite, type Texture, UniformsLib, UniformsUtils, Vector3
} from 'three';

/* Sprite instancing: every glow sprite (flames, candles, mist, chimney smoke) used to be
   its own draw call, ~50 of them. The sprites stay in the scene graph as proxies — the
   code that moves, flickers and hides them is unchanged — but they are no longer drawn
   (layer 31). One instanced quad per texture + blending + fog draws them all, reading
   each proxy's world position, scale, opacity and visibility every frame.
   Blending order inside a batch is fixed, which is invisible: the additive ones commute,
   and the normal-blended mist and smoke are one colour each. */

const HIDDEN_LAYER = 31;

const vertexShader = /* glsl */`
attribute vec3 iPos;
attribute vec2 iSize;
attribute float iOpacity;
varying vec2 vUv;
varying float vOpacity;
#include <fog_pars_vertex>
void main() {
  vUv = uv; vOpacity = iOpacity;
  vec4 mvPosition = viewMatrix * vec4(iPos, 1.0);
  mvPosition.xy += position.xy * iSize;          // screen-aligned, like THREE.Sprite
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

// the same output path as SpriteMaterial (white colour): tone mapping, colour space, fog
const fragmentShader = /* glsl */`
uniform sampler2D map;
varying vec2 vUv;
varying float vOpacity;
#include <fog_pars_fragment>
void main() {
  vec4 c = texture2D(map, vUv);
  gl_FragColor = vec4(c.rgb, c.a * vOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

class SpriteBatch {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  private pos: InstancedBufferAttribute; private size: InstancedBufferAttribute; private op: InstancedBufferAttribute;
  constructor(private proxies: Sprite[], map: Texture, blending: Blending, fog: boolean) {
    const n = proxies.length, quad = new PlaneGeometry(1, 1), g = new InstancedBufferGeometry();
    g.setIndex(quad.index); g.setAttribute('position', quad.getAttribute('position')); g.setAttribute('uv', quad.getAttribute('uv'));
    g.instanceCount = n;
    g.setAttribute('iPos', this.pos = new InstancedBufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('iSize', this.size = new InstancedBufferAttribute(new Float32Array(n * 2), 2));
    g.setAttribute('iOpacity', this.op = new InstancedBufferAttribute(new Float32Array(n), 1));
    const m = new ShaderMaterial({
      uniforms: UniformsUtils.merge([UniformsLib.fog, { map: { value: null } }]),
      vertexShader, fragmentShader, transparent: true, depthWrite: false, blending, fog
    });
    m.uniforms.map.value = map;
    this.mesh = new Mesh(g, m);
    this.mesh.frustumCulled = false;                 // instances are everywhere along the walk
    for (const p of proxies) p.layers.set(HIDDEN_LAYER);
  }
  update() {
    const w = new Vector3(), s = new Vector3();
    this.proxies.forEach((p, i) => {
      p.updateWorldMatrix(true, false);
      const e = p.matrixWorld.elements;
      w.set(e[12], e[13], e[14]);
      s.set(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), 0);
      const on = shown(p);
      this.pos.setXYZ(i, w.x, w.y, w.z);
      this.size.setXY(i, on ? s.x : 0, on ? s.y : 0);
      this.op.setX(i, p.material.opacity);
    });
    this.pos.needsUpdate = this.size.needsUpdate = this.op.needsUpdate = true;
  }
}

function shown(o: Object3D | null): boolean {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

const batches: SpriteBatch[] = [];

/** Collects the sprites under `root` into batches. Groups of fewer than `min` stay plain
 *  sprites (the moon disc and the carried flame: no fog, one each). */
export function batchSprites(root: Object3D, min = 3) {
  const groups = new Map<string, { sprites: Sprite[]; map: Texture; blending: Blending; fog: boolean }>();
  root.traverse(o => {
    if (!(o instanceof Sprite)) return;
    const sp = o as Sprite, m = sp.material;
    if (!m.map || m.rotation !== 0) return;
    const key = `${m.map.uuid}|${m.blending}|${m.fog}`;
    let g = groups.get(key);
    if (!g) groups.set(key, g = { sprites: [], map: m.map, blending: m.blending, fog: m.fog });
    g.sprites.push(sp);
  });
  for (const g of groups.values()) {
    if (g.sprites.length < min) continue;
    const b = new SpriteBatch(g.sprites, g.map, g.blending, g.fog);
    root.add(b.mesh); batches.push(b);
  }
  updateSpriteBatches();
  return batches.length;
}

export function updateSpriteBatches() {
  for (const b of batches) b.update();
}
