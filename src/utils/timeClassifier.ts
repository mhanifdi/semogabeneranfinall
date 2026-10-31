import { HabitSchedule } from '../types';
import { SCORING_CONFIG } from '../config/scoringConfig';

export type TimeZoneStatus = 'IDEAL' | 'TOLERANSI' | 'TERLAMBAT' | 'DILUAR_JADWAL' | 'TERKUNCI';

export interface TimeClassificationResult {
  status: TimeZoneStatus;
  label: string;
  points: number;
  maxPoints: number;
  message: string;
  canSubmit: boolean;
}

/**
 * Helper to convert "HH:MM" or "HH.MM" string into total minutes from 00:00
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const normalized = timeStr.trim().replace('.', ':');
  const [hours, minutes] = normalized.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Get current "HH:MM" string in local time
 */
export function getCurrentTimeStr(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Check if a scheduled prayer/worship time has arrived on today's date
 */
export function hasScheduleArrived(scheduledStartTime: string, currentTimeStr?: string, isPastDate = false): boolean {
  if (isPastDate) return true;
  const nowMin = timeToMinutes(currentTimeStr || getCurrentTimeStr());
  const startMin = timeToMinutes(scheduledStartTime);
  return nowMin >= startMin;
}

/**
 * 1. Klasifikasi Waktu Bangun Pagi (Spesifikasi Baru: 04-05 = 75, 05-06 = 60, >06 = 45)
 * Rentang waktu bangun:
 * - 04.00–04.20 -> 75
 * - 04.21–04.40 -> 70
 * - 04.41–05.00 -> 65
 * - 05.01–06.20 -> 60
 * - 06.21–06.40 -> 55
 * - Lebih dari 06.40 -> 50
 */
export function classifyWakeUpTime(
  reportedTime: string,
  _schedule?: HabitSchedule
): TimeClassificationResult {
  const t = reportedTime.trim();

  if (t === '04.00-05.00' || t === '04:00-05:00' || t === '04.00 – 05.00 WIB' || t === '04.00 – 05.00') {
    return { status: 'IDEAL', label: '04.00 – 05.00 WIB (Ideal)', points: 75, maxPoints: 75, message: 'Bangun pagi ideal (75/75 poin).', canSubmit: true };
  }
  if (t === '05.00-06.00' || t === '05:00-06:00' || t === '05.00 – 06.00 WIB' || t === '05.00 – 06.00') {
    return { status: 'TOLERANSI', label: '05.00 – 06.00 WIB', points: 60, maxPoints: 75, message: 'Bangun pukul 05.00–06.00 (60/75 poin).', canSubmit: true };
  }
  if (t === '>06.00' || t === '> 06.00 WIB' || t === 'Lebih dari 06.00' || t === '>06.00 WIB') {
    return { status: 'TERLAMBAT', label: '> 06.00 WIB', points: 45, maxPoints: 75, message: 'Bangun lebih dari 06.00 (45/75 poin).', canSubmit: true };
  }

  // Fallback compatibility for previous slots
  if (t.includes('04.') || t.includes('04:')) {
    return { status: 'IDEAL', label: '04.00 – 05.00 WIB (Ideal)', points: 75, maxPoints: 75, message: 'Bangun pukul 04.00–05.00 (75/75 poin).', canSubmit: true };
  }
  if (t.includes('05.') || t.includes('05:')) {
    return { status: 'TOLERANSI', label: '05.00 – 06.00 WIB', points: 60, maxPoints: 75, message: 'Bangun pukul 05.00–06.00 (60/75 poin).', canSubmit: true };
  }

  const minutes = timeToMinutes(t);
  if (minutes >= 240 && minutes <= 300) {
    return { status: 'IDEAL', label: '04.00 – 05.00 WIB', points: 75, maxPoints: 75, message: 'Bangun pukul 04.00–05.00 (75/75 poin).', canSubmit: true };
  } else if (minutes >= 301 && minutes <= 360) {
    return { status: 'TOLERANSI', label: '05.00 – 06.00 WIB', points: 60, maxPoints: 75, message: 'Bangun pukul 05.00–06.00 (60/75 poin).', canSubmit: true };
  } else {
    return { status: 'TERLAMBAT', label: '> 06.00 WIB', points: 45, maxPoints: 75, message: 'Bangun lebih dari 06.00 (45/75 poin).', canSubmit: true };
  }
}
/**
 * 2. Klasifikasi Waktu Tidur Cepat (Spesifikasi Final Section 5)
 * - Sebelum 21.30 -> 75
 * - 21.30–22.30 -> 65
 * - 22.31–23.30 -> 55
 * - Setelah 23.30 -> 45
 */
export function classifySleepTime(
  reportedTime: string,
  _schedule?: HabitSchedule
): TimeClassificationResult {
  const t = reportedTime.trim();

  if (t === '<21.30' || t === 'Sebelum 21.30' || t === '<21:30' || t === '< 21.30 WIB') {
    return { status: 'IDEAL', label: '< 21.30 WIB', points: 75, maxPoints: 75, message: 'Tidur tepat waktu sebelum 21.30 (75/75 poin).', canSubmit: true };
  }
  if (t === '21.30-22.30' || t === '21:30-22:30' || t === '21.30 – 22.30 WIB') {
    return { status: 'TOLERANSI', label: '21.30 – 22.30 WIB', points: 65, maxPoints: 75, message: 'Tidur pukul 21.30–22.30 (65/75 poin).', canSubmit: true };
  }
  if (t === '22.31-23.30' || t === '22:31-23:30' || t === '22.31 – 23.30 WIB') {
    return { status: 'TOLERANSI', label: '22.31 – 23.30 WIB', points: 55, maxPoints: 75, message: 'Tidur pukul 22.31–23.30 (55/75 poin).', canSubmit: true };
  }
  if (t === '>23.31' || t === '>23.30' || t === 'Setelah 23.30' || t === '> 23.31 WIB') {
    return { status: 'TERLAMBAT', label: '> 23.31 WIB', points: 45, maxPoints: 75, message: 'Tidur larut malam setelah 23.31 (45/75 poin).', canSubmit: true };
  }

  const minutes = timeToMinutes(t);
  if (minutes >= 1080 && minutes < 1290) {
    return { status: 'IDEAL', label: '< 21.30 WIB', points: 75, maxPoints: 75, message: 'Tidur tepat waktu sebelum 21.30 (75/75 poin).', canSubmit: true };
  } else if (minutes >= 1290 && minutes <= 1350) {
    return { status: 'TOLERANSI', label: '21.30 – 22.30 WIB', points: 65, maxPoints: 75, message: 'Tidur pukul 21.30–22.30 (65/75 poin).', canSubmit: true };
  } else if (minutes >= 1351 && minutes <= 1410) {
    return { status: 'TOLERANSI', label: '22.31 – 23.30 WIB', points: 55, maxPoints: 75, message: 'Tidur pukul 22.31–23.30 (55/75 poin).', canSubmit: true };
  } else {
    return { status: 'TERLAMBAT', label: '> 23.31 WIB', points: 45, maxPoints: 75, message: 'Tidur setelah 23.31 (45/75 poin).', canSubmit: true };
  }
}
/**
 * 3. Klasifikasi Waktu Ibadah Shalat Wajib (Islam - Spesifikasi Final Section 2.1)
 * Kategori waktu manual atau berbasis rentang waktu:
 * - Awal waktu -> 100
 * - Tengah waktu -> 85
 * - Akhir waktu -> 70
 */
export function classifyPrayerTime(
  prayerKey: 'subuh' | 'dzuhur' | 'ashar' | 'maghrib' | 'isya',
  reportedInput: string,
  schedule?: HabitSchedule,
  isPastDate = false,
  currentTimeStr?: string
): TimeClassificationResult {
  const cfg = SCORING_CONFIG.beribadah.islam;
  const defaultWindows: Record<string, { start: string; idealEnd: string; midEnd: string; end: string }> = {
    subuh:   { start: '04:00', idealEnd: '04:35', midEnd: '05:05', end: '05:30' },
    dzuhur:  { start: '11:40', idealEnd: '12:30', midEnd: '13:45', end: '14:54' },
    ashar:   { start: '14:55', idealEnd: '15:40', midEnd: '16:45', end: '17:49' },
    maghrib: { start: '17:50', idealEnd: '18:15', midEnd: '18:40', end: '19:04' },
    isya:    { start: '19:05', idealEnd: '20:00', midEnd: '21:30', end: '23:59' }
  };

  const win = defaultWindows[prayerKey];
  const startTime = schedule?.start_time || win.start;

  // Periksa apakah waktu shalat sudah masuk (untuk pengisian hari ini)
  if (!hasScheduleArrived(startTime, currentTimeStr, isPastDate)) {
    return {
      status: 'TERKUNCI',
      label: `Belum Masuk Waktu (${startTime})`,
      points: 0,
      maxPoints: cfg.prayerPoints.awal,
      message: `Shalat belum dapat diisi karena belum memasuki jadwal (${startTime}).`,
      canSubmit: false
    };
  }

  const lower = (reportedInput || '').toLowerCase();
  if (lower === 'awal' || lower === 'awal_waktu' || lower === 'tepat_waktu') {
    return { status: 'IDEAL', label: 'Awal Waktu', points: cfg.prayerPoints.awal, maxPoints: cfg.prayerPoints.awal, message: 'Shalat di awal waktu (100/100 poin).', canSubmit: true };
  }
  if (lower === 'tengah' || lower === 'tengah_waktu' || lower === 'toleransi') {
    return { status: 'TOLERANSI', label: 'Tengah Waktu', points: cfg.prayerPoints.tengah, maxPoints: cfg.prayerPoints.awal, message: 'Shalat di tengah waktu (85/100 poin).', canSubmit: true };
  }
  if (lower === 'akhir' || lower === 'akhir_waktu' || lower === 'terlambat') {
    return { status: 'TERLAMBAT', label: 'Akhir Waktu', points: cfg.prayerPoints.akhir, maxPoints: cfg.prayerPoints.awal, message: 'Shalat di akhir waktu (70/100 poin).', canSubmit: true };
  }

  const startMin = timeToMinutes(startTime);
  const idealMin = timeToMinutes(schedule?.ideal_end_time || win.idealEnd);
  const midMin = timeToMinutes(win.midEnd);
  const endMin = timeToMinutes(schedule?.end_time || win.end);
  const repMin = timeToMinutes(reportedInput);

  if (repMin >= startMin && repMin <= idealMin) {
    return { status: 'IDEAL', label: 'Awal Waktu', points: cfg.prayerPoints.awal, maxPoints: cfg.prayerPoints.awal, message: 'Shalat di awal waktu (100/100 poin).', canSubmit: true };
  } else if (repMin > idealMin && repMin <= midMin) {
    return { status: 'TOLERANSI', label: 'Tengah Waktu', points: cfg.prayerPoints.tengah, maxPoints: cfg.prayerPoints.awal, message: 'Shalat di tengah waktu (85/100 poin).', canSubmit: true };
  } else if (repMin > midMin && repMin <= endMin) {
    return { status: 'TERLAMBAT', label: 'Akhir Waktu', points: cfg.prayerPoints.akhir, maxPoints: cfg.prayerPoints.awal, message: 'Shalat di akhir waktu (70/100 poin).', canSubmit: true };
  } else {
    return { status: 'TERLAMBAT', label: 'Akhir Waktu', points: cfg.prayerPoints.akhir, maxPoints: cfg.prayerPoints.awal, message: 'Shalat tercatat pada kategori akhir waktu (70/100 poin).', canSubmit: true };
  }
}

/**
 * 4. Klasifikasi Waktu Tri Sandhya (Hindu - Spesifikasi Final Section 2.3)
 * - Awal waktu (0-2 jam dari jadwal) -> 100
 * - Tengah waktu (2-4 jam dari jadwal) -> 85
 * - Akhir waktu (4-6 jam dari jadwal) -> 70
 */
export function classifyTriSandhyaTime(
  sessionKey: 'pagi' | 'siang' | 'sore',
  categoryOrTime: string,
  scheduleStartStr?: string,
  isPastDate = false,
  currentTimeStr?: string
): TimeClassificationResult {
  const cfg = SCORING_CONFIG.beribadah.hindu;
  const defaultStarts: Record<'pagi' | 'siang' | 'sore', string> = {
    pagi: cfg.defaultSchedule.pagi,
    siang: cfg.defaultSchedule.siang,
    sore: cfg.defaultSchedule.sore
  };
  const startStr = scheduleStartStr || defaultStarts[sessionKey];

  if (!hasScheduleArrived(startStr, currentTimeStr, isPastDate)) {
    return {
      status: 'TERKUNCI',
      label: `Belum Masuk Waktu (${startStr})`,
      points: 0,
      maxPoints: cfg.triSandhyaPoints.awal,
      message: `Tri Sandhya ${sessionKey} belum dapat diisi sebelum pukul ${startStr}.`,
      canSubmit: false
    };
  }

  const lower = (categoryOrTime || '').toLowerCase();
  if (lower === 'awal' || lower === 'awal_waktu') {
    return { status: 'IDEAL', label: 'Awal Waktu (0–2 jam)', points: cfg.triSandhyaPoints.awal, maxPoints: cfg.triSandhyaPoints.awal, message: 'Tri Sandhya di awal waktu (100/100 poin).', canSubmit: true };
  }
  if (lower === 'tengah' || lower === 'tengah_waktu') {
    return { status: 'TOLERANSI', label: 'Tengah Waktu (2–4 jam)', points: cfg.triSandhyaPoints.tengah, maxPoints: cfg.triSandhyaPoints.awal, message: 'Tri Sandhya di tengah waktu (85/100 poin).', canSubmit: true };
  }
  if (lower === 'akhir' || lower === 'akhir_waktu') {
    return { status: 'TERLAMBAT', label: 'Akhir Waktu (4–6 jam)', points: cfg.triSandhyaPoints.akhir, maxPoints: cfg.triSandhyaPoints.awal, message: 'Tri Sandhya di akhir waktu (70/100 poin).', canSubmit: true };
  }

  const startMin = timeToMinutes(startStr);
  const repMin = timeToMinutes(categoryOrTime);
  const diff = repMin - startMin;

  if (diff >= 0 && diff <= 120) {
    return { status: 'IDEAL', label: 'Awal Waktu (0–2 jam)', points: cfg.triSandhyaPoints.awal, maxPoints: cfg.triSandhyaPoints.awal, message: 'Tri Sandhya di awal waktu (100/100 poin).', canSubmit: true };
  } else if (diff > 120 && diff <= 240) {
    return { status: 'TOLERANSI', label: 'Tengah Waktu (2–4 jam)', points: cfg.triSandhyaPoints.tengah, maxPoints: cfg.triSandhyaPoints.awal, message: 'Tri Sandhya di tengah waktu (85/100 poin).', canSubmit: true };
  } else {
    return { status: 'TERLAMBAT', label: 'Akhir Waktu (4–6 jam)', points: cfg.triSandhyaPoints.akhir, maxPoints: cfg.triSandhyaPoints.awal, message: 'Tri Sandhya di akhir waktu (70/100 poin).', canSubmit: true };
  }
}

/**
 * 5. Klasifikasi Waktu Makan Bergizi (Spesifikasi Final Section 4)
 * Sesi makan normal:
 * - Sarapan: 06.00-08.00 (ideal 15 pt), batas akhir 11.29 (di luar ideal 10 pt)
 * - Makan siang: 11.30-13.00 (ideal 15 pt), batas akhir 17.49 (di luar ideal 10 pt)
 * - Makan malam: 18.00-19.30 (ideal 15 pt), batas akhir 23.59 (di luar ideal 10 pt)
 * Sesi makan puasa sunnah:
 * - Sahur: 03.00-04.30 (ideal 15 pt), batas akhir 05.30 (10 pt)
 */
export function classifyMealTime(
  mealKey: 'pagi' | 'siang' | 'malam' | 'sahur',
  reportedTimeOrMode: string,
  schedule?: HabitSchedule
): TimeClassificationResult {
  const cfg = SCORING_CONFIG.makanBergizi.sessionComponents;
  const lower = (reportedTimeOrMode || '').toLowerCase();

  if (lower === 'ideal' || lower === 'tepat_waktu') {
    return { status: 'IDEAL', label: 'Rentang Ideal', points: cfg.waktuIdeal, maxPoints: cfg.waktuIdeal, message: `Waktu makan pada rentang ideal (${cfg.waktuIdeal}/${cfg.waktuIdeal} poin).`, canSubmit: true };
  }
  if (lower === 'diluar_ideal' || lower === 'toleransi' || lower === 'terlambat') {
    return { status: 'TOLERANSI', label: 'Di Luar Rentang Ideal (Masih Dalam Batas)', points: cfg.waktuDiluarIdeal, maxPoints: cfg.waktuIdeal, message: `Waktu makan masih dalam batas sesi (${cfg.waktuDiluarIdeal}/${cfg.waktuIdeal} poin).`, canSubmit: true };
  }

  const defaultWindows: Record<string, { start: string; idealEnd: string; end: string; label: string }> = {
    pagi:  { start: '06:00', idealEnd: '08:00', end: '11:29', label: 'Sarapan' },
    siang: { start: '11:30', idealEnd: '13:00', end: '17:49', label: 'Makan Siang' },
    malam: { start: '18:00', idealEnd: '19:30', end: '23:59', label: 'Makan Malam' },
    sahur: { start: '03:00', idealEnd: '04:30', end: '05:30', label: 'Sahur' }
  };

  const win = defaultWindows[mealKey] || defaultWindows.pagi;
  const startMin = timeToMinutes(schedule?.start_time || win.start);
  const idealMin = timeToMinutes(schedule?.ideal_end_time || win.idealEnd);
  const endMin = timeToMinutes(schedule?.end_time || win.end);
  const repMin = timeToMinutes(reportedTimeOrMode);

  if (repMin >= startMin && repMin <= idealMin) {
    return { status: 'IDEAL', label: 'Rentang Ideal', points: cfg.waktuIdeal, maxPoints: cfg.waktuIdeal, message: `${win.label} pada rentang ideal (${cfg.waktuIdeal}/${cfg.waktuIdeal} poin).`, canSubmit: true };
  } else if (repMin >= 0 && repMin <= endMin) {
    return { status: 'TOLERANSI', label: 'Masih Dalam Batas Sesi', points: cfg.waktuDiluarIdeal, maxPoints: cfg.waktuIdeal, message: `${win.label} di luar rentang ideal namun sebelum batas akhir (${cfg.waktuDiluarIdeal}/${cfg.waktuIdeal} poin).`, canSubmit: true };
  } else {
    return { status: 'TOLERANSI', label: 'Tercatat Dalam Sesi', points: cfg.waktuDiluarIdeal, maxPoints: cfg.waktuIdeal, message: `${win.label} tercatat (${cfg.waktuDiluarIdeal}/${cfg.waktuIdeal} poin).`, canSubmit: true };
  }
}
