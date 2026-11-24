/* S10: log galat lokal, penyensoran data pribadi, dan tombol Diagnostik. */
const { test, expect } = require('@playwright/test');
const { openAt, goRoute, jakarta } = require('./helpers');

test('error dan unhandledrejection tercatat, disensor, bisa diunduh, dan dihapus', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0));
  await page.evaluate(() => {
    window.dispatchEvent(new ErrorEvent('error', {
      message: 'Gagal memuat "Judul Rahasia"',
      filename: 'http://127.0.0.1:8099/js/app.js?token=rahasia',
      lineno: 42
    }));
  });
  await page.evaluate(() => { Promise.reject(new Error('Gagal "Catatan Pribadi"')); });
  await expect.poll(() => page.evaluate(() => ErrLog.count())).toBe(2);

  const entries = await page.evaluate(() => ErrLog.list());
  expect(entries[0]).toMatchObject({ line: 42, src: '/js/app.js', kind: 'error' });
  expect(entries[0].msg).not.toContain('Judul Rahasia');
  expect(entries[0].src).not.toContain('token');
  expect(entries[1].kind).toBe('rejection');
  expect(entries[1].msg).not.toContain('Catatan Pribadi');
  expect(entries.every((e) => e.stack.length <= 500 && e.ver === '1.3.0')).toBe(true);

  await goRoute(page, 'pengaturan');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-action="download-errlog"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('rutin-buah-log-galat.txt');
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  expect(text).toContain('# Rutin & Buah — log galat lokal');
  expect(text).not.toContain('Judul Rahasia');
  expect(text).not.toContain('Catatan Pribadi');

  await page.locator('[data-action="clear-errlog"]').click();
  expect(await page.evaluate(() => ErrLog.count())).toBe(0);
  await expect(page.locator('#errlog-count')).toContainText('0 entri');
});
