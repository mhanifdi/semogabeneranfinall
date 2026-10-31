/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Streak, Journal Summary & Student Aggregate Recalculation Service — VERTIKAL SMA JAWARA 28
 *
 * Implements Spesifikasi Final 7 KAIH:
 * - Evaluates daily habit scores per date (multi-session habits `ibadah` and `makan` are averaged
 *   across sessions on that date; single-session habits take their entry score).
 * - Calculates consecutive active/complete day streaks (`streak_records`).
 * - Updates `students` (`xp`, `poin_hebat`, `level`, `streak`, `best_streak`, `predicate`).
 */

import { RelationalDatabase } from '../../database/client.ts';
import { VALID_HABIT_CODES } from '../../shared/schemas/validation-schemas.ts';
import type { HabitCode } from '../../shared/schemas/validation-schemas.ts';

export interface DailyHabitEvaluation {
  date: string;
  scoresByHabit: Record<HabitCode, number>;
  habitStatuses: Record<HabitCode, 'BELUM_DIMULAI' | 'SEDANG_DIISI' | 'SELESAI' | 'BELUM_DIISI_TERLEWAT'>;
  completedHabits: HabitCode[];
  inProgressHabits: HabitCode[];
  missingHabits: HabitCode[];
  completedCount: number;
  dailyAverageScore: number;
  isCompleteDay: boolean;
  overallDayStatus: 'SELESAI' | 'SEDANG_DIISI' | 'BELUM_DIMULAI' | 'BELUM_DIISI_TERLEWAT';
}

export function computePredicate(avgScore: number): string {
  if (avgScore >= 90) return 'Sangat Terbiasa (Teladan)';
  if (avgScore >= 80) return 'Terbiasa Baik';
  if (avgScore >= 70) return 'Cukup Terbiasa';
  return 'Perlu Pembinaan';
}

/**
 * Returns Monday YYYY-MM-DD for the school week of the given date.
 * Used for weekly Poin Hebat reset at the weekend.
 */
export function getStartOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().split('T')[0];
}

export class StreaksService {
  private readonly db: RelationalDatabase;

  constructor(db: RelationalDatabase) {
    this.db = db;
  }

  /**
   * Evaluates a single student's journal on a given date from `habit_entries`.
   */
  public evaluateStudentDay(
    studentId: string,
    dateStr: string,
    todayDateStr: string,
    prebuiltRows?: any[]
  ): DailyHabitEvaluation {
    const rows =
      prebuiltRows ||
      this.db.queryAll<any>(
        `SELECT habit_code, sub_category, final_score, card_status, payload_json
         FROM habit_entries
         WHERE student_id = ? AND log_date = ?`,
        [studentId, dateStr]
      );

    const byHabit: Record<string, any[]> = {};
    for (const h of VALID_HABIT_CODES) byHabit[h] = [];
    for (const r of rows) {
      if (byHabit[r.habit_code]) {
        byHabit[r.habit_code].push(r);
      }
    }

    const scoresByHabit = {} as Record<HabitCode, number>;
    const habitStatuses = {} as Record<
      HabitCode,
      'BELUM_DIMULAI' | 'SEDANG_DIISI' | 'SELESAI' | 'BELUM_DIISI_TERLEWAT'
    >;
    const completedHabits: HabitCode[] = [];
    const inProgressHabits: HabitCode[] = [];
    const missingHabits: HabitCode[] = [];

    const isPastDay = dateStr < todayDateStr;

    for (const h of VALID_HABIT_CODES) {
      const hRows = byHabit[h];
      if (!hRows || hRows.length === 0) {
        scoresByHabit[h] = 0;
        habitStatuses[h] = isPastDay ? 'BELUM_DIISI_TERLEWAT' : 'BELUM_DIMULAI';
        missingHabits.push(h);
        continue;
      }

      if (h === 'makan') {
        const topFinal = Math.max(...hRows.map((r) => Number(r.final_score || 0)));
        if (topFinal >= 100) {
          scoresByHabit[h] = 100;
          habitStatuses[h] = 'SELESAI';
          completedHabits.push(h);
        } else {
          let isFasting = false;
          const mealRawMap: Record<string, number> = {};
          let airScore = 0;
          let bonusScore = 0;
          let hasAir = false;
          let hasFull = false;

          for (const r of hRows) {
            const sub = String(r.sub_category || '').toLowerCase();
            let p: any = {};
            try {
              p = typeof r.payload_json === 'string' ? JSON.parse(r.payload_json) : r.payload_json || {};
            } catch {}

            if (p.isPuasa || sub === 'sahur' || p.selectedMeal === 'sahur') {
              isFasting = true;
            }

            if (sub === 'sarapan' || sub === 'pagi' || p.selectedMeal === 'sarapan') {
              mealRawMap.sarapan = Math.min(55, Number(p.mealRaw ?? p.score ?? r.final_score ?? 55));
            } else if (sub === 'siang' || p.selectedMeal === 'siang') {
              mealRawMap.siang = Math.min(55, Number(p.mealRaw ?? p.score ?? r.final_score ?? 55));
            } else if (sub === 'malam' || sub === 'buka' || p.selectedMeal === 'malam') {
              mealRawMap.malam = Math.min(55, Number(p.mealRaw ?? p.score ?? r.final_score ?? 55));
            } else if (sub === 'sahur' || p.selectedMeal === 'sahur') {
              mealRawMap.sahur = Math.min(55, Number(p.mealRaw ?? p.score ?? r.final_score ?? 55));
            } else if (sub === 'air_minum' || sub === 'minum' || p.waterGlasses || p.minumGelasCount) {
              hasAir = true;
              const wg = p.waterGlasses;
              const pts = wg === '>=8' ? 45 : wg === '<8' ? 25 : Number(r.final_score || 45);
              airScore = Math.max(airScore, pts);
            } else if (sub === 'bonus') {
              bonusScore = Math.max(bonusScore, Number(r.final_score || 0));
            } else if (!sub) {
              hasFull = true;
              mealRawMap.sarapan = 55;
              mealRawMap.siang = 55;
              mealRawMap.malam = 55;
              airScore = 45;
              hasAir = true;
            }

            if (p.bonusPoints) {
              bonusScore = Math.max(bonusScore, Number(p.bonusPoints));
            }
          }

          const expectedMeals = isFasting ? 2 : 3;
          const totalMealsRaw = isFasting
            ? (mealRawMap.sahur ?? mealRawMap.sarapan ?? 0) + (mealRawMap.malam ?? 0)
            : (mealRawMap.sarapan ?? 0) + (mealRawMap.siang ?? 0) + (mealRawMap.malam ?? 0);

          const filledMeals = isFasting
            ? (mealRawMap.sahur !== undefined || mealRawMap.sarapan !== undefined ? 1 : 0) + (mealRawMap.malam !== undefined ? 1 : 0)
            : (mealRawMap.sarapan !== undefined ? 1 : 0) + (mealRawMap.siang !== undefined ? 1 : 0) + (mealRawMap.malam !== undefined ? 1 : 0);

          const mealPoints = Math.round((totalMealsRaw / expectedMeals) * 10) / 10;
          scoresByHabit[h] = Math.min(100, Math.round((mealPoints + airScore + bonusScore) * 10) / 10);

          const distinctSessions = new Set(hRows.map((r) => String(r.sub_category || '').toLowerCase()));
          if (hasFull || distinctSessions.size >= 3 || (filledMeals >= expectedMeals && (hasAir || hRows.length >= expectedMeals))) {
            habitStatuses[h] = 'SELESAI';
            completedHabits.push(h);
          } else {
            habitStatuses[h] = 'SEDANG_DIISI';
            inProgressHabits.push(h);
          }
        }
      } else if (h === 'ibadah') {
        let maxBase = 0;
        let bonusTotal = 0;
        let isDone = false;

        for (const r of hRows) {
          const sub = String(r.sub_category || '').toLowerCase();
          let p: any = {};
          try {
            p = typeof r.payload_json === 'string' ? JSON.parse(r.payload_json) : r.payload_json || {};
          } catch {}

          if (sub === 'bonus') {
            bonusTotal = Math.max(bonusTotal, Number(r.final_score || 0));
          } else {
            maxBase = Math.max(maxBase, Number(r.final_score || 0));
            if (r.card_status === 'SELESAI' || Number(r.is_locked) === 1) {
              isDone = true;
            }
          }
        }

        scoresByHabit[h] = Math.min(100, Math.round((maxBase + (maxBase < 100 ? bonusTotal : 0)) * 10) / 10);
        if (maxBase >= 100 || isDone || hRows.some((r) => r.card_status === 'SELESAI')) {
          habitStatuses[h] = 'SELESAI';
          completedHabits.push(h);
        } else {
          habitStatuses[h] = 'SEDANG_DIISI';
          inProgressHabits.push(h);
        }
      } else {
        const topScore = Math.max(...hRows.map((r) => Number(r.final_score || 0)));
        scoresByHabit[h] = Math.min(100, Math.round(topScore * 10) / 10);
        habitStatuses[h] = 'SELESAI';
        completedHabits.push(h);
      }
    }

    const activeCount = completedHabits.length + inProgressHabits.length;
    const sumScores = VALID_HABIT_CODES.reduce((acc, h) => acc + scoresByHabit[h], 0);
    const dailyAverageScore =
      activeCount > 0 ? Math.round((sumScores / 7) * 10) / 10 : 0;

    let overallDayStatus: DailyHabitEvaluation['overallDayStatus'] = 'BELUM_DIMULAI';
    if (completedHabits.length === 7) {
      overallDayStatus = 'SELESAI';
    } else if (activeCount > 0) {
      overallDayStatus = 'SEDANG_DIISI';
    } else if (isPastDay) {
      overallDayStatus = 'BELUM_DIISI_TERLEWAT';
    }

    return {
      date: dateStr,
      scoresByHabit,
      habitStatuses,
      completedHabits,
      inProgressHabits,
      missingHabits,
      completedCount: completedHabits.length,
      dailyAverageScore,
      isCompleteDay: completedHabits.length === 7,
      overallDayStatus,
    };
  }

  /**
   * Synchronizes the `journals` row for (studentId, dateStr), recalculates `streak_records`,
   * and updates `students` aggregate metrics (`xp`, `poin_hebat`, `level`, `streak`, `best_streak`, `predicate`).
   */
  public syncStudentJournalAndAggregates(studentId: string, targetDateStr: string, todayDateStr: string): void {
    const student = this.db.queryOne<any>(
      `SELECT id, class_id, rombel_id FROM students WHERE id = ?`,
      [studentId]
    );
    if (!student) return;

    const evalDay = this.evaluateStudentDay(studentId, targetDateStr, todayDateStr);
    const journalId = `jrn-${studentId}-${targetDateStr}`;

    this.db.execute(
      `INSERT INTO journals
       (id, student_id, journal_date, academic_year_id, class_id_snapshot, rombel_id_snapshot,
        completed_habits_count, in_progress_habits_count, missed_habits_count,
        daily_average_score, journal_status, is_locked, completed_at, updated_at)
       VALUES (?, ?, ?, 'ay-2026-2027-1', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(student_id, journal_date) DO UPDATE SET
        completed_habits_count = excluded.completed_habits_count,
        in_progress_habits_count = excluded.in_progress_habits_count,
        missed_habits_count = excluded.missed_habits_count,
        daily_average_score = excluded.daily_average_score,
        journal_status = excluded.journal_status,
        is_locked = excluded.is_locked,
        completed_at = excluded.completed_at,
        updated_at = datetime('now')`,
      [
        journalId,
        studentId,
        targetDateStr,
        student.class_id || null,
        student.rombel_id || null,
        evalDay.completedCount,
        evalDay.inProgressHabits.length,
        evalDay.missingHabits.length,
        evalDay.dailyAverageScore,
        evalDay.overallDayStatus,
        evalDay.isCompleteDay ? 1 : 0,
        evalDay.isCompleteDay ? new Date().toISOString() : null,
      ]
    );

    this.recalculateStudentAggregates(studentId, todayDateStr);
  }

  public recalculateStudentAggregates(studentId: string, todayDateStr: string): void {
    const allEntries = this.db.queryAll<{
      log_date: string;
      final_score: number;
      overflow_bonus_points: number;
    }>(
      `SELECT log_date, final_score, overflow_bonus_points
       FROM habit_entries
       WHERE student_id = ?
       ORDER BY log_date ASC`,
      [studentId]
    );

    // Complete days where all 7 habits are completed
    const completeJournals = this.db.queryAll<{ journal_date: string }>(
      `SELECT journal_date FROM journals WHERE student_id = ? AND completed_habits_count = 7 ORDER BY journal_date ASC`,
      [studentId]
    );
    const completeDateSet = new Set(completeJournals.map((j) => j.journal_date));

    // Calculate active consecutive streak backwards
    // Per requirement 9:
    // - Streak automatically increments (+1) when a day is 7/7 complete.
    // - Resets to 0 if midnight arrives (00:00) and the previous day was not complete.
    // - Updates immediately when all habits today are completed.
    let currentStreak = 0;
    const checkDate = new Date(`${todayDateStr}T12:00:00Z`);
    const todayStr = checkDate.toISOString().split('T')[0];

    if (completeDateSet.has(todayStr)) {
      // Today is fully completed: streak increments immediately!
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
      while (true) {
        const dStr = checkDate.toISOString().split('T')[0];
        if (completeDateSet.has(dStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    } else {
      // Today is in progress. Check yesterday:
      checkDate.setDate(checkDate.getDate() - 1);
      const yesterdayStr = checkDate.toISOString().split('T')[0];
      if (completeDateSet.has(yesterdayStr)) {
        // Yesterday was complete; streak remains active through yesterday
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
        while (true) {
          const dStr = checkDate.toISOString().split('T')[0];
          if (completeDateSet.has(dStr)) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      } else {
        // Yesterday ended incomplete (broken streak at 00:00) -> 0
        currentStreak = 0;
      }
    }

    // Determine data collection start date for period-based all-time calculation
    const periodStartSetting = this.db.queryOne<{ value: string }>(
      `SELECT value FROM app_settings WHERE key = 'data_collection_start_date'`
    );
    const rawStartDate = periodStartSetting?.value || '2026-10-15';
    const startDate = rawStartDate < todayDateStr ? rawStartDate : todayDateStr;

    // Group entries by date
    const entriesByDate: Record<string, number[]> = {};
    for (const e of allEntries) {
      if (!entriesByDate[e.log_date]) entriesByDate[e.log_date] = [];
      entriesByDate[e.log_date].push(Number(e.final_score || 0));
    }

    // Per requirement 10:
    // Data masuk ke realtime/all-time adalah data hari ini JIKA jurnalnya sudah lengkap (7/7),
    // atau data yang sudah lewat (< todayDateStr).
    const evaluatedDates: string[] = [];
    const curIter = new Date(`${startDate}T12:00:00Z`);
    const todayMs = new Date(`${todayDateStr}T12:00:00Z`).getTime();

    while (curIter.getTime() < todayMs) {
      evaluatedDates.push(curIter.toISOString().split('T')[0]);
      curIter.setDate(curIter.getDate() + 1);
    }

    // ONLY include today if today is fully completed (7/7)!
    if (completeDateSet.has(todayDateStr)) {
      evaluatedDates.push(todayDateStr);
    }

    // Calculate sum of daily scores where each day is (sum of 7 habits / 7), missing habits = 0
    let totalScoreSum = 0;
    for (const d of evaluatedDates) {
      const scores = entriesByDate[d] || [];
      const daySum = scores.reduce((acc, s) => acc + s, 0);
      const dayAvg = daySum / 7;
      totalScoreSum += dayAvg;
    }

    const avgScore = evaluatedDates.length > 0
      ? Math.round((totalScoreSum / evaluatedDates.length) * 10) / 10
      : 0;

    const totalXpFromEntries = Math.round(
      allEntries.reduce((acc, r) => acc + Number(r.final_score || 0), 0)
    );

    // Per requirements 1, 11, 12:
    // Poin Hebat diberanda = poin sebelum-sebelumnya di minggu ini + poin hari ini.
    // Poin hebat direset akhir pekan (siklus mingguan Senin-Minggu).
    const startOfWeek = getStartOfWeek(todayDateStr);

    // Sum scores of habit entries in current week (from startOfWeek up to todayDateStr)
    const weekEntries = allEntries.filter(
      (e) => e.log_date >= startOfWeek && e.log_date <= todayDateStr
    );
    const weekHabitScores = weekEntries.reduce(
      (acc, r) => acc + Number(r.final_score || 0) + Number(r.overflow_bonus_points || 0),
      0
    );

    // Add event bonuses in current week
    const weekEventBonusRow = this.db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(bonus_awarded), 0) AS total
       FROM event_bonuses
       WHERE student_id = ? AND log_date >= ? AND log_date <= ?`,
      [studentId, startOfWeek, todayDateStr]
    );
    const weekEventBonuses = Number(weekEventBonusRow?.total || 0);

    // Add streak bonus for current week
    const weekStreakBonus = currentStreak;

    // Explicit Poin Hebat calculation:
    const poinHebat = Math.round(weekHabitScores + weekEventBonuses + weekStreakBonus);

    const totalXp = totalXpFromEntries + poinHebat;
    const level = Math.max(1, Math.floor(totalXp / 250) + 1);
    const predicate = computePredicate(avgScore);
    const distinctDates = Array.from(new Set(allEntries.map((e) => e.log_date))).sort();
    const lastDate = distinctDates.length > 0 ? distinctDates[distinctDates.length - 1] : null;

    const existingStreak = this.db.queryOne<{ longest_streak: number }>(
      `SELECT longest_streak FROM streak_records WHERE student_id = ?`,
      [studentId]
    );
    const longestStreak = Math.max(Number(existingStreak?.longest_streak || 0), currentStreak);

    this.db.execute(
      `INSERT INTO streak_records
       (id, student_id, current_streak, longest_streak, total_complete_days, total_active_days, last_completed_date, last_evaluated_date, streak_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(student_id) DO UPDATE SET
        current_streak = excluded.current_streak,
        longest_streak = MAX(streak_records.longest_streak, excluded.longest_streak),
        total_complete_days = excluded.total_complete_days,
        total_active_days = excluded.total_active_days,
        last_completed_date = excluded.last_completed_date,
        last_evaluated_date = excluded.last_evaluated_date,
        streak_status = excluded.streak_status,
        updated_at = datetime('now')`,
      [
        `str-${studentId}`,
        studentId,
        currentStreak,
        longestStreak,
        completeDateSet.size,
        distinctDates.length,
        lastDate,
        todayDateStr,
        currentStreak > 0 ? 'ACTIVE' : 'INACTIVE',
      ]
    );

    this.db.execute(
      `UPDATE students
       SET xp = ?,
           poin_hebat = ?,
           level = ?,
           streak = ?,
           best_streak = MAX(best_streak, ?),
           predicate = ?,
           avg_score = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [totalXp, poinHebat, level, currentStreak, longestStreak, predicate, avgScore, studentId]
    );
  }

  public recalculateAllStudents(todayDateStr: string): void {
    const students = this.db.queryAll<{ id: string }>(
      `SELECT id FROM students WHERE account_status = 'ACTIVE'`
    );
    for (const s of students) {
      this.recalculateStudentAggregates(s.id, todayDateStr);
    }
  }
}
