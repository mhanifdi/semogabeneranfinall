/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ============================================================================
 * DIRECTORY ATURAN & FORMULASI PENILAIAN 7 KAIH SMAN 28 JAKARTA (SPESIFIKASI FINAL)
 * ============================================================================
 */

export const PRAYER_SCHEDULE = {
  subuh: {
    name: 'Subuh',
    adzanTime: '04:00',
    nextPrayerTime: '06:00',
    totalMinutes: 120,
  },
  zuhur: {
    name: 'Zuhur',
    adzanTime: '11:38',
    nextPrayerTime: '14:54',
    totalMinutes: 196,
  },
  asar: {
    name: 'Asar',
    adzanTime: '14:54',
    nextPrayerTime: '17:48',
    totalMinutes: 174,
  },
  magrib: {
    name: 'Maghrib',
    adzanTime: '17:48',
    nextPrayerTime: '19:00',
    totalMinutes: 72,
  },
  isya: {
    name: 'Isya',
    adzanTime: '19:00',
    nextPrayerTime: '04:00',
    totalMinutes: 540,
  },
};

export const SCORING_RULES = {
  version: 'v2.1-jawara28-updated',

  // 1. Beribadah Islam — Shalat Wajib & Berhalangan (Perempuan)
  // Checkbox 5 waktu @ 20 poin = 100 poin
  // Jadwal buka: Subuh 04.00, Zuhur 11.38, Asar 14.54, Maghrib 17.48, Isya 19.00
  // Bonus ibadah (puasa sunnah, baca quran, ibadah lainnya) = 10 poin
  // Bonus Adiwiyata tempat ibadah = 10 poin
  shalat: {
    perPrayerScore: 20,
    awalWaktu: 100,
    tengahWaktu: 85,
    akhirWaktu: 70,
    sunnahBonus: 10,
    adiwiyataBonus: 10,
    minCapScore: 0,
    maxScore: 100,
    missedPenalty: 0,
    openTimes: {
      subuh: '04:00',
      zuhur: '11:38',
      asar: '14:54',
      magrib: '17:48',
      isya: '19:00',
    },
    halanganComponents: [
      { id: 'dzikir_doa', label: 'Berdzikir dan berdoa', score: 20 },
      { id: 'murajaah_quran', label: "Mendengar, membaca, atau muraja'ah Al-Qur'an", score: 20 },
      { id: 'berbuat_baik', label: 'Berbuat baik, contohnya bersedekah', score: 20 },
      { id: 'kajian_agama', label: 'Belajar ilmu agama atau mendengarkan kajian', score: 20 },
      { id: 'kebersihan_diri', label: 'Menjaga kebersihan dan kesehatan diri', score: 20 },
    ],
  },

  // Tri Sandhya Hindu (Pagi 05.00, Siang 12.00, Sore 18.00 @ maks 100 pt)
  triSandhya: {
    openTimes: {
      pagi: '05:00',
      siang: '12:00',
      sore: '18:00',
    },
    pagi: { startMin: 300, label: 'Tri Sandhya Pagi (05.00 WIB)' },
    siang: { startMin: 720, label: 'Tri Sandhya Siang (12.00 WIB)' },
    sore: { startMin: 1080, label: 'Tri Sandhya Sore (18.00 WIB)' },
    wedaBonus: 10,
    adiwiyataBonus: 10,
    maxScore: 100,
    missedPenalty: 0,
  },

  // Kristen / Katolik:
  // Ibadah ke Gereja (50 pt) - hanya Sabtu/Minggu, lock sepekan & beri 50 pt tiap hari
  // Membaca Doa sesudah atau sebelum kegiatan (25 pt)
  // Membaca alkitab (25 pt)
  doaKristen: {
    gerejaScore: 50,
    doaKegiatanScore: 25,
    bacaAlkitabScore: 25,
    items: [
      { id: 'gereja', label: 'Ibadah ke Gereja (Sabtu / Minggu)', score: 50 },
      { id: 'doaKegiatan', label: 'Membaca Doa sesudah atau sebelum kegiatan', score: 25 },
      { id: 'alkitab', label: 'Membaca Alkitab', score: 25 },
    ],
    maxScore: 100,
    missedPenalty: 0,
  },

  // 2. Bangun Pagi:
  // Jam bangun tidur:
  // 4—5 = 75 poin (ideal)
  // 5—6 = 60 poin
  // >6 = 45 poin
  // Kondisi mental (3 pilihan):
  // Segar (25 poin)
  // Biasa (15 poin)
  // Kurang (5 poin)
  bangunPagi: {
    brackets: [
      { id: '04.00-05.00', label: '04.00 – 05.00 WIB', minMin: 240, maxMin: 300, score: 75, isIdeal: true },
      { id: '05.00-06.00', label: '05.00 – 06.00 WIB', minMin: 301, maxMin: 360, score: 60, isIdeal: false },
      { id: '>06.00', label: '> 06.00 WIB', minMin: 361, maxMin: 1440, score: 45, isIdeal: false },
    ],
    kondisiMental: [
      { id: 'segar', score: 25, label: 'Segar', desc: 'Tubuh bugar, pikiran jernih, siap menyongsong hari dengan bersemangat.' },
      { id: 'biasa', score: 15, label: 'Biasa', desc: 'Kondisi fisik netral, cukup bertenaga untuk memulai aktivitas harian.' },
      { id: 'kurang', score: 5, label: 'Kurang', desc: 'Merasa lelah, mengantuk, atau kurang tidur, butuh waktu pemulihan.' },
    ],
    conditionRatings: [
      { stars: 5, score: 25, label: 'Segar', desc: 'Tubuh bugar, pikiran jernih, siap menyongsong hari dengan bersemangat.' },
      { stars: 3, score: 15, label: 'Biasa', desc: 'Kondisi fisik netral, cukup bertenaga untuk memulai aktivitas harian.' },
      { stars: 1, score: 5, label: 'Kurang', desc: 'Merasa lelah, mengantuk, atau kurang tidur, butuh waktu pemulihan.' },
    ],
    popups: {
      ideal: 'Cakep, ente Betawi banget! Jangan sampe rejeki dipatok ayam ye!',
      sedang: 'Jangan bangun siang-siang! Nanti rejeki lu dipatok ayam!',
      terlambat: 'Wah... ente ngeledek malaikat rejeki nih...',
    },
    missedPenalty: 0,
  },

  // 3. Makan Bergizi:
  // Isi piringku: Makanan pokok (15), Sayur mayur (15), Lauk pauk (7.5), Buah-buahan (7.5) = 45 poin
  // Rentang ideal: Tepat rentang (10), Diluar rentang (5) = 55 poin per meal session
  // Minum di page 1: <8 gelas = 25, >=8 gelas = 45
  // Bonus Betawi (5 poin) + Adiwiyata tumbler (10 poin)
  makan: {
    makananPokok: 15,
    sayurMayur: 15,
    laukPauk: 7.5,
    buahBuahan: 7.5,
    rentangIdeal: 10,
    rentangLuarIdeal: 5,
    minumKurang8: 25,
    minum8AtauLebih: 45,
    bonusBetawi: 5,
    bonusTumbler: 10,
    missedPenalty: 0,
  },

  // 4. Berolahraga:
  // Intensitas:
  // Tinggi (75) -> Olahraga kompetitif, Sprint, Skipping
  // Menengah (50) -> Seni maen pukul (silat), senam, Jogging
  // Ringan (25) -> Berjalan cepat, peregangan, naik-turun tangga
  // Durasi:
  // <15 menit (25)
  // 15-30 menit (50)
  // >30 menit (75)
  olahraga: {
    intensitas: [
      { id: 'tinggi', label: 'Tinggi', score: 75, examples: 'Olahraga kompetitif, Sprint, Skipping' },
      { id: 'menengah', label: 'Menengah', score: 50, examples: 'Seni maen pukul (silat), senam, Jogging' },
      { id: 'ringan', label: 'Ringan', score: 25, examples: 'Berjalan cepat, peregangan, naik-turun tangga' },
    ],
    durasi: [
      { id: '<15', label: '< 15 menit', score: 25 },
      { id: '15-30', label: '15 – 30 menit', score: 50 },
      { id: '>30', label: '> 30 menit', score: 75 },
    ],
    missedPenalty: 0,
  },

  // 5. Gemar Belajar:
  // Page 1:
  // 1. Mengulang materi pelajaran sekolah / mengerjakan PR
  // 2. Membaca literatur (Non-fiksi / Fiksi)
  // 3. Mempelajari keterampilan baru (Memasak, musik, bahasa asing, pemrograman)
  // 4. Mengikuti kelompok belajar / diskusi materi bersama teman
  // 1 kegiatan = 45 poin, >1 kegiatan = 50 poin
  // Program 28: Menyimak siaran sekolah mengenai adiwiyata dan budaya betawi = +10 poin
  // Page 2:
  // Durasi tambahan: <=30 (15), 31-60 (25), 60-90 (35), 90-120 (45)
  // Deskripsi min 40 char: 40 char (5), 80 char (10)
  belajar: {
    activities: [
      { id: 'mengulang_pr', label: 'Mengulang materi pelajaran sekolah / mengerjakan PR' },
      { id: 'literatur', label: 'Membaca literatur (Non-fiksi / Fiksi)' },
      { id: 'skill_baru', label: 'Mempelajari keterampilan baru (Memasak, musik, bahasa asing, pemrograman)' },
      { id: 'kelompok_belajar', label: 'Mengikuti kelompok belajar / diskusi materi bersama teman' },
    ],
    score1Kegiatan: 45,
    scoreMoreThan1: 50,
    program28Bonus: 10,
    durasiBrackets: [
      { id: '<=30', label: '≤ 30 menit', score: 15 },
      { id: '31-60', label: '31 – 60 menit', score: 25 },
      { id: '60-90', label: '60 – 90 menit', score: 35 },
      { id: '90-120', label: '90 – 120 menit', score: 45 },
    ],
    desc40Score: 5,
    desc80Score: 10,
    minDescChars: 40,
    missedPenalty: 0,
  },

  // 6. Bermasyarakat:
  // Aksi sosial @ 25 poin/kegiatan (maks 75 poin):
  // 1. Membantu pekerjaan rumah atau anggota keluarga.
  // 2. Bertegur sapa dan bersikap santun kepada tetangga atau warga sekolah.
  // 3. Berkontribusi positif dalam bermedia sosial (diskusi kelompok, kampanye positif, berbagi informasi/membuat konten edukasi)
  // Deskripsi min 40 char (10 poin), 80++ char (15 poin)
  // Bonus: Nyambat (kerja bakti/gotong royong) menjaga kebersihan lingkungan (+10 poin)
  // Link rujukan: https://www.senibudayabetawi.com/8001/memaknai-gotong-royong-tradisi-nyambat-masyarakat-betawi.html
  masyarakat: {
    socialActionsList: [
      { id: 'bantu_rumah', label: 'Membantu pekerjaan rumah atau anggota keluarga.' },
      { id: 'tegur_sapa', label: 'Bertegur sapa dan bersikap santun kepada tetangga atau warga sekolah.' },
      { id: 'medsos_positif', label: 'Berkontribusi positif dalam bermedia sosial (diskusi kelompok, kampanye positif, berbagi informasi/membuat konten edukasi)' },
    ],
    pointsPerAction: 25,
    desc40Score: 10,
    desc80Score: 15,
    minDescChars: 40,
    nyambatBonus: 10,
    nyambatUrl: 'https://www.senibudayabetawi.com/8001/memaknai-gotong-royong-tradisi-nyambat-masyarakat-betawi.html',
    missedPenalty: 0,
  },

  // 7. Tidur Cepat:
  // Buka pukul 18.00 (6 sore) WIB
  // Opsi kartu klik-klik:
  // Jam tidur: <21.30 (75), 21.30 - 22.30 (65), 22.31 - 23.30 (55), >23.31 (45)
  // Kualitas tidur: Rileks (25), Belum mengantuk (15), Hiperaktif (5)
  // Adiwiyata hemat energi (10 poin)
  tidur: {
    openHour: 18, // 18.00 WIB
    brackets: [
      { id: '<21.30', label: '< 21.30 WIB', score: 75 },
      { id: '21.30-22.30', label: '21.30 – 22.30 WIB', score: 65 },
      { id: '22.31-23.30', label: '22.31 – 23.30 WIB', score: 55 },
      { id: '>23.31', label: '> 23.31 WIB', score: 45 },
    ],
    kualitasOptions: [
      { id: 'rileks', label: 'Rileks (tenang, santai)', score: 25, desc: 'Tubuh rileks, pikiran tenang dan siap istirahat pulas.' },
      { id: 'belum_ngantuk', label: 'Belum mengantuk', score: 15, desc: 'Kondisi fisik netral, perlu beberapa saat untuk memejamkan mata.' },
      { id: 'hiperaktif', label: 'Hiperaktif (stress, gelisah, tegang)', score: 5, desc: 'Tubuh tegang atau pikiran gelisah, sulit memasuki fase rileks.' },
    ],
    adiwiyataHematEnergiBonus: 10,
    missedPenalty: 0,
  },
  tidurCepat: {
    openHour: 18,
    brackets: [
      { id: '<21.30', label: '< 21.30 WIB', score: 75 },
      { id: '21.30-22.30', label: '21.30 – 22.30 WIB', score: 65 },
      { id: '22.31-23.30', label: '22.31 – 23.30 WIB', score: 55 },
      { id: '>23.31', label: '> 23.31 WIB', score: 45 },
    ],
    kualitasOptions: [
      { id: 'rileks', label: 'Rileks (tenang, santai)', score: 25 },
      { id: 'belum_ngantuk', label: 'Belum mengantuk', score: 15 },
      { id: 'hiperaktif', label: 'Hiperaktif (stress, gelisah, tegang)', score: 5 },
    ],
    adiwiyataHematEnergiBonus: 10,
    missedPenalty: 0,
  },

  // 8. Aktivitas Seru
  aktivitasSeru: {
    bonusPoints: 10,
  },
};

export const SCORING_CONFIG = {
  bangunPagi: {
    wakeTimePoints: {
      slot_0400_0500: 75,
      slot_0500_0600: 60,
      after_0600: 45,
      slot_0400_0420: 75,
      slot_0421_0440: 70,
      slot_0441_0500: 65,
      slot_0501_0620: 60,
      slot_0621_0640: 55,
      after_0640: 50,
    },
    conditionRatings: SCORING_RULES.bangunPagi.kondisiMental,
    brackets: SCORING_RULES.bangunPagi.brackets,
  },
  tidurCepat: {
    sleepTimePoints: {
      before_2130: 75,
      slot_2130_2230: 65,
      slot_2231_2330: 55,
      after_2330: 45,
    },
    conditionRatings: SCORING_RULES.tidur.kualitasOptions,
    brackets: SCORING_RULES.tidur.brackets,
  },
  beribadah: {
    islam: {
      prayerPoints: {
        perPrayer: 20,
        awal: 100,
        tengah: 85,
        akhir: 70,
      },
      openTimes: SCORING_RULES.shalat.openTimes,
      halanganComponents: [
        { id: 'dzikir_doa', label: 'Berdzikir dan berdoa', points: 20, score: 20 },
        { id: 'murajaah_quran', label: "Mendengar, membaca, atau muraja'ah Al-Qur'an", points: 20, score: 20 },
        { id: 'berbuat_baik', label: 'Berbuat baik, contohnya bersedekah', points: 20, score: 20 },
        { id: 'kajian_agama', label: 'Belajar ilmu agama atau mendengarkan kajian', points: 20, score: 20 },
        { id: 'kebersihan_diri', label: 'Menjaga kebersihan dan kesehatan diri', points: 20, score: 20 },
      ],
      sunnahBonus: 10,
      adiwiyataBonus: 10,
    },
    hindu: {
      openTimes: SCORING_RULES.triSandhya.openTimes,
      defaultSchedule: {
        pagi: '05:00',
        siang: '12:00',
        sore: '18:00',
      },
      triSandhyaPoints: {
        awal: 100,
        tengah: 85,
        akhir: 70,
      },
      wedaBonus: 10,
      adiwiyataBonus: 10,
    },
    kristenKatolik: {
      items: SCORING_RULES.doaKristen.items,
      gerejaScore: 50,
      doaKegiatanScore: 25,
      bacaAlkitabScore: 25,
    },
  },
  makanBergizi: {
    isiPiringku: {
      makananPokok: 15,
      sayurMayur: 15,
      laukPauk: 7.5,
      buahBuahan: 7.5,
    },
    sessionComponents: {
      waktuIdeal: 10,
      waktuDiluarIdeal: 5,
      karbohidrat: 15,
      lauk: 7.5,
      sayur: 15,
      buah: 7.5,
      minum2GelasAtauLebih: 20,
      minum1Gelas: 15,
      minum0Gelas: 0,
    },
    bonusAdiwiyata: {
      kotakMakan: 5,
      tumbler: 10,
    },
    waktuIdeal: 10,
    waktuLuarIdeal: 5,
    minumKurang8: 25,
    minum8AtauLebih: 45,
    bonusBetawi: 5,
    bonusTumbler: 10,
  },
  berolahraga: {
    intensitas: SCORING_RULES.olahraga.intensitas,
    durasi: SCORING_RULES.olahraga.durasi,
  },
  gemarBelajar: {
    activities: SCORING_RULES.belajar.activities,
    score1: 45,
    scoreMore: 50,
    program28: 10,
    durasiBrackets: SCORING_RULES.belajar.durasiBrackets,
    desc40: 5,
    desc80: 10,
  },
  bermasyarakat: {
    socialActionsList: SCORING_RULES.masyarakat.socialActionsList,
    socialActionOptions: [
      'Membantu pekerjaan rumah atau anggota keluarga.',
      'Bertegur sapa dan bersikap santun kepada tetangga atau warga sekolah.',
      'Berkontribusi positif dalam bermedia sosial (diskusi kelompok, kampanye positif, berbagi informasi/membuat konten edukasi)',
    ],
    pointsPerAction: 25,
    desc40: 10,
    desc80: 15,
    nyambatBonus: 10,
    nyambatUrl: SCORING_RULES.masyarakat.nyambatUrl,
  },
};
