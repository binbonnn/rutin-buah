/* v1.3.0 — S9 (skalabel), S1 (penjadwalan), S2 (insight murni). */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createEnv, singleActivityEnv, setClock } = require('./helpers');

const WEEK = '2026-11-16';

/* ---------------- S9: penyimpanan skalabel ---------------- */

test('S9: migrasi v5 mengompresi item dan mempertahankan teks lama', () => {
  const probe = createEnv();
  const base = probe.Store.normalizeState({});
  const legacy = {
    ...base,
    version: 4,
    weeklyReviews: {
      [WEEK]: {
        weekKey: WEEK, status: 'final', generatedAt: '2026-11-23T02:00:00.000Z',
        expiresAt: '2027-01-01T00:00:00.000Z', score: 0, done: 0, total: 1,
        items: [{ date: WEEK, id: 'a1', title: 'Skripsi', time: '07.00', reason: 'Belum ditandai', duration: 60 }],
        skippedItems: [], waiting: [], daily: [], insights: [
          { kind: 'ringkasan', title: 'Konsisten', count: 80, detail: '1 dari 1 selesai' }
        ],
        plan: [{ id: 'plan-1', activityId: 'a1', title: 'Skripsi', date: WEEK, time: '07.00',
          action: 'Usulan (belum terjadwal otomatis)', accepted: false, skipped: false }]
      }
    }
  };
  const env = createEnv(legacy);
  const r = env.Store.reviewFor(WEEK);
  assert.deepEqual(Object.keys(r.items[0]).sort(), ['d', 'id', 's']);
  assert.equal(r.items[0].s, 'm');
  assert.equal(r.titles.a1[0], 'Skripsi');
  assert.equal(r.titles.a1[1], '07.00');
  assert.equal(env.Store.reviewItems(r)[0].title, 'Skripsi');
  assert.equal(env.Store.reviewItems(r)[0].cat, 'Pribadi');
  assert.equal(r.plan[0].status, 'proposed');
  assert.equal(r.plan[0].action, 'Usulan (belum terjadwal otomatis)');
  assert.equal(r.insights[0].kind, 'legacy');
  assert.match(env.Store.insightText(r.insights[0]), /Konsisten/);
});

test('S9: dayPlans v4 dipindahkan ke daySnapshots kompak', () => {
  const probe = createEnv();
  const base = probe.Store.normalizeState({});
  const legacy = {
    ...base, version: 4,
    dayPlans: { '2026-11-16': [{ id: 'a1', title: 'Skripsi', startTime: '07.00', endTime: '08.00', category: 'Skripsi' }] }
  };
  const env = createEnv(legacy);
  assert.equal(env.Store.state.version, 5);
  assert.equal(env.Store.state.dayPlans, undefined);
  assert.equal(JSON.stringify(env.Store.state.daySnapshots['2026-11-16'].a[0]),
    JSON.stringify(['a1', '07.00', '08.00', 'Skripsi', 'Skripsi']));
  assert.equal(env.Store.state.daySnapshots['2026-11-16'].v, 1);
});

test('S9: simulasi 52 minggu tetap di bawah 350 KB dan laporan di bawah 6 KB', () => {
  const env = createEnv();
  setClock(env, '2026-11-24T02:30:00.000Z'); // Senin 09.30 Asia/Jakarta
  env.Store.update((s) => {
    s.firstUseAt = env.date(2025, 10, 24, 8, 0, 0).toISOString();
    s.settings.strictSince = '2000-01-01';
    s.activities = [{
      id: 'a1', title: 'Aktivitas uji', dayOfWeek: 1, category: 'Pribadi',
      startTime: '07.00', endTime: '07.30', isRecurring: true, isTemplate: false
    }];
    s.completion = {};
    for (let i = 0; i < 364; i += 1) {
      const day = env.Utils.dateKey(env.Utils.addDays(env.date(2025, 10, 24), i));
      s.completion[day] = {
        a1: { s: 'completed', startedAt: null, at: day + 'T00:10:00.000Z', src: 'legacy', title: 'Aktivitas uji', startTime: '07.00', dur: null }
      };
    }
  }, true);
  env.Store.ensureReviews(new Date('2026-11-24T02:30:00.000Z'));
  const stateSize = JSON.stringify(env.Store.state).length;
  assert.ok(stateSize < 350000, `state terlalu besar: ${stateSize} byte`);
  const review = env.Store.reviewList()[0];
  assert.ok(review, 'laporan final harus ada');
  const reviewSize = JSON.stringify(review).length;
  assert.ok(reviewSize < 6000, `laporan terlalu besar: ${reviewSize} byte`);
  assert.ok(Object.keys(env.Store.state.daySnapshots).length <= 35);
});

test('S9: tanpa IndexedDB arsip tidak memindahkan apa pun', async () => {
  const env = singleActivityEnv();
  env.Archive.available = () => false;
  env.Store.update((s) => {
    s.completion = { '2020-01-01': { a1: { s: 'completed', at: null, src: 'legacy' } } };
    s.consumption = [{ id: 'c1', date: '2020-01-01', fruitId: 'f1', servingCount: 1 }];
  }, true);
  const result = await env.Store.archiveOld(env.date(2026, 10, 24));
  assert.equal(result.completion, 0);
  assert.equal(result.consumption, 0);
  assert.ok(env.Store.state.completion['2020-01-01']);
  assert.equal(env.Store.state.consumption.length, 1);
});

test('S9: tulis arsip dulu, hapus kemudian, dan ekspor→impor mempertahankan arsip', async () => {
  const env = singleActivityEnv();
  const stored = { 'completion-old': new Map(), 'consumption-old': new Map() };
  env.Archive.available = () => true;
  env.Archive.put = (store, key, value) => { stored[store].set(key, value); return Promise.resolve(true); };
  env.Archive.all = (store) => Promise.resolve(Object.fromEntries(stored[store]));
  env.Store.update((s) => {
    s.completion = { '2020-01-01': { a1: { s: 'completed', at: null, src: 'legacy', title: 'Aktivitas uji' } } };
    s.consumption = [{ id: 'c1', date: '2020-01-01', fruitId: 'f1', servingCount: 1 }];
  }, true);
  const result = await env.Store.archiveOld(env.date(2026, 10, 24));
  assert.equal(result.completion, 1);
  assert.equal(result.consumption, 1);
  assert.equal(env.Store.state.completion['2020-01-01'], undefined);
  assert.equal(env.Store.state.consumption.length, 0);

  const json = await env.Store.exportDataAsync();
  const payload = JSON.parse(json);
  assert.equal(payload.schemaVersion, 5);
  assert.ok(payload.archive.completion['2020-01-01']);
  assert.ok(payload.archive.consumption.c1);

  env.Store.reset();
  stored['completion-old'].clear();
  stored['consumption-old'].clear();
  await env.Store.importDataAsync(json);
  assert.ok(stored['completion-old'].has('2020-01-01'));
  assert.ok(stored['consumption-old'].has('c1'));
});

/* ---------------- S1: penjadwalan pemulihan ---------------- */

test('S1: findSlot memakai celah pertama dan penyangga 5 menit', () => {
  const env = createEnv();
  const base = env.Store.normalizeState({});
  base.firstUseAt = '2026-01-01T00:00:00.000Z';
  base.activities = [{
    id: 'a1', title: 'Rapat', dayOfWeek: 1, category: 'Pribadi',
    startTime: '07.00', endTime: '08.00', isRecurring: true
  }];
  const now = env.date(2026, 10, 23, 5, 30, 0); // Senin
  const slot = env.Planner.findSlot({ from: '2026-11-23', durationMin: 30, now }, base, env.Store.activitiesForDayIn);
  assert.equal(slot.date, '2026-11-23');
  assert.ok(slot.end <= '08.05', `slot ${slot.start}–${slot.end} harus di luar jam sibuk + penyangga`);
  assert.equal(env.Planner.isSlotFree(base, { date: '2026-11-23', start: '07.30', end: '08.00' }, null,
    env.Store.activitiesForDayIn), false);
});

test('S1: findSlot pindah hari bila penuh, melewati hari istirahat, dan mematuhi batas beban', () => {
  const env = createEnv();
  const base = env.Store.normalizeState({});
  base.firstUseAt = '2026-01-01T00:00:00.000Z';
  base.restDays = ['2026-11-24'];
  base.settings.recoveryMaxPerDay = 30;
  base.activities = [
    { id: 'full', title: 'Penuh', dayOfWeek: 1, category: 'Pribadi', startTime: '05.00', endTime: '21.30', isRecurring: true },
    { id: 'heavy', title: 'Pemulihan', dayOfWeek: 2, category: 'Pribadi', startTime: '09.00', endTime: '09.30', isRecurring: false, date: '2026-11-24', origin: 'recovery' }
  ];
  const now = env.date(2026, 10, 23, 5, 30, 0);
  const slot = env.Planner.findSlot({ from: '2026-11-23', durationMin: 30, now }, base, env.Store.activitiesForDayIn);
  assert.equal(slot.date, '2026-11-25');
});

test('S1: findSlot tidak menimpa Ibadah dan tidak melewati waktu tidur', () => {
  const env = createEnv();
  const base = env.Store.normalizeState({});
  base.firstUseAt = '2026-01-01T00:00:00.000Z';
  base.settings.bedtime = '21.00';
  base.activities = [{
    id: 'ibadah', title: 'Ibadah', dayOfWeek: 1, category: 'Ibadah',
    startTime: '19.00', endTime: '20.00', isRecurring: true
  }];
  const now = env.date(2026, 10, 23, 6, 0, 0);
  const slot = env.Planner.findSlot({ from: '2026-11-23', durationMin: 30, preferTime: '19.00', now }, base,
    env.Store.activitiesForDayIn);
  assert.equal(slot.date, '2026-11-23');
  assert.ok(slot.end <= '20.55', `slot ${slot.start}–${slot.end} harus di luar Ibadah + penyangga`);
  assert.ok(slot.end <= '20.30', 'tidak boleh melewati bedtime − 30 menit');
});

test('S1: kronis tiga minggu berturut-turut menghasilkan satu item chronic', () => {
  const base = createEnv().Store.normalizeState({});
  // Tiga laporan final sebelumnya mencatat "Skripsi" sebagai tidak tercatat.
  const mk = (wk) => ({
    weekKey: wk, status: 'final', generatedAt: '2026-11-23T02:00:00.000Z',
    expiresAt: '2027-01-01T00:00:00.000Z', score: 0, done: 0, total: 1,
    items: [{ d: wk, id: 'a1', s: 'm' }], titles: { a1: ['Skripsi', '07.00', 'Skripsi'] },
    skippedItems: [], waiting: [], daily: [], insights: [], plan: []
  });
  base.firstUseAt = '2026-01-01T00:00:00.000Z';
  base.settings.strictSince = '2000-01-01';
  base.activities = [{
    id: 'a1', templateId: 't1', title: 'Skripsi', dayOfWeek: 1, category: 'Skripsi',
    startTime: '07.00', endTime: '08.00', isRecurring: true, isTemplate: true
  }];
  // Minggu berjalan sengaja tidak disemin; ensureReviews yang membangunnya.
  base.weeklyReviews = Object.fromEntries(['2026-10-26', '2026-11-02', '2026-11-09'].map((wk) => [wk, mk(wk)]));
  const env = createEnv(base);
  env.Store.ensureReviews(env.date(2026, 10, 23, 9, 30, 0));
  const r = env.Store.reviewList(env.date(2026, 10, 23, 9, 30, 0))[0];
  const chronic = r.plan.filter((p) => p.kind === 'chronic');
  assert.equal(chronic.length, 1);
  assert.equal(chronic[0].status, 'proposed');
  assert.ok(chronic[0].suggested, 'item kronis juga perlu usulan jam');
  const kept = env.Store.resolveChronic(r.weekKey, chronic[0].id, 'keep');
  assert.equal(kept.ok, true);
  assert.ok(Date.parse(env.Store.state.chronicDismissedUntil.t1) > Date.now());
});

/* ---------------- S2: insight berbasis pola (murni) ---------------- */

const baseArgs = {
  review: {
    score: 50, done: 10, total: 20,
    blockTotals: { pagi: 10, siang: 0, sore: 0, malam: 0 },
    blockMissed: { pagi: 4, siang: 0, sore: 0, malam: 0 },
    categoryStats: { Skripsi: { total: 10, done: 5 }, Ibadah: { total: 10, done: 5 } },
    lastMinute: { done: 6, grace: 2 }
  },
  prev: null, items: [], daily: [],
  firstUseAt: '2026-01-01T00:00:00.000Z',
  now: new Date('2026-11-23T02:00:00.000Z')
};

const cases = [
  ['data kurang dari 20 aktivitas', { review: { ...baseArgs.review, total: 19 } }, []],
  ['minggu pertama setelah pemakaian', { firstUseAt: '2026-11-20T00:00:00.000Z', review: { weekKey: WEEK } }, []],
  ['recurring-miss tepat 3', { items: misses(3, 'Skripsi') }, ['recurring-miss']],
  ['recurring-miss 2 tidak memicu', { items: misses(2, 'Skripsi') }, []],
  ['block-weak tepat 60%', { review: { ...baseArgs.review, blockTotals: { pagi: 10, siang: 0, sore: 0, malam: 0 }, blockMissed: { pagi: 6, siang: 0, sore: 0, malam: 0 } } }, ['block-weak']],
  ['block-weak 59% tidak memicu', { review: { ...baseArgs.review, blockTotals: { pagi: 100, siang: 0, sore: 0, malam: 0 }, blockMissed: { pagi: 59, siang: 0, sore: 0, malam: 0 } } }, []],
  ['worst-day tepat 25 poin', { daily: [{ key: '2026-11-16', total: 8, pct: 20 }, { key: '2026-11-17', total: 8, pct: 70 }] }, ['worst-day']],
  ['worst-day 24,5 poin tidak memicu', { daily: [{ key: '2026-11-16', total: 8, pct: 21 }, { key: '2026-11-17', total: 8, pct: 70 }] }, []],
  ['category-weak', { review: { ...baseArgs.review, categoryStats: { Skripsi: { total: 10, done: 5 }, Ibadah: { total: 10, done: 9 } } } }, ['category-weak']],
  ['trend tepat 10', { prev: { score: 40 } }, ['celebrate', 'trend']],
  ['trend 9 tidak memicu', { prev: { score: 41 } }, []],
  ['last-minute tepat 50% dari 6', { review: { ...baseArgs.review, lastMinute: { done: 6, grace: 3 } } }, ['last-minute']],
  ['celebrate skor 80 selalu menang', { review: { ...baseArgs.review, score: 80 } }, ['celebrate']]
];

function misses(count, category) {
  return Array.from({ length: count }, (_, i) => ({
    id: 'a1', title: 'Skripsi', time: '07.00', cat: category, s: 'm',
    date: `2026-11-${String(16 + i).padStart(2, '0')}`
  }));
}

function computeWith(overrides) {
  const env = createEnv();
  const args = {
    ...baseArgs, ...overrides,
    review: { ...baseArgs.review, ...(overrides.review || {}), weekKey: WEEK },
    now: baseArgs.now
  };
  return env.Insights.compute(args);
}

for (const [name, overrides, expected] of cases) {
  test(`S2: ${name}`, () => {
    const result = computeWith(overrides);
    if (!expected.length) assert.equal(result.length, 0, `${name} harus kosong`);
    else assert.equal(JSON.stringify(result.map((i) => i.kind)), JSON.stringify(expected));
    assert.ok(result.length <= 3, 'maksimal tiga insight');
  });
}

test('S2: keberagaman kind dan teks tanpa frasa terlarang', () => {
  const env = createEnv();
  const kinds = ['celebrate', 'recurring-miss', 'block-weak', 'worst-day', 'category-weak', 'trend', 'last-minute'];
  const text = kinds.map((kind) => env.Store.insightText({
    kind, score: 1, cta: '',
    data: { score: 90, delta: 10, count: 3, title: 'Skripsi', category: 'Skripsi', time: '07.00',
      days: ['2026-11-16', '2026-11-17', '2026-11-18'], block: 'pagi', pct: 0.75, total: 10, avg: 70,
      date: '2026-11-16', done: 8, grace: 5 }
  })).join('\n');
  for (const banned of ['gagal', 'malas', 'kurang disiplin']) {
    assert.equal(text.toLowerCase().includes(banned), false, `frasa terlarang: ${banned}`);
  }
  const mixed = computeWith({ items: misses(3, 'Skripsi') });
  const unique = new Set(mixed.map((i) => i.kind));
  assert.equal(unique.size, mixed.length, 'kind tidak boleh dobel bila ada kandidat lain');
});

test('S2: Pages.insightText tersedia dan mengembalikan teks dari data', () => {
  const pages = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js', 'pages.js'), 'utf8');
  assert.match(pages, /insightText,\s*setViewDate/);
  assert.match(pages, /Data belum cukup untuk saran minggu ini\./);
});
