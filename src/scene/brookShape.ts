/* The brook's course: pure functions of (x, z), shared by the terrain (its channel and the
   valley it runs in), whatever is strewn along the walk (kept dry), the water and the bridge.
   It crosses the walk halfway, square-on to the path where the path meets the camera line
   (pathX(z) ≈ 0 at z −90.75, so the bridge sits on the track), and wanders off into the
   forest both ways. Metres; y 0 is the path's level. */

export const BROOK = {
  z: -90.75,           // where it crosses the walk
  water: -.3,          // its surface, below the path
  depth: .6,           // its bed, below the ground
  bank: 1.3            // how far the banks reach out from the channel's edge
};
export const STRAIGHT = 3;                         // m either side of the path the course runs straight (the bridge)

const smooth = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const wander = (x: number) => smooth(STRAIGHT, 12, Math.abs(x));

/** the course's centre line */
export function brookZ(x: number): number {
  return BROOK.z + (Math.sin(x * .085 + .6) * 1.7 + Math.sin(x * .23 + 1.3) * .35) * wander(x);
}
/** half the channel's width */
export function brookHalf(x: number): number {
  return .95 + (Math.sin(x * .13 + 1) * .22 + Math.sin(x * .41) * .12) * wander(x);
}
/** how far from the centre line the ground meets the water (the channel's profile is a
 *  smoothstep from half × 0.55 to half + bank: its midpoint is at the water's depth) */
export function waterEdge(x: number): number {
  const h = brookHalf(x);
  return (h * .55 + h + BROOK.bank) / 2;
}
/** how far below the ground the channel is cut at (x, z) */
export function brookCut(x: number, z: number): number {
  const h = brookHalf(x), d = Math.abs(z - brookZ(x));
  return BROOK.depth * (1 - smooth(h * .55, h + BROOK.bank, d));
}
/** 1 along the brook's valley, where the ground's undulation is flattened (water stays level), 0 well away */
export function brookValley(x: number, z: number): number {
  const reach = brookHalf(x) + BROOK.bank, d = Math.abs(z - brookZ(x));
  return 1 - smooth(reach + 1, reach + 7, d);
}
/** false within `margin` m of the water */
export function dry(x: number, z: number, margin: number): boolean {
  return Math.abs(z - brookZ(x)) > waterEdge(x) + margin;
}
/* The footbridge: a humpback over the channel, its deck a circular arc from bank top to bank
   top (a little past them), `rise` at the crown. The walk climbs it (walkRise). */
const half = brookHalf(0) + BROOK.bank + .45;
export const BRIDGE = { half, rise: .5, width: 2 };
const radius = (half * half + BRIDGE.rise * BRIDGE.rise) / (2 * BRIDGE.rise);
/** the deck's height at s m from the bridge's middle, along the path (0 off the bridge) */
export function deckY(s: number): number {
  return Math.abs(s) >= half ? 0 : Math.sqrt(radius * radius - s * s) - (radius - BRIDGE.rise);
}
/** the deck's slope there (dy/ds) */
export const deckSlope = (s: number) => Math.abs(s) >= half ? 0 : -s / Math.sqrt(radius * radius - s * s);
/* The eye over the bridge: the deck smoothed into a bell that starts a metre before it and
   ends a metre after (a smootherstep: level and straight at both ends). Following the deck
   itself the camera jumped: the arc meets the ground at 21°, so the climb and the tilt
   started within one frame; a cos² bell still kicked the tilt's speed at its ends. The bell
   stays within 3 cm of the deck. */
const WALK_HALF = half + 1;
/** how far the walk is lifted at z */
export function walkRise(z: number): number {
  const x = Math.min(1, Math.abs(z - BROOK.z) / WALK_HALF);
  return BRIDGE.rise * (1 - x * x * x * (x * (6 * x - 15) + 10));
}
/** its slope there (dy/dz) */
export function walkSlope(z: number): number {
  const s = z - BROOK.z, x = Math.min(1, Math.abs(s) / WALK_HALF);
  return -Math.sign(s) * BRIDGE.rise * 30 * x * x * (1 - x) ** 2 / WALK_HALF;
}

/** the z band the channel can reach anywhere (for the terrain's denser rows) */
export const BAND = { from: BROOK.z - 5.5, to: BROOK.z + 5.5 };

/** brookZ in GLSL (the terrain shader keeps the track off the banks), the same curve */
export const BROOK_GLSL = /* glsl */`
float brookSmooth(float a, float b, float v) { float t = clamp((v - a) / (b - a), 0., 1.); return t * t * (3. - 2. * t); }
float brookZ(float x) {
  float k = brookSmooth(${STRAIGHT.toFixed(1)}, 12., abs(x));
  return ${BROOK.z.toFixed(3)} + (sin(x * .085 + .6) * 1.7 + sin(x * .23 + 1.3) * .35) * k;
}
float brookHalf(float x) {
  float k = brookSmooth(${STRAIGHT.toFixed(1)}, 12., abs(x));
  return .95 + (sin(x * .13 + 1.) * .22 + sin(x * .41) * .12) * k;
}`;
