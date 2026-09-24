import { AmbientLight, type ColorRepresentation, DirectionalLight, HemisphereLight, PointLight } from 'three';
import { cfg } from '../config';
import { fireTex, type GlowSprite, sprite } from './sprites';
import { scene } from './stage';

/* ── light units ─────────────────────────────────────────────────────
   Every intensity in this codebase is written in the prototype's r128 "legacy" units
   and converted here. three ≥ 0.155 dropped the legacy mode:

   - ambient / hemisphere / directional: legacy multiplied by π in the shader → ×π, exact.
   - point: legacy irradiance was π·I·(1 − d/R)², physical is I·d^−decay·(1 − (d/R)⁴)².
     A single ×k at decay 2 cannot match: vs. the prototype it gives ×14 at 1 m and
     ×0.45 at 8 m for the torch. So each light gets k and decay from a least-squares
     fit in log space, weighted by the legacy brightness, over 0.5 m … 0.97·R.
     Result: decay ≈ 0.55–0.85, k ≈ 2.8–4.1, within about ±30 % of the prototype
     between 1 m and 8 m. Retune in real units once the real assets are in.
   ──────────────────────────────────────────────────────────────────── */
export const LEGACY = Math.PI;

export function fitLegacyFalloff(range: number) {
  const N = 200, d0 = .5, d1 = range * .97;
  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < N; i++) {
    const d = d0 + (d1 - d0) * i / (N - 1), q = d / range;
    const legacy = Math.PI * (1 - q) ** 2, window = (1 - q ** 4) ** 2;
    const x = Math.log(d), y = Math.log(legacy / window), w = legacy;
    sw += w; sx += w * x; sy += w * y; sxx += w * x * x; sxy += w * x * y;
  }
  const slope = (sw * sxy - sx * sy) / (sw * sxx - sx * sx);
  return { decay: -slope, k: Math.exp((sy - slope * sx) / sw) };
}

export class RescaledPointLight extends PointLight {
  readonly k: number;
  constructor(color: ColorRepresentation, range: number) {
    const { k, decay } = fitLegacyFalloff(range);
    super(color, 0, range, decay);
    this.k = k;
  }
  /** intensity in prototype (r128 legacy) units */
  setLegacy(v: number) { this.intensity = v * this.k; }
}

/* ── global lights ───────────────────────────────────────────────── */
export const moon = new DirectionalLight(0x8aa4e0, 1.5 * LEGACY); moon.position.set(-6, 14, 5);
export const sky = new HemisphereLight(0x33477a, 0x0b0d10, .55 * LEGACY);
export const ambient = new AmbientLight(0x18233d, .5 * LEGACY);
export const warmAmb = new AmbientLight(0x4a2e18, 0);          // inside the tavern
export const torch = new RescaledPointLight(0xff8c33, 24); torch.setLegacy(2.8);

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
