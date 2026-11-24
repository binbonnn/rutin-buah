# Skema State Lokal — `rutin-buah:v1`

Dokumen ini merangkum bentuk data yang disimpan di `localStorage` dengan kunci **`rutin-buah:v1`**. Aplikasi memakai `SCHEMA_VERSION = 4` (`APP_VERSION = 1.2.3`). State dibaca lewat `Store.normalizeState()` dan dimigrasi otomatis oleh `Store.migrate()`; jangan mengedit kunci ini langsung kecuali untuk pengujian.

## Bentuk umum

```js
{
  version: 4,
  settings: {
    name, theme: 'system' | 'light' | 'dark', onboarded: boolean,
    timezone: string,              // kompatibilitas lama; tidak dipakai UI
    wakeUpTime: 'HH.mm', subuhTime, bedtime, workStartTime, workEndTime,
    overtimeEndTime, fruit1Time, fruit2Time,
    walkMinutes, workoutMinutes, commuteMinutes,
    weeklyBudget: number, budgetLocked: boolean, dailyFruitTarget: number,
    seminarDate: 'YYYY-MM-DD' | '', thesisTopic: string,
    shoppingDays: { main: 1..7, refill: 1..7 },
    markGraceMinutes: 0..30,        // toleransi Jendela Aktif, default 10
    strictSince: 'YYYY-MM-DD',      // Senin pekan berjalan; tanggal sebelumnya memakai jalur lama
    notifications: {
      enabled, activity, fruit, shopping, lowStock, bedtime, review: boolean,
      activityLeadMinutes: number,
      shoppingTimeMain, shoppingTimeRefill: 'HH.mm'
    }
  },
  activities: [ /* template aktivitas mingguan */ ],
  completion: { 'YYYY-MM-DD': { [activityId]: record } },
  firstUseAt: ISODateString,                // v4: kapan aplikasi pertama dipakai
  dayPlans: {                               // v4: jadwal harian yang dibekukan, maks. 35 hari
    'YYYY-MM-DD': [{ id, title, startTime, endTime, category }]
  },
  weeklyReviews: { 'YYYY-MM-DD': review },  // kunci = Senin minggu tersebut
  restDays: ['YYYY-MM-DD'],                 // maks. 2 per minggu
  customTargets: { [1..7]: string },
  tasks: [ /* tugas skripsi */ ],
  mentorshipNotes: string,
  fruitCatalog: [ /* jenis buah + panduan penyimpanan */ ],
  inventory: [ /* stok buah */ ],
  consumption: [ /* riwayat konsumsi */ ],
  shopping: [ /* item belanja per minggu */ ],
  generatedWeeks: ['YYYY-MM-DD'],
  deletedTemplateIds: [activityId],
  reminders: { 'YYYY-MM-DD:main|refill': { status, at } },  // kunci = Senin
  notified: { 'YYYY-MM-DD:...': true },
  lastBackupAt: ISODateString | '',
  updatedAt: ISODateString
}
```

### Record `completion` (v3)

```js
{
  s: 'inprogress' | 'completed' | 'skipped' | 'excused',
  startedAt: ISODateString | null,  // diisi saat "Mulai"
  at: ISODateString | null,         // waktu perubahan terakhir
  src: 'live' | 'grace' | 'legacy' | 'rest',
  title: string | null,             // snapshot agar aktivitas yang dihapus tetap dikenali
  startTime: 'HH.mm' | null
}
```

String lama (`'completed'` / `'skipped'`) masih dibaca oleh `Store.statusOf()` dan dinormalisasi menjadi `{ s, at: null, src: 'legacy' }` saat migrasi. **Semua pembaca status wajib memakai `Store.statusOf()`**, bukan `rec.s` langsung.

### Snapshot `weeklyReviews`

```js
{
  weekKey: 'YYYY-MM-DD',            // Senin
  isoWeek: 'YYYY-Www',              // hanya label/nama berkas
  status: 'preview' | 'final',
  ruleVersion: 4,
  generatedAt, expiresAt: ISODateString,
  seen: boolean, downloadedAt: ISODateString | null, downloadedFormat: 'md' | null,
  score: 0..100, done, total, unfinished, skippedCount, excusedCount, waitingCount,
  items: [{ date, id, title, time, duration, reason }],
  waiting: [{ date, id, title, time, reason: 'Menunggu' }], // pratinjau: jam belum tiba
  skippedItems: [{ date, id, title, time }],
  daily: [{ key, label, done, total, pct }],
  insights: [/* maksimal 3 */],
  plan: [{ id, activityId, date, title, time, action, accepted, skipped }] // maksimal 5
}
```

`preview` dibuat Minggu 21.00, `final` menggantikannya Senin 09.00. Snapshot final tidak dihitung ulang (B.4). `expiresAt` = 28 hari setelah pembuatan. Tidak ada laporan untuk minggu yang seluruhnya sebelum `firstUseAt`; pada minggu pertama laporan baru dibuat bila ada catatan `completion`. `waiting` hanya diisi pada `preview` dan tidak ikut dihitung dalam `total`.

## Invarian penting

- **Waktu** disimpan sebagai `HH.mm` (titik, bukan titik dua). `Utils.parseTime` menolak format salah; `fmtTimeColon` dipakai untuk input `<input type="time">`.
- **Tanggal** memakai `YYYY-MM-DD` (`Utils.dateKey` / `Utils.fromKey`). Minggu juga dikunci ke tanggal **Senin**; label ISO `YYYY-Www` hanya dipakai untuk nama berkas dan kunci pengingat lama.
- **Aktivitas** memiliki `id` stabil dan `templateId`. `isRecurring !== false` berarti aktivitas muncul tiap minggu; jika `false`, hanya muncul pada `date`-nya. `applyTemplate()` menjamin ID unik dan melewati aktivitas yang telah diedit/dihapus.
- **Jendela Aktif** (untuk tanggal ≥ `strictSince`, default = Senin pekan berjalan):
  - `opensAt = tanggal + startTime`
  - `closesAt = max(tanggal + endTime, opensAt + 10 menit)`; jika `endTime < startTime`, endTime dianggap hari berikutnya. Jika `endTime === startTime` (durasi 0), tetap dipakai minimum 10 menit.
  - `lastTick = closesAt + markGraceMinutes`
  - `canMark = now >= opensAt && now < lastTick`, dan ditolak bila `now >= lastTick` meski tombol masih terlihat.
  - Status tampilan (`Store.activityStatus()`) memakai jendela yang sama: `upcoming` sebelum `opensAt`, `ongoing` sampai `closesAt`, `grace` (“Segera tutup”) sampai `lastTick`, lalu `missed`. Tidak ada perhitungan jam kedua di UI.
  - Aktivitas dengan durasi ≥ 20 menit wajib `inprogress` terlebih dahulu sebelum `completed`; aturan ini juga dijaga di `Store.canMark()`.
  - Tanggal sebelum `strictSince` memakai jalur lama (`legacy`) tanpa jendela, agar riwayat tidak berubah.
- **`completion`** selalu per tanggal dan **tidak** dibatasi retensi. Aktivitas yang dihapus tidak dihapus dari `completion` lama.
- **`restDays`** maksimal 2 per minggu, hanya untuk hari berjalan, dan dikecualikan dari perhitungan skor (`s: 'excused'`). Hari istirahat tidak boleh menimpa catatan `completed`/`inprogress`/`skipped`; membatalkannya hanya menghapus `excused` yang ber-`src: 'rest'`.
- **`dayPlans`** berisi jadwal harian yang dibekukan sekali saat hari tersebut sudah lewat (maksimal 35 hari). `buildReview()` memakainya sebagai sumber jadwal agar edit di masa kini tidak mengubah laporan lama; `completion` tidak pernah dibekukan atau dipangkas.
- **Retensi laporan**: hanya 4 laporan `final` terbaru yang disimpan, dengan batas keras 8 laporan `final` secara keseluruhan. Laporan kedaluwarsa yang **belum** dibuka sengaja ditahan agar tampil sekali, paling lambat 14 hari setelah `expiresAt`; setelah `seen = true`, `pruneReviews()` langsung menghapusnya. `completion` tidak ikut terhapus.
- **`shopping`** memiliki `id` unik per minggu dan `templateId` yang sama untuk item turunan. Tidak ada pemotongan senyap: `generatedWeeks` menentukan minggu yang sudah dibuat.
- **`inventory`** menyimpan `quantityRemaining`, `unit`, `servingSize`, `servingUnit`, `purchaseDate`, dan `storageLocation`. Status manual `consume-soon` mempercepat penandaan; selain itu penandaan dihitung otomatis dari usia stok dan panduan lokasi penyimpanan (`Store.consumeSoonReason`).
- **`notified`** dipangkas saat `load()` sehingga hanya 14 hari terakhir yang tersisa. Kunci pengingat cadangan memakai akhiran `:backup-reminder`.
- **`lastBackupAt`** diperbarui saat ekspor JSON (`Store.markBackup()`). Banner & toast muncul bila usia cadangan > 14 hari.
- **`settings.timezone`** tetap dibaca untuk kompatibilitas dengan cadangan lama, tetapi tidak lagi ditulis oleh UI.

## Log galat terpisah

`js/errlog.js` menyimpan maksimal 50 entri di `rutin-buah:errlog`, di luar state utama:

```js
[{ t, msg, src, line, stack, route, ver, kind: 'error' | 'rejection' }]
```

`stack` dibatasi 500 karakter. Teks dalam tanda kutip, tanggal, dan query URL disensor agar judul aktivitas/catatan tidak ikut tersimpan. Semua akses `localStorage` dibungkus `try/catch`; kegagalan menulis tidak boleh mengganggu aplikasi. Pengaturan → Diagnostik menyediakan unduh dan hapus log.

## Migrasi & cadangan

1. Sebelum state diubah, raw versi lama disalin ke `rutin-buah:v1:pre-migrate-v<from>` (`from` = nomor versi sumber). Hanya satu slot terbaru yang dipertahankan; slot lama dibersihkan pada migrasi berikutnya. Cadangan ini dibuat di `load()` dan `reloadFromStorage()`.
2. Cadangan lama (`version` < 2) dinormalisasi: item belanja dengan ID duplikat diberi `Utils.uid('shop')` dan `templateId` diisi dari `id`.
3. Cadangan `version` < 3: aktivitas dengan ID duplikat dibongkar (edit pengguna diutamakan) dan string `completion` lama diubah menjadi record v3.
4. Cadangan `version` < 4: `firstUseAt` diestimasi dari tanggal `completion` terawal, lalu `updatedAt`, lalu waktu migrasi. `dayPlans` dimulai kosong dan diisi saat laporan pertama kali disusun. Laporan lama tidak dihapus otomatis; tombol Pengaturan “Bersihkan laporan 0%” menghapus hanya laporan `final` 0% dari minggu sebelum `firstUseAt`.
5. Setiap migrasi menambah `weeklyReviews` & `restDays`, mengisi `strictSince` = Senin pekan berjalan bila kosong **atau masih di masa depan**, dan membatasi `markGraceMinutes` ke 0–30.
6. Jika parsed data cacat, raw disimpan di `rutin-buah:v1:corrupt-<timestamp>` dan aplikasi memakai state awal (safe mode menawarkan unduh data mentah).
7. Impor JSON divalidasi dengan `Store.describeImport()`; cadangan state saat ini ditulis ke `rutin-buah:v1:pre-import` sebelum ditimpa. Laporan evaluasi yang sudah kedaluwarsa dilewati dan tidak diperpanjang umurnya.
8. Ekspor JSON menghasilkan pembungkus `{ appVersion, schemaVersion, exportedAt, state }`. Laporan evaluasi hanya diekspor sebagai Markdown `.md`, bukan JSON importable.

## Contoh

```json
{
  "appVersion": "1.2.3",
  "schemaVersion": 4,
  "exportedAt": "2026-11-24T04:30:00.000Z",
  "state": {
    "version": 4,
    "settings": {
      "theme": "system",
      "markGraceMinutes": 10,
      "strictSince": "2026-11-23",
      "notifications": { "review": true }
    },
    "completion": {
      "2026-11-23": {
        "a1": { "s": "completed", "startedAt": null, "at": "2026-11-23T07:05:00.000Z", "src": "live", "title": "Subuh", "startTime": "04.10" }
      }
    },
    "firstUseAt": "2026-11-23T00:00:00.000Z",
    "dayPlans": {
      "2026-11-23": [{ "id": "a1", "title": "Subuh", "startTime": "04.10", "endTime": "04.30", "category": "Ibadah" }]
    },
    "weeklyReviews": {},
    "restDays": []
  }
}
```
