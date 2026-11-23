const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createEnv, singleActivityEnv, ROOT } = require('./helpers');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* ---------------- R-01 / R-02 / N-02 ---------------- */

test('R-01: input impor permanen tetap ada di halaman', () => {
  const html = read('index.html');
  const pages = read('js/pages.js');
  assert.match(html, /<input[^>]+id="import-file"[^>]+accept="application\/json,\.json"[^>]*hidden>/);
  assert.match(pages, /'import-trigger'\(\)\s*\{\s*document\.getElementById\('import-file'\)\.click\(\);/);
});

test('R-02: terapkan template tidak menggandakan ID dan mempertahankan edit', () => {
  const env = createEnv();
  const edited = env.Store.state.activities.find((a) => a.isTemplate);
  assert.ok(edited, 'harus ada aktivitas template bawaan');
  env.Store.update((s) => {
    const a = s.activities.find((x) => x.id === edited.id);
    a.title = 'Aktivitas hasil edit';
    a.userEdited = true;
  });
  const result = env.Store.applyTemplate();
  const ids = env.Store.state.activities.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, 'ID harus unik');
  const kept = env.Store.state.activities.find((a) => a.id === edited.id);
  assert.equal(kept.title, 'Aktivitas hasil edit');
  assert.ok(result.skipped >= 1);
});

test('R-02: normalisasi state membongkar duplikat ID lama', () => {
  const env = createEnv();
  const a = env.Store.normalizeState({}).activities[0];
  const cleaned = env.Store.normalizeState({ activities: [a, { ...a }] });
  assert.equal(cleaned.activities.length, 1);
});

test('N-02: autosave catatan lewat Store tidak kalah dengan reload antar-tab', () => {
  const env = createEnv();
  env.Store.saveMentorNotes('Catatan baru');
  assert.equal(env.saved().mentorshipNotes, 'Catatan baru');

  env.Store.state.mentorshipNotes = 'Tulisan terakhir';
  env.Store.persistSoon();
  env.Store.update((s) => { s.settings.name = 'Uji'; }, true);
  const saved = env.saved();
  assert.equal(saved.mentorshipNotes, 'Tulisan terakhir');
  assert.equal(saved.settings.name, 'Uji');
});

/* ---------------- Jendela Aktif ---------------- */

const DAY = [2026, 10, 23]; // Senin

function outcomeAt(hour, minute, opts = {}) {
  const env = singleActivityEnv(opts);
  const date = env.date(...DAY);
  const now = env.date(2026, 10, 23, hour, minute, 0);
  const activity = env.Store.state.activities[0];
  const result = env.Store.setActivityStatus(activity.id, date, 'completed', { now });
  return { env, date, activity, result };
}

test('Jendela Aktif: mulai inklusif, akhir eksklusif, plus grace 10 menit', () => {
  // Aktivitas pendek (<20 menit) agar satu langkah complete diuji, bukan alur dua langkah.
  const opts = { start: '07.00', end: '07.10' };
  assert.equal(outcomeAt(6, 59, opts).result.ok, false, 'sebelum mulai ditolak');
  assert.equal(outcomeAt(7, 0, opts).result.ok, true, 'tepat mulai diterima');
  assert.equal(outcomeAt(7, 19, opts).result.ok, true, 'dalam grace diterima');
  const late = outcomeAt(7, 20, opts);
  assert.equal(late.result.ok, false, 'tepat lastTick ditolak');
  assert.equal(Object.keys(late.env.Store.state.completion).length, 0, 'penolakan tidak menulis status');
});

test('Jendela Aktif: durasi 0 tetap punya jendela 10 menit', () => {
  const env = singleActivityEnv({ start: '07.00', end: '07.00' });
  const win = env.Store.windowFor(env.Store.state.activities[0], env.date(...DAY));
  assert.equal((win.closesAt - win.opensAt) / 60000, 10);
  assert.equal((win.lastTick - win.opensAt) / 60000, 20);
});

test('Jendela Aktif: aktivitas >=20 menit wajib dua langkah', () => {
  const env = singleActivityEnv({ start: '07.00', end: '07.30' });
  const date = env.date(...DAY);
  const activity = env.Store.state.activities[0];
  const start = env.Store.setActivityStatus(activity.id, date, 'inprogress', { now: env.date(2026, 10, 23, 7, 0, 0) });
  assert.equal(start.ok, true);
  const done = env.Store.setActivityStatus(activity.id, date, 'completed', { now: env.date(2026, 10, 23, 7, 12, 0) });
  assert.equal(done.ok, true);
  const rec = env.Store.state.completion['2026-11-23'][activity.id];
  assert.equal(rec.s, 'completed');
  assert.ok(rec.startedAt, 'waktu mulai tetap tersimpan');
  assert.equal(rec.src, 'live');
});

test('Jendela Aktif: penandaan di luar jendela ditolak di lapisan Store', () => {
  const env = singleActivityEnv();
  const date = env.date(...DAY);
  const id = env.Store.state.activities[0].id;
  const check = env.Store.canMark(id, date, 'complete', env.date(2026, 10, 23, 3, 0, 0));
  assert.equal(check.ok, false);
  assert.match(check.reason, /Buka pukul/);
  assert.equal(env.Store.setActivityStatus(id, date, 'completed', { now: env.date(2026, 10, 23, 3, 0, 0) }).ok, false);
});

test('Jendela Aktif langsung berlaku pada instalasi baru (bukan Senin depan)', () => {
  const env = createEnv();
  const today = new Date();
  assert.equal(env.Store.state.settings.strictSince, env.Utils.weekKey(today));
  const win = env.Store.windowFor(env.Store.state.activities[0], env.Utils.dateKey(today), today);
  assert.equal(win.legacy, false, 'tanggal hari ini tidak boleh memakai jalur lama');
});

test('Migrasi menarik strictSince masa depan ke Senin pekan berjalan', () => {
  const env = createEnv();
  const base = env.Store.normalizeState({});
  const future = env.Utils.dateKey(env.Utils.addDays(new Date(), 30));
  const migrated = env.Store.normalizeState({
    ...base, settings: { ...base.settings, strictSince: future }
  });
  assert.equal(migrated.settings.strictSince, env.Utils.weekKey(new Date()));
  const past = '2020-01-01';
  const kept = env.Store.normalizeState({
    ...base, settings: { ...base.settings, strictSince: past }
  });
  assert.equal(kept.settings.strictSince, past, 'nilai lama tidak boleh dimundurkan');
});

test('Jendela Aktif: aktivitas terlewat terkunci pada instalasi baru', () => {
  const env = createEnv();
  const tomorrow = env.Utils.addDays(new Date(), 1);
  const key = env.Utils.dateKey(tomorrow);
  const now = env.date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 25, 0);
  const activity = {
    id: 'terlewat', title: 'Aktivitas uji', dayOfWeek: env.Utils.dow(tomorrow),
    category: 'Pribadi', startTime: '00.00', endTime: '00.05',
    isRecurring: true, isTemplate: false
  };
  env.Store.update((s) => { s.activities = [activity]; });
  const res = env.Store.setActivityStatus(activity.id, key, 'completed', { now });
  assert.equal(res.ok, false);
  assert.match(res.reason, /Jendela sudah ditutup/);
  assert.equal(Object.keys(env.Store.state.completion).length, 0, 'penolakan tidak menulis status');
});

test('Anti-retroaktif: tanggal sebelum strictSince memakai jalur lama', () => {
  const env = singleActivityEnv();
  const strict = env.Store.state.settings.strictSince;
  const before = env.Utils.addDays(env.Utils.fromKey(strict), -1);
  const key = env.Utils.dateKey(before);
  const now = new Date(before.getFullYear(), before.getMonth(), before.getDate(), 3, 0, 0);
  const win = env.Store.windowFor(env.Store.state.activities[0], key, now);
  assert.equal(win.legacy, true);
  const res = env.Store.setActivityStatus(env.Store.state.activities[0].id, key, 'completed', { now });
  assert.equal(res.ok, true);
  assert.equal(env.Store.state.completion[key][env.Store.state.activities[0].id].src, 'legacy');
});

test('Migrasi v2: string completion lama dibaca sebagai status v3', () => {
  const env = createEnv();
  const base = env.Store.normalizeState({});
  const a = base.activities[0];
  const legacy = {
    version: 2,
    settings: base.settings,
    activities: [a, { ...a }],
    completion: { '2026-11-23': { [a.id]: 'completed' } },
    shopping: [], tasks: []
  };
  const migrated = createEnv(legacy).Store.state;
  assert.equal(migrated.version, 3);
  assert.equal(migrated.activities.length, 1);
  assert.equal(migrated.weeklyReviews && typeof migrated.weeklyReviews, 'object');
  assert.equal(migrated.completion['2026-11-23'][a.id].s, 'completed');
  assert.equal(migrated.completion['2026-11-23'][a.id].src, 'legacy');
});

/* ---------------- Evaluasi Mingguan ---------------- */

function reviewState(count, { expiredKeys = [], status = 'final' } = {}) {
  const probe = createEnv();
  const base = probe.Store.normalizeState({});
  const reviews = {};
  const monday = new probe.date(2026, 10, 23);
  for (let i = 1; i <= count; i += 1) {
    const d = new probe.date(monday.getTime());
    d.setDate(d.getDate() - 7 * i);
    const key = probe.Utils.dateKey(d);
    reviews[key] = {
      weekKey: key,
      status,
      generatedAt: new probe.date(2026, 10, 26, 9, 0, 0).toISOString(),
      expiresAt: expiredKeys.includes(key)
        ? new probe.date(2026, 10, 1, 9, 0, 0).toISOString()
        : new probe.date(2026, 12, 30, 9, 0, 0).toISOString(),
      seen: false,
      items: [], insights: [], plan: [], daily: [], score: 50, done: 1, total: 2
    };
  }
  return createEnv({ ...base, weeklyReviews: reviews });
}

test('D.1: pratinjau Minggu 21.00 lalu final Senin 09.00', () => {
  const env = singleActivityEnv();
  const previewNow = env.date(2026, 10, 22, 21, 30, 0); // Minggu 21.30
  env.Store.ensureReviews(previewNow);
  const preview = env.Store.reviewFor('2026-11-16', previewNow);
  assert.equal(preview.status, 'preview');
  assert.equal(new Date(preview.generatedAt).getDay(), 0, 'pratinjau dibuat pada Minggu');
  assert.equal(new Date(preview.generatedAt).getHours(), 21, 'pukul 21.00');

  const finalNow = env.date(2026, 10, 23, 9, 30, 0); // Senin 09.30
  env.Store.ensureReviews(finalNow);
  const final = env.Store.reviewFor('2026-11-16', finalNow);
  assert.equal(final.status, 'final');
  assert.equal(new Date(final.generatedAt).getDay(), 1, 'final dibuat pada Senin');
  assert.equal(new Date(final.generatedAt).getHours(), 9, 'pukul 09.00');
});

test('Retensi: 5 laporan dipangkas menjadi 4', () => {
  const env = reviewState(5);
  env.Store.ensureReviews(env.date(2026, 10, 23, 12, 0, 0));
  const keys = Object.keys(env.Store.state.weeklyReviews);
  assert.equal(keys.length, 4);
});

test('Retensi: laporan kedaluwarsa belum dibuka ditahan sampai seen', () => {
  const probe = createEnv();
  const base = probe.Store.normalizeState({});
  const key = '2026-10-12';
  const expired = {
    [key]: {
      weekKey: key, status: 'final', score: 0, done: 0, total: 1,
      generatedAt: new probe.date(2026, 10, 19, 9, 0, 0).toISOString(),
      expiresAt: new probe.date(2026, 10, 20, 9, 0, 0).toISOString(),
      seen: false, items: [], insights: [], plan: [], daily: []
    }
  };
  const env = createEnv({ ...base, weeklyReviews: expired });
  const now = env.date(2026, 10, 23, 12, 0, 0);
  assert.equal(env.Store.reviewList(now).length, 1, 'belum dibuka → masih tampil');
  env.Store.markReviewSeen(key);
  assert.equal(env.Store.state.weeklyReviews[key], undefined, 'sudah dibuka → dihapus');
});

test('Impor: laporan kedaluwarsa dilewati dan tidak memperpanjang umur', () => {
  const probe = createEnv();
  const base = probe.Store.normalizeState({});
  const payload = {
    activities: base.activities,
    weeklyReviews: {
      '2026-10-12': {
        status: 'final',
        generatedAt: new probe.date(2026, 10, 19, 9, 0, 0).toISOString(),
        expiresAt: new probe.date(2026, 10, 20, 9, 0, 0).toISOString()
      }
    }
  };
  const result = probe.Store.describeImport(JSON.stringify(payload));
  assert.equal(result.skippedReviews, 1);
  assert.equal(Object.keys(result.state.weeklyReviews).length, 0);
  assert.match(result.summary, /1 laporan kedaluwarsa dilewati/);
});

test('Insight maksimal 3 dan rencana maksimal 5', () => {
  const env = createEnv();
  env.Store.update((s) => {
    s.settings.strictSince = '2000-01-01';
    s.activities = Array.from({ length: 6 }, (_, i) => ({
      id: 'x' + i, title: 'Aktivitas ' + i, dayOfWeek: 1, category: 'Pribadi',
      startTime: '07.' + String(i).padStart(2, '0'), endTime: '08.' + String(i).padStart(2, '0'),
      isRecurring: true, isTemplate: false
    }));
  });
  const review = env.Store.ensureReviews(env.date(2026, 10, 26, 9, 0, 0));
  assert.ok(review.created >= 1);
  const list = env.Store.reviewList(env.date(2026, 10, 26, 9, 0, 0));
  assert.ok(list.length >= 1);
  assert.ok(list[0].insights.length <= 3);
  assert.ok(list[0].plan.length <= 5);
  assert.equal(list[0].status, 'final');
});

/* ---------------- Statis: aksesibilitas, kalender, target sentuh ---------------- */

test('N-03: heading kosong/terbalik diganti elemen teks', () => {
  const pages = read('js/pages.js');
  assert.doesNotMatch(pages, /<h3>\$\{esc\(s\.settings\.thesisTopic\)\}<\/h3>/);
  assert.match(pages, /class="thesis-topic"/);
  assert.match(pages, /class="fruit-summary-title"/);
});

test('D.2: ICS memuat dua pengingat mingguan evaluasi', () => {
  const pages = read('js/pages.js');
  // UID dan BYDAY dirakit dari variabel, jadi yang diuji adalah pola sumbernya.
  for (const needle of [
    "uid: 'review-preview'", "uid: 'review-final'",
    "byday: 'SU'", "byday: 'MO'",
    'TRIGGER:PT0M', 'RRULE:FREQ=WEEKLY;BYDAY=${e.byday}'
  ]) {
    assert.ok(pages.includes(needle), `ICS harus memuat ${needle}`);
  }
});

test('V-09: target sentuh nyata 44 px tanpa pengecualian kecil', () => {
  const css = read('css/styles.css');
  assert.match(css, /\.check\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/s);
  assert.match(css, /\.btn-icon-sm\s*\{[^}]*width:\s*44px;\s*height:\s*44px/s);
  assert.match(css, /\.mini-input\s*\{[^}]*height:\s*44px/s);
  assert.doesNotMatch(css, /\.week-grid \.check \{ width: 24px/);
  assert.doesNotMatch(css, /\.activity-tools \.btn-icon-sm \{ width: 30px/);
});

test('F-11: interval memakai pembaruan terarah, bukan render penuh', () => {
  const app = read('js/app.js');
  assert.match(app, /else Pages\.refreshLiveStates\(\);/);
  assert.match(app, /function syncReviews\(\)/);
});
