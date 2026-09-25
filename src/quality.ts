/* Quality tier, decided once at start-up.

   low  — phones, tablets and weak machines: pixel ratio 1, no MSAA, half the forest and
          mist, models from public/models/low (512 textures, no normal maps).
   high — everything else: pixel ratio up to 2, MSAA, full forest, 1K textures.

   Override with ?quality=low|high. The FPS guard in app.ts can still lower the pixel
   ratio at run time, and falls back straight to the site if even that is not enough. */

type Tier = 'low' | 'high';

function detect(): Tier {
  const q = new URLSearchParams(location.search).get('quality');
  if (q === 'low' || q === 'high') return q;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const touch = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 900;
  const weak = (nav.deviceMemory ?? 8) <= 4 || (nav.hardwareConcurrency ?? 8) <= 4;
  return (touch && small) || weak ? 'low' : 'high';
}

const tier: Tier = detect();

export const Q = tier === 'low'
  ? { tier, pixelRatio: 1, antialias: false, forest: .5, mist: 7, models: 'models/low/' }
  : { tier, pixelRatio: 2, antialias: true, forest: 1, mist: 14, models: 'models/' };

/** WebGL2 is required (three ≥ 0.163); without it the scene is skipped. */
export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch { return false; }
}
