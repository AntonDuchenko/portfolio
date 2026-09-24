import { AmbientLight, Color, DirectionalLight, HemisphereLight, LinearSRGBColorSpace, PointLight } from 'three';
import { cfg } from '../config';
import { fireTex, type GlowSprite, sprite } from './sprites';
import { scene } from './stage';

/* ── light units ─────────────────────────────────────────────────────
   Intensities in this codebase are written in the prototype's r128 "legacy" units and
   converted here (three ≥ 0.155 has physical units only):

   - ambient / hemisphere / directional: legacy multiplied by π in the shader → ×π, exact.
   - point: legacy irradiance was π·I·(1 − d/R)², nearly flat; physical is I/d²·window.
     With the textured kit assets the flat legacy falloff lit whole walls evenly and read
     as daylight, so point lights are physical (decay 2) and match the prototype at a
     reference distance dRef: brightness at dRef is the approved one, falloff is real.
   - colours: the prototype used hex values as linear numbers (no colour management).
     Light colours keep those linear values (legacyColor) so the light energy matches;
     surfaces use the kits' sRGB textures.
   ──────────────────────────────────────────────────────────────────── */
export const LEGACY = Math.PI;

export const legacyColor = (hex: number) =>
  new Color().setRGB((hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255, LinearSRGBColorSpace);

export class RescaledPointLight extends PointLight {
  readonly k: number;
  constructor(hex: number, range: number, dRef = 1.5) {
    super(legacyColor(hex), 0, range, 2);
    const q = dRef / range;
    this.k = Math.PI * dRef * dRef * (1 - q) ** 2 / (1 - q ** 4) ** 2;
  }
  /** intensity in prototype (r128 legacy) units */
  setLegacy(v: number) { this.intensity = v * this.k * LOOK.points; }
}

/** global look knobs, tuned against the prototype frames */
export const LOOK = { points: 1, ambient: 1 };

/* ── global lights ───────────────────────────────────────────────── */
export const moon = new DirectionalLight(legacyColor(0x8aa4e0), 1.5 * LEGACY); moon.position.set(-6, 14, 5);
export const sky = new HemisphereLight(legacyColor(0x33477a), legacyColor(0x0b0d10), .55 * LEGACY);
export const ambient = new AmbientLight(legacyColor(0x18233d), .5 * LEGACY);
export const warmAmb = new AmbientLight(legacyColor(0x4a2e18), 0);          // inside the tavern
export const torch = new RescaledPointLight(0xff8c33, 24, 2); torch.setLegacy(2.8);

export const flame = sprite(fireTex, .78, .8, false);
export const moonDisc = sprite(fireTex, 24, .55, false);
moonDisc.material.color.set(0xc3d4ff);

export function addGlobalLights() {
  scene.add(moon, sky, ambient, warmAmb, torch, flame, moonDisc);
}

/** moon slider and the `inside` fade both go through here */
export function setMoon(k: number) {
  moon.intensity = cfg.moon * k * LEGACY;
  sky.intensity = .37 * cfg.moon * k * LEGACY;
}

/* ── everything that flickers ────────────────────────────────────── */
export interface Fire {
  light: RescaledPointLight | null;
  sp: GlowSprite;
  phase: number;
  power?: number;
  outside?: boolean;
}
export const fires: Fire[] = [];

// tavern fires come up as we enter, street lanterns stay as they are
export function updateFires(t: number, inside: number) {
  for (const f of fires) {
    const f2 = .82 + .11 * Math.sin(t * 9.3 + f.phase) + .07 * Math.sin(t * 16.7 + f.phase) + .03 * Math.random();
    const gain = f.outside ? 1 : (cfg.hall * Math.max(inside, .12));
    if (f.light) f.light.setLegacy((f.power || 1.4) * f2 * gain);
    f.sp.material.opacity = Math.min(1, (.5 + .3 * f2) * (f.outside ? 1 : Math.max(inside, .15) * 1.6));
    const b = f.sp.userData.base;
    f.sp.scale.set(b * f2, b * 1.25 * f2, 1);
  }
}
