/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Explicit Database Seeding Script — VERTIKAL SMA JAWARA 28
 *
 * Separates:
 * 1. Production Bootstrap (`seedProductionAdmin`): Creates only the initial Super Admin
 *    and reference catalogs if no admin exists yet.
 * 2. Development / Test Demo Seeding (`seedDevelopmentDemoData`): Explicitly seeds
 *    default educators, classes, rombels, and students with `scrypt` password hashes.
 */

import { RelationalDatabase, getDb } from './client.ts';
import { env } from '../config/env.ts';
import { UsersAcademicService } from '../modules/users/users-academic.service.ts';

export function seedProductionAdmin(db: RelationalDatabase, todayDateStr = '2026-10-27'): void {
  db.runMigrations();
  const svc = new UsersAcademicService(db);

  const existingAdmin = db.queryOne<{ id: string }>(
    `SELECT id FROM teachers WHERE id = 'adm-admin' OR nip = '197501012000031001'`
  );
  if (!existingAdmin) {
    svc.saveTeacher(
      {
        id: 'adm-admin',
        username: 'admin',
        password: process.env.INITIAL_ADMIN_PASSWORD || '123',
        nip: '197501012000031001',
        name: 'Drs. H. Ubaidillah, M.M.',
        role: 'Super Admin & Koordinator Tim 7 KAIH',
        assignment_type: 'ADMIN',
        class_name: 'Seluruh Kelas',
        rombel_name: 'Seluruh Rombel',
        account_status: 'ACTIVE',
      },
      todayDateStr
    );
  }
}

export function seedDevelopmentDemoData(db: RelationalDatabase, todayDateStr = '2026-10-27'): void {
  seedProductionAdmin(db, todayDateStr);
  const svc = new UsersAcademicService(db);

  // 1. Default Classes & Rombels
  svc.ensureClassExists('XI-MIPA-1', 'Dra. Hj. Nurhidayah, M.Pd.', 'tch-guru');
  svc.ensureClassExists('XI-MIPA-2', 'Bpk. Budi Santoso, M.Pd.');
  svc.ensureClassExists('XI-IPS-1', 'Ibu Siti Aminah, S.Pd.');
  svc.ensureClassExists('X-MIPA-1', 'Bpk. Agus Salim, S.Pd.');
  svc.ensureClassExists('XII-MIPA-1', 'Ibu Dewi Sartika, M.Si.');

  svc.ensureRombelExists(
    'Rombel Sains & Riset A',
    'Kelompok Pendampingan Sains & Riset Lintas Kelas A',
    'Bpk. Hendra Wijaya, S.Pd.',
    'tch-wali'
  );
  svc.ensureRombelExists(
    'Rombel Sosial & Humaniora B',
    'Kelompok Pendampingan Sosial & Humaniora Lintas Kelas B',
    'Ibu Rina Marlina, M.Pd.'
  );
  svc.ensureRombelExists(
    'Rombel Teknologi & Inovasi C',
    'Kelompok Pendampingan Teknologi & Inovasi Lintas Kelas C',
    'Bpk. Dedi Kurniawan, S.Kom.'
  );

  // 2. Default Educators (Guru Walas, Guru Wali, Tim 7 KAIH)
  const demoTeachers = [
    {
      id: 'tch-guru',
      username: 'guru',
      password: '123',
      nip: '198005152005012003',
      name: 'Dra. Hj. Nurhidayah, M.Pd.',
      role: 'Wali Kelas XI-MIPA-1',
      assignment_type: 'WALAS',
      class_name: 'XI-MIPA-1',
      rombel_name: 'Rombel Sains & Riset A',
      account_status: 'ACTIVE',
    },
    {
      id: 'tch-wali',
      username: 'wali',
      password: '123',
      nip: '198408122009021004',
      name: 'Bpk. Hendra Wijaya, S.Pd.',
      role: 'Guru Wali Rombel Sains & Riset A',
      assignment_type: 'GURU_WALI',
      class_name: '',
      rombel_name: 'Rombel Sains & Riset A',
      account_status: 'ACTIVE',
    },
    {
      id: 'tch-tim7kaih',
      username: 'tim7kaih',
      password: '123',
      nip: '197911202006042002',
      name: 'Ibu Dra. Ratna Sari, M.Pd.',
      role: 'Koordinator Tim 7 KAIH',
      assignment_type: 'TIM_7_KAIH',
      class_name: 'Seluruh Kelas',
      rombel_name: 'Seluruh Rombel',
      account_status: 'ACTIVE',
    },
  ];

  for (const t of demoTeachers) {
    const exists = db.queryOne<{ id: string }>(`SELECT id FROM teachers WHERE id = ?`, [t.id]);
    if (!exists) {
      svc.saveTeacher(t, todayDateStr);
    }
  }

  // 3. Default Students (if not already migrated)
  const demoStudents = [
    {
      id: 'std-siswa',
      username: 'siswa',
      password: '123',
      nisn: '0081234501',
      name: 'Ahmad Fauzi (Putra Islam)',
      gender: 'L',
      religion: 'Islam',
      class_name: 'XI-MIPA-1',
      rombel_name: 'Rombel Sains & Riset A',
      account_status: 'ACTIVE',
    },
    {
      id: 'std-siswai',
      username: 'siswai',
      password: '123',
      nisn: '0081234502',
      name: 'Siti Aisyah (Putri Islam)',
      gender: 'P',
      religion: 'Islam',
      class_name: 'XI-MIPA-1',
      rombel_name: 'Rombel Sains & Riset A',
      account_status: 'ACTIVE',
    },
    {
      id: 'std-siswak',
      username: 'siswak',
      password: '123',
      nisn: '0081234503',
      name: 'Yohanes Christian (Kristen)',
      gender: 'L',
      religion: 'Kristen',
      class_name: 'XI-MIPA-1',
      rombel_name: 'Rombel Sosial & Humaniora B',
      account_status: 'ACTIVE',
    },
    {
      id: 'std-siswah',
      username: 'siswah',
      password: '123',
      nisn: '0081234504',
      name: 'Ni Putu Ayu Saraswati (Hindu)',
      gender: 'P',
      religion: 'Hindu',
      class_name: 'XI-MIPA-1',
      rombel_name: 'Rombel Teknologi & Inovasi C',
      account_status: 'ACTIVE',
    },
  ];

  for (const s of demoStudents) {
    const exists = db.queryOne<{ id: string }>(`SELECT id FROM students WHERE id = ?`, [s.id]);
    if (!exists) {
      svc.saveStudent(s, todayDateStr);
    }
  }
}

import path from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const db = getDb();
  if (env.allowDemoSeed) {
    seedDevelopmentDemoData(db);
    console.log('[SEED] Development & reference data seeded successfully.');
  } else {
    seedProductionAdmin(db);
    console.log('[SEED] Production initial admin & reference catalogs seeded successfully.');
  }
}
