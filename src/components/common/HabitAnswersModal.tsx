/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modal Rincian Jawaban Instrumen Murid — JAWARA 28
 * Menampilkan seluruh jawaban yang tersimpan di tabel SQLite `student_habit_answers`
 * baik untuk menu Kebiasaanku, Riwayat Pengisian, maupun Guru & Admin.
 */

import React, { useState, useEffect } from 'react';
import { X, Database, CheckCircle2, Calendar, User, Award, Clock } from 'lucide-react';
import { api } from '../../utils/api';

interface HabitAnswersModalProps {
  studentId: string;
  studentName?: string;
  habitCode: string;
  habitTitle: string;
  logDate: string;
  onClose: () => void;
}

export const HabitAnswersModal: React.FC<HabitAnswersModalProps> = ({
  studentId,
  studentName,
  habitCode,
  habitTitle,
  logDate,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<any[]>([]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    api
      .getStudentHabitAnswers(studentId, logDate, habitCode)
      .then((data) => {
        if (isMounted) {
          setAnswers(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load student habit answers:', err);
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [studentId, logDate, habitCode]);

  const totalPoints = answers.reduce(
    (sum, item) => sum + (Number(item.points ?? item.score_earned) || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 max-h-[90vh] flex flex-col">
        {/* Header with Betawi bar */}
        <div className="h-2 w-full bg-gradient-to-r from-[#fc351c] via-[#feb52b] to-[#1c5ddc]" />
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/70 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1c5ddc] text-white flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#1c5ddc]">
                  Rekam Jawaban Instrumen Murid
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-[#1c5ddc]" /> Tanggal: {logDate}
                </span>
              </div>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight mt-0.5">
                {habitTitle}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700 font-semibold">
            <User className="w-4 h-4 text-slate-400" />
            <span>Murid: <strong>{studentName || 'Murid'}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Tersimpan di SQLite (student_habit_answers)
            </span>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <div className="w-6 h-6 border-2 border-[#1c5ddc] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold">Memuat rincian data jawaban murid...</span>
            </div>
          ) : answers.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-xs text-slate-500">
                Belum ada rincian jawaban spesifik instrumen untuk tanggal dan kebiasaan ini.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {answers.map((ans, idx) => (
                <div
                  key={ans.id || idx}
                  className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200 flex items-start justify-between gap-3"
                >
                  <div className="flex-1">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-0.5">
                      Pertanyaan #{idx + 1} • {ans.question_code || ans.question_key}
                    </span>
                    <h4 className="text-xs font-bold text-slate-800 leading-snug">
                      {ans.question_text || ans.question_label}
                    </h4>
                    <div className="mt-2 p-2 bg-white rounded-xl border border-slate-200/80 text-xs text-slate-900 font-medium">
                      {ans.answer_text || ans.answer_value || '-'}
                    </div>
                  </div>
                  {(ans.points !== undefined && ans.points !== null) || (ans.score_earned !== undefined && ans.score_earned !== null) ? (
                    <span className="text-xs font-black text-[#1c5ddc] bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-xl shrink-0 mt-4">
                      +{ans.points ?? ans.score_earned} Poin
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            Total {answers.length} butir jawaban instrumen tercatat
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Tutup Rincian
          </button>
        </div>
      </div>
    </div>
  );
};
