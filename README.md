# Rutin & Buah — Weekly Routine & Fruit Planner

Aplikasi web **mobile-first** dan **PWA** untuk mengelola rutinitas mingguan, progres skripsi, konsumsi buah, stok, dan anggaran belanja. Seluruh data tersimpan lokal di browser (`localStorage`) sehingga tetap ada setelah halaman ditutup.

**Versi aplikasi:** 1.1.0 · **Skema data:** 2

## Menjalankan

Karena PWA/service worker memerlukan `localhost` atau HTTPS, jalankan melalui server statis. Server Node yang disediakan mengirim header keamanan/CSP yang sama dengan kebijakan di `index.html` dan disarankan untuk pengujian:

```powershell
node scripts\serve.js
# lalu buka http://localhost:8080
```

Alternatif (tanpa header keamanan tambahan): `python -m http.server 8080` atau `npx serve . -l 8080`.

> Membuka `index.html` langsung dengan `file://` tetap menampilkan aplikasi, tetapi service worker, install prompt, dan notifikasi tidak akan aktif.

## Memasang sebagai PWA

1. Buka aplikasi di Chrome/Edge Android atau desktop melalui `localhost`/HTTPS.
2. Pilih **Install app / Add to Home screen** dari menu browser (atau tombol unduh di header saat tersedia).
3. Aplikasi dapat dibuka tanpa koneksi setelah berhasil dimuat pertama kali. Manifest memakai `id` absolut, `display_override`, orientasi `any`, ikon `any`/`maskable`/`monochrome`, serta tangkapan layar untuk instalasi di desktop.

## Fitur utama

| Halaman | Isi |
| --- | --- |
| **Beranda** | Tanggal, aktivitas berikutnya, checklist hari ini, progres harian & mingguan, target buah, ringkasan stok, anggaran, pengingat belanja, quick action, peringatan cadangan lama |
| **Jadwal Mingguan** | Senin–Minggu (grid 7 kolom di desktop, carousel dengan Closure peek di ponsel), status visual + teks, edit/tambah/hapus aktivitas, penanda "sekarang", pengelompokan rutinitas, target akademik harian |
| **Skripsi** | Topik & target seminar (boleh kosong), 7 tugas awal, prioritas/status, urutan, catatan bimbingan (autosave), riwayat penyelesaian |
| **Buah & Stok** | Target 2 porsi/hari (dapat diubah), jadwal konsumsi, stok per jenis + panduan penyimpanan, status "segera dikonsumsi" dihitung otomatis dari tanggal beli & lokasi simpann, pencatatan konsumsi yang dapat mengurangi stok, riwayat |
| **Belanja** | Anggaran Rp50.000 (dapat diubah & dikunci), estimasi vs aktual dengan format Rupiah, dua sesi belanja (Minggu & Rabu), checklist item, pengingat, riwayat tanpa pemotongan diam-diam |
| **Pengaturan** | Target, waktu jadwal, anggaran, hari belanja, notifikasi, tema (sistem/terang/gelap), ekspor JSON/Markdown/ICS, impor dengan konfirmasi + cadangan, pulihkan cadangan, reset |

Navigasi harian memakai **bottom tab bar** pada layar < 1024 px; Pengaturan tetap dapat diakses lewat menu/header. Drawer tertutup tidak bisa difokus oleh keyboard maupun pembaca layar.

## Catatan implementasi

- **Tanpa build step** — HTML, CSS, dan JavaScript vanilla. Tema diterapkan oleh `js/theme-init.js` sebelum *first paint* agar tidak ada kilatan.
- **Tampilan** — glassmorphism "Liquid Glass Studio": slab putih bevel, bento pastel, pill coral. Lantai ukuran huruf 12 px, target sentuh 44 px, teks koral memakai `--ink-primary` di tema terang dan putih di koral gelap di tema gelap. `prefers-reduced-motion` dan `prefers-reduced-transparency` dihormati.
- **Penyimpanan** — `rutin-buah:v1`, skema 2. State dinormalisasi & dimigrasi saat dibaca; cadangan pra-impor disimpan di `rutin-buah:v1:pre-import`. Data awal langsung dipersist, penulisan digabung (debounce), dan perubahan antar-tab disinkronkan. `navigator.storage.persist()` diminta setelah aplikasi dimuat. Lihat [`docs/STATE_SCHEMA.md`](docs/STATE_SCHEMA.md).
- **Status aktivitas** disimpan per tanggal (`completion[YYYY-MM-DD][activityId]`), sehingga menyelesaikan aktivitas Senin tidak otomatis menyelesaikan Selasa. ID template stabil sehingga riwayat tidak hilang saat template diterapkan ulang.
- **Notifikasi** — pengingat dalam-aplikasi memakai jendela waktu 10 menit dan tetap tampil saat tab dibuka/difokuskan walaupun izin browser belum diberikan. Ekspor **kalender `.ics` dengan `VALARM`** tersedia untuk pengingat yang tetap berjalan saat aplikasi tertutup. Web Push sungguhan belum tersedia (lihat Batasan).
- **Ekspor** — JSON (cadangan penuh), Markdown (ringkasan), dan ICS (kalender). Unduhan memakai Blob URL dan tetap berjalan di bawah CSP.
- **Keamanan** — CSP, `Referrer-Policy`, `X-Content-Type-Options`, dan `Permissions-Policy` dikirim lewat header server serta meta HTML. Semua teks pengguna di-escape sebelum `innerHTML`. Server menolak URL rusak, traversal, dan berkas internal; aset yang hilang dibalas 404.
- **Font** — memakai font sistem (`system-ui`/Inter fallback). Google Fonts dihapus agar aplikasi benar-benar bekerja offline dan tidak mengirim permintaan ke pihak ketiga.
- **Urutan olahraga sebelum mandi** dan blok lembur Jumat s.d. 21.00 mengikuti template PRD.

## Batasan yang diketahui

- **Web Push / notifikasi latar belakang penuh** memerlukan server atau serverless + VAPID. Belum termasuk MVP; gunakan ekspor ICS dengan `VALARM` di aplikasi kalender perangkat untuk pengingat saat aplikasi tertutup (iOS ≥ 16.4 juga membatasi notifikasi web pada PWA yang terpasang).
- Penyimpanan browser tetap bisa dihapus pengguna atau sistem. Aplikasi meminta persistensi dan mengingatkan bila cadangan lebih tua dari 14 hari, tetapi **ekspor JSON berkala tetap tanggung jawab pengguna**.
- Berkas ekspor JSON/Markdown berisi topik skripsi dan catatan bimbingan: simpan di lokasi privat dan jangan diunggah ke tempat publik.
- Tidak ada font kustom yang di-*bundle*; tampilan tipografi mengikuti font sistem perangkat.

## Struktur

```
index.html                app shell + CSP/meta + theme-init
manifest.webmanifest      konfigurasi PWA (id, screenshots, shortcut, ikon)
sw.js                     service worker (cache terversi, timeout navigasi, klik notifikasi)
css/styles.css            styling mobile-first, dark mode, token aksesibilitas
js/theme-init.js          terapkan tema sebelum first paint
js/utils.js               helper tanggal, waktu, rupiah, ikon, unduhan
js/seed.js                data awal & generator template jadwal
js/store.js               state, migrasi, localStorage, selektor
js/ui.js                  modal, toast, field, badge, progress ring
js/pages.js               enam halaman & semua aksi (termasuk ekspor ICS)
js/app.js                 router, drawer, tab bar, notifikasi, registrasi SW
icons/                    ikon PWA 180/192/512, maskable, monochrome SVG
screenshots/              tangkapan layar narrow/wide untuk manifest
scripts/serve.js          server statis + header keamanan
scripts/generate-icons.js generator ikon (Node)
scripts/make-icons.ps1    generator ikon (PowerShell)
docs/STATE_SCHEMA.md      dokumentasi state localStorage
CHANGELOG.md              riwayat perubahan
UX_MOTION_AUDIT.md        audit 6 UX laws + 6 animated icons + lampiran verifikasi
```
