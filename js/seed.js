/* ---------- Data awal / template dari PRD ---------- */
const Seed = (() => {
  const { parseTime, fmtTime, dow, dateKey, addDays } = Utils;

  const settings = {
    name: '',
    theme: 'light',
    timezone: 'Asia/Jakarta',
    weeklyBudget: 50000,
    budgetLocked: false,
    dailyFruitTarget: 2,
    wakeUpTime: '04.00',
    subuhTime: '04.10',
    walkMinutes: 40,
    workoutMinutes: 30,
    workStartTime: '09.00',
    commuteMinutes: 30,
    workEndTime: '17.00',
    overtimeEndTime: '21.00',
    fruit1Time: '08.30',
    fruit2Time: '15.15',
    bedtime: '21.00',
    seminarDate: '',
    thesisTopic: 'Usulan Perbaikan Sistem Kerja Menggunakan Pendekatan Macroergonomic Analysis and Design (MEAD) pada TPA BLE Banyumas.',
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
    }
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

  const shoppingTemplate = [
    { id: 'shop-jambu', fruitId: 'jambu', name: 'Jambu biji', quantity: 1, unit: '500 gram', estimatedUnitPrice: 9500, session: 'main' },
    { id: 'shop-pepaya', fruitId: 'pepaya', name: 'Pepaya', quantity: 1, unit: '1 kg utuh', estimatedUnitPrice: 15000, session: 'main' },
    { id: 'shop-jeruk', fruitId: 'jeruk', name: 'Jeruk', quantity: 3, unit: 'buah sedang', estimatedUnitPrice: 3750, session: 'main' },
    { id: 'shop-pisang', fruitId: 'pisang', name: 'Pisang', quantity: 2, unit: 'buah sedang', estimatedUnitPrice: 2500, session: 'main' },
    { id: 'shop-melon', fruitId: 'melon', name: 'Melon potong', quantity: 1, unit: '400 gram daging', estimatedUnitPrice: 7200, session: 'refill' }
  ].map((i) => ({ ...i, actualUnitPrice: null, isPurchased: false, shoppingDate: '', storeNotes: '', weekKey: '' }));

  const fruitSchedule = {
    1: [{ fruitId: 'jambu', label: 'Jambu biji 150 g' }, { fruitId: 'pepaya', label: 'Pepaya 150 g' }],
    2: [{ fruitId: 'jeruk', label: 'Jeruk 1 buah' }, { fruitId: 'jambu', label: 'Jambu biji 150 g' }],
    3: [{ fruitId: 'pepaya', label: 'Pepaya 150 g' }, { fruitId: 'pisang', label: 'Pisang 1 buah' }],
    4: [{ fruitId: 'jeruk', label: 'Jeruk 1 buah' }, { fruitId: 'pepaya', label: 'Pepaya 150 g' }],
    5: [{ fruitId: 'jambu', label: 'Jambu biji 150 g' }, { fruitId: 'jeruk', label: 'Jeruk 1 buah' }],
    6: [{ fruitId: 'pepaya', label: 'Pepaya 150 g' }, { fruitId: 'melon', label: 'Melon 150 g' }],
    7: [{ fruitId: 'pisang', label: 'Pisang 1 buah' }, { fruitId: 'melon', label: 'Melon 150 g' }]
  };

  /** Bangun template aktivitas. ID stabil agar riwayat checklist tidak hilang saat template diperbarui. */
  function buildActivities(s = settings) {
    const acts = [];
    const w = parseTime(s.wakeUpTime) ?? 240;
    const subuhRaw = parseTime(s.subuhTime) ?? 250;
    const walk = Math.max(5, Number(s.walkMinutes) || 40);
    const workout = Math.max(5, Number(s.workoutMinutes) || 30);
    const workStart = parseTime(s.workStartTime) ?? 540;
    const commute = Math.max(5, Number(s.commuteMinutes) || 30);
    const workEnd = parseTime(s.workEndTime) ?? 1020;
    const overtimeEnd = parseTime(s.overtimeEndTime) ?? 1260;
    const f1 = parseTime(s.fruit1Time) ?? 510;
    const f2 = parseTime(s.fruit2Time) ?? 915;
    const bedtime = parseTime(s.bedtime) ?? 1260;

    const add = (d, key, title, category, start, end, notes = '') => {
      acts.push({
        id: `tpl-${d}-${key}`, title, category, dayOfWeek: d,
        startTime: fmtTime(start), endTime: fmtTime(end),
        isRecurring: true, isTemplate: true, notes
      });
    };

    // Rutinitas pagi harian (urutan olahraga sebelum mandi)
    const subuhStart = Math.max(subuhRaw, w + 10);
    const morning = [
      ['bangun', 'Bangun, minum air, dan persiapan', 'Pribadi', w, w + 10, ''],
      ['subuh', 'Salat Subuh dan ibadah singkat', 'Ibadah', subuhStart, subuhStart + 20, 'Waktu mengikuti salat setempat; dapat diubah.'],
      ['pemanasan', 'Pemanasan', 'Olahraga', subuhStart + 20, subuhStart + 30, ''],
      ['jalan', 'Jalan pagi', 'Olahraga', subuhStart + 30, subuhStart + 30 + walk, ''],
      ['workout', 'Home workout', 'Olahraga', subuhStart + 30 + walk, subuhStart + 30 + walk + workout, ''],
      ['pendinginan', 'Pendinginan', 'Olahraga', subuhStart + 30 + walk + workout, subuhStart + 40 + walk + workout, ''],
      ['mandi', 'Mandi dan bersiap', 'Pribadi', subuhStart + 40 + walk + workout, subuhStart + 70 + walk + workout, 'Olahraga wajib selesai sebelum mandi.'],
      ['sarapan', 'Sarapan', 'Makan', subuhStart + 70 + walk + workout, subuhStart + 100 + walk + workout, '']
    ];

    for (let d = 1; d <= 7; d++) {
      morning.forEach(([key, title, cat, start, end, notes]) => {
        add(d, key, key === 'workout' ? `${title} — ${workoutFocus[d]}` : title, cat, start, end, notes);
      });

      if (d <= 4) {
        // Senin -- Kamis
        add(d, 'skripsi-pagi', 'Mengerjakan skripsi', 'Skripsi', 420, 510, academicTargets[d]);
        add(d, 'buah-1', 'Buah porsi pertama', 'Makan', f1, f1 + 15, 'Target 1 porsi buah.');
        add(d, 'persiapan-akhir', 'Persiapan akhir sebelum kerja', 'Pribadi', f1 + 15, workStart, '');
        add(d, 'persiapan-kerja', 'Persiapan kerja dan berpakaian', 'Kerja', workStart, workStart + 30, 'Bukan mandi kedua; sudah mandi setelah olahraga pagi.');
        add(d, 'berangkat', 'Perjalanan ke kantor', 'Kerja', workStart + 30, workStart + 30 + commute, '');
        add(d, 'kerja-1', 'Bekerja', 'Kerja', workStart + 30 + commute, 720, '');
        add(d, 'makan-siang', 'Istirahat dan makan siang', 'Makan', 720, 780, '');
        add(d, 'kerja-2', 'Bekerja', 'Kerja', 780, 915, '');
        add(d, 'buah-2', 'Buah porsi kedua', 'Makan', f2, f2 + 15, 'Target 1 porsi buah.');
        add(d, 'kerja-3', 'Bekerja', 'Kerja', f2 + 15, workEnd, '');
        add(d, 'pulang', 'Perjalanan pulang', 'Kerja', workEnd, workEnd + commute, '');
        add(d, 'istirahat', 'Istirahat', 'Pribadi', workEnd + commute, 1095, '');
        add(d, 'makan-malam', 'Makan malam', 'Makan', 1095, 1125, '');
        add(d, 'skripsi-malam', 'Mengerjakan skripsi', 'Skripsi', 1125, 1200, '');
        add(d, 'membaca', 'Membaca buku', 'Membaca', 1200, 1230, '');
        add(d, 'persiapan-besok', 'Persiapan hari berikutnya', 'Pribadi', 1230, 1245, '');
        add(d, 'persiapan-tidur', 'Persiapan tidur', 'Pribadi', 1245, bedtime, '');
        add(d, 'target-tidur', 'Target tidur', 'Pribadi', bedtime, bedtime + 15, '');
      } else if (d === 5) {
        // Jumat
        add(d, 'skripsi-singkat', 'Sesi singkat skripsi & target akhir pekan', 'Skripsi', 420, 480, academicTargets[5]);
        add(d, 'buah-1', 'Buah porsi pertama', 'Makan', 480, 495, 'Target 1 porsi buah.');
        add(d, 'persiapan-akhir', 'Persiapan akhir', 'Pribadi', 495, workStart, '');
        add(d, 'persiapan-kerja', 'Persiapan kerja', 'Kerja', workStart, workStart + 30, '');
        add(d, 'berangkat', 'Perjalanan ke kantor', 'Kerja', workStart + 30, workStart + 30 + commute, '');
        add(d, 'kerja-1', 'Bekerja', 'Kerja', workStart + 30 + commute, 720, '');
        add(d, 'makan-siang', 'Istirahat dan makan siang', 'Makan', 720, 780, '');
        add(d, 'kerja-2', 'Bekerja', 'Kerja', 780, 915, '');
        add(d, 'buah-2', 'Buah porsi kedua', 'Makan', f2, f2 + 15, 'Target 1 porsi buah.');
        add(d, 'kerja-3', 'Bekerja', 'Kerja', f2 + 15, 1080, '');
        add(d, 'makan-malam', 'Makan malam / jeda makan', 'Makan', 1080, 1110, '');
        add(d, 'lembur', 'Lembur', 'Kerja', 1110, overtimeEnd, 'Tidak ada sesi skripsi atau membaca pada Jumat malam.');
        add(d, 'pulang', 'Perjalanan pulang', 'Kerja', overtimeEnd, overtimeEnd + 30, '');
        add(d, 'bersih', 'Bersih-bersih dan persiapan tidur', 'Pribadi', overtimeEnd + 30, overtimeEnd + 45, '');
        add(d, 'tidur', 'Tidur', 'Pribadi', overtimeEnd + 45, overtimeEnd + 60, '');
      } else if (d === 6) {
        // Sabtu
        const sabtu = [
          ['skripsi-1', 'Mengerjakan skripsi', 'Skripsi', 420, 540, academicTargets[6]],
          ['buah-1', 'Buah porsi pertama', 'Makan', 540, 555, 'Target 1 porsi buah.'],
          ['skripsi-2', 'Mengerjakan skripsi', 'Skripsi', 555, 630, ''],
          ['istirahat-1', 'Istirahat', 'Pribadi', 630, 645, ''],
          ['skripsi-3', 'Mengerjakan skripsi', 'Skripsi', 645, 720, ''],
          ['makan-siang', 'Istirahat dan makan siang', 'Makan', 720, 780, ''],
          ['ppt-1', 'Menyusun PowerPoint', 'Skripsi', 780, 900, ''],
          ['istirahat-2', 'Istirahat', 'Pribadi', 900, 915, ''],
          ['buah-2', 'Buah porsi kedua', 'Makan', 915, 930, 'Target 1 porsi buah.'],
          ['ppt-2', 'Merapikan PowerPoint', 'Skripsi', 930, 1020, ''],
          ['bebas', 'Waktu bebas dan istirahat', 'Pribadi', 1020, 1095, ''],
          ['makan-malam', 'Makan malam', 'Makan', 1095, 1125, ''],
          ['evaluasi', 'Evaluasi skripsi', 'Skripsi', 1125, 1185, ''],
          ['membaca', 'Membaca buku', 'Membaca', 1185, 1215, ''],
          ['pribadi', 'Waktu pribadi', 'Pribadi', 1215, 1245, ''],
          ['persiapan-tidur', 'Persiapan tidur', 'Pribadi', 1245, bedtime, ''],
          ['target-tidur', 'Target tidur', 'Pribadi', bedtime, bedtime + 15, '']
        ];
        sabtu.forEach(([k, t, c, a, b, n]) => add(d, k, t, c, a, b, n));
      } else {
        // Minggu
        const minggu = [
          ['tinjau', 'Meninjau progres skripsi', 'Skripsi', 420, 510, academicTargets[7]],
          ['buah-1', 'Buah porsi pertama', 'Makan', 510, 525, 'Target 1 porsi buah.'],
          ['ppt-1', 'Mengerjakan PowerPoint', 'Skripsi', 525, 600, ''],
          ['istirahat-1', 'Istirahat', 'Pribadi', 600, 630, ''],
          ['latihan', 'Latihan presentasi', 'Skripsi', 630, 720, ''],
          ['makan-siang', 'Istirahat dan makan siang', 'Makan', 720, 780, ''],
          ['perbaikan', 'Perbaikan materi presentasi', 'Skripsi', 780, 870, ''],
          ['bebas-1', 'Waktu bebas', 'Pribadi', 870, 915, ''],
          ['buah-2', 'Buah porsi kedua', 'Makan', 915, 930, 'Target 1 porsi buah.'],
          ['evaluasi', 'Evaluasi mingguan', 'Skripsi', 930, 990, ''],
          ['pribadi', 'Waktu pribadi', 'Pribadi', 990, 1095, ''],
          ['makan-malam', 'Makan malam', 'Makan', 1095, 1125, ''],
          ['persiapan-minggu', 'Persiapan minggu berikutnya', 'Skripsi', 1125, 1170, ''],
          ['membaca', 'Membaca buku', 'Membaca', 1170, 1200, ''],
          ['persiapan-tidur', 'Persiapan tidur', 'Pribadi', 1200, 1230, ''],
          ['tenang', 'Waktu tenang', 'Pribadi', 1230, bedtime, ''],
          ['target-tidur', 'Target tidur', 'Pribadi', bedtime, bedtime + 15, '']
        ];
        minggu.forEach(([k, t, c, a, b, n]) => add(d, k, t, c, a, b, n));
      }
    }
    return acts;
  }

  function initialInventory() {
    const today = new Date();
    return [
      { id: 'inv-demo-jambu', fruitId: 'jambu', name: 'Jambu biji', quantityPurchased: 500, quantityRemaining: 300, unit: 'gram', estimatedServings: 2, purchaseDate: dateKey(addDays(today, -2)), storageLocation: 'Kulkas', condition: 'Agak keras, baik', status: 'available' },
      { id: 'inv-demo-pepaya', fruitId: 'pepaya', name: 'Pepaya', quantityPurchased: 1, quantityRemaining: 1, unit: 'kg utuh', estimatedServings: 4, purchaseDate: dateKey(addDays(today, -1)), storageLocation: 'Suhu ruang', condition: 'Mulai matang', status: 'consume-soon' },
      { id: 'inv-demo-jeruk', fruitId: 'jeruk', name: 'Jeruk', quantityPurchased: 3, quantityRemaining: 3, unit: 'buah', estimatedServings: 3, purchaseDate: dateKey(addDays(today, -2)), storageLocation: 'Kulkas', condition: 'Baik', status: 'available' }
    ];
  }

  return {
    settings, fruitCatalog, academicTargets, thesisTasks, shoppingTemplate,
    fruitSchedule, workoutFocus, buildActivities, initialInventory
  };
})();
