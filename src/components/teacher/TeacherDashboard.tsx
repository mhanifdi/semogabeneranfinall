/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Heart,
  ShieldCheck,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trophy,
  Calendar,
  Search,
  Award,
  Star,
  RefreshCw,
  Lock,
  Check,
  FileText,
  ChevronRight,
  LogOut,
  Layers,
} from 'lucide-react';
import {
  Teacher,
  Student,
  ClassAnalytics,
  RombelAnalytics,
  SchoolAnalytics,
  HabitStatus,
} from '../../types';
import { api } from '../../utils/api';
import { RadarChart } from '../charts/RadarChart';
import { GaugeChart } from '../charts/GaugeChart';
import { ScoreDistributionBar } from '../charts/ScoreDistributionBar';
import { LeaderboardTable } from '../common/LeaderboardTable';
import { StudentReportModal } from '../common/StudentReportModal';
import { ErrorBoundary } from '../common/ErrorBoundary';

interface TeacherDashboardProps {
  teacher: Teacher;
  allStudents: Student[];
  onLogout: () => void;
  onRefreshStudents?: () => void;
}

type TeacherMenu = 'analitik_kelas' | 'analitik_wali' | 'verifikasi_7kaih' | 'analitik_sekolah';

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  teacher,
  allStudents,
  onLogout,
  onRefreshStudents,
}) => {
  // Roles detection (multi-role support)
  const isWalas = Boolean(
    teacher.is_walas ||
    teacher.roles_csv?.includes('WALAS') ||
    teacher.assignment_type === 'WALAS' ||
    teacher.class_name
  );
  const isWali = Boolean(
    teacher.is_wali ||
    teacher.roles_csv?.includes('WALI') ||
    teacher.assignment_type === 'WALI'
  );
  const isTim7Kaih = Boolean(
    teacher.is_tim_7_kaih ||
    teacher.roles_csv?.includes('TIM_7_KAIH') ||
    teacher.assignment_type === 'TIM_7_KAIH'
  );

  const [activeMenu, setActiveMenu] = useState<TeacherMenu>(() => {
    if (isWalas) return 'analitik_kelas';
    if (isWali) return 'analitik_wali';
    if (isTim7Kaih) return 'verifikasi_7kaih';
    return 'analitik_sekolah';
  });

  const [selectedStudentForReport, setSelectedStudentForReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [classList, setClassList] = useState<string[]>([]);

  // 1. Walas State - Locked to teacher's assigned class per requirement Guru 2
  const [selectedClass, setSelectedClass] = useState<string>(teacher.class_name || '');
  const [walasDate, setWalasDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [walasStatusFilter, setWalasStatusFilter] = useState<'ALL' | HabitStatus>('ALL');
  const [walasTab, setWalasTab] = useState<'monitoring' | 'analitik' | 'leaderboard'>('monitoring');
  const [classData, setClassData] = useState<ClassAnalytics | null>(null);

  // 2. Guru Wali State (No rombel word!)
  const [rombelDays, setRombelDays] = useState<number>(14);
  const [waliTab, setWaliTab] = useState<'murid' | 'analitik'>('murid');
  const [rombelData, setRombelData] = useState<RombelAnalytics | null>(null);

  // 3. Tim 7 KAIH Top 10 Verification State
  const [top10Students, setTop10Students] = useState<Student[]>([]);
  const [verifyingStudent, setVerifyingStudent] = useState<Student | null>(null);
  const [verificationScore, setVerificationScore] = useState<number>(9);
  const [verificationNotes, setVerificationNotes] = useState<string>('Konsisten melaksanakan 7 KAIH dan aktif dalam kegiatan positif sekolah.');
  const [verificationSuccessMsg, setVerificationSuccessMsg] = useState('');

  // 4. School State
  const [schoolData, setSchoolData] = useState<SchoolAnalytics | null>(null);

  // Teacher Password Change State
  const [isPwModalOpen, setIsPwModalOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangeTeacherPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 3) {
      setPwMsg({ text: 'Kata sandi baru minimal 3 karakter.', type: 'error' });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ text: 'Konfirmasi kata sandi tidak cocok.', type: 'error' });
      return;
    }
    setPwLoading(true);
    try {
      const res = await api.changePassword({ currentPassword: currentPw, newPassword: newPw });
      setPwMsg({ text: res.message || 'Kata sandi berhasil diperbarui!', type: 'success' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: any) {
      setPwMsg({ text: err.message || 'Gagal mengubah kata sandi.', type: 'error' });
    } finally {
      setPwLoading(false);
    }
  };

  // Synchronize assigned class
  useEffect(() => {
    if (teacher.class_name) {
      setSelectedClass(teacher.class_name);
    }
  }, [teacher.class_name]);

  // Load Walas Data
  const loadWalasData = async () => {
    if (!selectedClass) return;
    try {
      setLoading(true);
      const data = await api.getClassAnalytics(selectedClass, walasDate);
      setClassData(data);
    } catch (e) {
      console.error('Failed to load class analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isWalas && activeMenu === 'analitik_kelas') {
      loadWalasData();
    }
  }, [selectedClass, walasDate, activeMenu, isWalas]);

  // Load Guru Wali Data
  const loadWaliData = async () => {
    try {
      setLoading(true);
      // Query by teacher's name or assigned rombel/id
      const queryName = teacher.name || teacher.rombel_name || 'Rombel B';
      const data = await api.getRombelAnalytics(queryName, rombelDays);
      setRombelData(data);
    } catch (e) {
      console.error('Failed to load anak wali analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isWali && activeMenu === 'analitik_wali') {
      loadWaliData();
    }
  }, [activeMenu, rombelDays, isWali]);

  // Load Tim 7 KAIH Data (Top 10 Leaderboard)
  const loadTim7KaihData = async () => {
    try {
      const freshList = await api.getStudents().catch(() => allStudents);
      const top = [...freshList].sort((a, b) => (b.poin_hebat || b.xp || 0) - (a.poin_hebat || a.xp || 0)).slice(0, 10);
      setTop10Students(top);
    } catch (e) {
      console.error(e);
      const top = [...allStudents].sort((a, b) => (b.poin_hebat || b.xp || 0) - (a.poin_hebat || a.xp || 0)).slice(0, 10);
      setTop10Students(top);
    }
  };

  useEffect(() => {
    loadTim7KaihData();
  }, [allStudents, activeMenu]);

  // Load School Data
  const loadSchoolData = async () => {
    try {
      const data = await api.getSchoolAnalytics();
      setSchoolData(data);
    } catch (e) {
      console.error('Failed to load school analytics:', e);
    }
  };

  useEffect(() => {
    if (activeMenu === 'analitik_sekolah') {
      loadSchoolData();
    }
  }, [activeMenu]);

  // Handle Tim 7 KAIH Verification Submit
  const handleSaveVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingStudent) return;
    const studentIdToVerify = verifyingStudent.id;
    const finalScore = Number(verificationScore);

    try {
      setLoading(true);
      // Immediately reflect in local state for zero-latency feedback
      setTop10Students((prev) =>
        prev.map((s) => (s.id === studentIdToVerify ? { ...s, verification_score: finalScore } : s))
      );

      await api.saveAdminValidation(
        studentIdToVerify,
        finalScore,
        verificationNotes,
        teacher.id
      );
      setVerificationSuccessMsg(`Berhasil memverifikasi ${verifyingStudent.name} dengan nilai ${finalScore}/10!`);
      setTimeout(() => setVerificationSuccessMsg(''), 4000);
      setVerifyingStudent(null);

      // Re-fetch fresh student data from DB to guarantee absolute synchronization
      const freshList = await api.getStudents();
      const top = [...freshList].sort((a, b) => (b.poin_hebat || b.xp || 0) - (a.poin_hebat || a.xp || 0)).slice(0, 10);
      setTop10Students(top);
      onRefreshStudents?.();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan verifikasi');
      // Revert if error
      loadTim7KaihData();
    } finally {
      setLoading(false);
    }
  };

  const formatRadarData = (items?: any[]) => {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return [
        { habit: 'bangun', label: 'Bangun Pagi', score: 0 },
        { habit: 'ibadah', label: 'Beribadah', score: 0 },
        { habit: 'olahraga', label: 'Berolahraga', score: 0 },
        { habit: 'makan', label: 'Makan Bergizi', score: 0 },
        { habit: 'belajar', label: 'Gemar Belajar', score: 0 },
        { habit: 'masyarakat', label: 'Bermasyarakat', score: 0 },
        { habit: 'tidur', label: 'Tidur Cepat', score: 0 },
      ];
    }
    return items.map((it: any) => ({
      habit: it.habit || it.habit_code || 'kebiasaan',
      label: it.label || it.habit || 'Kebiasaan',
      score: Number(it.score ?? it.avg_score ?? it.average ?? 0),
    }));
  };

  const navItems = [
    {
      id: 'analitik_kelas' as const,
      label: 'Analitik Kelas',
      icon: Users,
      enabled: isWalas,
      desc: isWalas ? `Kelas Binaan: ${selectedClass}` : 'Memerlukan wewenang Wali Kelas (Walas)',
    },
    {
      id: 'analitik_wali' as const,
      label: 'Analitik Anak Wali',
      icon: Heart,
      enabled: isWali,
      desc: isWali ? 'Kelompok Binaan Guru Wali' : 'Memerlukan wewenang Guru Wali',
    },
    {
      id: 'verifikasi_7kaih' as const,
      label: 'Verifikasi 7 KAIH (Top 10)',
      icon: ShieldCheck,
      enabled: isTim7Kaih,
      desc: isTim7Kaih ? 'Verifikasi Integritas 10 Besar' : 'Memerlukan wewenang Tim 7 KAIH',
    },
    {
      id: 'analitik_sekolah' as const,
      label: 'Analitik Sekolah',
      icon: Building2,
      enabled: true,
      desc: 'Pemantauan Karakter Seluruh Murid SMAN 28',
    },
  ];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
        {/* ===================================================================
            LEFT SIDEBAR NAVBAR
        =================================================================== */}
        <aside className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
          {/* Brand Header */}
          <div className="p-5 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#19ae5d] to-[#1c5ddc] text-white flex items-center justify-center font-black text-sm shadow-xs">
                28
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-extrabold text-sm text-slate-900 tracking-tight leading-tight">
                    JAWARA 28
                  </h1>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#1c5ddc] bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                    VERTIKAL
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Jagoan Warga Jakarta SMAN 28 • Panel Guru
                </span>
              </div>
            </div>
          </div>

          {/* Teacher Profile Card */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-base shadow-xs">
                {teacher.name.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <span className="font-extrabold text-xs text-slate-900 block truncate">
                  {teacher.name}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  NIP {teacher.nip || '-'} • {teacher.subject || 'Guru'}
                </span>
              </div>
            </div>

            {/* Role Badges */}
            <div className="mt-2.5 flex flex-wrap gap-1">
              {isWalas && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                  ✓ Walas {teacher.class_name || selectedClass}
                </span>
              )}
              {isWali && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                  ✓ Guru Wali
                </span>
              )}
              {isTim7Kaih && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                  ✓ Tim 7 KAIH
                </span>
              )}
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setPwMsg(null);
                  setCurrentPw('');
                  setNewPw('');
                  setConfirmPw('');
                  setIsPwModalOpen(true);
                }}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <Lock className="w-3 h-3" /> Ubah Kata Sandi
              </button>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1.5 flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 block mb-1">
              Menu Otoritas Guru
            </span>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.id;
              const isEnabled = item.enabled;

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!isEnabled}
                  onClick={() => isEnabled && setActiveMenu(item.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-2xl font-bold text-xs transition-all text-left ${
                    !isEnabled
                      ? 'opacity-40 cursor-not-allowed bg-slate-50/50 text-slate-400'
                      : isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="overflow-hidden flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate">{item.label}</span>
                      {!isEnabled && (
                        <span className="text-[9px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded-md">
                          Nonaktif
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] block font-normal truncate mt-0.5 ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                      {item.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar Sesi Guru</span>
            </button>
          </div>
        </aside>

        {/* ===================================================================
            RIGHT MAIN WORKSPACE
        =================================================================== */}
        <main className="flex-1 p-4 sm:p-8 space-y-6 overflow-y-auto max-w-6xl">
          {/* TAB 1: ANALITIK KELAS (WALI KELAS) */}
          {activeMenu === 'analitik_kelas' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Wali Kelas
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Monitoring &amp; Analitik Kelas {selectedClass}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pantau keterisian 7 kebiasaan dan perkembangan karakter peserta didik kelas binaan Anda.
                  </p>
                </div>

                {/* Class & Date Display - Locked to teacher's assigned class per requirement Guru 2 */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <span>Kelas Binaan:</span>
                    <span className="font-black text-indigo-700">{teacher.class_name || 'Belum Ditugaskan'}</span>
                  </div>
                  <input
                    type="date"
                    value={walasDate}
                    onChange={(e) => setWalasDate(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={loadWalasData}
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 cursor-pointer"
                    title="Segarkan data kelas"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* 4 Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
                  <span className="text-xs font-bold text-slate-500 block">Total Murid Kelas</span>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 block mt-1">
                    {classData?.studentCount ?? 0}
                  </span>
                  <span className="text-[10px] text-slate-400">Kelas {selectedClass}</span>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs">
                  <span className="text-xs font-bold text-emerald-800 block">Selesai (7/7)</span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-700 block mt-1">
                    {classData?.statusSummary?.selesai ?? 0}
                  </span>
                  <span className="text-[10px] text-emerald-700">Lengkap seluruh kebiasaan</span>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl shadow-xs">
                  <span className="text-xs font-bold text-blue-800 block">Sedang Diisi</span>
                  <span className="text-2xl sm:text-3xl font-black text-blue-700 block mt-1">
                    {classData?.statusSummary?.sedangDiisi ?? 0}
                  </span>
                  <span className="text-[10px] text-blue-700">Sebagian kebiasaan terisi</span>
                </div>
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl shadow-xs">
                  <span className="text-xs font-bold text-rose-800 block">Belum Diisi / Terlewat</span>
                  <span className="text-2xl sm:text-3xl font-black text-rose-700 block mt-1">
                    {(classData?.statusSummary?.belumDimulai ?? 0) + (classData?.statusSummary?.terlewat ?? 0)}
                  </span>
                  <span className="text-[10px] text-rose-700">Perlu diingatkan Walas</span>
                </div>
              </div>

              {/* View Switcher: Monitoring / Analitik / Leaderboard */}
              <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
                {[
                  { id: 'monitoring' as const, label: 'Monitoring Keterisian' },
                  { id: 'analitik' as const, label: 'Radar & Distribusi Nilai' },
                  { id: 'leaderboard' as const, label: 'Leaderboard Kelas' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setWalasTab(t.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      walasTab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Sub-view 1: Monitoring Keterisian Table */}
              {walasTab === 'monitoring' && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-xs font-extrabold text-slate-800">
                      Daftar Peserta Didik Kelas {selectedClass} (Tanggal: {walasDate})
                    </span>
                    <div className="flex gap-1.5 overflow-x-auto">
                      {(['ALL', 'Selesai', 'Sedang diisi', 'Belum dimulai'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setWalasStatusFilter(f as any)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                            walasStatusFilter === f
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {f === 'ALL' ? 'Semua' : f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase">
                          <th className="py-3 px-4">Nama Murid</th>
                          <th className="py-3 px-4">Guru Wali</th>
                          <th className="py-3 px-4 text-center">Status Jurnal</th>
                          <th className="py-3 px-4 text-center">Nilai Hari Ini</th>
                          <th className="py-3 px-4 text-center">Rata-rata All-Time</th>
                          <th className="py-3 px-4 text-center">Poin Hebat</th>
                          <th className="py-3 px-4 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {(classData?.students || [])
                          .filter((st) => {
                            if (walasStatusFilter === 'ALL') return true;
                            return st.overallDayStatus === walasStatusFilter;
                          })
                          .map((st) => (
                            <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4 font-bold text-slate-900">
                                <div>{st.name}</div>
                                <span className="text-[10px] text-slate-400 font-normal">NIS: {st.nisn || st.nis}</span>
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                {st.wali_name || st.rombel_name || '-'}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    st.overallDayStatus === 'Selesai'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : st.overallDayStatus === 'Sedang diisi'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {st.overallDayStatus || 'Belum dimulai'} ({st.completedHabitsCount || 0}/7)
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-slate-800">
                                {st.dailyAverageScore || 0}
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-emerald-700">
                                {st.avg_score || st.avgScore || 0}
                              </td>
                              <td className="py-3 px-4 text-center font-black text-amber-600">
                                ⚡ {st.poin_hebat || st.xp || 0}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedStudentForReport(st.id)}
                                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer"
                                >
                                  Lihat Rapor
                                </button>
                              </td>
                            </tr>
                          ))}
                        {(!classData?.students || classData.students.length === 0) && (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                              Tidak ada data murid untuk kelas {selectedClass}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-view 2: Radar & Score Distribution */}
              {walasTab === 'analitik' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
                    <h3 className="font-extrabold text-sm text-slate-900">
                      Radar 7 Kebiasaan Kelas {selectedClass}
                    </h3>
                    <div className="h-64 flex items-center justify-center">
                      <RadarChart
                        data={formatRadarData(classData?.classRadar)}
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
                    <h3 className="font-extrabold text-sm text-slate-900">
                      Rata-rata Skor &amp; Distribusi Nilai
                    </h3>
                    <div className="h-44 flex items-center justify-center">
                      <GaugeChart
                        score={classData?.classAverage || 0}
                        title={`Rata-rata Kelas ${selectedClass}`}
                      />
                    </div>
                    {classData?.distribution && (
                      <div className="pt-2">
                        <ScoreDistributionBar distribution={classData.distribution} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-view 3: Class Leaderboard */}
              {walasTab === 'leaderboard' && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5">
                  <h3 className="font-extrabold text-sm text-slate-900 mb-4">
                    Peringkat Murid Terbaik Kelas {selectedClass}
                  </h3>
                  <div className="max-h-[500px] overflow-y-auto">
                    <LeaderboardTable
                      students={(classData?.students || []).sort(
                        (a, b) => (b.poin_hebat || b.xp || 0) - (a.poin_hebat || a.xp || 0)
                      )}
                      viewerRole="TEACHER"
                      currentUserId={teacher.id}
                      onSelectStudent={(st) => setSelectedStudentForReport(st.id)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ANALITIK ANAK WALI (GURU WALI - ZERO ROMBEL WORD!) */}
          {activeMenu === 'analitik_wali' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full">
                      Guru Wali
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Analitik Anak Wali Binaan — {teacher.name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Monitoring perkembangan karakter dan ketercapaian 7 KAIH anak-anak wali binaan Anda.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">Rentang:</span>
                  <select
                    value={rombelDays}
                    onChange={(e) => setRombelDays(Number(e.target.value))}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value={7}>7 Hari Terakhir</option>
                    <option value={14}>14 Hari Terakhir</option>
                    <option value={30}>30 Hari Terakhir</option>
                  </select>
                  <button
                    type="button"
                    onClick={loadWaliData}
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl shadow-xs">
                  <span className="text-xs font-bold text-purple-800 block">Total Anak Wali</span>
                  <span className="text-3xl font-black text-purple-900 block mt-1">
                    {rombelData?.students?.length ?? 0}
                  </span>
                  <span className="text-[10px] text-purple-700">Dibina oleh {teacher.name}</span>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs">
                  <span className="text-xs font-bold text-emerald-800 block">Rata-rata Skor Binaan</span>
                  <span className="text-3xl font-black text-emerald-700 block mt-1">
                    {rombelData?.rombelAverage ?? rombelData?.classAverage ?? 0}
                  </span>
                  <span className="text-[10px] text-emerald-700">Skala 0 - 100</span>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl shadow-xs">
                  <span className="text-xs font-bold text-blue-800 block">Partisipasi Hari Ini</span>
                  <span className="text-3xl font-black text-blue-700 block mt-1">
                    {rombelData?.participatingToday ?? 0} Murid
                  </span>
                  <span className="text-[10px] text-blue-700">Aktif mengisi jurnal</span>
                </div>
              </div>

              {/* View Switcher: Murid / Analitik */}
              <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
                <button
                  type="button"
                  onClick={() => setWaliTab('murid')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                    waliTab === 'murid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Daftar Anak Wali
                </button>
                <button
                  type="button"
                  onClick={() => setWaliTab('analitik')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                    waliTab === 'analitik' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Grafik Karakter Anak Wali
                </button>
              </div>

              {waliTab === 'murid' && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase">
                        <th className="py-3 px-4">Nama Murid</th>
                        <th className="py-3 px-4">Kelas</th>
                        <th className="py-3 px-4 text-center">Rata-rata All-Time</th>
                        <th className="py-3 px-4 text-center">Poin Hebat</th>
                        <th className="py-3 px-4 text-center">Status Hari Ini</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {(rombelData?.students || []).map((st) => (
                        <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div>{st.name}</div>
                            <span className="text-[10px] text-slate-400 font-normal">NIS: {st.nisn || st.nis}</span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-700">{st.class_name}</td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-700">
                            {st.avg_score || st.avgScore || 0}
                          </td>
                          <td className="py-3 px-4 text-center font-black text-amber-600">
                            ⚡ {st.poin_hebat || st.xp || 0}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              {st.overallDayStatus || 'Belum dimulai'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedStudentForReport(st.id)}
                              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer"
                            >
                              Lihat Rapor
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!rombelData?.students || rombelData.students.length === 0) && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                            Belum ada anak wali yang ditugaskan ke Guru Wali ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {waliTab === 'analitik' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
                    <h3 className="font-extrabold text-sm text-slate-900">
                      Radar Karakter 7 KAIH Anak Wali
                    </h3>
                    <div className="h-64 flex items-center justify-center">
                      <RadarChart
                        data={formatRadarData(rombelData?.rombelRadar || rombelData?.classRadar)}
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
                    <h3 className="font-extrabold text-sm text-slate-900">
                      Rata-rata Skor Keseluruhan
                    </h3>
                    <div className="h-52 flex items-center justify-center">
                      <GaugeChart
                        score={rombelData?.rombelAverage ?? rombelData?.classAverage ?? 0}
                        title="Rata-rata Skor Anak Wali"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VERIFIKASI 7 KAIH TOP 10 (TIM 7 KAIH) */}
          {activeMenu === 'verifikasi_7kaih' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 bg-blue-100 px-2 py-0.5 rounded-full">
                    Otoritas Tim 7 KAIH
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Verifikasi 7 KAIH — Top 10 Leaderboard Sekolah
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verifikasi langsung integritas jurnal harian dan portofolio 10 murid peringkat teratas sekolah (skala penilaian 1 - 10).
                </p>
              </div>

              {verificationSuccessMsg && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{verificationSuccessMsg}</span>
                </div>
              )}

              {/* Inline Verification Modal / Card when a student is selected */}
              {verifyingStudent && (
                <div className="bg-white rounded-3xl p-6 border-2 border-blue-300 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                        Formulir Verifikasi Tim 7 KAIH
                      </span>
                      <h3 className="text-base font-extrabold text-slate-900 mt-1">
                        Verifikasi Nilai: {verifyingStudent.name} ({verifyingStudent.class_name})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Poin Hebat: {verifyingStudent.poin_hebat || verifyingStudent.xp || 0} • Rata-rata All-Time: {verifyingStudent.avg_score || 0}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVerifyingStudent(null)}
                      className="text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>

                  <form onSubmit={handleSaveVerification} className="space-y-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nilai Verifikasi Integritas (Skala 1 - 10):
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        step={1}
                        value={verificationScore}
                        onChange={(e) => setVerificationScore(Math.max(1, Math.min(10, Number(e.target.value))))}
                        className="w-full sm:w-48 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <span className="text-[11px] text-slate-500 block mt-1">
                        Beri nilai 1 hingga 10 berdasarkan portofolio, wawancara, dan observasi nyata kebiasaan.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Catatan &amp; Ulasan Verifikasi Tim 7 KAIH:
                      </label>
                      <textarea
                        value={verificationNotes}
                        onChange={(e) => setVerificationNotes(e.target.value)}
                        rows={3}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Tuliskan catatan verifikasi portofolio dan rekomendasi..."
                        required
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {loading ? 'Menyimpan...' : 'Simpan Nilai Verifikasi'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setVerifyingStudent(null)}
                        className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                      >
                        Tutup
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Simplified Top 10 Table for Guru */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800">
                    10 Murid Peringkat Teratas (Leaderboard SMAN 28 Jakarta)
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Diperbarui real-time
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase">
                        <th className="py-2.5 px-3 text-center w-12">Rank</th>
                        <th className="py-2.5 px-3">Murid &amp; Kelas</th>
                        <th className="py-2.5 px-3 text-center">Poin Hebat</th>
                        <th className="py-2.5 px-3 text-center">Status Verifikasi</th>
                        <th className="py-2.5 px-3 text-center w-28">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {top10Students.map((st, idx) => {
                        const isVerified = Boolean(st.verification_score);
                        return (
                          <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 text-center font-black text-xs text-slate-700">
                              {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-extrabold text-slate-900 leading-tight">{st.name}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Kelas <span className="font-semibold text-slate-700">{st.class_name}</span> • NIS {st.nisn || st.nis}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="font-black text-amber-600">
                                ⚡ {st.poin_hebat || st.xp || 0}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-0.5">pt</span>
                              <div className="text-[9px] text-slate-400">Rata-rata: {st.avg_score || 0}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {isVerified ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  ✓ Nilai {st.verification_score}/10
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                  Belum
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setVerifyingStudent(st);
                                  setVerificationScore(st.verification_score || 9);
                                }}
                                className="w-full py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[10px] font-extrabold cursor-pointer transition-colors"
                              >
                                {isVerified ? 'Edit Nilai' : 'Verifikasi'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ANALITIK SEKOLAH (ACTIVE FOR ALL TEACHERS) */}
          {activeMenu === 'analitik_sekolah' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-slate-900" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full">
                    Analitik Seluruh Sekolah
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Ketercapaian 7 KAIH SMAN 28 Jakarta
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rangkuman makro pembiasaan karakter dan tingkat partisipasi seluruh murid aktif.
                </p>
              </div>

              {/* School KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
                  <span className="text-xs font-bold text-slate-500 block">Total Murid Aktif</span>
                  <span className="text-3xl font-black text-slate-900 block mt-1">
                    {schoolData?.totalActiveStudents ?? allStudents.length}
                  </span>
                  <span className="text-[10px] text-slate-400">Terdaftar di database</span>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs">
                  <span className="text-xs font-bold text-emerald-800 block">Rata-rata Sekolah</span>
                  <span className="text-3xl font-black text-emerald-700 block mt-1">
                    {schoolData?.schoolAverage ?? 0}
                  </span>
                  <span className="text-[10px] text-emerald-700">Skor Karakter 7 KAIH (Aturan Jadwal)</span>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl shadow-xs">
                  <span className="text-xs font-bold text-blue-800 block">Partisipasi Hari Ini</span>
                  <span className="text-3xl font-black text-blue-700 block mt-1">
                    {schoolData?.participatingToday ?? 0} Murid
                  </span>
                  <span className="text-[10px] text-blue-700">Aktif mengisi jurnal</span>
                </div>
              </div>

              {/* School Habits Radar & Grade Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Radar 7 Kebiasaan Tingkat Sekolah
                  </h3>
                  <div className="h-64 flex items-center justify-center">
                    <RadarChart
                      data={formatRadarData(schoolData?.habitRadar || schoolData?.schoolRadar || schoolData?.habitAverages)}
                    />
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Leaderboard Top 10 Sekolah
                  </h3>
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <LeaderboardTable
                      students={allStudents}
                      viewerRole="TEACHER"
                      currentUserId={teacher.id}
                      onSelectStudent={(st) => setSelectedStudentForReport(st.id)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Global Student Report Modal */}
        {selectedStudentForReport && (
          <StudentReportModal
            studentId={selectedStudentForReport}
            onClose={() => setSelectedStudentForReport(null)}
          />
        )}

        {/* Modal Ubah Kata Sandi Guru */}
        {isPwModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      Ubah Kata Sandi Guru
                    </h3>
                    <p className="text-xs text-slate-500">
                      Akun: {teacher.name} (NIP: {teacher.nip || '-'})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPwModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleChangeTeacherPassword} className="space-y-3 pt-2 border-t border-slate-100">
                {pwMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold ${
                      pwMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {pwMsg.text}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kata Sandi Saat Ini:
                  </label>
                  <input
                    type="password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    placeholder="Ketik kata sandi lama..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1c5ddc] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kata Sandi Baru:
                  </label>
                  <input
                    type="password"
                    required
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Minimal 3 karakter..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1c5ddc] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Konfirmasi Kata Sandi Baru:
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Ketik ulang kata sandi baru..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1c5ddc] outline-none"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPwModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={pwLoading}
                    className="flex-1 py-2.5 rounded-xl bg-[#1c5ddc] hover:bg-blue-700 text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {pwLoading ? 'Menyimpan...' : 'Perbarui Sandi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};
