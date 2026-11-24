/* S10 / V3-02: hari istirahat tidak boleh menimpa atau menghapus penandaan. */
const { test, expect } = require('@playwright/test');
const { openAt, goRoute, seedState, jakarta } = require('./helpers');

const KEY = '2026-11-23';

async function acceptDialog(page) {
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal-submit').click();
  await expect(page.locator('#modal')).toBeHidden();
}

test('selesai → hari istirahat → batalkan → tetap selesai', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0));
  await seedState(page, (s, arg) => {
    s.settings.strictSince = arg.key;
    s.settings.markGraceMinutes = 10;
    s.firstUseAt = '2026-11-01T00:00:00.000Z';
    s.activities = [{
      id: 'a1', title: 'Aktivitas uji', dayOfWeek: 1, category: 'Pribadi',
      startTime: '07.00', endTime: '07.10', isRecurring: true, isTemplate: false
    }];
    s.completion = {};
    s.restDays = [];
  }, { key: KEY });
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('app:force-render')));

  const marked = await page.evaluate((key) => Store.setActivityStatus('a1', key, 'completed', {
    now: new Date(key + 'T07:05:00+07:00')
  }), KEY);
  expect(marked.ok).toBe(true);
  expect(await page.evaluate((key) => Store.statusOf(Store.state.completion[key].a1), KEY)).toBe('completed');

  // Tombol hari istirahat ada di Jadwal (dashboard hanya menampilkannya setelah aktif).
  await goRoute(page, 'jadwal');
  const restButton = page.locator('[data-action="toggle-rest-day"][data-date="2026-11-23"]');
  await expect(restButton).toBeVisible();
  await restButton.click();
  await acceptDialog(page);

  expect(await page.evaluate((key) => Store.state.restDays.includes(key), KEY)).toBe(true);
  expect(await page.evaluate((key) => Store.statusOf(Store.state.completion[key].a1), KEY)).toBe('completed');

  // Membatalkan tidak meminta konfirmasi kedua.
  await restButton.click();
  await expect(page.locator('.toast').last()).toContainText('dibatalkan');

  expect(await page.evaluate((key) => Store.state.restDays.includes(key), KEY)).toBe(false);
  expect(await page.evaluate((key) => Store.statusOf(Store.state.completion[key].a1), KEY)).toBe('completed');
  expect(await page.evaluate((key) => JSON.stringify(Store.state.completion[key].a1), KEY)).toContain('"s":"completed"');
});
