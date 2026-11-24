/* ---------- Halaman & aksi aplikasi ---------- */
const Pages = (() => {
  const esc = Utils.escapeHtml;
  const ic = Utils.icon;
  const S = () => Store.state;

  let viewDate = new Date();
  let activitySearch = { open: false, query: '' };
  let evalTab = 'ringkasan';
  let evalWeek = '';

  // CHOICE OVERLOAD: 6 opsi utama lebih dulu, 2 opsi jarang di akhir daftar.
  const CATEGORIES = ['Skripsi', 'Kerja', 'Olahraga', 'Pribadi', 'Makan', 'Lainnya', 'Membaca', 'Ibadah'];

  /**
   * C.6/F-11: satu tombol kontekstual. Tombol yang terkunci tetap bisa
   * difokus (aria-disabled) supaya alasannya terdengar, lalu aksi menolak
   * lewat Store.canMark — bukan sekadar menyembunyikan tombol.
   */
  function activityControl(a, key, compact = false) {
    const now = new Date();
    const raw = Store.statusOf((S().completion[key] || {})[a.id]);
    const win = Store.windowFor(a, key, now, S());
    const finished = raw === 'completed' || raw === 'skipped' || raw === 'excused';
    const want = finished ? 'undo' : (win.long && raw !== 'inprogress' ? 'start' : 'complete');
    const check = Store.canMark(a, key, want, now, S());
    const locked = !check.ok;
    let label = `Tandai selesai: ${a.title}`;
    if (want === 'undo') label = `Batalkan penandaan: ${a.title}`;
    else if (want === 'start') label = `Mulai: ${a.title}`;
    else if (raw === 'inprogress') label = `Selesaikan: ${a.title}`;
    const mark = want === 'start' && !locked ? ic('play', 18) : UI.checkIcon(raw === 'completed');
    return `<button class="check ${locked ? 'is-locked' : ''} ${raw === 'inprogress' ? 'is-running' : ''} ${compact ? 'check-sm' : ''}"
      type="button" data-action="toggle-activity" data-id="${esc(a.id)}" data-date="${esc(key)}"
      aria-label="${esc(label)}" aria-pressed="${raw === 'completed'}" aria-disabled="${locked}"
      title="${esc(locked ? check.reason : label)}" data-reason="${esc(check.reason || '')}">${mark}</button>`;
  }

  /* ============================ BERANDA ============================ */
  function dashboard() {
    const now = new Date();
    const day = Utils.dow(now);
    const acts = Store.activitiesForDay(now); // F-08: ikut filters tanggal aktivitas sekali jadi
    const statuses = acts.map((a) => ({ a, status: Store.activityStatus(a, now) }));
    const done = statuses.filter((s) => s.status === 'completed').length;
    const daily = Store.progressForDate(now);
    const weekly = Store.weekProgress(now);
    const next = statuses.find((s) => s.status === 'upcoming' || s.status === 'ongoing');
    const servings = Store.servingsForDate(now);
    const target = Store.dailyTarget();
    const soon = Store.consumeSoonInventory();
    const totals = Store.shoppingTotals();
    const reminder = Store.nextShoppingReminder();
    const remState = Store.reminderFor(reminder.session);
    const taskStats = Store.taskStats();
    const todayTarget = Store.targetForDay(day);
    const topTasks = Store.nearestTasks(3); // F-12: belum selesai & sesuai urutan
    const timeline = statuses.filter((s) => s.status === 'ongoing' || s.status === 'upcoming').slice(0, 3);
    const timelineItems = timeline.length ? timeline : statuses.slice(0, 3);

    const nextHtml = next
      ? `<div class="next-top">${UI.chip(next.status === 'ongoing' ? 'Sedang berlangsung' : 'Berikutnya', next.status === 'ongoing' ? 'run' : 'primary')}<span class="next-time">${esc(Utils.fmtTime(next.a.startTime))}</span></div>
         <h3>${esc(next.a.title)}</h3>
         <p>${esc(Utils.fmtTime(next.a.startTime))} – ${esc(Utils.fmtTime(next.a.endTime))} · ${esc(next.a.category)}</p>`
      : `<div class="next-top">${UI.chip('Selesai', 'ok')}</div><h3>Semua jadwal hari ini tertangani</h3><p>Setelahnya, fokus pada pemulihan dan persiapan besok.</p>`;

    const todayKey = Utils.dateKey(now);
    const checklist = statuses.length ? statuses.map(({ a, status }) => `
      <li class="task-row ${status === 'completed' ? 'is-done' : ''}">
        ${activityControl(a, todayKey, true)}
        <div class="task-main"><strong>${esc(a.title)}</strong><span>${esc(Utils.fmtTime(a.startTime))} – ${esc(Utils.fmtTime(a.endTime))} · ${esc(a.category)}</span></div>
        ${UI.badge(status)}
      </li>`).join('') : UI.empty('calendar', 'Belum ada aktivitas', 'Tambahkan aktivitas untuk hari ini.');

    const bentoTasks = topTasks.length ? topTasks.map((t) => {
      const isDone = t.status === 'completed';
      return `<button class="bento-check ${isDone ? 'is-done' : ''}" type="button" data-action="toggle-task" data-id="${esc(t.id)}"
        aria-label="Tandai tugas ${esc(t.title)} ${isDone ? 'belum selesai' : 'selesai'}" aria-pressed="${isDone}">
        ${UI.checkIcon(isDone)}<span>${esc(t.title)}</span></button>`;
    }).join('') : '<p class="hint">Belum ada tugas skripsi.</p>';

    const ringColors = ['#a78bfa', '#f68a73', '#6ee7b7', '#7dd3fc'];
    const ringOffsets = ['0', '-106.81', '-213.63', '-320.44'];
    const ringSegments = ringColors.map((color, i) => {
      const opacity = daily.pct >= (i + 1) * 25 ? .95 : (daily.pct > i * 25 ? .62 : .28);
      return `<circle class="ring-segment" cx="90" cy="90" r="68" fill="none" stroke="${color}" stroke-width="18"
        stroke-linecap="round" stroke-dasharray="96 427.26" stroke-dashoffset="${ringOffsets[i]}" opacity="${opacity}"></circle>`;
    }).join('');

    const timelineRows = timelineItems.map((s, i) => {
      const tone = s.status === 'ongoing' ? 'coral' : i % 2 ? 'violet' : 'mint';
      const start = Utils.parseTime(s.a.startTime);
      const current = now.getHours() * 60 + now.getMinutes();
      const inMinutes = start == null ? '' : start > current
        ? `dalam ${start - current} mnt`
        : (s.status === 'ongoing' ? 'Sedang berjalan' : 'Akan datang');
      return `<div class="timeline-row">
        <span class="tl-left"><span class="tl-mark ${tone}" aria-hidden="true">${i + 1}</span>
          <strong>${esc(Utils.fmtTime(s.a.startTime))} · ${esc(s.a.title)}</strong></span>
        <small>${inMinutes || esc(Utils.fmtTime(s.a.startTime))}</small>
      </div>`;
    }).join('') || '<p class="hint">Belum ada jadwal mendatang.</p>';

    const backupAge = Store.backupAgeDays();
    const backupWarn = backupAge != null && backupAge > 14
      ? `<div class="alert alert-warn stock-alert" role="status">${ic('alert', 18)} <span><strong>Cadangan terakhir ${backupAge} hari lalu.</strong> Ekspor data agar catatan tidak hilang bila storage browser dibersihkan.</span><button class="btn btn-soft btn-sm" type="button" data-goto="pengaturan">Buka cadangan</button></div>`
      : '';
    const restAlert = (S().restDays || []).includes(todayKey)
      ? `<div class="alert alert-info stock-alert" role="status">${ic('info', 18)} <span><strong>Hari ini ditandai hari istirahat.</strong> Penandaan aktivitas dikecualikan dari skor minggu ini.</span><button class="btn btn-soft btn-sm" type="button" data-action="toggle-rest-day" data-date="${todayKey}">Batalkan</button></div>`
      : '';
    const statsReview = Store.reviewStats(now);
    const reviewWarn = statsReview.expiring
      ? `<div class="alert alert-warn stock-alert" role="status">${ic('alert', 18)} <span><strong>Laporan ${esc(statsReview.expiring.isoWeek)} akan dihapus Senin depan pukul 09.00.</strong> Unduh bila ingin menyimpannya.</span><button class="btn btn-soft btn-sm" type="button" data-action="download-review" data-week="${esc(statsReview.expiring.weekKey)}">Unduh sekarang</button></div>`
      : '';
    const reviewCard = statsReview.latest
      ? `<section class="card review-teaser">
          ${UI.section('Evaluasi mingguan', `Laporan terbaru · ${esc(statsReview.latest.isoWeek)}`, `<a class="link-btn" href="#/evaluasi">Buka evaluasi</a>`)}
          <div class="review-teaser-body">
            <strong class="review-score">${statsReview.latest.score}%</strong>
            <span>${statsReview.latest.done}/${statsReview.latest.total} aktivitas selesai · sisa ${statsReview.latest.daysLeft} hari</span>
            <button class="btn btn-soft btn-sm" type="button" data-action="download-review" data-week="${esc(statsReview.latest.weekKey)}">${UI.downloadIcon()} Unduh .md</button>
          </div>
        </section>`
      : `<section class="card review-teaser">
          ${UI.section('Evaluasi mingguan', 'Laporan pertama muncul Minggu 21.00')}
          <p class="hint">Laporan disimpan selama 4 minggu terakhir, lalu dihapus otomatis. Unduh laporan yang ingin Anda simpan.</p>
          <a class="btn btn-soft btn-sm" href="#/evaluasi">Lihat evaluasi</a>
        </section>`;

    return `
      <div class="stack">
        ${backupWarn}${restAlert}${reviewWarn}
        <section class="hero-card tile-hero-lavender">
          <div class="hero-glow" aria-hidden="true"></div>
          <div class="hero-content">
            <span class="hero-eyebrow">${esc(Utils.formatDate(now))}</span>
            <h2>${greeting()}${S().settings.name ? ', ' + esc(S().settings.name) : ''}</h2>
            <p class="hero-sub">Fokus hari ini: ${esc(todayTarget || 'Jalankan rutinitas dengan konsisten.')}</p>
            <div class="bento-pill-row">
              <span class="pct-pill">${done}/${daily.total} aktivitas hari ini</span>
              <span class="pct-pill">${Store.servingsForWeek()}/${Store.weeklyTarget()} buah pekan ini</span>
            </div>
          </div>
          <div class="hero-side" style="flex:0 0 235px">
            <div class="crystal-panel" style="border-radius:18px;padding:14px;width:100%">${nextHtml}</div>
          </div>
        </section>

        <div class="dashboard-grid">
          <div class="dashboard-main">
            <div class="bento-row">
              <section class="card tile-lavender bento-tile">
                <div class="bento-top">
                  <span class="sculpt-icon sculpt-violet" aria-hidden="true">${ic('target', 20)}</span>
                  <span class="pct-pill">${weekly.pct}%</span>
                </div>
                <h3>Progres Minggu Ini</h3>
                <p>Hari Senin sampai hari ini</p>
                <div class="bento-body">
                  <div class="bento-count"><strong>${weekly.done}</strong><span> / ${weekly.total} aktivitas</span></div>
                  ${UI.bar(weekly.pct, 'primary', 'Progres aktivitas minggu ini')}
                  <div class="bento-pill-row">
                    <button class="mini-pill" type="button" data-action="add-activity" data-day="${day}">+ Tambah aktivitas</button>
                    <a class="mini-pill tile-arrow" href="#/jadwal" aria-label="Lihat jadwal mingguan">${ic('chevronRight', 18)}</a>
                  </div>
                </div>
              </section>

              <section class="card tile-mint bento-tile">
                <div class="bento-top">
                  <span class="sculpt-icon sculpt-mint" aria-hidden="true">${ic('fruit', 20)}</span>
                  <span class="pct-pill">${Utils.clamp(Math.round((servings / Math.max(1, target)) * 100), 0, 100)}%</span>
                </div>
                <h3>Konsumsi Buah Hari Ini</h3>
                <p>Target ${target} porsi per hari</p>
                <div class="bento-body">
                  <div class="bento-count"><strong>${servings}</strong><span> / ${target} porsi</span><em>${servings >= target ? 'Target tercapai' : servings === 0 ? 'Belum ada' : `Kurang ${target - servings} porsi`}</em></div>
                  <div class="bento-pill-row">
                    <button class="mini-pill" type="button" data-action="open-consume-preset" data-preset="1">+ 1 porsi</button>
                    <button class="mini-pill" type="button" data-action="open-consume-preset" data-preset="2">+ 2 porsi</button>
                    <a class="mini-pill tile-arrow" href="#/buah" aria-label="Lihat catatan buah">${ic('chevronRight', 18)}</a>
                  </div>
                </div>
              </section>

              <section class="card tile-thesis bento-tile">
                <div class="bento-top">
                  <span class="sculpt-icon sculpt-thesis" aria-hidden="true">${ic('book', 20)}</span>
                  <span class="pct-pill">${taskStats.done}/${taskStats.total}</span>
                </div>
                <h3>Skripsi &amp; Presentasi</h3>
                <p>3 tugas terdekat</p>
                <div class="bento-checklist">${bentoTasks}</div>
              </section>
            </div>

            <div class="card crystal-panel action-bar">
              <div class="action-icons">
                <a class="btn-icon" href="#/jadwal" title="Buka Jadwal" aria-label="Buka Jadwal">${ic('clock', 17)}</a>
                <a class="btn-icon" href="#/buah" title="Catatan Buah" aria-label="Buka catatan buah">${ic('fruit', 17)}</a>
                <button class="btn-icon" type="button" data-action="open-stock" title="Tambah stok" aria-label="Tambah stok">${ic('box', 17)}</button>
              </div>
              <a class="btn btn-primary btn-sm" href="#/jadwal">Atur Jadwal</a>
            </div>
          </div>

          <div class="dashboard-side">
            <section class="card">
              <div class="ring-multi" role="img" aria-label="${daily.pct}% target harian, ${done} dari ${daily.total} aktivitas">
                <svg viewBox="0 0 180 180" aria-hidden="true">
                  <circle cx="90" cy="90" r="68" fill="rgba(255,255,255,.36)" stroke="rgba(255,255,255,.72)" stroke-width="18"></circle>
                  ${ringSegments}
                </svg>
                <div class="ring-disc"><strong>${daily.pct}%</strong><span>Target Harian</span></div>
              </div>
              <p class="hint" style="text-align:center;margin-top:14px;font-weight:700;color:var(--ink-primary)">Hari ini · ${done}/${daily.total} aktivitas</p>
            </section>

            <section class="card" style="flex:1">
              <div class="section-head" style="margin-bottom:12px">
                <div class="flex items-center gap-2" style="display:flex;align-items:center;gap:8px">
                  <span style="width:24px;height:24px;border-radius:8px;background:var(--coral-grad);color:var(--on-coral);display:grid;place-items:center;font-size:var(--fs-xs);font-weight:800">1</span>
                  <h2>Berikutnya</h2>
                </div>
                <span class="hint">${esc(Utils.formatDate(now, { short: true }))}</span>
              </div>
              <div class="timeline-list">${timelineRows}</div>
              <a class="btn mini-pill timeline-foot" href="#/jadwal"><span>Lihat Semua Jadwal</span><span aria-hidden="true">⌄</span></a>
            </section>
          </div>
        </div>

        ${reviewCard}

        <section class="card">
          ${UI.section('Aktivitas hari ini', `${done} dari ${acts.length} selesai`, `<button class="btn btn-ghost btn-sm" type="button" data-action="add-activity" data-day="${day}">${ic('plus', 16)} Tambah</button>`)}
          <ul class="task-list">${checklist}</ul>
        </section>

        <div class="grid-2">
          <section class="card">
            ${UI.section('Stok buah', 'Siap dikonsumsi sekarang', `<a class="link-btn" href="#/buah">Lihat semua</a>`)}
            <div class="summary-list">
              <div class="summary-item"><span class="summary-icon icon-green">${ic('box', 20)}</span><div><strong>${Store.fruitKinds()} jenis buah</strong><span>Tersedia dalam stok</span></div></div>
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
      const acts = Store.activitiesForDay(d);
      const key = Utils.dateKey(d);
      const p = Store.progressForDate(d);
      const rows = renderDayActivities(acts, key);
      return `<section class="day-column ${key === selKey ? 'is-selected' : ''}" data-day-column="${key}">
        <div class="day-column-head">
          <div><strong>${esc(Utils.dayName(dayNum))}</strong><span>${d.getDate()} ${esc(Utils.MONTHS[d.getMonth()].slice(0, 3))}</span></div>
          ${UI.chip(`${p.done}/${p.total} selesai`, p.pct === 100 ? 'ok' : 'neutral')}
          ${key === Utils.dateKey(new Date()) ? `<button class="btn-icon btn-icon-sm rest-day ${(S().restDays || []).includes(key) ? 'is-active' : ''}" type="button" data-action="toggle-rest-day" data-date="${key}" aria-pressed="${(S().restDays || []).includes(key)}" aria-label="Tandai hari istirahat" title="Maksimal 2 hari istirahat per minggu">${ic('lock', 16)}</button>` : ''}
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
        <div class="week-grid">${columns}</div>
        <p class="hint">Penandaan hanya bisa dilakukan saat jendela aktivitas terbuka, dengan toleransi 10 menit setelahnya. Aktivitas 20 menit ke atas memakai dua langkah: Mulai lalu Selesai. Aturan berlaku mulai Senin setelah pembaruan ini; tanggal sebelumnya tetap memakai cara lama. Maksimal 2 hari istirahat per minggu.</p>
      </div>`;
  }

  /** V-07: rutinitas pagi dikelompokkan; garis "sekarang" ditaruh sebelum item berikutnya. */
  function renderDayActivities(acts, dateKeyStr) {
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const isToday = dateKeyStr === Utils.dateKey(now);
    let nowPlaced = false;
    const nowLine = () => (isToday && !nowPlaced
      ? `<div class="now-line" role="separator" aria-label="Sekarang ${Utils.fmtTime(current)}"></div>` : '');

    const out = [];
    let i = 0;
    while (i < acts.length) {
      const a = acts[i];
      const start = Utils.parseTime(a.startTime);
      if (isToday && !nowPlaced && start != null && start > current) {
        out.push(nowLine());
        nowPlaced = true;
      }
      if (a.block) {
        const group = [];
        while (i < acts.length && acts[i].block === a.block) group.push(acts[i++]);
        const done = group.filter((x) => Store.activityStatus(x, Utils.fromKey(dateKeyStr)) === 'completed').length;
        const open = group.some((x) => ['ongoing', 'inprogress'].includes(Store.activityStatus(x, Utils.fromKey(dateKeyStr)))) ? ' open' : '';
        out.push(`<details class="routine-group"${open}>
          <summary><strong>${esc(a.blockLabel || a.block)}</strong> · ${group.length} aktivitas · ${esc(Utils.fmtTime(group[0].startTime))}–${esc(Utils.fmtTime(group[group.length - 1].endTime))}
          <span class="badge badge-ok">${done}/${group.length}</span></summary>
          <div class="routine-items">${group.map((x) => activityRow(x, dateKeyStr)).join('')}</div>
        </details>`);
      } else {
        out.push(activityRow(a, dateKeyStr));
        i++;
      }
    }
    if (isToday && !nowPlaced) out.push(nowLine());
    return out.join('');
  }

  function activityRow(a, dateKeyStr) {
    const status = Store.activityStatus(a, Utils.fromKey(dateKeyStr) || new Date());
    return `<article class="activity-item status-${status}" data-activity-id="${esc(a.id)}">
      ${activityControl(a, dateKeyStr)}
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

  /** F-11: perbarui atribut/status saja; <details> yang terbuka tidak ikut tertutup. */
  function refreshLiveStates() {
    const page = (location.hash || '').replace(/^#\/?/, '').split('?')[0] || 'dashboard';
    if (!['dashboard', 'jadwal'].includes(page)) return;
    const tpl = document.createElement('template');
    document.querySelectorAll('[data-action="toggle-activity"]').forEach((btn) => {
      const a = S().activities.find((x) => x.id === btn.dataset.id);
      if (!a) return;
      const key = btn.dataset.date;
      tpl.innerHTML = activityControl(a, key, btn.classList.contains('check-sm')).trim();
      const fresh = tpl.content.firstElementChild;
      if (!fresh) return;
      ['aria-label', 'aria-pressed', 'aria-disabled', 'title', 'data-reason'].forEach((attr) => {
        const value = fresh.getAttribute(attr);
        if (value == null) btn.removeAttribute(attr); else btn.setAttribute(attr, value);
      });
      btn.classList.toggle('is-locked', fresh.classList.contains('is-locked'));
      btn.classList.toggle('is-running', fresh.classList.contains('is-running'));
      if (btn.innerHTML !== fresh.innerHTML) btn.innerHTML = fresh.innerHTML;
      const item = btn.closest('.activity-item, .task-row');
      if (!item) return;
      const status = Store.activityStatus(a, Utils.fromKey(key));
      item.classList.remove('status-upcoming', 'status-ongoing', 'status-grace', 'status-missed', 'status-completed', 'status-skipped', 'status-inprogress', 'status-excused');
      item.classList.add('status-' + status);
      const badge = item.querySelector('.badge');
      if (badge) badge.outerHTML = UI.badge(status);
    });
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
      { label: `Belanja ${Utils.dayName(Store.state.settings.shoppingDays.main, true)}`, state: stateOf(mainRem, mainItems) },
      { label: `Belanja ${Utils.dayName(Store.state.settings.shoppingDays.refill, true)}`, state: stateOf(refillRem, refillItems) },
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

  /* ========================= EVALUASI MINGGUAN ======================== */
  const EVAL_NOTES = 'Laporan final disimpan maksimal 4 minggu dan 8 laporan. Yang kedaluwarsa dihapus paling lambat 14 hari setelahnya. Unduh laporan yang ingin Anda simpan.';

  function reviewBadge(r) {
    const parts = [];
    parts.push(r.expired ? 'Akan dihapus' : r.daysLeft <= 1 ? 'Dihapus Senin 09.00' : `Tersisa ${r.daysLeft} hari`);
    parts.push(r.downloadedAt ? 'Sudah diunduh ✓' : 'Belum diunduh');
    return UI.chip(parts.join(' · '), r.expired ? 'danger' : r.daysLeft <= 1 ? 'warn' : r.downloadedAt ? 'ok' : 'neutral');
  }

  function evalBars(daily) {
    const bars = daily.map((d) => {
      const h = Math.max(4, d.pct);
      return `<div class="eval-bar-wrap" title="${esc(`${d.label}: ${d.done}/${d.total} (${d.pct}%)`)}">
        <div class="eval-bar-track"><span class="eval-bar-fill" style="height:${h}%"></span></div>
        <strong>${d.pct}%</strong><span>${esc(d.label)}</span>
      </div>`;
    }).join('');
    const label = daily.map((d) => `${d.label} ${d.pct}%`).join(', ');
    return `<div class="eval-bars" role="img" aria-label="Progres harian: ${esc(label)}">${bars}</div>`;
  }

  function reviewItemRow(i) {
    return `<li><span>${esc(Utils.dayName(Utils.dow(Utils.fromKey(i.date)), true))} · ${esc(i.time || '-')}</span><strong>${esc(i.title)}</strong><em>${esc(i.reason)}</em></li>`;
  }

  /** V3-10: grup per hari, hari terburuk dibuka, maksimal 10 baris awal. */
  function reviewDayGroups(items, daily) {
    if (!items.length) return '<p class="hint">Semua aktivitas minggu ini selesai.</p>';
    const groups = new Map();
    items.forEach((i) => {
      if (!groups.has(i.date)) groups.set(i.date, []);
      groups.get(i.date).push(i);
    });
    const pctOf = (key) => (daily.find((d) => d.key === key) || {}).pct ?? 100;
    const worst = [...groups.keys()].sort((a, b) =>
      pctOf(a) - pctOf(b) || groups.get(b).length - groups.get(a).length)[0];
    return `<div class="review-day-groups">${[...groups.entries()].map(([date, rows]) => {
      const when = Utils.fromKey(date);
      const label = `${Utils.dayName(Utils.dow(when), true)}, ${Utils.formatDate(when, { short: true })}`;
      const first = rows.slice(0, 10).map(reviewItemRow).join('');
      const rest = rows.slice(10).map(reviewItemRow).join('');
      const more = rest
        ? `<details class="review-more"><summary class="link-btn">Tampilkan semua (${rows.length})</summary><ul class="review-items">${rest}</ul></details>`
        : '';
      return `<details class="review-day" ${date === worst ? 'open' : ''}>
        <summary><strong>${esc(label)}</strong><span>${rows.length} belum tercatat</span></summary>
        <ul class="review-items">${first}</ul>${more}
      </details>`;
    }).join('')}</div>`;
  }

  /** S2: teks dan CTA berasal dari data insight, bukan teks yang disimpan. */
  function insightText(i) {
    return Store.insightText(i);
  }

  function insightCta(i) {
    const d = (i && i.data) || {};
    if (i.cta === 'open-plan') return `<button class="btn btn-soft btn-sm" type="button" data-action="eval-goto-plan">Atur rencana</button>`;
    if (i.cta === 'open-day' && /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || ''))) {
      return `<a class="btn btn-soft btn-sm" href="#/jadwal?date=${encodeURIComponent(d.date)}">Lihat hari</a>`;
    }
    if (i.cta === 'edit-activity' && d.id) {
      return `<button class="btn btn-soft btn-sm" type="button" data-action="insight-edit" data-id="${esc(d.id)}" data-title="${esc(d.title || '')}">Ubah jam</button>`;
    }
    if (i.cta === 'open-settings') return `<a class="btn btn-soft btn-sm" href="#/pengaturan">Buka pengaturan</a>`;
    return '';
  }

  /** S1: satu baris rencana, lengkap dengan jam usulan dan tindakannya. */
  function planRow(p, key, index) {
    const accepted = p.status === 'accepted';
    const skipped = p.status === 'skipped';
    const when = p.suggested ? Store.planWhen(p.suggested) : Store.planReason(p);
    const chronic = p.kind === 'chronic' && p.status === 'proposed'
      ? `<div class="plan-chronic" role="group" aria-label="Pilihan aktivitas kronis">
          <button class="btn btn-soft btn-sm" type="button" data-action="plan-chronic" data-choice="reschedule" data-week="${esc(key)}" data-id="${esc(p.id)}">Ubah jam permanen</button>
          <button class="btn btn-ghost btn-sm" type="button" data-action="plan-chronic" data-choice="delete" data-week="${esc(key)}" data-id="${esc(p.id)}">Hapus dari template</button>
          <button class="btn btn-ghost btn-sm" type="button" data-action="plan-chronic" data-choice="keep" data-week="${esc(key)}" data-id="${esc(p.id)}">Pertahankan</button>
        </div>`
      : '';
    const actions = accepted
      ? `<div class="plan-buttons">
          <a class="btn btn-soft btn-sm" href="#/jadwal?date=${encodeURIComponent(p.suggested ? p.suggested.date : '')}">Lihat di Jadwal</a>
          <button class="btn btn-ghost btn-sm" type="button" data-action="plan-undo" data-week="${esc(key)}" data-id="${esc(p.id)}">Undo</button>
        </div>`
      : skipped ? ''
        : `<div class="plan-buttons">
            <button class="btn btn-ghost btn-sm" type="button" data-action="plan-edit" data-week="${esc(key)}" data-id="${esc(p.id)}">Ubah jam</button>
            <button class="btn btn-soft btn-sm" type="button" data-action="plan-accept" data-week="${esc(key)}" data-id="${esc(p.id)}">Terima</button>
            <button class="btn btn-ghost btn-sm" type="button" data-action="plan-skip" data-week="${esc(key)}" data-id="${esc(p.id)}">Lewati</button>
          </div>`;
    return `<li class="plan-decision ${accepted ? 'is-accepted' : skipped ? 'is-skipped' : ''}">
      <span class="plan-index">${index + 1}</span>
      <div class="plan-main"><strong>${esc(p.title)}</strong><small>${esc(when)}</small><small>${Utils.number(p.durationMin, 20)} menit · ${p.kind === 'chronic' ? 'Pola kronis' : 'Pemulihan'}</small>${chronic}</div>
      ${accepted ? UI.chip('Diterima', 'ok') : skipped ? UI.chip('Dilewati', 'neutral') : ''}
      ${actions}
    </li>`;
  }

  function evaluasi() {
    const now = new Date();
    const list = Store.reviewList(now);
    const key = evalWeek && list.some((r) => r.weekKey === evalWeek) ? evalWeek : (list[0] && list[0].weekKey) || '';
    if (!key) {
      return `<div class="stack">
        ${UI.pageHead('Evaluasi Mingguan', 'Evaluasi', 'Ringkasan otomatis dari aktivitas yang belum terselesaikan.')}
        <div class="alert alert-info" role="status">${ic('info', 18)} <span>${EVAL_NOTES}</span></div>
        ${UI.empty('chart', 'Belum ada laporan', 'Laporan pertama dibuat Minggu pukul 21.00, lalu diperbarui Senin pukul 09.00.')}
        <a class="btn btn-soft" href="#/jadwal">Lihat jadwal mingguan</a>
      </div>`;
    }
    const r = Store.reviewFor(key, now);
    if (!r) return '<div class="stack"></div>';
    if (!r.seen) Store.markReviewSeen(key, true); // D.6: buka sekali → laporan kedaluwarsa boleh dihapus.
    const tabs = [
      { key: 'ringkasan', label: 'Ringkasan', icon: 'chart' },
      { key: 'rencana', label: 'Rencana', icon: 'target' },
      { key: 'riwayat', label: 'Riwayat', icon: 'history' }
    ].map((t) => `<button class="subtab ${evalTab === t.key ? 'is-active' : ''}" type="button" role="tab" aria-selected="${evalTab === t.key}" data-action="eval-tab" data-tab="${t.key}">${ic(t.icon, 16)} ${t.label}</button>`).join('');
    const head = `${UI.pageHead('Evaluasi Mingguan', 'Evaluasi', `Laporan ${esc(r.isoWeek)} · ${esc(Utils.formatDate(Utils.fromKey(r.weekKey), { short: true }))} – ${esc(Utils.formatDate(Utils.addDays(Utils.fromKey(r.weekKey), 6), { short: true }))}`, `
        <button class="btn btn-soft btn-sm" type="button" data-action="share-review" data-week="${esc(key)}">${ic('share', 16)} Bagikan</button>
        <button class="btn btn-primary btn-sm" type="button" data-action="download-review" data-week="${esc(key)}">${UI.downloadIcon()} Unduh .md</button>`)}
      <div class="alert alert-info review-retention" role="note">${ic('info', 18)} <span>${EVAL_NOTES}</span></div>
      <div class="subtabs" role="tablist" aria-label="Bagian evaluasi">${tabs}</div>`;

    if (evalTab === 'rencana') {
      const rows = r.plan.length ? r.plan.map((p, i) => planRow(p, key, i)).join('')
        : UI.empty('target', 'Tidak ada rencana', 'Semua aktivitas minggu ini sudah tertangani.');
      const totalMin = r.plan.filter((p) => p.status === 'accepted')
        .reduce((sum, p) => sum + Utils.number(p.durationMin, 20), 0);
      return `<div class="stack">${head}
        <section class="card">${UI.section('Rencana pemulihan', 'Maksimal 5 tindakan dari aktivitas yang belum selesai')}
          <p class="hint plan-total">Total tambahan: ${totalMin} menit</p>
          <ul class="plan-decisions">${rows}</ul>
        </section>
      </div>`;
    }

    if (evalTab === 'riwayat') {
      const rows = list.map((item) => `<li class="review-history-item ${item.weekKey === key ? 'is-selected' : ''}">
        <div class="review-history-main"><strong>${esc(item.isoWeek)}</strong><small>${item.done}/${item.total} selesai · skor ${item.score}%</small>${reviewBadge(item)}</div>
        <div class="review-history-actions">
          <button class="btn btn-soft btn-sm" type="button" data-action="eval-open" data-week="${esc(item.weekKey)}">Buka</button>
          <button class="btn btn-ghost btn-sm" type="button" data-action="download-review" data-week="${esc(item.weekKey)}">${UI.downloadIcon()} Unduh</button>
        </div>
      </li>`).join('');
      return `<div class="stack">${head}
        <section class="card">${UI.section('Riwayat laporan', 'Empat laporan terbaru', `<button class="btn btn-soft btn-sm" type="button" data-action="download-all-reviews">${UI.downloadIcon()} Unduh semua</button>`)}
          <ul class="review-history">${rows}</ul>
        </section>
      </div>`;
    }

    const insights = r.insights.length
      ? `<ol class="insight-list">${r.insights.map((i) => `<li><span>${esc(insightText(i))}</span>${insightCta(i)}</li>`).join('')}</ol>`
      : UI.empty('chart', 'Data belum cukup', 'Data belum cukup untuk saran minggu ini.');
    const unfinished = reviewDayGroups(Store.reviewItems(r), r.daily);
    const waiting = r.waitingCount
      ? `<p class="hint">${r.waitingCount} aktivitas masih menunggu jamnya dan belum dihitung dalam pratinjau ini.</p>`
      : '';
    const skipped = r.skippedItems.length
      ? `<p class="hint">Sengaja dilewati (tidak masuk perhitungan skor): ${r.skippedItems.map((i) => esc(i.title)).join(', ')}.</p>`
      : '';
    return `<div class="stack">${head}
      <section class="card">
        <div class="review-summary">
          ${UI.ring(r.score, 'Skor minggu ini', `${r.done}/${r.total} selesai`)}
          <div class="review-summary-body">
            <div class="bento-pill-row">
              ${UI.chip(`${r.done} selesai`, 'ok')}${UI.chip(`${r.unfinished} belum`, 'warn')}${UI.chip(`${r.skippedCount} dilewati`, 'neutral')}${UI.chip(`${r.excusedCount} istirahat`, 'neutral')}
            </div>
            ${reviewBadge(r)}
            <p class="hint">${r.status === 'preview' ? 'Pratinjau Minggu 21.00; angka final dibuat Senin 09.00.' : 'Snapshot final Senin 09.00. Riwayat centang tidak ikut dihapus.'}</p>
          </div>
        </div>
        ${evalBars(r.daily)}
      </section>
      <section class="card">${UI.section('Insight', 'Maksimal tiga catatan penting')}${insights}</section>
      <section class="card">${UI.section('Yang belum selesai', 'Dikelompokkan per hari')}${unfinished}${waiting}${skipped}</section>
      <section class="card">
        ${UI.section('Rencana pemulihan', `${r.plan.filter((p) => p.status === 'accepted').length} dari ${r.plan.length} diterima`, `<button class="btn btn-soft btn-sm" type="button" data-action="eval-goto-plan">Atur rencana</button>`)}
        <p class="hint">${r.plan.map((p) => `${p.status === 'accepted' ? '✓' : p.status === 'skipped' ? '–' : '·'} ${p.title}${p.suggested ? ` (${Store.planWhen(p.suggested)})` : ''}`).join(' · ') || 'Tidak ada rencana.'}</p>
      </section>
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
    // F-17: turunkan "tahap saat ini" dari tugas aktif, lalu dari tugas pertama yang belum selesai.
    const current = tasks.find((t) => t.status === 'in-progress') || tasks.find((t) => t.status !== 'completed');
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
          ${t.status === 'todo' ? `<button class="btn-icon btn-icon-sm" type="button" data-action="start-task" data-id="${esc(t.id)}" aria-label="Mulai kerjakan ${esc(t.title)}" title="Mulai kerjakan">${ic('sparkle', 16)}</button>` : ''}
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
          <p class="thesis-topic">${esc(s.settings.thesisTopic || 'Topik belum diisi. Tambahkan melalui Pengaturan.')}</p>
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
          ${UI.section('Daftar tugas', 'Diurutkan berdasarkan urutan yang Anda atur')}
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
    const soon = Store.consumeSoonInventory();
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
    const plan = (Seed.fruitScheduleFor(s.settings)[d] || []).slice(0, target); // F-15: mengikuti target
    const planTimes = [s.settings.fruit1Time, s.settings.fruit2Time];
    for (let i = 2; i < target; i++) planTimes.push(Utils.fmtTime((Utils.parseTime(s.settings.fruit2Time) ?? 915) + (i - 1) * 90));
    const planRows = plan.map((p, i) => {
      const time = planTimes[i] || planTimes[planTimes.length - 1];
      const portion = ['Porsi pertama', 'Porsi kedua', 'Porsi ketiga', 'Porsi keempat'][i] || `Porsi ke-${i + 1}`;
      return `<div class="plan-row"><span class="plan-time">${esc(Utils.fmtTime(time))}</span><div><strong>${esc(p.label)}</strong><small>${portion}</small></div><button class="btn btn-soft btn-sm" type="button" data-action="log-planned" data-fruit="${p.fruitId}" data-label="${esc(p.label)}">${ic('check', 15)} Sudah</button></div>`;
    }).join('');

    const inventory = s.inventory.slice().sort((a, b) => {
      const rank = (x) => x.status === 'finished' || Number(x.quantityRemaining) <= 0 ? 2 : Store.isConsumeSoon(x) ? 0 : 1;
      return rank(a) - rank(b);
    });
    const invRows = inventory.map((i) => {
      const fruit = Store.fruitById(i.fruitId);
      const soonReason = Store.consumeSoonReason(i);
      const isSoon = !!soonReason;
      const isDone = i.status === 'finished' || Number(i.quantityRemaining) <= 0;
      return `<article class="stock-card ${isDone ? 'is-empty' : ''}">
        <div class="stock-head">
          <span class="stock-emoji">${ic('fruit', 22)}</span>
          <div class="stock-title"><strong>${esc(i.name)}</strong><span>Dibeli ${esc(Utils.relativeDay(i.purchaseDate))} · ${esc(i.storageLocation)}</span></div>
          ${UI.chip(isDone ? 'Habis' : isSoon ? 'Segera dikonsumsi' : 'Tersedia', isDone ? 'neutral' : isSoon ? 'warn' : 'ok')}
          ${i.isSample ? UI.chip('Contoh', 'neutral') : ''}
        </div>
        ${isSoon && !isDone ? `<p class="hint" style="margin-top:4px">${esc(soonReason)}.</p>` : ''}
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
        ${UI.pageHead('Konsumsi & persediaan', 'Buah & Stok', `Target ${target} porsi buah per hari, ${Store.weeklyTarget()} porsi per minggu.`, `
          <button class="btn btn-soft btn-sm" type="button" data-action="open-stock">${ic('plus', 16)} Tambah stok</button>
          <button class="btn btn-primary btn-sm" type="button" data-action="open-consume">${ic('plus', 16)} Catat buah</button>`)}

        ${soon.length ? `<div class="alert alert-warn stock-alert">${ic('alert', 18)} <span><strong>${esc(soon.map((i) => i.name).join(', '))} perlu dikonsumsi lebih dulu.</strong></span><button class="btn btn-soft btn-sm" type="button" data-action="open-consume">Catat sekarang</button></div>` : ''}
        ${s.inventory.some((i) => i.isSample) ? `<div class="alert alert-info stock-alert">${ic('info', 18)} <span><strong>Stok contoh</strong> ditampilkan untuk menunjukkan cara kerja. Hapus bila tidak diperlukan.</span><button class="btn btn-soft btn-sm" type="button" data-action="remove-samples">Hapus contoh</button></div>` : ''}

        <section class="card">
          <div class="fruit-summary">
            ${UI.ring(Math.min(100, (servings / target) * 100), 'Hari ini', `${servings}/${target} porsi`)}
            <div class="fruit-summary-body">
              <p class="fruit-summary-title">${servings >= target ? 'Target hari ini tercapai' : `Butuh ${target - servings} porsi lagi`}</p>
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
      { key: 'main', title: 'Belanja utama', day: s.settings.shoppingDays.main, icon: 'cart', note: `Pembelian ${Utils.dayName(s.settings.shoppingDays.main)}` },
      { key: 'refill', title: 'Belanja ulang buah segar', day: s.settings.shoppingDays.refill, icon: 'sparkle', note: `Pembelian ${Utils.dayName(s.settings.shoppingDays.refill)}` }
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
          <div class="shop-main"><strong>${esc(i.name)}</strong><span>${esc(Utils.formatQtyUnit(i.quantity, i.unit))}</span></div>
          <div class="shop-price"><small>Estimasi</small><strong>${esc(Utils.rupiah(subtotalEst))}</strong></div>
          <div class="shop-price"><small>Harga/satuan</small><input class="mini-input" type="text" data-money inputmode="numeric" value="${i.actualUnitPrice == null ? '' : esc(Number(i.actualUnitPrice).toLocaleString('id-ID'))}" placeholder="—" data-action="actual-price" data-id="${esc(i.id)}" aria-label="Harga aktual per satuan ${esc(i.name)}"></div>
          <div class="shop-tools">
            <button class="btn-icon btn-icon-sm" type="button" data-action="shop-to-stock" data-id="${esc(i.id)}" aria-label="Tambah ${esc(i.name)} ke stok" title="Tambah ke stok">${ic('box', 16)}</button>
            <button class="btn-icon btn-icon-sm" type="button" data-action="edit-shop" data-id="${esc(i.id)}" aria-label="Edit item">${ic('edit', 16)}</button>
            <button class="btn-icon btn-icon-sm danger" type="button" data-action="delete-shop" data-id="${esc(i.id)}" aria-label="Hapus item">${ic('trash', 16)}</button>
          </div>
          <span class="shop-subtotal" data-actual-subtotal="${esc(i.id)}">${subtotalAct ? `Aktual ${esc(Utils.rupiah(subtotalAct))}` : 'Harga aktual belum diisi'}</span>
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
        ${UI.pageHead(`Anggaran ${Utils.rupiah(totals.budget)}`, 'Belanja', 'Rencanakan pembelian buah mingguan dan catat harga sebenarnya.', `
          <button class="btn-icon" type="button" data-action="toggle-budget-lock" aria-label="${budgetLocked ? 'Buka kunci anggaran' : 'Kunci anggaran'}" title="${budgetLocked ? 'Buka kunci anggaran' : 'Kunci anggaran'}">${UI.lockIcon(budgetLocked)}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-action="edit-budget">${ic('settings', 16)} Atur anggaran</button>`)}
        ${shoppingStepper(items)}

        <section class="card budget-card ${totals.over ? 'is-over' : ''}" id="budget-card">
          <div class="budget-hero">
            <div><span class="eyebrow">Sisa anggaran</span><strong id="budget-remaining" class="${totals.remaining < 0 ? 'text-danger' : ''}">${esc(Utils.rupiah(totals.remaining))}</strong></div>
            <div class="budget-total">dari ${esc(Utils.rupiah(totals.budget))}</div>
          </div>
          <div id="budget-bar">${UI.bar(totals.budget ? (totals.actual / totals.budget) * 100 : 0, totals.actual > totals.budget ? 'danger' : 'primary', 'Penggunaan anggaran buah')}</div>
          <div class="budget-stats">
            <div><span>Estimasi</span><strong id="budget-estimated">${esc(Utils.rupiah(totals.estimated))}</strong></div>
            <div><span>Aktual terpakai</span><strong id="budget-actual">${esc(Utils.rupiah(totals.actual))}</strong></div>
            <div><span>Sudah dibeli</span><strong id="budget-bought">${items.filter((i) => i.isPurchased).length}/${items.length} item</strong></div>
          </div>
          <div id="budget-over">${totals.over ? `<div class="alert alert-warn">${ic('alert', 18)} <span>Pengeluaran atau estimasi melebihi anggaran. Pertimbangkan menyesuaikan daftar sebelum membeli.</span></div>` : ''}</div>
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
    const backupAge = Store.backupAgeDays();
    const backupText = backupAge == null
      ? 'Belum pernah mengekspor cadangan. Lakukan minimal setiap 14 hari.'
      : backupAge > 14
        ? `Cadangan terakhir: ${backupAge} hari lalu. Segera ekspor data Anda.`
        : `Cadangan terakhir: ${backupAge === 0 ? 'hari ini' : backupAge + ' hari lalu'}.`;
    const budgetLocked = !!s.settings.budgetLocked;
    const f = (label, name, opts) => UI.field(label, name, opts);
    const profile = UI.formGrid([
      f('Nama panggilan', 'name', { value: s.settings.name, placeholder: 'Nama Anda' }),
      f('Tema', 'theme', { type: 'select', value: s.settings.theme, options: [{ value: 'system', label: 'Ikuti perangkat' }, { value: 'light', label: 'Terang' }, { value: 'dark', label: 'Gelap' }], help: 'Default mengikuti pengaturan tema perangkat.' }),
      f('Anggaran buah per minggu (Rp)', 'weeklyBudget', { type: 'text', value: Number(s.settings.weeklyBudget).toLocaleString('id-ID'), required: true, attrs: `${budgetLocked ? 'disabled' : ''} data-money inputmode="numeric"`, full: true, help: budgetLocked ? 'Anggaran terkunci. Buka kunci di halaman Belanja untuk mengubah.' : 'Maksimal pengeluaran buah per minggu.' }),
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
      f('Selesai lembur Jumat', 'overtimeEndTime', { type: 'time', value: Utils.fmtTimeColon(s.settings.overtimeEndTime) }),
      f('Toleransi setelah jendela (menit)', 'markGraceMinutes', { type: 'number', min: 0, max: 30, value: s.settings.markGraceMinutes, full: true, help: '0–30 menit. Berlaku untuk tanggal mulai Senin setelah pembaruan; tanggal lama memakai aturan sebelumnya.' })
    ]);

    const dayOpts = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: Utils.dayName(d) }));
    const shopping = UI.formGrid([
      f('Hari belanja utama', 'shoppingDayMain', { type: 'select', value: s.settings.shoppingDays.main, options: dayOpts }),
      f('Hari belanja ulang', 'shoppingDayRefill', { type: 'select', value: s.settings.shoppingDays.refill, options: dayOpts }),
      f('Jam pengingat belanja utama', 'shoppingTimeMain', { type: 'time', value: Utils.fmtTimeColon(n.shoppingTimeMain) }),
      f('Jam pengingat belanja ulang', 'shoppingTimeRefill', { type: 'time', value: Utils.fmtTimeColon(n.shoppingTimeRefill) })
    ]);

    const notif = UI.formGrid([
      f('Aktifkan pengingat', 'notifEnabled', { type: 'checkbox', checked: n.enabled, help: 'Bila izin browser belum diberikan, pengingat tetap tampil sebagai notifikasi di dalam aplikasi.' }),
      f('Pengingat aktivitas', 'notifActivity', { type: 'checkbox', checked: n.activity }),
      f('Pengingat konsumsi buah', 'notifFruit', { type: 'checkbox', checked: n.fruit }),
      f(`Pengingat belanja ${Utils.dayName(s.settings.shoppingDays.main, true)} & ${Utils.dayName(s.settings.shoppingDays.refill, true)}`, 'notifShopping', { type: 'checkbox', checked: n.shopping }),
      f('Peringatan stok perlu dikonsumsi', 'notifLowStock', { type: 'checkbox', checked: n.lowStock }),
      f('Pengingat persiapan tidur', 'notifBedtime', { type: 'checkbox', checked: n.bedtime }),
      f('Pengingat evaluasi mingguan', 'notifReview', { type: 'checkbox', checked: n.review, help: 'Pratinjau Minggu 21.00 dan laporan final Senin 09.00.' }),
      f('Waktu sebelum aktivitas (menit)', 'activityLeadMinutes', { type: 'number', min: 0, max: 60, value: n.activityLeadMinutes })
    ]);

    return `
      <div class="stack">
        ${UI.pageHead('Preferensi aplikasi', 'Pengaturan', 'Perubahan disimpan setelah menekan tombol Simpan pengaturan.')}
        <form id="settings-form">
          <div class="settings-savebar">
            <span class="hint">Perubahan belum tersimpan sampai ditekan.</span>
            <button class="btn btn-primary btn-sm" type="submit">Simpan pengaturan</button>
          </div>
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
              <p class="hint">Jika izin ditolak, buka ikon gembok di bilah alamat browser → izinkan Notifikasi, lalu muat ulang halaman. Pengingat tetap tampil di dalam aplikasi tanpa izin tersebut. Untuk pengingat saat aplikasi tertutup, ekspor jadwal kalender di bagian Data &amp; cadangan.</p>
            </div>
          </section>
        </form>

        <section class="card" id="data-cadangan">
          ${UI.section('Data & cadangan', 'Ekspor, impor, atau pulihkan data')}
          <div class="data-actions">
            <button class="btn btn-soft btn-sm" type="button" data-action="export-data">${UI.downloadIcon()} Ekspor JSON</button>
            <button class="btn btn-soft btn-sm" type="button" data-action="export-md">${UI.downloadIcon()} Ekspor ringkasan MD</button>
            <button class="btn btn-soft btn-sm" type="button" data-action="export-ics">${UI.downloadIcon()} Ekspor jadwal kalender</button>
            <button class="btn btn-soft btn-sm" type="button" data-action="import-trigger">${ic('download', 16)} Impor JSON</button>
            <button class="btn btn-soft btn-sm" type="button" data-action="cleanup-fake-reviews">${ic('trash', 16)} Bersihkan laporan 0%</button>
          </div>
          <p class="hint" id="last-backup-note">${esc(backupText)}</p>
          <p class="hint">“Bersihkan laporan 0%” hanya menghapus laporan dari minggu sebelum aplikasi pertama dipakai; riwayat centang Anda tidak diubah.</p>
          <p class="hint">Data disimpan di browser perangkat ini. Berkas ekspor berisi catatan pribadi—simpan di lokasi privat dan jangan diunggah ke tempat publik.</p>
        </section>

        <section class="card" id="diagnostik">
          ${UI.section('Diagnostik', 'Log galat lokal untuk pelaporan masalah')}
          <div class="data-actions">
            <button class="btn btn-soft btn-sm" type="button" data-action="download-errlog">${UI.downloadIcon()} Unduh log galat</button>
            <button class="btn btn-soft btn-sm" type="button" data-action="clear-errlog">${ic('trash', 16)} Hapus log</button>
          </div>
          <p class="hint" id="errlog-count">${typeof ErrLog !== 'undefined' ? ErrLog.count() : 0} entri tersimpan di perangkat ini. Log otomatis membuang entri terlama setelah 50 entri dan tidak menyimpan judul aktivitas maupun catatan Anda.</p>
        </section>

        <section class="card danger-zone">
          ${UI.section('Zona berbahaya', 'Pulihkan cadangan atau kembalikan ke data awal')}
          <div class="data-actions">
            <button class="btn btn-soft btn-sm" type="button" data-action="restore-import">${ic('history', 16)} Pulihkan cadangan pra-impor</button>
            <button class="btn btn-danger-ghost btn-sm" type="button" data-action="reset-data">${ic('trash', 16)} Kembalikan data awal</button>
          </div>
          <p class="hint">Cadangan pra-impor dibuat otomatis sebelum setiap impor. Mengembalikan data awal menghapus seluruh catatan Anda.</p>
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
        set('servingSize', amount);
        set('servingUnit', /gram/i.test(unit) ? 'gram' : 'buah');
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
        field('Berulang tiap minggu', 'isRecurring', { type: 'checkbox', checked: a.isRecurring !== false, help: 'Nonaktifkan untuk aktivitas sekali jadi pada tanggal tertentu.' }),
        field('Tanggal khusus', 'date', { type: 'date', value: a.date || '', help: 'Wajib diisi bila tidak berulang.' }),
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
          date: String(data.get('date') || ''),
          notes: String(data.get('notes') || '').trim(),
          isTemplate: a.isTemplate || false,
          userEdited: true
        };
        if (!payload.title) { UI.toast('Nama aktivitas wajib diisi.', 'error'); return false; }
        if (!payload.isRecurring && !payload.date) { UI.toast('Isi tanggal khusus untuk aktivitas sekali jadi.', 'error'); return false; }
        const start = Utils.parseTime(payload.startTime);
        const end = Utils.parseTime(payload.endTime);
        if (start == null || end == null) { UI.toast('Waktu mulai dan selesai wajib diisi.', 'error'); return false; }
        if (end === start) { UI.toast('Waktu selesai harus berbeda dengan waktu mulai.', 'error'); return false; }
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
      ]) + '<p class="hint stock-preview" id="stock-use-preview">Pilih stok untuk melihat pratinjau.</p>',
      onOpen(d) {
        if (!preset.fruitId && !preset.inventoryId) bindFruitAutofill(d, 'consume');
        const form = d.querySelector('#modal-form');
        const stockSel = form?.elements.inventoryId;
        const countEl = form?.elements.servingCount;
        const preview = d.querySelector('#stock-use-preview');
        const update = () => {
          const stock = Store.state.inventory.find((i) => i.id === stockSel?.value);
          preview.textContent = stock
            ? `Stok akan berkurang ${Store.stockUseLabel(stock, countEl?.value || 1)}.`
            : 'Tidak ada stok yang dikurangi.';
        };
        stockSel?.addEventListener('change', update);
        countEl?.addEventListener('input', update);
        update();
      },
      onSubmit(form, data) {
        const fruit = Store.fruitById(data.get('fruitId'));
        const serving = Number(data.get('servingCount')) || 0;
        if (serving <= 0) { UI.toast('Jumlah porsi harus lebih dari 0.', 'error'); return false; }
        const invId = data.get('inventoryId');
        let linked = false;
        let usedLabel = '';
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
              Store.deductStock(stock, serving); // F-01: 2 porsi × 150 g = 300 g
              usedLabel = Store.stockUseLabel(stock, serving);
              linked = true;
            }
          }
        });
        UI.toast(linked ? `Konsumsi tercatat, stok ${fruit.name} berkurang ${usedLabel}.` : 'Konsumsi tercatat tanpa perubahan stok.', linked ? 'success' : 'info');
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
        field('Ukuran satu porsi', 'servingSize', { type: 'number', min: 0, step: 'any', value: st.servingSize ?? 150, help: 'Dipakai saat mencatat konsumsi agar stok turun sesuai porsi.' }),
        field('Satuan satu porsi', 'servingUnit', { type: 'select', value: st.servingUnit || 'gram', options: [{ value: 'gram', label: 'gram' }, { value: 'buah', label: 'buah' }] }),
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
          servingSize: Math.max(0, Number(data.get('servingSize')) || 0), servingUnit: data.get('servingUnit') || 'gram',
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
        const payloadStatus = data.get('status');
        const payload = {
          id: t.id || Utils.uid('task'), title: String(data.get('title') || '').trim(),
          description: String(data.get('description') || '').trim(), priority: data.get('priority'),
          status: payloadStatus, dueDate: data.get('dueDate') || '',
          notes: String(data.get('notes') || '').trim(), order: t.order || (S().tasks.length + 1),
          // F-03: riwayat penyelesaian mengikuti status, bukan jalur tombol centang.
          completedAt: payloadStatus === 'completed'
            ? (t.status === 'completed' && t.completedAt ? t.completedAt : new Date().toISOString())
            : ''
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
      const a = S().activities.find((x) => x.id === id);
      if (!a) return;
      const raw = Store.statusOf((S().completion[date] || {})[id]);
      const win = Store.windowFor(a, date, new Date(), S());
      const next = (raw === 'completed' || raw === 'skipped' || raw === 'excused') ? ''
        : (win.long && raw !== 'inprogress' ? 'inprogress' : 'completed');
      const res = Store.setActivityStatus(id, date, next);
      if (!res.ok) { UI.toast(res.reason || 'Penandaan tidak bisa dilakukan.', 'info'); return; }
      if (next === 'inprogress') UI.toast('Aktivitas dimulai. Tekan lagi untuk menyelesaikan.', 'info');
    },
    'activity-undo'(el) {
      const res = Store.setActivityStatus(el.dataset.id, el.dataset.date, '');
      if (!res.ok) UI.toast(res.reason || 'Penandaan tidak bisa dibatalkan.', 'info');
    },
    async 'toggle-rest-day'(el) {
      const key = el.dataset.date;
      const on = !(S().restDays || []).includes(key);
      if (on) {
        const ok = await UI.confirm('Tandai hari istirahat?', 'Aktivitas hari ini dikecualikan dari skor mingguan. Maksimal 2 hari istirahat per minggu.', 'Tandai');
        if (!ok) return;
      }
      const res = Store.setRestDay(key, on);
      if (!res.ok) { UI.toast(res.reason || 'Hari istirahat tidak bisa dicatat.', 'info'); return; }
      UI.toast(on ? 'Hari istirahat dicatat.' : 'Hari istirahat dibatalkan.');
    },

    'eval-tab'(el) { evalTab = el.dataset.tab; document.dispatchEvent(new CustomEvent('app:force-render')); },
    'eval-open'(el) { evalWeek = el.dataset.week; evalTab = 'ringkasan'; document.dispatchEvent(new CustomEvent('app:force-render')); },
    'eval-goto-plan'() { evalTab = 'rencana'; document.dispatchEvent(new CustomEvent('app:force-render')); },
    'plan-accept'(el) {
      const res = Store.acceptPlan(el.dataset.week, el.dataset.id);
      if (!res.ok) { UI.toast(res.reason || 'Rencana tidak bisa diterima.', 'info'); return; }
      UI.toast('Rencana diterima; satu aktivitas ditambahkan ke Jadwal.');
    },
    'plan-skip'(el) {
      if (Store.skipPlan(el.dataset.week, el.dataset.id)) UI.toast('Rencana dilewati.', 'info');
    },
    'plan-undo'(el) {
      const res = Store.undoPlan(el.dataset.week, el.dataset.id);
      UI.toast(res.ok ? 'Rencana dibatalkan.' : (res.reason || 'Rencana tidak bisa dibatalkan.'), res.ok ? 'success' : 'info');
    },
    'plan-edit'(el) {
      const r = Store.reviewFor(el.dataset.week);
      const p = r && r.plan.find((item) => item.id === el.dataset.id);
      if (!p) return;
      const sug = p.suggested || { date: Utils.dateKey(new Date()), start: '19.00', end: '19.40' };
      UI.openModal({
        title: 'Ubah jam rencana',
        body: grid([
          field('Tanggal', 'date', { type: 'date', value: sug.date, required: true, full: true }),
          field('Mulai', 'startTime', { type: 'time', value: Utils.fmtTimeColon(sug.start), required: true }),
          field('Selesai', 'endTime', { type: 'time', value: Utils.fmtTimeColon(sug.end), required: true })
        ]),
        onSubmit(form, data) {
          const res = Store.editPlanSlot(el.dataset.week, el.dataset.id, {
            date: String(data.get('date') || ''),
            start: Utils.fmtTime(String(data.get('startTime') || '')),
            end: Utils.fmtTime(String(data.get('endTime') || ''))
          });
          if (!res.ok) { UI.toast(res.reason || 'Jadwal tidak valid.', 'error'); return false; }
          UI.toast(`Rencana diperbarui: ${Store.planWhen(res.suggested)}.`);
        }
      });
    },
    'plan-chronic'(el) {
      const week = el.dataset.week;
      const id = el.dataset.id;
      const choice = el.dataset.choice;
      if (choice === 'reschedule') {
        const r = Store.reviewFor(week);
        const p = r && r.plan.find((item) => item.id === id);
        if (!p) return;
        const found = S().activities.find((a) => a.templateId === p.activityId || a.id === p.activityId || a.title === p.title);
        if (!found) { UI.toast('Aktivitas asli tidak ditemukan.', 'info'); return; }
        openActivityModal(found);
        return;
      }
      const res = Store.resolveChronic(week, id, choice);
      UI.toast(res.ok ? (choice === 'delete' ? 'Aktivitas dihapus dari template.' : 'Pola kronis dipertahankan 28 hari.')
        : (res.reason || 'Pilihan tidak bisa diproses.'), res.ok ? 'success' : 'info');
    },
    'insight-edit'(el) {
      const found = S().activities.find((a) => a.id === el.dataset.id || a.title === el.dataset.title);
      if (!found) { UI.toast('Aktivitas tidak ditemukan.', 'info'); return; }
      openActivityModal(found);
    },
    'download-review'(el) {
      const key = el.dataset.week;
      const md = Store.reviewMarkdown(key);
      if (!md) { UI.toast('Laporan tidak ditemukan.', 'error'); return; }
      Utils.downloadFile(Store.reviewFileName(key), md, 'text/markdown;charset=utf-8');
      Store.markReviewDownloaded(key, 'md');
      UI.toast('Laporan evaluasi diunduh.');
    },
    'download-all-reviews'() {
      const list = Store.reviewList();
      if (!list.length) { UI.toast('Belum ada laporan.', 'info'); return; }
      const all = list.map((r) => Store.reviewMarkdown(r.weekKey)).filter(Boolean).join('\n\n---\n\n');
      Utils.downloadFile(`evaluasi-mingguan-semua_${Utils.fileDate(new Date())}.md`, all, 'text/markdown;charset=utf-8');
      list.forEach((r) => Store.markReviewDownloaded(r.weekKey, 'md'));
      UI.toast(`${list.length} laporan diunduh dalam satu berkas.`);
    },
    async 'share-review'(el) {
      const r = Store.reviewFor(el.dataset.week);
      if (!r) return;
      const text = Store.reviewMarkdown(el.dataset.week);
      if (navigator.share) {
        try {
          await navigator.share({ title: `Evaluasi Mingguan ${r.isoWeek}`, text: text.slice(0, 2000) });
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }
      try {
        await navigator.clipboard.writeText(text);
        UI.toast('Laporan disalin ke papan klip.');
      } catch {
        UI.toast('Bagikan tidak tersedia. Gunakan tombol Unduh .md.', 'info');
      }
    },
    'add-activity'(el) { openActivityModal(null, Number(el.dataset.day)); },
    'edit-activity'(el) { openActivityModal(S().activities.find((a) => a.id === el.dataset.id)); },
    async 'delete-activity'(el) {
      const a = S().activities.find((x) => x.id === el.dataset.id);
      if (!a || !(await UI.confirm('Hapus aktivitas?', `“${a.title}” akan dihapus dari jadwal. Riwayat checklist yang sudah tercatat tetap disimpan.`, 'Hapus'))) return;
      Store.update((s) => {
        s.activities = s.activities.filter((x) => x.id !== a.id);
        // F-07: ingat template yang sengaja dihapus agar tidak muncul lagi saat "Terapkan".
        if (a.isTemplate) {
          s.deletedTemplateIds = s.deletedTemplateIds || [];
          if (!s.deletedTemplateIds.includes(a.id)) s.deletedTemplateIds.push(a.id);
        }
      });
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
    // F-17: aksi cepat memulai tugas, mengisi "tahap saat ini" tanpa membuka modal.
    'start-task'(el) {
      const id = el.dataset.id;
      const task = S().tasks.find((t) => t.id === id);
      if (!task || task.status === 'completed') return;
      Store.update((s) => {
        const t = s.tasks.find((x) => x.id === id);
        if (t) t.status = 'in-progress';
      });
      UI.toast(`Mulai mengerjakan: ${task.title}`);
    },
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
      const el = document.getElementById('mentor-notes');
      Store.saveMentorNotes(el ? el.value : '');
      UI.toast('Catatan bimbingan disimpan.');
    },
    'edit-seminar'() { openSeminarModal(); },

    'open-consume'() { openConsumeModal(); },
    // F-12: tombol preset mengisi jumlah porsi di modal, bukan menambah langsung.
    'open-consume-preset'(el) {
      openConsumeModal({ servingCount: Number(el.dataset.preset) || 1 });
    },
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
        Store.deductStock(st, 1); // F-01/V-17: satu porsi, bukan satu satuan
      });
      UI.toast(`Stok ${item.name} dikurangi ${Store.stockUseLabel(item, 1)} (1 porsi).`);
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
    async 'remove-samples'() {
      const count = S().inventory.filter((i) => i.isSample).length;
      if (!count) return;
      if (!(await UI.confirm('Hapus stok contoh?', `${count} item contoh akan dihapus. Stok dan riwayat yang Anda buat sendiri tidak tersentuh.`, 'Hapus contoh'))) return;
      Store.update((s) => { s.inventory = s.inventory.filter((i) => !i.isSample); });
      UI.toast(`${count} stok contoh dihapus.`);
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
        servingSize: fruit && /gram/i.test(fruit.defaultServing) ? parseInt(fruit.defaultServing, 10) || 150 : 1,
        servingUnit: fruit && /gram/i.test(fruit.defaultServing) ? 'gram' : 'buah',
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
        // F-09: jangan mengisi harga aktual dari estimasi; itu memalsukan pengeluaran.
      });
      const bought = S().shopping.find((i) => i.id === id)?.isPurchased;
      if (bought && S().shopping.find((i) => i.id === id)?.actualUnitPrice == null) {
        // U-07: arahkan pengguna mengisi harga, fokus ke input baris yang sama.
        const input = document.querySelector(`[data-action="actual-price"][data-id="${CSS.escape(id)}"]`);
        if (input) { input.focus(); input.select(); }
        UI.toast('Tandai dibeli. Isi harga aktual per satuan bila sudah diketahui.', 'info');
      } else {
        UI.toast('Status pembelian diperbarui.');
      }
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
      // F-05: next = true berarti baru dikunci. Teks mengikuti keadaan akhir.
      UI.toast(next ? 'Anggaran dikunci.' : 'Anggaran dibuka.', next ? 'success' : 'info');
    },
    'reminder-done'(el) { Store.setReminder(el.dataset.session, 'done'); UI.toast('Pengingat ditandai selesai.'); },
    'reminder-postpone'(el) { Store.setReminder(el.dataset.session, 'postponed'); UI.toast('Pengingat ditunda.', 'info'); },
    'reminder-reset'(el) { Store.setReminder(el.dataset.session, 'pending'); UI.toast('Pengingat diaktifkan kembali.', 'info'); },

    'save-settings-form'() { saveSettings(); },
    async 'apply-template'() {
      const s = S();
      const deleted = new Set(s.deletedTemplateIds || []);
      const editable = s.activities.filter((a) => a.isTemplate && !a.userEdited && !deleted.has(a.id));
      const skipped = s.activities.filter((a) => a.isTemplate && (a.userEdited || deleted.has(a.id))).length;
      const ok = await UI.confirm(
        'Terapkan template jadwal?',
        `${editable.length} aktivitas bawaan akan diperbarui, ${skipped} dilewati (telah diubah atau dihapus). Aktivitas buatan sendiri dan riwayat checklist tidak tersentuh.`,
        'Terapkan'
      );
      if (!ok) return;
      saveSettings(true);
      // R-02: satu jalur dengan invarian ID unik di Store, bukan concat mentah.
      const result = Store.applyTemplate();
      UI.toast(`Template diterapkan. ${result.skipped} aktivitas dilewati.`);
    },
    async 'request-notif'() {
      if (!('Notification' in window)) { UI.toast('Browser ini tidak mendukung notifikasi.', 'error'); return; }
      const perm = await Notification.requestPermission();
      updateNotifStatus();
      UI.toast(perm === 'granted' ? 'Notifikasi browser diaktifkan.' : 'Izin notifikasi belum diberikan. Pengingat tetap tampil di aplikasi.', perm === 'granted' ? 'success' : 'info');
    },
    async 'export-data'() {
      Store.markBackup();
      const json = await Store.exportDataAsync();
      Utils.downloadFile('rutin-buah-cadangan.json', json, 'application/json');
      const note = document.getElementById('last-backup-note');
      if (note) note.textContent = 'Cadangan terakhir: hari ini.';
      UI.toast('Data diekspor.');
    },
    'export-md'() { exportMarkdown(); },
    'export-ics'() { exportICS(); }, // N-01.2: pengingat kalender tanpa tab terbuka
    'import-trigger'() { document.getElementById('import-file').click(); },
    'cleanup-fake-reviews'() {
      const n = Store.cleanupFakeReviews();
      UI.toast(n ? `${n} laporan 0% sebelum pemakaian dihapus.` : 'Tidak ada laporan 0% yang perlu dibersihkan.', n ? 'success' : 'info');
    },
    'download-errlog'() {
      Utils.downloadFile('rutin-buah-log-galat.txt', ErrLog.exportText(), 'text/plain;charset=utf-8');
      UI.toast('Log galat diunduh.');
    },
    'clear-errlog'() {
      const n = ErrLog.clear();
      document.dispatchEvent(new CustomEvent('app:force-render'));
      UI.toast(n ? `${n} entri log dihapus.` : 'Log galat sudah kosong.', n ? 'success' : 'info');
    },
    async 'reset-data'() {
      const ok = await UI.confirm('Kembalikan data awal?', 'Seluruh aktivitas, catatan, stok, riwayat, dan laporan evaluasi akan diganti dengan data bawaan. Ekspor data terlebih dahulu jika ingin menyimpannya.', 'Ya, kembalikan');
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
    const rawBudget = d.get('weeklyBudget');
    const budget = rawBudget == null ? null : Number(String(rawBudget).replace(/\./g, '').replace(/[^\d]/g, ''));
    Store.update((s) => {
      const st = s.settings;
      st.name = String(d.get('name') || '').trim();
      st.theme = ['system', 'light', 'dark'].includes(d.get('theme')) ? d.get('theme') : 'system';
      // F-05: field terkunci tidak dikirim FormData; pertahankan nilai lama.
      if (budget != null && Number.isFinite(budget)) st.weeklyBudget = budget;
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
      st.markGraceMinutes = Utils.clamp(Number(d.get('markGraceMinutes') ?? 10), 0, 30);
      st.shoppingDays = { main: Number(d.get('shoppingDayMain')) || 7, refill: Number(d.get('shoppingDayRefill')) || 3 };
      st.notifications = {
        enabled: bool('notifEnabled'), activity: bool('notifActivity'), fruit: bool('notifFruit'),
        shopping: bool('notifShopping'), lowStock: bool('notifLowStock'), bedtime: bool('notifBedtime'),
        review: bool('notifReview'),
        activityLeadMinutes: Utils.clamp(Number(d.get('activityLeadMinutes')) || 0, 0, 60),
        shoppingTimeMain: d.get('shoppingTimeMain') || '09.00',
        shoppingTimeRefill: d.get('shoppingTimeRefill') || '09.00'
      };
    });
    // Tema diterapkan oleh app.js lewat event app:changed (termasuk resolusi 'system').
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
      `- Buah: ${Store.servingsForDate(new Date())}/${Store.dailyTarget()} porsi`, '',
      '## Skripsi', ...s.tasks.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map((t) => `- [${t.status === 'completed' ? 'x' : ' '}] ${t.title} (${t.priority})`), '',
      '## Stok buah', ...s.inventory.map((i) => `- ${i.name}: ${i.quantityRemaining} ${i.unit} (${i.status})`), '',
      '## Anggaran', `- Maksimal: ${Utils.rupiah(totals.budget)}`, `- Estimasi: ${Utils.rupiah(totals.estimated)}`, `- Aktual: ${Utils.rupiah(totals.actual)}`, `- Sisa: ${Utils.rupiah(totals.remaining)}`
    ];
    Utils.downloadFile(`ringkasan-rutin-${today}.md`, lines.join('\n'), 'text/markdown;charset=utf-8');
    UI.toast('Ringkasan diekspor.');
  }

  /** U-07: perbarui angka anggaran tanpa render ulang agar fokus input tidak hilang. */
  function refreshShoppingTotals() {
    const items = Store.currentWeekShopping();
    const totals = Store.shoppingTotals(items);
    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    setText('budget-remaining', Utils.rupiah(totals.remaining));
    setText('budget-estimated', Utils.rupiah(totals.estimated));
    setText('budget-actual', Utils.rupiah(totals.actual));
    setText('budget-bought', `${items.filter((i) => i.isPurchased).length}/${items.length} item`);
    const remaining = document.getElementById('budget-remaining');
    if (remaining) remaining.classList.toggle('text-danger', totals.remaining < 0);
    const bar = document.getElementById('budget-bar');
    if (bar) bar.innerHTML = UI.bar(totals.budget ? (totals.actual / totals.budget) * 100 : 0, totals.actual > totals.budget ? 'danger' : 'primary', 'Penggunaan anggaran buah');
    const card = document.getElementById('budget-card');
    if (card) card.classList.toggle('is-over', totals.over);
    const over = document.getElementById('budget-over');
    if (over) over.innerHTML = totals.over
      ? `<div class="alert alert-warn">${ic('alert', 18)} <span>Pengeluaran atau estimasi melebihi anggaran. Pertimbangkan menyesuaikan daftar sebelum membeli.</span></div>`
      : '';
    items.forEach((i) => {
      const el = document.querySelector(`[data-actual-subtotal="${CSS.escape(i.id)}"]`);
      if (!el) return;
      const hasPrice = i.actualUnitPrice != null && i.actualUnitPrice !== '';
      el.textContent = hasPrice
        ? `Aktual ${Utils.rupiah((Number(i.quantity) || 0) * Number(i.actualUnitPrice))}`
        : 'Harga aktual belum diisi';
    });
  }

  /** N-01.2: ekspor kalender dengan VALARM agar pengingat tetap jalan tanpa tab terbuka. */
  function exportICS() {
    const s = S();
    const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const local = (date, minutes) => {
      const m = Utils.wrapMinutes(minutes);
      return Utils.dateKey(date).replace(/-/g, '') + 'T' + Utils.pad(Math.floor(m / 60)) + Utils.pad(m % 60) + '00';
    };
    const icsEsc = (v) => String(v == null ? '' : v)
      .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const fold = (line) => {
      if (line.length <= 70) return line;
      const parts = [line.slice(0, 70)];
      let rest = line.slice(70);
      while (rest.length) { parts.push(' ' + rest.slice(0, 69)); rest = rest.slice(69); }
      return parts.join('\r\n');
    };
    const lead = Math.max(0, Number(s.settings.notifications.activityLeadMinutes) || 0);
    const alarm = (summary, minutes) => [
      'BEGIN:VALARM', `TRIGGER:-PT${minutes}M`, 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(summary)}`, 'END:VALARM'
    ];
    const week = Utils.weekDates(new Date());
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rutin Buah//Planner//ID', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VTIMEZONE', 'TZID:Asia/Jakarta', 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
      'TZOFFSETFROM:+0700', 'TZOFFSETTO:+0700', 'TZNAME:WIB', 'END:STANDARD', 'END:VTIMEZONE'
    ];
    s.activities.forEach((a) => {
      const start = Utils.parseTime(a.startTime);
      const end = Utils.parseTime(a.endTime);
      if (start == null || end == null) return;
      const date = a.date && !a.isRecurring ? Utils.fromKey(a.date) : week[Utils.dow(a.dayOfWeek) - 1];
      if (!date) return;
      const summary = a.title;
      lines.push(
        'BEGIN:VEVENT',
        `UID:${icsEsc(a.id)}@rutin-buah`,
        `DTSTAMP:${stamp(new Date())}`,
        `DTSTART;TZID=Asia/Jakarta:${local(date, start)}`,
        `DTEND;TZID=Asia/Jakarta:${local(date, end)}`,
        `SUMMARY:${icsEsc(summary)}`,
        `DESCRIPTION:${icsEsc([a.category, a.notes].filter(Boolean).join(' · '))}`,
        ...(a.isRecurring !== false ? [`RRULE:FREQ=WEEKLY;BYDAY=${['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][Utils.dow(a.dayOfWeek) - 1]}`] : []),
        ...alarm('Segera: ' + summary, lead || 1),
        'END:VEVENT'
      );
    });
    const shoppingDays = [
      { day: Number(s.settings.shoppingDays.main) || 7, label: 'Belanja utama' },
      { day: Number(s.settings.shoppingDays.refill) || 3, label: 'Belanja ulang buah segar' }
    ];
    shoppingDays.forEach((x) => {
      const date = week[x.day - 1];
      const m = Utils.parseTime(x.day === Number(s.settings.shoppingDays.main) ? s.settings.notifications.shoppingTimeMain : s.settings.notifications.shoppingTimeRefill);
      if (!date || m == null) return;
      lines.push(
        'BEGIN:VEVENT',
        `UID:shop-${x.day}@rutin-buah`,
        `DTSTAMP:${stamp(new Date())}`,
        `DTSTART;TZID=Asia/Jakarta:${local(date, m)}`,
        `DTEND;TZID=Asia/Jakarta:${local(date, m + 30)}`,
        `SUMMARY:${icsEsc(x.label)}`,
        'RRULE:FREQ=WEEKLY;BYDAY=' + ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][x.day - 1],
        ...alarm(x.label, 30),
        'END:VEVENT'
      );
    });
    // D.2: dua pengingat evaluasi tetap jalan walau aplikasi tidak dibuka.
    const reviewDate = week[0]; // Senin minggu berjalan
    const reviewEvents = [
      { uid: 'review-preview', date: Utils.addDays(reviewDate, 6), minute: 21 * 60, byday: 'SU', title: 'Pratinjau evaluasi mingguan', desc: 'Minggu 21.00 — buka Evaluasi untuk melihat pratinjau.' },
      { uid: 'review-final', date: Utils.addDays(reviewDate, 7), minute: 9 * 60, byday: 'MO', title: 'Laporan evaluasi mingguan', desc: 'Senin 09.00 — laporan final siap dibuka atau diunduh.' }
    ];
    reviewEvents.forEach((e) => {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${e.uid}@rutin-buah`,
        `DTSTAMP:${stamp(new Date())}`,
        `DTSTART;TZID=Asia/Jakarta:${local(e.date, e.minute)}`,
        `DTEND;TZID=Asia/Jakarta:${local(e.date, e.minute + 15)}`,
        `SUMMARY:${icsEsc(e.title)}`,
        `DESCRIPTION:${icsEsc(e.desc)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${e.byday}`,
        'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(e.title)}`, 'END:VALARM',
        'END:VEVENT'
      );
    });
    lines.push('END:VCALENDAR');
    Utils.downloadFile('rutin-buah-jadwal.ics', lines.map(fold).join('\r\n') + '\r\n', 'text/calendar;charset=utf-8');
    UI.toast('Jadwal kalender diekspor.');
  }

  return {
    dashboard, jadwal, evaluasi, skripsi, buah, belanja, pengaturan,
    Actions, openActivityModal, openConsumeModal, openStockModal, openShopModal, openTaskModal,
    saveSettings, updateNotifStatus, exportMarkdown, exportICS, refreshShoppingTotals,
    insightText, setViewDate: (d) => { viewDate = new Date(d); },
    getViewDate: () => viewDate, filterActivities, afterRender, refreshLiveStates
  };
})();
