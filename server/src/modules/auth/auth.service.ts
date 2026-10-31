/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Authentication & Session Management Service — VERTIKAL SMA JAWARA 28
 */

import crypto from 'node:crypto';
import { RelationalDatabase } from '../../database/client.ts';
import { env } from '../../config/env.ts';
import {
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  hashPassword,
} from '../../shared/utilities/password.ts';
import {
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  NotFoundError,
} from '../../shared/errors/app-error.ts';
import { AuditService } from '../audit/audit.service.ts';

export type RoleCode = 'SISWA' | 'GURU_WALAS' | 'GURU_WALI' | 'TIM_7_KAIH' | 'SUPER_ADMIN';

export interface AuthSessionContext {
  sessionId: string;
  userId: string;
  username: string;
  fullName: string;
  activeRole: RoleCode;
  roles: RoleCode[];
  permissions: string[];
  studentId?: string;
  studentClass?: string;
  studentRombel?: string;
  teacherId?: string;
  assignedClassNames: string[];
  assignedRombelNames: string[];
}

export class AuthService {
  private readonly db: RelationalDatabase;
  private readonly audit: AuditService;

  constructor(db: RelationalDatabase) {
    this.db = db;
    this.audit = new AuditService(db);
  }

  public login(params: {
    username: string;
    password: string;
    roleCategory?: 'siswa' | 'guru' | 'admin';
    ipAddress?: string;
    userAgent?: string;
  }) {
    const cleanUser = String(params.username || '').trim().toLowerCase();
    const cleanPass = String(params.password || '');

    if (!cleanUser || !cleanPass) {
      throw new ValidationError('Username dan kata sandi wajib diisi.');
    }

    // Lookup user by username, NISN, or NIP
    let userRow = this.db.queryOne<any>(
      `SELECT * FROM users WHERE lower(username) = ?`,
      [cleanUser]
    );

    if (!userRow) {
      const studentByNisn = this.db.queryOne<any>(
        `SELECT user_id FROM students WHERE lower(nisn) = ? OR lower(id) = ?`,
        [cleanUser, `std-${cleanUser}`]
      );
      if (studentByNisn) {
        userRow = this.db.queryOne<any>(`SELECT * FROM users WHERE id = ?`, [studentByNisn.user_id]);
      }
    }

    if (!userRow) {
      const teacherByNip = this.db.queryOne<any>(
        `SELECT user_id FROM teachers WHERE lower(nip) = ? OR lower(id) = ?`,
        [cleanUser, `tch-${cleanUser}`]
      );
      if (teacherByNip) {
        userRow = this.db.queryOne<any>(`SELECT * FROM users WHERE id = ?`, [teacherByNip.user_id]);
      }
    }

    if (!userRow) {
      this.audit.log({
        actor_username: cleanUser,
        action: 'AUTH_LOGIN_FAILED',
        entity_type: 'users',
        entity_id: cleanUser,
        reason: 'User tidak ditemukan',
        ip_address: params.ipAddress,
      });
      throw new UnauthorizedError('Username atau Kata Sandi salah.');
    }

    if (userRow.account_status !== 'ACTIVE') {
      this.audit.log({
        actor_user_id: userRow.id,
        actor_username: userRow.username,
        action: 'AUTH_LOGIN_BLOCKED_INACTIVE',
        entity_type: 'users',
        entity_id: userRow.id,
        reason: `Status akun: ${userRow.account_status}`,
        ip_address: params.ipAddress,
      });
      throw new ForbiddenError(`Akun tidak aktif (Status: ${userRow.account_status}). Hubungi Admin Sekolah.`);
    }

    const isPasswordValid = verifyPassword(cleanPass, userRow.password_hash);
    if (!isPasswordValid) {
      this.db.execute(
        `UPDATE users SET failed_login_attempts = failed_login_attempts + 1, updated_at = datetime('now') WHERE id = ?`,
        [userRow.id]
      );
      this.audit.log({
        actor_user_id: userRow.id,
        actor_username: userRow.username,
        action: 'AUTH_LOGIN_FAILED',
        entity_type: 'users',
        entity_id: userRow.id,
        reason: 'Kata sandi tidak cocok',
        ip_address: params.ipAddress,
      });
      throw new UnauthorizedError('Username atau Kata Sandi salah.');
    }

    // Load assigned roles
    const userRoleRows = this.db.queryAll<{ code: RoleCode; scope_type: string; scope_id: string }>(
      `SELECT r.code, ur.scope_type, ur.scope_id
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ? AND ur.is_active = 1`,
      [userRow.id]
    );

    const roleCodes = Array.from(new Set(userRoleRows.map((r) => r.code)));

    // Guarantee admin account or assignment_type === 'ADMIN' always has SUPER_ADMIN role
    const teacherAdmin = this.db.queryOne<any>(
      `SELECT assignment_type FROM teachers WHERE user_id = ?`,
      [userRow.id]
    );
    if (
      cleanUser === 'admin' ||
      userRow.username.toLowerCase() === 'admin' ||
      teacherAdmin?.assignment_type === 'ADMIN'
    ) {
      if (!roleCodes.includes('SUPER_ADMIN')) {
        roleCodes.push('SUPER_ADMIN');
      }
      this.db.execute(
        `INSERT OR IGNORE INTO user_roles (id, user_id, role_id, scope_type, scope_id, is_active)
         VALUES (?, ?, 'role-super-admin', 'GLOBAL', 'GLOBAL', 1)`,
        [`ur-${userRow.id}-superadmin`, userRow.id]
      );
    }

    // Verify role category match
    if (params.roleCategory === 'admin') {
      if (!roleCodes.includes('SUPER_ADMIN') && !roleCodes.includes('TIM_7_KAIH')) {
        throw new ForbiddenError('Akun ini tidak memiliki otorisasi Control Panel Admin (/admin).');
      }
    } else if (params.roleCategory === 'siswa') {
      if (!roleCodes.includes('SISWA')) {
        throw new ForbiddenError('Akun ini bukan akun Siswa.');
      }
    } else if (params.roleCategory === 'guru') {
      const hasTeacherRole = roleCodes.some((r) =>
        ['GURU_WALAS', 'GURU_WALI', 'TIM_7_KAIH', 'SUPER_ADMIN'].includes(r)
      );
      if (!hasTeacherRole) {
        throw new ForbiddenError('Akun ini bukan akun Guru/Pendidik.');
      }
    }

    const activeRole: RoleCode =
      params.roleCategory === 'admin'
        ? roleCodes.includes('SUPER_ADMIN')
          ? 'SUPER_ADMIN'
          : 'TIM_7_KAIH'
        : params.roleCategory === 'siswa'
        ? 'SISWA'
        : roleCodes[0] || 'SISWA';

    // Create DB session
    const { rawToken, tokenHash } = generateSessionToken();
    const sessionId = `ses-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const expiresAt = new Date(Date.now() + env.sessionTtlHours * 3600 * 1000).toISOString();

    this.db.transaction(() => {
      this.db.execute(
        `UPDATE users SET failed_login_attempts = 0, last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
        [userRow.id]
      );
      this.db.execute(
        `INSERT INTO sessions (id, user_id, token_hash, active_role, ip_address, user_agent, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          sessionId,
          userRow.id,
          tokenHash,
          activeRole,
          params.ipAddress || '127.0.0.1',
          params.userAgent || 'Jawara28-Client',
          expiresAt,
        ]
      );
      this.audit.log({
        actor_user_id: userRow.id,
        actor_username: userRow.username,
        actor_role: activeRole,
        action: 'AUTH_LOGIN_SUCCESS',
        entity_type: 'sessions',
        entity_id: sessionId,
        ip_address: params.ipAddress,
      });
    });

    // Build profile data matching frontend expectation
    if (activeRole === 'SISWA') {
      const student = this.db.queryOne<any>(
        `SELECT id, user_id, nisn, nis, name, gender, religion, angkatan, cohort_id, class_name, rombel_name,
                xp, poin_hebat, level, streak, best_streak, predicate, walas_notes, walas_recommendation,
                avatar_url, account_status, created_at
         FROM students WHERE user_id = ?`,
        [userRow.id]
      );
      return {
        status: 'ok',
        role: 'siswa',
        active_role: activeRole,
        roles: roleCodes,
        token: rawToken,
        expires_at: expiresAt,
        data: {
          ...student,
          username: userRow.username,
        },
      };
    } else {
      const teacher = this.db.queryOne<any>(
        `SELECT id, user_id, nip, name, gender, phone, role_title AS role, assignment_type,
                roles_csv, class_name, rombel_name, avatar_url, account_status, created_at
         FROM teachers WHERE user_id = ?`,
        [userRow.id]
      );
      const rolesArr = (teacher?.roles_csv || '').split(',').map((s: string) => s.trim());
      const isWalas = rolesArr.includes('WALAS') || teacher?.assignment_type === 'WALAS';
      const isWali = rolesArr.includes('WALI') || teacher?.assignment_type === 'GURU_WALI';
      const isTim7Kaih = rolesArr.includes('TIM_7_KAIH') || teacher?.assignment_type === 'TIM_7_KAIH';
      const isAdmin = rolesArr.includes('ADMIN') || teacher?.assignment_type === 'ADMIN' || roleCodes.includes('SUPER_ADMIN');

      return {
        status: 'ok',
        role: params.roleCategory === 'admin' ? 'admin' : 'guru',
        active_role: activeRole,
        roles: roleCodes,
        token: rawToken,
        expires_at: expiresAt,
        data: {
          ...teacher,
          is_walas: isWalas,
          is_wali: isWali,
          is_tim_7_kaih: isTim7Kaih,
          is_admin: isAdmin,
          username: userRow.username,
        },
      };
    }
  }

  public verifySessionToken(rawToken: string): AuthSessionContext {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new UnauthorizedError('Token sesi tidak ditemukan.');
    }

    const cleanToken = rawToken.replace(/^Bearer\s+/i, '').trim();
    if (!cleanToken) {
      throw new UnauthorizedError('Format Bearer token tidak valid.');
    }

    const tokenHash = hashSessionToken(cleanToken);
    const sessionRow = this.db.queryOne<any>(
      `SELECT s.id AS session_id, s.user_id, s.active_role, s.expires_at, s.revoked_at,
              u.username, u.full_name, u.account_status
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
      [tokenHash]
    );

    if (!sessionRow) {
      throw new UnauthorizedError('Sesi tidak ditemukan atau tidak sah.');
    }

    if (sessionRow.revoked_at) {
      throw new UnauthorizedError('Sesi telah dicabut (logged out). Silakan login kembali.');
    }

    if (new Date(sessionRow.expires_at).getTime() <= Date.now()) {
      throw new UnauthorizedError('Sesi telah kedaluwarsa (expired). Silakan login kembali.');
    }

    if (sessionRow.account_status !== 'ACTIVE') {
      throw new ForbiddenError('Akun pengguna sudah tidak aktif.');
    }

    const roleRows = this.db.queryAll<{ code: RoleCode; scope_type: string; scope_id: string }>(
      `SELECT r.code, ur.scope_type, ur.scope_id
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ? AND ur.is_active = 1`,
      [sessionRow.user_id]
    );
    const roles = Array.from(new Set(roleRows.map((r) => r.code)));

    const permRows = this.db.queryAll<{ code: string }>(
      `SELECT DISTINCT p.code
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = ? AND ur.is_active = 1`,
      [sessionRow.user_id]
    );
    const permissions = permRows.map((p) => p.code);

    const assignedClassNames: string[] = [];
    const assignedRombelNames: string[] = [];

    for (const r of roleRows) {
      if (r.scope_type === 'CLASS' && r.scope_id) assignedClassNames.push(r.scope_id);
      if (r.scope_type === 'ROMBEL' && r.scope_id) assignedRombelNames.push(r.scope_id);
    }

    let studentId: string | undefined;
    let studentClass: string | undefined;
    let studentRombel: string | undefined;
    const studentRow = this.db.queryOne<any>(
      `SELECT id, class_name, rombel_name FROM students WHERE user_id = ?`,
      [sessionRow.user_id]
    );
    if (studentRow) {
      studentId = studentRow.id;
      studentClass = studentRow.class_name;
      studentRombel = studentRow.rombel_name;
    }

    let teacherId: string | undefined;
    const teacherRow = this.db.queryOne<any>(
      `SELECT id, class_name, rombel_name FROM teachers WHERE user_id = ?`,
      [sessionRow.user_id]
    );
    if (teacherRow) {
      teacherId = teacherRow.id;
      if (teacherRow.class_name && !assignedClassNames.includes(teacherRow.class_name)) {
        assignedClassNames.push(teacherRow.class_name);
      }
      if (teacherRow.rombel_name && !assignedRombelNames.includes(teacherRow.rombel_name)) {
        assignedRombelNames.push(teacherRow.rombel_name);
      }
    }

    return {
      sessionId: sessionRow.session_id,
      userId: sessionRow.user_id,
      username: sessionRow.username,
      fullName: sessionRow.full_name,
      activeRole: sessionRow.active_role as RoleCode,
      roles,
      permissions,
      studentId,
      studentClass,
      studentRombel,
      teacherId,
      assignedClassNames,
      assignedRombelNames,
    };
  }

  public revokeSession(rawToken: string, reason = 'USER_LOGOUT'): void {
    const cleanToken = String(rawToken || '').replace(/^Bearer\s+/i, '').trim();
    if (!cleanToken) return;
    const tokenHash = hashSessionToken(cleanToken);
    this.db.execute(
      `UPDATE sessions SET revoked_at = datetime('now'), revoked_reason = ? WHERE token_hash = ?`,
      [reason, tokenHash]
    );
  }

  public changePassword(params: {
    userId: string;
    currentPassword?: string;
    newPassword: string;
    skipCurrentCheck?: boolean;
  }) {
    const userRow = this.db.queryOne<any>(`SELECT * FROM users WHERE id = ?`, [params.userId]);
    if (!userRow) throw new NotFoundError('Pengguna tidak ditemukan.');
    if (!params.skipCurrentCheck && params.currentPassword) {
      const ok = verifyPassword(params.currentPassword, userRow.password_hash);
      if (!ok) throw new ValidationError('Kata sandi saat ini tidak cocok.');
    }
    if (!params.newPassword || params.newPassword.trim().length < 3) {
      throw new ValidationError('Kata sandi baru minimal 3 karakter.');
    }
    const cleanNew = params.newPassword.trim();
    const newHash = hashPassword(cleanNew);
    this.db.execute(
      `UPDATE users SET password_hash = ?, plain_password = ?, updated_at = datetime('now') WHERE id = ?`,
      [newHash, cleanNew, params.userId]
    );
    this.audit.log({
      actor_user_id: userRow.id,
      actor_username: userRow.username,
      action: 'USER_PASSWORD_CHANGE',
      entity_type: 'users',
      entity_id: userRow.id,
    });
    return { status: 'ok', message: 'Kata sandi berhasil diperbarui.' };
  }
}
