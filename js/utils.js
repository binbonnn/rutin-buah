/* ---------- Utilitas umum ---------- */
const Utils = (() => {
  const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  // Q-09: satu sumber versi aplikasi (dipakai UI, ekspor, dan dokumentasi).
  const APP_VERSION = '1.2.0';

  const pad = (n) => String(n).padStart(2, '0');

  function uid(prefix = 'id') {
    if (globalThis.crypto && typeof crypto.randomUUID === 'function') {
      return prefix + '-' + crypto.randomUUID();
    }
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function parseTime(value) {
    if (value == null || value === '') return null;
    const m = String(value).match(/^(\d{1,2})[.:](\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  }

  /** F-06: bungkus menit ke 0..1439 agar tidak pernah menghasilkan "24.05". */
  function wrapMinutes(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return ((Math.round(n) % 1440) + 1440) % 1440;
  }

  function fmtTime(value) {
    const mins = typeof value === 'number' ? value : parseTime(value);
    if (mins == null) return '—';
    const w = wrapMinutes(mins);
    return pad(Math.floor(w / 60)) + '.' + pad(w % 60);
  }

  function fmtTimeColon(value) {
    const mins = typeof value === 'number' ? value : parseTime(value);
    if (mins == null) return '';
    const w = wrapMinutes(mins);
    return pad(Math.floor(w / 60)) + ':' + pad(w % 60);
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

  /** Evaluasi memakai kunci Senin lokal; label ISO dipakai pada nama berkas. */
  function isoWeekParts(date) {
    const d = date instanceof Date ? date : new Date(date);
    const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const year = utc.getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil(((utc - start) / 86400000 + 1) / 7);
    return { year, week };
  }

  function isoWeekKey(date) {
    const { year, week } = isoWeekParts(date);
    return `${year}-W${pad(week)}`;
  }

  /** Senin berikutnya; dipakai sebagai tanggal mulai aturan Jendela Aktif. */
  function nextMondayKey(date = new Date()) {
    return dateKey(addDays(startOfWeek(date), 7));
  }

  /** Tanggal + menit (boleh >1440) → epoch ms lokal, aman untuk lintas tengah malam. */
  function atMinutes(key, minutes) {
    const base = fromKey(key) || new Date();
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0).getTime() + number(minutes) * 60000;
  }

  function fileDate(date) {
    const d = date instanceof Date ? date : fromKey(date);
    if (!d) return '';
    return pad(d.getDate()) + '-' + MONTHS[d.getMonth()].slice(0, 3).toLowerCase() + '-' + d.getFullYear();
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
    return Math.max(min, Math.min(max, number(n, min)));
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* D-01/D-08 mergeDefaults: kunci yang tidak ada pada data disi dari default.
     Kunci proto diblokir agar impor JSON tidak mencemari prototipe hasil. */
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  function mergeDefaults(base, extra) {
    if (Array.isArray(base)) return Array.isArray(extra) ? extra.slice() : base.slice();
    if (!isObj(base)) {
      return (extra !== undefined && extra !== null && typeof extra === typeof base) ? extra : base;
    }
    const out = {};
    for (const k of Object.keys(base)) {
      if (BAD_KEYS.has(k)) continue;
      out[k] = mergeDefaults(base[k], isObj(extra) ? extra[k] : undefined);
    }
    if (isObj(extra)) {
      for (const k of Object.keys(extra)) {
        if (BAD_KEYS.has(k) || k in out) continue;
        out[k] = extra[k]; // kompatibilitas maju: pertahankan kunci yang tidak dikenal
      }
    }
    return out;
  }

  /** N-01: jendela waktu, bukan pencocokan menit persis. */
  function withinWindow(target, now, windowMin = 10) {
    return target != null && now >= target && now - target <= windowMin;
  }

  /** V-08: "1 × 400 gram" bila satuan sudah memuat ukuran kemasan. */
  function formatQtyUnit(quantity, unit) {
    const q = number(quantity, 0);
    const u = String(unit || 'buah').trim();
    return /^\d/.test(u) ? `${q} × ${u}` : `${q} ${u}`;
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
      more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
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
      chart: '<path d="M4 20V4M4 20h16"/><path d="M8 17v-5M12 17V8M16 17v-8M20 17v-3"/>',
      play: '<path d="M8 5.5v13l10-6.5-10-6.5Z"/>',
      share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
      lock: '<rect x="5" y="10" width="14" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15" r="1.1" fill="currentColor" stroke="none"/>',
      history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4"/><path d="M12 7.5V12l3 2"/>',
      snack: '<path d="M6 3h12l-1.5 18h-9L6 3Z"/><path d="M7 9h10M8.5 15h7"/>',
      flag: '<path d="M5 21V4m0 1c4-3 8 3 14 0v9c-6 3-10-3-14 0"/>'
    };
    const body = paths[name] || paths.info;
    return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  return {
    APP_VERSION, DAY_NAMES, DAY_SHORT, MONTHS, pad, uid, parseTime, wrapMinutes, fmtTime, fmtTimeColon, dow, dayName,
    dateKey, fromKey, addDays, startOfWeek, weekDates, weekKey, isoWeekParts, isoWeekKey, nextMondayKey, atMinutes, fileDate,
    formatDate, relativeDay,
    rupiah, number, clamp, escapeHtml, isObj, mergeDefaults, withinWindow, formatQtyUnit,
    debounce, downloadFile, icon,
    // Alih-alih menghapus nama lama, arahkan ke implementasi yang aman.
    deepMerge: mergeDefaults
  };
})();
