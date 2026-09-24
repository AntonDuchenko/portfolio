import { MathUtils, Vector3 } from 'three';
import { camera } from '../camera/camera';
import { easeInOut } from '../camera/easing';
import { DOOR_H, DOOR_W, GATE_Z, POSTER_Z, SHEET_H, SHEET_Y } from '../config';
import { el } from '../ui/dom';

/* The poster and the resume are DOM, not textures. A world-space rectangle (poster
   height at POSTER_Z) is projected every frame and the pane gets translate + scale
   to match it. The resume is a separate fixed layer (hard rule 5). */

/** camera distance at which the sheet exactly fills the screen height */
export const fitDist = () => SHEET_H / (2 * Math.tan(MathUtils.degToRad(camera.fov) / 2));
// The sheet is portrait: to cover a wide frame its height must exceed the screen height
// 1.9·(width/height) times. That is where the flight goes.
export const coverSc = () => Math.max(1.9 * (innerWidth / innerHeight), 1.06);
export const endSc = () => coverSc() * 1.42;

const v3 = new Vector3();
const toScreen = (x: number, y: number, z: number) => {
  v3.set(x, y, z).project(camera);
  return { x: (v3.x * .5 + .5) * innerWidth, y: (-v3.y * .5 + .5) * innerHeight };
};

/** Fits the pane to the projected sheet; returns the screen-height fraction it covers. */
export function layoutPane() {
  const top = toScreen(0, SHEET_Y + SHEET_H / 2, POSTER_Z);
  const bot = toScreen(0, SHEET_Y - SHEET_H / 2, POSTER_Z);
  const h = Math.abs(bot.y - top.y), cx = (top.x + bot.x) / 2, cy = (top.y + bot.y) / 2;
  const sc = h / innerHeight;
  el.pane.style.transform =
    `translate(${(cx - innerWidth / 2).toFixed(1)}px, ${(cy - innerHeight / 2).toFixed(1)}px) scale(${sc.toFixed(4)})`;
  return sc;
}

/* The mask is what is actually visible between the leaves. The doors open inward, so the
   free edge moves DEEPER: a gap computed in the door plane lets the poster bleed over the
   leaves (hard rule 4). Project the real free-edge coordinates instead. */
export function maskDoor(angle: number) {
  const half = DOOR_W / 2;
  const ez = GATE_Z - half * Math.sin(angle);          // free edge, moved inward
  const L = toScreen(-half * (1 - Math.cos(angle)), SHEET_Y, ez);
  const R = toScreen(half * (1 - Math.cos(angle)), SHEET_Y, ez);
  const T = toScreen(0, DOOR_H - .3, GATE_Z);
  const B = toScreen(0, .36, GATE_Z);
  const l = Math.min(L.x, R.x), r = Math.max(L.x, R.x);
  const tp = Math.min(T.y, B.y), bt = Math.max(T.y, B.y);
  if (r - l <= 1 || bt - tp <= 1) { el.portal.style.clipPath = 'polygon(0 0,0 0,0 0,0 0)'; return; }
  if (l <= 0 && r >= innerWidth && tp <= 0 && bt >= innerHeight) { el.portal.style.clipPath = 'none'; return; }
  el.portal.style.clipPath =
    `polygon(${l.toFixed(1)}px ${tp.toFixed(1)}px, ${r.toFixed(1)}px ${tp.toFixed(1)}px, ` +
    `${r.toFixed(1)}px ${bt.toFixed(1)}px, ${l.toFixed(1)}px ${bt.toFixed(1)}px)`;
}

/** The resume only starts to show once the parchment covers the whole frame and keeps
 *  fading until the end of the flight, so it never reads as a picture swap. */
export function crossfade(sc: number) {
  const c = coverSc();
  const x = easeInOut(Math.min(1, Math.max(0, (sc - c) / (endSc() - c))));
  el.site.style.opacity = x.toFixed(3);
  return sc >= c;                                    // covered
}
