/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VERTIKAL SMA JAWARA 28
 * Rumus Penilaian 7 Kebiasaan Anak Indonesia Hebat (7 KAIH)
 * Sesuai Spesifikasi Final & Pembaruan Sistem Aturan Penilaian
 */

import { PRAYER_SCHEDULE, SCORING_RULES } from '../config/scoringConfig';
import { timeToMinutes } from './timeClassifier';

export interface ScoreBreakdownResult {
  baseScore: number;            // Nilai dasar sebelum bonus (0-100)
  bonusScore: number;           // Total bonus yang diperoleh (Adiwiyata, Sunnah, Betawi, dsb.)
  bonusPoints: number;          // Alias untuk bonusScore
  bonusAppliedToScore?: number; // Poin bonus yang diserap untuk menggenapkan nilai capaian ke 100
  nilaiCapaian: number;         // Nilai Capaian akhir kebiasaan (Maksimal 100)
  finalScore: number;           // Nilai Capaian akhir (alias nilaiCapaian)
  overflowBonus: number;        // Bonus berlebih di atas 100 yang dialihkan ke Poin Hebat
  timePoints?: number;          // Poin komponen waktu (jika ada)
  conditionPoints?: number;     // Poin komponen kondisi/kebugaran (jika ada)
  timeLabel?: string;           // Label deskripsi slot waktu
  isHalangan?: boolean;
  completedPrayers?: number;
  completedCount?: number;
  [key: string]: any;
}

/**
 * Aturan Umum:
 * Tidak ada pengurangan nilai 5 poin untuk pengisian fleksibel atau formulir terlewat.
 */
export function getHonestyPenalty(_isMissed?: boolean): number {
  return 0;
}

/**
 * Mekanisme Bonus:
 * 1. Nilai Capaian suatu kebiasaan maksimal 100.
 * 2. Bonus menambah Nilai Capaian selama hasil akhirnya belum mencapai 100.
 * 3. Jika Nilai Capaian sudah 100, bonus yang berlebih dialihkan ke Poin Hebat (overflowBonus).
 * 4. Nilai Capaian tidak boleh melebihi 100.
 */
export function applyBonusCapAndOverflow(baseScore: number, bonusScore: number): ScoreBreakdownResult {
  const cleanBase = Math.max(0, Math.round(baseScore * 100) / 100);
  const cleanBonus = Math.max(0, Math.round(bonusScore * 100) / 100);
  const combined = cleanBase + cleanBonus;
  const nilaiCapaian = Math.min(100, Math.round(combined * 10) / 10);
  const bonusAppliedToScore = Math.min(cleanBonus, Math.max(0, 100 - Math.min(100, cleanBase)));
  const overflowBonus = Math.max(0, Math.round((combined - 100) * 10) / 10);

  return {
    baseScore: Math.min(100, cleanBase),
    bonusScore: cleanBonus,
    bonusPoints: cleanBonus,
    bonusAppliedToScore,
    nilaiCapaian,
    finalScore: nilaiCapaian,
    overflowBonus,
  };
}

// ============================================================================
// 1. BANGUN PAGI
// Jam bangun tidur:
// 4—5 = 75 poin (ideal)
// 5—6 = 60 poin
// >6 = 45 poin
// Kondisi mental (3 pilihan):
// 25 poin - Segar
// 15 poin - Biasa
// 5 poin - Kurang
// Di bawahnya kolom afirmasi hari ini
// ============================================================================
export interface BangunPagiInput {
  timeStr?: string; // e.g. "04:15"
  timeSlot?: string; // e.g. "04.00-05.00"
  kebugaranLevel?: number | string; // 25, 15, 5 or 'segar', 'biasa', 'kurang'
  kondisiMental?: string;
  afirmasi?: string;
  isMissed?: boolean;
}

export function classifyBangunPagiTime(timeStr: string): { slotId: string; score: number; label: string } {
  const min = timeToMinutes(timeStr);
  if (min >= 240 && min <= 300) {
    return { slotId: '04.00-05.00', score: 75, label: '04.00 – 05.00 WIB (Ideal)' };
  }
  if (min > 300 && min <= 360) {
    return { slotId: '05.00-06.00', score: 60, label: '05.00 – 06.00 WIB' };
  }
  return { slotId: '>06.00', score: 45, label: '> 06.00 WIB' };
}

export function calculateBangunPagiScoreWithBreakdown(
  inputOrTime: BangunPagiInput | string,
  kebugaranLevel?: number | string,
  _isMissed?: boolean
): ScoreBreakdownResult {
  const input: BangunPagiInput = typeof inputOrTime === 'string'
    ? { [inputOrTime.includes(':') ? 'timeStr' : 'timeSlot']: inputOrTime, kebugaranLevel }
    : inputOrTime;

  let timeScore = 45;
  let timeLabel = '> 06.00 WIB';

  if (input.timeSlot) {
    if (input.timeSlot === '04.00-05.00' || input.timeSlot.includes('04.') || input.timeSlot.includes('04:')) {
      timeScore = 75;
      timeLabel = '04.00 – 05.00 WIB (Ideal)';
    } else if (input.timeSlot === '05.00-06.00' || input.timeSlot.includes('05.') || input.timeSlot.includes('05:')) {
      timeScore = 60;
      timeLabel = '05.00 – 06.00 WIB';
    } else {
      timeScore = 45;
      timeLabel = '> 06.00 WIB';
    }
  } else if (input.timeStr) {
    const classified = classifyBangunPagiTime(input.timeStr);
    timeScore = classified.score;
    timeLabel = classified.label;
  }

  // Kondisi mental (3 pilihan: Segar 25, Biasa 15, Kurang 5)
  let conditionPoints = 15;
  const condVal = input.kondisiMental || input.kebugaranLevel;
  if (condVal === 'segar' || condVal === 25 || condVal === 5 || condVal === '5') {
    conditionPoints = 25;
  } else if (condVal === 'kurang' || condVal === 5 || condVal === 1 || condVal === '1') {
    conditionPoints = 5;
  } else if (condVal === 'biasa' || condVal === 15 || condVal === 3 || condVal === '3') {
    conditionPoints = 15;
  } else if (typeof condVal === 'number') {
    if (condVal >= 20) conditionPoints = 25;
    else if (condVal >= 10) conditionPoints = 15;
    else conditionPoints = 5;
  }

  const baseScore = Math.min(100, timeScore + conditionPoints);
  const res = applyBonusCapAndOverflow(baseScore, 0);

  return {
    ...res,
    timePoints: timeScore,
    conditionPoints,
    timeLabel,
  };
}

export function calculateBangunPagiScore(
  inputOrTime: BangunPagiInput | string,
  kebugaranLevel?: number | string,
  isMissed?: boolean
): number {
  return calculateBangunPagiScoreWithBreakdown(inputOrTime, kebugaranLevel, isMissed).finalScore;
}

// ============================================================================
// 2. BERIBADAH (ISLAM, KRISTEN, HINDU)
// - Islam: Shalat 5 waktu (checkbox @ 20 poin = 100).
//   Jadwal buka: Subuh 04.00, Zuhur 11.38, Asar 14.54, Maghrib 17.48, Isya 19.00
//   Bonus Ibadah: Puasa sunnah, Baca quran, Ibadah lainnya -> 10 poin bonus.
//   Adiwiyata: Menjaga kebersihan tempat ibadah -> 10 poin bonus.
// - Hindu: Tri Sandhya checkboxes (Pagi 05.00, Siang 12.00, Sore 18.00).
//   Bonus Weda (10) + Adiwiyata (10).
// - Kristen: Checkbox Ibadah Gereja (50 pt, hanya Sabtu/Minggu, lock sepekan & +50 per hari),
//   Doa sebelum/sesudah kegiatan (25 pt), Baca Alkitab (25 pt). Total 100. Tak ada bonus.
// ============================================================================

export interface IslamHalanganInput {
  dzikirDoa?: boolean;
  murajaahQuran?: boolean;
  berbuatBaik?: boolean;
  kajianAgama?: boolean;
  kebersihanDiri?: boolean;
  [key: string]: any;
}

export function calculateIslamHalanganScore(input: IslamHalanganInput): ScoreBreakdownResult {
  let count = 0;
  if (input.dzikirDoa) count++;
  if (input.murajaahQuran) count++;
  if (input.berbuatBaik) count++;
  if (input.kajianAgama) count++;
  if (input.kebersihanDiri) count++;
  const baseScore = Math.min(100, count * 20);
  return applyBonusCapAndOverflow(baseScore, 0);
}

export interface IslamIbadahInput {
  isHalangan?: boolean;
  halanganComponents?: IslamHalanganInput;
  prayersDone?: string[];
  subuh?: boolean | string;
  zuhur?: boolean | string;
  dzuhur?: boolean | string;
  asar?: boolean | string;
  ashar?: boolean | string;
  magrib?: boolean | string;
  maghrib?: boolean | string;
  isya?: boolean | string;
  puasaSunnah?: boolean;
  bacaQuran?: boolean;
  quranSurah?: string;
  quranAyatCount?: string | number;
  ibadahLainnya?: boolean;
  ibadahLainnyaText?: string;
  adiwiyataTempatIbadah?: boolean;
  isMissed?: boolean;
  [key: string]: any;
}

export function calculateIslamScoreWithBreakdown(input: IslamIbadahInput): ScoreBreakdownResult {
  if (input.isHalangan) {
    const halSrc = input.halanganComponents || input.halangan;
    const compScore = halSrc !== undefined
      ? calculateIslamHalanganScore(halSrc).finalScore
      : 100;
    const adiwiyata = input.adiwiyataTempatIbadah ? 10 : 0;
    const res = applyBonusCapAndOverflow(compScore, adiwiyata);
    return {
      ...res,
      isHalangan: true,
      completedPrayers: 5,
      completedCount: Math.round(compScore / 20),
    };
  }

  const prayers = ['subuh', 'zuhur', 'asar', 'magrib', 'isya'] as const;
  let completedPrayers = 0;

  for (const p of prayers) {
    const val =
      (input as any)[p] ??
      (p === 'zuhur' ? (input as any)['dzuhur'] : undefined) ??
      (p === 'asar' ? (input as any)['ashar'] : undefined) ??
      (p === 'magrib' ? (input as any)['maghrib'] : undefined);

    const isDone = Boolean(
      val === true ||
      val === '1' ||
      val === 1 ||
      (typeof val === 'string' && val.trim().length > 0) ||
      input.prayersDone?.includes(p) ||
      (p === 'zuhur' && input.prayersDone?.includes('dzuhur')) ||
      (p === 'asar' && input.prayersDone?.includes('ashar')) ||
      (p === 'magrib' && input.prayersDone?.includes('maghrib'))
    );

    if (isDone) completedPrayers++;
  }

  const baseScore = completedPrayers * 20;

  // Bonus ibadah (puasa sunnah, baca quran, ibadah lainnya): salah satu atau semua = 10 poin
  const hasBonusIbadah = Boolean(
    input.puasaSunnah ||
    input.bacaQuran ||
    (input.quranSurah && input.quranSurah.trim().length > 0) ||
    input.ibadahLainnya ||
    (input.ibadahLainnyaText && input.ibadahLainnyaText.trim().length > 0) ||
    (input.sunnahActivities && input.sunnahActivities.trim().length > 0)
  );

  const bonusIbadahPoints = hasBonusIbadah ? 10 : 0;
  const bonusAdiwiyata = input.adiwiyataTempatIbadah ? 10 : 0;
  const totalBonus = bonusIbadahPoints + bonusAdiwiyata;

  const res = applyBonusCapAndOverflow(baseScore, totalBonus);
  return {
    ...res,
    completedPrayers,
    completedCount: completedPrayers,
  };
}

export function calculateIslamScore(input: IslamIbadahInput): number {
  return calculateIslamScoreWithBreakdown(input).finalScore;
}

export interface KristenIbadahInput {
  ibadahGereja?: boolean;
  gerejaMingguanAktif?: boolean;
  doaKegiatan?: boolean;
  bacaAlkitab?: boolean;
  [key: string]: any;
}

export function calculateKristenScoreWithBreakdown(input: KristenIbadahInput): ScoreBreakdownResult {
  let baseScore = 0;
  // Gereja: 50 poin
  if (input.ibadahGereja || input.gerejaMingguanAktif || input.gereja) {
    baseScore += 50;
  }
  // Doa sesudah/sebelum kegiatan: 25 poin
  if (input.doaKegiatan || input.doaSebelumSesudahKegiatan || input.doa_kegiatan) {
    baseScore += 25;
  }
  // Membaca alkitab: 25 poin
  if (input.bacaAlkitab || input.membacaAlkitab || input.alkitab) {
    baseScore += 25;
  }

  // Kristen tak ada bonus
  const res = applyBonusCapAndOverflow(Math.min(100, baseScore), 0);
  return {
    ...res,
    completedPrayers: Math.round(baseScore / 25),
  };
}

export function calculateKristenScore(input: KristenIbadahInput): number {
  return calculateKristenScoreWithBreakdown(input).finalScore;
}

export interface HinduIbadahInput {
  pagi?: boolean;
  siang?: boolean;
  sore?: boolean;
  triSandhya?: ('pagi' | 'siang' | 'sore')[];
  bacaWeda?: boolean;
  adiwiyataTempatIbadah?: boolean;
  [key: string]: any;
}

export function calculateHinduScoreWithBreakdown(input: HinduIbadahInput): ScoreBreakdownResult {
  let count = 0;
  if (input.pagi || input.triSandhya?.includes('pagi')) count++;
  if (input.siang || input.triSandhya?.includes('siang')) count++;
  if (input.sore || input.triSandhya?.includes('sore')) count++;

  let baseScore = 0;
  if (count === 3) baseScore = 100;
  else if (count === 2) baseScore = 67;
  else if (count === 1) baseScore = 34;

  const bonusWeda = (input.bacaWeda || input.otherWorship) ? 10 : 0;
  const bonusAdiwiyata = input.adiwiyataTempatIbadah ? 10 : 0;

  const res = applyBonusCapAndOverflow(baseScore, bonusWeda + bonusAdiwiyata);
  return {
    ...res,
    completedPrayers: count,
  };
}

export function calculateHinduScore(input: HinduIbadahInput): number {
  return calculateHinduScoreWithBreakdown(input).finalScore;
}

export function calculateBeribadahScoreWithBreakdown(
  religion: 'Islam' | 'Kristen' | 'Katolik' | 'Hindu' | string,
  input: any
): ScoreBreakdownResult {
  const norm = (religion || 'Islam').toLowerCase();
  if (norm === 'hindu') {
    return calculateHinduScoreWithBreakdown(input);
  }
  if (norm === 'kristen' || norm === 'katolik') {
    return calculateKristenScoreWithBreakdown(input);
  }
  return calculateIslamScoreWithBreakdown(input);
}

// ============================================================================
// 3. BEROLAHRAGA
// Berdasarkan intensitas (pg1):
// Tinggi (75 poin) --> Olahraga kompetitif, Sprint, Skipping, Renang cepat
// Menengah (50 poin) --> Seni maen pukul (silat), senam kebugaran, Jogging
// Ringan (25 poin) --> Berjalan cepat, peregangan, naik-turun tangga
// Durasi (pg2):
// <15 menit (25 poin)
// 15-30 menit (50 poin)
// >30 menit (75 poin)
// Rumus Skor Baru:
// - rawSum = intensitas + durasi (maks 150)
// - baseScore = Math.min(100, rawSum)
// - Jika rawSum > 100, kelebihan poin dibagi 10 dimasukkan ke Poin Hebat: (rawSum - 100) / 10
// - Bonus Adiwiyata: Jalan kaki atau bersepeda ke sekolah (+10 poin bonus)
// ============================================================================
export interface OlahragaInput {
  intensitas?: 'tinggi' | 'menengah' | 'ringan' | string;
  durasiKategori?: '<15' | '15-30' | '>30' | string;
  duration?: string;
  deskripsi?: string;
  notes?: string;
  jalanKakiSepeda?: boolean;
  bersepedaKaki?: boolean;
  ecoCommute?: boolean;
  adiwiyata?: boolean;
  isMissed?: boolean;
  [key: string]: any;
}

export function calculateOlahragaScoreWithBreakdown(input: OlahragaInput, _isMissed?: boolean): ScoreBreakdownResult {
  let intensitasScore = 50;
  const intKey = String(input.intensitas || '').toLowerCase();
  if (intKey.includes('tinggi') || intKey === '75') {
    intensitasScore = 75;
  } else if (intKey.includes('ringan') || intKey === '25') {
    intensitasScore = 25;
  } else if (intKey.includes('menengah') || intKey === '50') {
    intensitasScore = 50;
  }

  let durasiScore = 50;
  const durKey = String(input.durasiKategori || input.duration || '').trim();
  if (durKey === '<15' || durKey.includes('<15') || durKey === '25') {
    durasiScore = 25;
  } else if (durKey === '15-30' || durKey.includes('15-30') || durKey === '50') {
    durasiScore = 50;
  } else if (durKey === '>30' || durKey.includes('>30') || durKey === '75') {
    durasiScore = 75;
  }

  // rawSum maks 150 (Tinggi 75 + >30m 75)
  const rawSum = intensitasScore + durasiScore;
  const baseScore = Math.min(100, rawSum);
  const rawOverflow = rawSum > 100 ? (rawSum - 100) / 10 : 0;

  // Bonus Adiwiyata: Berjalan kaki atau bersepeda ke sekolah (+10 poin)
  const hasAdiwiyata = Boolean(
    input.jalanKakiSepeda ||
    input.bersepedaKaki ||
    input.ecoCommute ||
    input.adiwiyata
  );
  const adiwiyataBonus = hasAdiwiyata ? 10 : 0;

  // Nilai Capaian maks 100
  const bonusAppliedToScore = Math.min(adiwiyataBonus, Math.max(0, 100 - baseScore));
  const finalScore = Math.min(100, baseScore + bonusAppliedToScore);
  const adiwiyataOverflow = Math.max(0, adiwiyataBonus - bonusAppliedToScore);
  const totalOverflow = Math.round((rawOverflow + adiwiyataOverflow) * 10) / 10;

  return {
    baseScore,
    bonusScore: adiwiyataBonus,
    bonusPoints: adiwiyataBonus,
    bonusAppliedToScore,
    nilaiCapaian: finalScore,
    finalScore,
    overflowBonus: totalOverflow,
    intensitasScore,
    durasiScore,
    actScore: intensitasScore,
    durScore: durasiScore,
    rawSum,
  };
}

export function calculateOlahragaScore(input: OlahragaInput): number {
  return calculateOlahragaScoreWithBreakdown(input).finalScore;
}
export const calculateBerolahragaScoreWithBreakdown = calculateOlahragaScoreWithBreakdown;

// ============================================================================
// 4. MAKAN BERGIZI
// Page 1:
// - Poin minum ditaruh di opsi awal: <8 gelas = 25, >=8 gelas = 45
// - Opsi puasa terintegrasi dengan beribadah
// - Bonus: Makanan Betawi (5 poin bonus), Adiwiyata tumbler (10 poin bonus)
// Page 2:
// - 2 Opsi: Makan di rentang waktu ideal (10 poin), diluar rentang ideal (5 poin)
// - Isi piringku: Makanan pokok (15), Sayur mayur (15), Lauk pauk (7.5), Buah-buahan (7.5) = 45 poin
// ============================================================================
export interface MakanSingleMealInput {
  mealType?: 'sarapan' | 'siang' | 'malam' | 'sahur' | 'buka' | string;
  isRentangIdeal?: boolean;
  makananPokok?: boolean;
  sayurMayur?: boolean;
  laukPauk?: boolean;
  buahBuahan?: boolean;
  karbo?: boolean;
  sayur?: boolean;
  lauk?: boolean;
  buah?: boolean;
  gelasAir?: number | string;
  makananBetawi?: boolean;
  namaMakananBetawi?: string;
  bawaTumbler?: boolean;
  isPuasa?: boolean;
  [key: string]: any;
}

export function calculateSingleMealScoreWithBreakdown(input: MakanSingleMealInput): ScoreBreakdownResult {
  const timeScore = input.isRentangIdeal ? 10 : 5;
  let piringScore = 0;
  if (input.makananPokok || input.karbo) piringScore += 15;
  if (input.sayurMayur || input.sayur) piringScore += 15;
  if (input.laukPauk || input.lauk) piringScore += 7.5;
  if (input.buahBuahan || input.buah) piringScore += 7.5;

  const mealBase = timeScore + piringScore; // maks 55 per sesi makan

  let bonusPoints = 0;
  if (input.makananBetawi) bonusPoints += 5;
  if (input.bawaTumbler || input.tumblerEco) bonusPoints += 10;

  return applyBonusCapAndOverflow(mealBase, bonusPoints);
}

export function calculateSingleMealScore(input: MakanSingleMealInput): number {
  return calculateSingleMealScoreWithBreakdown(input).finalScore;
}

export interface MakanDailySummaryInput {
  minumGelasCount?: number | string; // <8 or >=8
  meals?: MakanSingleMealInput[];
  sarapan?: MakanSingleMealInput;
  siang?: MakanSingleMealInput;
  malam?: MakanSingleMealInput;
  isPuasa?: boolean;
  makananBetawi?: boolean;
  namaMakananBetawi?: string;
  bawaTumbler?: boolean;
  [key: string]: any;
}

export function calculateMakanBergiziScoreWithBreakdown(input: MakanDailySummaryInput): ScoreBreakdownResult {
  let minumScore = 0;
  const mVal = String(input.minumGelasCount ?? input.airGelas ?? input.waterGlasses ?? '').trim();
  if (mVal === '>=8' || mVal === '8+' || Number(mVal) >= 8) {
    minumScore = 45;
  } else if (mVal === '<8' || (mVal !== '' && Number(mVal) > 0)) {
    minumScore = 25;
  } else {
    minumScore = 0;
  }

  // Kumpulkan sesi makan
  const mealsList: MakanSingleMealInput[] = input.meals ? [...input.meals] : [];
  if (input.sarapan || input.pagi) mealsList.push(input.sarapan || input.pagi);
  if (input.siang) mealsList.push(input.siang);
  if (input.malam) mealsList.push(input.malam);
  if (input.sahur) mealsList.push(input.sahur);

  const expectedMeals = input.isPuasa ? 2 : 3;
  let totalMealScore = 0;

  if (mealsList.length > 0) {
    let rawMealSum = 0;
    mealsList.slice(0, expectedMeals).forEach((m) => {
      const ts = m.isRentangIdeal ?? (m.waktu === 'ideal' || m.waktuKategori === 'ideal') ? 10 : 5;
      let ps = 0;
      if (m.makananPokok || m.karbo || m.pokok) ps += 15;
      if (m.sayurMayur || m.sayur) ps += 15;
      if (m.laukPauk || m.lauk) ps += 7.5;
      if (m.buahBuahan || m.buah) ps += 7.5;
      const mealRaw = ts + ps; // maks 55 per sesi
      rawMealSum += mealRaw;
    });
    // Rata-rata dari sesi makan yang tersedia (include 0 untuk yang belum diisi)
    totalMealScore = Math.min(55, Math.round((rawMealSum / expectedMeals) * 10) / 10);
  } else {
    totalMealScore = 0; // belum ada sesi diisi
  }

  // Nilai dasar: Nilai rata-rata makan (maks 55) + Minum (0/25/45) = total maks 100
  const baseScore = Math.min(100, Math.round((totalMealScore + minumScore) * 10) / 10);

  let bonusPoints = 0;
  if (input.makananBetawi) bonusPoints += 5;
  if (input.bawaTumbler || input.useTumbler) bonusPoints += 10;

  return applyBonusCapAndOverflow(baseScore, bonusPoints);
}

export function calculateMakanDailyScore(input: MakanDailySummaryInput): number {
  return calculateMakanBergiziScoreWithBreakdown(input).finalScore;
}

// ============================================================================
// 5. GEMAR BELAJAR
// Page 1:
// 4 Kegiatan (pilih 1 = 45 poin, pilih >1 = 50 poin)
// Program 28: Menyimak siaran adiwiyata & budaya betawi = +10 poin bonus
// Page 2:
// Durasi tambahan: <=30 (15), 31-60 (25), 60-90 (35), 90-120 (45)
// Ringkasan minimal 40 char: 40 char = 5 poin, 80 char = 10 poin
// ============================================================================
export interface GemarBelajarInput {
  activities?: string[];
  durasiKategori?: '<=30' | '31-60' | '60-90' | '90-120' | string;
  duration?: string;
  program28?: boolean;
  ringkasanMateri?: string;
  deskripsi?: string;
  isMissed?: boolean;
  [key: string]: any;
}

export function calculateGemarBelajarScoreWithBreakdown(input: GemarBelajarInput, _isMissed?: boolean): ScoreBreakdownResult {
  const acts = input.activities || [];
  let actScore = 0;
  if (acts.length > 1) {
    actScore = 50;
  } else if (acts.length === 1) {
    actScore = 45;
  }

  let durScore = 15;
  const durKey = String(input.durasiKategori || input.duration || '').trim();
  if (durKey === '90-120' || durKey.includes('90')) {
    durScore = 45;
  } else if (durKey === '60-90' || durKey.includes('60')) {
    durScore = 35;
  } else if (durKey === '31-60' || durKey.includes('31')) {
    durScore = 25;
  } else {
    durScore = 15;
  }

  const descText = (input.ringkasanMateri || input.deskripsi || '').trim();
  let descScore = 0;
  if (descText.length >= 80) {
    descScore = 10;
  } else if (descText.length >= 40) {
    descScore = 5;
  }

  const baseScore = Math.min(100, actScore + durScore + descScore);
  const bonusPoints = input.program28 ? 10 : 0;

  const res = applyBonusCapAndOverflow(baseScore, bonusPoints);
  return {
    ...res,
    actScore,
    durScore,
    descScore,
  };
}

export function calculateGemarBelajarScore(input: GemarBelajarInput): number {
  return calculateGemarBelajarScoreWithBreakdown(input).finalScore;
}

// ============================================================================
// 6. BERMASYARAKAT
// Aksi sosial: 30 poin / kegiatan (maks 90 poin untuk 3 opsi)
// Deskripsi aksi dan kesan (page 2): min 40 char = 5 poin, 80++ char = 10 poin
// (Total baseScore aksi 90 + deskripsi 10 = pas 100 poin)
// Bonus: Nyambat (kerja bakti/gotong royong) = +10 poin bonus
// ============================================================================
export interface BermasyarakatInput {
  actions?: string[];
  deskripsi?: string;
  description?: string;
  nyambat?: boolean;
  isMissed?: boolean;
  [key: string]: any;
}

export function calculateBermasyarakatScoreWithBreakdown(input: BermasyarakatInput, _isMissed?: boolean): ScoreBreakdownResult {
  const actions = input.actions || [];
  const actCount = actions.length;
  const actScore = Math.min(90, actCount * 30);

  const desc = (input.deskripsi || input.description || '').trim();
  let descScore = 0;
  if (desc.length >= 80) {
    descScore = 10;
  } else if (desc.length >= 40) {
    descScore = 5;
  }

  const baseScore = Math.min(100, actScore + descScore);
  const bonus = input.nyambat ? 10 : 0;

  return applyBonusCapAndOverflow(baseScore, bonus);
}

export function calculateBermasyarakatScore(input: BermasyarakatInput): number {
  return calculateBermasyarakatScoreWithBreakdown(input).finalScore;
}

// ============================================================================
// 7. TIDUR CEPAT
// Akses dibuka jam 18.00 (6 sore) WIB
// Dropdown dihapus -> Opsi kartu klik-klik:
// Jam tidur: <21.30 (75), 21.30-22.30 (65), 22.31-23.30 (55), >23.31 (45)
// Kualitas: Rileks (25), Belum mengantuk (15), Hiperaktif (5)
// Adiwiyata hemat energi: +10 poin bonus
// ============================================================================
export interface TidurCepatInput {
  bedtimeSlot?: string;
  timeStr?: string;
  sleepQuality?: string | number;
  kualitasTidur?: string | number;
  turnOffLightsEco?: boolean;
  hematEnergi?: boolean;
  isMissed?: boolean;
  [key: string]: any;
}

export function classifyTidurTime(timeStr: string): { slot: string; score: number; label: string } {
  const min = timeToMinutes(timeStr);
  if (min >= 1080 && min < 1290) {
    return { slot: '<21.30', score: 75, label: '< 21.30 WIB' };
  }
  if (min >= 1290 && min <= 1350) {
    return { slot: '21.30-22.30', score: 65, label: '21.30 – 22.30 WIB' };
  }
  if (min > 1350 && min <= 1410) {
    return { slot: '22.31-23.30', score: 55, label: '22.31 – 23.30 WIB' };
  }
  return { slot: '>23.31', score: 45, label: '> 23.31 WIB' };
}

export function calculateTidurCepatScoreWithBreakdown(
  inputOrTime: TidurCepatInput | string,
  qualityLevel?: string | number,
  _isMissed?: boolean,
  hematEnergi?: boolean
): ScoreBreakdownResult {
  const input: TidurCepatInput = typeof inputOrTime === 'string'
    ? {
        [inputOrTime.includes(':') ? 'timeStr' : 'bedtimeSlot']: inputOrTime,
        sleepQuality: qualityLevel,
        hematEnergi,
      }
    : inputOrTime;

  let timeScore = 45;
  let timeLabel = '> 23.31 WIB';

  const bSlot = input.bedtimeSlot || '';
  if (bSlot === '<21.30' || bSlot.includes('<21.30') || bSlot.includes('<21:30')) {
    timeScore = 75;
    timeLabel = '< 21.30 WIB';
  } else if (bSlot === '21.30-22.30' || bSlot.includes('21.30-22.30') || bSlot.includes('21:30-22:30')) {
    timeScore = 65;
    timeLabel = '21.30 – 22.30 WIB';
  } else if (bSlot === '22.31-23.30' || bSlot.includes('22.31-23.30') || bSlot.includes('22:31-23:30')) {
    timeScore = 55;
    timeLabel = '22.31 – 23.30 WIB';
  } else if (bSlot === '>23.31' || bSlot === '>23.30' || bSlot.includes('>23')) {
    timeScore = 45;
    timeLabel = '> 23.31 WIB';
  } else if (input.timeStr) {
    const cls = classifyTidurTime(input.timeStr);
    timeScore = cls.score;
    timeLabel = cls.label;
  }

  // Kualitas: Rileks (25), Belum mengantuk (15), Hiperaktif (5)
  let qualityPoints = 15;
  const qVal = String(input.kualitasTidur || input.sleepQuality || '').toLowerCase();
  if (qVal.includes('rileks') || qVal === '25' || qVal === '5') {
    qualityPoints = 25;
  } else if (qVal.includes('hiperaktif') || qVal.includes('tegang') || qVal === '5' || qVal === '1') {
    qualityPoints = 5;
  } else if (qVal.includes('belum') || qVal === '15' || qVal === '3') {
    qualityPoints = 15;
  } else if (typeof input.sleepQuality === 'number') {
    if (input.sleepQuality >= 20) qualityPoints = 25;
    else if (input.sleepQuality >= 10) qualityPoints = 15;
    else qualityPoints = 5;
  }

  const baseScore = Math.min(100, timeScore + qualityPoints);
  const bonus = (input.hematEnergi || input.turnOffLightsEco) ? 10 : 0;

  const res = applyBonusCapAndOverflow(baseScore, bonus);
  return {
    ...res,
    timePoints: timeScore,
    conditionPoints: qualityPoints,
    timeLabel,
  };
}

export function calculateTidurCepatScore(
  inputOrTime: TidurCepatInput | string,
  qualityLevel?: string | number,
  isMissed?: boolean,
  hematEnergi?: boolean
): number {
  return calculateTidurCepatScoreWithBreakdown(inputOrTime, qualityLevel, isMissed, hematEnergi).finalScore;
}
