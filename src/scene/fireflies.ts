import { GATE_Z } from '../config';
import { Q } from '../quality';
import { rand, random, side } from '../random';
import { fireflyTex, type GlowSprite, sprite } from './sprites';
import { scene } from './stage';
import { pathX, surfaceY } from './terrain';

/* Fireflies: small warm points drifting over the undergrowth along the walk and around the
   tavern, each blinking on its own rhythm. They give the dark verges life and, with the
   glowing mushrooms, a trail of light towards the door. Their own texture, so one draw
   call (spriteBatch). The motion is a function of time only — no random per frame. */

interface Fly { sp: GlowSprite; x: number; y: number; z: number; a: number; b: number; c: number; ph: number; blink: number }
const flies: Fly[] = [];

export function buildFireflies(startZ: number) {
  const n = Math.round(80 * Q.forest);
  for (let i = 0; i < n; i++) {
    // a quarter of them in the tavern's yard, the rest along the walk, off the camera line
    const yard = random() < .25;
    const z = yard ? rand(GATE_Z - 6, GATE_Z + 8) : rand(GATE_Z + 8, startZ + 5);
    const x = yard ? side() * rand(3.5, 12) : pathX(z) + side() * rand(1.3, 8);
    const sp = sprite(fireflyTex, rand(.08, .13), 0);
    const f = { sp, x, y: surfaceY(x, z) + rand(.4, 2.1), z, a: rand(.6, 1.4), b: rand(.6, 1.4), c: rand(.6, 1.4), ph: rand(0, 6.28), blink: rand(.5, 1.3) };
    sp.position.set(f.x, f.y, f.z); scene.add(sp); flies.push(f);
  }
}

export function updateFireflies(t: number, inside: number) {
  for (const f of flies) {
    f.sp.position.set(
      f.x + Math.sin(t * .31 * f.a + f.ph) * .6,
      f.y + Math.sin(t * .53 * f.b + f.ph * 1.7) * .25,
      f.z + Math.cos(t * .27 * f.c + f.ph) * .6);
    const on = Math.max(0, Math.sin(t * f.blink + f.ph));
    f.sp.material.opacity = on * on * on * .95 * (1 - inside);
  }
}
