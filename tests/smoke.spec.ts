import { expect, type Page, test } from '@playwright/test';
import { collectErrors, step, virtualClock } from './helpers';

// Everything the visitor can hit on the way in: the gate, the scene up to the page and
// the files the page links to. The fallback without WebGL is in no-webgl.spec.ts.

test('gate explains the scene and becomes enterable', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?noguard&quality=low&seed=1');
  await expect(page.locator('#gate h2')).toHaveText('Anton Duchenko');
  await expect(page.locator('#gate .what')).toContainText('skip the walk');
  await expect(page.locator('#enter')).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator('#enter')).toHaveText(/^Take the trail( \(no sound\))?$/);
  expect(errors()).toEqual([]);
});

test('the scene hands over to the page', async ({ page }) => {
  const errors = collectErrors(page);
  await virtualClock(page);
  await page.goto('./?noguard&quality=low&seed=1');
  await expect(page.locator('#enter')).toBeEnabled({ timeout: 120_000 });
  await page.locator('#enter').click();
  await step(page, 20);                               // a second of the walk
  await expect(page.locator('#skip')).toBeVisible();
  // entered with sound: the sound control is up; the slider remembers its level, the
  // speaker mutes and unmutes
  await expect(page.locator('#volume')).toBeVisible();
  await page.locator('#volume input').fill('30');
  expect(await page.evaluate(() => localStorage.getItem('tavern:volume'))).toBe('0.3');
  await page.locator('#volume .mute').click();
  await expect(page.locator('#volume .mute')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#volume .mute').click();
  await expect(page.locator('#volume .mute')).toHaveAttribute('aria-pressed', 'false');
  // full screen: started by the enter click; the corner button leaves and re-enters it
  const fullscreen = () => page.evaluate(() => !!document.fullscreenElement);
  await expect.poll(fullscreen).toBe(true);
  await expect(page.locator('#fullscreen')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#fullscreen').click();
  await expect.poll(fullscreen).toBe(false);
  await page.locator('#fullscreen').click();
  await expect.poll(fullscreen).toBe(true);
  await page.locator('#skip').click();                // → hold, door, flight
  // skip shortens the walk only: it is gone for the door and the flight
  await expect(page.locator('#skip')).toBeHidden();

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
  await expect(page.locator('#volume')).toBeHidden();
  await expect(page.locator('#fullscreen')).toBeHidden();
  // the nav has the same control, in step with the scene's (set to 30 above); the slider
  // shows from 761 px, phones get the speaker only
  await page.setViewportSize({ width: 1280, height: 720 });
  const nav = page.locator('#sound');
  await expect(nav).toBeVisible();
  await expect(nav.locator('input')).toHaveValue('30');
  await nav.locator('.mute').click();
  await expect(nav.locator('.mute')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('tavern:muted'))).toBe('1');
  await nav.locator('input').fill('55');                  // moving the slider unmutes
  await expect(nav.locator('.mute')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('tavern:volume'))).toBe('0.55');
  await expect.poll(fullscreen, { message: 'the page reads in the normal window' }).toBe(false);
  expect(errors()).toEqual([]);
});

/** Steps the scene until it lands on the page (the flight takes ~8 s of scene time). */
async function flyToPage(page: Page) {
  for (let i = 0; i < 40; i++) {
    await step(page, 10);
    if (await page.evaluate(() => document.body.classList.contains('landed'))) return;
  }
  throw new Error('did not land within 20 s of scene time');
}

/* The innkeeper starts from an IntersectionObserver, whose callbacks run only on a real
   rendering frame. Headless Chrome with software WebGL draws them rarely once the page is
   still (measured 3–9 s here, over 30 s on CI); a pointer move asks for one (0.24 s). */
async function innkeeperSpeaks(page: Page) {
  let x = 0;
  await expect.poll(async () => {
    await page.mouse.move(100 + (x ^= 1), 100);
    return page.locator('.narrator').getAttribute('class');
  }, { timeout: 30_000 }).toMatch(/open/);
}

test('replaying the scene silences the innkeeper until the next landing', async ({ page }) => {
  const errors = collectErrors(page);
  await virtualClock(page);
  // ?noavatar: under swiftshader the avatar's shader compile blocks the page for 30 s+
  await page.goto('./?noguard&noavatar&quality=low&seed=1');
  await expect(page.locator('#enter')).toBeEnabled({ timeout: 120_000 });
  await page.locator('#enter').click();
  await step(page, 20);
  await page.locator('#skip').click();                // the door and the flight still play
  await flyToPage(page);
  await innkeeperSpeaks(page);                        // the intro line

  await page.locator('#again').click();               // back to the scene, full screen again
  await expect(page.locator('.narrator')).toBeHidden();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  for (let i = 0; i < 6; i++) {                        // three seconds of the walk
    await step(page, 10);
    await expect(page.locator('.narrator')).toBeHidden();
    await expect(page.locator('.narrator')).not.toHaveClass(/open/);
  }

  await expect(page.locator('#skip')).toBeVisible();   // back for the new walk
  await page.locator('#skip').click();
  await flyToPage(page);
  await expect(page.locator('.narrator')).toBeVisible();
  await innkeeperSpeaks(page);                        // tells the tale again
  expect(errors()).toEqual([]);
});

test('linked files exist', async ({ request }) => {
  for (const [path, type] of [
    ['Anton-Duchenko-CV.pdf', 'application/pdf'], ['og.jpg', 'image/jpeg'],
    ['icon.svg', 'image/svg+xml'], ['apple-touch-icon.png', 'image/png'], ['sitemap.xml', 'xml'],
    ['models/forest.glb', ''], ['models/low/forest.glb', ''], ['models/narrator.glb', ''],
    ['audio/forest.mp3', ''], ['audio/voice/line0.mp3', ''], ['audio/narrator/intro.mp3', '']
  ]) {
    const r = await request.get(path);
    expect(r.status(), path).toBe(200);
    if (type) expect(r.headers()['content-type'], path).toContain(type);
  }
});
