import type { Group } from 'three';
import { POST_W, POST_Z, POSTER_Z, SHEET_Y, TAV_H } from '../config';
import { rand } from '../random';
import { fires, RescaledPointLight } from './lights';
import { box, M } from './materials';
import { fireTex, sprite } from './sprites';
import { scene } from './stage';

/** light that warms the poster as we enter; intensity driven by the frame loop */
export const noticeGlow = new RescaledPointLight(0xffc98a, 8);

/** The post with the WANTED poster. The poster itself is DOM (see portal/). */
export function buildPost(tav: Group) {
  tav.add(box(POST_W, TAV_H, POST_W, M.beam, 0, TAV_H / 2, POST_Z));
  tav.add(box(POST_W + .5, .34, POST_W + .5, M.beam, 0, TAV_H - .5, POST_Z));   // capital
  tav.add(box(POST_W + .4, .3, POST_W + .4, M.beam, 0, .45, POST_Z));         // base
  for (const s of [-1, 1]) {                                                  // braces to the beams
    const b = box(.24, 1.5, .24, M.beam, s * .85, TAV_H - 1.1, POST_Z); b.rotation.z = s * .7; tav.add(b);
  }
  // other notices pinned to the sides of the post
  for (const [sx, sz, y, w, h, rot] of [[-1, 0, 3.3, .55, .7, Math.PI / 2], [-1, 0, 1.4, .5, .62, Math.PI / 2],
    [1, 0, 2.9, .6, .75, Math.PI / 2], [0, -1, 2.4, .62, .8, 0]]) {
    const p = box(w, h, .03, M.paper, sx * (POST_W / 2 + .02), y, POST_Z + sz * (POST_W / 2 + .02));
    p.rotation.y = rot; tav.add(p);
  }
  // two lanterns lighting the poster; bracket → gusset → link → body all touch (hard rule 3)
  for (const s of [-1, 1]) {
    const x = s * 1.2, y = 2.95, z = POST_Z + .75;
    tav.add(box(1.1, .09, .09, M.iron, s * .94, y + .3, z));            // bracket from the post
    tav.add(box(.09, .5, .09, M.iron, s * (POST_W / 2 - .04), y + .55, z));  // gusset at the post
    tav.add(box(.05, .2, .05, M.iron, x, y + .25, z));                 // link
    tav.add(box(.36, .42, .36, M.iron, x, y, z));
    const l = new RescaledPointLight(0xffb066, 12); l.position.set(x, y, z); tav.add(l);
    const sp = sprite(fireTex, .7, .85); sp.position.set(x, y, z); tav.add(sp);
    fires.push({ light: l, sp, phase: rand(0, 10), power: 1.6 });
  }
  noticeGlow.position.set(0, SHEET_Y, POSTER_Z + 1.2); scene.add(noticeGlow);
}
