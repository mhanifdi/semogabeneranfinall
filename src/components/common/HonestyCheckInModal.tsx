/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HonestyCheckInModal: Router for 7 KAIH Habit Forms
 * SMAN 28 Jakarta
 */

import React from 'react';
import { HabitLog } from '../../types';
import { BangunPagiForm } from '../habits/BangunPagiForm';
import { BeribadahForm } from '../habits/BeribadahForm';
import { MakanBergiziForm } from '../habits/MakanBergiziForm';
import { BerolahragaForm } from '../habits/BerolahragaForm';
import { GemarBelajarForm } from '../habits/GemarBelajarForm';
import { BermasyarakatForm } from '../habits/BermasyarakatForm';
import { TidurCepatForm } from '../habits/TidurCepatForm';

interface HonestyCheckInModalProps {
  habitId: string;
  studentReligion?: string;
  studentGender?: string;
  todayLogs?: Record<string, HabitLog[]> | any;
  isMissedEntry?: boolean;
  targetDate?: string;
  initialHalangan?: boolean;
  initialPuasaSunnah?: boolean;
  isPuasaSunnah?: boolean;
  onSuccess: (score: number, payload: any, isMulti?: boolean, subCategory?: string, overwrite?: boolean) => void;
  onCancel: () => void;
  isAlreadySubmitted?: boolean;
  prayerSchedule?: any;
}

export const HonestyCheckInModal: React.FC<HonestyCheckInModalProps> = ({
  habitId,
  studentReligion = 'Islam',
  studentGender = 'L',
  todayLogs = {},
  isMissedEntry = false,
  targetDate,
  initialHalangan = false,
  initialPuasaSunnah = false,
  isPuasaSunnah = false,
  onSuccess,
  onCancel,
  isAlreadySubmitted = false,
  prayerSchedule,
}) => {
  const currentLogsList = Array.isArray(todayLogs)
    ? todayLogs
    : todayLogs[habitId] || [];

  // Deteksi jika puasa sunnah dicentang di riwayat / log Beribadah hari ini
  const ibadahLogsList = Array.isArray(todayLogs)
    ? todayLogs.filter((l: any) => l.habit_code === 'ibadah')
    : todayLogs['ibadah'] || [];

  const detectedPuasa =
    initialPuasaSunnah ||
    isPuasaSunnah ||
    ibadahLogsList.some((l: any) => {
      try {
        const p = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
        return Boolean(p?.puasaSunnah || p?.puasa || p?.isPuasa);
      } catch {
        return false;
      }
    });

  switch (habitId) {
    case 'bangun':
      return (
        <BangunPagiForm
          isMissedEntry={isMissedEntry}
          targetDate={targetDate}
          onSuccess={(score, payload) => onSuccess(score, payload, false)}
          onCancel={onCancel}
          isAlreadySubmitted={isAlreadySubmitted}
        />
      );

    case 'ibadah':
      return (
        <BeribadahForm
          studentReligion={studentReligion}
          studentGender={studentGender}
          todayLogs={currentLogsList}
          isMissedEntry={isMissedEntry}
          targetDate={targetDate}
          initialHalangan={initialHalangan}
          onSuccess={(score, payload, isMulti, subCat, overwrite) =>
            onSuccess(score, payload, isMulti ?? true, subCat, overwrite)
          }
          onCancel={onCancel}
        />
      );

    case 'makan':
      return (
        <MakanBergiziForm
          todayLogs={currentLogsList}
          isMissedEntry={isMissedEntry}
          targetDate={targetDate}
          initialPuasaSunnah={detectedPuasa}
          onSuccess={(score, payload, isMulti, subCat) =>
            onSuccess(score, payload, isMulti ?? true, subCat)
          }
          onCancel={onCancel}
        />
      );

    case 'olahraga':
      return (
        <BerolahragaForm
          isMissedEntry={isMissedEntry}
          targetDate={targetDate}
          onSuccess={(score, payload) => onSuccess(score, payload, false)}
          onCancel={onCancel}
          isAlreadySubmitted={isAlreadySubmitted}
        />
      );

    case 'belajar':
      return (
        <GemarBelajarForm
          isMissedEntry={isMissedEntry}
          targetDate={targetDate}
          onSuccess={(score, payload) => onSuccess(score, payload, false)}
          onCancel={onCancel}
          isAlreadySubmitted={isAlreadySubmitted}
        />
      );

    case 'masyarakat':
      return (
        <BermasyarakatForm
          isMissedEntry={isMissedEntry}
          targetDate={targetDate}
          onSuccess={(score, payload) => onSuccess(score, payload, false)}
          onCancel={onCancel}
          isAlreadySubmitted={isAlreadySubmitted}
        />
      );

    case 'tidur':
      return (
        <TidurCepatForm
          isMissedEntry={isMissedEntry}
          targetDate={targetDate}
          onSuccess={(score, payload) => onSuccess(score, payload, false)}
          onCancel={onCancel}
          isAlreadySubmitted={isAlreadySubmitted}
        />
      );

    default:
      return (
        <div className="p-4 text-center text-slate-500 text-sm">
          Kebiasaan tidak ditemukan.
        </div>
      );
  }
};
