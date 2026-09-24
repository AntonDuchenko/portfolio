import './styles.css';
import * as THREE from 'three';
import { Color, Vector3 } from 'three';
import { loadAudio, resetAudio, resumeAndStart, sfxPaperOnce, updateAudio, voiceName } from './audio/audio';
import { camera } from './camera/camera';
import { advance, footsteps, placeCamera } from './camera/timeline';
import * as C from './config';
import { cfg, EYE, FOG_IN, FOG_OUT, GATE_Z, SPEED, STOP_AT, T_HOLD } from './config';
import { crossfade, layoutPane, maskDoor } from './portal/portal';
import { loadKits } from './scene/assets';
import { buildForest, updateForest, updateMists } from './scene/forest';
import { addGlobalLights, flame, moonDisc, setMoon, torch, updateFires, warmAmb, LEGACY } from './scene/lights';
import { buildPost, noticeGlow } from './scene/post';
import { fog, renderer, scene } from './scene/stage';
import { buildFacade, buildHall, setDoor, updateSmoke } from './scene/tavern';
import { buildTerrain } from './scene/terrain';
import { state } from './state';
import { el } from './ui/dom';
import { initTune, tuneEnabled } from './ui/tune';
import { buildSchedule, LINES, resetLines, setLine } from './ui/voice';

/* ── build: procedural parts now, kit models once they are loaded ── */
el.scene.appendChild(renderer.domElement);
addGlobalLights();
buildTerrain();
initTune();
setMoon(1);

/* ── landing, skip, replay ───────────────────────────────────────── */
const chrome = [el.scene, el.vignette, el.skip, ...(tuneEnabled ? [el.tune] : [])];

function land() {
  state.phase = 'done';
  document.body.classList.add('landed'); el.portal.style.clipPath = 'none';
  chrome.forEach(e => e.classList.add('hidden'));
  setLine(null); document.body.classList.remove('scene-locked');
  el.again.classList.add('on'); scrollTo(0, 0);
}
el.skip.addEventListener('click', () => {
  if (state.phase === 'walk') { state.walked = state.walkLen; state.phase = 'hold'; state.pt = T_HOLD - .35; resetLines(); setLine(null); }
  else if (state.phase !== 'done') land();
});
el.again.addEventListener('click', () => {
  document.body.classList.remove('landed'); el.portal.classList.remove('on');
  el.again.classList.remove('on');
  chrome.forEach(e => e.classList.remove('hidden'));
  document.body.classList.add('scene-locked');
  Object.assign(state, { phase: 'walk', walked: 0, pt: 0, torchLeft: null, doorAngle: 0, inside: 0, lastStep: -1 });
  resetLines();
  resetAudio();
  noticeGlow.intensity = 0; el.poster.style.opacity = '1'; el.site.style.opacity = '0';
  setDoor(0); scrollTo(0, 0);
});

/* ── loop ────────────────────────────────────────────────────────── */
const hand = new Vector3(), fogC = new Color();
let last = 0;

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, .05); last = now; state.t += dt;
  if (state.phase === 'done') return;

  const pose = advance(dt, land);
  if (!pose) return;
  const { camZ, pitch, bob } = pose;
  const { inside, t } = state;

  // fog and background shift from night blue to the warm interior
  fog.density = cfg.fog * (1 - inside) + .005 * inside;
  fogC.copy(FOG_OUT).lerp(FOG_IN, inside);
  fog.color.copy(fogC); renderer.setClearColor(fogC, 1);
  setMoon(1 - inside * .85);

  footsteps();
  updateAudio(dt, camZ);
  placeCamera(camZ, pitch, bob);

  if (state.phase === 'open' || state.phase === 'fly') {
    const sc = layoutPane();
    if (crossfade(sc)) sfxPaperOnce();   // entered the paper
    if (camZ > GATE_Z + .3) maskDoor(state.doorAngle);
    else el.portal.style.clipPath = 'none';
  }

  const flick = .86 + .09 * Math.sin(t * 14.3) + .06 * Math.sin(t * 6.1) + .05 * Math.sin(t * 23.7) + .04 * Math.random();
  if (state.torchLeft) { torch.position.copy(state.torchLeft); flame.position.copy(state.torchLeft); }
  else {
    // carried at camera-space (−0.34, +0.34, −1.15); on `fly` it stays at the threshold
    hand.set(-.34, .34, -1.15).applyQuaternion(camera.quaternion).add(camera.position);
    torch.position.set(hand.x + Math.sin(t * 8.3) * .02, hand.y + Math.sin(t * 11.7) * .018, hand.z);
    flame.position.copy(torch.position);
  }
  torch.setLegacy(2.8 * flick * (1 - inside * .7));
  flame.material.opacity = (.45 + .28 * flick) * (1 - inside * .6);
  flame.scale.set(.76 * flick, .98 * flick, 1);

  updateFires(t, inside);
  noticeGlow.setLegacy(inside * cfg.hall * 2.2);
  warmAmb.intensity = inside * cfg.hall * .5 * LEGACY;

  moonDisc.position.set(camera.position.x - 52, 70, camZ - 170);
  updateMists(dt, t, camZ, inside);
  updateSmoke(dt);
  updateForest(camZ);

  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (state.phase === 'open' || state.phase === 'fly') { camera.updateMatrixWorld(); layoutPane(); }
});

Promise.all([loadKits(), loadAudio()]).then(([, bufs]) => {
  // timeline inversion: the narration's length sets the walk's length
  const walkTime = buildSchedule(LINES.map((_, i) => bufs?.[voiceName(i)]?.duration ?? null));
  state.walkLen = SPEED * walkTime;
  state.startZ = STOP_AT + state.walkLen;
  buildForest(state.startZ);
  buildFacade();
  buildPost(buildHall());
  // dev hook for the numeric checks (hard rules 1–4), stripped from production builds
  if (import.meta.env.DEV) Object.assign(window, { __tavern: { THREE, scene, camera, renderer, state, setDoor, C } });
  // draw the first frame right away — it shows through the entry gate
  camera.position.set(0, EYE, state.startZ); camera.updateMatrixWorld();
  renderer.render(scene, camera);
  return bufs;
}).then(bufs => {
  el.enter.disabled = false;
  el.enter.textContent = bufs ? 'Enter' : 'Enter without sound';
  el.enter.addEventListener('click', () => {
    resumeAndStart(bufs);
    el.gate.classList.add('off');
    setTimeout(() => el.gate.classList.add('hidden'), 950);
    last = performance.now();
    frame();
  }, { once: true });
});
