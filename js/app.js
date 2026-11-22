/* ---------- Routing, inisialisasi, dan pengingat ---------- */
(() => {
  const NAV = [
    { key: 'dashboard', label: 'Beranda', icon: 'home', title: 'Beranda' },
    { key: 'jadwal', label: 'Jadwal', icon: 'calendar', title: 'Jadwal Mingguan' },
    { key: 'skripsi', label: 'Skripsi', icon: 'book', title: 'Skripsi' },
    { key: 'buah', label: 'Buah', icon: 'fruit', title: 'Buah & Stok' },
    { key: 'belanja', label: 'Belanja', icon: 'cart', title: 'Belanja' },
    { key: 'pengaturan', label: 'Setelan', icon: 'settings', title: 'Pengaturan' }
  ];

  const PAGES = {
    dashboard: Pages.dashboard, jadwal: Pages.jadwal, skripsi: Pages.skripsi,
    buah: Pages.buah, belanja: Pages.belanja, pengaturan: Pages.pengaturan
  };

  let current = 'dashboard';
  let deferredInstall = null;
  let lastRouteKey = '';

  function parseRoute() {
    const raw = (location.hash || '').replace(/^#\/?/, '');
    const [path, query = ''] = raw.split('?');
    const key = PAGES[path] ? path : 'dashboard';
    return { key, query: new URLSearchParams(query) };
  }

  function render() {
    const app = document.getElementById('app');
    const prevFocus = document.activeElement;
    const shouldRestore = prevFocus && app.contains(prevFocus) && prevFocus.dataset.action === 'toggle-activity';
    app.innerHTML = PAGES[current]();

    const navItem = NAV.find((n) => n.key === current);
    document.getElementById('page-title').textContent = navItem ? navItem.title : 'Beranda';
    document.getElementById('topbar-date').textContent = current === 'dashboard'
      ? Utils.formatDate(new Date())
      : Utils.dayName(Utils.dow(new Date())) + ' · ' + Utils.formatDate(new Date(), { short: true });

    document.querySelectorAll('#nav [data-nav]').forEach((b) => {
      const active = b.dataset.nav === current;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-current', active ? 'page' : 'false');
    });

    const weekly = Store.weekProgress();
    document.getElementById('sidebar-progress').textContent = weekly.pct + '%';

    if (shouldRestore) {
      const id = prevFocus.dataset.id;
      const replacement = app.querySelector(`[data-action="toggle-activity"][data-id="${CSS.escape(id)}"]`);
      if (replacement) replacement.focus({ preventScroll: true });
    }
    if (typeof Pages.afterRender === 'function') Pages.afterRender();
  }

  function route() {
    const { key, query } = parseRoute();
    current = key;
    render();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

    const routeKey = key + '|' + query.toString();
    if (query.get('action') === 'consume' && routeKey !== lastRouteKey) {
      lastRouteKey = routeKey;
      Pages.openConsumeModal();
    }
  }

  function renderNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = NAV.map((n) => `<button class="nav-item" type="button" data-nav="${n.key}">
      ${Utils.icon(n.icon, 21)}<span>${n.label}</span></button>`).join('');
  }

  function setSaveIndicator(text, isError = false) {
    const el = document.getElementById('footer-backup');
    if (!el) return;
    const parent = el.parentElement;
    parent.firstChild.textContent = text + ' ';
    parent.classList.toggle('save-error', isError);
  }

  function initTheme() {
    const isDark = document.documentElement.dataset.theme === 'dark';
    document.querySelectorAll('#theme-toggle, #mobile-theme-toggle').forEach((btn) => {
      btn.innerHTML = UI.themeIcon(isDark, btn.id === 'mobile-theme-toggle' ? 'mobile' : 'desktop');
      btn.setAttribute('aria-label', isDark ? 'Gunakan tema terang' : 'Gunakan tema gelap');
      btn.setAttribute('title', isDark ? 'Tema terang' : 'Tema gelap');
    });
  }

  function initTopbarButtons() {
    const fruitBtn = document.getElementById('quick-fruit');
    fruitBtn.innerHTML = Utils.icon('fruit', 17) + '<span>Catat buah</span>';
    fruitBtn.addEventListener('click', () => Pages.openConsumeModal());

    const installBtn = document.getElementById('install-btn');
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

  function bindEvents() {
    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) {
        location.hash = '#/' + nav.dataset.nav;
        return;
      }
      const el = e.target.closest('[data-action]');
      if (!el || el.tagName === 'INPUT') return;
      const handler = Pages.Actions[el.dataset.action];
      if (!handler) return;
      e.preventDefault();
      if (el.dataset.action === 'export-data' || el.dataset.action === 'export-md') {
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
    });

    document.addEventListener('change', (e) => {
      const el = e.target;
      if (el.matches('[data-action="actual-price"]')) {
        const id = el.dataset.id;
        Store.update((s) => {
          const item = s.shopping.find((i) => i.id === id);
          if (item) item.actualUnitPrice = el.value === '' ? null : Math.max(0, Number(el.value) || 0);
        });
        UI.toast('Harga aktual disimpan.');
      }
      if (el.id === 'import-file' && el.files && el.files[0]) {
        const file = el.files[0];
        const reader = new FileReader();
        reader.onload = () => {
          try {
            Store.importData(String(reader.result));
            document.dispatchEvent(new CustomEvent('app:force-render'));
            UI.toast('Data berhasil diimpor.');
          } catch (err) {
            UI.toast('Gagal mengimpor: ' + err.message, 'error');
          }
          el.value = '';
        };
        reader.onerror = () => { UI.toast('Gagal membaca berkas.', 'error'); el.value = ''; };
        reader.readAsText(file);
      }
    });

    document.addEventListener('submit', (e) => {
      if (e.target.id === 'settings-form') {
        e.preventDefault();
        Pages.saveSettings();
      }
    });

    document.querySelectorAll('#theme-toggle, #mobile-theme-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        Store.update((s) => { s.settings.theme = next; });
        document.documentElement.dataset.theme = next;
        UI.themeTransition();
        initTheme();
      });
    });

    document.getElementById('footer-backup').addEventListener('click', () => Pages.Actions['export-data']());

    document.addEventListener('app:saved', () => {
      setSaveIndicator('Tersimpan pukul ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + '.');
    });
    document.addEventListener('app:save-error', () => {
      setSaveIndicator('Gagal menyimpan data.', true);
      UI.toast('Data gagal disimpan. Periksa ruang penyimpanan browser.', 'error');
    });
    document.addEventListener('app:changed', () => {
      document.documentElement.dataset.theme = Store.state.settings.theme === 'dark' ? 'dark' : 'light';
      initTheme();
      if (current !== 'pengaturan') render();
      else {
        // Jangan timpa input yang belum disimpan; cukup sinkronkan status global.
        const weekly = Store.weekProgress();
        document.getElementById('sidebar-progress').textContent = weekly.pct + '%';
      }
    });
    document.addEventListener('app:force-render', () => render());

    window.addEventListener('hashchange', route);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNotifications(); });
  }

  /* ---------- Pengingat dalam aplikasi & browser ---------- */
  function notify(title, body, tag, url = './index.html') {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const options = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url } };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, options)).catch(() => new Notification(title, options));
    } else {
      new Notification(title, options);
    }
  }

  function markNotified(key) {
    if (Store.state.notified[key]) return false;
    Store.state.notified[key] = true;
    Store.persist();
    return true;
  }

  function checkNotifications() {
    const n = Store.state.settings.notifications;
    if (!n.enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date();
    const key = Utils.dateKey(now);
    const current = now.getHours() * 60 + now.getMinutes();

    if (n.activity) {
      Store.activitiesForDay(Utils.dow(now)).forEach((a) => {
        const start = Utils.parseTime(a.startTime);
        if (start == null) return;
        const lead = Number(n.activityLeadMinutes) || 0;
        if (start >= current && start - current <= lead && Store.activityStatus(a, now) === 'upcoming') {
          const k = `${key}:activity:${a.id}`;
          if (markNotified(k)) notify('Segera: ' + a.title, `Mulai pukul ${Utils.fmtTime(a.startTime)} · ${a.category}`, k);
        }
      });
    }

    if (n.fruit && Store.servingsForDate(now) < Store.dailyTarget()) {
      [Store.state.settings.fruit1Time, Store.state.settings.fruit2Time].forEach((t, i) => {
        const m = Utils.parseTime(t);
        if (m != null && current === m) {
          const k = `${key}:fruit:${i}`;
          if (markNotified(k)) notify('Waktu konsumsi buah', `Porsi ${i === 0 ? 'pertama' : 'kedua'} · ${Store.servingsForDate(now)}/${Store.dailyTarget()} porsi hari ini`, k, './index.html#/buah');
        }
      });
    }

    if (n.shopping) {
      const next = Store.nextShoppingReminder();
      const timeKey = next.session === 'main' ? n.shoppingTimeMain : n.shoppingTimeRefill;
      const m = Utils.parseTime(timeKey);
      if (Utils.dow(now) === next.day && m != null && current === m && Store.reminderFor(next.session).status === 'pending') {
        const k = `${Utils.weekKey(now)}:${next.session}:shopping`;
        if (markNotified(k)) notify('Pengingat ' + next.label.toLowerCase(), 'Jangan lupa menyiapkan daftar belanja buah minggu ini.', k, './index.html#/belanja');
      }
    }

    if (n.lowStock && Store.consumeSoonInventory().length) {
      const k = `${key}:lowstock`;
      if (markNotified(k)) notify('Buah perlu segera dikonsumsi', Store.consumeSoonInventory().map((i) => i.name).join(', '), k, './index.html#/buah');
    }

    if (n.bedtime) {
      const m = Utils.parseTime(Store.state.settings.bedtime);
      if (m != null && current === m) {
        const k = `${key}:bedtime`;
        if (markNotified(k)) notify('Waktu persiapan tidur', 'Target tidur ' + Utils.fmtTime(Store.state.settings.bedtime) + '.', k);
      }
    }
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker tidak terdaftar:', err));
    });
  }

  function init() {
    UI.initModal();
    renderNav();
    document.documentElement.dataset.theme = Store.state.settings.theme === 'dark' ? 'dark' : 'light';
    initTheme();
    initTopbarButtons();
    bindEvents();
    registerSW();
    Pages.setViewDate(new Date());
    route();
    Pages.updateNotifStatus();
    checkNotifications();
    setInterval(checkNotifications, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
