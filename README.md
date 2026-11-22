# Rutin & Buah — Weekly Routine & Fruit Planner

Aplikasi web **mobile-first** dan **PWA** untuk mengelola rutinitas mingguan, progres skripsi, konsumsi buah, stok, dan anggaran belanja. Seluruh data tersimpan lokal di browser (localStorage) sehingga tetap ada setelah halaman ditutup.

## Menjalankan

Karena PWA/service worker memerlukan `localhost` atau HTTPS, jalankan melalui server statis:

```powershell
# Opsi 1 — Python
python -m http.server 8080

# Opsi 2 — Node (tanpa instalasi, server sudah disediakan)
node scripts\serve.js

# Opsi 3 — Node (npx)
npx serve . -l 8080
```

Lalu buka `http://localhost:8080`.

> Membuka `index.html` langsung dengan `file://` tetap menampilkan aplikasi, tetapi service worker, install prompt, dan notifikasi tidak akan aktif.

## Memasang sebagai PWA

1. Buka aplikasi di Chrome/Edge Android atau desktop melalui `localhost`/HTTPS.
2. Pilih **Install app / Add to Home screen** dari menu browser (atau tombol unduh di header saat tersedia).
3. Aplikasi dapat dibuka tanpa koneksi setelah berhasil dimuat pertama kali.

## Fitur utama

| Halaman | Isi |
| --- | --- |
| **Beranda** | Tanggal, aktivitas berikutnya, checklist hari ini, progres harian & mingguan, target buah 0/2, ringkasan stok, anggaran, pengingat belanja, quick action |
| **Jadwal Mingguan** | Senin–Minggu (grid 7 kolom di desktop, satu hari per layar di ponsel), status visual + teks, edit/tambah/hapus aktivitas, target akademik harian |
| **Skripsi** | Topik & target seminar (tanggal bisa dikosongkan), 7 tugas awal, prioritas/status, urutan, catatan bimbingan, riwayat penyelesaian |
| **Buah & Stok** | 14 porsi/minggu, jadwal konsumsi, stok per jenis + panduan penyimpanan, pencatatan konsumsi yang dapat mengurangi stok, riwayat |
| **Belanja** | Anggaran Rp50.000 (dapat diubah), estimasi vs aktual, dua sesi belanja (Minggu & Rabu), checklist item, pengingat, riwayat |
| **Pengaturan** | Target, waktu jadwal, anggaran, hari belanja, notifikasi, tema, ekspor/impor/reset data |

## Catatan implementasi

- **Tanpa build step** — HTML, CSS, dan JavaScript vanilla.
- **Tampilan glassmorphism** — latar gradient mesh hangat–gelap dengan blob ungu/teal, panel kaca translusen, border terang, dan navigasi kaca; tersedia tema terang & gelap.
- **Penyimpanan**: `localStorage` dengan kunci `rutin-buah:v1`. Ekspor JSON/Markdown tersedia di Pengaturan.
- **Status aktivitas** disimpan per tanggal (`completion[YYYY-MM-DD][activityId]`), sehingga menyelesaikan aktivitas Senin tidak otomatis menyelesaikan Selasa.
- **Template jadwal** dibuat dari pengaturan dengan ID stabil; menerapkan ulang template tidak menghapus riwayat checklist maupun aktivitas buatan sendiri.
- **Notifikasi browser** memerlukan izin dan hanya aktif saat halaman terbuka. Pengingat dalam aplikasi (dashboard & halaman belanja) tetap tampil tanpa izin.
- **Urutan olahraga sebelum mandi** dan blok lembur Jumat s.d. 21.00 mengikuti template PRD.

## Struktur

```
index.html            app shell
manifest.webmanifest  konfigurasi PWA
sw.js                 service worker (cache-first aset, network-first navigasi)
css/styles.css        styling mobile-first + dark mode
js/utils.js           helper tanggal, waktu, rupiah, ikon
js/seed.js            data awal & generator template jadwal
js/store.js           state + localStorage + selektor
js/ui.js              modal, toast, field, badge, progress ring
js/pages.js           enam halaman & semua aksi
js/app.js             router, event, notifikasi, registrasi SW
icons/                ikon PWA 192/512 (any + maskable)
scripts/make-icons.ps1 generator ikon (PowerShell)
```
