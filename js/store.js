/* ---------- Penyimpanan lokal & selektor data ---------- */
const Store = (() => {
  const KEY = 'rutin-buah:v1';
  const BACKUP_KEY = KEY + ':pre-import';
  const SCHEMA_VERSION = 2;
  const { mergeDefaults, dateKey, weekKey, dow, parseTime, dayName, number } = Utils;

  const arr = (v, fb) => (Array.isArray(v) ? v : fb);
  const obj = (v, fb) => (v && typeof v === 'object' && !Array.isArray(v) ? v : fb);
  const str = (v, fb = '') => (typeof v === 'string' ? v : fb);

  function defaultState() {
    return {
      version: SCHEMA_VERSION,
      settings: JSON.parse(JSON.stringify(Seed.settings)),
      activities: Seed.buildActivities(Seed.settings),
      completion: {},
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
    const weeks = new Set(arr(s.generatedWeeks, []));
    s.shopping.forEach((item) => weeks.add(item.weekKey));
    if (!weeks.size) weeks.add(weekKey(new Date()));
    s.generatedWeeks = [...weeks];
    s.version = SCHEMA_VERSION;
    return s;
  }

  function normalizeState(parsed) {
    const base = defaultState();
    const src = obj(parsed, {});
    const s = mergeDefaults(base, src);
    s.settings = mergeDefaults(base.settings, obj(src.settings, {}));
    s.customTargets = obj(src.customTargets, {});
    s.activities = arr(src.activities, base.activities)
      .filter((a) => a && a.id && a.title && number(a.dayOfWeek) >= 1 && number(a.dayOfWeek) <= 7)
      .map((a) => ({ ...a, isRecurring: a.isRecurring !== false }));
    if (!s.activities.length) s.activities = base.activities;
    s.tasks = arr(src.tasks, base.tasks).filter((t) => t && t.id && t.title);
    if (!s.tasks.length && Array.isArray(src.tasks)) s.tasks = [];
    s.inventory = arr(src.inventory, []).filter((i) => i && i.id && i.name);
    s.consumption = arr(src.consumption, []).filter((c) => c && c.id && /^\d{4}-\d{2}-\d{2}$/.test(str(c.date)));
    s.shopping = arr(src.shopping, base.shopping)
      .filter((i) => i && i.id)
      .map((i) => ({ ...i, templateId: i.templateId || i.id }));
    if (!s.shopping.length && !Array.isArray(src.shopping)) s.shopping = base.shopping;
    s.completion = obj(src.completion, {});
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
    if (persistTimer) persist();
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
    return {
      state: candidate,
      summary: `${candidate.activities.length} aktivitas, ${candidate.tasks.length} tugas, ${candidate.consumption.length} catatan konsumsi, ${candidate.shopping.length} item belanja.`
    };
  }

  function importData(json) {
    const { state: next } = describeImport(json);
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

  /* ---------- Selektor ---------- */

  /**
   * F-08: menerima angka hari (kompatibel) atau Date/kunci tanggal.
   * Aktivitas "sekali jadi" hanya muncul pada tanggalnya.
   */
  function activitiesForDay(dayOrDate) {
    const isDate = dayOrDate instanceof Date || (typeof dayOrDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayOrDate));
    const day = isDate ? dow(dayOrDate) : Number(dayOrDate);
    const key = isDate ? dateKey(dayOrDate) : null;
    return state.activities
      .filter((a) => Number(a.dayOfWeek) === day && (a.isRecurring !== false || (key && a.date === key)))
      .sort((a, b) => (parseTime(a.startTime) ?? 0) - (parseTime(b.startTime) ?? 0));
  }

  /** F-02: tanggal diperiksa lebih dulu, baru jam. */
  function activityStatus(activity, date) {
    const rec = state.completion[dateKey(date)] || {};
    const saved = rec[activity.id];
    if (saved === 'completed' || saved === 'skipped') return saved;
    const now = new Date();
    const key = dateKey(date);
    const today = dateKey(now);
    if (key < today) return 'missed';
    if (key > today) return 'upcoming';
    const current = now.getHours() * 60 + now.getMinutes();
    const start = parseTime(activity.startTime) ?? 0;
    const end = Math.max(start, parseTime(activity.endTime) ?? start);
    if (current >= end) return 'missed';
    if (current >= start) return 'ongoing';
    return 'upcoming';
  }

  function setActivityStatus(activityId, date, status) {
    update((s) => {
      const key = dateKey(date);
      if (!s.completion[key]) s.completion[key] = {};
      if (status) s.completion[key][activityId] = status;
      else delete s.completion[key][activityId];
    });
  }

  function progressForDate(date) {
    const key = dateKey(date);
    const acts = activitiesForDay(date);
    const rec = state.completion[key] || {};
    const done = acts.filter((a) => rec[a.id] === 'completed').length;
    return { done, total: acts.length, pct: acts.length ? Math.round((done / acts.length) * 100) : 0 };
  }

  function weekProgress(reference = new Date()) {
    const dates = Utils.weekDates(reference).filter((d) => d <= new Date());
    let done = 0, total = 0;
    dates.forEach((d) => {
      const acts = activitiesForDay(d);
      const rec = state.completion[dateKey(d)] || {};
      total += acts.length;
      done += acts.filter((a) => rec[a.id] === 'completed').length;
    });
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0, days: dates.length };
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

  return {
    KEY, BACKUP_KEY, SCHEMA_VERSION, APP_VERSION: Utils.APP_VERSION,
    get state() { return state; }, update, persist, persistSoon, flush, reset, importData, exportData, describeImport,
    markBackup, backupAgeDays,
    normalizeState, reloadFromStorage, refreshWeek, ensureWeekShopping,
    activitiesForDay, activityStatus, setActivityStatus, progressForDate, weekProgress,
    nearestTasks, fruitKinds, consumptionForDate, servingsForDate, servingsForWeek, dailyTarget, weeklyTarget,
    activeInventory, consumeSoonInventory, isConsumeSoon, consumeSoonReason, servingsToQty, stockUseLabel, deductStock,
    currentWeekShopping, shoppingTotals, reminderFor, setReminder, targetForDay, taskStats, fruitById, nextShoppingReminder
  };
})();
