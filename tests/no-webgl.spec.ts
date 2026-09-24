import { expect, test } from '@playwright/test';
import { collectErrors } from './helpers';

// Without WebGL2 the bootstrap skips the scene and shows the page directly (ui/fallback.ts).
test.use({ launchOptions: { args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] } });

test('without WebGL the page is shown directly', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await expect(page.locator('#gate')).toBeHidden();
  await expect(page.locator('#site')).toBeVisible();
  await expect(page.locator('#intro h1')).toBeVisible();
  await expect(page.locator('a.cv').first()).toHaveAttribute('href', 'Anton-Duchenko-CV.pdf');
  expect(errors().filter(e => !/WebGL/i.test(e))).toEqual([]);
});
