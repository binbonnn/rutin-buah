# Skema State Lokal — `rutin-buah:v1`

Dokumen ini merangkum bentuk data yang disimpan di `localStorage` dengan kunci **`rutin-buah:v1`**. Aplikasi memakai `SCHEMA_VERSION = 3` (`APP_VERSION = 1.2.1`). State dibaca lewat `Store.normalizeState()` dan dimigrasi otomatis oleh `Store.migrate()`; jangan mengedit kunci ini langsung kecuali untuk pengujian.

## Bentuk umum

```js
{
  version: 3,
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
  ruleVersion: 3,
  generatedAt, expiresAt: ISODateString,
  seen: boolean, downloadedAt: ISODateString | null, downloadedFormat: 'md' | null,
  score: 0..100, done, total, unfinished, skippedCount, excusedCount,
  items: [{ date, id, title, time, duration, reason }],
  skippedItems: [{ date, id, title, time }],
  daily: [{ key, label, done, total, pct }],
  insights: [/* maksimal 3 */],
  plan: [{ id, activityId, date, title, time, action, accepted, skipped }] // maksimal 5
}
```

`preview` dibuat Minggu 21.00, `final` menggantikannya Senin 09.00. Snapshot final tidak dihitung ulang (B.4). `expiresAt` = 28 hari setelah pembuatan.

## Invarian penting

- **Waktu** disimpan sebagai `HH.mm` (titik, bukan titik dua). `Utils.parseTime` menolak format salah; `fmtTimeColon` dipakai untuk input `<input type="time">`.
- **Tanggal** memakai `YYYY-MM-DD` (`Utils.dateKey` / `Utils.fromKey`). Minggu juga dikunci ke tanggal **Senin**; label ISO `YYYY-Www` hanya dipakai untuk nama berkas dan kunci pengingat lama.
- **Aktivitas** memiliki `id` stabil dan `templateId`. `isRecurring !== false` berarti aktivitas muncul tiap minggu; jika `false`, hanya muncul pada `date`-nya. `applyTemplate()` menjamin ID unik dan melewati aktivitas yang telah diedit/dihapus.
- **Jendela Aktif** (untuk tanggal ≥ `strictSince`, default = Senin pekan berjalan):
  - `opensAt = tanggal + startTime`
  - `closesAt = max(tanggal + endTime, opensAt + 10 menit)`; jika `endTime < startTime`, endTime dianggap hari berikutnya. Jika `endTime === startTime` (durasi 0), tetap dipakai minimum 10 menit.
  - `lastTick = closesAt + markGraceMinutes`
  - `canMark = now >= opensAt && now < lastTick`, dan ditolak bila `now >= lastTick` meski tombol masih terlihat.
  - Aktivitas dengan durasi ≥ 20 menit wajib `inprogress` terlebih dahulu sebelum `completed`; aturan ini juga dijaga di `Store.canMark()`.
  - Tanggal sebelum `strictSince` memakai jalur lama (`legacy`) tanpa jendela, agar riwayat tidak berubah.
- **`completion`** selalu per tanggal dan **tidak** dibatasi retensi. Aktivitas yang dihapus tidak dihapus dari `completion` lama.
- **`restDays`** maksimal 2 per minggu, hanya untuk hari berjalan, dan dikecualikan dari perhitungan skor (`s: 'excused'`).
- **Retensi laporan**: hanya 4 laporan `final` terbaru yang disimpan. Laporan kedaluwarsa yang **belum** dibuka sengaja ditahan agar tampil sekali; setelah `seen = true`, `pruneReviews()` langsung menghapusnya. `completion` tidak ikut terhapus.
- **`shopping`** memiliki `id` unik per minggu dan `templateId` yang sama untuk item turunan. Tidak ada pemotongan senyap: `generatedWeeks` menentukan minggu yang sudah dibuat.
- **`inventory`** menyimpan `quantityRemaining`, `unit`, `servingSize`, `servingUnit`, `purchaseDate`, dan `storageLocation`. Status manual `consume-soon` mempercepat penandaan; selain itu penandaan dihitung otomatis dari usia stok dan panduan lokasi penyimpanan (`Store.consumeSoonReason`).
- **`notified`** dipangkas saat `load()` sehingga hanya 14 hari terakhir yang tersisa. Kunci pengingat cadangan memakai akhiran `:backup-reminder`.
- **`lastBackupAt`** diperbarui saat ekspor JSON (`Store.markBackup()`). Banner & toast muncul bila usia cadangan > 14 hari.
- **`settings.timezone`** tetap dibaca untuk kompatibilitas dengan cadangan lama, tetapi tidak lagi ditulis oleh UI.

## Migrasi & cadangan

1. Cadangan lama (`version` < 2) dinormalisasi: item belanja dengan ID duplikat diberi `Utils.uid('shop')` dan `templateId` diisi dari `id`.
2. Cadangan `version` < 3: aktivitas dengan ID duplikat dibongkar (edit pengguna diutamakan) dan string `completion` lama diubah menjadi record v3.
3. Setiap migrasi menambah `weeklyReviews` & `restDays`, mengisi `strictSince` = Senin pekan berjalan bila kosong **atau masih di masa depan**, dan membatasi `markGraceMinutes` ke 0–30.
4. Jika parsed data cacat, raw disimpan di `rutin-buah:v1:corrupt-<timestamp>` dan aplikasi memakai state awal (safe mode menawarkan unduh data mentah).
5. Impor JSON divalidasi dengan `Store.describeImport()`; cadangan state saat ini ditulis ke `rutin-buah:v1:pre-import` sebelum ditimpa. Laporan evaluasi yang sudah kedaluwarsa dilewati dan tidak diperpanjang umurnya.
6. Ekspor JSON menghasilkan pembungkus `{ appVersion, schemaVersion, exportedAt, state }`. Laporan evaluasi hanya diekspor sebagai Markdown `.md`, bukan JSON importable.

## Contoh

```json
{
  "appVersion": "1.2.1",
  "schemaVersion": 3,
  "exportedAt": "2026-11-23T04:30:00.000Z",
  "state": {
    "version": 3,
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
    "weeklyReviews": {},
    "restDays": []
  }
}
```
