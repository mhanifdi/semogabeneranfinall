/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Users, Students, Teachers, Classes, Rombels & Membership History Service — VERTIKAL SMA JAWARA 28
 */

import crypto from 'node:crypto';
import { RelationalDatabase } from '../../database/client.ts';
import { hashPassword } from '../../shared/utilities/password.ts';
import { NotFoundError, ValidationError } from '../../shared/errors/app-error.ts';
import { AuditService } from '../audit/audit.service.ts';
import type { AuthSessionContext } from '../auth/auth.service.ts';

export class UsersAcademicService {
  private readonly db: RelationalDatabase;
  private readonly audit: AuditService;

  constructor(db: RelationalDatabase) {
    this.db = db;
    this.audit = new AuditService(db);
  }

  public ensureClassExists(className: string, walasName?: string, walasTeacherId?: string): string {
    const cleanName = String(className || 'XI-MIPA-1').trim();
    const validTeacherId =
      walasTeacherId &&
      this.db.queryOne<{ id: string }>(`SELECT id FROM teachers WHERE id = ?`, [walasTeacherId])
        ? walasTeacherId
        : null;
    const existing = this.db.queryOne<{ id: string }>(
      `SELECT id FROM classes WHERE name = ?`,
      [cleanName]
    );
    if (existing) {
      if (walasName || validTeacherId) {
        this.db.execute(
          `UPDATE classes
           SET walas_name = COALESCE(?, walas_name),
               walas_teacher_id = COALESCE(?, walas_teacher_id),
               updated_at = datetime('now')
           WHERE id = ?`,
          [walasName || null, validTeacherId, existing.id]
        );
      }
      return existing.id;
    }

    const gradeLevel = cleanName.startsWith('XII')
      ? 'XII'
      : cleanName.startsWith('X-') || cleanName === 'X'
      ? 'X'
      : 'XI';
    const cohortId =
      gradeLevel === 'XII' ? 'coh-2024' : gradeLevel === 'X' ? 'coh-2026' : 'coh-2025';
    const classId = `cls-${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    this.db.execute(
      `INSERT INTO classes (id, name, grade_level, cohort_id, academic_year_id, walas_teacher_id, walas_name, is_active)
       VALUES (?, ?, ?, ?, 'ay-2026-2027-1', ?, ?, 1)`,
      [classId, cleanName, gradeLevel, cohortId, validTeacherId, walasName || null]
    );
    return classId;
  }

  public ensureRombelExists(
    rombelName: string,
    description?: string,
    waliName?: string,
    waliTeacherId?: string
  ): string | null {
    const cleanName = String(rombelName || '').trim();
    if (!cleanName) return null;
    const validTeacherId =
      waliTeacherId &&
      this.db.queryOne<{ id: string }>(`SELECT id FROM teachers WHERE id = ?`, [waliTeacherId])
        ? waliTeacherId
        : null;

    const existing = this.db.queryOne<{ id: string }>(
      `SELECT id FROM rombels WHERE name = ?`,
      [cleanName]
    );
    if (existing) {
      if (description || waliName || validTeacherId) {
        this.db.execute(
          `UPDATE rombels
           SET description = COALESCE(?, description),
               wali_name = COALESCE(?, wali_name),
               wali_teacher_id = COALESCE(?, wali_teacher_id),
               updated_at = datetime('now')
           WHERE id = ?`,
          [description || null, waliName || null, validTeacherId, existing.id]
        );
      }
      return existing.id;
    }

    const rombelId = `rmb-${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    this.db.execute(
      `INSERT INTO rombels (id, name, description, academic_year_id, wali_teacher_id, wali_name, is_active)
       VALUES (?, ?, ?, 'ay-2026-2027-1', ?, ?, 1)`,
      [
        rombelId,
        cleanName,
        description || 'Kelompok Binaan Rombel Lintas Kelas',
        validTeacherId,
        waliName || null,
      ]
    );
    return rombelId;
  }

  public getStudents(includeArchived = false) {
    const whereClause = includeArchived ? '' : `WHERE s.account_status = 'ACTIVE'`;
    return this.db.queryAll<any>(
      `SELECT s.id, s.user_id, u.username, s.nisn, s.nis, s.name, s.gender, s.religion, s.angkatan,
              COALESCE(u.plain_password, '123') AS password,
              s.class_id, s.class_name, s.rombel_id, s.rombel_name,
              COALESCE(c.walas_name, t_walas.name, 'Dra. Hj. Nurhidayah, M.Pd.') AS walas_name,
              CASE WHEN t_walas.nip = 'guru' OR t_walas.nip IS NULL THEN '197003151995122001' ELSE t_walas.nip END AS walas_nip,
              COALESCE(s.wali_name, t_wali.name, 'Bpk. Hendra Wijaya, S.Pd.') AS wali_name,
              COALESCE(s.wali_id, t_wali.id, 'tch-wali') AS wali_id,
              CASE WHEN t_wali.nip = 'wali' OR t_wali.nip IS NULL THEN '198408122009021004' ELSE t_wali.nip END AS wali_nip,
              s.is_demo,
              COALESCE(s.avg_score, 0) AS avg_score,
              s.xp, s.poin_hebat, s.level, s.streak, s.best_streak, s.predicate,
              s.verification_score, s.verification_count,
              s.walas_notes, s.walas_recommendation, s.avatar_url, s.account_status, s.created_at
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN classes c ON (c.id = s.class_id OR c.name = s.class_name)
       LEFT JOIN teachers t_walas ON (t_walas.id = c.walas_teacher_id OR (t_walas.class_name = s.class_name AND t_walas.assignment_type = 'WALAS'))
       LEFT JOIN teachers t_wali ON (t_wali.id = s.wali_id OR (t_wali.rombel_name = s.rombel_name AND t_wali.assignment_type = 'GURU_WALI'))
       ${whereClause}
       GROUP BY s.id
       ORDER BY s.poin_hebat DESC, s.name ASC`
    );
  }

  public getStudentById(studentId: string) {
    const student = this.db.queryOne<any>(
      `SELECT s.id, s.user_id, u.username, s.nisn, s.nis, s.name, s.gender, s.religion, s.angkatan,
              COALESCE(u.plain_password, '123') AS password,
              s.class_id, s.class_name, s.rombel_id, s.rombel_name,
              COALESCE(c.walas_name, t_walas.name, 'Dra. Hj. Nurhidayah, M.Pd.') AS walas_name,
              CASE WHEN t_walas.nip = 'guru' OR t_walas.nip IS NULL THEN '197003151995122001' ELSE t_walas.nip END AS walas_nip,
              COALESCE(s.wali_name, t_wali.name, 'Bpk. Hendra Wijaya, S.Pd.') AS wali_name,
              COALESCE(s.wali_id, t_wali.id, 'tch-wali') AS wali_id,
              CASE WHEN t_wali.nip = 'wali' OR t_wali.nip IS NULL THEN '198408122009021004' ELSE t_wali.nip END AS wali_nip,
              s.is_demo,
              COALESCE(s.avg_score, 0) AS avg_score,
              s.xp, s.poin_hebat, s.level, s.streak, s.best_streak, s.predicate,
              s.verification_score, s.verification_count,
              s.walas_notes, s.walas_recommendation, s.avatar_url, s.account_status, s.created_at
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN classes c ON (c.id = s.class_id OR c.name = s.class_name)
       LEFT JOIN teachers t_walas ON (t_walas.id = c.walas_teacher_id OR (t_walas.class_name = s.class_name AND t_walas.assignment_type = 'WALAS'))
       LEFT JOIN teachers t_wali ON (t_wali.id = s.wali_id OR (t_wali.rombel_name = s.rombel_name AND t_wali.assignment_type = 'GURU_WALI'))
       WHERE s.id = ?`,
      [studentId]
    );
    if (!student) {
      throw new NotFoundError(`Murid '${studentId}' tidak ditemukan.`);
    }
    return student;
  }

  public getTeachers() {
    const teachers = this.db.queryAll<any>(
      `SELECT t.id, t.user_id, u.username, COALESCE(u.plain_password, '123') AS password,
              t.nip, t.name, t.gender, t.phone,
              t.role_title AS role, t.assignment_type, t.class_name, t.rombel_name,
              t.roles_csv, t.is_demo,
              t.avatar_url, t.account_status, t.created_at
       FROM teachers t
       JOIN users u ON u.id = t.user_id
       ORDER BY t.name ASC`
    );

    return teachers.map((t) => {
      const rolesCsv = t.roles_csv || t.assignment_type || 'WALAS';
      const isWalas = rolesCsv.includes('WALAS') || t.assignment_type === 'WALAS';
      const isWali = rolesCsv.includes('WALI') || t.assignment_type === 'GURU_WALI';
      const isTim7Kaih = rolesCsv.includes('TIM_7_KAIH') || t.assignment_type === 'TIM_7_KAIH' || (t.role && t.role.includes('7 KAIH'));
      const isAdmin = t.assignment_type === 'ADMIN' || (t.role && t.role.includes('Admin'));

      return {
        ...t,
        roles_csv: rolesCsv,
        is_walas: isWalas,
        is_wali: isWali,
        is_tim_7_kaih: isTim7Kaih,
        is_admin: isAdmin,
      };
    });
  }

  public saveStudent(rawBody: any, todayDateStr: string, actor?: AuthSessionContext | null) {
    const name = String(rawBody.name || '').trim();
    const nisn = String(rawBody.nisn || rawBody.nis || '').trim();
    if (!name || !nisn) {
      throw new ValidationError('Nama lengkap dan NIS siswa wajib diisi.');
    }

    const cleanUsername = String(rawBody.username || nisn).trim().toLowerCase();
    const studentId = String(rawBody.id || `std-${cleanUsername}`).trim();
    const userId = `usr-${studentId}`;
    const gender = String(rawBody.gender || 'L').toUpperCase() === 'P' ? 'P' : 'L';
    const religion = String(rawBody.religion || 'Islam').trim();
    const className = String(rawBody.class_name || 'XI-MIPA-1').trim();
    let waliName = rawBody.wali_name ? String(rawBody.wali_name).trim() : null;
    let waliId = rawBody.wali_id ? String(rawBody.wali_id).trim() : null;
    if (waliName && !waliId) {
      const teacherRow = this.db.queryOne<any>(`SELECT id, name FROM teachers WHERE name = ?`, [waliName]);
      if (teacherRow) {
        waliId = teacherRow.id;
        waliName = teacherRow.name;
      }
    }

    let rombelName = String(rawBody.rombel_name || '').trim();
    if (!rombelName && (waliName || waliId)) {
      const rombelRow = this.db.queryOne<any>(
        `SELECT name FROM rombels WHERE wali_name = ? OR wali_teacher_id = ?`,
        [waliName, waliId]
      );
      if (rombelRow) {
        rombelName = rombelRow.name;
      }
    }
    if (!rombelName) rombelName = 'Rombel Sains & Riset A';
    const isDemo = rawBody.is_demo ? 1 : 0;
    const status = String(rawBody.account_status || 'ACTIVE').toUpperCase();
    const angkatan = String(rawBody.angkatan || 'XI').toUpperCase();
    const cohortId = angkatan === 'X' ? 'coh-2026' : angkatan === 'XII' ? 'coh-2024' : 'coh-2025';
    const avatarUrl =
      rawBody.avatar_url ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanUsername)}`;

    return this.db.transaction(() => {
      const classId = this.ensureClassExists(className);
      const rombelId = this.ensureRombelExists(rombelName);
      const existingStudent = this.db.queryOne<any>(
        `SELECT * FROM students WHERE id = ?`,
        [studentId]
      );

      if (existingStudent) {
        if (rawBody.password && String(rawBody.password).trim()) {
          const plainPass = String(rawBody.password).trim();
          const newHash = hashPassword(plainPass);
          this.db.execute(
            `UPDATE users
             SET username = ?, full_name = ?, password_hash = ?, plain_password = ?, password_algo = 'scrypt',
                 account_status = ?, updated_at = datetime('now')
             WHERE id = ?`,
            [cleanUsername, name, newHash, plainPass, status, existingStudent.user_id]
          );
        } else {
          this.db.execute(
            `UPDATE users
             SET username = ?, full_name = ?, account_status = ?, updated_at = datetime('now')
             WHERE id = ?`,
            [cleanUsername, name, status, existingStudent.user_id]
          );
        }

        // If class or rombel changed, record non-destructive membership history
        if (existingStudent.class_name !== className) {
          this.db.execute(
            `UPDATE student_class_memberships SET is_current = 0, end_date = ? WHERE student_id = ? AND is_current = 1`,
            [todayDateStr, studentId]
          );
          this.db.execute(
            `INSERT INTO student_class_memberships
             (id, student_id, class_id, class_name, academic_year_id, start_date, is_current, move_reason, changed_by)
             VALUES (?, ?, ?, ?, 'ay-2026-2027-1', ?, 1, 'Pembaruan data profil siswa', ?)`,
            [
              `scm-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
              studentId,
              classId,
              className,
              todayDateStr,
              actor?.userId || null,
            ]
          );
        }

        if (rombelId && existingStudent.rombel_name !== rombelName) {
          this.db.execute(
            `UPDATE student_rombel_memberships SET is_current = 0, end_date = ? WHERE student_id = ? AND is_current = 1`,
            [todayDateStr, studentId]
          );
          this.db.execute(
            `INSERT INTO student_rombel_memberships
             (id, student_id, rombel_id, rombel_name, academic_year_id, start_date, is_current, move_reason, changed_by)
             VALUES (?, ?, ?, ?, 'ay-2026-2027-1', ?, 1, 'Pembaruan data profil siswa', ?)`,
            [
              `srm-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
              studentId,
              rombelId,
              rombelName,
              todayDateStr,
              actor?.userId || null,
            ]
          );
        }

        this.db.execute(
          `UPDATE students
           SET nisn = ?, name = ?, gender = ?, religion = ?, angkatan = ?, cohort_id = ?,
               class_id = ?, class_name = ?, rombel_id = ?, rombel_name = ?,
               wali_name = ?, wali_id = ?, is_demo = ?,
               account_status = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [
            nisn,
            name,
            gender,
            religion,
            angkatan,
            cohortId,
            classId,
            className,
            rombelId,
            rombelName,
            waliName,
            waliId,
            isDemo,
            status,
            studentId,
          ]
        );
      } else {
        const plainPass = String(rawBody.password || '123').trim();
        const passwordHash = hashPassword(plainPass);

        this.db.execute(
          `INSERT INTO users (id, username, password_hash, plain_password, password_algo, full_name, account_status)
           VALUES (?, ?, ?, ?, 'scrypt', ?, ?)`,
          [userId, cleanUsername, passwordHash, plainPass, name, status]
        );

        this.db.execute(
          `INSERT OR IGNORE INTO user_roles (id, user_id, role_id, scope_type, scope_id, is_active, assigned_by)
           VALUES (?, ?, 'role-siswa', 'SELF', ?, 1, ?)`,
          [`ur-${studentId}`, userId, studentId, actor?.userId || null]
        );

        this.db.execute(
          `INSERT INTO students
           (id, user_id, nisn, name, gender, religion, angkatan, cohort_id, class_id, class_name, rombel_id, rombel_name,
            wali_name, wali_id, is_demo, xp, poin_hebat, level, streak, best_streak, predicate, avatar_url, account_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, 0, 0, 'Perlu Pembinaan', ?, ?)`,
          [
            studentId,
            userId,
            nisn,
            name,
            gender,
            religion,
            angkatan,
            cohortId,
            classId,
            className,
            rombelId,
            rombelName,
            waliName,
            waliId,
            isDemo,
            avatarUrl,
            status,
          ]
        );

        this.db.execute(
          `INSERT INTO student_class_memberships
           (id, student_id, class_id, class_name, academic_year_id, start_date, is_current, move_reason, changed_by)
           VALUES (?, ?, ?, ?, 'ay-2026-2027-1', ?, 1, 'Pendaftaran awal siswa', ?)`,
          [
            `scm-${studentId}-init`,
            studentId,
            classId,
            className,
            todayDateStr,
            actor?.userId || null,
          ]
        );

        if (rombelId) {
          this.db.execute(
            `INSERT INTO student_rombel_memberships
             (id, student_id, rombel_id, rombel_name, academic_year_id, start_date, is_current, move_reason, changed_by)
             VALUES (?, ?, ?, ?, 'ay-2026-2027-1', ?, 1, 'Penempatan awal rombel', ?)`,
            [
              `srm-${studentId}-init`,
              studentId,
              rombelId,
              rombelName,
              todayDateStr,
              actor?.userId || null,
            ]
          );
        }

        this.db.execute(
          `INSERT OR IGNORE INTO streak_records (id, student_id, current_streak, longest_streak, streak_status)
           VALUES (?, ?, 0, 0, 'INACTIVE')`,
          [`str-${studentId}`, studentId]
        );
      }

      this.audit.log({
        actor_user_id: actor?.userId || null,
        actor_username: actor?.username || 'admin',
        actor_role: actor?.activeRole || 'SUPER_ADMIN',
        action: existingStudent ? 'STUDENT_ACCOUNT_UPDATE' : 'STUDENT_ACCOUNT_CREATE',
        entity_type: 'students',
        entity_id: studentId,
        after_state: { id: studentId, nisn, name, className, rombelName, status },
      });

      return { status: 'ok', id: studentId };
    });
  }

  public deleteOrArchiveStudent(
    studentId: string,
    mode: 'ARCHIVE' | 'INACTIVE' | 'DELETE',
    actor?: AuthSessionContext | null
  ) {
    const existing = this.db.queryOne<any>(`SELECT * FROM students WHERE id = ?`, [studentId]);
    if (!existing) {
      throw new NotFoundError(`Siswa '${studentId}' tidak ditemukan.`);
    }

    return this.db.transaction(() => {
      if (mode === 'DELETE') {
        this.db.execute(`DELETE FROM habit_components WHERE habit_entry_id IN (SELECT id FROM habit_entries WHERE student_id = ?)`, [studentId]);
        this.db.execute(`DELETE FROM habit_sessions WHERE student_id = ?`, [studentId]);
        this.db.execute(`DELETE FROM habit_entry_revisions WHERE habit_entry_id IN (SELECT id FROM habit_entries WHERE student_id = ?)`, [studentId]);
        this.db.execute(`DELETE FROM habit_entries WHERE student_id = ?`, [studentId]);
        this.db.execute(`DELETE FROM journals WHERE student_id = ?`, [studentId]);
        this.db.execute(`DELETE FROM event_bonuses WHERE student_id = ?`, [studentId]);
        this.db.execute(`DELETE FROM point_transactions WHERE student_id = ?`, [studentId]);
        this.db.execute(`DELETE FROM admin_validations WHERE student_id = ?`, [studentId]);
        this.db.execute(`DELETE FROM data_corrections WHERE student_id = ?`, [studentId]);
        this.db.execute(`DELETE FROM student_class_memberships WHERE student_id = ?`, [studentId]);
        this.db.execute(`DELETE FROM student_rombel_memberships WHERE student_id = ?`, [studentId]);
        this.db.execute(`DELETE FROM streak_records WHERE student_id = ?`, [studentId]);
        this.db.execute(`DELETE FROM leaderboard_snapshots WHERE student_id = ?`, [studentId]);
        this.db.execute(`DELETE FROM students WHERE id = ?`, [studentId]);
        this.db.execute(`DELETE FROM user_roles WHERE user_id = ?`, [existing.user_id]);
        this.db.execute(`DELETE FROM sessions WHERE user_id = ?`, [existing.user_id]);
        this.db.execute(`DELETE FROM password_reset_tokens WHERE user_id = ?`, [existing.user_id]);
        this.db.execute(`DELETE FROM users WHERE id = ?`, [existing.user_id]);
      } else {
        const targetStatus = mode === 'INACTIVE' ? 'INACTIVE' : 'ARCHIVED';
        this.db.execute(
          `UPDATE students SET account_status = ?, updated_at = datetime('now') WHERE id = ?`,
          [targetStatus, studentId]
        );
        this.db.execute(
          `UPDATE users SET account_status = ?, updated_at = datetime('now') WHERE id = ?`,
          [targetStatus, existing.user_id]
        );
        // Revoke active sessions immediately when account is deactivated/archived
        this.db.execute(
          `UPDATE sessions SET revoked_at = datetime('now'), revoked_reason = ? WHERE user_id = ? AND revoked_at IS NULL`,
          [`ACCOUNT_${targetStatus}`, existing.user_id]
        );
      }

      this.audit.log({
        actor_user_id: actor?.userId || null,
        actor_username: actor?.username || 'admin',
        actor_role: actor?.activeRole || 'SUPER_ADMIN',
        action: `STUDENT_ACCOUNT_${mode}`,
        entity_type: 'students',
        entity_id: studentId,
      });

      return { status: 'ok', id: studentId, mode };
    });
  }

  public importStudentsBatch(rows: any[], todayDateStr: string, actor?: AuthSessionContext | null) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new ValidationError('Daftar siswa untuk impor kosong.');
    }
    let importedCount = 0;
    for (const r of rows) {
      if (!r.name || !r.nisn) continue;
      this.saveStudent(r, todayDateStr, actor);
      importedCount++;
    }
    return { status: 'ok', importedCount };
  }

  public saveTeacher(rawBody: any, todayDateStr: string, actor?: AuthSessionContext | null) {
    const name = String(rawBody.name || '').trim();
    const nip = String(rawBody.nip || '').trim();
    if (!name || !nip) {
      throw new ValidationError('Nama lengkap dan NIP guru wajib diisi.');
    }

    const cleanUsername = String(rawBody.username || nip).trim().toLowerCase().replace(/\s+/g, '_');
    const teacherId = String(rawBody.id || `tch-${cleanUsername}`).trim();
    const userId = `usr-${teacherId}`;

    // Multiple roles support via checkboxes
    const isWalas = Boolean(rawBody.is_walas ?? (rawBody.assignment_type === 'WALAS' || rawBody.roles_csv?.includes('WALAS')));
    const isWali = Boolean(rawBody.is_wali ?? (rawBody.assignment_type === 'GURU_WALI' || rawBody.roles_csv?.includes('WALI')));
    const isTim7Kaih = Boolean(rawBody.is_tim_7_kaih ?? (rawBody.assignment_type === 'TIM_7_KAIH' || rawBody.roles_csv?.includes('TIM_7_KAIH')));
    const isAdmin = Boolean(rawBody.is_admin ?? (rawBody.assignment_type === 'ADMIN' || rawBody.roles_csv?.includes('ADMIN')));
    const isDemo = rawBody.is_demo ? 1 : 0;

    const assignedRoles: string[] = [];
    if (isWalas) assignedRoles.push('WALAS');
    if (isWali) assignedRoles.push('WALI');
    if (isTim7Kaih) assignedRoles.push('TIM_7_KAIH');
    if (isAdmin) assignedRoles.push('ADMIN');
    if (assignedRoles.length === 0) assignedRoles.push('WALAS');
    const rolesCsv = assignedRoles.join(',');

    const assignmentType = isAdmin ? 'ADMIN' : (isWalas ? 'WALAS' : (isWali ? 'GURU_WALI' : 'TIM_7_KAIH'));
    const className = isWalas && rawBody.class_name ? String(rawBody.class_name).trim() : null;
    const rombelName = rawBody.rombel_name ? String(rawBody.rombel_name).trim() : null;
    const roleTitle = String(rawBody.role || (isWalas ? `Wali Kelas ${className || ''}` : (isWali ? 'Guru Wali' : 'Tim 7 KAIH'))).trim();
    const status = String(rawBody.account_status || 'ACTIVE').toUpperCase();
    const avatarUrl =
      rawBody.avatar_url ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanUsername)}`;

    return this.db.transaction(() => {
      const existing = this.db.queryOne<any>(`SELECT * FROM teachers WHERE id = ?`, [teacherId]);
      const existingByNip = !existing ? this.db.queryOne<any>(`SELECT * FROM teachers WHERE nip = ?`, [nip]) : null;
      const targetTeacher = existing || existingByNip;
      const existingUser = this.db.queryOne<any>(`SELECT * FROM users WHERE username = ? OR id = ?`, [cleanUsername, userId]);

      const effectiveUserId = targetTeacher?.user_id || existingUser?.id || userId;
      const effectiveTeacherId = targetTeacher?.id || teacherId;

      if (existingUser || targetTeacher) {
        if (rawBody.password && String(rawBody.password).trim()) {
          const plainPass = String(rawBody.password).trim();
          const newHash = hashPassword(plainPass);
          this.db.execute(
            `UPDATE users
             SET username = ?, full_name = ?, password_hash = ?, plain_password = ?, password_algo = 'scrypt',
                 account_status = ?, updated_at = datetime('now')
             WHERE id = ?`,
            [cleanUsername, name, newHash, plainPass, status, effectiveUserId]
          );
        } else {
          this.db.execute(
            `UPDATE users
             SET username = ?, full_name = ?, account_status = ?, updated_at = datetime('now')
             WHERE id = ?`,
            [cleanUsername, name, status, effectiveUserId]
          );
        }
      } else {
        const plainPass = String(rawBody.password || '123').trim();
        const passwordHash = hashPassword(plainPass);
        this.db.execute(
          `INSERT INTO users (id, username, password_hash, plain_password, password_algo, full_name, account_status)
           VALUES (?, ?, ?, ?, 'scrypt', ?, ?)`,
          [effectiveUserId, cleanUsername, passwordHash, plainPass, name, status]
        );
      }

      if (targetTeacher) {
        this.db.execute(
          `UPDATE teachers
           SET nip = ?, name = ?, role_title = ?, assignment_type = ?,
               class_name = ?, rombel_name = ?, roles_csv = ?, is_demo = ?,
               account_status = ?, updated_at = datetime('now')
           WHERE id = ?`,
          [nip, name, roleTitle, assignmentType, className, rombelName, rolesCsv, isDemo, status, effectiveTeacherId]
        );
      } else {
        this.db.execute(
          `INSERT INTO teachers
           (id, user_id, nip, name, role_title, assignment_type, class_name, rombel_name, roles_csv, is_demo, avatar_url, account_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            effectiveTeacherId,
            effectiveUserId,
            nip,
            name,
            roleTitle,
            assignmentType,
            className,
            rombelName,
            rolesCsv,
            isDemo,
            avatarUrl,
            status,
          ]
        );
      }

      const targetUserId = effectiveUserId;

      // Rebuild RBAC `user_roles` & `teacher_assignments` according to assignedRoles
      this.db.execute(`DELETE FROM user_roles WHERE user_id = ?`, [targetUserId]);
      this.db.execute(`UPDATE teacher_assignments SET is_active = 0 WHERE teacher_id = ?`, [
        effectiveTeacherId,
      ]);

      if (isAdmin) {
        this.db.execute(
          `INSERT OR REPLACE INTO user_roles (id, user_id, role_id, scope_type, scope_id, is_active)
           VALUES (?, ?, 'role-super-admin', 'GLOBAL', 'GLOBAL', 1)`,
          [`ur-${effectiveTeacherId}-admin`, targetUserId]
        );
      }
      if (isTim7Kaih) {
        this.db.execute(
          `INSERT OR REPLACE INTO user_roles (id, user_id, role_id, scope_type, scope_id, is_active)
           VALUES (?, ?, 'role-tim-7kaih', 'SCHOOL', 'SCHOOL', 1)`,
          [`ur-${effectiveTeacherId}-7kaih`, targetUserId]
        );
        this.db.execute(
          `INSERT OR REPLACE INTO teacher_assignments
           (id, teacher_id, academic_year_id, assignment_role, start_date, is_active)
           VALUES (?, ?, 'ay-2026-2027-1', 'TIM_7_KAIH', ?, 1)`,
          [`ta-${effectiveTeacherId}-tim7kaih`, effectiveTeacherId, todayDateStr]
        );
      }

      // Per Requirement 4 & 5:
      // If Walas checkbox is unchecked, remove from class (class and students remain).
      if (!isWalas) {
        this.db.execute(`UPDATE classes SET walas_teacher_id = NULL, walas_name = NULL WHERE walas_teacher_id = ?`, [effectiveTeacherId]);
        this.db.execute(`UPDATE teachers SET class_name = NULL WHERE id = ?`, [effectiveTeacherId]);
      } else if (className) {
        const classId = this.ensureClassExists(className, name, effectiveTeacherId);
        this.db.execute(
          `INSERT OR REPLACE INTO user_roles (id, user_id, role_id, scope_type, scope_id, is_active)
           VALUES (?, ?, 'role-guru-walas', 'CLASS', ?, 1)`,
          [`ur-${effectiveTeacherId}-walas-${classId}`, targetUserId, className]
        );
        this.db.execute(
          `INSERT OR REPLACE INTO teacher_assignments
           (id, teacher_id, academic_year_id, assignment_role, class_id, start_date, is_active)
           VALUES (?, ?, 'ay-2026-2027-1', 'GURU_WALAS', ?, ?, 1)`,
          [`ta-${effectiveTeacherId}-walas-${classId}`, effectiveTeacherId, classId, todayDateStr]
        );
        this.db.execute(
          `UPDATE classes SET walas_teacher_id = ?, walas_name = ? WHERE name = ?`,
          [effectiveTeacherId, name, className]
        );
        this.db.execute(
          `UPDATE students SET walas_name = ?, walas_nip = ? WHERE LOWER(TRIM(class_name)) = LOWER(TRIM(?))`,
          [name, nip, className]
        );
      }

      // Per Requirement 4 & 5:
      // If Guru Wali checkbox is unchecked, revoke Guru Wali role, and students assigned to this guru wali exit anak wali status!
      if (!isWali) {
        this.db.execute(`UPDATE rombels SET wali_teacher_id = NULL, wali_name = NULL WHERE wali_teacher_id = ?`, [effectiveTeacherId]);
        this.db.execute(`UPDATE students SET wali_id = NULL, wali_name = NULL, rombel_id = NULL, rombel_name = '-' WHERE wali_id = ? OR wali_name = ?`, [effectiveTeacherId, name]);
        this.db.execute(`UPDATE teachers SET rombel_name = NULL WHERE id = ?`, [effectiveTeacherId]);
      } else {
        const rmbName = `Binaan ${name}`;
        const existingRmb = this.db.queryOne<any>(`SELECT * FROM rombels WHERE wali_teacher_id = ? OR name = ?`, [effectiveTeacherId, rmbName]);
        if (!existingRmb) {
          const rmbId = `rmb-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
          this.db.execute(
            `INSERT INTO rombels (id, academic_year_id, name, description, wali_teacher_id, wali_name, is_active)
             VALUES (?, 'ay-2026-2027-1', ?, 'Kelompok Binaan Guru Wali', ?, ?, 1)`,
            [rmbId, rmbName, effectiveTeacherId, name]
          );
        }
        this.db.execute(
          `INSERT OR REPLACE INTO user_roles (id, user_id, role_id, scope_type, scope_id, is_active)
           VALUES (?, ?, 'role-guru-wali', 'GLOBAL', 'GLOBAL', 1)`,
          [`ur-${effectiveTeacherId}-wali`, targetUserId]
        );
        this.db.execute(
          `INSERT OR REPLACE INTO teacher_assignments
           (id, teacher_id, academic_year_id, assignment_role, start_date, is_active)
           VALUES (?, ?, 'ay-2026-2027-1', 'GURU_WALI', ?, 1)`,
          [`ta-${effectiveTeacherId}-wali`, effectiveTeacherId, todayDateStr]
        );
      }

      this.audit.log({
        actor_user_id: actor?.userId || null,
        actor_username: actor?.username || 'admin',
        actor_role: actor?.activeRole || 'SUPER_ADMIN',
        action: existing ? 'TEACHER_ACCOUNT_UPDATE' : 'TEACHER_ACCOUNT_CREATE',
        entity_type: 'teachers',
        entity_id: effectiveTeacherId,
        after_state: { id: effectiveTeacherId, nip, name, rolesCsv, className },
      });

      return { status: 'ok', id: effectiveTeacherId };
    });
  }

  public deleteTeacher(teacherId: string, actor?: AuthSessionContext | null) {
    const existing = this.db.queryOne<any>(`SELECT * FROM teachers WHERE id = ?`, [teacherId]);
    if (!existing) {
      throw new NotFoundError(`Guru '${teacherId}' tidak ditemukan.`);
    }
    return this.db.transaction(() => {
      // 1. Walas: unassign from class (class and students remain)
      this.db.execute(`UPDATE classes SET walas_teacher_id = NULL, walas_name = NULL WHERE walas_teacher_id = ?`, [teacherId]);
      
      // 2. Guru Wali: unassign rombels and students exit anak wali status
      this.db.execute(`UPDATE rombels SET wali_teacher_id = NULL, wali_name = NULL WHERE wali_teacher_id = ?`, [teacherId]);
      this.db.execute(`UPDATE students SET wali_id = NULL, wali_name = NULL, rombel_id = NULL, rombel_name = '-' WHERE wali_id = ? OR wali_name = ?`, [teacherId, existing.name]);
      
      // 3. Delete teacher assignments
      this.db.execute(`DELETE FROM teacher_assignments WHERE teacher_id = ?`, [teacherId]);
      
      // 4. Delete user roles, sessions, and tokens
      this.db.execute(`DELETE FROM user_roles WHERE user_id = ?`, [existing.user_id]);
      this.db.execute(`DELETE FROM sessions WHERE user_id = ?`, [existing.user_id]);
      this.db.execute(`DELETE FROM password_reset_tokens WHERE user_id = ?`, [existing.user_id]);
      
      // 5. Delete teacher record FIRST before users table (foreign key constraint)
      this.db.execute(`DELETE FROM teachers WHERE id = ?`, [teacherId]);
      
      // 6. Delete user record
      this.db.execute(`DELETE FROM users WHERE id = ?`, [existing.user_id]);

      this.audit.log({
        actor_user_id: actor?.userId || null,
        actor_username: actor?.username || 'admin',
        actor_role: actor?.activeRole || 'SUPER_ADMIN',
        action: 'TEACHER_ACCOUNT_DELETE',
        entity_type: 'teachers',
        entity_id: teacherId,
      });
      return { status: 'ok', id: teacherId };
    });
  }

  // =========================================================================
  // ADMIN ACCOUNT MANAGEMENT (SUPER_ADMIN)
  // =========================================================================
  public getAdmins() {
    return this.db.queryAll<any>(
      `SELECT u.id AS user_id, u.username, u.full_name, u.account_status, u.created_at,
              COALESCE(u.plain_password, '123') AS password,
              COALESCE(t.id, u.id) AS id, COALESCE(t.nip, u.username) AS nip,
              COALESCE(t.name, u.full_name) AS name, t.role_title, t.avatar_url
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id AND ur.role_id = 'role-super-admin'
       LEFT JOIN teachers t ON t.user_id = u.id
       WHERE ur.is_active = 1
       GROUP BY u.id
       ORDER BY u.full_name ASC`
    );
  }

  public saveAdminAccount(rawBody: any, todayDateStr: string, actor?: AuthSessionContext | null) {
    const name = String(rawBody.full_name || rawBody.name || '').trim();
    const cleanUsername = String(rawBody.username || '').trim().toLowerCase();
    if (!name || !cleanUsername) {
      throw new ValidationError('Nama lengkap dan username admin wajib diisi.');
    }

    const userId = rawBody.user_id ? String(rawBody.user_id).trim() : `usr-adm-${cleanUsername}`;
    const teacherId = rawBody.id ? String(rawBody.id).trim() : `adm-${cleanUsername}`;
    const status = String(rawBody.account_status || 'ACTIVE').toUpperCase();
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanUsername)}`;

    return this.db.transaction(() => {
      const existingUser = this.db.queryOne<any>(
        `SELECT * FROM users WHERE id = ? OR lower(username) = ?`,
        [userId, cleanUsername]
      );
      if (existingUser) {
        if (rawBody.password && String(rawBody.password).trim()) {
          const plainPass = String(rawBody.password).trim();
          const newHash = hashPassword(plainPass);
          this.db.execute(
            `UPDATE users SET username = ?, full_name = ?, password_hash = ?, plain_password = ?, account_status = ?, updated_at = datetime('now') WHERE id = ?`,
            [cleanUsername, name, newHash, plainPass, status, existingUser.id]
          );
        } else {
          this.db.execute(
            `UPDATE users SET username = ?, full_name = ?, account_status = ?, updated_at = datetime('now') WHERE id = ?`,
            [cleanUsername, name, status, existingUser.id]
          );
        }

        const existingTeacher = this.db.queryOne<any>(`SELECT * FROM teachers WHERE user_id = ?`, [existingUser.id]);
        if (existingTeacher) {
          this.db.execute(
            `UPDATE teachers SET name = ?, role_title = 'Super Admin', assignment_type = 'ADMIN', account_status = ?, updated_at = datetime('now') WHERE id = ?`,
            [name, status, existingTeacher.id]
          );
        } else {
          this.db.execute(
            `INSERT INTO teachers (id, user_id, nip, name, role_title, assignment_type, class_name, rombel_name, avatar_url, account_status)
             VALUES (?, ?, ?, ?, 'Super Admin', 'ADMIN', 'Semua Kelas', 'Seluruh Rombel', ?, ?)`,
            [teacherId, existingUser.id, cleanUsername, name, avatarUrl, status]
          );
        }
      } else {
        const plainPass = String(rawBody.password || '123').trim();
        const passwordHash = hashPassword(plainPass);
        this.db.execute(
          `INSERT INTO users (id, username, password_hash, plain_password, password_algo, full_name, account_status)
           VALUES (?, ?, ?, ?, 'scrypt', ?, ?)`,
          [userId, cleanUsername, passwordHash, plainPass, name, status]
        );
        this.db.execute(
          `INSERT INTO teachers
           (id, user_id, nip, name, role_title, assignment_type, class_name, rombel_name, avatar_url, account_status)
           VALUES (?, ?, ?, ?, 'Super Admin', 'ADMIN', 'Semua Kelas', 'Seluruh Rombel', ?, ?)`,
          [teacherId, userId, cleanUsername, name, avatarUrl, status]
        );
      }

      const targetUserId = existingUser ? existingUser.id : userId;
      this.db.execute(
        `INSERT OR IGNORE INTO user_roles (id, user_id, role_id, scope_type, scope_id, is_active)
         VALUES (?, ?, 'role-super-admin', 'GLOBAL', 'GLOBAL', 1)`,
        [`ur-${targetUserId}-admin`, targetUserId]
      );

      this.audit.log({
        actor_user_id: actor?.userId || null,
        actor_username: actor?.username || 'admin',
        actor_role: actor?.activeRole || 'SUPER_ADMIN',
        action: existingUser ? 'ADMIN_ACCOUNT_UPDATE' : 'ADMIN_ACCOUNT_CREATE',
        entity_type: 'users',
        entity_id: targetUserId,
      });

      return { status: 'ok', user_id: targetUserId, username: cleanUsername };
    });
  }

  public deleteAdminAccount(adminId: string, actor?: AuthSessionContext | null) {
    const userRow = this.db.queryOne<any>(
      `SELECT * FROM users WHERE id = ? OR id = (SELECT user_id FROM teachers WHERE id = ?)`,
      [adminId, adminId]
    );
    if (!userRow) {
      throw new NotFoundError(`Akun admin '${adminId}' tidak ditemukan.`);
    }

    if (userRow.username === 'admin') {
      throw new ValidationError('Akun Super Admin utama (admin) tidak dapat dihapus.');
    }
    if (actor && actor.userId === userRow.id) {
      throw new ValidationError('Anda tidak dapat menghapus akun admin yang sedang Anda gunakan.');
    }

    return this.db.transaction(() => {
      const teacherRow = this.db.queryOne<any>(`SELECT id, name FROM teachers WHERE user_id = ?`, [userRow.id]);
      if (teacherRow) {
        this.db.execute(`UPDATE classes SET walas_teacher_id = NULL, walas_name = NULL WHERE walas_teacher_id = ?`, [teacherRow.id]);
        this.db.execute(`UPDATE rombels SET wali_teacher_id = NULL, wali_name = NULL WHERE wali_teacher_id = ?`, [teacherRow.id]);
        this.db.execute(`UPDATE students SET wali_id = NULL, wali_name = NULL, rombel_id = NULL, rombel_name = '-' WHERE wali_id = ? OR wali_name = ?`, [teacherRow.id, teacherRow.name]);
        this.db.execute(`DELETE FROM teacher_assignments WHERE teacher_id = ?`, [teacherRow.id]);
        this.db.execute(`DELETE FROM teachers WHERE id = ?`, [teacherRow.id]);
      }
      this.db.execute(`DELETE FROM sessions WHERE user_id = ?`, [userRow.id]);
      this.db.execute(`DELETE FROM password_reset_tokens WHERE user_id = ?`, [userRow.id]);
      this.db.execute(`DELETE FROM user_roles WHERE user_id = ?`, [userRow.id]);
      this.db.execute(`DELETE FROM users WHERE id = ?`, [userRow.id]);

      this.audit.log({
        actor_user_id: actor?.userId || null,
        actor_username: actor?.username || 'admin',
        actor_role: actor?.activeRole || 'SUPER_ADMIN',
        action: 'ADMIN_ACCOUNT_DELETE',
        entity_type: 'users',
        entity_id: userRow.id,
      });

      return { status: 'ok', deleted_id: userRow.id };
    });
  }

  public getCohorts() {
    return this.db.queryAll<any>(
      `SELECT * FROM cohorts ORDER BY entry_year DESC`
    );
  }

  public updateCohortLabel(cohortId: string, name: string, actor?: AuthSessionContext | null) {
    const trimmed = String(name || '').trim();
    if (!trimmed) throw new ValidationError('Nama angkatan tidak boleh kosong.');
    const existing = this.db.queryOne<any>(`SELECT * FROM cohorts WHERE id = ?`, [cohortId]);
    if (!existing) throw new NotFoundError(`Angkatan '${cohortId}' tidak ditemukan.`);
    this.db.execute(`UPDATE cohorts SET name = ? WHERE id = ?`, [trimmed, cohortId]);
    this.audit.log({
      actor_user_id: actor?.userId || null,
      actor_username: actor?.username || 'admin',
      actor_role: actor?.activeRole || 'SUPER_ADMIN',
      action: 'COHORT_UPDATE_LABEL',
      entity_type: 'cohorts',
      entity_id: cohortId,
      after_state: { name: trimmed },
    });
    return { status: 'ok', id: cohortId, name: trimmed };
  }

  public assignWalasToClass(classId: string, teacherId: string, todayDateStr: string, actor?: AuthSessionContext | null) {
    const targetClass = this.db.queryOne<any>(`SELECT * FROM classes WHERE id = ? OR name = ?`, [classId, classId]);
    if (!targetClass) throw new NotFoundError('Kelas tidak ditemukan.');
    const teacher = this.db.queryOne<any>(`SELECT * FROM teachers WHERE id = ?`, [teacherId]);
    if (!teacher) throw new NotFoundError('Guru tidak ditemukan.');

    return this.db.transaction(() => {
      // 0. Ensure user exists for teacher
      let userId = teacher.user_id;
      if (!userId || !this.db.queryOne(`SELECT id FROM users WHERE id = ?`, [userId])) {
        userId = `usr-${teacher.id}`;
        this.db.execute(
          `INSERT OR IGNORE INTO users (id, username, password_hash, plain_password, password_algo, full_name, account_status)
           VALUES (?, ?, ?, '123', 'scrypt', ?, 'ACTIVE')`,
          [userId, teacher.nip || teacher.id, hashPassword('123'), teacher.name]
        );
        this.db.execute(`UPDATE teachers SET user_id = ? WHERE id = ?`, [userId, teacher.id]);
      }

      // 1. Unassign teacher from any other class they may currently have
      this.db.execute(`UPDATE classes SET walas_teacher_id = NULL, walas_name = NULL WHERE walas_teacher_id = ?`, [teacher.id]);

      // 2. Assign teacher to this class
      this.db.execute(
        `UPDATE classes SET walas_teacher_id = ?, walas_name = ?, updated_at = datetime('now') WHERE id = ?`,
        [teacher.id, teacher.name, targetClass.id]
      );

      // 3. Update teacher record with WALAS role and class name
      let rolesArr = (teacher.roles_csv || '').split(',').map((s: string) => s.trim()).filter(Boolean);
      if (!rolesArr.includes('WALAS')) rolesArr.push('WALAS');
      const newRolesCsv = rolesArr.join(',');

      this.db.execute(
        `UPDATE teachers SET class_name = ?, roles_csv = ?, updated_at = datetime('now') WHERE id = ?`,
        [targetClass.name, newRolesCsv, teacher.id]
      );

      // 4. Update user_roles and teacher_assignments
      this.db.execute(
        `INSERT OR REPLACE INTO user_roles (id, user_id, role_id, scope_type, scope_id, is_active)
         VALUES (?, ?, 'role-guru-walas', 'CLASS', ?, 1)`,
        [`ur-${teacher.id}-walas-${targetClass.id}`, userId, targetClass.name]
      );

      const activeAy = this.db.queryOne<any>(`SELECT id FROM academic_years WHERE is_active = 1 LIMIT 1`);
      const ayId = activeAy?.id || 'ay-2026-2027-1';

      this.db.execute(
        `INSERT OR REPLACE INTO teacher_assignments
         (id, teacher_id, academic_year_id, assignment_role, class_id, start_date, is_active)
         VALUES (?, ?, ?, 'GURU_WALAS', ?, ?, 1)`,
        [`ta-${teacher.id}-walas-${targetClass.id}`, teacher.id, ayId, targetClass.id, todayDateStr]
      );

      // 5. Update all students in this class so their walas_name and walas_nip match immediately
      this.db.execute(
        `UPDATE students SET walas_name = ?, walas_nip = ? WHERE LOWER(TRIM(class_name)) = LOWER(TRIM(?))`,
        [teacher.name, teacher.nip || '', targetClass.name]
      );

      return { status: 'ok', class_id: targetClass.id, teacher_id: teacher.id };
    });
  }

  public unassignWalasFromClass(classId: string, actor?: AuthSessionContext | null) {
    const targetClass = this.db.queryOne<any>(`SELECT * FROM classes WHERE id = ? OR name = ?`, [classId, classId]);
    if (!targetClass) throw new NotFoundError('Kelas tidak ditemukan.');

    return this.db.transaction(() => {
      if (targetClass.walas_teacher_id) {
        this.db.execute(`UPDATE teachers SET class_name = NULL WHERE id = ?`, [targetClass.walas_teacher_id]);
        this.db.execute(`DELETE FROM teacher_assignments WHERE teacher_id = ? AND assignment_role = 'GURU_WALAS'`, [targetClass.walas_teacher_id]);
      }
      this.db.execute(`UPDATE classes SET walas_teacher_id = NULL, walas_name = NULL, updated_at = datetime('now') WHERE id = ?`, [targetClass.id]);
      this.db.execute(`UPDATE students SET walas_name = NULL, walas_nip = NULL WHERE LOWER(TRIM(class_name)) = LOWER(TRIM(?))`, [targetClass.name]);
      return { status: 'ok', class_id: targetClass.id };
    });
  }

  public assignGuruWali(teacherId: string, todayDateStr: string, actor?: AuthSessionContext | null) {
    const teacher = this.db.queryOne<any>(`SELECT * FROM teachers WHERE id = ?`, [teacherId]);
    if (!teacher) throw new NotFoundError('Guru tidak ditemukan.');

    return this.db.transaction(() => {
      let rolesArr = (teacher.roles_csv || '').split(',').map((s: string) => s.trim()).filter(Boolean);
      if (!rolesArr.includes('WALI')) rolesArr.push('WALI');
      const newRolesCsv = rolesArr.join(',');

      const rmbName = `Binaan ${teacher.name}`;
      let rmb = this.db.queryOne<any>(`SELECT * FROM rombels WHERE wali_teacher_id = ? OR name = ?`, [teacher.id, rmbName]);
      if (!rmb) {
        const rmbId = `rmb-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        this.db.execute(
          `INSERT INTO rombels (id, academic_year_id, name, description, wali_teacher_id, wali_name, is_active)
           VALUES (?, 'ay-2026-2027-1', ?, 'Kelompok Binaan Guru Wali', ?, ?, 1)`,
          [rmbId, rmbName, teacher.id, teacher.name]
        );
        rmb = { id: rmbId, name: rmbName };
      } else {
        this.db.execute(`UPDATE rombels SET wali_teacher_id = ?, wali_name = ?, is_active = 1 WHERE id = ?`, [teacher.id, teacher.name, rmb.id]);
      }

      this.db.execute(
        `UPDATE teachers SET rombel_name = ?, roles_csv = ?, updated_at = datetime('now') WHERE id = ?`,
        [rmbName, newRolesCsv, teacher.id]
      );

      this.db.execute(
        `INSERT OR REPLACE INTO user_roles (id, user_id, role_id, scope_type, scope_id, is_active)
         VALUES (?, ?, 'role-guru-wali', 'GLOBAL', 'GLOBAL', 1)`,
        [`ur-${teacher.id}-wali`, teacher.user_id]
      );
      this.db.execute(
        `INSERT OR REPLACE INTO teacher_assignments
         (id, teacher_id, academic_year_id, assignment_role, rombel_id, start_date, is_active)
         VALUES (?, ?, 'ay-2026-2027-1', 'GURU_WALI', ?, ?, 1)`,
        [`ta-${teacher.id}-wali`, teacher.id, rmb.id, todayDateStr]
      );

      return { status: 'ok', teacher_id: teacher.id, rombel_id: rmb.id };
    });
  }

  public getClassesAndRombels() {
    const classes = this.db.queryAll<any>(
      `SELECT c.id, c.name, c.grade_level, c.walas_teacher_id, c.walas_name, c.created_at,
              COUNT(s.id) AS student_count
       FROM classes c
       LEFT JOIN students s ON s.class_name = c.name AND s.account_status = 'ACTIVE'
       WHERE c.is_active = 1
       GROUP BY c.id, c.name, c.grade_level, c.walas_teacher_id, c.walas_name, c.created_at
       ORDER BY c.name ASC`
    );

    const rombels = this.db.queryAll<any>(
      `SELECT r.id, r.name, r.description, r.wali_teacher_id, r.wali_name, r.created_at,
              COUNT(s.id) AS student_count
       FROM rombels r
       LEFT JOIN students s ON s.rombel_name = r.name AND s.account_status = 'ACTIVE'
       WHERE r.is_active = 1
       GROUP BY r.id, r.name, r.description, r.wali_teacher_id, r.wali_name, r.created_at
       ORDER BY r.name ASC`
    );

    const cohorts = this.getCohorts();

    return { classes, rombels, cohorts };
  }

  public saveClass(rawBody: any, actor?: AuthSessionContext | null) {
    const name = String(rawBody.name || '').trim();
    if (!name) throw new ValidationError('Nama kelas wajib diisi.');
    const classId = this.ensureClassExists(name, rawBody.walas_name, rawBody.walas_teacher_id);
    this.audit.log({
      actor_user_id: actor?.userId || null,
      actor_username: actor?.username || 'admin',
      actor_role: actor?.activeRole || 'SUPER_ADMIN',
      action: 'CLASS_UPSERT',
      entity_type: 'classes',
      entity_id: classId,
    });
    return { status: 'ok', id: classId, name };
  }

  public deleteClass(classId: string, actor?: AuthSessionContext | null) {
    return this.db.transaction(() => {
      const targetClass = this.db.queryOne<any>(`SELECT * FROM classes WHERE id = ? OR name = ?`, [classId, classId]);
      if (targetClass) {
        this.db.execute(`UPDATE students SET class_id = NULL, class_name = '-' WHERE class_id = ? OR class_name = ?`, [targetClass.id, targetClass.name]);
        this.db.execute(`UPDATE journals SET class_id_snapshot = NULL WHERE class_id_snapshot = ?`, [targetClass.id]);
        this.db.execute(`DELETE FROM student_class_memberships WHERE class_id = ?`, [targetClass.id]);
        this.db.execute(`DELETE FROM teacher_assignments WHERE class_id = ?`, [targetClass.id]);
        this.db.execute(`UPDATE teachers SET class_name = NULL WHERE class_name = ?`, [targetClass.name]);
        this.db.execute(`DELETE FROM classes WHERE id = ?`, [targetClass.id]);
      }
      this.audit.log({
        actor_user_id: actor?.userId || null,
        actor_username: actor?.username || 'admin',
        actor_role: actor?.activeRole || 'SUPER_ADMIN',
        action: 'CLASS_DELETE',
        entity_type: 'classes',
        entity_id: classId,
      });
      return { status: 'ok', id: classId };
    });
  }

  public deleteRombel(rombelId: string, actor?: AuthSessionContext | null) {
    return this.db.transaction(() => {
      const targetRombel = this.db.queryOne<any>(`SELECT * FROM rombels WHERE id = ? OR name = ?`, [rombelId, rombelId]);
      if (targetRombel) {
        this.db.execute(
          `UPDATE students
           SET rombel_id = NULL, rombel_name = '-', wali_name = NULL, wali_id = NULL
           WHERE rombel_id = ? OR rombel_name = ?
              OR (wali_name IS NOT NULL AND (wali_name = ? OR wali_name = ?))
              OR (wali_id IS NOT NULL AND (wali_id = ? OR wali_id = ?))`,
          [
            targetRombel.id,
            targetRombel.name,
            targetRombel.wali_name || targetRombel.name,
            targetRombel.name,
            targetRombel.wali_teacher_id || targetRombel.id,
            targetRombel.id,
          ]
        );
        this.db.execute(`UPDATE journals SET rombel_id_snapshot = NULL WHERE rombel_id_snapshot = ?`, [targetRombel.id]);
        this.db.execute(`DELETE FROM student_rombel_memberships WHERE rombel_id = ?`, [targetRombel.id]);
        this.db.execute(`DELETE FROM teacher_assignments WHERE rombel_id = ?`, [targetRombel.id]);
        if (targetRombel.wali_teacher_id) {
          this.db.execute(`UPDATE teachers SET rombel_name = NULL WHERE id = ?`, [targetRombel.wali_teacher_id]);
        }
        this.db.execute(`DELETE FROM rombels WHERE id = ?`, [targetRombel.id]);
      }
      this.audit.log({
        actor_user_id: actor?.userId || null,
        actor_username: actor?.username || 'admin',
        actor_role: actor?.activeRole || 'SUPER_ADMIN',
        action: 'ROMBEL_DELETE',
        entity_type: 'rombels',
        entity_id: rombelId,
      });
      return { status: 'ok', id: rombelId };
    });
  }

  public saveRombel(rawBody: any, actor?: AuthSessionContext | null) {
    const name = String(rawBody.name || '').trim();
    if (!name) throw new ValidationError('Nama rombel wajib diisi.');
    const rombelId = this.ensureRombelExists(
      name,
      rawBody.description,
      rawBody.wali_name,
      rawBody.wali_teacher_id
    );
    this.audit.log({
      actor_user_id: actor?.userId || null,
      actor_username: actor?.username || 'admin',
      actor_role: actor?.activeRole || 'SUPER_ADMIN',
      action: 'ROMBEL_UPSERT',
      entity_type: 'rombels',
      entity_id: rombelId || name,
    });
    return { status: 'ok', id: rombelId, name };
  }

  /**
   * Moves a student to a new Class and/or Rombel while preserving 100% of their
   * historical journals, habit entries, points, and streaks, and recording the
   * membership transition in `student_class_memberships` and `student_rombel_memberships`.
   */
  public moveStudentGroup(
    studentId: string,
    targetClassName: string | undefined,
    targetRombelName: string | undefined,
    todayDateStr: string,
    actor?: AuthSessionContext | null,
    reason = 'Mutasi penempatan kelas/rombel oleh Admin'
  ) {
    const student = this.db.queryOne<any>(`SELECT * FROM students WHERE id = ?`, [studentId]);
    if (!student) {
      throw new NotFoundError(`Siswa '${studentId}' tidak ditemukan.`);
    }

    return this.db.transaction(() => {
      let newClassId = student.class_id;
      let newClassName = student.class_name;
      if (targetClassName !== undefined) {
        const cleanClass = targetClassName.trim();
        if (cleanClass === '-' || cleanClass === '') {
          newClassName = '-';
          newClassId = null;
          this.db.execute(
            `UPDATE student_class_memberships SET is_current = 0, end_date = ? WHERE student_id = ? AND is_current = 1`,
            [todayDateStr, studentId]
          );
        } else if (cleanClass !== student.class_name) {
          newClassName = cleanClass;
          newClassId = this.ensureClassExists(newClassName);

          this.db.execute(
            `UPDATE student_class_memberships SET is_current = 0, end_date = ? WHERE student_id = ? AND is_current = 1`,
            [todayDateStr, studentId]
          );
          this.db.execute(
            `INSERT INTO student_class_memberships
             (id, student_id, class_id, class_name, academic_year_id, start_date, is_current, move_reason, changed_by)
             VALUES (?, ?, ?, ?, 'ay-2026-2027-1', ?, 1, ?, ?)`,
            [
              `scm-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
              studentId,
              newClassId,
              newClassName,
              todayDateStr,
              reason,
              actor?.userId || null,
            ]
          );
        }
      }

      let newRombelId = student.rombel_id;
      let newRombelName = student.rombel_name;
      let newWaliName = student.wali_name;
      let newWaliId = student.wali_id;

      if (targetRombelName !== undefined) {
        const cleanRombel = targetRombelName.trim();
        if (cleanRombel === '-' || cleanRombel === '') {
          newRombelName = '-';
          newRombelId = null;
          newWaliName = null;
          newWaliId = null;
          this.db.execute(
            `UPDATE student_rombel_memberships SET is_current = 0, end_date = ? WHERE student_id = ? AND is_current = 1`,
            [todayDateStr, studentId]
          );
        } else if (cleanRombel !== student.rombel_name && cleanRombel !== student.wali_name) {
          newRombelName = cleanRombel;
          newRombelId = this.ensureRombelExists(newRombelName);

          const rombelRow = newRombelId
            ? this.db.queryOne<any>(`SELECT * FROM rombels WHERE id = ?`, [newRombelId])
            : null;
          newWaliName = rombelRow?.wali_name || cleanRombel;
          newWaliId = rombelRow?.wali_teacher_id || null;

          this.db.execute(
            `UPDATE student_rombel_memberships SET is_current = 0, end_date = ? WHERE student_id = ? AND is_current = 1`,
            [todayDateStr, studentId]
          );
          if (newRombelId) {
            this.db.execute(
              `INSERT INTO student_rombel_memberships
               (id, student_id, rombel_id, rombel_name, academic_year_id, start_date, is_current, move_reason, changed_by)
               VALUES (?, ?, ?, ?, 'ay-2026-2027-1', ?, 1, ?, ?)`,
              [
                `srm-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
                studentId,
                newRombelId,
                newRombelName,
                todayDateStr,
                reason,
                actor?.userId || null,
              ]
            );
          }
        }
      }

      this.db.execute(
        `UPDATE students
         SET class_id = ?, class_name = ?, rombel_id = ?, rombel_name = ?, wali_name = ?, wali_id = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [newClassId, newClassName, newRombelId, newRombelName, newWaliName, newWaliId, studentId]
      );

      this.audit.log({
        actor_user_id: actor?.userId || null,
        actor_username: actor?.username || 'admin',
        actor_role: actor?.activeRole || 'SUPER_ADMIN',
        action: 'STUDENT_MOVE_GROUP',
        entity_type: 'students',
        entity_id: studentId,
        before_state: { class_name: student.class_name, rombel_name: student.rombel_name },
        after_state: { class_name: newClassName, rombel_name: newRombelName },
        reason,
      });

      return {
        status: 'ok',
        student_id: studentId,
        class_name: newClassName,
        rombel_name: newRombelName,
      };
    });
  }

  public saveTeacherNotes(
    studentId: string,
    walasNotes: string,
    walasRecommendation: string,
    actor?: AuthSessionContext | null
  ) {
    this.db.execute(
      `UPDATE students SET walas_notes = ?, walas_recommendation = ?, updated_at = datetime('now') WHERE id = ?`,
      [walasNotes || '', walasRecommendation || '', studentId]
    );
    this.audit.log({
      actor_user_id: actor?.userId || null,
      actor_username: actor?.username || 'walas',
      actor_role: actor?.activeRole || 'GURU_WALAS',
      action: 'WALAS_NOTES_SAVE',
      entity_type: 'students',
      entity_id: studentId,
      after_state: { walas_notes: walasNotes, walas_recommendation: walasRecommendation },
    });
    return { status: 'ok', student_id: studentId };
  }
}
