/* S10 / C.3 / V3-05: perbatasan Jendela Aktif di UI dan di Store. */
const { test, expect } = require('@playwright/test');
const { openAt, seedState, setNow, jakarta } = require('./helpers');

const KEY = '2026-11-23'; // Senin, Asia/Jakarta

const shortActivity = (overrides = {}) => ({
  id: 'short', title: 'Aktivitas pendek', dayOfWeek: 1, category: 'Pribadi',
  startTime: '07.00', endTime: '07.10', isRecurring: true, isTemplate: false,
  ...overrides
});

async function seedActivities(page, activities) {
  await seedState(page, (s, arg) => {
    s.settings.strictSince = arg.key;
    s.settings.markGraceMinutes = 10;
    s.firstUseAt = '2026-11-01T00:00:00.000Z';
    s.activities = arg.activities;
    s.completion = {};
    s.weeklyReviews = {};
  }, { key: KEY, activities });
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('app:force-render')));
}

const checkFor = (page, id) => page.locator(`[data-action="toggle-activity"][data-id="${id}"]`).first();
const statusOf = (page, id) => page.evaluate(
  ({ key, id }) => Store.statusOf((Store.state.completion[key] || {})[id]),
  { key: KEY, id }
);

test('batas jendela: sebelum mulai, tepat mulai, grace−1 detik, dan grace habis', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 6, 59, 0));
  await seedActivities(page, [shortActivity()]);
  const button = checkFor(page, 'short');

  // Tombol dinonaktifkan, jadi guard Store yang diuji lewat pemanggilan langsung.
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute('aria-disabled', 'true');
  const blocked = await page.evaluate((key) => Store.setActivityStatus('short', key, 'completed', {
    now: new Date()
  }), KEY);
  expect(blocked.ok).toBe(false);
  expect(blocked.reason).toContain('Buka pukul 07.00.');
  expect(await statusOf(page, 'short')).toBe('');

  await setNow(page, jakarta(2026, 11, 23, 7, 0, 0));
  await expect(button).toBeEnabled();
  await expect(button).toHaveAttribute('aria-disabled', 'false');
  await button.click();
  expect(await statusOf(page, 'short')).toBe('completed');

  // Batalkan di dalam jendela agar masa toleransi bisa diuji tanpa penandaan.
  await page.evaluate((key) => Store.setActivityStatus('short', key, ''), KEY);
  await setNow(page, jakarta(2026, 11, 23, 7, 19, 59));
  const grace = await page.evaluate((key) => {
    const a = Store.state.activities[0];
    return {
      status: Store.activityStatus(a, key),
      canMark: Store.canMark(a, key, 'complete', new Date()).ok
    };
  }, KEY);
  expect(grace).toEqual({ status: 'grace', canMark: true });

  await setNow(page, jakarta(2026, 11, 23, 7, 20, 0));
  await expect(button).toBeDisabled();
  const expired = await page.evaluate((key) => Store.setActivityStatus('short', key, 'completed', {
    now: new Date()
  }), KEY);
  expect(expired.ok).toBe(false);
  expect(expired.reason).toContain('Jendela sudah ditutup');
  expect(await statusOf(page, 'short')).toBe('');
});

test('dua langkah di UI dan bypass Store ditolak', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 7, 5));
  await seedActivities(page, [
    shortActivity(),
    shortActivity({ id: 'long', title: 'Aktivitas panjang', startTime: '07.00', endTime: '07.30' })
  ]);
  const button = checkFor(page, 'long');

  await expect(button).toHaveAttribute('aria-label', /Mulai: Aktivitas panjang/);
  await button.click();
  expect(await statusOf(page, 'long')).toBe('inprogress');
  await expect(button).toHaveAttribute('aria-label', /Selesaikan: Aktivitas panjang/);
  await button.click();
  expect(await statusOf(page, 'long')).toBe('completed');

  const bypass = await page.evaluate(() => {
    Store.update((s) => { s.completion['2026-11-23'] = {}; }, true);
    return Store.setActivityStatus('long', '2026-11-23', 'completed', { now: new Date() });
  });
  expect(bypass.ok).toBe(false);
  expect(bypass.reason).toContain('Mulai aktivitas terlebih dahulu');
  expect(await statusOf(page, 'long')).toBe('');
});

test('jadwal lintas tengah malam memakai jam tutup hari berikutnya', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 23, 45));
  await seedActivities(page, [
    shortActivity({ id: 'late', title: 'Lintas tengah malam', startTime: '23.30', endTime: '00.30' })
  ]);

  const windowInfo = await page.evaluate((key) => {
    const a = Store.state.activities[0];
    const w = Store.windowFor(a, key, new Date());
    return { closesAt: new Date(w.closesAt).toISOString(), lastTick: new Date(w.lastTick).toISOString() };
  }, KEY);
  // toISOString() memakai UTC; 00.30 dan 00.40 Jakarta = 17.30/17.40 UTC hari sebelumnya.
  expect(windowInfo.closesAt).toContain('2026-11-23T17:30');
  expect(windowInfo.lastTick).toContain('2026-11-23T17:40');

  await setNow(page, jakarta(2026, 11, 24, 0, 15));
  const inside = await page.evaluate((key) => Store.canMark('late', key, 'start', new Date()).ok, KEY);
  expect(inside).toBe(true);
  expect(await page.evaluate((key) => Store.setActivityStatus('late', key, 'inprogress').ok, KEY)).toBe(true);
  expect(await page.evaluate((key) => Store.setActivityStatus('late', key, 'completed').ok, KEY)).toBe(true);

  await setNow(page, jakarta(2026, 11, 24, 0, 41));
  const outside = await page.evaluate((key) => {
    const a = Store.state.activities[0];
    return Store.canMark({ ...a, id: 'late-lain' }, key, 'start', new Date());
  }, KEY);
  expect(outside.ok).toBe(false);
  expect(outside.reason).toContain('Jendela sudah ditutup');
});
