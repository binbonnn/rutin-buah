/* U-03 — Terapkan tema sebelum first paint agar tidak ada kilatan terang.
   Dipasang sebagai berkas eksternal (bukan inline) agar tetap kompatibel
   dengan CSP `script-src 'self'`. */
(function () {
  try {
    var raw = localStorage.getItem('rutin-buah:v1');
    var prefs = raw ? (JSON.parse(raw).settings || {}) : {};
    var theme = prefs.theme || 'system';
    if (theme === 'system') {
      theme = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
  } catch (e) {
    // localStorage bisa diblokir (mode privat); biarkan fallback light.
  }
})();
