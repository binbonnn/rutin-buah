/* ---------- Penyimpanan lokal & selektor data ---------- */
const Store = (() => {
  const KEY = 'rutin-buah:v1';
  const { deepMerge, dateKey, weekKey, dow, parseTime, dayName } = Utils;

  function defaultState() {
    return {
      version: 1,
      settings: JSON.parse(JSON.stringify(Seed.settings)),
      activities: Seed.buildActivities(Seed.settings),
      completion: {},
      customTargets: {},
      tasks: JSON.parse(JSON.stringify(Seed.thesisTasks)),
      mentorshipNotes: '',
      fruitCatalog: JSON.parse(JSON.stringify(Seed.fruitCatalog)),
      inventory: Seed.initialInventory(),
      consumption: [],
      shopping: Seed.shoppingTemplate.map((i) => ({ ...i, weekKey: weekKey(new Date()) })),
      reminders: {},
      notified: {},
      updatedAt: new Date().toISOString()
    };
  }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      const merged = deepMerge(base, parsed);
      merged.settings = deepMerge(base.settings, parsed.settings || {});
      if (!Array.isArray(merged.activities) || !merged.activities.length) merged.activities = base.activities;
      if (!Array.isArray(merged.shopping)) merged.shopping = base.shopping;
      ensureWeekShopping(merged);
      return merged;
    } catch (err) {
      console.error('Gagal memuat data, menggunakan data awal.', err);
      return defaultState();
    }
  }

  function ensureWeekShopping(target = state) {
    const wk = weekKey(new Date());
    if (!target.shopping.some((i) => i.weekKey === wk)) {
      const fresh = Seed.shoppingTemplate.map((i) => ({
        ...i,
        weekKey: wk,
        isPurchased: false,
        actualUnitPrice: null,
        shoppingDate: '',
        storeNotes: ''
      }));
      target.shopping = fresh.concat(target.shopping).slice(0, 200);
    }
    return target;
  }

  function persist() {
    try {
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

  function update(mutator) {
    const result = typeof mutator === 'function' ? mutator(state) : mutator;
    persist();
    document.dispatchEvent(new CustomEvent('app:changed'));
    return result;
  }

  function reset() {
    state = defaultState();
    persist();
    document.dispatchEvent(new CustomEvent('app:changed'));
  }

  function importData(json) {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    if (!parsed || typeof parsed !== 'object') throw new Error('Format data tidak valid.');
    state = deepMerge(defaultState(), parsed);
    ensureWeekShopping(state);
    persist();
    document.dispatchEvent(new CustomEvent('app:changed'));
  }

  function exportData() {
    return JSON.stringify(state, null, 2);
  }

  /* ---------- Selektor ---------- */

  function activitiesForDay(day) {
    return state.activities
      .filter((a) => Number(a.dayOfWeek) === Number(day))
      .sort((a, b) => (parseTime(a.startTime) ?? 0) - (parseTime(b.startTime) ?? 0));
  }

  function activityStatus(activity, date) {
    const rec = state.completion[dateKey(date)] || {};
    const saved = rec[activity.id];
    if (saved === 'completed') return 'completed';
    if (saved === 'skipped') return 'skipped';
    const now = new Date();
    const isToday = dateKey(date) === dateKey(now);
    if (!isToday) return parseTime(activity.endTime) <= (now.getHours() * 60 + now.getMinutes()) && dateKey(date) < dateKey(now) ? 'missed' : 'upcoming';
    const current = now.getHours() * 60 + now.getMinutes();
    const start = parseTime(activity.startTime) ?? 0;
    const end = parseTime(activity.endTime) ?? start;
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
    const acts = activitiesForDay(dow(date));
    const rec = state.completion[key] || {};
    const done = acts.filter((a) => rec[a.id] === 'completed').length;
    return { done, total: acts.length, pct: acts.length ? Math.round((done / acts.length) * 100) : 0 };
  }

  function weekProgress(reference = new Date()) {
    const dates = Utils.weekDates(reference).filter((d) => d <= new Date());
    let done = 0, total = 0;
    dates.forEach((d) => {
      const acts = activitiesForDay(dow(d));
      const rec = state.completion[dateKey(d)] || {};
      total += acts.length;
      done += acts.filter((a) => rec[a.id] === 'completed').length;
    });
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0, days: dates.length };
  }

  function consumptionForDate(date) {
    const key = dateKey(date);
    return state.consumption.filter((c) => c.date === key);
  }

  function servingsForDate(date) {
    return consumptionForDate(date).reduce((sum, c) => sum + (Number(c.servingCount) || 0), 0);
  }

  function servingsForWeek(reference = new Date()) {
    const start = weekKey(reference);
    return state.consumption
      .filter((c) => weekKey(Utils.fromKey(c.date)) === start)
      .reduce((sum, c) => sum + (Number(c.servingCount) || 0), 0);
  }

  function dailyTarget() {
    return Math.max(1, Number(state.settings.dailyFruitTarget) || 2);
  }

  function weeklyTarget() {
    return dailyTarget() * 7;
  }

  function activeInventory() {
    return state.inventory.filter((i) => i.status !== 'finished' && (Number(i.quantityRemaining) > 0));
  }

  function consumeSoonInventory() {
    return state.inventory.filter((i) => i.status === 'consume-soon' && Number(i.quantityRemaining) > 0);
  }

  function currentWeekShopping() {
    const wk = weekKey(new Date());
    return state.shopping.filter((i) => i.weekKey === wk);
  }

  function shoppingTotals(items = currentWeekShopping()) {
    const estimated = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.estimatedUnitPrice) || 0), 0);
    const actual = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.actualUnitPrice) || 0), 0);
    const budget = Number(state.settings.weeklyBudget) || 0;
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
    const main = Number(state.settings.shoppingDays.main) || 7;
    const refill = Number(state.settings.shoppingDays.refill) || 3;
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
    KEY, get state() { return state; }, update, persist, reset, importData, exportData, ensureWeekShopping,
    activitiesForDay, activityStatus, setActivityStatus, progressForDate, weekProgress,
    consumptionForDate, servingsForDate, servingsForWeek, dailyTarget, weeklyTarget,
    activeInventory, consumeSoonInventory, currentWeekShopping, shoppingTotals,
    reminderFor, setReminder, targetForDay, taskStats, fruitById, nextShoppingReminder
  };
})();
