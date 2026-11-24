/* S2: insight berbasis pola. Murni: tanpa DOM, Store, atau localStorage. */
const Insights = (() => {
  const BLOCKS = ['pagi', 'siang', 'sore', 'malam'];
  const CORE = ['Ibadah', 'Skripsi'];
  const MIN_TOTAL = 20;
  const WEEK_MS = 7 * 86400000;

  const num = (v, fb = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  };

  function blockOf(time) {
    const m = Utils.parseTime(time);
    if (m == null) return '';
    if (m < 11 * 60) return 'pagi';
    if (m < 15 * 60) return 'siang';
    if (m < 18 * 60) return 'sore';
    return 'malam';
  }

  /** Ambang data minimum: minggu pertama dan minggu dengan <20 aktivitas tidak dinilai. */
  function needsMoreData(review = {}, firstUseAt, now = new Date()) {
    if (num(review.total) < MIN_TOTAL) return true;
    const first = Date.parse(firstUseAt);
    if (!Number.isFinite(first)) return false;
    const start = Date.parse((review.weekKey || '') + 'T00:00:00Z');
    const reference = now instanceof Date ? now.getTime() : Date.parse(now);
    if (!Number.isFinite(reference)) return false;
    return (Number.isFinite(start) ? start : reference) < first + WEEK_MS;
  }

  function isMissed(it) {
    if (!it) return false;
    if (it.s === 'm' || it.status === 'missed') return true;
    if (it.s === 'p' || it.status === 'done') return false;
    return /tidak tercatat/i.test(it.reason || '');
  }

  function recurringMiss(items) {
    const groups = new Map();
    (items || []).filter(isMissed).forEach((it) => {
      if (!it || !it.id) return;
      const key = it.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(it);
    });
    return [...groups.entries()]
      .filter(([, rows]) => rows.length >= 3)
      .map(([id, rows]) => {
        const weight = CORE.includes(rows[0].cat) ? 1.5 : 1;
        return {
          kind: 'recurring-miss',
          score: rows.length * weight,
          data: {
            id, title: rows[0].title || 'Aktivitas', category: rows[0].cat || '',
            time: rows[0].time || '', count: rows.length,
            days: rows.map((r) => r.date).sort()
          },
          cta: 'edit-activity'
        };
      });
  }

  function blockWeak(review) {
    const totals = review.blockTotals || {};
    return BLOCKS.map((block) => {
      const total = num(totals[block]);
      const missed = num((review.blockMissed || {})[block]);
      const pct = total ? missed / total : 0;
      return { block, total, missed, pct };
    }).filter((b) => b.total >= 6 && b.pct >= 0.6)
      .map((b) => ({
        kind: 'block-weak',
        score: b.pct * 10,
        data: b,
        cta: 'open-plan'
      }));
  }

  function worstDay(daily) {
    const rows = (daily || []).filter((d) => num(d.total) >= 8 && num(d.pct) >= 0);
    if (!rows.length) return [];
    const avg = rows.reduce((sum, d) => sum + num(d.pct), 0) / rows.length;
    const worst = rows.reduce((a, b) => (num(b.pct) < num(a.pct) ? b : a));
    const gap = avg - num(worst.pct);
    if (gap < 25) return [];
    return [{
      kind: 'worst-day',
      score: gap,
      data: { date: worst.key, pct: num(worst.pct), avg, total: num(worst.total) },
      cta: 'open-day'
    }];
  }

  function categoryWeak(review) {
    const stats = review.categoryStats || {};
    const rows = Object.entries(stats)
      .map(([category, s]) => ({
        category, total: num(s && s.total), pct: num(s && s.total) ? num(s && s.done) / num(s.total) * 100 : 100
      }))
      .filter((r) => r.total >= 8);
    if (!rows.length) return [];
    const avg = rows.reduce((sum, r) => sum + r.pct, 0) / rows.length;
    const worst = rows.reduce((a, b) => (b.pct < a.pct ? b : a));
    const gap = avg - worst.pct;
    if (gap <= 0) return [];
    return [{
      kind: 'category-weak',
      score: gap,
      data: { ...worst, avg },
      cta: 'open-plan'
    }];
  }

  function trend(review, prev) {
    if (!prev) return [];
    const delta = num(review.score) - num(prev.score);
    if (Math.abs(delta) < 10) return [];
    return [{ kind: 'trend', score: Math.abs(delta), data: { delta }, cta: '' }];
  }

  function lastMinute(review) {
    const lm = review.lastMinute || {};
    const done = num(lm.done);
    const grace = num(lm.grace);
    if (done < 6 || !done || grace / done < 0.5) return [];
    const pct = grace / done * 100;
    return [{ kind: 'last-minute', score: pct, data: { done, grace, pct }, cta: 'open-settings' }];
  }

  function celebrate(review, prev) {
    const delta = prev ? num(review.score) - num(prev.score) : 0;
    if (num(review.score) < 80 && delta < 10) return [];
    return [{
      kind: 'celebrate',
      score: 100,
      data: { score: num(review.score), delta },
      cta: ''
    }];
  }

  function select(candidates) {
    const order = ['celebrate', 'recurring-miss', 'block-weak', 'worst-day', 'category-weak', 'trend', 'last-minute'];
    const sorted = candidates
      .map((c, i) => ({ ...c, _order: order.indexOf(c.kind), _i: i }))
      .sort((a, b) => (b.score - a.score) || (a._order - b._order) || (a._i - b._i));
    const picked = [];
    const win = (c) => {
      const clean = { kind: c.kind, score: c.score, data: c.data, cta: c.cta };
      return clean;
    };
    const take = (c) => { picked.push(win(c)); return c; };
    const key = (c) => c.kind + '|' + JSON.stringify(c.data);
    const taken = new Set();

    const celebrateItem = sorted.find((c) => c.kind === 'celebrate');
    if (celebrateItem) {
      take(celebrateItem);
      taken.add(key(celebrateItem));
    }
    // Keberagaman dulu: tidak dua kind sama bila masih ada kandidat lain.
    sorted.forEach((c) => {
      if (picked.length >= 3 || c.kind === 'celebrate' || taken.has(key(c))) return;
      if (picked.some((p) => p.kind === c.kind)) return;
      take(c);
      taken.add(key(c));
    });
    // Baru isi sisa dengan kandidat yang ada bila belum cukup 3.
    sorted.forEach((c) => {
      if (picked.length >= 3 || taken.has(key(c))) return;
      take(c);
      taken.add(key(c));
    });
    return picked.slice(0, 3);
  }

  function compute({ review = {}, prev = null, items = [], daily = [], firstUseAt, now = new Date() } = {}) {
    if (needsMoreData(review, firstUseAt, now)) return [];
    const candidates = [
      ...celebrate(review, prev),
      ...recurringMiss(items),
      ...blockWeak(review),
      ...worstDay(daily),
      ...categoryWeak(review),
      ...trend(review, prev),
      ...lastMinute(review)
    ];
    return select(candidates);
  }

  return { BLOCKS, CORE, MIN_TOTAL, blockOf, needsMoreData, compute };
})();
