/* Audit v1.3.0: perbaikan tombol modal, toast, skip link, XSS, dan notifikasi. */
const { test, expect } = require('@playwright/test');
const { openAt, goRoute, seedState, jakarta } = require('./helpers');

test('audit: tombol Tutup modal bekerja dan perubahan belum disimpan diperingatkan', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0), 'jadwal');
  const add = page.locator('[data-action="add-activity"]').first();
  await add.click();
  await expect(page.locator('#modal-form')).toBeVisible();
  await page.locator('#modal-close').click();
  await expect(page.locator('#modal-form')).toBeHidden();

  await add.click();
  await page.locator('#f-title').fill('Perubahan sementara');
  await page.locator('#modal-close').click();
  await expect(page.locator('.modal-dirty-hint')).toContainText('Perubahan belum disimpan');
  await page.locator('#modal-cancel').click();
  await expect(page.locator('#modal-form')).toBeVisible();
  await page.locator('#modal').evaluate((d) => d.close());
});

test('audit: toast bisa diklik dan skip link tidak memaksa route Beranda', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0), 'skripsi');
  const pointer = await page.locator('#toast-root').evaluate((el) => getComputedStyle(el).pointerEvents);
  expect(pointer).toBe('none');
  await page.evaluate(() => UI.toast('Notifikasi uji audit', 'info'));
  const toast = page.locator('.toast').filter({ hasText: 'Notifikasi uji audit' });
  await expect(toast).toBeVisible();
  expect(await toast.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('auto');
  await toast.click();
  await expect(toast).toHaveCount(0);

  await expect(page.locator('#page-title')).toHaveText('Skripsi');
  // Skip link tersembunyi di kiri sampai menerima fokus (alur keyboard).
  await page.locator('.skip-link').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/skripsi$/);
  await expect(page.locator('#page-title')).toHaveText('Skripsi');
});

test('audit: judul rencana dari impor tidak mengeksekusi HTML', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openAt(page, jakarta(2026, 11, 23, 10, 0), 'evaluasi');
  await seedState(page, (s) => {
    s.firstUseAt = '2026-01-01T00:00:00.000Z';
    s.weeklyReviews = {
      '2026-11-16': {
        weekKey: '2026-11-16', status: 'final', generatedAt: '2026-11-23T02:00:00.000Z',
        expiresAt: '2027-01-01T00:00:00.000Z', seen: true, isoWeek: '2026-W47',
        score: 50, done: 1, total: 2, unfinished: 1, skippedCount: 0, excusedCount: 0, waitingCount: 0,
        items: [], titles: {}, skippedItems: [], waiting: [], daily: [], insights: [],
        plan: [{ id: 'evil', title: '<img src=x onerror="window.__xss=1">', status: 'proposed', durationMin: 20, kind: 'recover' }]
      }
    };
  });
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('app:force-render')));
  await goRoute(page, 'evaluasi');
  await expect(page.locator('.card', { hasText: 'Rencana pemulihan' })).toContainText('<img src=x');
  expect(await page.evaluate(() => window.__xss || null)).toBe(null);
  expect(errors).toEqual([]);
});

test('audit: rencana dilewati bisa di-undo dari UI dan CTA insight membuka modal', async ({ page }) => {
  await openAt(page, jakarta(2026, 11, 23, 10, 0), 'evaluasi');
  await seedState(page, (s) => {
    s.firstUseAt = '2026-01-01T00:00:00.000Z';
    s.settings.strictSince = '2026-11-01';
    s.weeklyReviews = {};
    s.daySnapshots = {};
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

  await page.locator('[data-action="plan-skip"]').first().click();
  await expect(page.locator('.plan-decision.is-skipped')).toHaveCount(1);
  await expect(page.locator('.plan-decision.is-skipped [data-action="plan-undo"]')).toHaveCount(1);
  await page.locator('.plan-decision.is-skipped [data-action="plan-undo"]').click();
  await expect(page.locator('.plan-decision.is-skipped')).toHaveCount(0);
  await expect(page.locator('[data-action="plan-accept"]')).toHaveCount(1);

  await page.evaluate(() => {
    Store.update((s) => {
      s.weeklyReviews['2026-11-16'].insights = [{
        kind: 'block-weak', score: 80,
        data: { id: 'a1', title: 'Skripsi', block: 'pagi', pct: 0.8, total: 10 },
        cta: 'edit-activity'
      }];
    }, true);
    document.dispatchEvent(new CustomEvent('app:force-render'));
  });
  // Insight tampil di tab ringkasan, bukan tab rencana.
  await page.locator('[data-action="eval-tab"][data-tab="ringkasan"]').click();
  await page.locator('[data-action="insight-edit"]').click();
  await expect(page.locator('#modal-form')).toBeVisible();
  await expect(page.locator('#f-title')).toHaveValue('Skripsi');
  await page.locator('#modal-close').click();
});

test('N-03: pengingat tetap tampil di aplikasi tanpa izin notifikasi browser', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      if (typeof Notification === 'function') {
        Object.defineProperty(Notification, 'permission', { get: () => 'denied', configurable: true });
      }
    } catch { /* abbaikan */ }
  });
  await openAt(page, jakarta(2026, 11, 23, 8, 49));
  await seedState(page, (s) => {
    s.settings.strictSince = '2026-11-01';
    s.settings.notifications.enabled = true;
    s.settings.notifications.activity = true;
    s.notified = {};
    s.activities = [{
      id: 'notif-a', title: 'Rapat pengingat', dayOfWeek: 1, category: 'Pribadi',
      startTime: '09.00', endTime: '09.20', isRecurring: true
    }];
  });
  // Berhenti segera setelah tick 60 detik: timer toast 3,2 detik belum menghapusnya.
  await page.clock.runFor(61000);
  const keys = await page.evaluate(() => Object.keys(Store.state.notified).filter((k) => k.includes('notif-a')));
  expect(keys).toEqual(['2026-11-23:activity:notif-a']);
  await expect(page.locator('#toast-root')).toContainText('Segera: Rapat pengingat');
});

test('audit: status sidebar sesuai mode setelah navigasi', async ({ page }) => {
  const desktop = test.info().project.name === 'chromium';
  await openAt(page, jakarta(2026, 11, 23, 10, 0), 'dashboard');
  await page.locator('[data-nav="jadwal"]:visible').first().click();
  await expect(page).toHaveURL(/#\/jadwal$/);
  // Desktop memakai rail permanen; mobile menyembunyikan drawer saat tertutup.
  expect(await page.locator('.sidebar').getAttribute('aria-hidden')).toBe(desktop ? null : '');
  expect(await page.locator('main').getAttribute('inert')).toBe(null);
});
