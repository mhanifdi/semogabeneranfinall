/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'siswa' | 'guru' | 'admin';
export type TeacherAssignmentType = 'WALAS' | 'WALI' | 'TIM_7_KAIH' | 'ADMIN';
export type HabitStatus = 'Belum dimulai' | 'Sedang diisi' | 'Selesai' | 'Belum diisi/terlewat';

export interface Student {
  id: string;
  user_id?: string;
  nisn: string;
  nis?: string;
  name: string;
  full_name?: string;
  gender: 'L' | 'P';
  class_name: string;
  class_id?: string;
  rombel_name: string;
  rombel_id?: string;
  angkatan: string;
  cohort_id?: string;
  religion: 'Islam' | 'Kristen' | 'Katolik' | 'Hindu';
  avatar_seed?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  student_status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  account_status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  is_demo?: number | boolean;
  password?: string;
  walas_name: string;
  walas_nip: string;
  wali_name?: string;
  wali_nip?: string;
  walas_notes: string;
  walas_recommendation: string;
  total_entries?: number;
  avg_score?: number; // Nilai Capaian Rata-rata (0-100)
  avgScore?: number;
  poin_hebat?: number; // Total Poin Hebat (Accumulated / Weekly)
  xp?: number;
  weekly_poin_hebat?: number;
  active_days?: number;
  streak?: number;
  longest_streak?: number;
  verification_score?: number | null;
  verification_count?: number;
  today_status?: HabitStatus;
  today_entries?: number;
  today_completed_habits?: number;
  dailyAverageScore?: number;
  overallDayStatus?: string;
  completedHabitsCount?: number;
}

export interface TeacherAssignment {
  id: string;
  teacher_id: string;
  assignment_type: TeacherAssignmentType;
  class_id?: string | null;
  class_name?: string | null;
  rombel_id?: string | null;
  rombel_name?: string | null;
  valid_from: string;
  valid_until?: string | null;
  is_active: number;
}

export interface Teacher {
  id: string;
  user_id?: string;
  nip: string;
  employee_identifier?: string;
  name: string;
  full_name?: string;
  class_name: string;
  rombel_name?: string;
  subject: string;
  role: string;
  assignment_type?: TeacherAssignmentType;
  assignments?: TeacherAssignment[];
  teacher_status?: 'ACTIVE' | 'INACTIVE';
  is_demo?: number | boolean;
  is_walas?: number | boolean;
  is_wali?: number | boolean;
  is_tim_7_kaih?: number | boolean;
  is_admin?: number | boolean;
  roles_csv?: string;
  password?: string;
}

export interface AdminJournalEntry {
  id: number;
  student_id: string;
  student_name: string;
  class_name: string;
  rombel_name?: string;
  habit_code: string;
  habit_title: string;
  log_date: string;
  final_score: number;
  base_score?: number;
  correction_reason?: string;
  corrected_by?: string;
}

export interface SchoolClass {
  id: string;
  class_code: string;
  class_name: string;
  cohort_id: string;
  angkatan: string;
  walas_teacher_id?: string | null;
  walas_name?: string;
  walas_nip?: string;
  student_count?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

export interface SchoolRombel {
  id: string;
  rombel_code: string;
  rombel_name: string;
  academic_year: string;
  wali_teacher_id?: string | null;
  wali_name?: string;
  wali_nip?: string;
  student_count?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

export interface Cohort {
  id: string;
  cohort_name: string;
  academic_year: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface HabitLog {
  id: number;
  student_id: string;
  journal_id?: string;
  habit_type: 'bangun' | 'ibadah' | 'olahraga' | 'makan' | 'belajar' | 'masyarakat' | 'tidur';
  sub_category?: string;
  log_date: string;
  created_at: string;
  reported_event_time?: string;
  entry_mode?: 'tepat_hari' | 'fleksibel' | 'timestamp' | 'terlewat';
  entry_status?: HabitStatus;
  base_score?: number;
  bonus_score?: number;
  score: number; // Final Nilai Capaian (capped 0-100)
  overflow_bonus_points?: number; // Bonus redirected to Poin Hebat when Nilai Capaian is already 100
  scoring_rule_version_id?: string;
  payload: string;
  is_counter_entry: number;
  is_missed?: number;
  parsedPayload?: any;
  components?: HabitComponentRecord[];
  sessions?: HabitSessionRecord[];
}

export interface HabitSessionRecord {
  id: string;
  habit_entry_id: number;
  session_type: string;
  reported_time: string;
  session_status: string;
  session_score: number;
  raw_answers: string;
  created_at: string;
}

export interface HabitComponentRecord {
  id: string;
  habit_entry_id: number;
  habit_session_id?: string | null;
  component_code: string;
  component_label?: string;
  answer_value: string;
  component_score: number;
  max_component_score: number;
}

export interface AktivitasSeruEntry {
  id: string;
  student_id: string;
  log_date: string;
  habit_type: 'bangun' | 'ibadah' | 'olahraga' | 'makan' | 'belajar' | 'masyarakat' | 'tidur';
  story: string;
  bonus_points: number;
  applied_to_capaian: number;
  applied_to_poin_hebat: number;
  created_at: string;
}

export interface HabitMetricComparison {
  habit: string;
  label: string;
  studentScore: number;
  periodScore?: number;
  classAvg: number;
  rombelAvg?: number;
  angkatanAvg: number;
  schoolAvg: number;
}

export interface HabitSchedule {
  id?: string;
  habit_type?: string;
  sub_category?: string;
  start_time?: string;
  ideal_end_time?: string;
  end_time?: string;
  is_active?: number;
  [key: string]: any;
}

export interface ClassAnalytics {
  className: string;
  groupType?: 'CLASS' | 'ROMBEL';
  teacherName?: string;
  studentCount: number;
  participatingCount: number;
  completedTodayCount?: number;
  inProgressTodayCount?: number;
  notStartedTodayCount?: number;
  classAverage: number;
  completionPercentage?: number;
  statusSummary?: {
    total?: number;
    selesai?: number;
    sedangDiisi?: number;
    belumDimulai?: number;
    belumMulai?: number;
    terlewat?: number;
    completionPct?: number;
  };
  distribution: {
    under70: number;
    between70_79: number;
    between80_89: number;
    between90_95: number;
    between96_100: number;
    noData: number;
  };
  classRadar: {
    habit: string;
    label: string;
    avg_score: number;
  }[];
  dailyTrend?: {
    date: string;
    label?: string;
    avg_score: number;
    completion_pct: number;
  }[];
  students: (Student & {
    today_entries?: number;
    today_status?: HabitStatus;
    today_completed_habits?: number;
  })[];
}

export interface RombelAnalytics extends ClassAnalytics {
  rombelName?: string;
  rombelAverage?: number;
  completionRate?: number;
  participatingToday?: number;
  rombelRadar?: {
    habit: string;
    label: string;
    avg_score: number;
  }[];
  dailyTrend?: {
    date: string;
    label?: string;
    avg_score: number;
    avgScore?: number;
    completion_pct: number;
    completionPct?: number;
  }[];
}

export interface SchoolAnalytics {
  totalStudents: number;
  totalActiveStudents?: number;
  schoolAverage?: number;
  participatingToday?: number;
  participatingStudents: number;
  overallScore: number;
  verifiedResponses: number;
  completionPercentage?: number;
  distribution: {
    under70: number;
    between70_79: number;
    between80_89: number;
    between90_95: number;
    between96_100: number;
  };
  schoolRadar: {
    habit: string;
    label: string;
    avg_score: number;
  }[];
  habitRadar?: {
    habit: string;
    label: string;
    avg_score: number;
  }[];
  habitAverages?: any;
  classes: string[];
  rombels?: string[];
  cohorts?: string[];
  cohortAnalytics?: {
    cohort: string;
    studentCount: number;
    participatingCount: number;
    avgScore: number;
  }[];
}

export interface DashboardWidgetConfig {
  id: string;
  widget_code: string;
  title: string;
  description: string;
  metric_code: string;
  visualization_type: 'CARD' | 'BAR' | 'LINE' | 'RADAR' | 'GAUGE' | 'TABLE';
  chart_type?: string;
  scope_type: 'SCHOOL' | 'CLASS' | 'ROMBEL' | 'STUDENT';
  dashboard_target?: string;
  role_visibility: string; // JSON array or comma-separated roles
  configuration: string;
  display_order: number;
  is_active: number;
  is_visible?: boolean | number;
  updated_by?: string;
  updated_at?: string;
}

export interface DataCorrectionRecord {
  id: string;
  actor_user_id: string;
  actor_name: string;
  target_type: string;
  target_id: string;
  student_id?: string;
  student_name?: string;
  journal_date?: string;
  habit_type?: string;
  before_snapshot: string;
  after_snapshot: string;
  reason: string;
  created_at: string;
}

export type HabitCode = 'bangun' | 'ibadah' | 'olahraga' | 'makan' | 'belajar' | 'masyarakat' | 'tidur';

export type InstrumentInputType = 'CHOICE' | 'RATING' | 'CHECKBOX' | 'RANGE' | 'TEXT';

export interface InstrumentRubricOption {
  label: string;
  score: number;
  description?: string;
}

export interface HabitInstrument {
  id: string;
  habit_code: HabitCode;
  title: string;
  category: string;
  question_text: string;
  input_type: InstrumentInputType;
  max_score: number;
  weight_percentage: number;
  rubric_json: string;
  rubric_options?: InstrumentRubricOption[];
  help_text?: string;
  order_no: number;
  is_active: number | boolean;
  created_at?: string;
  updated_at?: string;
}

