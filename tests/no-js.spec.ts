import { expect, test } from '@playwright/test';

// Without JavaScript (some crawlers, link previews, script blockers) the page is the CV
// itself: the <noscript> styles in index.html drop the gate and the scene.
test.use({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });

test('without JavaScript the CV is readable and described for search engines', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#gate')).toBeHidden();
  await expect(page.locator('#site')).toHaveCSS('opacity', '1');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText('Anton Duchenko');
  await expect(page.locator('#experience')).toBeVisible();
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '{}') as { mainEntity?: { name?: string } };
  expect(ld.mainEntity?.name).toBe('Anton Duchenko');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://antonduchenko.github.io/portfolio/');
});
