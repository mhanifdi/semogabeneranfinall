/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Least-Privilege Authorization (RBAC & Scope Enforcement) — VERTIKAL SMA JAWARA 28
 * Enforces role permissions and strict data scope boundaries (Self, Class, Rombel, School)
 * on the backend so manipulating URL/body IDs is always blocked with 403 Forbidden.
 */

import { RelationalDatabase } from '../database/client.ts';
import type { AuthSessionContext, RoleCode } from '../modules/auth/auth.service.ts';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../shared/errors/app-error.ts';

export function assertAuthenticated(auth: AuthSessionContext | null): asserts auth is AuthSessionContext {
  if (!auth) {
    throw new UnauthorizedError('Anda harus login terlebih dahulu untuk mengakses endpoint ini.');
  }
}

export function assertHasAnyRole(auth: AuthSessionContext | null, allowedRoles: RoleCode[]): void {
  assertAuthenticated(auth);
  const matched = auth.roles.some((r) => allowedRoles.includes(r));
  if (!matched) {
    throw new ForbiddenError(
      `Akses ditolak: Endpoint ini memerlukan salah satu peran [${allowedRoles.join(', ')}], sedangkan peran Anda adalah [${auth.roles.join(', ')}].`
    );
  }
}

export function assertHasPermission(auth: AuthSessionContext | null, permissionCode: string): void {
  assertAuthenticated(auth);
  if (auth.roles.includes('SUPER_ADMIN')) return;
  if (!auth.permissions.includes(permissionCode)) {
    throw new ForbiddenError(
      `Akses ditolak: Izin '${permissionCode}' tidak dimiliki oleh akun '${auth.username}'.`
    );
  }
}

/**
 * Ensures a student can ONLY read/write their own student_id, and a Guru Walas / Guru Wali
 * can ONLY access students belonging to their assigned Class or Rombel.
 */
export function assertStudentAccessScope(
  auth: AuthSessionContext | null,
  targetStudentId: string,
  db: RelationalDatabase,
  mode: 'READ' | 'WRITE_SELF' | 'WRITE_WALAS'
): void {
  assertAuthenticated(auth);

  // Super Admin & Tim 7 KAIH have school-wide read access
  if (mode === 'READ' && (auth.roles.includes('SUPER_ADMIN') || auth.roles.includes('TIM_7_KAIH'))) {
    return;
  }

  // Siswa: Strictly restricted to their own studentId
  if (auth.roles.includes('SISWA')) {
    if (mode === 'WRITE_WALAS') {
      throw new ForbiddenError('Siswa tidak diizinkan mengubah catatan Wali Kelas.');
    }
    if (auth.studentId !== targetStudentId) {
      throw new ForbiddenError(
        `Pelanggaran Otorisasi (IDOR): Siswa '${auth.studentId}' dilarang mengakses atau memodifikasi data siswa '${targetStudentId}'.`
      );
    }
    return;
  }

  // Student self-submission endpoint called by non-student
  if (mode === 'WRITE_SELF' && !auth.roles.includes('SUPER_ADMIN')) {
    throw new ForbiddenError('Hanya pemilik akun Siswa yang dapat mengisi jurnal harian dirinya sendiri.');
  }

  const targetStudent = db.queryOne<{ id: string; class_name: string; rombel_name: string }>(
    `SELECT id, class_name, rombel_name FROM students WHERE id = ?`,
    [targetStudentId]
  );
  if (!targetStudent) {
    throw new NotFoundError(`Siswa '${targetStudentId}' tidak ditemukan.`);
  }

  if (auth.roles.includes('SUPER_ADMIN') || auth.roles.includes('TIM_7_KAIH')) {
    return;
  }

  const canAccessByClass =
    auth.roles.includes('GURU_WALAS') &&
    auth.assignedClassNames.includes(targetStudent.class_name);

  const canAccessByRombel =
    mode === 'READ' &&
    auth.roles.includes('GURU_WALI') &&
    Boolean(targetStudent.rombel_name) &&
    auth.assignedRombelNames.includes(targetStudent.rombel_name);

  if (!canAccessByClass && !canAccessByRombel) {
    throw new ForbiddenError(
      `Akses ditolak: Guru '${auth.username}' tidak memiliki penugasan pada kelas '${targetStudent.class_name}' maupun rombel '${targetStudent.rombel_name || '-'}'.`
    );
  }
}

/**
 * Ensures Guru Wali Kelas can only access their assigned class.
 */
export function assertClassAccessScope(auth: AuthSessionContext | null, targetClassName: string): void {
  assertAuthenticated(auth);
  if (auth.roles.includes('SUPER_ADMIN') || auth.roles.includes('TIM_7_KAIH')) {
    return;
  }
  if (!auth.roles.includes('GURU_WALAS')) {
    throw new ForbiddenError('Akses ditolak: Hanya Guru Wali Kelas, Tim 7 KAIH, atau Super Admin yang dapat melihat analitik kelas.');
  }
  if (!auth.assignedClassNames.includes(targetClassName)) {
    throw new ForbiddenError(
      `Pelanggaran Scope Kelas: Wali Kelas '${auth.username}' hanya ditugaskan pada kelas [${auth.assignedClassNames.join(', ')}] dan dilarang mengakses kelas '${targetClassName}'.`
    );
  }
}

/**
 * Ensures Guru Wali can only access their assigned rombel.
 */
export function assertRombelAccessScope(auth: AuthSessionContext | null, targetRombelName: string): void {
  assertAuthenticated(auth);
  if (auth.roles.includes('SUPER_ADMIN') || auth.roles.includes('TIM_7_KAIH')) {
    return;
  }
  if (!auth.roles.includes('GURU_WALI')) {
    throw new ForbiddenError('Akses ditolak: Hanya Guru Wali (Pendamping Rombel), Tim 7 KAIH, atau Super Admin yang dapat melihat analitik rombel.');
  }
  if (!auth.assignedRombelNames.includes(targetRombelName)) {
    throw new ForbiddenError(
      `Pelanggaran Scope Rombel: Guru Wali '${auth.username}' hanya ditugaskan pada rombel [${auth.assignedRombelNames.join(', ')}] dan dilarang mengakses rombel '${targetRombelName}'.`
    );
  }
}
