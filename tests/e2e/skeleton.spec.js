/* Skeleton loading: konten placeholder saat boot, pindah halaman, dan data async. */
const { test, expect } = require('@playwright/test');
const { openAt, jakarta } = require('./helpers');

test('skeleton terlihat sebelum skrip aplikasi siap, lalu hilang setelah render', async ({ page }) => {
  // Tunda eksekusi app.js agar fase boot dapat diamati.
  await page.route('**/js/app.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });
  await page.goto('/#/dashboard', { waitUntil: 'commit' });

  const sk = page.locator('#page-skeleton');
  await expect(sk).toBeVisible();
  expect(await sk.getAttribute('aria-label')).toBe('Memuat konten');
  expect(await sk.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  expect(await sk.locator('.sk-card').count()).toBe(3);

  await expect(page.locator('#app')).toContainText('Tambah aktivitas');
  await expect(sk).toBeHidden();
});

test('skeleton bisa ditampilkan saat memuat dan tidak menghalangi navigasi', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0), 'dashboard');
  const sk = page.locator('#page-skeleton');
  await expect(sk).toBeHidden();

  await page.evaluate(() => UI.setSkeleton(true));
  await expect(sk).toBeVisible();
  expect(await sk.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');

  // Overlay bersifat dekoratif: klik tetap sampai ke tombol navigasi.
  await page.locator('[data-nav="buah"]:visible').first().click();
  await expect(page).toHaveURL(/#\/buah$/);
  await expect(sk).toBeHidden();

  await page.evaluate(() => UI.setSkeleton(true));
  await expect(sk).toBeVisible();
  await page.evaluate(() => UI.setSkeleton(false));
  await expect(sk).toBeHidden();
});
