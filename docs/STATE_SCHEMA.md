# Skema State Lokal — `rutin-buah:v1`

Dokumen ini merangkum bentuk data yang disimpan di `localStorage` dengan kunci **`rutin-buah:v1`**. Aplikasi memakai `SCHEMA_VERSION = 2` (`APP_VERSION = 1.1.0`). State dibaca lewat `Store.normalizeState()` dan dimigrasi otomatis oleh `Store.migrate()`; jangan mengedit kunci ini langsung kecuali untuk pengujian.

## Bentuk umum

```js
{
  version: 2,
  settings: {
    name, theme: 'system' | 'light' | 'dark', onboarded: boolean,
    timezone: string,              // kompatibilitas lama; tidak dipakai UI
    wakeUpTime: 'HH.mm', subuhTime, bedtime, workStartTime, workEndTime,
    overtimeEndTime, fruit1Time, fruit2Time,
    walkMinutes, workoutMinutes, commuteMinutes,
    weeklyBudget: number, budgetLocked: boolean, dailyFruitTarget: number,
    seminarDate: 'YYYY-MM-DD' | '', thesisTopic: string,
    shoppingDays: { main: 1..7, refill: 1..7 },
    notifications: {
      enabled, activity, fruit, shopping, lowStock, bedtime: boolean,
      activityLeadMinutes: number,
      shoppingTimeMain, shoppingTimeRefill: 'HH.mm'
    }
  },
  activities: [ /* template aktivitas mingguan */ ],
  completion: { 'YYYY-MM-DD': { [activityId]: 'completed' | 'skipped' } },
  customTargets: { [1..7]: string },
  tasks: [ /* tugas skripsi */ ],
  mentorshipNotes: string,
  fruitCatalog: [ /* jenis buah + panduan penyimpanan */ ],
  inventory: [ /* stok buah */ ],
  consumption: [ /* riwayat konsumsi */ ],
  shopping: [ /* item belanja per minggu */ ],
  generatedWeeks: ['YYYY-Www'],
  deletedTemplateIds: [activityId],
  reminders: { 'YYYY-Www:main|refill': { status, at } },
  notified: { 'YYYY-MM-DD:...': true },
  lastBackupAt: ISODateString | '',
  updatedAt: ISODateString
}
```

## Invarian penting

- **Waktu** disimpan sebagai `HH.mm` (titik, bukan titik dua). `Utils.parseTime` menolak format salah; `fmtTimeColon` dipakai untuk input `<input type="time">`.
- **Tanggal** memakai `YYYY-MM-DD` (`Utils.dateKey` / `Utils.fromKey`).
- **Minggu** memakai kunci `YYYY-Www` yang lokal (Senin sebagai awal minggu).
- **Aktivitas** memiliki `id` stabil dan `templateId`. `isRecurring !== false` berarti aktivitas muncul tiap minggu; jika `false`, hanya muncul pada `date`-nya.
- **`completion`** selalu per tanggal. Aktivitas yang dihapus tidak dihapus dari `completion` lama agar riwayat tetap ada; ID template yang sengaja dihapus tercatat di `deletedTemplateIds` agar tidak dibuat ulang.
- **`shopping`** memiliki `id` unik per minggu dan `templateId` yang sama untuk item turunan. Tidak ada pemotongan senyap: `generatedWeeks` menentukan minggu yang sudah dibuat.
- **`inventory`** menyimpan `quantityRemaining`, `unit`, `servingSize`, `servingUnit`, `purchaseDate`, dan `storageLocation`. Status manual `consume-soon` mempercepat penandaan; selain itu penandaan dihitung otomatis dari usia stok dan panduan lokasi penyimpanan (`Store.consumeSoonReason`).
- **`notified`** dipangkas saat `load()` sehingga hanya 14 hari terakhir yang tersisa. Kunci pengingat cadangan memakai akhiran `:backup-reminder`.
- **`lastBackupAt`** diperbarui saat ekspor JSON (`Store.markBackup()`). Banner & toast muncul bila usia cadangan > 14 hari.
- **`settings.timezone`** tetap dibaca untuk kompatibilitas dengan cadangan lama, tetapi tidak lagi ditulis oleh UI.

## Migrasi & cadangan

1. Cadangan lama (`version` < 2) dinormalisasi: item belanja dengan ID duplikat diberi `Utils.uid('shop')` dan `templateId` diisi dari `id`.
2. Jika parsed data cacat, raw disimpan di `rutin-buah:v1:corrupt-<timestamp>` dan aplikasi memakai state awal (safe mode menawarkan unduh data mentah).
3. Impor JSON divalidasi dengan `Store.describeImport()`; cadangan state saat ini ditulis ke `rutin-buah:v1:pre-import` sebelum ditimpa.
4. Ekspor JSON menghasilkan pembungkus `{ appVersion, schemaVersion, exportedAt, state }`.

## Contoh

```json
{
  "appVersion": "1.1.0",
  "schemaVersion": 2,
  "exportedAt": "2026-11-23T04:30:00.000Z",
  "state": { "version": 2, "settings": { "theme": "system" } }
}
```
