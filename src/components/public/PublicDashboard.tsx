/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Sun,
  Heart,
  Activity,
  Utensils,
  GraduationCap,
  Users,
  Moon,
  Trophy,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  School,
  Clock,
  BookOpen,
} from 'lucide-react';
import { Student } from '../../types';
import { api } from '../../utils/api';
import { LeaderboardTable } from '../common/LeaderboardTable';
import sman28Photo from '../../assets/images/sman28_campus_exterior_1792928761292.jpg';

interface PublicDashboardProps {
  students: Student[];
  onGoToLogin: () => void;
  onGoToAdmin?: () => void;
  onOpenReport?: (studentId: string) => void;
}

export const PublicDashboard: React.FC<PublicDashboardProps> = ({
  students,
  onGoToLogin,
  onGoToAdmin,
  onOpenReport,
}) => {
  const [schoolStats, setSchoolStats] = useState<any>(null);

  useEffect(() => {
    api.getSchoolAnalytics().then(setSchoolStats).catch(console.error);
  }, []);

  const HABITS = [
    {
      title: 'Bangun Pagi',
      time: '04.00 – 06.00 WIB',
      icon: Sun,
      color: '#1c5ddc',
      bg: 'bg-blue-50',
      desc: 'Memulai hari dengan kesiapan jiwa, ibadah fajar, dan energi positif.',
    },
    {
      title: 'Beribadah',
      time: 'Tepat Waktu & Khusyuk',
      icon: Heart,
      color: '#19ae5d',
      bg: 'bg-emerald-50',
      desc: 'Shalat 5 waktu & tadarus Al-Qur’an / Doa Harian / Tri Sandhya.',
    },
    {
      title: 'Berolahraga',
      time: '15 – 60 Menit',
      icon: Activity,
      color: '#fc351c',
      bg: 'bg-red-50',
      desc: 'Menjaga kebugaran jasmani, peregangan aktif, dan kesehatan jantung.',
    },
    {
      title: 'Makan Bergizi',
      time: 'Isi Piringku & Air',
      icon: Utensils,
      color: '#feb52b',
      bg: 'bg-amber-50',
      desc: 'Komposisi karbohidrat, lauk, sayur-sayuran, buah, dan air minum ideal.',
    },
    {
      title: 'Gemar Belajar',
      time: 'Mandiri & Terstruktur',
      icon: GraduationCap,
      color: '#0000fe',
      bg: 'bg-indigo-50',
      desc: 'Mengulang materi pelajaran, literasi buku, dan pendalaman keilmuan.',
    },
    {
      title: 'Bermasyarakat',
      time: 'Aksi Nyata & Peduli',
      icon: Users,
      color: '#19ae5d',
      bg: 'bg-emerald-50',
      desc: 'Piket kelas, gotong royong, kegiatan Adiwiyata, dan kebaikan acak.',
    },
    {
      title: 'Tidur Cepat',
      time: 'Sebelum 22.30 WIB',
      icon: Moon,
      color: '#1c5ddc',
      bg: 'bg-indigo-50',
      desc: 'Memulihkan energi tubuh, mematikan lampu, dan tidur berkualitas.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1c5ddc] via-[#feb52b] to-[#fc351c] flex items-center justify-center shadow-md">
              <School className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-slate-900 tracking-tight text-base sm:text-lg">
                  JAWARA 28 <span className="text-[#1c5ddc]">VERTIKAL</span>
                </span>
                <span className="hidden sm:inline-block text-[10px] bg-red-100 text-[#fc351c] font-black px-1.5 py-0.5 rounded uppercase">
                  BETAWI 28
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Jagoan Warga Jakarta SMA Negeri 28 Jakarta • 7 KAIH
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onGoToLogin}
              className="btn-interactive px-4 py-2 bg-[#1c5ddc] hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span>Masuk Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-8 pt-8 pb-10">
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-sm relative overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200/80 px-3.5 py-1.5 rounded-full text-xs font-bold text-[#1c5ddc]">
              <Sparkles className="w-3.5 h-3.5 text-[#feb52b]" />
              Sistem Pemantauan Karakter Murid Terpadu
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Membentuk Insan Unggul Melalui{' '}
              <span className="text-[#1c5ddc]">7 Kebiasaan</span> Anak Indonesia Hebat
            </h1>

            <p className="text-sm sm:text-base text-slate-600 font-normal leading-relaxed max-w-2xl">
              SMAN 28 Jakarta mengintegrasikan pelaporan mandiri teratur, pendampingan wali kelas, dan validasi observasi sekolah nyata untuk menumbuhkan keteladanan harian murid.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={onGoToLogin}
                className="btn-interactive px-6 py-3 bg-[#1c5ddc] hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-md cursor-pointer flex items-center gap-2"
              >
                <span>Mulai Catat Kebiasaan Hari Ini</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 relative rounded-2xl overflow-hidden shadow-lg border border-slate-200 max-h-[320px]">
            <img
              src={sman28Photo}
              alt="SMA Negeri 28 Jakarta"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-4">
              <div className="text-white text-xs">
                <span className="font-black block">SMA Negeri 28 Jakarta</span>
                <span className="text-slate-300 text-[11px]">Pasar Minggu, Jakarta Selatan</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Aggregate Public Metrics */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-8 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center shadow-xs">
            <span className="text-xs text-slate-500 font-semibold block">Total Murid Terdaftar</span>
            <span className="text-3xl font-black text-[#1c5ddc] my-1 block">
              {students.length}
            </span>
            <span className="text-[11px] text-slate-400">Lintas Jenjang X, XI, dan XII</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center shadow-xs">
            <span className="text-xs text-slate-500 font-semibold block">Rata-Rata Indeks Karakter</span>
            <span className="text-3xl font-black text-[#19ae5d] my-1 block">
              {schoolStats?.overallScore ? `${schoolStats.overallScore}%` : '0%'}
            </span>
            <span className="text-[11px] text-slate-400">Capaian 7 KAIH SMAN 28 Jakarta</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 text-center shadow-xs">
            <span className="text-xs text-slate-500 font-semibold block">Murid Tervalidasi Sekolah</span>
            <span className="text-3xl font-black text-[#feb52b] my-1 block">
              {students.filter((s) => s.verification_score).length}
            </span>
            <span className="text-[11px] text-slate-400">Verifikasi Faktual Guru &amp; Admin</span>
          </div>
        </div>
      </section>

      {/* 7 KAIH Pillar Cards */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-8 pb-12 space-y-6">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-[#1c5ddc]">
            Indikator Utama
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            7 Pilar Kebiasaan Anak Indonesia Hebat
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Panduan baku dan penilaian terukur untuk membangun kebiasaan positif setiap hari.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {HABITS.map((h) => {
            const Icon = h.icon;
            return (
              <div
                key={h.title}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-[#1c5ddc] transition-all space-y-2"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: h.color }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h4 className="font-extrabold text-slate-900 text-base">{h.title}</h4>
                <span className="inline-block text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                  {h.time}
                </span>
                <p className="text-xs text-slate-500 leading-relaxed">{h.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Leaderboard Top 10 Publik */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-8 pb-16 space-y-6">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[#feb52b]">
                Papan Kehormatan Publik
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Top 10 Jawara Pembiasaan 28
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Peringkat 10 besar murid teladan berdasarkan akumulasi Poin Hebat 7 KAIH. Peringkat selanjutnya hanya dapat diakses oleh Guru dan Admin.
              </p>
            </div>
            <button
              type="button"
              onClick={onGoToLogin}
              className="text-xs font-bold text-[#1c5ddc] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              Masuk Portal Murid / Guru →
            </button>
          </div>

          <LeaderboardTable
            students={students}
            hideNis={true}
            viewerRole="PUBLIC"
            onSelectStudent={(st) => onOpenReport?.(st.id)}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 px-4 sm:px-8 text-center text-xs text-slate-500">
        <p className="font-semibold text-slate-700">
          JAWARA 28 (VERTIKAL) — Jagoan Warga Jakarta SMA Negeri 28 Jakarta
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          7 Kebiasaan Anak Indonesia Hebat • Sekolah Adiwiyata Mandiri
        </p>
      </footer>
    </div>
  );
};
