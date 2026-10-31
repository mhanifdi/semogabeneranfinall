/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Formulir Kebiasaan Bermasyarakat — JAWARA 28
 * Halaman 1:
 * - Aksi Sosial: (25 poin/kegiatan)
 *   1. Membantu pekerjaan rumah atau anggota keluarga.
 *   2. Bertegur sapa dan bersikap santun kepada tetangga atau warga sekolah.
 *   3. Berkontribusi positif dalam bermedia sosial (diskusi kelompok, kampanye positif, berbagi informasi/membuat konten edukasi)
 * - Bonus: Nyambat (kerja bakti/gotong royong) dalam menjaga kebersihan lingkungan (+10 poin bonus)
 * Halaman 2:
 * - Deskripsi aksi dan kesan (minimal 40 karakter):
 *   40 karakter = 10 poin, 80++ karakter = 15 poin.
 * Formulir dimulai dari 0 (kosong).
 * Di bagian bawah remang-remang: tautan rujukan budaya tradisi Nyambat Betawi.
 * Mencatat seluruh jawaban murid ke database.
 */

import React, { useState, useEffect } from 'react';
import { Users, Check, ShieldCheck, ChevronRight, ChevronLeft, Sparkles, Calendar, ExternalLink } from 'lucide-react';
import { calculateBermasyarakatScoreWithBreakdown } from '../../utils/scoring';

interface BermasyarakatFormProps {
  onSuccess: (score: number, payload: any) => void;
  onCancel: () => void;
  isAlreadySubmitted?: boolean;
  isMissedEntry?: boolean;
  targetDate?: string;
}

export const BermasyarakatForm: React.FC<BermasyarakatFormProps> = ({
  onSuccess,
  onCancel,
  isMissedEntry = false,
  targetDate,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const displayDate = targetDate || todayStr;
  const isPastDay = displayDate < todayStr || isMissedEntry;

  const [currentPage, setCurrentPage] = useState<1 | 2>(1);

  // Form dimulai dari 0
  const [actions, setActions] = useState<string[]>([]);
  const [bonusNyambat, setBonusNyambat] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [showHonestyModal, setShowHonestyModal] = useState<boolean>(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const SOCIAL_ACTIONS = [
    'Membantu pekerjaan rumah atau anggota keluarga.',
    'Bertegur sapa dan bersikap santun kepada tetangga atau warga sekolah.',
    'Berkontribusi positif dalam bermedia sosial (diskusi kelompok, kampanye positif, berbagi informasi/membuat konten edukasi)',
  ];

  const toggleAction = (item: string) => {
    setActions((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  const actScore = Math.min(90, actions.length * 30);
  const cleanDesc = description.trim();
  let descScore = 0;
  if (cleanDesc.length >= 80) {
    descScore = 10;
  } else if (cleanDesc.length >= 40) {
    descScore = 5;
  }

  const baseScore = Math.min(100, actScore + descScore);
  const bonusPoints = bonusNyambat ? 10 : 0;
  const rawTotal = baseScore + bonusPoints;
  const currentScore = Math.min(100, rawTotal);
  const overflowBonus = Math.max(0, rawTotal - 100);

  const handleConfirmHonesty = () => {
    setShowHonestyModal(false);

    const answers = [
      ...actions.map((act, idx) => ({
        question_code: `masyarakat_aksi_${idx + 1}`,
        question_text: 'Aksi Sosial yang Dilaksanakan (30 Poin / Aksi)',
        answer_value: act,
        answer_text: act,
        points: 30,
      })),
      {
        question_code: 'masyarakat_bonus_nyambat',
        question_text: 'Bonus: Nyambat (Kerja bakti / gotong royong) menjaga kebersihan lingkungan (+10 Poin)',
        answer_value: bonusNyambat ? 'ya' : 'tidak',
        answer_text: bonusNyambat ? 'Ya (+10 Poin Bonus)' : 'Tidak',
        points: bonusNyambat ? 10 : 0,
      },
      {
        question_code: 'masyarakat_deskripsi_kesan',
        question_text: 'Deskripsi Aksi dan Kesan (Minimal 40 Karakter)',
        answer_value: cleanDesc,
        answer_text: cleanDesc,
        points: descScore,
      },
    ];

    onSuccess(currentScore, {
      entryMode: isPastDay ? 'formulir_terlewat' : 'tepat_hari_fleksibel',
      actions,
      nyambat: bonusNyambat,
      bonusNyambat,
      bonusPiket: bonusNyambat,
      description: cleanDesc,
      deskripsi: cleanDesc,
      baseScore,
      bonusPoints,
      overflowBonus,
      score: currentScore,
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
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-teal-50/80 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Users className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-teal-600">
                  Bermasyarakat • Halaman {currentPage} dari 2
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-teal-600" /> Tanggal: {displayDate}
                </span>
                {isPastDay && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Formulir Terlewat
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight mt-0.5">
                {currentPage === 1 ? 'Pilihan Aksi Sosial & Tradisi Nyambat' : 'Deskripsi Aksi, Kesan & Konfirmasi'}
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
                  step === currentPage ? 'bg-teal-600' : step < currentPage ? 'bg-teal-700' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-black text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200">
            Nilai: {currentScore} / 100
          </span>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {currentPage === 1 && (
            <div className="space-y-4">
              {/* Pilihan Aksi Sosial */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Pilih Aksi Sosial ({actions.length} dipilih):
                  </label>
                  <span className="text-xs font-black text-teal-700">
                    {actScore} / 90 Poin
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mb-2">
                  Tiap aksi bernilai 30 poin (maksimal 90 poin untuk 3 aksi)
                </p>

                <div className="space-y-2">
                  {SOCIAL_ACTIONS.map((act, idx) => {
                    const isSelected = actions.includes(act);
                    return (
                      <label
                        key={idx}
                        onClick={() => toggleAction(act)}
                        className={`flex items-start gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-teal-50/70 border-teal-600 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border-2 shrink-0 mt-0.5 ${
                            isSelected ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="flex-1">
                          <span className="text-xs font-bold text-slate-900 block leading-snug">
                            {act}
                          </span>
                        </div>
                        <span className="text-[10px] font-black text-teal-700 bg-teal-100/70 border border-teal-200 px-2 py-0.5 rounded-md shrink-0">
                          +30 Poin
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Bonus Nyambat Budaya Betawi (+10 Poin) */}
              <div
                onClick={() => setBonusNyambat(!bonusNyambat)}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  bonusNyambat
                    ? 'bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500 shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border-2 shrink-0 mt-0.5 ${
                        bonusNyambat ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {bonusNyambat && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-slate-900 block">
                        Bonus: Nyambat (Kerja Bakti / Gotong Royong)
                      </span>
                      <span className="text-[11px] text-slate-600 mt-0.5 block leading-relaxed">
                        Tradisi gotong royong masyarakat Betawi dalam menjaga kebersihan lingkungan bersama
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
              {/* Deskripsi Aksi dan Kesan (Min 40 Karakter) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800">
                    Deskripsi Aksi &amp; Kesan yang Dirasakan (Wajib):
                  </label>
                  <span className="text-xs font-black text-teal-700">
                    {descScore} / 10 Poin
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ceritakan apa yang kamu lakukan, kepada siapa, dan bagaimana perasaan atau kesanmu setelah membantu sesama (minimal 40 karakter)..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className={cleanDesc.length >= 40 ? 'text-emerald-600 font-bold' : 'text-slate-500'}>
                    {cleanDesc.length >= 80
                      ? `✓ Cerita sangat mendalam (${cleanDesc.length} karakter → 10 / 10 Poin)`
                      : cleanDesc.length >= 40
                      ? `✓ Memenuhi syarat (${cleanDesc.length} karakter → 5 / 10 Poin, tulis ${80 - cleanDesc.length} karakter lagi untuk 10 poin)`
                      : `Minimal 40 karakter (${cleanDesc.length}/40 karakter, kurang ${40 - cleanDesc.length} karakter lagi)`}
                  </span>
                  <span className="text-slate-400 font-medium">40 chr = 5 pt • 80++ chr = 10 pt</span>
                </div>
              </div>

              {/* Total Score Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-800 text-white shadow-md flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-teal-200 block">
                    Nilai Capaian Bermasyarakat:
                  </span>
                  <span className="text-2xl font-black">{currentScore} / 100</span>
                  <span className="text-[11px] text-teal-100 block mt-0.5">
                    Aksi ({actScore}) + Deskripsi &amp; Kesan ({descScore})
                    {bonusNyambat ? ' + Nyambat (+10)' : ''}
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

          {/* Rujukan Budaya Betawi Remang-remang di Bagian Paling Bawah */}
          <div className="pt-3 border-t border-slate-100 text-center">
            <a
              href="https://www.senibudayabetawi.com/8001/memaknai-gotong-royong-tradisi-nyambat-masyarakat-betawi.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors inline-flex items-center gap-1 underline underline-offset-2"
            >
              <span>Rujukan: Memaknai Gotong Royong Tradisi Nyambat Masyarakat Betawi</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
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
                disabled={actions.length === 0}
                onClick={() => {
                  if (actions.length === 0) {
                    alert('Silakan pilih minimal 1 aksi sosial yang murid laksanakan.');
                    return;
                  }
                  setCurrentPage(2);
                }}
                className={`px-4 py-2 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 transition-all ${
                  actions.length === 0
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                    : 'bg-teal-600 hover:bg-teal-700 text-white cursor-pointer'
                }`}
              >
                Lanjut <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={cleanDesc.length < 40}
                onClick={() => {
                  if (cleanDesc.length < 40) {
                    alert('Deskripsi aksi dan kesan minimal 40 karakter untuk menyimpan.');
                    return;
                  }
                  setShowHonestyModal(true);
                }}
                className={`px-5 py-2 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all ${
                  cleanDesc.length < 40
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
            <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-600 flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Pernyataan Kejujuran Bermasyarakat
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Jurnal tanggal {displayDate} • Nilai Capaian: {currentScore} / 100
              </p>
            </div>
            <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl text-xs text-teal-950 font-medium text-left">
              "Saya menyatakan dengan sejujur-jujurnya bahwa aksi sosial dan keterlibatan gotong royong ini telah saya lakukan secara nyata."
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
