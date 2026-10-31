/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Home,
  CheckSquare,
  Trophy,
  User,
  Sun,
  Moon,
  Activity,
  Utensils,
  GraduationCap,
  Users,
  Heart,
  ChevronRight,
  Flame,
  Award,
  Sparkles,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Calendar,
  AlertTriangle,
  Palette,
  Check,
  Send,
  Star,
  Bell,
  Quote,
  ChevronDown,
  ChevronUp,
  X,
  Database,
} from 'lucide-react';
import { Student, HabitLog } from '../../types';
import { api } from '../../utils/api';
import { HonestyCheckInModal } from '../common/HonestyCheckInModal';
import { LeaderboardTable } from '../common/LeaderboardTable';
import { HabitAnswersModal } from '../common/HabitAnswersModal';
import { RadarChart } from '../charts/RadarChart';
import { TrendLineChart } from '../charts/TrendLineChart';
import { GaugeChart } from '../charts/GaugeChart';
import { StudentProgressChart } from '../charts/StudentProgressChart';
import { THEME_OPTIONS, applyTheme, getSavedTheme } from '../../config/themeConfig';
import {
  initNotificationScheduler,
  requestNotificationPermission,
  isNotificationSupported,
} from '../../utils/notificationScheduler';

interface StudentDashboardProps {
  student: Student;
  allStudents: Student[];
  onLogout: () => void;
  onOpenReport?: (studentId: string) => void;
}

type TabType = 'beranda' | 'kebiasaanku' | 'terlewat' | 'prestasi' | 'leaderboard' | 'profil';

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
  allStudents,
  onLogout,
  onOpenReport,
}) => {
  const [currentStudent, setCurrentStudent] = useState<Student>(student);
  const [liveStudents, setLiveStudents] = useState<Student[]>(allStudents);
  const [activeTab, setActiveTab] = useState<TabType>('beranda');
  const [todayLogs, setTodayLogs] = useState<Record<string, HabitLog[]>>({
    bangun: [],
    ibadah: [],
    olahraga: [],
    makan: [],
    belajar: [],
    masyarakat: [],
    tidur: [],
  });
  const [activeFormModal, setActiveFormModal] = useState<string | null>(null);
  const [inspectAnswerModal, setInspectAnswerModal] = useState<{
    habitCode: string;
    habitTitle: string;
    logDate: string;
  } | null>(null);
  const [modalInitialHalangan, setModalInitialHalangan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [studentStats, setStudentStats] = useState<any>(null);
  const [progressSeries, setProgressSeries] = useState<any[]>([]);
  const [prayerSchedule, setPrayerSchedule] = useState<Record<string, string>>({
    subuh: '04:00',
    zuhur: '11:40',
    asar: '14:55',
    maghrib: '17:50',
    isya: '19:05',
  });

  // Realtime Jakarta Clock & Date state
  const [serverTodayDate, setServerTodayDate] = useState<string>(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
  );
  const [currentTime, setCurrentTime] = useState<string>('');

  // Announcements & Quotes
  const [announcements, setAnnouncements] = useState<any[]>([]);

  // Aktivitas Seru & Kegiatan state (Section 9)
  const [aktivitasSeruList, setAktivitasSeruList] = useState<any[]>([]);
  const [isSeruModalOpen, setIsSeruModalOpen] = useState(false);
  const [todaySeruCount, setTodaySeruCount] = useState<number>(0);
  const [seruHabitType, setSeruHabitType] = useState('belajar');
  const [seruTitle, setSeruTitle] = useState('');
  const [seruStory, setSeruStory] = useState('');
  const [seruSubmitting, setSeruSubmitting] = useState(false);
  const [seruFeedback, setSeruFeedback] = useState('');

  // Portofolio & Pengajuan Prestasi Murid (Section 8, 10, 11)
  const [myAchievements, setMyAchievements] = useState<any[]>([]);
  const [achievementRubric, setAchievementRubric] = useState<any[]>([]);
  const [showRubricDetail, setShowRubricDetail] = useState(false);
  const [isPrestasiModalOpen, setIsPrestasiModalOpen] = useState(false);
  const [prestasiForm, setPrestasiForm] = useState({
    nama_prestasi: '',
    jenis_prestasi: 'Akademik' as 'Akademik' | 'Nonakademik',
    jenjang: 'Sekolah' as 'Sekolah' | 'Kecamatan' | 'Kota-Kabupaten' | 'Provinsi' | 'Nasional' | 'Internasional',
    kategori: 'Individu' as 'Individu' | 'Beregu',
    tanggal: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()),
    pencapaian: '',
    cerita: '',
    bukti_url: '',
  });
  const [prestasiSubmitting, setPrestasiSubmitting] = useState(false);
  const [prestasiFeedback, setPrestasiFeedback] = useState('');

  // Calendar & Multi-date missed habit tracking (Riwayat Pengisian)
  // Per requirement 4: Initial state is null (user must pick a date from cards above)
  const [missedDate, setMissedDate] = useState<string | null>(null);
  const [periodInfo, setPeriodInfo] = useState<{ startDate: string; endDate: string; isInPeriod: boolean }>({
    startDate: '2026-10-15',
    endDate: '2026-11-15',
    isInPeriod: true,
  });
  const [calendarDates, setCalendarDates] = useState<{
    date: string;
    dayName: string;
    formattedDate: string;
    completedCount: number;
    missingCount: number;
    isComplete: boolean;
    isFuture?: boolean;
    isToday?: boolean;
    isPast?: boolean;
    calendarCardStatus?: string;
    habitsDone: string[];
    missingHabits: string[];
    dailyScore: number;
  }[]>([]);
  const [hasAnyMissed, setHasAnyMissed] = useState(false);
  const [selectedDateLogs, setSelectedDateLogs] = useState<Record<string, HabitLog[]>>({});

  // Theme state & Profile Accordion & Statistics View Mode
  const [activeTheme, setActiveTheme] = useState(() => getSavedTheme());
  const [themeToast, setThemeToast] = useState('');
  const [isThemeAccordionOpen, setIsThemeAccordionOpen] = useState(false);
  const [statsViewMode, setStatsViewMode] = useState<'today' | 'all_time'>('today');

  // Password change state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);
  const [isPwAccordionOpen, setIsPwAccordionOpen] = useState(false);

  // Browser notifications
  const [notifPermission, setNotifPermission] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [inAppToast, setInAppToast] = useState<{ title: string; body: string } | null>(null);

  const handleRequestNotification = async () => {
    await requestNotificationPermission();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
  };

  // Helper to check if student is fasting sunnah on a given logs set (checks ibadah and makan)
  const isFastingOnLogs = (logsMap: Record<string, HabitLog[]>) => {
    const ibadahLogs = logsMap['ibadah'] || [];
    const hasIbadahFasting = ibadahLogs.some((l) => {
      try {
        const p = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
        return !!p?.puasaSunnah || !!p?.isPuasa;
      } catch {
        return false;
      }
    });
    if (hasIbadahFasting) return true;

    const makanLogs = logsMap['makan'] || [];
    return makanLogs.some((l) => {
      if (l.sub_category === 'sahur' || l.sub_category === 'puasa') return true;
      try {
        const p = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
        return !!p?.isPuasa || !!p?.puasa || p?.mealType === 'sahur';
      } catch {
        return false;
      }
    });
  };

  // Helper to check if female Muslim student has active Halangan mode on a given logs set
  const isHalanganOnLogs = (logsMap: Record<string, HabitLog[]>) => {
    const ibadahLogs = logsMap['ibadah'] || [];
    return ibadahLogs.some((l) => {
      if (l.sub_category === 'islam_halangan') return true;
      try {
        const p = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
        return !!p?.isHalangan || p?.mode === 'HALANGAN';
      } catch {
        return false;
      }
    });
  };

  const getMaxCount = (habitId: string, logsMap: Record<string, HabitLog[]> = todayLogs) => {
    if (habitId === 'makan') {
      return isFastingOnLogs(logsMap) ? 2 : 3;
    }
    if (habitId === 'ibadah') {
      const rel = (student.religion || '').toLowerCase();
      if (rel.includes('hindu')) return 3;
      if (rel.includes('kristen') || rel.includes('katolik')) return 1; // Saved as single consolidated 5-component form
      if (isHalanganOnLogs(logsMap)) return 1; // Saved as single consolidated 5-component Halangan form
      return 5;
    }
    return 1;
  };

  // Compute habit card score (Nilai saat ini / 100) and status according to Section 1.3 & 1.4
  const getHabitProgressInfo = (
    habitId: string,
    logsMap: Record<string, HabitLog[]>,
    isPastDate = false
  ): {
    status: 'Belum dimulai' | 'Sedang diisi' | 'Selesai' | 'Belum diisi/terlewat';
    currentScore: number;
    sessionCount: number;
    maxSessions: number;
    halanganCheckedCount?: number;
  } => {
    const logs = logsMap[habitId] || [];
    const maxSessions = getMaxCount(habitId, logsMap);

    if (logs.length === 0) {
      return {
        status: isPastDate ? 'Belum diisi/terlewat' : 'Belum dimulai',
        currentScore: 0,
        sessionCount: 0,
        maxSessions,
      };
    }

    if (habitId === 'ibadah') {
      const rel = (student.religion || 'Islam').toLowerCase();
      if (isHalanganOnLogs(logsMap)) {
        const halLog = logs.find((l) => l.sub_category === 'islam_halangan') || logs[0];
        let checkedCount = 0;
        try {
          const p = typeof halLog.payload === 'string' ? JSON.parse(halLog.payload) : halLog.payload;
          checkedCount = Array.isArray(p?.checkedItems) ? p.checkedItems.length : Math.round((halLog.score || 0) / 20);
        } catch {
          checkedCount = Math.round((halLog.score || 0) / 20);
        }
        const score = Math.min(100, Math.round(halLog.score || checkedCount * 20));
        return {
          status: checkedCount >= 5 ? 'Selesai' : isPastDate ? 'Belum diisi/terlewat' : 'Sedang diisi',
          currentScore: score,
          sessionCount: checkedCount,
          maxSessions: 5,
          halanganCheckedCount: checkedCount,
        };
      }
      if (rel.includes('kristen') || rel.includes('katolik')) {
        let hasGereja = false;
        let hasDoa = false;
        let hasAlkitab = false;
        logs.forEach((l) => {
          try {
            const p = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
            if (p?.ibadahGereja || p?.gereja) hasGereja = true;
            if (p?.doaKegiatan || p?.doa) hasDoa = true;
            if (p?.bacaAlkitab || p?.alkitab) hasAlkitab = true;
          } catch {}
        });
        const latestLog = logs[logs.length - 1];
        const score = Math.min(100, Math.round(latestLog?.score || (hasGereja ? 50 : 0) + (hasDoa ? 25 : 0) + (hasAlkitab ? 25 : 0)));
        // Church attendance makes it fully complete for the week
        const isComplete = hasGereja && hasDoa && hasAlkitab;
        return {
          status: isComplete ? 'Selesai' : isPastDate ? 'Belum diisi/terlewat' : 'Sedang diisi',
          currentScore: score,
          sessionCount: (hasGereja ? 1 : 0) + (hasDoa ? 1 : 0) + (hasAlkitab ? 1 : 0),
          maxSessions: 3,
        };
      }
      if (rel.includes('hindu')) {
        let hasPagi = false;
        let hasSiang = false;
        let hasSore = false;
        let bonusScore = 0;
        let maxBaseScore = 0;

        logs.forEach((l) => {
          const sub = (l.sub_category || '').toLowerCase();
          try {
            const p = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
            if (p?.triSandhya?.pagi || p?.pagi) hasPagi = true;
            if (p?.triSandhya?.siang || p?.siang) hasSiang = true;
            if (p?.triSandhya?.sore || p?.sore) hasSore = true;
            if (p?.bacaWeda) bonusScore = Math.max(bonusScore, 10);
            if (p?.adiwiyataTempatIbadah) bonusScore += 10;
          } catch {}
          if (sub === 'bonus') {
            bonusScore = Math.max(bonusScore, Number(l.score || 0));
          } else {
            maxBaseScore = Math.max(maxBaseScore, Number(l.score || 0));
          }
        });

        const checkedSessions = (hasPagi ? 1 : 0) + (hasSiang ? 1 : 0) + (hasSore ? 1 : 0);
        const count = Math.max(checkedSessions, logs.filter((l) => (l.sub_category || '').toLowerCase() !== 'bonus').length);
        const computedBase = count >= 3 ? 100 : count === 2 ? 67 : count === 1 ? 34 : 0;
        const finalBase = Math.max(computedBase, maxBaseScore);
        const total = Math.min(100, Math.round(finalBase + (finalBase < 100 ? bonusScore : 0)));
        const done = count >= 3 || finalBase >= 100;
        return {
          status: done ? 'Selesai' : isPastDate ? 'Belum diisi/terlewat' : 'Sedang diisi',
          currentScore: total,
          sessionCount: Math.min(3, Math.max(count, 1)),
          maxSessions: 3,
        };
      }
      // Islam 5 prayers (subuh, zuhur, asar, magrib, isya)
      const completedPrayersSet = new Set<string>();
      logs.forEach((l) => {
        const sub = (l.sub_category || '').toLowerCase();
        if (['subuh', 'zuhur', 'dzuhur', 'asar', 'ashar', 'magrib', 'maghrib', 'isya'].includes(sub)) {
          const normKey = sub.replace('dzuhur', 'zuhur').replace('ashar', 'asar').replace('maghrib', 'magrib');
          completedPrayersSet.add(normKey);
        }
        try {
          const p = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
          if (p?.shalat && typeof p.shalat === 'object') {
            Object.keys(p.shalat).forEach((k) => {
              if (p.shalat[k]) {
                const norm = k.replace('dzuhur', 'zuhur').replace('ashar', 'asar').replace('maghrib', 'magrib');
                completedPrayersSet.add(norm);
              }
            });
          }
        } catch {}
      });
      const doneCount = completedPrayersSet.size;
      const done = doneCount >= 5;
      const latestLog = logs[logs.length - 1];
      const score = Math.min(100, Math.round(latestLog?.score ?? doneCount * 20));
      return {
        status: done ? 'Selesai' : isPastDate ? 'Belum diisi/terlewat' : 'Sedang diisi',
        currentScore: score,
        sessionCount: doneCount,
        maxSessions: 5,
      };
    }

    if (habitId === 'makan') {
      const fasting = isFastingOnLogs(logsMap);
      const expectedMeals = fasting ? 2 : 3;
      const mealRawMap: Record<string, number> = {};
      let airScore = 0;
      let bonusScore = 0;
      let hasAir = false;

      logs.forEach((l) => {
        const sub = (l.sub_category || '').toLowerCase();
        let p: any = {};
        try {
          p = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
        } catch {}

        if (sub === 'sarapan' || sub === 'pagi' || p?.selectedMeal === 'sarapan') {
          mealRawMap.sarapan = Math.min(55, Number(p?.mealRaw ?? p?.score ?? l.score ?? 55));
        } else if (sub === 'siang' || p?.selectedMeal === 'siang') {
          mealRawMap.siang = Math.min(55, Number(p?.mealRaw ?? p?.score ?? l.score ?? 55));
        } else if (sub === 'malam' || sub === 'buka' || p?.selectedMeal === 'malam') {
          mealRawMap.malam = Math.min(55, Number(p?.mealRaw ?? p?.score ?? l.score ?? 55));
        } else if (sub === 'sahur' || p?.selectedMeal === 'sahur') {
          mealRawMap.sahur = Math.min(55, Number(p?.mealRaw ?? p?.score ?? l.score ?? 55));
        } else if (sub === 'air_minum' || sub === 'minum' || p?.waterGlasses || p?.minumGelasCount) {
          hasAir = true;
          const wg = p?.waterGlasses;
          const pts = wg === '>=8' ? 45 : wg === '<8' ? 25 : Number(l.score || 45);
          airScore = Math.max(airScore, pts);
        } else if (sub === 'bonus') {
          bonusScore = Math.max(bonusScore, Number(l.score || 0));
        } else if (!sub) {
          // Consolidated entry
          mealRawMap.sarapan = 55;
          mealRawMap.siang = 55;
          mealRawMap.malam = 55;
          airScore = 45;
          hasAir = true;
        }

        if (p?.bonusPoints) {
          bonusScore = Math.max(bonusScore, Number(p.bonusPoints));
        }
      });

      const totalMealsRaw = fasting
        ? (mealRawMap.sahur || 0) + (mealRawMap.malam || 0)
        : (mealRawMap.sarapan || 0) + (mealRawMap.siang || 0) + (mealRawMap.malam || 0);

      const filledMeals = fasting
        ? (mealRawMap.sahur !== undefined ? 1 : 0) + (mealRawMap.malam !== undefined ? 1 : 0)
        : (mealRawMap.sarapan !== undefined ? 1 : 0) + (mealRawMap.siang !== undefined ? 1 : 0) + (mealRawMap.malam !== undefined ? 1 : 0);

      const mealPoints = Math.round((totalMealsRaw / expectedMeals) * 10) / 10;
      const totalScore = Math.min(100, Math.round(mealPoints + airScore + bonusScore));
      const isDone = filledMeals >= expectedMeals && hasAir;

      return {
        status: isDone ? 'Selesai' : isPastDate ? 'Belum diisi/terlewat' : 'Sedang diisi',
        currentScore: totalScore,
        sessionCount: filledMeals + (hasAir ? 1 : 0),
        maxSessions: expectedMeals + 1,
      };
    }

    // Single-entry habits
    const score = Math.min(100, Math.round(logs[0]?.score || 0));
    return {
      status: 'Selesai',
      currentScore: score,
      sessionCount: 1,
      maxSessions: 1,
    };
  };

  // Indonesian date formatter helper
  const formatIndoDate = (dateStr: string) => {
    try {
      const d = new Date(`${dateStr}T12:00:00Z`);
      return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  useEffect(() => {
    setCurrentStudent(student);
  }, [student]);

  useEffect(() => {
    setLiveStudents(allStudents);
  }, [allStudents]);

  // Load today's logs, report, progress series, aktivitas seru, announcements & calendar summary
  const fetchTodayHabits = async () => {
    try {
      const todayInfo = await api.getTodayInfo().catch(() => ({
        todayDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()),
      }));
      const todayStr = todayInfo.todayDate;
      setServerTodayDate(todayStr);

      const [todayData, report, calendarData, progData, seruData, announcementsData, seruSummary, freshStudents] = await Promise.all([
        api.getTodayHabits(currentStudent.id, todayStr),
        api.getStudentReport(currentStudent.id),
        api.getCalendarSummary(currentStudent.id, 14),
        api.getStudentProgress(currentStudent.id, 14),
        api.getAktivitasSeru(currentStudent.id, todayStr),
        api.getAnnouncements().catch(() => []),
        api.getAktivitasSeruSummary(todayStr).catch(() => ({ count: 0 })),
        api.getStudents().catch(() => null),
      ]);

      if (todayData?.habitsByType) {
        setTodayLogs(todayData.habitsByType);
      }
      setStudentStats(report);

      if (freshStudents && Array.isArray(freshStudents)) {
        setLiveStudents(freshStudents);
        const me = freshStudents.find((s: any) => s.id === currentStudent.id);
        if (me) setCurrentStudent(me);
      }

      if (calendarData) {
        const sDate = calendarData.startDate || '2026-10-15';
        const eDate = calendarData.endDate || '2026-11-15';
        const inPeriod = todayStr >= sDate && todayStr <= eDate;
        setPeriodInfo({ startDate: sDate, endDate: eDate, isInPeriod: inPeriod });
        if (calendarData.dates) {
          setCalendarDates(calendarData.dates);
          setHasAnyMissed(calendarData.hasAnyMissed);
        }
      }
      if (progData?.series) {
        setProgressSeries(progData.series);
      }
      if (seruData) {
        setAktivitasSeruList(Array.isArray(seruData) ? seruData : ((seruData as any).entries || []));
      }
      if (announcementsData && Array.isArray(announcementsData)) {
        setAnnouncements(announcementsData);
      }
      if (seruSummary) {
        setTodaySeruCount(seruSummary.count || 0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch logs for the selected missed date
  const fetchDateHabits = async (dateStr: string) => {
    try {
      const data = await api.getTodayHabits(currentStudent.id, dateStr);
      if (data?.habitsByType) {
        setSelectedDateLogs(data.habitsByType);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAchievements = async () => {
    try {
      const [achList, rubricData] = await Promise.all([
        api.getMyAchievements(student.id),
        api.getAchievementRubric(),
      ]);
      if (achList) setMyAchievements(achList);
      const rubricsList = Array.isArray(rubricData) ? rubricData : (rubricData as any)?.rubric || [];
      if (rubricsList.length > 0) setAchievementRubric(rubricsList);
    } catch (err) {
      console.error('Failed to load achievements:', err);
    }
  };

  useEffect(() => {
    fetchTodayHabits();
    fetchAchievements();
  }, [student.id]);

  useEffect(() => {
    if (activeTab === 'prestasi') {
      fetchAchievements();
    }
  }, [activeTab]);

  // Live ticking digital clock for Jakarta timezone
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' WIB'
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Browser notification scheduler (only active during data collection period)
  useEffect(() => {
    if (!periodInfo.isInPeriod) return;
    const cleanup = initNotificationScheduler((title, body) => {
      setInAppToast({ title, body });
      setTimeout(() => setInAppToast(null), 8000);
    });
    return cleanup;
  }, [periodInfo.isInPeriod]);

  useEffect(() => {
    if (activeTab === 'terlewat') {
      fetchDateHabits(missedDate);
    }
  }, [missedDate, activeTab]);

  // Apply theme on initial mount
  useEffect(() => {
    applyTheme(activeTheme.hex);
  }, []);

  const handleThemeChange = (hex: string) => {
    applyTheme(hex);
    const found = THEME_OPTIONS.find((t) => t.hex.toLowerCase() === hex.toLowerCase()) || THEME_OPTIONS[0];
    setActiveTheme(found);
    setThemeToast(`Tema berhasil diubah ke ${found.name}!`);
    setTimeout(() => setThemeToast(''), 3000);
  };

  // 7 KAIH master definition
  const HABIT_CARDS = [
    {
      id: 'bangun',
      title: 'Bangun Pagi',
      subtitle: 'Pukul 04.00 – 06.40 WIB',
      icon: Sun,
      color: '#1c5ddc',
      bgLight: 'bg-blue-50',
      borderLight: 'border-blue-200',
      isMulti: false,
      desc: 'Kedisiplinan mengawali hari dengan segar',
    },
    {
      id: 'ibadah',
      title: 'Beribadah',
      subtitle: 'Shalat / Doa Harian / Tri Sandhya',
      icon: Heart,
      color: '#19ae5d',
      bgLight: 'bg-emerald-50',
      borderLight: 'border-emerald-200',
      isMulti: true,
      desc: 'Ketaatan spiritual & penguatan nilai keimanan',
    },
    {
      id: 'olahraga',
      title: 'Berolahraga',
      subtitle: 'Aktivitas Fisik & Peregangan',
      icon: Activity,
      color: '#fc351c',
      bgLight: 'bg-red-50',
      borderLight: 'border-red-200',
      isMulti: false,
      desc: 'Kebugaran fisik, peregangan & stamina tubuh',
    },
    {
      id: 'makan',
      title: 'Makan Bergizi',
      subtitle: '3 Sesi Makan & Air Putih',
      icon: Utensils,
      color: '#feb52b',
      bgLight: 'bg-amber-50',
      borderLight: 'border-amber-200',
      isMulti: true,
      desc: 'Nutrisi seimbang karbohidrat, lauk, sayur & buah',
    },
    {
      id: 'belajar',
      title: 'Gemar Belajar',
      subtitle: 'Mandiri di luar jam sekolah',
      icon: GraduationCap,
      color: '#0000fe',
      bgLight: 'bg-indigo-50',
      borderLight: 'border-indigo-200',
      isMulti: false,
      desc: 'Membaca, review pelajaran & eksplorasi materi',
    },
    {
      id: 'masyarakat',
      title: 'Bermasyarakat',
      subtitle: 'Aksi Sosial & Kebersihan Lingkungan',
      icon: Users,
      color: '#19ae5d',
      bgLight: 'bg-emerald-50',
      borderLight: 'border-emerald-200',
      isMulti: false,
      desc: 'Kepedulian sosial di rumah, sekolah & masyarakat',
    },
    {
      id: 'tidur',
      title: 'Tidur Cepat',
      subtitle: 'Sebelum 21.30 – 22.30 WIB',
      icon: Moon,
      color: '#0000fe',
      bgLight: 'bg-indigo-50',
      borderLight: 'border-indigo-200',
      isMulti: false,
      desc: 'Pemulihan tubuh & ritme istirahat sehat',
    },
  ];

  // Check which habits have NOT reached 'Selesai' today
  const uncompletedHabits = HABIT_CARDS.filter((h) => {
    const info = getHabitProgressInfo(h.id, todayLogs, false);
    return info.status !== 'Selesai';
  });

  // Calculate my rank in all students based on highest Poin Hebat
  const sortedLiveStudents = [...liveStudents].sort(
    (a, b) => Number(b.poin_hebat ?? b.xp ?? 0) - Number(a.poin_hebat ?? a.xp ?? 0)
  );
  const myRank =
    sortedLiveStudents.findIndex((s) => s.id === currentStudent.id) !== -1
      ? sortedLiveStudents.findIndex((s) => s.id === currentStudent.id) + 1
      : 1;

  // Poin Hebat Formula per user brief:
  // Daily Poin Hebat = Sum(7 habit scores) + Bonus Points (Aktivitas Seru, Adiwiyata, Overflow Habits > 100) + Streak Bonus
  const habitScoresSum = HABIT_CARDS.reduce((sum, h) => {
    const info = getHabitProgressInfo(h.id, todayLogs, false);
    return sum + (info.currentScore || 0);
  }, 0);

  // Overflow bonus from habit logs that exceeded 100 points
  let habitOverflowBonusToday = 0;
  Object.values(todayLogs).forEach((logsList) => {
    logsList.forEach((l) => {
      if (l.overflow_bonus_points && Number(l.overflow_bonus_points) > 0) {
        habitOverflowBonusToday += Number(l.overflow_bonus_points);
      } else {
        try {
          const p = typeof l.payload === 'string' ? JSON.parse(l.payload) : l.payload;
          if (p?.overflowBonus && Number(p.overflowBonus) > 0) {
            habitOverflowBonusToday += Number(p.overflowBonus);
          }
        } catch {}
      }
    });
  });

  const bonusPointsToday =
    (aktivitasSeruList.length > 0 ? 10 : 0) +
    habitOverflowBonusToday +
    (studentStats?.eventBonuses || 0);
  const streakBonus = studentStats?.streak ?? student.streak ?? 0;
  const poinHebatHariIni = habitScoresSum + bonusPointsToday + streakBonus;

  // Handle submit habit log
  const handleHabitSubmit = async (
    habitType: string,
    score: number,
    payload: any,
    isCounter = false,
    subCategory?: string
  ) => {
    try {
      setLoading(true);
      const todayStr = serverTodayDate || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      const isPastDate = activeTab === 'terlewat' && missedDate !== null && missedDate !== todayStr;
      const targetDate = isPastDate ? (missedDate as string) : todayStr;
      const isMissed = isPastDate || !!payload?.isMissed;
      const finalSubCat =
        subCategory ||
        payload?.subCategory ||
        payload?.mealType ||
        payload?.detectedMeal ||
        payload?.detectedPrayer ||
        payload?.prayer ||
        payload?.doaTime ||
        payload?.sandhyaTime ||
        '';

      // If switching between Islam normal prayers and Halangan on the same date, clear previous ibadah logs first
      if (habitType === 'ibadah' && payload?.overwritePreviousMode) {
        await api.resetHabitForDate(currentStudent.id, 'ibadah', targetDate);
      }

      await api.submitHabit({
        student_id: currentStudent.id,
        habit_type: habitType,
        score,
        payload,
        sub_category: finalSubCat,
        is_counter_entry: isCounter ? 1 : 0,
        is_missed: isMissed ? 1 : 0,
        log_date: targetDate,
      });
      setActiveFormModal(null);
      setModalInitialHalangan(false);
      await fetchTodayHabits();
      if (isPastDate && missedDate) {
        await fetchDateHabits(missedDate);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan kebiasaan');
    } finally {
      setLoading(false);
    }
  };

  // Handle Aktivitas Seru & Kegiatan submit (Section 9: +10 bonus)
  const handleSubmitAktivitasSeru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (seruStory.trim().length < 5) {
      alert('Cerita minimal 5 karakter untuk dapat disimpan.');
      return;
    }
    try {
      setSeruSubmitting(true);
      await api.submitAktivitasSeru({
        student_id: student.id,
        habit_type: seruHabitType,
        activity_title: seruTitle.trim() || `Cerita Seru ${seruHabitType.toUpperCase()}`,
        story_text: seruStory.trim(),
      });
      setSeruTitle('');
      setSeruStory('');
      setSeruFeedback('Cerita Aktivitas Seru berhasil disimpan (+10 Poin Bonus)!');
      setIsSeruModalOpen(false);
      setTimeout(() => setSeruFeedback(''), 4000);
      await fetchTodayHabits();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan Aktivitas Seru');
    } finally {
      setSeruSubmitting(false);
    }
  };

  const handleSubmitPrestasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prestasiForm.nama_prestasi.trim()) {
      alert('Nama prestasi wajib diisi.');
      return;
    }
    try {
      setPrestasiSubmitting(true);
      await api.submitAchievement({
        student_id: currentStudent.id,
        ...prestasiForm,
      });
      setPrestasiFeedback('Pengajuan prestasi berhasil dikirim! Menunggu validasi admin.');
      setIsPrestasiModalOpen(false);
      setPrestasiForm({
        nama_prestasi: '',
        jenis_prestasi: 'Akademik',
        jenjang: 'Sekolah',
        kategori: 'Individu',
        tanggal: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()),
        pencapaian: '',
        cerita: '',
        bukti_url: '',
      });
      await fetchAchievements();
      setTimeout(() => setPrestasiFeedback(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Gagal mengirim pengajuan prestasi');
    } finally {
      setPrestasiSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 3) {
      setPwMsg({ text: 'Kata sandi baru minimal 3 karakter.', type: 'error' });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ text: 'Konfirmasi kata sandi baru tidak cocok.', type: 'error' });
      return;
    }
    setPwLoading(true);
    try {
      const res = await api.changePassword({ currentPassword: currentPw, newPassword: newPw });
      setPwMsg({ text: res.message || 'Kata sandi berhasil diperbarui!', type: 'success' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: any) {
      setPwMsg({ text: err.message || 'Gagal mengubah kata sandi.', type: 'error' });
    } finally {
      setPwLoading(false);
    }
  };

  // Find missed count for past days
  const missedDaysCount = calendarDates.slice(1).filter((d) => !d.isComplete).length;

  const isFemaleIslam =
    student.gender === 'P' && (student.religion || 'Islam').toLowerCase().includes('islam');

  return (
    <div className="min-h-screen bg-kebaya-pattern flex flex-col pb-20 md:pb-6">
      {/* Toast Notification */}
      {themeToast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-lg border border-slate-700 animate-bounce flex items-center gap-2">
          <Palette className="w-4 h-4 text-[#feb52b]" />
          <span>{themeToast}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl text-white flex items-center justify-center font-black text-sm shadow-sm transition-colors"
            style={{ backgroundColor: 'var(--primary-color, #1c5ddc)' }}
          >
            28
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                JAWARA 28
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#1c5ddc] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                VERTIKAL
              </span>
              <span
                className="w-2.5 h-2.5 rounded-full transition-colors"
                style={{ backgroundColor: activeTheme.hex }}
                title={`Tema: ${activeTheme.name}`}
              />
            </div>
            <span className="text-[11px] text-slate-500 hidden sm:block">
              Jagoan Warga Jakarta SMA Negeri 28 Jakarta • 7 KAIH
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-slate-900 block">{student.name}</span>
            <span className="text-[10px] text-slate-500 font-semibold">
              Kelas {currentStudent.class_name} • NISN {currentStudent.nisn || currentStudent.nis}
            </span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Keluar
          </button>
        </div>
      </header>

      {/* Main 3-Column / Responsive Layout */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Fixed / Collapsible Sidebar (Col 1-3 on Desktop) */}
        <aside className="hidden md:block md:col-span-3 lg:col-span-3">
          <div className="sticky top-20 bg-white rounded-2xl border border-slate-200 p-3 shadow-xs space-y-1">
            <div className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
              Menu Murid
            </div>
            {[
              { id: 'beranda' as const, label: 'Beranda', icon: Home },
              {
                id: 'kebiasaanku' as const,
                label: 'Kebiasaanku (Hari Ini)',
                icon: CheckSquare,
                badge: uncompletedHabits.length > 0 ? `${uncompletedHabits.length}` : null,
              },
              {
                id: 'terlewat' as const,
                label: 'Riwayat Pengisian',
                icon: Calendar,
                badge: missedDaysCount > 0 ? `${missedDaysCount} Hari` : null,
              },
              {
                id: 'prestasi' as const,
                label: 'Upload Prestasi',
                icon: Award,
              },
              { id: 'leaderboard' as const, label: 'Leaderboard', icon: Trophy },
              { id: 'profil' as const, label: 'Profil Murid', icon: User },
            ].map((menu) => {
              const Icon = menu.icon;
              const isActive = activeTab === menu.id;
              return (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() => setActiveTab(menu.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  style={{
                    backgroundColor: isActive ? 'var(--primary-color, #1c5ddc)' : undefined,
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{menu.label}</span>
                  </div>
                  {menu.badge && (
                    <span
                      className={`text-[10px] min-w-[20px] h-5 px-1.5 rounded-full font-black flex items-center justify-center ${
                        menu.id === 'kebiasaanku' || menu.id === 'terlewat'
                          ? 'bg-red-600 text-white shadow-xs'
                          : isActive
                          ? 'bg-white text-slate-900'
                          : 'bg-red-600 text-white'
                      }`}
                    >
                      {menu.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Quick SMAN 28 Identity card in sidebar */}
            <div className="pt-4 mt-4 border-t border-slate-100 px-3 space-y-2.5">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">
                  GURU WALAS
                </span>
                <span className="text-xs font-bold text-slate-800 block mt-0.5">
                  {currentStudent.walas_name || 'Belum Ditugaskan'}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {currentStudent.walas_nip ? `NIP ${currentStudent.walas_nip}` : '-'}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">
                  GURU WALI
                </span>
                <span className="text-xs font-bold text-slate-800 block mt-0.5">
                  {currentStudent.wali_name || 'Belum Ditugaskan'}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {currentStudent.wali_nip ? `NIP ${currentStudent.wali_nip}` : '-'}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Center Main Content (Col 4-9 on Desktop, full on tablet/mobile) */}
        <main className="md:col-span-9 lg:col-span-6 space-y-6">
          {/* TAB 1: BERANDA */}
          {activeTab === 'beranda' && (
            <div className="space-y-6">
              {/* Period banner when outside data collection range */}
              {!periodInfo.isInPeriod && (
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-blue-950">
                        Periode Pengambilan Data Karakter 7 KAIH
                      </h4>
                      <p className="text-[11px] text-blue-800">
                        Jadwal pengambilan data sekolah: <strong>{formatIndoDate(periodInfo.startDate)}</strong> s.d. <strong>{formatIndoDate(periodInfo.endDate)}</strong>. Hari ini ({serverTodayDate}) berada di luar jadwal aktif pengisian harian. Pengisian ditutup dan pengingat dinonaktifkan.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Browser notification permission request banner */}
              {notifPermission === 'default' && (
                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-indigo-950">
                        Aktifkan Notifikasi Pengingat Browser
                      </h4>
                      <p className="text-[11px] text-indigo-800">
                        Izinkan notifikasi browser untuk menerima pengingat pengisian 7 KAIH pada pukul 09.00, 12.00, 15.00, dan 20.00 WIB.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRequestNotification}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shrink-0 hover:bg-indigo-700 cursor-pointer shadow-xs"
                  >
                    Aktifkan
                  </button>
                </div>
              )}

              {/* Alert Banner ONLY IF THERE ARE MISSED PAST DATES */}
              {hasAnyMissed && (
                <div
                  onClick={() => setActiveTab('terlewat')}
                  className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 border border-amber-200/80 flex items-center justify-between cursor-pointer hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-amber-950">
                        Ada Jurnal Tanggal Sebelumnya yang Belum Lengkap
                      </h4>
                      <p className="text-[11px] text-amber-800">
                        Terdapat {missedDaysCount} hari di Riwayat Pengisian yang belum lengkap. Klik untuk membuka Formulir Terlewat (Tanpa pengurangan poin).
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-amber-700 shrink-0" />
                </div>
              )}

              {/* Profile Card (Nama, NISN, Kelas, Rombel, Streak, Nilai Capaian, Poin Hebat) */}
              <div
                className="bg-white rounded-3xl p-5 sm:p-6 border shadow-sm relative overflow-hidden transition-all"
                style={{ borderColor: 'var(--theme-soft-border, rgba(28, 93, 220, 0.25))' }}
              >
                <div
                  className="absolute top-0 right-0 w-36 h-36 rounded-bl-full pointer-events-none opacity-40 transition-colors"
                  style={{ backgroundColor: 'var(--theme-tint-bg, rgba(28, 93, 220, 0.05))' }}
                />
                {/* Realtime Date, Clock, and School Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-blue-50/90 to-indigo-50/70 rounded-2xl border border-blue-100 mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#1c5ddc] text-white flex items-center justify-center font-black text-xs shadow-xs">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 capitalize">
                          {formatIndoDate(serverTodayDate)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Jakarta
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Pengisian jurnal tepat hari aktif hingga pukul 23.59 WIB
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-mono text-[#1c5ddc] block leading-none">
                      {currentTime || '00:00:00 WIB'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">Waktu Indonesia Barat</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-14 h-14 rounded-2xl text-white flex items-center justify-center font-black text-2xl shadow-md ring-4 ring-slate-100 transition-colors"
                      style={{ backgroundColor: 'var(--primary-color, #1c5ddc)' }}
                    >
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                          {currentStudent.name}
                        </h2>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-black text-white"
                          style={{ backgroundColor: 'var(--primary-color, #1c5ddc)' }}
                        >
                          Kelas {currentStudent.class_name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-purple-100 text-purple-800 border border-purple-200">
                          Guru Wali: {currentStudent.wali_name || 'Belum Ditugaskan'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        NISN: {currentStudent.nisn || currentStudent.nis} • SMAN 28 Jakarta • Jenjang {currentStudent.angkatan}
                      </p>
                      <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                        Agama: <strong>{currentStudent.religion}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* KPI metrics: Streak, Nilai Capaian, Poin Hebat (Breakdown), Peringkat */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 border-t border-slate-100">
                  <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-100/80 text-center">
                    <span className="text-[10px] font-semibold text-amber-800 flex items-center justify-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-amber-500" /> Streak
                    </span>
                    <span className="text-xl font-black text-amber-950 block mt-0.5">
                      {studentStats?.streak ?? currentStudent.streak ?? 0}
                    </span>
                    <span className="text-[9px] text-amber-700 font-medium">Hari Lengkap (7/7)</span>
                  </div>

                  <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-100/80 text-center">
                    <span className="text-[10px] font-semibold text-[#1c5ddc] flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#1c5ddc]" /> Nilai Capaian
                    </span>
                    <span className="text-xl font-black text-blue-950 block mt-0.5">
                      {`${Number(
                        studentStats?.periodAverage ?? studentStats?.student?.avg_score ?? studentStats?.overallScore ?? currentStudent.avg_score ?? 0
                      ).toFixed(1)}/100`}
                    </span>
                    <span className="text-[9px] text-blue-700 font-medium">Rata-rata All-Time</span>
                  </div>

                  <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-100/80 text-center relative group">
                    <span className="text-[10px] font-semibold text-emerald-800 flex items-center justify-center gap-1">
                      <Award className="w-3.5 h-3.5 text-emerald-500" /> Poin Hebat
                    </span>
                    <span className="text-xl font-black text-emerald-950 block mt-0.5">
                      {currentStudent.poin_hebat ?? studentStats?.poinHebat ?? 0}
                    </span>
                    <span className="text-[9px] text-emerald-700 font-medium block">
                      Hari Ini (Total: +{poinHebatHariIni})
                    </span>
                    <div className="text-[9px] text-emerald-800/80 mt-0.5 font-bold">
                      Kebiasaan ({habitScoresSum}) + Bonus ({bonusPointsToday}) + Streak ({streakBonus})
                    </div>
                  </div>

                  <div className="p-3 bg-purple-50/70 rounded-2xl border border-purple-100/80 text-center">
                    <span className="text-[10px] font-semibold text-purple-800 flex items-center justify-center gap-1">
                      <Trophy className="w-3.5 h-3.5 text-purple-600" /> Peringkat
                    </span>
                    <span className="text-xl font-black text-purple-950 block mt-0.5">
                      #{myRank}
                    </span>
                    <span className="text-[9px] text-purple-700 font-medium">Leaderboard</span>
                  </div>
                </div>
              </div>

              {/* Container Kebiasaan Belum Selesai Hari Ini */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight flex items-center gap-2">
                      <span>Jurnal Kebiasaan Hari Ini</span>
                      {uncompletedHabits.length > 0 && (
                        <span className="w-2 h-2 rounded-full bg-[#eb30a2]" />
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {uncompletedHabits.length > 0
                        ? `Ada ${uncompletedHabits.length} kebiasaan yang belum selesai hari ini (Mode Fleksibel tanpa pengurangan poin).`
                        : 'Luar biasa! Seluruh 7 kebiasaan hari ini berstatus Selesai.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('kebiasaanku')}
                    className="text-xs font-bold hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                    style={{ color: 'var(--primary-color, #1c5ddc)' }}
                  >
                    Semua Kartu (7 KAIH) →
                  </button>
                </div>

                {uncompletedHabits.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {uncompletedHabits.slice(0, 2).map((habit) => {
                      const Icon = habit.icon;
                      const info = getHabitProgressInfo(habit.id, todayLogs, false);
                      return (
                        <div
                          key={habit.id}
                          onClick={() => {
                            setModalInitialHalangan(false);
                            setActiveFormModal(habit.id);
                          }}
                          className="habit-card p-4 rounded-2xl border border-slate-200 bg-white hover:border-[#1c5ddc] cursor-pointer group shadow-xs"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                              style={{ backgroundColor: habit.color }}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                info.status === 'Sedang diisi'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-50 text-amber-800'
                              }`}
                            >
                              {info.status} • {info.currentScore} / 100
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-900 text-sm">{habit.title}</h4>
                          <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-0.5">
                            {habit.subtitle}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center bg-emerald-50/70 rounded-2xl border border-emerald-200">
                    <CheckCircle2 className="w-8 h-8 text-[#19ae5d] mx-auto mb-1.5" />
                    <span className="font-bold text-emerald-900 text-sm block">
                      Semua 7 Kebiasaan Hari Ini Telah Selesai!
                    </span>
                    <span className="text-xs text-emerald-700">
                      Streak harianmu bertambah. Terus pertahankan konsistensi Jawara 28!
                    </span>
                  </div>
                )}
              </div>

              {/* SECTION 9: AKTIVITAS SERU & KEGIATAN HARI INI (Card-First, Modal on Click, 1x Per Day) */}
              {aktivitasSeruList.length === 0 ? (
                <div className="bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-amber-100/50 rounded-3xl p-5 sm:p-6 border border-amber-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                          Aktivitas Seru &amp; Kegiatan Hari Ini
                        </h3>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                          Bonus +10 Poin
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Dibatasi 1 kali pengisian per hari. Pilih kebiasaan dan ceritakan pengalaman positifmu hari ini!
                      </p>
                      {todaySeruCount > 0 && (
                        <p className="text-[11px] text-amber-800 font-bold mt-1">
                          🎉 {todaySeruCount} murid telah mengisi cerita Aktivitas Seru hari ini!
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSeruModalOpen(true)}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-sm transition-all cursor-pointer shrink-0"
                  >
                    Tulis Refleksi Seru (+10 Poin)
                  </button>
                </div>
              ) : (
                <div className="bg-emerald-50/80 border border-emerald-300 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                            Aktivitas Seru Hari Ini Selesai
                          </h3>
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                            +10 Poin Masuk
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          Pengisian dibatasi 1 kali per hari ({formatIndoDate(serverTodayDate)}). Terima kasih atas partisipasimu!
                        </p>
                      </div>
                    </div>
                    {todaySeruCount > 0 && (
                      <span className="text-xs font-bold text-slate-500 hidden sm:inline">
                        {todaySeruCount} Murid Mengisi Hari Ini
                      </span>
                    )}
                  </div>
                  <div className="p-3 bg-white rounded-2xl border border-emerald-200 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">
                        {aktivitasSeruList[0].activity_title || 'Refleksi Harian'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold uppercase">
                        {aktivitasSeruList[0].habit_type}
                      </span>
                    </div>
                    <p className="text-slate-600 italic whitespace-pre-wrap break-words max-h-48 overflow-y-auto pr-1">
                      &quot;{aktivitasSeruList[0].story_text || aktivitasSeruList[0].story}&quot;
                    </p>
                  </div>
                </div>
              )}

              {/* Container Ringkasan Rapor memuat: Ulasan guru & Capaian Skor Keseluruhan (%) */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight">
                    Ringkasan Rapor Pembiasaan
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('profil')}
                    className="text-xs font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    style={{ color: 'var(--primary-color, #1c5ddc)' }}
                  >
                    Buka Rapor Lengkap <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1 p-4 rounded-2xl bg-gradient-to-b from-blue-50/80 to-white border border-blue-100 text-center flex flex-col justify-center items-center">
                    <span className="text-xs text-slate-500 font-semibold">Nilai Capaian</span>
                    <span
                      className="text-2xl font-black my-1"
                      style={{ color: 'var(--primary-color, #1c5ddc)' }}
                    >
                      {studentStats?.overallScore ? `${studentStats.overallScore} / 100` : '0 / 100'}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                      Poin Hebat: +{studentStats?.poinHebat ?? student.poin_hebat ?? 0}
                    </span>
                  </div>
                  <div className="sm:col-span-2 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Ulasan Guru Walas ({student.walas_name}):
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 italic">
                      "{student.walas_notes || 'Belum ada ulasan catatan dari wali kelas.'}"
                    </p>
                    {student.walas_recommendation && (
                      <p className="text-[11px] text-[#1c5ddc] font-medium pt-1 border-t border-slate-200">
                        <strong>Rekomendasi:</strong> {student.walas_recommendation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: KEBIASAANKU (7 Cards Grid -> Form when clicked; NO +/- counter buttons!) */}
          {activeTab === 'kebiasaanku' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Jurnal 7 Kebiasaan Hari Ini ({serverTodayDate})
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Pengisian Tepat Hari &amp; Fleksibel sebelum pukul 00.00 WIB tanpa pengurangan poin. Kartu berstatus Selesai berubah hijau dan terkunci.
                  </p>
                </div>
              </div>

              {!periodInfo.isInPeriod && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <strong>Peringatan Periode Pengambilan Data:</strong> Hari ini ({serverTodayDate}) berada di luar jadwal aktif sekolah ({formatIndoDate(periodInfo.startDate)} s.d. {formatIndoDate(periodInfo.endDate)}).
                  </div>
                </div>
              )}

              {/* 7 Habit Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                {HABIT_CARDS.map((habit) => {
                  const Icon = habit.icon;
                  const info = getHabitProgressInfo(habit.id, todayLogs, false);
                  const isCompleted = info.status === 'Selesai';
                  const isHalanganActive = habit.id === 'ibadah' && isHalanganOnLogs(todayLogs);

                  return (
                    <div
                      key={habit.id}
                      className={`habit-card rounded-3xl p-5 border transition-all flex flex-col justify-between ${
                        isCompleted
                          ? 'bg-emerald-50 border-emerald-500 shadow-sm ring-2 ring-emerald-400/30'
                          : info.status === 'Sedang diisi'
                          ? 'bg-white border-blue-300 hover:border-[#1c5ddc]'
                          : 'bg-white border-slate-200 hover:border-[#1c5ddc]'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
                            style={{ backgroundColor: isCompleted ? '#19ae5d' : habit.color }}
                          >
                            <Icon className="w-5 h-5" />
                          </div>

                          {/* 4 Official Status Badges + Score Fraction */}
                          <div className="flex flex-col items-end gap-1">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-900 bg-emerald-200 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                                <Lock className="w-3 h-3 text-emerald-800" /> Selesai &amp; Terkunci
                              </span>
                            ) : info.status === 'Sedang diisi' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full">
                                <Clock className="w-3 h-3" /> Sedang diisi ({info.sessionCount}/{info.maxSessions})
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                                Belum dimulai
                              </span>
                            )}
                            <span className="text-[11px] font-black text-slate-700">
                              Nilai: {info.currentScore} / 100
                            </span>
                          </div>
                        </div>

                        <h4 className="font-extrabold text-slate-900 text-base">{habit.title}</h4>
                        <p className="text-xs font-medium text-slate-500 mb-1">{habit.subtitle}</p>
                        <p className="text-[11px] text-slate-400 mb-3 line-clamp-1">{habit.desc}</p>

                        {/* ADDENDUM B: Inline Female Muslim "Saya sedang berhalangan" toggle directly on Beribadah card */}
                        {habit.id === 'ibadah' && isFemaleIslam && (
                          <div className="mb-3 p-3 rounded-2xl bg-pink-50/90 border border-pink-200 space-y-1.5">
                            <label className="flex items-center justify-between gap-2 cursor-pointer">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isHalanganActive}
                                  disabled={isCompleted}
                                  onChange={() => {
                                    setModalInitialHalangan(true);
                                    setActiveFormModal('ibadah');
                                  }}
                                  className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500"
                                />
                                <span className="text-xs font-extrabold text-pink-950">
                                  Saya sedang berhalangan
                                </span>
                              </div>
                              <span className="text-[10px] font-black text-pink-800 bg-pink-100 px-2 py-0.5 rounded-full">
                                {isHalanganActive
                                  ? `${info.halanganCheckedCount || 0}/5 komponen • ${info.currentScore}/100`
                                  : '5 Komponen @ 20 Poin'}
                              </span>
                            </label>
                            <p className="text-[10px] text-pink-800 leading-snug">
                              Menggantikan 5 kartu shalat wajib dengan 5 amalan pengganti (Dzikir, Muraja&apos;ah, Sedekah, Kajian, Kebersihan Diri).
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Bottom Action Bar (No + / - buttons!) */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-500">
                          {habit.isMulti
                            ? isHalanganActive
                              ? `Amalan Pengganti: ${info.sessionCount} / 5`
                              : `Progres Sesi: ${info.sessionCount} / ${info.maxSessions}`
                            : `Capaian: ${info.currentScore} / 100`}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isCompleted}
                            onClick={() => {
                              if (isCompleted) return;
                              setModalInitialHalangan(isHalanganActive);
                              setActiveFormModal(habit.id);
                            }}
                            className={`btn-interactive px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                              isCompleted
                                ? 'bg-[#19ae5d] text-white font-extrabold cursor-default opacity-90 shadow-xs flex items-center gap-1.5'
                                : 'bg-[#1c5ddc] text-white hover:bg-blue-700 shadow-xs cursor-pointer'
                            }`}
                          >
                            {isCompleted ? (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>Selesai &amp; Terkunci</span>
                              </>
                            ) : info.status === 'Sedang diisi' ? (
                              'Lanjutkan Pengisian'
                            ) : (
                              'Buka Formulir'
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: RIWAYAT PENGISIAN & FORMULIR TERLEWAT (NO -5 PENALTY!) */}
          {activeTab === 'terlewat' && (
            <div className="space-y-6">
              {/* Header Box */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-amber-600" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-full">
                        Riwayat Pengisian &amp; Formulir Terlewat
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                      Riwayat Pengisian Jurnal 7 KAIH
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Jadwal Periode: <strong>{formatIndoDate(periodInfo.startDate)}</strong> s.d. <strong>{formatIndoDate(periodInfo.endDate)}</strong>. Kartu hijau sudah berstatus <strong>Selesai (7/7)</strong>, kartu kuning berstatus <strong>Belum Lengkap</strong> dan dapat dilengkapi menggunakan <strong>Formulir Terlewat</strong>, kartu abu-abu adalah tanggal mendatang.
                    </p>
                  </div>
                </div>

                {/* Interactive Multi-Date Calendar Strip */}
                <div className="space-y-2 pt-2 border-t border-amber-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-700" />
                      Pilih Tanggal Riwayat:
                    </span>
                    <span className="text-[11px] text-slate-600">
                      Tanggal Jurnal Terpilih: <strong>{missedDate || 'Belum dipilih'}</strong>
                    </span>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-2 pt-1">
                    {calendarDates.map((dItem) => {
                      const isSelected = missedDate === dItem.date;
                      const isFuture = Boolean(dItem.isFuture || dItem.date > serverTodayDate);
                      const isToday = Boolean(dItem.isToday || dItem.date === serverTodayDate);
                      const isComplete = Boolean(dItem.isComplete || dItem.completedCount >= 7);

                      let cardStyle = '';
                      let badgeStyle = '';
                      let badgeLabel = '';

                      if (isFuture) {
                        // Tanggal belum dilewati: abu-abu dan terkunci nonaktif
                        cardStyle = 'bg-slate-100 border-slate-200 text-slate-400 opacity-50 cursor-not-allowed';
                        badgeStyle = 'bg-slate-200 text-slate-500';
                        badgeLabel = 'Terkunci';
                      } else if (isToday) {
                        // Tanggal hari ini: warna card hijau
                        cardStyle = 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold';
                        badgeStyle = 'bg-emerald-200 text-emerald-900 font-extrabold';
                        badgeLabel = 'Hari Ini';
                      } else if (isComplete) {
                        // Tanggal terlewat & lengkap: warna hijau
                        cardStyle = 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold';
                        badgeStyle = 'bg-emerald-200 text-emerald-900 font-extrabold';
                        badgeLabel = '✓ Lengkap (7/7)';
                      } else {
                        // Tanggal terlewat & belum lengkap: warna merah
                        cardStyle = 'bg-rose-100 border-rose-400 text-rose-950 font-bold';
                        badgeStyle = 'bg-rose-200 text-rose-900 font-extrabold';
                        badgeLabel = `${7 - dItem.completedCount} Belum Diisi`;
                      }

                      return (
                        <button
                          key={dItem.date}
                          type="button"
                          disabled={isFuture}
                          onClick={() => {
                            if (!isFuture) setMissedDate(dItem.date);
                          }}
                          className={`flex-shrink-0 p-3 rounded-2xl border text-center transition-all min-w-[102px] ${
                            isSelected
                              ? 'ring-2 ring-slate-900 shadow-md scale-102'
                              : 'hover:scale-101'
                          } ${cardStyle} ${isFuture ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <span className="text-[10px] font-bold block opacity-75">
                            {isToday ? 'Hari Ini' : dItem.dayName}
                          </span>
                          <span className="text-sm font-black block my-0.5">
                            {dItem.formattedDate}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold inline-block ${badgeStyle}`}>
                            {badgeLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {missedDate && (
                  <div className="p-3 bg-white/90 border border-amber-200 rounded-xl text-xs text-slate-700 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>Aturan Penilaian:</strong> Melengkapi jurnal melalui <strong>Formulir Terlewat</strong> pada tanggal <strong>{missedDate}</strong> dinilai penuh sesuai komponen aktual <strong>tanpa pengurangan poin</strong>.
                    </span>
                  </div>
                )}
              </div>

              {/* SECTION: Content based on selected date type */}
              {!missedDate ? (
                <div className="bg-white border-2 border-dashed border-amber-300 rounded-3xl p-10 text-center space-y-3 shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    Silakan pilih tanggal dari card diatas
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Pilih tanggal yang ingin Anda tinjau atau lengkapi pada daftar kartu tanggal di atas.
                  </p>
                </div>
              ) : missedDate === serverTodayDate ? (
                /* Tanggal Sekarang/Hari ini: JANGAN menampilkan 7 kartu kebiasaan, tampilkan tombol "Ayo Isi kebiasaanku" */
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100 border-2 border-emerald-300 rounded-3xl p-8 text-center space-y-4 shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-[#19ae5d] text-white flex items-center justify-center mx-auto shadow-md">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <div className="max-w-md mx-auto">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">
                      Pengisian Jurnal Hari Ini ({formatIndoDate(serverTodayDate)})
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Pengisian kebiasaan hari ini hanya dapat dilakukan melalui menu utama <strong>Kebiasaanku (Hari Ini)</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('kebiasaanku')}
                    className="btn-interactive px-6 py-3 rounded-xl bg-[#1c5ddc] hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
                  >
                    <span>Ayo Isi Kebiasaanku</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* Tanggal yg sudah terlewat: Lengkap = Hijau & Terkunci, Belum Lengkap = Merah dengan Formulir Terlewat */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        Jurnal 7 Kebiasaan — {formatIndoDate(missedDate)}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {HABIT_CARDS.every((h) => getHabitProgressInfo(h.id, selectedDateLogs, true).status === 'Selesai')
                          ? 'Status tanggal ini: Lengkap (7/7) dan terkunci.'
                          : 'Status tanggal ini: Belum lengkap. Buka kartu kebiasaan merah untuk melengkapi.'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                    {HABIT_CARDS.map((habit) => {
                      const Icon = habit.icon;
                      const info = getHabitProgressInfo(habit.id, selectedDateLogs, true);
                      const isCompleteOnDate = info.status === 'Selesai';
                      const isHalanganOnDate = habit.id === 'ibadah' && isHalanganOnLogs(selectedDateLogs);

                      return (
                        <div
                          key={`missed-card-${habit.id}`}
                          className={`habit-card rounded-3xl p-5 border shadow-xs transition-all flex flex-col justify-between ${
                            isCompleteOnDate
                              ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-300'
                              : 'bg-rose-50 border-rose-300 hover:border-rose-400'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between mb-3">
                              <div
                                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
                                style={{ backgroundColor: isCompleteOnDate ? '#19ae5d' : '#e11d48' }}
                              >
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span
                                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                                    isCompleteOnDate
                                      ? 'bg-emerald-200 text-emerald-900 border border-emerald-300'
                                      : 'bg-rose-200 text-rose-900 border border-rose-300'
                                  }`}
                                >
                                  {isCompleteOnDate ? '✓ Selesai & Terkunci' : 'Belum Diisi'}
                                </span>
                                <span className="text-[11px] font-black text-slate-700">
                                  Nilai: {info.currentScore} / 100
                                </span>
                              </div>
                            </div>

                            <h4 className="font-extrabold text-slate-900 text-base">{habit.title}</h4>
                            <p className="text-xs font-medium text-slate-500 mb-1">{habit.subtitle}</p>
                            <p className="text-[11px] text-slate-400 mb-3">{habit.desc}</p>
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-500">
                              {isCompleteOnDate ? 'Tercatat di Database' : 'Belum Terisi'}
                            </span>

                            {isCompleteOnDate ? (
                              <span
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#19ae5d] text-white flex items-center gap-1.5 shadow-xs"
                              >
                                <Lock className="w-3.5 h-3.5" /> Selesai
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setModalInitialHalangan(isHalanganOnDate);
                                  setActiveFormModal(habit.id);
                                }}
                                className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
                              >
                                <span>Buka Formulir Terlewat</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: PRESTASI MURID & UPLOAD HASIL (Section 8, 10, 11) */}
          {activeTab === 'prestasi' && (
            <div className="space-y-6">
              {/* Header Banner & CTA */}
              <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white">
                      Pencapaian Murid JAWARA 28
                    </span>
                    <span className="text-xs font-semibold text-amber-100">
                      • Validasi Terbuka Admin
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black mt-1">
                    Portofolio &amp; Pengajuan Prestasi
                  </h2>
                  <p className="text-xs text-amber-100 mt-1 max-w-xl">
                    Ajukan bukti capaian kejuaraan, olimpiade, lomba akademik maupun nonakademik. Raih poin tambahan ke Poin Hebat setelah disetujui tim admin sekolah!
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPrestasiModalOpen(true)}
                  className="px-5 py-3 rounded-2xl bg-white text-amber-700 hover:bg-amber-50 font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
                >
                  <Award className="w-4 h-4 text-amber-600" />
                  Ajukan Prestasimu!
                </button>
              </div>

              {prestasiFeedback && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{prestasiFeedback}</span>
                </div>
              )}

              {/* Transparent Rubric Scheme Card (Requirement 10 - Collapsible Details) */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                        Skema Rubrik Penilaian Prestasi
                      </h3>
                      <p className="text-xs text-slate-500">
                        Transparansi rentang poin penghargaan resmi SMAN 28 Jakarta berdasarkan jenjang kejuaraan
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRubricDetail(!showRubricDetail)}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition cursor-pointer border border-amber-200/80 shrink-0 self-start sm:self-auto"
                  >
                    <span>{showRubricDetail ? 'Sembunyikan Skema' : 'Lihat Detail Skema'}</span>
                    {showRubricDetail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {showRubricDetail && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-slate-100">
                    {(achievementRubric.length > 0
                      ? achievementRubric
                      : [
                          { level: 'Sekolah', min_points: 10, max_points: 25, default_points: 15 },
                          { level: 'Kecamatan', min_points: 25, max_points: 40, default_points: 30 },
                          { level: 'Kota-Kabupaten', min_points: 40, max_points: 60, default_points: 50 },
                          { level: 'Provinsi', min_points: 60, max_points: 80, default_points: 70 },
                          { level: 'Nasional', min_points: 80, max_points: 100, default_points: 90 },
                          { level: 'Internasional', min_points: 100, max_points: 150, default_points: 120 },
                        ]
                    ).map((item: any) => (
                      <div
                        key={item.level}
                        className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-center space-y-1 shadow-2xs"
                      >
                        <span className="text-[11px] font-black uppercase text-amber-900 block truncate">
                          {item.level}
                        </span>
                        <span className="text-lg font-black text-amber-700 block">
                          +{item.default_points ?? item.defaultPoints ?? item.min_points ?? item.minPoints ?? 15} pt
                        </span>
                        <span className="text-[10px] text-amber-800/80 font-semibold block">
                          Rentang: {item.min_points ?? item.minPoints ?? 10} – {item.max_points ?? item.maxPoints ?? 25} pt
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Table of Submitted Achievements */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                    Riwayat Pengajuan Prestasiku ({myAchievements.length})
                  </h3>
                </div>

                {myAchievements.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">Belum ada data pengajuan prestasi</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Klik tombol &quot;Ajukan Prestasimu!&quot; di atas untuk mengunggah sertifikat atau bukti kejuaraan.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-extrabold text-[11px]">
                          <th className="pb-3 px-3">Tanggal</th>
                          <th className="pb-3 px-3">Nama Prestasi</th>
                          <th className="pb-3 px-3">Jenis</th>
                          <th className="pb-3 px-3">Jenjang</th>
                          <th className="pb-3 px-3">Kategori</th>
                          <th className="pb-3 px-3">Pencapaian</th>
                          <th className="pb-3 px-3">Status &amp; Poin</th>
                          <th className="pb-3 px-3">Catatan Admin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {myAchievements.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3 font-medium text-slate-600 whitespace-nowrap">
                              {item.tanggal || item.event_date || '-'}
                            </td>
                            <td className="py-3 px-3 font-black text-slate-900">
                              {item.nama_prestasi || item.achievement_name}
                              {(item.bukti_url || item.certificate_url) && (
                                <span className="block text-[10px] text-blue-600 font-medium truncate max-w-[200px]">
                                  Bukti: {item.bukti_url || item.certificate_url}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                                {item.jenis_prestasi || item.achievement_type}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[10px]">
                                {item.jenjang || item.level}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600 font-medium">
                              {item.kategori || item.participation_category}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-800">
                              {item.pencapaian || item.achievement_rank || '-'}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              {String(item.status || '').toLowerCase() === 'approved' ? (
                                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Approved (+{item.points_awarded} pt)
                                </span>
                              ) : String(item.status || '').toLowerCase() === 'rejected' ? (
                                <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-extrabold text-[10px]">
                                  Ditolak
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-extrabold text-[10px] inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  Menunggu Validasi
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-[11px] text-slate-500 italic">
                              {item.admin_notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: LEADERBOARD (Top 10 + Murid Row 11 jika >10) */}
          {activeTab === 'leaderboard' && (
            <LeaderboardTable
              students={liveStudents}
              currentUserId={currentStudent.id}
              hideNis={true}
              viewerRole="STUDENT"
              onSelectStudent={(s) => onOpenReport?.(s.id)}
            />
          )}

          {/* TAB 5: PROFIL MURID & PENGATURAN TEMA */}
          {activeTab === 'profil' && (
            <div className="space-y-6">
              {/* Profile Card Header */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-5">
                <div
                  className="w-20 h-20 rounded-3xl text-white flex items-center justify-center font-black text-3xl shadow-md transition-colors"
                  style={{ backgroundColor: activeTheme.hex }}
                >
                  {currentStudent.name.charAt(0)}
                </div>
                <div className="text-center sm:text-left flex-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                    <h2 className="text-xl font-black text-slate-900">{currentStudent.name}</h2>
                    <span
                      className="text-xs px-2.5 py-0.5 rounded-full font-bold text-white"
                      style={{ backgroundColor: activeTheme.hex }}
                    >
                      Kelas {currentStudent.class_name}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-800 border border-purple-200">
                      Guru Wali: {currentStudent.wali_name || 'Belum Ditugaskan'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    NISN: {currentStudent.nisn || currentStudent.nis} • Agama: {currentStudent.religion} • Jenjang: {currentStudent.angkatan}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Guru Walas: <strong>{currentStudent.walas_name || 'Belum Ditugaskan'}</strong> ({currentStudent.walas_nip ? `NIP ${currentStudent.walas_nip}` : '-'})
                    {currentStudent.wali_name ? ` • Guru Wali: ${currentStudent.wali_name} (${currentStudent.wali_nip ? `NIP ${currentStudent.wali_nip}` : '-'})` : ''}
                  </p>
                </div>
              </div>

              {/* PENGATURAN TEMA WARNA (Card-First with Downward Accordion Expand/Collapse) */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                <div
                  onClick={() => setIsThemeAccordionOpen(!isThemeAccordionOpen)}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xs"
                      style={{ backgroundColor: activeTheme.hex }}
                    >
                      <Palette className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                        Pengaturan Tema Warna Jawara 28
                      </h3>
                      <p className="text-xs text-slate-500">
                        Tema saat ini: <strong>{activeTheme.name}</strong> ({activeTheme.hex})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 text-slate-700 cursor-pointer"
                  >
                    <span>{isThemeAccordionOpen ? 'Ciutkan Pilihan' : 'Ubah Tema Warna'}</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        isThemeAccordionOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>

                {isThemeAccordionOpen && (
                  <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fadeIn">
                    {THEME_OPTIONS.map((theme) => {
                      const isSelected = activeTheme.hex.toLowerCase() === theme.hex.toLowerCase();
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => handleThemeChange(theme.hex)}
                          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'ring-2 ring-slate-900 shadow-md bg-slate-50'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                          style={{
                            borderColor: isSelected ? theme.hex : undefined,
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className="w-7 h-7 rounded-full shadow-inner flex items-center justify-center text-white"
                              style={{ backgroundColor: theme.hex }}
                            >
                              {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 font-bold">
                              {theme.hex}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-extrabold text-slate-900 block">
                              {theme.name}
                            </span>
                            <span className="text-[10px] text-slate-500 block mt-0.5">
                              {theme.tagline}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* UBAH KATA SANDI (Card-First Accordion) */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                <div
                  onClick={() => setIsPwAccordionOpen(!isPwAccordionOpen)}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                        Ubah Kata Sandi Akun
                      </h3>
                      <p className="text-xs text-slate-500">
                        Perbarui kata sandi untuk keamanan akun portal belajarmu
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                  >
                    <ChevronRight className={`w-4 h-4 transition-transform ${isPwAccordionOpen ? 'rotate-90' : ''}`} />
                  </button>
                </div>

                {isPwAccordionOpen && (
                  <form onSubmit={handleChangePassword} className="space-y-3 pt-2 border-t border-slate-100">
                    {pwMsg && (
                      <div
                        className={`p-3 rounded-xl text-xs font-bold ${
                          pwMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {pwMsg.text}
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Kata Sandi Saat Ini (Opsional jika baru pertama login):
                      </label>
                      <input
                        type="password"
                        value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)}
                        placeholder="Ketik kata sandi lama..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1c5ddc] outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Kata Sandi Baru:
                        </label>
                        <input
                          type="password"
                          required
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                          placeholder="Minimal 3 karakter..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1c5ddc] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Konfirmasi Kata Sandi Baru:
                        </label>
                        <input
                          type="password"
                          required
                          value={confirmPw}
                          onChange={(e) => setConfirmPw(e.target.value)}
                          placeholder="Ketik ulang kata sandi baru..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1c5ddc] outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={pwLoading}
                      className="px-5 py-2.5 rounded-xl bg-[#1c5ddc] hover:bg-blue-700 text-white font-bold text-xs shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {pwLoading ? 'Menyimpan...' : 'Perbarui Kata Sandi'}
                    </button>
                  </form>
                )}
              </div>

              {/* STATISTIK 2 JENIS: Realtime Hari Ini vs Sepanjang Waktu (All-Time) */}
              <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setStatsViewMode('today')}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    statsViewMode === 'today'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Statistik Hari Ini (Realtime)
                </button>
                <button
                  type="button"
                  onClick={() => setStatsViewMode('all_time')}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    statsViewMode === 'all_time'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  Statistik Sepanjang Waktu (All-Time)
                </button>
              </div>

              {/* STATISTIK LAYOUT URUTAN:
                  Mobile: 1. Gauge, 2. Radar/Jaring, 3. Progress, 4. Trend, 5. Table, 6. Catatan Walas
                  Desktop: Row 1 (Gauge & Radar), Row 2 (Progress), Row 3 (Trend), Row 4 (Table), Row 5 (Catatan)
              */}
              {(() => {
                const todayHabitMetrics = HABIT_CARDS.map((h) => {
                  const info = getHabitProgressInfo(h.id, todayLogs, false);
                  return {
                    habit: h.id,
                    label: h.title,
                    studentScore: info.currentScore || 0,
                    classAvg: 85,
                    schoolAvg: 80,
                  };
                });
                const todayOverall = Math.round(
                  todayHabitMetrics.reduce((acc, m) => acc + m.studentScore, 0) / 7
                );

                const activeMetrics =
                  statsViewMode === 'today' ? todayHabitMetrics : (studentStats?.habitMetrics || []);
                const activeOverallScore =
                  statsViewMode === 'today'
                    ? todayOverall
                    : Number(studentStats?.periodAverage ?? studentStats?.student?.avg_score ?? studentStats?.overallScore ?? 0);

                return (
                  <div className="space-y-6">
                    {/* 1 & 2: Gauge & Radar (On mobile: Gauge rendered first, then Radar; on desktop: 2 cols side-by-side) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Gauge Chart */}
                      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-center">
                        <GaugeChart
                          score={activeOverallScore}
                          title={
                            statsViewMode === 'today'
                              ? 'Capaian Rata-Rata Hari Ini'
                              : 'Nilai Capaian Sepanjang Waktu (Maks 100)'
                          }
                          size={240}
                        />
                      </div>

                      {/* Radar / Jaring Chart */}
                      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700">
                            Grafik Jaring 7 KAIH
                          </h4>
                          <span className="text-[10px] font-bold text-slate-500">
                            {statsViewMode === 'today' ? 'Kondisi Hari Ini' : 'Akumulasi All-Time'}
                          </span>
                        </div>
                        <RadarChart
                          data={activeMetrics.map((m: any) => ({
                            habit: m.habit,
                            label: m.label,
                            score:
                              statsViewMode === 'today'
                                ? Number(m.studentScore || 0)
                                : Number(m.periodScore ?? m.studentScore ?? 0),
                          }))}
                          size={280}
                        />
                      </div>
                    </div>

                    {/* 3: Grafik Perkembangan Murid */}
                    <StudentProgressChart
                      series={progressSeries}
                      title="Grafik Perkembangan Harian (7 Kebiasaan & Rata-rata 14 Hari)"
                    />

                    {/* 4: Trend Garis Komparasi */}
                    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
                      <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 mb-1">
                        Grafik Komparasi Capaian 7 KAIH
                      </h4>
                      <p className="text-xs text-slate-500 mb-3">
                        Perbandingan Capaian Murid ({statsViewMode === 'today' ? 'Hari Ini' : 'Sepanjang Waktu'}) vs Target Rata-Rata Kelas &amp; Sekolah
                      </p>
                      <TrendLineChart metrics={activeMetrics} />
                    </div>

                    {/* 5: Tabel Rincian Metrik Lengkap 7 KAIH */}
                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                      <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 flex items-center justify-between">
                        <span>
                          Rincian Metrik 7 KAIH — {statsViewMode === 'today' ? 'Hari Ini' : 'Sepanjang Waktu'}
                        </span>
                        <span className="text-[11px] font-black text-slate-500">
                          Rata-rata: {activeOverallScore} / 100
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50/60 text-slate-500 font-semibold border-b border-slate-100">
                            <tr>
                              <th className="py-2.5 px-4">Kebiasaan</th>
                              <th className="py-2.5 px-4 text-center">Nilai Saya</th>
                              <th className="py-2.5 px-4 text-center">Rata-rata Kelas</th>
                              <th className="py-2.5 px-4 text-center">Rata-rata Sekolah</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activeMetrics.map((m: any) => (
                              <tr key={m.habit}>
                                <td className="py-2.5 px-4 font-bold text-slate-800">{m.label}</td>
                                <td className="py-2.5 px-4 text-center font-black text-[#1c5ddc]">
                                  {m.studentScore} / 100
                                </td>
                                <td className="py-2.5 px-4 text-center text-slate-600">
                                  {m.classAvg} / 100
                                </td>
                                <td className="py-2.5 px-4 text-center text-slate-600">
                                  {m.schoolAvg} / 100
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 6: Catatan & Rekomendasi Walas */}
                    <div className="bg-amber-50/60 rounded-3xl p-5 border border-amber-200/80 space-y-3">
                      <h4 className="font-extrabold text-sm text-amber-950 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        Catatan &amp; Rekomendasi Guru Walas ({student.walas_name})
                      </h4>
                      <div className="p-3 bg-white rounded-2xl border border-amber-200 text-xs text-slate-700">
                        <strong className="block text-slate-900 mb-0.5">Catatan Evaluasi:</strong>
                        {student.walas_notes || 'Belum ada catatan tertulis dari wali kelas.'}
                      </div>
                      <div className="p-3 bg-white rounded-2xl border border-amber-200 text-xs text-slate-700">
                        <strong className="block text-slate-900 mb-0.5">Rekomendasi Tindak Lanjut:</strong>
                        {student.walas_recommendation || 'Belum ada rekomendasi tertulis dari wali kelas.'}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </main>

        {/* Right Column: Quotes & Announcements with Realtime Clock & Date (Hidden on Mobile) */}
        <aside className="hidden lg:block lg:col-span-3 space-y-5">
          {/* Realtime Clock & Date Container */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Waktu &amp; Tanggal
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Realtime
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {currentTime || '00:00:00 WIB'}
            </div>
            <div className="text-xs font-bold text-[#1c5ddc]">
              {formatIndoDate(serverTodayDate)}
            </div>
            <p className="text-[11px] text-slate-400 leading-snug pt-1 border-t border-slate-100">
              SMAN 28 Jakarta • Pengisian tepat hari ditutup otomatis pukul 00.00 WIB.
            </p>
          </div>

          {/* Pengumuman & Quotes Jawara 28 */}
          <div className="bg-gradient-to-br from-blue-50/80 via-white to-amber-50/60 rounded-3xl p-5 border border-blue-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <Quote className="w-4 h-4 text-[#1c5ddc]" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Kata Bijak &amp; Pengumuman
              </h4>
            </div>

            {announcements && announcements.length > 0 ? (
              <div className="space-y-2.5">
                {announcements.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white/95 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-[#1c5ddc] uppercase tracking-wide">
                        {item.title}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          item.type === 'QUOTE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.type === 'QUOTE' ? 'Quote' : 'Info'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700 italic leading-relaxed">
                      &quot;{item.content}&quot;
                    </p>
                    {item.author && (
                      <span className="text-[10px] font-semibold text-slate-400 block text-right">
                        — {item.author}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
                Belum ada pengumuman terbaru.
              </div>
            )}
          </div>

          {/* Notification Opt-in Prompt */}
          {isNotificationSupported() && notifPermission !== 'granted' && (
            <div className="bg-white rounded-3xl p-4 border border-indigo-200 shadow-xs space-y-2">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-900">Notifikasi Pengingat 7 KAIH</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Dapatkan notifikasi otomatis pada pukul 09.00, 12.00, 15.00, dan 20.00 WIB.
              </p>
              <button
                type="button"
                onClick={async () => {
                  const ok = await requestNotificationPermission();
                  setNotifPermission(ok ? 'granted' : 'denied');
                }}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Aktifkan Notifikasi
              </button>
            </div>
          )}

          {/* Prinsip Jawara 28 */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-5 border border-amber-200 shadow-xs">
            <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block mb-1">
              Prinsip Jawara 28
            </span>
            <h5 className="font-extrabold text-xs text-amber-950 mb-1">
              &quot;Karakter Unggul Dibentuk dari Kebiasaan Kecil yang Konsisten&quot;
            </h5>
            <p className="text-[11px] text-amber-800/80 leading-relaxed">
              Nilai Capaian harian maksimal 100. Poin bonus tambahan yang melampaui 100 otomatis tersimpan ke dalam Poin Hebat mingguan!
            </p>
          </div>
        </aside>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-2 flex items-center justify-around shadow-lg">
        {[
          { id: 'beranda' as const, label: 'Beranda', icon: Home },
          {
            id: 'kebiasaanku' as const,
            label: 'Hari Ini',
            icon: CheckSquare,
            badge: uncompletedHabits.length > 0 ? `${uncompletedHabits.length}` : null,
          },
          {
            id: 'terlewat' as const,
            label: 'Riwayat',
            icon: Calendar,
            badge: missedDaysCount > 0 ? `${missedDaysCount}` : null,
          },
          { id: 'prestasi' as const, label: 'Prestasi', icon: Award },
          { id: 'leaderboard' as const, label: 'Peringkat', icon: Trophy },
          { id: 'profil' as const, label: 'Profil', icon: User },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center min-w-[50px] min-h-[48px] rounded-xl text-[10px] font-bold transition-all relative ${
                isActive ? 'text-[#1c5ddc]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="absolute top-1 right-1.5 min-w-[16px] h-4 px-1 bg-red-600 text-white text-[9px] rounded-full flex items-center justify-center font-black shadow-xs">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Clean Single-Modal Container for Habit Check-In */}
      {activeFormModal && (
        <HonestyCheckInModal
          habitId={activeFormModal}
          studentReligion={student.religion}
          studentGender={student.gender}
          todayLogs={activeTab === 'terlewat' ? selectedDateLogs : todayLogs}
          isMissedEntry={activeTab === 'terlewat'}
          targetDate={activeTab === 'terlewat' ? missedDate : undefined}
          initialHalangan={modalInitialHalangan}
          prayerSchedule={prayerSchedule as any}
          isPuasaSunnah={isFastingOnLogs(activeTab === 'terlewat' ? selectedDateLogs : todayLogs)}
          onSuccess={(score, payload, isMulti, subCategory) =>
            handleHabitSubmit(activeFormModal, score, payload, isMulti, subCategory)
          }
          onCancel={() => {
            setActiveFormModal(null);
            setModalInitialHalangan(false);
          }}
        />
      )}

      {/* Modal Rincian Jawaban Instrumen Murid (Database SQLite) */}
      {inspectAnswerModal && (
        <HabitAnswersModal
          studentId={currentStudent.id}
          studentName={currentStudent.name}
          habitCode={inspectAnswerModal.habitCode}
          habitTitle={inspectAnswerModal.habitTitle}
          logDate={inspectAnswerModal.logDate}
          onClose={() => setInspectAnswerModal(null)}
        />
      )}

      {/* POPUP MODAL: Aktivitas Seru & Refleksi Hari Ini (1x Per Hari) */}
      {isSeruModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSeruModalOpen(false);
          }}
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Aktivitas Seru &amp; Refleksi Hari Ini
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                      Bonus +10 Poin Hebat
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      • 1 kali per hari ({formatIndoDate(serverTodayDate)})
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSeruModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAktivitasSeru} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilih Kebiasaan yang Kamu Ceritakan:
                </label>
                <select
                  value={seruHabitType}
                  onChange={(e) => setSeruHabitType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1c5ddc] outline-hidden cursor-pointer"
                >
                  <option value="bangun">Bangun Pagi — Disiplin &amp; Kesiapan Diri</option>
                  <option value="ibadah">Beribadah — Spiritual &amp; Refleksi Diri</option>
                  <option value="olahraga">Berolahraga — Kebugaran &amp; Aktivitas Fisik</option>
                  <option value="makan">Makan Bergizi — Pola Makan Sehat &amp; Air Putih</option>
                  <option value="belajar">Gemar Belajar — Eksplorasi &amp; Literasi</option>
                  <option value="masyarakat">Bermasyarakat — Aksi Sosial &amp; Gotong Royong</option>
                  <option value="tidur">Tidur Cepat — Istirahat Teratur</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Judul Kegiatan / Topik Seru:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Belajar Kelompok Matematika di Perpustakaan / Lari Pagi 20 Menit"
                  value={seruTitle}
                  onChange={(e) => setSeruTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1c5ddc] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cerita Pengalaman / Nilai Positif yang Didapat (Min 10 Karakter):
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Tuliskan pengalamanmu, apa yang kamu rasakan, atau hikmah positif dari kebiasaan ini..."
                  value={seruStory}
                  onChange={(e) => setSeruStory(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1c5ddc] outline-hidden break-words resize-y whitespace-pre-wrap"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {seruStory.trim().length}/10 karakter minimal.
                </span>
              </div>

              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Refleksi seru ini hanya bisa diisi <strong>1 kali sehari</strong> dan akan menambahkan <strong>+10 Poin Hebat</strong> ke profilmu hari ini.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSeruModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={seruSubmitting || seruStory.trim().length < 10}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {seruSubmitting ? (
                    'Menyimpan...'
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Kirim Cerita (+10 Poin)
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL: Ajukan Prestasimu (Section 8, 11) */}
      {isPrestasiModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPrestasiModalOpen(false);
          }}
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Ajukan Prestasimu!
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Isi formulir prestasi &amp; sertifikat untuk dinilai tim admin sekolah
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrestasiModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPrestasi} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Prestasi:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Olimpiade Sains Nasional (OSN) Bidang Fisika"
                  value={prestasiForm.nama_prestasi}
                  onChange={(e) => setPrestasiForm({ ...prestasiForm, nama_prestasi: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1c5ddc] outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jenis Prestasi:
                  </label>
                  <select
                    value={prestasiForm.jenis_prestasi}
                    onChange={(e) => setPrestasiForm({ ...prestasiForm, jenis_prestasi: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1c5ddc] outline-hidden cursor-pointer"
                  >
                    <option value="Akademik">Akademik</option>
                    <option value="Nonakademik">Nonakademik</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jenjang:
                  </label>
                  <select
                    value={prestasiForm.jenjang}
                    onChange={(e) => setPrestasiForm({ ...prestasiForm, jenjang: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1c5ddc] outline-hidden cursor-pointer"
                  >
                    <option value="Sekolah">Sekolah</option>
                    <option value="Kecamatan">Kecamatan</option>
                    <option value="Kota-Kabupaten">Kota-Kabupaten</option>
                    <option value="Provinsi">Provinsi</option>
                    <option value="Nasional">Nasional</option>
                    <option value="Internasional">Internasional</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kategori Peserta:
                  </label>
                  <select
                    value={prestasiForm.kategori}
                    onChange={(e) => setPrestasiForm({ ...prestasiForm, kategori: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1c5ddc] outline-hidden cursor-pointer"
                  >
                    <option value="Individu">Individu / Mandiri</option>
                    <option value="Beregu">Beregu / Tim</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Perolehan:
                  </label>
                  <input
                    type="date"
                    required
                    value={prestasiForm.tanggal}
                    onChange={(e) => setPrestasiForm({ ...prestasiForm, tanggal: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1c5ddc] outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pencapaian:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Juara 1 Medali Emas / Harapan 1 / Finalis Terbaik"
                  value={prestasiForm.pencapaian}
                  onChange={(e) => setPrestasiForm({ ...prestasiForm, pencapaian: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1c5ddc] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ceritakan Prestasimu:
                </label>
                <textarea
                  rows={3}
                  placeholder="Ceritakan proses perjuanganmu, persiapan, atau pengalaman berharga saat mengikuti kejuaraan..."
                  value={prestasiForm.cerita}
                  onChange={(e) => setPrestasiForm({ ...prestasiForm, cerita: e.target.value })}
                  className="w-full p-3.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1c5ddc] outline-hidden resize-y"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Link Bukti / File Sertifikat (Opsional):
                </label>
                <input
                  type="text"
                  placeholder="Contoh: https://drive.google.com/... atau nomor SK sertifikat"
                  value={prestasiForm.bukti_url}
                  onChange={(e) => setPrestasiForm({ ...prestasiForm, bukti_url: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1c5ddc] outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPrestasiModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={prestasiSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {prestasiSubmitting ? (
                    'Mengirim...'
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Ajukan Prestasi
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
