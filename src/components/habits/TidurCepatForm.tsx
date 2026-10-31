/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Formulir Kebiasaan Tidur Cepat — JAWARA 28
 * - Akses dibuka mulai pukul 18.00 WIB (jam 6 sore) untuk hari berjalan.
 * - Dropdown dihapus -> Opsi kartu klik-klik.
 * - Jam Tidur:
 *   <21.30 (75 poin)
 *   21.30 - 22.30 (65 poin)
 *   22.31 - 23.30 (55 poin)
 *   >23.31 (45 poin)
 * - Kualitas Tidur:
 *   Rileks (tenang, santai) (25 poin)
 *   Belum mengantuk (15 poin)
 *   Hiperaktif (stress, gelisah, tegang) (5 poin)
 * - Adiwiyata Hemat Energi (Checkbox): matikan lampu, atur suhu AC/kipas (+10 poin bonus)
 * Formulir dimulai dari 0 (belum terisi).
 * Mencatat seluruh jawaban murid ke database.
 */

import React, { useState, useEffect } from 'react';
import { Moon, Check, ShieldCheck, Clock, Calendar, ChevronRight, ChevronLeft, Sparkles, BookOpen, Lock, Quote } from 'lucide-react';
import { calculateTidurCepatScoreWithBreakdown } from '../../utils/scoring';

interface TidurCepatFormProps {
  onSuccess: (score: number, payload: any) => void;
  onCancel: () => void;
  isAlreadySubmitted?: boolean;
  isMissedEntry?: boolean;
  targetDate?: string;
}

export const TidurCepatForm: React.FC<TidurCepatFormProps> = ({
  onSuccess,
  onCancel,
  isMissedEntry = false,
  targetDate,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const displayDate = targetDate || todayStr;
  const isPastDay = displayDate < todayStr || isMissedEntry;

  const [currentPage, setCurrentPage] = useState<1 | 2>(1);

  // Mode pengisian: default tepat_hari_timestamp pertama kali
  const [fillMode, setFillMode] = useState<'tepat_hari_timestamp' | 'tepat_hari_fleksibel'>('tepat_hari_timestamp');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  // Form dimulai dari kosong (0)
  const [jamTidurSlot, setJamTidurSlot] = useState<'<21.30' | '21.30-22.30' | '22.31-23.30' | '>23.31' | ''>('');
  const [kualitasTidur, setKualitasTidur] = useState<'rileks' | 'belum_mengantuk' | 'hiperaktif' | ''>('');
  const [hematEnergi, setHematEnergi] = useState<boolean>(false);
  const [catatan, setCatatan] = useState<string>('');
  const [showHonestyModal, setShowHonestyModal] = useState<boolean>(false);
  const [showBetawiModal, setShowBetawiModal] = useState<boolean>(false);
  const [betawiPopupText, setBetawiPopupText] = useState<string>('');
  const [pendingSubmission, setPendingSubmission] = useState<{ score: number; payload: any } | null>(null);

  // Helper resolusi waktu aktual ke slot jam tidur
  const resolveTimestampSlot = (timeStr: string): '<21.30' | '21.30-22.30' | '22.31-23.30' | '>23.31' => {
    const [hhStr, mmStr] = timeStr.split(':');
    const hh = Number(hhStr || 0);
    const mm = Number(mmStr || 0);
    const totalMin = hh * 60 + mm;

    if (totalMin >= 1080 && totalMin <= 1289) {
      // 18.00 - 21.29 (< 21.30 WIB)
      return '<21.30';
    } else if (totalMin >= 1290 && totalMin <= 1350) {
      // 21.30 - 22.30 WIB
      return '21.30-22.30';
    } else if (totalMin >= 1351 && totalMin <= 1410) {
      // 22.31 - 23.30 WIB
      return '22.31-23.30';
    } else {
      // Lewat 23.30 WIB atau dini hari
      return '>23.31';
    }
  };

  // Cek apakah akses hari ini sudah dibuka (jam 18.00 / 6 sore WIB)
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const timeFormatted = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')} WIB`;
  const isLockedTime = !isPastDay && currentHour < 18;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const str = `${hh}:${mm}`;
      setCurrentTimeStr(str);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Set default slot saat mode timestamp aktif
  useEffect(() => {
    if (fillMode === 'tepat_hari_timestamp' && !isPastDay) {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const autoSlot = resolveTimestampSlot(`${hh}:${mm}`);
      setJamTidurSlot(autoSlot);
    }
  }, [fillMode, isPastDay]);

  const JAM_OPTIONS = [
    {
      key: '<21.30' as const,
      label: '< 21.30 WIB',
      pts: 75,
      sub: 'Tidur sangat awal, waktu istirahat dan regenerasi sel tubuh maksimal',
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
    {
      key: '21.30-22.30' as const,
      label: '21.30 – 22.30 WIB',
      pts: 65,
      sub: 'Jadwal tidur ideal remaja untuk menjaga daya tahan tubuh dan fokus',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      key: '22.31-23.30' as const,
      label: '22.31 – 23.30 WIB',
      pts: 55,
      sub: 'Cukup larut, segera istirahatkan mata dari gawai dan buku',
      color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
      key: '>23.31' as const,
      label: '> 23.31 WIB',
      pts: 45,
      sub: 'Terlalu larut / begadang, berpotensi menurunkan konsentrasi esok hari',
      color: 'text-rose-600 bg-rose-50 border-rose-200',
    },
  ];

  const QUALITY_OPTIONS = [
    {
      key: 'rileks' as const,
      label: 'Rileks (Tenang, Santai)',
      pts: 25,
      sub: 'Pikiran tenang, tidak terbebani kecemasan, siap beristirahat nyenyak',
      badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    {
      key: 'belum_mengantuk' as const,
      label: 'Belum Mengantuk',
      pts: 15,
      sub: 'Tubuh masih aktif namun berusaha menenangkan diri untuk tidur',
      badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    {
      key: 'hiperaktif' as const,
      label: 'Hiperaktif (Stres, Gelisah, Tegang)',
      pts: 5,
      sub: 'Pikiran terdistraksi gawai, emosi tidak stabil atau cemas berlebih',
      badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
    },
  ];

  // Perhitungan Nilai
  let jamScore = 0;
  if (jamTidurSlot === '<21.30') jamScore = 75;
  else if (jamTidurSlot === '21.30-22.30') jamScore = 65;
  else if (jamTidurSlot === '22.31-23.30') jamScore = 55;
  else if (jamTidurSlot === '>23.31') jamScore = 45;

  let qualityScore = 0;
  if (kualitasTidur === 'rileks') qualityScore = 25;
  else if (kualitasTidur === 'belum_mengantuk') qualityScore = 15;
  else if (kualitasTidur === 'hiperaktif') qualityScore = 5;

  const baseScore = Math.min(100, jamScore + qualityScore);
  const bonusPoints = hematEnergi ? 10 : 0;
  const rawTotal = baseScore + bonusPoints;
  const currentScore = Math.min(100, rawTotal);
  const overflowBonus = Math.max(0, rawTotal - 100);

  // Jika terkunci sebelum jam 18.00
  if (isLockedTime) {
    return (
      <div className="modal-backdrop-blur fixed inset-0 w-screen h-screen z-50 bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 text-center border border-slate-200 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Akses Tidur Cepat Belum Dibuka
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Formulir kebiasaan Tidur Cepat baru dapat diisi mulai pukul <span className="font-extrabold text-indigo-600">18.00 WIB (jam 6 sore)</span>.
            </p>
          </div>
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs text-indigo-900 font-semibold flex items-center justify-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>Waktu saat ini: {timeFormatted}</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  const handleConfirmHonesty = () => {
    setShowHonestyModal(false);

    const jamObj = JAM_OPTIONS.find((j) => j.key === jamTidurSlot);
    const qualObj = QUALITY_OPTIONS.find((q) => q.key === kualitasTidur);

    const answers: Array<{
      question_code: string;
      question_text: string;
      answer_value: string;
      answer_text: string;
      points: number;
    }> = [
      {
        question_code: 'tidur_jam',
        question_text: 'Rentang Jam Masuk Tidur',
        answer_value: jamTidurSlot,
        answer_text: jamObj ? `${jamObj.label} (${jamObj.pts} Poin) - ${jamObj.sub}` : '',
        points: jamScore,
      },
      {
        question_code: 'tidur_kualitas',
        question_text: 'Kondisi Mental & Kualitas Sebelum Tidur',
        answer_value: kualitasTidur,
        answer_text: qualObj ? `${qualObj.label} (${qualObj.pts} Poin) - ${qualObj.sub}` : '',
        points: qualityScore,
      },
      {
        question_code: 'tidur_adiwiyata_energi',
        question_text: 'Adiwiyata Hemat Energi (Matikan Lampu / Atur Suhu AC)',
        answer_value: hematEnergi ? 'ya' : 'tidak',
        answer_text: hematEnergi ? 'Ya (+10 Poin Bonus)' : 'Tidak',
        points: hematEnergi ? 10 : 0,
      },
    ];

    if (catatan.trim().length > 0) {
      answers.push({
        question_code: 'tidur_catatan',
        question_text: 'Catatan Refleksi Sebelum Tidur (Opsional)',
        answer_value: catatan.trim(),
        answer_text: catatan.trim(),
        points: 0,
      });
    }

    let popup = '';
    if (jamTidurSlot === '<21.30') {
      popup = 'Mantep! Bocah baek mah emang begini. Besok bangun pagi, badan seger rejeki juga kaga kabur';
    } else if (jamTidurSlot === '21.30-22.30') {
      popup = 'Udah mulai lewat batas nih. Kurangin melek malem-malem, nanti bisa masuk angin.';
    } else if (jamTidurSlot === '22.31-23.30') {
      popup = 'Dikit lagi kebablasan tuh! Rem dikit, Tong. Jangan diporsir mulu meleknya, kasihan itu mata minta istirahat';
    } else {
      popup = 'Buset dah, jek melotot bae lu! Ronda kaga melek iya, mau nyari penyakit lu?';
    }

    setBetawiPopupText(popup);
    setPendingSubmission({
      score: currentScore,
      payload: {
        entryMode: isPastDay ? 'formulir_terlewat' : fillMode,
        bedtimeSlot: jamTidurSlot,
        jamTidurSlot,
        waktuTidur: jamTidurSlot,
        kualitasTidur,
        sleepQuality: qualityScore,
        kondisiLabel: qualObj ? qualObj.label : '',
        turnOffLightsEco: hematEnergi,
        hematEnergi,
        adiwiyataHematEnergi: hematEnergi,
        reasonOrReport: catatan.trim(),
        baseScore,
        bonusPoints,
        overflowBonus,
        score: currentScore,
        isMissed: isPastDay,
        journalDate: displayDate,
        timestamp: new Date().toLocaleTimeString('id-ID'),
        answers,
      },
    });

    setShowHonestyModal(false);
    setShowBetawiModal(true);
  };

  return (
    <div className="modal-backdrop-blur fixed inset-0 w-screen h-screen z-50 bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Moon className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
                  Tidur Cepat • Halaman {currentPage} dari 2
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-indigo-600" /> Tanggal: {displayDate}
                </span>
                {isPastDay && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Formulir Terlewat
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight mt-0.5">
                {currentPage === 1 ? 'Pilih Jam Masuk Tidur & Hemat Energi' : 'Kualitas Mental Sebelum Tidur & Refleksi'}
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
                  step === currentPage ? 'bg-indigo-600' : step < currentPage ? 'bg-indigo-700' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
            Nilai: {currentScore} / 100
          </span>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {currentPage === 1 && (
            <div className="space-y-4">
              {!isPastDay ? (
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setFillMode('tepat_hari_timestamp');
                      const autoSlot = resolveTimestampSlot(currentTimeStr || '21:00');
                      setJamTidurSlot(autoSlot);
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      fillMode === 'tepat_hari_timestamp'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Stempel Waktu ({currentTimeStr || '--:--'})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFillMode('tepat_hari_fleksibel');
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      fillMode === 'tepat_hari_fleksibel'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Pilih Manual (Rentang Jam)
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-extrabold block">Formulir Terlewat — Tanggal {displayDate}</span>
                    <span className="text-[11px] text-amber-800">
                      Melengkapi jurnal tanggal sebelumnya tanpa pengurangan poin.
                    </span>
                  </div>
                  <span className="font-black text-amber-700 bg-white px-2.5 py-1 rounded-lg border border-amber-200">
                    Nilai Penuh
                  </span>
                </div>
              )}

              {fillMode === 'tepat_hari_timestamp' && !isPastDay ? (
                <div className="p-4 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border border-indigo-200 rounded-2xl text-center space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
                    <Clock className="w-4 h-4 animate-pulse" />
                    Stempel Waktu Aktual Tidur (WIB)
                  </div>
                  <div className="text-4xl font-black text-slate-900 tracking-tight font-mono">
                    {currentTimeStr || '21:00'} <span className="text-sm font-semibold text-slate-500">WIB</span>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-indigo-200 text-xs shadow-xs">
                    <span className="text-slate-500">Kategori Terbaca:</span>
                    <strong className="text-indigo-600">
                      {JAM_OPTIONS.find((j) => j.key === jamTidurSlot)?.label || '< 21.30 WIB'}
                    </strong>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <strong className="text-emerald-600">{jamScore} / 75 Poin</strong>
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    {JAM_OPTIONS.find((j) => j.key === jamTidurSlot)?.sub || 'Waktu tidur ideal tercatat otomatis.'}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      Pilih Jam Masuk Tidur:
                    </label>
                    <span className="text-xs font-black text-indigo-600">
                      {jamScore} / 75 Poin
                    </span>
                  </div>
                  <div className="space-y-2">
                    {JAM_OPTIONS.map((item) => {
                      const isSelected = jamTidurSlot === item.key;
                      return (
                        <div
                          key={item.key}
                          onClick={() => setJamTidurSlot(item.key)}
                          className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/70 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center border-2 shrink-0 mt-0.5 ${
                                  isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div>
                                <span className="text-xs font-black text-slate-900 block">
                                  {item.label}
                                </span>
                                <span className="text-[11px] text-slate-600 mt-0.5 block">
                                  {item.sub}
                                </span>
                              </div>
                            </div>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border shrink-0 ${item.color}`}>
                              +{item.pts} Poin
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Adiwiyata Hemat Energi (+10 Poin) */}
              <div
                onClick={() => setHematEnergi(!hematEnergi)}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  hematEnergi
                    ? 'bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500 shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border-2 shrink-0 mt-0.5 ${
                        hematEnergi ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {hematEnergi && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-slate-900 block">
                        Adiwiyata Hemat Energi (+10 Poin Bonus)
                      </span>
                      <span className="text-[11px] text-slate-600 mt-0.5 block leading-relaxed">
                        Mematikan lampu kamar, mengatur suhu AC/kipas angin secara bijak sebelum tidur
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0">
                    +10 Bonus
                  </span>
                </div>
              </div>
            </div>
          )}

          {currentPage === 2 && (
            <div className="space-y-4">
              {/* Kualitas Tidur / Kondisi Mental (3 Pilihan) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Kondisi Mental Sebelum Tidur:
                  </label>
                  <span className="text-xs font-black text-indigo-600">
                    {qualityScore} / 25 Poin
                  </span>
                </div>
                <div className="space-y-2">
                  {QUALITY_OPTIONS.map((item) => {
                    const isSelected = kualitasTidur === item.key;
                    return (
                      <div
                        key={item.key}
                        onClick={() => setKualitasTidur(item.key)}
                        className={`p-3 rounded-2xl border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center border-2 shrink-0 mt-0.5 ${
                                isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <div>
                              <span className="text-xs font-black text-slate-900 block">
                                {item.label}
                              </span>
                              <span className="text-[11px] text-slate-600 mt-0.5 block">
                                {item.sub}
                              </span>
                            </div>
                          </div>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border shrink-0 ${item.badgeColor}`}>
                            +{item.pts} Poin
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Catatan / Refleksi (Opsional) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Catatan / Evaluasi Harian Sebelum Tidur (Opsional):
                </label>
                <textarea
                  rows={2}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Hal yang disyukuri hari ini atau target kebaikan untuk esok hari..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Total Score Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-700 to-purple-800 text-white shadow-md flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-indigo-200 block">
                    Nilai Capaian Tidur Cepat:
                  </span>
                  <span className="text-2xl font-black">{currentScore} / 100</span>
                  <span className="text-[11px] text-indigo-100 block mt-0.5">
                    Jam Tidur ({jamScore}) + Kualitas ({qualityScore})
                    {hematEnergi ? ' + Adiwiyata (+10)' : ''}
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

          {/* Rujukan Ilmiah Remang-remang di Bagian Paling Bawah */}
          <div className="pt-3 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 font-medium inline-flex items-center gap-1.5 leading-relaxed">
              <BookOpen className="w-3 h-3 text-slate-400 shrink-0" />
              <span>
                Rujukan: National Sleep Foundation (NSF) Sleep Guidelines &amp; Pengaruh Higienitas Tidur Terhadap Ritme Sirkadian Remaja.
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
                disabled={!jamTidurSlot}
                onClick={() => {
                  if (!jamTidurSlot) {
                    alert('Silakan pilih salah satu jam masuk tidur.');
                    return;
                  }
                  setCurrentPage(2);
                }}
                className={`px-4 py-2 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 transition-all ${
                  !jamTidurSlot
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                }`}
              >
                Lanjut <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!kualitasTidur}
                onClick={() => {
                  if (!kualitasTidur) {
                    alert('Silakan pilih kondisi mental sebelum tidur.');
                    return;
                  }
                  setShowHonestyModal(true);
                }}
                className={`px-5 py-2 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all ${
                  !kualitasTidur
                    ? 'bg-slate-300 cursor-not-allowed opacity-60'
                    : 'bg-[#19ae5d] hover:bg-emerald-700 cursor-pointer'
                }`}
              >
                <Check className="w-4 h-4" /> Simpan Jurnal
              </button>
            )}
          </div>
        </div>
      </div>

      {showHonestyModal && (
        <div className="honesty-backdrop-blur fixed inset-0 w-screen h-screen z-[100] bg-slate-950/75 backdrop-blur-lg flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Pernyataan Kejujuran Tidur Cepat
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Jurnal tanggal {displayDate} • Nilai Capaian: {currentScore} / 100
              </p>
            </div>
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-950 font-medium text-left">
              "Saya menyatakan dengan sejujur-jujurnya bahwa data jam tidur dan kondisi sebelum tidur ini saya isi secara jujur."
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

      {/* Modal Popup Pepatah Betawi Setelah Simpan Jurnal Tidur Cepat */}
      {showBetawiModal && (
        <div className="honesty-backdrop-blur fixed inset-0 w-screen h-screen z-[110] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-indigo-200 text-center space-y-4 animate-scale-up">
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto shadow-inner">
              <Quote className="w-9 h-9" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 bg-indigo-100 px-3 py-1 rounded-full border border-indigo-300">
                Petuah Budaya Betawi JAWARA 28
              </span>
              <h3 className="text-lg font-black text-slate-900 tracking-tight mt-2">
                Nasehat Orang Betawi
              </h3>
            </div>
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-300 rounded-2xl">
              <p className="text-sm sm:text-base font-extrabold text-indigo-950 leading-relaxed italic">
                “{betawiPopupText}”
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Jurnal Tidur Cepat berhasil disimpan ke database dengan nilai {pendingSubmission?.score} / 100.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowBetawiModal(false);
                if (pendingSubmission) {
                  onSuccess(pendingSubmission.score, pendingSubmission.payload);
                }
              }}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md cursor-pointer transition-colors"
            >
              Mantap, Selesai!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
