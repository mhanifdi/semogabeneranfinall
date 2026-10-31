/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Legacy Database Backup & Relational Migration Script — VERTIKAL SMA JAWARA 28
 *
 * 1. Backs up `database/local_habit.db` (binary copy + JSON dump + SHA-256 checksum).
 * 2. Migrates all legacy `students`, `teachers`, `habit_logs`, and `admin_validations`
 *    into the normalized 35-table relational database (`database/jawara28_relational.db`).
 * 3. Upgrades plain-text passwords ('123') to cryptographic `scrypt` hashes with random 16-byte salts.
 * 4. Normalizes legacy `habit_logs` into `journals`, `habit_entries`, `habit_sessions`,
 *    `habit_components`, `habit_entry_revisions`, `point_transactions`, and `streak_records`.
 * 5. Detects and documents legacy anomalies (`quranPages: 1230` on log #7, `-5` missed penalty on log #10).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { env } from '../config/env.ts';
import { RelationalDatabase, getDb } from './client.ts';
import { seedDevelopmentDemoData } from './seed.ts';
import { UsersAcademicService } from '../modules/users/users-academic.service.ts';
import { JournalsService } from '../modules/journals/journals.service.ts';
import { AnalyticsReportsService } from '../modules/analytics/analytics-reports.service.ts';

export interface MigrationReport {
  timestamp: string;
  sourceDbPath: string;
  targetDbPath: string;
  backupBinaryPath: string;
  backupJsonPath: string;
  backupSha256: string;
  sourceCounts: {
    students: number;
    teachers: number;
    habit_logs: number;
    admin_validations: number;
  };
  migratedCounts: {
    users: number;
    students: number;
    teachers: number;
    classes: number;
    rombels: number;
    journals: number;
    habit_entries: number;
    habit_sessions: number;
    habit_components: number;
    habit_entry_revisions: number;
    point_transactions: number;
    streak_records: number;
    admin_validations: number;
  };
  anomaliesDetectedAndHandled: {
    legacyLogId: number;
    studentId: string;
    logDate: string;
    habitType: string;
    issue: string;
    resolution: string;
  }[];
}

export function runLegacyBackupAndMigration(customTargetDb?: RelationalDatabase): MigrationReport {
  const sourcePath = env.legacySqliteDbPath;
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`File database lama tidak ditemukan di: ${sourcePath}`);
  }

  if (!fs.existsSync(env.backupDirPath)) {
    fs.mkdirSync(env.backupDirPath, { recursive: true });
  }

  // 1. Binary backup + SHA-256 verification
  const backupBinaryPath = path.join(
    env.backupDirPath,
    'local_habit_pre_reengineering_backup.db'
  );
  fs.copyFileSync(sourcePath, backupBinaryPath);
  const fileBuffer = fs.readFileSync(backupBinaryPath);
  const backupSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  // 2. Read all rows from legacy SQLite DB
  const legacyDb = new DatabaseSync(sourcePath, { readOnly: true });
  const legacyStudents = legacyDb.prepare('SELECT * FROM students ORDER BY id ASC').all() as any[];
  const legacyTeachers = legacyDb.prepare('SELECT * FROM teachers ORDER BY id ASC').all() as any[];
  const legacyLogs = legacyDb.prepare('SELECT * FROM habit_logs ORDER BY id ASC').all() as any[];
  const legacyValidations = legacyDb
    .prepare('SELECT * FROM admin_validations ORDER BY id ASC')
    .all() as any[];
  legacyDb.close();

  const backupJsonPath = path.join(
    env.backupDirPath,
    'local_habit_pre_reengineering_dump.json'
  );
  fs.writeFileSync(
    backupJsonPath,
    JSON.stringify(
      {
        backedUpAt: new Date().toISOString(),
        sourcePath,
        sha256: backupSha256,
        tables: {
          students: legacyStudents,
          teachers: legacyTeachers,
          habit_logs: legacyLogs,
          admin_validations: legacyValidations,
        },
      },
      null,
      2
    ),
    'utf-8'
  );

  // 3. Initialize target relational database
  const targetDb = customTargetDb || getDb();
  targetDb.runMigrations();

  const usersSvc = new UsersAcademicService(targetDb);
  const journalsSvc = new JournalsService(targetDb);
  const analyticsSvc = new AnalyticsReportsService(targetDb);
  const todayDateStr = '2026-10-27';

  // Seed base classes, rombels, and default educators
  seedDevelopmentDemoData(targetDb, todayDateStr);

  // 4. Migrate Legacy Teachers
  for (const lt of legacyTeachers) {
    const isAdmin = lt.id === 'adm-admin' || String(lt.role || '').toLowerCase().includes('admin');
    usersSvc.saveTeacher(
      {
        id: lt.id,
        username: lt.username,
        password: lt.password || '123',
        nip: lt.nip,
        name: lt.name,
        role: lt.role,
        assignment_type: isAdmin ? 'ADMIN' : 'WALAS',
        class_name: lt.class_name || 'XI-MIPA-1',
        rombel_name: isAdmin ? 'Seluruh Rombel' : 'Rombel Sains & Riset A',
        avatar_url: lt.avatar_url,
        account_status: 'ACTIVE',
      },
      todayDateStr
    );
  }

  // 5. Migrate Legacy Students
  const rombelDefaultMap: Record<string, string> = {
    'std-siswa': 'Rombel Sains & Riset A',
    'std-siswai': 'Rombel Sains & Riset A',
    'std-siswak': 'Rombel Sosial & Humaniora B',
    'std-siswah': 'Rombel Teknologi & Inovasi C',
  };

  for (const ls of legacyStudents) {
    usersSvc.saveStudent(
      {
        id: ls.id,
        username: ls.username,
        password: ls.password || '123',
        nisn: ls.nisn,
        name: ls.name,
        gender: ls.gender || 'L',
        religion: ls.religion || 'Islam',
        class_name: ls.class_name || 'XI-MIPA-1',
        rombel_name: ls.rombel_name || rombelDefaultMap[ls.id] || 'Rombel Sains & Riset A',
        avatar_url: ls.avatar_url,
        account_status: 'ACTIVE',
      },
      todayDateStr
    );
    if (ls.walas_notes || ls.walas_recommendation) {
      usersSvc.saveTeacherNotes(
        ls.id,
        ls.walas_notes || '',
        ls.walas_recommendation || ''
      );
    }
  }

  // 6. Migrate Legacy `habit_logs` with Anomaly Detection & Normalization
  const anomalies: MigrationReport['anomaliesDetectedAndHandled'] = [];

  for (const log of legacyLogs) {
    let payload: Record<string, any> = {};
    try {
      payload = JSON.parse(log.payload || '{}');
    } catch {
      payload = {};
    }

    // Detect Anomaly #1: quranPages: 1230 on log #7
    if (Number(payload.quranPages) > 30) {
      anomalies.push({
        legacyLogId: Number(log.id),
        studentId: log.student_id,
        logDate: log.log_date,
        habitType: log.habit_type,
        issue: `Input tidak wajar pada payload lama: quranPages=${payload.quranPages}, surahName='${payload.surahName}' dengan rumus kontinu lama (score=${log.score}).`,
        resolution:
          'Dinormalisasi ke skema sesi ibadah (zuhur) sesuai Spesifikasi Final 7 KAIH dan nilai asli disimpan pada riwayat revisi migrasi.',
      });
      payload.legacyAnomalyFlagged = true;
      payload.originalQuranPages = payload.quranPages;
      payload.quranPages = 2;
    }

    // Detect Anomaly #2: -5 missed penalty on log #10 (score 95 on bangun pagi terlewat)
    if (Boolean(log.is_missed) || payload.entryMode === 'terlewat') {
      anomalies.push({
        legacyLogId: Number(log.id),
        studentId: log.student_id,
        logDate: log.log_date,
        habitType: log.habit_type,
        issue: `Entri terlewat lama terkena penalti -5 poin (legacy score=${log.score}).`,
        resolution:
          'Dihapus penalti -5 poin sesuai Spesifikasi Final Bagian 1.4 ("Tidak ada pengurangan nilai sebesar 5 poin karena mengisi secara fleksibel atau terlambat melengkapi jurnal").',
      });
    }

    journalsSvc.submitHabitEntry(
      {
        student_id: log.student_id,
        habit_type: log.habit_type,
        log_date: log.log_date,
        sub_category: log.sub_category || payload.waktuSholat || payload.waktuMakan || '',
        is_counter_entry: Boolean(log.is_counter_entry),
        is_missed: Boolean(log.is_missed),
        overwrite: true,
        payload: {
          ...payload,
          migratedFromLegacyLogId: log.id,
          legacyOriginalScore: log.score,
        },
      },
      todayDateStr
    );
  }

  // 7. Migrate Legacy `admin_validations`
  const existingValCount = targetDb.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM admin_validations`
  );
  if (Number(existingValCount?.cnt || 0) === 0) {
    for (const lv of legacyValidations) {
      analyticsSvc.saveAdminValidation({
        student_id: lv.student_id,
        verification_score: Number(lv.verification_score),
        verified_by: lv.verified_by || 'Tim 7 KAIH',
        notes: lv.notes || '',
      });
    }
  }

  const countTable = (tbl: string) =>
    Number(targetDb.queryOne<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM ${tbl}`)?.cnt || 0);

  const report: MigrationReport = {
    timestamp: new Date().toISOString(),
    sourceDbPath: sourcePath,
    targetDbPath: targetDb.dbPath,
    backupBinaryPath,
    backupJsonPath,
    backupSha256,
    sourceCounts: {
      students: legacyStudents.length,
      teachers: legacyTeachers.length,
      habit_logs: legacyLogs.length,
      admin_validations: legacyValidations.length,
    },
    migratedCounts: {
      users: countTable('users'),
      students: countTable('students'),
      teachers: countTable('teachers'),
      classes: countTable('classes'),
      rombels: countTable('rombels'),
      journals: countTable('journals'),
      habit_entries: countTable('habit_entries'),
      habit_sessions: countTable('habit_sessions'),
      habit_components: countTable('habit_components'),
      habit_entry_revisions: countTable('habit_entry_revisions'),
      point_transactions: countTable('point_transactions'),
      streak_records: countTable('streak_records'),
      admin_validations: countTable('admin_validations'),
    },
    anomaliesDetectedAndHandled: anomalies,
  };

  const reportPath = path.join(env.backupDirPath, 'migration_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  return report;
}

import { pathToFileURL } from 'node:url';

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const report = runLegacyBackupAndMigration();
  console.log('=== LEGACY BACKUP & MIGRATION COMPLETED ===');
  console.log(JSON.stringify(report, null, 2));
}
