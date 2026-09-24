import {
  AnimationMixer, Box3, type Bone, DirectionalLight, HemisphereLight, type Object3D,
  PerspectiveCamera, Scene, Vector3, WebGLRenderer
} from 'three';
import { loadGLTF } from '../loaders/gltf';

/* The innkeeper in the narrator's portrait: a rigged character from the Ultimate Animated
   Character Pack (Quaternius, CC0), packed by scripts/assets/build.mjs as narrator.glb.
   The pack has no facial rig, so speech is body language driven by the voice level:
   head nods, torso sway and a right-hand gesture, layered on top of the Idle clip after
   each mixer update. The head also turns towards the pointer. */

export interface Avatar { talk(level: number): void; idle(): void; greet(): void }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export async function mountAvatar(slot: HTMLElement): Promise<Avatar> {
  const gltf = await loadGLTF(`${import.meta.env.BASE_URL}models/narrator.glb`);
  const model = gltf.scene;
  const bone = (n: string) => model.getObjectByName(n) as Bone | undefined;
  const head = bone('Head'), neck = bone('Neck'), torso = bone('Torso'), armR = bone('UpperArm.R'), foreR = bone('LowerArm.R');

  const scene = new Scene();
  scene.add(model);
  scene.add(new HemisphereLight(0xffe2b8, 0x2a1a0c, 1.6));
  const key = new DirectionalLight(0xffc27a, 2.4); key.position.set(-2, 3, 4); scene.add(key);
  const rim = new DirectionalLight(0x8aa4e0, 1.6); rim.position.set(3, 2, -3); scene.add(rim);

  // frame head and shoulders. Measured in the Idle pose (not the bind pose, which stands
  // differently): the head bone sits at the head's base, the chibi head is ~0.9 tall above
  // it. The pack faces +Z. The camera is placed from the head bone, not the bounding box.
  const idleClip = gltf.animations.find(a => a.name === 'Idle');
  if (idleClip) { const m = new AnimationMixer(model); m.clipAction(idleClip).play(); m.update(1); }
  model.updateMatrixWorld(true);
  const target = head ? head.getWorldPosition(new Vector3()) : new Box3().setFromObject(model).getCenter(new Vector3());
  target.y += .38;                                   // between the eyes and the shoulders
  const camera = new PerspectiveCamera(24, 1, .1, 100);
  camera.position.set(target.x + .9, target.y + .15, target.z + 4.6);
  camera.lookAt(target);

  const canvas = document.createElement('canvas');
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const size = () => { const r = slot.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); };
  slot.replaceChildren(canvas);
  size(); addEventListener('resize', size);

  const mixer = new AnimationMixer(model);
  const clip = (n: string) => gltf.animations.find(a => a.name === n);
  if (clip('Idle')) mixer.clipAction(clip('Idle')!).play();

  // pointer → where the head looks (−1…1 relative to the portrait)
  let lookX = 0, lookY = 0;
  addEventListener('pointermove', e => {
    const r = slot.getBoundingClientRect();
    lookX = clamp((e.clientX - (r.left + r.width / 2)) / (innerWidth / 2), -1, 1);
    lookY = clamp((e.clientY - (r.top + r.height / 2)) / (innerHeight / 2), -1, 1);
  }, { passive: true });

  // greeting: a nod with a tilt, procedural — the pack's Victory clip throws an arm across
  // the face and jumps out of a portrait this tight
  let level = 0, smooth = 0, t = 0, last = performance.now(), running = true, greetT = -1;
  // Offsets are layered on the Idle pose. The mixer only rewrites bones whose tracks change,
  // so last frame's offsets are taken off before it runs — otherwise they pile up frame
  // after frame on bones Idle leaves alone (the head drifted off the portrait).
  const applied = new Map<Object3D, [number, number, number]>();
  const sway = (o: Object3D | undefined, x: number, y: number, z: number) => {
    if (!o) return;
    o.rotation.x += x; o.rotation.y += y; o.rotation.z += z;
    const a = applied.get(o) ?? [0, 0, 0];
    applied.set(o, [a[0] + x, a[1] + y, a[2] + z]);
  };
  const unsway = () => {
    for (const [o, [x, y, z]] of applied) { o.rotation.x -= x; o.rotation.y -= y; o.rotation.z -= z; }
    applied.clear();
  };
  const loop = () => {
    if (!running) return;
    requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
    unsway();
    mixer.update(dt);
    smooth += (level - smooth) * Math.min(1, dt * 12);
    const talk = smooth;
    // speech: nods on syllables, a slow sway, the right hand weighing its words
    sway(head, -talk * .22 * (.6 + .4 * Math.sin(t * 11)), 0, talk * .06 * Math.sin(t * 3.1));
    sway(torso, 0, talk * .12 * Math.sin(t * 1.7), talk * .04 * Math.sin(t * 2.3));
    sway(armR, -talk * .5, 0, -talk * .35);
    sway(foreR, -talk * .6 * (.7 + .3 * Math.sin(t * 5)), 0, 0);
    if (greetT >= 0) {
      greetT += dt;
      const k = Math.min(1, greetT / 1.1), w = Math.sin(k * Math.PI);
      sway(head, w * .32, 0, w * .18);
      if (k >= 1) greetT = -1;
    }
    // look at the pointer (neck carries most of it)
    sway(neck, lookY * .18, lookX * .45, 0);
    renderer.render(scene, camera);
  };
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { last = performance.now(); loop(); }
  });
  loop();

  return {
    talk(l) { level = l; },
    idle() { level = 0; },
    greet() { greetT = 0; }
  };
}
