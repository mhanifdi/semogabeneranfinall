/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Input Validation Schemas — VERTIKAL SMA JAWARA 28
 * Enforces strict server-side validation for all endpoints, habit variables,
 * dates, time formats, score bounds, and mandatory audit reasons.
 */

import { ValidationError } from '../errors/app-error.ts';

export const VALID_HABIT_CODES = [
  'bangun',
  'ibadah',
  'olahraga',
  'makan',
  'belajar',
  'masyarakat',
  'tidur',
] as const;

export type HabitCode = (typeof VALID_HABIT_CODES)[number];

export const VALID_PRAYER_SESSIONS = ['subuh', 'zuhur', 'asar', 'magrib', 'isya', 'halangan', 'gereja', 'doa', 'alkitab', 'tri_sandhya_pagi', 'tri_sandhya_siang', 'tri_sandhya_sore', 'bonus', 'bonus_ibadah'] as const;
export const VALID_MEAL_SESSIONS = ['pagi', 'sarapan', 'siang', 'malam', 'sahur', 'buka', 'buka_puasa', 'air_minum', 'bonus', 'bonus_makan'] as const;
export const VALID_RELIGIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'] as const;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function validateDateString(dateStr: unknown, fieldName = 'date'): string {
  const val = String(dateStr || '').trim();
  if (!DATE_REGEX.test(val)) {
    throw new ValidationError(`Format tanggal '${fieldName}' tidak valid (wajib YYYY-MM-DD, diterima: '${val}')`);
  }
  const parsed = new Date(`${val}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`Tanggal '${fieldName}' bukan tanggal kalender yang sah.`);
  }
  return val;
}

export function validateTimeString(timeStr: unknown, fieldName = 'time', allowEmpty = false): string {
  const val = String(timeStr || '').trim();
  if (!val && allowEmpty) return '';
  if (!TIME_REGEX.test(val)) {
    throw new ValidationError(`Format waktu '${fieldName}' tidak valid (wajib HH:mm 24-jam, diterima: '${val}')`);
  }
  return val;
}

export interface ValidatedHabitSubmission {
  student_id: string;
  habit_type: HabitCode;
  log_date: string;
  sub_category: string;
  entry_mode: 'TEPAT_HARI' | 'TEPAT_HARI_FLEKSIBEL' | 'TEPAT_HARI_TIMESTAMP' | 'FORMULIR_TERLEWAT';
  is_missed: boolean;
  is_counter_entry: boolean;
  overwrite: boolean;
  client_score?: number;
  payload: Record<string, any>;
}

export function validateHabitSubmissionInput(body: any, todayDateStr: string): ValidatedHabitSubmission {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Payload pengisian kebiasaan wajib berupa objek JSON.');
  }

  const student_id = String(body.student_id || '').trim();
  if (!student_id) {
    throw new ValidationError('student_id wajib diisi.');
  }

  const habit_type = String(body.habit_type || '').trim().toLowerCase() as HabitCode;
  if (!VALID_HABIT_CODES.includes(habit_type)) {
    throw new ValidationError(
      `habit_type '${habit_type}' tidak valid. Pilihan sah: ${VALID_HABIT_CODES.join(', ')}.`
    );
  }

  const log_date = body.log_date ? validateDateString(body.log_date, 'log_date') : todayDateStr;
  if (log_date > todayDateStr) {
    throw new ValidationError(`Tidak diperbolehkan mengisi jurnal untuk tanggal masa depan (${log_date}).`);
  }

  const payload = body.payload && typeof body.payload === 'object' ? { ...body.payload } : {};
  let sub_category = String(body.sub_category || payload.waktuSholat || payload.waktuMakan || '').trim().toLowerCase();

  // Validate sub_category rules for multi-session habits
  if (habit_type === 'makan') {
    if (!sub_category || sub_category === 'sarapan') sub_category = 'pagi';
    if (sub_category === 'buka') sub_category = 'buka_puasa';
    if (sub_category === 'bonus_makan') sub_category = 'bonus';
    if (!VALID_MEAL_SESSIONS.includes(sub_category as any)) {
      throw new ValidationError(
        `Sesi Makan Bergizi '${sub_category}' tidak valid. Pilihan sah: pagi, siang, malam, sahur, buka_puasa, air_minum, bonus.`
      );
    }
  }

  const is_missed = Boolean(body.is_missed || payload.isMissed || log_date < todayDateStr);
  let entry_mode: ValidatedHabitSubmission['entry_mode'] = 'TEPAT_HARI';
  if (log_date < todayDateStr || is_missed || payload.entryMode === 'terlewat') {
    entry_mode = 'FORMULIR_TERLEWAT';
  } else if (payload.entryMode === 'fleksibel') {
    entry_mode = 'TEPAT_HARI_FLEKSIBEL';
  } else if (payload.entryMode === 'timestamp') {
    entry_mode = 'TEPAT_HARI_TIMESTAMP';
  }

  return {
    student_id,
    habit_type,
    log_date,
    sub_category,
    entry_mode,
    is_missed,
    is_counter_entry: Boolean(body.is_counter_entry),
    overwrite: Boolean(body.overwrite),
    client_score: body.score !== undefined ? Number(body.score) : undefined,
    payload,
  };
}

export function validateAktivitasSeruInput(body: any, todayDateStr: string) {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Payload Aktivitas Seru tidak valid.');
  }
  const student_id = String(body.student_id || '').trim();
  const habit_type = String(body.habit_type || '').trim().toLowerCase() as HabitCode;
  const story = String(body.story || '').trim();
  const log_date = body.log_date ? validateDateString(body.log_date, 'log_date') : todayDateStr;

  if (!student_id) {
    throw new ValidationError('student_id wajib diisi.');
  }
  if (!VALID_HABIT_CODES.includes(habit_type)) {
    throw new ValidationError(`Kebiasaan pilihan '${habit_type}' tidak valid.`);
  }
  if (story.length < 15) {
    throw new ValidationError(
      `Cerita Aktivitas Seru wajib minimal 15 karakter (saat ini: ${story.length} karakter).`
    );
  }
  return { student_id, habit_type, story, log_date };
}

export function validateJournalCorrectionInput(body: any) {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Payload koreksi jurnal tidak valid.');
  }
  const reason = String(body.reason || '').trim();
  if (reason.length < 5) {
    throw new ValidationError('Alasan koreksi (reason) wajib diisi minimal 5 karakter untuk jejak audit.');
  }
  const new_score = Number(body.new_score);
  if (Number.isNaN(new_score) || new_score < 0 || new_score > 100) {
    throw new ValidationError('Nilai hasil koreksi (new_score) wajib berada pada rentang 0 hingga 100.');
  }
  return {
    log_id: body.log_id ? Number(body.log_id) : undefined,
    student_id: body.student_id ? String(body.student_id).trim() : undefined,
    log_date: body.log_date ? validateDateString(body.log_date, 'log_date') : undefined,
    habit_type: body.habit_type ? (String(body.habit_type).trim().toLowerCase() as HabitCode) : undefined,
    sub_category: body.sub_category ? String(body.sub_category).trim().toLowerCase() : '',
    new_score: Math.round(new_score * 10) / 10,
    new_base_score: body.new_base_score !== undefined ? Number(body.new_base_score) : undefined,
    new_bonus_score: body.new_bonus_score !== undefined ? Number(body.new_bonus_score) : undefined,
    new_payload: body.new_payload,
    reason,
    actor_name: body.actor_name ? String(body.actor_name).trim() : undefined,
  };
}
