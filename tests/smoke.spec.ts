import { expect, test } from '@playwright/test';
import { collectErrors, step, virtualClock } from './helpers';

// Everything the visitor can hit on the way in: the gate, the scene up to the page and
// the files the page links to. The fallback without WebGL is in no-webgl.spec.ts.

test('gate explains the scene and becomes enterable', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?noguard&quality=low');
  await expect(page.locator('#gate h2')).toHaveText('Anton Duchenko');
  await expect(page.locator('#gate .what')).toContainText('skip it any time');
  await expect(page.locator('#enter')).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator('#enter')).toHaveText(/^Enter (the tavern|without sound)$/);
  expect(errors()).toEqual([]);
});

test('the scene hands over to the page', async ({ page }) => {
  const errors = collectErrors(page);
  await virtualClock(page);
  await page.goto('./?noguard&quality=low');
  await expect(page.locator('#enter')).toBeEnabled({ timeout: 120_000 });
  await page.locator('#enter').click();
  await step(page, 20);                               // a second of the walk
  await expect(page.locator('#skip')).toBeVisible();
  await page.locator('#skip').click();                // → hold, door, flight

  // the door opens: the poster layer shows, clipped to the doorway
  let clipped = false, landed = false;
  for (let i = 0; i < 40 && !landed; i++) {
    await step(page, 10);
    clipped ||= await page.evaluate(() => {
      const c = document.getElementById('portal')!.style.clipPath;
      return c.startsWith('polygon') && !c.startsWith('polygon(0 0,0 0');   // a real doorway, not the empty mask
    });
    landed = await page.evaluate(() => document.body.classList.contains('landed'));
  }
  expect(clipped, 'door mask was applied').toBe(true);
  expect(landed, 'landed on the page within 20 s of scene time').toBe(true);

  await expect(page.locator('#site')).toHaveCSS('opacity', '1');
  await expect(page.locator('#scene')).toBeHidden();
  await expect(page.locator('#intro [data-ink]')).toHaveClass(/is-in/);
  await expect(page.locator('.narrator')).toBeVisible();
  await expect(page.locator('#again')).toBeVisible();
  expect(errors()).toEqual([]);
});

test('linked files exist', async ({ request }) => {
  for (const [path, type] of [
    ['Anton-Duchenko-CV.pdf', 'application/pdf'], ['og.jpg', 'image/jpeg'],
    ['icon.svg', 'image/svg+xml'], ['apple-touch-icon.png', 'image/png'],
    ['models/forest.glb', ''], ['models/low/forest.glb', ''], ['models/narrator.glb', ''],
    ['audio/forest.mp3', ''], ['audio/voice/line0.mp3', ''], ['audio/narrator/intro.mp3', '']
  ]) {
    const r = await request.get(path);
    expect(r.status(), path).toBe(200);
    if (type) expect(r.headers()['content-type'], path).toContain(type);
  }
});
