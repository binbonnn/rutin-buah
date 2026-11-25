/* ---------- Penyimpanan lokal & selektor data ---------- */
const Store = (() => {
  const KEY = 'rutin-buah:v1';
  const BACKUP_KEY = KEY + ':pre-import';
  const SCHEMA_VERSION = 5;
  const { mergeDefaults, dateKey, weekKey, dow, parseTime, number } = Utils;

  const arr = (v, fb) => (Array.isArray(v) ? v : fb);
  const obj = (v, fb) => (v && typeof v === 'object' && !Array.isArray(v) ? v : fb);
  const str = (v, fb = '') => (typeof v === 'string' ? v : fb);
  /** Kontrak skema memakai HH.mm; terima juga HH:mm dari input/state lawas. */
  const normTime = (v, fb = '') => {
    const m = parseTime(v);
    return m == null ? fb : Utils.fmtTime(m);
  };

  // C.10 / D.8: konstanta tunggal untuk Jendela Aktif dan retensi laporan.
  const MIN_WINDOW_MIN = 10;
  const TWO_STEP_MIN = 20;
  const GRACE_MAX = 30;
  const REVIEW_KEEP = 4;
  const REVIEW_MAX_TOTAL = 8;
  const REVIEW_HOLD_DAYS = 14;
  const CATCHUP_MAX = 4;
  const REVIEW_TTL_DAYS = 28;
  const DAY_PLAN_MAX = 35; // alias lama, dipakai docs/uji
  const DAY_SNAPSHOT_MAX = DAY_PLAN_MAX;
  const ARCHIVE_COMPLETION_DAYS = 90;
  const ARCHIVE_CONSUMPTION_DAYS = 180;
  const REVIEW_RULE_VERSION = 5;
  const STORED_STATUS = new Set(['inprogress', 'completed', 'skipped', 'excused']);
  const RECORD_SRC = new Set(['live', 'grace', 'legacy', 'rest']);

  function defaultState() {
    return {
      version: SCHEMA_VERSION,
      settings: JSON.parse(JSON.stringify(Seed.settings)),
      activities: Seed.buildActivities(Seed.settings),
      completion: {},
      // v4: kapan aplikasi pertama dipakai. Dipakai agar tidak membuat laporan
      // untuk minggu sebelum instalasi.
      firstUseAt: new Date().toISOString(),
      // v5: snapshot jadwal harian kompak (S9, menutup V3-08).
      daySnapshots: {},
      scheduleVersion: 1,
      chronicDismissedUntil: {},
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

  function validISO(value) {
    const s = str(value);
    if (!s) return false;
    return Number.isFinite(Date.parse(s));
  }

  /** v5: snapshot harian kompak {v, a:[[id, start, end, cat, title], ...]}. */
  function normalizeDaySnapshots(raw, now = new Date()) {
    const out = {};
    const cutoff = dateKey(Utils.addDays(now, -(DAY_SNAPSHOT_MAX - 1)));
    Object.entries(obj(raw, {})).forEach(([key, value]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || key < cutoff) return;
      const source = obj(value, Array.isArray(value) ? { a: value } : {});
      const rows = Array.isArray(source.a) ? source.a : [];
      const compact = rows.map((r) => Array.isArray(r)
        ? [str(r[0]), str(r[1]), str(r[2] || r[1]), str(r[3]) || 'Pribadi', str(r[4]) || 'Aktivitas']
        : [str(r && r.id), str(r && r.startTime), str(r && r.endTime || r && r.startTime),
          str(r && r.category) || 'Pribadi', str(r && r.title) || 'Aktivitas'])
        .filter((r) => r[0] && r[1]);
      if (compact.length) out[key] = { v: number(source.v, 1), a: compact };
    });
    return out;
  }

  /** v4 → v5: dayPlans lama jadi daySnapshots tanpa kehilangan jadwal bekukan. */
  function dayPlansToSnapshots(raw, now = new Date()) {
    return normalizeDaySnapshots(obj(raw, {}), now);
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
      startTime: str(o.startTime) || null,
      // S2: durasi aktual (menit) bila mulai dan selesai tercatat.
      dur: o.dur == null ? null : (Number.isFinite(Number(o.dur)) ? Number(o.dur) : null)
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

  const BLOCK_OF = (time) => {
    const m = parseTime(time);
    if (m == null) return '';
    if (m < 11 * 60) return 'pagi';
    if (m < 15 * 60) return 'siang';
    if (m < 18 * 60) return 'sore';
    return 'malam';
  };

  /** v5: judul/jam/kategori disimpan sekali; item hanya {d, id, s}. */
  function compactTitles(raw) {
    const out = {};
    Object.entries(obj(raw, {})).forEach(([id, value]) => {
      if (Array.isArray(value)) out[id] = [str(value[0]) || 'Aktivitas', normTime(value[1], str(value[1])), str(value[2]) || 'Pribadi'];
      else if (obj(value, null)) out[id] = [str(value.title) || 'Aktivitas', normTime(value.time || value.startTime, str(value.time || value.startTime)), str(value.category) || 'Pribadi'];
    });
    return out;
  }

  function compactItems(raw, titles) {
    return arr(raw, []).filter((i) => i && i.id).map((i) => {
      const s = i.s === 'p' || i.s === 'm' ? i.s
        : (i.reason === 'Sedang berjalan' || i.status === 'inprogress' ? 'p' : 'm');
      if (!titles[i.id]) titles[i.id] = [str(i.title) || 'Aktivitas', str(i.time || i.startTime), str(i.cat || i.category) || 'Pribadi'];
      return { d: str(i.d || i.date), id: str(i.id), s };
    }).filter((i) => i.d);
  }

  function compactPlan(raw, week) {
    return arr(raw, []).filter((p) => p && p.id).map((p, n) => {
      const status = p.status || (p.accepted ? 'accepted' : p.skipped ? 'skipped' : 'proposed');
      const suggested = obj(p.suggested, null);
      return {
        id: str(p.id) || `plan-${week}-${n + 1}`,
        activityId: str(p.activityId) || '',
        title: str(p.title) || 'Aktivitas',
        category: str(p.category) || 'Pribadi',
        durationMin: Math.max(5, number(p.durationMin, 20)),
        status: ['proposed', 'accepted', 'skipped'].includes(status) ? status : 'proposed',
        suggested: suggested && /^\d{4}-\d{2}-\d{2}$/.test(str(suggested.date))
          ? { date: str(suggested.date), start: normTime(suggested.start, str(suggested.start)), end: normTime(suggested.end, str(suggested.end)) } : null,
        createdActivityId: str(p.createdActivityId) || null,
        kind: p.kind === 'chronic' ? 'chronic' : 'recover',
        ...(p.reason ? { reason: str(p.reason) } : {}),
        ...(p.decision ? { decision: str(p.decision) } : {}),
        ...(!suggested && p.action ? { action: str(p.action) } : {})
      };
    });
  }

  function compactInsights(raw) {
    return arr(raw, []).filter((i) => i && i.kind).map((i) => {
      if (obj(i.data, null)) {
        return { kind: str(i.kind), score: number(i.score, 0), data: i.data, cta: str(i.cta) };
      }
      // Insight templat lama: teks tetap tampil, tetapi sudah berbentuk data.
      return { kind: 'legacy', score: 0, data: { title: str(i.title), detail: str(i.detail) }, cta: '' };
    });
  }

  function normalizeReviews(raw) {
    const out = {};
    const nonNeg = (v, fb = 0) => Math.max(0, number(v, fb));
    Object.entries(obj(raw, {})).forEach(([key, review]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !obj(review, null)) return;
      const genMs = Date.parse(str(review.generatedAt));
      const generatedAt = Number.isFinite(genMs) ? new Date(genMs).toISOString() : new Date(0).toISOString();
      const expMs = Date.parse(str(review.expiresAt));
      const expiresAt = Number.isFinite(expMs) ? new Date(expMs).toISOString()
        : new Date(Date.parse(generatedAt) + REVIEW_TTL_DAYS * 86400000).toISOString();
      const titles = compactTitles(review.titles);
      const items = compactItems(review.items, titles);
      const rows = (value) => arr(value, []).filter((i) => obj(i, null))
        .map((i) => ({ ...i, date: str(i.date || i.d), title: str(i.title) || 'Aktivitas' }))
        .filter((i) => i.date);
      const skippedItems = rows(review.skippedItems);
      const waiting = rows(review.waiting);
      const daily = arr(review.daily, []).filter((d) => obj(d, null)).map((d, n) => {
        const done = nonNeg(d.done);
        const total = nonNeg(d.total);
        const pct = Utils.clamp(nonNeg(d.pct, total ? Math.round((done / total) * 100) : 0), 0, 100);
        return { ...d, key: str(d.key), label: str(d.label) || `Hari ${n + 1}`, done, total, pct };
      });
      const done = nonNeg(review.done);
      const total = Math.max(done, nonNeg(review.total, items.length));
      out[key] = {
        ...review,
        weekKey: key,
        isoWeek: str(review.isoWeek) || Utils.isoWeekKey(Utils.fromKey(key)),
        ruleVersion: number(review.ruleVersion, REVIEW_RULE_VERSION),
        generatedAt,
        expiresAt,
        seen: !!review.seen,
        downloadedAt: str(review.downloadedAt) || null,
        downloadedFormat: str(review.downloadedFormat) || null,
        status: review.status === 'preview' ? 'preview' : 'final',
        score: Utils.clamp(nonNeg(review.score, total ? Math.round((done / total) * 100) : 0), 0, 100),
        done,
        total,
        unfinished: Math.max(0, nonNeg(review.unfinished, Math.max(0, items.length - done))),
        skippedCount: nonNeg(review.skippedCount, skippedItems.length),
        excusedCount: nonNeg(review.excusedCount),
        waitingCount: nonNeg(review.waitingCount, waiting.length),
        items,
        titles,
        skippedItems,
        waiting,
        daily,
        insights: compactInsights(review.insights),
        plan: compactPlan(review.plan, key)
      };
    });
    return out;
  }

  /** UI/markdown membaca bentuk lama; data kompak tetap jadi sumber penyimpanan. */
  function reviewItems(review) {
    if (!review) return [];
    if (Array.isArray(review.items) && review.items.some((i) => i && i.title !== undefined && !Array.isArray(i))) {
      // Review yang baru dibuat memakai bentuk lama sebelum dikompresi.
      return review.items.map((i) => ({ ...i, cat: str(i.cat || i.category) || 'Pribadi', blk: BLOCK_OF(i.time || i.startTime) }));
    }
    const titles = obj(review.titles, {});
    return arr(review.items, []).map((it) => {
      const t = Array.isArray(titles[it.id]) ? titles[it.id] : [];
      const time = str(t[1]);
      return {
        date: str(it.d), id: str(it.id), s: it.s,
        title: str(t[0]) || 'Aktivitas', time,
        cat: str(t[2]) || 'Pribadi', blk: BLOCK_OF(time),
        reason: it.s === 'p' ? 'Sedang berjalan' : 'Belum ditandai'
      };
    });
  }

  /* ---------- D-01: normalisasi, migrasi, dan pemangkasan ---------- */

  function pruneNotified(map, days = 14) {
    const cutoff = dateKey(Utils.addDays(new Date(), -days));
    return Object.fromEntries(Object.entries(map).filter(([k]) => str(k).slice(0, 10) >= cutoff));
  }

  function migrate(s, sourceVersion) {
    //Versi sumber harus dibaca sebelum mergeDefaults(base, src), karena base
    //sudah memakai SCHEMA_VERSION dan akan menyembunyikan state lawas.
    const version = Number.isFinite(sourceVersion) ? sourceVersion : number(s.version, 1);
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
    if (version < 4) {
      // v1.2.2: perkiraan awal pemakaian = tanggal completion terawal,
      // lalu updatedAt, lalu sekarang. Tidak menghapus laporan lama otomatis.
      const days = Object.keys(obj(s.completion, {}))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort();
      s.firstUseAt = days.length
        ? new Date(Utils.atMinutes(days[0], 0)).toISOString()
        : validISO(s.updatedAt) ? str(s.updatedAt) : new Date().toISOString();
    }
    if (version < 5) {
      // v5: pindahkan snapshot v4 ke format kompak; laporan lama dikompresi
      // oleh normalizeReviews() di bawah. firstUseAt sengaja tidak diubah.
      s.daySnapshots = normalizeDaySnapshots(s.daySnapshots);
      delete s.dayPlans;
      s.chronicDismissedUntil = obj(s.chronicDismissedUntil, {});
      s.scheduleVersion = number(s.scheduleVersion, 1);
    }
    const weeks = new Set(arr(s.generatedWeeks, []));
    s.shopping.forEach((item) => weeks.add(item.weekKey));
    if (!weeks.size) weeks.add(weekKey(new Date()));
    s.generatedWeeks = [...weeks];
    s.restDays = arr(s.restDays, []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(str(d)));
    s.weeklyReviews = normalizeReviews(s.weeklyReviews);
    // v1.2.1: tarik strictSince yang masih di masa depan ke Senin pekan berjalan.
    // Catatan lama tidak diubah — hanya penandaan baru yang mengikuti aturan.
    const currentMonday = Utils.weekKey(new Date());
    const savedStrict = str(s.settings.strictSince);
    s.settings.strictSince = !savedStrict || savedStrict > currentMonday ? currentMonday : savedStrict;
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
      .map((a) => ({
        ...a, isRecurring: a.isRecurring !== false,
        startTime: normTime(a.startTime, str(a.startTime)),
        endTime: normTime(a.endTime, str(a.endTime))
      })));
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
    s.firstUseAt = validISO(src.firstUseAt) ? str(src.firstUseAt) : s.firstUseAt;
    s.daySnapshots = normalizeDaySnapshots(src.daySnapshots || s.daySnapshots);
    if (!Object.keys(s.daySnapshots).length && src.dayPlans) s.daySnapshots = dayPlansToSnapshots(src.dayPlans);
    s.scheduleVersion = number(src.scheduleVersion, 1);
    s.chronicDismissedUntil = obj(src.chronicDismissedUntil, {});
    const settings = s.settings;
    settings.planWindowStart = normTime(settings.planWindowStart, '05.00');
    settings.planWindowEnd = normTime(settings.planWindowEnd, '21.30');
    settings.wakeUpTime = normTime(settings.wakeUpTime, str(settings.wakeUpTime) || '04.00');
    settings.bedtime = normTime(settings.bedtime, str(settings.bedtime) || '21.00');
    settings.recoveryMaxPerDay = Utils.clamp(number(settings.recoveryMaxPerDay, 60), 0, 240);
    if (!Array.isArray(settings.coreCategories)) settings.coreCategories = ['Ibadah', 'Skripsi'];
    delete s.dayPlans;
    return migrate(s, number(src.version, 1));
  }

  /** B.0.5: simpan raw sebelum migrasi; satu slot terbaru saja. */
  function backupBeforeMigration(raw, parsed) {
    const from = number(parsed && parsed.version, 1);
    if (from >= SCHEMA_VERSION) return;
    try {
      const prefix = KEY + ':pre-migrate-v';
      const keys = typeof localStorage.length === 'number' && typeof localStorage.key === 'function'
        ? Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(Boolean)
        : [];
      keys.filter((k) => k.startsWith(prefix)).forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(prefix + from, raw);
    } catch (err) {
      console.warn('Cadangan pra-migrasi gagal dibuat.', err);
    }
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
      const parsed = JSON.parse(raw);
      backupBeforeMigration(raw, parsed);
      return ensureWeekShopping(normalizeState(parsed));
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
      const parsed = JSON.parse(raw);
      backupBeforeMigration(raw, parsed);
      const fresh = ensureWeekShopping(normalizeState(parsed));
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
    // Sama seperti update(): jangan mengarsipkan state in-memory yang stale.
    if (persistTimer) flush();
    reloadFromStorage();
    try { localStorage.setItem(BACKUP_KEY, JSON.stringify(state)); } catch (err) { console.warn('Cadangan impor gagal dibuat.', err); }
    state = ensureWeekShopping(next);
    persist();
    document.dispatchEvent(new CustomEvent('app:changed'));
  }

  function emptyArchive() {
    return { completion: {}, consumption: {} };
  }

  function exportData() {
    return JSON.stringify({
      appVersion: Utils.APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      state,
      archive: emptyArchive()
    }, null, 2);
  }

  /** S9: ekspor menyertakan arsip IndexedDB; gagal baca arsip ≠ gagal ekspor. */
  async function exportDataAsync() {
    const archive = emptyArchive();
    if (typeof Archive !== 'undefined' && Archive.available && Archive.available()) {
      archive.completion = await Archive.all('completion-old');
      archive.consumption = await Archive.all('consumption-old');
    }
    return JSON.stringify({
      appVersion: Utils.APP_VERSION,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      state,
      archive
    }, null, 2);
  }

  /** S9: impor menulis ulang arsip setelah state utama berhasil dipulihkan. */
  async function importDataAsync(json) {
    importData(json);
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    const archive = obj(parsed && parsed.archive, {});
    if (typeof Archive === 'undefined' || !Archive.available || !Archive.available()) return;
    // Timpa seluruh arsip: entri dari state yang diganti tidak boleh ikut ter-ekspor.
    const cleared = await Promise.all([
      Archive.clear('completion-old'),
      Archive.clear('consumption-old')
    ]);
    if (!cleared.every(Boolean)) console.warn('Sebagian arsip lama gagal dibersihkan saat impor.');
    for (const [key, value] of Object.entries(obj(archive.completion, {}))) {
      await Archive.put('completion-old', key, value);
    }
    for (const [key, value] of Object.entries(obj(archive.consumption, {}))) {
      await Archive.put('consumption-old', key, value);
    }
  }

  /**
   * S9: pindahkan riwayat lama ke IndexedDB. Tulis dulu; hanya setelah komit
   * data dihapus dari localStorage dalam satu Store.update().
   */
  function archiveOld(now = new Date()) {
    const result = { completion: 0, consumption: 0 };
    if (typeof Archive === 'undefined' || !Archive.available || !Archive.available()) {
      return Promise.resolve(result);
    }
    const completionCutoff = dateKey(Utils.addDays(now, -ARCHIVE_COMPLETION_DAYS));
    const consumptionCutoff = dateKey(Utils.addDays(now, -ARCHIVE_CONSUMPTION_DAYS));
    const oldCompletion = Object.entries(obj(state.completion, {}))
      .filter(([day]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && day < completionCutoff);
    const oldConsumption = arr(state.consumption, [])
      .filter((c) => c && /^\d{4}-\d{2}-\d{2}$/.test(str(c.date)) && str(c.date) < consumptionCutoff);
    if (!oldCompletion.length && !oldConsumption.length) return Promise.resolve(result);
    const writes = [
      ...oldCompletion.map(([day, value]) => Archive.put('completion-old', day, value).then((ok) => ({ kind: 'completion', day, ok }))),
      ...oldConsumption.map((c) => Archive.put('consumption-old', str(c.id), c).then((ok) => ({ kind: 'consumption', id: str(c.id), ok })))
    ];
    return Promise.all(writes).then((rows) => {
      const doneCompletion = rows.filter((r) => r.kind === 'completion' && r.ok).map((r) => r.day);
      const doneConsumption = rows.filter((r) => r.kind === 'consumption' && r.ok).map((r) => r.id);
      if (!doneCompletion.length && !doneConsumption.length) return result;
      update((s) => {
        doneCompletion.forEach((day) => { delete s.completion[day]; });
        if (doneConsumption.length) {
          s.consumption = arr(s.consumption, []).filter((c) => !doneConsumption.includes(str(c.id)));
        }
      }, true);
      result.completion = doneCompletion.length;
      result.consumption = doneConsumption.length;
      return result;
    }).catch(() => result);
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
    const strictSince = str(target.settings.strictSince) || Utils.weekKey(now);
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
        startTime: activity.startTime || null,
        dur: (() => {
          if (status !== 'completed' || !prev || prev.s !== 'inprogress' || !prev.startedAt) return null;
          const began = Date.parse(prev.startedAt);
          return Number.isFinite(began) ? Math.max(0, Math.round((now.getTime() - began) / 60000)) : null;
        })()
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
        // V3-02: hari istirahat tidak boleh menimpa catatan yang sudah ada.
        if (on) {
          if (prev && (['completed', 'inprogress', 'skipped'].includes(prev.s)
            || (prev.s === 'excused' && prev.src !== 'rest'))) return;
          day[a.id] = { s: 'excused', startedAt: null, at: now.toISOString(), src: 'rest' };
        } else if (prev && prev.s === 'excused' && prev.src === 'rest') {
          delete day[a.id];
        }
      });
      outcome = { ok: true, on, used: on ? used + (already ? 0 : 1) : Math.max(0, used - 1) };
    });
    return outcome;
  }

  /* ---------- Selektor ---------- */

  /** F-02/V3-05: status tampilan turunan windowFor(), bukan logika jam kedua. */
  function activityStatus(activity, date) {
    const saved = statusOf(state.completion[dateKey(date)]?.[activity.id]);
    if (saved === 'completed' || saved === 'skipped' || saved === 'excused') return saved;
    const now = new Date();
    const key = dateKey(date);
    const today = dateKey(now);
    if (key < today) return saved === 'inprogress' ? 'inprogress' : 'missed';
    if (key > today) return 'upcoming';
    if (saved === 'inprogress') return 'inprogress';
    const win = windowFor(activity, key, now);
    if (!win.ok) return 'upcoming';
    if (now < win.opensAt) return 'upcoming';
    if (now < win.closesAt) return 'ongoing';
    if (now < win.lastTick) return 'grace';
    return 'missed';
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

  /** S9/V3-08: bekukan jadwal hari yang sudah lewat saat pertama dibuka setelahnya. */
  function freezeDays(target, now = new Date()) {
    target.daySnapshots = normalizeDaySnapshots(target.daySnapshots, now);
    const firstDay = dateKey(new Date(Date.parse(target.firstUseAt) || now.getTime()));
    const cutoff = dateKey(Utils.addDays(now, -(DAY_SNAPSHOT_MAX - 1)));
    const start = firstDay > cutoff ? firstDay : cutoff;
    const yesterdayKey = dateKey(Utils.addDays(now, -1));
    let cursor = new Date(Utils.atMinutes(start, 0));
    while (dateKey(cursor) <= yesterdayKey) {
      const key = dateKey(cursor);
      if (!target.daySnapshots[key]) {
        const rows = activitiesForDayIn(target, cursor).map((a) => [
          str(a.id), str(a.startTime), str(a.endTime || a.startTime),
          str(a.category) || 'Pribadi', str(a.title) || 'Aktivitas'
        ]);
        if (rows.length) target.daySnapshots[key] = { v: number(target.scheduleVersion, 1), a: rows };
      }
      cursor = Utils.addDays(cursor, 1);
    }
  }

  /** buildReview memakai snapshot harian bila tersedia; jadwal sekarang hanya fallback. */
  function scheduleForDate(target, date) {
    const frozen = (target.daySnapshots || {})[dateKey(date)];
    if (frozen && Array.isArray(frozen.a)) {
      return frozen.a.map((r) => ({
        id: str(r[0]), startTime: str(r[1]), endTime: str(r[2]),
        category: str(r[3]) || 'Pribadi', title: str(r[4]) || 'Aktivitas'
      })).sort((a, b) => (parseTime(a.startTime) ?? 0) - (parseTime(b.startTime) ?? 0));
    }
    return activitiesForDayIn(target, date);
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

  const PLAN_NO_SLOT = 'Tidak ada celah minggu depan; pertimbangkan mengurangi aktivitas lain';

  function findPlanSlot(target, opts, now = new Date()) {
    if (typeof Planner === 'undefined' || typeof Planner.findSlot !== 'function') return null;
    return Planner.findSlot({ ...opts, now }, target, activitiesForDayIn);
  }

  /** Menit pemulihan aktif pada suatu tanggal (tanpa aktivitas yang diganti). */
  function recoveryMinutes(s, date, ignoreId = null) {
    if (typeof Planner === 'undefined' || typeof Planner.activeOn !== 'function') return 0;
    return Planner.activeOn(s, date)
      .filter((a) => a && a.origin === 'recovery' && a.id !== ignoreId)
      .reduce((sum, a) => {
        const end = parseTime(a.endTime);
        const start = parseTime(a.startTime);
        return sum + (end != null && start != null && end > start ? end - start : 0);
      }, 0);
  }

  function quotaFits(s, date, duration, ignoreId = null) {
    const cap = Utils.clamp(number(s.settings && s.settings.recoveryMaxPerDay, 60), 0, 240);
    return recoveryMinutes(s, str(date), ignoreId) + Math.max(0, number(duration, 0)) <= cap;
  }

  function planWhen(suggested) {
    if (!suggested || !suggested.date) return '';
    const when = Utils.fromKey(suggested.date);
    return `${Utils.dayName(Utils.dow(when), true)} ${Utils.formatDate(when, { short: true })}, ${Utils.fmtTime(suggested.start)}–${Utils.fmtTime(suggested.end)}`;
  }

  function planReason(plan) {
    return (plan && (plan.reason || plan.action)) || PLAN_NO_SLOT;
  }

  /** S2: teks dirender saat tampil, tidak pernah disimpan di snapshot. */
  function insightText(insight) {
    const i = insight || {};
    const d = obj(i.data, {});
    const pct = (v) => `${Math.round(number(v, 0))}%`;
    switch (i.kind) {
      case 'celebrate':
        return `Skor minggu ini ${number(d.score, 0)}%. Pertahankan ritme ini.`;
      case 'recurring-miss': {
        const days = arr(d.days, []).map((k) => Utils.dayName(Utils.dow(Utils.fromKey(k)), true)).join(', ');
        const label = str(d.category) ? `${str(d.category)} ${Utils.fmtTime(d.time || '')}` : str(d.title);
        return `${label} tidak tercatat ${number(d.count, 0)} kali (${days}). Geser ke 19.00?`;
      }
      case 'block-weak':
        return `Blok ${str(d.block)} tidak tercatat ${pct(number(d.pct, 0) * 100)} dari ${number(d.total, 0)} aktivitas. Coba jadwal di blok lain.`;
      case 'worst-day': {
        const when = Utils.fromKey(d.date);
        return `${Utils.dayName(Utils.dow(when), true)} ${Utils.formatDate(when, { short: true })}: ${number(d.pct, 0)}% selesai terhadap rata-rata ${pct(d.avg)}. Lihat hari itu?`;
      }
      case 'category-weak':
        return `Kategori ${str(d.category)}: ${pct(d.pct)} selesai terhadap rata-rata ${pct(d.avg)}. Atur ulang jadwalnya?`;
      case 'trend':
        return `Skor berubah ${number(d.delta, 0) > 0 ? '+' : ''}${number(d.delta, 0)} poin dari minggu lalu.`;
      case 'last-minute':
        return `${pct(d.pct)} aktivitas ditandai menjelang akhir jendela. Sesuaikan pengingat atau toleransi?`;
      case 'legacy':
        return `${str(d.title)} — ${str(d.detail)}`;
      default:
        return 'Ada pola yang bisa ditindaklanjuti minggu ini.';
    }
  }

  /** S1: kronis hanya diambil dari tiga laporan final terakhir sebelum minggu ini. */
  function chronicFor(target, weekStartKey, items, titles) {
    const dismissed = obj(target.chronicDismissedUntil, {});
    const deleted = arr(target.deletedTemplateIds, []).map((v) => str(v));
    const finals = Object.values(obj(target.weeklyReviews, {}))
      .filter((r) => r && r.status === 'final' && str(r.weekKey) < weekStartKey)
      .sort((a, b) => str(b.weekKey).localeCompare(str(a.weekKey)))
      .slice(0, 3);
    if (finals.length < 3) return null;
    const keyOf = (item) => {
      const found = (target.activities || []).find((a) => a.id === item.id);
      return str(found && (found.templateId || found.id)) || str(item.title) || str(item.id);
    };
    const count = new Map();
    items.forEach((item) => {
      const k = keyOf(item);
      count.set(k, (count.get(k) || 0) + 1);
      if (!titles[item.id]) titles[item.id] = [str(item.title) || 'Aktivitas', str(item.time), str(item.cat) || 'Pribadi'];
    });
    for (const [key, total] of count) {
      if (total < 1) continue;
      if (deleted.includes(key) || Date.parse(str(dismissed[key])) > Date.now()) continue;
      // `reviewItems` berisi aktivitas yang tidak tercatat; kronis berarti
      // pola itu muncul sebagai miss di ketiga laporan final sebelumnya.
      const missedEverywhere = finals.every((r) => reviewItems(r).some((row) => keyOf(row) === key));
      if (!missedEverywhere) continue;
      const sample = items.find((item) => keyOf(item) === key) || {};
      return {
        id: key, title: str(sample.title) || key, category: str(sample.cat) || 'Pribadi',
        durationMin: Math.max(5, number(sample.duration, 20))
      };
    }
    return null;
  }

  /** B.4: satu snapshot lengkap; tidak pernah dihitung ulang setelah final. */
  function buildReview(target, weekStartKey, status) {
    const times = reviewTimes(weekStartKey);
    const days = Utils.weekDates(Utils.fromKey(weekStartKey));
    const fullItems = [], compact = [], skippedItems = [], waiting = [], daily = [];
    const titles = {};
    const blockTotals = { pagi: 0, siang: 0, sore: 0, malam: 0 };
    const blockMissed = { pagi: 0, siang: 0, sore: 0, malam: 0 };
    const categoryStats = {};
    const lastMinute = { done: 0, grace: 0 };
    let done = 0, unfinished = 0, excused = 0;
    days.forEach((date) => {
      const key = dateKey(date);
      const rec = (target.completion || {})[key] || {};
      const acts = scheduleForDate(target, date);
      // Aktivitas dihapus di tengah minggu tetap dihitung sampai hari penghapusan.
      const restored = Object.keys(rec)
        .filter((id) => !acts.some((a) => a.id === id))
        .map((id) => {
          const r = normRecord(rec[id]);
          return {
            id, restored: true,
            title: (r && r.title) || 'Aktivitas yang dihapus',
            startTime: (r && r.startTime) || '', endTime: '', category: 'Pribadi'
          };
        });
      let dayDone = 0, dayTotal = 0;
      acts.concat(restored).forEach((a) => {
        const record = normRecord(rec[a.id]);
        const s = record ? record.s : '';
        if (s === 'excused') { excused += 1; return; }
        if (s === 'skipped') {
          skippedItems.push({ date: key, id: a.id, title: a.title, time: a.startTime || '' });
          return;
        }
        const cat = str(a.category) || 'Pribadi';
        const blk = BLOCK_OF(a.startTime);
        const cs = categoryStats[cat] || (categoryStats[cat] = { total: 0, done: 0 });
        cs.total += 1;
        if (blk) blockTotals[blk] += 1;
        if (s === 'completed') {
          done += 1; dayDone += 1; dayTotal += 1; cs.done += 1;
          if (record && record.src === 'grace') lastMinute.grace += 1;
          lastMinute.done += 1;
          return;
        }
        // V3-07: pratinjau Minggu 21.00 tidak menghitung aktivitas yang belum waktunya.
        const startMin = parseTime(a.startTime);
        const startAt = startMin == null ? null : Utils.atMinutes(key, startMin);
        if (status === 'preview' && startAt != null && startAt > times.previewAt) {
          waiting.push({ date: key, id: a.id, title: a.title, time: a.startTime || '', reason: 'Menunggu' });
          return;
        }
        dayTotal += 1;
        unfinished += 1;
        if (blk) blockMissed[blk] += 1;
        const item = {
          date: key, id: str(a.id), title: str(a.title) || 'Aktivitas', time: str(a.startTime),
          cat, blk, s: 'm', duration: activityMinutes(a),
          reason: s === 'inprogress' ? 'Sedang berjalan' : 'Belum ditandai'
        };
        fullItems.push(item);
        titles[item.id] = [item.title, item.time, cat];
      });
      daily.push({
        key, label: Utils.dayName(Utils.dow(date), true),
        done: dayDone, total: dayTotal,
        pct: dayTotal ? Math.round((dayDone / dayTotal) * 100) : 0
      });
    });
    const total = done + unfinished;
    const score = total ? Math.round((done / total) * 100) : 0;
    fullItems.forEach((i) => compact.push({ d: i.date, id: i.id, s: i.reason === 'Sedang berjalan' ? 'p' : 'm' }));

    const at = status === 'final' ? times.finalAt : times.previewAt;
    const now = new Date(at);
    const core = Array.isArray(target.settings.coreCategories) ? target.settings.coreCategories : ['Ibadah', 'Skripsi'];
    const freq = new Map();
    fullItems.forEach((i) => {
      const k = str(i.id) || str(i.title);
      freq.set(k, (freq.get(k) || 0) + 1);
    });
    // recoveryDepth ≤ 1: aktivitas pemulihan tidak menjadi sumber rencana berikutnya.
    const sources = fullItems.filter((i) => {
      const source = (target.activities || []).find((a) => a.id === i.id);
      return !(source && source.origin === 'recovery');
    });
    sources.sort((a, b) => {
      const ac = core.includes(a.cat) ? 1 : 0;
      const bc = core.includes(b.cat) ? 1 : 0;
      const af = freq.get(str(a.id) || str(a.title)) || 0;
      const bf = freq.get(str(b.id) || str(b.title)) || 0;
      return bc - ac || bf - af || a.date.localeCompare(b.date) || String(a.time).localeCompare(String(b.time));
    });
    const plan = sources.slice(0, 5).map((i, n) => {
      const durationMin = Math.max(5, number(i.duration, 20));
      // Usulan selalu dihitung dari hari ini agar laporan catch-up tidak
      // menghasilkan aktivitas pemulihan di tanggal yang sudah lewat.
      const suggested = findPlanSlot(target, {
        from: dateKey(new Date()), durationMin, category: i.cat, preferTime: i.time
      });
      return {
        id: `plan-${weekStartKey}-${n + 1}`, activityId: i.id, title: i.title, category: i.cat,
        durationMin, status: 'proposed', suggested, createdActivityId: null, kind: 'recover',
        ...(suggested ? {} : { reason: PLAN_NO_SLOT })
      };
    });
    const chronic = chronicFor(target, weekStartKey, fullItems, titles);
    if (chronic) {
      const suggested = findPlanSlot(target, {
        from: dateKey(new Date()), durationMin: chronic.durationMin, category: chronic.category
      });
      plan.push({
        id: `plan-${weekStartKey}-chronic`, activityId: chronic.id, title: chronic.title,
        category: chronic.category, durationMin: chronic.durationMin, status: 'proposed',
        suggested, createdActivityId: null, kind: 'chronic',
        ...(suggested ? {} : { reason: PLAN_NO_SLOT })
      });
    }

    const prev = obj(target.weeklyReviews, {})[previousWeekKey(weekStartKey)];
    const insightInput = {
      review: { score, done, total, blockTotals, blockMissed, categoryStats, lastMinute },
      prev, items: fullItems, daily, firstUseAt: target.firstUseAt, now
    };
    const insights = typeof Insights !== 'undefined' && typeof Insights.compute === 'function'
      ? Insights.compute(insightInput) : [];
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
      waitingCount: waiting.length,
      items: compact, titles, skippedItems, waiting, daily,
      blockTotals, blockMissed, categoryStats, lastMinute,
      insights: insights.slice(0, 3),
      plan
    };
  }

  function pruneReviews(target, now) {
    const all = obj(target.weeklyReviews, {});
    const ms = now.getTime();
    Object.keys(all).forEach((k) => {
      const r = all[k];
      const expiry = Date.parse(r && r.expiresAt);
      if (isExpired(r, now) && r.seen) { delete all[k]; return; }
      // V3-04: penahanan "belum dibuka" punya batas keras 14 hari.
      if (r && r.status === 'final' && Number.isFinite(expiry) && expiry + REVIEW_HOLD_DAYS * 86400000 <= ms) delete all[k];
    });
    // Empat laporan final terbaru yang masih berlaku, dan maksimal delapan
    // laporan final tersimpan secara keseluruhan.
    Object.entries(all)
      .filter(([, r]) => r.status === 'final' && !isExpired(r, now))
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(REVIEW_KEEP)
      .forEach(([k]) => { delete all[k]; });
    Object.entries(all)
      .filter(([, r]) => r.status === 'final')
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(REVIEW_MAX_TOTAL)
      .forEach(([k]) => { delete all[k]; });
    target.weeklyReviews = all;
  }

  /** D.1: idempoten, dibuat satu kali per minggu lewat Store.update(). */
  function ensureReviews(now = new Date()) {
    let created = 0, promoted = 0;
    update((s) => {
      s.weeklyReviews = obj(s.weeklyReviews, {});
      freezeDays(s, now);
      const current = weekKey(now);
      const firstUse = Date.parse(s.firstUseAt);
      // back=0 penting: pratinjau Minggu 21.00 dibuat untuk minggu yang masih berjalan.
      for (let back = 0; back <= CATCHUP_MAX; back += 1) {
        const wk = previousWeekKey(current, back);
        const times = reviewTimes(wk);
        const at = now.getTime();
        // V3-01: jangan membuat laporan untuk minggu sebelum aplikasi dipakai.
        const weekStart = Utils.atMinutes(wk, 0);
        const weekEnd = Utils.atMinutes(wk, 7 * 1440);
        if (Number.isFinite(firstUse) && weekEnd <= firstUse) continue;
        if (Number.isFinite(firstUse) && weekStart <= firstUse && firstUse < weekEnd) {
          const hasCompletion = Utils.weekDates(Utils.fromKey(wk))
            .some((d) => Object.keys((s.completion || {})[dateKey(d)] || {}).length);
          if (!hasCompletion) continue;
        }
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

  /**
   * S1: terima rencana → satu aktivitasRecovery sekali jadi. Slot diperiksa
   * ulang; bila terpakai, kembalikan usulan baru dan minta konfirmasi.
   */
  function acceptPlan(weekStartKey, planId, override = null) {
    let outcome = { ok: false, reason: 'Rencana tidak ditemukan.' };
    update((s) => {
      const r = s.weeklyReviews[weekStartKey];
      if (!r) return;
      const p = arr(r.plan, []).find((item) => item.id === planId);
      if (!p) return;
      if (p.status === 'accepted' && p.createdActivityId) {
        outcome = { ok: true, reason: '', activityId: p.createdActivityId, idempotent: true, suggested: p.suggested };
        return;
      }
      if (p.status === 'skipped') { outcome = { ok: false, reason: 'Rencana sudah dilewati.' }; return; }
      const wanted = obj(override, null) && str(override.date) ? override : p.suggested;
      const recalc = () => findPlanSlot(s, {
        from: dateKey(new Date()), durationMin: number(p.durationMin, 20),
        category: p.category, preferTime: str(p.suggested && p.suggested.start)
      }, new Date());
      if (!wanted || !str(wanted.date)) {
        const fresh = recalc();
        if (fresh) {
          p.suggested = fresh;
          outcome = { ok: false, reason: 'Jadwal perlu disesuaikan. Konfirmasi usulan baru?', suggestion: fresh };
        } else outcome = { ok: false, reason: PLAN_NO_SLOT };
        return;
      }
      // Laporan catch-up boleh berisi usulan lama; jangan pernah membuat
      // aktivitas di tanggal yang sudah lewat tanpa konfirmasi jadwal baru.
      if (str(wanted.date) < dateKey(new Date())) {
        const fresh = recalc();
        if (fresh) p.suggested = fresh;
        outcome = {
          ok: false, reason: 'Usulan sudah lewat. Konfirmasi jadwal baru?',
          suggestion: fresh || null
        };
        return;
      }
      if (typeof Planner !== 'undefined' && typeof Planner.isSlotFree === 'function'
        && !Planner.isSlotFree(s, wanted, p.createdActivityId, activitiesForDayIn)) {
        const fresh = recalc();
        if (fresh) p.suggested = fresh;
        outcome = {
          ok: false, reason: 'Slot sudah terpakai. Konfirmasi jadwal baru?',
          suggestion: fresh || null
        };
        return;
      }
      const span = (parseTime(wanted.end) ?? 0) - (parseTime(wanted.start) ?? 0);
      if (!quotaFits(s, str(wanted.date), span > 0 ? span : number(p.durationMin, 20))) {
        const fresh = recalc();
        if (fresh) p.suggested = fresh;
        outcome = {
          ok: false, reason: 'Kuota pemulihan harian penuh. Konfirmasi jadwal baru?',
          suggestion: fresh || null
        };
        return;
      }
      const activity = {
        id: Utils.uid('rec'), title: str(p.title) || 'Aktivitas pemulihan',
        category: str(p.category) || 'Pribadi',
        dayOfWeek: Utils.dow(Utils.fromKey(str(wanted.date))),
        startTime: str(wanted.start), endTime: str(wanted.end),
        isRecurring: false, date: str(wanted.date), isTemplate: false,
        origin: 'recovery', recoveryOf: str(p.activityId) || null
      };
      s.activities.push(activity);
      p.status = 'accepted';
      p.suggested = { date: activity.date, start: activity.startTime, end: activity.endTime };
      p.createdActivityId = activity.id;
      outcome = { ok: true, reason: '', activityId: activity.id, suggested: p.suggested };
    });
    return outcome;
  }

  /** S1: batalkan hanya bila aktivitas pemulihan belum ditandai. */
  function undoPlan(weekStartKey, planId) {
    let outcome = { ok: false, reason: 'Rencana tidak ditemukan.' };
    update((s) => {
      const r = s.weeklyReviews[weekStartKey];
      if (!r) return;
      const p = arr(r.plan, []).find((item) => item.id === planId);
      if (!p || !['accepted', 'skipped'].includes(p.status)) { outcome = { ok: false, reason: 'Rencana belum diputuskan.' }; return; }
      if (p.status === 'skipped') {
        p.status = 'proposed';
        p.decision = null;
        outcome = { ok: true, reason: '' };
        return;
      }
      const id = str(p.createdActivityId);
      const idx = s.activities.findIndex((a) => a.id === id);
      if (idx >= 0) {
        const used = Object.values(obj(s.completion, {}))
          .some((day) => !!statusOf(day && day[id]));
        if (used) { outcome = { ok: false, reason: 'Aktivitas sudah ditandai; tidak bisa dibatalkan.' }; return; }
        s.activities.splice(idx, 1);
      }
      p.status = 'proposed';
      p.createdActivityId = null;
      outcome = { ok: true, reason: '' };
    });
    return outcome;
  }

  /** S1: ubah jam usulan dengan validasi tumpang tindih. */
  function editPlanSlot(weekStartKey, planId, suggested) {
    let outcome = { ok: false, reason: 'Jadwal tidak valid.' };
    const wanted = obj(suggested, null);
    if (!wanted || !/^\d{4}-\d{2}-\d{2}$/.test(str(wanted.date))
      || parseTime(wanted.start) == null || parseTime(wanted.end) == null
      || parseTime(wanted.end) <= parseTime(wanted.start)) {
      return { ok: false, reason: 'Isi tanggal dan jam dengan benar.' };
    }
    update((s) => {
      const r = s.weeklyReviews[weekStartKey];
      if (!r) return;
      const p = arr(r.plan, []).find((item) => item.id === planId);
      if (!p) return;
      if (p.status === 'accepted') {
        outcome = { ok: false, reason: 'Rencana sudah diterima. Batalkan dulu untuk mengubah jam.' };
        return;
      }
      if (str(wanted.date) < dateKey(new Date())) {
        outcome = { ok: false, reason: 'Tanggal sudah lewat.' };
        return;
      }
      if (typeof Planner !== 'undefined' && typeof Planner.isSlotFree === 'function'
        && !Planner.isSlotFree(s, wanted, p.createdActivityId, activitiesForDayIn)) {
        outcome = { ok: false, reason: 'Jam itu bertabrakan dengan aktivitas lain.' };
        return;
      }
      if (!quotaFits(s, str(wanted.date), parseTime(wanted.end) - parseTime(wanted.start), p.createdActivityId)) {
        outcome = { ok: false, reason: 'Kuota pemulihan harian sudah penuh.' };
        return;
      }
      p.suggested = { date: str(wanted.date), start: str(wanted.start), end: str(wanted.end) };
      p.reason = '';
      outcome = { ok: true, reason: '', suggested: p.suggested };
    });
    return outcome;
  }

  /** Kompatibilitas pemanggil lama; kini benar-benar menjadwalkan saat diterima. */
  function setPlanDecision(weekStartKey, ids = [], accepted = true) {
    const wanted = arr(ids, []);
    const plans = obj(state.weeklyReviews[weekStartKey] && state.weeklyReviews[weekStartKey].plan, []);
    let changed = 0;
    plans.forEach((p) => {
      if (wanted.length && !wanted.includes(p.id)) return;
      if (p.status === 'accepted' || p.status === 'skipped') return;
      if (accepted && acceptPlan(weekStartKey, p.id).ok) changed += 1;
      else if (!accepted && skipPlan(weekStartKey, p.id)) changed += 1;
    });
    return changed;
  }

  function skipPlan(weekStartKey, planId) {
    let changed = 0;
    update((s) => {
      const r = s.weeklyReviews[weekStartKey];
      if (!r) return;
      arr(r.plan, []).forEach((p) => {
        if (p.id !== planId || p.status !== 'proposed') return;
        p.status = 'skipped';
        changed += 1;
      });
    });
    return changed > 0;
  }

  /** S1: tiga pilihan kronis; "pertahankan" menunda 28 hari. */
  function resolveChronic(weekStartKey, planId, choice) {
    let outcome = { ok: false, reason: 'Rencana kronis tidak ditemukan.' };
    update((s) => {
      const r = s.weeklyReviews[weekStartKey];
      if (!r) return;
      const p = arr(r.plan, []).find((item) => item.id === planId && item.kind === 'chronic');
      if (!p) return;
      if (choice === 'keep') {
        s.chronicDismissedUntil[p.activityId] = new Date(Date.now() + 28 * 86400000).toISOString();
        p.status = 'skipped';
        p.decision = 'keep';
        outcome = { ok: true, reason: '', choice };
        return;
      }
      if (choice === 'delete') {
        const key = str(p.activityId);
        if (!arr(s.deletedTemplateIds, []).includes(key)) s.deletedTemplateIds.push(key);
        // Tanpa penanda ini pola lama tetap muncul dari tiga laporan tersimpan.
        s.chronicDismissedUntil[key] = new Date(Date.now() + 28 * 86400000).toISOString();
        s.activities = arr(s.activities, []).filter((a) => str(a.templateId || a.id) !== key);
        p.status = 'skipped';
        p.decision = 'delete';
        outcome = { ok: true, reason: '', choice };
        return;
      }
      outcome = { ok: false, reason: 'Pilihan tidak dikenali.' };
    });
    return outcome;
  }

  /** S9: baca ulang myState dan bekukan hari yang baru lewat (dipanggil saat init). */
  function freezeDaysNow(now = new Date()) {
    return update((s) => { freezeDays(s, now); }, true);
  }

  /** V3-01: hapus hanya laporan 0% dari minggu sebelum firstUseAt. */
  function cleanupFakeReviews() {
    const firstUse = Date.parse(state.firstUseAt);
    if (!Number.isFinite(firstUse)) return 0;
    let removed = 0;
    update((s) => {
      Object.entries(obj(s.weeklyReviews, {})).forEach(([key, r]) => {
        if (!r || r.status !== 'final' || Utils.atMinutes(key, 7 * 1440) > firstUse) return;
        if (number(r.total, 0) > 0 && number(r.done, 0) === 0 && number(r.skippedCount, 0) === 0) {
          delete s.weeklyReviews[key];
          removed += 1;
        }
      });
    }, true);
    if (removed) document.dispatchEvent(new CustomEvent('app:changed'));
    return removed;
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
    const expiryMs = Date.parse(r.expiresAt);
    const deletedAfter = Number.isFinite(expiryMs)
      ? Utils.formatDate(new Date(expiryMs + REVIEW_HOLD_DAYS * 86400000)) : '—';
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
      ...(r.items.length ? reviewItems(r).map((i) => `- [ ] ${Utils.dayName(Utils.dow(Utils.fromKey(i.date)), true)}, ${i.time || '-'} — ${i.title} (${i.reason})`) : ['- Tidak ada.']),
      '',
      '## Sengaja dilewati',
      ...(r.skippedItems.length ? r.skippedItems.map((i) => `- ${Utils.dayName(Utils.dow(Utils.fromKey(i.date)), true)} — ${i.title}`) : ['- Tidak ada.']),
      '',
      '## Insight',
      ...(r.insights.length ? r.insights.map((i, n) => `${n + 1}. ${insightText(i)}`) : ['- Data belum cukup untuk saran minggu ini.']),
      '',
      '## Rencana pemulihan',
      ...(r.plan.length ? r.plan.map((p, n) => `${n + 1}. [${p.status === 'accepted' ? 'x' : ' '}] ${p.title} — ${p.suggested ? planWhen(p.suggested) : planReason(p)}`) : ['- Tidak ada rencana.']),
      '',
      '## Detail harian',
      '| Hari | Selesai | Dihitung | Persentase |',
      '|---|---:|---:|---:|',
      ...r.daily.map((d) => `| ${d.label} | ${d.done} | ${d.total} | ${d.pct}% |`),
      '',
      `Salinan ini milik Anda. Laporan di app dihapus setelah ${deletedAfter}.`
    ];
    return lines.join('\n');
  }

  return {
    KEY, BACKUP_KEY, SCHEMA_VERSION, APP_VERSION: Utils.APP_VERSION,
    REVIEW_HOLD_DAYS, REVIEW_MAX_TOTAL, DAY_PLAN_MAX, DAY_SNAPSHOT_MAX,
    ARCHIVE_COMPLETION_DAYS, ARCHIVE_CONSUMPTION_DAYS,
    get state() { return state; }, update, persist, persistSoon, flush, reset,
    importData, importDataAsync, exportData, exportDataAsync, describeImport, archiveOld,
    markBackup, backupAgeDays,
    normalizeState, reloadFromStorage, refreshWeek, ensureWeekShopping,
    activitiesForDayIn, activitiesForDay, activityMinutes, windowFor, canMark, setActivityStatus, setRestDay,
    statusOf, progressForDate, weekProgress, applyTemplate, saveMentorNotes,
    activityStatus,
    ensureReviews, reviewFor, reviewList, reviewStats, markReviewSeen, markReviewDownloaded,
    freezeDays: freezeDaysNow, reviewItems, insightText, planWhen, planReason,
    setPlanDecision, acceptPlan, undoPlan, editPlanSlot, skipPlan, resolveChronic,
    cleanupFakeReviews, reviewMarkdown, reviewFileName, isExpired, daysLeft,
    nearestTasks, fruitKinds, consumptionForDate, servingsForDate, servingsForWeek, dailyTarget, weeklyTarget,
    activeInventory, consumeSoonInventory, isConsumeSoon, consumeSoonReason, servingsToQty, stockUseLabel, deductStock,
    currentWeekShopping, shoppingTotals, reminderFor, setReminder, targetForDay, taskStats, fruitById, nextShoppingReminder
  };
})();
