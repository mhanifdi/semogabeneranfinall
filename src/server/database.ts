/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Relational SQLite Database Manager for VERTIKAL SMA JAWARA 28
 * Implements full relational schema per Specification & Addendum H:
 * - users, students, teachers, classes, cohorts, rombels
 * - student_class_memberships, student_rombel_memberships, teacher_assignments
 * - habit_definitions, journals, habit_entries (and habit_logs sync), habit_sessions, habit_components
 * - scoring_rule_versions, habit_schedules, point_transactions, streak_records
 * - events, event_bonuses, dashboard_widgets, app_settings, data_corrections
 */

import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { USER_ACCOUNTS } from '../config/accounts';
import { PRAYER_SCHEDULE, SCORING_RULES } from '../config/scoringConfig';

const DB_DIR = path.resolve(process.cwd(), 'database');
const DB_FILE = path.resolve(DB_DIR, 'local_habit.db');

let dbInstance: Database | null = null;

export function hashPassword(plain: string): string {
  return crypto.createHash('sha256').update(`jawara28_salt_${plain}`).digest('hex');
}

export function verifyPassword(plain: string, storedHashOrPlain: string): boolean {
  if (!storedHashOrPlain) return false;
  const hashed = hashPassword(plain);
  return storedHashOrPlain === hashed || storedHashOrPlain === plain;
}

export async function getDatabase(forceReset = false): Promise<Database> {
  if (dbInstance && !forceReset) return dbInstance;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (forceReset && fs.existsSync(DB_FILE)) {
    try {
      fs.unlinkSync(DB_FILE);
    } catch {}
  }

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  initTables(dbInstance);
  saveDatabase();

  return dbInstance;
}

export function saveDatabase(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Failed to save database to disk:', err);
  }
}

function safeAddColumn(db: Database, table: string, columnDef: string) {
  try {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${columnDef};`);
  } catch {}
}

function initTables(db: Database) {
  const nowIso = new Date().toISOString();

  // 1. users
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      account_status TEXT NOT NULL DEFAULT 'ACTIVE',
      is_demo INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 2. cohorts (Angkatan)
  db.run(`
    CREATE TABLE IF NOT EXISTS cohorts (
      id TEXT PRIMARY KEY,
      cohort_name TEXT UNIQUE NOT NULL,
      academic_year TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE'
    );
  `);

  // 3. classes (Kelas - Guru Walas)
  db.run(`
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      class_code TEXT UNIQUE NOT NULL,
      class_name TEXT NOT NULL,
      cohort_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (cohort_id) REFERENCES cohorts(id)
    );
  `);

  // 4. rombels (Rombel - Guru Wali)
  db.run(`
    CREATE TABLE IF NOT EXISTS rombels (
      id TEXT PRIMARY KEY,
      rombel_code TEXT UNIQUE NOT NULL,
      rombel_name TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 5. students
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      nisn TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL DEFAULT '123',
      name TEXT NOT NULL,
      gender TEXT NOT NULL,
      class_name TEXT NOT NULL,
      rombel_name TEXT DEFAULT 'Rombel B',
      angkatan TEXT NOT NULL,
      religion TEXT NOT NULL,
      avatar_seed TEXT,
      student_status TEXT DEFAULT 'ACTIVE',
      is_demo INTEGER DEFAULT 0,
      walas_name TEXT NOT NULL,
      walas_nip TEXT NOT NULL,
      wali_name TEXT DEFAULT 'Budi Santoso, S.Pd., M.Si.',
      wali_nip TEXT DEFAULT '198002152005011002',
      walas_notes TEXT DEFAULT '',
      walas_recommendation TEXT DEFAULT '',
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    );
  `);

  safeAddColumn(db, 'students', `user_id TEXT DEFAULT ''`);
  safeAddColumn(db, 'students', `password TEXT NOT NULL DEFAULT '123'`);
  safeAddColumn(db, 'students', `rombel_name TEXT DEFAULT 'Rombel B'`);
  safeAddColumn(db, 'students', `student_status TEXT DEFAULT 'ACTIVE'`);
  safeAddColumn(db, 'students', `is_demo INTEGER DEFAULT 0`);
  safeAddColumn(db, 'students', `wali_name TEXT DEFAULT 'Budi Santoso, S.Pd., M.Si.'`);
  safeAddColumn(db, 'students', `wali_nip TEXT DEFAULT '198002152005011002'`);
  safeAddColumn(db, 'students', `created_at TEXT DEFAULT ''`);
  safeAddColumn(db, 'students', `updated_at TEXT DEFAULT ''`);

  // 6. teachers
  db.run(`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      nip TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL DEFAULT '123',
      name TEXT NOT NULL,
      class_name TEXT NOT NULL,
      rombel_name TEXT DEFAULT '',
      subject TEXT NOT NULL,
      role TEXT NOT NULL,
      assignment_type TEXT DEFAULT 'WALAS',
      teacher_status TEXT DEFAULT 'ACTIVE',
      is_demo INTEGER DEFAULT 0,
      created_at TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    );
  `);

  safeAddColumn(db, 'teachers', `user_id TEXT DEFAULT ''`);
  safeAddColumn(db, 'teachers', `password TEXT NOT NULL DEFAULT '123'`);
  safeAddColumn(db, 'teachers', `rombel_name TEXT DEFAULT ''`);
  safeAddColumn(db, 'teachers', `assignment_type TEXT DEFAULT 'WALAS'`);
  safeAddColumn(db, 'teachers', `teacher_status TEXT DEFAULT 'ACTIVE'`);
  safeAddColumn(db, 'teachers', `is_demo INTEGER DEFAULT 0`);
  safeAddColumn(db, 'teachers', `created_at TEXT DEFAULT ''`);
  safeAddColumn(db, 'teachers', `updated_at TEXT DEFAULT ''`);

  // 7. student_class_memberships
  db.run(`
    CREATE TABLE IF NOT EXISTS student_class_memberships (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      valid_from TEXT NOT NULL,
      valid_until TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );
  `);

  // 8. student_rombel_memberships
  db.run(`
    CREATE TABLE IF NOT EXISTS student_rombel_memberships (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      rombel_id TEXT NOT NULL,
      valid_from TEXT NOT NULL,
      valid_until TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (rombel_id) REFERENCES rombels(id)
    );
  `);

  // 9. teacher_assignments
  db.run(`
    CREATE TABLE IF NOT EXISTS teacher_assignments (
      id TEXT PRIMARY KEY,
      teacher_id TEXT NOT NULL,
      assignment_type TEXT NOT NULL,
      class_id TEXT,
      rombel_id TEXT,
      valid_from TEXT NOT NULL,
      valid_until TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id)
    );
  `);

  // 10. habit_definitions
  db.run(`
    CREATE TABLE IF NOT EXISTS habit_definitions (
      id TEXT PRIMARY KEY,
      habit_code TEXT UNIQUE NOT NULL,
      habit_name TEXT NOT NULL,
      description TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL
    );
  `);

  // 11. journals (daily_journals)
  db.run(`
    CREATE TABLE IF NOT EXISTS journals (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      journal_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Sedang diisi',
      submitted_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(student_id, journal_date),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );
  `);

  // 12. habit_logs / habit_entries
  db.run(`
    CREATE TABLE IF NOT EXISTS habit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journal_id TEXT DEFAULT '',
      student_id TEXT NOT NULL,
      habit_type TEXT NOT NULL,
      sub_category TEXT DEFAULT '',
      log_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      reported_event_time TEXT DEFAULT '',
      entry_mode TEXT DEFAULT 'tepat_hari',
      entry_status TEXT DEFAULT 'Selesai',
      base_score REAL DEFAULT 0,
      bonus_score REAL DEFAULT 0,
      score REAL NOT NULL,
      overflow_bonus_points REAL DEFAULT 0,
      scoring_rule_version_id TEXT DEFAULT 'v2.0-final-7kaih',
      payload TEXT NOT NULL,
      is_counter_entry INTEGER DEFAULT 0,
      is_missed INTEGER DEFAULT 0,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );
  `);

  safeAddColumn(db, 'habit_logs', `journal_id TEXT DEFAULT ''`);
  safeAddColumn(db, 'habit_logs', `sub_category TEXT DEFAULT ''`);
  safeAddColumn(db, 'habit_logs', `reported_event_time TEXT DEFAULT ''`);
  safeAddColumn(db, 'habit_logs', `entry_mode TEXT DEFAULT 'tepat_hari'`);
  safeAddColumn(db, 'habit_logs', `entry_status TEXT DEFAULT 'Selesai'`);
  safeAddColumn(db, 'habit_logs', `base_score REAL DEFAULT 0`);
  safeAddColumn(db, 'habit_logs', `bonus_score REAL DEFAULT 0`);
  safeAddColumn(db, 'habit_logs', `overflow_bonus_points REAL DEFAULT 0`);
  safeAddColumn(db, 'habit_logs', `scoring_rule_version_id TEXT DEFAULT 'v2.0-final-7kaih'`);
  safeAddColumn(db, 'habit_logs', `is_missed INTEGER DEFAULT 0`);

  // 13. habit_sessions
  db.run(`
    CREATE TABLE IF NOT EXISTS habit_sessions (
      id TEXT PRIMARY KEY,
      habit_entry_id INTEGER NOT NULL,
      student_id TEXT NOT NULL,
      journal_date TEXT NOT NULL,
      habit_type TEXT NOT NULL,
      session_type TEXT NOT NULL,
      reported_time TEXT,
      session_status TEXT NOT NULL,
      session_score REAL NOT NULL,
      raw_answers TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 14. habit_components (entry_components)
  db.run(`
    CREATE TABLE IF NOT EXISTS habit_components (
      id TEXT PRIMARY KEY,
      habit_entry_id INTEGER NOT NULL,
      habit_session_id TEXT,
      component_code TEXT NOT NULL,
      component_label TEXT DEFAULT '',
      answer_value TEXT NOT NULL,
      component_score REAL NOT NULL,
      max_component_score REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 15. scoring_rule_versions
  db.run(`
    CREATE TABLE IF NOT EXISTS scoring_rule_versions (
      id TEXT PRIMARY KEY,
      rule_name TEXT NOT NULL,
      version_number TEXT NOT NULL,
      configuration TEXT NOT NULL,
      effective_from TEXT NOT NULL,
      effective_until TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // 16. habit_schedules (schedule_settings)
  db.run(`
    CREATE TABLE IF NOT EXISTS habit_schedules (
      id TEXT PRIMARY KEY,
      habit_code TEXT UNIQUE NOT NULL,
      schedule_configuration TEXT NOT NULL,
      effective_from TEXT NOT NULL,
      effective_until TEXT,
      version_number INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 17. point_transactions & entry_bonuses
  db.run(`
    CREATE TABLE IF NOT EXISTS point_transactions (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      journal_id TEXT,
      journal_date TEXT,
      transaction_type TEXT NOT NULL,
      points_delta REAL NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(student_id, source_type, source_id)
    );
  `);

  // 18. streak_records
  db.run(`
    CREATE TABLE IF NOT EXISTS streak_records (
      student_id TEXT PRIMARY KEY,
      current_streak INTEGER NOT NULL DEFAULT 0,
      longest_streak INTEGER NOT NULL DEFAULT 0,
      last_completed_journal_date TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );
  `);

  // 19. events & event_bonuses (Aktivitas Seru & Kegiatan)
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      event_name TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      target_habit TEXT NOT NULL,
      bonus_amount REAL NOT NULL DEFAULT 10,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS event_bonuses (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      log_date TEXT NOT NULL,
      habit_type TEXT NOT NULL,
      story TEXT NOT NULL,
      bonus_points REAL NOT NULL DEFAULT 10,
      applied_to_capaian REAL NOT NULL DEFAULT 0,
      applied_to_poin_hebat REAL NOT NULL DEFAULT 0,
      scoring_rule_version_id TEXT DEFAULT 'v2.0-final-7kaih',
      created_at TEXT NOT NULL,
      UNIQUE(student_id, log_date)
    );
  `);

  // 20. dashboard_widgets
  db.run(`
    CREATE TABLE IF NOT EXISTS dashboard_widgets (
      id TEXT PRIMARY KEY,
      widget_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      metric_code TEXT NOT NULL,
      visualization_type TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      role_visibility TEXT NOT NULL,
      configuration TEXT NOT NULL,
      display_order INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 21. app_settings
  db.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT NOT NULL,
      version_number INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // 22. data_corrections
  db.run(`
    CREATE TABLE IF NOT EXISTS data_corrections (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_name TEXT DEFAULT 'Admin',
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      student_id TEXT DEFAULT '',
      journal_date TEXT DEFAULT '',
      habit_type TEXT DEFAULT '',
      before_snapshot TEXT NOT NULL,
      after_snapshot TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // 23. weekly_leaderboards & admin_validations
  db.run(`
    CREATE TABLE IF NOT EXISTS weekly_leaderboards (
      id TEXT PRIMARY KEY,
      week_period TEXT NOT NULL,
      student_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      class_name TEXT NOT NULL,
      rombel_name TEXT NOT NULL,
      rank_position INTEGER NOT NULL,
      weekly_points REAL NOT NULL,
      avg_capaian REAL NOT NULL,
      streak INTEGER NOT NULL,
      recorded_at TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS admin_validations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      verified_by TEXT NOT NULL,
      verification_score INTEGER NOT NULL,
      notes TEXT,
      verified_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );
  `);

  // Create performance indices
  db.run(`CREATE INDEX IF NOT EXISTS idx_habit_logs_student_date ON habit_logs(student_id, log_date);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_habit_logs_type ON habit_logs(habit_type);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_journals_student_date ON journals(student_id, journal_date);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_class_memberships_student ON student_class_memberships(student_id, is_active);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_rombel_memberships_student ON student_rombel_memberships(student_id, is_active);`);

  // Seed default reference data (idempotent)
  seedInitialReferenceData(db, nowIso);
}

function seedInitialReferenceData(db: Database, nowIso: string) {
  // 1. Seed 7 Habit Definitions
  const habits = [
    { id: 'hab-1', code: 'bangun', name: 'Bangun Pagi', desc: 'Ketepatan waktu bangun pagi (04.00–06.40) dan kondisi kesegaran saat bangun.', order: 1 },
    { id: 'hab-2', code: 'ibadah', name: 'Beribadah', desc: 'Ketaatan ibadah harian sesuai agama (Shalat 5 Waktu / Berhalangan, Doa Kristen, Tri Sandhya Hindu).', order: 2 },
    { id: 'hab-3', code: 'olahraga', name: 'Berolahraga', desc: 'Aktivitas kebugaran fisik, durasi olahraga, dan deskripsi kegiatan olahraga.', order: 3 },
    { id: 'hab-4', code: 'makan', name: 'Makan Bergizi', desc: '3 sesi makan harian (Sarapan, Siang, Malam / Puasa) dengan komponen Isi Piringku & air minum.', order: 4 },
    { id: 'hab-5', code: 'belajar', name: 'Gemar Belajar', desc: 'Durasi belajar mandiri, variasi kegiatan belajar, dan deskripsi hasil belajar.', order: 5 },
    { id: 'hab-6', code: 'masyarakat', name: 'Bermasyarakat', desc: 'Jumlah tindakan kepedulian sosial, deskripsi aksi nyata, dan piket kebersihan.', order: 6 },
    { id: 'hab-7', code: 'tidur', name: 'Tidur Cepat', desc: 'Ketepatan waktu tidur malam dengan timestamp dan kondisi rileks sebelum tidur.', order: 7 },
  ];
  for (const h of habits) {
    db.run(
      `INSERT OR IGNORE INTO habit_definitions (id, habit_code, habit_name, description, is_active, display_order)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [h.id, h.code, h.name, h.desc, h.order]
    );
  }

  // 2. Seed Scoring Rule Version Snapshot
  db.run(
    `INSERT OR IGNORE INTO scoring_rule_versions (id, rule_name, version_number, configuration, effective_from, effective_until, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      'v2.0-final-7kaih',
      'Spesifikasi Final 7 KAIH & Addendum Jawara 28',
      '2.0.0',
      JSON.stringify(SCORING_RULES),
      '2025-01-01',
      'System',
      nowIso,
    ]
  );

  // 3. Seed Habit Schedules
  db.run(
    `INSERT OR IGNORE INTO habit_schedules (id, habit_code, schedule_configuration, effective_from, effective_until, version_number, updated_by, updated_at)
     VALUES (?, ?, ?, ?, NULL, 1, ?, ?)`,
    ['sched-ibadah', 'ibadah', JSON.stringify({ shalat: PRAYER_SCHEDULE, triSandhya: SCORING_RULES.triSandhya }), '2025-01-01', 'Admin', nowIso]
  );
  db.run(
    `INSERT OR IGNORE INTO habit_schedules (id, habit_code, schedule_configuration, effective_from, effective_until, version_number, updated_by, updated_at)
     VALUES (?, ?, ?, ?, NULL, 1, ?, ?)`,
    ['sched-makan', 'makan', JSON.stringify(SCORING_RULES.makan), '2025-01-01', 'Admin', nowIso]
  );

  // 4. Seed Cohorts (Angkatan)
  const cohorts = [
    { id: 'coh-2025', name: '2025/2026', year: '2025/2026' },
    { id: 'coh-2024', name: '2024/2025', year: '2024/2025' },
    { id: 'coh-2026', name: '2026/2027', year: '2026/2027' },
  ];
  for (const c of cohorts) {
    db.run(
      `INSERT OR IGNORE INTO cohorts (id, cohort_name, academic_year, status) VALUES (?, ?, ?, 'ACTIVE')`,
      [c.id, c.name, c.year]
    );
  }

  // 5. Seed Classes (Kelas — Guru Walas)
  const classes = [
    { id: 'cls-xi-mipa-1', code: 'XI-MIPA-1', name: 'XI-MIPA-1', cohort: 'coh-2025' },
    { id: 'cls-xi-mipa-2', code: 'XI-MIPA-2', name: 'XI-MIPA-2', cohort: 'coh-2025' },
    { id: 'cls-x-1', code: 'X-1', name: 'X-1', cohort: 'coh-2026' },
    { id: 'cls-xii-mipa-1', code: 'XII-MIPA-1', name: 'XII-MIPA-1', cohort: 'coh-2024' },
  ];
  for (const cl of classes) {
    db.run(
      `INSERT OR IGNORE INTO classes (id, class_code, class_name, cohort_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)`,
      [cl.id, cl.code, cl.name, cl.cohort, nowIso, nowIso]
    );
  }

  // 6. Seed Rombels (Rombel — Guru Wali, terpisah dari Kelas!)
  const rombels = [
    { id: 'rmb-a', code: 'ROMBEL-A', name: 'Rombel A', year: '2025/2026' },
    { id: 'rmb-b', code: 'ROMBEL-B', name: 'Rombel B', year: '2025/2026' },
    { id: 'rmb-c', code: 'ROMBEL-C', name: 'Rombel C', year: '2025/2026' },
  ];
  for (const r of rombels) {
    db.run(
      `INSERT OR IGNORE INTO rombels (id, rombel_code, rombel_name, academic_year, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)`,
      [r.id, r.code, r.name, r.year, nowIso, nowIso]
    );
  }

  // 7. Seed Demo Accounts (Without deleting any user-added accounts!)
  for (const acc of USER_ACCOUNTS) {
    const userId = `usr-${acc.id}`;
    db.run(
      `INSERT OR IGNORE INTO users (id, username, password_hash, role, account_status, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
      [userId, acc.username, hashPassword(acc.password), acc.role, acc.is_demo ?? 1, nowIso, nowIso]
    );

    if (acc.role === 'siswa') {
      db.run(
        `INSERT OR IGNORE INTO students (
          id, user_id, nisn, password, name, gender, class_name, rombel_name, angkatan, religion,
          avatar_seed, student_status, is_demo, walas_name, walas_nip, wali_name, wali_nip,
          walas_notes, walas_recommendation, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          acc.id,
          userId,
          acc.username,
          hashPassword(acc.password),
          acc.name,
          acc.gender || 'L',
          acc.class_name,
          acc.rombel_name || 'Rombel B',
          acc.angkatan || '2025/2026',
          acc.religion || 'Islam',
          acc.username,
          acc.is_demo ?? 1,
          acc.walas_name || 'Dra. Hj. Nurhidayah, M.Pd.',
          acc.walas_nip || '197405101999032001',
          acc.wali_name || 'Budi Santoso, S.Pd., M.Si.',
          acc.wali_nip || '198002152005011002',
          'Pertahankan konsistensi 7 kebiasaan unggul Jawara 28.',
          'Tingkatkan keterlibatan aktif dalam kegiatan Adiwiyata sekolah.',
          nowIso,
          nowIso,
        ]
      );

      // Ensure rombel_name is populated on existing demo students
      db.run(
        `UPDATE students SET rombel_name = ?, wali_name = ?, wali_nip = ?, is_demo = 1 WHERE id = ? AND (rombel_name IS NULL OR rombel_name = '');`,
        [
          acc.rombel_name || 'Rombel B',
          acc.wali_name || 'Budi Santoso, S.Pd., M.Si.',
          acc.wali_nip || '198002152005011002',
          acc.id,
        ]
      );

      // Class & Rombel membership records
      const classId = acc.class_name === 'XI-MIPA-2' ? 'cls-xi-mipa-2' : 'cls-xi-mipa-1';
      const rombelId = acc.rombel_name === 'Rombel A' ? 'rmb-a' : 'rmb-b';

      db.run(
        `INSERT OR IGNORE INTO student_class_memberships (id, student_id, class_id, valid_from, valid_until, is_active)
         VALUES (?, ?, ?, '2025-07-01', NULL, 1)`,
        [`scm-${acc.id}`, acc.id, classId]
      );
      db.run(
        `INSERT OR IGNORE INTO student_rombel_memberships (id, student_id, rombel_id, valid_from, valid_until, is_active)
         VALUES (?, ?, ?, '2025-07-01', NULL, 1)`,
        [`srm-${acc.id}`, acc.id, rombelId]
      );
      db.run(
        `INSERT OR IGNORE INTO streak_records (student_id, current_streak, longest_streak, last_completed_journal_date, updated_at)
         VALUES (?, 0, 0, NULL, ?)`,
        [acc.id, nowIso]
      );
    } else {
      const roleLabel =
        acc.role === 'admin'
          ? 'Administrator Control Panel'
          : acc.assignment_type === 'TIM_7_KAIH'
          ? 'Guru Tim 7 KAIH'
          : acc.assignment_type === 'WALI'
          ? 'Guru Wali Rombel'
          : 'Guru Walas';

      db.run(
        `INSERT OR REPLACE INTO teachers (
          id, user_id, nip, password, name, class_name, rombel_name, subject, role,
          assignment_type, teacher_status, is_demo, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
        [
          acc.id,
          userId,
          acc.username,
          hashPassword(acc.password),
          acc.name,
          acc.class_name,
          acc.rombel_name || '',
          acc.subject || roleLabel,
          roleLabel,
          acc.assignment_type || (acc.role === 'admin' ? 'ADMIN' : 'WALAS'),
          acc.is_demo ?? 1,
          nowIso,
          nowIso,
        ]
      );

      if (acc.role === 'guru' && acc.assignment_type) {
        const classId = acc.assignment_type === 'WALAS' ? 'cls-xi-mipa-1' : null;
        const rombelId = acc.assignment_type === 'WALI' ? 'rmb-b' : null;
        db.run(
          `INSERT OR REPLACE INTO teacher_assignments (id, teacher_id, assignment_type, class_id, rombel_id, valid_from, valid_until, is_active)
           VALUES (?, ?, ?, ?, ?, '2025-07-01', NULL, 1)`,
          [`asg-${acc.id}`, acc.id, acc.assignment_type, classId, rombelId]
        );
      }
    }
  }

  // 8. Seed Default Dashboard Widgets (For Editor Komponen Dashboard G.7)
  const defaultWidgets = [
    {
      id: 'wdg-1',
      code: 'avg_habit_radar',
      title: 'Capaian 7 KAIH (Radar / Bar)',
      desc: 'Menampilkan rata-rata nilai ketujuh kebiasaan',
      metric: 'AVG_HABIT_SCORE',
      vis: 'RADAR',
      scope: 'SCHOOL',
      roles: 'siswa,guru,admin',
      order: 1,
    },
    {
      id: 'wdg-2',
      code: 'overall_gauge',
      title: 'Indeks Karakter Keseluruhan',
      desc: 'Gauge rata-rata capaian 7 KAIH skala 0-100',
      metric: 'OVERALL_INDEX',
      vis: 'GAUGE',
      scope: 'SCHOOL',
      roles: 'siswa,guru,admin',
      order: 2,
    },
    {
      id: 'wdg-3',
      code: 'score_distribution',
      title: 'Distribusi Rentang Skor Siswa',
      desc: 'Sebaran jumlah siswa berdasarkan kelompok nilai (<70 s.d. 96-100)',
      metric: 'SCORE_DISTRIBUTION',
      vis: 'BAR',
      scope: 'SCHOOL',
      roles: 'guru,admin',
      order: 3,
    },
    {
      id: 'wdg-4',
      code: 'completion_summary',
      title: 'Persentase Kelengkapan Jurnal Harian',
      desc: 'Proporsi siswa Selesai, Sedang diisi, dan Belum dimulai',
      metric: 'JOURNAL_COMPLETION_PCT',
      vis: 'CARD',
      scope: 'CLASS',
      roles: 'guru,admin',
      order: 4,
    },
    {
      id: 'wdg-5',
      code: 'daily_trend_14d',
      title: 'Tren Nilai Harian (14 Hari)',
      desc: 'Perkembangan nilai harian dari hari ke-1 sampai hari ke-14',
      metric: 'DAILY_TREND_14D',
      vis: 'LINE',
      scope: 'ROMBEL',
      roles: 'siswa,guru,admin',
      order: 5,
    },
  ];
  for (const w of defaultWidgets) {
    db.run(
      `INSERT OR IGNORE INTO dashboard_widgets (
        id, widget_code, title, description, metric_code, visualization_type,
        scope_type, role_visibility, configuration, display_order, is_active, updated_by, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, 1, 'System', ?)`,
      [w.id, w.code, w.title, w.desc, w.metric, w.vis, w.scope, w.roles, w.order, nowIso]
    );
  }

  // 9. Seed Default App Settings (For Pengaturan Global Website G.8)
  const settings = [
    { id: 'set-1', key: 'school_name', val: 'SMAN 28 Jakarta' },
    { id: 'set-2', key: 'site_title', val: 'VERTIKAL SMA JAWARA 28' },
    { id: 'set-3', key: 'site_description', val: 'Sistem Evaluasi & Pemantauan 7 Kebiasaan Anak Indonesia Hebat (7 KAIH) SMAN 28 Jakarta' },
    { id: 'set-4', key: 'academic_year', val: '2025/2026' },
    { id: 'set-5', key: 'active_journal_period_days', val: '14' },
    { id: 'set-6', key: 'aktivitas_seru_bonus', val: '10' },
    { id: 'set-7', key: 'allow_flexible_same_day', val: 'true' },
    { id: 'set-8', key: 'prayer_schedule', val: JSON.stringify(PRAYER_SCHEDULE) },
  ];
  for (const s of settings) {
    db.run(
      `INSERT OR IGNORE INTO app_settings (id, setting_key, setting_value, version_number, updated_by, updated_at)
       VALUES (?, ?, ?, 1, 'System', ?)`,
      [s.id, s.key, s.val, nowIso]
    );
  }
}
