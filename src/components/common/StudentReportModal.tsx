/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Award, CheckCircle2, Save, Sparkles, TrendingUp, Database } from 'lucide-react';
import { api } from '../../utils/api';
import { Student, HabitLog, HabitMetricComparison } from '../../types';
import { RadarChart } from '../charts/RadarChart';
import { TrendLineChart } from '../charts/TrendLineChart';
import { GaugeChart } from '../charts/GaugeChart';
import { StudentProgressChart, DailyProgressPoint } from '../charts/StudentProgressChart';
import { HabitAnswersModal } from './HabitAnswersModal';

interface StudentReportModalProps {
  studentId: string;
  onClose: () => void;
  canEditNotes?: boolean;
}

export const StudentReportModal: React.FC<StudentReportModalProps> = ({
  studentId,
  onClose,
  canEditNotes = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<{
    student: Student;
    habitMetrics: HabitMetricComparison[];
    overallScore: number;
    poinHebat?: number;
    totalEntries: number;
    streak?: number;
    recentLogs: HabitLog[];
  } | null>(null);
  const [progressSeries, setProgressSeries] = useState<DailyProgressPoint[]>([]);

  const [notes, setNotes] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [inspectAnswerHabit, setInspectAnswerHabit] = useState<{
    habitCode: string;
    habitTitle: string;
    logDate: string;
  } | null>(null);

  useEffect(() => {
    loadReport();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [studentId]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const [data, prog] = await Promise.all([
        api.getStudentReport(studentId),
        api.getStudentProgress(studentId, 14),
      ]);
      setReportData(data);
      setProgressSeries(prog?.series || []);
      setNotes(data.student.walas_notes || '');
      setRecommendation(data.student.walas_recommendation || '');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await api.saveTeacherNotes({
        student_id: studentId,
        walas_notes: notes,
        walas_recommendation: recommendation,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingNotes(false);
    }
  };

  if (loading || !reportData) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 shadow-xl flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#1c5ddc] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-slate-700">Memuat Rapor Murid...</span>
        </div>
      </div>
    );
  }

  const { student, habitMetrics, overallScore, poinHebat } = reportData;
  const effectiveScore = Number(student.avg_score || reportData.periodAverage || overallScore || 0);

  const radarData = habitMetrics.map((m: any) => ({
    habit: m.habit,
    label: m.label,
    score: Number(m.periodScore ?? m.studentScore ?? 0),
  }));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden my-6 max-h-[90vh] flex flex-col">
        {/* Header with Betawi Accent Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-[#fc351c] via-[#feb52b] to-[#1c5ddc]" />
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <span className="text-[11px] font-black tracking-wider text-[#1c5ddc] uppercase">
              Rapor Evaluasi Karakter 7 KAIH
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {student.name}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              NIS: {student.nisn} • Kelas: <strong>{student.class_name}</strong> • Rombel: <strong>{student.rombel_name || 'Rombel B'}</strong> • Jenjang {student.angkatan}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* Identity & KPI Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
              <span className="text-xs text-slate-500 font-medium block">Nilai Capaian</span>
              <span className="text-2xl font-black text-[#1c5ddc]">{overallScore} / 100</span>
              <span className="text-[11px] text-blue-700 font-medium block mt-0.5">
                {overallScore >= 90 ? 'Jawara Utama' : overallScore >= 75 ? 'Baik' : 'Perlu Ditingkatkan'}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100">
              <span className="text-xs text-slate-500 font-medium block">Poin Hebat</span>
              <span className="text-2xl font-black text-amber-900">{poinHebat ?? overallScore}</span>
              <span className="text-[11px] text-amber-700 font-medium block mt-0.5">
                Termasuk Bonus &amp; Streak
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
              <span className="text-xs text-slate-500 font-medium block">Guru Walas &amp; Wali</span>
              <span className="text-xs font-bold text-slate-900 block mt-0.5 line-clamp-1">
                Walas: {student.walas_name}
              </span>
              <span className="text-[11px] text-emerald-700 font-medium block line-clamp-1">
                Wali: {student.wali_name || 'Budi Santoso, S.Pd., M.Si.'}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100">
              <span className="text-xs text-slate-500 font-medium block">Validasi Lapangan</span>
              <span className="text-2xl font-black text-purple-900">
                {student.verification_score ? `${student.verification_score}/10` : '—'}
              </span>
              <span className="text-[11px] text-purple-700 font-medium block mt-0.5">
                {student.verification_score ? 'Terverifikasi Tim 7 KAIH' : 'Belum Diverifikasi'}
              </span>
            </div>
          </div>

          {/* Grafik Perkembangan Murid (Spesifikasi Final Section 13) */}
          <div className="bg-slate-50/60 rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-[#1c5ddc]" />
                  Grafik Perkembangan Murid (14 Hari)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Pilih salah satu dari 7 kebiasaan atau Rata-rata, serta ubah antara Grafik Garis dan Grafik Batang.
                </p>
              </div>
            </div>
            <StudentProgressChart series={progressSeries} />
          </div>

          {/* Charts Row: Radar & Gauge */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50/60 rounded-2xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Grafik Jaring Capaian 7 KAIH
                </h4>
                <span className="text-[10px] bg-blue-100 text-[#1c5ddc] px-2 py-0.5 rounded-full font-bold">
                  Skala 0–100
                </span>
              </div>
              <RadarChart
                data={radarData}
                compareData={[
                  { label: 'Rata-rata Kelas', color: '#10b981', scores: habitMetrics.map((m) => m.classAvg) },
                  { label: 'Rata-rata Sekolah', color: '#f59e0b', scores: habitMetrics.map((m) => m.schoolAvg) },
                ]}
                size={280}
              />
            </div>

            <div className="bg-slate-50/60 rounded-2xl p-4 border border-slate-200 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Indikator Kesiapan Karakter
                </h4>
              </div>
              <GaugeChart score={effectiveScore} title="Nilai Capaian" size={240} />
            </div>
          </div>

          {/* Trend Garis Komparasi */}
          <div className="bg-slate-50/60 rounded-2xl p-4 border border-slate-200">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1">
              Grafik Garis Tren Komparasi 7 KAIH
            </h4>
            <p className="text-[11px] text-slate-500 mb-3">
              Perbandingan capaian murid terhadap rata-rata Kelas, rata-rata Jenjang, dan rata-rata Sekolah SMAN 28 Jakarta.
            </p>
            <TrendLineChart metrics={habitMetrics} />
          </div>

          {/* Rincian Metrik Lengkap 7 KAIH */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 font-bold text-xs text-slate-700">
              Tabel &amp; Rincian Metrik Lengkap 7 KAIH
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Kebiasaan</th>
                    <th className="py-2.5 px-3 text-center">Nilai Murid</th>
                    <th className="py-2.5 px-3 text-center">Rerata Kelas</th>
                    <th className="py-2.5 px-3 text-center">Rerata Rombel</th>
                    <th className="py-2.5 px-3 text-center">Rerata Sekolah</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Jawaban SQLite</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {habitMetrics.map((m) => {
                    const diff = m.studentScore - m.classAvg;
                    return (
                      <tr key={m.habit} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-800">{m.label}</td>
                        <td className="py-2.5 px-3 text-center font-black text-[#1c5ddc]">
                          {m.studentScore > 0 ? m.studentScore : '0'} / 100
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600">{m.classAvg}</td>
                        <td className="py-2.5 px-3 text-center text-slate-600">{m.rombelAvg ?? m.classAvg}</td>
                        <td className="py-2.5 px-3 text-center text-slate-600">{m.schoolAvg}</td>
                        <td className="py-2.5 px-3">
                          {m.studentScore === 0 ? (
                            <span className="text-slate-400 text-[10px]">Belum diisi</span>
                          ) : diff >= 0 ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold">
                              Di Atas Rerata (+{diff.toFixed(1)})
                            </span>
                          ) : (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-bold">
                              Di Bawah Rerata ({diff.toFixed(1)})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setInspectAnswerHabit({
                                habitCode: m.habit,
                                habitTitle: m.label,
                                logDate: new Date().toISOString().split('T')[0],
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#1c5ddc] font-bold text-[10px] border border-blue-200 cursor-pointer shadow-2xs"
                            title="Buka seluruh rekaman jawaban instrumen murid ini di database"
                          >
                            <Database className="w-3 h-3" />
                            <span>Rincian</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ulasan & Rekomendasi Wali Kelas */}
          <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <h4 className="text-sm font-extrabold text-amber-950">
                  Ulasan &amp; Rekomendasi Guru Walas
                </h4>
              </div>
              {canEditNotes && (
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="btn-interactive inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1c5ddc] text-white text-xs font-bold rounded-lg hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingNotes ? 'Menyimpan...' : 'Simpan Catatan'}
                </button>
              )}
            </div>

            {savedSuccess && (
              <div className="p-2.5 bg-green-100 text-green-800 text-xs rounded-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Catatan dan rekomendasi berhasil disimpan!
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ulasan Guru Walas:
                </label>
                {canEditNotes ? (
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tulis ulasan kedisiplinan dan pembiasaan murid..."
                    className="w-full px-3 py-2 bg-white rounded-xl border border-amber-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1c5ddc]"
                  />
                ) : (
                  <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-amber-100">
                    {notes || 'Belum ada catatan tertulis dari wali kelas.'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rekomendasi Pengembangan:
                </label>
                {canEditNotes ? (
                  <textarea
                    rows={2}
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    placeholder="Tulis saran tindak lanjut untuk murid..."
                    className="w-full px-3 py-2 bg-white rounded-xl border border-amber-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1c5ddc]"
                  />
                ) : (
                  <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-amber-100">
                    {recommendation || 'Belum ada rekomendasi tertulis dari wali kelas.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Tutup Rapor
          </button>
        </div>
      </div>

      {/* Pop-up Rincian Jawaban Instrumen Murid dari Database SQLite */}
      {inspectAnswerHabit && (
        <HabitAnswersModal
          studentId={student.id}
          studentName={student.name}
          habitCode={inspectAnswerHabit.habitCode}
          habitTitle={inspectAnswerHabit.habitTitle}
          logDate={inspectAnswerHabit.logDate}
          onClose={() => setInspectAnswerHabit(null)}
        />
      )}
    </div>
  );
};
