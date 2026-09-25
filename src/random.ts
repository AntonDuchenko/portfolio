/* Scene randomness from its own generators, seeded once per visit; `?seed=<n>` pins them
   (tests, screenshots). Not Math.random: three.js draws from it for every object's uuid,
   so the layout would shift whenever the code creates a different number of objects.

   Two streams, so per-frame noise cannot disturb the layout:
   - random / rand / side — placement: trees (also re-placed ahead during the walk), path,
     props, fire phases.
   - jitter — per-frame variation: flicker, footstep and creak choice, owls. Its draws
     depend on how many frames run, which differs between devices. */

function mulberry32(a: number) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const pinned = new URLSearchParams(location.search).get('seed');
const seed = pinned !== null ? Number(pinned) : Math.floor(Math.random() * 2 ** 32);
export const random = mulberry32(seed);
export const jitter = mulberry32(seed ^ 0x9e3779b9);
export const rand = (a: number, b: number) => a + random() * (b - a);
export const side = () => random() < .5 ? -1 : 1;
