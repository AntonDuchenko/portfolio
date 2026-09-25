/* Scene randomness — forest layout, prop angles, flicker phases, sound variation — from
   its own generator, seeded once per visit. `?seed=<n>` pins it (tests, screenshots).
   Not Math.random: three.js draws from it for every object's uuid, so the layout would
   shift whenever the code creates a different number of objects before the forest. */

function mulberry32(a: number) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const pinned = new URLSearchParams(location.search).get('seed');
export const random = mulberry32(pinned !== null ? Number(pinned) : Math.floor(Math.random() * 2 ** 32));
export const rand = (a: number, b: number) => a + random() * (b - a);
export const side = () => random() < .5 ? -1 : 1;
