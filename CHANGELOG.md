# Changelog

Semua perubahan Signifikan dicatat di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/); proyek ini belum memakai Semantic Versioning secara ketat.

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
