/* ---------- Penyimpanan lokal & selektor data ---------- */
const Store = (() => {
  const KEY = 'rutin-buah:v1';
  const BACKUP_KEY = KEY + ':pre-import';
  const SCHEMA_VERSION = 3;
  const { mergeDefaults, dateKey, weekKey, dow, parseTime, dayName, number } = Utils;

  const arr = (v, fb) => (Array.isArray(v) ? v : fb);
  const obj = (v, fb) => (v && typeof v === 'object' && !Array.isArray(v) ? v : fb);
  const str = (v, fb = '') => (typeof v === 'string' ? v : fb);

  // C.10 / D.8: konstanta tunggal untuk Jendela Aktif dan retensi laporan.
  const MIN_WINDOW_MIN = 10;
  const TWO_STEP_MIN = 20;
  const GRACE_MAX = 30;
  const REVIEW_KEEP = 4;
  const CATCHUP_MAX = 4;
  const REVIEW_TTL_DAYS = 28;
  const REVIEW_RULE_VERSION = 3;
  const STORED_STATUS = new Set(['inprogress', 'completed', 'skipped', 'excused']);
  const RECORD_SRC = new Set(['live', 'grace', 'legacy', 'rest']);

  function defaultState() {
    return {
      version: SCHEMA_VERSION,
      settings: JSON.parse(JSON.stringify(Seed.settings)),
      activities: Seed.buildActivities(Seed.settings),
      completion: {},
      // v3: snapshot evaluasi & hari istirahat. completion sengaja tidak dibatasi.
      weeklyReviews: {},
      restDays: [],
      customTargets: {},
      tasks: JSON.parse(JSON.stringify(Seed.thesisTasks)),
      mentorshipNotes: '',
      fruitCatalog: JSON.parse(JSON.stringify(Seed.fruitCatalog)),
      inventory: Seed.initialInventory(),
      consumption: [],
      shopping: Seed.shoppingTemplate.map((i) => ({
        ...i, id: Utils.uid('shop'), templateId: i.id, weekKey: weekKey(new Date())
      })),
      generatedWeeks: [weekKey(new Date())],
      deletedTemplateIds: [], // F-07: template yang sengaja dihapus tidak dibuat ulang
      reminders: {},
      notified: {},
      lastBackupAt: '', // D-07: penanda cadangan terakhir (ekspor JSON)
      updatedAt: new Date().toISOString()
    };
  }

  /* ---------- C.3: satu pembaca status (string lama atau objek v3) ---------- */

  function normRecord(rec, nowIso = null) {
    if (typeof rec === 'string') {
      return STORED_STATUS.has(rec) ? { s: rec, at: null, src: 'legacy' } : null;
    }
    const o = obj(rec, null);
    if (!o || !STORED_STATUS.has(o.s)) return null;
    return {
      s: o.s,
      startedAt: str(o.startedAt) || null,
      at: str(o.at) || nowIso || null,
      src: RECORD_SRC.has(o.src) ? o.src : 'legacy',
      // B.4: judul ikut disimpan agar aktivitas yang dihapus tetap dikenali di snapshot.
      title: str(o.title) || null,
      startTime: str(o.startTime) || null
    };
  }

  function statusOf(rec) {
    const r = normRecord(rec);
    return r ? r.s : '';
  }

  function normalizeCompletion(raw) {
    const out = {};
    Object.entries(obj(raw, {})).forEach(([day, recs]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
      const dayOut = {};
      Object.entries(obj(recs, {})).forEach(([id, rec]) => {
        const normalized = normRecord(rec);
        if (normalized) dayOut[id] = normalized;
      });
      if (Object.keys(dayOut).length) out[day] = dayOut;
    });
    return out;
  }

  function normalizeReviews(raw) {
    const out = {};
    Object.entries(obj(raw, {})).forEach(([key, review]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !obj(review, null)) return;
      const generatedAt = str(review.generatedAt) || new Date(0).toISOString();
      const expiresAt = str(review.expiresAt) || new Date(Date.parse(generatedAt) + REVIEW_TTL_DAYS * 86400000).toISOString();
      out[key] = {
        ...review,
        weekKey: key,
        generatedAt,
        expiresAt,
        seen: !!review.seen,
        downloadedAt: str(review.downloadedAt) || null,
        downloadedFormat: str(review.downloadedFormat) || null,
        status: review.status === 'preview' ? 'preview' : 'final',
        items: arr(review.items, []),
        insights: arr(review.insights, []),
        plan: arr(review.plan, [])
      };
    });
    return out;
  }

  /* ---------- D-01: normalisasi, migrasi, dan pemangkasan ---------- */

  function pruneNotified(map, days = 14) {
    const cutoff = dateKey(Utils.addDays(new Date(), -days));
    return Object.fromEntries(Object.entries(map).filter(([k]) => str(k).slice(0, 10) >= cutoff));
  }

  function migrate(s) {
    const version = number(s.version, 1);
    if (version < 2) {
      // D-02: item belanja dari minggu berbeda pernah memakai ID template yang sama.
      const seen = new Set();
      s.shopping = s.shopping.map((item) => {
        const copy = { ...item };
        if (!copy.templateId) copy.templateId = copy.id;
        if (seen.has(copy.id)) copy.id = Utils.uid('shop');
        seen.add(copy.id);
        return copy;
      });
    }
    if (version < 3) {
      // R-02: data yang sudah terkenal duplikat ikut dibersihkan saat migrasi.
      s.activities = dedupeActivities(arr(s.activities, []));
      s.completion = normalizeCompletion(s.completion);
    }
    const weeks = new Set(arr(s.generatedWeeks, []));
    s.shopping.forEach((item) => weeks.add(item.weekKey));
    if (!weeks.size) weeks.add(weekKey(new Date()));
    s.generatedWeeks = [...weeks];
    s.restDays = arr(s.restDays, []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(str(d)));
    s.weeklyReviews = normalizeReviews(s.weeklyReviews);
    s.settings.strictSince = str(s.settings.strictSince) || Utils.nextMondayKey(new Date());
    s.settings.markGraceMinutes = Utils.clamp(number(s.settings.markGraceMinutes, 10), 0, GRACE_MAX);
    s.version = SCHEMA_VERSION;
    return s;
  }

  /** R-02: ID unik; bila bentrok, utamakan hasil edit pengguna. */
  function dedupeActivities(list) {
    const byId = new Map();
    list.forEach((a) => {
      if (!a || !a.id) return;
      const prev = byId.get(a.id);
      const priority = (x) => (x.userEdited ? 2 : 0) + (x.isRecurring === false ? 1 : 0);
      if (!prev || priority(a) > priority(prev)) byId.set(a.id, a);
    });
    return [...byId.values()];
  }

  function normalizeState(parsed) {
    const base = defaultState();
    const src = obj(parsed, {});
    const s = mergeDefaults(base, src);
    s.settings = mergeDefaults(base.settings, obj(src.settings, {}));
    s.customTargets = obj(src.customTargets, {});
    s.activities = dedupeActivities(arr(src.activities, base.activities)
      .filter((a) => a && a.id && a.title && number(a.dayOfWeek) >= 1 && number(a.dayOfWeek) <= 7)
      .map((a) => ({ ...a, isRecurring: a.isRecurring !== false })));
    if (!s.activities.length) s.activities = base.activities;
    s.tasks = arr(src.tasks, base.tasks).filter((t) => t && t.id && t.title);
    if (!s.tasks.length && Array.isArray(src.tasks)) s.tasks = [];
    s.inventory = arr(src.inventory, []).filter((i) => i && i.id && i.name);
    s.consumption = arr(src.consumption, []).filter((c) => c && c.id && /^\d{4}-\d{2}-\d{2}$/.test(str(c.date)));
    s.shopping = arr(src.shopping, base.shopping)
      .filter((i) => i && i.id)
      .map((i) => ({ ...i, templateId: i.templateId || i.id }));
    if (!s.shopping.length && !Array.isArray(src.shopping)) s.shopping = base.shopping;
    s.completion = normalizeCompletion(src.completion);
    s.weeklyReviews = normalizeReviews(src.weeklyReviews);
    s.deletedTemplateIds = arr(src.deletedTemplateIds, []);
    s.reminders = obj(src.reminders, {});
    s.notified = pruneNotified(obj(src.notified, {}));
    s.mentorshipNotes = str(src.mentorshipNotes, '');
    s.lastBackupAt = str(src.lastBackupAt, s.lastBackupAt);
    s.updatedAt = str(src.updatedAt, new Date().toISOString());
    return migrate(s);
  }

  function readRaw() {
    try { return localStorage.getItem(KEY); } catch { return null; }
  }

  function load() {
    try {
      const raw = readRaw();
      // D-09: state awal langsung dipersist agar versi & minggu belanja stabil.
      if (!raw) {
        const initial = defaultState();
        localStorage.setItem(KEY, JSON.stringify(initial));
        return initial;
      }
      return ensureWeekShopping(normalizeState(JSON.parse(raw)));
    } catch (err) {
      console.error('Gagal memuat data, menggunakan data awal.', err);
      try { localStorage.setItem(KEY + ':corrupt-' + Date.now(), readRaw() || ''); } catch { /* abbaikan */ }
      return defaultState();
    }
  }

  let state = load();
  let persistTimer = null;

  /* ---------- D-03: sinkronisasi antar-tab ---------- */

  function reloadFromStorage(notify = false) {
    try {
      const raw = readRaw();
      if (!raw) return false;
      const fresh = ensureWeekShopping(normalizeState(JSON.parse(raw)));
      state = fresh;
      // Hanya beri tahu bila dipanggil eksplisit dari penangan event storage,
      // bukan dari update() internal (kalau tidak, setiap klik memicu toast sinkron).
      if (notify) document.dispatchEvent(new CustomEvent('app:changed', { detail: { external: true } }));
      return true;
    } catch (err) {
      console.error('Gagal menyinkronkan data antar-tab.', err);
      return false;
    }
  }

  /** Baca ulang sebelum mutasi: perubahan tab lain tidak ikut tertimpa. */
  function update(mutator, silent = false) {
    // N-02: tulis dulu antrean autosave sebelum membaca ulang, agar teks yang
    // baru diketik tidak dikembalikan ke versi lama dari storage.
    if (persistTimer) flush();
    reloadFromStorage();
    const result = typeof mutator === 'function' ? mutator(state) : mutator;
    persist();
    // U-07: silent dipakai untuk edit satu field agar fokus tidak hilang.
    if (!silent) document.dispatchEvent(new CustomEvent('app:changed'));
    return result;
  }

  function persist() {
    try {
      clearTimeout(persistTimer);
      persistTimer = null;
      state.updatedAt = new Date().toISOString();
      localStorage.setItem(KEY, JSON.stringify(state));
      document.dispatchEvent(new CustomEvent('app:saved'));
      return true;
    } catch (err) {
      console.error('Gagal menyimpan data.', err);
      document.dispatchEvent(new CustomEvent('app:save-error', { detail: err }));
      return false;
    }
  }

  /** P-02: tulisan frekuensi tinggi (autosave) digabung dalam 250 ms. */
  function persistSoon() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persist, 250);
  }

  function flush() {
    if (!persistTimer) return;
    persistTimer = null;
    persist();
  }

  /** N-02: satu jalur tulis untuk textarea catatan bimbingan. */
  function saveMentorNotes(value) {
    return update((s) => { s.mentorshipNotes = String(value == null ? '' : value); }, true);
  }

  function reset() {
    state = defaultState();
    persist();
    document.dispatchEvent(new CustomEvent('app:changed'));
  }

  /** D-04: impor divalidasi, cadangan satu slot, dan ringkasan ditampilkan aplikasi. */
  function describeImport(json) {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    const src = obj(parsed && parsed.state ? parsed.state : parsed, null);
    if (!src) throw new Error('Format cadangan tidak dikenali.');
    const candidate = normalizeState(src);
    const ValidationError = 'Format cadangan tidak dikenali.';
    if (!Array.isArray(src.activities) && !Array.isArray(parsed?.state?.activities)) {
      throw new Error(ValidationError);
    }
    // D.6: laporan kedaluwarsa tidak diimpor dan tidak boleh memperpanjang umur.
    const now = Date.now();
    const skippedReviews = Object.values(candidate.weeklyReviews).filter((r) => Date.parse(r.expiresAt) <= now).length;
    if (skippedReviews) {
      Object.keys(candidate.weeklyReviews).forEach((k) => {
        if (Date.parse(candidate.weeklyReviews[k].expiresAt) <= now) delete candidate.weeklyReviews[k];
      });
    }
    const reviewCount = Object.values(candidate.weeklyReviews).filter((r) => r.status === 'final').length;
    return {
      state: candidate,
      skippedReviews,
      summary: `${candidate.activities.length} aktivitas, ${candidate.tasks.length} tugas, ${candidate.consumption.length} catatan konsumsi, ${candidate.shopping.length} item belanja, ${reviewCount} laporan evaluasi${skippedReviews ? `, ${skippedReviews} laporan kedaluwarsa dilewati` : ''}.`
    };
  }

  function importData(json) {
    const parsed = describeImport(json);
    const next = parsed.state;
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(state)); } catch (err) { console.warn('Cadangan impor gagal dibuat.', err); }
    state = ensureWeekShopping(next);
    persist();
    document.dispatchEvent(new CustomEvent('app:changed'));
  }

  function exportData() {
    return JSON.stringify({
      appVersion: Utils.APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      state
    }, null, 2);
  }

  /* ---------- D-07: pengingat usia cadangan ---------- */

  function markBackup() {
    // silent: ekspor tidak boleh memicu render ulang saat animasi unduhan.
    update((s) => { s.lastBackupAt = new Date().toISOString(); }, true);
  }

  function backupAgeDays() {
    const at = str(state.lastBackupAt);
    if (!at) return null;
    const ms = Date.parse(at);
    if (!Number.isFinite(ms)) return null;
    return Math.max(0, Math.floor((Date.now() - ms) / 86400000));
  }

  /* ---------- D-02/F-10: daftar belanja per minggu ---------- */

  function ensureWeekShopping(target = state) {
    const wk = weekKey(new Date());
    const weeks = new Set(arr(target.generatedWeeks, []));
    target.generatedWeeks = [...weeks];
    if (!weeks.has(wk)) {
      const fresh = Seed.shoppingTemplate.map((i) => ({
        ...i,
        id: Utils.uid('shop'),
        templateId: i.templateId || i.id,
        weekKey: wk,
        isPurchased: false,
        actualUnitPrice: null,
        shoppingDate: '',
        storeNotes: ''
      }));
      target.shopping = fresh.concat(target.shopping);
      target.generatedWeeks.push(wk);
    }
    // D-06: tidak ada pemotongan diam-diam; riwayat tetap utuh.
    return target;
  }

  /** Dipanggil saat kembali ke tab / sebelum render agar minggu baru muncul. */
  function refreshWeek() {
    const wk = weekKey(new Date());
    if (state.generatedWeeks.includes(wk)) return;
    ensureWeekShopping(state);
    persist();
    // Tidak memicu app:changed di sini: render yang memanggil sudah memakai state terbaru.
  }

  /* ---------- C: Jendela Aktif ---------- */

  /** F-08: menerima angka hari (kompatibel) atau Date/kunci tanggal. */
  function activitiesForDayIn(target, dayOrDate) {
    const isDate = dayOrDate instanceof Date || (typeof dayOrDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayOrDate));
    const day = isDate ? dow(dayOrDate) : Number(dayOrDate);
    const key = isDate ? dateKey(dayOrDate) : null;
    return (target.activities || [])
      .filter((a) => Number(a.dayOfWeek) === day && (a.isRecurring !== false || (key && a.date === key)))
      .sort((a, b) => (parseTime(a.startTime) ?? 0) - (parseTime(b.startTime) ?? 0));
  }

  function activitiesForDay(dayOrDate) {
    return activitiesForDayIn(state, dayOrDate);
  }

  function activityMinutes(activity) {
    const start = parseTime(activity && activity.startTime);
    const end = parseTime(activity && activity.endTime);
    if (start == null || end == null) return 0;
    // C.10: durasi 0 bukan "seharian penuh"; jendelanya tetap MIN_WINDOW_MIN.
    if (end === start) return 0;
    return end > start ? end - start : end + 1440 - start;
  }

  /** C.4: waktu absolut, jadi aktivitas lintas tengah malam tetap benar. */
  function windowFor(activity, date, now = new Date(), target = state) {
    const key = dateKey(date);
    const start = parseTime(activity && activity.startTime);
    if (start == null) {
      return { ok: false, reason: 'Jam aktivitas belum diatur.', opensAt: null, closesAt: null, lastTick: null, legacy: false, long: false, start };
    }
    const rawEnd = parseTime(activity && activity.endTime);
    let end = rawEnd == null ? start : rawEnd;
    // Sama dengan start ⇒ durasi 0; clamp MIN_WINDOW_MIN di bawah menangani jendelanya.
    if (end < start) end += 1440;
    const opensAt = Utils.atMinutes(key, start);
    const closesAt = Math.max(Utils.atMinutes(key, end), opensAt + MIN_WINDOW_MIN * 60000);
    const grace = Utils.clamp(number(target.settings.markGraceMinutes, 10), 0, GRACE_MAX);
    const lastTick = closesAt + grace * 60000;
    const strictSince = str(target.settings.strictSince) || Utils.nextMondayKey(now);
    return {
      ok: true, reason: '', opensAt, closesAt, lastTick,
      legacy: key < strictSince,
      long: activityMinutes(activity) >= TWO_STEP_MIN,
      start, end
    };
  }

  /** C.6: guard satu sumber kebenaran; UI hanya membaca hasilnya. */
  function canMark(activityOrId, date, action = 'complete', now = new Date(), target = state) {
    const activity = typeof activityOrId === 'string'
      ? (target.activities || []).find((a) => a.id === activityOrId)
      : activityOrId;
    if (!activity) return { ok: false, reason: 'Aktivitas tidak ditemukan.', legacy: false };
    const key = dateKey(date);
    const win = windowFor(activity, key, now, target);
    if (!win.ok) return { ...win, ok: false };
    const saved = statusOf((target.completion[key] || {})[activity.id]);
    if (saved === 'excused') return { ...win, ok: false, reason: 'Hari ini ditandai sebagai hari istirahat.' };
    if (win.legacy) {
      if (saved === 'skipped' && action !== 'undo') return { ...win, ok: false, reason: 'Aktivitas dilewati.' };
      return { ...win, ok: true };
    }
    if (action === 'undo') {
      if (!saved) return { ...win, ok: false, reason: 'Belum ada penandaan untuk dibatalkan.' };
      if (now >= win.lastTick) return { ...win, ok: false, reason: 'Jendela sudah ditutup; penandaan terkunci.' };
      return { ...win, ok: true };
    }
    if (saved === 'completed' || saved === 'skipped') return { ...win, ok: false, reason: 'Aktivitas sudah ditandai. Batalkan dulu bila perlu.' };
    if (action === 'start' && saved === 'inprogress') return { ...win, ok: false, reason: 'Aktivitas sudah berjalan.' };
    if (now < win.opensAt) {
      return { ...win, ok: false, reason: `Buka pukul ${Utils.fmtTime(win.start)}.` };
    }
    if (now >= win.lastTick) return { ...win, ok: false, reason: 'Jendela sudah ditutup; aktivitas tidak bisa ditandai.' };
    // C.10: dua langkah juga dijaga di lapisan Store, bukan hanya di tombol.
    if (win.long && action === 'complete' && saved !== 'inprogress') {
      return { ...win, ok: false, reason: 'Mulai aktivitas terlebih dahulu sebelum menandainya selesai.' };
    }
    return { ...win, ok: true };
  }

  /** C.3: penulisan tetap diamankan di lapisan Store, bukan sekadar tombol. */
  function setActivityStatus(activityId, date, status, opts = {}) {
    const key = dateKey(date);
    const now = opts.now instanceof Date ? opts.now : new Date();
    const action = !status ? 'undo' : status === 'inprogress' ? 'start' : status === 'skipped' ? 'skip' : 'complete';
    let outcome = { ok: false, reason: 'Aktivitas tidak ditemukan.' };
    update((s) => {
      const activity = (s.activities || []).find((a) => a.id === activityId);
      if (!activity) return;
      outcome = canMark(activity, key, action, now, s);
      if (!outcome.ok) return;
      const day = s.completion[key] || (s.completion[key] = {});
      if (!status) { delete day[activityId]; return; }
      const prev = normRecord(day[activityId]);
      const src = outcome.legacy ? 'legacy' : now < outcome.closesAt ? 'live' : 'grace';
      day[activityId] = {
        s: status,
        startedAt: status === 'inprogress' ? now.toISOString()
          : status === 'completed' && prev && prev.s === 'inprogress' ? (prev.startedAt || prev.at)
            : null,
        at: now.toISOString(),
        src,
        title: activity.title || null,
        startTime: activity.startTime || null
      };
    }, !!opts.silent);
    return outcome;
  }

  /** C.7: maksimal 2 hari istirahat per minggu, hanya untuk hari berjalan. */
  function setRestDay(date, on = true) {
    const key = dateKey(date);
    if (key !== dateKey(new Date())) return { ok: false, reason: 'Hari istirahat hanya bisa dicatat untuk hari ini.' };
    let outcome = { ok: false, reason: '' };
    const now = new Date();
    update((s) => {
      const week = weekKey(Utils.fromKey(key));
      const used = arr(s.restDays, []).filter((d) => weekKey(Utils.fromKey(d)) === week).length;
      const already = arr(s.restDays, []).includes(key);
      if (on && !already && used >= 2) {
        outcome = { ok: false, reason: 'Maksimal 2 hari istirahat per minggu.' };
        return;
      }
      s.restDays = on ? [...new Set([...arr(s.restDays, []), key])] : arr(s.restDays, []).filter((d) => d !== key);
      const day = s.completion[key] || (s.completion[key] = {});
      activitiesForDayIn(s, key).forEach((a) => {
        const prev = normRecord(day[a.id]);
        if (on) day[a.id] = { s: 'excused', startedAt: null, at: now.toISOString(), src: 'rest' };
        else if (prev && prev.s === 'excused' && prev.src === 'rest') delete day[a.id];
      });
      outcome = { ok: true, on, used: on ? used + (already ? 0 : 1) : Math.max(0, used - 1) };
    });
    return outcome;
  }

  /* ---------- Selektor ---------- */

  /** F-02: tanggal diperiksa lebih dulu, baru jam. */
  function activityStatus(activity, date) {
    const saved = statusOf(state.completion[dateKey(date)]?.[activity.id]);
    if (saved === 'completed' || saved === 'skipped' || saved === 'excused') return saved;
    const now = new Date();
    const key = dateKey(date);
    const today = dateKey(now);
    if (key < today) return saved === 'inprogress' ? 'inprogress' : 'missed';
    if (key > today) return 'upcoming';
    if (saved === 'inprogress') return 'inprogress';
    const current = now.getHours() * 60 + now.getMinutes();
    const start = parseTime(activity.startTime) ?? 0;
    const end = Math.max(start, parseTime(activity.endTime) ?? start);
    if (current >= end) return 'missed';
    if (current >= start) return 'ongoing';
    return 'upcoming';
  }

  function progressForDate(date) {
    const key = dateKey(date);
    const rec = state.completion[key] || {};
    const acts = activitiesForDay(date).filter((a) => statusOf(rec[a.id]) !== 'excused');
    const done = acts.filter((a) => statusOf(rec[a.id]) === 'completed').length;
    return { done, total: acts.length, pct: acts.length ? Math.round((done / acts.length) * 100) : 0 };
  }

  function weekProgress(reference = new Date()) {
    const dates = Utils.weekDates(reference).filter((d) => d <= new Date());
    let done = 0, total = 0;
    dates.forEach((d) => {
      const p = progressForDate(d);
      total += p.total;
      done += p.done;
    });
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0, days: dates.length };
  }

  /** R-02: template tidak boleh menggandakan aktivitas yang sudah diedit. */
  function applyTemplate() {
    let skipped = 0;
    update((s) => {
      const deleted = new Set(arr(s.deletedTemplateIds, []));
      const fresh = Seed.buildActivities(s.settings);
      const keep = s.activities.filter((a) => !a.isTemplate || a.userEdited || deleted.has(a.id));
      skipped = keep.filter((a) => a.isTemplate && (a.userEdited || deleted.has(a.id))).length;
      const keptIds = new Set(keep.map((a) => a.id));
      s.activities = dedupeActivities(fresh.filter((a) => !deleted.has(a.id) && !keptIds.has(a.id)).concat(keep));
    });
    return { skipped };
  }

  /** F-12: tugas terdekat mengabaikan yang selesai dan mengikuti urutan. */
  function nearestTasks(limit = 3) {
    return state.tasks
      .filter((t) => t.status !== 'completed')
      .slice()
      .sort((a, b) => number(a.order, 99) - number(b.order, 99))
      .slice(0, limit);
  }

  function fruitKinds() {
    return new Set(activeInventory().map((i) => i.fruitId || i.name)).size;
  }

  function consumptionForDate(date) {
    const key = dateKey(date);
    return state.consumption.filter((c) => c.date === key);
  }

  function servingsForDate(date) {
    return consumptionForDate(date).reduce((sum, c) => sum + number(c.servingCount), 0);
  }

  function servingsForWeek(reference = new Date()) {
    const start = weekKey(reference);
    return state.consumption
      .filter((c) => weekKey(Utils.fromKey(c.date)) === start)
      .reduce((sum, c) => sum + number(c.servingCount), 0);
  }

  function dailyTarget() {
    return Math.max(1, Math.floor(number(state.settings.dailyFruitTarget, 2)));
  }

  function weeklyTarget() {
    return dailyTarget() * 7;
  }

  function activeInventory() {
    return state.inventory.filter((i) => i.status !== 'finished' && number(i.quantityRemaining) > 0);
  }

  /* ---------- N-02: "segera dikonsumsi" dihitung otomatis ---------- */

  // Panduan sederhana berdasarkan jenis buah + lokasi penyimpanan. Angka ini
  // pelengkap kondisi yang dicatat pengguna, bukan pengganti penilaiannya.
  const STORAGE_DAYS = {
    jambu:  { kulkas: 6,  'suhu ruang': 4 },
    pepaya: { kulkas: 5,  'suhu ruang': 3 },
    jeruk:  { kulkas: 10, 'suhu ruang': 6 },
    pisang: { kulkas: 5,  'suhu ruang': 3 },
    melon:  { kulkas: 3,  'suhu ruang': 2 }
  };
  const DEFAULT_STORAGE_DAYS = { kulkas: 5, 'suhu ruang': 3 };

  function consumeSoonReason(stock) {
    if (!stock || stock.status === 'finished' || number(stock.quantityRemaining) <= 0) return '';
    if (stock.status === 'consume-soon') return 'Ditandai perlu segera dikonsumsi';
    const purchased = str(stock.purchaseDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchased)) return '';
    const bought = Utils.fromKey(purchased);
    const age = Math.floor((Date.now() - bought.getTime()) / 86400000);
    if (!Number.isFinite(age) || age < 0) return '';
    const loc = str(stock.storageLocation).toLowerCase();
    const guide = STORAGE_DAYS[str(stock.fruitId)] || DEFAULT_STORAGE_DAYS;
    const limit = /kulkas|dingin/.test(loc) ? guide.kulkas
      : /ruang|pantry|meja/.test(loc) ? guide['suhu ruang']
        : Math.min(guide.kulkas, guide['suhu ruang']);
    if (age >= limit) return `${age} hari sejak pembelian (panduan ±${limit} hari)`;
    return '';
  }

  function isConsumeSoon(stock) {
    return !!consumeSoonReason(stock);
  }

  function consumeSoonInventory() {
    return state.inventory.filter(isConsumeSoon);
  }

  /** F-01: satu porsi = servingSize (150 g / 1 buah), konversi kg → gram otomatis. */
  function servingsToQty(stock, servings) {
    const count = Math.max(0, number(servings, 0));
    const unit = str(stock && stock.unit, 'buah').toLowerCase();
    const servingUnit = str(stock && stock.servingUnit, /kg|gram|g\b/.test(unit) ? 'gram' : 'buah').toLowerCase();
    const size = number(stock && stock.servingSize, /kg|gram/.test(unit) ? 150 : 1) || 1;
    let qty = count * size;
    if (servingUnit === 'gram' && /kg\b|kg utuh/.test(unit)) qty = qty / 1000;
    return Math.round(qty * 1000) / 1000;
  }

  function stockUseLabel(stock, servings) {
    const qty = servingsToQty(stock, servings);
    return `${Utils.formatQtyUnit(qty, str(stock && stock.unit, 'buah'))}`;
  }

  function deductStock(stock, servings) {
    if (!stock) return false;
    const use = servingsToQty(stock, servings);
    stock.quantityRemaining = Math.round(Math.max(0, number(stock.quantityRemaining) - use) * 1000) / 1000;
    if (stock.quantityRemaining <= 0) stock.status = 'finished';
    return true;
  }

  function currentWeekShopping() {
    const wk = weekKey(new Date());
    refreshWeek();
    return state.shopping.filter((i) => i.weekKey === wk);
  }

  function shoppingTotals(items = currentWeekShopping()) {
    const estimated = items.reduce((sum, i) => sum + number(i.quantity) * number(i.estimatedUnitPrice), 0);
    // F-09: harga aktual hanya dihitung bila pengguna benar-benar mengisinya.
    const actual = items.reduce((sum, i) => sum + number(i.quantity) * (i.actualUnitPrice == null || i.actualUnitPrice === '' ? 0 : number(i.actualUnitPrice)), 0);
    const budget = number(state.settings.weeklyBudget);
    return { estimated, actual, budget, remaining: budget - actual, over: actual > budget || estimated > budget };
  }

  function reminderFor(session) {
    const key = weekKey(new Date()) + ':' + session;
    return state.reminders[key] || { status: 'pending', at: '' };
  }

  function setReminder(session, status) {
    update((s) => {
      const key = weekKey(new Date()) + ':' + session;
      s.reminders[key] = { status, at: new Date().toISOString() };
    });
  }

  function targetForDay(day) {
    return state.customTargets[day] ?? Seed.academicTargets[day] ?? '';
  }

  function taskStats() {
    const done = state.tasks.filter((t) => t.status === 'completed').length;
    return { done, total: state.tasks.length, pct: state.tasks.length ? Math.round((done / state.tasks.length) * 100) : 0 };
  }

  function fruitById(id) {
    return state.fruitCatalog.find((f) => f.id === id);
  }

  function nextShoppingReminder() {
    const today = dow(new Date());
    const main = number(state.settings.shoppingDays.main, 7);
    const refill = number(state.settings.shoppingDays.refill, 3);
    const options = [
      { session: 'main', day: main, label: 'Belanja utama' },
      { session: 'refill', day: refill, label: 'Belanja ulang buah segar' }
    ].map((o) => {
      const delta = (o.day - today + 7) % 7;
      return { ...o, delta, date: Utils.addDays(new Date(), delta) };
    }).sort((a, b) => a.delta - b.delta);
    return options[0];
  }

  /* ---------- D: Evaluasi Mingguan (snapshot, retensi, unduh) ---------- */

  function reviewTimes(weekStartKey) {
    return {
      previewAt: Utils.atMinutes(weekStartKey, 6 * 1440 + 21 * 60), // Minggu 21.00
      finalAt: Utils.atMinutes(weekStartKey, 7 * 1440 + 9 * 60)     // Senin berikutnya 09.00
    };
  }

  function previousWeekKey(weekStartKey, back = 1) {
    return dateKey(Utils.addDays(Utils.fromKey(weekStartKey), -7 * back));
  }

  function isExpired(review, now = new Date()) {
    if (!review || review.status !== 'final') return false;
    const ms = Date.parse(review.expiresAt);
    return Number.isFinite(ms) && ms <= now.getTime();
  }

  function daysLeft(review, now = new Date()) {
    const ms = Date.parse(review && review.expiresAt);
    if (!Number.isFinite(ms)) return 0;
    return Math.max(0, Math.ceil((ms - now.getTime()) / 86400000));
  }

  /** B.4: satu snapshot lengkap; tidak pernah dihitung ulang setelah final. */
  function buildReview(target, weekStartKey, status) {
    const times = reviewTimes(weekStartKey);
    const days = Utils.weekDates(Utils.fromKey(weekStartKey));
    const items = [], skippedItems = [], daily = [];
    let done = 0, unfinished = 0, excused = 0;
    days.forEach((date) => {
      const key = dateKey(date);
      const rec = (target.completion || {})[key] || {};
      const acts = activitiesForDayIn(target, date);
      // Aktivitas dihapus di tengah minggu tetap dihitung sampai hari penghapusan.
      const restored = Object.keys(rec)
        .filter((id) => !acts.some((a) => a.id === id))
        .map((id) => {
          const r = normRecord(rec[id]);
          return {
            id, restored: true,
            title: (r && r.title) || 'Aktivitas yang dihapus',
            startTime: (r && r.startTime) || '',
            endTime: ''
          };
        });
      let dayDone = 0, dayTotal = 0;
      acts.concat(restored).forEach((a) => {
        const s = statusOf(rec[a.id]);
        if (s === 'excused') { excused += 1; return; }
        if (s === 'skipped') {
          skippedItems.push({ date: key, id: a.id, title: a.title, time: a.startTime || '' });
          return;
        }
        if (s === 'completed') { done += 1; dayDone += 1; dayTotal += 1; return; }
        dayTotal += 1;
        unfinished += 1;
        items.push({
          date: key, id: a.id, title: a.title, time: a.startTime || '',
          duration: activityMinutes(a),
          reason: s === 'inprogress' ? 'Sedang berjalan' : 'Belum ditandai'
        });
      });
      daily.push({
        key, label: Utils.dayName(Utils.dow(date), true),
        done: dayDone, total: dayTotal,
        pct: dayTotal ? Math.round((dayDone / dayTotal) * 100) : 0
      });
    });
    const total = done + unfinished;
    const score = total ? Math.round((done / total) * 100) : 0;
    const insights = [];
    const byActivity = new Map();
    items.forEach((i) => byActivity.set(i.title, (byActivity.get(i.title) || 0) + 1));
    const top = [...byActivity.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) insights.push({ kind: 'fokus', title: top[0], count: top[1], detail: `${top[1]} kali belum terselesaikan` });
    const best = daily.filter((d) => d.total).sort((a, b) => b.pct - a.pct)[0];
    if (best) insights.push({ kind: 'terbaik', title: best.label, count: best.done, detail: `${best.done}/${best.total} selesai` });
    insights.push({
      kind: 'ringkasan',
      title: score >= 80 ? 'Konsisten' : 'Perlu perhatian',
      count: score,
      detail: `${done} dari ${total} aktivitas selesai`
    });
    const plan = items.slice()
      .sort((a, b) => a.date.localeCompare(b.date) || String(a.time).localeCompare(String(b.time)))
      .slice(0, 5)
      .map((i, n) => ({
        id: `plan-${weekStartKey}-${n + 1}`,
        activityId: i.id,
        date: i.date,
        title: i.title,
        time: i.time,
        action: i.reason === 'Sedang berjalan' ? 'Lanjutkan dan selesaikan' : 'Jadwalkan ulang di hari berikutnya',
        accepted: false,
        skipped: false
      }));
    const at = status === 'final' ? times.finalAt : times.previewAt;
    return {
      weekKey: weekStartKey,
      isoWeek: Utils.isoWeekKey(Utils.fromKey(weekStartKey)),
      status,
      ruleVersion: REVIEW_RULE_VERSION,
      generatedAt: new Date(at).toISOString(),
      expiresAt: new Date(at + REVIEW_TTL_DAYS * 86400000).toISOString(),
      seen: false,
      downloadedAt: null,
      downloadedFormat: null,
      score, done, total, unfinished,
      skippedCount: skippedItems.length,
      excusedCount: excused,
      items, skippedItems, daily,
      insights: insights.slice(0, 3),
      plan
    };
  }

  function pruneReviews(target, now) {
    const all = obj(target.weeklyReviews, {});
    Object.keys(all).forEach((k) => {
      if (isExpired(all[k], now) && all[k].seen) delete all[k];
    });
    // D.3: hanya 4 laporan final terbaru yang disimpan. Yang kedaluwarsa belum
    // dibuka sengaja ditahan agar pengguna sempat melihatnya sekali.
    Object.entries(all)
      .filter(([, r]) => r.status === 'final' && !isExpired(r, now))
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(REVIEW_KEEP)
      .forEach(([k]) => { delete all[k]; });
    target.weeklyReviews = all;
  }

  /** D.1: idempoten, dibuat satu kali per minggu lewat Store.update(). */
  function ensureReviews(now = new Date()) {
    let created = 0, promoted = 0;
    update((s) => {
      s.weeklyReviews = obj(s.weeklyReviews, {});
      const current = weekKey(now);
      // back=0 penting: pratinjau Minggu 21.00 dibuat untuk minggu yang masih berjalan.
      for (let back = 0; back <= CATCHUP_MAX; back += 1) {
        const wk = previousWeekKey(current, back);
        const times = reviewTimes(wk);
        const at = now.getTime();
        if (at < times.previewAt) continue;
        const want = at >= times.finalAt ? 'final' : 'preview';
        const existing = s.weeklyReviews[wk];
        if (existing && (existing.status === want || existing.status === 'final')) continue;
        const fresh = buildReview(s, wk, want);
        if (existing) {
          fresh.seen = existing.seen;
          fresh.downloadedAt = existing.downloadedAt;
          fresh.downloadedFormat = existing.downloadedFormat;
          promoted += 1;
        } else created += 1;
        s.weeklyReviews[wk] = fresh;
      }
      pruneReviews(s, now);
    }, true);
    if (created || promoted) document.dispatchEvent(new CustomEvent('app:changed'));
    return { created, promoted };
  }

  function reviewFor(weekStartKey, now = new Date()) {
    const r = state.weeklyReviews[weekStartKey];
    if (!r) return null;
    return { ...r, daysLeft: daysLeft(r, now), expired: isExpired(r, now) };
  }

  function reviewList(now = new Date()) {
    return Object.values(state.weeklyReviews)
      .filter((r) => r.status === 'final' && (!isExpired(r, now) || !r.seen))
      .sort((a, b) => b.weekKey.localeCompare(a.weekKey))
      .map((r) => ({ ...r, daysLeft: daysLeft(r, now), expired: isExpired(r, now) }));
  }

  function reviewStats(now = new Date()) {
    const list = reviewList(now);
    const expiring = list.find((r) => !r.expired && !r.downloadedAt && r.daysLeft <= 7) || null;
    return { count: list.length, unseen: list.filter((r) => !r.seen).length, expiring, latest: list[0] || null };
  }

  function markReviewSeen(weekStartKey, silent = false) {
    if (!state.weeklyReviews[weekStartKey]) return false;
    update((s) => {
      if (!s.weeklyReviews[weekStartKey]) return;
      s.weeklyReviews[weekStartKey].seen = true;
      pruneReviews(s, new Date());
    }, silent);
    return true;
  }

  function markReviewDownloaded(weekStartKey, format = 'md') {
    if (!state.weeklyReviews[weekStartKey]) return false;
    update((s) => {
      const r = s.weeklyReviews[weekStartKey];
      if (!r) return;
      r.seen = true;
      r.downloadedAt = new Date().toISOString();
      r.downloadedFormat = format;
    }, true);
    return true;
  }

  function setPlanDecision(weekStartKey, ids = [], accepted = true) {
    let changed = 0;
    const wanted = new Set(arr(ids, []));
    update((s) => {
      const r = s.weeklyReviews[weekStartKey];
      if (!r) return;
      r.plan.forEach((p) => {
        if (p.accepted || p.skipped) return;
        if (wanted.size && !wanted.has(p.id)) return;
        p.accepted = accepted;
        p.skipped = !accepted;
        changed += 1;
      });
    });
    return changed;
  }

  function reviewFileName(weekStartKey) {
    const r = state.weeklyReviews[weekStartKey];
    const monday = Utils.fromKey(weekStartKey);
    return `evaluasi-mingguan_${(r && r.isoWeek) || Utils.isoWeekKey(monday)}_${Utils.fileDate(monday)}.md`;
  }

  function reviewMarkdown(weekStartKey, now = new Date()) {
    const r = reviewFor(weekStartKey, now);
    if (!r) return '';
    const when = (v) => v ? new Date(v).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }) : '-';
    const start = Utils.fromKey(r.weekKey);
    const end = Utils.addDays(start, 6);
    const lines = [
      `# Evaluasi Mingguan ${r.isoWeek}`,
      '',
      `- Periode: ${Utils.formatDate(start)} — ${Utils.formatDate(end)}`,
      `- Dibuat: ${when(r.generatedAt)}${r.status === 'preview' ? ' (pratinjau)' : ''}`,
      `- Skor: ${r.score}% — ${r.done} selesai dari ${r.total} yang dihitung`,
      `- Sengaja dilewati: ${r.skippedCount} · Hari istirahat: ${r.excusedCount}`,
      '',
      '## Belum selesai',
      ...(r.items.length ? r.items.map((i) => `- [ ] ${Utils.dayName(Utils.dow(Utils.fromKey(i.date)), true)}, ${i.time || '-'} — ${i.title} (${i.reason})` ) : ['- Tidak ada.']),
      '',
      '## Sengaja dilewati',
      ...(r.skippedItems.length ? r.skippedItems.map((i) => `- ${Utils.dayName(Utils.dow(Utils.fromKey(i.date)), true)} — ${i.title}`) : ['- Tidak ada.']),
      '',
      '## Insight',
      ...r.insights.map((i, n) => `${n + 1}. ${i.title} — ${i.detail}`),
      '',
      '## Rencana pemulihan',
      ...(r.plan.length ? r.plan.map((p, n) => `${n + 1}. [${p.accepted ? 'x' : p.skipped ? ' ' : ' '}] ${p.title} — ${p.action}`) : ['- Tidak ada rencana.']),
      '',
      '## Detail harian',
      '| Hari | Selesai | Dihitung | Persentase |',
      '|---|---:|---:|---:|',
      ...r.daily.map((d) => `| ${d.label} | ${d.done} | ${d.total} | ${d.pct}% |`),
      '',
      `Laporan ini akan dihapus pada hari ${when(r.expiresAt)} bila belum diunduh dan sudah dibuka.`
    ];
    return lines.join('\n');
  }

  return {
    KEY, BACKUP_KEY, SCHEMA_VERSION, APP_VERSION: Utils.APP_VERSION,
    get state() { return state; }, update, persist, persistSoon, flush, reset, importData, exportData, describeImport,
    markBackup, backupAgeDays,
    normalizeState, reloadFromStorage, refreshWeek, ensureWeekShopping,
    activitiesForDayIn, activitiesForDay, activityMinutes, windowFor, canMark, setActivityStatus, setRestDay,
    statusOf, progressForDate, weekProgress, applyTemplate, saveMentorNotes,
    activityStatus,
    ensureReviews, reviewFor, reviewList, reviewStats, markReviewSeen, markReviewDownloaded,
    setPlanDecision, reviewMarkdown, reviewFileName, isExpired, daysLeft,
    nearestTasks, fruitKinds, consumptionForDate, servingsForDate, servingsForWeek, dailyTarget, weeklyTarget,
    activeInventory, consumeSoonInventory, isConsumeSoon, consumeSoonReason, servingsToQty, stockUseLabel, deductStock,
    currentWeekShopping, shoppingTotals, reminderFor, setReminder, targetForDay, taskStats, fruitById, nextShoppingReminder
  };
})();
