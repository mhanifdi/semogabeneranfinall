/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Leaderboard Table — JAWARA 28
 * Aturan Akses & Privasi Peringkat:
 * 1. Publik: Maksimal menampilkan Top 10. Peringkat 11+ disembunyikan.
 * 2. Murid: Menampilkan Top 10. Jika posisi murid > 10, namanya menempel di baris ke-11
 *    dengan angka posisi aslinya (misal #15), peringkat murid lain >10 disembunyikan.
 * 3. Guru Wali, Guru Wali Kelas & Admin: Akses penuh ke seluruh peringkat murid dengan filter kelas & paginasi.
 */

import React, { useState } from 'react';
import {
  Trophy,
  Medal,
  Award,
  Search,
  Sparkles,
  Filter,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Star,
  Lock,
  User,
  ShieldAlert,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Student } from '../../types';

interface LeaderboardTableProps {
  students: Student[];
  currentUserId?: string;
  onSelectStudent?: (student: Student) => void;
  highlightClass?: string;
  hideNis?: boolean;
  viewerRole?: 'PUBLIC' | 'STUDENT' | 'TEACHER' | 'ADMIN';
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  students,
  currentUserId,
  onSelectStudent,
  highlightClass,
  hideNis = false,
  viewerRole = 'PUBLIC',
}) => {
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [privacyWarning, setPrivacyWarning] = useState<string | null>(null);

  // Trigger confetti for celebration
  const triggerCelebration = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#feb52b', '#1c5ddc', '#eb30a2', '#19ae5d', '#fc351c'],
    });
  };

  const handleRowClick = (s: Student) => {
    if (viewerRole === 'PUBLIC') {
      setPrivacyWarning('Rapor evaluasi karakter murid hanya dapat diakses melalui akun murid bersangkutan atau guru/admin.');
      return;
    }
    // Murid hanya boleh membuka rapor diri sendiri. Guru & Admin boleh membuka semua rapor.
    if (viewerRole === 'STUDENT' && currentUserId && s.id !== currentUserId) {
      setPrivacyWarning(`Rapor evaluasi atas nama ${s.name} bersifat privat. Murid hanya dapat membuka rapor miliknya sendiri.`);
      return;
    }
    onSelectStudent?.(s);
  };

  // Urutkan seluruh murid berdasarkan Poin Hebat tertinggi
  const allSortedStudents = [...students].sort(
    (a, b) => Number(b.poin_hebat ?? b.xp ?? 0) - Number(a.poin_hebat ?? a.xp ?? 0)
  );

  // Tambahkan atribut peringkat aktual (actualRank)
  const studentsWithRank = allSortedStudents.map((s, index) => ({
    ...s,
    actualRank: index + 1,
  }));

  // Temukan posisi akun murid saat ini di peringkat sekolah
  const myIndex = currentUserId ? studentsWithRank.findIndex((s) => s.id === currentUserId) : -1;
  const myStudentObj = myIndex !== -1 ? studentsWithRank[myIndex] : null;
  const myActualRank = myStudentObj ? myStudentObj.actualRank : null;

  // Siapkan data yang boleh dilihat sesuai hak akses (viewerRole)
  let visibleStudents: Array<Student & { actualRank: number; isAttachedRow?: boolean }> = [];

  if (viewerRole === 'PUBLIC') {
    // Publik: strictly Top 10 max
    visibleStudents = studentsWithRank.slice(0, 10);
  } else if (viewerRole === 'STUDENT') {
    // Murid: Top 10
    const top10 = studentsWithRank.slice(0, 10);
    if (myStudentObj && myActualRank && myActualRank > 10) {
      // Jika posisi murid di bawah 10, tempelkan di baris ke-11 dengan angka posisi aktualnya
      visibleStudents = [...top10, { ...myStudentObj, isAttachedRow: true }];
    } else {
      visibleStudents = top10;
    }
  } else {
    // Guru / Admin: Seluruh murid
    visibleStudents = studentsWithRank;
  }

  // Filter pencarian dan kelas
  const filtered = visibleStudents.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (!hideNis && (s.nisn || s.nis || '').toLowerCase().includes(searchTerm.toLowerCase())) ||
      s.class_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = classFilter === 'ALL' || s.class_name === classFilter;
    return matchesSearch && matchesClass;
  });

  const isFullAccess = viewerRole === 'TEACHER' || viewerRole === 'ADMIN';
  const displayedStudents = isFullAccess
    ? pageSize === 'all'
      ? filtered
      : filtered.slice(0, Number(pageSize))
    : filtered;

  const top3 = studentsWithRank.slice(0, 3);
  const classes = Array.from(new Set(studentsWithRank.map((s) => s.class_name)));

  return (
    <div className="space-y-6">
      {/* Toast Notifikasi Privasi Murid */}
      {privacyWarning && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between text-xs text-amber-900 shadow-sm animate-pulse">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{privacyWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setPrivacyWarning(null)}
            className="px-2 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded-lg text-[10px] cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Top 3 Podium Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#feb52b]" />
            <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">
              Podium Jawara Utama 7 KAIH
            </h3>
          </div>
          <button
            type="button"
            onClick={triggerCelebration}
            className="btn-interactive inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-xs font-bold text-amber-900 cursor-pointer shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#feb52b]" />
            Rayakan Jawara 28 🎉
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Rank 2 (Left) */}
          {top3[1] && (
            <div
              onClick={() => handleRowClick(top3[1])}
              className={`relative p-5 rounded-2xl border-2 border-[#1c5ddc]/30 bg-gradient-to-b from-blue-50/60 to-white shadow-sm hover:shadow-md transition-all cursor-pointer md:mt-4 ${
                top3[1].id === currentUserId ? 'ring-2 ring-[#1c5ddc]' : ''
              }`}
            >
              <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-black text-[#1c5ddc] text-sm">
                #2
              </div>
              <div className="mb-3">
                <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{top3[1].name}</h4>
                <p className="text-xs text-slate-500 font-medium">
                  {top3[1].class_name}{!hideNis ? ` • NIS ${top3[1].nisn || top3[1].nis}` : ''}
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">Poin Hebat</span>
                <span className="text-lg font-black text-[#1c5ddc]">
                  {top3[1].poin_hebat || top3[1].xp || 0} pt
                </span>
              </div>
            </div>
          )}

          {/* Rank 1 (Center - HEBOH) */}
          {top3[0] && (
            <div
              onClick={() => handleRowClick(top3[0])}
              className={`relative p-5 rounded-2xl border-2 border-[#feb52b] bg-gradient-to-b from-amber-50 via-amber-50/40 to-white shadow-lg ring-2 ring-[#feb52b]/40 hover:shadow-xl transition-all cursor-pointer ${
                top3[0].id === currentUserId ? 'ring-4 ring-[#feb52b]' : ''
              }`}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#feb52b] text-slate-950 font-black text-[11px] shadow-sm flex items-center gap-1 uppercase tracking-wider">
                <Trophy className="w-3 h-3" /> Peringkat 1 Jawara
              </div>
              <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black text-sm shadow-xs">
                #1
              </div>
              <div className="mb-3 mt-1">
                <h4 className="font-extrabold text-slate-900 text-base line-clamp-1">{top3[0].name}</h4>
                <p className="text-xs text-amber-800 font-semibold">
                  {top3[0].class_name}{!hideNis ? ` • NIS ${top3[0].nisn || top3[0].nis}` : ''}
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-amber-200">
                <span className="text-xs text-slate-600 font-medium">Total Poin Hebat</span>
                <span className="text-2xl font-black text-amber-900">
                  {top3[0].poin_hebat || top3[0].xp || 0} pt
                </span>
              </div>
            </div>
          )}

          {/* Rank 3 (Right) */}
          {top3[2] && (
            <div
              onClick={() => handleRowClick(top3[2])}
              className={`relative p-5 rounded-2xl border-2 border-[#fc351c]/30 bg-gradient-to-b from-red-50/60 to-white shadow-sm hover:shadow-md transition-all cursor-pointer md:mt-6 ${
                top3[2].id === currentUserId ? 'ring-2 ring-[#fc351c]' : ''
              }`}
            >
              <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center font-black text-[#fc351c] text-sm">
                #3
              </div>
              <div className="mb-3">
                <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{top3[2].name}</h4>
                <p className="text-xs text-slate-500 font-medium">
                  {top3[2].class_name}{!hideNis ? ` • NIS ${top3[2].nisn || top3[2].nis}` : ''}
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">Poin Hebat</span>
                <span className="text-lg font-black text-[#fc351c]">
                  {top3[2].poin_hebat || top3[2].xp || 0} pt
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard Notice Banner */}
      {!isFullAccess && (
        <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center justify-between text-xs text-blue-950 font-medium">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#1c5ddc] shrink-0" />
            <span>
              {viewerRole === 'PUBLIC'
                ? 'Peringkat Publik menampilkan 10 Besar Jawara 28. Peringkat selanjutnya hanya dapat diakses oleh Guru dan Admin.'
                : `Menampilkan 10 Besar Sekolah. Posisi Anda di sekolah berada di peringkat #${myActualRank || '-'}.`}
            </span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#1c5ddc] bg-white px-2 py-0.5 rounded-md border border-blue-200">
            {viewerRole === 'PUBLIC' ? 'Top 10 Publik' : 'Top 10 & Posisi Saya'}
          </span>
        </div>
      )}

      {/* Controls & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={hideNis ? 'Cari murid berdasarkan nama atau kelas...' : 'Cari murid berdasarkan nama, NIS, atau kelas...'}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#1c5ddc]"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Class Filter */}
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 font-medium"
          >
            <option value="ALL">Semua Kelas</option>
            {classes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Page size limit (Hanya tampil untuk Guru / Admin) */}
          {isFullAccess && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span>Tampilkan:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="px-2.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-800"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value="all">Semuanya</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-16 text-center">Posisi</th>
                <th className="py-3 px-4">Nama Murid</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4 text-center">Total Entri</th>
                <th className="py-3 px-4 text-center">Hari Aktif</th>
                <th className="py-3 px-4 text-right">Poin Hebat</th>
                <th className="py-3 px-4 text-center">Validasi Sekolah</th>
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedStudents.map((s) => {
                const isMe = s.id === currentUserId;
                const isMyClass = highlightClass && s.class_name === highlightClass;
                const canOpenReport = isFullAccess || isMe;
                const isAttached = Boolean(s.isAttachedRow);

                return (
                  <React.Fragment key={s.id}>
                    {/* Visual Separator baris ke-11 jika murid menempel di bawah Top 10 */}
                    {isAttached && (
                      <tr className="bg-blue-50/80 border-t-2 border-b-2 border-dashed border-blue-300">
                        <td colSpan={8} className="py-2 px-4 text-center">
                          <span className="text-[11px] font-black text-[#1c5ddc] inline-flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5" />
                            Peringkat #11 s.d. #{s.actualRank - 1} dirahasiakan • Berikut adalah Posisi Peringkat Anda:
                          </span>
                        </td>
                      </tr>
                    )}

                    <tr
                      onClick={() => handleRowClick(s)}
                      className={`transition-colors ${
                        canOpenReport ? 'hover:bg-slate-50/80 cursor-pointer' : 'hover:bg-slate-50/40 cursor-default'
                      } ${
                        isMe
                          ? 'bg-blue-50/90 font-semibold ring-1 ring-[#1c5ddc]/30'
                          : isMyClass
                          ? 'bg-amber-50/30'
                          : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        {s.actualRank === 1 ? (
                          <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black inline-flex items-center justify-center text-xs">
                            1
                          </span>
                        ) : s.actualRank === 2 ? (
                          <span className="w-6 h-6 rounded-full bg-slate-300 text-slate-900 font-bold inline-flex items-center justify-center text-xs">
                            2
                          </span>
                        ) : s.actualRank === 3 ? (
                          <span className="w-6 h-6 rounded-full bg-amber-700 text-white font-bold inline-flex items-center justify-center text-xs">
                            3
                          </span>
                        ) : (
                          <span className={`font-bold ${isMe ? 'text-[#1c5ddc] font-black text-sm' : 'text-slate-500'}`}>
                            #{s.actualRank}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <span className="font-bold text-slate-900 block">{s.name}</span>
                            {!hideNis && (
                              <span className="text-[10px] text-slate-400">NIS: {s.nisn || s.nis}</span>
                            )}
                          </div>
                          {isMe && (
                            <span className="ml-1 text-[10px] bg-[#1c5ddc] text-white px-2 py-0.5 rounded-full font-black shadow-xs">
                              Saya
                            </span>
                          )}
                          {isMyClass && !isMe && (
                            <span className="ml-1 text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                              Kelas Binaan
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{s.class_name}</td>
                      <td className="py-3 px-4 text-center font-medium text-slate-600">
                        {s.total_entries || 0}
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-slate-600">
                        {s.active_days || 0} hari
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-black text-[#1c5ddc] text-sm">
                          {s.poin_hebat || s.xp || 0}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-0.5">pt</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {s.verification_score !== null && s.verification_score !== undefined ? (
                          s.verification_score < 7 ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full font-black text-[10px] border border-red-200 animate-pulse">
                                <AlertCircle className="w-3 h-3 text-red-600" />
                                Tindak Lanjuti! ({s.verification_score}/10)
                              </span>
                              {canOpenReport ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowClick(s);
                                  }}
                                  className="text-[10px] font-bold text-red-700 underline hover:text-red-900 cursor-pointer"
                                >
                                  Buka Rapor
                                </button>
                              ) : (
                                <span className="text-[9px] text-slate-400 italic">Rapor Privat</span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {s.verification_score}/10
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400 text-[10px]">Belum</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {canOpenReport ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(s);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-[11px] font-bold cursor-pointer inline-flex items-center gap-1"
                            title="Buka Rapor Murid"
                          >
                            <span>Rapor</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-400 bg-slate-100 cursor-default"
                            title="Rapor ini hanya dapat diakses oleh murid bersangkutan & guru/admin"
                          >
                            <Lock className="w-3 h-3 text-slate-400" />
                            Privat
                          </span>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
              {displayedStudents.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Tidak ada murid yang cocok dengan filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
