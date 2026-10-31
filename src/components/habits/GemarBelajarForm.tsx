/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Formulir Kebiasaan Gemar Belajar — JAWARA 28
 * Halaman 1:
 * - 4 Pilihan Kegiatan Belajar (Pilih 1 = 45 poin, Pilih >1 = 50 poin)
 *   1. Mengulang materi pelajaran sekolah / mengerjakan PR
 *   2. Membaca literatur (Non-fiksi / Fiksi)
 *   3. Mempelajari keterampilan baru (Memasak, musik, bahasa asing, pemerograman)
 *   4. Mengikuti kelompok belajar / diskusi materi bersama teman
 * - Program 28 (Checkbox): Menyimak siaran sekolah mengenai adiwiyata dan budaya betawi (+10 poin bonus)
 * Halaman 2:
 * - Durasi Belajar Tambahan:
 *   <=30 menit (15 poin)
 *   31-60 menit (25 poin)
 *   60-90 menit (35 poin)
 *   90-120 menit (45 poin)
 * - Ringkasan Materi: Minimal 40 karakter.
 *   40 karakter = 5 poin, 80+ karakter = 10 poin.
 * Formulir dimulai dari 0 (kosong).
 * Mencatat seluruh jawaban murid ke database.
 */

import React, { useState, useEffect } from 'react';
import { GraduationCap, Check, ShieldCheck, ChevronRight, ChevronLeft, Sparkles, Calendar, BookOpen, Radio } from 'lucide-react';
import { calculateGemarBelajarScoreWithBreakdown } from '../../utils/scoring';

interface GemarBelajarFormProps {
  onSuccess: (score: number, payload: any) => void;
  onCancel: () => void;
  isAlreadySubmitted?: boolean;
  isMissedEntry?: boolean;
  targetDate?: string;
}

export const GemarBelajarForm: React.FC<GemarBelajarFormProps> = ({
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
  const [activities, setActivities] = useState<string[]>([]);
  const [program28, setProgram28] = useState<boolean>(false);
  const [durasiKategori, setDurasiKategori] = useState<'<=30' | '31-60' | '60-90' | '90-120' | ''>('');
  const [ringkasanMateri, setRingkasanMateri] = useState<string>('');
  const [showHonestyModal, setShowHonestyModal] = useState<boolean>(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const LEARNING_ACTIVITIES = [
    'Mengulang materi pelajaran sekolah / mengerjakan PR',
    'Membaca literatur (Non-fiksi / Fiksi)',
    'Mempelajari keterampilan baru (Memasak, musik, bahasa asing, pemerograman)',
    'Mengikuti kelompok belajar / diskusi materi bersama teman',
  ];

  const DURATION_OPTIONS = [
    { key: '<=30' as const, label: '≤ 30 menit', pts: 15, desc: 'Fokus singkat mengulang konsep kunci' },
    { key: '31-60' as const, label: '31 – 60 menit', pts: 25, desc: 'Pengerjaan tugas harian rutin' },
    { key: '60-90' as const, label: '60 – 90 menit', pts: 35, desc: 'Pendalaman materi mendalam & latihan soal' },
    { key: '90-120' as const, label: '90 – 120 menit', pts: 45, desc: 'Sesi belajar intensif & keterampilan baru' },
  ];

  const toggleActivity = (item: string) => {
    setActivities((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  // Skor kegiatan
  let actScore = 0;
  if (activities.length > 1) {
    actScore = 50;
  } else if (activities.length === 1) {
    actScore = 45;
  }

  // Skor durasi
  let durScore = 0;
  if (durasiKategori === '90-120') durScore = 45;
  else if (durasiKategori === '60-90') durScore = 35;
  else if (durasiKategori === '31-60') durScore = 25;
  else if (durasiKategori === '<=30') durScore = 15;

  // Skor ringkasan
  const cleanDesc = ringkasanMateri.trim();
  let descScore = 0;
  if (cleanDesc.length >= 80) descScore = 10;
  else if (cleanDesc.length >= 40) descScore = 5;

  const baseScore = Math.min(100, actScore + durScore + descScore);
  const bonusPoints = program28 ? 10 : 0;
  const rawTotal = baseScore + bonusPoints;
  const currentScore = Math.min(100, rawTotal);
  const overflowBonus = Math.max(0, rawTotal - 100);

  const handleConfirmHonesty = () => {
    setShowHonestyModal(false);

    const durObj = DURATION_OPTIONS.find((d) => d.key === durasiKategori);

    const answers = [
      ...activities.map((act, idx) => ({
        question_code: `belajar_kegiatan_${idx + 1}`,
        question_text: 'Kegiatan Belajar yang Dilakukan',
        answer_value: act,
        answer_text: act,
        points: idx === 0 ? 45 : (idx === 1 ? 5 : 0),
      })),
      {
        question_code: 'belajar_program28',
        question_text: 'Program 28: Menyimak siaran sekolah mengenai adiwiyata dan budaya betawi',
        answer_value: program28 ? 'ya' : 'tidak',
        answer_text: program28 ? 'Ya (+10 Poin Bonus)' : 'Tidak',
        points: program28 ? 10 : 0,
      },
      {
        question_code: 'belajar_durasi',
        question_text: 'Durasi Belajar Tambahan',
        answer_value: durasiKategori,
        answer_text: durObj ? `${durObj.label} (+${durObj.pts} Poin)` : '',
        points: durScore,
      },
      {
        question_code: 'belajar_ringkasan',
        question_text: 'Ringkasan Materi / Hal yang Dipelajari (Min 40 Karakter)',
        answer_value: cleanDesc,
        answer_text: cleanDesc,
        points: descScore,
      },
    ];

    onSuccess(currentScore, {
      entryMode: isPastDay ? 'formulir_terlewat' : 'tepat_hari_fleksibel',
      duration: durasiKategori,
      durasiKategori,
      activities,
      program28,
      ringkasanMateri: cleanDesc,
      deskripsi: cleanDesc,
      notes: cleanDesc,
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
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0000fe] text-white flex items-center justify-center shadow-xs">
              <GraduationCap className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#0000fe]">
                  Gemar Belajar • Halaman {currentPage} dari 2
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#0000fe]" /> Tanggal: {displayDate}
                </span>
                {isPastDay && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Formulir Terlewat
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight mt-0.5">
                {currentPage === 1 ? 'Pilihan Kegiatan Belajar & Program 28' : 'Durasi Tambahan & Ringkasan Materi'}
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
                  step === currentPage ? 'bg-[#0000fe]' : step < currentPage ? 'bg-indigo-700' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-black text-[#0000fe] bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
            Nilai: {currentScore} / 100
          </span>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
          {currentPage === 1 && (
            <div className="space-y-4">
              {/* Pilihan Kegiatan Belajar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Pilih Kegiatan Belajar ({activities.length} dipilih):
                  </label>
                  <span className="text-xs font-black text-[#0000fe]">
                    {actScore} / 50 Poin
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mb-2">
                  Pilih 1 kegiatan = 45 poin • Pilih lebih dari 1 kegiatan = 50 poin
                </p>

                <div className="space-y-2">
                  {LEARNING_ACTIVITIES.map((act, idx) => {
                    const isSelected = activities.includes(act);
                    return (
                      <label
                        key={idx}
                        onClick={() => toggleActivity(act)}
                        className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-50/70 border-indigo-600 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border-2 shrink-0 ${
                            isSelected ? 'bg-[#0000fe] border-[#0000fe] text-white' : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="text-xs font-semibold text-slate-800 leading-snug">
                          {act}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Program 28: Adiwiyata & Budaya Betawi (+10 Poin Bonus) */}
              <div
                onClick={() => setProgram28(!program28)}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  program28
                    ? 'bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500 shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border-2 shrink-0 mt-0.5 ${
                        program28 ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {program28 && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-slate-900 block">
                        Program 28: Menyimak Siaran Sekolah
                      </span>
                      <span className="text-[11px] text-slate-600 mt-0.5 block">
                        Menyimak materi edukasi siaran sekolah mengenai adiwiyata dan kebudayaan Betawi
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
              {/* Durasi Belajar Tambahan */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Durasi Belajar Tambahan Hari Ini:
                  </label>
                  <span className="text-xs font-black text-[#0000fe]">
                    {durScore} / 45 Poin
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DURATION_OPTIONS.map((d) => {
                    const isSelected = durasiKategori === d.key;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => setDurasiKategori(d.key)}
                        className={`p-3 rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/80 border-[#0000fe] ring-1 ring-[#0000fe] shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-black text-slate-900 block">{d.label}</span>
                          <span className="text-[10px] text-slate-500 mt-0.5 block">{d.desc}</span>
                        </div>
                        <span className="text-[11px] font-black text-[#0000fe] mt-2 block">
                          +{d.pts} Poin
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ringkasan Materi (Min 40 Karakter) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800">
                    Ringkasan Materi / Hal yang Dipelajari (Wajib):
                  </label>
                  <span className="text-xs font-black text-[#0000fe]">
                    {descScore} / 10 Poin
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={ringkasanMateri}
                  onChange={(e) => setRingkasanMateri(e.target.value)}
                  placeholder="Tuliskan ringkasan materi, PR yang diselesaikan, atau ilmu baru yang kamu pelajari hari ini (minimal 40 karakter)..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className={cleanDesc.length >= 40 ? 'text-emerald-600 font-bold' : 'text-slate-500'}>
                    {cleanDesc.length >= 80
                      ? `✓ Ringkasan sangat lengkap (${cleanDesc.length} karakter → 10 / 10 Poin)`
                      : cleanDesc.length >= 40
                      ? `✓ Memenuhi syarat (${cleanDesc.length} karakter → 5 / 10 Poin, tulis ${80 - cleanDesc.length} karakter lagi untuk 10 poin)`
                      : `Minimal 40 karakter (${cleanDesc.length}/40 karakter, kurang ${40 - cleanDesc.length} karakter lagi)`}
                  </span>
                  <span className="text-slate-400 font-medium">40 chr = 5 pt • 80 chr = 10 pt</span>
                </div>
              </div>

              {/* Total Score Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 text-white shadow-md flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-200 block">
                    Nilai Capaian Gemar Belajar:
                  </span>
                  <span className="text-2xl font-black">{currentScore} / 100</span>
                  <span className="text-[11px] text-blue-100 block mt-0.5">
                    Kegiatan ({actScore}) + Durasi ({durScore}) + Ringkasan ({descScore})
                    {program28 ? ' + Program 28 (+10)' : ''}
                  </span>
                  {overflowBonus > 0 && (
                    <span className="text-[10px] bg-emerald-500 text-white font-bold px-2 py-0.5 rounded-full inline-block mt-1">
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
                Rujukan: Teori Retensi Belajar Spaced Repetition (Hermann Ebbinghaus) &amp; Standar Literasi Belajar Mandiri Kemendikbudristek.
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
                disabled={activities.length === 0}
                onClick={() => {
                  if (activities.length === 0) {
                    alert('Silakan pilih minimal 1 kegiatan belajar yang dilakukan.');
                    return;
                  }
                  setCurrentPage(2);
                }}
                className={`px-4 py-2 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 transition-all ${
                  activities.length === 0
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                    : 'bg-[#0000fe] hover:bg-blue-800 text-white cursor-pointer'
                }`}
              >
                Lanjut <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!durasiKategori || cleanDesc.length < 40}
                onClick={() => {
                  if (!durasiKategori) {
                    alert('Silakan pilih durasi belajar tambahan.');
                    return;
                  }
                  if (cleanDesc.length < 40) {
                    alert('Ringkasan materi minimal 40 karakter untuk menyimpan jurnal belajar.');
                    return;
                  }
                  setShowHonestyModal(true);
                }}
                className={`px-5 py-2 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all ${
                  !durasiKategori || cleanDesc.length < 40
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
            <div className="w-14 h-14 rounded-2xl bg-blue-100 text-[#0000fe] flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Pernyataan Kejujuran Belajar
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Jurnal tanggal {displayDate} • Nilai Capaian: {currentScore} / 100
              </p>
            </div>
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-950 font-medium text-left">
              "Saya menyatakan dengan sejujur-jujurnya bahwa kegiatan belajar dan materi yang saya tulis telah saya laksanakan sendiri."
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
