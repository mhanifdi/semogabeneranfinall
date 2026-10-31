/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Formulir Kebiasaan Beribadah — Sesuai Pembaruan Sistem Jawara 28
 * 1. Shalat 5 waktu & Tri Sandhya diubah menjadi checkbox (tanpa rentang awal/akhir).
 *    Terkunci otomatis jika waktu jadwal belum tiba pada hari ini.
 *    - Shalat: Subuh 04.00, Zuhur 11.38, Asar 14.54, Maghrib 17.48, Isya 19.00
 *    - Tri Sandhya: Pagi 05.00, Siang 12.00, Sore 18.00 (6.00 sore)
 * 2. Kristen:
 *    - Ibadah ke Gereja (50 pt) -> hanya dapat diisi hari Sabtu / Minggu.
 *      Setelah diisi, tombol terkunci untuk sepekan dan +50 poin ditambahkan setiap hari dalam pekan itu.
 *    - Membaca Doa sesudah atau sebelum kegiatan (25 pt)
 *    - Membaca Alkitab (25 pt)
 *    - Tak ada bonus untuk Kristen.
 * 3. Bonus Ibadah (bisa diakses di halaman pertama, max 1 pengisian per hari):
 *    - Islam: Puasa sunnah, Baca Qur'an (ada input surah/ayat/halaman, popup "Semoga khatam, ye!"), Ibadah lainnya.
 *      Diisi salah satu atau semuanya bernilai tetap 10 poin bonus.
 *    - Puasa sunnah terintegrasi otomatis dengan Makan Bergizi.
 * 4. Adiwiyata: Menjaga kebersihan tempat ibadah (+10 poin bonus), muncul di halaman pertama.
 * 5. Mulai dalam keadaan kosong murni (isi dari 0).
 * 6. Rujukan remang-remang di bagian paling bawah.
 * 7. Menggunakan istilah "Murid".
 */

import React, { useState, useEffect } from 'react';
import {
  Heart,
  Check,
  Clock,
  ShieldCheck,
  BookOpen,
  Calendar,
  Sparkles,
  Lock,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Info,
  CheckCircle2,
} from 'lucide-react';
import {
  calculateIslamHalanganScore,
  applyBonusCapAndOverflow,
} from '../../utils/scoring';
import { SCORING_RULES } from '../../config/scoringConfig';
import { timeToMinutes } from '../../utils/timeClassifier';

interface BeribadahFormProps {
  studentReligion?: string;
  studentGender?: string;
  todayLogs?: any[];
  isMissedEntry?: boolean;
  targetDate?: string;
  initialHalangan?: boolean;
  onSuccess: (score: number, payload: any, isCounter?: boolean, subCategory?: string, overwrite?: boolean) => void;
  onCancel: () => void;
}

export const BeribadahForm: React.FC<BeribadahFormProps> = ({
  studentReligion = 'Islam',
  studentGender = 'L',
  todayLogs = [],
  isMissedEntry = false,
  targetDate,
  initialHalangan = false,
  onSuccess,
  onCancel,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const displayDate = targetDate || todayStr;
  const isPastDay = displayDate < todayStr || isMissedEntry;

  const isIslam = !studentReligion || studentReligion.toLowerCase().includes('islam');
  const isKristen =
    studentReligion?.toLowerCase().includes('kristen') ||
    studentReligion?.toLowerCase().includes('katolik');
  const isHindu = studentReligion?.toLowerCase().includes('hindu');

  const [currentPage, setCurrentPage] = useState<1 | 2>(1);
  const [currentTimeStr, setCurrentTimeStr] = useState('');
  const [currentMinutes, setCurrentMinutes] = useState(0);
  const [showHonestyModal, setShowHonestyModal] = useState(false);

  // Pop up khatam Al-Qur'an
  const [quranPopup, setQuranPopup] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<{ score: number; payload: any } | null>(null);

  // Hari dalam sepekan untuk aturan Kristen (0 = Minggu, 6 = Sabtu)
  const targetDateObj = new Date(displayDate + 'T12:00:00');
  const dayOfWeek = targetDateObj.getDay(); // 0: Sun, 6: Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Deteksi status pelaksanaan shalat & ibadah dari log yang sudah tersimpan sebelumnya
  const previouslyCompletedShalat: Record<string, boolean> = {
    subuh: false,
    zuhur: false,
    asar: false,
    magrib: false,
    isya: false,
  };
  const previouslyCompletedHindu: Record<string, boolean> = {
    pagi: false,
    siang: false,
    sore: false,
  };
  let previouslyWedaDone = false;
  let previouslyChurchDone = false;
  let previouslyDoaDone = false;
  let previouslyAlkitabDone = false;
  let previouslyPuasa = false;
  let previouslyQuran = false;
  let previouslySurah = '';
  let previouslyAyat = '';
  let previouslyIbadahLain = false;
  let previouslyIbadahLainText = '';
  let previouslyAdiwiyata = false;

  todayLogs.forEach((l) => {
    const sub = (l.sub_category || '').toLowerCase();
    if (sub.includes('subuh')) previouslyCompletedShalat.subuh = true;
    if (sub.includes('zuhur') || sub.includes('dzuhur')) previouslyCompletedShalat.zuhur = true;
    if (sub.includes('asar') || sub.includes('ashar')) previouslyCompletedShalat.asar = true;
    if (sub.includes('magrib') || sub.includes('maghrib')) previouslyCompletedShalat.magrib = true;
    if (sub.includes('isya')) previouslyCompletedShalat.isya = true;

    try {
      const p = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
      if (p?.shalat) {
        if (p.shalat.subuh) previouslyCompletedShalat.subuh = true;
        if (p.shalat.zuhur || p.shalat.dzuhur) previouslyCompletedShalat.zuhur = true;
        if (p.shalat.asar || p.shalat.ashar) previouslyCompletedShalat.asar = true;
        if (p.shalat.magrib || p.shalat.maghrib) previouslyCompletedShalat.magrib = true;
        if (p.shalat.isya) previouslyCompletedShalat.isya = true;
      }
      if (p?.ibadahGereja || p?.gereja) previouslyChurchDone = true;
      if (p?.doaKegiatan || p?.doa) previouslyDoaDone = true;
      if (p?.bacaAlkitab || p?.alkitab) previouslyAlkitabDone = true;
      if (p?.puasaSunnah) previouslyPuasa = true;
      if (p?.bacaQuran) {
        previouslyQuran = true;
        if (p.quranSurah) previouslySurah = p.quranSurah;
        if (p.quranAyatCount) previouslyAyat = p.quranAyatCount;
      }
      if (p?.ibadahLainnya) {
        previouslyIbadahLain = true;
        if (p.ibadahLainnyaText) previouslyIbadahLainText = p.ibadahLainnyaText;
      }
      if (p?.adiwiyataTempatIbadah) previouslyAdiwiyata = true;
      if (p?.triSandhya) {
        if (p.triSandhya.pagi) previouslyCompletedHindu.pagi = true;
        if (p.triSandhya.siang) previouslyCompletedHindu.siang = true;
        if (p.triSandhya.sore) previouslyCompletedHindu.sore = true;
      }
      if (p?.bacaWeda) previouslyWedaDone = true;
    } catch {}
  });

  // Islam Checkbox States (dimulai dengan menyertakan yang sudah selesai)
  const [shalatChecked, setShalatChecked] = useState<{
    subuh: boolean;
    zuhur: boolean;
    asar: boolean;
    magrib: boolean;
    isya: boolean;
  }>({
    subuh: previouslyCompletedShalat.subuh,
    zuhur: previouslyCompletedShalat.zuhur,
    asar: previouslyCompletedShalat.asar,
    magrib: previouslyCompletedShalat.magrib,
    isya: previouslyCompletedShalat.isya,
  });

  // Islam Halangan (khusus murid putri)
  const [isHalangan, setIsHalangan] = useState(studentGender === 'P' && initialHalangan);
  const [halanganItems, setHalanganItems] = useState({
    dzikirDoa: false,
    murajaahQuran: false,
    berbuatBaik: false,
    kajianAgama: false,
    kebersihanDiri: false,
  });

  // State & Locking Bonus Ibadah + Adiwiyata
  const [activeBonusPage, setActiveBonusPage] = useState(false);
  const [bonusError, setBonusError] = useState('');
  let previouslyBonusClaimed = false;
  todayLogs.forEach((l) => {
    const sub = (l.sub_category || '').toLowerCase();
    if (sub === 'bonus' || sub.includes('bonus')) previouslyBonusClaimed = true;
    try {
      const p = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
      if (p?.isBonusLocked || p?.bonusSubmitted) previouslyBonusClaimed = true;
    } catch {}
  });
  const [bonusLocked, setBonusLocked] = useState(previouslyBonusClaimed);

  // Bonus Ibadah Islam
  const [bonusPuasaSunnah, setBonusPuasaSunnah] = useState(previouslyPuasa);
  const [bonusBacaQuran, setBonusBacaQuran] = useState(previouslyQuran);
  const [quranSurah, setQuranSurah] = useState(previouslySurah);
  const [quranAyatCount, setQuranAyatCount] = useState(previouslyAyat);
  const [bonusIbadahLainnya, setBonusIbadahLainnya] = useState(previouslyIbadahLain);
  const [ibadahLainnyaText, setIbadahLainnyaText] = useState(previouslyIbadahLainText);

  // Adiwiyata
  const [adiwiyataKebersihan, setAdiwiyataKebersihan] = useState(previouslyAdiwiyata);

  // Kristen Checkbox States
  const [kristenGereja, setKristenGereja] = useState(previouslyChurchDone);
  const [kristenDoaKegiatan, setKristenDoaKegiatan] = useState(previouslyDoaDone);
  const [kristenBacaAlkitab, setKristenBacaAlkitab] = useState(previouslyAlkitabDone);

  // Hindu Checkbox States
  const [hinduPagi, setHinduPagi] = useState(previouslyCompletedHindu.pagi);
  const [hinduSiang, setHinduSiang] = useState(previouslyCompletedHindu.siang);
  const [hinduSore, setHinduSore] = useState(previouslyCompletedHindu.sore);
  const [hinduBacaWeda, setHinduBacaWeda] = useState(previouslyWedaDone);

  // Notes
  const [notes, setNotes] = useState('');

  const handleSaveBonus = () => {
    setBonusError('');
    if (isIslam) {
      if (bonusBacaQuran && (!quranSurah.trim() || !quranAyatCount.trim())) {
        setBonusError("Nama Surah dan Jumlah Ayat / Halaman wajib diisi jika Membaca Al-Qur'an dicentang.");
        return;
      }
      if (bonusIbadahLainnya && !ibadahLainnyaText.trim()) {
        setBonusError('Rincian ibadah wajib diisi jika Ibadah Lainnya (Tahajud / Rawatib / Zikir) dicentang.');
        return;
      }
    }

    let calculatedBonus = 0;
    if (isIslam && (bonusPuasaSunnah || bonusBacaQuran || bonusIbadahLainnya)) calculatedBonus += 10;
    if (isHindu && hinduBacaWeda) calculatedBonus += 10;
    if (adiwiyataKebersihan) calculatedBonus += 10;

    const bonusPayload = {
      entryMode: isPastDay ? 'formulir_terlewat' : 'tepat_hari_fleksibel',
      religion: studentReligion,
      puasaSunnah: bonusPuasaSunnah,
      bacaQuran: bonusBacaQuran,
      quranSurah: quranSurah.trim(),
      quranAyatCount: quranAyatCount.trim(),
      ibadahLainnya: bonusIbadahLainnya,
      ibadahLainnyaText: ibadahLainnyaText.trim(),
      adiwiyataTempatIbadah: adiwiyataKebersihan,
      bacaWeda: hinduBacaWeda,
      isBonusLocked: true,
      bonusSubmitted: true,
      score: calculatedBonus,
      bonusPoints: calculatedBonus,
      isMissed: isPastDay,
      journalDate: displayDate,
      timestamp: new Date().toLocaleTimeString('id-ID'),
    };

    setBonusLocked(true);
    setActiveBonusPage(false);

    if (isIslam && bonusBacaQuran && !previouslyQuran) {
      setPendingSubmission({ score: calculatedBonus, payload: bonusPayload });
      setQuranPopup(true);
    } else {
      onSuccess(calculatedBonus, bonusPayload, true, 'bonus', true);
    }
  };

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
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setCurrentTimeStr(`${hh}:${mm}`);
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Jam Buka Shalat: Subuh 04.00, Zuhur 11.38, Asar 14.54, Maghrib 17.48, Isya 19.00
  const prayerSchedules = [
    { key: 'subuh', label: 'Salat Subuh', openStr: '04.00', openMin: 240, score: 20 },
    { key: 'zuhur', label: 'Salat Zuhur', openStr: '11.38', openMin: 698, score: 20 },
    { key: 'asar', label: 'Salat Asar', openStr: '14.54', openMin: 894, score: 20 },
    { key: 'magrib', label: 'Salat Maghrib', openStr: '17.48', openMin: 1068, score: 20 },
    { key: 'isya', label: 'Salat Isya', openStr: '19.00', openMin: 1140, score: 20 },
  ];

  // Tri Sandhya Buka: Pagi 05.00, Siang 12.00, Sore 18.00 (6 sore)
  const triSandhyaSchedules = [
    { key: 'pagi', label: 'Tri Sandhya Pagi', openStr: '05.00', openMin: 300, score: 34 },
    { key: 'siang', label: 'Tri Sandhya Siang', openStr: '12.00', openMin: 720, score: 33 },
    { key: 'sore', label: 'Tri Sandhya Sore', openStr: '18.00', openMin: 1080, score: 33 },
  ];

  // Hitung Skor
  let baseScore = 0;
  let bonusPoints = 0;

  if (isIslam) {
    if (isHalangan) {
      const count = Object.values(halanganItems).filter(Boolean).length;
      baseScore = count * 20;
    } else {
      const count = Object.values(shalatChecked).filter(Boolean).length;
      baseScore = count * 20;
    }
    const hasBonus = bonusPuasaSunnah || bonusBacaQuran || bonusIbadahLainnya;
    if (hasBonus) bonusPoints += 10;
    if (adiwiyataKebersihan) bonusPoints += 10;
  } else if (isKristen) {
    if (kristenGereja) baseScore += 50;
    if (kristenDoaKegiatan) baseScore += 25;
    if (kristenBacaAlkitab) baseScore += 25;
    // Tak ada bonus untuk kristen
  } else if (isHindu) {
    let count = 0;
    if (hinduPagi) count += 34;
    if (hinduSiang) count += 33;
    if (hinduSore) count += 33;
    baseScore = count;
    if (hinduBacaWeda) bonusPoints += 10;
    if (adiwiyataKebersihan) bonusPoints += 10;
  }

  const breakdown = applyBonusCapAndOverflow(baseScore, bonusPoints);
  const finalScore = breakdown.finalScore;

  const handleNextOrSubmit = () => {
    if (currentPage === 1) {
      setCurrentPage(2);
    } else {
      setShowHonestyModal(true);
    }
  };

  const handleConfirmHonesty = () => {
    setShowHonestyModal(false);

    // Kumpulkan seluruh jawaban murid untuk dicatat secara rinci di database
    const answersRecord: Array<{ key: string; label: string; value: string; score?: number }> = [];

    if (isIslam) {
      if (isHalangan) {
        answersRecord.push({
          key: 'mode_ibadah',
          label: 'Status Ibadah',
          value: 'Mode Pengganti Berhalangan (Siswi)',
          score: 0,
        });
        const hItems = [
          { key: 'dzikirDoa', label: 'Berdzikir dan berdoa', checked: halanganItems.dzikirDoa },
          { key: 'murajaahQuran', label: "Mendengar / membaca Al-Qur'an", checked: halanganItems.murajaahQuran },
          { key: 'berbuatBaik', label: 'Berbuat baik / sedekah', checked: halanganItems.berbuatBaik },
          { key: 'kajianAgama', label: 'Belajar ilmu agama / kajian', checked: halanganItems.kajianAgama },
          { key: 'kebersihanDiri', label: 'Menjaga kebersihan dan kesehatan', checked: halanganItems.kebersihanDiri },
        ];
        hItems.forEach((item) => {
          answersRecord.push({
            key: `halangan_${item.key}`,
            label: item.label,
            value: item.checked ? 'Ya (Dilaksanakan)' : 'Tidak',
            score: item.checked ? 20 : 0,
          });
        });
      } else {
        prayerSchedules.forEach((p) => {
          const isDone = Boolean((shalatChecked as any)[p.key]);
          answersRecord.push({
            key: `shalat_${p.key}`,
            label: p.label,
            value: isDone ? 'Ya (Sudah Dilaksanakan)' : 'Belum Dilaksanakan',
            score: isDone ? p.score : 0,
          });
        });
      }

      // Bonus Ibadah
      answersRecord.push({
        key: 'bonus_puasa_sunnah',
        label: 'Bonus Ibadah: Puasa Sunnah',
        value: bonusPuasaSunnah ? 'Ya (Sedang Berpuasa Sunnah)' : 'Tidak',
        score: bonusPuasaSunnah ? 10 : 0,
      });
      answersRecord.push({
        key: 'bonus_baca_quran',
        label: "Bonus Ibadah: Baca Al-Qur'an",
        value: bonusBacaQuran
          ? `Ya (Surah: ${quranSurah || '-'}, Jumlah: ${quranAyatCount || '-'})`
          : 'Tidak',
        score: bonusBacaQuran ? 10 : 0,
      });
      answersRecord.push({
        key: 'bonus_ibadah_lainnya',
        label: 'Bonus Ibadah: Ibadah Lainnya',
        value: bonusIbadahLainnya
          ? `Ya (${ibadahLainnyaText || 'Tahajjud / Shalat Rawatib / Zikir Petang'})`
          : 'Tidak',
        score: bonusIbadahLainnya ? 10 : 0,
      });
      answersRecord.push({
        key: 'adiwiyata_tempat_ibadah',
        label: 'Adiwiyata: Menjaga Kebersihan Tempat Ibadah',
        value: adiwiyataKebersihan ? 'Ya (Dilaksanakan)' : 'Tidak',
        score: adiwiyataKebersihan ? 10 : 0,
      });
    } else if (isKristen) {
      answersRecord.push({
        key: 'kristen_gereja',
        label: 'Ibadah ke Gereja (Sabtu / Minggu)',
        value: kristenGereja ? 'Ya (Sudah Dilaksanakan)' : 'Belum / Terkunci',
        score: kristenGereja ? 50 : 0,
      });
      answersRecord.push({
        key: 'kristen_doa_kegiatan',
        label: 'Membaca Doa sesudah atau sebelum kegiatan',
        value: kristenDoaKegiatan ? 'Ya (Sudah Dilaksanakan)' : 'Tidak',
        score: kristenDoaKegiatan ? 25 : 0,
      });
      answersRecord.push({
        key: 'kristen_baca_alkitab',
        label: 'Membaca Alkitab',
        value: kristenBacaAlkitab ? 'Ya (Sudah Dilaksanakan)' : 'Tidak',
        score: kristenBacaAlkitab ? 25 : 0,
      });
    } else if (isHindu) {
      answersRecord.push({
        key: 'hindu_tri_sandhya_pagi',
        label: 'Tri Sandhya Pagi (05.00 WIB)',
        value: hinduPagi ? 'Ya (Dilaksanakan)' : 'Tidak',
        score: hinduPagi ? 34 : 0,
      });
      answersRecord.push({
        key: 'hindu_tri_sandhya_siang',
        label: 'Tri Sandhya Siang (12.00 WIB)',
        value: hinduSiang ? 'Ya (Dilaksanakan)' : 'Tidak',
        score: hinduSiang ? 33 : 0,
      });
      answersRecord.push({
        key: 'hindu_tri_sandhya_sore',
        label: 'Tri Sandhya Sore (18.00 WIB)',
        value: hinduSore ? 'Ya (Dilaksanakan)' : 'Tidak',
        score: hinduSore ? 33 : 0,
      });
      answersRecord.push({
        key: 'hindu_baca_weda',
        label: 'Membaca Kitab Suci Weda',
        value: hinduBacaWeda ? 'Ya (Dilaksanakan)' : 'Tidak',
        score: hinduBacaWeda ? 10 : 0,
      });
      answersRecord.push({
        key: 'adiwiyata_tempat_ibadah',
        label: 'Adiwiyata: Menjaga Kebersihan Tempat Ibadah',
        value: adiwiyataKebersihan ? 'Ya (Dilaksanakan)' : 'Tidak',
        score: adiwiyataKebersihan ? 10 : 0,
      });
    }

    if (notes.trim()) {
      answersRecord.push({
        key: 'catatan_refleksi_ibadah',
        label: 'Catatan & Refleksi Ibadah',
        value: notes.trim(),
        score: 0,
      });
    }

    const payloadData = {
      entryMode: isPastDay ? 'formulir_terlewat' : 'tepat_hari_fleksibel',
      religion: studentReligion,
      isHalangan,
      halangan: halanganItems,
      shalat: shalatChecked,
      puasaSunnah: bonusPuasaSunnah,
      bacaQuran: bonusBacaQuran,
      quranSurah,
      quranAyatCount,
      ibadahLainnya: bonusIbadahLainnya,
      ibadahLainnyaText,
      adiwiyataTempatIbadah: adiwiyataKebersihan,
      // Kristen
      ibadahGereja: kristenGereja,
      doaKegiatan: kristenDoaKegiatan,
      bacaAlkitab: kristenBacaAlkitab,
      // Hindu
      triSandhya: { pagi: hinduPagi, siang: hinduSiang, sore: hinduSore },
      bacaWeda: hinduBacaWeda,
      notes: notes.trim(),
      baseScore,
      bonusPoints,
      overflowBonus: breakdown.overflowBonus,
      score: finalScore,
      isMissed: isPastDay,
      journalDate: displayDate,
      timestamp: new Date().toLocaleTimeString('id-ID'),
      answers: answersRecord,
    };

    if (isIslam && bonusBacaQuran && !previouslyQuran) {
      setPendingSubmission({ score: finalScore, payload: payloadData });
      setQuranPopup(true);
    } else {
      onSuccess(
        finalScore,
        payloadData,
        false,
        isHalangan ? 'halangan' : ''
      );
    }
  };

  return (
    <div className="modal-backdrop-blur fixed inset-0 w-screen h-screen z-50 bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-50/80 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#19ae5d] text-white flex items-center justify-center shadow-xs">
              <Heart className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#19ae5d]">
                  Beribadah • {studentReligion} • Hal {currentPage} dari 2
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#19ae5d]" /> {displayDate}
                </span>
                {isPastDay && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Formulir Terlewat
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight mt-0.5">
                {activeBonusPage ? 'Pengisian Poin Bonus & Adiwiyata' : currentPage === 1 ? 'Ibadah Harian, Bonus & Adiwiyata' : 'Refleksi & Konfirmasi Jurnal'}
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
                  activeBonusPage
                    ? step === 2 ? 'bg-[#19ae5d]' : 'bg-emerald-600'
                    : step === currentPage ? 'bg-[#19ae5d]' : step < currentPage ? 'bg-emerald-600' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-black text-[#19ae5d] bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
            Nilai: {finalScore} / 100
          </span>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {activeBonusPage ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-white rounded-2xl border border-emerald-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#19ae5d]" />
                    {isIslam ? 'Formulir Bonus Ibadah & Program Adiwiyata' : 'Formulir Bonus Weda & Program Adiwiyata'}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-white border border-emerald-200 px-2 py-0.5 rounded-full">
                    Maks +20 Poin
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Pengisian ini dilakukan 1 kali sehari dan akan terkunci setelah disimpan. Centang amalan yang kamu tunaikan.
                </p>
              </div>

              {bonusError && (
                <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-800 font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{bonusError}</span>
                </div>
              )}

              {isIslam && (
                <div className="space-y-3">
                  {/* 1. Puasa Sunnah */}
                  <label className="flex items-center justify-between p-3 bg-white rounded-2xl border-2 border-slate-200 hover:border-emerald-300 cursor-pointer transition-all">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={bonusPuasaSunnah}
                        onChange={(e) => setBonusPuasaSunnah(e.target.checked)}
                        className="w-4 h-4 text-[#19ae5d] rounded focus:ring-[#19ae5d] cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-black text-slate-900 block">Puasa Sunnah</span>
                        <span className="text-[11px] text-slate-500">
                          Otomatis sinkron dengan formulir Makan Bergizi (Sedang Berpuasa)
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-black text-[#19ae5d] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">+10 pt</span>
                  </label>

                  {/* 2. Baca Qur'an */}
                  <div className="p-3.5 bg-white rounded-2xl border-2 border-slate-200 space-y-2.5">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={bonusBacaQuran}
                          onChange={(e) => setBonusBacaQuran(e.target.checked)}
                          className="w-4 h-4 text-[#19ae5d] rounded focus:ring-[#19ae5d] cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-black text-slate-900 block">
                            Membaca Al-Qur'an (Tadarrus / Tilawah)
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Wajib menulis nama surah dan ayat/halaman yang dibaca
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-black text-[#19ae5d] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">+10 pt</span>
                    </label>
                    {bonusBacaQuran && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 pl-7">
                        <div>
                          <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                            Nama Surah <span className="text-red-500">*</span>:
                          </label>
                          <input
                            type="text"
                            value={quranSurah}
                            onChange={(e) => {
                              setQuranSurah(e.target.value);
                              if (bonusError) setBonusError('');
                            }}
                            placeholder="Contoh: Al-Baqarah"
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-400 focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                            Jumlah Ayat / Halaman <span className="text-red-500">*</span>:
                          </label>
                          <input
                            type="text"
                            value={quranAyatCount}
                            onChange={(e) => {
                              setQuranAyatCount(e.target.value);
                              if (bonusError) setBonusError('');
                            }}
                            placeholder="Contoh: 10 ayat / 2 halaman"
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-400 focus:bg-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Ibadah Lainnya */}
                  <div className="p-3.5 bg-white rounded-2xl border-2 border-slate-200 space-y-2.5">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={bonusIbadahLainnya}
                          onChange={(e) => setBonusIbadahLainnya(e.target.checked)}
                          className="w-4 h-4 text-[#19ae5d] rounded focus:ring-[#19ae5d] cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-black text-slate-900 block">
                            Ibadah Lainnya (Tahajjud, Rawatib, Zikir Petang)
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Wajib menuliskan jenis ibadah yang dilaksanakan
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-black text-[#19ae5d] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">+10 pt</span>
                    </label>
                    {bonusIbadahLainnya && (
                      <div className="pt-1 pl-7">
                        <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                          Rincian Ibadah <span className="text-red-500">*</span>:
                        </label>
                        <input
                          type="text"
                          value={ibadahLainnyaText}
                          onChange={(e) => {
                            setIbadahLainnyaText(e.target.value);
                            if (bonusError) setBonusError('');
                          }}
                          placeholder="Tuliskan jenis ibadah (contoh: Shalat Tahajud 2 rakaat dan zikir petang)"
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-400 focus:bg-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* 4. Adiwiyata */}
                  <label className="flex items-start justify-between p-3.5 bg-emerald-50/70 rounded-2xl border-2 border-emerald-300 cursor-pointer">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={adiwiyataKebersihan}
                        onChange={(e) => setAdiwiyataKebersihan(e.target.checked)}
                        className="w-4 h-4 text-[#19ae5d] rounded focus:ring-[#19ae5d] mt-0.5 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-black text-emerald-950 block">
                          Program Adiwiyata: Menjaga Kebersihan Tempat Ibadah
                        </span>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Merapikan sajadah/tempat ibadah, memilah sampah, dan menjaga kesucian serta kebersihan lingkungan ibadah.
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-emerald-700 bg-white border border-emerald-200 px-2 py-0.5 rounded-lg shrink-0">+10 pt</span>
                  </label>
                </div>
              )}

              {isHindu && (
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3.5 bg-white rounded-2xl border-2 border-slate-200 hover:border-amber-300 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={hinduBacaWeda}
                        onChange={(e) => setHinduBacaWeda(e.target.checked)}
                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-black text-slate-900 block">
                          Membaca Kitab Suci Weda
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Membaca dan merenungkan sloka suci Weda harian
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">+10 pt</span>
                  </label>

                  <label className="flex items-start justify-between p-3.5 bg-amber-50/70 rounded-2xl border-2 border-amber-300 cursor-pointer">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={adiwiyataKebersihan}
                        onChange={(e) => setAdiwiyataKebersihan(e.target.checked)}
                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 mt-0.5 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs font-black text-amber-950 block">
                          Program Adiwiyata: Menjaga Kebersihan Tempat Ibadah
                        </span>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Membersihkan pelataran pura/tempat sembahyang, memilah sampah canang sari dan menjaga keasrian lingkungan.
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-amber-800 bg-white border border-amber-200 px-2 py-0.5 rounded-lg shrink-0">+10 pt</span>
                  </label>
                </div>
              )}
            </div>
          ) : currentPage === 1 ? (
            <div className="space-y-4">
              {/* ISLAM SECTION */}
              {isIslam && (
                <>
                  {studentGender === 'P' && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-rose-600" />
                        <span className="text-xs font-bold text-rose-950">
                          Saya sedang berhalangan (Khusus Siswi)
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isHalangan}
                        onChange={(e) => setIsHalangan(e.target.checked)}
                        className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
                      />
                    </div>
                  )}

                  {isHalangan ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800">
                          Aktivitas Pengganti Ibadah (Centang yang dilaksanakan):
                        </label>
                        <span className="text-xs font-black text-rose-600">
                          {baseScore} / 100
                        </span>
                      </div>
                      {[
                        { key: 'dzikirDoa', label: 'Berdzikir dan berdoa harian' },
                        { key: 'murajaahQuran', label: "Mendengar atau murottal Al-Qur'an" },
                        { key: 'berbuatBaik', label: 'Berbuat baik dan bersedekah' },
                        { key: 'kajianAgama', label: 'Belajar ilmu agama atau menyimak kajian' },
                        { key: 'kebersihanDiri', label: 'Menjaga kebersihan dan kesehatan diri' },
                      ].map((item) => (
                        <label
                          key={item.key}
                          className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                            (halanganItems as any)[item.key]
                              ? 'bg-rose-50/80 border-rose-400 ring-1 ring-rose-400 shadow-xs'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={(halanganItems as any)[item.key]}
                              onChange={(e) =>
                                setHalanganItems({ ...halanganItems, [item.key]: e.target.checked })
                              }
                              className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-800">{item.label}</span>
                          </div>
                          <span className="text-xs font-black text-rose-600">+20 pt</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-bold text-slate-800 block">
                            Status Pelaksanaan Shalat Fardhu 5 Waktu:
                          </label>
                          <span className="text-[11px] text-slate-500">
                            Pilih dan tandai selesai shalat yang sudah kamu tunaikan
                          </span>
                        </div>
                        <span className="text-xs font-black text-[#19ae5d] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          {baseScore} / 100 Poin
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5">
                        {prayerSchedules.map((p) => {
                          const isUnlocked = isPastDay || currentMinutes >= p.openMin;
                          const isAlreadyDone = Boolean(previouslyCompletedShalat[p.key]);
                          const isCheckedNow = Boolean((shalatChecked as any)[p.key]);

                          return (
                            <div
                              key={p.key}
                              className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                isAlreadyDone
                                  ? 'bg-emerald-50 border-emerald-500 shadow-xs'
                                  : !isUnlocked
                                  ? 'bg-slate-100/70 border-slate-200 opacity-65 cursor-not-allowed'
                                  : isCheckedNow
                                  ? 'bg-emerald-100/70 border-[#19ae5d] ring-2 ring-emerald-400 shadow-sm'
                                  : 'bg-white border-slate-200 hover:border-emerald-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                    isAlreadyDone || isCheckedNow
                                      ? 'bg-[#19ae5d] text-white shadow-xs'
                                      : !isUnlocked
                                      ? 'bg-slate-200 text-slate-500'
                                      : 'bg-emerald-50 border border-emerald-200 text-[#19ae5d]'
                                  }`}
                                >
                                  {isAlreadyDone || isCheckedNow ? (
                                    <Check className="w-5 h-5 stroke-[3]" />
                                  ) : !isUnlocked ? (
                                    <Lock className="w-4 h-4" />
                                  ) : (
                                    <Clock className="w-4 h-4" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-black text-slate-900 block leading-tight">
                                      {p.label}
                                    </span>
                                    <span
                                      className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                        isAlreadyDone || isCheckedNow
                                          ? 'bg-emerald-200/80 text-emerald-900 border border-emerald-300'
                                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                                      }`}
                                    >
                                      +{p.score} Poin
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-500 block mt-0.5">
                                    {isAlreadyDone ? (
                                      <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                                        ✓ Sudah Selesai Tercatat di Database
                                      </span>
                                    ) : !isUnlocked ? (
                                      <span className="text-slate-500 flex items-center gap-1">
                                        <Lock className="w-3 h-3 text-slate-400" /> Terkunci (Dibuka pukul {p.openStr} WIB)
                                      </span>
                                    ) : isCheckedNow ? (
                                      <span className="text-emerald-800 font-bold">
                                        ✓ Dipilih untuk disimpan pada sesi ini
                                      </span>
                                    ) : (
                                      <span className="text-slate-600 font-medium">
                                        Waktu masuk {p.openStr} WIB. Klik tombol untuk menyelesaikan.
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* Action Button sesuai 4 State */}
                              <div className="flex items-center justify-end">
                                {isAlreadyDone ? (
                                  <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 text-white flex items-center gap-1.5 shadow-xs cursor-default">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" /> Selesai (Terkunci)
                                  </span>
                                ) : !isUnlocked ? (
                                  <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-200 text-slate-500 flex items-center gap-1.5 cursor-not-allowed">
                                    <Lock className="w-3.5 h-3.5" /> Belum Waktunya
                                  </span>
                                ) : isCheckedNow ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShalatChecked({
                                        ...shalatChecked,
                                        [p.key]: false,
                                      })
                                    }
                                    className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-[#19ae5d] hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                                  >
                                    <Check className="w-3.5 h-3.5 stroke-[3]" /> Ditandai Selesai
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShalatChecked({
                                        ...shalatChecked,
                                        [p.key]: true,
                                      })
                                    }
                                    className="px-4 py-1.5 rounded-xl text-xs font-extrabold bg-white border-2 border-[#19ae5d] text-[#19ae5d] hover:bg-emerald-50 flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                                  >
                                    Tandai Selesai
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* CARD BONUS IBADAH & ADIWIYATA (ISLAM) */}
                  <div className="space-y-2 pt-1">
                    <label className="text-xs font-extrabold text-slate-800 block">
                      Poin Bonus Ibadah &amp; Program Adiwiyata:
                    </label>
                    <div
                      className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        bonusLocked
                          ? 'bg-emerald-50/90 border-emerald-500 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            bonusLocked
                              ? 'bg-[#19ae5d] text-white shadow-xs'
                              : 'bg-emerald-50 border border-emerald-200 text-[#19ae5d]'
                          }`}
                        >
                          {bonusLocked ? <Check className="w-5 h-5 stroke-[3]" /> : <Sparkles className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-900 block leading-tight">
                              Poin Bonus Sunnah, Al-Qur'an &amp; Adiwiyata
                            </span>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                bonusLocked
                                  ? 'bg-emerald-200/80 text-emerald-900 border border-emerald-300'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              Maks +20 Poin
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            {bonusLocked ? (
                              <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                                ✓ Selesai Tercatat (Terkunci) • Diisi 1x sehari
                              </span>
                            ) : (
                              'Puasa sunnah, tilawah Al-Qur\'an, ibadah lainnya & aksi kebersihan Adiwiyata.'
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        {bonusLocked ? (
                          <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 text-white flex items-center gap-1.5 shadow-xs cursor-default">
                            <Check className="w-3.5 h-3.5 stroke-[3]" /> Selesai (Terkunci)
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setBonusError('');
                              setActiveBonusPage(true);
                            }}
                            className="px-4 py-1.5 rounded-xl text-xs font-extrabold bg-white border-2 border-[#19ae5d] text-[#19ae5d] hover:bg-emerald-50 flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Isi Poin Bonus
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* KRISTEN SECTION */}
              {isKristen && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-slate-800 block">
                        Aktivitas Ibadah Murid Kristen / Katolik:
                      </label>
                      <span className="text-[11px] text-slate-500">
                        Ibadah gereja dibuka setiap Sabtu/Minggu dan berlaku sepekan
                      </span>
                    </div>
                    <span className="text-xs font-black text-[#1c5ddc] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                      {baseScore} / 100 Poin
                    </span>
                  </div>

                  {/* 1. Ibadah ke Gereja (Sabtu / Minggu saja, sepekan) */}
                  <div
                    className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      previouslyChurchDone
                        ? 'bg-emerald-50 border-emerald-500 shadow-xs'
                        : !isWeekend
                        ? 'bg-slate-100/70 border-slate-200 opacity-65 cursor-not-allowed'
                        : kristenGereja
                        ? 'bg-blue-50 border-[#1c5ddc] ring-2 ring-blue-400 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          previouslyChurchDone || kristenGereja
                            ? 'bg-[#1c5ddc] text-white shadow-xs'
                            : !isWeekend
                            ? 'bg-slate-200 text-slate-500'
                            : 'bg-blue-50 border border-blue-200 text-[#1c5ddc]'
                        }`}
                      >
                        {previouslyChurchDone || kristenGereja ? (
                          <Check className="w-5 h-5 stroke-[3]" />
                        ) : !isWeekend ? (
                          <Lock className="w-4 h-4" />
                        ) : (
                          <Clock className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 block leading-tight">
                            Ibadah ke Gereja (Kebaktian / Misa)
                          </span>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                              previouslyChurchDone || kristenGereja
                                ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            +50 Poin
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          {previouslyChurchDone ? (
                            <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                              ✓ Selesai tercatat untuk sepekan berjalan (+50 poin per hari)
                            </span>
                          ) : !isWeekend ? (
                            <span className="text-slate-500 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-slate-400" /> Terkunci (Hanya dibuka pada hari Sabtu / Minggu)
                            </span>
                          ) : kristenGereja ? (
                            <span className="text-blue-800 font-bold">
                              ✓ Dipilih untuk disimpan (+50 poin mingguan)
                            </span>
                          ) : (
                            <span className="text-slate-600 font-medium">
                              Tersedia hari ini (Sabtu/Minggu). Klik Tandai Selesai setelah beribadah.
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      {previouslyChurchDone ? (
                        <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 text-white flex items-center gap-1.5 shadow-xs cursor-default">
                          <Check className="w-3.5 h-3.5 stroke-[3]" /> Selesai (Terkunci)
                        </span>
                      ) : !isWeekend ? (
                        <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-200 text-slate-500 flex items-center gap-1.5 cursor-not-allowed">
                          <Lock className="w-3.5 h-3.5" /> Hanya Sabtu/Minggu
                        </span>
                      ) : kristenGereja ? (
                        <button
                          type="button"
                          onClick={() => setKristenGereja(false)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-[#1c5ddc] hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" /> Ditandai Selesai
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setKristenGereja(true)}
                          className="px-4 py-1.5 rounded-xl text-xs font-extrabold bg-white border-2 border-[#1c5ddc] text-[#1c5ddc] hover:bg-blue-50 flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                        >
                          Tandai Selesai
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 2. Membaca Doa sesudah atau sebelum kegiatan */}
                  <div
                    className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      previouslyDoaDone
                        ? 'bg-emerald-50 border-emerald-500 shadow-xs'
                        : kristenDoaKegiatan
                        ? 'bg-blue-50 border-[#1c5ddc] ring-2 ring-blue-400 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          previouslyDoaDone || kristenDoaKegiatan
                            ? 'bg-[#1c5ddc] text-white shadow-xs'
                            : 'bg-blue-50 border border-blue-200 text-[#1c5ddc]'
                        }`}
                      >
                        {previouslyDoaDone || kristenDoaKegiatan ? (
                          <Check className="w-5 h-5 stroke-[3]" />
                        ) : (
                          <Heart className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 block leading-tight">
                            Membaca Doa Sesudah atau Sebelum Kegiatan
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-200">
                            +25 Poin
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          {previouslyDoaDone ? (
                            <span className="text-emerald-700 font-extrabold">✓ Sudah Selesai Tercatat</span>
                          ) : (
                            'Doa syukur dan memohon bimbingan Tuhan dalam aktivitas harian.'
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      {previouslyDoaDone ? (
                        <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 text-white flex items-center gap-1.5 shadow-xs cursor-default">
                          <Check className="w-3.5 h-3.5 stroke-[3]" /> Selesai (Terkunci)
                        </span>
                      ) : kristenDoaKegiatan ? (
                        <button
                          type="button"
                          onClick={() => setKristenDoaKegiatan(false)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-[#1c5ddc] hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" /> Ditandai Selesai
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setKristenDoaKegiatan(true)}
                          className="px-4 py-1.5 rounded-xl text-xs font-extrabold bg-white border-2 border-[#1c5ddc] text-[#1c5ddc] hover:bg-blue-50 flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                        >
                          Tandai Selesai
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 3. Membaca Alkitab */}
                  <div
                    className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      previouslyAlkitabDone
                        ? 'bg-emerald-50 border-emerald-500 shadow-xs'
                        : kristenBacaAlkitab
                        ? 'bg-blue-50 border-[#1c5ddc] ring-2 ring-blue-400 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          previouslyAlkitabDone || kristenBacaAlkitab
                            ? 'bg-[#1c5ddc] text-white shadow-xs'
                            : 'bg-blue-50 border border-blue-200 text-[#1c5ddc]'
                        }`}
                      >
                        {previouslyAlkitabDone || kristenBacaAlkitab ? (
                          <Check className="w-5 h-5 stroke-[3]" />
                        ) : (
                          <BookOpen className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 block leading-tight">
                            Membaca Alkitab
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-200">
                            +25 Poin
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          {previouslyAlkitabDone ? (
                            <span className="text-emerald-700 font-extrabold">✓ Sudah Selesai Tercatat</span>
                          ) : (
                            'Merenungkan ayat suci dan firman Tuhan untuk penguatan karakter.'
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      {previouslyAlkitabDone ? (
                        <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 text-white flex items-center gap-1.5 shadow-xs cursor-default">
                          <Check className="w-3.5 h-3.5 stroke-[3]" /> Selesai (Terkunci)
                        </span>
                      ) : kristenBacaAlkitab ? (
                        <button
                          type="button"
                          onClick={() => setKristenBacaAlkitab(false)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-[#1c5ddc] hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" /> Ditandai Selesai
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setKristenBacaAlkitab(true)}
                          className="px-4 py-1.5 rounded-xl text-xs font-extrabold bg-white border-2 border-[#1c5ddc] text-[#1c5ddc] hover:bg-blue-50 flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                        >
                          Tandai Selesai
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
                    <Info className="w-4 h-4 text-[#1c5ddc] shrink-0 mt-0.5" />
                    <span>
                      <strong>Aturan Ibadah Gereja:</strong> Ibadah gereja hanya dapat diisi hari Sabtu atau Minggu. Setelah diisi, poin mingguan ditambahkan +50 poin setiap hari (Senin–Minggu) dan terkunci untuk pekan berjalan.
                    </span>
                  </div>
                </div>
              )}

              {/* HINDU SECTION */}
              {isHindu && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-slate-800 block">
                        Pelaksanaan Tri Sandhya Harian:
                      </label>
                      <span className="text-[11px] text-slate-500">
                        Tandai selesai Tri Sandhya yang sudah dilaksanakan hari ini
                      </span>
                    </div>
                    <span className="text-xs font-black text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                      {baseScore} / 100 Poin
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {triSandhyaSchedules.map((s) => {
                      const isUnlocked = isPastDay || currentMinutes >= s.openMin;
                      const isAlreadyDone = Boolean(previouslyCompletedHindu[s.key]);
                      const isCheckedNow = s.key === 'pagi' ? hinduPagi : s.key === 'siang' ? hinduSiang : hinduSore;

                      return (
                        <div
                          key={s.key}
                          className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isAlreadyDone
                              ? 'bg-amber-50 border-amber-500 shadow-xs'
                              : !isUnlocked
                              ? 'bg-slate-100/70 border-slate-200 opacity-65 cursor-not-allowed'
                              : isCheckedNow
                              ? 'bg-amber-100/70 border-amber-500 ring-2 ring-amber-400 shadow-sm'
                              : 'bg-white border-slate-200 hover:border-amber-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                isAlreadyDone || isCheckedNow
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : !isUnlocked
                                  ? 'bg-slate-200 text-slate-500'
                                  : 'bg-amber-50 border border-amber-200 text-amber-600'
                              }`}
                            >
                              {isAlreadyDone || isCheckedNow ? (
                                <Check className="w-5 h-5 stroke-[3]" />
                              ) : !isUnlocked ? (
                                <Lock className="w-4 h-4" />
                              ) : (
                                <Clock className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-slate-900 block leading-tight">
                                  {s.label}
                                </span>
                                <span
                                  className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                    isAlreadyDone || isCheckedNow
                                      ? 'bg-amber-200/80 text-amber-900 border border-amber-300'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}
                                >
                                  +{s.score} Poin
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-500 block mt-0.5">
                                {isAlreadyDone ? (
                                  <span className="text-amber-800 font-extrabold flex items-center gap-1">
                                    ✓ Sudah Selesai Tercatat di Database
                                  </span>
                                ) : !isUnlocked ? (
                                  <span className="text-slate-500 flex items-center gap-1">
                                    <Lock className="w-3 h-3 text-slate-400" /> Terkunci (Dibuka pukul {s.openStr} WIB)
                                  </span>
                                ) : isCheckedNow ? (
                                  <span className="text-amber-800 font-bold">
                                    ✓ Dipilih untuk disimpan pada sesi ini
                                  </span>
                                ) : (
                                  <span className="text-slate-600 font-medium">
                                    Waktu masuk {s.openStr} WIB. Klik tombol untuk menyelesaikan.
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end">
                            {isAlreadyDone ? (
                              <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-amber-600 text-white flex items-center gap-1.5 shadow-xs cursor-default">
                                <Check className="w-3.5 h-3.5 stroke-[3]" /> Selesai (Terkunci)
                              </span>
                            ) : !isUnlocked ? (
                              <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-200 text-slate-500 flex items-center gap-1.5 cursor-not-allowed">
                                <Lock className="w-3.5 h-3.5" /> Belum Waktunya
                              </span>
                            ) : isCheckedNow ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (s.key === 'pagi') setHinduPagi(false);
                                  else if (s.key === 'siang') setHinduSiang(false);
                                  else setHinduSore(false);
                                }}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" /> Ditandai Selesai
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  if (s.key === 'pagi') setHinduPagi(true);
                                  else if (s.key === 'siang') setHinduSiang(true);
                                  else setHinduSore(true);
                                }}
                                className="px-4 py-1.5 rounded-xl text-xs font-extrabold bg-white border-2 border-amber-600 text-amber-700 hover:bg-amber-50 flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                              >
                                Tandai Selesai
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* CARD BONUS WEDA & ADIWIYATA (HINDU) */}
                  <div className="space-y-2 pt-1">
                    <label className="text-xs font-extrabold text-slate-800 block">
                      Poin Bonus Weda &amp; Program Adiwiyata:
                    </label>
                    <div
                      className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        bonusLocked
                          ? 'bg-amber-50/90 border-amber-500 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            bonusLocked
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-amber-50 border border-amber-200 text-amber-600'
                          }`}
                        >
                          {bonusLocked ? <Check className="w-5 h-5 stroke-[3]" /> : <Sparkles className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-slate-900 block leading-tight">
                              Poin Bonus Kitab Suci Weda &amp; Adiwiyata
                            </span>
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                bonusLocked
                                  ? 'bg-amber-200/80 text-amber-900 border border-amber-300'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              Maks +20 Poin
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            {bonusLocked ? (
                              <span className="text-amber-800 font-extrabold flex items-center gap-1">
                                ✓ Selesai Tercatat (Terkunci) • Diisi 1x sehari
                              </span>
                            ) : (
                              'Membaca Kitab Suci Weda (+10 pt) & aksi kebersihan tempat ibadah Adiwiyata (+10 pt).'
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        {bonusLocked ? (
                          <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-amber-600 text-white flex items-center gap-1.5 shadow-xs cursor-default">
                            <Check className="w-3.5 h-3.5 stroke-[3]" /> Selesai (Terkunci)
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setBonusError('');
                              setActiveBonusPage(true);
                            }}
                            className="px-4 py-1.5 rounded-xl text-xs font-extrabold bg-white border-2 border-amber-600 text-amber-700 hover:bg-amber-50 flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Isi Poin Bonus
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Total Capaian Sesi (Gradasi Biru-Hijau BNI / Muhammadiyah) */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#005f56] via-[#00897b] to-[#10b981] text-white flex items-center justify-between shadow-md border border-teal-500/30">
                <div>
                  <span className="text-[10px] uppercase font-bold text-teal-100 block">
                    Nilai Capaian Ibadah Hari Ini:
                  </span>
                  <span className="text-2xl font-black text-white">
                    {finalScore} / 100
                  </span>
                  <span className="text-[10px] text-teal-50 block mt-0.5 font-medium">
                    Dasar ({baseScore}) + Bonus ({bonusPoints})
                  </span>
                </div>
                <CheckCircle2 className="w-8 h-8 text-emerald-200" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Ringkasan Skor Ibadah:</span>
                  <span className="text-base font-black text-emerald-800">
                    {finalScore} / 100 Poin
                  </span>
                </div>
                <span className="text-xs font-black text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
                  {breakdown.overflowBonus > 0 ? `+${breakdown.overflowBonus} Poin Hebat` : 'Lengkap'}
                </span>
              </div>

              {/* Kolom Refleksi / Doa / Catatan Ibadah */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Doa / Refleksi Pribadi Murid Hari Ini (Opsional):
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tuliskan refleksi ketenangan hati, doa kebaikan, atau catatan ibadah hari ini..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#19ae5d]"
                />
              </div>

              {/* Card Komitmen Spiritual */}
              <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl text-white shadow-md space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-200">Karakter Pelajar Pancasila</span>
                <h4 className="text-sm font-extrabold">Beriman, Bertakwa &amp; Berakhlak Mulia</h4>
                <p className="text-xs text-emerald-100 leading-relaxed pt-1">
                  Konsistensi ibadah membentuk integritas, kejujuran diri, serta kepedulian terhadap sesama warga sekolah.
                </p>
              </div>
            </div>
          )}

          {/* Rujukan Ilmiah Remang-remang di Bagian Paling Bawah */}
          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 space-y-0.5 leading-relaxed">
            <span className="font-semibold block text-slate-500">Rujukan untuk Kebiasaan Beribadah:</span>
            <p>
              Pusat Penguatan Karakter Kemendikbudristek RI (2024) &amp; Koenig, H. G. (2012). <em>Medicine, Religion, and Health</em>. Riset menunjukkan kedisiplinan beribadah dan refleksi spiritual harian meningkatkan ketahanan mental (<em>emotional resilience</em>), menurunkan tingkat stres murid, serta menumbuhkan kebiasaan hidup bersih ramah lingkungan.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          {activeBonusPage ? (
            <>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveBonusPage(false);
                    setBonusError('');
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Batal
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleSaveBonus}
                  className="px-5 py-2 bg-[#19ae5d] hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Simpan Poin Bonus
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                {currentPage === 2 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Kembali
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                )}
              </div>
              <div>
                {currentPage === 1 ? (
                  <button
                    type="button"
                    onClick={handleNextOrSubmit}
                    className="px-4 py-2 bg-[#19ae5d] hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    Lanjut <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowHonestyModal(true)}
                    className="px-5 py-2 bg-[#19ae5d] hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> Simpan Jurnal
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pop up Semoga Khatam Ye! */}
      {quranPopup && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-3 shadow-2xl border border-emerald-200 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-[#19ae5d] flex items-center justify-center mx-auto shadow-inner">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Alhamdulillah!
            </h3>
            <p className="text-sm font-bold text-emerald-800">
              “Semoga khatam, ye!”
            </p>
            <p className="text-xs text-slate-500">
              {quranSurah ? `Tadarrus Surah ${quranSurah} (${quranAyatCount || 'beberapa ayat'})` : 'Pahala tilawah Al-Qur\'an tercatat.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuranPopup(false);
                if (pendingSubmission) {
                  onSuccess(pendingSubmission.score, pendingSubmission.payload, false, isHalangan ? 'halangan' : '');
                }
              }}
              className="w-full py-2.5 bg-[#19ae5d] hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs"
            >
              Aamiin, Selesai!
            </button>
          </div>
        </div>
      )}

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
                Jurnal tanggal {displayDate} • Nilai Capaian: {finalScore} / 100
              </p>
            </div>
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950 font-medium text-left">
              "Saya menyatakan dengan sejujur-jujurnya bahwa data pelaksanaan ibadah dan kepedulian tempat ibadah ini diisi sesuai keadaan sebenarnya di hadapan Tuhan Yang Maha Esa."
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowHonestyModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Kembali / Koreksi
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