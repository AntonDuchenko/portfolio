import { cfg, EYE, MAX_ANGLE, POSTER_Z, reduceMotion, SHEET_Y, SPEED, STOP_AT, T_HOLD, T_OPEN } from '../config';
import { endSc, fitDist } from '../portal/portal';
import { state } from '../state';
import { camera } from './camera';
import { ease, easeOut, flyEase } from './easing';

/* walk → hold → open → fly → done. See docs/scene-spec.md, "Camera timeline".
   Pure camera and phase logic: what the phases *do* to the page, the sound and the door
   is the caller's business (hooks), so this module knows nothing of DOM or audio. */

export interface TimelineHooks {
  /** each walk frame, with the seconds walked so far (the narration clock) */
  walk(t: number): void;
  /** the door starts to open */
  open(): void;
  /** the camera leaves the threshold */
  fly(): void;
  /** the flight is over: the page takes over */
  land(): void;
}

export interface Pose { camZ: number; pitch: number; bob: number }

/** Advances the phase machine. Returns the camera pose, or null once the flight has landed. */
export function advance(dt: number, on: TimelineHooks): Pose | null {
  const s = state;
  let camZ: number, pitch = 0, bob = 1; s.camY = EYE;

  // The walk is as long as the narration: startZ = STOP_AT + SPEED · narration time.
  if (s.phase === 'walk') {
    s.walked += SPEED * dt;
    on.walk(s.walked / SPEED);
    if (s.walked >= s.walkLen) { s.walked = s.walkLen; s.phase = 'hold'; s.pt = 0; }
    camZ = s.startZ - s.walked;
  } else camZ = STOP_AT;

  if (s.phase === 'hold') {
    s.pt += dt; bob = Math.max(0, 1 - s.pt / .6); pitch = ease(Math.min(1, s.pt / T_HOLD)) * .04;
    if (s.pt >= T_HOLD) { s.phase = 'open'; s.pt = 0; on.open(); }
  }
  if (s.phase === 'open') {
    s.pt += dt; bob = 0; pitch = .04;
    const k = ease(Math.min(1, s.pt / T_OPEN));
    s.doorAngle = k * MAX_ANGLE;
    s.inside = Math.min(1, k * .45);
    if (s.pt >= T_OPEN * .55) { s.phase = 'fly'; s.pt = 0; s.flyFrom = camZ; on.fly(); }
  }
  if (s.phase === 'fly') {
    s.pt += dt; bob = 0;
    const k = Math.min(1, s.pt / cfg.fly), e = flyEase(k);
    s.doorAngle = Math.min(MAX_ANGLE, s.doorAngle + dt * .6);
    const target = POSTER_Z + fitDist() / endSc();
    camZ = s.flyFrom + (target - s.flyFrom) * e;
    s.camY = EYE + (SHEET_Y - EYE) * e;
    pitch = .04 * (1 - easeOut(k));
    s.inside = Math.min(1, .45 + e * .75);
    if (k >= 1) { on.land(); return null; }
  }
  return { camZ, pitch, bob };
}

/** A footstep is due on every half-period of the gait — the same phase that bobs the camera. */
export function stepDue() {
  if (state.phase !== 'walk') return false;
  const sp = Math.floor(state.walked * 1.9 / Math.PI);
  if (sp <= state.lastStep) return false;
  state.lastStep = sp; return true;
}

/** Head bob: vertical at 2× stride frequency, lateral at 1×. */
export function placeCamera({ camZ, pitch, bob }: Pose) {
  const stride = state.walked * 1.9, rm = reduceMotion ? .25 : 1, t = state.t;
  camera.position.set(Math.sin(stride) * .085 * bob * rm, state.camY + Math.sin(stride * 2) * .052 * bob * rm, camZ);
  camera.rotation.set(
    pitch + Math.sin(stride * 2 + 1) * .004 * bob,
    Math.sin(t * .31) * .02 * bob + Math.sin(stride) * .006 * bob,
    Math.sin(stride) * .007 * bob
  );
  camera.updateMatrixWorld();
}
