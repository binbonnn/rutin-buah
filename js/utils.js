/* ---------- Utilitas umum ---------- */
const Utils = (() => {
  const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const pad = (n) => String(n).padStart(2, '0');

  function uid(prefix = 'id') {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function parseTime(value) {
    if (value == null || value === '') return null;
    const m = String(value).match(/^(\d{1,2})[.:](\d{2})$/);
    if (!m) return null;
    const h = Math.min(23, parseInt(m[1], 10));
    const min = Math.min(59, parseInt(m[2], 10));
    return h * 60 + min;
  }

  function fmtTime(value) {
    const mins = typeof value === 'number' ? value : parseTime(value);
    if (mins == null) return '—';
    return pad(Math.floor(mins / 60)) + '.' + pad(mins % 60);
  }

  function fmtTimeColon(value) {
    const mins = typeof value === 'number' ? value : parseTime(value);
    if (mins == null) return '';
    return pad(Math.floor(mins / 60)) + ':' + pad(mins % 60);
  }

  /** 1 = Senin ... 7 = Minggu */
  function dow(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.getDay() === 0 ? 7 : d.getDay();
  }

  function dayName(n, short = false) {
    const idx = n === 7 ? 0 : n;
    return (short ? DAY_SHORT : DAY_NAMES)[idx];
  }

  function dateKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function fromKey(key) {
    if (!key) return null;
    const [y, m, d] = String(key).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  function addDays(date, n) {
    const d = new Date(date instanceof Date ? date.getTime() : new Date(date).getTime());
    d.setDate(d.getDate() + n);
    return d;
  }

  /** Senin pada minggu yang sama */
  function startOfWeek(date) {
    const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
    const diff = dow(d) - 1;
    d.setHours(0, 0, 0, 0);
    return addDays(d, -diff);
  }

  function weekDates(date) {
    const monday = startOfWeek(date);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }

  function weekKey(date) {
    return dateKey(startOfWeek(date));
  }

  function formatDate(date, opts = {}) {
    const d = date instanceof Date ? date : fromKey(date);
    if (!d) return '—';
    if (opts.short) return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3);
    return DAY_NAMES[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function relativeDay(date) {
    const today = dateKey(new Date());
    const key = typeof date === 'string' ? date : dateKey(date);
    if (key === today) return 'Hari ini';
    if (key === dateKey(addDays(new Date(), -1))) return 'Kemarin';
    if (key === dateKey(addDays(new Date(), 1))) return 'Besok';
    return formatDate(date, { short: true });
  }

  function rupiah(value) {
    const n = Number(value) || 0;
    return 'Rp' + Math.round(n).toLocaleString('id-ID');
  }

  function number(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function deepMerge(base, extra) {
    if (Array.isArray(extra)) return extra.slice();
    if (extra && typeof extra === 'object') {
      const out = {};
      const keys = new Set([...Object.keys(base || {}), ...Object.keys(extra)]);
      keys.forEach((k) => {
        const b = base && base[k];
        const e = extra[k];
        out[k] = e && typeof e === 'object' && !Array.isArray(e) && b && typeof b === 'object' && !Array.isArray(b)
          ? deepMerge(b, e)
          : e;
      });
      return out;
    }
    return extra === undefined ? base : extra;
  }

  function debounce(fn, ms = 200) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function downloadFile(filename, content, type = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function icon(name, size = 20) {
    const paths = {
      home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
      book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22V4.5Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
      fruit: '<path d="M12 8c-4.5-3-9 0-9 5.5C3 18 6.8 22 12 22s9-4 9-8.5C21 8 16.5 5 12 8Z"/><path d="M12 8c0-3 1.6-5 4.5-5.5M12 8c-.8-2.4-2.7-3.8-5-4"/>',
      cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h3l2.4 12h11l2.1-8H6.2"/>',
      settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21H9.9v-.1A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.9.3l-.1.1L4.1 16.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3v-2.8h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L7.1 4.9l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3h4.1v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.8 2.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H21V14h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
      close: '<path d="M6 6l12 12M18 6 6 18"/>',
      edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14.5 6.5 3 3"/>',
      trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
      chevronLeft: '<path d="m15 5-7 7 7 7"/>',
      chevronRight: '<path d="m9 5 7 7-7 7"/>',
      chevronDown: '<path d="m5 9 7 7 7-7"/>',
      chevronUp: '<path d="m19 15-7-7-7 7"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
      bell: '<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
      moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
      download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3"/>',
      install: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3"/>',
      box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
      alert: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5M12 17.5v.5"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
      target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
      sparkle: '<path d="m12 3 1.6 4.9L18.5 9.5l-4.9 1.6L12 16l-1.6-4.9L5.5 9.5l4.9-1.6L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
      history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4"/><path d="M12 7.5V12l3 2"/>',
      snack: '<path d="M6 3h12l-1.5 18h-9L6 3Z"/><path d="M7 9h10M8.5 15h7"/>',
      flag: '<path d="M5 21V4m0 1c4-3 8 3 14 0v9c-6 3-10-3-14 0"/>'
    };
    const body = paths[name] || paths.info;
    return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  return {
    DAY_NAMES, DAY_SHORT, MONTHS, pad, uid, parseTime, fmtTime, fmtTimeColon, dow, dayName,
    dateKey, fromKey, addDays, startOfWeek, weekDates, weekKey, formatDate, relativeDay,
    rupiah, number, clamp, escapeHtml, deepMerge, debounce, downloadFile, icon
  };
})();
