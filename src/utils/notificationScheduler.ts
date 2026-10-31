/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Browser & In-App Notification Scheduler — VERTIKAL SMA JAWARA 28
 * Reminds students at 09:00, 12:00, 15:00, and 20:00 WIB.
 */

export interface ScheduledReminder {
  hour: number;
  label: string;
  title: string;
  body: string;
}

export const REMINDER_SCHEDULE: ScheduledReminder[] = [
  {
    hour: 9,
    label: 'Pagi (09.00)',
    title: 'Pengingat Pagi 7 KAIH — SMAN 28',
    body: 'Waktunya Bangun Energi! Sudahkah kamu berolahraga dan mulai aktivitas belajar hari ini? 🏃‍♂️📚',
  },
  {
    hour: 12,
    label: 'Siang (12.00)',
    title: 'Pengingat Siang 7 KAIH — SMAN 28',
    body: 'Istirahat Siang! Tunaikan Shalat Zuhur dan nikmati makan siang bergizi 4 Sehat 5 Sempurna 🍱🕌',
  },
  {
    hour: 15,
    label: 'Sore (15.00)',
    title: 'Pengingat Sore 7 KAIH — SMAN 28',
    body: 'Waktunya Shalat Asar & Aktivitas Sosial! Lakukan hal positif bersama keluarga atau lingkungan 🤝🌿',
  },
  {
    hour: 20,
    label: 'Malam (20.00)',
    title: 'Evaluasi Jurnal & Persiapan Tidur — SMAN 28',
    body: 'Lengkapi 7 Kebiasaanmu hari ini sebelum tengah malam dan persiapkan tidur cepat sebelum 22.00! 🌙⭐',
  },
];

let schedulerInterval: any = null;

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  try {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  } catch {
    return false;
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export function initNotificationScheduler(onToast?: (title: string, body: string) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  const checkSchedule = () => {
    try {
      const now = new Date();
      // Formatter in Asia/Jakarta timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const hourPart = parts.find((p) => p.type === 'hour')?.value;
      const minPart = parts.find((p) => p.type === 'minute')?.value;
      const currentHour = Number(hourPart || now.getHours());
      const currentMinute = Number(minPart || now.getMinutes());

      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);

      for (const slot of REMINDER_SCHEDULE) {
        // Fire if within first 15 minutes of the target hour
        if (currentHour === slot.hour && currentMinute < 15) {
          const key = `jawara28_notif_${todayStr}_${slot.hour}`;
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, 'sent');

            // 1. Browser Push Notification
            if (isNotificationSupported() && Notification.permission === 'granted') {
              try {
                new Notification(slot.title, {
                  body: slot.body,
                  icon: '/logo_sman28.svg',
                  badge: '/favicon.svg',
                });
              } catch {
                // Ignore background errors
              }
            }

            // 2. In-App Toast
            if (onToast) {
              onToast(slot.title, slot.body);
            }
          }
        }
      }
    } catch {
      // Ignore timing errors
    }
  };

  // Check immediately, then every 30 seconds
  checkSchedule();
  schedulerInterval = setInterval(checkSchedule, 30000);

  return () => {
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
    }
  };
}
