/* S10: log galat lokal. Tidak pernah melempar, tidak menyimpan data pribadi. */
const ErrLog = (() => {
  const KEY = 'rutin-buah:errlog';
  const MAX = 50;
  const MAX_STACK = 500;
  const MAX_MSG = 240;

  // Judul aktivitas/catatan pengguna umumnya muncul di dalam tanda kutip.
  // Semua kutipan dan tanggal/ISO ikut dihapus sebelum disimpan.
  function scrub(value) {
    return String(value == null ? '' : value)
      .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '"…"')
      .replace(/\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}[^\s)]*)?/g, '<tanggal>')
      .replace(/[?&][^=\s&]+=[^&\s)]+/g, '<query>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sourceOf(value) {
    const raw = String(value || '');
    try { return new URL(raw, location.href).pathname; } catch { return scrub(raw).slice(0, 120); }
  }

  function stackOf(value) {
    const lines = String(value || '').split('\n').slice(0, 6);
    return scrub(lines.map((line) => line.trim().replace(/^at\s+/, '')).join(' | ')).slice(0, MAX_STACK);
  }

  function read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(parsed) ? parsed.slice(-MAX) : [];
    } catch { return []; }
  }

  function write(entries) {
    try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX))); } catch { /* abaikan */ }
  }

  function record(kind, payload) {
    try {
      const err = payload && (payload.reason || payload.error);
      const message = kind === 'error'
        ? (payload && payload.message) || (err && err.message) || 'Galat tanpa pesan'
        : (err && err.message) || 'Penolakan tanpa pesan';
      const route = location.hash && location.hash !== '#/' ? location.hash.slice(0, 60) : '#/dashboard';
      const entry = {
        t: new Date().toISOString(),
        msg: scrub(message).slice(0, MAX_MSG),
        src: sourceOf(kind === 'error' ? payload && payload.filename : err && err.file),
        line: Number((kind === 'error' ? payload && payload.lineno : err && err.lineNumber) || 0) || 0,
        stack: stackOf(kind === 'error' ? payload && payload.error && payload.error.stack : err && err.stack),
        route: scrub(route),
        ver: (typeof Utils !== 'undefined' && Utils.APP_VERSION) || '0.0.0'
      };
      write([...read(), { ...entry, kind }].slice(-MAX));
    } catch { /* jangan pernah mengganggu aplikasi */ }
  }

  window.addEventListener('error', (event) => record('error', event), true);
  window.addEventListener('unhandledrejection', (event) => record('rejection', event));

  return {
    KEY, MAX,
    list() { return read(); },
    count() { return read().length; },
    clear() { const n = read().length; write([]); return n; },
    exportText() {
      const rows = read().map((e) => [
        e.t, e.kind === 'rejection' ? 'unhandledrejection' : 'error',
        `${e.ver} ${e.route}`, `${e.src}:${e.line}`,
        e.msg, e.stack || '-'
      ].join(' | '));
      return ['# Rutin & Buah — log galat lokal', ...(rows.length ? rows : ['(tidak ada entri)'])].join('\n') + '\n';
    }
  };
})();
