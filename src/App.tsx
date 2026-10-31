/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Student, Teacher } from './types';
import { api } from './utils/api';
import { PublicDashboard } from './components/public/PublicDashboard';
import { LoginPage } from './components/auth/LoginPage';
import { StudentDashboard } from './components/student/StudentDashboard';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { StudentReportModal } from './components/common/StudentReportModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { applyTheme, getSavedTheme } from './config/themeConfig';

type AppView =
  | 'public'
  | 'login'
  | 'admin_login'
  | 'student'
  | 'teacher'
  | 'admin';

export default function App() {
  const getInitialRoute = (): { view: AppView; rememberedUser?: any } => {
    if (typeof window === 'undefined') return { view: 'public' };
    const pathname = window.location.pathname;
    const hash = window.location.hash;

    const isAdmin = pathname === '/admin' || pathname.startsWith('/admin') || hash === '#/admin';
    const isApp = pathname === '/app' || pathname.startsWith('/app') || hash === '#/app';

    try {
      const saved = localStorage.getItem('jawara28_remember_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.token) {
          api.setAuthToken(parsed.token);
        }
        if (isAdmin) {
          if (parsed.role === 'admin' || parsed.data?.assignment_type === 'ADMIN') {
            return { view: 'admin', rememberedUser: parsed.data };
          }
          return { view: 'admin_login' };
        }
        if (isApp) {
          if (parsed.role === 'siswa' || parsed.role === 'murid') return { view: 'student', rememberedUser: parsed.data };
          if (parsed.role === 'guru') return { view: 'teacher', rememberedUser: parsed.data };
          if (parsed.role === 'admin') return { view: 'admin', rememberedUser: parsed.data };
          return { view: 'login' };
        }
      }
    } catch {
      // ignore JSON parse error
    }

    if (isAdmin) return { view: 'admin_login' };
    if (isApp) return { view: 'login' };
    return { view: 'public' };
  };

  const initialInfo = getInitialRoute();
  const [currentView, setCurrentView] = useState<AppView>(initialInfo.view);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  // Active authenticated user
  const [currentStudent, setCurrentStudent] = useState<Student | null>(() =>
    initialInfo.view === 'student' ? initialInfo.rememberedUser : null
  );
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(() =>
    initialInfo.view === 'teacher' ? initialInfo.rememberedUser : null
  );
  const [currentAdmin, setCurrentAdmin] = useState<Teacher | null>(() =>
    initialInfo.view === 'admin' ? initialInfo.rememberedUser : null
  );

  // Global report modal
  const [openedReportStudentId, setOpenedReportStudentId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [stList, tchList] = await Promise.all([
        api.getStudents(),
        api.getTeachers(),
      ]);
      setStudents(stList);
      setTeachers(tchList);

      // Restore or match updated student data from DB
      const savedSession = localStorage.getItem('jawara28_remember_session');
      if (savedSession) {
        try {
          const parsed = JSON.parse(savedSession);
          if ((parsed.role === 'siswa' || parsed.role === 'murid') && parsed.data?.id) {
            const found = stList.find((s) => s.id === parsed.data.id);
            if (found) setCurrentStudent(found);
          } else if (parsed.role === 'guru' && parsed.data?.id) {
            const found = tchList.find((t) => t.id === parsed.data.id);
            if (found) setCurrentTeacher(found);
          } else if (parsed.role === 'admin' && parsed.data?.id) {
            const found = tchList.find((t) => t.id === parsed.data.id);
            if (found) setCurrentAdmin(found);
          }
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.error('Failed to load school data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    applyTheme(getSavedTheme().hex);
    loadData();

    const handlePopState = () => {
      const info = getInitialRoute();
      setCurrentView(info.view);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (view: AppView, path: string) => {
    try {
      window.history.pushState({}, '', path);
    } catch {
      window.location.hash = `#${path}`;
    }
    setCurrentView(view);
  };

  const handleStudentLogin = (s: Student) => {
    setCurrentStudent(s);
    setCurrentView('student');
    try {
      window.history.pushState({}, '', '/app');
    } catch {}
  };

  const handleTeacherLogin = (t: Teacher) => {
    setCurrentTeacher(t);
    setCurrentView('teacher');
    try {
      window.history.pushState({}, '', '/app');
    } catch {}
  };

  const handleAdminLogin = (a: Teacher) => {
    setCurrentAdmin(a);
    setCurrentView('admin');
    try {
      window.history.pushState({}, '', '/admin');
    } catch {}
  };

  const handleLogout = () => {
    localStorage.removeItem('jawara28_remember_session');
    api.setAuthToken('');
    setCurrentStudent(null);
    setCurrentTeacher(null);
    setCurrentAdmin(null);

    if (currentView === 'admin' || window.location.pathname.startsWith('/admin')) {
      navigateTo('admin_login', '/admin');
    } else {
      navigateTo('login', '/app');
    }
    loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-kebaya-pattern flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4 max-w-sm w-full">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1c5ddc] to-[#0000fe] text-white flex items-center justify-center font-black text-xl mx-auto shadow-md">
            28
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              JAWARA 28 <span className="text-[#1c5ddc]">VERTIKAL</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Jagoan Warga Jakarta SMA Negeri 28 Jakarta • 7 KAIH
            </p>
          </div>
          <div className="w-6 h-6 border-2 border-[#1c5ddc] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        {/* VIEW 1: PUBLIC LANDING PAGE ( / ) */}
        {currentView === 'public' && (
          <PublicDashboard
            students={students}
            onGoToLogin={() => navigateTo('login', '/app')}
            onGoToAdmin={() => navigateTo('admin_login', '/admin')}
            onOpenReport={(id) => setOpenedReportStudentId(id)}
          />
        )}

        {/* VIEW 2: PRODUCTION LOGIN ( /app ) */}
        {currentView === 'login' && (
          <LoginPage
            students={students}
            teachers={teachers}
            isAdminLogin={false}
            onLoginStudent={handleStudentLogin}
            onLoginTeacher={handleTeacherLogin}
            onLoginAdmin={handleAdminLogin}
            onSwitchToAdminLogin={() => navigateTo('admin_login', '/admin')}
            onBackToPublic={() => navigateTo('public', '/')}
          />
        )}

        {/* VIEW 3: ADMIN LOGIN ( /admin ) */}
        {currentView === 'admin_login' && (
          <LoginPage
            students={students}
            teachers={teachers}
            isAdminLogin={true}
            onLoginStudent={handleStudentLogin}
            onLoginTeacher={handleTeacherLogin}
            onLoginAdmin={handleAdminLogin}
            onSwitchToMainLogin={() => navigateTo('login', '/app')}
            onBackToPublic={() => navigateTo('public', '/')}
          />
        )}

        {/* VIEW 4: LOGGED IN STUDENT DASHBOARD */}
        {currentView === 'student' && currentStudent && (
          <StudentDashboard
            student={currentStudent}
            allStudents={students}
            onLogout={handleLogout}
            onOpenReport={(id) => setOpenedReportStudentId(id)}
          />
        )}

        {/* VIEW 5: LOGGED IN TEACHER DASHBOARD */}
        {currentView === 'teacher' && currentTeacher && (
          <TeacherDashboard
            teacher={currentTeacher}
            allStudents={students}
            onLogout={handleLogout}
            onRefreshStudents={loadData}
          />
        )}

        {/* VIEW 6: LOGGED IN ADMIN DASHBOARD */}
        {currentView === 'admin' && currentAdmin && (
          <AdminDashboard
            admin={currentAdmin}
            allStudents={students}
            onLogout={handleLogout}
            onRefreshStudents={loadData}
          />
        )}

        {/* Global Student Report Inspection Modal */}
        {openedReportStudentId && (
          <StudentReportModal
            studentId={openedReportStudentId}
            canEditNotes={currentView === 'teacher' || currentView === 'admin'}
            onClose={() => {
              setOpenedReportStudentId(null);
              loadData();
            }}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
