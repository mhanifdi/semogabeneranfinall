/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Analytics, Individual Reports, Leaderboard, Validations & Settings Service — VERTIKAL SMA JAWARA 28
 * Optimized with bulk SQL aggregations (zero N+1 queries) to scale smoothly to 750+ students.
 */

import crypto from 'node:crypto';
import { RelationalDatabase } from '../../database/client.ts';
import { VALID_HABIT_CODES } from '../../shared/schemas/validation-schemas.ts';
import type { HabitCode } from '../../shared/schemas/validation-schemas.ts';
import { NotFoundError, ValidationError } from '../../shared/errors/app-error.ts';
import { StreaksService, computePredicate } from '../streaks/streaks.service.ts';
import { JournalsService } from '../journals/journals.service.ts';
import { AuditService } from '../audit/audit.service.ts';
import { PointsService } from '../points/points.service.ts';
import type { AuthSessionContext } from '../auth/auth.service.ts';

const HABIT_LABELS: Record<HabitCode, string> = {
  bangun: 'Bangun Pagi',
  ibadah: 'Beribadah',
  olahraga: 'Berolahraga',
  makan: 'Makan Bergizi',
  belajar: 'Gemar Belajar',
  masyarakat: 'Bermasyarakat',
  tidur: 'Tidur Cepat',
};

export class AnalyticsReportsService {
  private readonly db: RelationalDatabase;
  private readonly streaks: StreaksService;
  private readonly journals: JournalsService;
  private readonly audit: AuditService;
  private readonly points: PointsService;

  constructor(db: RelationalDatabase) {
    this.db = db;
    this.streaks = new StreaksService(db);
    this.journals = new JournalsService(db);
    this.audit = new AuditService(db);
    this.points = new PointsService(db);
  }

  public getElapsedPeriodDates(todayDateStr: string): string[] {
    const period = this.getDataCollectionPeriod(todayDateStr);
    const startDate = period.startDate;
    const endDate = period.endDate;
    const effectiveEnd = todayDateStr < endDate ? todayDateStr : endDate;

    if (effectiveEnd < startDate) return [todayDateStr];

    const dates: string[] = [];
    const cur = new Date(startDate + 'T00:00:00');
    const end = new Date(effectiveEnd + 'T00:00:00');

    while (cur <= end) {
      dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return dates.length > 0 ? dates : [todayDateStr];
  }

  /**
   * Computes Individual Student Report (Rapor 7 KAIH) comparing Student vs Class vs School averages.
   */
  public getStudentReport(studentId: string) {
    const student = this.db.queryOne<any>(
      `SELECT s.*, u.username
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
      [studentId]
    );
    if (!student) {
      throw new NotFoundError(`Siswa '${studentId}' tidak ditemukan.`);
    }

    // Check if student's journal today is 7/7 complete
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const todayJournal = this.db.queryOne<any>(
      `SELECT completed_habits_count, journal_status FROM journals WHERE student_id = ? AND journal_date = ?`,
      [studentId, todayStr]
    );
    const isTodayComplete = todayJournal && (todayJournal.completed_habits_count >= 7 || todayJournal.journal_status === 'SELESAI');

    const elapsedDates = this.getElapsedPeriodDates(todayStr);
    const numDays = Math.max(1, elapsedDates.length);

    // Total active students in class and school
    const classCountRow = this.db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM students WHERE LOWER(TRIM(class_name)) = LOWER(TRIM(?)) AND account_status = 'ACTIVE'`,
      [student.class_name]
    );
    const classStudentCount = Math.max(1, Number(classCountRow?.cnt || 1));

    const schoolCountRow = this.db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM students WHERE account_status = 'ACTIVE'`
    );
    const schoolStudentCount = Math.max(1, Number(schoolCountRow?.cnt || 1));

    // 1. Authoritative student averages per habit (incorporating all elapsed dates, counting missing days as 0)
    const studentDayScores: Record<HabitCode, number[]> = {
      bangun: [], ibadah: [], olahraga: [], makan: [], belajar: [], masyarakat: [], tidur: []
    };

    const studentEntriesAll = this.db.queryAll<any>(
      `SELECT * FROM habit_entries WHERE student_id = ? AND log_date <= ?`,
      [studentId, todayStr]
    );
    const entriesByDate: Record<string, any[]> = {};
    for (const r of studentEntriesAll) {
      if (!entriesByDate[r.log_date]) entriesByDate[r.log_date] = [];
      entriesByDate[r.log_date].push(r);
    }

    const totalEntries = studentEntriesAll.length;
    for (const dStr of elapsedDates) {
      const dayEval = this.streaks.evaluateStudentDay(studentId, dStr, todayStr, entriesByDate[dStr] || []);
      for (const h of VALID_HABIT_CODES) {
        studentDayScores[h].push(dayEval.scoresByHabit[h]);
      }
    }

    const studentMap: Record<string, { cnt: number; avg: number; periodAvg: number }> = {};
    for (const h of VALID_HABIT_CODES) {
      const scores = studentDayScores[h];
      const nonZero = scores.filter((s) => s > 0);
      const activeAvg = nonZero.length > 0 ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
      const periodAvg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / numDays : 0;
      studentMap[h] = {
        cnt: nonZero.length,
        avg: Math.round(activeAvg * 10) / 10,
        periodAvg: Math.round(periodAvg * 10) / 10,
      };
    }

    // 2. Class averages per habit across elapsed dates (including 0s)
    const classHabitRows = this.db.queryAll<{ habit_code: HabitCode; sum_score: number }>(
      `SELECT he.habit_code, SUM(he.final_score) AS sum_score
       FROM habit_entries he
       JOIN students s ON s.id = he.student_id
       WHERE LOWER(TRIM(s.class_name)) = LOWER(TRIM(?)) AND s.account_status = 'ACTIVE' AND he.log_date <= ?
       GROUP BY he.habit_code`,
      [student.class_name, todayStr]
    );
    const classMap: Record<string, number> = {};
    for (const r of classHabitRows) {
      classMap[r.habit_code] = Math.round((Number(r.sum_score || 0) / (classStudentCount * numDays)) * 10) / 10;
    }

    // 3. School averages per habit across elapsed dates (including 0s)
    const schoolHabitRows = this.db.queryAll<{ habit_code: HabitCode; sum_score: number }>(
      `SELECT habit_code, SUM(final_score) AS sum_score
       FROM habit_entries
       WHERE log_date <= ?
       GROUP BY habit_code`,
      [todayStr]
    );
    const schoolMap: Record<string, number> = {};
    for (const r of schoolHabitRows) {
      schoolMap[r.habit_code] = Math.round((Number(r.sum_score || 0) / (schoolStudentCount * numDays)) * 10) / 10;
    }

    const habitMetrics = VALID_HABIT_CODES.map((h) => ({
      habit: h,
      label: HABIT_LABELS[h],
      studentScore: studentMap[h]?.avg ?? 0,
      periodScore: studentMap[h]?.periodAvg ?? 0,
      classAvg: classMap[h] ?? 0,
      schoolAvg: schoolMap[h] ?? 0,
      count: studentMap[h]?.cnt ?? 0,
    }));

    // Requirement 4: All-time average includes empty/unfilled habits as 0 across all 7 habits
    const allTimeScore =
      Math.round(
        (habitMetrics.reduce((acc, m) => acc + (m.studentScore || 0), 0) / 7) * 10
      ) / 10;
    const overallScore = allTimeScore;
    const periodAverage =
      Math.round(
        (habitMetrics.reduce((acc, m) => acc + (m.periodScore || 0), 0) / 7) * 10
      ) / 10;

    const activeDaysRow = this.db.queryOne<{ cnt: number }>(
      isTodayComplete
        ? `SELECT COUNT(DISTINCT log_date) AS cnt FROM habit_entries WHERE student_id = ? AND log_date <= ?`
        : `SELECT COUNT(DISTINCT log_date) AS cnt FROM habit_entries WHERE student_id = ? AND log_date < ?`,
      [studentId, todayStr]
    );

    const latestValidation = this.db.queryOne<{ verification_score: number }>(
      `SELECT verification_score FROM admin_validations WHERE student_id = ? ORDER BY id DESC LIMIT 1`,
      [studentId]
    );

    const rawRecent = this.db.queryAll<any>(
      `SELECT * FROM habit_entries WHERE student_id = ? ORDER BY log_date DESC, id DESC LIMIT 25`,
      [studentId]
    );

    return {
      student: {
        ...student,
        predicate: computePredicate(overallScore || 0),
      },
      habitMetrics,
      overallScore,
      periodAverage,
      poinHebat: Number(student.poin_hebat || 0),
      totalEntries,
      streak: Number(student.streak || 0),
      activeDays: Number(activeDaysRow?.cnt || 0),
      verification_score: latestValidation ? Number(latestValidation.verification_score) : null,
      recentLogs: rawRecent.map((r) => this.journals.formatEntryForClient(r)),
    };
  }

  /**
   * Computes Class Analytics (Wali Kelas Monitoring & Analytics) using bulk SQL queries.
   */
  public getClassAnalytics(className: string, filterDateStr: string | undefined, todayDateStr: string) {
    const targetDate = filterDateStr || todayDateStr;
    const cleanClassName = (className || '').trim().toLowerCase();
    const students = this.db.queryAll<any>(
      `SELECT s.*, u.username
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE LOWER(TRIM(s.class_name)) = ? AND s.account_status = 'ACTIVE'
       ORDER BY s.xp DESC, s.name ASC`,
      [cleanClassName]
    );

    // Bulk load all entries on targetDate for this class
    const dateEntries = this.db.queryAll<any>(
      `SELECT he.*
       FROM habit_entries he
       JOIN students s ON s.id = he.student_id
       WHERE LOWER(TRIM(s.class_name)) = ? AND s.account_status = 'ACTIVE' AND he.log_date = ?`,
      [cleanClassName, targetDate]
    );
    const dateEntriesByStudent: Record<string, any[]> = {};
    for (const r of dateEntries) {
      if (!dateEntriesByStudent[r.student_id]) dateEntriesByStudent[r.student_id] = [];
      dateEntriesByStudent[r.student_id].push(r);
    }

    // Bulk load all-time habit sums per student in this class across elapsed dates
    const elapsedDates = this.getElapsedPeriodDates(todayDateStr);
    const numDays = Math.max(1, elapsedDates.length);

    const studentHabitSums = this.db.queryAll<{
      student_id: string;
      habit_code: HabitCode;
      sum_score: number;
      cnt: number;
    }>(
      `SELECT he.student_id, he.habit_code, SUM(he.final_score) AS sum_score, COUNT(*) AS cnt
       FROM habit_entries he
       JOIN students s ON s.id = he.student_id
       WHERE LOWER(TRIM(s.class_name)) = ? AND s.account_status = 'ACTIVE' AND he.log_date <= ?
       GROUP BY he.student_id, he.habit_code`,
      [cleanClassName, todayDateStr]
    );

    const studentHabitMap: Record<string, Record<string, number>> = {};
    const studentTotalLogsMap: Record<string, number> = {};
    const habitSumAcrossClass: Record<HabitCode, number> = {
      bangun: 0,
      ibadah: 0,
      olahraga: 0,
      makan: 0,
      belajar: 0,
      masyarakat: 0,
      tidur: 0,
    };

    for (const row of studentHabitSums) {
      if (!studentHabitMap[row.student_id]) studentHabitMap[row.student_id] = {};
      const scoreAvg = Math.round((Number(row.sum_score || 0) / numDays) * 10) / 10;
      studentHabitMap[row.student_id][row.habit_code] = scoreAvg;
      studentTotalLogsMap[row.student_id] =
        (studentTotalLogsMap[row.student_id] || 0) + Number(row.cnt);
      if (habitSumAcrossClass[row.habit_code] !== undefined) {
        habitSumAcrossClass[row.habit_code] += Number(row.sum_score || 0);
      }
    }

    let participatingCount = 0;
    const statusSummary = { selesai: 0, sedangDiisi: 0, belumDimulai: 0, terlewat: 0 };

    const enrichedStudents = students.map((st) => {
      const dayEval = this.streaks.evaluateStudentDay(
        st.id,
        targetDate,
        todayDateStr,
        dateEntriesByStudent[st.id] || []
      );

      if (dayEval.completedCount > 0 || dayEval.inProgressHabits.length > 0) {
        participatingCount++;
      }
      if (dayEval.overallDayStatus === 'SELESAI') statusSummary.selesai++;
      else if (dayEval.overallDayStatus === 'SEDANG_DIISI') statusSummary.sedangDiisi++;
      else if (dayEval.overallDayStatus === 'BELUM_DIISI_TERLEWAT') statusSummary.terlewat++;
      else statusSummary.belumDimulai++;

      const hScores = studentHabitMap[st.id] || {};
      const sum7 = VALID_HABIT_CODES.reduce((acc, code) => acc + (hScores[code] || 0), 0);
      const avgScore = Math.round((sum7 / 7) * 10) / 10;

      return {
        ...st,
        avgScore,
        avg_score: avgScore,
        poin_hebat: st.poin_hebat || 0,
        todayCount: dayEval.completedCount,
        today_entries: dayEval.completedCount,
        today_completed_habits: dayEval.completedCount,
        todayHabitsDone: dayEval.completedHabits,
        todayHabitStatuses: dayEval.habitStatuses,
        todayStatus: dayEval.overallDayStatus,
        today_status: dayEval.overallDayStatus,
        overallDayStatus:
          dayEval.overallDayStatus === 'SELESAI'
            ? 'Selesai'
            : dayEval.overallDayStatus === 'SEDANG_DIISI'
            ? 'Sedang diisi'
            : 'Belum dimulai',
        completedHabitsCount: dayEval.completedCount,
        dailyAverageScore: dayEval.dailyAverageScore,
        todayScore: dayEval.dailyAverageScore,
        totalLogs: studentTotalLogsMap[st.id] || 0,
        habitScores: {
          bangun: hScores.bangun || 0,
          ibadah: hScores.ibadah || 0,
          olahraga: hScores.olahraga || 0,
          makan: hScores.makan || 0,
          belajar: hScores.belajar || 0,
          masyarakat: hScores.masyarakat || 0,
          tidur: hScores.tidur || 0,
        },
      };
    });

    const totalClassOpportunities = Math.max(1, students.length) * numDays;
    const classRadar = VALID_HABIT_CODES.map((h) => {
      const avg = Math.round((habitSumAcrossClass[h] / totalClassOpportunities) * 10) / 10;
      return {
        habit: h,
        label: HABIT_LABELS[h],
        avg_score: avg,
        score: avg,
        average: avg,
      };
    });

    const habitAverages = classRadar;

    const distribution = {
      under70: 0,
      between70_79: 0,
      between80_89: 0,
      between90_95: 0,
      between96_100: 0,
      noData: 0,
    };
    let totalScoreSum = 0;
    let studentsWithScores = 0;
    for (const st of enrichedStudents) {
      const sc = Number(st.avg_score || st.avgScore || 0);
      if (sc <= 0) {
        distribution.noData++;
      } else {
        totalScoreSum += sc;
        studentsWithScores++;
        if (sc < 70) distribution.under70++;
        else if (sc < 80) distribution.between70_79++;
        else if (sc < 90) distribution.between80_89++;
        else if (sc < 96) distribution.between90_95++;
        else distribution.between96_100++;
      }
    }

    const classAverage =
      students.length > 0
        ? Math.round((enrichedStudents.reduce((acc, s) => acc + s.avgScore, 0) / students.length) * 10) / 10
        : 0;

    const participationRate =
      students.length > 0 ? Math.round((participatingCount / students.length) * 100) : 0;

    return {
      className,
      studentCount: students.length,
      totalStudents: students.length,
      participatingCount,
      participatingToday: participatingCount,
      classAverage,
      completionPercentage: participationRate,
      participationRate,
      statusSummary,
      distribution,
      classRadar,
      habitAverages,
      filterDate: targetDate,
      students: enrichedStudents,
    };
  }

  /**
   * Computes Rombel / Guru Wali Analytics using bulk SQL queries.
   */
  public getRombelAnalytics(rombelOrWaliName: string, days: number, todayDateStr: string) {
    const clampedDays = Math.min(30, Math.max(7, Number(days || 14)));
    const cleanName = (rombelOrWaliName || '').trim().toLowerCase();
    const students = this.db.queryAll<any>(
      `SELECT s.*, u.username
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE (LOWER(TRIM(COALESCE(s.rombel_name, ''))) = ? OR LOWER(TRIM(COALESCE(s.wali_name, ''))) = ? OR LOWER(TRIM(COALESCE(s.wali_id, ''))) = ?) AND s.account_status = 'ACTIVE'
       ORDER BY s.xp DESC, s.name ASC`,
      [cleanName, cleanName, cleanName]
    );

    const todayEntries = this.db.queryAll<any>(
      `SELECT he.*
       FROM habit_entries he
       JOIN students s ON s.id = he.student_id
       WHERE (LOWER(TRIM(COALESCE(s.rombel_name, ''))) = ? OR LOWER(TRIM(COALESCE(s.wali_name, ''))) = ? OR LOWER(TRIM(COALESCE(s.wali_id, ''))) = ?) AND s.account_status = 'ACTIVE' AND he.log_date = ?`,
      [cleanName, cleanName, cleanName, todayDateStr]
    );
    const todayByStudent: Record<string, any[]> = {};
    for (const r of todayEntries) {
      if (!todayByStudent[r.student_id]) todayByStudent[r.student_id] = [];
      todayByStudent[r.student_id].push(r);
    }

    const periodDates = this.getElapsedPeriodDates(todayDateStr);
    const numDays = Math.max(1, periodDates.length);

    const studentHabitSums = this.db.queryAll<{
      student_id: string;
      habit_code: HabitCode;
      sum_score: number;
      cnt: number;
    }>(
      `SELECT he.student_id, he.habit_code, SUM(he.final_score) AS sum_score, COUNT(*) AS cnt
       FROM habit_entries he
       JOIN students s ON s.id = he.student_id
       WHERE (LOWER(TRIM(COALESCE(s.rombel_name, ''))) = ? OR LOWER(TRIM(COALESCE(s.wali_name, ''))) = ? OR LOWER(TRIM(COALESCE(s.wali_id, ''))) = ?) AND s.account_status = 'ACTIVE' AND he.log_date <= ?
       GROUP BY he.student_id, he.habit_code`,
      [cleanName, cleanName, cleanName, todayDateStr]
    );

    const studentHabitMap: Record<string, Record<string, number>> = {};
    const studentTotalLogsMap: Record<string, number> = {};
    const habitSumAcrossRombel: Record<HabitCode, number> = {
      bangun: 0,
      ibadah: 0,
      olahraga: 0,
      makan: 0,
      belajar: 0,
      masyarakat: 0,
      tidur: 0,
    };

    for (const row of studentHabitSums) {
      if (!studentHabitMap[row.student_id]) studentHabitMap[row.student_id] = {};
      const scoreAvg = Math.round((Number(row.sum_score || 0) / numDays) * 10) / 10;
      studentHabitMap[row.student_id][row.habit_code] = scoreAvg;
      studentTotalLogsMap[row.student_id] =
        (studentTotalLogsMap[row.student_id] || 0) + Number(row.cnt);
      if (habitSumAcrossRombel[row.habit_code] !== undefined) {
        habitSumAcrossRombel[row.habit_code] += Number(row.sum_score || 0);
      }
    }

    let participatingToday = 0;
    const enrichedStudents = students.map((st) => {
      const dayEval = this.streaks.evaluateStudentDay(
        st.id,
        todayDateStr,
        todayDateStr,
        todayByStudent[st.id] || []
      );
      if (dayEval.completedCount > 0 || dayEval.inProgressHabits.length > 0) {
        participatingToday++;
      }

      const hScores = studentHabitMap[st.id] || {};
      const sum7 = VALID_HABIT_CODES.reduce((acc, code) => acc + (hScores[code] || 0), 0);
      const avgScore = Math.round((sum7 / 7) * 10) / 10;

      return {
        ...st,
        avgScore,
        avg_score: avgScore,
        poin_hebat: st.poin_hebat || 0,
        todayCount: dayEval.completedCount,
        today_entries: dayEval.completedCount,
        today_completed_habits: dayEval.completedCount,
        todayStatus: dayEval.overallDayStatus,
        today_status: dayEval.overallDayStatus,
        overallDayStatus:
          dayEval.overallDayStatus === 'SELESAI'
            ? 'Selesai'
            : dayEval.overallDayStatus === 'SEDANG_DIISI'
            ? 'Sedang diisi'
            : 'Belum dimulai',
        completedHabitsCount: dayEval.completedCount,
        dailyAverageScore: dayEval.dailyAverageScore,
        todayScore: dayEval.dailyAverageScore,
        todayHabitStatuses: dayEval.habitStatuses,
        totalLogs: studentTotalLogsMap[st.id] || 0,
        habitScores: {
          bangun: hScores.bangun || 0,
          ibadah: hScores.ibadah || 0,
          olahraga: hScores.olahraga || 0,
          makan: hScores.makan || 0,
          belajar: hScores.belajar || 0,
          masyarakat: hScores.masyarakat || 0,
          tidur: hScores.tidur || 0,
        },
      };
    });

    const totalRombelOpportunities = Math.max(1, students.length) * numDays;
    const rombelRadar = VALID_HABIT_CODES.map((h) => {
      const avg = Math.round((habitSumAcrossRombel[h] / totalRombelOpportunities) * 10) / 10;
      return {
        habit: h,
        label: HABIT_LABELS[h],
        avg_score: avg,
        score: avg,
        average: avg,
      };
    });

    const distribution = {
      under70: 0,
      between70_79: 0,
      between80_89: 0,
      between90_95: 0,
      between96_100: 0,
      noData: 0,
    };
    let totalScoreSum = 0;
    let studentsWithScores = 0;
    for (const st of enrichedStudents) {
      const sc = Number(st.avg_score || st.avgScore || 0);
      if (sc <= 0) {
        distribution.noData++;
      } else {
        totalScoreSum += sc;
        studentsWithScores++;
        if (sc < 70) distribution.under70++;
        else if (sc < 80) distribution.between70_79++;
        else if (sc < 90) distribution.between80_89++;
        else if (sc < 96) distribution.between90_95++;
        else distribution.between96_100++;
      }
    }

    const rombelAverage =
      students.length > 0
        ? Math.round((enrichedStudents.reduce((acc, s) => acc + s.avgScore, 0) / students.length) * 10) / 10
        : 0;

    const participationRate =
      students.length > 0 ? Math.round((participatingToday / students.length) * 100) : 0;

    // Daily trend series for Rombel / Wali
    const dayNamesShort = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const baseDate = new Date(`${todayDateStr}T12:00:00Z`);
    const dateList: string[] = [];
    for (let i = clampedDays - 1; i >= 0; i--) {
      const d = new Date(baseDate.getTime() - i * 86400000);
      dateList.push(d.toISOString().split('T')[0]);
    }
    const minDate = dateList[0];

    const trendRows = this.db.queryAll<{
      log_date: string;
      avg_score: number;
      active_students: number;
    }>(
      `SELECT he.log_date,
              ROUND(AVG(he.final_score), 1) AS avg_score,
              COUNT(DISTINCT he.student_id) AS active_students
       FROM habit_entries he
       JOIN students s ON s.id = he.student_id
       WHERE (s.rombel_name = ? OR s.wali_name = ? OR s.wali_id = ?) AND s.account_status = 'ACTIVE'
         AND he.log_date >= ? AND he.log_date <= ?
       GROUP BY he.log_date`,
      [rombelOrWaliName, rombelOrWaliName, rombelOrWaliName, minDate, todayDateStr]
    );
    const trendMap: Record<string, { avg_score: number; active_students: number }> = {};
    for (const r of trendRows) trendMap[r.log_date] = r;

    const dailyTrend = dateList.map((dateStr) => {
      const d = new Date(`${dateStr}T12:00:00Z`);
      const t = trendMap[dateStr];
      return {
        date: dateStr,
        label: `${dayNamesShort[d.getUTCDay()]}, ${d.getUTCDate()} ${monthNamesShort[d.getUTCMonth()]}`,
        avgScore: Number(t?.avg_score || 0),
        avg_score: Number(t?.avg_score || 0),
        completion_pct: students.length > 0 ? Math.round((Number(t?.active_students || 0) / students.length) * 100) : 0,
        activeStudents: Number(t?.active_students || 0),
      };
    });

    return {
      rombelName: rombelOrWaliName,
      waliName: rombelOrWaliName,
      studentCount: students.length,
      totalStudents: students.length,
      participatingToday,
      participatingCount: participatingToday,
      participationRate,
      completionRate: participationRate,
      completionPercentage: participationRate,
      rombelAverage,
      waliAverage: rombelAverage,
      classAverage: rombelAverage,
      distribution,
      rombelRadar,
      waliRadar: rombelRadar,
      classRadar: rombelRadar,
      habitAverages: rombelRadar,
      dailyTrend,
      students: enrichedStudents,
    };
  }

  /**
   * Computes School-Wide & Cohort Analytics using fast bulk SQL queries.
   */
  public getSchoolAnalytics(todayDateStr: string) {
    const totalsRow = this.db.queryOne<{ total_students: number }>(
      `SELECT COUNT(*) AS total_students FROM students WHERE account_status = 'ACTIVE'`
    );
    const totalStudents = Number(totalsRow?.total_students || 0);

    const entriesStatRow = this.db.queryOne<{
      total_entries: number;
      participating_students: number;
    }>(
      `SELECT COUNT(*) AS total_entries,
              COUNT(DISTINCT student_id) AS participating_students
       FROM habit_entries`
    );
    const totalEntries = Number(entriesStatRow?.total_entries || 0);
    const participatingStudents = Number(entriesStatRow?.participating_students || 0);
    const schoolParticipationRate =
      totalStudents > 0 ? Math.round((participatingStudents / totalStudents) * 100) : 0;

    const periodDates = this.getElapsedPeriodDates(todayDateStr);
    const numDays = Math.max(1, periodDates.length);
    const totalSchoolOpportunities = Math.max(1, totalStudents) * numDays;

    // Habit averages across school factoring in all dates in data collection period (0s for missed days)
    const habitSumRows = this.db.queryAll<{ habit_code: HabitCode; sum_score: number }>(
      `SELECT he.habit_code, SUM(he.final_score) AS sum_score
       FROM habit_entries he
       JOIN students s ON s.id = he.student_id
       WHERE s.account_status = 'ACTIVE' AND he.log_date <= ?
       GROUP BY he.habit_code`,
      [todayDateStr]
    );
    const habitMap: Record<string, number> = {};
    for (const r of habitSumRows) {
      habitMap[r.habit_code] = Math.round((Number(r.sum_score || 0) / totalSchoolOpportunities) * 10) / 10;
    }

    const habitAverages = VALID_HABIT_CODES.map((h) => ({
      habit: h,
      label: HABIT_LABELS[h],
      average: habitMap[h] ?? 0,
      score: habitMap[h] ?? 0,
      avg_score: habitMap[h] ?? 0,
    }));

    // Predicate distribution
    const predRows = this.db.queryAll<{ predicate: string; cnt: number }>(
      `SELECT predicate, COUNT(*) AS cnt
       FROM students
       WHERE account_status = 'ACTIVE'
       GROUP BY predicate`
    );
    const predicateDistribution: Record<string, number> = {
      'Sangat Terbiasa (Teladan)': 0,
      'Terbiasa Baik': 0,
      'Cukup Terbiasa': 0,
      'Perlu Pembinaan': 0,
    };
    for (const r of predRows) {
      predicateDistribution[r.predicate] = Number(r.cnt);
    }

    // Classes & Rombels lists
    const classesRows = this.db.queryAll<{ name: string }>(
      `SELECT DISTINCT class_name AS name FROM students WHERE account_status = 'ACTIVE' ORDER BY class_name ASC`
    );
    const rombelsRows = this.db.queryAll<{ name: string }>(
      `SELECT DISTINCT rombel_name AS name FROM students WHERE account_status = 'ACTIVE' AND rombel_name IS NOT NULL AND rombel_name != '' ORDER BY rombel_name ASC`
    );

    // Cohort Breakdown (X, XI, XII) factoring in all elapsed dates (0s for missed days)
    const cohortStats = this.db.queryAll<{
      grade_prefix: string;
      student_count: number;
      participating_count: number;
      total_score: number;
    }>(
      `SELECT
          CASE
            WHEN s.class_name LIKE 'XII%' THEN 'Kelas XII'
            WHEN s.class_name LIKE 'XI%' THEN 'Kelas XI'
            ELSE 'Kelas X'
          END AS grade_prefix,
          COUNT(DISTINCT s.id) AS student_count,
          COUNT(DISTINCT j.student_id) AS participating_count,
          COALESCE(SUM(j.daily_average_score), 0) AS total_score
       FROM students s
       LEFT JOIN journals j ON j.student_id = s.id AND j.journal_date <= ?
       WHERE s.account_status = 'ACTIVE'
       GROUP BY grade_prefix
       ORDER BY grade_prefix ASC`,
      [todayDateStr]
    );

    const cohorts = cohortStats.map((c) => {
      const stCount = Number(c.student_count || 0);
      const cohortOpps = Math.max(1, stCount) * numDays;
      const avgScore = Math.round((Number(c.total_score || 0) / cohortOpps) * 10) / 10;
      return {
        cohortName: c.grade_prefix,
        studentCount: stCount,
        participatingCount: Number(c.participating_count || 0),
        avgScore,
      };
    });

    // Top Leaderboard (Top 25 for fast UI rendering, backed by full SQL index)
    const leaderboard = this.getLeaderboard({
      periodType: 'ALL_TIME',
      scopeType: 'SCHOOL',
      limit: 25,
      todayDateStr,
    });

    const schoolAverage =
      habitAverages.length > 0
        ? Math.round((habitAverages.reduce((acc, h) => acc + h.score, 0) / 7) * 10) / 10
        : 0;

    return {
      totalStudents,
      totalActiveStudents: totalStudents,
      participatingStudents,
      participatingToday: participatingStudents,
      schoolParticipationRate,
      schoolAverage,
      habitAverages,
      habitRadar: habitAverages,
      schoolRadar: habitAverages,
      predicateDistribution,
      leaderboard,
      classes: classesRows.map((c) => c.name),
      rombels: rombelsRows.map((r) => r.name),
      cohorts,
    };
  }

  /**
   * Period-based and Scope-based Leaderboard Query.
   */
  public getLeaderboard(params: {
    periodType?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'SEMESTER' | 'ALL_TIME';
    scopeType?: 'SCHOOL' | 'CLASS' | 'ROMBEL' | 'COHORT';
    scopeId?: string;
    limit?: number;
    todayDateStr: string;
  }) {
    const periodType = params.periodType || 'ALL_TIME';
    const scopeType = params.scopeType || 'SCHOOL';
    const limit = Math.min(750, Math.max(1, Number(params.limit || 50)));

    let dateFilterSql = '';
    const sqlParams: any[] = [];

    if (periodType === 'DAILY') {
      dateFilterSql = 'AND he.log_date = ?';
      sqlParams.push(params.todayDateStr);
    } else if (periodType === 'WEEKLY') {
      const d = new Date(`${params.todayDateStr}T12:00:00Z`);
      const minD = new Date(d.getTime() - 7 * 86400000).toISOString().split('T')[0];
      dateFilterSql = 'AND he.log_date >= ?';
      sqlParams.push(minD);
    } else if (periodType === 'MONTHLY') {
      const d = new Date(`${params.todayDateStr}T12:00:00Z`);
      const minD = new Date(d.getTime() - 30 * 86400000).toISOString().split('T')[0];
      dateFilterSql = 'AND he.log_date >= ?';
      sqlParams.push(minD);
    }

    let scopeFilterSql = '';
    if (scopeType === 'CLASS' && params.scopeId) {
      scopeFilterSql = 'AND s.class_name = ?';
      sqlParams.push(params.scopeId);
    } else if (scopeType === 'ROMBEL' && params.scopeId) {
      scopeFilterSql = 'AND s.rombel_name = ?';
      sqlParams.push(params.scopeId);
    } else if (scopeType === 'COHORT' && params.scopeId) {
      scopeFilterSql = 'AND s.cohort_id = ?';
      sqlParams.push(params.scopeId);
    }

    sqlParams.push(limit);

    if (periodType === 'ALL_TIME') {
      const topStudents = this.db.queryAll<any>(
        `SELECT s.id, s.nisn, s.name, s.gender, s.religion, s.class_name, s.rombel_name,
                s.xp, s.poin_hebat, s.level, s.streak, s.predicate, s.avatar_url
         FROM students s
         WHERE s.account_status = 'ACTIVE' ${scopeFilterSql}
         ORDER BY s.xp DESC, s.poin_hebat DESC, s.streak DESC
         LIMIT ?`,
        sqlParams
      );
      return topStudents.map((r, index) => ({
        ...r,
        rank: index + 1,
        period_avg_score: r.xp > 0 ? Math.min(100, Math.round((r.xp / Math.max(1, r.streak * 7)) * 10) / 10) : 0,
        entry_count: r.streak * 7,
      }));
    }

    const rows = this.db.queryAll<any>(
      `SELECT s.id, s.nisn, s.name, s.gender, s.religion, s.class_name, s.rombel_name,
              s.xp, s.poin_hebat, s.level, s.streak, s.predicate, s.avatar_url,
              COUNT(he.id) AS entry_count,
              COALESCE(ROUND(AVG(he.final_score), 1), 0) AS period_avg_score
       FROM students s
       LEFT JOIN habit_entries he ON he.student_id = s.id ${dateFilterSql}
       WHERE s.account_status = 'ACTIVE' ${scopeFilterSql}
       GROUP BY s.id
       ORDER BY period_avg_score DESC, s.xp DESC, s.poin_hebat DESC, s.streak DESC
       LIMIT ?`,
      sqlParams
    );

    return rows.map((r, index) => ({
      ...r,
      rank: index + 1,
      period_avg_score: Number(r.period_avg_score),
      entry_count: Number(r.entry_count),
    }));
  }

  public saveAdminValidation(
    data: {
      student_id: string;
      verification_score: number;
      verified_by?: string;
      notes?: string;
    },
    actor?: AuthSessionContext | null
  ) {
    const score = Number(data.verification_score);
    if (!data.student_id || Number.isNaN(score) || score < 1 || score > 10) {
      throw new ValidationError('student_id dan verification_score (1..10) wajib valid.');
    }

    const verifiedBy = data.verified_by || actor?.fullName || 'Tim 7 KAIH';
    const validationUuid = `val-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    this.db.transaction(() => {
      this.db.execute(
        `INSERT INTO admin_validations
         (validation_uuid, student_id, verification_score, verified_by_user_id, verified_by, notes, verified_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          validationUuid,
          data.student_id,
          score,
          actor?.userId || null,
          verifiedBy,
          data.notes || '',
        ]
      );

      // Persist directly to students table so leaderboard and analytics immediately reflect verification
      this.db.execute(
        `UPDATE students
         SET verification_score = ?,
             verification_count = COALESCE(verification_count, 0) + 1,
             updated_at = datetime('now')
         WHERE id = ?`,
        [score, data.student_id]
      );

      this.audit.log({
        actor_user_id: actor?.userId || null,
        actor_username: actor?.username || verifiedBy,
        actor_role: actor?.activeRole || 'TIM_7_KAIH',
        action: 'ADMIN_VALIDATION_SAVE',
        entity_type: 'admin_validations',
        entity_id: validationUuid,
        after_state: { student_id: data.student_id, verification_score: score, notes: data.notes },
      });
    });

    return { status: 'ok', validation_uuid: validationUuid, student_id: data.student_id, verification_score: score };
  }

  public getAdminValidationsSummary() {
    const validations = this.db.queryAll<any>(
      `SELECT av.*, s.name AS student_name, s.class_name
       FROM admin_validations av
       LEFT JOIN students s ON s.id = av.student_id
       ORDER BY av.id DESC`
    );

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
    for (const v of validations) {
      const s = Math.min(10, Math.max(1, Math.round(Number(v.verification_score))));
      distribution[s] = (distribution[s] || 0) + 1;
    }

    const avgScore =
      validations.length > 0
        ? Math.round(
            (validations.reduce((acc, v) => acc + Number(v.verification_score || 0), 0) /
              validations.length) *
              10
          ) / 10
        : 0;

    return {
      totalValidations: validations.length,
      averageScore: avgScore,
      distribution,
      recentValidations: validations.slice(0, 50),
    };
  }

  // =========================================================================
  // 7 KAIH INSTRUMENT MANAGEMENT (CRUD)
  // =========================================================================
  public getInstruments(habitCode?: string) {
    if (habitCode) {
      return this.db.queryAll<any>(
        `SELECT * FROM habit_instruments WHERE habit_code = ? ORDER BY order_no ASC`,
        [habitCode]
      );
    }
    return this.db.queryAll<any>(
      `SELECT * FROM habit_instruments ORDER BY habit_code ASC, order_no ASC`
    );
  }

  public saveInstrument(data: any, actor?: AuthSessionContext | null) {
    const id = data.id || `inst-${data.habit_code}-${Date.now()}`;
    const rubricJson = typeof data.rubric_json === 'string'
      ? data.rubric_json
      : JSON.stringify(data.rubric_options || []);

    this.db.execute(
      `INSERT INTO habit_instruments
       (id, habit_code, title, category, question_text, input_type, max_score, weight_percentage, rubric_json, help_text, order_no, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
        habit_code = excluded.habit_code,
        title = excluded.title,
        category = excluded.category,
        question_text = excluded.question_text,
        input_type = excluded.input_type,
        max_score = excluded.max_score,
        weight_percentage = excluded.weight_percentage,
        rubric_json = excluded.rubric_json,
        help_text = excluded.help_text,
        order_no = excluded.order_no,
        is_active = excluded.is_active,
        updated_at = datetime('now')`,
      [
        id,
        data.habit_code || 'bangun',
        data.title || 'Instrumen 7 KAIH',
        data.category || 'Umum',
        data.question_text || '',
        data.input_type || 'CHOICE',
        Number(data.max_score || 100),
        Number(data.weight_percentage || 100),
        rubricJson,
        data.help_text || '',
        Number(data.order_no || 1),
        data.is_active === false || data.is_active === 0 ? 0 : 1,
      ]
    );

    this.audit.log({
      actor_user_id: actor?.userId || null,
      actor_username: actor?.username || 'admin',
      actor_role: actor?.activeRole || 'SUPER_ADMIN',
      action: 'INSTRUMENT_UPSERT',
      entity_type: 'habit_instruments',
      entity_id: id,
    });

    return { status: 'ok', id };
  }

  public deleteInstrument(id: string, actor?: AuthSessionContext | null) {
    this.db.execute(`DELETE FROM habit_instruments WHERE id = ?`, [id]);
    this.audit.log({
      actor_user_id: actor?.userId || null,
      actor_username: actor?.username || 'admin',
      actor_role: actor?.activeRole || 'SUPER_ADMIN',
      action: 'INSTRUMENT_DELETE',
      entity_type: 'habit_instruments',
      entity_id: id,
    });
    return { status: 'ok', id };
  }

  public seedDefaultInstruments(): void {
    const defaultInstruments = [
      { id: 'inst-bangun-1', habit_code: 'bangun', title: 'Waktu Bangun Pagi', category: 'Waktu', question_text: 'Pukul berapa Anda bangun pagi hari ini?', input_type: 'TIME', max_score: 75, weight_percentage: 75, rubric_json: JSON.stringify([{ key: '04.00-05.00', label: '04.00 - 05.00 (Ideal)', points: 75 }, { key: '05.00-06.00', label: '05.00 - 06.00', points: 60 }, { key: '>06.00', label: '> 06.00', points: 45 }]), help_text: 'Bangun pagi sebelum fajar meningkatkan konsentrasi belajar.', order_no: 1, is_active: 1 },
      { id: 'inst-bangun-2', habit_code: 'bangun', title: 'Kondisi Mental Saat Bangun', category: 'Mental', question_text: 'Bagaimana kondisi mental dan kesegaran Anda saat bangun tidur?', input_type: 'CHOICE', max_score: 25, weight_percentage: 25, rubric_json: JSON.stringify([{ key: 'segar', label: 'Segar (Pikiran jernih, berenergi)', points: 25 }, { key: 'biasa', label: 'Biasa (Cukup bertenaga)', points: 15 }, { key: 'kurang', label: 'Kurang (Masih lemas/mengantuk)', points: 5 }]), help_text: 'Rujukan: National Sleep Foundation Journal.', order_no: 2, is_active: 1 },
      { id: 'inst-ibadah-1', habit_code: 'ibadah', title: 'Pelaksanaan Ibadah Wajib', category: 'Wajib', question_text: 'Pelaksanaan Shalat 5 Waktu / Ibadah Gereja / Tri Sandhya', input_type: 'CHECKBOX_GROUP', max_score: 100, weight_percentage: 100, rubric_json: JSON.stringify([{ key: 'wajib', label: 'Ibadah Wajib Terjadwal', points: 100 }]), help_text: 'Ibadah konsisten membentuk fondasi integritas spiritual.', order_no: 1, is_active: 1 },
      { id: 'inst-olahraga-1', habit_code: 'olahraga', title: 'Intensitas & Durasi Olahraga', category: 'Fisik', question_text: 'Pilih intensitas dan durasi kebugaran jasmani Anda hari ini', input_type: 'CHOICE', max_score: 100, weight_percentage: 100, rubric_json: JSON.stringify([{ key: 'tinggi', label: 'Tinggi (75 pt)', points: 75 }, { key: 'menengah', label: 'Menengah (50 pt)', points: 50 }, { key: 'ringan', label: 'Ringan (25 pt)', points: 25 }]), help_text: 'Kebugaran fisik mendukung fungsi kognitif otak.', order_no: 1, is_active: 1 },
      { id: 'inst-makan-1', habit_code: 'makan', title: 'Isi Piringku & Asupan Air', category: 'Nutrisi', question_text: 'Pola makan bergizi seimbang (Makanan Pokok, Sayur, Lauk, Buah) dan Air Putih', input_type: 'CHECKBOX_GROUP', max_score: 100, weight_percentage: 100, rubric_json: JSON.stringify([{ key: 'piring', label: 'Isi Piringku (55 pt)', points: 55 }, { key: 'air', label: 'Air Putih >= 8 Gelas (45 pt)', points: 45 }]), help_text: 'Panduan Gizi Seimbang Kemenkes RI.', order_no: 1, is_active: 1 },
      { id: 'inst-belajar-1', habit_code: 'belajar', title: 'Kegiatan Belajar & Durasi', category: 'Akademik', question_text: 'Aktivitas literasi dan belajar mandiri tambahan hari ini', input_type: 'CHOICE', max_score: 100, weight_percentage: 100, rubric_json: JSON.stringify([{ key: '1_kegiatan', label: '1 Kegiatan Belajar (45 pt)', points: 45 }, { key: 'multi_kegiatan', label: '> 1 Kegiatan Belajar (50 pt)', points: 50 }]), help_text: 'Kebiasaan gemar belajar membangun pembelajar sepanjang hayat.', order_no: 1, is_active: 1 },
      { id: 'inst-masyarakat-1', habit_code: 'masyarakat', title: 'Aksi Sosial Kemasyarakatan', category: 'Sosial', question_text: 'Pilihan aksi kepedulian sosial di lingkungan keluarga dan masyarakat', input_type: 'CHECKBOX_GROUP', max_score: 100, weight_percentage: 100, rubric_json: JSON.stringify([{ key: 'aksi', label: '30 pt per aksi sosial (maks 90 pt) + 10 pt refleksi', points: 100 }]), help_text: 'Membina empati sosial dan budaya gotong royong.', order_no: 1, is_active: 1 },
      { id: 'inst-tidur-1', habit_code: 'tidur', title: 'Jam Istirahat Malam', category: 'Istirahat', question_text: 'Pukul berapa Anda mulai tidur malam hari ini?', input_type: 'TIME', max_score: 100, weight_percentage: 100, rubric_json: JSON.stringify([{ key: '<21.30', label: '< 21.30 (75 pt)', points: 75 }, { key: '21.30-22.30', label: '21.30 - 22.30 (50 pt)', points: 50 }, { key: '>22.30', label: '> 22.30 (25 pt)', points: 25 }]), help_text: 'Tidur cukup 7-8 jam merevitalisasi sel saraf otak.', order_no: 1, is_active: 1 },
    ];
    for (const inst of defaultInstruments) {
      try {
        this.saveInstrument(inst);
      } catch {}
    }
  }

  // =========================================================================
  // DATA COLLECTION SCHEDULE PERIOD
  // =========================================================================
  public getDataCollectionPeriod(todayDateStr: string) {
    const startRow = this.db.queryOne<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'data_collection_start_date'`
    );
    const endRow = this.db.queryOne<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'data_collection_end_date'`
    );
    const activeRow = this.db.queryOne<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'data_collection_active'`
    );
    const endOfDayRow = this.db.queryOne<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'end_of_day_time'`
    );

    const startDate = startRow?.value || '2026-10-15';
    const endDate = endRow?.value || '2026-11-15';
    const isActive = activeRow ? activeRow.value === 'true' : true;
    const endOfDayTime = endOfDayRow?.value || '22:00';

    const isBeforeStart = todayDateStr < startDate;
    const isAfterEnd = todayDateStr > endDate;
    const isInPeriod = isActive && !isBeforeStart && !isAfterEnd;

    let message = 'Periode pengambilan data sedang aktif.';
    if (!isActive) message = 'Pengambilan data sedang dinonaktifkan oleh Admin.';
    else if (isBeforeStart) message = `Periode pengambilan data baru akan dibuka pada ${startDate}.`;
    else if (isAfterEnd) message = `Periode pengambilan data telah berakhir pada ${endDate}.`;

    return {
      startDate,
      endDate,
      endOfDayTime,
      isActive,
      todayDate: todayDateStr,
      isInPeriod,
      isBeforeStart,
      isAfterEnd,
      message,
    };
  }

  public saveDataCollectionPeriod(
    data: { startDate: string; endDate: string; endOfDayTime?: string; isActive?: boolean },
    actor?: AuthSessionContext | null
  ) {
    const startDate = String(data.startDate || '').trim();
    const endDate = String(data.endDate || '').trim();
    const endOfDayTime = String(data.endOfDayTime || '22:00').trim();
    const isActive = data.isActive !== undefined ? (data.isActive ? 'true' : 'false') : 'true';

    if (!startDate || !endDate) {
      throw new ValidationError('Tanggal mulai dan selesai pengambilan data wajib diisi.');
    }

    this.db.transaction(() => {
      this.db.execute(
        `INSERT INTO app_settings (key, value, value_type, description, updated_at)
         VALUES ('data_collection_start_date', ?, 'STRING', 'Tanggal awal rentang pengambilan data 7 KAIH', datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        [startDate]
      );
      this.db.execute(
        `INSERT INTO app_settings (key, value, value_type, description, updated_at)
         VALUES ('data_collection_end_date', ?, 'STRING', 'Tanggal akhir rentang pengambilan data 7 KAIH', datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        [endDate]
      );
      this.db.execute(
        `INSERT INTO app_settings (key, value, value_type, description, updated_at)
         VALUES ('end_of_day_time', ?, 'STRING', 'Waktu batas akhir pengisian harian (End of the Day)', datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        [endOfDayTime]
      );
      this.db.execute(
        `INSERT INTO app_settings (key, value, value_type, description, updated_at)
         VALUES ('data_collection_active', ?, 'BOOLEAN', 'Status keaktifan rentang pengambilan data', datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        [isActive]
      );
    });

    this.audit.log({
      actor_user_id: actor?.userId || null,
      actor_username: actor?.username || 'admin',
      actor_role: actor?.activeRole || 'SUPER_ADMIN',
      action: 'DATA_COLLECTION_PERIOD_UPDATE',
      entity_type: 'app_settings',
      entity_id: 'data_collection_period',
      after_state: { startDate, endDate, endOfDayTime, isActive },
    });

    return { status: 'ok', startDate, endDate, isActive: isActive === 'true' };
  }

  public getAdminOverview() {
    const stRow = this.db.queryOne<{ total: number; active: number; archived: number }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN account_status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN account_status != 'ACTIVE' THEN 1 ELSE 0 END) AS archived
       FROM students`
    );
    const tchRow = this.db.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM teachers WHERE account_status = 'ACTIVE'`
    );
    const clsRow = this.db.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM classes WHERE is_active = 1`
    );
    const rmbRow = this.db.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM rombels WHERE is_active = 1`
    );
    const logRow = this.db.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM habit_entries`
    );
    const corRow = this.db.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM data_corrections`
    );

    return {
      totalStudents: Number(stRow?.total || 0),
      activeStudents: Number(stRow?.active || 0),
      archivedStudents: Number(stRow?.archived || 0),
      totalTeachers: Number(tchRow?.total || 0),
      totalClasses: Number(clsRow?.total || 0),
      totalRombels: Number(rmbRow?.total || 0),
      totalLogs: Number(logRow?.total || 0),
      totalCorrections: Number(corRow?.total || 0),
    };
  }

  public getGlobalSettings() {
    const rows = this.db.queryAll<{ key: string; value: string }>(`SELECT key, value FROM app_settings`);
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;

    let prayerSchedule = {
      subuh: { start: '04:15', onTimeEnd: '05:00', end: '05:45' },
      zuhur: { start: '11:45', onTimeEnd: '12:30', end: '14:45' },
      asar: { start: '15:00', onTimeEnd: '15:45', end: '17:30' },
      magrib: { start: '17:50', onTimeEnd: '18:20', end: '19:00' },
      isya: { start: '19:05', onTimeEnd: '19:45', end: '23:59' },
    };
    if (settings.prayer_schedule_json) {
      try {
        prayerSchedule = JSON.parse(settings.prayer_schedule_json);
      } catch {
        // use default
      }
    }

    return { settings, prayerSchedule };
  }

  public saveGlobalSettings(
    data: { settings?: Record<string, string>; prayerSchedule?: any },
    actor?: AuthSessionContext | null
  ) {
    this.db.transaction(() => {
      if (data.settings && typeof data.settings === 'object') {
        for (const [k, v] of Object.entries(data.settings)) {
          this.db.execute(
            `INSERT INTO app_settings (key, value, updated_by, updated_at)
             VALUES (?, ?, ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')`,
            [k, String(v), actor?.userId || null]
          );
        }
      }
      if (data.prayerSchedule && typeof data.prayerSchedule === 'object') {
        this.db.execute(
          `INSERT INTO app_settings (key, value, value_type, updated_by, updated_at)
           VALUES ('prayer_schedule_json', ?, 'JSON', ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')`,
          [JSON.stringify(data.prayerSchedule), actor?.userId || null]
        );
      }
      this.audit.log({
        actor_user_id: actor?.userId || null,
        actor_username: actor?.username || 'admin',
        actor_role: actor?.activeRole || 'SUPER_ADMIN',
        action: 'APP_SETTINGS_UPDATE',
        entity_type: 'app_settings',
        entity_id: 'global',
      });
    });

    return { status: 'ok', ...this.getGlobalSettings() };
  }

  public getDashboardWidgets() {
    const rows = this.db.queryAll<any>(
      `SELECT * FROM dashboard_widgets ORDER BY display_order ASC`
    );
    return rows.map((r) => {
      let config = {};
      try {
        config = JSON.parse(r.config_json || '{}');
      } catch {
        config = {};
      }
      return {
        ...r,
        config,
      };
    });
  }

  public saveDashboardWidget(rawWidget: any, actor?: AuthSessionContext | null) {
    const id = String(rawWidget.id || `w-${Date.now()}`).trim();
    const title = String(rawWidget.title || 'Widget Dashboard').trim();
    const subtitle = String(rawWidget.subtitle || '').trim();
    const widgetType = String(rawWidget.widget_type || 'METRIC_CARD').trim();
    const visiblePublic = rawWidget.visible_public !== undefined ? (rawWidget.visible_public ? 1 : 0) : 1;
    const visibleStudent = rawWidget.visible_student !== undefined ? (rawWidget.visible_student ? 1 : 0) : 1;
    const visibleTeacher = rawWidget.visible_teacher !== undefined ? (rawWidget.visible_teacher ? 1 : 0) : 1;
    const displayOrder = Number(rawWidget.display_order || 1);
    const configJson =
      typeof rawWidget.config_json === 'string'
        ? rawWidget.config_json
        : JSON.stringify(rawWidget.config || {});

    this.db.execute(
      `INSERT INTO dashboard_widgets
       (id, title, subtitle, widget_type, visible_public, visible_student, visible_teacher, display_order, config_json, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        subtitle = excluded.subtitle,
        widget_type = excluded.widget_type,
        visible_public = excluded.visible_public,
        visible_student = excluded.visible_student,
        visible_teacher = excluded.visible_teacher,
        display_order = excluded.display_order,
        config_json = excluded.config_json,
        updated_by = excluded.updated_by,
        updated_at = datetime('now')`,
      [
        id,
        title,
        subtitle,
        widgetType,
        visiblePublic,
        visibleStudent,
        visibleTeacher,
        displayOrder,
        configJson,
        actor?.userId || null,
      ]
    );
    return { status: 'ok', id };
  }

  // =========================================================================
  // STUDENT ACHIEVEMENTS & RUBRIC MANAGEMENT
  // =========================================================================
  public getAchievementRubric() {
    let rawList: any[] = [];
    const row = this.db.queryOne<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'achievement_rubric_schema'`
    );
    if (row?.value) {
      try {
        rawList = JSON.parse(row.value);
      } catch {}
    }
    if (!Array.isArray(rawList) || rawList.length === 0) {
      rawList = [
        { level: 'Sekolah', minPoints: 10, maxPoints: 25, defaultPoints: 20, description: 'Lomba antar kelas / ekstrakurikuler tingkat sekolah' },
        { level: 'Kecamatan', minPoints: 25, maxPoints: 40, defaultPoints: 35, description: 'Kompetisi / ajang tingkat kecamatan / antar sekolah wilayah' },
        { level: 'Kota-Kabupaten', minPoints: 40, maxPoints: 60, defaultPoints: 50, description: 'OSN / O2SN / FLS2N / Kejuaraan tingkat Kota Jakarta Selatan' },
        { level: 'Provinsi', minPoints: 60, maxPoints: 80, defaultPoints: 75, description: 'Kejuaraan / Olimpiade tingkat Provinsi DKI Jakarta' },
        { level: 'Nasional', minPoints: 80, maxPoints: 100, defaultPoints: 90, description: 'Lomba / Kejuaraan Nasional (Puspresnas, Kemdikbudristek, dsb.)' },
        { level: 'Internasional', minPoints: 100, maxPoints: 150, defaultPoints: 120, description: 'Kompetisi / Konferensi / Prestasi tingkat Internasional' },
      ];
    }
    return rawList.map((item: any) => ({
      level: item.level,
      description: item.description || '',
      minPoints: Number(item.minPoints ?? item.min_points ?? 10),
      maxPoints: Number(item.maxPoints ?? item.max_points ?? 25),
      defaultPoints: Number(item.defaultPoints ?? item.default_points ?? 15),
      min_points: Number(item.min_points ?? item.minPoints ?? 10),
      max_points: Number(item.max_points ?? item.maxPoints ?? 25),
      default_points: Number(item.default_points ?? item.defaultPoints ?? 15),
    }));
  }

  public saveAchievementRubric(rubric: any[], actor?: AuthSessionContext | null) {
    if (!Array.isArray(rubric) || rubric.length === 0) {
      throw new ValidationError('Format skema rubrik tidak valid.');
    }
    const normalized = rubric.map((item: any) => ({
      level: item.level,
      description: item.description || '',
      minPoints: Number(item.minPoints ?? item.min_points ?? 10),
      maxPoints: Number(item.maxPoints ?? item.max_points ?? 25),
      defaultPoints: Number(item.defaultPoints ?? item.default_points ?? 15),
      min_points: Number(item.min_points ?? item.minPoints ?? 10),
      max_points: Number(item.max_points ?? item.maxPoints ?? 25),
      default_points: Number(item.default_points ?? item.defaultPoints ?? 15),
    }));
    const valJson = JSON.stringify(normalized);
    this.db.execute(
      `INSERT INTO app_settings (key, value, value_type, description, updated_by, updated_at)
       VALUES ('achievement_rubric_schema', ?, 'JSON', 'Skema panduan rentang penilaian prestasi murid per jenjang', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')`,
      [valJson, actor?.userId || null]
    );

    this.audit.log({
      actor_user_id: actor?.userId || null,
      actor_username: actor?.username || 'admin',
      actor_role: actor?.activeRole || 'SUPER_ADMIN',
      action: 'ACHIEVEMENT_RUBRIC_UPDATE',
      entity_type: 'app_settings',
      entity_id: 'achievement_rubric_schema',
      after_state: { rubric: normalized },
    });

    return { status: 'ok', rubric: normalized };
  }

  public getStudentAchievements(studentId: string) {
    const rows = this.db.queryAll<any>(
      `SELECT sa.*, s.name as student_name, s.class_name
       FROM student_achievements sa
       JOIN students s ON s.id = sa.student_id
       WHERE sa.student_id = ?
       ORDER BY sa.created_at DESC`,
      [studentId]
    );
    return rows.map((r) => this.formatAchievementRow(r));
  }

  public getAllAchievements(statusFilter?: string) {
    let sql = `SELECT sa.*, s.name as student_name, s.class_name, s.nisn
               FROM student_achievements sa
               JOIN students s ON s.id = sa.student_id`;
    const params: any[] = [];
    if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'all') {
      sql += ` WHERE UPPER(sa.status) = UPPER(?)`;
      params.push(statusFilter);
    }
    sql += ` ORDER BY sa.created_at DESC`;
    const rows = this.db.queryAll<any>(sql, params);
    return rows.map((r) => this.formatAchievementRow(r));
  }

  private formatAchievementRow(r: any) {
    return {
      ...r,
      id: r.id,
      student_id: r.student_id,
      student_name: r.student_name,
      class_name: r.class_name,
      student_class: r.class_name,
      student_nis: r.nisn || r.nis || '',
      // Frontend aliases for compatibility with StudentDashboard & AdminDashboard
      nama_prestasi: r.achievement_name,
      jenis_prestasi: r.achievement_type,
      jenjang: r.level,
      kategori: r.participation_category,
      tanggal: r.event_date,
      pencapaian: r.achievement_rank,
      cerita: r.story,
      bukti_url: r.certificate_url,
      // Standard database properties
      achievement_name: r.achievement_name,
      achievement_type: r.achievement_type,
      level: r.level,
      participation_category: r.participation_category,
      event_date: r.event_date,
      achievement_rank: r.achievement_rank,
      story: r.story,
      certificate_url: r.certificate_url,
      status: String(r.status || 'PENDING').toLowerCase(),
      status_raw: r.status,
      points_awarded: Number(r.points_awarded || 0),
      admin_notes: r.admin_notes || '',
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }

  public submitAchievement(data: {
    studentId: string;
    achievementName: string;
    achievementType: string;
    level: string;
    participationCategory: string;
    eventDate: string;
    achievementRank: string;
    story: string;
    certificateUrl?: string;
  }, actor?: AuthSessionContext | null) {
    const student = this.db.queryOne<any>(
      `SELECT id, name, class_name FROM students WHERE id = ?`,
      [data.studentId]
    );
    if (!student) {
      throw new NotFoundError(`Siswa '${data.studentId}' tidak ditemukan.`);
    }

    if (!data.achievementName || !data.eventDate) {
      throw new ValidationError('Nama prestasi dan tanggal perolehan wajib diisi.');
    }

    const id = `ach-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    this.db.execute(
      `INSERT INTO student_achievements
       (id, student_id, student_name, class_name, achievement_name, achievement_type, level, participation_category, event_date, achievement_rank, story, certificate_url, status, points_awarded, admin_notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, '', datetime('now'), datetime('now'))`,
      [
        id,
        student.id,
        student.name,
        student.class_name,
        data.achievementName.trim(),
        data.achievementType || 'Akademik',
        data.level || 'Sekolah',
        data.participationCategory || 'Individu',
        data.eventDate,
        data.achievementRank || 'Peserta',
        (data.story || '').trim(),
        data.certificateUrl || '',
      ]
    );

    this.audit.log({
      actor_user_id: actor?.userId || null,
      actor_username: actor?.username || student.name,
      actor_role: actor?.activeRole || 'SISWA',
      action: 'ACHIEVEMENT_SUBMIT',
      entity_type: 'student_achievements',
      entity_id: id,
      after_state: { ...data, student_id: student.id },
    });

    return { status: 'ok', id };
  }

  public validateAchievement(
    id: string,
    data: {
      status: 'APPROVED' | 'REJECTED';
      pointsAwarded?: number;
      adminNotes?: string;
    },
    actor?: AuthSessionContext | null
  ) {
    const item = this.db.queryOne<any>(
      `SELECT * FROM student_achievements WHERE id = ?`,
      [id]
    );
    if (!item) {
      throw new NotFoundError(`Pengajuan prestasi '${id}' tidak ditemukan.`);
    }

    const newStatus = data.status === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    const points = newStatus === 'APPROVED' ? Math.max(0, Number(data.pointsAwarded || 0)) : 0;
    const adminNotes = String(data.adminNotes || '').trim();
    const validatedBy = actor?.fullName || actor?.username || 'Admin Tim 7 KAIH';

    // Verify if database schema still has legacy foreign key constraint REFERENCES teachers(id)
    let safeValidatedBy: string | null = validatedBy;
    const achTableSql = this.db.queryOne<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name = 'student_achievements'");
    if (achTableSql?.sql && achTableSql.sql.includes('REFERENCES teachers')) {
      const isTeacher = this.db.queryOne<{ id: string }>('SELECT id FROM teachers WHERE id = ?', [validatedBy]);
      if (!isTeacher) {
        safeValidatedBy = null; // Prevent FK error on unmigrated legacy schema
      }
    }

    const validUserId = actor?.userId && this.db.queryOne('SELECT id FROM users WHERE id = ?', [actor.userId]) ? actor.userId : null;

    this.db.transaction(() => {
      this.db.execute(
        `UPDATE student_achievements
         SET status = ?, points_awarded = ?, admin_notes = ?, validated_by = ?, validated_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?`,
        [newStatus, points, adminNotes, safeValidatedBy, id]
      );

      if (newStatus === 'APPROVED' && points > 0) {
        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

        // Award to point_transactions
        this.points.recordTransaction({
          studentId: item.student_id,
          transactionDate: todayStr,
          pointBucket: 'POIN_HEBAT',
          sourceType: 'ADMIN_ADJUSTMENT',
          sourceId: `ach-approval-${id}`,
          amount: points,
          description: `Apresiasi Prestasi: ${item.achievement_name} (${item.level})`,
          createdBy: validUserId,
        });

        this.points.recordTransaction({
          studentId: item.student_id,
          transactionDate: todayStr,
          pointBucket: 'XP',
          sourceType: 'ADMIN_ADJUSTMENT',
          sourceId: `ach-approval-xp-${id}`,
          amount: points,
          description: `Apresiasi Prestasi: ${item.achievement_name} (${item.level})`,
          createdBy: validUserId,
        });

        // Update student balances
        this.db.execute(
          `UPDATE students
           SET poin_hebat = COALESCE(poin_hebat, 0) + ?,
               xp = COALESCE(xp, 0) + ?,
               updated_at = datetime('now')
           WHERE id = ?`,
          [points, points, item.student_id]
        );
      }

      this.audit.log({
        actor_user_id: actor?.userId || null,
        actor_username: actor?.username || 'admin',
        actor_role: actor?.activeRole || 'SUPER_ADMIN',
        action: 'ACHIEVEMENT_VALIDATE',
        entity_type: 'student_achievements',
        entity_id: id,
        after_state: { status: newStatus, points, adminNotes, validatedBy },
      });
    });

    return { status: 'ok', id, newStatus, points };
  }
}
