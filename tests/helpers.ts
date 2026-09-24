import type { Page } from '@playwright/test';

/** Replaces performance.now and requestAnimationFrame: time only moves by `step(n)`, 50 ms
 *  per frame (the app's dt clamp). Playwright's own clock can run performance.now
 *  backwards, which breaks the camera. Math.random is seeded for repeatable scenes. */
export async function virtualClock(page: Page) {
  await page.addInitScript(() => {
    let a = 12345;
    Math.random = () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    let now = 0; const queue: FrameRequestCallback[] = [];
    performance.now = () => now;
    window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
    (window as unknown as { __step: (n: number) => void }).__step = n => {
      for (let i = 0; i < n; i++) { now += 50; for (const cb of queue.splice(0)) cb(now); }
    };
  });
}

export const step = (page: Page, n: number) =>
  page.evaluate(k => (window as unknown as { __step: (n: number) => void }).__step(k), n);

/** Page errors and console errors, minus blocked web fonts (CI must not depend on Google). */
export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // web fonts are not needed for the checks, and CI must not depend on Google
  void page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  return () => errors.filter(e => !/ERR_FAILED|ERR_BLOCKED/.test(e));
}
