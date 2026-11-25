/* ---------- Routing, inisialisasi, dan pengingat ---------- */
(() => {
  const NAV = [
    { key: 'dashboard', label: 'Beranda', icon: 'home', title: 'Beranda' },
    { key: 'jadwal', label: 'Jadwal', icon: 'calendar', title: 'Jadwal Mingguan' },
    { key: 'evaluasi', label: 'Evaluasi', icon: 'chart', title: 'Evaluasi Mingguan' },
    { key: 'skripsi', label: 'Skripsi', icon: 'book', title: 'Skripsi' },
    { key: 'buah', label: 'Buah', icon: 'fruit', title: 'Buah & Stok' },
    { key: 'belanja', label: 'Belanja', icon: 'cart', title: 'Belanja' },
    { key: 'pengaturan', label: 'Pengaturan', icon: 'settings', title: 'Pengaturan' } // V-17: konsisten
  ];
  const TAB_KEYS = ['dashboard', 'jadwal', 'skripsi', 'buah', 'belanja'];

  const PAGES = {
    dashboard: Pages.dashboard, jadwal: Pages.jadwal, evaluasi: Pages.evaluasi, skripsi: Pages.skripsi,
    buah: Pages.buah, belanja: Pages.belanja, pengaturan: Pages.pengaturan
  };

  let current = 'dashboard';
  let deferredInstall = null;
  let lastRouteKey = '';
  let lastDayKey = Utils.dateKey(new Date());
  let safeMode = false;

  /** N-02: paksa tulisan terakhir sebelum blur, pindah tab, atau tutup halaman. */
  function flushMentorNotes() {
    if (!window.__mentorT) return;
    clearTimeout(window.__mentorT);
    window.__mentorT = null;
    const el = document.getElementById('mentor-notes');
    if (el) Store.saveMentorNotes(el.value);
  }

  /** D.1: evaluasi dibuat otomatis, idempoten, dan hanya sekali per minggu. */
  function syncReviews() {
    const before = Store.reviewStats().count;
    const result = Store.ensureReviews();
    if (!result.created && !result.promoted) return;
    if (!before && Store.reviewStats().count) {
      UI.toast('Laporan evaluasi mingguan sudah tersedia. Buka menu Evaluasi.', 'info');
    }
  }

  function parseRoute() {
    const raw = (location.hash || '').replace(/^#\/?/, '');
    const [path, query = ''] = raw.split('?');
    const key = PAGES[path] ? path : 'dashboard';
    return { key, query: new URLSearchParams(query) };
  }

  function resolvedTheme() {
    const pref = Store.state.settings.theme;
    if (pref === 'dark' || pref === 'light') return pref;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme() {
    const theme = resolvedTheme();
    document.documentElement.dataset.theme = theme;
    initTheme();
    // S-05: theme-color meta mengikuti tema aktif (bukan hanya preferensi sistem).
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.content = theme === 'dark' ? '#141b29' : '#cbd2dc';
    });
  }

  function safeScreen(err) {
    console.error('Render gagal, masuk mode aman.', err);
    const app = document.getElementById('app');
    safeMode = true;
    app.innerHTML = `<section class="card safe-mode">
      <h2>Data tidak dapat ditampilkan</h2>
      <p>Terjadi kesalahan saat membaca data tersimpan. Data Anda <strong>belum dihapus</strong>.</p>
      <div class="row-actions">
        <button class="btn btn-soft" type="button" data-action="export-raw">Unduh data mentah</button>
        <button class="btn btn-danger-ghost" type="button" data-action="reset-data">Kembalikan data awal</button>
      </div>
    </section>`;
  }

  function isEditingInApp() {
    const el = document.activeElement;
    return el && document.getElementById('app').contains(el) &&
      (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'radio'));
  }

  function render(force = false) {
    if (!force && safeMode) return;
    // D-05/U-07: jangan timpa teks yang sedang diketik—termasuk harga aktual.
    if (!force && isEditingInApp()) return;
    const app = document.getElementById('app');
    const prevFocus = document.activeElement;
    const shouldRestore = prevFocus && app.contains(prevFocus) && prevFocus.dataset.action === 'toggle-activity';
    try {
      const html = PAGES[current]();
      app.innerHTML = html;
      safeMode = false;
    } catch (err) {
      safeScreen(err);
      return;
    }

    const navItem = NAV.find((n) => n.key === current);
    const title = navItem ? navItem.title : 'Beranda';
    document.getElementById('page-title').textContent = title;
    document.title = title + ' — Rutin & Buah'; // U-04
    document.getElementById('topbar-date').textContent = current === 'dashboard'
      ? Utils.formatDate(new Date())
      : Utils.dayName(Utils.dow(new Date())) + ' · ' + Utils.formatDate(new Date(), { short: true });

    document.querySelectorAll('#nav [data-nav]').forEach((b) => {
      const active = b.dataset.nav === current;
      b.classList.toggle('is-active', active);
      if (active) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current'); // U-04: jangan aria-current="false"
    });
    document.querySelectorAll('#tabbar [data-nav]').forEach((a) => {
      const active = a.dataset.nav === current;
      if (active) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    // V-03: CTA "Catat buah" hanya muncul di halaman yang relevan.
    const fruitBtn = document.getElementById('quick-fruit');
    if (fruitBtn) fruitBtn.hidden = !(['dashboard', 'buah'].includes(current));

    const weekly = Store.weekProgress();
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    setText('sidebar-progress', weekly.pct + '%');
    setText('sidebar-progress-orb', weekly.pct + '%');
    setText('sidebar-progress-label', weekly.pct + '% pekan ini');

    if (shouldRestore) {
      const id = prevFocus.dataset.id;
      const replacement = app.querySelector(`[data-action="toggle-activity"][data-id="${CSS.escape(id)}"]`);
      if (replacement) replacement.focus({ preventScroll: true });
    }
    if (typeof Pages.afterRender === 'function') Pages.afterRender();
  }

  function route(initial = false) {
    const { key, query } = parseRoute();
    const changed = key !== current;
    current = key;
    const dateParam = query.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) Pages.setViewDate(Utils.fromKey(dateParam));
    render(true);
    window.scrollTo({ top: 0, behavior: 'auto' }); // F-19: hapus deteksi fitur yang salah

    if (changed && !initial) {
      // U-04: beri tahu pembaca layar bahwa halaman berganti.
      document.getElementById('app').focus({ preventScroll: true });
    }

    const routeKey = key + '|' + query.toString();
    if (query.get('action') === 'consume' && routeKey !== lastRouteKey) {
      lastRouteKey = routeKey;
      Pages.openConsumeModal();
    }
  }

  function renderNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = NAV.map((n) => `<a class="nav-item" href="#/${n.key}" data-nav="${n.key}">
      <span><span class="nav-icon-badge" aria-hidden="true">${Utils.icon(n.icon, 15)}</span><span>${n.label}</span></span>
      <span class="nav-arrow" aria-hidden="true">→</span></a>`).join('');

    // V-04: tab bar bawah untuk 5 tujuan harian; Pengaturan tetap lewat menu.
    let tabbar = document.getElementById('tabbar');
    if (!tabbar) {
      tabbar = document.createElement('nav');
      tabbar.id = 'tabbar';
      tabbar.className = 'tabbar';
      tabbar.setAttribute('aria-label', 'Navigasi utama');
      // V-04: di dalam app-shell agar z-index tab bar (30) tetap di bawah
      // backdrop (70) & sidebar (80) saat drawer terbuka.
      (document.querySelector('.app-shell') || document.body).appendChild(tabbar);
    }
    tabbar.innerHTML = TAB_KEYS.map((key) => {
      const n = NAV.find((x) => x.key === key);
      return `<a href="#/${key}" data-nav="${key}">${Utils.icon(n.icon, 20)}<span>${n.label}</span></a>`;
    }).join('');
  }

  const isDrawer = () => typeof matchMedia === 'function' && matchMedia('(max-width: 1023px)').matches;

  function setSidebar(open) {
    // Desktop memakai rail permanen: jangan pernah menandainya aria-hidden/inert.
    if (!isDrawer()) {
      document.body.classList.remove('sidebar-open');
      ['main', 'topbar', 'tabbar'].forEach((id) => document.getElementById(id)?.removeAttribute('inert'));
      document.querySelector('.sidebar')?.removeAttribute('aria-hidden');
      return;
    }
    const wasOpen = document.body.classList.contains('sidebar-open');
    const focusInside = document.querySelector('.sidebar')?.contains(document.activeElement);
    document.body.classList.toggle('sidebar-open', open);
    const toggle = document.getElementById('menu-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', String(open));
    // U-01: latar tidak bisa difokus saat drawer terbuka.
    ['main', 'topbar', 'tabbar'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.toggleAttribute('inert', open);
    });
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.toggleAttribute('aria-hidden', !open);
    if (open) document.querySelector('#nav .nav-item.is-active, #nav .nav-item')?.focus();
    else if (wasOpen && focusInside) toggle?.focus();
  }

  function initDrawer() {
    const open = document.getElementById('menu-toggle');
    const close = document.getElementById('menu-close');
    const backdrop = document.getElementById('mobile-backdrop');
    if (open) open.addEventListener('click', () => setSidebar(true));
    if (close) close.addEventListener('click', () => setSidebar(false));
    if (backdrop) backdrop.addEventListener('click', () => setSidebar(false));
    document.addEventListener('keydown', (e) => {
      if (!document.body.classList.contains('sidebar-open')) return;
      if (e.key === 'Escape') { setSidebar(false); return; }
      if (e.key !== 'Tab') return;
      // Focus trap sederhana di dalam drawer.
      const items = [...document.querySelectorAll('.sidebar a, .sidebar button')].filter((el) => !el.disabled);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function setSaveIndicator(text, isError = false) {
    const el = document.getElementById('footer-backup');
    if (!el) return;
    const parent = el.parentElement;
    parent.firstChild.textContent = text + ' ';
    parent.classList.toggle('save-error', isError);
  }

  function initTheme() {
    const dark = document.documentElement.dataset.theme === 'dark';
    document.querySelectorAll('#theme-toggle, #mobile-theme-toggle').forEach((btn) => {
      btn.innerHTML = UI.themeIcon(dark, 'main');
      btn.setAttribute('aria-label', dark ? 'Gunakan tema terang' : 'Gunakan tema gelap');
      btn.setAttribute('title', dark ? 'Tema terang' : 'Tema gelap');
    });
  }

  function initTopbarButtons() {
    const fruitBtn = document.getElementById('quick-fruit');
    if (fruitBtn) {
      fruitBtn.innerHTML = Utils.icon('fruit', 17) + '<span class="quick-fruit-label">Catat buah</span>';
      fruitBtn.setAttribute('aria-label', 'Catat buah'); // label sesuai teks tampak
      fruitBtn.addEventListener('click', () => Pages.openConsumeModal());
    }
    const installBtn = document.getElementById('install-btn');
    if (!installBtn) return;
    installBtn.innerHTML = Utils.icon('install', 19);
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstall = e;
      installBtn.hidden = false;
    });
    installBtn.addEventListener('click', async () => {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      await deferredInstall.userChoice;
      deferredInstall = null;
      installBtn.hidden = true;
    });
    window.addEventListener('appinstalled', () => {
      deferredInstall = null;
      installBtn.hidden = true;
      UI.toast('Aplikasi dipasang di perangkat.');
    });
  }

  function restoreBackup() {
    try {
      const raw = localStorage.getItem(Store.BACKUP_KEY);
      if (!raw) { UI.toast('Tidak ada cadangan pra-impor.', 'info'); return; }
      localStorage.setItem(Store.KEY, raw);
      Store.reloadFromStorage();
      applyTheme();
      render(true);
      UI.toast('Cadangan pra-impor dipulihkan.');
    } catch (err) {
      UI.toast('Gagal memulihkan cadangan: ' + err.message, 'error');
    }
  }

  /** D-04: validasi + ringkasan + konfirmasi sebelum menimpa data. */
  async function handleImport(file, input) {
    try {
      const text = await file.text();
      const { summary } = Store.describeImport(text);
      const ok = await UI.confirm(
        'Impor cadangan?',
        `Data saat ini akan diganti. Cadangan otomatis dibuat terlebih dahulu.\n\nData baru: ${summary}`,
        'Ya, impor data'
      );
      if (!ok) return;
      await Store.importDataAsync(text);
      applyTheme();
      render(true);
      UI.toast('Data berhasil diimpor. Cadangan lama tersedia di Pengaturan.');
    } catch (err) {
      UI.toast('Gagal mengimpor: ' + err.message, 'error');
    } finally {
      input.value = '';
    }
  }

  function initOnboarding() {
    if (Store.state.settings.onboarded) return;
    UI.openModal({
      title: 'Selamat datang di Rutin & Buah',
      submitLabel: 'Mulai pakai',
      cancelLabel: 'Nanti',
      body: `<p class="modal-note">Isi beberapa hal dasar agar jadwal dan anggaran sesuai kebutuhan Anda.</p>
        <div class="form-grid">
          ${UI.field('Nama panggilan', 'onboardName', { value: Store.state.settings.name, placeholder: 'Nama Anda', full: true })}
          ${UI.field('Jam bangun', 'onboardWake', { type: 'time', value: Store.state.settings.wakeUpTime.replace('.', ':'), full: true })}
          ${UI.field('Anggaran belanja per minggu (Rp)', 'onboardBudget', { type: 'number', value: Store.state.settings.weeklyBudget, min: 0, step: 1000, full: true })}
          ${UI.field('Topik skripsi (opsional)', 'onboardTopic', { value: Store.state.settings.thesisTopic, full: true })}
          ${UI.field('Hapus data contoh', 'onboardClearSamples', { type: 'checkbox', checked: true, help: 'Stok contoh akan dihapus. Riwayat Anda tidak tersentuh.', full: true })}
        </div>`,
      onSubmit(form, data) {
        Store.update((s) => {
          s.settings.name = String(data.get('onboardName') || '').trim();
          const wake = String(data.get('onboardWake') || '').replace(':', '.');
          if (Utils.parseTime(wake)) s.settings.wakeUpTime = wake;
          const budget = Number(data.get('onboardBudget'));
          if (Number.isFinite(budget) && budget >= 0) s.settings.weeklyBudget = budget;
          s.settings.thesisTopic = String(data.get('onboardTopic') || '').trim();
          s.settings.onboarded = true;
          if (data.get('onboardClearSamples')) s.inventory = s.inventory.filter((i) => !i.isSample);
          // Jangan menimpa aktivitas buatan pengguna (mis. hasil impor lawas).
          const hasUserData = (s.activities || []).some((a) => !a.isTemplate || a.userEdited);
          if (!hasUserData) s.activities = Seed.buildActivities(s.settings);
        });
        UI.toast('Pengaturan awal tersimpan.');
        render(true);
      }
    });
  }

  function bindEvents() {
    // Skip link tidak boleh mengubah hash menjadi #app (router akan ke Beranda).
    document.querySelector('.skip-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      const app = document.getElementById('app');
      app?.focus({ preventScroll: true });
      app?.scrollIntoView({ block: 'start' });
    });
    window.addEventListener('resize', () => { if (!isDrawer()) setSidebar(false); });
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) {
        if (nav.tagName === 'A' && (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) return;
        e.preventDefault();
        setSidebar(false);
        if (location.hash === '#/' + nav.dataset.nav) render(true);
        else location.hash = '#/' + nav.dataset.nav;
        return;
      }
      const goto = e.target.closest('[data-goto]');
      if (goto) {
        e.preventDefault();
        setSidebar(false);
        location.hash = '#/' + goto.dataset.goto;
        return;
      }
      const el = e.target.closest('[data-action]');
      if (!el || el.tagName === 'INPUT') return;
      if (el.dataset.action === 'export-raw') {
        Utils.downloadFile('rutin-buah-mentah.json', localStorage.getItem(Store.KEY) || '{}', 'application/json');
        return;
      }
      if (el.dataset.action === 'restore-import') { restoreBackup(); return; }
      const handler = Pages.Actions[el.dataset.action];
      if (!handler) return;
      e.preventDefault();
      if (['export-data', 'export-md', 'export-ics', 'download-review', 'download-all-reviews', 'download-errlog'].includes(el.dataset.action)) {
        UI.animateDownload(el, () => {
          try { handler(el); } catch (err) { console.error(err); UI.toast('Aksi gagal: ' + err.message, 'error'); }
        });
        return;
      }
      try { handler(el); } catch (err) { console.error(err); UI.toast('Aksi gagal: ' + err.message, 'error'); }
    });

    document.addEventListener('input', (e) => {
      const el = e.target;
      if (el.matches('[data-action="activity-search"]') && typeof Pages.filterActivities === 'function') {
        Pages.filterActivities(el.value);
      }
      // N-02: autosave lewat Store.update (flush antrean dulu), tanpa render ulang.
      if (el.id === 'mentor-notes') {
        clearTimeout(window.__mentorT);
        window.__mentorT = setTimeout(() => {
          window.__mentorT = null;
          Store.saveMentorNotes(el.value);
        }, 400);
      }
      // F-01: pratinjau stok ditangani onOpen modal (field inventoryId).
    });

    const rawMoney = (v) => Number(String(v ?? '').replace(/\./g, '').replace(/[^\d]/g, '')) || 0;

    document.addEventListener('change', (e) => {
      const el = e.target;
      if (el.matches('[data-action="actual-price"]')) {
        const id = el.dataset.id;
        // U-07: silent = tanpa render ulang, fokus tetap di input.
        Store.update((s) => {
          const item = s.shopping.find((i) => i.id === id);
          if (item) item.actualUnitPrice = el.value.trim() === '' ? null : Math.max(0, rawMoney(el.value));
        }, true);
        if (typeof Pages.refreshShoppingTotals === 'function') Pages.refreshShoppingTotals();
      }
      if (el.id === 'import-file' && el.files && el.files[0]) handleImport(el.files[0], el);
    });

    // V-15: format ribuan saat blur, angka mentah saat fokus.
    document.addEventListener('focusin', (e) => {
      const el = e.target;
      if (el.matches?.('[data-money]')) el.value = String(rawMoney(el.value) || '');
    });
    document.addEventListener('focusout', (e) => {
      const el = e.target;
      if (el.id === 'mentor-notes') { flushMentorNotes(); return; }
      if (!el.matches?.('[data-money]')) return;
      const n = rawMoney(el.value);
      el.value = n ? n.toLocaleString('id-ID') : '';
    });

    document.addEventListener('submit', (e) => {
      if (e.target.id === 'settings-form') {
        e.preventDefault();
        Pages.saveSettings();
      }
    });

    document.querySelectorAll('#theme-toggle, #mobile-theme-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = resolvedTheme() === 'dark' ? 'light' : 'dark';
        Store.update((s) => { s.settings.theme = next; });
        applyTheme();
        UI.themeTransition();
      });
    });

    document.getElementById('footer-backup').addEventListener('click', () => {
      if (typeof Pages.Actions['export-data'] === 'function') Pages.Actions['export-data']();
    });

    document.addEventListener('app:saved', () => {
      setSaveIndicator('Tersimpan pukul ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + '.');
    });
    document.addEventListener('app:save-error', () => {
      setSaveIndicator('Gagal menyimpan data.', true);
      UI.toast('Data gagal disimpan. Periksa ruang penyimpanan browser.', 'error');
    });
    document.addEventListener('app:changed', (e) => {
      applyTheme();
      const external = !!(e.detail && e.detail.external);
      if (external) UI.toast('Data disinkronkan dari jendela lain.', 'info');
      render(external);
    });
    document.addEventListener('app:force-render', () => render(true));

    // D-03: tab lain menulis → muat ulang state, jangan menimpa.
    window.addEventListener('storage', (e) => {
      if (e.key !== Store.KEY) return;
      Store.reloadFromStorage(true); // app:changed handler melakukan applyTheme + render
    });

    window.addEventListener('hashchange', () => route());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { flushMentorNotes(); Store.flush(); return; }
      Store.reloadFromStorage();
      Store.refreshWeek();
      syncReviews();
      applyTheme();
      checkNotifications();
      const today = Utils.dateKey(new Date());
      if (today !== lastDayKey) { lastDayKey = today; render(true); }
      else Pages.refreshLiveStates();
    });
    window.addEventListener('focus', checkNotifications);
    window.addEventListener('pagehide', () => { flushMentorNotes(); Store.flush(); });
    if (window.matchMedia) {
      matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
        if (Store.state.settings.theme === 'system') applyTheme();
      });
    }
  }

  /* ---------- Pengingat dalam aplikasi & browser ---------- */

  function notify(title, body, tag, url = './index.html', inAppText = '') {
    const permission = 'Notification' in window && Notification.permission === 'granted';
    if (!permission) {
      // N-03: tetap beri pengingat dalam aplikasi bila izin browser tidak ada.
      if (inAppText || body) UI.toast(inAppText || body, 'info');
      return;
    }
    const options = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url } };
    const fallback = () => {
      try {
        if (typeof Notification === 'function') { new Notification(title, options); return; }
      } catch { /* abbaikan */ }
      if (inAppText || body) UI.toast(inAppText || body, 'info');
    };
    if (!navigator.serviceWorker || !navigator.serviceWorker.ready) { fallback(); return; }
    Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(null), 1200))
    ]).then((reg) => {
      if (!reg || typeof reg.showNotification !== 'function') { fallback(); return; }
      Promise.resolve(reg.showNotification(title, options)).catch(fallback);
    }).catch(fallback);
  }

  function markNotified(key) {
    if (Store.state.notified[key]) return false;
    return Store.update((s) => {
      if (s.notified[key]) return false;
      s.notified[key] = true;
      return true;
    }, true);
  }

  function checkNotifications() {
    const n = Store.state.settings.notifications;
    if (!n.enabled) return;
    const now = new Date();
    const key = Utils.dateKey(now);
    const current = now.getHours() * 60 + now.getMinutes();
    const wake = Utils.parseTime(Store.state.settings.wakeUpTime) ?? 240;

    if (n.activity) {
      Store.activitiesForDay(now).forEach((a) => {
        const start = Utils.parseTime(a.startTime);
        if (start == null) return;
        const lead = Math.max(0, Number(n.activityLeadMinutes) || 0);
        const within = Utils.withinWindow(start - lead, current, Math.max(lead, 10));
        if (within && Store.activityStatus(a, now) === 'upcoming') {
          const k = `${key}:activity:${a.id}`;
          if (markNotified(k)) notify('Segera: ' + a.title, `Mulai pukul ${Utils.fmtTime(a.startTime)} · ${a.category}`, k, './index.html', `Segera: ${a.title}`);
        }
        // C.8: buka/tutup jendela hanya sekali per hari per aktivitas.
        const win = Store.windowFor(a, now, now, Store.state);
        if (!win.ok || win.legacy) return;
        const ms = now.getTime();
        if (ms >= win.opensAt && ms < win.opensAt + 60000) {
          const k = `${key}:window-open:${a.id}`;
          if (markNotified(k)) notify('Jendela dibuka: ' + a.title, `Tersedia sampai ${Utils.fmtTime(win.start)} plus toleransi.`, k, './index.html#/jadwal', 'Jendela dibuka: ' + a.title);
        }
        if (ms >= win.closesAt && ms < win.closesAt + 60000) {
          const k = `${key}:window-close:${a.id}`;
          if (markNotified(k)) notify('Jendela ditutup: ' + a.title, 'Toleransi 10 menit berjalan. Setelah itu penandaan dikunci.', k, './index.html#/jadwal', 'Jendela ditutup: ' + a.title);
        }
      });
    }

    if (n.fruit && Store.servingsForDate(now) < Store.dailyTarget()) {
      const slots = [Store.state.settings.fruit1Time, Store.state.settings.fruit2Time];
      for (let i = 2; i < Store.dailyTarget(); i++) {
        slots.push(Utils.fmtTime(Utils.parseTime(Store.state.settings.fruit2Time) + (i - 1) * 90));
      }
      slots.forEach((t, i) => {
        const m = Utils.parseTime(t);
        if (m != null && Utils.withinWindow(m, current, 10)) {
          const k = `${key}:fruit:${i}`;
          if (markNotified(k)) notify('Waktu konsumsi buah', `Porsi ${i + 1} · ${Store.servingsForDate(now)}/${Store.dailyTarget()} porsi hari ini`, k, './index.html#/buah', 'Waktu konsumsi buah');
        }
      });
    }

    if (n.shopping) {
      const next = Store.nextShoppingReminder();
      const timeKey = next.session === 'main' ? n.shoppingTimeMain : n.shoppingTimeRefill;
      const m = Utils.parseTime(timeKey);
      if (Utils.dow(now) === next.day && m != null && Utils.withinWindow(m, current, 10) && Store.reminderFor(next.session).status === 'pending') {
        const k = `${Utils.weekKey(now)}:${next.session}:shopping`;
        if (markNotified(k)) notify('Pengingat ' + next.label.toLowerCase(), 'Jangan lupa menyiapkan daftar belanja buah minggu ini.', k, './index.html#/belanja', 'Pengingat belanja buah minggu ini.');
      }
    }

    if (n.lowStock && Store.consumeSoonInventory().length && Utils.withinWindow(wake, current, 720)) {
      const k = `${key}:lowstock`;
      if (markNotified(k)) {
        const names = Store.consumeSoonInventory().map((i) => i.name).join(', ');
        notify('Buah perlu segera dikonsumsi', names, k, './index.html#/buah', 'Buah perlu segera dikonsumsi: ' + names);
      }
    }

    if (n.bedtime) {
      const m = Utils.parseTime(Store.state.settings.bedtime);
      if (m != null && Utils.withinWindow(m, current, 10)) {
        const k = `${key}:bedtime`;
        if (markNotified(k)) notify('Waktu persiapan tidur', 'Target tidur ' + Utils.fmtTime(Store.state.settings.bedtime) + '.', k, './index.html', 'Waktu persiapan tidur.');
      }
    }

    if (n.review && Utils.withinWindow(21 * 60, current, 10) && Utils.dow(now) === 7) {
      const k = `${Utils.weekKey(now)}:review-preview`;
      if (markNotified(k)) notify('Pratinjau evaluasi mingguan', 'Minggu 21.00 — laporan pratinjau siap dibuka.', k, './index.html#/evaluasi', 'Pratinjau evaluasi mingguan siap dibuka.');
    }
    if (n.review && Utils.withinWindow(9 * 60, current, 10) && Utils.dow(now) === 1) {
      const k = `${Utils.weekKey(now)}:review-final`;
      const expiring = Store.reviewStats().expiring;
      if (markNotified(k)) notify('Laporan evaluasi mingguan', expiring
        ? `Laporan ${expiring.isoWeek} akan dihapus Senin depan. Unduh bila perlu.`
        : 'Senin 09.00 — laporan final siap dibuka atau diunduh.', k, './index.html#/evaluasi', 'Laporan evaluasi mingguan siap dibuka.');
    }
  }

  /** D-07: ingatkan maksimal sekali sehari bila cadangan sudah tua. */
  function checkBackupReminder() {
    const age = Store.backupAgeDays();
    if (age == null || age <= 14) return;
    const k = `${Utils.dateKey(new Date())}:backup-reminder`;
    if (markNotified(k)) {
      UI.toast(`Cadangan terakhir ${age} hari lalu. Buka Pengaturan → Data & cadangan untuk ekspor.`, 'info');
    }
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        // S-03: beri tahu pengguna bila versi baru siap.
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state !== 'installed' || !navigator.serviceWorker.controller) return;
            UI.confirm('Versi baru tersedia', 'Muat ulang aplikasi untuk memakai versi terbaru?', 'Muat ulang')
              .then((ok) => {
                if (!ok) return;
                // Pasang dulu: worker baru bisa mengambil kontrol segera setelah SKIP_WAITING.
                navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
                installing.postMessage({ type: 'SKIP_WAITING' });
              });
          });
        });
      }).catch((err) => console.warn('Service worker tidak terdaftar:', err));

      // S-02: klik notifikasi mengarahkan jendela yang sudah ada.
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'NAVIGATE' && e.data.hash) location.hash = e.data.hash;
      });
    });
  }

  async function requestPersistentStorage() {
    try {
      if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
    } catch { /* abbaikan */ }
  }

  /** S9: arsip riwayat lama hanya saat idle; gagal/IndexedDB absen = data tetap di localStorage. */
  function scheduleArchive() {
    const run = () => { Store.archiveOld().catch(() => {}); };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 5000 });
    else setTimeout(run, 1500);
  }

  function init() {
    UI.initModal();
    renderNav();
    initDrawer();
    applyTheme();
    initTopbarButtons();
    bindEvents();
    registerSW();
    Pages.setViewDate(new Date());
    Store.freezeDays();
    syncReviews();
    route(true);
    Pages.updateNotifStatus();
    checkNotifications();
    setInterval(() => {
      checkNotifications();
      syncReviews();
      const today = Utils.dateKey(new Date());
      if (today !== lastDayKey) { lastDayKey = today; render(true); }
      else Pages.refreshLiveStates();
    }, 60000);
    requestPersistentStorage();
    scheduleArchive();
    setTimeout(initOnboarding, 300);
    setTimeout(checkBackupReminder, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
