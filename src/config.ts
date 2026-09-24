import { Color } from 'three';

// All numbers are from docs/prototype/tavern-scene.html (see docs/scene-spec.md). Metres, seconds.
// The camera travels along −Z; `d` = metres inside the tavern past the facade.

// The building follows the Medieval Village kit grid (1:1): wall modules 2 m wide,
// 3.12 m per storey, wall solid from z = 0 (outside face) to −0.2 (inside face).
// Hall: 3 modules wide, two storeys open to the roof, 7 modules deep (one 6x14 roof).
export const GATE_Z = -132;
export const DOOR_W = 1.79, DOOR_H = 2.4;          // clear opening between the door posts
export const DOOR_HINGE_Z = -.1;                    // hinge line, relative to GATE_Z (mid-wall)
export const MOD = 2, STOREY = 3.12;
export const TAV_HW = 3, TAV_H = 2 * STOREY, TAV_LEN = 14, TAV_END = GATE_Z - TAV_LEN;
export const WALL_IN = .2;                          // inside face offset from the module line
export const FLOOR_Y = .06;                         // hall floor top, flush with the sill
export const D = (d: number) => GATE_Z - d;

export const EYE = 1.62;

// post and poster
export const POST_Z = D(10), POST_W = 1.1;          // on the tie-beam line at d = 10
export const SHEET_Y = 1.81, SHEET_H = 1.95, POSTER_Z = POST_Z + POST_W / 2 + .03;

// timeline
export const SPEED = 2.3, STOP_AT = GATE_Z + 6, T_HOLD = 1.3, T_OPEN = 3.6, MAX_ANGLE = 1.75;

export const FOG_OUT = new Color(0x0d1626), FOG_IN = new Color(0x1a1209);

// values driven by the tune panel; lights are in prototype (r128 legacy) units here
export const cfg = { moon: 1.5, fog: .028, hall: 1.3, fly: 4.2 };

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
