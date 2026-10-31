/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Formulir Kebiasaan Makan Bergizi — JAWARA 28
 * Pembaruan Sistem Desain & Aturan:
 * 1. Halaman 1: Berbasis Card untuk Sesi Makan (Sarapan, Siang, Malam / Sahur, Malam) + Card Asupan Air Minum.
 *    - Status Card: Selesai (hijau terkunci), Belum Selesai (dapat diisi), Terkunci belum waktunya (abu-abu).
 *    - Bagian bawah card: Section tersendiri untuk Poin Bonus Harian (Betawi +5 pt, Tumbler +10 pt).
 *      Bonus diisi 1x sehari, tetap tercentang/terkunci selesai setelah diisi, batas akhir pengisian saat makan malam.
 * 2. Halaman 2 untuk Sesi Makan:
 *    - Rentang waktu ideal sesi makan.
 *    - 2 Opsi Waktu Pelaksanaan: Ideal (10 pt) vs Luar Ideal (5 pt).
 *    - 4 Checkbox Isi Piringku 2x2 Grid (2 atas, 2 bawah) berdesain modern EduTech:
 *      - Baris Atas: Makanan Pokok (15 pt) & Sayur-Mayur (15 pt)
 *      - Baris Bawah: Lauk-Pauk (7,5 pt) & Buah-buahan (7,5 pt)
 * 3. Halaman 2 untuk Asupan Air Minum:
 *    - Pertanyaan interaktif EduTech: < 8 gelas (25 pt) vs >= 8 gelas (45 pt) dengan wawasan sains hidrasi.
 * 4. Sistem Penilaian:
 *    - Maks Nilai Makan: 55 poin (terbagi merata per sesi makan: ~18,333 pt per sesi untuk 3 sesi, total pas 55 tanpa over-bonus).
 *    - Maks Nilai Minum: 45 poin (akumulasi harian: >=8 gelas = 45 pt, <8 gelas = 25 pt).
 *    - Total Nilai Capaian: Makan (55) + Minum (45) = Pas 100 Poin.
 *    - Bonus Betawi (+5) & Tumbler (+10) masuk ke Poin Hebat (overflowBonus).
 * 5. Seluruh jawaban instrumen dicatat lengkap ke database SQLite.
 */

import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Check,
  Wheat,
  Drumstick,
  Carrot,
  Apple,
  Clock,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Calendar,
  Droplet,
  Coffee,
  Sun,
  Moon,
  BookOpen,
  Lock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Heart,
} from 'lucide-react';

interface MakanBergiziFormProps {
  onSuccess: (score: number, payload: any, isCounter?: boolean, subCategory?: string, overwrite?: boolean) => void;
  onCancel: () => void;
  todayLogs?: any[];
  isMissedEntry?: boolean;
  targetDate?: string;
  initialPuasaSunnah?: boolean;
}

export const MakanBergiziForm: React.FC<MakanBergiziFormProps> = ({
  onSuccess,
  onCancel,
  todayLogs = [],
  isMissedEntry = false,
  targetDate,
  initialPuasaSunnah = false,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const displayDate = targetDate || todayStr;
  const isPastDay = displayDate < todayStr || isMissedEntry;

  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<1 | 2>(1);
  const [activeItem, setActiveItem] = useState<'sarapan' | 'siang' | 'malam' | 'sahur' | 'air_minum' | 'bonus' | ''>('');

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Deteksi status puasa dari props atau log ibadah hari ini
  let detectedPuasa = initialPuasaSunnah;
  if (!detectedPuasa) {
    for (const log of todayLogs) {
      if (log.habit_code === 'ibadah') {
        try {
          const p = typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload;
          if (p?.puasaSunnah || p?.puasa || p?.isPuasa) {
            detectedPuasa = true;
            break;
          }
        } catch {}
      }
    }
  }

  // Deteksi sesi makan & air minum yang sudah tercatat sebelumnya hari ini
  const completedSessions: Record<string, any> = {};
  let alreadyClaimedBetawi = false;
  let savedNamaBetawi = '';
  let alreadyClaimedTumbler = false;
  let existingMinumGelas: string = '';

  todayLogs.forEach((l) => {
    const sub = (l.sub_category || '').toLowerCase();
    if (sub) {
      completedSessions[sub] = l;
    }
    try {
      const p = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
      if (p?.makananBetawi) {
        alreadyClaimedBetawi = true;
        if (p?.namaMakananBetawi) savedNamaBetawi = p.namaMakananBetawi;
      }
      if (p?.bawaTumbler || p?.tumblerEco) {
        alreadyClaimedTumbler = true;
      }
      if (p?.waterGlasses || p?.minumGelasCount) {
        existingMinumGelas = String(p.waterGlasses || p.minumGelasCount);
        completedSessions['air_minum'] = l;
      }
      if (p?.selectedMeal) {
        completedSessions[p.selectedMeal] = l;
      }
    } catch {}
  });

  // State Halaman 1 Bonus Harian
  const [makananBetawi, setMakananBetawi] = useState<boolean>(alreadyClaimedBetawi);
  const [namaMakananBetawi, setNamaMakananBetawi] = useState<string>(savedNamaBetawi);
  const [bawaTumbler, setBawaTumbler] = useState<boolean>(alreadyClaimedTumbler);

  // State Halaman 2: Sesi Makan
  const [waktuKategori, setWaktuKategori] = useState<'ideal' | 'diluar_ideal' | ''>('');
  const [piring, setPiring] = useState({
    pokok: false,
    sayur: false,
    lauk: false,
    buah: false,
  });

  // State Halaman 2: Air Minum
  const [waterGlasses, setWaterGlasses] = useState<'<8' | '>=8' | ''>(
    existingMinumGelas === '>=8' ? '>=8' : existingMinumGelas === '<8' ? '<8' : ''
  );

  const [showHonestyModal, setShowHonestyModal] = useState<boolean>(false);

  // Konfigurasi Sesi Makan
  const MEAL_SESSIONS = detectedPuasa
    ? [
        {
          key: 'sahur' as const,
          label: 'Makan Sahur',
          rangeStr: '03.00 – 04.30 WIB',
          openMin: 180, // 03.00
          icon: Moon,
          desc: 'Santap sahur bernutrisi sebelum waktu imsak tiba',
        },
        {
          key: 'malam' as const,
          label: 'Buka Puasa & Makan Malam',
          rangeStr: '18.00 – 19.30 WIB',
          openMin: 1080, // 18.00
          icon: Coffee,
          desc: 'Berbuka puasa dan santap malam gizi seimbang',
        },
      ]
    : [
        {
          key: 'sarapan' as const,
          label: 'Sarapan Pagi',
          rangeStr: '06.00 – 08.00 WIB',
          openMin: 360, // 06.00
          icon: Sun,
          desc: 'Energi utama untuk konsentrasi belajar pagi',
        },
        {
          key: 'siang' as const,
          label: 'Makan Siang',
          rangeStr: '11.30 – 13.00 WIB',
          openMin: 690, // 11.30
          icon: Utensils,
          desc: 'Pemulihan tenaga dan stamina di tengah aktivitas sekolah',
        },
        {
          key: 'malam' as const,
          label: 'Makan Malam',
          rangeStr: '18.00 – 19.30 WIB',
          openMin: 1080, // 18.00
          icon: Moon,
          desc: 'Makan malam seimbang sebelum tubuh beristirahat malam',
        },
      ];

  const expectedMealsCount = detectedPuasa ? 2 : 3;

  // Hitung Skor Sesi Makan Saat Ini (Page 2)
  const waktuScore = waktuKategori === 'ideal' ? 10 : waktuKategori === 'diluar_ideal' ? 5 : 0;
  let piringScore = 0;
  if (piring.pokok) piringScore += 15;
  if (piring.sayur) piringScore += 15;
  if (piring.lauk) piringScore += 7.5;
  if (piring.buah) piringScore += 7.5;

  const currentMealRaw = waktuScore + piringScore; // maks 55 raw
  const currentMealPoints = currentMealRaw;

  // Skor Minum
  const currentMinumPoints = waterGlasses === '>=8' ? 45 : waterGlasses === '<8' ? 25 : 0;

  // 1. Hitung Nilai Rata-rata Sesi Makan (include 0 untuk yang belum diisi):
  // Jumlah nilai sesi makan / jumlah sesi makan tersedia (2 jika puasa, 3 jika tidak)
  const mealRawMap: Record<string, number> = {};
  let totalMealsRawSum = 0;

  MEAL_SESSIONS.forEach((m) => {
    if (completedSessions[m.key]) {
      const l = completedSessions[m.key];
      let raw = 0;
      try {
        const p = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
        if (p?.mealRaw !== undefined) raw = Number(p.mealRaw);
        else if (p?.waktuScore !== undefined && p?.piringScore !== undefined) raw = Number(p.waktuScore) + Number(p.piringScore);
        else raw = Math.min(55, Number(l.score || 0));
      } catch {
        raw = Math.min(55, Number(l.score || 0));
      }
      mealRawMap[m.key] = raw;
      totalMealsRawSum += raw;
    } else if (activeItem === m.key) {
      mealRawMap[m.key] = currentMealRaw;
      totalMealsRawSum += currentMealRaw;
    } else {
      mealRawMap[m.key] = 0;
    }
  });

  const avgMealsScore = Math.round((totalMealsRawSum / expectedMealsCount) * 10) / 10;
  const activeMinumScore = waterGlasses === '>=8' ? 45 : waterGlasses === '<8' ? 25 : (existingMinumGelas === '>=8' ? 45 : existingMinumGelas === '<8' ? 25 : 0);

  let bonusPoints = 0;
  if (makananBetawi) bonusPoints += 5;
  if (bawaTumbler) bonusPoints += 10;

  const totalCalculated = Math.round((avgMealsScore + activeMinumScore + bonusPoints) * 10) / 10;
  const currentScore = Math.min(100, Math.round(totalCalculated));
  const overflowBonus = Math.max(0, Math.round((totalCalculated - 100) * 10) / 10);

  const activeMealConfig = MEAL_SESSIONS.find((m) => m.key === activeItem);

  const handleOpenItem = (itemKey: 'sarapan' | 'siang' | 'malam' | 'sahur' | 'air_minum' | 'bonus') => {
    setActiveItem(itemKey);
    // Reset page 2 inputs for new meal
    if (itemKey !== 'air_minum' && itemKey !== 'bonus') {
      setWaktuKategori('');
      setPiring({ pokok: false, sayur: false, lauk: false, buah: false });
    }
    setCurrentPage(2);
  };

  const handleConfirmHonesty = () => {
    setShowHonestyModal(false);

    if (activeItem === 'bonus') {
      const bonusScoreTotal = (makananBetawi ? 5 : 0) + (bawaTumbler ? 10 : 0);
      const bonusAnswers = [
        {
          question_code: 'makan_bonus_betawi',
          question_text: 'Makan Makanan Khas Betawi (+5 Poin Bonus)',
          answer_value: makananBetawi ? (namaMakananBetawi.trim() || 'Ya') : 'tidak',
          answer_text: makananBetawi ? `Ya - ${namaMakananBetawi.trim() || 'Kuliner Betawi'} (+5 Poin)` : 'Tidak',
          points: makananBetawi ? 5 : 0,
        },
        {
          question_code: 'makan_bonus_tumbler',
          question_text: 'Membawa Tumbler / Tempat Minum Sendiri (+10 Poin Bonus)',
          answer_value: bawaTumbler ? 'ya' : 'tidak',
          answer_text: bawaTumbler ? 'Ya - Membawa Tumbler (+10 Poin)' : 'Tidak',
          points: bawaTumbler ? 10 : 0,
        },
      ];

      onSuccess(
        bonusScoreTotal,
        {
          entryMode: isPastDay ? 'formulir_terlewat' : 'tepat_hari_fleksibel',
          session: 'bonus',
          selectedMeal: 'bonus',
          makananBetawi,
          namaMakananBetawi: namaMakananBetawi.trim(),
          bawaTumbler,
          isPuasa: detectedPuasa,
          score: bonusScoreTotal,
          baseScore: 0,
          bonusPoints: bonusScoreTotal,
          overflowBonus: 0,
          isMissed: isPastDay,
          journalDate: displayDate,
          timestamp: new Date().toLocaleTimeString('id-ID'),
          answers: bonusAnswers,
        },
        true,
        'bonus',
        true
      );
      return;
    }

    if (activeItem === 'air_minum') {
      const answers = [
        {
          question_code: 'makan_air_minum',
          question_text: 'Asupan Air Putih Hari Ini (≥8 Gelas = 45 Poin, <8 Gelas = 25 Poin)',
          answer_value: waterGlasses,
          answer_text: waterGlasses === '>=8' ? '≥ 8 Gelas Air Putih (45 Poin - Rekomendasi Ideal)' : '< 8 Gelas Air Putih (25 Poin)',
          points: currentMinumPoints,
        },
        {
          question_code: 'makan_bonus_betawi',
          question_text: 'Makan Makanan Khas Betawi (+5 Poin Bonus)',
          answer_value: makananBetawi ? (namaMakananBetawi.trim() || 'Ya') : 'tidak',
          answer_text: makananBetawi ? `Ya - ${namaMakananBetawi.trim() || 'Kuliner Betawi'} (+5 Poin)` : 'Tidak',
          points: makananBetawi && !alreadyClaimedBetawi ? 5 : 0,
        },
        {
          question_code: 'makan_bonus_tumbler',
          question_text: 'Membawa Tumbler / Tempat Minum Sendiri (+10 Poin Bonus)',
          answer_value: bawaTumbler ? 'ya' : 'tidak',
          answer_text: bawaTumbler ? 'Ya - Membawa Tumbler (+10 Poin)' : 'Tidak',
          points: bawaTumbler && !alreadyClaimedTumbler ? 10 : 0,
        },
      ];

      onSuccess(
        currentMinumPoints,
        {
          entryMode: isPastDay ? 'formulir_terlewat' : 'tepat_hari_fleksibel',
          session: 'air_minum',
          waterGlasses,
          minumGelasCount: waterGlasses,
          minumScore: currentMinumPoints,
          makananBetawi,
          namaMakananBetawi: namaMakananBetawi.trim(),
          bawaTumbler,
          isPuasa: detectedPuasa,
          score: currentMinumPoints,
          baseScore: currentMinumPoints,
          bonusPoints: (makananBetawi ? 5 : 0) + (bawaTumbler ? 10 : 0),
          overflowBonus: Math.max(0, currentMinumPoints + (makananBetawi ? 5 : 0) + (bawaTumbler ? 10 : 0) - 100),
          isMissed: isPastDay,
          journalDate: displayDate,
          timestamp: new Date().toLocaleTimeString('id-ID'),
          answers,
        },
        true,
        'air_minum',
        true
      );
      return;
    }

    // Meal session submission
    const mealAnswers = [
      {
        question_code: `makan_sesi_${activeItem}`,
        question_text: `Sesi Makan: ${activeMealConfig?.label || activeItem}`,
        answer_value: activeItem,
        answer_text: `${activeMealConfig?.label || activeItem} (${activeMealConfig?.rangeStr})`,
        points: currentMealPoints,
      },
      {
        question_code: `makan_waktu_${activeItem}`,
        question_text: 'Waktu Pelaksanaan Sesi Makan (Ideal 10 Poin / Luar Ideal 5 Poin)',
        answer_value: waktuKategori,
        answer_text: waktuKategori === 'ideal' ? 'Makan di Rentang Waktu Ideal (+10 Poin)' : 'Di Luar Rentang Ideal (+5 Poin)',
        points: waktuScore,
      },
      {
        question_code: `makan_piring_pokok_${activeItem}`,
        question_text: 'Isi Piringku: Makanan Pokok (Karbohidrat - 15 Poin)',
        answer_value: piring.pokok ? 'ada' : 'tidak',
        answer_text: piring.pokok ? 'Ada (15 Poin)' : 'Tidak ada (0 Poin)',
        points: piring.pokok ? 15 : 0,
      },
      {
        question_code: `makan_piring_sayur_${activeItem}`,
        question_text: 'Isi Piringku: Sayur-Mayur (15 Poin)',
        answer_value: piring.sayur ? 'ada' : 'tidak',
        answer_text: piring.sayur ? 'Ada (15 Poin)' : 'Tidak ada (0 Poin)',
        points: piring.sayur ? 15 : 0,
      },
      {
        question_code: `makan_piring_lauk_${activeItem}`,
        question_text: 'Isi Piringku: Lauk-Pauk (Protein - 7,5 Poin)',
        answer_value: piring.lauk ? 'ada' : 'tidak',
        answer_text: piring.lauk ? 'Ada (7,5 Poin)' : 'Tidak ada (0 Poin)',
        points: piring.lauk ? 7.5 : 0,
      },
      {
        question_code: `makan_piring_buah_${activeItem}`,
        question_text: 'Isi Piringku: Buah-buahan (7,5 Poin)',
        answer_value: piring.buah ? 'ada' : 'tidak',
        answer_text: piring.buah ? 'Ada (7,5 Poin)' : 'Tidak ada (0 Poin)',
        points: piring.buah ? 7.5 : 0,
      },
      {
        question_code: 'makan_bonus_betawi',
        question_text: 'Makan Makanan Khas Betawi (+5 Poin Bonus)',
        answer_value: makananBetawi ? (namaMakananBetawi.trim() || 'Ya') : 'tidak',
        answer_text: makananBetawi ? `Ya - ${namaMakananBetawi.trim() || 'Kuliner Betawi'} (+5 Poin)` : 'Tidak',
        points: makananBetawi && !alreadyClaimedBetawi ? 5 : 0,
      },
      {
        question_code: 'makan_bonus_tumbler',
        question_text: 'Membawa Tumbler / Tempat Minum Sendiri (+10 Poin Bonus)',
        answer_value: bawaTumbler ? 'ya' : 'tidak',
        answer_text: bawaTumbler ? 'Ya - Membawa Tumbler (+10 Poin)' : 'Tidak',
        points: bawaTumbler && !alreadyClaimedTumbler ? 10 : 0,
      },
    ];

    onSuccess(
      currentMealPoints,
      {
        entryMode: isPastDay ? 'formulir_terlewat' : 'tepat_hari_fleksibel',
        session: activeItem,
        selectedMeal: activeItem,
        waktuKategori,
        waktuScore,
        piring,
        piringScore,
        mealRaw: currentMealRaw,
        makananBetawi,
        namaMakananBetawi: namaMakananBetawi.trim(),
        bawaTumbler,
        isPuasa: detectedPuasa,
        score: currentMealPoints,
        baseScore: currentMealPoints,
        bonusPoints: (makananBetawi && !alreadyClaimedBetawi ? 5 : 0) + (bawaTumbler && !alreadyClaimedTumbler ? 10 : 0),
        overflowBonus: 0,
        isMissed: isPastDay,
        journalDate: displayDate,
        timestamp: new Date().toLocaleTimeString('id-ID'),
        answers: mealAnswers,
      },
      true,
      activeItem,
      true
    );
  };

  return (
    <div className="modal-backdrop-blur fixed inset-0 w-screen h-screen z-50 bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg max-h-[92vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#19ae5d] text-white flex items-center justify-center shadow-xs">
              <Utensils className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#19ae5d]">
                  Makan Bergizi • Halaman {currentPage} dari 2
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#19ae5d]" /> Tanggal: {displayDate}
                </span>
                {isPastDay && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Formulir Terlewat
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight mt-0.5">
                {currentPage === 1
                  ? 'Pilih Sesi Makan, Minum & Bonus Harian'
                  : activeItem === 'air_minum'
                  ? 'Asupan Air Putih & Hidrasi Sehat'
                  : activeItem === 'bonus'
                  ? 'Poin Bonus Harian Makan Bergizi'
                  : `Komposisi Gizi — ${activeMealConfig?.label || 'Sesi Makan'}`}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex-shrink-0 px-6 pt-3 flex items-center justify-between gap-3">
          <div className="flex gap-1.5 flex-1">
            {[1, 2].map((step) => (
              <div
                key={step}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  step === currentPage ? 'bg-[#19ae5d]' : step < currentPage ? 'bg-emerald-700' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-black text-[#19ae5d] bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
            Nilai Capaian: {currentScore} / 100
            {overflowBonus > 0 && <span className="text-amber-700 font-bold ml-1">(+{overflowBonus} Poin Hebat)</span>}
          </span>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {/* Status Puasa (Sinkron dengan Ibadah) */}
          {detectedPuasa && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2.5 shadow-xs">
              <span className="text-xl">🌙</span>
              <div>
                <span className="text-xs font-black text-amber-900 block">
                  Sedang Berpuasa Sunnah (Sinkron Ibadah)
                </span>
                <span className="text-[11px] text-amber-700">
                  Sesi makan disesuaikan khusus untuk Santap Sahur dan Berbuka Puasa.
                </span>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* HALAMAN 1: CARD-BASED SESI MAKAN + CARD AIR MINUM + BONUS SECTION */}
          {/* ================================================================ */}
          {currentPage === 1 && (
            <div className="space-y-4">
              {/* Petunjuk Interaktif EduTech */}
              <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-white rounded-2xl border border-emerald-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#19ae5d]" />
                    Struktur Sesi Makan &amp; Hidrasi Harian
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-white border border-emerald-200 px-2 py-0.5 rounded-full">
                    Maks 100 Poin
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Maksimal makan <strong>55 poin</strong> ({expectedMealsCount} sesi) + air minum <strong>45 poin</strong>. Pilih card sesi untuk mengisi detail gizi.
                </p>
              </div>

              {/* CARD SESI MAKAN */}
              <div className="space-y-2.5">
                <label className="text-xs font-extrabold text-slate-800 block">
                  1. Sesi Santap Makanan Bergizi (Nilai Seluruh Sesi = {totalMealsRawSum} pt):
                </label>

                <div className="grid grid-cols-1 gap-2.5">
                  {MEAL_SESSIONS.map((m) => {
                    const isCompleted = Boolean(completedSessions[m.key]);
                    const isUnlocked = isPastDay || currentTimeMinutes >= m.openMin;
                    const IconComp = m.icon;

                    return (
                      <div
                        key={m.key}
                        className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isCompleted
                            ? 'bg-emerald-50/90 border-emerald-500 shadow-xs'
                            : !isUnlocked
                            ? 'bg-slate-100/70 border-slate-200 opacity-65 cursor-not-allowed'
                            : 'bg-white border-slate-200 hover:border-emerald-400 hover:shadow-xs'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isCompleted
                                ? 'bg-[#19ae5d] text-white shadow-xs'
                                : !isUnlocked
                                ? 'bg-slate-200 text-slate-500'
                                : 'bg-emerald-50 border border-emerald-200 text-[#19ae5d]'
                            }`}
                          >
                            {isCompleted ? (
                              <Check className="w-5 h-5 stroke-[3]" />
                            ) : !isUnlocked ? (
                              <Lock className="w-4 h-4" />
                            ) : (
                              <IconComp className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-slate-900 block leading-tight">
                                {m.label}
                              </span>
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                  isCompleted
                                    ? 'bg-emerald-200/80 text-emerald-900 border border-emerald-300'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {m.rangeStr}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 block mt-0.5">
                              {isCompleted ? (
                                <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                                  ✓ Selesai Terisi ({mealRawMap[m.key] ?? 55} pt)
                                </span>
                              ) : !isUnlocked ? (
                                <span className="text-slate-500 flex items-center gap-1">
                                  <Lock className="w-3 h-3 text-slate-400" /> Terkunci (Dibuka pukul {m.rangeStr.split('–')[0]} WIB)
                                </span>
                              ) : (
                                m.desc
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end">
                          {isCompleted ? (
                            <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 text-white flex items-center gap-1.5 shadow-xs cursor-default">
                              <Check className="w-3.5 h-3.5 stroke-[3]" /> Selesai (Terkunci)
                            </span>
                          ) : !isUnlocked ? (
                            <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-200 text-slate-500 flex items-center gap-1.5 cursor-not-allowed">
                              <Lock className="w-3.5 h-3.5" /> Belum Waktunya
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenItem(m.key)}
                              className="px-4 py-1.5 rounded-xl text-xs font-extrabold bg-[#19ae5d] hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                            >
                              Isi Sesi Ini <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CARD ASUPAN AIR MINUM */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-800 block">
                  2. Asupan Air Putih Hari Ini (Akumulasi Harian):
                </label>

                {(() => {
                  const isWaterCompleted = Boolean(completedSessions['air_minum'] || existingMinumGelas);
                  const waterVal = existingMinumGelas || waterGlasses;

                  return (
                    <div
                      className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isWaterCompleted
                          ? 'bg-blue-50/90 border-blue-400 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isWaterCompleted
                              ? 'bg-[#1c5ddc] text-white shadow-xs'
                              : 'bg-blue-50 border border-blue-200 text-[#1c5ddc]'
                          }`}
                        >
                          {isWaterCompleted ? <Check className="w-5 h-5 stroke-[3]" /> : <Droplet className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-900 block leading-tight">
                              Asupan Air Putih (Hidrasi)
                            </span>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                isWaterCompleted
                                  ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              Maks 45 Poin
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            {isWaterCompleted ? (
                              <span className="text-blue-800 font-extrabold flex items-center gap-1">
                                ✓ Selesai Tercatat: {waterVal === '>=8' ? '≥ 8 Gelas (45 Poin Ideal)' : '< 8 Gelas (25 Poin)'}
                              </span>
                            ) : (
                              'Memenuhi hidrasi tubuh harian (target minimal 8 gelas / 2 Liter per hari)'
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        {isWaterCompleted ? (
                          <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-[#1c5ddc] text-white flex items-center gap-1.5 shadow-xs cursor-default">
                            <Check className="w-3.5 h-3.5 stroke-[3]" /> Selesai (Terkunci)
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenItem('air_minum')}
                            className="px-4 py-1.5 rounded-xl text-xs font-extrabold bg-[#1c5ddc] hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                          >
                            Isi Air Minum <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* CARD 3: BONUS HARIAN MAKAN BERGIZI (STANDALONE CARD) */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-800 block">
                  3. Poin Bonus Harian (Sekali Pengisian Sehari):
                </label>

                {(() => {
                  const isBonusCompleted = Boolean(completedSessions['bonus'] || alreadyClaimedBetawi || alreadyClaimedTumbler);
                  const isAllMandatoryDone = MEAL_SESSIONS.every((m) => Boolean(completedSessions[m.key])) && Boolean(completedSessions['air_minum'] || existingMinumGelas);

                  return (
                    <div
                      className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isBonusCompleted
                          ? 'bg-amber-50/90 border-amber-400 shadow-xs'
                          : isAllMandatoryDone
                          ? 'bg-slate-100/70 border-slate-200 opacity-70'
                          : 'bg-white border-slate-200 hover:border-amber-400 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isBonusCompleted
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'bg-amber-50 border border-amber-200 text-amber-600'
                          }`}
                        >
                          {isBonusCompleted ? <Check className="w-5 h-5 stroke-[3]" /> : <Sparkles className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-900 block leading-tight">
                              Bonus Kuliner Betawi &amp; Tumbler Adiwiyata
                            </span>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                isBonusCompleted
                                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              Hingga +15 Poin
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            {isBonusCompleted ? (
                              <span className="text-amber-800 font-extrabold flex items-center gap-1">
                                ✓ Selesai Diklaim (+{bonusPoints || 15} Poin Bonus)
                              </span>
                            ) : isAllMandatoryDone ? (
                              <span className="text-slate-500">
                                Sesi wajib selesai. Bonus harian bersifat opsional dan otomatis terkunci.
                              </span>
                            ) : (
                              'Makan kuliner Betawi (+5 pt) & Membawa tumbler tempat minum (+10 pt)'
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        {isBonusCompleted ? (
                          <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-amber-600 text-white flex items-center gap-1.5 shadow-xs cursor-default">
                            <Check className="w-3.5 h-3.5 stroke-[3]" /> Selesai (Terkunci)
                          </span>
                        ) : isAllMandatoryDone ? (
                          <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-200 text-slate-500 flex items-center gap-1.5 cursor-not-allowed">
                            <Lock className="w-3.5 h-3.5" /> Terkunci (Sesi Selesai)
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenItem('bonus')}
                            className="px-4 py-1.5 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                          >
                            Isi Bonus <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Total Daily Score Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-900 text-white shadow-md flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-200 block">
                    TOTAL CAPAIAN MAKAN BERGIZI HARI INI
                  </span>
                  <span className="text-2xl font-black">{currentScore} / 100</span>
                  <span className="text-[11px] text-emerald-100 block mt-0.5">
                    ({totalMealsRawSum} / {expectedMealsCount} = {avgMealsScore.toFixed(1)} pt) + Minum ({activeMinumScore} / 45 pt)
                    {bonusPoints > 0 ? ` + Bonus (+${bonusPoints})` : ''}
                  </span>
                  {overflowBonus > 0 && (
                    <span className="text-[10px] bg-amber-400 text-slate-900 font-black px-2 py-0.5 rounded-full inline-block mt-1">
                      +{overflowBonus} Poin Bonus masuk ke Poin Hebat
                    </span>
                  )}
                </div>
                <Sparkles className="w-8 h-8 text-amber-300" />
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* HALAMAN 2: DETAIL BONUS MAKAN BERGIZI (BETAWI & ADIWIYATA TUMBLER) */}
          {/* ================================================================ */}
          {currentPage === 2 && activeItem === 'bonus' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-black text-amber-800 tracking-wider block">
                    Bonus Harian Murid:
                  </span>
                  <span className="text-sm font-black text-slate-900 block mt-0.5">
                    Kuliner Khas Betawi &amp; Adiwiyata Tumbler
                  </span>
                  <span className="text-xs font-bold text-amber-700">
                    Klaim 1 kali per hari • Total bonus hingga +15 Poin Hebat
                  </span>
                </div>
                <Sparkles className="w-7 h-7 text-amber-500" />
              </div>

              {/* 1. Bonus Makanan Khas Betawi */}
              <div
                className={`p-4 rounded-2xl border-2 transition-all ${
                  makananBetawi
                    ? 'bg-orange-50/90 border-orange-400 shadow-xs'
                    : 'bg-white border-slate-200'
                }`}
              >
                <label
                  onClick={() => {
                    if (alreadyClaimedBetawi) return;
                    setMakananBetawi(!makananBetawi);
                  }}
                  className={`flex items-start justify-between gap-2.5 cursor-pointer ${
                    alreadyClaimedBetawi ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border-2 shrink-0 mt-0.5 ${
                        makananBetawi ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {makananBetawi && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div>
                      <span className="text-sm font-black text-slate-900 block">
                        Makan Makanan Khas Betawi (+5 Poin Bonus)
                      </span>
                      <span className="text-xs text-slate-500 mt-0.5 block leading-relaxed">
                        {alreadyClaimedBetawi
                          ? 'Bonus ini telah selesai diklaim hari ini (Terkunci Selesai).'
                          : 'Melestarikan warisan kuliner Jakarta. Contoh: Gabus pucung, soto Betawi, kerak telor, semur jengkol, asinan Betawi.'}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-black text-orange-600 bg-orange-100 border border-orange-200 px-2.5 py-1 rounded-lg shrink-0">
                    +5 Poin
                  </span>
                </label>

                {makananBetawi && !alreadyClaimedBetawi && (
                  <div className="mt-3 pt-3 border-t border-orange-200">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Tuliskan Nama Masakan Betawi yang Kamu Konsumsi:
                    </label>
                    <input
                      type="text"
                      value={namaMakananBetawi}
                      onChange={(e) => setNamaMakananBetawi(e.target.value)}
                      placeholder="Contoh: Soto Betawi santan gurih / Sayur asem Betawi"
                      className="w-full p-2.5 bg-white border border-orange-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                )}
              </div>

              {/* 2. Bonus Adiwiyata Tumbler */}
              <label
                onClick={() => {
                  if (alreadyClaimedTumbler) return;
                  setBawaTumbler(!bawaTumbler);
                }}
                className={`flex items-start justify-between gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  bawaTumbler
                    ? 'bg-emerald-50/90 border-emerald-500 shadow-xs'
                    : 'bg-white border-slate-200'
                } ${alreadyClaimedTumbler ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border-2 shrink-0 mt-0.5 ${
                      bawaTumbler ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {bawaTumbler && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <div>
                    <span className="text-sm font-black text-slate-900 block">
                      Membawa Tumbler / Tempat Minum Sendiri (+10 Poin Bonus)
                    </span>
                    <span className="text-xs text-slate-500 mt-0.5 block leading-relaxed">
                      {alreadyClaimedTumbler
                        ? 'Bonus ini telah selesai diklaim hari ini (Terkunci Selesai).'
                        : 'Aksi nyata Sekolah Adiwiyata Mandiri mengurangi timbulan sampah plastik sekali pakai.'}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0">
                  +10 Poin
                </span>
              </label>

              {/* Bonus Score Summary Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-100 block">
                    Total Poin Bonus Diklaim:
                  </span>
                  <span className="text-2xl font-black">+{(makananBetawi ? 5 : 0) + (bawaTumbler ? 10 : 0)} Poin Hebat</span>
                  <span className="text-[11px] text-amber-50 block mt-0.5">
                    {makananBetawi && bawaTumbler ? 'Kedua bonus aktif (Maksimal +15)' : makananBetawi ? 'Bonus Betawi aktif (+5)' : bawaTumbler ? 'Bonus Tumbler aktif (+10)' : 'Pilih opsi bonus di atas jika ada'}
                  </span>
                </div>
                <Sparkles className="w-8 h-8 text-amber-200" />
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* HALAMAN 2: DETAIL SESI MAKAN (RENTANG WAKTU + 2x2 GRID ISI PIRINGKU) */}
          {/* ================================================================ */}
          {currentPage === 2 && activeItem !== 'air_minum' && activeItem !== 'bonus' && (
            <div className="space-y-4">
              {/* Header Sesi Terpilih */}
              {activeMealConfig && (
                <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-black text-emerald-800 tracking-wider block">
                      Sesi yang Diisi:
                    </span>
                    <span className="text-sm font-black text-slate-900 block mt-0.5">
                      {activeMealConfig.label}
                    </span>
                    <span className="text-xs font-bold text-emerald-700">
                      Rentang Ideal: {activeMealConfig.rangeStr}
                    </span>
                  </div>
                  <span className="text-xs font-black text-emerald-800 bg-white border border-emerald-200 px-2.5 py-1 rounded-xl">
                    Capaian Sesi: {currentMealPoints} / {Math.round(55 / expectedMealsCount * 10) / 10} Poin
                  </span>
                </div>
              )}

              {/* 2 Opsi Waktu Pelaksanaan */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Waktu Pelaksanaan Sesi Makan:
                  </label>
                  <span className="text-xs font-black text-[#19ae5d]">
                    {waktuScore} / 10 Poin
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWaktuKategori('ideal')}
                    className={`p-3 rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                      waktuKategori === 'ideal'
                        ? 'bg-emerald-50/80 border-[#19ae5d] ring-1 ring-[#19ae5d] shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Makan di Rentang Ideal</span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Sesuai jam makan ideal tubuh murid</span>
                    </div>
                    <span className="text-[11px] font-black text-[#19ae5d] mt-2 block">+10 Poin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWaktuKategori('diluar_ideal')}
                    className={`p-3 rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                      waktuKategori === 'diluar_ideal'
                        ? 'bg-amber-50/80 border-amber-400 ring-1 ring-amber-400 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Di Luar Rentang Ideal</span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">Mendahului atau terlambat dari jadwal</span>
                    </div>
                    <span className="text-[11px] font-black text-amber-700 mt-2 block">+5 Poin</span>
                  </button>
                </div>
              </div>

              {/* 4 Checkbox Isi Piringku: Modern EduTech 2x2 Grid (2 Atas, 2 Bawah) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-800">
                      Komposisi Gizi "Isi Piringku":
                    </label>
                    <span className="text-[10px] text-slate-500">
                      Standar Kemenkes RI: 2/3 Karbo, 2/3 Sayur, 1/3 Lauk, 1/3 Buah
                    </span>
                  </div>
                  <span className="text-xs font-black text-[#19ae5d] bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                    {piringScore} / 45 Poin
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {/* Row 1, Col 1: Makanan Pokok */}
                  <label
                    onClick={() => setPiring((prev) => ({ ...prev, pokok: !prev.pokok }))}
                    className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      piring.pokok
                        ? 'bg-amber-50/80 border-amber-500 shadow-xs ring-1 ring-amber-400'
                        : 'bg-white border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                          <Wheat className="w-4 h-4" />
                        </div>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border-2 shrink-0 ${
                            piring.pokok ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {piring.pokok && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-slate-900 block leading-tight">
                        Makanan Pokok
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-1 leading-snug">
                        Nasi, ubi, singkong, jagung, kentang
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-amber-800 bg-amber-100/70 border border-amber-200 px-2 py-0.5 rounded-md mt-2 inline-block self-start">
                      +15 Poin
                    </span>
                  </label>

                  {/* Row 1, Col 2: Sayur-Mayur */}
                  <label
                    onClick={() => setPiring((prev) => ({ ...prev, sayur: !prev.sayur }))}
                    className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      piring.sayur
                        ? 'bg-emerald-50/80 border-emerald-500 shadow-xs ring-1 ring-emerald-400'
                        : 'bg-white border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                          <Carrot className="w-4 h-4" />
                        </div>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border-2 shrink-0 ${
                            piring.sayur ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {piring.sayur && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-slate-900 block leading-tight">
                        Sayur-Mayur
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-1 leading-snug">
                        Bayam, buncis, brokoli, wortel, kangkung
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-2 py-0.5 rounded-md mt-2 inline-block self-start">
                      +15 Poin
                    </span>
                  </label>

                  {/* Row 2, Col 1: Lauk-Pauk */}
                  <label
                    onClick={() => setPiring((prev) => ({ ...prev, lauk: !prev.lauk }))}
                    className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      piring.lauk
                        ? 'bg-red-50/80 border-red-500 shadow-xs ring-1 ring-red-400'
                        : 'bg-white border-slate-200 hover:border-red-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
                          <Drumstick className="w-4 h-4" />
                        </div>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border-2 shrink-0 ${
                            piring.lauk ? 'bg-red-600 border-red-600 text-white' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {piring.lauk && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-slate-900 block leading-tight">
                        Lauk-Pauk
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-1 leading-snug">
                        Ikan, ayam, telur, tempe, tahu, daging
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-red-800 bg-red-100/70 border border-red-200 px-2 py-0.5 rounded-md mt-2 inline-block self-start">
                      +7,5 Poin
                    </span>
                  </label>

                  {/* Row 2, Col 2: Buah-buahan */}
                  <label
                    onClick={() => setPiring((prev) => ({ ...prev, buah: !prev.buah }))}
                    className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      piring.buah
                        ? 'bg-rose-50/80 border-rose-500 shadow-xs ring-1 ring-rose-400'
                        : 'bg-white border-slate-200 hover:border-rose-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
                          <Apple className="w-4 h-4" />
                        </div>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border-2 shrink-0 ${
                            piring.buah ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {piring.buah && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-slate-900 block leading-tight">
                        Buah-buahan
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-1 leading-snug">
                        Pisang, pepaya, apel, jeruk, semangka
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-rose-800 bg-rose-100/70 border border-rose-200 px-2 py-0.5 rounded-md mt-2 inline-block self-start">
                      +7,5 Poin
                    </span>
                  </label>
                </div>
              </div>

              {/* Sesi Score Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-200 block">
                    Poin Sesi Ini:
                  </span>
                  <span className="text-2xl font-black">{currentMealPoints} Poin</span>
                  <span className="text-[11px] text-emerald-100 block mt-0.5">
                    Waktu ({waktuScore}) + Isi Piringku ({piringScore}) = Raw {currentMealRaw}/55
                  </span>
                </div>
                <Sparkles className="w-8 h-8 text-amber-300" />
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* HALAMAN 2: DETAIL ASUPAN AIR PUTIH (EDUTECH INTERACTIVE WIDGET) */}
          {/* ================================================================ */}
          {currentPage === 2 && activeItem === 'air_minum' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-black text-blue-800 tracking-wider block">
                    Komponen Hidrasi:
                  </span>
                  <span className="text-sm font-black text-slate-900 block mt-0.5">
                    Asupan Air Putih Sehat
                  </span>
                  <span className="text-xs font-bold text-blue-700">
                    Target Sehat: Minimal 8 Gelas / 2 Liter Per Hari
                  </span>
                </div>
                <Droplet className="w-7 h-7 text-[#1c5ddc]" />
              </div>

              {/* EduTech Interactive Hydration Options */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  Berapa Asupan Air Putih yang Kamu Minum Hari Ini?
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: < 8 Gelas */}
                  <button
                    type="button"
                    onClick={() => setWaterGlasses('<8')}
                    className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                      waterGlasses === '<8'
                        ? 'bg-blue-50 border-[#1c5ddc] ring-2 ring-[#1c5ddc] shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-black text-slate-900">&lt; 8 Gelas</span>
                        <span className="text-xs font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          +25 Poin
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-600 block mt-1 leading-relaxed">
                        Kurang dari 2 Liter per hari. Hidrasi tubuh belum optimal untuk aktivitas padat.
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-1">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="w-5 h-6 rounded bg-blue-300 border border-blue-400" />
                      ))}
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="w-5 h-6 rounded bg-slate-100 border border-slate-200" />
                      ))}
                    </div>
                  </button>

                  {/* Option 2: >= 8 Gelas */}
                  <button
                    type="button"
                    onClick={() => setWaterGlasses('>=8')}
                    className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                      waterGlasses === '>=8'
                        ? 'bg-blue-50 border-[#1c5ddc] ring-2 ring-[#1c5ddc] shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-black text-slate-900">≥ 8 Gelas (Ideal)</span>
                        <span className="text-xs font-black text-[#1c5ddc] bg-blue-100 px-2 py-0.5 rounded-md">
                          +45 Poin
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-600 block mt-1 leading-relaxed">
                        Mencapai atau melampaui 2 Liter per hari. Menjaga fokus otak dan stamina belajar.
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-1">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="w-5 h-6 rounded bg-[#1c5ddc] border border-blue-600" />
                      ))}
                    </div>
                  </button>
                </div>
              </div>

              {/* EduTech Science Box */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl text-[11px] text-blue-950 space-y-1">
                <div className="font-extrabold flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#1c5ddc]" />
                  <span>Sains Hidrasi Murid SMA (Kemenkes RI)</span>
                </div>
                <p className="leading-relaxed">
                  Otak manusia terdiri dari 75% air. Dehidrasi ringan sebesar 1-2% dapat menurunkan daya ingat jangka pendek, memperlambat kecepatan memproses materi pelajaran, serta menimbulkan rasa kantuk di kelas.
                </p>
              </div>

              {/* Water Score Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-200 block">
                    Poin Asupan Air Putih:
                  </span>
                  <span className="text-2xl font-black">{currentMinumPoints} / 45 Poin</span>
                  <span className="text-[11px] text-blue-100 block mt-0.5">
                    {waterGlasses === '>=8' ? 'Memenuhi kuota ideal 8 gelas penuh' : waterGlasses === '<8' ? 'Mendapat 25 poin' : 'Pilih opsi di atas'}
                  </span>
                </div>
                <Sparkles className="w-8 h-8 text-amber-300" />
              </div>
            </div>
          )}

          {/* Rujukan Ilmiah Remang-remang di Bagian Paling Bawah */}
          <div className="pt-3 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 font-medium inline-flex items-center gap-1.5 leading-relaxed">
              <BookOpen className="w-3 h-3 text-slate-400 shrink-0" />
              <span>
                Rujukan: Pedoman Gizi Seimbang &amp; Panduan Isi Piringku — Kementerian Kesehatan Republik Indonesia (Kemenkes RI).
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div>
            {currentPage === 2 ? (
              <button
                type="button"
                onClick={() => {
                  setCurrentPage(1);
                  setActiveItem('');
                }}
                className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Kembali ke Card
              </button>
            ) : (
              <button
                type="button"
                onClick={onCancel}
                className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            )}
          </div>
          <div>
            {currentPage === 2 ? (
              <button
                type="button"
                disabled={
                  activeItem === 'bonus'
                    ? false
                    : activeItem === 'air_minum'
                    ? !waterGlasses
                    : !waktuKategori || (!piring.pokok && !piring.sayur && !piring.lauk && !piring.buah)
                }
                onClick={() => setShowHonestyModal(true)}
                className={`px-5 py-2 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all ${
                  (activeItem === 'air_minum' && !waterGlasses) ||
                  (activeItem !== 'air_minum' && activeItem !== 'bonus' && (!waktuKategori || (!piring.pokok && !piring.sayur && !piring.lauk && !piring.buah)))
                    ? 'bg-slate-300 cursor-not-allowed opacity-60'
                    : activeItem === 'bonus'
                    ? 'bg-amber-500 hover:bg-amber-600 cursor-pointer'
                    : 'bg-[#19ae5d] hover:bg-emerald-700 cursor-pointer'
                }`}
              >
                <Check className="w-4 h-4" /> {activeItem === 'bonus' ? 'Simpan Bonus Harian' : 'Simpan Jurnal'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Selesai
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Pernyataan Kejujuran Murid */}
      {showHonestyModal && (
        <div className="honesty-backdrop-blur fixed inset-0 w-screen h-screen z-[100] bg-slate-950/75 backdrop-blur-lg flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-[#19ae5d] flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Pernyataan Kejujuran Murid
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Jurnal tanggal {displayDate} • {activeItem === 'bonus' ? `Bonus: Kuliner Betawi & Tumbler (+${(makananBetawi ? 5 : 0) + (bawaTumbler ? 10 : 0)} pt)` : activeItem === 'air_minum' ? `Asupan Air: ${waterGlasses === '>=8' ? '≥8 Gelas (45 pt)' : '<8 Gelas (25 pt)'}` : `Sesi: ${activeMealConfig?.label}`}
              </p>
            </div>
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950 font-medium text-left">
              "Saya menyatakan dengan sejujur-jujurnya bahwa porsi makan, asupan gizi Isi Piringku, dan jumlah air putih yang saya laporkan sesuai dengan yang saya konsumsi secara nyata."
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowHonestyModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Koreksi
              </button>
              <button
                type="button"
                onClick={handleConfirmHonesty}
                className="flex-1 py-2.5 rounded-xl bg-[#19ae5d] hover:bg-emerald-700 text-white text-xs font-black shadow-sm cursor-pointer"
              >
                Simpan &amp; Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
