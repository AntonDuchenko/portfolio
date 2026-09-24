import { sfxDoor, sfxStep, sfxWhoosh } from '../audio/audio';
import { cfg, EYE, MAX_ANGLE, POSTER_Z, reduceMotion, SHEET_Y, SPEED, STOP_AT, T_HOLD, T_OPEN } from '../config';
import { fitDist, endSc } from '../portal/portal';
import { torch } from '../scene/lights';
import { setDoor } from '../scene/tavern';
import { state } from '../state';
import { el } from '../ui/dom';
import { setLine, updateLines } from '../ui/voice';
import { camera } from './camera';
import { ease, easeOut, flyEase } from './easing';

/* walk → hold → open → fly → done. See docs/scene-spec.md, "Camera timeline". */

/** Advances the phase machine. Returns the camera z, or null when the flight has landed. */
export function advance(dt: number, land: () => void): { camZ: number; pitch: number; bob: number } | null {
  const s = state;
  let camZ: number, pitch = 0, bob = 1; s.camY = EYE;

  // The walk is as long as the narration: startZ = STOP_AT + SPEED · narration time.
  if (s.phase === 'walk') {
    s.walked += SPEED * dt;
    updateLines(s.walked / SPEED);
    if (s.walked >= s.walkLen) { s.walked = s.walkLen; s.phase = 'hold'; s.pt = 0; }
    camZ = s.startZ - s.walked;
  } else camZ = STOP_AT;

  if (s.phase === 'hold') {
    s.pt += dt; bob = Math.max(0, 1 - s.pt / .6); pitch = ease(Math.min(1, s.pt / T_HOLD)) * .04;
    if (s.pt >= T_HOLD) { s.phase = 'open'; s.pt = 0; setLine(null); el.portal.classList.add('on'); sfxDoor(); }
  }
  if (s.phase === 'open') {
    s.pt += dt; bob = 0; pitch = .04;
    const k = ease(Math.min(1, s.pt / T_OPEN));
    s.doorAngle = k * MAX_ANGLE;
    setDoor(s.doorAngle);
    s.inside = Math.min(1, k * .45);
    if (s.pt >= T_OPEN * .55) { s.phase = 'fly'; s.pt = 0; s.flyFrom = camZ; s.torchLeft = torch.position.clone(); sfxWhoosh(); }
  }
  if (s.phase === 'fly') {
    s.pt += dt; bob = 0;
    const k = Math.min(1, s.pt / cfg.fly), e = flyEase(k);
    s.doorAngle = Math.min(MAX_ANGLE, s.doorAngle + dt * .6);
    setDoor(s.doorAngle);
    const target = POSTER_Z + fitDist() / endSc();
    camZ = s.flyFrom + (target - s.flyFrom) * e;
    s.camY = EYE + (SHEET_Y - EYE) * e;
    pitch = .04 * (1 - easeOut(k));
    s.inside = Math.min(1, .45 + e * .75);
    if (k >= 1) { el.site.style.opacity = '1'; land(); return null; }
  }
  return { camZ, pitch, bob };
}

/** Footsteps on every half-period of the gait — the same phase that bobs the camera. */
export function footsteps() {
  if (state.phase !== 'walk') return;
  const sp = Math.floor(state.walked * 1.9 / Math.PI);
  if (sp > state.lastStep) { state.lastStep = sp; sfxStep(); }
}

/** Head bob: vertical at 2× stride frequency, lateral at 1×. */
export function placeCamera(camZ: number, pitch: number, bob: number) {
  const stride = state.walked * 1.9, rm = reduceMotion ? .25 : 1, t = state.t;
  camera.position.set(Math.sin(stride) * .085 * bob * rm, state.camY + Math.sin(stride * 2) * .052 * bob * rm, camZ);
  camera.rotation.set(
    pitch + Math.sin(stride * 2 + 1) * .004 * bob,
    Math.sin(t * .31) * .02 * bob + Math.sin(stride) * .006 * bob,
    Math.sin(stride) * .007 * bob
  );
  camera.updateMatrixWorld();
}
