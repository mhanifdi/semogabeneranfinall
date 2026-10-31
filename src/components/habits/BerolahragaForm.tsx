/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Formulir Kebiasaan Berolahraga — JAWARA 28
 * Halaman 1: Intensitas Olahraga
 * - Tinggi (75 poin) --> Olahraga kompetitif, Sprint, Skipping
 * - Menengah (50 poin) --> Seni maen pukul (silat), senam, Jogging
 * - Ringan (25 poin) --> Berjalan cepat, peregangan, naik-turun tangga
 * Halaman 2: Durasi
 * - <15 menit (25 poin)
 * - 15-30 menit (50 poin)
 * - >30 menit (75 poin)
 * Skala 100: (Intensitas + Durasi) / 150 * 100
 * Formulir dimulai dari 0 (belum terisi).
 * Mencatat seluruh jawaban murid ke database.
 */

import React, { useState, useEffect } from 'react';
import { Activity, Check, ShieldCheck, ChevronRight, ChevronLeft, Sparkles, Calendar, BookOpen } from 'lucide-react';
import { calculateBerolahragaScoreWithBreakdown } from '../../utils/scoring';

interface BerolahragaFormProps {
  onSuccess: (score: number, payload: any) => void;
  onCancel: () => void;
  isAlreadySubmitted?: boolean;
  isMissedEntry?: boolean;
  targetDate?: string;
}

export const BerolahragaForm: React.FC<BerolahragaFormProps> = ({
  onSuccess,
  onCancel,
  isMissedEntry = false,
  targetDate,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const displayDate = targetDate || todayStr;
  const isPastDay = displayDate < todayStr || isMissedEntry;

  const [currentPage, setCurrentPage] = useState<1 | 2>(1);

  // Form dimulai dari kosong (0)
  const [intensitas, setIntensitas] = useState<'tinggi' | 'menengah' | 'ringan' | ''>('');
  const [durasiKategori, setDurasiKategori] = useState<'<15' | '15-30' | '>30' | ''>('');
  const [jalanKakiSepeda, setJalanKakiSepeda] = useState(false);
  const [showHonestyModal, setShowHonestyModal] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Hitung poin sesuai rumus baru:
  // rawSum = intensitas + durasi (maks 150)
  // baseScore = Math.min(100, rawSum)
  // rawOverflow = (rawSum - 100) / 10
  // Adiwiyata = +10 poin bonus
  const intensitasScore = intensitas === 'tinggi' ? 75 : intensitas === 'menengah' ? 50 : intensitas === 'ringan' ? 25 : 0;
  const durasiScore = durasiKategori === '>30' ? 75 : durasiKategori === '15-30' ? 50 : durasiKategori === '<15' ? 25 : 0;
  const rawSum = (intensitas ? intensitasScore : 0) + (durasiKategori ? durasiScore : 0);
  const baseScore = Math.min(100, rawSum);
  const rawOverflow = rawSum > 100 ? (rawSum - 100) / 10 : 0;
  const adiwiyataBonus = jalanKakiSepeda ? 10 : 0;
  const bonusAppliedToScore = Math.min(adiwiyataBonus, Math.max(0, 100 - baseScore));
  const currentScore = Math.min(100, baseScore + bonusAppliedToScore);
  const adiwiyataOverflow = Math.max(0, adiwiyataBonus - bonusAppliedToScore);
  const overflowBonus = Math.round((rawOverflow + adiwiyataOverflow) * 10) / 10;

  const INTENSITY_OPTIONS = [
    {
      key: 'tinggi' as const,
      label: 'Tinggi (75 Poin)',
      sub: 'Olahraga kompetitif, Sprint, Skipping, Renang cepat',
      pts: 75,
      badgeColor: 'text-red-700 bg-red-50 border-red-200',
    },
    {
      key: 'menengah' as const,
      label: 'Menengah (50 Poin)',
      sub: 'Seni maen pukul (silat khas Betawi), senam kebugaran, Jogging santai',
      pts: 50,
      badgeColor: 'text-red-700 bg-red-50 border-red-200',
    },
    {
      key: 'ringan' as const,
      label: 'Ringan (25 Poin)',
      sub: 'Berjalan cepat, peregangan (stretching), naik-turun tangga',
      pts: 25,
      badgeColor: 'text-red-700 bg-red-50 border-red-200',
    },
  ];

  const DURATION_OPTIONS = [
    {
      key: '<15' as const,
      label: 'Kurang dari 15 menit',
      pts: 25,
      desc: 'Aktivitas fisik singkat penyegar tubuh',
    },
    {
      key: '15-30' as const,
      label: '15 – 30 menit',
      pts: 50,
      desc: 'Durasi standar menjaga kebugaran harian',
    },
    {
      key: '>30' as const,
      label: 'Lebih dari 30 menit',
      pts: 75,
      desc: 'Latihan optimal meningkatkan daya tahan jantung & otot',
    },
  ];

  const handleConfirmHonesty = () => {
    setShowHonestyModal(false);

    const intObj = INTENSITY_OPTIONS.find((i) => i.key === intensitas);
    const durObj = DURATION_OPTIONS.find((d) => d.key === durasiKategori);

    const answers: Array<{
      question_code: string;
      question_text: string;
      answer_value: string;
      answer_text: string;
      points: number;
    }> = [
      {
        question_code: 'olahraga_intensitas',
        question_text: 'Tingkat Intensitas Olahraga',
        answer_value: intensitas,
        answer_text: intObj ? `${intObj.label} - ${intObj.sub}` : '',
        points: intensitasScore,
      },
      {
        question_code: 'olahraga_durasi',
        question_text: 'Durasi Olahraga',
        answer_value: durasiKategori,
        answer_text: durObj ? `${durObj.label} (${durObj.pts} Poin)` : '',
        points: durasiScore,
      },
      {
        question_code: 'olahraga_bonus_adiwiyata',
        question_text: 'Bonus Adiwiyata: Berjalan kaki atau bersepeda ke sekolah (+10 Poin)',
        answer_value: jalanKakiSepeda ? 'ya' : 'tidak',
        answer_text: jalanKakiSepeda ? 'Ya (+10 Poin Bonus)' : 'Tidak',
        points: jalanKakiSepeda ? 10 : 0,
      },
    ];

    onSuccess(currentScore, {
      entryMode: isPastDay ? 'formulir_terlewat' : 'tepat_hari_fleksibel',
      intensitas,
      intensitasScore,
      durasiKategori,
      durasiScore,
      duration: durasiKategori,
      jalanKakiSepeda,
      score: currentScore,
      baseScore,
      bonusPoints: adiwiyataBonus,
      overflowBonus,
      isMissed: isPastDay,
      journalDate: displayDate,
      timestamp: new Date().toLocaleTimeString('id-ID'),
      answers,
    });
  };

  return (
    <div className="modal-backdrop-blur fixed inset-0 w-screen h-screen z-50 bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-red-50/80 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#fc351c] text-white flex items-center justify-center shadow-xs">
              <Activity className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#fc351c]">
                  Berolahraga • Halaman {currentPage} dari 2
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#fc351c]" /> Tanggal: {displayDate}
                </span>
                {isPastDay && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Formulir Terlewat
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight mt-0.5">
                {currentPage === 1 ? 'Pilih Intensitas Olahraga' : 'Pilih Durasi & Catatan'}
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
                  step === currentPage ? 'bg-[#fc351c]' : step < currentPage ? 'bg-red-600' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-black text-[#fc351c] bg-red-50 px-2.5 py-0.5 rounded-lg border border-red-200">
            Nilai: {currentScore} / 100
          </span>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {currentPage === 1 && (
            <div className="space-y-3">
              <div className="p-3 bg-red-50/60 rounded-2xl border border-red-100">
                <span className="text-xs font-bold text-slate-900 block">
                  Pilih Tingkat Intensitas Olahraga Hari Ini:
                </span>
                <span className="text-[11px] text-slate-500">
                  Sesuaikan dengan jenis aktivitas fisik yang murid lakukan
                </span>
              </div>

              <div className="space-y-2.5">
                {INTENSITY_OPTIONS.map((item) => {
                  const isSelected = intensitas === item.key;
                  return (
                    <div
                      key={item.key}
                      onClick={() => setIntensitas(item.key)}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#fc351c] bg-red-50/70 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center border-2 shrink-0 ${
                              isSelected ? 'border-[#fc351c] bg-[#fc351c] text-white' : 'border-slate-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div>
                            <span className="text-xs font-extrabold text-slate-900 block">
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
          )}

          {currentPage === 2 && (
            <div className="space-y-4">
              {/* Durasi Olahraga */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  Durasi Olahraga Hari Ini:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {DURATION_OPTIONS.map((d) => {
                    const isSelected = durasiKategori === d.key;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => setDurasiKategori(d.key)}
                        className={`p-3 rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#fc351c] bg-red-50/70 shadow-xs ring-1 ring-[#fc351c]'
                            : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-extrabold text-slate-900 block">{d.label}</span>
                          <span className="text-[10px] text-slate-500 mt-1 block">{d.desc}</span>
                        </div>
                        <span className="text-[11px] font-black text-[#fc351c] mt-2 block">
                          +{d.pts} Poin
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bonus Adiwiyata: Jalan Kaki atau Bersepeda ke Sekolah */}
              <label
                onClick={() => setJalanKakiSepeda(!jalanKakiSepeda)}
                className={`p-3.5 rounded-2xl border-2 flex items-start justify-between gap-3 cursor-pointer transition-all ${
                  jalanKakiSepeda
                    ? 'bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center border-2 shrink-0 mt-0.5 ${
                      jalanKakiSepeda ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {jalanKakiSepeda && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <span className="text-xs font-extrabold text-slate-900 block">
                      Berjalan Kaki atau Bersepeda ke Sekolah (Bonus Adiwiyata)
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block leading-relaxed">
                      Kebiasaan mobilitas ramah lingkungan (eco-commute) tanpa polusi emisi karbon.
                    </span>
                  </div>
                </div>
                <span className="text-xs font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-md shrink-0">
                  +10 Bonus
                </span>
              </label>

              {/* Score summary banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-md flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-red-100 block">
                    Nilai Capaian Berolahraga:
                  </span>
                  <span className="text-2xl font-black">{currentScore} / 100</span>
                  <span className="text-[11px] text-red-100 block mt-0.5">
                    Intensitas ({intensitasScore}) + Durasi ({durasiScore})
                    {jalanKakiSepeda ? ' + Adiwiyata (+10)' : ''}
                  </span>
                  {overflowBonus > 0 && (
                    <span className="text-[10px] bg-amber-400 text-slate-900 font-black px-2 py-0.5 rounded-full inline-block mt-1">
                      +{overflowBonus} Poin Bonus masuk ke Poin Hebat
                    </span>
                  )}
                </div>
                <Sparkles className="w-8 h-8 text-amber-200" />
              </div>
            </div>
          )}

          {/* Rujukan Ilmiah Remang-remang di Bagian Paling Bawah */}
          <div className="pt-3 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400 font-medium inline-flex items-center gap-1.5 leading-relaxed">
              <BookOpen className="w-3 h-3 text-slate-400 shrink-0" />
              <span>
                Rujukan: Pedoman Aktivitas Fisik Remaja — Kementerian Kesehatan RI &amp; World Health Organization (WHO) Guidelines on Physical Activity.
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
                disabled={!intensitas}
                onClick={() => {
                  if (!intensitas) {
                    alert('Silakan pilih salah satu kategori intensitas olahraga.');
                    return;
                  }
                  setCurrentPage(2);
                }}
                className={`px-4 py-2 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 transition-all ${
                  !intensitas
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                    : 'bg-[#fc351c] hover:bg-red-700 text-white cursor-pointer'
                }`}
              >
                Lanjut <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!durasiKategori}
                onClick={() => {
                  if (!durasiKategori) {
                    alert('Silakan pilih durasi olahraga yang dilakukan.');
                    return;
                  }
                  setShowHonestyModal(true);
                }}
                className={`px-5 py-2 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all ${
                  !durasiKategori
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
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-[#fc351c] flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Pernyataan Kejujuran Olahraga
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Jurnal tanggal {displayDate} • Nilai Capaian: {currentScore} / 100
              </p>
            </div>
            <div className="p-3.5 bg-red-50/70 border border-red-200 rounded-xl text-xs text-red-950 font-medium text-left">
              "Saya menyatakan dengan sejujur-jujurnya bahwa aktivitas olahraga ini telah saya laksanakan sesuai data yang diisi."
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
