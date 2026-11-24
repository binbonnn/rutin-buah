# Changelog

Semua perubahan Signifikan dicatat di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/); proyek ini belum memakai Semantic Versioning secara ketat.

## [1.2.3] — 2026-11-24

**S10 — uji E2E browser, jam palsu, dan log galat**

- Tes Playwright baru untuk batas Jendela Aktif, V3-02, evaluasi, impor/template, autosave catatan, aksesibilitas, offline, dan konsol. Setiap temuan V3-01 s.d. V3-10 kini punya spesifikasi E2E; dua tes regresi yang hanya mencocokkan teks sumber (`V-09`, `F-11`) dihapus.
- `page.clock.install` dipakai sebelum `goto` dengan `timezoneId: 'Asia/Jakarta'`; proyek `chromium` 1280×900 dan `mobile` 390×844 berjalan satu worker agar `localStorage` terisolasi.
- ESLint flat config (`no-undef`, `no-unused-vars`, `eqeqeq`) berjalan di lokal dan CI. CI juga memasang Chromium Playwright, menjalankan `npm run test:e2e`, dan mengunggah `playwright-report/` bila gagal.
- Log galat lokal `js/errlog.js`: ring buffer 50 entri `{t, msg, src, line, stack, route, ver, kind}` di `rutin-buah:errlog`, menangkap `error` dan `unhandledrejection`, menyensor kutipan/tanggal, dan tidak pernah melempar. Pengaturan → **Diagnostik** menyediakan **Unduh log galat** dan **Hapus log**. Berkas ditambahkan ke `SHELL` service worker.
- Service worker cache bump `rutin-buah-v34` → `rutin-buah-v35`.

## [1.2.2] — 2026-11-24

**Remediasi audit V3 — V3-01 s.d. V3-10**

- **V3-02 (tinggi):** hari istirahat tidak lagi menimpa catatan `completed`/`inprogress`/`skipped`; membatalkannya juga tidak menghapus catatan tersebut.
- **V3-01 (tinggi):** instalasi baru tidak lagi membuat laporan `final` 0% untuk minggu sebelum aplikasi dipakai. State menyimpan `firstUseAt`; laporan 0% lama bisa dibersihkan lewat tombol di Pengaturan tanpa menyentuh riwayat centang.
- **V3-04:** laporan kedaluwarsa yang belum dibuka kini dihapus paling lambat 14 hari setelah `expiresAt` dan jumlah laporan `final` dibatasi maksimal 8 (sebelumnya bisa tumbuh tanpa batas).
- **V3-03:** teks rencana pemulihan diubah menjadi “Usulan (belum terjadwal otomatis)”. Penjadwalan nyata tetap menjadi pekerjaan S1/v1.3.0.
- **V3-05:** status tampilan kini turunan tunggal `Store.windowFor()`; status `grace` (“Segera tutup”) muncul antara jam tutup dan akhir toleransi, termasuk untuk jadwal lintas tengah malam.
- **V3-06:** tab aktif pada tema gelap memakai `--primary-bright` agar kontrasnya memadai.
- **V3-07:** pratinjau Minggu 21.00 tidak lagi menghitung aktivitas yang jamnya belum tiba; aktivitas tersebut dicantumkan terpisah sebagai “menunggu”.
- **V3-09:** target sentuh `.bento-check` dan `.link-btn` minimum 44 px.
- **V3-10:** daftar “Yang belum selesai” dikelompokkan per hari, hari terburuk dibuka otomatis, dan maksimal 10 baris tampil awal dengan opsi “Tampilkan semua”.
- **V3-08:** snapshot harian ringan `dayPlans` dibekukan untuk 35 hari terakhir agar laporan catch-up memakai jadwal saat hari berlalu, bukan jadwal yang sudah diedit.
- Skema data naik `3 → 4`. Sebelum migrasi, data mentah disalin ke `rutin-buah:v1:pre-migrate-v<from>` dan hanya slot terbaru yang dipertahankan. Kontrak evaluasi naik ke `ruleVersion = 4`; kaki unduhan `.md` kini menyebut tanggal penghapusan yang sebenarnya.
- Service worker cache bump `rutin-buah-v33` → `rutin-buah-v34`.
- Tes regresi bertambah `22 → 35` (satu tes perilaku per temuan V3, migrasi schema 4, dan cadangan pra-migrasi).

## [1.2.1] — 2026-11-23

**Perbaikan Jendela Aktif**
- `strictSince` sebelumnya diset ke Senin **berikutnya**, sehingga seluruh aktivitas dalam pekan pembaruan masih memakai jalur lama: aktivitas terlewat tetap bisa dicentang dan aktivitas ≥ 20 menit tetap bisa langsung diselesaikan tanpa `Mulai`.
- Instalasi baru dan data yang sudah ada kini memakai `strictSince` = **Senin pekan berjalan**. Nilai lama yang masih di masa depan ditarik ke Senin pekan berjalan saat state dinormalisasi; catatan/completion lama tidak diubah.
- Service worker cache bump `rutin-buah-v32` → `rutin-buah-v33` agar perbaikan langsung terpasang.
- Tes regresi bertambah menjadi **22 tes** (instalasi baru, migrasi `strictSince`, aktivitas terlewat terkunci, dan jalur lama sebelum Senin).

## [1.2.0] — 2026-11-23

Remediasi hasil audit kedua (`AUDIT-V2-dan-Saran-Evaluasi-Mingguan.md`) sekaligus Fase 0–3: Jendela Aktif, Evaluasi Mingguan, dan otomasi pengujian. Skema data naik ke **3**.

**Perbaikan regresi audit**
- R-01: input `#import-file` kini permanen di `index.html`; tombol "Impor" hanya memicu picker, sehingga alur impor tidak lagi bergantung pada halaman Pengaturan.
- R-02: "Terapkan template" memakai `Store.applyTemplate()` dengan ID unik; duplikat lama dibongkar saat normalisasi/migrasi dan edit pengguna tetap diprioritaskan.
- N-02: autosave catatan bimbingan lewat `Store.saveMentorNotes()`; `update()` mengosongkan antrean `persistSoon()` lebih dulu, ditambah flush saat blur, `visibilitychange`, dan `pagehide`.
- D-05: laporan evaluasi kedaluwarsa yang belum dibuka ditahan tampil; setelah dibuka (`seen`) langsung dihapus, dan tidak ikut diimpor kembali.
- N-01: notifikasi buka/tutup jendela dan pratinjau/final evaluasi; ICS kini memuat dua VEVENT mingguan ber-`VALARM` (Minggu 21.00 dan Senin 09.00).
- N-03: `h3` pada topik skripsi dan ringkasan buah diganti elemen teks agar hierarki heading tidak meloncat.
- F-11: interval 60 detik dan `visibilitychange` memperbarui atribut/status lewat `Pages.refreshLiveStates()`, bukan render ulang penuh.
- V-09: target sentuh `.check`, `.btn-icon-sm`, dan `.mini-input` jadi 44 px nyata; override desktop yang mengecilkan dihapus.

**Jendela Aktif (mulai Senin setelah pembaruan)**
- Penandaan hanya saat `opensAt ≤ now < lastTick`, dengan `lastTick = closesAt + grace`; grace default 10 menit (0–30 menit, diatur di Pengaturan).
- Durasi 0 menit tetap menjadi item dengan jendela minimum 10 menit, dan template bawaan sudah diperbaiki.
- Aktivitas ≥ 20 menit wajib dua langkah (`Mulai` → `Selesai`); dijaga baik di tombol maupun di `Store.canMark()`.
- Hari istirahat maksimal 2 per minggu dan dikecualikan dari skor; tanggal sebelum `settings.strictSince` tetap memakai aturan lama (`src: 'legacy'`).

**Evaluasi Mingguan**
- Halaman baru **Evaluasi** dengan tab Ringkasan / Rencana / Riwayat: grafik 7 batang, maksimal 3 insight, dan rencana pemulihan maksimal 5 tindakan yang bisa diterima/dilewati.
- Snapshot dibuat sekali per minggu (pratinjau Minggu 21.00, final Senin 09.00), idempoten, dengan catch-up maksimal 4 minggu.
- Retensi **4 laporan final terbaru**; riwayat `completion` tidak ikut dibatasi. Laporan kedaluwarsa sudah dibuka dihapus otomatis.
- Unduh Markdown `.md` per laporan atau "Unduh semua", plus Web Share dengan fallback papan klip. Tidak ada skor mini jangka panjang dan tidak ada format laporan JSON importable.
- Service worker cache bump `rutin-buah-v30` → `rutin-buah-v32`.

**Pengujian**
- `tests/regression.test.js` + `tests/helpers.js`: 19 tes untuk R-01/R-02/N-02, boundary Jendela Aktif, anti-retroaktif, migrasi v2→v3, waktu pratinjau/final evaluasi, retensi, impor, ICS, target sentuh, dan pembaruan terarah.
- `package.json` menyediakan `npm test` / `npm start`; `.github/workflows/test.yml` menjalankan `node --check`, validasi manifest, dan tes pada setiap push/PR ke `main`.

## [1.1.0] — 2026-11-23

### Remediasi audit 92 temuan (`AUDIT-Rutin-Buah.md`)

**Data & stabilitas**
- `mergeDefaults` menggantikan `deepMerge`, dengan filter `__proto__`, validasi tipe, normalisasi state, migrasi skema 2, dan *safe mode* dengan unduh data mentah.
- ID item belanja unik per minggu (`templateId` terpisah) + migrasi sekali; riwayat tidak lagi ikut terhapus.
- Sinkronisasi antar-tab lewat event `storage`, penulisan debounced, dan `update()` membaca ulang state sebelum mutasi.
- Impor divalidasi, menampilkan ringkasan, meminta konfirmasi, dan menyimpan cadangan pra-impor (`rutin-buah:v1:pre-import`).
- Status aktivitas diperiksa berdasarkan tanggal lebih dulu; ID template stabil; template yang dihapus tidak muncul lagi.
- `notified` dipangkas 14 hari, batas 200 item belanja dihapus, state awal langsung dipersist, dan `navigator.storage.persist()` diminta.
- Pengingat usia cadangan: penanda `lastBackupAt`, banner dashboard, toast harian, dan keterangan "Cadangan terakhir" di Pengaturan.

**Notifikasi**
- Pencocokan menit persis diganti jendela waktu 10 menit dan pemeriksaan saat `visibilitychange`/`focus`.
- Fallback `navigator.serviceWorker.ready` diberi timeout agar notifikasi dalam-aplikasi tetap tampil.
- Ekspor kalender ICS dengan `VALARM Asia/Jakarta` untuk jadwal mingguan dan pengingat belanja.
- Klik notifikasi service worker memfokuskan jendela yang ada dan menerapkan hash tujuan.
- Status "segera dikonsumsi" kini dihitung otomatis dari `purchaseDate` + lokasi penyimpanan; penanda manual tetap mempercepat.

**Tampilan & aksesibilitas**
- Perbaikan V-01: `.main { position: relative; z-index: 1; }` mengembalikan ketajaman `page-head` dan kepala kolom tanpa merusak drawer.
- Bottom tab bar 5 tujuan harian untuk < 1024 px; drawer tetap tersedia untuk Pengaturan dan tertutup tidak bisa difokus (`visibility:hidden` + `inert`).
- Lantai tipografi 12 px, target sentuh 44 px, label tombol sesuai teks tampak, save indicator & feedback form, ring dibatasi 0–100%.
- Kontras teks koral diperbaiki (gelap di tema terang, putih di koral `#c2410c` pada tema gelap); peta warna kategori konsisten (Skripsi = ungu).
- Tema `system` sebagai default + `js/theme-init.js` sebelum paint; dua meta `theme-color` mengikuti tema aktif.
- Money input diformat `id-ID`, harga aktual disimpan silent tanpa kehilangan fokus, sticky save bar, dan zona berbahaya dipisah.
- Data contoh diberi penanda, onboarding singkat, serta mikrocopy dan ikon yang disamakan.
- `prefers-reduced-motion` tetap dihormati; mode transparansi/contrast dikurangi memakai permukaan solid.

**PWA & keamanan**
- Service worker cache `rutin-buah-v30`: pre-cache atomik, cache-first aset tanpa campur versi, timeout 3 detik untuk navigasi, hanya `res.ok` yang di-cache, dan alur "Versi baru tersedia".
- Manifest: `id` absolut, `start_url?source=pwa`, orientasi `any`, `display_override`, ikon monochrome + maskable + Apple 180, screenshots narrow/wide, shortcut diperbarui.
- Google Fonts dihapus (font sistem), CSP + header keamanan ditambahkan ke `index.html` dan `scripts/serve.js`.
- `serve.js` tahan URL rusak/traversal, membalas 404 untuk aset hilang, dan tidak menyajikan dokumen/internal scripts.

### Verifikasi
- `node --check` untuk seluruh JS; manifest valid JSON.
- Enam halaman di desktop & simulasi 390 px: tanpa overflow horizontal dan tanpa console error.
- Drawer 390 px: sidebar `x=12,y=12`, backdrop `0,0,390,844`, `closeHit=ASIDE.sidebar`, `navHit=A.nav-item`.
- Lighthouse Accessibility / Best Practices / SEO: **1.00 / 1.00 / 1.00**, tanpa audit failures.
- CSP tidak memblokir unduhan Blob (JSON cadangan berhasil diunduh).
- Server: URL cacat → 400, aset hilang → 404, traversal → 403, dokumen internal → 404.

## [1.0.0]

- Rilis awal: enam halaman, PWA offline-first, tema terang/gelap, dan 6 UX laws + 6 animated icons (lihat [`UX_MOTION_AUDIT.md`](UX_MOTION_AUDIT.md)).
