/* v1.3.0 — S9 arsip, S1 penjadwalan pemulihan, S2 insight berbasis data. */
const { test, expect } = require('@playwright/test');
const { openAt, goRoute, seedState, jakarta } = require('./helpers');

const WEEK = '2026-11-16';

/** Satu aktivitas Senin yang tidak tercatat → satu rencana dengan slot usulan. */
async function seedRencana(page) {
  await seedState(page, (s) => {
    s.firstUseAt = '2026-11-01T00:00:00.000Z';
    s.settings.strictSince = '2026-11-01';
    s.weeklyReviews = {};
    s.daySnapshots = {};
    s.scheduleVersion = 1;
    s.activities = [{
      id: 'a1', title: 'Skripsi', dayOfWeek: 1, category: 'Skripsi',
      startTime: '07.00', endTime: '08.00', isRecurring: true, isTemplate: false
    }];
    s.completion = {};
  });
  await page.evaluate(() => Store.ensureReviews());
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('app:force-render')));
  await goRoute(page, 'evaluasi');
  await page.locator('[data-action="eval-tab"][data-tab="rencana"]').click();
}

test('S1: terima rencana menambah satu aktivitas tepat di slot usulan, lalu undo', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0), 'evaluasi');
  await seedRencana(page);

  const before = await page.evaluate(() => ({
    count: Store.state.activities.length,
    plan: Store.state.weeklyReviews['2026-11-16'].plan[0]
  }));
  expect(before.plan.suggested).toBeTruthy();
  expect(before.plan.status).toBe('proposed');

  await page.locator('[data-action="plan-accept"]').first().click();
  await expect(page.locator('#toast-root')).toContainText('Rencana diterima');

  const accepted = await page.evaluate((key) => {
    const p = Store.state.weeklyReviews[key].plan[0];
    const created = Store.state.activities.find((a) => a.id === p.createdActivityId);
    return {
      count: Store.state.activities.length,
      status: p.status,
      created: created && {
        origin: created.origin, recoveryOf: created.recoveryOf,
        isRecurring: created.isRecurring, date: created.date,
        startTime: created.startTime, endTime: created.endTime
      },
      suggested: p.suggested
    };
  }, WEEK);
  expect(accepted.count).toBe(before.count + 1);
  expect(accepted.status).toBe('accepted');
  expect(accepted.created.origin).toBe('recovery');
  expect(accepted.created.recoveryOf).toBe(before.plan.activityId);
  expect(accepted.created.isRecurring).toBe(false);
  expect(accepted.created.date).toBe(accepted.suggested.date);
  expect(accepted.created.startTime).toBe(accepted.suggested.start);
  expect(accepted.created.endTime).toBe(accepted.suggested.end);
  await expect(page.locator('.plan-decision.is-accepted')).toContainText('Lihat di Jadwal');
  await expect(page.locator('.plan-total')).toContainText('Total tambahan: 60 menit');

  await page.locator('[data-action="plan-undo"]').click();
  await expect(page.locator('#toast-root')).toContainText('Rencana dibatalkan');
  const undone = await page.evaluate((key) => ({
    count: Store.state.activities.length,
    status: Store.state.weeklyReviews[key].plan[0].status,
    createdActivityId: Store.state.weeklyReviews[key].plan[0].createdActivityId
  }), WEEK);
  expect(undone.count).toBe(before.count);
  expect(undone.status).toBe('proposed');
  expect(undone.createdActivityId).toBe(null);
});

test('S1: Ubah jam menolak tabrakan dan menyimpan slot baru', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0), 'evaluasi');
  await seedRencana(page);

  await page.locator('[data-action="plan-edit"]').first().click();
  await page.locator('#f-date').fill('2026-11-23');
  await page.locator('#f-startTime').fill('07:30');
  await page.locator('#f-endTime').fill('08:00');
  await page.locator('#modal-submit').click();
  await expect(page.locator('#toast-root')).toContainText('bertabrakan');
  expect(await page.evaluate((key) => Store.state.weeklyReviews[key].plan[0].status, WEEK)).toBe('proposed');

  await page.locator('#f-startTime').fill('19:00');
  await page.locator('#f-endTime').fill('19:40');
  await page.locator('#modal-submit').click();
  await expect(page.locator('#toast-root')).toContainText('Rencana diperbarui');
  await expect(page.locator('.plan-decisions')).toContainText('19.00–19.40');
  const suggested = await page.evaluate((key) => Store.state.weeklyReviews[key].plan[0].suggested, WEEK);
  expect(suggested).toEqual({ date: '2026-11-23', start: '19.00', end: '19.40' });
});

test('S2: insight data-only dirender jadi teks plus CTA tanpa frasa terlarang', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0), 'evaluasi');
  await seedState(page, (s) => {
    s.firstUseAt = '2026-01-01T00:00:00.000Z';
    s.weeklyReviews = {
      '2026-11-16': {
        weekKey: '2026-11-16', status: 'final', isoWeek: '2026-W47',
        generatedAt: '2026-11-23T02:00:00.000Z', expiresAt: '2026-12-31T00:00:00.000Z',
        seen: true, items: [], waiting: [], skippedItems: [], daily: [], plan: [],
        score: 50, done: 10, total: 20,
        insights: [{ kind: 'block-weak', score: 80, data: { block: 'pagi', pct: 0.8, total: 10 }, cta: 'open-plan' }]
      }
    };
  });
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('app:force-render')));
  await goRoute(page, 'evaluasi');

  const stored = await page.evaluate(() => Store.state.weeklyReviews['2026-11-16'].insights[0]);
  expect(Object.keys(stored).sort()).toEqual(['cta', 'data', 'kind', 'score']);
  await expect(page.locator('.insight-list')).toContainText('Blok pagi tidak tercatat 80% dari 10 aktivitas');
  await expect(page.locator('.insight-list [data-action="eval-goto-plan"]')).toHaveCount(1);
  const text = (await page.locator('.insight-list').textContent()).toLowerCase();
  for (const banned of ['gagal', 'malas', 'kurang disiplin']) expect(text).not.toContain(banned);
});

test('S9: arsip lama pindah ke IndexedDB, ikut ekspor, dan pulih saat impor', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0));
  await seedState(page, (s) => {
    s.completion = { '2020-01-01': { a1: { s: 'completed', at: null, src: 'legacy', title: 'Aktivitas uji' } } };
    s.consumption = [{ id: 'c-lama', date: '2020-01-01', fruitId: 'f1', servingCount: 1 }];
  });

  const moved = await page.evaluate(async () => Store.archiveOld(new Date('2026-11-23T03:00:00.000Z')));
  expect(moved).toEqual({ completion: 1, consumption: 1 });
  expect(await page.evaluate(() => Store.state.completion['2020-01-01'])).toBeUndefined();
  expect(await page.evaluate(() => Store.state.consumption.length)).toBe(0);
  expect(await page.evaluate(() => Archive.get('completion-old', '2020-01-01'))).toBeTruthy();

  const json = await page.evaluate(() => Store.exportDataAsync());
  const payload = JSON.parse(json);
  expect(payload.schemaVersion).toBe(5);
  expect(payload.archive.completion['2020-01-01']).toBeTruthy();
  expect(payload.archive.consumption['c-lama']).toBeTruthy();

  await page.evaluate(() => Store.reset());
  await page.evaluate(() => Archive.clear('completion-old'));
  await page.evaluate((text) => Store.importDataAsync(text), json);
  expect(await page.evaluate(() => Archive.get('completion-old', '2020-01-01'))).toBeTruthy();
});
