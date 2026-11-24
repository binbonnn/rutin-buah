# Skema State Lokal — `rutin-buah:v1`

Dokumen ini merangkum bentuk data yang disimpan di `localStorage` dengan kunci **`rutin-buah:v1`**. Aplikasi memakai `SCHEMA_VERSION = 5` (`APP_VERSION = 1.3.0`). State dibaca lewat `Store.normalizeState()` dan dimigrasi otomatis oleh `Store.migrate()`; jangan mengedit kunci ini langsung kecuali untuk pengujian.

## Bentuk umum

```js
{
  version: 5,
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
    planWindowStart: 'HH.mm',       // v5: jendela penjadwalan pemulihan, default 05.00
    planWindowEnd: 'HH.mm',         // v5: default 21.30, dibatasi bedtime − 30 menit
    recoveryMaxPerDay: number,      // v5: total menit pemulihan per hari, default 60
    coreCategories: ['Ibadah', 'Skripsi'], // v5: kategori prioritas rencana
    notifications: {
      enabled, activity, fruit, shopping, lowStock, bedtime, review: boolean,
      activityLeadMinutes: number,
      shoppingTimeMain, shoppingTimeRefill: 'HH.mm'
    }
  },
  activities: [ /* template aktivitas mingguan; yang dibuat rencana memakai origin:'recovery' */ ],
  completion: { 'YYYY-MM-DD': { [activityId]: record } },
  firstUseAt: ISODateString,                // v4: kapan aplikasi pertama dipakai
  daySnapshots: {                           // v5: jadwal harian kompak, maks. 35 hari
    'YYYY-MM-DD': { v: scheduleVersion, a: [[id, start, end, category, title], ...] }
  },
  scheduleVersion: number,                  // v5: versi format snapshot harian
  chronicDismissedUntil: { [key]: ISODateString }, // v5: tunda pola kronis 28 hari
  weeklyReviews: { 'YYYY-MM-DD': review },  // kunci = Senin minggu tersebut
  restDays: ['YYYY-MM-DD'],                 // maks. 2 per minggu
  customTargets: { [1..7]: string },
  tasks: [ /* tugas skripsi */ ],
  mentorshipNotes: string,
  fruitCatalog: [ /* jenis buah + panduan penyimpanan */ ],
  inventory: [ /* stok buah */ ],
  consumption: [ /* riwayat konsumsi; yang > 180 hari bisa diarsipkan */ ],
  shopping: [ /* item belanja per minggu */ ],
  generatedWeeks: ['YYYY-MM-DD'],
  deletedTemplateIds: [activityId],
  reminders: { 'YYYY-MM-DD:main|refill': { status, at } },  // kunci = Senin
  notified: { 'YYYY-MM-DD:...': true },
  lastBackupAt: ISODateString | '',
  updatedAt: ISODateString
}
```

### Record `completion` (v3, ditambah `dur` di v5)

```js
{
  s: 'inprogress' | 'completed' | 'skipped' | 'excused',
  startedAt: ISODateString | null,  // diisi saat "Mulai"
  at: ISODateString | null,         // waktu perubahan terakhir
  src: 'live' | 'grace' | 'legacy' | 'rest',
  title: string | null,             // snapshot agar aktivitas yang dihapus tetap dikenali
  startTime: 'HH.mm' | null,
  dur: number | null                // v5: menit aktual bila mulai→selesai tercatat
}
```

String lama (`'completed'` / `'skipped'`) masih dibaca oleh `Store.statusOf()` dan dinormalisasi menjadi `{ s, at: null, src: 'legacy' }` saat migrasi. **Semua pembaca status wajib memakai `Store.statusOf()`**, bukan `rec.s` langsung.

### Snapshot `weeklyReviews` (v5)

```js
{
  weekKey: 'YYYY-MM-DD',            // Senin
  isoWeek: 'YYYY-Www',              // hanya label/nama berkas
  status: 'preview' | 'final',
  ruleVersion: 5,
  generatedAt, expiresAt: ISODateString,
  seen: boolean, downloadedAt: ISODateString | null, downloadedFormat: 'md' | null,
  score: 0..100, done, total, unfinished, skippedCount, excusedCount, waitingCount,
  items: [{ d: 'YYYY-MM-DD', id, s: 'm' | 'p' }],   // kompak; baca via Store.reviewItems(r)
  titles: { [id]: [title, 'HH.mm', category] },     // judul/jam/kategori disimpan sekali
  waiting: [{ date, id, title, time, reason: 'Menunggu' }],
  skippedItems: [{ date, id, title, time }],
  daily: [{ key, label, done, total, pct }],
  blockTotals: { pagi, siang, sore, malam },        // v5: untuk insight S2
  blockMissed: { pagi, siang, sore, malam },
  categoryStats: { [category]: { total, done } },
  lastMinute: { done, grace },
  insights: [{ kind, score, data, cta }],           // data-only; teks via Store.insightText(i)
  plan: [{
    id, activityId, title, category, durationMin,
    status: 'proposed' | 'accepted' | 'skipped',
    suggested: { date, start, end } | null,
    createdActivityId: string | null,
    kind: 'recover' | 'chronic'
  }]
}
```

`preview` dibuat Minggu 21.00, `final` menggantikannya Senin 09.00. Snapshot final tidak dihitung ulang (B.4). `expiresAt` = 28 hari setelah pembuatan. Tidak ada laporan untuk minggu yang seluruhnya sebelum `firstUseAt`; pada minggu pertama laporan baru dibuat bila ada catatan `completion`. `waiting` hanya diisi pada `preview` dan tidak ikut dihitung dalam `total`.

`items` sengaja kompak agar satu laporan < 6 KB. UI dan Markdown **wajib** memakai `Store.reviewItems(review)` untuk mendapatkan `{ date, id, s, title, time, cat, blk, reason }`. Insight tidak menyimpan teks: `Store.insightText(i)` / `Pages.insightText(i)` yang merender dari `data`, sehingga perubahan kata tidak perlu migrasi.

### Rencana pemulihan (S1)

Menerima rencana (`Store.acceptPlan`) menambah tepat satu aktivitas sekali-jadi:

```js
{
  id: Utils.uid('rec'), title, category,
  dayOfWeek, startTime, endTime, date,
  isRecurring: false, isTemplate: false,
  origin: 'recovery', recoveryOf: <activityId>
}
```

Slot dihitung oleh `Planner.findSlot()` (modul murni `js/planner.js`) dalam jendela `planWindowStart`–`min(planWindowEnd, bedtime − 30 menit)`, dengan penyangga 5 menit, melewati `restDays`/mode libur, menjaga total `origin:'recovery'` per hari ≤ `recoveryMaxPerDay`, dan tidak memakai kategori `Ibadah` sebagai penukar. Jika tidak ada celah, `suggested: null` dan `reason` berisi pesan jelas. `Store.undoPlan()` menghapus aktivitas hanya bila belum ditandai. Aktivitas pemulihan tidak menjadi sumber rencana berikutnya lebih dari satu tingkat (`recoveryDepth ≤ 1`).

Item `kind:'chronic'` muncul bila kunci `templateId` atau judul tidak tercatat pada ≥ 3 laporan final berturut-turut. Tiga pilihannya: ubah jam permanen, hapus dari template (`deletedTemplateIds`), atau tunda 28 hari (`chronicDismissedUntil`).

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
- **`completion`** selalu per tanggal. `Store.archiveOld()` memindahkan tanggal > 90 hari ke IndexedDB **`completion-old`** setelah transaksi komit, lalu menghapusnya dari state dalam satu `Store.update()`. Kegagalan IndexedDB tidak memindahkan apa pun. Hitungan Jendela Aktif 28 hari tidak terpengaruh.
- **`restDays`** maksimal 2 per minggu, hanya untuk hari berjalan, dan dikecualikan dari perhitungan skor (`s: 'excused'`). Hari istirahat tidak boleh menimpa catatan `completed`/`inprogress`/`skipped`; membatalkannya hanya menghapus `excused` yang ber-`src: 'rest'`.
- **`daySnapshots`** berisi jadwal harian kompak yang dibekukan sekali saat hari tersebut sudah lewat (maksimal 35 hari), ditulis oleh `Store.freezeDays()` saat `init()` dan `ensureReviews()`. `buildReview()` memakainya sebagai sumber jadwal agar edit di masa kini tidak mengubah laporan lama (V3-08); `completion` tidak pernah dibekukan atau dipangkas.
- **Retensi laporan**: hanya 4 laporan `final` terbaru yang disimpan, dengan batas keras 8 laporan `final` secara keseluruhan. Laporan kedaluwarsa yang **belum** dibuka sengaja ditahan agar tampil sekali, paling lambat 14 hari setelah `expiresAt`; setelah `seen = true`, `pruneReviews()` langsung menghapusnya. `completion` tidak ikut terhapus.
- **`shopping`** memiliki `id` unik per minggu dan `templateId` yang sama untuk item turunan. Tidak ada pemotongan senyap: `generatedWeeks` menentukan minggu yang sudah dibuat.
- **`inventory`** menyimpan `quantityRemaining`, `unit`, `servingSize`, `servingUnit`, `purchaseDate`, dan `storageLocation`. Status manual `consume-soon` mempercepat penandaan; selain itu penandaan dihitung otomatis dari usia stok dan panduan lokasi penyimpanan (`Store.consumeSoonReason`).
- **`consumption`** yang lebih tua dari 180 hari dipindahkan ke IndexedDB `consumption-old` dengan aturan yang sama seperti `completion`.
- **`notified`** dipangkas saat `load()` sehingga hanya 14 hari terakhir yang tersisa. Kunci pengingat cadangan memakai akhiran `:backup-reminder`.
- **`lastBackupAt`** diperbarui saat ekspor JSON (`Store.markBackup()`). Banner & toast muncul bila usia cadangan > 14 hari.
- **`settings.timezone`** tetap dibaca untuk kompatibilitas dengan cadangan lama, tetapi tidak lagi ditulis oleh UI.

## Arsip IndexedDB (v5)

`js/archive.js` memakai database `rutin-buah-archive` versi 1 dengan dua object store: `completion-old` dan `consumption-old`. API: `Archive.put(store, key, value)`, `Archive.get(store, key)`, `Archive.all(store)`, `Archive.clear(store)`. Semua asynchronous dan tidak pernah melempar; kegagalan mengembalikan `false`/`null`/`{}`. `Store.archiveOld()` dijalankan saat idle pada startup. Ekspor memakai `Store.exportDataAsync()` agar menyertakan arsip; impor memakai `Store.importDataAsync()` untuk menulis ulang arsip. `Store.exportData()` tetap sinkron untuk pemanggil lama dan menyertakan arsip kosong.

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
5. Cadangan `version` < 5: `dayPlans` lama dikonversi ke `daySnapshots` kompak; `scheduleVersion`, `chronicDismissedUntil`, dan pengaturan penjadwalan diisi dengan nilai bawaan. `firstUseAt` **tidak** diubah. Item laporan lama dikompresi menjadi `{d, id, s}` dengan `titles` turunan; `accepted`/`skipped` dipetakan ke `status`.
6. Setiap migrasi menambah `weeklyReviews` & `restDays`, mengisi `strictSince` = Senin pekan berjalan bila kosong **atau masih di masa depan**, dan membatasi `markGraceMinutes` ke 0–30.
7. Jika parsed data cacat, raw disimpan di `rutin-buah:v1:corrupt-<timestamp>` dan aplikasi memakai state awal (safe mode menawarkan unduh data mentah).
8. Impor JSON divalidasi dengan `Store.describeImport()`; cadangan state saat ini ditulis ke `rutin-buah:v1:pre-import` sebelum ditimpa. Laporan evaluasi yang sudah kedaluwarsa dilewati dan tidak diperpanjang umurnya.
9. Ekspor JSON menghasilkan pembungkus `{ appVersion, schemaVersion, exportedAt, state, archive }` (arsip diisi oleh jalur async). Laporan evaluasi juga tetap bisa diunduh sebagai Markdown `.md`.

## Contoh

```json
{
  "appVersion": "1.3.0",
  "schemaVersion": 5,
  "exportedAt": "2026-11-24T04:30:00.000Z",
  "state": {
    "version": 5,
    "settings": {
      "theme": "system",
      "markGraceMinutes": 10,
      "strictSince": "2026-11-23",
      "planWindowStart": "05.00",
      "planWindowEnd": "21.30",
      "recoveryMaxPerDay": 60,
      "notifications": { "review": true }
    },
    "completion": {
      "2026-11-23": {
        "a1": { "s": "completed", "startedAt": null, "at": "2026-11-23T07:05:00.000Z", "src": "live", "title": "Subuh", "startTime": "04.10", "dur": null }
      }
    },
    "firstUseAt": "2026-11-23T00:00:00.000Z",
    "daySnapshots": {
      "2026-11-23": { "v": 1, "a": [["a1", "04.10", "04.30", "Ibadah", "Subuh"]] }
    },
    "weeklyReviews": {},
    "restDays": []
  },
  "archive": { "completion": {}, "consumption": {} }
}
```
