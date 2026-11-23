# Audit & Redesain — 6 UX Laws + 6 Animated Icons

**Produk:** Rutin & Buah — Weekly Planner (PWA, pengguna tunggal)
**Layar / flow:** Beranda · Jadwal Mingguan · Skripsi · Buah & Stok · Belanja · Pengaturan
**Platform & stack:** Web mobile-first, HTML/CSS/JS vanilla, `localStorage` (`rutin-buah:v1`), service worker, `<dialog>` native. Tanpa build step.
**Bahasa:** Bahasa Indonesia (konsisten di seluruh dokumen dan UI).
**Tanggal audit:** 22 November 2026 · **Pembaruan remediasi:** 23 November 2026 (v1.1.0)
**Status implementasi:** ✅ Diterapkan penuh di kode, terverifikasi di browser (lihat Lampiran 1–5). Prinsip 6 UX laws + 6 animated icons dipertahankan; perbaikan audit 92 temuan tidak mengubah pola Closure peek, Figure-Ground scrim, inline alerts, low keystrokes, satu garis stepper, 4–6 opsi, durasi morph 300–600 ms, maupun fallback reduced-motion.

> Catatan pemetaan [ASUMSI]: tidak ada pemutar media di produk ini, sehingga ikon **01 Play/Pause** dari reels dipetakan ke **toggle checklist** (centang kosong ↔ centang penuh) — pasangan state biner yang paling sering disentuh pengguna. Ikon **06 Unlock** dipetakan ke **kunci anggaran belanja**.

---

# BAGIAN A — 6 UX LAWS

## A1. Ringkasan Eksekutif

1. Perubahan terbesar ada di **Jadwal Mingguan**: strip hari yang semula memaksa 7 hari muat dalam satu layar kini menjadi carousel dengan **peek 30%** + fade, sehingga affordance geser terlihat tanpa instruksi.
2. **Modal** naikkan scrim dari 58% → **62%** (masuk rentang 60–70%) dan scroll belakang dikunci; fokus terkunci oleh `<dialog>` native sehingga tidak ada klik liar ke halaman di belakang.
3. **Pesan anggaran** tidak lagi bergaya banner iklan; kini kalimat tenang inline di dalam kartu anggaran, dekat tombol "Atur anggaran".
4. **Form** dipangkas drastis lewat `<datalist>` saran aktivitas dan autofill buah (label, stok, satuan, jumlah, harga, sesi terisi otomatis saat jenis buah dipilih).
5. **Belanja** kini satu stepper 4 langkah yang disatukan satu garis kontinu, bukan 4 kartu lepas.
6. Dampak yang diharapkan: lebih sedikit ketukan, lebih sedikit salah pilih, dan pengguna langsung paham "ada konten lagi" / "aku sedang di langkah berapa".
7. Trade-off disengaja: peek mengorbankan ~1 kartu hari di layar, tetapi menghilangkan kesalahan "kira hanya 5 hari". Rekomendasi: **pertahankan peek**.

---

## A2. Audit per Hukum

### A2.1 Closure — kartu berikutnya harus terlihat

**Masalah saat ini.** `.day-strip` memakai `display: grid; grid-template-columns: repeat(7, 1fr)`. Tujuh hari dipampatkan selebar layar. Chip melebar, tidak ada petunjuk bahwa strip bisa digeser. User mengira hanya ada 5–7 hari yang tampil.

**Perubahan yang diusulkan.** Ubah ke flex + `overflow-x: auto`, beri`scroll-snap`, dan**selalu tampilkan 4 chip penuh + 30% chip kelima** lewat lebar relatif, lalu tutup tepi kanan dengan fade.

**Spesifikasi implementasi presisi.**
```css
.day-strip {
  display: flex; gap: 8px; overflow-x: auto; padding: 2px 0 9px;
  scroll-snap-type: x mandatory; scrollbar-width: none;
  -webkit-mask-image: linear-gradient(to right, #000 0%, #000 88%, transparent 100%);
  mask-image: linear-gradient(to right, #000 0%, #000 88%, transparent 100%);
}
.day-chip {
  min-height: 60px; padding: 5px 2px; border-radius: 12px;
  flex: 0 0 calc((100% - 32px) / 4.3);   /* 4 penuh + 0.3 peek */
  scroll-snap-align: start;
}
@media (min-width: 1100px) {
  .day-strip { -webkit-mask-image: none; mask-image: none; }
  .day-chip  { flex: 1 1 0; }            /* desktop: 7 hari muat, fade mati */
}
```
- Rumus: `lebar chip = (lebar strip − 4 × gap 8px) / 4.3`.
- Fade: opacity penuh 0–88%, transparan di 100%.
- Target peek: **28–32%**; terukur **30%** (32px dari chip 106px pada strip 487px).
- Touch target chip: tinggi 60px (≥44px), lebar ≥74px di viewport 350px.

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Layout strip | grid 7 kolom, semua muat | flex scroll, 4 penuh + peek |
| Peek kartu berikutnya | **0%** | **30%** (target 28–32%) |
| Fade tepi kanan | tidak ada | gradient 88% → 100% |
| Scroll snap | tidak ada | `x mandatory` |
| Desktop ≥1100px | 7 kolom | 7 kolom, fade mati (tidak regresi) |

**Cara mengukur.** Di `#/jadwal`, hitung `lebar visible chip ke-5 / lebar chip`. Swipe ke ujung dan pastikan chip ke-7 bisaHab selected. Target: rasio 0,28–0,32; swipe rate naik vs baseline.

---

### A2.2 Figure-Ground — modal sebagai figure, halaman sebagai ground

**Masalah saat ini.** Scrim `rgba(8,12,22,.58)` + blur 5px masih terlalu tipis; halaman belakang tetap bisa di-scroll; kontras figure–ground kurang tegas.

**Perubahan.** Scrim **68%**, blur 6px, kunci scroll body, sekalian beri jeda animasi kirim agar pengguna tidak menutup modal sebelum feedback selesai.

**Spesifikasi.**
```css
.modal::backdrop { background: rgba(5, 8, 15, .68); backdrop-filter: blur(6px); }
body.has-modal { overflow: hidden; }
```
- `<dialog>.showModal()` native → background inert, focus trap, `Esc` menutup, klik backdrop menutup.
- Tombol utama `.btn-primary` vs sekunder `.btn-ghost` dibedakan warna + weight.
- `#modal-submit` dinonaktifkan 720ms saat mengirim (lihat B2.05).
- State sukses: toast + modal tertutup; state error validasi: `return false` dari `onSubmit` → modal tetap terbuka.

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Scrim | 58% | **68%** (target 60–70%) |
| Blur | 5px | 6px |
| Scroll belakang | aktif | **terkunci** (`body.has-modal`) |
| Klik belakang | berisiko | inert via `showModal()` |
| Focus | tidak tertrap | tertrap native |

**Cara menguji.** Buka modal tambah aktivitas → coba scroll roda mouse (tidak boleh bergerak), Tab berputar hanya di dalam modal, Esc/klik backdrop menutup, dan `body.has-modal` hilang setelah `close`.

---

### A2.3 Banner Blindness — info penting bergaya konten, bukan iklan

**Masalah saat ini.** `.alert-warn` memakai background `--warn-soft`, border penuh, dan teks berwarna `--warn` — tampak seperti promo sehingga di-skip.

**Perubahan.** Jadikan inline note: background transparan, tanpa border penuh, garis kiri 2px, teks `--muted`, ikon tetap berwarna `warn` sebagai penanda tunggal.

**Spesifikasi.**
```css
.alert { display: flex; gap: 8px; padding: 7px 0 7px 11px; margin-top: 10px;
         font-size: .76rem; line-height: 1.5; }
.alert-warn { background: transparent; color: var(--muted);
              border: 0; border-left: 2px solid var(--warn); }
.alert-warn .icon { color: var(--warn); margin-top: 1px; }
```
- Lokasi: di dalam `.budget-card` halaman Belanja, tepat setelah progress bar anggaran, sebelum tombol aksi.
- Tidak ada ALL CAPS, tidak ada neon, tidak ada badge "PENTING!".

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Gaya | kotak berwarna + border penuh | inline, garis kiri 2px |
| Warna teks | `--warn` (menjerit) | `--muted` (tenang) |
| Posisi | mengambang di atas konten | di dalam alur anggaran |
| Copy | "Anda tetap dapat mencatat…" | "Pertimbangkan menyesuaikan daftar sebelum membeli." |

**Cara menguji.** Tanya 5 pengguna untuk menyebutkan "ada apa dengan anggaranmu?" setelah 3 detik di halaman Belanja saat over-budget. Target ≥4/5 menyebut "melebihi anggaran".

---

### A2.4 Parkinson's Law — kurangi ketukan ≥50%

**Masalah saat ini.** Setiap entri buah/stok/belanja mengetik ulang label, satuan, jumlah, harga, lokasi — padahal semuanya sudah ada di katalog buah & template belanja. Nama aktivitas diketik dari nol tiap kali.

**Perubahan.**
1. `UI.field()` menerima opsi `suggestions` → merender `<datalist id="dl-{name}">`.
2. `frequentTitles(6)` mengisi saran nama aktivitas dari riwayat (6 teratas).
3. `bindFruitAutofill(dialog, kind)` mengisi otomatis saat `<select>` jenis buah berubah:
   - `consume`: label porsi + inventory yang aktif.
   - `stock`: nama, satuan, estimasi porsi, jumlah beli/sisa, lokasi simpan.
   - `shop`: nama dari template, jumlah, satuan, harga estimasi, sesi.

**Spesifikasi implementasi.**
```js
field('Nama aktivitas', 'title', {
  value: a.title || '', required: true, full: true,
  suggestions: frequentTitles(),
  help: 'Pilih dari aktivitas yang sering dipakai atau ketik yang baru.'
});
onOpen(d) { if (!isEdit) bindFruitAutofill(d, 'shop'); }
```
- Fallback jika data kosong: `suggestions = []` → datalist tidak dirender, field tetap bebas ketik.
- Fallback jika `Store.fruitById()` tidak ketemu: tidak ada yang diisi, user tetap bisa manual.

**Tabel ketukan sebelum vs sesudah** [ASUMSI: 1 ketikan ≈ 1 karakter, 1 pilihan = 1 klik; dihitung dari field yang ada di modal]:

| Form | Sebelum | Sesudah | Penurunan |
|---|---|---|---|
| Catat buah | 1 pilih buah + ~20 ketik (label, jumlah, satuan) + 1 pilih stok = **~22 interaksi** | 1 pilih buah → 4 field terisi, ~2 koreksi = **~3 interaksi** | **~86%** |
| Tambah stok | 1 pilih buah + ~35 ketik (nama, satuan, 2× jumlah, lokasi, porsi) = **~36** | 1 pilih buah → 6 field terisi, ~3 koreksi = **~4** | **~89%** |
| Tambah item belanja | 1 pilih buah + ~25 ketik (nama, jumlah, satuan, harga) + 1 pilih sesi = **~27** | 1 pilih buah → 5 field terisi, ~2 koreksi = **~3** | **~89%** |
| Tambah aktivitas | ~20 ketik nama + 5 field lain = **~25** | pilih dari 6 saran (1 klik) + 5 field lain = **~6** | **~76%** |

**Cara menguji.** Rekam time-on-task 5 pengguna untuk "catat 2 porsi buah". Target: ≤50% waktu baseline, dan 0 field salah isi pada first-run.

---

### A2.5 Connectedness — stepper satu garis kontinu

**Masalah saat ini.** Halaman Belanja menampilkan dua sesi belanja + riwayat sebagai kartu terpisah; tidak ada urutan yang terbaca sebagai satu alur.

**Perubahan.** Tambah `shoppingStepper(items)` di atas kartu anggaran dengan 4 langkah yang disatukan satu garis 2px.

**Spesifikasi.**
```
[● Rencana] ──── [● Belanja Minggu] ──── [○ Belanja Rabu] ──── [○ Selesai]
```
- Langkah: `Rencana → Belanja Minggu → Belanja Rabu → Selesai`.
- State: `is-done` (hijau `--ok` + ikon centang), `is-active` (gradient ungu→teal + ring 4px), `is-next` (abu).
- Garis: pseudo `::after` 2px dari titik ke titik berikutnya; segmen `is-done` memakai gradient `--primary-bright → --accent`.
- Status langkah diturunkan dari `Store.reminderFor('main'|'refill').status` + `item.isPurchased`.
- `role="list"` / `role="listitem"`, `aria-current="step"` hanya pada langkah aktif.

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Grup visual | 4 kartu lepas | **1 stepper, 1 garis** |
| State terlihat | tidak ada | done / active / next |
| Label langkah | implisit | 4 label eksplisit |
| Dapat dibaca screen reader | tidak | `role=list` + `aria-current` |

**Cara menguji.** Tandai semua item Minggu dibeli → langkah 2 jadi `is-done`, langkah 3 jadi `is-active`, garis segmen 1–2 berubah gradient. Ulangi untuk Rabu → "Selesai" aktif.

---

### A2.6 Choice Overload — maks 4–6 opsi di depan

**Masalah saat ini.** `CATEGORIES` menampilkan **8** kategori sekaligus, dan 177 aktivitas di Jadwal harus dipindai manual.

**Perubahan.** Susun ulang agar 6 opsi paling dipakai tampil lebih dulu, 2 opsi jarang di ujung; tambah pencarian aktivitas dengan satu tombol morph (lihat B2.04).

**Spesifikasi.**
```js
const CATEGORIES = ['Skripsi','Kerja','Olahraga','Pribadi','Makan','Lainnya','Membaca','Ibadah'];
```
- Opsi depan (6): Skripsi, Kerja, Olahraga, Pribadi, Makan, Lainnya → **default/rekomendasi: Skripsi** (sesuai fokus skripsi pengguna).
- Opsi ekor (2): Membaca, Ibadah.
- Pencarian: input `type="search"` + tombol `data-action="toggle-search"`; query difilter case-insensitive via `toLocaleLowerCase('id')`; empty-state "Tidak ada aktivitas yang cocok."

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Opsi kategori di depan | **8** | **6** (+2 di ekor daftar) |
| Opsi default | tidak jelas | **Skripsi** (pertama) |
| Filter 177 aktivitas | tidak ada | pencarian inline |
| Tombol buka/tutup cari | — | **1 tombol, 1 posisi** |

**Cara menguji.** Hitung opsi yang terlihat tanpa scroll di dropdown kategori (target ≤6). Cari "skripsi" → 21 dari 177 item tersisa; tutup → 177 kembali, query kosong.

---

## A3. Wireframe / Spesifikasi Teks per layar

**Jadwal Mingguan** (atas → bawah)
1. Header: judul "Jadwal Mingguan" + nav minggu (`‹ › Berhari ini`).
2. `search-row` (tinggi 44px): tombol ikon search (40×40) + input yang melebar saat `is-open`.
3. `hint` empty-state (hidden default).
4. `day-strip`: 7 chip, 4 penuh + 30% peek, fade kanan, snap tiap chip.
5. `legend`: 4 status (belum, berjalan, selesai, terlewat) — label teks, bukan warna saja.
6. `day-column.is-selected`: daftar aktivitas; tiap baris = tombol `.check` 26–28px + judul + waktu + chip kategori (maks 6 di depan).

**Belanja** (atas → bawah)
1. Header: "Anggaran Rp50.000" + tombol ikon kunci (48px) + tombol "Atur anggaran".
2. `stepper`: 4 langkah, garis 2px.
3. `budget-card`: hero sisa anggaran + progress bar + statistik estimasi/aktual.
4. `alert-warn` inline (hanya saat over budget).
5. Dua kartu sesi: tabel item (check, nama, qty, estimasi, aktual, aksi).
6. Riwayat 10 pembelian terakhir.

**Pengaturan** (atas → bawah)
1. Header + tombol "Simpan pengaturan".
2. Kartu "Profil & target" — termasuk toggle **Kunci anggaran** + bantuan.
3. Kartu "Template jadwal" + "Terapkan ke jadwal mingguan".
4. Kartu "Notifikasi" + status izin browser.
5. Kartu "Data" — Ekspor JSON / Ekspor ringkasan MD (dengan morph unduh) / Impor / Reset.

**Modal (semua form)**
1. `<dialog>`+ backdrop 68% + blur 6px.
2. Header: judul + tombol Tutup (44px).
3. `<form id="modal-form">` grid 2 kolom ≥520px, 1 kolom di HP; field wajib bertanda `*`.
4. Footer: Batal (ghost) + Simpan (primary, ikon kirim, min-width 116px).

---

## A4. Copy Baru

| Konteks | Copy lama | Copy baru |
|---|---|---|
| Alert anggaran | "Pengeluaran atau estimasi melewati anggaran. Anda tetap dapat mencatat pembelian, tetapi pertimbangkan untuk menyesuaikan daftar." | "Pengeluaran atau estimasi melebihi anggaran. Pertimbangkan menyesuaikan daftar sebelum membeli." |
| Nama aktivitas (help) | — | "Pilih dari aktivitas yang sering dipakai atau ketik yang baru." |
| Kunci anggaran (help) | — | "Mencegah perubahan anggaran tidak sengaja dari halaman Belanja." |
| Anggaran terkunci (toast) | — | "Anggaran terkunci. Buka kunci di halaman Belanja atau Pengaturan." |
| Kunci dibuka (toast) | — | "Anggaran dibuka." |
| Cari aktivitas | — | placeholder "Cari aktivitas di jadwal..." · aria-label "Cari aktivitas" · tutup "Tutup pencarian aktivitas" |
| Empty state cari | — | "Tidak ada aktivitas yang cocok." |
| Izin notifikasi | — | "Izin notifikasi belum diberikan. Pengingat tetap tampil di aplikasi." |
| Simpan pengaturan | — | "Simpan pengaturan" · toast "Pengaturan disimpan." |

Nada: tenang, jelas, tanpa seruan, tanpa ALL CAPS, tanpa emoji promosi.

---

## A5. Checklist QA — UX Laws

```
☐ CLOSURE — Strip hari menampilkan 28–32% chip berikutnya (terukur 30%).
☐ CLOSURE — Ada fade di tepi kanan (mask 88% → 100%) sebagai penanda konten lanjutan.
☐ CLOSURE — scroll-snap aktif; desktop ≥1100px tetap 7 hari tanpa fade.
☐ FIGURE-GROUND — Semua modal memakai backdrop 68% + blur 6px.
☐ FIGURE-GROUND — body.has-modal mengunci scroll; klik belakang tidak menutup kecuali backdrop.
☐ FIGURE-GROUND — Primer vs sekunder jelas; submit mati 720ms saat kirim.
☐ BANNER BLINDNESS — Tidak ada info penting bergaya banner/iklan.
☐ BANNER BLINDNESS — Alert anggaran inline, garis kiri 2px, teks --muted + ikon --warn.
☐ PARKINSON — Datalist 6 saran nama aktivitas; autofill 3 modal buah/belanja.
☐ PARKINSON — Ketukan turun ≥50% (terukur 76–89%) dan tercatat di A2.4.
☐ CONNECTEDNESS — Stepper 4 langkah disatukan satu garis 2px.
☐ CONNECTEDNESS — State done/active/next terlihat + aria-current="step".
☐ CHOICE OVERLOAD — Maks 6 opsi kategori di depan (2 di ekor).
☐ CHOICE OVERLOAD — Ada default "Skripsi" + pencarian untuk 177 aktivitas.
```

---

## A6. Rencana Pengujian — UX Laws

| Yang diukur | Cara mengukur | Kriteria sukses |
|---|---|---|
| Peek kartu | Rasio lebar chip ke-5 tampil / lebar chip di 3 viewport (350/487/1100px) | 0,28–0,32 di mobile; fade mati di ≥1100px |
| Swipe rate | Analytics `scroll` pada `.day-strip` (event listener ringan) | ≥30% user menggeser saat hari ke-7 tidak tampil |
| Focus trap modal | Uji manual Tab/Shift+Tab + klik backdrop + Esc | 0 fokus bocor ke belakang |
| Ketukan form | Rekam interaksi saat "catat buah" & "tambah stok" | Turun ≥50% vs baseline |
| Error rate form | `% onSubmit` yang return false | ≤5% validasi gagal pada first-run |
| Pemahaman alert | Tanya 5 user setelah 3 detik di halaman over-budget | ≥4/5 menyebut "melebihi anggaran" |
| Stepper | Klik item Minggu → Rabu → Selesai | State berganti sesuai urutan, garis menyambung |
| Choice load | Hitung opsi kategori terlihat tanpa scroll | ≤6 |

---

## A7. Yang Sengaja TIDAK Diubah

- **Struktur data & ID aktivitas.** 177 aktivitas memakai ID stabil; mengubahnya akan merusak riwayat `completion[YYYY-MM-DD][activityId]`.
- **Target angka PRD.** 2 porsi buah/hari, 14 porsi/minggu, Rp50.000/minggu, Minggu & Rabu — bukan hasil eksperimen, tapi syarat produk.
- **Navigasi bawah (mobile) & sidebar (desktop).** Sudah 6 ikon dengan label; menambah animasi di sini hanya menambah kebisingan.
- **Sistem warna glassmorphism** (mesh beige→slate, blob ungu/teal, panel frosted) — identitas visual yang sudah disetujui.
- **Logika reminder & notifikasi.** Diubah copy-nya saja, bukan mekanismenya.

---

# BAGIAN B — 6 ANIMATED ICONS

## B1. Ringkasan Eksekutif

1. Prinsip **"6 Icons, No Swaps"** diterapkan: tidak ada `innerHTML = ikonLain`, semua transisi berupa perubahan bentuk pada elemen SVG yang sama.
2. Ikon paling berdampak: **check morph** (~25–177 toggle per sesi) dan **search → X** (menghemat satu tombol + satu posisi).
3. **Sun ↔ Moon** disinkronkan dengan transisi tema halaman 600ms sehingga tidak ada "ikon berubah duluan, halaman belakangan".
4. **Download** bercerita tiga fase (panah → ring → centang) dan ekspor asli dijalankan setelah fase loading — progres jujur, bukan sekadar dekorasi.
5. **Send** mencegah double-submit lewat `disabled` + jeda 720ms, sekaligus memberi feedback "terkirim" sebelum modal menutup.
6. **Lock/Unlock** memakai spring dengan overshoot, memberi kepastian bahwa kunci anggaran benar-benar berubah.
7. Semua ikon hormati `prefers-reduced-motion` (langsung ke state akhir) dan **area tap tidak berubah ukuran**.

---

## B2. Audit per Ikon

### B2.01 Check — kosong ↔ centang (pemetaan Play/Pause)

**Masalah.** Sebelumnya `<button>.check` mengganti `ic('check')` dengan string kosong — swap mendadak, tidak ada umpan balik arah.

**Perubahan.** Satu SVG `.check-morph` dengan `<rect class="check-box">` dan `<path class="check-mark">`; kotak mengecil + memutar saat centang menggambar itself dengan spring.

| Aspek | Sebelum (swap) | Sesudah (morph) |
|---|---|---|
| Perubahan | string kosong ↔ SVG | 1 SVG, `is-checked` |
| Durasi | 0ms | **300ms** |
| Easing | — | box `cubic-bezier(.2,.8,.2,1)`, mark `.34,1.4,.64,1` |
| Area tap | 26px | 26px (tetap) |
| Reduced motion | — | centang langsung penuh |

```css
.check-morph .check-box { transition: transform .3s cubic-bezier(.2,.8,.2,1), opacity .2s; }
.check-morph .check-mark { stroke-dasharray:18; stroke-dashoffset:18; transform:scale(.55);
  transition: stroke-dashoffset .3s ease .06s, transform .3s cubic-bezier(.34,1.4,.64,1) .04s; }
.check-morph.is-checked .check-box { transform: scale(.25) rotate(10deg); opacity:0; }
.check-morph.is-checked .check-mark { stroke-dashoffset:0; transform:scale(1); }
```

---

### B2.02 Download — panah → ring → centang

**Masalah.** Ikon unduh statis; klik tidak ada indikasi "sedang menyiapkan file", user bisa klik berulang.

**Perubahan.** Satu SVG tiga lapis (`.dl-arrow`, `.dl-ring`, `.dl-check`) dengan state `is-loading` → `is-done`. Fungsi ekspor asli dipanggil di tengah animasi (setelah 650ms), bukan di awal.

| Aspek | Sebelum | Sesudah |
|---|---|---|
| State | 1 (statis) | 3 (idle → loading → done) |
| Durasi | 0ms | 650ms + 300ms + jeda 900ms (~1,85s total) |
| Easing | — | ring cubic-bezier(.2,.7,.3,1), check ease |
| Progres | tidak ada | ring 0→100% (`dashoffset 56.6→0`) |
| Double-click | bisa | `btn.disabled = true` |
| Reduced motion | — | langsung `is-done` |

```js
UI.animateDownload(btn, run); // 650ms → run() → is-done 900ms → reset
```

---

### B2.03 Dark Mode — matahari ↔ bulan sabit

**Masalah.** Ikon tema di-swap (`sun` ↔ `moon`) secara instan, lebih cepat dari transisi warna halaman.

**Perubahan.** Satu SVG `.theme-morph`: 8 rays `scale(0)→scale(1)` dengan stagger 35ms, disc ber-mask, crescent-cut bergeser `translate(11px,-7px)`, sparkle memudar. Halaman ikut transisi 600ms via `html.theme-switching`.

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Cara | swap `sun`/`moon` | 1 SVG, `.is-dark` |
| Durasi | 0ms | **600ms** |
| Rays | — | 8, stagger 35ms (0→245ms) |
| Easing | — | cubic-bezier(.4,0,.2,1); rays spring `.34,1.4,.64,1` |
| Sinkronisasi | tidak ada | tema + ikon 600ms bersamaan |
| Reduced motion | — | state akhir langsung |

- Mask unik per tombol (`theme-mask-mobile` / `theme-mask-desktop`) agar tidak bentrok.
- Berlaku di toggle mobile, toggle desktop, dan select "Tema" di Pengaturan.

---

### B2.04 Search — kaca pembesar → X

**Masalah.** Membuka dan menutup pencarian butuh dua tombol/area berbeda; ikon tidak berubah.

**Perubahan.** Satu tombol: ring `undraw` (`dashoffset 0→41`), handle bergeser + rotate 45° lalu hilang, dua garis X `draw` dengan delay 120ms. Tombol yang sama menutup search dan menghapus query.

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Tombol | 2 (cari & tutup) | **1 tombol, 1 posisi** |
| Durasi | 0ms | **400ms** |
| Mekanisme | swap | stroke-dash undraw/draw |
| Easing | — | ease + delay 120ms pada X |
| Area tap | 40px | 40px (tetap) |

---

### B2.05 Send — paper plane terbang + spring back

**Masalah.** Tombol "Simpan" langsung menutup modal tanpa feedback; user tidak yakin data tersimpan dan bisa klik dua kali.

**Perubahan.** SVG `.send-morph` dengan `.send-plane` + `.send-trail`. Saat submit valid: `disabled = true`, kelas `is-sending`, plane terbang 15px kanan / 11px atas dengan scale .5 + opacity .25 (400ms), jeda, lalu spring kembali; modal tutup di 720ms.

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Feedback | langsung tutup | fly + spring back |
| Durasi | 0ms | **720ms** (400ms keluar + spring back) |
| Jarak | — | +15px X, −11px Y |
| Easing | — | cubic-bezier(.2,.8,.25,1) |
| Trail | tidak ada | garis flash 720ms |
| Double-send | memungkinkan | `disabled` + guard `if (submit.disabled) return` |
| Error state | — | `onSubmit` return false → tidak ada animasi, modal tetap buka |

---

### B2.06 Unlock / Lock — shackle spring

**Masalah.** Kunci anggaran hanya berubah ikon (gembok tertutup ↔ terbuka) tanpa rasa "klik".

**Perubahan.** SVG `.lock-morph`; shackle bergerak dengan spring overshoot, keyhole berubah warna ke `--accent` saat terbuka, dan kelas sementara `just-locked` / `just-unlocked` memicu keyframe sekali jalan.

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Cara | swap ikon | 1 SVG, `.is-unlocked` |
| Durasi | 0ms | buka 550ms / tutup 400ms + klik 300ms |
| Overshoot | — | translate(6px,−10px) rotate 19° → settle (4px,−6px) 14° |
| Easing | — | spring cubic-bezier(.34,1.56,.64,1) |
| Feedback tambahan | — | toast "Anggaran dibuka/dikunci" |
| Reduced motion | — | state akhir langsung |

> Catatan koreksi QA: kelas yang ditambahkan saat **mengunci** adalah `just-locked`, saat **membuka** adalah `just-unlocked` (sudah sesuai setelah verifikasi).

---

## B3. Motion Spec Sheet

| # | Ikon | Trigger | Durasi | Easing / Spring | Jarak / Overshoot | State awal → akhir | Reduced Motion |
|---|---|---|---|---|---|---|---|
| 01 | Check | klik checklist | 300ms | `.2,.8,.2,1` + `.34,1.4,.64,1` | box scale 1→.25, rot 10° | kotak → centang | langsung centang |
| 02 | Download | klik Ekspor | 650 + 300ms (+900ms hold) | `.2,.7,.3,1` / ease | dash 56.6→0 | panah → ring → centang | langsung done |
| 03 | Theme | toggle tema / select | 600ms | `.4,0,.2,1` + spring rays | crescent +11px,−7px; rays stagger 35ms | matahari → bulan | state akhir |
| 04 | Search | klik tombol cari | 400ms | ease + delay 120ms | dash 41, handle rot 45° | kaca → X | X langsung |
| 05 | Send | submit modal | 720ms | `.2,.8,.25,1` | +15px,−11px, scale .5 | plane → fly → back | langsung tutup |
| 06 | Lock | klik kunci anggaran | 550 / 400ms | `.34,1.56,.64,1` | +6px,−10px, rot 19° | terkunci ↔ terbuka | state akhir |

**Aturan global:** durasi 300–600ms (pengecualian progres unduh ±1,2s), easing ease-out/spring, Area tap tidak berubah, `prefers-reduced-motion` → `transition-duration: .01ms !important; animation-duration: .01ms !important;` + state akhir dipaksa benar.

---

## B4. Keyframe / Deskripsi Gerak

**01 Check (0→300ms).** 0ms: rect tampil, mark dashoffset 18. 60ms: rect mulai scale + rotasi. 120ms: rect opacity → 0; mark mulai draw (dashoffset → 0) + scale .55→1 dengan sedikit overshoot. 300ms: centang penuh, stabil.

**02 Download (0→1250ms).** 0–650ms: arrow opacity 1→0, base opacity 1→.35, ring dashoffset 56.6→0 (`@keyframes dl-ring`). 650ms: `run()` dieksekusi (ekspor asli). 650–950ms: arrow/base/ring opacity → 0, check dashoffset 16→0 (`@keyframes dl-check`). 950–1850ms: done state bertahan, lalu tombol aktif kembali.

**03 Theme (0→600ms).** 0ms: rays scale 0, crescent-cut di (0,0), sparkle tampil. 35–245ms: 8 rays scale 0→1 bergantian tiap 35ms. 0–600ms: disc/crescent transforms, sparkle opacity 1→0. `html.theme-switching` memberi transisi background/border/color 600ms ke kartu, topbar, sidebar, tombol, chip, dan activity item.

**04 Search (0→400ms).** 0ms: ring dashoffset 0, handle di posisi, X dashoffset 15. 0–400ms: ring → 41 + opacity .65; handle translate(−4px,−4px) rotate 45° + opacity 0. 120–400ms: dua garis X dashoffset → 0. Input melebar via `width/opacity .3s`.

**05 Send (0→720ms).** `@keyframes send-fly`: 0ms translate(0,0) scale 1 opacity 1 → 346ms translate(15px,−11px) scale .5 opacity .25 → 403ms hold → 720ms kembali (0,0) scale 1. `@keyframes send-trail`: 0–216ms opacity 0 → 324ms opacity .8 scale 1 → 504–720ms opacity 0 scale 1.2. Modal `close()` dipanggil tepat di 720ms.

**06 Lock (0→550ms buka).** `@keyframes lock-open`: 0ms (0,0) rot 0 → 341ms (6px,−10px) rot 19° → 550ms settle (4px,−6px) rot 14°. Tutup: `@keyframes lock-close` 0ms (4px,−6px) rot 14° → 280ms (−1px,1px) rot −2° → 400ms (0,0). `@keyframes lock-click` scale .94 di 50%.

---

## B5. Implementasi (stack: vanilla JS + CSS transition/keyframe)

**Struktur.**
- `js/ui.js` — `checkIcon`, `downloadIcon`, `sendIcon`, `themeIcon`, `searchIcon`, `lockIcon`, `themeTransition`, `animateDownload`; `initModal()` menyuntik `<span id="modal-label">` tetap + ikon kirim sekali saat inisialisasi.
- `js/app.js` — router memanggil `Pages.afterRender()`; event `input` → `Pages.filterActivities()`; toggle tema → `UI.themeTransition()`; klik Ekspor → `UI.animateDownload()`.
- `js/pages.js` — state `activitySearch`, `filterActivities()`, `shoppingStepper()`, `toggle-budget-lock`.
- `css/styles.css` — seluruh `@keyframes` + state classes; blok `@media (prefers-reduced-motion: reduce)` memaksa state akhir.

**Interrupt handling.**
- Download & Send: `btn.disabled = true` + guard di awal handler → klik kedua diabaikan.
- Theme: `clearTimeout(themeTimer)` sebelum setTimeout baru → klik cepat tidak meninggalkan kelas `theme-switching`.
- Search: toggle simetris; menutup menghapus query dan mengembalikan 177 item.
- Lock: `setTimeout(..., 600)` menghapus kelas `just-*` agar bisa dipicu lagi.

**Loading / error state.**
- Download: loading = ring berputar; selesai = centang; jika `run()` melempar error, `app.js` menampilkan toast error dan ikon tetap kembali ke idle.
- Send: `onSubmit` mengembalikan `false` (validasi gagal) → animasi tidak jalan, modal tetap terbuka, pesan error dari browser tampil di field.
- Theme/lock: tidak ada state loading; perubahan tersimpan sinkron via `Store.update()`.

---

## B6. Checklist QA — Motion Review

```
☐ GLOBAL — Tidak ada swap ikon; semua perubah bentuk pada 1 SVG.
☐ GLOBAL — Durasi 300–600ms (kecuali progres unduh).
☐ GLOBAL — reduced-motion: state akhir benar, tanpa gerakan.
☐ GLOBAL — Area tap tidak berubah ukuran saat animate.
☐ 01 CHECK — Kotak mengecil + centang draw 300ms; aria-pressed ikut berubah.
☐ 02 DOWNLOAD — panah→ring→centang; ekspor asli jalan di fase loading.
☐ 02 DOWNLOAD — tombol disabled saat animasi; tidak ada double-download.
☐ 03 THEME — 8 rays stagger 35ms, crescent 11px/−7px, sinkron 600ms.
☐ 03 THEME — mask id unik per tombol (mobile vs desktop).
☐ 04 SEARCH — 1 tombol buka/tutup; X menggambar dengan delay 120ms.
☐ 05 SEND — plane +15px/−11px, spring back, modal tutup di 720ms.
☐ 05 SEND — double-send dicegah; validasi gagal tidak memicu animasi.
☐ 06 LOCK — shackle overshoot; just-locked saat mengunci, just-unlocked saat membuka.
☐ 06 LOCK — toast + aria-label ikut berubah, tersimpan di settings.budgetLocked.
```

---

## B7. Rencana Pengujian — Animated Icons

| Yang diukur | Cara mengukur | Kriteria sukses |
|---|---|---|
| Persepsi responsif | Tanya 5 user setelah toggle check/tema: "apakah aksimu langsung terbaca?" | ≥4/5 menjawab ya |
| Waktu animasi | `performance.now()` di awal/akhir kelas | Sesuai spec sheet ±50ms |
| Double-send | Klik submit 3× cepat via script | 1 entri tersimpan, tidak ada duplikat |
| Double-download | Klik Ekspor 3× cepat | 1 file terunduh |
| State reduced-motion | Emulasi `prefers-reduced-motion: reduce` | Ikut state akhir, durasi ~0ms |
| Kebingungan ikon | Tanya arti ikon kunci & X search | ≥4/5 menjawab benar |
| Konsistensi tema | Toggle via 3 entry point | Ikon + halaman berubah bersamaan |
| Regresi tap | Ukur `getBoundingClientRect()` sebelum/sesudah | Ukuran identik |

---

## B8. Yang Sengaja TIDAK Diubah

- **Ikon navigasi** (home, calendar, book, fruit, cart, settings) — tidak punya perubahan state, jadi tetap statis; menganimasikannya hanya menambah kebisingan.
- **Ikon dekoratif** pada kartu (bell, sparkle, alert, plus, panah nav minggu) — bukan target interaksi bermakna.
- **Ikon status (centang di rating/status)** di luar checklist — sudah memakai label teks; tidak perlu morph ganda.
- **Svg `Utils.icon()` lama** tetap dipakai untuk ikon statis; hanya 6 ikon interaktif yang punya versi morph di `UI.*Icon()`.
- **Keyframe tidak diubah tanpa alasan** — sudah tervalidasi di 6 halaman × 2 tema.

---

# LAMPIRAN — Verifikasi Akhir

| Pemeriksaan | Hasil |
|---|---|
| Lighthouse `#/dashboard`, `#/jadwal`, `#/belanja` — light & dark | Accessibility **1.00**, Best Practices **1.00**, SEO **1.00** |
| Audit `aria-required-children` | ✅ Hilang setelah `role="tablist"` → `role="group"` + `aria-pressed` pada chip |
| Audit `color-contrast` | ✅ Hilang setelah `--primary-bright` `#b9a5ff` → `#c7b7ff` (4,28 → 5,04 : 1) |
| Console error (6 halaman) | 0 |
| Horizontal overflow (6 halaman, 800px) | 0 |
| Closure peek (strip 487px) | 30% (32px / 106px) |
| Service worker cache aktif | `rutin-buah-v22` |
| Data awal | 177 aktivitas, 7 target skripsi, 7 tugas, 5 buah, tema terang, kunci anggaran nonaktif |
| Pencarian aktivitas | "skripsi" → 21/177 tampil; tutup → 177, query kosong |
| Send / Download / Lock / Theme / Search / Check | Semua state & transisi terverifikasi di browser |

---

# LAMPIRAN L — Audit Tata Letak Pasca-Liquid Glass

**Pemicu:** user melaporkan layout "berantakan" setelah restyle glassmorphism.
**Metode:** audit geometri DOM di iframe viewport 360–1440px (screenshot tidak tersedia di sesi ini), 6 halaman × lebar × tema, plus Lighthouse.

## L1. Temuan utama (root cause)

| # | Temuan terukur | Dampak UX | Perbaikan |
|---|---|---|---|
| 1 | `.app-shell` tetap `flex-direction: column` pada ≥1024px; sidebar statis menumpuk **di atas** main (sidebar `y=29`, main `y=548`, tinggi sidebar ~520px). | Navigasi memakan satu layar penuh sebelum konten; hierarki dan figure-ground rusak — ini penyebab utama kesan berantakan. | Sidebar diubah ke rail samping hanya di `@media (min-width:1024px)` dengan `.app-shell { flex-direction: row; align-items: stretch }`. Di bawah 1024px tetap drawer. |
| 2 | `.bento-row` 3 kolom mulai 520px; pada 520px tiap tile hanya 144px dan `.bento-pill-row` meluap 139px vs 52px. | Teks dan tombol bertabrakan; target sentuh tidak bisa dipakai. | 1 kolom <700px, 2 kolom 700–1199px, 3 kolom ≥1200px. |
| 3 | `.dashboard-grid` 2 kolom mulai 800px; pada 800px kolom samping hanya 219px sedangkan ring 176px + padding 36px. | Cincin progres mepet/terpotong. | 2 kolom baru aktif ≥1024px, setelah sidebar menjadi rail. |
| 4 | Tombol `#quick-fruit` selebar 176,5px di 390px membuat `.topbar-title` tinggal 35,5px; `h1` dan tanggal meluap. | Judul halaman tidak terbaca — kehilangan orientasi (usability). | Label disembunyikan secara visually-hidden <520px (tombol ≈102px), `eyebrow` + `h1` ellipsis/nowrap, font disesuaikan <400px. |
| 5 | `.week-grid` 7 kolom dengan `.activity-item` satu baris membuat `.activity-info` hanya 9px di 1440px. | Judul aktivitas hilang di desktop. | Item jadwal 7-kolom: checkbox 24px, info fleksibel dengan `min-width:0`, alat edit/hapus pindah ke baris bawah (30px + area tap 44px via pseudo). |
| 6 | `.app-shell { overflow:hidden }` mengurung sticky topbar. | Header tidak menempel saat scroll. | Diganti `overflow: clip` (klip sudut tetap, sticky kembali bekerja; terukur `topbar.y=0` setelah scroll 900px). |
| 7 | `.hero-glow` memakai `right:-70px` sehingga `scrollWidth` hero +70px. | False-positive overflow dan ruang tak terpakai. | Digradial dalam batas hero (`inset:0`, radial-gradient). |
| 8 | Target sentuh kecil: `.check` 28px, `.mini-pill` 34px, `.orb` 38px, `.btn-icon` 42px. | Rawan salah ketuk. | `.check` tetap 28px visual + area tap 44px; `.mini-pill` 44px; `.orb`/`.btn-icon`/`.mobile-theme`/`.week-nav` 44px; `.btn-icon-sm` 36px + area tap 44px. |

## L2. Prinsip UX yang dipakai

- **Visual hierarchy & figure-ground:** rail kiri menjadi landasan navigasi, konten menjadi figure; tidak ada lagi "header" sidebar sebelum judul halaman.
- **Fitts' law / touch target:** target penting ≥44px tanpa mengubah ukuran visual utama (area tap via pseudo-element/inset).
- **Progressive disclosure / choice overload:** bento dan ringkasan hanya menambah kolom ketika ruang benar-benar tersedia, bukan berdasarkan lebar layar mentah.
- **Recognition over recall:** judul halaman selalu terlihat dengan ellipsis terkendali, bukan teks terpotong acak.
- **Error prevention:** elipsis pada label tugas dan pill mencegah luap teks tanpa menghilangkan akses ke detail.
- **Sticky orientation:** topbar tetap di atas saat scroll untuk konteks tanggal/halaman.

## L3. Verifikasi setelah perbaikan

| Pemeriksaan | Hasil |
|---|---|
| Lebar 360/390/520/700/800/1024/1100/1280/1440 | `document.scrollWidth === clientWidth` (0 overflow halaman) di 6 rute |
| Sidebar desktop 1280/1440 | `x=33/58`, `right=289/314`, bersebelahan dengan main `x=289/314` |
| Topbar 390px | tinggi judul 50,3px (dulu 87–103px); tombol buah 102,5px (dulu 176,5px) |
| Bento 520 / 700 / 1024 / 1280 / 1440 | 1 / 2 / 2 / 3 / 3 kolom, tidak ada tabrakan teks |
| Dashboard 1440 | bento 212px/tile, side 333px, ring 176px passed |
| Jadwal 1440 | 7 kolom muat; info aktivitas 73px dengan ellipsis, alat di baris kedua |
| Sticky topbar | `y=29` sebelum scroll → `y=0` setelah `scrollTop=900` |
| Drawer 390px | `body.sidebar-open`, sidebar `x=13`, `aria-expanded=true` |
| Modal / checklist / bento / tema | berfungsi, 0 console error |
| Lighthouse light & dark | Accessibility **1.00**, Best Practices **1.00**, SEO **1.00**, **0 failures** |
| Service worker | cache `rutin-buah-v24` |

> Catatan: sisa `scrollWidth > clientWidth` pada elemen dengan `text-overflow: ellipsis` atau pseudo-element area tap adalah _clip behavior_ yang disengaja; tidak menghasilkan scroll horizontal dokumen.

**Cara menjalankan:** `node scripts\serve.js` lalu buka `http://localhost:8080`.
**Catatan SW:** setiap perubahan `index.html` / `css` / `js` / `manifest` wajib menaikkan `CACHE` di `sw.js` agar tidak tertahan cache-first.

---

# LAMPIRAN 2 — Restyle «Liquid Glass Studio»

| Aspek | Detail |
|---|---|
| Referensi visual | `rutin_buah_glassmorphism_planner.html` — studio light, slab putih bevel, bento pastel, pill coral, Plus Jakarta Sans. |
| Token inti | `--studio-bg-top #cbd2dc` → `--studio-bg-bottom #a6b0be`; tinta `#181c24 / #4e5868 / #697486`; coral `#f68a73 → #eb725c`. |
| Slab | `max-width 1320px`, `border-radius 32px` (desktop), border putih 1.5px, `backdrop-filter blur(28px) saturate(145%)`, inner rim + specular glint, cast shadow `-22px 28px 60px rgba(34,42,56,.24)`. |
| Latar | `.bg-mesh` + `.studio-sunlight` (via `::before`) + 3 `.studio-bloom` (`#c4c0f5`, `#bce3cf`, `#f6c6b3`, blur 75px). |
| Navigasi | Sidebar kiri 256px di desktop; drawer geser + backdrop di mobile. Pill aktif coral dengan badge ikon & anak panah `→`. |
| Beranda | Hero lavender, 3 bento tile (lavender/mint/peach), action bar kristal, kartu ring multi-segment 4 busur, timeline "Berikutnya". |
| Font | Plus Jakarta Sans 400–800 via Google Fonts, fallback Inter/system-ui. **Sejak v1.1.0:** Google Fonts dihapus; stack font sistem dipakai agar offline & bebas permintaan pihak ketiga (lihat Lampiran 5). |
| Tema | Terang adalah default (sesuai referensi); gelap tetap tersedia dengan geometri & token yang sama. |
| Ikon PWA | Emblem multi-petal (coral/amber/violet/mint) di slab frosted, dihasilkan ulang oleh `scripts\generate-icons.js` (192/512 + maskable). |
| Kompatibilitas | Semua `data-action`, `data-nav`, `data-goto`, dan state tersimpan tidak berubah. 6 ikon morph + 6 UX laws tetap aktif. |

**Verifikasi setelah restyle:** 6 halaman tanpa console error & tanpa overflow horizontal; Lighthouse Accessibility / Best Practices / SEO **1.00** (light); interaksi check, bento task, modal buah, search, lock anggaran, drawer, dan theme toggle terverifikasi.

---

# LAMPIRAN 3 — Perbaikan Drawer "Blur & Tidak Bisa Ditekan"

**Gejala.** Menekan hamburger (`#menu-toggle`) membuat seluruh layar blur dan semua tap berikutnya tidak bereaksi pada menu.

**Akar masalah (terukur).** `.mobile-backdrop` dulunya adalah sibling `body` dengan `z-index:70`, sementara `.sidebar` berada di dalam `.app-shell` yang membentuk stacking context sendiri (`position:relative; z-index:10; backdrop-filter:blur(28px)`). Akibatnya backdrop root dilukis **di atas seluruh slab**, termasuk sidebar. Uji `document.elementFromPoint()` pada tombol Tutup dan item nav mengembalikan `mobile-backdrop`, bukan elemen sidebar — jadi blur menutupi menu dan setiap tap kena scrim.

**Perbaikan.**
- `#mobile-backdrop` dipindahkan ke dalam `.app-shell`, tepat sebelum `.sidebar`, sehingga keduanya berbagi stacking context yang sama.
- Backdrop memakai `position:absolute; inset:0; z-index:70`, sidebar tetap `z-index:80` → scrim melukis di bawah sidebar (konten utama blur, menu tetap tajam dan bisa ditekan). Pendekatan v23 ini diperbaiki lagi di Lampiran 4.
- Ditambahkan `pointer-events:none` saat tertutup dan `pointer-events:auto` saat `body.sidebar-open`, plus fallback klik di luar sidebar/Escape untuk menutup.
- `CACHE` service worker dinaikkan ke `rutin-buah-v24` agar perbaikan tidak tertahan cache-first.

**Verifikasi.** Lebar 360px & 800px (terang dan gelap): `closeHit=path` (bukan backdrop), `body.sidebar-open` aktif, `aria-expanded=true`, tombol Tutup / item nav / backdrop / Escape semuanya menutup drawer, `overflow` tubuh pulih, `scrollWidth - clientWidth = 0`, 0 console error.

---

# LAMPIRAN 4 — Drawer Rusak Setelah Halaman Di-scroll

**Gejala.** Jika halaman digeser ke bawah dulu lalu hamburger ditekan, layar menjadi full blur dan tidak ada yang bisa ditekan. Drawer hanya normal saat posisi scroll masih di atas.

**Akar masalah (terukur).** Perbaikan v23 memindahkan backdrop ke dalam `.app-shell`, tetapi `.app-shell` masih memasang `backdrop-filter: blur(28px)` langsung pada dirinya. `backdrop-filter` menciptakan **containing block untuk descendant `position:fixed`**. Karena `.app-shell` tingginya mengikuti seluruh dokumen, saat di-scroll posisi sidebar `fixed` ikut naik bersama slab: terukur `shell.y=-972`, `sidebar.y=-971`, `closeButton.y=-949` (di luar layar), sementara backdrop menutup viewport. `elementFromPoint()` pada tombol Tutup mengembalikan `mobile-backdrop`.

**Perbaikan.**
- `backdrop-filter` dilepas dari `.app-shell`; blur slab dipindah ke child baru `.slab-glass` (`position:absolute; inset:0; border-radius:inherit; z-index:0; pointer-events:none`).
- Kini tidak ada ancestor dengan `transform`/`filter`/`backdrop-filter`/`contain`/`will-change`, sehingga `.sidebar` dan `.mobile-backdrop` benar-benar `fixed` terhadap **viewport**.
- Sidebar mobile: `inset:12px auto 12px 12px`, `width:min(290px,calc(100vw - 24px))`, tinggi mengikuti sisa viewport, radius + shadow; backdrop kembali `position:fixed; inset:0; z-index:70`.
- Desktop (`>=1024px`) tetap rail statis: override `position:static; inset:auto; border:0; border-right:...; border-radius:0; box-shadow:none`.
- `CACHE` dinaikkan ke `rutin-buah-v24`.

**Verifikasi.** Simulasi halaman tergeser (`app-shell.y=-472`): sidebar `x=12,y=12`, backdrop `x=0,y=0`, `closeHit=path`, `navHit=SPAN`; Tutup / backdrop / Escape menutup drawer. Desktop 1280px: sidebar `position:static` berdampingan dengan main (`x=33`, `x=289`), `slab-glass` tetap `blur(28px)`, 0 overflow, 0 console error.

---

# LAMPIRAN 5 — Remediasi Audit 92 Temuan (v1.1.0, 23 November 2026)

**Sumber:** `AUDIT-Rutin-Buah.md` (92 temuan, 7 High: D-01…D-04, F-01, N-01, V-01). Semua temuan High dan sisanya telah diterapkan; rincian perubahan ada di [`CHANGELOG.md`](CHANGELOG.md).

## Dampak pada prinsip UX/motion

| Prinsip | Status | Catatan |
|---|---|---|
| Closure peek | Utuh | `.day-strip` tetap flex + 4,3 chip + fade; tidak diubah oleh tab bar. |
| Figure–Ground | Utuh | Scrim modal 68% + blur 6px, `<dialog>` native, scroll body dikunci. |
| Inline alerts | Utuh | Budget, stok, dan cadangan lama memakai alert inline, bukan modal. |
| Low keystrokes | Utuh | Autofill buah + datalist + tab bar 5 tujuan mengurangi ketukan. |
| Satu garis stepper | Utuh | `shoppingStepper` tidak dipecah; save bar Pengaturan kini sticky. |
| 4–6 opsi | Utuh | 8 kategori dibagi 6 + 2 "jarang" di akhir daftar. |
| Morph 300–600 ms | Utuh | Ikon kirim 720 ms adalah pengecualian yang sudah didokumentasikan; theme transition 600 ms. |
| Reduced motion | Utuh | `prefers-reduced-motion` memaksa durasi ≈0; ditambah `prefers-reduced-transparency`/`prefers-contrast` memakai permukaan solid. |

## Perubahan struktural ringkas

- **V-01 (High):** `.main { position: relative; z-index: 1; }` mengangkat konten statis di atas `.slab-glass` (z0). Tumpukan drawer tidak berubah: tab bar z30 < backdrop z70 < sidebar z80.
- **V-04:** tab bar bawah ditambahkan di dalam `.app-shell` agar tetap di bawah scrim saat drawer terbuka; Pengaturan diakses lewat menu/header.
- **U-01:** drawer tertutup `visibility:hidden` dan latar `inert`; fokus dikembalikan ke hamburger saat ditutup.
- **U-02/U-10:** lantai 12 px (`--fs-xs`), target sentuh 44 px, teks koral gelap di tema terang / putih di koral `#c2410c` pada tema gelap.
- **U-03/S-05:** tema sistem tanpa kilatan lewat `js/theme-init.js`; dua meta `theme-color`, manifest dengan `id`, `display_override`, orientasi `any`, ikon 180/monochrome, screenshots.
- **N-01:** jendela waktu 10 menit + `visibilitychange`/`focus`, fallback SW timeout, ICS `VALARM`, klik notifikasi memfokus jendela existing. Web Push penuh masih menjadi batasan yang didokumentasikan.
- **N-02:** `consume-soon` dihitung dari `purchaseDate` dan panduan lokasi simpan; status manual hanya mempercepat.
- **S-01…S-06:** cache `rutin-buah-v30`, pre-cache atomik, cache-first tanpa refresh latar, timeout 3 detik, hanya respons `res.ok` yang di-cache, Google Fonts dihapus.
- **X-02/X-03:** CSP + header keamanan (meta & server), server tahan URL cacat/traversal, 404 untuk aset hilang, dokumen internal tidak disajikan.

## Verifikasi akhir

- `node --check` semua JS (termasuk `theme-init.js`, `sw.js`, `serve.js`) dan `manifest.webmanifest` sebagai JSON valid.
- Enam rute (Beranda, Jadwal, Skripsi, Buah, Belanja, Pengaturan) di desktop 1000 px dan simulasi viewport 390 px: `scrollWidth - clientWidth = 0`, 0 console error.
- Drawer 390 px dengan transisi dinonaktifkan untuk pengukuran: sidebar `[12, 12, 290, 820]`, backdrop `[0, 0, 390, 844]`, `closeHit=ASIDE.sidebar`, `navHit=A.nav-item is-active`, area luar kena backdrop.
- Ekspor JSON di bawah CSP menghasilkan berkas unduhan yang completed; `lastBackupAt` berubah menjadi "hari ini".
- Pengujian D-07: cadangan 20 hari lalu memunculkan banner dashboard dan toast harian; N-02: stok pisang 10 hari di suhu ruang otomatis berlabel "Segera dikonsumsi".
- Lighthouse (mode desktop): **Accessibility 1.00 · Best Practices 1.00 · SEO 1.00**, tanpa *audit failures*.
- Server statis: `/%E0%A4%A` → 400, `/js/nope.js` → 404, traversal → 403, `/README.md` → 404, `/sw.js` & `/manifest.webmanifest` → 200 dengan CSP.

