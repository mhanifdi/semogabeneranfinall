/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Formulir Kebiasaan Bangun Pagi — Sesuai Pembaruan Sistem Jawara 28
 * - Jam bangun tidur:
 *   4—5 (04.00–05.00 WIB) = 75 poin (ideal)
 *   5—6 (05.00–06.00 WIB) = 60 poin
 *   >6 (> 06.00 WIB) = 45 poin
 * - Pop up Betawi sesuai kategori waktu bangun
 * - Kondisi mental (3 pilihan):
 *   25 poin - Segar
 *   15 poin - Biasa
 *   5 poin - Kurang
 * - Kolom Afirmasi hari ini / kata-kata hari ini
 * - Rujukan ilmiah remang-remang di paling bawah
 * - Mulai dalam kondisi kosong murni (anak mengisi dari 0)
 * - Istilah murid digunakan secara konsisten
 */

import React, { useState, useEffect } from 'react';
import { Sun, Check, Clock, ShieldCheck, Calendar, ChevronRight, ChevronLeft, Sparkles, AlertCircle, Quote } from 'lucide-react';
import { calculateBangunPagiScoreWithBreakdown } from '../../utils/scoring';
import { SCORING_RULES } from '../../config/scoringConfig';

interface BangunPagiFormProps {
  onSuccess: (score: number, payload: any) => void;
  onCancel: () => void;
  isAlreadySubmitted?: boolean;
  isMissedEntry?: boolean;
  targetDate?: string;
}

export const BangunPagiForm: React.FC<BangunPagiFormProps> = ({
  onSuccess,
  onCancel,
  isMissedEntry = false,
  targetDate,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const displayDate = targetDate || todayStr;
  const isPastDay = displayDate < todayStr || isMissedEntry;

  const [currentPage, setCurrentPage] = useState<1 | 2>(1);
  const [fillMode, setFillMode] = useState<'tepat_hari_fleksibel' | 'tepat_hari_timestamp' | 'formulir_terlewat'>(
    isPastDay ? 'formulir_terlewat' : 'tepat_hari_fleksibel'
  );
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  // Formulir ketika dibuka BENAR-BENAR BELUM TERISI (isi dari 0)
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [kondisiMental, setKondisiMental] = useState<'segar' | 'biasa' | 'kurang' | ''>('');
  const [afirmasi, setAfirmasi] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Pop up Betawi
  const [betawiPopup, setBetawiPopup] = useState<string | null>(null);
  const [showHonestyModal, setShowHonestyModal] = useState(false);
  const [showBetawiModal, setShowBetawiModal] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState<{ score: number; payload: any } | null>(null);

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
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Slot pilihan jam bangun
  const slotOptions = [
    {
      id: '04.00-05.00',
      label: '04.00 – 05.00 WIB',
      score: 75,
      sub: 'Ideal & Sangat Pagi',
      popup: 'Cakep, ente Betawi banget! Jangan sampe rejeki dipatok ayam ye!',
    },
    {
      id: '05.00-06.00',
      label: '05.00 – 06.00 WIB',
      score: 60,
      sub: 'Awal Pagi / Cukup Disiplin',
      popup: 'Jangan bangun siang-siang! Nanti rejeki lu dipatok ayam!',
    },
    {
      id: '>06.00',
      label: '> 06.00 WIB (Lebih dari jam 6)',
      score: 45,
      sub: 'Kesiangan / Menjelang Masuk',
      popup: 'Wah... ente ngeledek malaikat rejeki nih...',
    },
  ];

  // 3 Opsi kondisi mental
  const kondisiOptions: Array<{ id: 'segar' | 'biasa' | 'kurang'; label: string; score: number; desc: string }> = [
    {
      id: 'segar',
      label: 'Segar',
      score: 25,
      desc: 'Tubuh bugar, pikiran jernih, siap menyongsong hari dengan bersemangat.',
    },
    {
      id: 'biasa',
      label: 'Biasa',
      score: 15,
      desc: 'Kondisi fisik netral, cukup bertenaga untuk memulai aktivitas harian.',
    },
    {
      id: 'kurang',
      label: 'Kurang',
      score: 5,
      desc: 'Merasa lelah, mengantuk, atau kurang tidur, butuh waktu pemulihan.',
    },
  ];

  // Handle slot selection (tanpa popup langsung saat klik)
  const handleSelectSlot = (slotId: string) => {
    setSelectedSlot(slotId);
  };

  // Timestamp mode slot mapping
  const resolveTimestampSlot = (timeStr: string) => {
    const [hhStr, mmStr] = timeStr.split(':');
    const hh = Number(hhStr || 0);
    const mm = Number(mmStr || 0);
    const totalMin = hh * 60 + mm;
    if (totalMin >= 240 && totalMin <= 300) return '04.00-05.00';
    if (totalMin > 300 && totalMin <= 360) return '05.00-06.00';
    return '>06.00';
  };

  const effectiveSlot =
    fillMode === 'tepat_hari_timestamp' && !isPastDay
      ? resolveTimestampSlot(currentTimeStr || '04:30')
      : selectedSlot;

  // Skor hitungan
  const selectedSlotObj = slotOptions.find((s) => s.id === effectiveSlot);
  const timeScore = selectedSlotObj ? selectedSlotObj.score : 0;
  const selectedKondisiObj = kondisiOptions.find((k) => k.id === kondisiMental);
  const conditionScore = selectedKondisiObj ? selectedKondisiObj.score : 0;
  const currentTotal = timeScore + conditionScore;

  const handleConfirmHonesty = () => {
    // Kumpulkan jawaban detail murid untuk dicatat di database
    const answersRecord = [
      {
        key: 'jam_bangun',
        label: 'Jam Bangun Tidur',
        value: selectedSlotObj ? `${selectedSlotObj.label} (${selectedSlotObj.score} poin)` : '-',
        score: timeScore,
      },
      {
        key: 'kondisi_mental',
        label: 'Kondisi Mental Saat Bangun',
        value: selectedKondisiObj ? `${selectedKondisiObj.label} (${selectedKondisiObj.score} poin) - ${selectedKondisiObj.desc}` : '-',
        score: conditionScore,
      },
      {
        key: 'afirmasi_hari_ini',
        label: 'Afirmasi Hari Ini',
        value: afirmasi.trim() || '(Tidak ada afirmasi khusus)',
        score: 0,
      },
      {
        key: 'catatan_refleksi',
        label: 'Catatan / Refleksi Pagi',
        value: notes.trim() || '-',
        score: 0,
      },
    ];

    const chosen = slotOptions.find((s) => s.id === effectiveSlot);
    const popupText = chosen ? chosen.popup : 'Cakep, ente Betawi banget! Jangan sampe rejeki dipatok ayam ye!';
    setBetawiPopup(popupText);

    setPendingSubmission({
      score: currentTotal,
      payload: {
        entryMode: fillMode,
        waktuBangun: selectedSlotObj?.label || effectiveSlot,
        timeSlot: effectiveSlot,
        kebugaranLevel: conditionScore,
        kondisiMental,
        kondisiLabel: selectedKondisiObj?.label || '',
        afirmasi: afirmasi.trim(),
        notes: notes.trim(),
        baseScore: currentTotal,
        bonusPoints: 0,
        overflowBonus: 0,
        score: currentTotal,
        isMissed: isPastDay,
        journalDate: displayDate,
        timestamp: new Date().toLocaleTimeString('id-ID'),
        answers: answersRecord,
        components: [
          { code: 'waktu_bangun', label: 'Rentang Waktu Bangun', value: selectedSlotObj?.label || effectiveSlot, score: timeScore, maxScore: 75 },
          { code: 'kondisi_bangun', label: 'Kondisi Mental Saat Bangun', value: selectedKondisiObj?.label || '', score: conditionScore, maxScore: 25 },
        ],
      },
    });

    setShowHonestyModal(false);
    setShowBetawiModal(true);
  };

  return (
    <div className="modal-backdrop-blur fixed inset-0 w-screen h-screen z-50 bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/80 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#1c5ddc] text-white flex items-center justify-center shadow-xs">
              <Sun className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#1c5ddc]">
                  Bangun Pagi • Halaman {currentPage} dari 2
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#1c5ddc]" /> Tanggal: {displayDate}
                </span>
                {isPastDay && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    Formulir Terlewat
                  </span>
                )}
              </div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight mt-0.5">
                {currentPage === 1 ? 'Pilih Jam Bangun Tidur' : 'Kondisi Mental & Afirmasi Hari Ini'}
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
                  step === currentPage ? 'bg-[#1c5ddc]' : step < currentPage ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-black text-[#1c5ddc] bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
            Nilai: {currentTotal} / 100
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
                      setFillMode('tepat_hari_fleksibel');
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      fillMode === 'tepat_hari_fleksibel'
                        ? 'bg-white text-[#1c5ddc] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Pilih Manual (Fleksibel)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFillMode('tepat_hari_timestamp');
                      const autoSlot = resolveTimestampSlot(currentTimeStr || '04:30');
                      handleSelectSlot(autoSlot);
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      fillMode === 'tepat_hari_timestamp'
                        ? 'bg-white text-[#1c5ddc] shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Stempel Waktu ({currentTimeStr || '--:--'})
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
                <div className="p-4 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200 rounded-2xl text-center space-y-2.5">
                  <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1c5ddc]">
                    <Clock className="w-4 h-4 animate-pulse" />
                    Stempel Waktu Aktual Murid (WIB)
                  </div>
                  <div className="text-4xl font-black text-slate-900 tracking-tight font-mono">
                    {currentTimeStr || '04:30'} <span className="text-sm font-semibold text-slate-500">WIB</span>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-blue-200 text-xs">
                    <span className="text-slate-500">Kategori Terbaca:</span>
                    <strong className="text-[#1c5ddc]">{selectedSlotObj?.label || '04.00 – 05.00 WIB'}</strong>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#19ae5d]" />
                    <strong className="text-[#19ae5d]">{timeScore} / 75</strong>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">
                      Pukul berapa Anda bangun tidur pagi ini?
                    </label>
                    <span className="text-xs font-black text-[#1c5ddc]">
                      {timeScore} / 75
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {slotOptions.map((opt) => {
                      const isSelected = selectedSlot === opt.id;
                      return (
                        <label
                          key={opt.id}
                          onClick={() => handleSelectSlot(opt.id)}
                          className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-blue-50/90 border-[#1c5ddc] ring-2 ring-[#1c5ddc] shadow-xs'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="bangun_slot_option"
                              checked={isSelected}
                              onChange={() => handleSelectSlot(opt.id)}
                              className="w-4 h-4 text-[#1c5ddc] focus:ring-[#1c5ddc]"
                            />
                            <div>
                              <span className="text-xs font-black text-slate-900 block">
                                {opt.label}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {opt.sub}
                              </span>
                            </div>
                          </div>
                          <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                            isSelected ? 'bg-[#1c5ddc] text-white' : 'bg-slate-200/70 text-slate-700'
                          }`}>
                            {opt.score} pt
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {currentPage === 2 && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Jam Bangun Terpilih:</span>
                  <span className="text-sm font-black text-[#1c5ddc]">
                    {selectedSlotObj?.label || effectiveSlot}
                  </span>
                </div>
                <span className="text-xs font-black text-[#1c5ddc] bg-white px-2.5 py-1 rounded-lg border border-blue-200">
                  {timeScore} / 75
                </span>
              </div>

              {/* Kondisi mental saat bangun tidur (3 pilihan) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-800">
                    Kondisi Mental Saat Bangun Tidur (3 Pilihan):
                  </label>
                  <span className="text-xs font-black text-[#1c5ddc]">
                    {conditionScore} / 25
                  </span>
                </div>

                <div className="space-y-2">
                  {kondisiOptions.map((opt) => {
                    const isSelected = kondisiMental === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setKondisiMental(opt.id)}
                        className={`w-full p-3 rounded-2xl border text-left flex items-start justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-50 border-[#1c5ddc] ring-2 ring-[#1c5ddc] shadow-xs'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900">{opt.label}</span>
                            <span className="text-[10px] font-bold text-[#1c5ddc] bg-blue-100 px-2 py-0.2 rounded-full">
                              {opt.score} poin
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                            {opt.desc}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected ? 'border-[#1c5ddc] bg-[#1c5ddc] text-white' : 'border-slate-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Kolom Afirmasi Hari Ini */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Afirmasi Hari Ini / Kata-kata Semangat Hari Ini:
                </label>
                <input
                  type="text"
                  value={afirmasi}
                  onChange={(e) => setAfirmasi(e.target.value)}
                  placeholder="Contoh: Hari ini saya fokus belajar, berbakti kepada orang tua, dan pantang menyerah!"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1c5ddc]"
                />
              </div>

              {/* Catatan Refleksi Opsional */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Catatan Pagi (Opsional):
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Merapikan tempat tidur dan membasuh muka dengan air dingin"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Total Score Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-100 block">
                    Nilai Capaian Bangun Pagi:
                  </span>
                  <span className="text-2xl font-black">{currentTotal} / 100</span>
                  <span className="text-[11px] text-blue-100 block mt-0.5">
                    Waktu ({timeScore}/75) + Kondisi Mental ({conditionScore}/25)
                  </span>
                </div>
                <Sparkles className="w-8 h-8 text-blue-200" />
              </div>
            </div>
          )}

          {/* Rujukan Ilmiah Remang-remang di Bagian Paling Bawah */}
          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 space-y-0.5 leading-relaxed">
            <span className="font-semibold block text-slate-500">Rujukan untuk Kebiasaan Bangun Pagi:</span>
            <p>
              Walker, M. (2017). <em>Why We Sleep: Unlocking the Power of Sleep and Dreams</em>. Scribner &amp; Kemenkes RI (Gerakan Masyarakat Hidup Sehat). Penelitian sirkadian membuktikan bangun pukul 04.00–05.00 WIB menyinkronkan pelepasan kortisol alami, meningkatkan kesegaran mental, dan menghindarkan kelambanan tidur (<em>sleep inertia</em>).
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
                disabled={!effectiveSlot}
                onClick={() => setCurrentPage(2)}
                className="px-4 py-2 bg-[#1c5ddc] hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1"
              >
                Lanjut <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!kondisiMental}
                onClick={() => setShowHonestyModal(true)}
                className="px-5 py-2 bg-[#19ae5d] hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Simpan Jurnal
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Pernyataan Kejujuran Murid */}
      {showHonestyModal && (
        <div className="honesty-backdrop-blur fixed inset-0 w-screen h-screen z-[100] bg-slate-950/75 backdrop-blur-lg flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 text-[#1c5ddc] flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Pernyataan Kejujuran Murid
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Jurnal tanggal {displayDate} • Nilai Capaian: {currentTotal} / 100
              </p>
            </div>
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-950 font-medium text-left space-y-1">
              <p>
                "Saya menyatakan dengan sejujur-jujurnya bahwa data waktu bangun pagi ({selectedSlotObj?.label || effectiveSlot}) dan kondisi mental ({selectedKondisiObj?.label || kondisiMental}) ini diisi sesuai keadaan sebenarnya."
              </p>
              {afirmasi && (
                <p className="text-[11px] text-blue-800 italic pt-1">
                  Afirmasi: "{afirmasi}"
                </p>
              )}
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

      {/* Modal Popup Pepatah Betawi Setelah Simpan Jurnal */}
      {showBetawiModal && (
        <div className="honesty-backdrop-blur fixed inset-0 w-screen h-screen z-[110] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-amber-200 text-center space-y-4 animate-scale-up">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-inner">
              <Quote className="w-9 h-9" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
                Petuah Budaya Betawi JAWARA 28
              </span>
              <h3 className="text-lg font-black text-slate-900 tracking-tight mt-2">
                Nasehat Orang Betawi
              </h3>
            </div>
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl">
              <p className="text-sm sm:text-base font-extrabold text-amber-950 leading-relaxed italic">
                “{betawiPopup}”
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Jurnal Bangun Pagi berhasil disimpan ke database dengan nilai {pendingSubmission?.score} / 100.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowBetawiModal(false);
                if (pendingSubmission) {
                  onSuccess(pendingSubmission.score, pendingSubmission.payload);
                }
              }}
              className="w-full py-3 rounded-xl bg-[#1c5ddc] hover:bg-blue-700 text-white text-xs font-black shadow-md cursor-pointer transition-colors"
            >
              Mantap, Selesai!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};