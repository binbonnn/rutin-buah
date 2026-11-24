/* S10 / V3-01, V3-03, V3-04, V3-07, V3-08, V3-10: evaluasi mingguan. */
const { test, expect } = require('@playwright/test');
const { openAt, seedState, setNow, goRoute, jakarta } = require('./helpers');

const WEEK = '2026-11-16';

async function reviews(page) {
  return page.evaluate(() => ({
    keys: Object.keys(Store.state.weeklyReviews).sort(),
    statuses: Object.fromEntries(Object.entries(Store.state.weeklyReviews).map(([k, r]) => [k, r.status])),
    list: Store.reviewList().map((r) => r.weekKey)
  }));
}

test('pratinjau 21.00, final 09.00, jadwal bekukan, usulan, grup, dan unduh .md', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 22, 20, 59));
  await seedState(page, (s) => {
    // Mulai Pemakaian di Senin minggu berjalan: minggu sebelumnya harus dilewati,
    // sehingga tidak ada laporan catch-up yang mengganggu uji pratinjau 21.00.
    s.firstUseAt = '2026-11-16T00:00:00.000Z';
    s.settings.strictSince = '2026-11-16';
    s.weeklyReviews = {};
    s.dayPlans = {};
    s.activities = [
      {
        id: 'harian', title: 'Aktivitas harian', dayOfWeek: 1, category: 'Pribadi',
        startTime: '07.00', endTime: '07.10', isRecurring: true, isTemplate: false
      },
      {
        id: 'selasa', title: 'Aktivitas Selasa', dayOfWeek: 2, category: 'Pribadi',
        startTime: '07.00', endTime: '07.10', isRecurring: true, isTemplate: false
      },
      {
        id: 'rabu', title: 'Aktivitas Rabu', dayOfWeek: 3, category: 'Pribadi',
        startTime: '08.00', endTime: '08.10', isRecurring: true, isTemplate: false
      },
      {
        id: 'malam', title: 'Aktivitas malam', dayOfWeek: 7, category: 'Pribadi',
        startTime: '23.00', endTime: '23.10', isRecurring: true, isTemplate: false
      }
    ];
    s.completion = { '2026-11-16': { harian: { s: 'completed', at: '2026-11-16T00:05:00.000Z', src: 'legacy', startedAt: null } } };
  });

  expect(await page.evaluate(() => Store.ensureReviews().created)).toBe(0);
  expect((await reviews(page)).keys).toEqual([]);

  await setNow(page, jakarta(2026, 11, 22, 21, 5));
  expect(await page.evaluate(() => Store.ensureReviews().created)).toBeGreaterThan(0);
  expect((await reviews(page)).statuses[WEEK]).toBe('preview');

  // V3-07: aktivitas yang jamnya belum tiba tidak masuk perhitungan.
  const waiting = await page.evaluate((key) => {
    const r = Store.state.weeklyReviews[key];
    return { waiting: r.waiting.map((i) => i.title), items: r.items.map((i) => i.title) };
  }, WEEK);
  expect(waiting.waiting).toContain('Aktivitas malam');
  expect(waiting.items).not.toContain('Aktivitas malam');

  // V3-08: jadwal lama dibekukan, edit hari ini tidak mengubahnya.
  await page.evaluate(() => Store.update((s) => {
    s.activities[0].title = 'Aktivitas hasil edit';
    s.activities[0].startTime = '08.00';
  }, true));
  const frozen = await page.evaluate(() => Store.state.dayPlans['2026-11-16'][0].title);
  expect(frozen).toBe('Aktivitas harian');

  await setNow(page, jakarta(2026, 11, 23, 8, 59));
  await page.evaluate(() => Store.ensureReviews());
  expect((await reviews(page)).statuses[WEEK]).toBe('preview');

  await setNow(page, jakarta(2026, 11, 23, 9, 5));
  await page.evaluate(() => Store.ensureReviews());
  expect((await reviews(page)).statuses[WEEK]).toBe('final');

  // V3-03: teks usulan jujur, bukan janji penjadwalan otomatis.
  const action = await page.evaluate((key) => Store.state.weeklyReviews[key].plan[0].action, WEEK);
  expect(action).toContain('Usulan (belum terjadwal otomatis)');

  await goRoute(page, 'evaluasi');
  // V3-10: daftar dikelompokkan per hari dan grup terburuk dibuka.
  const groups = await page.evaluate(() => ({
    total: document.querySelectorAll('.review-day').length,
    open: document.querySelectorAll('.review-day[open]').length
  }));
  expect(groups.total).toBeGreaterThan(1);
  expect(groups.open).toBe(1);

  await page.locator('[data-action="eval-tab"][data-tab="rencana"]').click();
  await expect(page.locator('.plan-decisions')).toContainText('Usulan (belum terjadwal otomatis)');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-action="download-review"]').first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.md$/);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const markdown = Buffer.concat(chunks).toString('utf8');
  expect(markdown).toContain('# Evaluasi Mingguan');
  expect(markdown).toContain('Laporan di app dihapus setelah');
});

test('instalasi baru menghasilkan nol laporan', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0));
  const info = await page.evaluate(() => ({
    keys: Object.keys(Store.state.weeklyReviews),
    count: Store.reviewStats().count,
    firstUseAt: Store.state.firstUseAt
  }));
  expect(info.keys).toEqual([]);
  expect(info.count).toBe(0);
  expect(Date.parse(info.firstUseAt)).toBeGreaterThan(0);
});

test('retensi 4 laporan, batas keras 8, dan buang kedaluwarsa lama', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0));
  await seedState(page, (s) => {
    const weeks = ['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19',
      '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'];
    s.firstUseAt = '2026-09-01T00:00:00.000Z';
    s.weeklyReviews = Object.fromEntries(weeks.map((k) => [k, {
      weekKey: k, status: 'final', isoWeek: '2026-W00',
      generatedAt: '2026-11-01T00:00:00.000Z', expiresAt: '2026-12-31T00:00:00.000Z',
      seen: false, items: [], waiting: [], skippedItems: [], daily: [],
      insights: [], plan: [], score: 0, done: 0, total: 1
    }]));
  });
  await page.evaluate(() => Store.ensureReviews());
  const after = await reviews(page);
  expect(after.list.length).toBeLessThanOrEqual(4);
  expect(after.keys.length).toBeLessThanOrEqual(8);

  await seedState(page, (s) => {
    const valid = [0, 1, 2, 3].map((n) => `2026-11-${String(2 + n * 7).padStart(2, '0')}`);
    const held = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'];
    s.weeklyReviews = Object.fromEntries([...valid, ...held, '2026-09-21'].map((k) => [k, {
      weekKey: k, status: 'final', isoWeek: '2026-W00',
      generatedAt: '2026-10-01T00:00:00.000Z',
      expiresAt: held.includes(k) || k === '2026-09-21' ? '2026-11-20T00:00:00.000Z' : '2026-12-31T00:00:00.000Z',
      seen: false, items: [], waiting: [], skippedItems: [], daily: [],
      insights: [], plan: [], score: 0, done: 0, total: 1
    }]));
  });
  await page.evaluate(() => Store.ensureReviews());
  const capped = await reviews(page);
  expect(capped.keys).not.toContain('2026-09-21'); // kedaluwarsa > 14 hari
  expect(capped.keys.length).toBeLessThanOrEqual(8);
});
