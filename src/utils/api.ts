/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Student,
  Teacher,
  HabitLog,
  HabitMetricComparison,
  ClassAnalytics,
  RombelAnalytics,
  SchoolAnalytics,
  AktivitasSeruEntry,
  DashboardWidgetConfig,
  DataCorrectionRecord,
} from '../types';

const AUTH_TOKEN_STORAGE_KEY = 'jawara28_auth_token';
let inMemoryAuthToken: string | null = null;

function getStoredToken(): string | null {
  if (inMemoryAuthToken) return inMemoryAuthToken;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const directToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      if (directToken) return directToken;
      const remember = window.localStorage.getItem('jawara28_remember_session');
      if (remember) {
        try {
          const parsed = JSON.parse(remember);
          if (parsed && parsed.token) return parsed.token;
        } catch {
          // ignore parse error
        }
      }
    }
  } catch {
    // ignore storage access errors
  }
  return null;
}

function buildHeaders(includeJsonContentType = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function safeJson<T = any>(res: Response, defaultError = 'Gagal memproses data'): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!res.ok) {
      throw new Error(`Server belum siap atau merespons dengan kesalahan (${res.status}). Silakan muat ulang halaman.`);
    }
    throw new Error('Respon server bukan format JSON yang valid.');
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.message || defaultError);
  }
  return data as T;
}

export const api = {
  setAuthToken(token: string | null) {
    inMemoryAuthToken = token;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (token) {
          window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
        } else {
          window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        }
      }
    } catch {
      // ignore storage access errors
    }
  },

  clearAuthToken() {
    this.setAuthToken(null);
  },

  async getStatus() {
    const res = await fetch('/api/status', { headers: buildHeaders() });
    return safeJson(res);
  },

  async loginAdmin(username: string, password: string) {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify({ username, password }),
    });
    const json = await safeJson(res, 'Login Admin gagal');
    if (json.token) {
      this.setAuthToken(json.token);
    }
    return json;
  },

  async logout() {
    await fetch('/api/logout', {
      method: 'POST',
      headers: buildHeaders(true),
    }).catch(() => {});
    this.clearAuthToken();
  },

  async getTeachers(): Promise<Teacher[]> {
    const res = await fetch('/api/teachers', { headers: buildHeaders() });
    return safeJson<Teacher[]>(res);
  },

  async getStudents(includeArchived = false): Promise<Student[]> {
    const res = await fetch(`/api/students${includeArchived ? '?include_archived=true' : ''}`, {
      headers: buildHeaders(),
    });
    return safeJson<Student[]>(res);
  },

  async getStudent(id: string): Promise<Student> {
    const res = await fetch(`/api/students/${id}`, { headers: buildHeaders() });
    return safeJson<Student>(res);
  },

  async getTodayHabits(studentId: string, date?: string): Promise<{
    date: string;
    student_id: string;
    logs: HabitLog[];
    habitsByType: Record<string, HabitLog[]>;
    totalToday: number;
    dailyEval?: any;
    aktivitasSeru?: AktivitasSeruEntry | null;
  }> {
    const url = `/api/habits/today?student_id=${studentId}${date ? `&date=${date}` : ''}`;
    const res = await fetch(url, { headers: buildHeaders() });
    return res.json();
  },

  async getCalendarSummary(studentId: string, days = 14): Promise<{
    student_id: string;
    startDate?: string;
    endDate?: string;
    hasAnyMissed: boolean;
    dates: {
      date: string;
      dayName: string;
      formattedDate: string;
      completedCount: number;
      missingCount: number;
      isComplete: boolean;
      isFuture?: boolean;
      isToday?: boolean;
      isPast?: boolean;
      calendarCardStatus?: string;
      overallDayStatus?: string;
      habitStatuses?: Record<string, string>;
      habitsDone: string[];
      missingHabits: string[];
      dailyScore: number;
      scoresByHabit?: Record<string, number>;
    }[];
  }> {
    const res = await fetch(`/api/habits/calendar-summary?student_id=${studentId}&days=${days}`, {
      headers: buildHeaders(),
    });
    return res.json();
  },

  async getStudentProgress(studentId: string, days = 14): Promise<{
    student_id: string;
    days: number;
    series: {
      dayIndex: number;
      date: string;
      label: string;
      fullLabel: string;
      bangun: number;
      ibadah: number;
      olahraga: number;
      makan: number;
      belajar: number;
      masyarakat: number;
      tidur: number;
      rataRata: number;
      completedCount: number;
      status: string;
    }[];
  }> {
    const res = await fetch(`/api/student/${studentId}/progress?days=${days}`, {
      headers: buildHeaders(),
    });
    return res.json();
  },

  async getStudentHabitAnswers(studentId: string, date?: string, habitCode?: string): Promise<{
    student_id: string;
    date?: string;
    habit_code?: string;
    answers: Array<{
      id: number;
      student_id: string;
      log_date: string;
      habit_code: string;
      question_key: string;
      question_label: string;
      answer_value: string;
      score_earned: number;
      created_at: string;
    }>;
  }> {
    const params = new URLSearchParams();
    params.set('student_id', studentId);
    if (date) params.set('date', date);
    if (habitCode) params.set('habit_code', habitCode);
    const res = await fetch(`/api/student/habit-answers?${params.toString()}`, {
      headers: buildHeaders(),
    });
    return safeJson(res);
  },

  async submitHabit(data: {
    student_id: string;
    habit_type: string;
    score: number;
    base_score?: number;
    bonus_score?: number;
    overflow_bonus_points?: number;
    payload: any;
    sub_category?: string;
    is_counter_entry?: number;
    is_missed?: number;
    log_date?: string;
    overwrite?: boolean;
  }) {
    const res = await fetch('/api/habits', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Gagal mencatat kebiasaan' }));
      throw new Error(err.error || 'Gagal mencatat');
    }
    return res.json();
  },

  async resetHabitOnDate(studentId: string, habitType: string, date?: string) {
    const url = `/api/habits/reset?student_id=${studentId}&habit_type=${habitType}${date ? `&date=${date}` : ''}`;
    const res = await fetch(url, { method: 'DELETE', headers: buildHeaders() });
    return res.json();
  },

  async resetHabitForDate(studentId: string, habitType: string, date?: string) {
    return this.resetHabitOnDate(studentId, habitType, date);
  },

  async getAktivitasSeru(studentId: string, date?: string): Promise<AktivitasSeruEntry[]> {
    const url = `/api/aktivitas-seru?student_id=${studentId}${date ? `&date=${date}` : ''}`;
    const res = await fetch(url, { headers: buildHeaders() });
    return res.json();
  },

  async submitAktivitasSeru(data: {
    student_id: string;
    habit_type: string;
    story?: string;
    story_text?: string;
    log_date?: string;
    activity_title?: string;
  }) {
    const payload = {
      ...data,
      story: data.story || data.story_text || '',
    };
    const res = await fetch('/api/aktivitas-seru', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Gagal menyimpan cerita Aktivitas Seru' }));
      throw new Error(err.error || 'Gagal menyimpan');
    }
    return res.json();
  },

  async getStudentReport(id: string): Promise<{
    student: Student;
    habitMetrics: HabitMetricComparison[];
    overallScore: number;
    poinHebat?: number;
    totalEntries: number;
    streak?: number;
    activeDays?: number;
    verification_score?: number | null;
    recentLogs: HabitLog[];
  }> {
    const res = await fetch(`/api/student/${id}/report`, { headers: buildHeaders() });
    return res.json();
  },

  async getClassAnalytics(className: string, date?: string): Promise<ClassAnalytics & {
    filterDate?: string;
    statusSummary?: { selesai: number; sedangDiisi: number; belumDimulai: number; terlewat: number };
  }> {
    const url = `/api/class/${encodeURIComponent(className)}/analytics${date ? `?date=${date}` : ''}`;
    const res = await fetch(url, { headers: buildHeaders() });
    return res.json();
  },

  async getRombelAnalytics(rombelName: string, days = 14): Promise<RombelAnalytics> {
    const res = await fetch(`/api/rombel/${encodeURIComponent(rombelName)}/analytics?days=${days}`, {
      headers: buildHeaders(),
    });
    return res.json();
  },

  async getSchoolAnalytics(): Promise<SchoolAnalytics & {
    rombels?: string[];
    cohorts?: { cohortName: string; studentCount: number; participatingCount: number; avgScore: number }[];
  }> {
    const res = await fetch('/api/school/analytics', { headers: buildHeaders() });
    return safeJson(res);
  },

  async saveAdminValidation(
    dataOrStudentId:
      | {
          student_id: string;
          verification_score: number;
          verified_by?: string;
          notes?: string;
        }
      | string,
    verification_score?: number,
    notes?: string,
    verified_by?: string
  ) {
    const payload =
      typeof dataOrStudentId === 'string'
        ? {
            student_id: dataOrStudentId,
            verification_score: verification_score || 0,
            notes,
            verified_by,
          }
        : dataOrStudentId;
    const res = await fetch('/api/admin/validate', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async saveTeacherNotes(data: {
    student_id: string;
    walas_notes: string;
    walas_recommendation: string;
  }) {
    const res = await fetch('/api/teacher/notes', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getAdminValidationsSummary(): Promise<{
    totalCount: number;
    avgScore: number;
    distribution: Record<number, number>;
    validations: any[];
  }> {
    const res = await fetch('/api/admin/validations-summary', { headers: buildHeaders() });
    return res.json();
  },

  // ============================================================================
  // CONTROL PANEL ADMIN API METHODS
  // ============================================================================
  async getAdminOverview() {
    const res = await fetch('/api/admin/overview', { headers: buildHeaders() });
    return res.json();
  },

  async saveAdminStudent(studentData: any) {
    const res = await fetch('/api/admin/students', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(studentData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Gagal menyimpan akun siswa' }));
      throw new Error(err.error || 'Gagal menyimpan');
    }
    return res.json();
  },

  async deleteAdminStudent(studentId: string, mode: 'ARCHIVE' | 'INACTIVE' | 'DELETE' = 'DELETE') {
    const res = await fetch(`/api/admin/students/${studentId}?mode=${mode}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    return safeJson(res);
  },

  async saveAdminTeacher(teacherData: any) {
    const res = await fetch('/api/admin/teachers', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(teacherData),
    });
    return safeJson(res, 'Gagal menyimpan akun guru');
  },

  async deleteAdminTeacher(teacherId: string) {
    const res = await fetch(`/api/admin/teachers/${teacherId}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    return safeJson(res);
  },

  async getAdminAccounts() {
    const res = await fetch('/api/admin/admins', { headers: buildHeaders() });
    return safeJson<any[]>(res);
  },

  async saveAdminAccount(data: any) {
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Gagal menyimpan akun admin');
  },

  async deleteAdminAccount(adminId: string) {
    const res = await fetch(`/api/admin/admins/${adminId}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    return safeJson(res);
  },

  async getAdminStudents(includeArchived = false) {
    return this.getStudents(includeArchived);
  },

  async getAdminTeachers() {
    return this.getTeachers();
  },

  async getAdminClassesRombels() {
    return this.getAdminClassesAndRombels();
  },

  async getAdminClassesAndRombels() {
    const res = await fetch('/api/admin/classes-rombels', { headers: buildHeaders() });
    return res.json();
  },

  async saveAdminClass(classData: any) {
    const res = await fetch('/api/admin/classes', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(classData),
    });
    return res.json();
  },

  async saveAdminRombel(rombelData: any) {
    const res = await fetch('/api/admin/rombels', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(rombelData),
    });
    return res.json();
  },

  async moveStudentGroup(
    student_id_or_obj: string | { student_id: string; target_type?: 'CLASS' | 'ROMBEL'; new_group_name?: string; target_class_name?: string; target_rombel_name?: string; actor_name?: string },
    target_class_name?: string,
    target_rombel_name?: string
  ) {
    let payload: any = {};
    if (typeof student_id_or_obj === 'object') {
      const { student_id, target_type, new_group_name, ...rest } = student_id_or_obj;
      payload = {
        student_id,
        target_class_name: target_type === 'CLASS' ? new_group_name : (student_id_or_obj.target_class_name || ''),
        target_rombel_name: target_type === 'ROMBEL' ? new_group_name : (student_id_or_obj.target_rombel_name || ''),
        ...rest,
      };
    } else {
      payload = { student_id: student_id_or_obj, target_class_name, target_rombel_name };
    }
    const res = await fetch('/api/admin/move-student-group', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async getAdminJournals(filters: {
    student_id?: string;
    class_name?: string;
    rombel_name?: string;
    habit_type?: string;
    date_from?: string;
    date_to?: string;
  } = {}): Promise<{ logs: any[]; corrections: DataCorrectionRecord[]; journals?: any[] }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const res = await fetch(`/api/admin/journals?${params.toString()}`, {
      headers: buildHeaders(),
    });
    const data = await res.json();
    return {
      ...data,
      journals: data?.journals || data?.logs || [],
    };
  },

  async correctAdminJournal(data: {
    log_id?: number;
    student_id?: string;
    log_date?: string;
    habit_type?: string;
    sub_category?: string;
    new_score: number;
    new_base_score?: number;
    new_bonus_score?: number;
    new_payload?: any;
    reason: string;
    actor_name?: string;
    corrected_by?: string;
  }) {
    const res = await fetch('/api/admin/journals/correct', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Gagal menyimpan koreksi jurnal' }));
      throw new Error(err.error || 'Gagal menyimpan koreksi');
    }
    return res.json();
  },

  async getDashboardWidgets(): Promise<DashboardWidgetConfig[]> {
    const res = await fetch('/api/dashboard-widgets', { headers: buildHeaders() });
    return res.json();
  },

  async saveDashboardWidget(widget: Partial<DashboardWidgetConfig>) {
    const res = await fetch('/api/admin/dashboard-widgets', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(widget),
    });
    return res.json();
  },

  async getGlobalSettings() {
    const res = await fetch('/api/settings', { headers: buildHeaders() });
    return res.json();
  },

  async saveGlobalSettings(data: { settings?: Record<string, string>; prayerSchedule?: any; actor_name?: string }) {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async importAdminStudents(rows: any[], actorName?: string) {
    const res = await fetch('/api/admin/import-students', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify({ rows, actor_name: actorName }),
    });
    return res.json();
  },

  async getTodayInfo(): Promise<{ todayDate: string; isSimulated: boolean; timeZone: string }> {
    const res = await fetch('/api/today', { headers: buildHeaders() });
    return safeJson(res);
  },

  async getAnnouncements(): Promise<any[]> {
    const res = await fetch('/api/announcements', { headers: buildHeaders() });
    return res.json();
  },

  async saveAnnouncement(data: { id?: string; type: 'ANNOUNCEMENT' | 'QUOTE'; title: string; content: string; author?: string }) {
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal menyimpan pengumuman');
    return json;
  },

  async deleteAnnouncement(id: string) {
    const res = await fetch(`/api/admin/announcements/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal menghapus pengumuman');
    return json;
  },

  async getAktivitasSeruSummary(date?: string): Promise<{ date: string; count: number }> {
    const res = await fetch(`/api/aktivitas-seru/summary${date ? `?date=${date}` : ''}`, { headers: buildHeaders() });
    return res.json();
  },

  async adminNextDay(): Promise<{ status: string; todayDate: string; message: string }> {
    const res = await fetch('/api/admin/demo/next-day', {
      method: 'POST',
      headers: buildHeaders(true),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal memajukan tanggal');
    return json;
  },

  async adminSetDate(date: string): Promise<{ status: string; todayDate: string; message: string }> {
    const res = await fetch('/api/admin/demo/set-date', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify({ date }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal mengatur tanggal');
    return json;
  },

  async adminResetDate(): Promise<{ status: string; todayDate: string; message: string }> {
    const res = await fetch('/api/admin/demo/reset-date', {
      method: 'POST',
      headers: buildHeaders(true),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal mereset tanggal');
    return json;
  },

  async adminFillAll100(studentId: string, date?: string): Promise<{ status: string; message: string }> {
    const res = await fetch('/api/admin/demo/fill-all-100', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify({ student_id: studentId, date }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal mengisi instan');
    return json;
  },

  async adminClearDemo(studentId?: string, date?: string): Promise<{ status: string; message: string }> {
    const res = await fetch('/api/admin/demo/clear-demo', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify({ student_id: studentId, date }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal membersihkan data demo');
    return json;
  },

  async getDataCollectionPeriod(): Promise<{
    startDate: string;
    endDate: string;
    endOfDayTime?: string;
    isActive: boolean;
    todayDate: string;
    isInPeriod: boolean;
    isBeforeStart: boolean;
    isAfterEnd: boolean;
    message: string;
  }> {
    const res = await fetch('/api/data-collection-period', { headers: buildHeaders() });
    return res.json();
  },

  async saveDataCollectionPeriod(
    dataOrStart: { startDate: string; endDate: string; endOfDayTime?: string; isActive?: boolean } | string,
    endDate?: string
  ): Promise<{ status: string; startDate: string; endDate: string; endOfDayTime?: string; isActive: boolean }> {
    const payload =
      typeof dataOrStart === 'string'
        ? { startDate: dataOrStart, endDate: endDate || dataOrStart }
        : dataOrStart;
    const res = await fetch('/api/admin/data-collection-period', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal menyimpan periode pengambilan data');
    return json;
  },

  async getInstruments(habitCode?: string): Promise<any[]> {
    const url = `/api/instruments${habitCode ? `?habit_code=${encodeURIComponent(habitCode)}` : ''}`;
    const res = await fetch(url, { headers: buildHeaders() });
    return res.json();
  },

  async saveInstrument(instrument: any): Promise<{ status: string; id: string }> {
    const res = await fetch('/api/admin/instruments', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(instrument),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal menyimpan instrumen');
    return json;
  },

  async getClasses(): Promise<any[]> {
    const res = await this.getAdminClassesAndRombels();
    return res?.classes || [];
  },

  async nextDayDemo(): Promise<{ status: string; date: string; message: string }> {
    const res = await this.adminNextDay();
    return { ...res, date: res.todayDate };
  },

  async setDemoDate(date: string): Promise<{ status: string; date: string; message: string }> {
    const res = await this.adminSetDate(date);
    return { ...res, date: res.todayDate };
  },

  async fillAll100Demo(studentId?: string, date?: string): Promise<{ status: string; message: string }> {
    return this.adminFillAll100(studentId || 'std-siswa', date);
  },

  async resetDemoData(): Promise<{ status: string; todayDate: string; message: string }> {
    return this.adminResetDate();
  },

  async deleteInstrument(id: string | number): Promise<{ status: string; id: string }> {
    const res = await fetch(`/api/admin/instruments/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Gagal menghapus instrumen');
    return json;
  },

  async deleteClass(id: string | number): Promise<{ status: string }> {
    const res = await fetch(`/api/admin/classes/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    return safeJson(res, 'Gagal menghapus kelas');
  },

  async deleteRombel(id: string | number): Promise<{ status: string }> {
    const res = await fetch(`/api/admin/rombels/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    return safeJson(res, 'Gagal menghapus kelompok wali');
  },

  async assignWalasToClass(classId: string, teacherId: string): Promise<any> {
    const res = await fetch(`/api/admin/classes/${encodeURIComponent(classId)}/assign-walas`, {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify({ teacher_id: teacherId }),
    });
    return safeJson(res);
  },

  async unassignWalasFromClass(classId: string): Promise<any> {
    const res = await fetch(`/api/admin/classes/${encodeURIComponent(classId)}/unassign-walas`, {
      method: 'POST',
      headers: buildHeaders(),
    });
    return safeJson(res);
  },

  async assignGuruWali(teacherId: string): Promise<any> {
    const res = await fetch(`/api/admin/teachers/${encodeURIComponent(teacherId)}/assign-guru-wali`, {
      method: 'POST',
      headers: buildHeaders(),
    });
    return safeJson(res);
  },

  async getCohorts(): Promise<any[]> {
    const res = await fetch('/api/admin/cohorts', { headers: buildHeaders() });
    return safeJson(res);
  },

  async updateCohort(cohortId: string, name: string): Promise<any> {
    const res = await fetch(`/api/admin/cohorts/${encodeURIComponent(cohortId)}`, {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify({ name }),
    });
    return safeJson(res);
  },

  async getAuditLogs(limit = 100): Promise<any[]> {
    const res = await fetch(`/api/admin/audit-logs?limit=${limit}`, { headers: buildHeaders() });
    return safeJson(res);
  },

  async getDatabaseTables(): Promise<string[]> {
    const res = await fetch('/api/admin/tables', { headers: buildHeaders() });
    return safeJson(res);
  },

  async getTableData(tableName: string, limit = 100, offset = 0): Promise<{
    tableName: string;
    totalRows: number;
    columns: Array<{ name: string; type: string; pk: boolean; notnull: boolean }>;
    rows: any[];
    limit: number;
    offset: number;
  }> {
    const res = await fetch(`/api/admin/table-data?table_name=${encodeURIComponent(tableName)}&limit=${limit}&offset=${offset}`, {
      headers: buildHeaders(),
    });
    return safeJson(res);
  },

  async changePassword(data: { currentPassword?: string; newPassword: string }): Promise<{ status: string; message: string }> {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    return safeJson(res);
  },

  async getPopups(): Promise<any[]> {
    const res = await fetch('/api/popups', { headers: buildHeaders() });
    return safeJson(res);
  },

  async savePopup(data: { id: string; habit_code: string; trigger_condition: string; title: string; quote_text: string }): Promise<any> {
    const res = await fetch('/api/admin/popups', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    return safeJson(res);
  },

  async deletePopup(id: string): Promise<any> {
    const res = await fetch(`/api/admin/popups/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    });
    return safeJson(res);
  },

  async getAchievementRubric(): Promise<any[]> {
    const res = await fetch('/api/achievements/rubric', { headers: buildHeaders() });
    return safeJson(res);
  },

  async saveAchievementRubric(rubric: any[]): Promise<any> {
    const res = await fetch('/api/admin/achievements/rubric', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify({ rubric }),
    });
    return safeJson(res);
  },

  async getMyAchievements(studentId?: string): Promise<any[]> {
    const url = `/api/achievements/my${studentId ? `?student_id=${encodeURIComponent(studentId)}` : ''}`;
    const res = await fetch(url, { headers: buildHeaders() });
    return safeJson(res);
  },

  async submitAchievement(data: {
    student_id?: string;
    achievement_name?: string;
    achievement_type?: string;
    level?: string;
    participation_category?: string;
    event_date?: string;
    achievement_rank?: string;
    story?: string;
    certificate_url?: string;
    nama_prestasi?: string;
    jenis_prestasi?: string;
    jenjang?: string;
    kategori?: string;
    tanggal?: string;
    pencapaian?: string;
    cerita?: string;
    bukti_url?: string;
    [key: string]: any;
  }): Promise<any> {
    const res = await fetch('/api/achievements/submit', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    return safeJson(res, 'Gagal mengajukan prestasi');
  },

  async getAdminAchievements(status?: string): Promise<any[]> {
    const url = `/api/admin/achievements${status ? `?status=${encodeURIComponent(status)}` : ''}`;
    const res = await fetch(url, { headers: buildHeaders() });
    return safeJson(res);
  },

  async validateAchievement(id: string, data: {
    status: 'APPROVED' | 'REJECTED' | 'approved' | 'rejected';
    points_awarded?: number;
    admin_notes?: string;
    [key: string]: any;
  }): Promise<any> {
    const res = await fetch(`/api/admin/achievements/${encodeURIComponent(id)}/validate`, {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify({
        ...data,
        status: data.status.toUpperCase() as 'APPROVED' | 'REJECTED',
      }),
    });
    return safeJson(res, 'Gagal memvalidasi prestasi');
  },

  async resetInstruments(): Promise<any> {
    const res = await fetch('/api/admin/instruments/reset', {
      method: 'POST',
      headers: buildHeaders(),
    });
    return safeJson(res);
  },

  async importData(data: { students?: any[]; teachers?: any[]; classes?: any[] }): Promise<any> {
    const res = await fetch('/api/admin/import-data', {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify(data),
    });
    return safeJson(res);
  },
};
