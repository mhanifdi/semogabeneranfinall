import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBangunPagiScore,
  calculateBeribadahScoreWithBreakdown,
  calculateIslamHalanganScore,
  calculateMakanBergiziScoreWithBreakdown,
  calculateBerolahragaScoreWithBreakdown,
  calculateGemarBelajarScoreWithBreakdown,
  calculateBermasyarakatScoreWithBreakdown,
  calculateTidurCepatScoreWithBreakdown,
  applyBonusCapAndOverflow,
  getHonestyPenalty
} from './scoring';

test('Aturan Umum 1.4: Tidak ada pengurangan nilai 5 poin untuk pengisian fleksibel atau terlambat', () => {
  assert.equal(getHonestyPenalty(true), 0);
  assert.equal(getHonestyPenalty(false), 0);
});

test('Aturan Umum 10.1: Nilai Capaian maksimal 100 dan kelebihan bonus masuk ke Poin Hebat (overflowBonus)', () => {
  const res = applyBonusCapAndOverflow(95, 15);
  assert.equal(res.finalScore, 100, 'Nilai Capaian harus dibatasi maksimal 100');
  assert.equal(res.bonusAppliedToScore, 5, '5 poin bonus menutup kekurangan ke 100');
  assert.equal(res.overflowBonus, 10, 'Sisa 10 poin bonus masuk ke Poin Hebat');
});

test('Bangun Pagi: Rentang waktu 75/70/65/60/55/50 + Kondisi 25/20/15/10/5', () => {
  const max = calculateBangunPagiScore('04.00-04.20', 5);
  assert.equal(max, 100, '04.00-04.20 (75) + Sangat segar (25) = 100');

  const mid = calculateBangunPagiScore('04.41-05.00', 4);
  assert.equal(mid, 85, '04.41-05.00 (65) + Cukup segar (20) = 85');

  const late = calculateBangunPagiScore('>06.40', 1);
  assert.equal(late, 55, '>06.40 (50) + Pusing/kelelahan (5) = 55');
});

test('Beribadah Islam Reguler: 5 shalat dirata-ratakan + bonus sunnah 5 poin', () => {
  const res = calculateBeribadahScoreWithBreakdown('Islam', {
    subuh: 'awal',
    dzuhur: 'awal',
    ashar: 'tengah',
    maghrib: 'awal',
    isya: 'akhir',
    puasaSunnah: true,
    sunnahText: 'Tahajud 2 rakaat'
  });
  // (100 + 100 + 85 + 100 + 70) / 5 = 455 / 5 = 91, + 5 bonus sunnah = 96
  assert.equal(res.baseScore, 91);
  assert.equal(res.bonusPoints, 5);
  assert.equal(res.finalScore, 96);
  assert.equal(res.completedPrayers, 5);
});

test('Beribadah Islam Siswi Berhalangan (Addendum B): 5 komponen @ 20 poin = 100 maksimal', () => {
  const partial = calculateIslamHalanganScore({
    dzikirDoa: true,
    murajaahQuran: true,
    berbuatBaik: true,
    kajianAgama: false,
    kebersihanDiri: false
  });
  assert.equal(partial.completedCount, 3);
  assert.equal(partial.finalScore, 60);

  const fullViaBeribadah = calculateBeribadahScoreWithBreakdown('Islam', {
    isHalangan: true,
    halangan: {
      dzikirDoa: true,
      murajaahQuran: true,
      berbuatBaik: true,
      kajianAgama: true,
      kebersihanDiri: true
    }
  });
  assert.equal(fullViaBeribadah.isHalangan, true);
  assert.equal(fullViaBeribadah.completedPrayers, 5);
  assert.equal(fullViaBeribadah.finalScore, 100);
});

test('Beribadah Kristen/Katolik & Hindu Tri Sandhya', () => {
  const kristen = calculateBeribadahScoreWithBreakdown('Kristen', {
    doaBangunTidur: true,
    bacaAlkitab: true,
    doaMakan: true,
    doaKegiatan: true,
    doaTidur: true,
    bonusKitabSuci: true
  });
  assert.equal(kristen.baseScore, 100);
  assert.equal(kristen.bonusPoints, 5);
  assert.equal(kristen.finalScore, 100);
  assert.equal(kristen.overflowBonus, 5, 'Bonus +5 saat baseScore 100 masuk ke Poin Hebat');

  const hindu = calculateBeribadahScoreWithBreakdown('Hindu', {
    pagi: 'awal',
    siang: 'tengah',
    sore: 'awal',
    bacaWeda: true
  });
  // (100 + 85 + 100) / 3 = 95 + 5 = 100
  assert.equal(hindu.baseScore, 95);
  assert.equal(hindu.finalScore, 100);
});

test('Makan Bergizi: 3 sesi (Waktu 15/10, Karbo 17.5, Lauk 17.5, Sayur 15, Buah 15, Air 20/15/0) + Adiwiyata', () => {
  const full3 = calculateMakanBergiziScoreWithBreakdown({
    pagi: { waktu: 'ideal', karbo: true, lauk: true, sayur: true, buah: true, airGelas: 2 },
    siang: { waktu: 'ideal', karbo: true, lauk: true, sayur: true, buah: true, airGelas: 2 },
    malam: { waktu: 'ideal', karbo: true, lauk: true, sayur: true, buah: true, airGelas: 2 },
    useLunchbox: true,
    useTumbler: true
  });
  assert.equal(full3.baseScore, 100);
  assert.equal(full3.bonusPoints, 10);
  assert.equal(full3.finalScore, 100);
  assert.equal(full3.overflowBonus, 10);

  // Jika hanya sarapan & siang (malam kosong = 0, tetap dibagi 3)
  const twoMeals = calculateMakanBergiziScoreWithBreakdown({
    pagi: { waktu: 'ideal', karbo: true, lauk: true, sayur: true, buah: true, airGelas: 2 },
    siang: { waktu: 'ideal', karbo: true, lauk: true, sayur: true, buah: true, airGelas: 1 } // 95 pt
  });
  // (100 + 95 + 0) / 3 = 65
  assert.equal(twoMeals.baseScore, 65);
});

test('Berolahraga: Aktivitas 4x10 + Durasi 25/35/45 + Deskripsi 15/10/0 + Adiwiyata 5', () => {
  const res = calculateBerolahragaScoreWithBreakdown({
    mandiri: true,
    kelompok: true,
    jalanTangga: true,
    pemanasan: true,
    durasiKategori: '>30',
    deskripsi: 'Latihan basket bersama tim sekolah selama 45 menit',
    ecoCommute: true
  });
  // 40 + 45 + 15 = 100, +5 ecoCommute -> overflow 5
  assert.equal(res.baseScore, 100);
  assert.equal(res.finalScore, 100);
  assert.equal(res.overflowBonus, 5);
});

test('Gemar Belajar: Durasi 60..0 + Aktivitas 30..0 + Deskripsi 10/5/0', () => {
  const res = calculateGemarBelajarScoreWithBreakdown({
    durasiKategori: '>3_jam',
    activities: ['Mengerjakan tugas', 'Membaca buku', 'Latihan soal'],
    deskripsi: 'Belajar fisika bab mekanika dan latihan soal olimpiade'
  });
  assert.equal(res.finalScore, 100);
});

test('Bermasyarakat: Tindakan sosial 90/80/70/60/0 + Deskripsi 10/5/0 + Bonus piket 5', () => {
  const res = calculateBermasyarakatScoreWithBreakdown({
    actions: [
      'Membantu orang tua atau saudara di rumah',
      'Berbagi makanan atau barang dengan teman',
      'Menjaga kebersihan lingkungan sekolah atau rumah',
      'Menolong teman yang mengalami kesulitan'
    ],
    deskripsi: 'Membantu ibu membersihkan halaman rumah dan berbagi bekal di kelas',
    bonusPiket: true
  });
  // >=4 tindakan (90) + deskripsi >15 char (10) = 100, + 5 bonus piket -> overflow 5
  assert.equal(res.baseScore, 100);
  assert.equal(res.finalScore, 100);
  assert.equal(res.overflowBonus, 5);
});

test('Tidur Cepat: Rentang waktu 75/65/55/45 + Kondisi 25..5 + Bonus mematikan lampu 5', () => {
  const res = calculateTidurCepatScoreWithBreakdown('<21.30', 5, false, true);
  // 75 + 25 = 100, + 5 lampu -> overflow 5
  assert.equal(res.baseScore, 100);
  assert.equal(res.finalScore, 100);
  assert.equal(res.overflowBonus, 5);
});
