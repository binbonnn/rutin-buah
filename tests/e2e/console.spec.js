/* S10: tidak ada galat JS saat menelusuri seluruh halaman. */
const { test, expect } = require('@playwright/test');
const { ROUTES, openAt, goRoute, jakarta } = require('./helpers');

test('tanpa pageerror maupun console.error di 7 halaman × 2 tema', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('console.error: ' + msg.text());
  });

  await openAt(page, jakarta(2026, 11, 23, 10, 0));
  for (const theme of ['light', 'dark']) {
    for (const route of ROUTES) {
      await goRoute(page, route);
      await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
      expect(await page.locator('#app').textContent()).not.toContain('Data tidak dapat ditampilkan');
    }
  }

  // Log galat lokal memang boleh berisi entri dari pengujian lain, tetapi
  // tidak boleh ada galat baru selama penelusuran ini.
  expect(errors, errors.join('\n')).toEqual([]);
});
