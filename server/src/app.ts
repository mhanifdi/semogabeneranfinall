/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modular Application Router & Request Dispatcher — VERTIKAL SMA JAWARA 28
 *
 * Provides:
 * 1. `JawaraApplication` with `dispatch(req)` for zero-overhead HTTP & integration test routing.
 * 2. `mountOnExpress(expressApp, jawaraApp)` for Express integration in `server.ts`.
 */

import { RelationalDatabase, getDb } from './database/client.ts';
import { AuthService } from './modules/auth/auth.service.ts';
import { JournalsService } from './modules/journals/journals.service.ts';
import { UsersAcademicService } from './modules/users/users-academic.service.ts';
import { AnalyticsReportsService } from './modules/analytics/analytics-reports.service.ts';
import { AuditService } from './modules/audit/audit.service.ts';
import { StreaksService } from './modules/streaks/streaks.service.ts';
import { resolveAuthSession, extractBearerToken } from './middleware/authentication.ts';
import {
  assertAuthenticated,
  assertHasAnyRole,
  assertStudentAccessScope,
  assertClassAccessScope,
  assertRombelAccessScope,
} from './middleware/authorization.ts';
import { formatErrorResponse } from './middleware/error-handler.ts';
import { NotFoundError, BadRequestError, ValidationError } from './shared/errors/app-error.ts';

export interface AppRequest {
  method: string;
  path: string;
  query?: Record<string, string | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
  ip?: string;
}

export interface AppResponse {
  statusCode: number;
  body: any;
}

export class JawaraApplication {
  public readonly db: RelationalDatabase;
  public readonly authService: AuthService;
  public readonly journalsService: JournalsService;
  public readonly usersAcademicService: UsersAcademicService;
  public readonly analyticsReportsService: AnalyticsReportsService;
  public readonly auditService: AuditService;
  public readonly streaks: StreaksService;
  private simulatedTodayDate: string | null = null;

  constructor(customDb?: RelationalDatabase) {
    this.db = customDb || getDb();
    this.authService = new AuthService(this.db);
    this.journalsService = new JournalsService(this.db);
    this.usersAcademicService = new UsersAcademicService(this.db);
    this.analyticsReportsService = new AnalyticsReportsService(this.db);
    this.auditService = new AuditService(this.db);
    this.streaks = new StreaksService(this.db);
  }

  public getTodayDateStr(): string {
    if (this.simulatedTodayDate) return this.simulatedTodayDate;
    if (process.env.SCHOOL_TODAY_DATE) return process.env.SCHOOL_TODAY_DATE;
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  }

  public setSimulatedTodayDate(dateStr: string | null): void {
    this.simulatedTodayDate = dateStr;
  }

  public async dispatch(req: AppRequest): Promise<AppResponse> {
    const method = (req.method || 'GET').toUpperCase();
    const givenPath = (req.path || '/').split('?')[0];
    const rawPath = givenPath.startsWith('/api')
      ? givenPath
      : `/api${givenPath.startsWith('/') ? '' : '/'}${givenPath}`;
    const query = req.query || {};
    const headers = req.headers || {};
    const body = req.body || {};
    const todayDateStr = this.getTodayDateStr();

    try {
      // ======================================================================
      // 1. PUBLIC & BOOTSTRAP ENDPOINTS
      // ======================================================================
      if (method === 'GET' && rawPath === '/api/status') {
        return {
          statusCode: 200,
          body: {
            status: 'ok',
            app: 'VERTIKAL SMA JAWARA 28',
            scoringVersion: '7KAIH-FINAL-2026.1',
            todayDate: todayDateStr,
            isSimulated: !!this.simulatedTodayDate,
          },
        };
      }

      if (method === 'GET' && rawPath === '/api/today') {
        return {
          statusCode: 200,
          body: {
            todayDate: todayDateStr,
            isSimulated: !!this.simulatedTodayDate,
            timeZone: 'Asia/Jakarta',
          },
        };
      }

      if (method === 'GET' && rawPath === '/api/announcements') {
        const rows = this.db.queryAll(
          `SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC`
        );
        return { statusCode: 200, body: rows };
      }

      if (method === 'GET' && rawPath === '/api/aktivitas-seru/summary') {
        const dateStr = String(query.date || todayDateStr);
        const row = this.db.queryOne<{ cnt: number }>(
          `SELECT COUNT(DISTINCT student_id) AS cnt FROM event_bonuses WHERE log_date = ?`,
          [dateStr]
        );
        return { statusCode: 200, body: { date: dateStr, count: Number(row?.cnt || 0) } };
      }

      if (method === 'POST' && rawPath === '/api/login') {
        const result = this.authService.login({
          username: body.username,
          password: body.password,
          roleCategory: body.role === 'guru' ? 'guru' : 'siswa',
          ipAddress: req.ip,
          userAgent: String(headers['user-agent'] || ''),
        });
        return { statusCode: 200, body: result };
      }

      if (method === 'POST' && rawPath === '/api/admin/login') {
        const result = this.authService.login({
          username: body.username,
          password: body.password,
          roleCategory: 'admin',
          ipAddress: req.ip,
          userAgent: String(headers['user-agent'] || ''),
        });
        return { statusCode: 200, body: result };
      }

      if (method === 'POST' && rawPath === '/api/logout') {
        const token = extractBearerToken(headers);
        if (token) {
          this.authService.revokeSession(token, 'USER_LOGOUT');
        }
        return { statusCode: 200, body: { status: 'ok' } };
      }

      if (method === 'GET' && rawPath === '/api/auth/me') {
        const auth = resolveAuthSession(this.db, headers, true);
        return { statusCode: 200, body: { status: 'ok', session: auth } };
      }

      if (method === 'GET' && rawPath === '/api/settings') {
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getGlobalSettings(),
        };
      }

      if (method === 'GET' && rawPath === '/api/dashboard-widgets') {
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getDashboardWidgets(),
        };
      }

      if (method === 'GET' && rawPath === '/api/school/analytics') {
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getSchoolAnalytics(todayDateStr),
        };
      }

      if (method === 'GET' && rawPath === '/api/leaderboard') {
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getLeaderboard({
            periodType: (query.period as any) || 'ALL_TIME',
            scopeType: (query.scope as any) || 'SCHOOL',
            scopeId: query.scope_id,
            limit: query.limit ? Number(query.limit) : 50,
            todayDateStr,
          }),
        };
      }

      if (method === 'GET' && rawPath === '/api/teachers') {
        return {
          statusCode: 200,
          body: this.usersAcademicService.getTeachers(),
        };
      }

      if (method === 'GET' && rawPath === '/api/students') {
        const includeArchived = query.include_archived === 'true';
        if (includeArchived) {
          const auth = resolveAuthSession(this.db, headers, true);
          assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        }
        return {
          statusCode: 200,
          body: this.usersAcademicService.getStudents(includeArchived),
        };
      }

      const studentByIdMatch = rawPath.match(/^\/api\/students\/([^/]+)$/);
      if (method === 'GET' && studentByIdMatch) {
        const studentId = decodeURIComponent(studentByIdMatch[1]);
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, studentId, this.db, 'READ');
        return {
          statusCode: 200,
          body: this.usersAcademicService.getStudentById(studentId),
        };
      }

      // ======================================================================
      // 2. STUDENT HABITS, JOURNALS & AKTIVITAS SERU (PROTECTED BY RBAC SCOPE)
      // ======================================================================
      if (method === 'GET' && rawPath === '/api/habits/today') {
        const studentId = String(query.student_id || '').trim();
        const dateStr = String(query.date || todayDateStr).trim();
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, studentId, this.db, 'READ');
        return {
          statusCode: 200,
          body: this.journalsService.getStudentTodayJournal(studentId, dateStr, todayDateStr),
        };
      }

      if (method === 'GET' && rawPath === '/api/habits/calendar-summary') {
        const studentId = String(query.student_id || '').trim();
        const days = Number(query.days || 14);
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, studentId, this.db, 'READ');
        return {
          statusCode: 200,
          body: this.journalsService.getStudentCalendarSummary(studentId, days, todayDateStr),
        };
      }

      if (method === 'GET' && rawPath === '/api/student/habit-answers') {
        const studentId = String(query.student_id || '').trim();
        const dateStr = query.date ? String(query.date).trim() : undefined;
        const habitCode = query.habit_code ? String(query.habit_code).trim() : undefined;
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, studentId, this.db, 'READ');
        return {
          statusCode: 200,
          body: {
            student_id: studentId,
            date: dateStr,
            habit_code: habitCode,
            answers: this.journalsService.getStudentHabitAnswers(studentId, dateStr, habitCode),
          },
        };
      }

      const progressMatch = rawPath.match(/^\/api\/student\/([^/]+)\/progress$/);
      if (method === 'GET' && progressMatch) {
        const studentId = decodeURIComponent(progressMatch[1]);
        const days = Number(query.days || 14);
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, studentId, this.db, 'READ');
        return {
          statusCode: 200,
          body: this.journalsService.getStudentProgressSeries(studentId, days, todayDateStr),
        };
      }

      const reportMatch = rawPath.match(/^\/api\/student\/([^/]+)\/report$/);
      if (method === 'GET' && reportMatch) {
        const studentId = decodeURIComponent(reportMatch[1]);
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, studentId, this.db, 'READ');
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getStudentReport(studentId),
        };
      }

      if (method === 'POST' && rawPath === '/api/habits') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, String(body.student_id || ''), this.db, 'WRITE_SELF');
        return {
          statusCode: 200,
          body: this.journalsService.submitHabitEntry(body, todayDateStr, auth),
        };
      }

      if (method === 'DELETE' && rawPath === '/api/habits/reset') {
        const studentId = String(query.student_id || '').trim();
        const habitType = String(query.habit_type || '').trim();
        const dateStr = String(query.date || todayDateStr).trim();
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, studentId, this.db, 'WRITE_SELF');
        return {
          statusCode: 200,
          body: this.journalsService.resetHabitOnDate(
            studentId,
            habitType,
            dateStr,
            todayDateStr,
            auth
          ),
        };
      }

      if (method === 'GET' && rawPath === '/api/aktivitas-seru') {
        const studentId = String(query.student_id || '').trim();
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, studentId, this.db, 'READ');
        return {
          statusCode: 200,
          body: this.journalsService.getAktivitasSeru(studentId, query.date),
        };
      }

      if (method === 'POST' && rawPath === '/api/aktivitas-seru') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, String(body.student_id || ''), this.db, 'WRITE_SELF');
        return {
          statusCode: 200,
          body: this.journalsService.submitAktivitasSeru(body, todayDateStr, auth),
        };
      }

      // ======================================================================
      // 3. TEACHER CLASS & ROMBEL MONITORING ENDPOINTS (STRICT SCOPE CHECK)
      // ======================================================================
      const classAnalyticsMatch = rawPath.match(/^\/api\/class\/([^/]+)\/analytics$/);
      if (method === 'GET' && classAnalyticsMatch) {
        const className = decodeURIComponent(classAnalyticsMatch[1]);
        const auth = resolveAuthSession(this.db, headers, true);
        assertClassAccessScope(auth, className);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getClassAnalytics(
            className,
            query.date,
            todayDateStr
          ),
        };
      }

      const rombelAnalyticsMatch = rawPath.match(/^\/api\/rombel\/([^/]+)\/analytics$/);
      if (method === 'GET' && rombelAnalyticsMatch) {
        const rombelName = decodeURIComponent(rombelAnalyticsMatch[1]);
        const days = Number(query.days || 14);
        const auth = resolveAuthSession(this.db, headers, true);
        assertRombelAccessScope(auth, rombelName);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getRombelAnalytics(
            rombelName,
            days,
            todayDateStr
          ),
        };
      }

      if (method === 'POST' && rawPath === '/api/teacher/notes') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertStudentAccessScope(auth, String(body.student_id || ''), this.db, 'WRITE_WALAS');
        return {
          statusCode: 200,
          body: this.usersAcademicService.saveTeacherNotes(
            String(body.student_id || ''),
            String(body.walas_notes || ''),
            String(body.walas_recommendation || ''),
            auth
          ),
        };
      }

      // ======================================================================
      // 4. ADMIN & TIM 7 KAIH CONTROL PANEL ENDPOINTS
      // ======================================================================
      if (method === 'POST' && rawPath === '/api/admin/validate') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['TIM_7_KAIH', 'SUPER_ADMIN', 'GURU_WALAS', 'GURU_WALI']);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.saveAdminValidation(body, auth),
        };
      }

      if (method === 'GET' && rawPath === '/api/admin/validations-summary') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['TIM_7_KAIH', 'SUPER_ADMIN', 'GURU_WALAS', 'GURU_WALI']);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getAdminValidationsSummary(),
        };
      }

      if (method === 'GET' && rawPath === '/api/admin/overview') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getAdminOverview(),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/students') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.saveStudent(body, todayDateStr, auth),
        };
      }

      const deleteStudentMatch = rawPath.match(/^\/api\/admin\/students\/([^/]+)$/);
      if (method === 'DELETE' && deleteStudentMatch) {
        const studentId = decodeURIComponent(deleteStudentMatch[1]);
        const mode = (String(query.mode || 'ARCHIVE').toUpperCase() as any) || 'ARCHIVE';
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.deleteOrArchiveStudent(studentId, mode, auth),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/import-students') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.importStudentsBatch(
            body.rows || [],
            todayDateStr,
            auth
          ),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/teachers') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.saveTeacher(body, todayDateStr, auth),
        };
      }

      const deleteTeacherMatch = rawPath.match(/^\/api\/admin\/teachers\/([^/]+)$/);
      if (method === 'DELETE' && deleteTeacherMatch) {
        const teacherId = decodeURIComponent(deleteTeacherMatch[1]);
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.deleteTeacher(teacherId, auth),
        };
      }

      if (method === 'GET' && rawPath === '/api/admin/admins') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.getAdmins(),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/admins') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.saveAdminAccount(body, todayDateStr, auth),
        };
      }

      const deleteAdminMatch = rawPath.match(/^\/api\/admin\/admins\/([^/]+)$/);
      if (method === 'DELETE' && deleteAdminMatch) {
        const adminId = decodeURIComponent(deleteAdminMatch[1]);
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.deleteAdminAccount(adminId, auth),
        };
      }

      if (method === 'GET' && rawPath === '/api/admin/classes-rombels') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.getClassesAndRombels(),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/classes') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.saveClass(body, auth),
        };
      }

      const deleteClassMatch = rawPath.match(/^\/api\/admin\/classes\/([^/]+)$/);
      if (method === 'DELETE' && deleteClassMatch) {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        const classId = decodeURIComponent(deleteClassMatch[1]);
        return {
          statusCode: 200,
          body: this.usersAcademicService.deleteClass(classId, auth),
        };
      }

      const assignWalasMatch = rawPath.match(/^\/api\/admin\/classes\/([^/]+)\/assign-walas$/);
      if (method === 'POST' && assignWalasMatch) {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        const classId = decodeURIComponent(assignWalasMatch[1]);
        return {
          statusCode: 200,
          body: this.usersAcademicService.assignWalasToClass(classId, body.teacher_id, todayDateStr, auth),
        };
      }

      const unassignWalasMatch = rawPath.match(/^\/api\/admin\/classes\/([^/]+)\/unassign-walas$/);
      if (method === 'POST' && unassignWalasMatch) {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        const classId = decodeURIComponent(unassignWalasMatch[1]);
        return {
          statusCode: 200,
          body: this.usersAcademicService.unassignWalasFromClass(classId, auth),
        };
      }

      const assignGuruWaliMatch = rawPath.match(/^\/api\/admin\/teachers\/([^/]+)\/assign-guru-wali$/);
      if (method === 'POST' && assignGuruWaliMatch) {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        const teacherId = decodeURIComponent(assignGuruWaliMatch[1]);
        return {
          statusCode: 200,
          body: this.usersAcademicService.assignGuruWali(teacherId, todayDateStr, auth),
        };
      }

      if (method === 'GET' && rawPath === '/api/admin/cohorts') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.getCohorts(),
        };
      }

      const updateCohortMatch = rawPath.match(/^\/api\/admin\/cohorts\/([^/]+)$/);
      if (method === 'POST' && updateCohortMatch) {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        const cohortId = decodeURIComponent(updateCohortMatch[1]);
        return {
          statusCode: 200,
          body: this.usersAcademicService.updateCohortLabel(cohortId, body.name, auth),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/rombels') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.saveRombel(body, auth),
        };
      }

      const deleteRombelMatch = rawPath.match(/^\/api\/admin\/rombels\/([^/]+)$/);
      if (method === 'DELETE' && deleteRombelMatch) {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        const rombelId = decodeURIComponent(deleteRombelMatch[1]);
        return {
          statusCode: 200,
          body: this.usersAcademicService.deleteRombel(rombelId, auth),
        };
      }

      // 7 KAIH Instruments API (Public & Admin CRUD)
      if (method === 'GET' && rawPath === '/api/instruments') {
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getInstruments(query.habit_code),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/instruments') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.saveInstrument(body, auth),
        };
      }

      const deleteInstrumentMatch = rawPath.match(/^\/api\/admin\/instruments\/([^/]+)$/);
      if (method === 'DELETE' && deleteInstrumentMatch) {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        const instId = decodeURIComponent(deleteInstrumentMatch[1]);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.deleteInstrument(instId, auth),
        };
      }

      // Data Collection Period API
      if (method === 'GET' && rawPath === '/api/data-collection-period') {
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getDataCollectionPeriod(todayDateStr),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/data-collection-period') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.saveDataCollectionPeriod(body, auth),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/move-student-group') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.usersAcademicService.moveStudentGroup(
            String(body.student_id || ''),
            body.target_class_name,
            body.target_rombel_name,
            todayDateStr,
            auth,
            body.reason
          ),
        };
      }

      if (method === 'GET' && rawPath === '/api/admin/journals') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        return {
          statusCode: 200,
          body: this.journalsService.queryAdminJournals(query as any),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/journals/correct') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        return {
          statusCode: 200,
          body: this.journalsService.correctJournalEntry(body, todayDateStr, auth),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/dashboard-widgets') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.saveDashboardWidget(body, auth),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/settings') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.saveGlobalSettings(body, auth),
        };
      }

      if (method === 'GET' && rawPath === '/api/admin/audit-logs') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        return {
          statusCode: 200,
          body: this.auditService.getRecentAuditLogs(
            Number(query.limit || 100),
            query.entity_type
          ),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/announcements') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        const annId = body.id || `ann-${Date.now()}`;
        this.db.execute(
          `INSERT INTO announcements (id, type, title, content, author, is_active)
           VALUES (?, ?, ?, ?, ?, 1)
           ON CONFLICT(id) DO UPDATE SET
            type = excluded.type,
            title = excluded.title,
            content = excluded.content,
            author = excluded.author,
            is_active = excluded.is_active`,
          [annId, body.type || 'QUOTE', body.title || 'Petuah Jawara', body.content, body.author || 'Admin']
        );
        return { statusCode: 200, body: { status: 'ok', id: annId } };
      }

      const deleteAnnMatch = rawPath.match(/^\/api\/admin\/announcements\/([^/]+)$/);
      if (method === 'DELETE' && deleteAnnMatch) {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        const annId = decodeURIComponent(deleteAnnMatch[1]);
        this.db.execute(`DELETE FROM announcements WHERE id = ?`, [annId]);
        return { statusCode: 200, body: { status: 'ok', message: 'Pengumuman berhasil dihapus.' } };
      }

      // ======================================================================
      // DATABASE TABLE EXPLORER & SPREADSHEET VIEWER (ADMIN ONLY)
      // ======================================================================
      if (method === 'GET' && rawPath === '/api/admin/tables') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        const rows = this.db.queryAll<{ name: string }>(
          `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC`
        );
        return { statusCode: 200, body: rows.map((r) => r.name) };
      }

      if (method === 'GET' && rawPath === '/api/admin/table-data') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        const tableName = String(query.table_name || '').trim();
        if (!tableName || !/^[a-zA-Z0-9_]+$/.test(tableName)) {
          throw new ValidationError('Nama tabel tidak valid.');
        }
        const limit = Math.min(500, Math.max(1, Number(query.limit || 100)));
        const offset = Math.max(0, Number(query.offset || 0));

        const countRow = this.db.queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM "${tableName}"`);
        const totalRows = Number(countRow?.cnt || 0);

        const colInfo = this.db.queryAll<any>(`PRAGMA table_info("${tableName}")`);
        const columns = colInfo.map((c) => ({
          name: c.name,
          type: c.type,
          pk: Boolean(c.pk),
          notnull: Boolean(c.notnull),
        }));

        const rows = this.db.queryAll<any>(`SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`, [limit, offset]);
        return {
          statusCode: 200,
          body: {
            tableName,
            totalRows,
            columns,
            rows,
            limit,
            offset,
          },
        };
      }

      // Change Password endpoint for students & teachers
      if (method === 'POST' && rawPath === '/api/auth/change-password') {
        const auth = resolveAuthSession(this.db, headers, true);
        const result = this.authService.changePassword({
          userId: auth.userId,
          currentPassword: body.currentPassword || body.oldPassword,
          newPassword: body.newPassword,
        });
        return { statusCode: 200, body: result };
      }

      // Popup Betawi Quotes Endpoints
      if (method === 'GET' && rawPath === '/api/popups') {
        const rows = this.db.queryAll<any>(`SELECT * FROM popup_quotes ORDER BY habit_code ASC, id ASC`);
        return { statusCode: 200, body: rows };
      }

      const popupRouteMatch = rawPath.match(/^\/api\/admin\/popups(?:\/([^/]+))?$/);
      if ((method === 'POST' || method === 'PUT') && popupRouteMatch) {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        let pBody = body;
        if (typeof pBody === 'string') {
          try { pBody = JSON.parse(pBody); } catch {}
        }
        pBody = pBody || {};
        const quoteText = String(
          pBody.quote_text || pBody.quoteText || pBody.quote || pBody.text || pBody.content || pBody.petuah || ''
        ).trim();
        if (!quoteText) {
          throw new ValidationError('quote_text (teks petuah) wajib diisi.');
        }
        const urlId = popupRouteMatch[1] ? decodeURIComponent(popupRouteMatch[1]) : '';
        const habitCode = String(pBody.habit_code || pBody.habitCode || 'umum').trim();
        const id = String(pBody.id || urlId || `popup_${habitCode}_${Date.now()}`).trim();
        const triggerCondition = String(pBody.trigger_condition || pBody.triggerCondition || 'always').trim();
        const title = String(pBody.title || 'Petuah Budaya Betawi').trim();

        this.db.execute(
          `INSERT INTO popup_quotes (id, habit_code, trigger_condition, title, quote_text, updated_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(id) DO UPDATE SET
            habit_code = excluded.habit_code,
            trigger_condition = excluded.trigger_condition,
            title = excluded.title,
            quote_text = excluded.quote_text,
            updated_at = datetime('now')`,
          [id, habitCode, triggerCondition, title, quoteText]
        );
        return { statusCode: 200, body: { status: 'ok', id, message: 'Popup petuah berhasil disimpan.' } };
      }

      const deletePopupMatch = rawPath.match(/^\/api\/admin\/popups\/([^/]+)$/);
      if (method === 'DELETE' && deletePopupMatch) {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        const popupId = decodeURIComponent(deletePopupMatch[1]);
        this.db.execute(`DELETE FROM popup_quotes WHERE id = ?`, [popupId]);
        return { statusCode: 200, body: { status: 'ok', message: 'Popup petuah berhasil dihapus.' } };
      }

      // ======================================================================
      // STUDENT ACHIEVEMENTS & RUBRIC API ENDPOINTS
      // ======================================================================
      if (method === 'GET' && rawPath === '/api/achievements/rubric') {
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getAchievementRubric(),
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/achievements/rubric') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        const rubricData = Array.isArray(body.rubric) ? body.rubric : Array.isArray(body) ? body : [];
        return {
          statusCode: 200,
          body: this.analyticsReportsService.saveAchievementRubric(rubricData, auth),
        };
      }

      if (method === 'GET' && rawPath === '/api/achievements/my') {
        const auth = resolveAuthSession(this.db, headers, true);
        const studentId = auth.studentId || (query.student_id ? String(query.student_id).trim() : auth.userId);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getStudentAchievements(studentId),
        };
      }

      if (method === 'POST' && rawPath === '/api/achievements/submit') {
        const auth = resolveAuthSession(this.db, headers, true);
        const studentId = auth.studentId || (body.student_id ? String(body.student_id).trim() : auth.userId);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.submitAchievement(
            {
              studentId,
              achievementName: body.achievement_name || body.achievementName || body.nama_prestasi || body.namaPrestasi,
              achievementType: body.achievement_type || body.achievementType || body.jenis_prestasi || 'Akademik',
              level: body.level || body.jenjang || 'Sekolah',
              participationCategory: body.participation_category || body.participationCategory || body.kategori || 'Individu',
              eventDate: body.event_date || body.eventDate || body.tanggal,
              achievementRank: body.achievement_rank || body.achievementRank || body.pencapaian || 'Peserta',
              story: body.story || body.cerita || '',
              certificateUrl: body.certificate_url || body.certificateUrl || body.bukti_url || '',
            },
            auth
          ),
        };
      }

      if (method === 'GET' && rawPath === '/api/admin/achievements') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.getAllAchievements(query.status),
        };
      }

      const validateAchievementMatch = rawPath.match(/^\/api\/admin\/achievements\/([^/]+)\/validate$/);
      if (method === 'POST' && validateAchievementMatch) {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        const achievementId = decodeURIComponent(validateAchievementMatch[1]);
        return {
          statusCode: 200,
          body: this.analyticsReportsService.validateAchievement(
            achievementId,
            {
              status: body.status,
              pointsAwarded: Number(body.points_awarded ?? body.pointsAwarded ?? 0),
              adminNotes: body.admin_notes || body.adminNotes || '',
            },
            auth
          ),
        };
      }

      // Reset instruments to default
      if (method === 'POST' && rawPath === '/api/admin/instruments/reset') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH']);
        this.db.execute(`DELETE FROM habit_instruments`);
        this.analyticsReportsService.seedDefaultInstruments();
        return { statusCode: 200, body: { status: 'ok', message: 'Instrumen berhasil direset ke pengaturan awal.' } };
      }

      // Flexible Data Import (Students, Teachers, Classes)
      if (method === 'POST' && rawPath === '/api/admin/import-data') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        const students = Array.isArray(body.students) ? body.students : [];
        const teachers = Array.isArray(body.teachers) ? body.teachers : [];
        const classes = Array.isArray(body.classes) ? body.classes : [];

        let studentCount = 0;
        let teacherCount = 0;
        let classCount = 0;

        this.db.transaction(() => {
          for (const c of classes) {
            if (c.name || c.class_name) {
              this.usersAcademicService.ensureClassExists(c.name || c.class_name, c.walas_name, c.walas_teacher_id);
              classCount++;
            }
          }
          for (const t of teachers) {
            if (t.name && (t.nip || t.username)) {
              this.usersAcademicService.saveTeacher(t, todayDateStr, auth);
              teacherCount++;
            }
          }
          for (const s of students) {
            if (s.name && (s.nisn || s.username)) {
              this.usersAcademicService.saveStudent(s, todayDateStr, auth);
              studentCount++;
            }
          }
        });

        return {
          statusCode: 200,
          body: {
            status: 'ok',
            message: `Berhasil mengimpor ${studentCount} murid, ${teacherCount} guru, dan ${classCount} kelas.`,
            studentCount,
            teacherCount,
            classCount,
          },
        };
      }

      // ======================================================================
      // 5. DEMO CONTROL ENDPOINTS (NEXT-DAY, FILL-ALL-100, RESET-DATE, CLEAR-DEMO)
      // ======================================================================
      if (method === 'POST' && rawPath === '/api/admin/demo/next-day') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH', 'SISWA', 'GURU_WALAS', 'GURU_WALI']);
        const cur = new Date(`${todayDateStr}T12:00:00Z`);
        cur.setDate(cur.getDate() + 1);
        const nextDate = cur.toISOString().split('T')[0];
        this.setSimulatedTodayDate(nextDate);
        this.streaks.recalculateAllStudents(nextDate);
        return {
          statusCode: 200,
          body: {
            status: 'ok',
            todayDate: nextDate,
            message: `Simulasi tanggal berhasil dimajukan ke ${nextDate}`,
          },
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/demo/set-date') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH', 'SISWA', 'GURU_WALAS', 'GURU_WALI']);
        const targetDate = String(body.date || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
          this.setSimulatedTodayDate(targetDate);
          this.streaks.recalculateAllStudents(targetDate);
          return {
            statusCode: 200,
            body: { status: 'ok', todayDate: targetDate, message: `Simulasi tanggal diset ke ${targetDate}` },
          };
        }
        throw new BadRequestError('Format tanggal harus YYYY-MM-DD');
      }

      if (method === 'POST' && rawPath === '/api/admin/demo/reset-date') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH', 'SISWA', 'GURU_WALAS', 'GURU_WALI']);
        this.setSimulatedTodayDate(null);
        const realToday = this.getTodayDateStr();
        this.streaks.recalculateAllStudents(realToday);
        return {
          statusCode: 200,
          body: { status: 'ok', todayDate: realToday, message: `Tanggal simulasi dikembalikan ke tanggal riil: ${realToday}` },
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/demo/toggle-demo-account') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        const id = String(body.id || '').trim();
        const type = String(body.type || 'student').trim();
        const flag = body.is_demo ? 1 : 0;
        if (type === 'teacher') {
          this.db.execute(`UPDATE teachers SET is_demo = ? WHERE id = ?`, [flag, id]);
        } else {
          this.db.execute(`UPDATE students SET is_demo = ? WHERE id = ?`, [flag, id]);
        }
        return { statusCode: 200, body: { status: 'ok', id, is_demo: flag } };
      }

      if (method === 'POST' && rawPath === '/api/admin/demo/fill-all-100') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN', 'TIM_7_KAIH', 'SISWA', 'GURU_WALAS', 'GURU_WALI']);
        const studentId = String(body.student_id || '').trim();
        if (!studentId) throw new BadRequestError('student_id diperlukan untuk demo isi instan');
        const targetDate = String(body.date || todayDateStr).trim();

        const sampleHabits = [
          {
            habit_type: 'bangun',
            sub_category: 'main',
            payload: { waktu_bangun: '04:30', kondisi_fisik: 'SANGAT_BUGAR', merapikan_tempat_tidur: true },
          },
          {
            habit_type: 'ibadah',
            sub_category: 'subuh',
            payload: { cara: 'BERJAMAAH', sholat_sunnah: true },
          },
          {
            habit_type: 'ibadah',
            sub_category: 'zuhur',
            payload: { cara: 'BERJAMAAH', sholat_sunnah: true },
          },
          {
            habit_type: 'ibadah',
            sub_category: 'asar',
            payload: { cara: 'BERJAMAAH', sholat_sunnah: true },
          },
          {
            habit_type: 'ibadah',
            sub_category: 'magrib',
            payload: { cara: 'BERJAMAAH', sholat_sunnah: true },
          },
          {
            habit_type: 'ibadah',
            sub_category: 'isya',
            payload: { cara: 'BERJAMAAH', sholat_sunnah: true },
          },
          {
            habit_type: 'olahraga',
            sub_category: 'main',
            payload: {
              durasi_menit: 45,
              intensitas: 'SEDANG',
              aktivitas_fisik: ['Lari', 'Push-up', 'Stretching'],
              deskripsi_kegiatan: 'Olahraga lari pagi dan latihan peregangan fisik secara rutin di halaman sekolah.',
              pembiasaan_adiwiyata: true,
            },
          },
          {
            habit_type: 'makan',
            sub_category: 'pagi',
            payload: {
              karbohidrat: true,
              lauk: true,
              sayur: true,
              buah: true,
              air_putih_gelas: 2,
              pembiasaan_adiwiyata: true,
            },
          },
          {
            habit_type: 'makan',
            sub_category: 'siang',
            payload: {
              karbohidrat: true,
              lauk: true,
              sayur: true,
              buah: true,
              air_putih_gelas: 2,
              pembiasaan_adiwiyata: true,
            },
          },
          {
            habit_type: 'makan',
            sub_category: 'malam',
            payload: {
              karbohidrat: true,
              lauk: true,
              sayur: true,
              buah: true,
              air_putih_gelas: 2,
              pembiasaan_adiwiyata: true,
            },
          },
          {
            habit_type: 'belajar',
            sub_category: 'main',
            payload: {
              durasi_menit: 90,
              kategori_kegiatan: 'Membaca',
              aktivitas_belajar: ['Membaca', 'Latihan Soal', 'Diskusi'],
              deskripsi_kegiatan: 'Belajar mandiri memahami konsep sains terapan dan berlatih menyelesaikan soal-soal latihan.',
            },
          },
          {
            habit_type: 'masyarakat',
            sub_category: 'main',
            payload: {
              kategori_kegiatan: 'Gotong Royong',
              jenis_tindakan: 'Membersihkan Lingkungan',
              deskripsi_kegiatan: 'Ikut serta gotong royong membersihkan pekarangan lingkungan dan memilah sampah organik.',
              pembiasaan_adiwiyata: true,
            },
          },
          {
            habit_type: 'tidur',
            sub_category: 'main',
            payload: { waktu_tidur: '21:30', kondisi_bangun: 'SEGAR', mematikan_lampu: true },
          },
        ];

        for (const sub of sampleHabits) {
          this.journalsService.submitHabitEntry(
            {
              student_id: studentId,
              habit_type: sub.habit_type,
              sub_category: sub.sub_category,
              log_date: targetDate,
              payload: sub.payload,
              entry_mode: 'TEPAT_HARI',
              is_missed: false,
              is_counter_entry: false,
              overwrite: true,
            },
            targetDate,
            auth
          );
        }

        return {
          statusCode: 200,
          body: {
            status: 'ok',
            student_id: studentId,
            date: targetDate,
            message: `Semua 7 kebiasaan murid ${studentId} pada ${targetDate} berhasil diisi 100 secara instan!`,
          },
        };
      }

      if (method === 'POST' && rawPath === '/api/admin/demo/clear-demo') {
        const auth = resolveAuthSession(this.db, headers, true);
        assertHasAnyRole(auth, ['SUPER_ADMIN']);
        const studentId = body.student_id ? String(body.student_id).trim() : null;
        const targetDate = body.date ? String(body.date).trim() : null;

        if (studentId && targetDate) {
          this.db.execute(`DELETE FROM habit_entries WHERE student_id = ? AND log_date = ?`, [studentId, targetDate]);
          this.db.execute(`DELETE FROM journals WHERE student_id = ? AND journal_date = ?`, [studentId, targetDate]);
          this.db.execute(`DELETE FROM event_bonuses WHERE student_id = ? AND log_date = ?`, [studentId, targetDate]);
          this.streaks.syncStudentJournalAndAggregates(studentId, targetDate, todayDateStr);
        } else if (studentId) {
          this.db.execute(`DELETE FROM habit_entries WHERE student_id = ?`, [studentId]);
          this.db.execute(`DELETE FROM journals WHERE student_id = ?`, [studentId]);
          this.db.execute(`DELETE FROM event_bonuses WHERE student_id = ?`, [studentId]);
          this.streaks.recalculateStudentAggregates(studentId, todayDateStr);
        } else {
          this.setSimulatedTodayDate(null);
        }

        return {
          statusCode: 200,
          body: { status: 'ok', message: 'Data demo berhasil dibersihkan.' },
        };
      }

      throw new NotFoundError(`Endpoint '${method} ${rawPath}' tidak ditemukan.`);
    } catch (err) {
      return formatErrorResponse(err);
    }
  }
}

export function mountJawaraRoutesOnExpress(expressApp: any, jawaraApp: JawaraApplication): void {
  expressApp.use('/api', async (req: any, res: any) => {
    const response = await jawaraApp.dispatch({
      method: req.method,
      path: req.originalUrl || req.url,
      query: req.query as Record<string, string>,
      headers: req.headers,
      body: req.body,
      ip: req.ip,
    });
    res.status(response.statusCode).json(response.body);
  });
}
