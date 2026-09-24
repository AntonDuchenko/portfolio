import { Color } from 'three';

// All numbers are from prototype/tavern-scene.html (see docs/scene-spec.md). Metres, seconds.
// The camera travels along −Z; `d` = metres inside the tavern past the facade.

export const GATE_Z = -132, DOOR_W = 3.6, DOOR_H = 4.6;
export const TAV_HW = 8, TAV_H = 5.6, TAV_LEN = 20, TAV_END = GATE_Z - TAV_LEN;
export const D = (d: number) => GATE_Z - d;

export const EYE = 1.62;

// post and poster
export const POST_Z = D(13), POST_W = 1.35;
export const SHEET_Y = 1.81, SHEET_H = 1.95, POSTER_Z = POST_Z + POST_W / 2 + .03;

// timeline
export const SPEED = 2.3, STOP_AT = GATE_Z + 6, T_HOLD = 1.3, T_OPEN = 3.6, MAX_ANGLE = 1.75;

export const FOG_OUT = new Color(0x0d1626), FOG_IN = new Color(0x1a1209);

// values driven by the tune panel; lights are in prototype (r128 legacy) units here
export const cfg = { moon: 1.5, fog: .028, hall: 1.3, fly: 4.2 };

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
