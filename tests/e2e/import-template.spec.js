/* S10 / R-01, R-02: impor lewat file chooser, ID unik, dan XSS tidak dieksekusi. */
const { test, expect } = require('@playwright/test');
const { openAt, goRoute, jakarta } = require('./helpers');

const XSS = '<img src=x onerror="window.__xss=1">';

async function importJson(page, payload) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('[data-action="import-trigger"]').click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'cadangan.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload))
  });
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal-submit').click();
  await expect(page.locator('#modal')).toBeHidden();
}

async function exportPayload(page) {
  return JSON.parse(await page.evaluate(() => Store.exportData()));
}

test('R-01: impor lewat file chooser dan cadangan pra-impor dibuat', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0));
  await goRoute(page, 'pengaturan');
  const payload = await exportPayload(page);
  payload.state.settings.name = 'Impor Berhasil';
  await importJson(page, payload);

  expect(await page.evaluate(() => Store.state.settings.name)).toBe('Impor Berhasil');
  const backup = await page.evaluate(() => localStorage.getItem('rutin-buah:v1:pre-import'));
  expect(backup).toBeTruthy();
  expect(JSON.parse(backup).settings.name).not.toBe('Impor Berhasil');
});

test('R-02: ID unik saat impor dan setelah terapkan template', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0));
  await goRoute(page, 'pengaturan');
  const payload = await exportPayload(page);
  payload.state.activities = [
    {
      id: 'dup', title: 'Lama', dayOfWeek: 1, category: 'Pribadi',
      startTime: '07.00', endTime: '07.10', isRecurring: true, isTemplate: false
    },
    {
      id: 'dup', title: 'Hasil edit pengguna', dayOfWeek: 1, category: 'Pribadi',
      startTime: '07.00', endTime: '07.10', isRecurring: true, isTemplate: true, userEdited: true
    }
  ];
  await importJson(page, payload);

  let ids = await page.evaluate(() => Store.state.activities.map((a) => a.id));
  expect(ids.length).toBe(new Set(ids).size);
  expect(await page.evaluate(() => Store.state.activities.find((a) => a.id === 'dup').title)).toBe('Hasil edit pengguna');

  await page.locator('[data-action="apply-template"]').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#modal-submit').click();
  await expect(page.locator('#modal')).toBeHidden();

  ids = await page.evaluate(() => Store.state.activities.map((a) => a.id));
  expect(ids.length).toBe(new Set(ids).size);
  expect(await page.evaluate(() => Store.state.activities.find((a) => a.id === 'dup').title)).toBe('Hasil edit pengguna');
});

test('XSS pada aktivitas, catatan, dan laporan tidak dieksekusi', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0));
  await goRoute(page, 'pengaturan');
  const payload = await exportPayload(page);
  payload.state.settings.thesisTopic = XSS;
  payload.state.mentorshipNotes = XSS;
  payload.state.activities[0].title = XSS;
  payload.state.weeklyReviews = {
    '2026-11-16': {
      weekKey: '2026-11-16', status: 'final', isoWeek: '2026-W47',
      generatedAt: '2026-11-23T02:00:00.000Z', expiresAt: '2026-12-31T00:00:00.000Z',
      seen: false, items: [{ date: '2026-11-16', id: 'a1', title: XSS, time: '07.00', reason: 'Belum ditandai' }],
      waiting: [], skippedItems: [], daily: [], insights: [], plan: [],
      score: 0, done: 0, total: 1
    }
  };
  await importJson(page, payload);

  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(await page.locator('img[src="x"]').count()).toBe(0);

  await goRoute(page, 'skripsi');
  expect(await page.locator('#app').textContent()).toContain('<img src=x');
  await goRoute(page, 'evaluasi');
  expect(await page.locator('#app').textContent()).toContain('<img src=x');
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});
