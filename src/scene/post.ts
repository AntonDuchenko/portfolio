import type { Group } from 'three';
import { FLOOR_Y, POST_W, POST_Z, POSTER_Z, SHEET_Y } from '../config';
import { kitBox } from './kitbox';
import { RescaledPointLight } from './lights';
import { box, M } from './materials';
import { scene } from './stage';
import { lantern } from './tavern';

/** light that warms the poster as we enter; intensity driven by the frame loop */
export const noticeGlow = new RescaledPointLight(0xffc98a, 8);

/** The notice post with the WANTED poster. The poster itself is DOM (see portal/).
 *  It stands on the floor and carries the tie beam at d = 10. */
export function buildPost({ tav, beamBottom }: { tav: Group; beamBottom: number }) {
  const dark = { mat: 'MI_WoodTrim', strip: 'dark' } as const;
  const h = beamBottom - FLOOR_Y;
  tav.add(kitBox(POST_W, h, POST_W, dark, 0, FLOOR_Y + h / 2, POST_Z));
  tav.add(kitBox(POST_W + .2, .25, POST_W + .2, dark, 0, FLOOR_Y + .125, POST_Z));           // base
  tav.add(kitBox(POST_W + .2, .2, POST_W + .2, dark, 0, beamBottom - .08, POST_Z));          // capital, 2 cm into the beam
  // other notices pinned to the sides and back: back face 5 mm off the post
  const off = POST_W / 2 + .02;
  for (const [sx, sz, y, w, h2, rot] of [[-1, 0, 3.1, .36, .46, Math.PI / 2], [-1, 0, 1.5, .32, .4, Math.PI / 2],
    [1, 0, 1.2, .38, .5, Math.PI / 2], [0, -1, 2.4, .4, .52, 0]]) {
    const p = box(w, h2, .03, M.paper, sx * off, y, POST_Z + sz * off);
    p.rotation.y = rot; tav.add(p);
  }
  // lanterns on both side faces, pointing sideways; back plate 3 cm into the post
  for (const s of [-1, 1])
    lantern(tav, s * (POST_W / 2 + .02), 2.56, POST_Z, s * Math.PI / 2, { color: 0xffb066, range: 12, power: 1.6 });
  noticeGlow.position.set(0, SHEET_Y, POSTER_Z + 1.2); scene.add(noticeGlow);
}
