import { test, expect } from '@playwright/test';

test('renders the profile and responsive poster without layout shift', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#page-background img').evaluate((image) => image.complete || new Promise((resolve) => {
    image.addEventListener('load', resolve, { once: true });
  }));
  await expect(page.locator('h1')).toHaveText('Réda BOUHADDAR');
  await expect(page.locator('#page-background img')).toBeVisible();
  await expect(page.locator('#video-toggle')).toBeHidden();
  expect(errors).toEqual([]);
});

test('keeps video disabled when reduced motion is requested', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#redabhrBgVideo-player')).toHaveCount(0);
  await expect(page.locator('#video-toggle')).toBeHidden();
  await context.close();
});

test('keeps controls keyboard accessible', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const firstLink = page.locator('a').first();
  await firstLink.focus();
  await expect(firstLink).toBeFocused();
  await expect(firstLink).toHaveAttribute('href', /linkedin|mailto/);
});

test('shows contact tooltip and pointer on hover', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const articles = page.locator('[data-tooltip="Articles"]');
  await articles.hover();
  await expect(articles).toHaveAttribute('aria-label', 'Articles');
  await expect.poll(() => articles.evaluate((element) => getComputedStyle(element, '::before').opacity)).toBe('1');
});
