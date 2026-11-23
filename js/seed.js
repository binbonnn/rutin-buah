/* ---------- Data awal / template dari PRD ---------- */
const Seed = (() => {
  const { parseTime, fmtTime, dow, dateKey, addDays } = Utils;

  // F-06/Q-04: angka ajaib diturunkan dari blok, bukan ditanam di jadwal.
  const num = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const nonNeg = (value, fallback) => Math.max(0, num(value, fallback));

  const settings = {
    name: '',
    theme: 'system', // U-03: ikut sistem sampai pengguna memilih
    timezone: 'Asia/Jakarta',
    weeklyBudget: 50000,
    budgetLocked: false,
    dailyFruitTarget: 2,
    wakeUpTime: '04.00',
    subuhTime: '04.10',
    walkMinutes: 40,
    workoutMinutes: 30,
    workStartTime: '09.00',
    commuteMinutes: 0, // F-06: 0 berarti 0, bukan jatuh ke default 30
    workEndTime: '17.00',
    overtimeEndTime: '21.00',
    fruit1Time: '08.30',
    fruit2Time: '15.15',
    bedtime: '21.00',
    seminarDate: '',
    thesisTopic: '', // X-04: judul pribadi pembuat dipindah ke onboarding pengguna
    shoppingDays: { main: 7, refill: 3 },
    notifications: {
      enabled: true,
      activity: true,
      fruit: true,
      shopping: true,
      lowStock: true,
      bedtime: false,
      activityLeadMinutes: 10,
      shoppingTimeMain: '09.00',
      shoppingTimeRefill: '09.00'
    },
    onboarded: false // V-16: tampilkan sambutan singkat pada kunjungan pertama
  };

  const fruitCatalog = [
    { id: 'jambu', name: 'Jambu biji', defaultServing: '150 gram', benefit: 'Vitamin C dan antioksidan', storage: 'Pilih agak keras, simpan kering di kulkas dalam wadah/kantong berlubang.' },
    { id: 'pepaya', name: 'Pepaya', defaultServing: '150 gram', benefit: 'Vitamin C dan beta-karoten', storage: 'Matangkan pada suhu ruang; setelah matang atau dipotong, simpan tertutup di kulkas.' },
    { id: 'jeruk', name: 'Jeruk', defaultServing: '1 buah sedang', benefit: 'Vitamin C', storage: 'Simpan di tempat sejuk atau kulkas; jangan dicuci sebelum disimpan.' },
    { id: 'pisang', name: 'Pisang', defaultServing: '1 buah sedang', benefit: 'Kalium dan sumber energi', storage: 'Simpan di suhu ruang, jauh dari sinar matahari langsung.' },
    { id: 'melon', name: 'Melon', defaultServing: '150 gram daging', benefit: 'Kandungan air dan variasi antioksidan', storage: 'Simpan tertutup di kulkas setelah dipotong dan segera konsumsi.' }
  ];

  const workoutFocus = {
    1: 'Upper body', 2: 'Lower body', 3: 'Abs dan core', 4: 'Upper body',
    5: 'Lower body ringan', 6: 'Full body', 7: 'Mobility dan stretching'
  };

  const academicTargets = {
    1: 'Menyelesaikan bagian revisi proposal yang paling prioritas',
    2: 'Melanjutkan revisi berdasarkan catatan dosen',
    3: 'Mengevaluasi revisi dan mengidentifikasi bagian yang belum tepat',
    4: 'Menuntaskan revisi utama dan mulai kerangka PowerPoint',
    5: 'Memeriksa progres singkat dan mencatat target akhir pekan',
    6: 'Menyelesaikan pekerjaan skripsi dan sebagian besar PowerPoint',
    7: 'Memeriksa PowerPoint, latihan presentasi, dan menentukan target minggu berikutnya'
  };

  const thesisTasks = [
    { key: 'revisi', title: 'Menyelesaikan revisi proposal', description: 'Prioritas utama: tindak lanjut catatan revisi dosen.', priority: 'high', status: 'todo', dueDate: '', notes: '' },
    { key: 'konsistensi', title: 'Memeriksa konsistensi isi proposal', description: 'Seluruh bab, tujuan, dan metode harus selaras.', priority: 'medium', status: 'todo', dueDate: '', notes: '' },
    { key: 'referensi', title: 'Memeriksa referensi, tabel, dan format', description: 'Cek sitasi, penomoran tabel, dan format sesuai panduan.', priority: 'medium', status: 'todo', dueDate: '', notes: '' },
    { key: 'kerangka-ppt', title: 'Menyusun kerangka PowerPoint', description: 'Buat alur slide seminar proposal.', priority: 'high', status: 'todo', dueDate: '', notes: '' },
    { key: 'slide', title: 'Menyelesaikan slide seminar proposal', description: 'Finalisasi seluruh slide dan desain visual.', priority: 'high', status: 'todo', dueDate: '', notes: '' },
    { key: 'latihan', title: 'Berlatih presentasi', description: 'Latih penyampaian dan pengaturan waktu.', priority: 'medium', status: 'todo', dueDate: '', notes: '' },
    { key: 'pertanyaan', title: 'Menyiapkan kemungkinan pertanyaan penguji', description: 'Susun daftar pertanyaan dan jawaban singkat.', priority: 'low', status: 'todo', dueDate: '', notes: '' }
  ].map((t, i) => ({ id: 'task-' + t.key, ...t, order: i + 1, completedAt: '' }));

  // D-02: template memakai ID stabil sebagai templateId; Store membuat ID unik per minggu.
  const shoppingTemplate = [
    { id: 'shop-jambu', fruitId: 'jambu', name: 'Jambu biji', quantity: 1, unit: '500 gram', estimatedUnitPrice: 9500, session: 'main' },
    { id: 'shop-pepaya', fruitId: 'pepaya', name: 'Pepaya', quantity: 1, unit: '1 kg utuh', estimatedUnitPrice: 15000, session: 'main' },
    { id: 'shop-jeruk', fruitId: 'jeruk', name: 'Jeruk', quantity: 3, unit: 'buah sedang', estimatedUnitPrice: 3750, session: 'main' },
    { id: 'shop-pisang', fruitId: 'pisang', name: 'Pisang', quantity: 2, unit: 'buah sedang', estimatedUnitPrice: 2500, session: 'main' },
    { id: 'shop-melon', fruitId: 'melon', name: 'Melon potong', quantity: 1, unit: '400 gram daging', estimatedUnitPrice: 7200, session: 'refill' }
  ].map((i) => ({ ...i, templateId: i.id, actualUnitPrice: null, isPurchased: false, shoppingDate: '', storeNotes: '', weekKey: '' }));

  function fruitScheduleFor(s = settings) {
    const target = Math.max(1, Math.min(6, Math.floor(num(s.dailyFruitTarget, 2))));
    const days = {};
    for (let d = 1; d <= 7; d++) {
      const base = [
        { fruitId: 'jambu', label: 'Jambu biji 150 g' },
        { fruitId: 'pepaya', label: 'Pepaya 150 g' },
        { fruitId: 'jeruk', label: 'Jeruk 1 buah' },
        { fruitId: 'pisang', label: 'Pisang 1 buah' },
        { fruitId: 'melon', label: 'Melon 150 g' }
      ];
      days[d] = Array.from({ length: target }, (_, i) => base[(d + i) % base.length]);
    }
    return days;
  }

  const fruitSchedule = fruitScheduleFor();

  /**
   * F-06: jadwal dibangun sebagai rangkaian blok berurutan.
   * `cursor` hanya pernah maju, sehingga tidak ada tumpang tindih atau durasi negatif
   * meski pengguna mengubah jam bangun, buah, atau tidur.
   */
  function buildActivities(s = settings) {
    const acts = [];
    const numOf = (v, fb) => num(v, fb);
    const wake = parseTime(s.wakeUpTime) ?? 240;
    const subuh = parseTime(s.subuhTime) ?? 250;
    const walk = nonNeg(s.walkMinutes, 40);
    const workout = nonNeg(s.workoutMinutes, 30);
    const workStart = parseTime(s.workStartTime) ?? 540;
    const commute = nonNeg(s.commuteMinutes, 0);
    const workEnd = parseTime(s.workEndTime) ?? 1020;
    const overtimeEnd = parseTime(s.overtimeEndTime) ?? 1260;
    const f1 = parseTime(s.fruit1Time) ?? 510;
    const f2 = parseTime(s.fruit2Time) ?? 915;
    const bedtime = parseTime(s.bedtime) ?? 1260;
    const fruitTarget = Math.max(1, Math.min(6, Math.floor(numOf(s.dailyFruitTarget, 2))));

    /** Tambah blok; mulai paling cepat di `desired`, paling lambat di cursor sebelumnya. */
    const seq = (d, key, title, category, desiredStart, duration, notes = '', block = '') => {
      const start = Math.max(0, Math.min(1439, Math.round(numOf(desiredStart, 0))));
      const dur = Math.max(0, Math.round(numOf(duration, 0)));
      const from = Math.max(start, cursor[d]);
      const to = Math.min(1440, from + dur);
      cursor[d] = to;
      acts.push({
        id: `tpl-${d}-${key}`, title, category, dayOfWeek: d,
        startTime: fmtTime(from === 1440 ? 1439 : from),
        endTime: fmtTime(to === 1440 ? 1439 : to),
        isRecurring: true, isTemplate: true, notes,
        ...(block ? { block, blockLabel: 'Rutinitas pagi' } : {})
      });
      return from;
    };

    /** Tambah blok yang harus selesai tepat sebelum jam tertentu (mis. persiapan kerja). */
    const until = (d, key, title, category, desiredStart, hardEnd, notes = '', block = '') => {
      const start = Math.max(0, Math.min(1439, Math.round(numOf(desiredStart, 0))));
      const end = Math.max(start, Math.min(1440, Math.round(numOf(hardEnd, start))));
      const from = Math.max(start, cursor[d]);
      const to = Math.max(from, end); // mundur ke cursor bila perlu, tapi tidak pernah negatif
      cursor[d] = to;
      acts.push({
        id: `tpl-${d}-${key}`, title, category, dayOfWeek: d,
        startTime: fmtTime(from), endTime: fmtTime(to === 1440 ? 1439 : to),
        isRecurring: true, isTemplate: true, notes,
        ...(block ? { block, blockLabel: 'Rutinitas pagi' } : {})
      });
      return from;
    };

    const cursor = {};
    for (let d = 1; d <= 7; d++) cursor[d] = 0;

    const fruitLabel = (n) => ['pertama', 'kedua', 'ketiga', 'keempat', 'kelima', 'keenam'][n - 1] || `ke-${n}`;

    for (let d = 1; d <= 7; d++) {
      // ---- Rutinitas pagi harian: satu rangkaian, dikelompokkan di UI (V-07) ----
      const B = 'rutinitas-pagi';
      seq(d, 'bangun', 'Bangun, minum air, dan persiapan', 'Pribadi', wake, 10, '', B);
      const subuhStart = Math.max(subuh, wake + 10);
      seq(d, 'subuh', 'Salat Subuh dan ibadah singkat', 'Ibadah', subuhStart, 20, 'Waktu mengikuti salat setempat; dapat diubah.', B);
      seq(d, 'pemanasan', 'Pemanasan', 'Olahraga', null, 10, '', B);
      seq(d, 'jalan', 'Jalan pagi', 'Olahraga', null, walk, '', B);
      seq(d, 'workout', `Home workout — ${workoutFocus[d]}`, 'Olahraga', null, workout, 'Olahraga wajib selesai sebelum mandi.', B);
      seq(d, 'pendinginan', 'Pendinginan', 'Olahraga', null, 10, '', B);
      seq(d, 'mandi', 'Mandi dan bersiap', 'Pribadi', null, 30, '', B);
      seq(d, 'sarapan', 'Sarapan', 'Makan', null, 30, '', B);

      if (d <= 4) {
        // ---- Senin–Kamis ----
        seq(d, 'skripsi-pagi', 'Mengerjakan skripsi', 'Skripsi', 420, 90, academicTargets[d]);
        seq(d, 'buah-1', 'Buah porsi pertama', 'Makan', f1, 15, 'Target 1 porsi buah.');
        if (fruitTarget > 2) seq(d, 'buah-3', 'Buah porsi ketiga', 'Makan', f1 + 30, 15, 'Target tambahan sesuai setelan.');
        until(d, 'persiapan-akhir', 'Persiapan akhir sebelum kerja', 'Pribadi', cursor[d], workStart, '');
        seq(d, 'persiapan-kerja', 'Persiapan kerja dan berpakaian', 'Kerja', workStart, 30, 'Bukan mandi kedua; sudah mandi setelah olahraga pagi.');
        seq(d, 'berangkat', 'Perjalanan ke kantor', 'Kerja', null, commute, '');
        seq(d, 'kerja-1', 'Bekerja', 'Kerja', null, Math.max(0, 720 - cursor[d]), '');
        seq(d, 'makan-siang', 'Istirahat dan makan siang', 'Makan', 720, 60, '');
        seq(d, 'kerja-2', 'Bekerja', 'Kerja', null, Math.max(0, f2 - cursor[d]), '');
        seq(d, 'buah-2', 'Buah porsi kedua', 'Makan', f2, 15, 'Target 1 porsi buah.');
        if (fruitTarget > 3) seq(d, 'buah-4', 'Buah porsi keempat', 'Makan', f2 + 45, 15, 'Target tambahan sesuai setelan.');
        seq(d, 'kerja-3', 'Bekerja', 'Kerja', null, Math.max(0, workEnd - cursor[d]), '');
        seq(d, 'pulang', 'Perjalanan pulang', 'Kerja', null, commute, '');
        seq(d, 'istirahat', 'Istirahat', 'Pribadi', null, Math.max(0, 1095 - cursor[d]), '');
        seq(d, 'makan-malam', 'Makan malam', 'Makan', 1095, 30, '');
        seq(d, 'skripsi-malam', 'Mengerjakan skripsi', 'Skripsi', null, 75, '');
        seq(d, 'membaca', 'Membaca buku', 'Membaca', null, 30, '');
        seq(d, 'persiapan-besok', 'Persiapan hari berikutnya', 'Pribadi', null, 15, '');
        until(d, 'persiapan-tidur', 'Persiapan tidur', 'Pribadi', cursor[d], bedtime, '');
        seq(d, 'target-tidur', 'Target tidur', 'Pribadi', bedtime, 15, '');
      } else if (d === 5) {
        // ---- Jumat ----
        seq(d, 'skripsi-singkat', 'Sesi singkat skripsi & target akhir pekan', 'Skripsi', 420, 60, academicTargets[5]);
        seq(d, 'buah-1', 'Buah porsi pertama', 'Makan', 480, 15, 'Target 1 porsi buah.');
        until(d, 'persiapan-akhir', 'Persiapan akhir', 'Pribadi', cursor[d], workStart, '');
        seq(d, 'persiapan-kerja', 'Persiapan kerja', 'Kerja', workStart, 30, '');
        seq(d, 'berangkat', 'Perjalanan ke kantor', 'Kerja', null, commute, '');
        seq(d, 'kerja-1', 'Bekerja', 'Kerja', null, Math.max(0, 720 - cursor[d]), '');
        seq(d, 'makan-siang', 'Istirahat dan makan siang', 'Makan', 720, 60, '');
        seq(d, 'kerja-2', 'Bekerja', 'Kerja', null, Math.max(0, f2 - cursor[d]), '');
        seq(d, 'buah-2', 'Buah porsi kedua', 'Makan', f2, 15, 'Target 1 porsi buah.');
        seq(d, 'kerja-3', 'Bekerja', 'Kerja', null, Math.max(0, 1080 - cursor[d]), '');
        seq(d, 'makan-malam', 'Makan malam / jeda makan', 'Makan', 1080, 30, '');
        seq(d, 'lembur', 'Lembur', 'Kerja', 1110, Math.max(0, overtimeEnd - 1110), 'Tidak ada sesi skripsi atau membaca pada Jumat malam.');
        seq(d, 'pulang', 'Perjalanan pulang', 'Kerja', null, 30, '');
        seq(d, 'bersih', 'Bersih-bersih dan persiapan tidur', 'Pribadi', null, 15, '');
        until(d, 'tidur', 'Tidur', 'Pribadi', cursor[d], bedtime, '');
      } else {
        // ---- Akhir pekan: jam buah juga mengikuti pengaturan ----
        const weekend = d === 6
          ? [
              ['skripsi-1', 'Mengerjakan skripsi', 'Skripsi', 420, 120, academicTargets[6]],
              ['buah-1', 'Buah porsi pertama', 'Makan', f1, 15, 'Target 1 porsi buah.'],
              ['skripsi-2', 'Mengerjakan skripsi', 'Skripsi', null, 75, ''],
              ['istirahat-1', 'Istirahat', 'Pribadi', null, 15, ''],
              ['skripsi-3', 'Mengerjakan skripsi', 'Skripsi', null, 75, ''],
              ['makan-siang', 'Istirahat dan makan siang', 'Makan', 720, 60, ''],
              ['ppt-1', 'Menyusun PowerPoint', 'Skripsi', null, 120, ''],
              ['istirahat-2', 'Istirahat', 'Pribadi', null, 15, ''],
              ['buah-2', 'Buah porsi kedua', 'Makan', f2, 15, 'Target 1 porsi buah.'],
              ['ppt-2', 'Merapikan PowerPoint', 'Skripsi', null, 90, ''],
              ['bebas', 'Waktu bebas dan istirahat', 'Pribadi', null, 75, ''],
              ['makan-malam', 'Makan malam', 'Makan', 1095, 30, ''],
              ['evaluasi', 'Evaluasi skripsi', 'Skripsi', null, 60, ''],
              ['membaca', 'Membaca buku', 'Membaca', null, 30, ''],
              ['pribadi', 'Waktu pribadi', 'Pribadi', null, 30, ''],
              ['persiapan-tidur', 'Persiapan tidur', 'Pribadi', null, Math.max(0, bedtime - 1245), ''],
              ['target-tidur', 'Target tidur', 'Pribadi', bedtime, 15, '']
            ]
          : [
              ['tinjau', 'Meninjau progres skripsi', 'Skripsi', 420, 90, academicTargets[7]],
              ['buah-1', 'Buah porsi pertama', 'Makan', f1, 15, 'Target 1 porsi buah.'],
              ['ppt-1', 'Mengerjakan PowerPoint', 'Skripsi', null, 75, ''],
              ['istirahat-1', 'Istirahat', 'Pribadi', null, 30, ''],
              ['latihan', 'Latihan presentasi', 'Skripsi', null, 90, ''],
              ['makan-siang', 'Istirahat dan makan siang', 'Makan', 720, 60, ''],
              ['perbaikan', 'Perbaikan materi presentasi', 'Skripsi', null, 90, ''],
              ['bebas-1', 'Waktu bebas', 'Pribadi', null, 45, ''],
              ['buah-2', 'Buah porsi kedua', 'Makan', f2, 15, 'Target 1 porsi buah.'],
              ['evaluasi', 'Evaluasi mingguan', 'Skripsi', null, 60, ''],
              ['pribadi', 'Waktu pribadi', 'Pribadi', null, 105, ''],
              ['makan-malam', 'Makan malam', 'Makan', 1095, 30, ''],
              ['persiapan-minggu', 'Persiapan minggu berikutnya', 'Skripsi', null, 45, ''],
              ['membaca', 'Membaca buku', 'Membaca', null, 30, ''],
              ['tenang', 'Waktu tenang', 'Pribadi', null, Math.max(0, bedtime - 1230), ''],
              ['target-tidur', 'Target tidur', 'Pribadi', bedtime, 15, '']
            ];
        // Sisipkan porsi buah tambahan bila target > 2 (F-15).
        const withExtra = [];
        weekend.forEach((row) => {
          withExtra.push(row);
          if (row[0] === 'buah-1' && fruitTarget > 2) {
            withExtra.push(['buah-3', 'Buah porsi ketiga', 'Makan', f1 + 45, 15, 'Target tambahan sesuai setelan.']);
          }
          if (row[0] === 'buah-2' && fruitTarget > 3) {
            withExtra.push(['buah-4', 'Buah porsi keempat', 'Makan', f2 + 45, 15, 'Target tambahan sesuai setelan.']);
          }
        });
        withExtra.forEach(([k, t, c, start, dur, n]) => {
          if (k === 'persiapan-tidur') until(d, k, t, c, cursor[d], bedtime, n);
          else seq(d, k, t, c, start, dur, n);
        });
      }

      // F-15: label porsi mengikuti target, bukan teks tetap "pertama/kedua".
      if (fruitTarget > 2) {
        for (let n = 3; n <= fruitTarget; n++) {
          const a = acts.find((x) => x.id === `tpl-${d}-buah-${n}`);
          if (a) a.title = `Buah porsi ${fruitLabel(n)}`;
        }
      }
    }
    return acts;
  }

  function initialInventory() {
    const today = new Date();
    // F-01/V-16: data contoh diberi penanda agar bisa dihapus sekali klik.
    return [
      { id: 'inv-demo-jambu', fruitId: 'jambu', name: 'Jambu biji', quantityPurchased: 500, quantityRemaining: 300, unit: 'gram', servingSize: 150, servingUnit: 'gram', estimatedServings: 2, purchaseDate: dateKey(addDays(today, -2)), storageLocation: 'Kulkas', condition: 'Agak keras, baik', status: 'available', isSample: true },
      { id: 'inv-demo-pepaya', fruitId: 'pepaya', name: 'Pepaya', quantityPurchased: 1, quantityRemaining: 1, unit: 'kg utuh', servingSize: 150, servingUnit: 'gram', estimatedServings: 4, purchaseDate: dateKey(addDays(today, -1)), storageLocation: 'Suhu ruang', condition: 'Mulai matang', status: 'consume-soon', isSample: true },
      { id: 'inv-demo-jeruk', fruitId: 'jeruk', name: 'Jeruk', quantityPurchased: 3, quantityRemaining: 3, unit: 'buah', servingSize: 1, servingUnit: 'buah', estimatedServings: 3, purchaseDate: dateKey(addDays(today, -2)), storageLocation: 'Kulkas', condition: 'Baik', status: 'available', isSample: true }
    ];
  }

  return {
    settings, fruitCatalog, academicTargets, thesisTasks, shoppingTemplate,
    fruitSchedule, fruitScheduleFor, workoutFocus, buildActivities, initialInventory
  };
})();
