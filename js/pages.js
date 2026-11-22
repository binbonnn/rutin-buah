/* ---------- Halaman & aksi aplikasi ---------- */
const Pages = (() => {
  const esc = Utils.escapeHtml;
  const ic = Utils.icon;
  const S = () => Store.state;

  let viewDate = new Date();
  let activitySearch = { open: false, query: '' };

  // CHOICE OVERLOAD: 6 opsi utama lebih dulu, 2 opsi jarang di akhir daftar.
  const CATEGORIES = ['Skripsi', 'Kerja', 'Olahraga', 'Pribadi', 'Makan', 'Lainnya', 'Membaca', 'Ibadah'];

  /* ============================ BERANDA ============================ */
  function dashboard() {
    const now = new Date();
    const day = Utils.dow(now);
    const acts = Store.activitiesForDay(day);
    const statuses = acts.map((a) => ({ a, status: Store.activityStatus(a, now) }));
    const done = statuses.filter((s) => s.status === 'completed').length;
    const daily = Store.progressForDate(now);
    const weekly = Store.weekProgress(now);
    const next = statuses.find((s) => s.status === 'upcoming' || s.status === 'ongoing');
    const servings = Store.servingsForDate(now);
    const target = Store.dailyTarget();
    const inv = Store.activeInventory();
    const soon = Store.consumeSoonInventory();
    const totals = Store.shoppingTotals();
    const reminder = Store.nextShoppingReminder();
    const remState = Store.reminderFor(reminder.session);
    const taskStats = Store.taskStats();
    const todayTarget = Store.targetForDay(day);

    const nextHtml = next
      ? `<div class="next-top">${UI.chip(next.status === 'ongoing' ? 'Sedang berlangsung' : 'Berikutnya', next.status === 'ongoing' ? 'run' : 'primary')}<span class="next-time">${esc(Utils.fmtTime(next.a.startTime))}</span></div>
         <h3>${esc(next.a.title)}</h3>
         <p>${esc(Utils.fmtTime(next.a.startTime))} – ${esc(Utils.fmtTime(next.a.endTime))} · ${esc(next.a.category)}</p>`
      : `<div class="next-top">${UI.chip('Selesai', 'ok')}</div><h3>Semua jadwal hari ini tertangani</h3><p>Setelahnya, fokus pada pemulihan dan persiapan besok.</p>`;

    const checklist = statuses.length ? statuses.map(({ a, status }) => `
      <li class="task-row ${status === 'completed' ? 'is-done' : ''}">
        <button class="check" type="button" data-action="toggle-activity" data-id="${esc(a.id)}" data-date="${Utils.dateKey(now)}"
          aria-label="Tandai ${esc(a.title)} ${status === 'completed' ? 'belum selesai' : 'selesai'}" aria-pressed="${status === 'completed'}">
          ${UI.checkIcon(status === 'completed')}
        </button>
        <div class="task-main"><strong>${esc(a.title)}</strong><span>${esc(Utils.fmtTime(a.startTime))} – ${esc(Utils.fmtTime(a.endTime))} · ${esc(a.category)}</span></div>
        ${UI.badge(status)}
      </li>`).join('') : UI.empty('calendar', 'Belum ada aktivitas', 'Tambahkan aktivitas untuk hari ini.');

    return `
      <div class="stack">
        <section class="hero-card">
          <div class="hero-glow" aria-hidden="true"></div>
          <div class="hero-content">
            <span class="hero-eyebrow">${esc(Utils.formatDate(now))}</span>
            <h2>${greeting()}${S().settings.name ? ', ' + esc(S().settings.name) : ''}</h2>
            <p class="hero-sub">Fokus hari ini: ${esc(todayTarget || 'Jalankan rutinitas dengan konsisten.')}</p>
            <div class="hero-next">${nextHtml}</div>
          </div>
          <div class="hero-side">
            ${UI.ring(daily.pct, 'Hari ini', `${done}/${daily.total} aktivitas`)}
          </div>
        </section>

        <div class="grid-2">
          <section class="card">
            ${UI.section('Progres minggu ini', 'Hari Senin sampai hari ini')}
            <div class="progress-row"><strong>${weekly.done}</strong><span>/ ${weekly.total} aktivitas</span><b>${weekly.pct}%</b></div>
            ${UI.bar(weekly.pct, 'primary', 'Progres aktivitas minggu ini')}
            <div class="mini-stats">
              <div><span>Tugas skripsi</span><strong>${taskStats.done}/${taskStats.total}</strong></div>
              <div><span>Buah pekan ini</span><strong>${Store.servingsForWeek()}/${Store.weeklyTarget()}</strong></div>
            </div>
          </section>

          <section class="card fruit-card">
            ${UI.section('Konsumsi buah hari ini', `Target ${target} porsi per hari`)}
            <div class="fruit-count"><strong>${servings}</strong><span>/ ${target} porsi</span></div>
            <div class="fruit-dots" role="img" aria-label="${servings} dari ${target} porsi">
              ${Array.from({ length: target }, (_, i) => `<span class="fruit-dot ${i < servings ? 'is-filled' : ''}">${ic('fruit', 18)}</span>`).join('')}
            </div>
            <button class="btn btn-soft btn-block" type="button" data-action="open-consume">${ic('plus', 18)} Catat konsumsi buah</button>
          </section>
        </div>

        <section class="card">
          ${UI.section('Aktivitas hari ini', `${done} dari ${acts.length} selesai`, `<button class="btn btn-ghost btn-sm" type="button" data-action="add-activity" data-day="${day}">${ic('plus', 16)} Tambah</button>`)}
          <ul class="task-list">${checklist}</ul>
        </section>

        <div class="grid-2">
          <section class="card">
            ${UI.section('Stok buah', 'Siap dikonsumsi sekarang', `<a class="link-btn" href="#/buah">Lihat semua</a>`)}
            <div class="summary-list">
              <div class="summary-item"><span class="summary-icon icon-green">${ic('box', 20)}</span><div><strong>${inv.length} jenis buah</strong><span>Tersedia dalam stok</span></div></div>
              <div class="summary-item"><span class="summary-icon icon-amber">${ic('clock', 20)}</span><div><strong>${soon.length} perlu segera</strong><span>Sebaiknya dikonsumsi lebih dulu</span></div></div>
            </div>
          </section>

          <section class="card">
            ${UI.section('Anggaran buah', 'Minggu berjalan')}
            <div class="budget-line"><span>Terpakai</span><strong class="${totals.actual > totals.budget ? 'text-danger' : ''}">${esc(Utils.rupiah(totals.actual))}</strong></div>
            <div class="budget-line"><span>Sisa anggaran</span><strong>${esc(Utils.rupiah(totals.remaining))}</strong></div>
            ${UI.bar(totals.budget ? (totals.actual / totals.budget) * 100 : 0, totals.actual > totals.budget ? 'danger' : 'primary', 'Penggunaan anggaran buah')}
            <p class="hint">Maksimal ${esc(Utils.rupiah(totals.budget))} per minggu · estimasi ${esc(Utils.rupiah(totals.estimated))}</p>
          </section>
        </div>

        <section class="card reminder-card ${remState.status === 'pending' ? '' : 'is-handled'}">
          <div class="reminder-icon">${ic('bell', 22)}</div>
          <div class="reminder-body">
            <span class="eyebrow">Pengingat belanja</span>
            <h3>${esc(reminder.label)} · ${esc(Utils.dayName(reminder.day))}</h3>
            <p>${remState.status === 'done' ? 'Sudah ditandai selesai untuk minggu ini.' : remState.status === 'postponed' ? 'Ditunda untuk minggu ini.' : `${reminder.delta === 0 ? 'Hari ini' : `${reminder.delta} hari lagi`} · ${esc(Utils.formatDate(reminder.date, { short: true }))}`}</p>
          </div>
          ${remState.status === 'pending' ? `<div class="reminder-actions">
            <button class="btn btn-primary btn-sm" type="button" data-action="reminder-done" data-session="${reminder.session}">Selesai</button>
            <button class="btn btn-ghost btn-sm" type="button" data-action="reminder-postpone" data-session="${reminder.session}">Tunda</button>
          </div>` : ''}
        </section>

        <div class="quick-actions">
          <button class="quick-btn" type="button" data-action="add-activity" data-day="${day}">${ic('calendar', 20)}<span>Tambah aktivitas</span></button>
          <button class="quick-btn" type="button" data-action="open-consume">${ic('fruit', 20)}<span>Catat buah</span></button>
          <button class="quick-btn" type="button" data-action="open-stock">${ic('box', 20)}<span>Tambah stok</span></button>
        </div>
      </div>`;
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 18) return 'Selamat sore';
    return 'Selamat malam';
  }

  /* ========================= JADWAL MINGGUAN ========================= */
  function jadwal() {
    const dates = Utils.weekDates(viewDate);
    const selKey = Utils.dateKey(viewDate);
    const todayKey = Utils.dateKey(new Date());
    const monday = dates[0], sunday = dates[6];

    const strip = dates.map((d) => {
      const p = Store.progressForDate(d);
      const key = Utils.dateKey(d);
      return `<button class="day-chip ${key === selKey ? 'is-active' : ''} ${key === todayKey ? 'is-today' : ''}" type="button" data-action="select-day" data-date="${key}" aria-pressed="${key === selKey}">
        <span>${esc(Utils.dayName(Utils.dow(d), true))}</span><strong>${d.getDate()}</strong><small>${p.done}/${p.total}</small>
      </button>`;
    }).join('');

    const columns = dates.map((d) => {
      const dayNum = Utils.dow(d);
      const acts = Store.activitiesForDay(dayNum);
      const key = Utils.dateKey(d);
      const p = Store.progressForDate(d);
      const rows = acts.map((a) => activityRow(a, key)).join('');
      return `<section class="day-column ${key === selKey ? 'is-selected' : ''}" data-day-column="${key}">
        <div class="day-column-head">
          <div><strong>${esc(Utils.dayName(dayNum))}</strong><span>${d.getDate()} ${esc(Utils.MONTHS[d.getMonth()].slice(0, 3))}</span></div>
          ${UI.chip(`${p.done}/${p.total} selesai`, p.pct === 100 ? 'ok' : 'neutral')}
        </div>
        <div class="target-mini"><span>${ic('target', 15)} Target akademik</span><p>${esc(Store.targetForDay(dayNum))}</p></div>
        <div class="timeline">${rows}</div>
        <button class="btn btn-soft btn-block btn-sm" type="button" data-action="add-activity" data-day="${dayNum}">${ic('plus', 16)} Tambah aktivitas</button>
      </section>`;
    }).join('');

    return `
      <div class="stack">
        ${UI.pageHead('Rencana 7 hari', 'Jadwal Mingguan', `${Utils.formatDate(monday, { short: true })} – ${Utils.formatDate(sunday)}`, `
          <div class="week-nav">
            <button class="btn-icon" type="button" data-action="week-prev" aria-label="Minggu sebelumnya">${ic('chevronLeft', 20)}</button>
            <button class="btn btn-ghost btn-sm" type="button" data-action="week-today">Minggu ini</button>
            <button class="btn-icon" type="button" data-action="week-next" aria-label="Minggu berikutnya">${ic('chevronRight', 20)}</button>
          </div>`)}
        <div class="search-row ${activitySearch.open ? 'is-open' : ''}" data-search-row>
          <button class="btn-icon" type="button" data-action="toggle-search" aria-label="${activitySearch.open ? 'Tutup pencarian aktivitas' : 'Cari aktivitas'}" aria-expanded="${activitySearch.open}">${UI.searchIcon(activitySearch.open)}</button>
          <input type="search" data-action="activity-search" value="${esc(activitySearch.query)}" placeholder="Cari aktivitas di jadwal..." aria-label="Cari aktivitas">
        </div>
        <p class="hint search-empty" data-search-empty hidden>Tidak ada aktivitas yang cocok.</p>
        <div class="day-strip" role="group" aria-label="Pilih hari">${strip}</div>
        <div class="legend">
          <span>${UI.badge('completed')}</span><span>${UI.badge('ongoing')}</span><span>${UI.badge('upcoming')}</span><span>${UI.badge('missed')}</span>
        </div>
        <div class="week-grid">${columns}</div>
        <p class="hint">Status tersimpan per tanggal. Aktivitas yang lewat waktu tidak otomatis dianggap selesai. Ubah jadwal Subuh dan blok lainnya melalui Pengaturan atau langsung dari daftar aktivitas.</p>
      </div>`;
  }

  function activityRow(a, dateKeyStr) {
    const status = Store.activityStatus(a, Utils.fromKey(dateKeyStr) || new Date());
    return `<article class="activity-item status-${status}">
      <button class="check" type="button" data-action="toggle-activity" data-id="${esc(a.id)}" data-date="${dateKeyStr}" aria-label="Tandai selesai: ${esc(a.title)}" aria-pressed="${status === 'completed'}">${UI.checkIcon(status === 'completed')}</button>
      <div class="activity-info">
        <div class="activity-time">${esc(Utils.fmtTime(a.startTime))} – ${esc(Utils.fmtTime(a.endTime))}</div>
        <strong>${esc(a.title)}</strong>
        <div class="activity-meta">${UI.chip(a.category, categoryTone(a.category))} ${UI.badge(status)}</div>
      </div>
      <div class="activity-tools">
        <button class="btn-icon btn-icon-sm" type="button" data-action="edit-activity" data-id="${esc(a.id)}" aria-label="Edit ${esc(a.title)}" title="Edit">${ic('edit', 16)}</button>
        <button class="btn-icon btn-icon-sm danger" type="button" data-action="delete-activity" data-id="${esc(a.id)}" aria-label="Hapus ${esc(a.title)}" title="Hapus">${ic('trash', 16)}</button>
      </div>
    </article>`;
  }

  function categoryTone(c) {
    const map = { Kerja: 'blue', Skripsi: 'purple', Olahraga: 'green', Pribadi: 'neutral', Makan: 'amber', Membaca: 'teal', Ibadah: 'green' };
    return map[c] || 'neutral';
  }

  /* ANIMATED ICON 04 — Search morph jadi X, satu tombol untuk buka/tutup. */
  function filterActivities(query) {
    activitySearch.query = String(query || '');
    const q = activitySearch.query.trim().toLocaleLowerCase('id');
    let visible = 0;
    document.querySelectorAll('.activity-item').forEach((el) => {
      const match = !q || el.textContent.toLocaleLowerCase('id').includes(q);
      el.hidden = !match;
      if (match) visible++;
    });
    const empty = document.querySelector('[data-search-empty]');
    if (empty) empty.hidden = !q || visible > 0;
  }

  function afterRender() {
    if (currentPageIsJadwal()) {
      const row = document.querySelector('[data-search-row]');
      if (row) row.classList.toggle('is-open', activitySearch.open);
      filterActivities(activitySearch.query);
    }
  }

  function currentPageIsJadwal() {
    return (location.hash || '').replace(/^#\/?/, '').split('?')[0] === 'jadwal';
  }

  /* CONNECTEDNESS: empat langkah belanja disatukan oleh satu garis. */
  function shoppingStepper(items) {
    const mainItems = items.filter((i) => i.session === 'main');
    const refillItems = items.filter((i) => i.session === 'refill');
    const bought = (list) => list.length > 0 && list.every((i) => i.isPurchased);
    const mainRem = Store.reminderFor('main').status;
    const refillRem = Store.reminderFor('refill').status;
    const stateOf = (rem, list) => rem === 'done' || bought(list) ? 'done' : rem === 'pending' ? 'active' : 'next';
    const steps = [
      { label: 'Rencana', state: items.length ? 'done' : 'active' },
      { label: 'Belanja Minggu', state: stateOf(mainRem, mainItems) },
      { label: 'Belanja Rabu', state: stateOf(refillRem, refillItems) },
      { label: 'Selesai', state: items.length && bought(items) ? 'done' : (mainRem === 'done' && refillRem === 'done') ? 'active' : 'next' }
    ];
    let foundActive = false;
    steps.forEach((s) => {
      if (s.state === 'active') {
        if (foundActive) s.state = 'next'; else foundActive = true;
      }
    });
    return `<div class="stepper" role="list" aria-label="Progres belanja mingguan">
      ${steps.map((s) => `<div class="stepper-item is-${s.state}" role="listitem" aria-current="${s.state === 'active' ? 'step' : 'false'}">
        <span class="stepper-dot" aria-hidden="true">${s.state === 'done' ? ic('check', 11) : ''}</span>
        <span>${esc(s.label)}</span>
      </div>`).join('')}
    </div>`;
  }

  /* ============================ SKRIPSI ============================ */
  function skripsi() {
    const s = S();
    const stats = Store.taskStats();
    const seminar = s.settings.seminarDate;
    let daysLeft = 'Belum ditentukan';
    if (seminar) {
      const diff = Math.ceil((Utils.fromKey(seminar).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
      daysLeft = diff >= 0 ? `${diff} hari lagi` : `${Math.abs(diff)} hari lalu`;
    }
    const tasks = [...s.tasks].sort((a, b) => (a.order || 0) - (b.order || 0));
    const current = tasks.find((t) => t.status === 'in-progress');
    const history = tasks.filter((t) => t.status === 'completed' && t.completedAt).sort((a, b) => b.completedAt.localeCompare(a.completedAt));

    const rows = tasks.map((t, i) => `
      <article class="task-card ${t.status === 'completed' ? 'is-done' : ''}">
        <button class="check" type="button" data-action="toggle-task" data-id="${esc(t.id)}" aria-label="Selesaikan ${esc(t.title)}" aria-pressed="${t.status === 'completed'}">${UI.checkIcon(t.status === 'completed')}</button>
        <div class="task-card-main">
          <div class="task-card-title"><strong>${esc(t.title)}</strong>${priorityBadge(t.priority)}</div>
          ${t.description ? `<p>${esc(t.description)}</p>` : ''}
          <div class="task-card-meta">${statusBadge(t.status)}${t.dueDate ? `<span>${ic('clock', 14)} ${esc(Utils.formatDate(t.dueDate, { short: true }))}</span>` : ''}${t.notes ? `<span>${ic('info', 14)} Catatan tersimpan</span>` : ''}</div>
          ${t.notes ? `<div class="task-note">${esc(t.notes)}</div>` : ''}
        </div>
        <div class="task-card-tools">
          <button class="btn-icon btn-icon-sm" type="button" data-action="task-up" data-id="${esc(t.id)}" ${i === 0 ? 'disabled' : ''} aria-label="Naikkan urutan">${ic('chevronUp', 16)}</button>
          <button class="btn-icon btn-icon-sm" type="button" data-action="task-down" data-id="${esc(t.id)}" ${i === tasks.length - 1 ? 'disabled' : ''} aria-label="Turunkan urutan">${ic('chevronDown', 16)}</button>
          <button class="btn-icon btn-icon-sm" type="button" data-action="edit-task" data-id="${esc(t.id)}" aria-label="Edit tugas">${ic('edit', 16)}</button>
          <button class="btn-icon btn-icon-sm danger" type="button" data-action="delete-task" data-id="${esc(t.id)}" aria-label="Hapus tugas">${ic('trash', 16)}</button>
        </div>
      </article>`).join('');

    return `
      <div class="stack">
        ${UI.pageHead('Prioritas akademik', 'Skripsi', 'Pantau tahapan seminar proposal tanpa tanggal yang dikunci.', `<button class="btn btn-primary btn-sm" type="button" data-action="add-task">${ic('plus', 16)} Tugas baru</button>`)}

        <section class="card thesis-hero">
          <span class="eyebrow">Topik skripsi</span>
          <h3>${esc(s.settings.thesisTopic)}</h3>
          <div class="thesis-grid">
            <div><span>Tahap saat ini</span><strong>${esc(current ? current.title : 'Belum ada yang dikerjakan')}</strong></div>
            <div><span>Target seminar proposal</span><strong>${seminar ? esc(Utils.formatDate(seminar, { short: true })) : 'Belum ditentukan'}</strong></div>
            <div><span>Hitung mundur</span><strong>${esc(daysLeft)}</strong></div>
          </div>
          <div class="thesis-actions">
            <button class="btn btn-soft btn-sm" type="button" data-action="edit-seminar">${ic('calendar', 16)} Atur target seminar</button>
          </div>
          <div class="progress-row"><strong>${stats.done}</strong><span>/ ${stats.total} tugas selesai</span><b>${stats.pct}%</b></div>
          ${UI.bar(stats.pct, 'purple', 'Progres tugas skripsi')}
        </section>

        <section class="card">
          ${UI.section('Daftar tugas', 'Diurutkan berdasarkan prioritas pekerjaan')}
          <div class="task-cards">${rows || UI.empty('book', 'Belum ada tugas')}</div>
        </section>

        <section class="card">
          ${UI.section('Catatan bimbingan', 'Catat arahan dosen atau progres terbaru')}
          <textarea id="mentor-notes" rows="4" placeholder="Contoh: Revisi bab 3 sesuai masukan dosen pembimbing...">${esc(s.mentorshipNotes)}</textarea>
          <div class="card-foot"><button class="btn btn-soft btn-sm" type="button" data-action="save-mentor-notes">Simpan catatan</button></div>
        </section>

        <section class="card">
          ${UI.section('Riwayat penyelesaian', `${history.length} tugas selesai`)}
          ${history.length ? `<ul class="history-list">${history.map((t) => `<li><span class="history-dot">${ic('check', 13)}</span><div><strong>${esc(t.title)}</strong><small>${esc(Utils.relativeDay(t.completedAt.slice(0, 10)))}</small></div></li>`).join('')}</ul>` : UI.empty('history', 'Belum ada riwayat', 'Tugas yang selesai akan muncul di sini.')}
        </section>
      </div>`;
  }

  function priorityBadge(p) {
    const map = { high: ['Tinggi', 'danger'], medium: ['Sedang', 'warn'], low: ['Rendah', 'neutral'] };
    const [label, tone] = map[p] || map.low;
    return UI.chip('Prioritas ' + label, tone);
  }
  function statusBadge(p) {
    const map = { todo: ['Belum dimulai', 'idle'], 'in-progress': ['Sedang dikerjakan', 'run'], completed: ['Selesai', 'ok'], postponed: ['Tertunda', 'warn'] };
    const [label, tone] = map[p] || map.todo;
    return UI.chip(label, tone);
  }

  /* ========================= BUAH & STOK ========================= */
  function buah() {
    const s = S();
    const today = new Date();
    const key = Utils.dateKey(today);
    const servings = Store.servingsForDate(today);
    const target = Store.dailyTarget();
    const weekDates = Utils.weekDates(today);
    const weekStrip = weekDates.map((d) => {
      const n = Store.servingsForDate(d);
      const isToday = Utils.dateKey(d) === key;
      return `<div class="week-day ${isToday ? 'is-today' : ''}"><span>${esc(Utils.dayName(Utils.dow(d), true))}</span><div class="fruit-pips">${Array.from({ length: Math.max(target, n) }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div><strong>${n}/${target}</strong></div>`;
    }).join('');

    const d = Utils.dow(today);
    const plan = Seed.fruitSchedule[d] || [];
    const planRows = plan.map((p, i) => {
      const time = i === 0 ? s.settings.fruit1Time : s.settings.fruit2Time;
      return `<div class="plan-row"><span class="plan-time">${esc(Utils.fmtTime(time))}</span><div><strong>${esc(p.label)}</strong><small>${i === 0 ? 'Porsi pertama' : 'Porsi kedua'}</small></div><button class="btn btn-soft btn-sm" type="button" data-action="log-planned" data-fruit="${p.fruitId}" data-label="${esc(p.label)}">${ic('check', 15)} Sudah</button></div>`;
    }).join('');

    const inventory = s.inventory.slice().sort((a, b) => {
      const rank = { 'consume-soon': 0, available: 1, finished: 2 };
      return (rank[a.status] ?? 3) - (rank[b.status] ?? 3);
    });
    const invRows = inventory.map((i) => {
      const fruit = Store.fruitById(i.fruitId);
      const isSoon = i.status === 'consume-soon';
      const isDone = i.status === 'finished' || Number(i.quantityRemaining) <= 0;
      return `<article class="stock-card ${isDone ? 'is-empty' : ''}">
        <div class="stock-head">
          <span class="stock-emoji">${ic('fruit', 22)}</span>
          <div class="stock-title"><strong>${esc(i.name)}</strong><span>Dibeli ${esc(Utils.relativeDay(i.purchaseDate))} · ${esc(i.storageLocation)}</span></div>
          ${UI.chip(isDone ? 'Habis' : isSoon ? 'Segera dikonsumsi' : 'Tersedia', isDone ? 'neutral' : isSoon ? 'warn' : 'ok')}
        </div>
        <div class="stock-stats">
          <div><span>Sisa</span><strong>${esc(String(i.quantityRemaining))} ${esc(i.unit)}</strong></div>
          <div><span>Perkiraan porsi</span><strong>${esc(String(i.estimatedServings))}</strong></div>
          <div><span>Kondisi</span><strong>${esc(i.condition || '—')}</strong></div>
        </div>
        ${fruit ? `<details class="storage-details"><summary>Panduan penyimpanan</summary><p>${esc(fruit.storage)}</p></details>` : ''}
        <div class="stock-actions">
          <button class="btn btn-soft btn-sm" type="button" data-action="consume-stock" data-id="${esc(i.id)}" ${isDone ? 'disabled' : ''}>${ic('check', 15)} Kurangi stok</button>
          <button class="btn-icon btn-icon-sm" type="button" data-action="mark-spoiled" data-id="${esc(i.id)}" ${isDone ? 'disabled' : ''} aria-label="Tandai ${esc(i.name)} rusak atau terbuang" title="Tandai rusak/terbuang">${ic('alert', 16)}</button>
          <button class="btn-icon btn-icon-sm" type="button" data-action="edit-stock" data-id="${esc(i.id)}" aria-label="Edit stok">${ic('edit', 16)}</button>
          <button class="btn-icon btn-icon-sm danger" type="button" data-action="delete-stock" data-id="${esc(i.id)}" aria-label="Hapus stok">${ic('trash', 16)}</button>
        </div>
      </article>`;
    }).join('');

    const history = s.consumption.slice().sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 12);
    const historyRows = history.map((c) => `<li><span class="history-dot">${ic('check', 13)}</span><div><strong>${esc(c.name)} · ${esc(String(c.servingCount))} porsi</strong><small>${esc(Utils.relativeDay(c.date))}${c.inventoryId ? ' · stok berkurang' : ' · tanpa stok terkait'}</small></div><button class="btn-icon btn-icon-sm danger" type="button" data-action="delete-consumption" data-id="${esc(c.id)}" aria-label="Hapus catatan">${ic('trash', 15)}</button></li>`).join('');

    return `
      <div class="stack">
        ${UI.pageHead('Konsumsi & persediaan', 'Buah & Stok', 'Target 2 porsi buah per hari, 14 porsi per minggu.', `
          <button class="btn btn-soft btn-sm" type="button" data-action="open-stock">${ic('plus', 16)} Tambah stok</button>
          <button class="btn btn-primary btn-sm" type="button" data-action="open-consume">${ic('plus', 16)} Catat buah</button>`)}

        <section class="card">
          <div class="fruit-summary">
            ${UI.ring(Math.min(100, (servings / target) * 100), 'Hari ini', `${servings}/${target} porsi`)}
            <div class="fruit-summary-body">
              <h3>${servings >= target ? 'Target hari ini tercapai' : `Butuh ${target - servings} porsi lagi`}</h3>
              <p>Pencatatan konsumsi dapat mengurangi stok yang terkait otomatis.</p>
              <div class="week-strip">${weekStrip}</div>
            </div>
          </div>
        </section>

        <section class="card">
          ${UI.section('Jadwal konsumsi hari ini', 'Rencana buah dapat disesuaikan dengan stok')}
          <div class="plan-list">${planRows}</div>
        </section>

        <section class="card">
          ${UI.section('Stok buah', `${Store.activeInventory().length} jenis tersedia`)}
          <div class="stock-grid">${invRows || UI.empty('box', 'Belum ada stok', 'Tambahkan stok buah yang Anda miliki.')}</div>
          <p class="hint">Buah membantu memenuhi kebutuhan nutrisi untuk mendukung kesehatan kulit. Konsumsi buah tidak menjamin kulit menjadi cerah atau menghilangkan kusam secara langsung.</p>
        </section>

        <section class="card">
          ${UI.section('Riwayat konsumsi', 'Catatan terakhir')}
          ${history.length ? `<ul class="history-list">${historyRows}</ul>` : UI.empty('history', 'Belum ada konsumsi', 'Catatan buah harian akan muncul di sini.')}
        </section>
      </div>`;
  }

  /* =========================== BELANJA =========================== */
  function belanja() {
    const s = S();
    const budgetLocked = !!s.settings.budgetLocked;
    const items = Store.currentWeekShopping();
    const totals = Store.shoppingTotals(items);
    const sessions = [
      { key: 'main', title: 'Belanja utama', day: s.settings.shoppingDays.main, icon: 'cart', note: 'Pembelian Minggu' },
      { key: 'refill', title: 'Belanja ulang buah segar', day: s.settings.shoppingDays.refill, icon: 'sparkle', note: 'Pembelian Rabu' }
    ];

    const sessionCards = sessions.map((sess) => {
      const list = items.filter((i) => i.session === sess.key);
      const rem = Store.reminderFor(sess.key);
      const est = list.reduce((n, i) => n + (Number(i.quantity) || 0) * (Number(i.estimatedUnitPrice) || 0), 0);
      const rows = list.map((i) => {
        const subtotalEst = (Number(i.quantity) || 0) * (Number(i.estimatedUnitPrice) || 0);
        const subtotalAct = (Number(i.quantity) || 0) * (Number(i.actualUnitPrice) || 0);
        return `<div class="shop-row ${i.isPurchased ? 'is-bought' : ''}">
          <button class="check" type="button" data-action="toggle-shop" data-id="${esc(i.id)}" aria-label="Tandai dibeli: ${esc(i.name)}" aria-pressed="${i.isPurchased}">${UI.checkIcon(i.isPurchased)}</button>
          <div class="shop-main"><strong>${esc(i.name)}</strong><span>${esc(String(i.quantity))} ${esc(i.unit)}</span></div>
          <div class="shop-price"><small>Estimasi</small><strong>${esc(Utils.rupiah(subtotalEst))}</strong></div>
          <div class="shop-price"><small>Aktual</small><input class="mini-input" type="number" min="0" inputmode="numeric" value="${i.actualUnitPrice == null ? '' : esc(i.actualUnitPrice)}" placeholder="—" data-action="actual-price" data-id="${esc(i.id)}" aria-label="Harga aktual satuan ${esc(i.name)}"></div>
          <div class="shop-tools">
            <button class="btn-icon btn-icon-sm" type="button" data-action="shop-to-stock" data-id="${esc(i.id)}" aria-label="Tambah ${esc(i.name)} ke stok" title="Tambah ke stok">${ic('box', 16)}</button>
            <button class="btn-icon btn-icon-sm" type="button" data-action="edit-shop" data-id="${esc(i.id)}" aria-label="Edit item">${ic('edit', 16)}</button>
            <button class="btn-icon btn-icon-sm danger" type="button" data-action="delete-shop" data-id="${esc(i.id)}" aria-label="Hapus item">${ic('trash', 16)}</button>
          </div>
          ${subtotalAct ? `<span class="shop-subtotal">Aktual ${esc(Utils.rupiah(subtotalAct))}</span>` : ''}
        </div>`;
      }).join('');
      return `<section class="card">
        ${UI.section(sess.title, `${sess.note} · ${esc(Utils.dayName(sess.day))}`, `<button class="btn btn-soft btn-sm" type="button" data-action="add-shop" data-session="${sess.key}">${ic('plus', 16)} Item</button>`)}
        <div class="session-meta">
          ${UI.chip(rem.status === 'done' ? 'Pengingat selesai' : rem.status === 'postponed' ? 'Ditunda' : 'Belum belanja', rem.status === 'done' ? 'ok' : rem.status === 'postponed' ? 'warn' : 'primary')}
          <span>Estimasi ${esc(Utils.rupiah(est))}</span>
          ${rem.status === 'pending'
            ? `<button class="link-btn" type="button" data-action="reminder-done" data-session="${sess.key}">Tandai selesai</button>
               <button class="link-btn" type="button" data-action="reminder-postpone" data-session="${sess.key}">Tunda</button>`
            : `<button class="link-btn" type="button" data-action="reminder-reset" data-session="${sess.key}">Ulangi pengingat</button>`}
        </div>
        <div class="shop-list">${rows || UI.empty('cart', 'Belum ada item', 'Tambahkan buah yang ingin dibeli.')}</div>
      </section>`;
    }).join('');

    const history = s.shopping.filter((i) => i.isPurchased && i.shoppingDate).sort((a, b) => b.shoppingDate.localeCompare(a.shoppingDate)).slice(0, 10);

    return `
      <div class="stack">
        ${UI.pageHead('Anggaran Rp50.000', 'Belanja', 'Rencanakan pembelian buah mingguan dan catat harga sebenarnya.', `
          <button class="btn-icon" type="button" data-action="toggle-budget-lock" aria-label="${budgetLocked ? 'Buka kunci anggaran' : 'Kunci anggaran'}" title="${budgetLocked ? 'Buka kunci anggaran' : 'Kunci anggaran'}">${UI.lockIcon(budgetLocked)}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-action="edit-budget">${ic('settings', 16)} Atur anggaran</button>`)}
        ${shoppingStepper(items)}

        <section class="card budget-card ${totals.over ? 'is-over' : ''}">
          <div class="budget-hero">
            <div><span class="eyebrow">Sisa anggaran</span><strong class="${totals.remaining < 0 ? 'text-danger' : ''}">${esc(Utils.rupiah(totals.remaining))}</strong></div>
            <div class="budget-total">dari ${esc(Utils.rupiah(totals.budget))}</div>
          </div>
          ${UI.bar(totals.budget ? (totals.actual / totals.budget) * 100 : 0, totals.actual > totals.budget ? 'danger' : 'primary', 'Penggunaan anggaran buah')}
          <div class="budget-stats">
            <div><span>Estimasi</span><strong>${esc(Utils.rupiah(totals.estimated))}</strong></div>
            <div><span>Aktual terpakai</span><strong>${esc(Utils.rupiah(totals.actual))}</strong></div>
            <div><span>Sudah dibeli</span><strong>${items.filter((i) => i.isPurchased).length}/${items.length} item</strong></div>
          </div>
          ${totals.over ? `<div class="alert alert-warn">${ic('alert', 18)} <span>Pengeluaran atau estimasi melebihi anggaran. Pertimbangkan menyesuaikan daftar sebelum membeli.</span></div>` : ''}
        </section>

        ${sessionCards}

        <section class="card">
          ${UI.section('Riwayat belanja', 'Item yang sudah dibeli')}
          ${history.length ? `<ul class="history-list">${history.map((i) => `<li><span class="history-dot">${ic('cart', 13)}</span><div><strong>${esc(i.name)} · ${esc(String(i.quantity))} ${esc(i.unit)}</strong><small>${esc(Utils.relativeDay(i.shoppingDate))} · ${esc(Utils.rupiah((Number(i.quantity) || 0) * (Number(i.actualUnitPrice) || 0)))}</small></div></li>`).join('')}</ul>` : UI.empty('history', 'Belum ada riwayat', 'Tandai item sebagai dibeli untuk mencatat pengeluaran.')}
        </section>
      </div>`;
  }

  /* ========================= PENGATURAN ========================= */
  function pengaturan() {
    const s = S();
    const n = s.settings.notifications;
    const f = (label, name, opts) => UI.field(label, name, opts);
    const profile = UI.formGrid([
      f('Nama panggilan', 'name', { value: s.settings.name, placeholder: 'Nama Anda' }),
      f('Tema', 'theme', { type: 'select', value: s.settings.theme, options: [{ value: 'light', label: 'Terang' }, { value: 'dark', label: 'Gelap' }] }),
      f('Zona waktu', 'timezone', { value: s.settings.timezone, help: 'Disimpan sebagai preferensi (WIB default).' }),
      f('Anggaran buah per minggu (Rp)', 'weeklyBudget', { type: 'number', min: 0, step: 1000, value: s.settings.weeklyBudget, required: true }),
      f('Target porsi buah per hari', 'dailyFruitTarget', { type: 'number', min: 1, max: 10, value: s.settings.dailyFruitTarget, required: true }),
      f('Kunci anggaran', 'budgetLocked', { type: 'checkbox', checked: !!s.settings.budgetLocked, help: 'Mencegah perubahan anggaran tidak sengaja dari halaman Belanja.' }),
      f('Target seminar proposal', 'seminarDate', { type: 'date', value: s.settings.seminarDate, help: 'Kosongkan jika belum ditentukan.' }),
      f('Waktu tidur target', 'bedtime', { type: 'time', value: Utils.fmtTimeColon(s.settings.bedtime) }),
      f('Jam buah porsi pertama', 'fruit1Time', { type: 'time', value: Utils.fmtTimeColon(s.settings.fruit1Time) }),
      f('Jam buah porsi kedua', 'fruit2Time', { type: 'time', value: Utils.fmtTimeColon(s.settings.fruit2Time) }),
      f('Judul/topik skripsi', 'thesisTopic', { type: 'textarea', value: s.settings.thesisTopic, full: true, rows: 2 })
    ]);

    const schedule = UI.formGrid([
      f('Jam bangun', 'wakeUpTime', { type: 'time', value: Utils.fmtTimeColon(s.settings.wakeUpTime) }),
      f('Waktu Subuh / blok ibadah', 'subuhTime', { type: 'time', value: Utils.fmtTimeColon(s.settings.subuhTime), help: 'Menyesuaikan waktu salat setempat.' }),
      f('Durasi jalan pagi (menit)', 'walkMinutes', { type: 'number', min: 5, value: s.settings.walkMinutes }),
      f('Durasi home workout (menit)', 'workoutMinutes', { type: 'number', min: 5, value: s.settings.workoutMinutes }),
      f('Mulai persiapan kerja', 'workStartTime', { type: 'time', value: Utils.fmtTimeColon(s.settings.workStartTime) }),
      f('Durasi perjalanan (menit)', 'commuteMinutes', { type: 'number', min: 0, value: s.settings.commuteMinutes }),
      f('Selesai kerja', 'workEndTime', { type: 'time', value: Utils.fmtTimeColon(s.settings.workEndTime) }),
      f('Selesai lembur Jumat', 'overtimeEndTime', { type: 'time', value: Utils.fmtTimeColon(s.settings.overtimeEndTime) })
    ]);

    const dayOpts = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: Utils.dayName(d) }));
    const shopping = UI.formGrid([
      f('Hari belanja utama', 'shoppingDayMain', { type: 'select', value: s.settings.shoppingDays.main, options: dayOpts }),
      f('Hari belanja ulang', 'shoppingDayRefill', { type: 'select', value: s.settings.shoppingDays.refill, options: dayOpts }),
      f('Jam pengingat belanja utama', 'shoppingTimeMain', { type: 'time', value: Utils.fmtTimeColon(n.shoppingTimeMain) }),
      f('Jam pengingat belanja ulang', 'shoppingTimeRefill', { type: 'time', value: Utils.fmtTimeColon(n.shoppingTimeRefill) })
    ]);

    const notif = UI.formGrid([
      f('Aktifkan pengingat', 'notifEnabled', { type: 'checkbox', checked: n.enabled, help: 'Notifikasi dalam aplikasi tetap tampil walau izin browser belum diberikan.' }),
      f('Pengingat aktivitas', 'notifActivity', { type: 'checkbox', checked: n.activity }),
      f('Pengingat konsumsi buah', 'notifFruit', { type: 'checkbox', checked: n.fruit }),
      f('Pengingat belanja Minggu & Rabu', 'notifShopping', { type: 'checkbox', checked: n.shopping }),
      f('Peringatan stok perlu dikonsumsi', 'notifLowStock', { type: 'checkbox', checked: n.lowStock }),
      f('Pengingat persiapan tidur', 'notifBedtime', { type: 'checkbox', checked: n.bedtime }),
      f('Waktu sebelum aktivitas (menit)', 'activityLeadMinutes', { type: 'number', min: 0, max: 60, value: n.activityLeadMinutes })
    ]);

    return `
      <div class="stack">
        ${UI.pageHead('Preferensi aplikasi', 'Pengaturan', 'Semua perubahan tersimpan otomatis di perangkat ini.', `<button class="btn btn-primary btn-sm" type="button" data-action="save-settings-form">Simpan pengaturan</button>`)}
        <form id="settings-form">
          <section class="card">
            ${UI.section('Profil & target', 'Identitas, target harian, dan anggaran')}
            ${profile}
          </section>

          <section class="card">
            ${UI.section('Template jadwal', 'Nilai awal untuk rutinitas harian dan kerja')}
            ${schedule}
            <div class="card-foot"><button class="btn btn-soft btn-sm" type="button" data-action="apply-template">Terapkan ke jadwal mingguan</button></div>
            <p class="hint">Menerapkan template akan memperbarui waktu aktivitas bawaan. Aktivitas yang ditambahkan sendiri dan riwayat checklist tetap disimpan.</p>
          </section>

          <section class="card">
            ${UI.section('Jadwal belanja', 'Hari dan jam pengingat')}
            ${shopping}
          </section>

          <section class="card">
            ${UI.section('Notifikasi', 'Pilih pengingat yang ingin diaktifkan')}
            ${notif}
            <div class="card-foot notif-foot">
              <button class="btn btn-soft btn-sm" type="button" data-action="request-notif">${ic('bell', 16)} Aktifkan notifikasi browser</button>
              <span id="notif-status" class="hint"></span>
              <p class="hint">Jika izin ditolak, buka ikon gembok di bilah alamat browser → izinkan Notifikasi, lalu muat ulang halaman. Pengingat belanja dan jadwal tetap tampil di dashboard tanpa izin tersebut.</p>
            </div>
          </section>
        </form>

        <section class="card">
          ${UI.section('Data & cadangan', 'Ekspor, impor, atau kembalikan ke data awal')}
          <div class="data-actions">
            <button class="btn btn-soft btn-sm" type="button" data-action="export-data">${UI.downloadIcon()} Ekspor JSON</button>
            <button class="btn btn-soft btn-sm" type="button" data-action="export-md">${UI.downloadIcon()} Ekspor ringkasan MD</button>
            <button class="btn btn-soft btn-sm" type="button" data-action="import-trigger">${ic('download', 16)} Impor JSON</button>
            <button class="btn btn-danger-ghost btn-sm" type="button" data-action="reset-data">${ic('trash', 16)} Kembalikan data awal</button>
          </div>
          <input type="file" id="import-file" accept="application/json,.json" hidden>
          <p class="hint">Data disimpan pada localStorage browser perangkat ini. Ekspor berkala disarankan sebagai cadangan.</p>
        </section>
      </div>`;
  }

  /* ====================== MODAL / FORM AKSI ====================== */
  const field = UI.field;
  const grid = UI.formGrid;

  /* PARKINSON: saran & nilai awal dari data yang sudah ada. */
  function frequentTitles(limit = 6) {
    const counts = new Map();
    S().activities.forEach((a) => counts.set(a.title, (counts.get(a.title) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([t]) => t);
  }

  function bindFruitAutofill(dialog, kind) {
    const fruitSelect = dialog.querySelector('#f-fruitId');
    if (!fruitSelect) return;
    const apply = () => {
      const fruit = Store.fruitById(fruitSelect.value);
      if (!fruit) return;
      const set = (name, value) => {
        const el = dialog.querySelector(`#f-${name}`);
        if (el && value !== undefined && value !== null && value !== '') el.value = value;
      };
      const servingText = fruit.defaultServing || '';
      const amount = parseInt(servingText, 10) || 1;
      const unit = servingText.replace(/^\d+\s*/, '').trim();
      if (kind === 'consume') {
        set('label', servingText);
        const stock = Store.activeInventory().find((i) => i.fruitId === fruit.id);
        if (stock) set('inventoryId', stock.id);
      } else if (kind === 'stock') {
        set('name', fruit.name);
        set('unit', unit || 'gram');
        set('estimatedServings', 3);
        set('quantityPurchased', /gram/i.test(unit) ? Math.max(500, amount * 3) : 1);
        set('quantityRemaining', /gram/i.test(unit) ? Math.max(500, amount * 3) : 1);
        set('storageLocation', /suhu ruang|matang/i.test(fruit.storage) ? 'Suhu ruang' : 'Kulkas');
      } else if (kind === 'shop') {
        const tpl = Seed.shoppingTemplate.find((i) => i.fruitId === fruit.id);
        set('name', tpl ? tpl.name : fruit.name);
        set('quantity', tpl ? tpl.quantity : 1);
        set('unit', tpl ? tpl.unit : (unit || 'buah'));
        set('estimatedUnitPrice', tpl ? tpl.estimatedUnitPrice : 10000);
        set('session', tpl ? tpl.session : 'main');
      }
    };
    fruitSelect.addEventListener('change', apply);
    apply();
  }

  function openActivityModal(activity, day) {
    const a = activity || {};
    const isEdit = !!a.id;
    UI.openModal({
      title: isEdit ? 'Edit aktivitas' : 'Tambah aktivitas',
      body: grid([
        field('Nama aktivitas', 'title', { value: a.title || '', required: true, full: true, placeholder: 'Contoh: Mengerjakan skripsi', suggestions: frequentTitles(), help: 'Pilih dari aktivitas yang sering dipakai atau ketik yang baru.' }),
        field('Kategori', 'category', { type: 'select', value: a.category || 'Pribadi', options: CATEGORIES }),
        field('Hari', 'dayOfWeek', { type: 'select', value: a.dayOfWeek || day || Utils.dow(new Date()), options: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: Utils.dayName(d) })) }),
        field('Mulai', 'startTime', { type: 'time', value: Utils.fmtTimeColon(a.startTime || '07.00'), required: true }),
        field('Selesai', 'endTime', { type: 'time', value: Utils.fmtTimeColon(a.endTime || '08.00'), required: true }),
        field('Berulang tiap minggu', 'isRecurring', { type: 'checkbox', checked: a.isRecurring !== false }),
        field('Catatan', 'notes', { type: 'textarea', value: a.notes || '', full: true, rows: 2 })
      ]),
      onSubmit(form, data) {
        const payload = {
          id: a.id || Utils.uid('act'),
          title: String(data.get('title') || '').trim(),
          category: data.get('category'),
          dayOfWeek: Number(data.get('dayOfWeek')),
          startTime: data.get('startTime'),
          endTime: data.get('endTime'),
          isRecurring: data.get('isRecurring') === 'on',
          notes: String(data.get('notes') || '').trim(),
          isTemplate: a.isTemplate || false
        };
        if (!payload.title) { UI.toast('Nama aktivitas wajib diisi.', 'error'); return false; }
        if (Utils.parseTime(payload.endTime) <= Utils.parseTime(payload.startTime)) { UI.toast('Waktu selesai harus setelah waktu mulai.', 'error'); return false; }
        Store.update((s) => {
          const idx = s.activities.findIndex((x) => x.id === payload.id);
          if (idx >= 0) s.activities[idx] = payload; else s.activities.push(payload);
        });
        UI.toast(isEdit ? 'Aktivitas diperbarui.' : 'Aktivitas ditambahkan.');
      }
    });
  }

  function openConsumeModal(preset = {}) {
    const catalog = S().fruitCatalog;
    const inv = Store.activeInventory();
    UI.openModal({
      title: 'Catat konsumsi buah',
      body: grid([
        field('Jenis buah', 'fruitId', { type: 'select', value: preset.fruitId || (Store.activeInventory()[0] && Store.activeInventory()[0].fruitId) || catalog[0].id, options: catalog.map((f) => ({ value: f.id, label: f.name })) }),
        field('Jumlah porsi', 'servingCount', { type: 'number', min: 0.5, max: 10, step: 0.5, value: preset.servingCount || 1, required: true }),
        field('Keterangan porsi', 'label', { value: preset.label || '', full: true, placeholder: 'Contoh: Jambu biji 150 g' }),
        field('Ambil dari stok', 'inventoryId', { type: 'select', value: preset.inventoryId || '', options: [{ value: '', label: 'Tidak hubungkan dengan stok' }].concat(inv.map((i) => ({ value: i.id, label: `${i.name} — sisa ${i.quantityRemaining} ${i.unit}` }))), full: true }),
        field('Tanggal', 'date', { type: 'date', value: Utils.dateKey(new Date()), required: true }),
        field('Catatan', 'notes', { type: 'textarea', value: '', rows: 2 })
      ]),
      onOpen(d) { if (!preset.fruitId && !preset.inventoryId) bindFruitAutofill(d, 'consume'); },
      onSubmit(form, data) {
        const fruit = Store.fruitById(data.get('fruitId'));
        const serving = Number(data.get('servingCount')) || 0;
        if (serving <= 0) { UI.toast('Jumlah porsi harus lebih dari 0.', 'error'); return false; }
        const invId = data.get('inventoryId');
        let linked = false;
        Store.update((s) => {
          s.consumption.push({
            id: Utils.uid('cons'), fruitId: fruit.id, name: fruit.name,
            date: data.get('date'), label: data.get('label') || fruit.name,
            servingCount: serving, inventoryId: invId || '',
            notes: String(data.get('notes') || '').trim(), createdAt: new Date().toISOString()
          });
          if (invId) {
            const stock = s.inventory.find((i) => i.id === invId);
            if (stock && Number(stock.quantityRemaining) > 0) {
              stock.quantityRemaining = Math.max(0, Number(stock.quantityRemaining) - 1);
              if (stock.quantityRemaining === 0) stock.status = 'finished';
              linked = true;
            }
          }
        });
        UI.toast(linked ? `Konsumsi tercatat, stok ${fruit.name} berkurang.` : 'Konsumsi tercatat tanpa perubahan stok.', linked ? 'success' : 'info');
      }
    });
  }

  function openStockModal(item) {
    const st = item || {};
    const isEdit = !!st.id;
    UI.openModal({
      title: isEdit ? 'Edit stok buah' : 'Tambah stok buah',
      body: grid([
        field('Jenis buah', 'fruitId', { type: 'select', value: st.fruitId || Seed.fruitCatalog[0].id, options: S().fruitCatalog.map((f) => ({ value: f.id, label: f.name })) }),
        field('Nama tampilan', 'name', { value: st.name || '', placeholder: 'Contoh: Jambu biji', required: true }),
        field('Jumlah dibeli', 'quantityPurchased', { type: 'number', min: 0, step: 'any', value: st.quantityPurchased ?? 500, required: true }),
        field('Sisa stok', 'quantityRemaining', { type: 'number', min: 0, step: 'any', value: st.quantityRemaining ?? 500, required: true }),
        field('Satuan', 'unit', { value: st.unit || 'gram', placeholder: 'gram / buah / porsi', required: true }),
        field('Perkiraan porsi', 'estimatedServings', { type: 'number', min: 0, step: 0.5, value: st.estimatedServings ?? 3 }),
        field('Tanggal pembelian', 'purchaseDate', { type: 'date', value: st.purchaseDate || Utils.dateKey(new Date()) }),
        field('Lokasi penyimpanan', 'storageLocation', { type: 'select', value: st.storageLocation || 'Kulkas', options: ['Kulkas', 'Suhu ruang'] }),
        field('Kondisi / kematangan', 'condition', { value: st.condition || '', placeholder: 'Contoh: Agak keras' }),
        field('Status stok', 'status', { type: 'select', value: st.status || 'available', options: [{ value: 'available', label: 'Tersedia' }, { value: 'consume-soon', label: 'Perlu segera dikonsumsi' }, { value: 'finished', label: 'Habis' }] })
      ]),
      onOpen(d) { if (!isEdit) bindFruitAutofill(d, 'stock'); },
      onSubmit(form, data) {
        const fruit = Store.fruitById(data.get('fruitId'));
        const remaining = Number(data.get('quantityRemaining')) || 0;
        const payload = {
          id: st.id || Utils.uid('inv'), fruitId: fruit.id, name: String(data.get('name') || fruit.name).trim(),
          quantityPurchased: Number(data.get('quantityPurchased')) || 0, quantityRemaining: remaining,
          unit: String(data.get('unit') || 'buah').trim(), estimatedServings: Number(data.get('estimatedServings')) || 0,
          purchaseDate: data.get('purchaseDate'), storageLocation: data.get('storageLocation'),
          condition: String(data.get('condition') || '').trim(), status: remaining <= 0 ? 'finished' : data.get('status')
        };
        Store.update((s) => {
          const idx = s.inventory.findIndex((i) => i.id === payload.id);
          if (idx >= 0) s.inventory[idx] = payload; else s.inventory.push(payload);
        });
        UI.toast(isEdit ? 'Stok diperbarui.' : 'Stok ditambahkan.');
      }
    });
  }

  function openShopModal(item, session) {
    const it = item || {};
    const isEdit = !!it.id;
    UI.openModal({
      title: isEdit ? 'Edit item belanja' : 'Tambah item belanja',
      body: grid([
        field('Jenis buah', 'fruitId', { type: 'select', value: it.fruitId || Seed.fruitCatalog[0].id, options: S().fruitCatalog.map((f) => ({ value: f.id, label: f.name })) }),
        field('Nama item', 'name', { value: it.name || '', required: true }),
        field('Sesi belanja', 'session', { type: 'select', value: it.session || session || 'main', options: [{ value: 'main', label: 'Belanja utama (Minggu)' }, { value: 'refill', label: 'Belanja ulang (Rabu)' }] }),
        field('Kuantitas', 'quantity', { type: 'number', min: 1, value: it.quantity ?? 1, required: true }),
        field('Satuan / ukuran', 'unit', { value: it.unit || 'buah', placeholder: 'Contoh: 500 gram', required: true }),
        field('Harga estimasi per satuan (Rp)', 'estimatedUnitPrice', { type: 'number', min: 0, value: it.estimatedUnitPrice ?? 0, required: true }),
        field('Harga aktual per satuan (Rp)', 'actualUnitPrice', { type: 'number', min: 0, value: it.actualUnitPrice ?? '', help: 'Isi saat sudah membeli; kosongkan jika belum.' }),
        field('Tanggal belanja', 'shoppingDate', { type: 'date', value: it.shoppingDate || '' }),
        field('Catatan tempat belanja', 'storeNotes', { type: 'textarea', value: it.storeNotes || '', full: true, rows: 2 })
      ]),
      onOpen(d) { if (!isEdit) bindFruitAutofill(d, 'shop'); },
      onSubmit(form, data) {
        const fruit = Store.fruitById(data.get('fruitId'));
        const actualRaw = data.get('actualUnitPrice');
        const actual = actualRaw === '' ? null : Number(actualRaw);
        const payload = {
          id: it.id || Utils.uid('shop'), fruitId: fruit.id, name: String(data.get('name') || fruit.name).trim(),
          session: data.get('session'), quantity: Number(data.get('quantity')) || 1, unit: String(data.get('unit') || 'buah').trim(),
          estimatedUnitPrice: Number(data.get('estimatedUnitPrice')) || 0, actualUnitPrice: actual,
          isPurchased: it.isPurchased || false, shoppingDate: data.get('shoppingDate') || '',
          storeNotes: String(data.get('storeNotes') || '').trim(), weekKey: it.weekKey || Utils.weekKey(new Date())
        };
        Store.update((s) => {
          const idx = s.shopping.findIndex((x) => x.id === payload.id);
          if (idx >= 0) s.shopping[idx] = payload; else s.shopping.push(payload);
        });
        UI.toast(isEdit ? 'Item belanja diperbarui.' : 'Item belanja ditambahkan.');
      }
    });
  }

  function openTaskModal(task) {
    const t = task || {};
    const isEdit = !!t.id;
    UI.openModal({
      title: isEdit ? 'Edit tugas skripsi' : 'Tambah tugas skripsi',
      body: grid([
        field('Nama tugas', 'title', { value: t.title || '', required: true, full: true }),
        field('Deskripsi', 'description', { type: 'textarea', value: t.description || '', full: true, rows: 2 }),
        field('Prioritas', 'priority', { type: 'select', value: t.priority || 'medium', options: [{ value: 'high', label: 'Tinggi' }, { value: 'medium', label: 'Sedang' }, { value: 'low', label: 'Rendah' }] }),
        field('Status', 'status', { type: 'select', value: t.status || 'todo', options: [{ value: 'todo', label: 'Belum dimulai' }, { value: 'in-progress', label: 'Sedang dikerjakan' }, { value: 'completed', label: 'Selesai' }, { value: 'postponed', label: 'Tertunda' }] }),
        field('Target tanggal selesai', 'dueDate', { type: 'date', value: t.dueDate || '' }),
        field('Catatan progres', 'notes', { type: 'textarea', value: t.notes || '', full: true, rows: 2 })
      ]),
      onSubmit(form, data) {
        const payload = {
          id: t.id || Utils.uid('task'), title: String(data.get('title') || '').trim(),
          description: String(data.get('description') || '').trim(), priority: data.get('priority'),
          status: data.get('status'), dueDate: data.get('dueDate') || '',
          notes: String(data.get('notes') || '').trim(), order: t.order || (S().tasks.length + 1),
          completedAt: t.completedAt || ''
        };
        if (!payload.title) { UI.toast('Nama tugas wajib diisi.', 'error'); return false; }
        Store.update((s) => {
          const idx = s.tasks.findIndex((x) => x.id === payload.id);
          if (idx >= 0) s.tasks[idx] = payload; else s.tasks.push(payload);
        });
        UI.toast(isEdit ? 'Tugas diperbarui.' : 'Tugas ditambahkan.');
      }
    });
  }

  function openSeminarModal() {
    UI.openModal({
      title: 'Target seminar proposal',
      body: grid([
        field('Tanggal target', 'seminarDate', { type: 'date', value: S().settings.seminarDate, full: true, help: 'Kosongkan jika tanggal belum ditentukan.' })
      ]),
      submitLabel: 'Simpan target',
      onSubmit(form, data) {
        Store.update((s) => { s.settings.seminarDate = data.get('seminarDate') || ''; });
        UI.toast('Target seminar disimpan.');
      }
    });
  }

  function openBudgetModal() {
    UI.openModal({
      title: 'Anggaran buah mingguan',
      body: grid([
        field('Anggaran maksimal (Rp)', 'weeklyBudget', { type: 'number', min: 0, step: 1000, value: S().settings.weeklyBudget, required: true, full: true })
      ]),
      onSubmit(form, data) {
        Store.update((s) => { s.settings.weeklyBudget = Number(data.get('weeklyBudget')) || 0; });
        UI.toast('Anggaran diperbarui.');
      }
    });
  }

  /* ============================ ACTIONS ============================ */
  const Actions = {
    'toggle-activity'(el) {
      const id = el.dataset.id, date = el.dataset.date;
      const rec = S().completion[date] || {};
      Store.setActivityStatus(id, date, rec[id] === 'completed' ? '' : 'completed');
    },
    'add-activity'(el) { openActivityModal(null, Number(el.dataset.day)); },
    'edit-activity'(el) { openActivityModal(S().activities.find((a) => a.id === el.dataset.id)); },
    async 'delete-activity'(el) {
      const a = S().activities.find((x) => x.id === el.dataset.id);
      if (!a || !(await UI.confirm('Hapus aktivitas?', `“${a.title}” akan dihapus dari template jadwal. Riwayat checklist yang sudah tercatat tetap disimpan.`, 'Hapus'))) return;
      Store.update((s) => { s.activities = s.activities.filter((x) => x.id !== a.id); });
      UI.toast('Aktivitas dihapus.');
    },
    'week-prev'() { viewDate = Utils.addDays(viewDate, -7); document.dispatchEvent(new CustomEvent('app:force-render')); },
    'week-next'() { viewDate = Utils.addDays(viewDate, 7); document.dispatchEvent(new CustomEvent('app:force-render')); },
    'week-today'() { viewDate = new Date(); document.dispatchEvent(new CustomEvent('app:force-render')); },
    'select-day'(el) { viewDate = Utils.fromKey(el.dataset.date) || new Date(); document.dispatchEvent(new CustomEvent('app:force-render')); },
    'toggle-search'() {
      activitySearch.open = !activitySearch.open;
      if (!activitySearch.open) activitySearch.query = '';
      document.dispatchEvent(new CustomEvent('app:force-render'));
      if (activitySearch.open) {
        const input = document.querySelector('[data-action="activity-search"]');
        if (input) input.focus();
      }
    },

    'add-task'() { openTaskModal(); },
    'edit-task'(el) { openTaskModal(S().tasks.find((t) => t.id === el.dataset.id)); },
    'toggle-task'(el) {
      const id = el.dataset.id;
      Store.update((s) => {
        const t = s.tasks.find((x) => x.id === id);
        if (!t) return;
        const done = t.status === 'completed';
        t.status = done ? 'todo' : 'completed';
        t.completedAt = done ? '' : new Date().toISOString();
      });
      UI.toast('Status tugas diperbarui.');
    },
    async 'delete-task'(el) {
      const t = S().tasks.find((x) => x.id === el.dataset.id);
      if (!t || !(await UI.confirm('Hapus tugas?', `“${t.title}” akan dihapus dari daftar tugas skripsi.`, 'Hapus'))) return;
      Store.update((s) => { s.tasks = s.tasks.filter((x) => x.id !== t.id); });
      UI.toast('Tugas dihapus.');
    },
    'task-up'(el) { moveTask(el.dataset.id, -1); },
    'task-down'(el) { moveTask(el.dataset.id, 1); },
    'save-mentor-notes'() {
      const v = document.getElementById('mentor-notes').value;
      Store.update((s) => { s.mentorshipNotes = v; });
      UI.toast('Catatan bimbingan disimpan.');
    },
    'edit-seminar'() { openSeminarModal(); },

    'open-consume'() { openConsumeModal(); },
    'log-planned'(el) {
      openConsumeModal({ fruitId: el.dataset.fruit, label: el.dataset.label, servingCount: 1 });
    },
    'open-stock'() { openStockModal(); },
    'edit-stock'(el) { openStockModal(S().inventory.find((i) => i.id === el.dataset.id)); },
    'consume-stock'(el) {
      const item = S().inventory.find((i) => i.id === el.dataset.id);
      if (!item) return;
      Store.update((s) => {
        const st = s.inventory.find((i) => i.id === item.id);
        st.quantityRemaining = Math.max(0, Number(st.quantityRemaining) - 1);
        if (st.quantityRemaining === 0) st.status = 'finished';
      });
      UI.toast(`Stok ${item.name} dikurangi 1 ${item.unit}.`);
    },
    async 'mark-spoiled'(el) {
      const item = S().inventory.find((i) => i.id === el.dataset.id);
      if (!item || !(await UI.confirm('Tandai buah rusak/terbuang?', `${item.name} akan ditandai habis dan tidak lagi dihitung dalam stok tersedia.`, 'Tandai'))) return;
      Store.update((s) => {
        const st = s.inventory.find((i) => i.id === item.id);
        st.quantityRemaining = 0;
        st.status = 'finished';
        st.condition = 'Rusak / terbuang';
      });
      UI.toast(`${item.name} ditandai rusak/terbuang.`, 'info');
    },
    async 'delete-stock'(el) {
      const item = S().inventory.find((i) => i.id === el.dataset.id);
      if (!item || !(await UI.confirm('Hapus stok?', `${item.name} akan dihapus dari daftar stok.`, 'Hapus'))) return;
      Store.update((s) => { s.inventory = s.inventory.filter((i) => i.id !== item.id); });
      UI.toast('Stok dihapus.');
    },
    async 'delete-consumption'(el) {
      if (!(await UI.confirm('Hapus catatan konsumsi?', 'Catatan ini akan dihapus dari riwayat. Stok tidak dikembalikan otomatis.', 'Hapus'))) return;
      Store.update((s) => { s.consumption = s.consumption.filter((c) => c.id !== el.dataset.id); });
      UI.toast('Catatan konsumsi dihapus.');
    },

    'add-shop'(el) { openShopModal(null, el.dataset.session); },
    'edit-shop'(el) { openShopModal(S().shopping.find((i) => i.id === el.dataset.id)); },
    'shop-to-stock'(el) {
      const item = S().shopping.find((i) => i.id === el.dataset.id);
      if (!item) return;
      const fruit = Store.fruitById(item.fruitId);
      openStockModal({
        fruitId: item.fruitId, name: item.name,
        quantityPurchased: item.quantity, quantityRemaining: item.quantity,
        unit: item.unit, estimatedServings: Math.max(1, item.quantity),
        purchaseDate: item.shoppingDate || Utils.dateKey(new Date()),
        storageLocation: 'Kulkas', condition: 'Baru dibeli', status: 'available'
      });
      if (fruit) UI.toast(`Periksa perkiraan porsi ${fruit.name} sebelum menyimpan stok.`, 'info');
    },
    'toggle-shop'(el) {
      const id = el.dataset.id;
      Store.update((s) => {
        const item = s.shopping.find((i) => i.id === id);
        if (!item) return;
        item.isPurchased = !item.isPurchased;
        item.shoppingDate = item.isPurchased ? Utils.dateKey(new Date()) : '';
        if (item.isPurchased && item.actualUnitPrice == null) item.actualUnitPrice = item.estimatedUnitPrice;
      });
      UI.toast('Status pembelian diperbarui.');
    },
    async 'delete-shop'(el) {
      const item = S().shopping.find((i) => i.id === el.dataset.id);
      if (!item || !(await UI.confirm('Hapus item belanja?', `${item.name} akan dihapus dari daftar belanja.`, 'Hapus'))) return;
      Store.update((s) => { s.shopping = s.shopping.filter((i) => i.id !== item.id); });
      UI.toast('Item belanja dihapus.');
    },
    'edit-budget'() {
      if (S().settings.budgetLocked) {
        UI.toast('Anggaran terkunci. Buka kunci di halaman Belanja atau Pengaturan.', 'info');
        return;
      }
      openBudgetModal();
    },
    'toggle-budget-lock'() {
      const next = !S().settings.budgetLocked;
      Store.update((s) => { s.settings.budgetLocked = next; });
      const btn = document.querySelector('[data-action="toggle-budget-lock"]');
      if (btn) {
        btn.classList.add(next ? 'just-locked' : 'just-unlocked');
        btn.setAttribute('aria-label', next ? 'Buka kunci anggaran' : 'Kunci anggaran');
        btn.setAttribute('title', next ? 'Buka kunci anggaran' : 'Kunci anggaran');
        setTimeout(() => btn.classList.remove('just-unlocked', 'just-locked'), 600);
      }
      UI.toast(next ? 'Anggaran dibuka.' : 'Anggaran dikunci.', next ? 'info' : 'success');
    },
    'reminder-done'(el) { Store.setReminder(el.dataset.session, 'done'); UI.toast('Pengingat ditandai selesai.'); },
    'reminder-postpone'(el) { Store.setReminder(el.dataset.session, 'postponed'); UI.toast('Pengingat ditunda.', 'info'); },
    'reminder-reset'(el) { Store.setReminder(el.dataset.session, 'pending'); UI.toast('Pengingat diaktifkan kembali.', 'info'); },

    'save-settings-form'() { saveSettings(); },
    async 'apply-template'() {
      const ok = await UI.confirm('Terapkan template jadwal?', 'Waktu aktivitas bawaan akan diperbarui sesuai pengaturan. Aktivitas buatan sendiri dan riwayat checklist tidak dihapus.', 'Terapkan');
      if (!ok) return;
      saveSettings(true);
      Store.update((s) => {
        const fresh = Seed.buildActivities(s.settings);
        s.activities = fresh.concat(s.activities.filter((a) => !a.isTemplate));
      });
      UI.toast('Template jadwal diterapkan.');
    },
    async 'request-notif'() {
      if (!('Notification' in window)) { UI.toast('Browser ini tidak mendukung notifikasi.', 'error'); return; }
      const perm = await Notification.requestPermission();
      updateNotifStatus();
      UI.toast(perm === 'granted' ? 'Notifikasi browser diaktifkan.' : 'Izin notifikasi belum diberikan. Pengingat tetap tampil di aplikasi.', perm === 'granted' ? 'success' : 'info');
    },
    'export-data'() {
      Utils.downloadFile('rutin-buah-cadangan.json', Store.exportData(), 'application/json');
      UI.toast('Data diekspor.');
    },
    'export-md'() { exportMarkdown(); },
    'import-trigger'() { document.getElementById('import-file').click(); },
    async 'reset-data'() {
      const ok = await UI.confirm('Kembalikan data awal?', 'Seluruh aktivitas, catatan, stok, dan riwayat akan diganti dengan data bawaan. Ekspor data terlebih dahulu jika ingin menyimpannya.', 'Ya, kembalikan');
      if (!ok) return;
      Store.reset();
      document.dispatchEvent(new CustomEvent('app:force-render'));
      UI.toast('Data awal dipulihkan.');
    }
  };

  function moveTask(id, dir) {
    Store.update((s) => {
      const sorted = s.tasks.slice().sort((a, b) => (a.order || 0) - (b.order || 0));
      const idx = sorted.findIndex((t) => t.id === id);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= sorted.length) return;
      [sorted[idx], sorted[next]] = [sorted[next], sorted[idx]];
      sorted.forEach((t, i) => { t.order = i + 1; });
    });
  }

  function saveSettings(silent = false) {
    const form = document.getElementById('settings-form');
    if (!form) return;
    const d = new FormData(form);
    const bool = (k) => d.get(k) === 'on';
    const themeChanged = d.get('theme') !== S().settings.theme;
    Store.update((s) => {
      const st = s.settings;
      st.name = String(d.get('name') || '').trim();
      st.theme = d.get('theme') === 'dark' ? 'dark' : 'light';
      st.timezone = String(d.get('timezone') || 'Asia/Jakarta').trim();
      st.weeklyBudget = Number(d.get('weeklyBudget')) || 0;
      st.budgetLocked = bool('budgetLocked');
      st.dailyFruitTarget = Utils.clamp(Number(d.get('dailyFruitTarget')) || 2, 1, 10);
      st.seminarDate = d.get('seminarDate') || '';
      st.bedtime = d.get('bedtime') || '21.00';
      st.fruit1Time = d.get('fruit1Time') || '08.30';
      st.fruit2Time = d.get('fruit2Time') || '15.15';
      st.thesisTopic = String(d.get('thesisTopic') || '').trim();
      st.wakeUpTime = d.get('wakeUpTime') || '04.00';
      st.subuhTime = d.get('subuhTime') || '04.10';
      st.walkMinutes = Number(d.get('walkMinutes')) || 40;
      st.workoutMinutes = Number(d.get('workoutMinutes')) || 30;
      st.workStartTime = d.get('workStartTime') || '09.00';
      st.commuteMinutes = Number(d.get('commuteMinutes')) || 0;
      st.workEndTime = d.get('workEndTime') || '17.00';
      st.overtimeEndTime = d.get('overtimeEndTime') || '21.00';
      st.shoppingDays = { main: Number(d.get('shoppingDayMain')) || 7, refill: Number(d.get('shoppingDayRefill')) || 3 };
      st.notifications = {
        enabled: bool('notifEnabled'), activity: bool('notifActivity'), fruit: bool('notifFruit'),
        shopping: bool('notifShopping'), lowStock: bool('notifLowStock'), bedtime: bool('notifBedtime'),
        activityLeadMinutes: Utils.clamp(Number(d.get('activityLeadMinutes')) || 0, 0, 60),
        shoppingTimeMain: d.get('shoppingTimeMain') || '09.00',
        shoppingTimeRefill: d.get('shoppingTimeRefill') || '09.00'
      };
    });
    document.documentElement.dataset.theme = S().settings.theme;
    if (themeChanged) UI.themeTransition();
    updateNotifStatus();
    if (!silent) UI.toast('Pengaturan disimpan.');
  }

  function updateNotifStatus() {
    const el = document.getElementById('notif-status');
    if (!el || !('Notification' in window)) return;
    el.textContent = 'Status izin browser: ' + (Notification.permission === 'granted' ? 'diaktifkan' : Notification.permission === 'denied' ? 'ditolak' : 'belum diminta');
  }

  function exportMarkdown() {
    const s = S();
    const today = Utils.dateKey(new Date());
    const p = Store.progressForDate(new Date());
    const totals = Store.shoppingTotals();
    const lines = [
      '# Ringkasan Rutin & Buah', '',
      `Diekspor: ${Utils.formatDate(new Date())}`, '',
      `## Progres hari ini`, `- Aktivitas selesai: ${p.done}/${p.total} (${p.pct}%)`,
      `- Buah: ${Store.servingsForDate(new Date())}/${Store.dailyTarget()} porsi`, '-', '',
      '## Skripsi', ...s.tasks.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map((t) => `- [${t.status === 'completed' ? 'x' : ' '}] ${t.title} (${t.priority})`), '',
      '## Stok buah', ...s.inventory.map((i) => `- ${i.name}: ${i.quantityRemaining} ${i.unit} (${i.status})`), '',
      '## Anggaran', `- Maksimal: ${Utils.rupiah(totals.budget)}`, `- Estimasi: ${Utils.rupiah(totals.estimated)}`, `- Aktual: ${Utils.rupiah(totals.actual)}`, `- Sisa: ${Utils.rupiah(totals.remaining)}`
    ];
    Utils.downloadFile(`ringkasan-rutin-${today}.md`, lines.join('\n'), 'text/markdown;charset=utf-8');
    UI.toast('Ringkasan diekspor.');
  }

  return {
    dashboard, jadwal, skripsi, buah, belanja, pengaturan,
    Actions, openActivityModal, openConsumeModal, openStockModal, openShopModal, openTaskModal,
    saveSettings, updateNotifStatus, exportMarkdown, setViewDate: (d) => { viewDate = new Date(d); },
    getViewDate: () => viewDate, filterActivities, afterRender
  };
})();
