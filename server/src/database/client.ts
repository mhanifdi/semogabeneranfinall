/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Relational Database Client & Versioned Migration Runner — VERTIKAL SMA JAWARA 28
 *
 * Supports:
 * 1. Production PostgreSQL (`DATABASE_URL=postgresql://...`) via SQL migrations
 *    `001_initial_postgresql_schema.sql` and `002_views_and_analytics_indexes.sql`.
 * 2. Local Relational Execution Engine via Node.js v24 built-in `node:sqlite` (`DatabaseSync`)
 *    with strict `PRAGMA foreign_keys = ON`, `WAL` mode, `CHECK` constraints, `UNIQUE` constraints,
 *    and atomic `BEGIN IMMEDIATE ... COMMIT / ROLLBACK` transactions.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { env } from '../config/env.ts';
import { ScoringService } from '../modules/scoring/scoring.service.ts';

export class RelationalDatabase {
  public readonly raw: DatabaseSync;
  public readonly dbPath: string;
  private inTransactionDepth = 0;

  constructor(customDbPath?: string) {
    this.dbPath = customDbPath || env.sqliteDbPath;
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.raw = new DatabaseSync(this.dbPath);
    this.raw.exec('PRAGMA foreign_keys = ON;');
    this.raw.exec('PRAGMA journal_mode = WAL;');
    this.raw.exec('PRAGMA synchronous = NORMAL;');
  }

  public exec(sql: string): void {
    this.raw.exec(sql);
  }

  public queryAll<T = Record<string, any>>(sql: string, params: any[] = []): T[] {
    const stmt = this.raw.prepare(sql);
    return stmt.all(...params) as T[];
  }

  public queryOne<T = Record<string, any>>(sql: string, params: any[] = []): T | undefined {
    const stmt = this.raw.prepare(sql);
    return stmt.get(...params) as T | undefined;
  }

  public execute(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
    const stmt = this.raw.prepare(sql);
    const res = stmt.run(...params);
    return {
      changes: Number(res.changes),
      lastInsertRowid: Number(res.lastInsertRowid),
    };
  }

  /**
   * Executes a callback inside an atomic database transaction (`BEGIN IMMEDIATE ... COMMIT`).
   * Supports nested savepoints so inner service calls roll back cleanly on failure.
   */
  public transaction<T>(fn: () => T): T {
    const depth = this.inTransactionDepth;
    const savepointName = `sp_${depth}`;
    if (depth === 0) {
      this.raw.exec('BEGIN IMMEDIATE;');
    } else {
      this.raw.exec(`SAVEPOINT ${savepointName};`);
    }
    this.inTransactionDepth++;
    try {
      const result = fn();
      this.inTransactionDepth--;
      if (depth === 0) {
        this.raw.exec('COMMIT;');
      } else {
        this.raw.exec(`RELEASE SAVEPOINT ${savepointName};`);
      }
      return result;
    } catch (err) {
      this.inTransactionDepth--;
      if (depth === 0) {
        try {
          this.raw.exec('ROLLBACK;');
        } catch {
          // ignore if already rolled back
        }
      } else {
        try {
          this.raw.exec(`ROLLBACK TO SAVEPOINT ${savepointName};`);
          this.raw.exec(`RELEASE SAVEPOINT ${savepointName};`);
        } catch {
          // ignore
        }
      }
      throw err;
    }
  }

  public close(): void {
    this.raw.close();
  }

  /**
   * Runs versioned migrations and initializes reference catalogs (Roles, Permissions,
   * 7 Habit Definitions, Schedules, Scoring Rule Versions, Default Academic Year).
   */
  public runMigrations(): void {
    this.raw.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'QUOTE',
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS habit_instruments (
        id TEXT PRIMARY KEY,
        habit_code TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Umum',
        question_text TEXT NOT NULL,
        input_type TEXT NOT NULL DEFAULT 'CHOICE',
        max_score REAL NOT NULL DEFAULT 100,
        weight_percentage REAL NOT NULL DEFAULT 100,
        rubric_json TEXT NOT NULL DEFAULT '[]',
        help_text TEXT,
        order_no INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS student_habit_answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        log_date TEXT NOT NULL,
        habit_code TEXT NOT NULL,
        question_key TEXT NOT NULL,
        question_label TEXT NOT NULL,
        answer_value TEXT NOT NULL,
        score_earned REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (student_id, log_date, habit_code, question_key)
      );
      CREATE INDEX IF NOT EXISTS idx_student_habit_answers_lookup
        ON student_habit_answers(student_id, log_date, habit_code);

      CREATE TABLE IF NOT EXISTS popup_quotes (
        id TEXT PRIMARY KEY,
        habit_code TEXT NOT NULL,
        trigger_condition TEXT NOT NULL,
        title TEXT NOT NULL,
        quote_text TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS student_achievements (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        student_name TEXT NOT NULL,
        class_name TEXT NOT NULL,
        achievement_name TEXT NOT NULL,
        achievement_type TEXT NOT NULL,
        level TEXT NOT NULL,
        participation_category TEXT NOT NULL,
        event_date TEXT NOT NULL,
        achievement_rank TEXT NOT NULL,
        story TEXT NOT NULL,
        certificate_url TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
        points_awarded REAL DEFAULT 0,
        admin_notes TEXT DEFAULT '',
        validated_by TEXT DEFAULT NULL,
        validated_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_student_achievements_student ON student_achievements(student_id);
      CREATE INDEX IF NOT EXISTS idx_student_achievements_status ON student_achievements(status);
    `);

    // Ensure default popups seeded
    const defaultPopups = [
      { id: 'bangun_ideal', habit_code: 'bangun', trigger_condition: '04.00-05.00', title: 'Petuah Bangun Ideal', quote_text: 'Cakep, ente Betawi banget! Jangan sampe rejeki dipatok ayam ye!' },
      { id: 'bangun_sedang', habit_code: 'bangun', trigger_condition: '05.00-06.00', title: 'Peringatan Bangun Pagi', quote_text: 'Jangan bangun siang-siang! Nanti rejeki lu dipatok ayam!' },
      { id: 'bangun_terlambat', habit_code: 'bangun', trigger_condition: '>06.00', title: 'Nasehat Malaikat Rezeki', quote_text: 'Wah... ente ngeledek malaikat rejeki nih...' },
      { id: 'tidur_cepat_1', habit_code: 'tidur', trigger_condition: '<21.30', title: 'Petuah Bocah Baek', quote_text: 'Mantep! Bocah baek mah emang begini. Besok bangun pagi, badan seger rejeki juga kaga kabur' },
      { id: 'tidur_cepat_2', habit_code: 'tidur', trigger_condition: '21.30-22.30', title: 'Peringatan Masuk Angin', quote_text: 'Udah mulai lewat batas nih. Kurangin melek malem-malem, nanti bisa masuk angin.' },
      { id: 'tidur_cepat_3', habit_code: 'tidur', trigger_condition: '22.31-23.30', title: 'Nasehat Rem Melek', quote_text: 'Dikit lagi kebablasan tuh! Rem dikit, Tong. Jangan diporsir mulu meleknya, kasihan itu mata minta istirahat' },
      { id: 'tidur_cepat_4', habit_code: 'tidur', trigger_condition: '>23.30', title: 'Teguran Melek Malam', quote_text: 'Buset dah, jek melotot bae lu! Ronda kaga melek iya, mau nyari penyakit lu?' },
      { id: 'quran_khatam', habit_code: 'ibadah', trigger_condition: 'baca_quran', title: 'Doa Tilawah Al-Qur\'an', quote_text: 'Semoga khatam, ye!' },
    ];
    for (const p of defaultPopups) {
      try {
        this.execute(
          `INSERT OR IGNORE INTO popup_quotes (id, habit_code, trigger_condition, title, quote_text)
           VALUES (?, ?, ?, ?, ?)`,
          [p.id, p.habit_code, p.trigger_condition, p.title, p.quote_text]
        );
      } catch {}
    }

    try {
      const valTableSql = this.queryOne<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name = 'admin_validations'");
      if (valTableSql?.sql && valTableSql.sql.includes('BETWEEN 1 AND 5')) {
        this.raw.exec(`
          CREATE TABLE IF NOT EXISTS admin_validations_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            validation_uuid TEXT NOT NULL UNIQUE,
            student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
            verification_score INTEGER NOT NULL CHECK (verification_score BETWEEN 1 AND 10),
            verified_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
            verified_by TEXT NOT NULL,
            notes TEXT DEFAULT '',
            verified_at TEXT NOT NULL DEFAULT (datetime('now'))
          );
          INSERT OR IGNORE INTO admin_validations_new SELECT * FROM admin_validations;
          DROP TABLE admin_validations;
          ALTER TABLE admin_validations_new RENAME TO admin_validations;
          CREATE INDEX IF NOT EXISTS idx_admin_validations_student ON admin_validations(student_id, verified_at DESC);
        `);
      }
    } catch {}

    try {
      const achTableSql = this.queryOne<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name = 'student_achievements'");
      if (achTableSql?.sql && achTableSql.sql.includes('REFERENCES teachers')) {
        this.raw.exec(`
          CREATE TABLE IF NOT EXISTS student_achievements_new (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
            student_name TEXT NOT NULL,
            class_name TEXT NOT NULL,
            achievement_name TEXT NOT NULL,
            achievement_type TEXT NOT NULL,
            level TEXT NOT NULL,
            participation_category TEXT NOT NULL,
            event_date TEXT NOT NULL,
            achievement_rank TEXT NOT NULL,
            story TEXT NOT NULL,
            certificate_url TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
            points_awarded REAL DEFAULT 0,
            admin_notes TEXT DEFAULT '',
            validated_by TEXT DEFAULT NULL,
            validated_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          );
          INSERT OR IGNORE INTO student_achievements_new SELECT * FROM student_achievements;
          DROP TABLE student_achievements;
          ALTER TABLE student_achievements_new RENAME TO student_achievements;
          CREATE INDEX IF NOT EXISTS idx_student_achievements_student ON student_achievements(student_id);
          CREATE INDEX IF NOT EXISTS idx_student_achievements_status ON student_achievements(status);
        `);
      }
    } catch {}

    // Safe column migrations for existing databases
    const safeColumns = [
      "ALTER TABLE students ADD COLUMN is_demo INTEGER DEFAULT 0",
      "ALTER TABLE students ADD COLUMN verification_score REAL",
      "ALTER TABLE students ADD COLUMN verification_count INTEGER DEFAULT 0",
      "ALTER TABLE students ADD COLUMN wali_name TEXT",
      "ALTER TABLE students ADD COLUMN wali_id TEXT",
      "ALTER TABLE students ADD COLUMN avg_score REAL DEFAULT 0",
      "ALTER TABLE students ADD COLUMN angkatan TEXT DEFAULT 'XI'",
      "ALTER TABLE students ADD COLUMN walas_name TEXT",
      "ALTER TABLE students ADD COLUMN walas_nip TEXT",
      "ALTER TABLE teachers ADD COLUMN is_demo INTEGER DEFAULT 0",
      "ALTER TABLE teachers ADD COLUMN roles_csv TEXT DEFAULT 'WALAS'",
      "ALTER TABLE users ADD COLUMN plain_password TEXT DEFAULT '123'",
    ];
    for (const colSql of safeColumns) {
      try {
        this.raw.exec(colSql);
      } catch {
        // column already exists
      }
    }

    const migrations: { version: string; name: string; sql: string }[] = [
      {
        version: '001',
        name: '001_initial_relational_schema',
        sql: INITIAL_RELATIONAL_DDL,
      },
      {
        version: '002',
        name: '002_views_and_analytics_indexes',
        sql: INDEXES_AND_VIEWS_DDL,
      },
    ];

    for (const m of migrations) {
      const existing = this.queryOne<{ version: string }>(
        'SELECT version FROM schema_migrations WHERE version = ?',
        [m.version]
      );
      if (!existing) {
        const checksum = crypto.createHash('sha256').update(m.sql).digest('hex');
        this.transaction(() => {
          this.raw.exec(m.sql);
          this.execute(
            'INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)',
            [m.version, m.name, checksum]
          );
        });
      }
    }

    this.seedSystemReferenceCatalogs();
  }

  /**
   * Seeds immutable system reference catalogs (RBAC roles, permissions, 7 habit definitions,
   * scoring version, prayer/meal schedules, academic year, and cohorts).
   * Does NOT seed demo users/students unless explicitly invoked via `seed.ts`.
   */
  public seedSystemReferenceCatalogs(): void {
    this.transaction(() => {
      // 1. Roles
      const roles = [
        {
          id: 'role-siswa',
          code: 'SISWA',
          name: 'Siswa SMAN 28 Jakarta',
          description: 'Mengisi jurnal 7 kebiasaan milik sendiri dan melihat progres serta rapor pribadi.',
        },
        {
          id: 'role-guru-walas',
          code: 'GURU_WALAS',
          name: 'Guru Wali Kelas',
          description: 'Memantau kelas binaan, mengisi catatan/rekomendasi wali kelas, dan melihat rapor siswa kelasnya.',
        },
        {
          id: 'role-guru-wali',
          code: 'GURU_WALI',
          name: 'Guru Wali (Pendamping Rombel)',
          description: 'Memantau rombel binaan lintas kelas dan perkembangan kebiasaan siswa rombel binaannya.',
        },
        {
          id: 'role-tim-7kaih',
          code: 'TIM_7_KAIH',
          name: 'Tim 7 KAIH',
          description: 'Memantau analitik sekolah, validasi rapor, jadwal kebiasaan, dan koreksi terkontrol ber-audit.',
        },
        {
          id: 'role-super-admin',
          code: 'SUPER_ADMIN',
          name: 'Super Admin / Tata Usaha',
          description: 'Mengelola seluruh akun, kelas, rombel, tahun ajaran, mutasi siswa, koreksi data, dan pengaturan.',
        },
      ];

      for (const r of roles) {
        this.execute(
          `INSERT OR IGNORE INTO roles (id, code, name, description) VALUES (?, ?, ?, ?)`,
          [r.id, r.code, r.name, r.description]
        );
      }

      // 2. Permissions
      const permissions = [
        { id: 'perm-journal-self-read', code: 'journal:read:self', module: 'journals', description: 'Membaca jurnal milik sendiri' },
        { id: 'perm-journal-self-write', code: 'journal:write:self', module: 'journals', description: 'Mengisi jurnal milik sendiri' },
        { id: 'perm-report-self-read', code: 'report:read:self', module: 'reports', description: 'Membaca rapor milik sendiri' },
        { id: 'perm-class-analytics', code: 'analytics:read:class', module: 'analytics', description: 'Membaca analitik kelas binaan' },
        { id: 'perm-walas-notes', code: 'report:write:walas_notes', module: 'reports', description: 'Menulis catatan dan rekomendasi Wali Kelas' },
        { id: 'perm-rombel-analytics', code: 'analytics:read:rombel', module: 'analytics', description: 'Membaca analitik rombel binaan' },
        { id: 'perm-school-analytics', code: 'analytics:read:school', module: 'analytics', description: 'Membaca analitik tingkat sekolah & angkatan' },
        { id: 'perm-validation-write', code: 'validation:write:school', module: 'validations', description: 'Menyimpan skor verifikasi Tim 7 KAIH / Admin' },
        { id: 'perm-journal-correct', code: 'journal:correct:audit', module: 'journals', description: 'Melakukan koreksi nilai jurnal dengan alasan wajib dan audit log' },
        { id: 'perm-admin-users', code: 'admin:manage:users', module: 'users', description: 'Mengelola akun siswa dan guru' },
        { id: 'perm-admin-structure', code: 'admin:manage:structure', module: 'classes', description: 'Mengelola tahun ajaran, kelas, rombel, dan mutasi anggota' },
        { id: 'perm-admin-settings', code: 'admin:manage:settings', module: 'settings', description: 'Mengelola pengaturan aplikasi, jadwal ibadah, dan widget' },
      ];

      for (const p of permissions) {
        this.execute(
          `INSERT OR IGNORE INTO permissions (id, code, module, description) VALUES (?, ?, ?, ?)`,
          [p.id, p.code, p.module, p.description]
        );
      }

      // 3. Role-Permission Matrix
      const rolePermLinks: [string, string][] = [
        ['role-siswa', 'perm-journal-self-read'],
        ['role-siswa', 'perm-journal-self-write'],
        ['role-siswa', 'perm-report-self-read'],
        ['role-guru-walas', 'perm-class-analytics'],
        ['role-guru-walas', 'perm-walas-notes'],
        ['role-guru-wali', 'perm-rombel-analytics'],
        ['role-tim-7kaih', 'perm-school-analytics'],
        ['role-tim-7kaih', 'perm-validation-write'],
        ['role-tim-7kaih', 'perm-journal-correct'],
        ['role-tim-7kaih', 'perm-admin-settings'],
        ['role-super-admin', 'perm-journal-self-read'],
        ['role-super-admin', 'perm-class-analytics'],
        ['role-super-admin', 'perm-walas-notes'],
        ['role-super-admin', 'perm-rombel-analytics'],
        ['role-super-admin', 'perm-school-analytics'],
        ['role-super-admin', 'perm-validation-write'],
        ['role-super-admin', 'perm-journal-correct'],
        ['role-super-admin', 'perm-admin-users'],
        ['role-super-admin', 'perm-admin-structure'],
        ['role-super-admin', 'perm-admin-settings'],
      ];

      for (const [roleId, permId] of rolePermLinks) {
        this.execute(
          `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [roleId, permId]
        );
      }

      // 4. Default Academic Year & Cohorts
      this.execute(
        `INSERT OR IGNORE INTO academic_years (id, name, semester, start_date, end_date, is_active)
         VALUES ('ay-2026-2027-1', '2026/2027', 'GANJIL', '2026-07-13', '2026-12-18', 1)`
      );

      const cohorts = [
        { id: 'coh-2026', name: 'Angkatan 2026 (Kelas X)', entry_year: 2026, grade_level: 'X' },
        { id: 'coh-2025', name: 'Angkatan 2025 (Kelas XI)', entry_year: 2025, grade_level: 'XI' },
        { id: 'coh-2024', name: 'Angkatan 2024 (Kelas XII)', entry_year: 2024, grade_level: 'XII' },
      ];
      for (const c of cohorts) {
        this.execute(
          `INSERT OR IGNORE INTO cohorts (id, name, entry_year, grade_level, is_active) VALUES (?, ?, ?, ?, 1)`,
          [c.id, c.name, c.entry_year, c.grade_level]
        );
      }

      // 5. Scoring Rule Version
      this.execute(
        `INSERT OR IGNORE INTO scoring_rule_versions (id, version_code, title, rules_json, no_missed_penalty, bonus_cap_score, is_active, effective_from)
         VALUES (?, ?, ?, ?, 1, 100.0, 1, '2026-07-01')`,
        [
          ScoringService.ACTIVE_VERSION_ID,
          ScoringService.ACTIVE_VERSION_CODE,
          'Spesifikasi Final 7 KAIH SMAN 28 Jakarta (Tanpa Penalti -5, Bonus Cap 100 + Overflow Poin Hebat)',
          JSON.stringify({
            noMissedPenalty: true,
            bonusAmount: 10,
            maxHabitScore: 100,
            minDescriptionChars: 10,
            maxPointDescriptionChars: 15,
          }),
        ]
      );

      // 6. 7 Habit Definitions
      const habits = [
        {
          id: 'hab-1-bangun',
          code: 'bangun',
          order_no: 1,
          name: 'Bangun Pagi',
          description: 'Bangun pukul 03.00–05.00 WIB, merapikan tempat tidur, dan kesiapan kebugaran diri.',
          multi_session: 0,
          form_schema_json: JSON.stringify({
            fields: ['jamBangun', 'merapikanTempatTidur', 'kebugaranLevel', 'deskripsi'],
          }),
        },
        {
          id: 'hab-2-ibadah',
          code: 'ibadah',
          order_no: 2,
          name: 'Beribadah',
          description: 'Pelaksanaan ibadah tepat waktu sesuai agama dan keyakinan (5 waktu untuk Islam / Halangan / Non-Islam).',
          multi_session: 1,
          form_schema_json: JSON.stringify({
            fields: ['religion', 'waktuSholat', 'caraPelaksanaan', 'waktuPelaksanaan', 'isHalangan', 'aktivitasPengganti', 'refleksi'],
          }),
        },
        {
          id: 'hab-3-olahraga',
          code: 'olahraga',
          order_no: 3,
          name: 'Berolahraga',
          description: 'Aktivitas kebugaran jasmani minimal 30 menit dengan intensitas terukur.',
          multi_session: 0,
          form_schema_json: JSON.stringify({
            fields: ['jenisOlahraga', 'durasi', 'intensitas', 'catatanOlahraga'],
          }),
        },
        {
          id: 'hab-4-makan',
          code: 'makan',
          order_no: 4,
          name: 'Makan Sehat & Bergizi',
          description: 'Asupan gizi seimbang Pagi, Siang, dan Malam (Karbohidrat, Protein, Sayur, Buah, Air Putih) atau Puasa.',
          multi_session: 1,
          form_schema_json: JSON.stringify({
            fields: ['waktuMakan', 'isPuasa', 'karbohidrat', 'protein', 'sayur', 'buah', 'gelasAir'],
          }),
        },
        {
          id: 'hab-5-belajar',
          code: 'belajar',
          order_no: 5,
          name: 'Gemar Belajar',
          description: 'Kegiatan belajar mandiri, literasi buku, dan penugasan akademik beserta ringkasan materi.',
          multi_session: 0,
          form_schema_json: JSON.stringify({
            fields: ['materi', 'durasi', 'ringkasanMateri'],
          }),
        },
        {
          id: 'hab-6-masyarakat',
          code: 'masyarakat',
          order_no: 6,
          name: 'Bermasyarakat',
          description: 'Kontribusi sosial, kepedulian lingkungan, gotong royong, dan organisasi siswa.',
          multi_session: 0,
          form_schema_json: JSON.stringify({
            fields: ['jenisKegiatan', 'peran', 'dampakSosial'],
          }),
        },
        {
          id: 'hab-7-tidur',
          code: 'tidur',
          order_no: 7,
          name: 'Tidur Cepat',
          description: 'Istirahat malam pukul 20.00–22.00 WIB, mematikan gawai, dan berdoa sebelum tidur.',
          multi_session: 0,
          form_schema_json: JSON.stringify({
            fields: ['jamTidur', 'matikanGawai', 'berdoaSebelumTidur'],
          }),
        },
      ];

      for (const h of habits) {
        this.execute(
          `INSERT OR IGNORE INTO habit_definitions
           (id, code, order_no, name, description, multi_session, max_score, min_description_chars, max_point_description_chars, form_schema_json, scoring_version_id, is_active)
           VALUES (?, ?, ?, ?, ?, ?, 100.0, 10, 15, ?, ?, 1)`,
          [
            h.id,
            h.code,
            h.order_no,
            h.name,
            h.description,
            h.multi_session,
            h.form_schema_json,
            ScoringService.ACTIVE_VERSION_ID,
          ]
        );
      }

      // 7. Default Habit Schedules
      const schedules = [
        { id: 'sch-bangun', habit: 'bangun', session: 'default', label: 'Bangun Pagi', start: '03:00', end: '07:00' },
        { id: 'sch-ibadah-subuh', habit: 'ibadah', session: 'subuh', label: 'Salat Subuh', start: '04:15', end: '05:45' },
        { id: 'sch-ibadah-zuhur', habit: 'ibadah', session: 'zuhur', label: 'Salat Zuhur', start: '11:45', end: '14:45' },
        { id: 'sch-ibadah-asar', habit: 'ibadah', session: 'asar', label: 'Salat Asar', start: '15:00', end: '17:30' },
        { id: 'sch-ibadah-magrib', habit: 'ibadah', session: 'magrib', label: 'Salat Magrib', start: '17:50', end: '19:00' },
        { id: 'sch-ibadah-isya', habit: 'ibadah', session: 'isya', label: 'Salat Isya', start: '19:05', end: '23:59' },
        { id: 'sch-makan-pagi', habit: 'makan', session: 'pagi', label: 'Sarapan Pagi', start: '05:30', end: '09:00' },
        { id: 'sch-makan-siang', habit: 'makan', session: 'siang', label: 'Makan Siang', start: '11:30', end: '15:00' },
        { id: 'sch-makan-malam', habit: 'makan', session: 'malam', label: 'Makan Malam', start: '17:30', end: '21:30' },
        { id: 'sch-tidur', habit: 'tidur', session: 'default', label: 'Tidur Cepat', start: '20:00', end: '23:59' },
      ];
      for (const s of schedules) {
        this.execute(
          `INSERT OR IGNORE INTO habit_schedules (id, habit_code, session_code, label, window_start, window_end, is_flexible_until_midnight, academic_year_id)
           VALUES (?, ?, ?, ?, ?, ?, 1, 'ay-2026-2027-1')`,
          [s.id, s.habit, s.session, s.label, s.start, s.end]
        );
      }

      // 8. Default Event (Aktivitas Seru Harian)
      this.execute(
        `INSERT OR IGNORE INTO events (id, code, name, description, bonus_score_amount, min_story_chars, start_date, is_active)
         VALUES ('evt-aktivitas-seru', 'AKTIVITAS_SERU_HARIAN', 'Cerita Aktivitas Seru (+10 Poin Bonus)', 'Ceritakan pengalaman seru melakukan salah satu dari 7 kebiasaan hari ini (min. 15 karakter) untuk memperoleh +10 poin bonus!', 10.0, 15, '2026-01-01', 1)`
      );

      // 9. Default App Settings & Dashboard Widgets
      const defaultSettings: [string, string, string, string][] = [
        ['school_name', 'SMAN 28 Jakarta', 'STRING', 'Nama resmi sekolah'],
        ['academic_year', '2026/2027', 'STRING', 'Tahun ajaran aktif'],
        ['semester', 'Ganjil', 'STRING', 'Semester aktif'],
        ['no_missed_penalty', 'true', 'BOOLEAN', 'Tidak ada pengurangan nilai 5 poin untuk pengisian fleksibel/terlewat'],
        ['bonus_cap_score', '100', 'NUMBER', 'Batas maksimal Nilai Capaian kebiasaan'],
        ['aktivitas_seru_bonus', '10', 'NUMBER', 'Bonus poin harian Aktivitas Seru'],
        [
          'prayer_schedule_json',
          JSON.stringify({
            subuh: { start: '04:15', onTimeEnd: '05:00', end: '05:45' },
            zuhur: { start: '11:45', onTimeEnd: '12:30', end: '14:45' },
            asar: { start: '15:00', onTimeEnd: '15:45', end: '17:30' },
            magrib: { start: '17:50', onTimeEnd: '18:20', end: '19:00' },
            isya: { start: '19:05', onTimeEnd: '19:45', end: '23:59' },
          }),
          'JSON',
          'Jadwal rentang waktu pelaksanaan ibadah salat 5 waktu',
        ],
        ['data_collection_start_date', '2026-10-15', 'STRING', 'Tanggal awal rentang pengambilan data 7 KAIH'],
        ['data_collection_end_date', '2026-11-15', 'STRING', 'Tanggal akhir rentang pengambilan data 7 KAIH'],
        ['data_collection_active', 'true', 'BOOLEAN', 'Status keaktifan rentang pengambilan data'],
        [
          'achievement_rubric_schema',
          JSON.stringify([
            { level: 'Sekolah', minPoints: 10, maxPoints: 25, defaultPoints: 20, description: 'Lomba antar kelas / ekstrakurikuler tingkat sekolah' },
            { level: 'Kecamatan', minPoints: 25, maxPoints: 40, defaultPoints: 35, description: 'Kompetisi / ajang tingkat kecamatan / antar sekolah wilayah' },
            { level: 'Kota-Kabupaten', minPoints: 40, maxPoints: 60, defaultPoints: 50, description: 'OSN / O2SN / FLS2N / Kejuaraan tingkat Kota Jakarta Selatan' },
            { level: 'Provinsi', minPoints: 60, maxPoints: 80, defaultPoints: 75, description: 'Kejuaraan / Olimpiade tingkat Provinsi DKI Jakarta' },
            { level: 'Nasional', minPoints: 80, maxPoints: 100, defaultPoints: 90, description: 'Lomba / Kejuaraan Nasional (Puspresnas, Kemdikbudristek, dsb.)' },
            { level: 'Internasional', minPoints: 100, maxPoints: 150, defaultPoints: 120, description: 'Kompetisi / Konferensi / Prestasi tingkat Internasional' },
          ]),
          'JSON',
          'Skema panduan rentang penilaian prestasi murid per jenjang',
        ],
      ];

      for (const [k, v, t, d] of defaultSettings) {
        this.execute(
          `INSERT OR IGNORE INTO app_settings (key, value, value_type, description) VALUES (?, ?, ?, ?)`,
          [k, v, t, d]
        );
      }

      // Default Habit Instruments (7 KAIH)
      const defaultInstruments = [
        {
          id: 'inst-bangun-1',
          habit_code: 'bangun',
          title: 'Rentang Waktu Bangun Pagi',
          category: 'Ketepatan Waktu',
          question_text: 'Pukul berapa Anda bangun pagi hari ini?',
          input_type: 'CHOICE',
          max_score: 75,
          weight_percentage: 75,
          order_no: 1,
          rubric_json: JSON.stringify([
            { label: '04.00 – 04.20 WIB', score: 75, description: 'Sangat tepat waktu di sepertiga malam akhir' },
            { label: '04.21 – 04.40 WIB', score: 70, description: 'Tepat waktu menjelang fajar' },
            { label: '04.41 – 05.00 WIB', score: 65, description: 'Mendekati waktu fajar' },
            { label: '05.01 – 06.20 WIB', score: 60, description: 'Setelah fajar / awal pagi' },
            { label: '06.21 – 06.40 WIB', score: 55, description: 'Menjelang waktu sekolah' },
            { label: 'Lebih dari 06.40 WIB', score: 50, description: 'Terlambat bangun' },
          ]),
          help_text: 'Pilih slot waktu bangun yang paling akurat sesuai jam riil Anda.',
        },
        {
          id: 'inst-bangun-2',
          habit_code: 'bangun',
          title: 'Kondisi Kebugaran Saat Bangun',
          category: 'Kebugaran Fisik',
          question_text: 'Bagaimana kondisi fisik dan kesegaran tubuh saat Anda bangun tidur?',
          input_type: 'CHOICE',
          max_score: 25,
          weight_percentage: 25,
          order_no: 2,
          rubric_json: JSON.stringify([
            { label: 'Sangat Segar & Bugar', score: 25, description: 'Tubuh segar, siap beraktivitas' },
            { label: 'Cukup Segar', score: 20, description: 'Segar dan bersemangat' },
            { label: 'Kurang Segar', score: 15, description: 'Agak mengantuk namun bisa bangkit' },
            { label: 'Lemas / Mengantuk', score: 10, description: 'Perlu waktu beberapa saat untuk pulih' },
            { label: 'Pusing / Kelelahan', score: 5, description: 'Kelelahan atau kurang tidur' },
          ]),
          help_text: 'Kebugaran bangun pagi dipengaruhi oleh jam tidur malam sebelumnya.',
        },
        {
          id: 'inst-ibadah-1',
          habit_code: 'ibadah',
          title: 'Pelaksanaan Ibadah 5 Waktu / Doa',
          category: 'Spiritualitas',
          question_text: 'Bagaimana pelaksanaan ibadah shalat fardhu / doa harian Anda?',
          input_type: 'CHOICE',
          max_score: 100,
          weight_percentage: 100,
          order_no: 1,
          rubric_json: JSON.stringify([
            { label: 'Berjamaah di Awal Waktu (+Sunnah/Kajian)', score: 100, description: 'Pahala dan kedisiplinan tertinggi' },
            { label: 'Berjamaah di Awal Waktu', score: 90, description: 'Disiplin dan taat tepat waktu' },
            { label: 'Mandiri di Awal Waktu', score: 80, description: 'Tepat waktu mandiri' },
            { label: 'Mandiri di Tengah/Akhir Waktu', score: 65, description: 'Dilaksanakan sebelum habis waktu' },
            { label: 'Mode Halangan / Pengganti (Kajian/Zikir)', score: 100, description: 'Khusus siswi muslim berhalangan' },
          ]),
          help_text: 'Bagi siswi yang berhalangan, isi refleksi dan aktivitas pengganti (zikir/kajian/sedekah).',
        },
        {
          id: 'inst-olahraga-1',
          habit_code: 'olahraga',
          title: 'Durasi & Aktivitas Fisik Harian',
          category: 'Kesehatan Jasmani',
          question_text: 'Berapa durasi aktivitas olahraga / fisik yang Anda lakukan?',
          input_type: 'CHOICE',
          max_score: 45,
          weight_percentage: 45,
          order_no: 1,
          rubric_json: JSON.stringify([
            { label: 'Lebih dari 30 Menit', score: 45, description: 'Latihan fisik optimal' },
            { label: '15 – 30 Menit', score: 35, description: 'Latihan fisik cukup' },
            { label: 'Kurang dari 15 Menit', score: 25, description: 'Peregangan ringan' },
            { label: 'Tidak Berolahraga', score: 0, description: 'Tidak ada aktivitas fisik tercatat' },
          ]),
          help_text: 'Dapat berupa lari, peregangan, jalan tangga, atau olahraga terstruktur.',
        },
        {
          id: 'inst-makan-1',
          habit_code: 'makan',
          title: 'Komponen Piring Makanku',
          category: 'Gizi Seimbang',
          question_text: 'Centang komponen gizi yang terdapat dalam piring makan Anda hari ini:',
          input_type: 'CHECKBOX',
          max_score: 65,
          weight_percentage: 65,
          order_no: 1,
          rubric_json: JSON.stringify([
            { label: 'Karbohidrat (Nasi/Kentang/Roti)', score: 17.5, description: 'Sumber energi utama' },
            { label: 'Lauk Pauk Berprotein (Ikan/Ayam/Telur/Tempe)', score: 17.5, description: 'Sumber zat pembangun' },
            { label: 'Sayur-sayuran Hijau/Warna', score: 15, description: 'Sumber serat dan mineral' },
            { label: 'Buah-buahan Segar', score: 15, description: 'Sumber vitamin dan antioksidan' },
          ]),
          help_text: 'Sesuai panduan Isi Piringku Kemenkes RI.',
        },
        {
          id: 'inst-belajar-1',
          habit_code: 'belajar',
          title: 'Durasi Belajar Mandiri & Literasi',
          category: 'Pengembangan Diri',
          question_text: 'Berapa total durasi belajar mandiri di luar jam pelajaran sekolah?',
          input_type: 'CHOICE',
          max_score: 60,
          weight_percentage: 60,
          order_no: 1,
          rubric_json: JSON.stringify([
            { label: 'Lebih dari 3 Jam', score: 60, description: 'Fokus dan eksplorasi mendalam' },
            { label: '2 – 3 Jam', score: 50, description: 'Belajar mandiri intensif' },
            { label: '1 – 2 Jam', score: 40, description: 'Mengulang materi harian' },
            { label: '30 – 60 Menit', score: 30, description: 'Penyelesaian PR / tugas' },
            { label: '15 – 30 Menit', score: 20, description: 'Membaca sekilas' },
            { label: 'Kurang dari 15 Menit', score: 10, description: 'Review singkat' },
            { label: 'Tidak Belajar', score: 0, description: 'Tidak belajar mandiri' },
          ]),
          help_text: 'Deskripsikan materi yang dipelajari minimal 5 karakter pada kolom catatan.',
        },
        {
          id: 'inst-masyarakat-1',
          habit_code: 'masyarakat',
          title: 'Kepedulian Sosial & Adiwiyata',
          category: 'Sosial Kemasyarakatan',
          question_text: 'Pilih tindakan sosial dan kepedulian lingkungan yang Anda laksanakan:',
          input_type: 'CHECKBOX',
          max_score: 90,
          weight_percentage: 90,
          order_no: 1,
          rubric_json: JSON.stringify([
            { label: 'Gotong Royong & Kerja Bakti', score: 25, description: 'Membersihkan lingkungan bersama' },
            { label: 'Membantu Tetangga / Warga Sekitar', score: 25, description: 'Empati dan tolong menolong' },
            { label: 'Pilah Sampah & Budaya Adiwiyata', score: 25, description: 'Kelestarian lingkungan sekolah/rumah' },
            { label: 'Aktif Berorganisasi / Karang Taruna', score: 15, description: 'Kontribusi positif kemasyarakatan' },
          ]),
          help_text: 'Tindakan nyata mencerminkan karakter pelajar Pancasila.',
        },
        {
          id: 'inst-tidur-1',
          habit_code: 'tidur',
          title: 'Rentang Waktu Tidur Malam',
          category: 'Kualitas Istirahat',
          question_text: 'Pukul berapa Anda tidur malam?',
          input_type: 'CHOICE',
          max_score: 75,
          weight_percentage: 75,
          order_no: 1,
          rubric_json: JSON.stringify([
            { label: '21.00 – 21.30 WIB', score: 75, description: 'Sangat ideal untuk regenerasi tubuh' },
            { label: '21.31 – 22.00 WIB', score: 70, description: 'Waktu tidur ideal' },
            { label: '22.01 – 22.30 WIB', score: 60, description: 'Cukup baik' },
            { label: '22.31 – 23.00 WIB', score: 50, description: 'Mendekati larut malam' },
            { label: 'Lebih dari 23.00 WIB', score: 40, description: 'Begadang / kurang istirahat' },
          ]),
          help_text: 'Tidur cepat menjaga kesehatan otak dan stamina untuk bangun pagi.',
        },
      ];

      for (const inst of defaultInstruments) {
        this.execute(
          `INSERT OR IGNORE INTO habit_instruments
           (id, habit_code, title, category, question_text, input_type, max_score, weight_percentage, rubric_json, help_text, order_no, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            inst.id,
            inst.habit_code,
            inst.title,
            inst.category,
            inst.question_text,
            inst.input_type,
            inst.max_score,
            inst.weight_percentage,
            inst.rubric_json,
            inst.help_text,
            inst.order_no,
          ]
        );
      }

      const defaultWidgets = [
        {
          id: 'w-participation',
          title: 'Partisipasi 7 Kebiasaan Sekolah',
          subtitle: 'Persentase keaktifan jurnal harian siswa SMAN 28 Jakarta',
          widget_type: 'METRIC_CARD',
          visible_public: 1,
          visible_student: 1,
          visible_teacher: 1,
          display_order: 1,
          config_json: JSON.stringify({ color: 'blue', metric: 'school_participation' }),
        },
        {
          id: 'w-radar-7kaih',
          title: 'Peta Capaian 7 KAIH',
          subtitle: 'Rata-rata capaian 7 Kebiasaan Anak Indonesia Hebat',
          widget_type: 'HABIT_DISTRIBUTION',
          visible_public: 1,
          visible_student: 1,
          visible_teacher: 1,
          display_order: 2,
          config_json: JSON.stringify({ showTargetLine: true, targetScore: 85 }),
        },
        {
          id: 'w-leaderboard',
          title: 'Papan Apresiasi Konsistensi Siswa',
          subtitle: 'Siswa dengan konsistensi & Poin Hebat tertinggi',
          widget_type: 'LEADERBOARD_TABLE',
          visible_public: 1,
          visible_student: 1,
          visible_teacher: 1,
          display_order: 3,
          config_json: JSON.stringify({ topLimit: 10 }),
        },
      ];

      for (const w of defaultWidgets) {
        this.execute(
          `INSERT OR IGNORE INTO dashboard_widgets
           (id, title, subtitle, widget_type, visible_public, visible_student, visible_teacher, display_order, config_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            w.id,
            w.title,
            w.subtitle,
            w.widget_type,
            w.visible_public,
            w.visible_student,
            w.visible_teacher,
            w.display_order,
            w.config_json,
          ]
        );
      }

      // 12. Default Announcements and Quotes
      const defaultAnnouncements = [
        {
          id: 'ann-1',
          type: 'QUOTE',
          title: 'Semangat Jawara Betawi',
          content: 'Kalo bukan kite nyang ngejaga budaye dan kebiasaan baek, siape lagi? Tetap disiplin dan jadi teladan, Siswa Jawara 28!',
          author: 'Petuah Bijak Betawi',
        },
        {
          id: 'ann-2',
          type: 'QUOTE',
          title: 'Kedisiplinan & Karakter',
          content: 'Disiplin adalah jembatan antara cita-cita dan pencapaian. Bangun pagi, ibadah tepat waktu, serta sayangi keluarga dan lingkungan.',
          author: 'Tim Pembina Karakter SMAN 28',
        },
        {
          id: 'ann-3',
          type: 'ANNOUNCEMENT',
          title: 'Evaluasi Mingguan 7 KAIH SMAN 28',
          content: 'Lengkapi seluruh jurnal harian sebelum pukul 00.00 WIB. Poin Hebat diakumulasikan sepanjang pekan untuk menetapkan Juara Teladan Pekan Ini!',
          author: 'Manajemen 7 KAIH SMAN 28',
        },
      ];

      for (const a of defaultAnnouncements) {
        this.execute(
          `INSERT OR IGNORE INTO announcements (id, type, title, content, author, is_active)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [a.id, a.type, a.title, a.content, a.author]
        );
      }
    });
  }
}

const INITIAL_RELATIONAL_DDL = `
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    password_algo TEXT NOT NULL DEFAULT 'scrypt',
    full_name TEXT NOT NULL,
    account_status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (account_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED')),
    failed_login_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
    locked_until TEXT,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE
        CHECK (code IN ('SISWA', 'GURU_WALAS', 'GURU_WALI', 'TIM_7_KAIH', 'SUPER_ADMIN')),
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    module TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    scope_type TEXT NOT NULL DEFAULT 'GLOBAL'
        CHECK (scope_type IN ('SELF', 'CLASS', 'ROMBEL', 'COHORT', 'SCHOOL', 'GLOBAL')),
    scope_id TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, role_id, scope_type, scope_id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    active_role TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    revoked_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS academic_years (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    semester TEXT NOT NULL DEFAULT 'GANJIL' CHECK (semester IN ('GANJIL', 'GENAP')),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cohorts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    entry_year INTEGER NOT NULL CHECK (entry_year BETWEEN 2000 AND 2100),
    grade_level TEXT NOT NULL CHECK (grade_level IN ('X', 'XI', 'XII', 'ALUMNI')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    nip TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('L', 'P')),
    phone TEXT,
    role_title TEXT NOT NULL,
    assignment_type TEXT NOT NULL DEFAULT 'WALAS'
        CHECK (assignment_type IN ('WALAS', 'GURU_WALI', 'BOTH', 'TIM_7_KAIH', 'ADMIN')),
    class_name TEXT,
    rombel_name TEXT,
    avatar_url TEXT,
    account_status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (account_status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    grade_level TEXT NOT NULL DEFAULT 'XI' CHECK (grade_level IN ('X', 'XI', 'XII')),
    cohort_id TEXT REFERENCES cohorts(id) ON DELETE SET NULL,
    academic_year_id TEXT REFERENCES academic_years(id) ON DELETE RESTRICT,
    walas_teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
    walas_name TEXT,
    capacity INTEGER NOT NULL DEFAULT 36 CHECK (capacity > 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rombels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    academic_year_id TEXT REFERENCES academic_years(id) ON DELETE RESTRICT,
    wali_teacher_id TEXT REFERENCES teachers(id) ON DELETE SET NULL,
    wali_name TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    nisn TEXT NOT NULL UNIQUE,
    nis TEXT UNIQUE,
    name TEXT NOT NULL,
    gender TEXT NOT NULL DEFAULT 'L' CHECK (gender IN ('L', 'P')),
    religion TEXT NOT NULL DEFAULT 'Islam'
        CHECK (religion IN ('Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu')),
    cohort_id TEXT REFERENCES cohorts(id) ON DELETE SET NULL,
    class_id TEXT REFERENCES classes(id) ON DELETE SET NULL,
    class_name TEXT NOT NULL,
    rombel_id TEXT REFERENCES rombels(id) ON DELETE SET NULL,
    rombel_name TEXT,
    xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
    poin_hebat INTEGER NOT NULL DEFAULT 0 CHECK (poin_hebat >= 0),
    level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
    streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
    best_streak INTEGER NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
    predicate TEXT NOT NULL DEFAULT 'Perlu Pembinaan',
    walas_name TEXT,
    walas_nip TEXT,
    walas_notes TEXT DEFAULT '',
    walas_recommendation TEXT DEFAULT '',
    avatar_url TEXT,
    account_status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (account_status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED', 'GRADUATED', 'MUTATED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_class_memberships (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    class_name TEXT NOT NULL,
    academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    start_date TEXT NOT NULL,
    end_date TEXT,
    is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
    move_reason TEXT,
    changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_rombel_memberships (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    rombel_id TEXT NOT NULL REFERENCES rombels(id) ON DELETE RESTRICT,
    rombel_name TEXT NOT NULL,
    academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    start_date TEXT NOT NULL,
    end_date TEXT,
    is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
    move_reason TEXT,
    changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teacher_assignments (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    assignment_role TEXT NOT NULL
        CHECK (assignment_role IN ('GURU_WALAS', 'GURU_WALI', 'TIM_7_KAIH', 'SUPER_ADMIN')),
    class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
    rombel_id TEXT REFERENCES rombels(id) ON DELETE CASCADE,
    start_date TEXT NOT NULL,
    end_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scoring_rule_versions (
    id TEXT PRIMARY KEY,
    version_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    rules_json TEXT NOT NULL,
    no_missed_penalty INTEGER NOT NULL DEFAULT 1 CHECK (no_missed_penalty IN (0, 1)),
    bonus_cap_score REAL NOT NULL DEFAULT 100.0,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    effective_from TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS habit_definitions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE
        CHECK (code IN ('bangun', 'ibadah', 'olahraga', 'makan', 'belajar', 'masyarakat', 'tidur')),
    order_no INTEGER NOT NULL UNIQUE CHECK (order_no BETWEEN 1 AND 7),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    multi_session INTEGER NOT NULL DEFAULT 0 CHECK (multi_session IN (0, 1)),
    max_score REAL NOT NULL DEFAULT 100.0 CHECK (max_score = 100.0),
    min_description_chars INTEGER NOT NULL DEFAULT 10,
    max_point_description_chars INTEGER NOT NULL DEFAULT 15,
    form_schema_json TEXT NOT NULL,
    scoring_version_id TEXT REFERENCES scoring_rule_versions(id) ON DELETE RESTRICT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS habit_schedules (
    id TEXT PRIMARY KEY,
    habit_code TEXT NOT NULL REFERENCES habit_definitions(code) ON DELETE CASCADE,
    session_code TEXT NOT NULL,
    label TEXT NOT NULL,
    window_start TEXT NOT NULL,
    window_end TEXT NOT NULL,
    is_flexible_until_midnight INTEGER NOT NULL DEFAULT 1 CHECK (is_flexible_until_midnight IN (0, 1)),
    academic_year_id TEXT REFERENCES academic_years(id) ON DELETE SET NULL,
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (habit_code, session_code)
);

CREATE TABLE IF NOT EXISTS journals (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    journal_date TEXT NOT NULL,
    academic_year_id TEXT REFERENCES academic_years(id) ON DELETE SET NULL,
    class_id_snapshot TEXT REFERENCES classes(id) ON DELETE SET NULL,
    rombel_id_snapshot TEXT REFERENCES rombels(id) ON DELETE SET NULL,
    completed_habits_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_habits_count BETWEEN 0 AND 7),
    in_progress_habits_count INTEGER NOT NULL DEFAULT 0 CHECK (in_progress_habits_count BETWEEN 0 AND 7),
    missed_habits_count INTEGER NOT NULL DEFAULT 0 CHECK (missed_habits_count BETWEEN 0 AND 7),
    daily_average_score REAL NOT NULL DEFAULT 0.0 CHECK (daily_average_score BETWEEN 0 AND 100),
    journal_status TEXT NOT NULL DEFAULT 'BELUM_DIMULAI'
        CHECK (journal_status IN ('BELUM_DIMULAI', 'SEDANG_DIISI', 'SELESAI', 'BELUM_DIISI_TERLEWAT')),
    is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1)),
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (student_id, journal_date)
);

CREATE TABLE IF NOT EXISTS habit_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_uuid TEXT NOT NULL UNIQUE,
    journal_id TEXT NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    habit_code TEXT NOT NULL REFERENCES habit_definitions(code) ON DELETE RESTRICT,
    log_date TEXT NOT NULL,
    sub_category TEXT NOT NULL DEFAULT '',
    card_status TEXT NOT NULL DEFAULT 'SELESAI'
        CHECK (card_status IN ('BELUM_DIMULAI', 'SEDANG_DIISI', 'SELESAI', 'BELUM_DIISI_TERLEWAT')),
    entry_mode TEXT NOT NULL DEFAULT 'TEPAT_HARI'
        CHECK (entry_mode IN ('TEPAT_HARI', 'TEPAT_HARI_FLEKSIBEL', 'TEPAT_HARI_TIMESTAMP', 'FORMULIR_TERLEWAT')),
    base_score REAL NOT NULL DEFAULT 0.0 CHECK (base_score BETWEEN 0 AND 100),
    bonus_score REAL NOT NULL DEFAULT 0.0 CHECK (bonus_score >= 0),
    final_score REAL NOT NULL DEFAULT 0.0 CHECK (final_score BETWEEN 0 AND 100),
    overflow_bonus_points REAL NOT NULL DEFAULT 0.0 CHECK (overflow_bonus_points >= 0),
    is_locked INTEGER NOT NULL DEFAULT 1 CHECK (is_locked IN (0, 1)),
    is_counter_entry INTEGER NOT NULL DEFAULT 0 CHECK (is_counter_entry IN (0, 1)),
    is_missed INTEGER NOT NULL DEFAULT 0 CHECK (is_missed IN (0, 1)),
    description_text TEXT DEFAULT '',
    description_length INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL DEFAULT '{}',
    scoring_version_id TEXT REFERENCES scoring_rule_versions(id) ON DELETE SET NULL,
    submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (student_id, log_date, habit_code, sub_category)
);

CREATE TABLE IF NOT EXISTS habit_sessions (
    id TEXT PRIMARY KEY,
    habit_entry_id INTEGER NOT NULL REFERENCES habit_entries(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    log_date TEXT NOT NULL,
    habit_code TEXT NOT NULL REFERENCES habit_definitions(code) ON DELETE RESTRICT,
    session_code TEXT NOT NULL,
    session_status TEXT NOT NULL DEFAULT 'SELESAI'
        CHECK (session_status IN ('BELUM_DIMULAI', 'SEDANG_DIISI', 'SELESAI', 'HALANGAN', 'PUASA')),
    execution_time TEXT,
    raw_session_score REAL NOT NULL DEFAULT 0.0,
    normalized_session_score REAL NOT NULL DEFAULT 0.0 CHECK (normalized_session_score BETWEEN 0 AND 100),
    session_payload_json TEXT NOT NULL DEFAULT '{}',
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (student_id, log_date, habit_code, session_code)
);

CREATE TABLE IF NOT EXISTS habit_components (
    id TEXT PRIMARY KEY,
    habit_entry_id INTEGER NOT NULL REFERENCES habit_entries(id) ON DELETE CASCADE,
    habit_session_id TEXT REFERENCES habit_sessions(id) ON DELETE CASCADE,
    component_key TEXT NOT NULL,
    component_label TEXT NOT NULL,
    component_value TEXT,
    score_earned REAL NOT NULL DEFAULT 0.0,
    max_possible_score REAL NOT NULL DEFAULT 100.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS habit_entry_revisions (
    id TEXT PRIMARY KEY,
    habit_entry_id INTEGER NOT NULL REFERENCES habit_entries(id) ON DELETE CASCADE,
    revision_no INTEGER NOT NULL CHECK (revision_no >= 1),
    previous_base_score REAL NOT NULL,
    previous_bonus_score REAL NOT NULL,
    previous_final_score REAL NOT NULL,
    new_base_score REAL NOT NULL,
    new_bonus_score REAL NOT NULL,
    new_final_score REAL NOT NULL,
    previous_payload_json TEXT NOT NULL,
    new_payload_json TEXT NOT NULL,
    change_source TEXT NOT NULL
        CHECK (change_source IN ('STUDENT_SUBMIT', 'EVENT_BONUS', 'ADMIN_CORRECTION', 'MIGRATION')),
    reason TEXT NOT NULL,
    changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    changed_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (habit_entry_id, revision_no)
);

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    bonus_score_amount REAL NOT NULL DEFAULT 10.0 CHECK (bonus_score_amount >= 0),
    min_story_chars INTEGER NOT NULL DEFAULT 15,
    start_date TEXT NOT NULL,
    end_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_bonuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bonus_uuid TEXT NOT NULL UNIQUE,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    habit_entry_id INTEGER REFERENCES habit_entries(id) ON DELETE SET NULL,
    log_date TEXT NOT NULL,
    habit_code TEXT NOT NULL REFERENCES habit_definitions(code) ON DELETE RESTRICT,
    story TEXT NOT NULL CHECK (length(story) >= 15),
    bonus_awarded REAL NOT NULL DEFAULT 10.0 CHECK (bonus_awarded >= 0),
    applied_to_habit_score REAL NOT NULL DEFAULT 0.0 CHECK (applied_to_habit_score >= 0),
    overflow_to_poin_hebat REAL NOT NULL DEFAULT 0.0 CHECK (overflow_to_poin_hebat >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (student_id, log_date)
);

CREATE TABLE IF NOT EXISTS point_transactions (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    transaction_date TEXT NOT NULL,
    point_bucket TEXT NOT NULL
        CHECK (point_bucket IN ('XP', 'POIN_HEBAT', 'STREAK_BONUS')),
    source_type TEXT NOT NULL
        CHECK (source_type IN ('HABIT_COMPLETION', 'EVENT_OVERFLOW', 'STREAK_MILESTONE', 'ADMIN_ADJUSTMENT', 'MIGRATION')),
    source_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    description TEXT NOT NULL,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (student_id, point_bucket, source_type, source_id)
);

CREATE TABLE IF NOT EXISTS streak_records (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
    current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
    longest_streak INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
    total_complete_days INTEGER NOT NULL DEFAULT 0 CHECK (total_complete_days >= 0),
    total_active_days INTEGER NOT NULL DEFAULT 0 CHECK (total_active_days >= 0),
    last_completed_date TEXT,
    last_evaluated_date TEXT,
    streak_status TEXT NOT NULL DEFAULT 'INACTIVE'
        CHECK (streak_status IN ('ACTIVE', 'AT_RISK', 'BROKEN', 'INACTIVE')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
    id TEXT PRIMARY KEY,
    period_type TEXT NOT NULL
        CHECK (period_type IN ('DAILY', 'WEEKLY', 'MONTHLY', 'SEMESTER', 'ALL_TIME')),
    period_key TEXT NOT NULL,
    scope_type TEXT NOT NULL
        CHECK (scope_type IN ('SCHOOL', 'CLASS', 'ROMBEL', 'COHORT')),
    scope_id TEXT NOT NULL DEFAULT 'SCHOOL',
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    rank_position INTEGER NOT NULL CHECK (rank_position >= 1),
    average_score REAL NOT NULL DEFAULT 0.0,
    total_xp INTEGER NOT NULL DEFAULT 0,
    poin_hebat INTEGER NOT NULL DEFAULT 0,
    streak_days INTEGER NOT NULL DEFAULT 0,
    generated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (period_type, period_key, scope_type, scope_id, student_id)
);

CREATE TABLE IF NOT EXISTS admin_validations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    validation_uuid TEXT NOT NULL UNIQUE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    verification_score INTEGER NOT NULL CHECK (verification_score BETWEEN 1 AND 10),
    verified_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    verified_by TEXT NOT NULL,
    notes TEXT DEFAULT '',
    verified_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS data_corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    correction_uuid TEXT NOT NULL UNIQUE,
    habit_entry_id INTEGER REFERENCES habit_entries(id) ON DELETE SET NULL,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    log_date TEXT NOT NULL,
    habit_type TEXT NOT NULL REFERENCES habit_definitions(code) ON DELETE RESTRICT,
    sub_category TEXT NOT NULL DEFAULT '',
    old_score REAL NOT NULL DEFAULT 0.0,
    new_score REAL NOT NULL CHECK (new_score BETWEEN 0 AND 100),
    old_payload TEXT,
    new_payload TEXT,
    reason TEXT NOT NULL CHECK (length(reason) >= 5),
    actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    corrected_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    actor_username TEXT,
    actor_role TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    before_state_json TEXT,
    after_state_json TEXT,
    reason TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    value_type TEXT NOT NULL DEFAULT 'STRING'
        CHECK (value_type IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON')),
    description TEXT,
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    widget_type TEXT NOT NULL
        CHECK (widget_type IN ('METRIC_CARD', 'CHART_TREND', 'ANNOUNCEMENT_BANNER', 'LEADERBOARD_TABLE', 'HABIT_DISTRIBUTION')),
    visible_public INTEGER NOT NULL DEFAULT 1 CHECK (visible_public IN (0, 1)),
    visible_student INTEGER NOT NULL DEFAULT 1 CHECK (visible_student IN (0, 1)),
    visible_teacher INTEGER NOT NULL DEFAULT 1 CHECK (visible_teacher IN (0, 1)),
    display_order INTEGER NOT NULL DEFAULT 1,
    config_json TEXT NOT NULL DEFAULT '{}',
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('ANNOUNCEMENT', 'QUOTE')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

const INDEXES_AND_VIEWS_DDL = `
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_scope ON user_roles(user_id, is_active, scope_type, scope_id);

CREATE INDEX IF NOT EXISTS idx_students_class_status ON students(class_name, account_status);
CREATE INDEX IF NOT EXISTS idx_students_rombel_status ON students(rombel_name, account_status);
CREATE INDEX IF NOT EXISTS idx_students_cohort_status ON students(cohort_id, account_status);
CREATE INDEX IF NOT EXISTS idx_students_leaderboard ON students(account_status, xp DESC, poin_hebat DESC, streak DESC);
CREATE INDEX IF NOT EXISTS idx_scm_student_current ON student_class_memberships(student_id, is_current);
CREATE INDEX IF NOT EXISTS idx_srm_student_current ON student_rombel_memberships(student_id, is_current);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON teacher_assignments(teacher_id, is_active);

CREATE INDEX IF NOT EXISTS idx_journals_student_date ON journals(student_id, journal_date DESC);
CREATE INDEX IF NOT EXISTS idx_journals_date_status ON journals(journal_date, journal_status);
CREATE INDEX IF NOT EXISTS idx_habit_entries_student_date ON habit_entries(student_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_habit_entries_date_habit ON habit_entries(log_date, habit_code);
CREATE INDEX IF NOT EXISTS idx_habit_entries_student_habit ON habit_entries(student_id, habit_code, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_habit_entries_covering_habit_score ON habit_entries(habit_code, student_id, final_score);
CREATE INDEX IF NOT EXISTS idx_habit_entries_student_covering ON habit_entries(student_id, habit_code, final_score);
CREATE INDEX IF NOT EXISTS idx_habit_sessions_entry ON habit_sessions(habit_entry_id);
CREATE INDEX IF NOT EXISTS idx_habit_sessions_student_date ON habit_sessions(student_id, log_date, habit_code);
CREATE INDEX IF NOT EXISTS idx_habit_components_entry ON habit_components(habit_entry_id);

CREATE INDEX IF NOT EXISTS idx_point_tx_student_date ON point_transactions(student_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_event_bonuses_student_date ON event_bonuses(student_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_admin_validations_student ON admin_validations(student_id, verified_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_corrections_student_date ON data_corrections(student_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id, created_at DESC);
`;

let singletonDb: RelationalDatabase | null = null;

export function getDb(customPath?: string): RelationalDatabase {
  if (customPath) {
    const db = new RelationalDatabase(customPath);
    db.runMigrations();
    return db;
  }
  if (!singletonDb) {
    singletonDb = new RelationalDatabase();
    singletonDb.runMigrations();
  }
  return singletonDb;
}
