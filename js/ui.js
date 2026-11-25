/* ---------- Komponen UI bersama ---------- */
const UI = (() => {
  const esc = Utils.escapeHtml;
  const ic = Utils.icon;
  let modalState = null;
  let themeTimer = null;

  /** F-04: timer milik masing-masing toast, bukan satu timer global. */
  function toast(message, type = 'success') {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'toast toast-' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const iconName = type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check';
    el.innerHTML = ic(iconName, 18) + `<span>${esc(message)}</span>`;
    el.title = 'Tutup notifikasi';
    root.appendChild(el);
    while (root.children.length > 3) root.firstElementChild.remove();
    requestAnimationFrame(() => el.classList.add('is-visible'));
    const remove = () => {
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 250);
    };
    const timer = setTimeout(remove, type === 'error' ? 6000 : 3200);
    el.addEventListener('click', () => { clearTimeout(timer); remove(); });
  }

  const dialog = () => document.getElementById('modal');

  function openModal({ title, body = '', submitLabel = 'Simpan', cancelLabel = 'Batal', onSubmit, onOpen, size = '' }) {
    const d = dialog();
    const trigger = document.activeElement;
    modalState = { onSubmit, resolver: null, trigger, dirty: false, onClose: null };
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-label').textContent = submitLabel;
    const submit = document.getElementById('modal-submit');
    submit.classList.remove('is-sending');
    submit.disabled = false;
    document.getElementById('modal-cancel').textContent = cancelLabel;
    clearModalHint();
    d.className = 'modal' + (size ? ' modal-' + size : '');
    if (onOpen) onOpen(d);
    if (!d.open) d.showModal();
    document.body.classList.add('has-modal');
    const first = d.querySelector('input:not([type=hidden]), select, textarea');
    if (first) setTimeout(() => first.focus(), 30);
  }

  function closeModal() {
    const d = dialog();
    if (d.open) d.close();
    else releaseModal();
  }

  /** Pesan di dalam dialog (toast global tertutup top layer saat modal aktif). */
  function modalHint(message) {
    const d = dialog();
    let hint = d.querySelector('.modal-dirty-hint');
    if (!hint) {
      hint = document.createElement('p');
      hint.className = 'modal-dirty-hint';
      hint.setAttribute('role', 'status');
      const foot = d.querySelector('.modal-foot');
      if (foot) foot.prepend(hint);
      else d.appendChild(hint);
    }
    hint.textContent = message;
  }

  function clearModalHint() {
    dialog().querySelector('.modal-dirty-hint')?.remove();
  }

  /** Tutup lewat X/Batal/backdrop/Escape dengan perlindungan dirty yang sama. */
  function requestCloseModal() {
    if (modalState && modalState.dirty) {
      modalHint('Perubahan belum disimpan. Pilih Simpan atau Batal.');
      return;
    }
    closeModal();
  }

  function releaseModal() {
    const d = dialog();
    if (!modalState) {
      document.body.classList.remove('has-modal');
      return;
    }
    const { resolver, onClose, trigger } = modalState;
    modalState = null;
    if (onClose) onClose();
    if (resolver) resolver(false); // U-05: promise selalu selesai.
    document.body.classList.remove('has-modal');
    // Elemen pemicu bisa diganti render; jatuhkan fokus ke area aplikasi.
    if (trigger && trigger.isConnected) trigger.focus();
    else document.getElementById('app')?.focus();
    d.removeAttribute('data-dirty');
    clearModalHint();
  }

  function confirm(title, message, submitLabel = 'Ya, lanjutkan') {
    return new Promise((resolve) => {
      openModal({
        title,
        submitLabel,
        body: `<p class="modal-note">${esc(message)}</p>`,
        onSubmit: () => { resolve(true); return true; }
      });
      modalState.resolver = resolve;
    });
  }

  function field(label, name, opts = {}) {
    const {
      type = 'text', value = '', options = [], placeholder = '', help = '',
      required = false, min, max, step, rows = 3, attrs = '', full = false, checked = false,
      suggestions = []
    } = opts;
    const id = 'f-' + name;
    const describedBy = help ? ` aria-describedby="help-${id}"` : '';
    let control;
    if (type === 'select') {
      control = `<select id="${id}" name="${esc(name)}" ${required ? 'required' : ''} ${describedBy} ${attrs}>` +
        options.map((o) => {
          const val = typeof o === 'object' ? o.value : o;
          const text = typeof o === 'object' ? o.label : o;
          return `<option value="${esc(val)}" ${String(val) === String(value) ? 'selected' : ''}>${esc(text)}</option>`;
        }).join('') + '</select>';
    } else if (type === 'textarea') {
      control = `<textarea id="${id}" name="${esc(name)}" rows="${rows}" placeholder="${esc(placeholder)}" ${required ? 'required' : ''} ${describedBy} ${attrs}>${esc(value)}</textarea>`;
    } else if (type === 'checkbox') {
      control = `<label class="switch"><input type="checkbox" id="${id}" name="${esc(name)}" ${checked ? 'checked' : ''} ${describedBy} ${attrs}><span class="switch-track"></span></label>`;
      return `<div class="field field-check ${full ? 'field-full' : ''}"><div class="field-check-main"><label for="${id}">${esc(label)}</label>${help ? `<small id="help-${id}">${esc(help)}</small>` : ''}</div>${control}</div>`;
    } else {
      const inputMode = type === 'number' ? ' inputmode="decimal"' : '';
      control = `<input id="${id}" name="${esc(name)}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${required ? 'required' : ''} ${inputMode} ${describedBy} ${min !== undefined ? `min="${min}"` : ''} ${max !== undefined ? `max="${max}"` : ''} ${step !== undefined ? `step="${step}"` : ''} ${suggestions.length ? `list="dl-${esc(name)}"` : ''} ${attrs}>`;
    }
    const list = suggestions.length
      ? `<datalist id="dl-${esc(name)}">${suggestions.map((s) => `<option value="${esc(s)}"></option>`).join('')}</datalist>`
      : '';
    const helpHtml = help ? `<small id="help-${id}">${esc(help)}</small>` : '';
    return `<div class="field ${full ? 'field-full' : ''}"><label for="${id}">${esc(label)}${required ? ' <span class="req">*</span>' : ''}</label>${control}${list}${helpHtml}</div>`;
  }

  function formGrid(fields) {
    return '<div class="form-grid">' + fields.join('') + '</div>';
  }

  const STATUS = {
    completed: { label: 'Selesai', cls: 'ok' },
    ongoing: { label: 'Berjalan', cls: 'run' },
    grace: { label: 'Segera tutup', cls: 'warn' },
    upcoming: { label: 'Akan datang', cls: 'idle' },
    missed: { label: 'Terlewat', cls: 'miss' },
    skipped: { label: 'Dilewati', cls: 'skip' },
    inprogress: { label: 'Berjalan', cls: 'run' },
    excused: { label: 'Hari istirahat', cls: 'skip' }
  };

  function badge(status) {
    const s = STATUS[status] || STATUS.upcoming;
    return `<span class="badge badge-${s.cls}"><span class="badge-dot"></span>${s.label}</span>`;
  }

  function chip(text, tone = 'neutral') {
    return `<span class="chip chip-${tone}">${esc(text)}</span>`;
  }

  function ring(pct, label, sub = '') {
    const p = Utils.clamp(Number(pct) || 0, 0, 100); // F-12: tidak pernah > 100%.
    const r = 42, c = 2 * Math.PI * r;
    return `<div class="ring" role="img" aria-label="${p}% ${esc(label)}">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="ring-bg" cx="50" cy="50" r="${r}"></circle>
        <circle class="ring-fg" cx="50" cy="50" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}"></circle>
      </svg>
      <div class="ring-label"><strong>${p}%</strong><span>${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ''}</div>
    </div>`;
  }

  function bar(pct, tone = 'primary', label = 'Progres') {
    const p = Utils.clamp(pct, 0, 100);
    return `<div class="bar" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><span class="bar-fill bar-${tone}" style="width:${p}%"></span></div>`;
  }

  function section(title, subtitle = '', action = '') {
    return `<div class="section-head"><div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>${action}</div>`;
  }

  function empty(iconName, title, text = '') {
    return `<div class="empty">${ic(iconName, 26)}<strong>${esc(title)}</strong>${text ? `<span>${esc(text)}</span>` : ''}</div>`;
  }

  function pageHead(eyebrow, title, desc, actions = '') {
    // U-04: judul halaman sudah ada di h1 topbar; h2 disembunyikan dari pembaca layar.
    return `<div class="page-head"><div><span class="eyebrow">${esc(eyebrow)}</span><h2 aria-hidden="true">${esc(title)}</h2>${desc ? `<p>${esc(desc)}</p>` : ''}</div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</div>`;
  }

  function initModal() {
    const d = dialog();
    document.getElementById('modal-close').innerHTML = ic('close', 20);
    document.getElementById('modal-close').addEventListener('click', requestCloseModal);
    document.getElementById('modal-cancel').addEventListener('click', requestCloseModal);
    const submit = document.getElementById('modal-submit');
    submit.insertAdjacentHTML('beforeend', sendIcon());
    submit.addEventListener('click', () => {
      if (submit.disabled) return;
      if (!modalState || !modalState.onSubmit) return closeModal();
      const form = document.getElementById('modal-form');
      // F-13: validasi native tetap dijalankan walaupun form memakai novalidate.
      if (form && !form.reportValidity()) return;
      const result = modalState.onSubmit(form, new FormData(form));
      if (result === false) return;
      // U-05: tutup segera; animasi tautan tetap ringan (220 ms) tanpa menahan UI.
      submit.disabled = true;
      submit.classList.add('is-sending');
      closeModal();
      setTimeout(() => {
        submit.disabled = false;
        submit.classList.remove('is-sending');
      }, 220);
    });
    document.getElementById('modal-form').addEventListener('submit', (e) => {
      e.preventDefault();
      document.getElementById('modal-submit').click();
    });
    d.addEventListener('input', (e) => {
      if (modalState && e.target.closest('#modal-form')) modalState.dirty = true;
    });
    d.addEventListener('click', (e) => {
      if (e.target !== d) return;
      requestCloseModal();
    });
    d.addEventListener('cancel', (e) => {
      if (modalState && modalState.dirty) {
        e.preventDefault();
        modalHint('Perubahan belum disimpan. Pilih Simpan atau Batal.');
      }
    });
    d.addEventListener('close', releaseModal);
  }

  /* ---------- Ikon yang ber-morph, bukan di-swap ---------- */
  function checkIcon(done) {
    return `<svg class="icon check-morph ${done ? 'is-checked' : ''}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect class="check-box" x="4" y="4" width="16" height="16" rx="4"></rect>
      <path class="check-mark" d="m7 12.4 3.4 3.4L17.4 9"></path>
    </svg>`;
  }

  function downloadIcon() {
    return `<svg class="icon download-morph" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path class="dl-arrow" d="M12 3v11m0 0 4-4m-4 4-4-4"></path>
      <path class="dl-base" d="M4 17v3h16v-3"></path>
      <circle class="dl-ring" cx="12" cy="12" r="9"></circle>
      <path class="dl-check" d="m8 12.4 3 3 5-6"></path>
    </svg>`;
  }

  function sendIcon() {
    return `<svg class="icon send-morph" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path class="send-trail" d="M9 14 20 4"></path>
      <path class="send-plane" d="M21 3 3 10.6l7.1 2.3 2.3 7.1L21 3Z"></path>
    </svg>`;
  }

  function themeIcon(isDark, key = 'main') {
    const mask = 'theme-mask-' + key;
    return `<svg class="icon theme-morph ${isDark ? 'is-dark' : 'is-light'}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
      <defs><mask id="${mask}"><rect width="24" height="24" fill="#fff"></rect><circle class="crescent-cut" cx="17" cy="6" r="8" fill="#000"></circle></mask></defs>
      <g class="sun-rays">
        <line x1="12" y1="1.5" x2="12" y2="3.5"></line><line x1="12" y1="20.5" x2="12" y2="22.5"></line>
        <line x1="1.5" y1="12" x2="3.5" y2="12"></line><line x1="20.5" y1="12" x2="22.5" y2="12"></line>
        <line x1="4.6" y1="4.6" x2="6" y2="6"></line><line x1="18" y1="18" x2="19.4" y2="19.4"></line>
        <line x1="4.6" y1="19.4" x2="6" y2="18"></line><line x1="18" y1="6" x2="19.4" y2="4.6"></line>
      </g>
      <circle class="theme-disc" cx="12" cy="12" r="5.2" mask="url(#${mask})"></circle>
      <g class="sparkles" fill="currentColor" stroke="none">
        <path d="m18.5 3 .7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"></path>
        <path d="m5 16 .5 1.5L7 18l-1.5.5L5 20l-.5-1.5L3 18l1.5-.5L5 16Z"></path>
      </g>
    </svg>`;
  }

  function searchIcon(open) {
    return `<svg class="icon search-morph ${open ? 'is-open' : ''}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true">
      <circle class="s-ring" cx="10.5" cy="10.5" r="6.5"></circle>
      <line class="s-handle" x1="15.4" y1="15.4" x2="20" y2="20"></line>
      <line class="s-x" x1="7.5" y1="7.5" x2="16.5" y2="16.5"></line>
      <line class="s-x" x1="16.5" y1="7.5" x2="7.5" y2="16.5"></line>
    </svg>`;
  }

  function lockIcon(locked) {
    return `<svg class="icon lock-morph ${locked ? '' : 'is-unlocked'}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path class="lock-shackle" d="M8 10V7a4 4 0 0 1 8 0v3"></path>
      <rect class="lock-body" x="5" y="10" width="14" height="11" rx="2.5"></rect>
      <circle class="lock-keyhole" cx="12" cy="15" r="1.2" fill="currentColor" stroke="none"></circle>
    </svg>`;
  }

  function themeTransition() {
    const el = document.documentElement;
    el.classList.add('theme-switching');
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => el.classList.remove('theme-switching'), 660);
  }

  function animateDownload(btn, run) {
    const icon = btn && btn.querySelector('.download-morph');
    if (!icon) { run(); return; }
    btn.disabled = true;
    icon.classList.add('is-loading');
    // P-01/U-05: umpan balik singkat, tidak menahan unduhan.
    setTimeout(() => {
      run();
      icon.classList.remove('is-loading');
      icon.classList.add('is-done');
      setTimeout(() => { icon.classList.remove('is-done'); btn.disabled = false; }, 500);
    }, 220);
  }

  return {
    toast, openModal, closeModal, confirm, field, formGrid, badge, chip, ring, bar,
    section, empty, pageHead, initModal, STATUS,
    checkIcon, downloadIcon, sendIcon, themeIcon, searchIcon, lockIcon, themeTransition, animateDownload
  };
})();
