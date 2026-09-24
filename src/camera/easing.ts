export const ease = (x: number) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeInOut = (x: number) => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

// Fly: short ramp, fast pass through the hall, long deceleration at the sheet.
// Half the distance in the first quarter of the time; the last centimetres, where
// the resume fades in, take roughly the last quarter.
const RAMP = .2, DECEL = 3.2;
export const flyEase = (x: number) => {
  const s = x < RAMP ? (x * x) / (2 * RAMP) : x - RAMP / 2;
  return 1 - Math.pow(1 - Math.min(1, s / (1 - RAMP / 2)), DECEL);
};
