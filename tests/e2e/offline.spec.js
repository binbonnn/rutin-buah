/* S10 / S-01: app shell tetap render setelah jaringan diputus. */
const { test, expect } = require('@playwright/test');
const { openAt, jakarta } = require('./helpers');

test('service worker aktif, lalu reload offline tetap menampilkan halaman', async ({ page, context }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0));
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Pastikan halaman berada di bawah kendali service worker sebelum offline.
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator('#page-title')).toHaveText('Beranda');
    await expect(page.locator('#app')).not.toBeEmpty();
    expect(await page.evaluate(() => Utils.APP_VERSION)).toBeTruthy();
  } finally {
    await context.setOffline(false);
  }
});
