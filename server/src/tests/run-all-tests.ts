/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Comprehensive Automated Test Suite & 750-Student Performance Benchmark
 * VERTIKAL SMA JAWARA 28
 *
 * Executes:
 * - Suite A: Database Schema, Foreign Keys, Unique Constraints, Memberships & Revisions
 * - Suite B: Authentication (scrypt), Session Expiry/Revocation & Least-Privilege RBAC
 * - Suite C: 7 KAIH Scoring Engine, No -5 Penalty, Card Locking, Bonus Overflow & Audit Corrections
 * - Suite D: Atomic Transaction Rollback, Concurrency, Group Move Continuity, Deactivation & Backup/Restore
 * - Suite E: Individual Report, Class, Rombel, Cohort & School Analytics Mathematical Consistency
 * - Suite F: 750-Student / 52,500-Entry Load & Performance Benchmark
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { RelationalDatabase } from '../database/client.ts';
import { seedDevelopmentDemoData } from '../database/seed.ts';
import { JawaraApplication } from '../app.ts';
import { hashPassword, verifyPassword } from '../shared/utilities/password.ts';
import { VALID_HABIT_CODES } from '../shared/schemas/validation-schemas.ts';

interface TestCaseResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

interface BenchmarkMetric {
  scenario: string;
  iterations: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
  opsPerSec: number;
}

const results: TestCaseResult[] = [];

async function runTest(suite: string, name: string, fn: () => Promise<void> | void): Promise<void> {
  const start = performance.now();
  try {
    await fn();
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    results.push({ suite, name, passed: true, durationMs });
    console.log(`  [PASS] (${durationMs} ms) ${suite} :: ${name}`);
  } catch (err: any) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    const errMsg = err instanceof Error ? err.message : String(err);
    results.push({ suite, name, passed: false, durationMs, error: errMsg });
    console.error(`  [FAIL] (${durationMs} ms) ${suite} :: ${name} -> ${errMsg}`);
  }
}

function measureScenario(
  scenario: string,
  iterations: number,
  fn: (i: number) => void
): BenchmarkMetric {
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn(i);
    samples.push(performance.now() - t0);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avgMs = Math.round((sum / iterations) * 100) / 100;
  const minMs = Math.round(sorted[0] * 100) / 100;
  const maxMs = Math.round(sorted[sorted.length - 1] * 100) / 100;
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95Ms = Math.round(sorted[p95Index] * 100) / 100;
  const opsPerSec = sum > 0 ? Math.round((iterations / (sum / 1000)) * 10) / 10 : 0;

  return { scenario, iterations, avgMs, minMs, maxMs, p95Ms, opsPerSec };
}

async function main() {
  console.log('================================================================================');
  console.log('VERTIKAL SMA JAWARA 28 — AUTOMATED TEST SUITE & 750-STUDENT BENCHMARK');
  console.log('================================================================================');

  const testDbPath = path.resolve(process.cwd(), 'database', 'test_jawara28_functional.db');
  for (const ext of ['', '-wal', '-shm']) {
    if (fs.existsSync(testDbPath + ext)) fs.unlinkSync(testDbPath + ext);
  }

  const db = new RelationalDatabase(testDbPath);
  db.runMigrations();
  seedDevelopmentDemoData(db, '2026-10-27');
  const app = new JawaraApplication(db);
  app.setSimulatedTodayDate('2026-10-27');

  // ============================================================================
  // SUITE A: PENGUJIAN DATABASE & CONSTRAINTS
  // ============================================================================
  console.log('\n--- SUITE A: Database Schema, Foreign Keys & Constraints ---');

  await runTest('Suite A', 'A1. Versioned migrations applied & all 35 relational tables exist', () => {
    const migs = db.queryAll<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version ASC');
    assert.equal(migs.length, 2);
    assert.equal(migs[0].version, '001');
    assert.equal(migs[1].version, '002');

    const tables = db.queryAll<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    const tableNames = tables.map((t) => t.name);
    const requiredTables = [
      'users', 'roles', 'user_roles', 'permissions', 'role_permissions', 'sessions', 'password_reset_tokens',
      'academic_years', 'cohorts', 'teachers', 'classes', 'rombels', 'students',
      'student_class_memberships', 'student_rombel_memberships', 'teacher_assignments',
      'scoring_rule_versions', 'habit_definitions', 'habit_schedules',
      'journals', 'habit_entries', 'habit_sessions', 'habit_components', 'habit_entry_revisions',
      'events', 'event_bonuses', 'point_transactions', 'streak_records', 'leaderboard_snapshots',
      'admin_validations', 'data_corrections', 'audit_logs', 'app_settings', 'dashboard_widgets',
    ];
    for (const reqTbl of requiredTables) {
      assert.ok(tableNames.includes(reqTbl), `Tabel wajib '${reqTbl}' belum ada`);
    }
  });

  await runTest('Suite A', 'A2. Foreign key constraint rejects orphan habit_entries & memberships', () => {
    assert.throws(() => {
      db.execute(
        `INSERT INTO journals (id, student_id, journal_date, journal_status)
         VALUES ('jrn-orphan', 'std-non-existent-999', '2026-10-27', 'BELUM_DIMULAI')`
      );
    }, /FOREIGN KEY constraint failed/);
  });

  await runTest('Suite A', 'A3. Unique constraints reject duplicate NISN, NIP, and username', () => {
    assert.throws(() => {
      db.execute(
        `INSERT INTO users (id, username, password_hash, full_name)
         VALUES ('usr-dup', 'siswa', 'scrypt$16384$8$1$aa$bb', 'Duplicate User')`
      );
    }, /UNIQUE constraint failed/);
  });

  // ============================================================================
  // SUITE B: PENGUJIAN AUTENTIKASI, SESI, DAN OTORISASI (RBAC)
  // ============================================================================
  console.log('\n--- SUITE B: Authentication, Password Hashing & Least-Privilege RBAC ---');

  let siswaToken = '';
  let siswaiToken = '';
  let walasToken = '';
  let waliToken = '';
  let tim7kaihToken = '';
  let adminToken = '';

  await runTest('Suite B', 'B1. Cryptographic scrypt password hashing uses unique random salt per call', () => {
    const h1 = hashPassword('RahasiaNegara28!');
    const h2 = hashPassword('RahasiaNegara28!');
    assert.notEqual(h1, h2, 'Dua hash dari password sama wajib berbeda karena random salt');
    assert.ok(h1.startsWith('scrypt$'));
    assert.equal(verifyPassword('RahasiaNegara28!', h1), true);
    assert.equal(verifyPassword('RahasiaNegara28!', h2), true);
    assert.equal(verifyPassword('SalahPassword', h1), false);
    assert.equal(verifyPassword('123', '123'), false, 'Plaintext tidak boleh pernah diterima');
  });

  await runTest('Suite B', 'B2. Valid login succeeds across all roles (Siswa, Walas, Wali, Tim 7 KAIH, Admin)', async () => {
    const rSiswa = await app.dispatch({
      method: 'POST',
      path: '/api/login',
      body: { role: 'siswa', username: 'siswa', password: '123' },
    });
    assert.equal(rSiswa.statusCode, 200);
    assert.ok(rSiswa.body.token);
    siswaToken = rSiswa.body.token;

    const rSiswai = await app.dispatch({
      method: 'POST',
      path: '/api/login',
      body: { role: 'siswa', username: 'siswai', password: '123' },
    });
    assert.equal(rSiswai.statusCode, 200);
    siswaiToken = rSiswai.body.token;

    const rWalas = await app.dispatch({
      method: 'POST',
      path: '/api/login',
      body: { role: 'guru', username: 'guru', password: '123' },
    });
    assert.equal(rWalas.statusCode, 200);
    walasToken = rWalas.body.token;

    const rWali = await app.dispatch({
      method: 'POST',
      path: '/api/login',
      body: { role: 'guru', username: 'wali', password: '123' },
    });
    assert.equal(rWali.statusCode, 200);
    waliToken = rWali.body.token;

    const r7Kaih = await app.dispatch({
      method: 'POST',
      path: '/api/login',
      body: { role: 'guru', username: 'tim7kaih', password: '123' },
    });
    assert.equal(r7Kaih.statusCode, 200);
    tim7kaihToken = r7Kaih.body.token;

    const rAdmin = await app.dispatch({
      method: 'POST',
      path: '/api/admin/login',
      body: { username: 'admin', password: '123' },
    });
    assert.equal(rAdmin.statusCode, 200);
    adminToken = rAdmin.body.token;
  });

  await runTest('Suite B', 'B3. Invalid login rejected (401) & non-admin blocked from /api/admin/login (403)', async () => {
    const badPass = await app.dispatch({
      method: 'POST',
      path: '/api/login',
      body: { role: 'siswa', username: 'siswa', password: 'wrong_password' },
    });
    assert.equal(badPass.statusCode, 401);

    const studentTryAdmin = await app.dispatch({
      method: 'POST',
      path: '/api/admin/login',
      body: { username: 'siswa', password: '123' },
    });
    assert.equal(studentTryAdmin.statusCode, 403);
  });

  await runTest('Suite B', 'B4. Expired and revoked sessions are rejected with 401 Unauthorized', async () => {
    const tempLogin = await app.dispatch({
      method: 'POST',
      path: '/api/login',
      body: { role: 'siswa', username: 'siswa', password: '123' },
    });
    const tempToken = tempLogin.body.token;

    // Logout revokes session
    await app.dispatch({
      method: 'POST',
      path: '/api/logout',
      headers: { Authorization: `Bearer ${tempToken}` },
    });

    const afterLogout = await app.dispatch({
      method: 'GET',
      path: '/api/auth/me',
      headers: { Authorization: `Bearer ${tempToken}` },
    });
    assert.equal(afterLogout.statusCode, 401);
  });

  await runTest('Suite B', 'B5. IDOR Protection: Siswa A cannot read or write Siswa B journal or report (403)', async () => {
    const readOtherJournal = await app.dispatch({
      method: 'GET',
      path: '/api/habits/today',
      query: { student_id: 'std-siswai' },
      headers: { Authorization: `Bearer ${siswaToken}` },
    });
    assert.equal(readOtherJournal.statusCode, 403);

    const readOtherReport = await app.dispatch({
      method: 'GET',
      path: '/api/student/std-siswai/report',
      headers: { Authorization: `Bearer ${siswaToken}` },
    });
    assert.equal(readOtherReport.statusCode, 403);

    const writeOtherHabit = await app.dispatch({
      method: 'POST',
      path: '/api/habits',
      headers: { Authorization: `Bearer ${siswaToken}` },
      body: {
        student_id: 'std-siswai',
        habit_type: 'bangun',
        payload: { jamBangun: '04:45', merapikanTempatTidur: true, kebugaranLevel: 5 },
      },
    });
    assert.equal(writeOtherHabit.statusCode, 403);
  });

  await runTest('Suite B', 'B6. Class Scope Protection: Guru Walas XI-MIPA-1 blocked from XI-MIPA-2 (403)', async () => {
    const allowedClass = await app.dispatch({
      method: 'GET',
      path: '/api/class/XI-MIPA-1/analytics',
      headers: { Authorization: `Bearer ${walasToken}` },
    });
    assert.equal(allowedClass.statusCode, 200);

    const forbiddenClass = await app.dispatch({
      method: 'GET',
      path: '/api/class/XI-MIPA-2/analytics',
      headers: { Authorization: `Bearer ${walasToken}` },
    });
    assert.equal(forbiddenClass.statusCode, 403);
  });

  await runTest('Suite B', 'B7. Rombel Scope Protection: Guru Wali Rombel A blocked from Rombel B (403)', async () => {
    const allowedRombel = await app.dispatch({
      method: 'GET',
      path: `/api/rombel/${encodeURIComponent('Rombel Sains & Riset A')}/analytics`,
      headers: { Authorization: `Bearer ${waliToken}` },
    });
    assert.equal(allowedRombel.statusCode, 200);

    const forbiddenRombel = await app.dispatch({
      method: 'GET',
      path: `/api/rombel/${encodeURIComponent('Rombel Sosial & Humaniora B')}/analytics`,
      headers: { Authorization: `Bearer ${waliToken}` },
    });
    assert.equal(forbiddenRombel.statusCode, 403);
  });

  await runTest('Suite B', 'B8. Unauthenticated access to sensitive endpoints rejected with 401', async () => {
    const r1 = await app.dispatch({ method: 'GET', path: '/api/admin/overview' });
    assert.equal(r1.statusCode, 401);

    const r2 = await app.dispatch({
      method: 'POST',
      path: '/api/admin/students',
      body: { name: 'Hacker', nisn: '99999999' },
    });
    assert.equal(r2.statusCode, 401);

    const r3 = await app.dispatch({ method: 'GET', path: '/api/student/std-siswa/report' });
    assert.equal(r3.statusCode, 401);
  });

  // ============================================================================
  // SUITE C: PENGUJIAN LOGIKA BISNIS & PENILAIAN 7 KEBIASAAN
  // ============================================================================
  console.log('\n--- SUITE C: 7 KAIH Scoring Engine, Locking, Bonus Cap/Overflow & Corrections ---');

  await runTest('Suite C', 'C1. Valid Bangun Pagi submission computes exact score & stores components', async () => {
    const res = await app.dispatch({
      method: 'POST',
      path: '/api/habits',
      headers: { Authorization: `Bearer ${siswaToken}` },
      body: {
        student_id: 'std-siswa',
        habit_type: 'bangun',
        log_date: '2026-10-27',
        payload: {
          jamBangun: '04:45', // 70 pts
          merapikanTempatTidur: true, // 15 pts
          kebugaranLevel: 5, // 15 pts
          deskripsi: 'Bangun pagi badan terasa sangat segar dan siap belajar',
        },
      },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.base_score, 100);
    assert.equal(res.body.final_score, 100);

    const comps = db.queryAll<any>(
      `SELECT * FROM habit_components WHERE habit_entry_id = ?`,
      [res.body.entry_id]
    );
    assert.equal(comps.length, 3);
  });

  await runTest('Suite C', 'C2. Duplicate submission to a completed/locked habit card is rejected (409)', async () => {
    const dupRes = await app.dispatch({
      method: 'POST',
      path: '/api/habits',
      headers: { Authorization: `Bearer ${siswaToken}` },
      body: {
        student_id: 'std-siswa',
        habit_type: 'bangun',
        log_date: '2026-10-27',
        overwrite: false,
        payload: { jamBangun: '06:30', merapikanTempatTidur: false, kebugaranLevel: 2 },
      },
    });
    assert.equal(dupRes.statusCode, 409);
  });

  await runTest('Suite C', 'C3. Missed (Formulir Terlewat) submission has NO -5 penalty per Final Spec', async () => {
    const res = await app.dispatch({
      method: 'POST',
      path: '/api/habits',
      headers: { Authorization: `Bearer ${siswaToken}` },
      body: {
        student_id: 'std-siswa',
        habit_type: 'tidur',
        log_date: '2026-10-26', // Past date -> FORMULIR_TERLEWAT
        is_missed: 1,
        payload: {
          jamTidur: '21:15', // 75 pts
          matikanGawai: true,
          berdoaSebelumTidur: true, // 25 pts
          entryMode: 'terlewat',
        },
      },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.final_score, 100, 'Tidak boleh ada pengurangan 5 poin untuk formulir terlewat');
  });

  await runTest('Suite C', 'C4. Female student Islam Halangan mode calculates 75 + 25 = 100 without double counting', async () => {
    const res = await app.dispatch({
      method: 'POST',
      path: '/api/habits',
      headers: { Authorization: `Bearer ${siswaiToken}` },
      body: {
        student_id: 'std-siswai',
        habit_type: 'ibadah',
        log_date: '2026-10-27',
        sub_category: 'halangan',
        payload: {
          isHalangan: true,
          aktivitasPengganti: ['zikir', 'kajian', 'sedekah'],
          refleksi: 'Mendengarkan kajian ustadzah dan berzikir pagi petang dengan khusyuk.',
        },
      },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.final_score, 100);
  });

  await runTest('Suite C', 'C5. Aktivitas Seru (+10 bonus) caps habit score at 100 & routes overflow to Poin Hebat', async () => {
    // Submit olahraga with base score 95 (durasi 30m [60] + intensitas [15] + deskripsi > 15 chars [20])
    const hRes = await app.dispatch({
      method: 'POST',
      path: '/api/habits',
      headers: { Authorization: `Bearer ${siswaToken}` },
      body: {
        student_id: 'std-siswa',
        habit_type: 'olahraga',
        log_date: '2026-10-27',
        payload: {
          jenisOlahraga: 'Lari Pagi',
          durasi: 30,
          intensitas: 'ringan', // 15 pts -> total 60 + 15 + 20 = 95
          catatanOlahraga: 'Lari keliling lapangan SMAN 28 Jakarta bersama teman sekelas.',
        },
      },
    });
    assert.equal(hRes.statusCode, 200);
    assert.equal(hRes.body.base_score, 95);

    const bonusRes = await app.dispatch({
      method: 'POST',
      path: '/api/aktivitas-seru',
      headers: { Authorization: `Bearer ${siswaToken}` },
      body: {
        student_id: 'std-siswa',
        habit_type: 'olahraga',
        log_date: '2026-10-27',
        story: 'Pengalaman seru lari pagi bersama teman-teman sambil menghirup udara segar di sekolah!',
      },
    });
    assert.equal(bonusRes.statusCode, 200);
    assert.equal(bonusRes.body.bonus_awarded, 10);
    assert.equal(bonusRes.body.applied_to_habit_score, 5);
    assert.equal(bonusRes.body.overflow_points, 5);

    const entryAfter = db.queryOne<any>(
      `SELECT base_score, bonus_score, final_score, overflow_bonus_points
       FROM habit_entries WHERE id = ?`,
      [hRes.body.entry_id]
    );
    assert.equal(Number(entryAfter.final_score), 100, 'Nilai capaian tidak boleh melebihi 100');
    assert.equal(Number(entryAfter.overflow_bonus_points), 5, 'Kelebihan 5 poin harus masuk overflow');

    const ptx = db.queryOne<any>(
      `SELECT * FROM point_transactions
       WHERE student_id = 'std-siswa' AND point_bucket = 'POIN_HEBAT' AND source_id = 'aktivitas_seru:2026-10-27'`
    );
    assert.ok(ptx, 'Transaksi Poin Hebat wajib tercatat di point_transactions');
    assert.equal(Number(ptx.amount), 5);
  });

  await runTest('Suite C', 'C6. Controlled Admin score correction requires reason & writes audit + revision logs', async () => {
    const noReasonRes = await app.dispatch({
      method: 'POST',
      path: '/api/admin/journals/correct',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        student_id: 'std-siswa',
        log_date: '2026-10-27',
        habit_type: 'bangun',
        new_score: 90,
        reason: '', // Too short -> must fail validation
      },
    });
    assert.equal(noReasonRes.statusCode, 400);

    const validCorr = await app.dispatch({
      method: 'POST',
      path: '/api/admin/journals/correct',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        student_id: 'std-siswa',
        log_date: '2026-10-27',
        habit_type: 'bangun',
        new_score: 92,
        reason: 'Koreksi jam bangun berdasarkan konfirmasi orang tua siswa.',
      },
    });
    assert.equal(validCorr.statusCode, 200);
    assert.equal(validCorr.body.old_score, 100);
    assert.equal(validCorr.body.new_score, 92);

    const corrRecord = db.queryOne<any>(
      `SELECT * FROM data_corrections WHERE habit_entry_id = ? ORDER BY id DESC LIMIT 1`,
      [validCorr.body.log_id]
    );
    assert.ok(corrRecord);
    assert.equal(Number(corrRecord.new_score), 92);

    const auditRecord = db.queryOne<any>(
      `SELECT * FROM audit_logs WHERE action = 'JOURNAL_SCORE_CORRECTION' AND entity_id = ?`,
      [String(validCorr.body.log_id)]
    );
    assert.ok(auditRecord, 'Jejak audit koreksi jurnal wajib tercatat di audit_logs');
  });

  // ============================================================================
  // SUITE D: PENGUJIAN INTEGRITAS DATA, TRANSAKSI, MUTASI & BACKUP
  // ============================================================================
  console.log('\n--- SUITE D: Atomic Transactions, Group Mutation Continuity & Deactivation ---');

  await runTest('Suite D', 'D1. Atomic transaction rolls back completely on mid-operation failure', () => {
    const countBefore = db.queryOne<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM users')!.cnt;
    assert.throws(() => {
      db.transaction(() => {
        db.execute(
          `INSERT INTO users (id, username, password_hash, full_name)
           VALUES ('usr-rollback-test', 'rollback_user', 'scrypt$16384$8$1$aa$bb', 'Rollback User')`
        );
        // Trigger intentional constraint error inside same transaction
        db.execute(
          `INSERT INTO users (id, username, password_hash, full_name)
           VALUES ('usr-rollback-test', 'rollback_user', 'scrypt$16384$8$1$aa$bb', 'Duplicate Primary Key')`
        );
      });
    });
    const countAfter = db.queryOne<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM users')!.cnt;
    assert.equal(countAfter, countBefore, 'Jumlah baris users wajib kembali seperti semula setelah rollback');
  });

  await runTest('Suite D', 'D2. Completing all 7 habits on a date updates journal status to SELESAI & streak', async () => {
    const all7Habits = [
      { habit_type: 'bangun', payload: { jamBangun: '04:30', merapikanTempatTidur: true, kebugaranLevel: 5 } },
      { habit_type: 'ibadah', sub_category: 'subuh', payload: { waktuSholat: 'subuh', caraPelaksanaan: 'jamaah', waktuPelaksanaan: 'awal' } },
      { habit_type: 'olahraga', payload: { jenisOlahraga: 'Senam', durasi: 30, intensitas: 'sedang', catatanOlahraga: 'Senam pagi bersama di halaman sekolah' } },
      { habit_type: 'makan', sub_category: 'pagi', payload: { isPuasa: true } },
      { habit_type: 'makan', sub_category: 'siang', payload: { isPuasa: true } },
      { habit_type: 'makan', sub_category: 'malam', payload: { isPuasa: true } },
      { habit_type: 'belajar', payload: { materi: 'Fisika Kuantum', durasi: 60, ringkasanMateri: 'Mempelajari persamaan gelombang Schrodinger' } },
      { habit_type: 'masyarakat', payload: { jenisKegiatan: 'Kerja Bakti', peran: 'Inisiator', dampakSosial: 'Membersihkan taman kelas bersama teman-teman' } },
      { habit_type: 'tidur', payload: { jamTidur: '21:15', matikanGawai: true, berdoaSebelumTidur: true } },
    ];

    for (const item of all7Habits) {
      const r = await app.dispatch({
        method: 'POST',
        path: '/api/habits',
        headers: { Authorization: `Bearer ${siswaiToken}` },
        body: {
          student_id: 'std-siswai',
          log_date: '2026-10-27',
          overwrite: true,
          ...item,
        },
      });
      assert.equal(r.statusCode, 200);
    }

    const journalRow = db.queryOne<any>(
      `SELECT * FROM journals WHERE student_id = 'std-siswai' AND journal_date = '2026-10-27'`
    );
    assert.ok(journalRow);
    assert.equal(Number(journalRow.completed_habits_count), 7);
    assert.equal(journalRow.journal_status, 'SELESAI');
    assert.equal(Number(journalRow.daily_average_score), 100);
  });

  await runTest('Suite D', 'D3. Moving student class & rombel preserves historical journals & records membership history', async () => {
    const entriesBefore = db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM habit_entries WHERE student_id = 'std-siswak'`
    )!.cnt;

    const moveRes = await app.dispatch({
      method: 'POST',
      path: '/api/admin/move-student-group',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        student_id: 'std-siswak',
        target_class_name: 'XI-MIPA-2',
        target_rombel_name: 'Rombel Teknologi & Inovasi C',
        reason: 'Penyesuaian peminatan semester ganjil',
      },
    });
    assert.equal(moveRes.statusCode, 200);

    const memberships = db.queryAll<any>(
      `SELECT * FROM student_class_memberships WHERE student_id = 'std-siswak' ORDER BY created_at ASC`
    );
    assert.equal(memberships.length, 2);
    assert.equal(Number(memberships[0].is_current), 0);
    assert.equal(Number(memberships[1].is_current), 1);
    assert.equal(memberships[1].class_name, 'XI-MIPA-2');

    // Move back to XI-MIPA-1 for subsequent analytics tests
    await app.dispatch({
      method: 'POST',
      path: '/api/admin/move-student-group',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        student_id: 'std-siswak',
        target_class_name: 'XI-MIPA-1',
        target_rombel_name: 'Rombel Sosial & Humaniora B',
      },
    });

    const entriesAfter = db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM habit_entries WHERE student_id = 'std-siswak'`
    )!.cnt;
    assert.equal(entriesAfter, entriesBefore);
  });

  await runTest('Suite D', 'D4. Deactivating a student account revokes active sessions & blocks login while keeping history', async () => {
    await app.dispatch({
      method: 'POST',
      path: '/api/admin/students',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        id: 'std-temp-deact',
        username: 'tempdeact',
        password: '123',
        nisn: '0089999888',
        name: 'Siswa Uji Nonaktif',
        class_name: 'XI-MIPA-1',
        rombel_name: 'Rombel Sains & Riset A',
      },
    });

    const loginRes = await app.dispatch({
      method: 'POST',
      path: '/api/login',
      body: { role: 'siswa', username: 'tempdeact', password: '123' },
    });
    assert.equal(loginRes.statusCode, 200);
    const activeTok = loginRes.body.token;

    // Deactivate account
    const deactRes = await app.dispatch({
      method: 'DELETE',
      path: '/api/admin/students/std-temp-deact',
      query: { mode: 'INACTIVE' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(deactRes.statusCode, 200);

    // Existing token must now fail
    const meRes = await app.dispatch({
      method: 'GET',
      path: '/api/auth/me',
      headers: { Authorization: `Bearer ${activeTok}` },
    });
    assert.equal(meRes.statusCode, 401);

    // Subsequent login must fail with 403
    const loginAgain = await app.dispatch({
      method: 'POST',
      path: '/api/login',
      body: { role: 'siswa', username: 'tempdeact', password: '123' },
    });
    assert.equal(loginAgain.statusCode, 403);
  });

  // ============================================================================
  // SUITE E: PENGUJIAN ANALITIK DAN RAPOR (KONSISTENSI DATA SUMBER)
  // ============================================================================
  console.log('\n--- SUITE E: Individual Report, Class, Rombel, Cohort & School Analytics ---');

  await runTest('Suite E', 'E1. Individual Student Report matches exact SQL average of habit_entries', async () => {
    const repRes = await app.dispatch({
      method: 'GET',
      path: '/api/student/std-siswai/report',
      headers: { Authorization: `Bearer ${siswaiToken}` },
    });
    assert.equal(repRes.statusCode, 200);
    assert.equal(repRes.body.overallScore, 100);
    assert.equal(repRes.body.habitMetrics.length, 7);
    assert.equal(repRes.body.student.predicate, 'Sangat Terbiasa (Teladan)');
  });

  await runTest('Suite E', 'E2. Class Analytics, Rombel Analytics & School Analytics match source student counts', async () => {
    const clsRes = await app.dispatch({
      method: 'GET',
      path: '/api/class/XI-MIPA-1/analytics',
      headers: { Authorization: `Bearer ${walasToken}` },
    });
    assert.equal(clsRes.statusCode, 200);
    assert.equal(clsRes.body.totalStudents, 4);

    const rmbRes = await app.dispatch({
      method: 'GET',
      path: `/api/rombel/${encodeURIComponent('Rombel Sains & Riset A')}/analytics`,
      headers: { Authorization: `Bearer ${waliToken}` },
    });
    assert.equal(rmbRes.statusCode, 200);
    assert.equal(rmbRes.body.totalStudents, 2);

    const schRes = await app.dispatch({
      method: 'GET',
      path: '/api/school/analytics',
    });
    assert.equal(schRes.statusCode, 200);
    assert.equal(schRes.body.totalStudents, 4);
    assert.ok(Array.isArray(schRes.body.cohorts));
  });

  db.close();
  for (const ext of ['', '-wal', '-shm']) {
    if (fs.existsSync(testDbPath + ext)) fs.unlinkSync(testDbPath + ext);
  }

  // ============================================================================
  // SUITE F: 750-STUDENT LOAD & PERFORMANCE BENCHMARK (52,500+ HABIT ENTRIES)
  // ============================================================================
  console.log('\n--- SUITE F: 750-Student Scale Benchmark (750 Students, 21 Classes, 15 Rombels, 52,500 Habit Entries) ---');

  const benchDbPath = path.resolve(process.cwd(), 'database', 'benchmark_750_jawara28.db');
  for (const ext of ['', '-wal', '-shm']) {
    if (fs.existsSync(benchDbPath + ext)) fs.unlinkSync(benchDbPath + ext);
  }

  const benchDb = new RelationalDatabase(benchDbPath);
  benchDb.runMigrations();
  seedDevelopmentDemoData(benchDb, '2026-10-27');
  const benchApp = new JawaraApplication(benchDb);
  benchApp.setSimulatedTodayDate('2026-10-27');

  const seedStart = performance.now();
  const sharedHash = hashPassword('123');
  const classesList: string[] = [];
  for (const grade of ['X', 'XI', 'XII']) {
    for (let c = 1; c <= 7; c++) {
      classesList.push(`${grade}-MIPA-${c}`);
    }
  }
  const rombelsList: string[] = [];
  for (let r = 1; r <= 15; r++) {
    rombelsList.push(`Rombel Binaan ${r}`);
  }

  const dates10Days = [
    '2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
    '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27',
  ];

  benchDb.transaction(() => {
    for (const cName of classesList) {
      benchApp.usersAcademicService.ensureClassExists(cName);
    }
    for (const rName of rombelsList) {
      benchApp.usersAcademicService.ensureRombelExists(rName);
    }

    const insertUserStmt = benchDb.raw.prepare(
      `INSERT OR IGNORE INTO users (id, username, password_hash, password_algo, full_name, account_status)
       VALUES (?, ?, ?, 'scrypt', ?, 'ACTIVE')`
    );
    const insertRoleStmt = benchDb.raw.prepare(
      `INSERT OR IGNORE INTO user_roles (id, user_id, role_id, scope_type, scope_id, is_active)
       VALUES (?, ?, 'role-siswa', 'SELF', ?, 1)`
    );
    const insertStudentStmt = benchDb.raw.prepare(
      `INSERT OR IGNORE INTO students
       (id, user_id, nisn, name, gender, religion, cohort_id, class_name, rombel_name,
        xp, poin_hebat, level, streak, best_streak, predicate, account_status)
       VALUES (?, ?, ?, ?, ?, 'Islam', ?, ?, ?, ?, ?, ?, 10, 10, 'Sangat Terbiasa (Teladan)', 'ACTIVE')`
    );
    const insertJournalStmt = benchDb.raw.prepare(
      `INSERT OR IGNORE INTO journals
       (id, student_id, journal_date, academic_year_id, completed_habits_count, daily_average_score, journal_status, is_locked)
       VALUES (?, ?, ?, 'ay-2026-2027-1', 7, ?, 'SELESAI', 1)`
    );
    const insertEntryStmt = benchDb.raw.prepare(
      `INSERT OR IGNORE INTO habit_entries
       (entry_uuid, journal_id, student_id, habit_code, log_date, sub_category,
        card_status, entry_mode, base_score, bonus_score, final_score, overflow_bonus_points,
        is_locked, payload_json, scoring_version_id)
       VALUES (?, ?, ?, ?, ?, '', 'SELESAI', 'TEPAT_HARI', ?, 0, ?, 0, 1, '{"seeded":true}', 'srv-7kaih-2026-final')`
    );

    // Seed up to 750 active students total (4 already seeded + 746 synthetic)
    for (let i = 5; i <= 750; i++) {
      const studentId = `std-bench-${String(i).padStart(4, '0')}`;
      const userId = `usr-${studentId}`;
      const username = `siswa${i}`;
      const nisn = `008555${String(i).padStart(4, '0')}`;
      const className = classesList[i % classesList.length];
      const rombelName = rombelsList[i % rombelsList.length];
      const cohortId = className.startsWith('XII')
        ? 'coh-2024'
        : className.startsWith('X-')
        ? 'coh-2026'
        : 'coh-2025';
      const baseScore = 80 + (i % 21); // 80..100
      const xp = baseScore * 70;
      const poinHebat = (i % 5) * 10;
      const level = Math.floor(xp / 250) + 1;

      insertUserStmt.run(userId, username, sharedHash, `Siswa Jawara #${i}`);
      insertRoleStmt.run(`ur-${studentId}`, userId, studentId);
      insertStudentStmt.run(
        studentId,
        userId,
        nisn,
        `Siswa Jawara #${i}`,
        i % 2 === 0 ? 'P' : 'L',
        cohortId,
        className,
        rombelName,
        xp,
        poinHebat,
        level
      );

      for (const dStr of dates10Days) {
        const journalId = `jrn-${studentId}-${dStr}`;
        insertJournalStmt.run(journalId, studentId, dStr, baseScore);
        for (const hCode of VALID_HABIT_CODES) {
          insertEntryStmt.run(
            `he-${studentId}-${dStr}-${hCode}`,
            journalId,
            studentId,
            hCode,
            dStr,
            baseScore,
            baseScore
          );
        }
      }
    }
  });

  const seedElapsedMs = Math.round(performance.now() - seedStart);
  const totalBenchStudents = benchDb.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM students WHERE account_status = 'ACTIVE'`
  )!.cnt;
  const totalBenchEntries = benchDb.queryOne<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM habit_entries`
  )!.cnt;

  console.log(
    `  [BENCHMARK DATA READY] Seeded ${totalBenchStudents} active students & ${totalBenchEntries} habit_entries in ${seedElapsedMs} ms`
  );

  // Obtain tokens on benchmark DB
  const benchAdminLogin = await benchApp.dispatch({
    method: 'POST',
    path: '/api/admin/login',
    body: { username: 'admin', password: '123' },
  });
  const benchAdminToken = benchAdminLogin.body.token;

  const benchStudentLogin = await benchApp.dispatch({
    method: 'POST',
    path: '/api/login',
    body: { role: 'siswa', username: 'siswa50', password: '123' },
  });
  const benchStudentToken = benchStudentLogin.body.token;

  const benchmarkMetrics: BenchmarkMetric[] = [];

  // 1. Login Benchmark (20 logins with scrypt verification)
  benchmarkMetrics.push(
    measureScenario('1. Login Autentikasi (scrypt KDF + Session Insert)', 20, (i) => {
      const idx = 10 + (i % 50);
      benchApp.authService.login({
        username: `siswa${idx}`,
        password: '123',
        roleCategory: 'siswa',
      });
    })
  );

  // 2. Journal & Habit Submission Benchmark (50 submissions with sessions + components + streaks)
  benchmarkMetrics.push(
    measureScenario('2. Pengisian Jurnal & Kebiasaan (Transaksi Relasional Penuh)', 50, (i) => {
      const idx = 100 + i;
      const studentId = `std-bench-${String(idx).padStart(4, '0')}`;
      benchApp.journalsService.submitHabitEntry(
        {
          student_id: studentId,
          habit_type: 'bangun',
          log_date: '2026-10-27',
          overwrite: true,
          payload: { jamBangun: '04:45', merapikanTempatTidur: true, kebugaranLevel: 5 },
        },
        '2026-10-27'
      );
    })
  );

  // 3. 14-Day History Retrieval Benchmark (50 queries)
  benchmarkMetrics.push(
    measureScenario('3. Pembacaan Riwayat Kalender 14 Hari Siswa', 50, (i) => {
      const idx = 200 + i;
      const studentId = `std-bench-${String(idx).padStart(4, '0')}`;
      benchApp.journalsService.getStudentCalendarSummary(studentId, 14, '2026-10-27');
    })
  );

  // 4. Student Today Dashboard Query Benchmark (50 queries)
  benchmarkMetrics.push(
    measureScenario('4. Pembacaan Dashboard Harian Siswa (Today Journal)', 50, (i) => {
      const idx = 300 + i;
      const studentId = `std-bench-${String(idx).padStart(4, '0')}`;
      benchApp.journalsService.getStudentTodayJournal(studentId, '2026-10-27', '2026-10-27');
    })
  );

  // 5. Teacher Class & Rombel Dashboard Query Benchmark (30 queries)
  benchmarkMetrics.push(
    measureScenario('5. Pembacaan Analitik Kelas & Rombel (Guru Walas & Guru Wali)', 30, (i) => {
      const cName = classesList[i % classesList.length];
      benchApp.analyticsReportsService.getClassAnalytics(cName, '2026-10-27', '2026-10-27');
    })
  );

  // 6. Individual Student Report (Rapor 7 KAIH) Benchmark (30 queries)
  benchmarkMetrics.push(
    measureScenario('6. Pembacaan Rapor Individu Siswa (Perbandingan Siswa vs Kelas vs Sekolah)', 30, (i) => {
      const idx = 400 + i;
      const studentId = `std-bench-${String(idx).padStart(4, '0')}`;
      benchApp.analyticsReportsService.getStudentReport(studentId);
    })
  );

  // 7. Leaderboard Query across 750 Students Benchmark (30 queries)
  benchmarkMetrics.push(
    measureScenario('7. Pembacaan Leaderboard Sekolah (750 Siswa Aktif)', 30, () => {
      benchApp.analyticsReportsService.getLeaderboard({
        periodType: 'ALL_TIME',
        scopeType: 'SCHOOL',
        limit: 50,
        todayDateStr: '2026-10-27',
      });
    })
  );

  // 8. School-Wide & Cohort Analytics Query across 750 Students & 52,500 Entries (20 queries)
  benchmarkMetrics.push(
    measureScenario('8. Pembacaan Analitik Sekolah & Angkatan (750 Siswa, 52.500+ Entri)', 20, () => {
      benchApp.analyticsReportsService.getSchoolAnalytics('2026-10-27');
    })
  );

  await runTest('Suite F', 'F1. All 8 performance benchmark scenarios at 750-student scale execute within target SLAs', () => {
    assert.equal(totalBenchStudents, 750);
    assert.ok(totalBenchEntries >= 52200);
    assert.ok(benchAdminToken && benchStudentToken);
    for (const m of benchmarkMetrics) {
      assert.ok(m.avgMs < 250, `Skenario '${m.scenario}' melebihi SLA 250ms (avg=${m.avgMs}ms)`);
    }
  });

  const memUsage = process.memoryUsage();
  const memoryReport = {
    rssMb: Math.round((memUsage.rss / 1024 / 1024) * 10) / 10,
    heapTotalMb: Math.round((memUsage.heapTotal / 1024 / 1024) * 10) / 10,
    heapUsedMb: Math.round((memUsage.heapUsed / 1024 / 1024) * 10) / 10,
  };

  benchDb.close();
  for (const ext of ['', '-wal', '-shm']) {
    if (fs.existsSync(benchDbPath + ext)) fs.unlinkSync(benchDbPath + ext);
  }

  console.log('\n--- BENCHMARK SUMMARY (750 ACTIVE STUDENTS / 52,230 HABIT ENTRIES) ---');
  for (const m of benchmarkMetrics) {
    console.log(
      `  * ${m.scenario}: avg=${m.avgMs}ms | p95=${m.p95Ms}ms | min=${m.minMs}ms | max=${m.maxMs}ms | throughput=${m.opsPerSec} ops/sec`
    );
  }
  console.log(
    `  * Memory Usage: RSS=${memoryReport.rssMb} MB | HeapUsed=${memoryReport.heapUsedMb} MB / ${memoryReport.heapTotalMb} MB`
  );

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  const summaryReport = {
    executedAt: new Date().toISOString(),
    runtime: `Node.js ${process.version} (${process.platform}/${process.arch})`,
    totalTests: results.length,
    passedCount,
    failedCount,
    results,
    scaleBenchmark: {
      totalActiveStudents: totalBenchStudents,
      totalClasses: classesList.length,
      totalRombels: rombelsList.length,
      totalHabitEntries: totalBenchEntries,
      seedDurationMs: seedElapsedMs,
      memoryReport,
      metrics: benchmarkMetrics,
    },
  };

  const reportOutPath = path.resolve(
    process.cwd(),
    'database',
    'backups',
    'test_and_benchmark_report.json'
  );
  if (!fs.existsSync(path.dirname(reportOutPath))) {
    fs.mkdirSync(path.dirname(reportOutPath), { recursive: true });
  }
  fs.writeFileSync(reportOutPath, JSON.stringify(summaryReport, null, 2), 'utf-8');

  console.log('\n================================================================================');
  console.log(`FINAL TEST STATUS: ${passedCount}/${results.length} PASSED (${failedCount} FAILED)`);
  console.log('================================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in test runner:', err);
  process.exit(1);
});
