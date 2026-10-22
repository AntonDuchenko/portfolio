import { expect, test } from '@playwright/test';
import { collectErrors } from './helpers';

// Headless Chromium draws WebGL with SwiftShader, a software renderer: without ?softgl the
// bootstrap must skip the scene and show the page, as for a visitor with acceleration off.
test('a software WebGL renderer goes straight to the page', async ({ page }) => {
  const errors = collectErrors(page);
  const warnings: string[] = [];
  page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });
  await page.goto('./');
  await expect(page.locator('#gate')).toBeHidden();
  await expect(page.locator('#site')).toBeVisible();
  await expect(page.locator('#intro h1')).toBeVisible();
  expect(warnings.some(w => w.includes('software WebGL renderer'))).toBe(true);
  expect(errors()).toEqual([]);
});
