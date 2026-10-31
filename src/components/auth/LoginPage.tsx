/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Lock, User, Shield, GraduationCap, School, AlertCircle, Sparkles } from 'lucide-react';
import { Student, Teacher, Role } from '../../types';
import { api } from '../../utils/api';
import sman28Photo from '../../assets/images/sman28_campus_exterior_1792928761292.jpg';

interface LoginPageProps {
  students: Student[];
  teachers: Teacher[];
  isAdminLogin?: boolean;
  onLoginStudent: (student: Student) => void;
  onLoginTeacher: (teacher: Teacher) => void;
  onLoginAdmin: (admin: Teacher) => void;
  onSwitchToAdminLogin?: () => void;
  onSwitchToMainLogin?: () => void;
  onBackToPublic?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  isAdminLogin = false,
  onLoginStudent,
  onLoginTeacher,
  onLoginAdmin,
  onSwitchToAdminLogin,
  onSwitchToMainLogin,
  onBackToPublic,
}) => {
  const [role, setRole] = useState<'siswa' | 'guru'>('siswa');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setErrorMsg('');
  }, [isAdminLogin]);

  const handleRoleChange = (newRole: 'siswa' | 'guru') => {
    setRole(newRole);
    setErrorMsg('');
  };

  const parseJsonResponse = async (res: Response, fallbackMsg: string) => {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (!res.ok) {
        throw new Error(`Server belum siap atau merespons dengan kode ${res.status}. Silakan coba beberapa saat lagi.`);
      }
      throw new Error('Respons dari server tidak valid (bukan JSON). Silakan coba lagi.');
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || fallbackMsg);
    }
    return data;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isAdminLogin) {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: usernameInput.trim(),
            password: passwordInput.trim(),
          }),
        });
        const json = await parseJsonResponse(res, 'Login Panel Admin gagal');
        if (json.token) {
          api.setAuthToken(json.token);
        }
        if (rememberMe) {
          localStorage.setItem(
            'jawara28_remember_session',
            JSON.stringify({
              role: 'admin',
              data: json.data,
              token: json.token,
              savedAt: Date.now(),
            })
          );
        } else {
          localStorage.removeItem('jawara28_remember_session');
        }
        onLoginAdmin(json.data);
      } else {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role,
            username: usernameInput.trim(),
            password: passwordInput.trim(),
          }),
        });

        const json = await parseJsonResponse(res, 'Login gagal');
        if (json.token) {
          api.setAuthToken(json.token);
        }
        if (rememberMe) {
          localStorage.setItem(
            'jawara28_remember_session',
            JSON.stringify({
              role,
              data: json.data,
              token: json.token,
              savedAt: Date.now(),
            })
          );
        } else {
          localStorage.removeItem('jawara28_remember_session');
        }

        if (role === 'siswa') {
          onLoginStudent(json.data);
        } else {
          onLoginTeacher(json.data);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Username atau Kata Sandi salah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-kebaya-pattern flex items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl border border-slate-200/90 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
        {/* Left Container */}
        <div className="md:col-span-6 p-6 sm:p-10 flex flex-col justify-between bg-white relative">
          <div>
            {onBackToPublic && (
              <button
                type="button"
                onClick={onBackToPublic}
                className="mb-4 text-xs font-bold text-[#1c5ddc] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                ← Kembali ke Beranda Publik
              </button>
            )}

            <div className="mb-5">
              <div className="flex items-center gap-3 mb-2">
                <img src="/logo_sman28.png" alt="Logo SMAN 28 Jakarta" className="w-9 h-9 object-contain" />
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
                        isAdminLogin
                          ? 'bg-slate-900 text-white'
                          : 'text-[#1c5ddc] bg-blue-50'
                      }`}
                    >
                      {isAdminLogin ? 'Panel Pengelola Admin' : 'Portal Masuk Jawara 28'}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#eb30a2]" />
                  </div>
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {isAdminLogin ? (
                  'PANEL PENGELOLA ADMIN'
                ) : (
                  <>
                    JAWARA 28 <span className="text-[#1c5ddc]">VERTIKAL</span>
                  </>
                )}
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {isAdminLogin
                  ? 'Halaman otoritas khusus Administrator untuk manajemen akun, kelas, rombel, database jurnal, dan konfigurasi sistem.'
                  : 'Jagoan Warga Jakarta SMA Negeri 28 Jakarta • 7 Kebiasaan Anak Indonesia Hebat'}
              </p>
            </div>

            {/* Role Switcher ONLY for Main Portal (Murid & Guru) */}
            {!isAdminLogin && (
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl mb-5">
                {[
                  { id: 'siswa' as const, label: 'Murid', icon: GraduationCap },
                  { id: 'guru' as const, label: 'Guru', icon: School },
                ].map((r) => {
                  const Icon = r.icon;
                  const active = role === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleRoleChange(r.id)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        active
                          ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? 'text-[#1c5ddc]' : ''}`} />
                      <span>{r.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isAdminLogin
                    ? 'Username Administrator:'
                    : role === 'siswa'
                    ? 'NIS / Username Murid:'
                    : 'NIP / Username Guru:'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder={
                      isAdminLogin
                        ? 'Ketik username admin...'
                        : role === 'siswa'
                        ? 'Ketik NIS / username murid (admindemo)'
                        : 'Ketik NIP / username guru'
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1c5ddc]"
                    required
                  />
                  <User className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kata Sandi (Password):
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Ketik kata sandi... (juara1)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1c5ddc]"
                    required
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>



              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-slate-600 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#1c5ddc] focus:ring-[#1c5ddc]"
                  />
                  <span>Ingat Sesi Masuk</span>
                </label>
                <span className="text-[11px] text-slate-400">SMAN 28 Jakarta</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`btn-interactive w-full py-3 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-colors cursor-pointer mt-2 disabled:opacity-50 ${
                  isAdminLogin
                    ? 'bg-slate-900 hover:bg-slate-800'
                    : 'bg-[#1c5ddc] hover:bg-blue-700'
                }`}
              >
                {loading
                  ? 'Memverifikasi...'
                  : isAdminLogin
                  ? 'Masuk ke Panel Pengelola Admin'
                  : `Masuk ke Instrumen ${role === 'siswa' ? 'Murid' : 'Guru'}`}
              </button>
            </form>
          </div>

          {/* Clean Footer with Route Switcher between Main Portal and Admin */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>JAWARA 28 (VERTIKAL) • Jagoan Warga Jakarta SMAN 28</span>
            {isAdminLogin ? (
              <button
                type="button"
                onClick={onSwitchToMainLogin}
                className="font-bold text-[#1c5ddc] hover:underline cursor-pointer"
              >
                ← Portal Murid &amp; Guru
              </button>
            ) : (
              <button
                type="button"
                onClick={onSwitchToAdminLogin}
                className="font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5 text-slate-500" />
                <span>Panel Pengelola Admin</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Container: SMAN 28 Photo */}
        <div className="hidden md:block md:col-span-6 relative bg-slate-900 overflow-hidden">
          <img
            src={sman28Photo}
            alt="SMAN 28 Jakarta Modern Campus"
            className="w-full h-full object-cover opacity-90 transition-transform duration-700 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />

          <div className="absolute bottom-8 left-8 right-8 text-white space-y-2">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold border border-white/30">
              <span className="w-2 h-2 rounded-full bg-[#feb52b]" />
              SMAN 28 JAKARTA • SEKOLAH ADIWIYATA MANDIRI
            </div>
            <h3 className="text-xl font-black tracking-tight leading-tight">
              Membangun Generasi Jawara dengan Karakter Luhur &amp; Kebiasaan Hebat.
            </h3>
            <p className="text-xs text-slate-300 font-normal leading-relaxed">
              Jujur, Berwawasan, Tangguh, dan Peduli Sesama melalui implementasi harian 7 Kebiasaan Anak Indonesia Hebat.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
