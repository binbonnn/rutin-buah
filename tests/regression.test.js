const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createEnv, singleActivityEnv, setClock, ROOT } = require('./helpers');

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
  assert.equal(migrated.version, 5);
  assert.equal(migrated.activities.length, 1);
  assert.equal(migrated.weeklyReviews && typeof migrated.weeklyReviews, 'object');
  assert.equal(migrated.completion['2026-11-23'][a.id].s, 'completed');
  assert.equal(migrated.completion['2026-11-23'][a.id].src, 'legacy');
  assert.equal(migrated.firstUseAt, new Date(env.Utils.atMinutes('2026-11-23', 0)).toISOString());
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
  env.Store.update((s) => { s.firstUseAt = env.date(2026, 10, 1, 8, 0, 0).toISOString(); }, true);
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
    s.firstUseAt = env.date(2026, 10, 1, 8, 0, 0).toISOString();
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

/* ---------------- v1.2.2: audit V3 ---------------- */

test('Schema 5: cadangan pra-migrasi ditulis sebelum data diubah', () => {
  const probe = createEnv();
  const base = probe.Store.normalizeState({});
  const legacy = { ...base, version: 3 };
  const env = createEnv(legacy);
  assert.equal(env.storage.get('rutin-buah:v1:pre-migrate-v3'), JSON.stringify(legacy));
  // Migrasi terjadi di memori dulu; data lama belum ditimpa sampai persist().
  assert.equal(env.saved().version, 3);
  assert.equal(env.Store.state.version, 5);
  assert.ok(env.Store.state.firstUseAt, 'firstUseAt harus terisi setelah migrasi');
});

test('Schema 5: slot pra-migrasi lama dibersihkan saat migrasi berikutnya', () => {
  const probe = createEnv();
  const base = probe.Store.normalizeState({});
  const legacy = { ...base, version: 3 };
  const env = createEnv(legacy);
  env.storage.set('rutin-buah:v1', JSON.stringify(legacy));
  env.storage.set('rutin-buah:v1:pre-migrate-v2', 'cadangan usang');
  env.Store.reloadFromStorage();
  assert.equal(env.storage.has('rutin-buah:v1:pre-migrate-v2'), false);
  assert.equal(env.storage.has('rutin-buah:v1:pre-migrate-v3'), true);
});

test('V3-01: instalasi baru tidak membuat laporan minggu sebelum dipakai', () => {
  const env = createEnv();
  env.Store.ensureReviews(new Date());
  assert.deepEqual(Object.keys(env.Store.state.weeklyReviews), []);
});

test('V3-01: minggu pertama baru dilaporkan bila ada catatan completion', () => {
  const env = createEnv();
  const monday = env.Utils.startOfWeek(new Date());
  const firstUse = env.Utils.addDays(monday, 1);
  const sunday = env.Utils.addDays(monday, 6);
  const sundayNow = new Date(env.Utils.atMinutes(env.Utils.dateKey(sunday), 21 * 60 + 5));
  env.Store.update((s) => {
    s.firstUseAt = new Date(env.Utils.atMinutes(env.Utils.dateKey(firstUse), 9 * 60)).toISOString();
  }, true);
  env.Store.ensureReviews(sundayNow);
  assert.equal(env.Store.reviewFor(env.Utils.dateKey(monday), sundayNow), null);

  const key = env.Utils.dateKey(firstUse);
  env.Store.update((s) => {
    s.completion[key] = { a1: { s: 'completed', at: new Date().toISOString(), src: 'live' } };
  }, true);
  env.Store.ensureReviews(sundayNow);
  const review = env.Store.reviewFor(env.Utils.dateKey(monday), sundayNow);
  assert.equal(review.status, 'preview');
  assert.equal(review.done, 1);
});

test('V3-01: bersihkan hanya laporan 0% dari minggu sebelum pemakaian', () => {
  const probe = createEnv();
  const base = probe.Store.normalizeState({});
  const make = (weekKey, done) => ({
    weekKey, status: 'final', done, total: 10, skippedCount: 0,
    generatedAt: new probe.date(2026, 10, 19, 9, 0, 0).toISOString(),
    expiresAt: new probe.date(2026, 12, 30, 9, 0, 0).toISOString(),
    seen: false, items: [], waiting: [], insights: [], plan: [], daily: []
  });
  const env = createEnv({
    ...base,
    firstUseAt: new probe.date(2026, 10, 26, 9, 0, 0).toISOString(),
    weeklyReviews: { '2026-10-12': make('2026-10-12', 0), '2026-11-16': make('2026-11-16', 2) }
  });
  assert.equal(env.Store.cleanupFakeReviews(), 1);
  assert.equal(env.Store.state.weeklyReviews['2026-10-12'], undefined);
  assert.ok(env.Store.state.weeklyReviews['2026-11-16'], 'laporan dengan catatan tidak boleh terhapus');
});

test('V3-02: hari istirahat tidak menimpa atau menghapus penandaan selesai', () => {
  const env = singleActivityEnv();
  const todayKey = env.Utils.dateKey(new Date());
  const day = env.Utils.dow(new Date());
  env.Store.update((s) => {
    s.activities = [
      { ...s.activities[0], dayOfWeek: day },
      { id: 'a2', title: 'Aktivitas kedua', dayOfWeek: day, category: 'Pribadi', startTime: '07.00', endTime: '08.00', isRecurring: true, isTemplate: false }
    ];
    s.completion = {};
  }, true);
  const nowStart = env.date(env.Utils.atMinutes(todayKey, 7 * 60 + 5));
  const now = env.date(env.Utils.atMinutes(todayKey, 7 * 60 + 30));
  assert.equal(env.Store.setActivityStatus('a1', todayKey, 'inprogress', { now: nowStart }).ok, true);
  assert.equal(env.Store.setActivityStatus('a1', todayKey, 'completed', { now }).ok, true);
  assert.equal(env.Store.setRestDay(todayKey, true).ok, true);
  assert.equal(env.Store.statusOf(env.Store.state.completion[todayKey].a1), 'completed');
  assert.equal(env.Store.statusOf(env.Store.state.completion[todayKey].a2), 'excused');
  assert.equal(env.Store.setRestDay(todayKey, false).ok, true);
  assert.equal(env.Store.statusOf(env.Store.state.completion[todayKey].a1), 'completed');
  assert.equal(env.Store.statusOf(env.Store.state.completion[todayKey].a2), '');
});

test('V3-04: laporan kedaluwarsa belum dibuka dihapus setelah 14 hari', () => {
  const probe = createEnv();
  const base = probe.Store.normalizeState({});
  const key = '2026-09-07';
  const env = createEnv({
    ...base,
    firstUseAt: '2026-01-01T00:00:00.000Z',
    weeklyReviews: {
      [key]: {
        weekKey: key, status: 'final', done: 0, total: 10, skippedCount: 0,
        generatedAt: new probe.date(2026, 10, 5, 9, 0, 0).toISOString(),
        expiresAt: new probe.date(2026, 10, 1, 9, 0, 0).toISOString(),
        seen: false, items: [], waiting: [], insights: [], plan: [], daily: []
      }
    }
  });
  env.Store.ensureReviews(env.date(2026, 10, 23, 12, 0, 0));
  assert.equal(env.Store.state.weeklyReviews[key], undefined);
});

test('V3-04: jumlah laporan final tidak melebihi delapan', () => {
  const probe = createEnv();
  const base = probe.Store.normalizeState({});
  const reviews = {};
  for (let i = 0; i < 12; i += 1) {
    const d = probe.Utils.addDays(probe.date(2026, 10, 26), -7 * i);
    const key = probe.Utils.dateKey(d);
    reviews[key] = {
      weekKey: key, status: 'final', done: 2, total: 10, skippedCount: 0,
      generatedAt: new probe.date(2026, 9, 30, 9, 0, 0).toISOString(),
      expiresAt: new probe.date(2026, 10, 28, 9, 0, 0).toISOString(),
      seen: false, items: [], waiting: [], insights: [], plan: [], daily: []
    };
  }
  const env = createEnv({ ...base, firstUseAt: '2026-01-01T00:00:00.000Z', weeklyReviews: reviews });
  env.Store.ensureReviews(env.date(2026, 10, 1, 12, 0, 0));
  const finals = Object.values(env.Store.state.weeklyReviews).filter((r) => r.status === 'final');
  assert.ok(finals.length > 0 && finals.length <= env.Store.REVIEW_MAX_TOTAL);
});

test('V3-05: status tampilan mengikuti jendela, grace, dan jadwal lintas tengah malam', () => {
  // Aktivitas pendek memakai satu langkah, jadi grace bisa diuji langsung.
  const env = singleActivityEnv({ start: '07.45', end: '07.55' });
  const key = '2026-11-23';
  const at = (minutes) => new Date(env.Utils.atMinutes(key, minutes)).toISOString();
  const activity = env.Store.state.activities[0];
  setClock(env, at(7 * 60 + 50));
  assert.equal(env.Store.activityStatus(activity, key), 'ongoing');
  setClock(env, at(8 * 60));
  assert.equal(env.Store.activityStatus(activity, key), 'grace');
  assert.equal(env.Store.canMark(activity, key).ok, true);
  setClock(env, at(8 * 60 + 6));
  assert.equal(env.Store.activityStatus(activity, key), 'missed');

  const late = { ...activity, id: 'late', startTime: '23.30', endTime: '00.30' };
  env.Store.update((s) => { s.activities = [late]; s.completion = {}; }, true);
  setClock(env, at(23 * 60 + 45));
  assert.equal(env.Store.activityStatus(late, key), 'ongoing');
});

test('V3-07: pratinjau tidak menghitung aktivitas yang belum waktunya', () => {
  const env = singleActivityEnv();
  env.Store.update((s) => {
    s.firstUseAt = env.date(2026, 10, 1, 8, 0, 0).toISOString();
    s.activities = [{
      id: 'late', title: 'Aktivitas larut', dayOfWeek: 7, category: 'Pribadi',
      startTime: '21.10', endTime: '21.30', isRecurring: true, isTemplate: false
    }];
    s.completion = {};
  }, true);
  const now = new Date(env.Utils.atMinutes('2026-11-22', 21 * 60 + 5));
  env.Store.ensureReviews(now);
  const r = env.Store.reviewFor('2026-11-16', now);
  assert.equal(r.status, 'preview');
  assert.ok(r.waiting.some((i) => i.id === 'late' && i.reason === 'Menunggu'));
  assert.equal(r.items.some((i) => i.id === 'late'), false);
  assert.equal(r.total, 0);
  assert.equal(r.waitingCount, 1);
});

test('V3-08: laporan catch-up memakai jadwal yang dibekukan saat hari berlalu', () => {
  const env = singleActivityEnv();
  env.Store.update((s) => {
    s.firstUseAt = env.date(2026, 10, 10, 8, 0, 0).toISOString();
    s.activities = [{
      id: 'old', title: 'Jadwal lama', dayOfWeek: 1, category: 'Pribadi',
      startTime: '07.00', endTime: '08.00', isRecurring: true, isTemplate: false
    }];
    s.completion = {};
  }, true);
  env.Store.ensureReviews(new Date(env.Utils.atMinutes('2026-11-17', 10 * 60)));
  assert.ok(env.Store.state.daySnapshots['2026-11-16'], 'jadwal 16 Nov harus dibekukan');
  assert.equal(env.Store.state.daySnapshots['2026-11-16'].a[0][4], 'Jadwal lama');
  env.Store.update((s) => { s.activities = []; }, true);
  const reportNow = new Date(env.Utils.atMinutes('2026-11-24', 9 * 60 + 5));
  env.Store.ensureReviews(reportNow);
  const r = env.Store.reviewFor('2026-11-16', reportNow);
  assert.equal(r.status, 'final');
  assert.ok(env.Store.reviewItems(r).some((i) => i.id === 'old' && i.title === 'Jadwal lama'));
});

test('S1/V3-03: rencana dijadwalkan, diterima jadi satu aktivitas, dan bisa dibatalkan', () => {
  const env = singleActivityEnv();
  env.Store.update((s) => { s.firstUseAt = env.date(2026, 10, 1, 8, 0, 0).toISOString(); }, true);
  const now = env.date(2026, 10, 26, 9, 30, 0);
  env.Store.ensureReviews(now);
  const r = env.Store.reviewList(now)[0];
  assert.ok(r.plan.length);
  assert.ok(r.plan[0].suggested, 'rencana harus punya slot usulan');
  assert.equal(r.plan[0].status, 'proposed');
  assert.equal(r.plan[0].createdActivityId, null);

  const before = env.Store.state.activities.length;
  const accepted = env.Store.acceptPlan(r.weekKey, r.plan[0].id);
  assert.equal(accepted.ok, true, accepted.reason);
  assert.equal(env.Store.state.activities.length, before + 1);
  const created = env.Store.state.activities.find((a) => a.id === accepted.activityId);
  assert.equal(created.origin, 'recovery');
  assert.equal(created.recoveryOf, r.plan[0].activityId);
  assert.equal(created.isRecurring, false);
  assert.equal(created.date, r.plan[0].suggested.date);
  assert.equal(created.startTime, r.plan[0].suggested.start);

  const undone = env.Store.undoPlan(r.weekKey, r.plan[0].id);
  assert.equal(undone.ok, true, undone.reason);
  assert.equal(env.Store.state.activities.length, before);
  assert.equal(env.Store.reviewFor(r.weekKey).plan[0].status, 'proposed');
  assert.doesNotMatch(env.Store.reviewMarkdown(r.weekKey), /akan dihapus pada hari/);
  assert.match(env.Store.reviewMarkdown(r.weekKey), /Salinan ini milik Anda\. Laporan di app dihapus setelah/);
});

test('V3-06/V3-09/V3-10: perbaikan tampilan terkait hadir di stylesheet dan markup', () => {
  const css = read('css/styles.css');
  const pages = read('js/pages.js');
  assert.match(css, /\[data-theme="dark"\]\s+\.subtab\.is-active\s*\{\s*color:\s*var\(--primary-bright\)/);
  assert.match(css, /\.bento-check\s*\{[^}]*min-height:\s*44px/s);
  assert.match(css, /\.link-btn\s*\{[^}]*min-height:\s*44px/s);
  assert.match(pages, /function reviewDayGroups\(/);
  assert.match(pages, /Tampilkan semua \(\$\{rows\.length\}\)/);
  assert.match(pages, /<details class="review-day"/);
});
