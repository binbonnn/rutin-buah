/* S1: penjadwal pemulihan murni. Tidak memakai DOM, Store, atau localStorage. */
const Planner = (() => {
  const BUFFER_MIN = 5;
  const DEFAULT_START = '05.00';
  const DEFAULT_END = '21.30';
  const DEFAULT_MAX_PER_DAY = 60;
  const BLOCKS = {
    pagi: [5 * 60, 11 * 60],
    siang: [11 * 60, 15 * 60],
    sore: [15 * 60, 18 * 60],
    malam: [18 * 60, 24 * 60]
  };

  const num = (v, fb) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  };

  function minutes(value, fallback = null) {
    const m = Utils.parseTime(value);
    return m == null ? fallback : m;
  }

  function clock(min) {
    const w = ((Math.round(min) % 1440) + 1440) % 1440;
    return Utils.pad(Math.floor(w / 60)) + '.' + Utils.pad(w % 60);
  }

  function blockOf(value) {
    const m = minutes(value);
    if (m == null) return '';
    return Object.keys(BLOCKS).find((k) => m >= BLOCKS[k][0] && m < BLOCKS[k][1]) || '';
  }

  function activeOn(state, date) {
    const day = Utils.dow(Utils.fromKey(date));
    const from = Date.parse(date + 'T00:00:00Z');
    return (state.activities || []).filter((a) => {
      if (!a) return false;
      if (a.date) return a.date === date;
      if (a.startDate && from < Date.parse(a.startDate + 'T00:00:00Z')) return false;
      if (a.endDate && from > Date.parse(a.endDate + 'T00:00:00Z')) return false;
      if (a.isRecurring === false) return false;
      if (Array.isArray(a.days)) return a.days.includes(day);
      return num(a.dayOfWeek, 0) === day;
    });
  }

  function spanOf(activity) {
    const start = minutes(activity.startTime);
    if (start == null) return null;
    let end = minutes(activity.endTime, start);
    if (end <= start) end += 1440;
    return [start, end];
  }

  function modeFor(state, date) {
    const from = Date.parse(date + 'T00:00:00Z');
    return (state.modes || []).find((m) => {
      const a = Date.parse((m.from || '') + 'T00:00:00Z');
      const b = Date.parse((m.to || '') + 'T00:00:00Z');
      return Number.isFinite(a) && Number.isFinite(b) && from >= a && from <= b;
    }) || null;
  }

  function isCore(state, category, activity) {
    const core = Array.isArray(state.settings && state.settings.coreCategories)
      ? state.settings.coreCategories : ['Ibadah', 'Skripsi'];
    return !!(activity && activity.core) || core.includes(category);
  }

  function skipsDate(state, date, category) {
    if ((state.restDays || []).includes(date)) return true;
    const mode = modeFor(state, date);
    if (!mode) return false;
    if (mode.type === 'libur' || mode.type === 'sakit') return true;
    if (mode.type === 'ringan' || mode.type === 'ujian') {
      return !isCore(state, category, null);
    }
    return false;
  }

  function windowFor(state, date) {
    const settings = (state && state.settings) || {};
    const start = minutes(settings.planWindowStart, minutes(DEFAULT_START));
    let end = minutes(settings.planWindowEnd, minutes(DEFAULT_END));
    const bedtime = minutes(settings.bedtime);
    if (bedtime != null) {
      let cap = bedtime - 30;
      if (cap <= start) cap += 1440; // tidur setelah tengah malam
      end = Math.min(end, cap);
    }
    return [start, Math.max(end, start + 30)];
  }

  function busyFor(state, date, ignoreId, activitiesForDayIn) {
    const source = typeof activitiesForDayIn === 'function'
      ? activitiesForDayIn(state, date)
      : activeOn(state, date);
    return source
      .filter((a) => a && a.id !== ignoreId)
      .map(spanOf)
      .filter((s) => s && s[1] > s[0])
      .map(([s, e]) => [Math.max(0, s - BUFFER_MIN), e + BUFFER_MIN])
      .sort((a, b) => a[0] - b[0]);
  }

  function gapsFor(start, end, busy) {
    const gaps = [];
    let cursor = start;
    busy.forEach(([s, e]) => {
      if (e <= cursor) return;
      if (s > cursor) gaps.push([cursor, Math.min(s, end)]);
      cursor = Math.max(cursor, e);
    });
    if (cursor < end) gaps.push([cursor, end]);
    return gaps.filter(([s, e]) => e - s >= 1);
  }

  /** Slot masih kosong? Dipakai ulang saat menerima rencana. */
  function isSlotFree(state, suggested, ignoreId = null, activitiesForDayIn) {
    if (!suggested || !suggested.date) return false;
    const s = minutes(suggested.start);
    const e = minutes(suggested.end);
    if (s == null || e == null || e <= s) return false;
    return !busyFor(state, suggested.date, ignoreId, activitiesForDayIn)
      .some(([bs, be]) => s < be && e > bs);
  }

  /**
   * Cari celah pertama dalam 7 hari. Mengembalikan {date, start, end} atau null.
   * `from` boleh date key atau Date; `now` diizinkan untuk uji deterministik.
   */
  function findSlot(opts = {}, state = {}) {
    const duration = Math.max(5, Math.round(num(opts.durationMin, 20)));
    const now = opts.now instanceof Date ? opts.now : new Date();
    const fromKey = opts.from instanceof Date ? Utils.dateKey(opts.from)
      : Utils.dateKey(Utils.fromKey(opts.from) || now);
    const todayKey = Utils.dateKey(now);
    const anchor = fromKey < todayKey ? todayKey : fromKey;
    const category = opts.category || '';
    const block = opts.preferBlock || blockOf(opts.preferTime || opts.time);
    const prefs = BLOCKS[block] || null;
    const maxPerDay = Math.max(0, num(state.settings && state.settings.recoveryMaxPerDay, DEFAULT_MAX_PER_DAY));

    for (let i = 0; i < 7; i += 1) {
      const date = Utils.dateKey(Utils.addDays(Utils.fromKey(anchor), i));
      if (skipsDate(state, date, category)) continue;

      const used = activeOn(state, date)
        .filter((a) => a.origin === 'recovery')
        .reduce((sum, a) => sum + Math.max(0, spanOf(a) ? spanOf(a)[1] - spanOf(a)[0] : 0), 0);
      if (used >= maxPerDay) continue;

      const [winStart, winEnd] = windowFor(state, date);
      const nowMin = date === todayKey
        ? now.getHours() * 60 + now.getMinutes() + 1
        : winStart;
      const earliest = Math.max(winStart, nowMin);
      if (earliest + duration > winEnd) continue;

      const gaps = gapsFor(earliest, winEnd, busyFor(state, date));
      const candidates = [];
      gaps.forEach(([gs, ge]) => {
        if (ge - gs < duration) return;
        const room = ge - duration;
        const ideal = prefs ? Math.max(gs, Math.min(prefs[0], room)) : gs;
        const starts = [...new Set([ideal, gs, room])].filter((s) => s >= gs && s <= room);
        starts.forEach((s) => {
          const sameBlock = prefs ? (s >= prefs[0] && s + duration <= prefs[1]) : false;
          const distance = prefs ? Math.abs(s - prefs[0]) : 0;
          candidates.push({ date, start: s, end: s + duration, sameBlock, distance });
        });
      });
      if (!candidates.length) continue;
      candidates.sort((a, b) =>
        (b.sameBlock - a.sameBlock) || (a.distance - b.distance) || (a.start - b.start));
      const best = candidates[0];
      return { date: best.date, start: clock(best.start), end: clock(best.end) };
    }
    return null;
  }

  return { BUFFER_MIN, BLOCKS, blockOf, findSlot, isSlotFree, activeOn, windowFor };
})();
