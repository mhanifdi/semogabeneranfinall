/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  UserCheck,
  Layers,
  Database,
  Quote,
  Trash2,
  Edit3,
  Calendar,
  Award,
  Sparkles,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  Search,
  RefreshCw,
  LogOut,
  ExternalLink,
  Plus,
  Sliders,
  Check,
  Clock,
  Heart,
  Activity,
  Utensils,
  GraduationCap,
  Moon,
  Sun,
  Lock,
  Eye,
  BookOpen,
  Sunrise,
  Dumbbell,
  Smile,
  Save,
  HeartHandshake,
  UploadCloud,
  Table as TableIcon,
  FileSpreadsheet,
  RotateCcw,
  FileText,
  MessageSquare,
} from 'lucide-react';
import {
  Student,
  Teacher,
  TeacherAssignmentType,
  AdminJournalEntry,
} from '../../types';
import { api } from '../../utils/api';
import { StudentReportModal } from '../common/StudentReportModal';
import { HabitAnswersModal } from '../common/HabitAnswersModal';
import { ErrorBoundary } from '../common/ErrorBoundary';

function getExcelColumnLabel(index: number): string {
  let label = '';
  let num = index;
  while (num >= 0) {
    label = String.fromCharCode((num % 26) + 65) + label;
    num = Math.floor(num / 26) - 1;
  }
  return label;
}

interface AdminDashboardProps {
  admin: Teacher;
  allStudents: Student[];
  onLogout: () => void;
  onRefreshStudents?: () => void;
}

type AdminControlTab =
  | 'overview'
  | 'period'
  | 'instruments'
  | 'achievements'
  | 'students'
  | 'teachers'
  | 'classes_rombels'
  | 'guru_wali'
  | 'journals'
  | 'import_data'
  | 'admins'
  | 'announcements';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  admin,
  allStudents,
  onLogout,
  onRefreshStudents,
}) => {
  const [activeTab, setActiveTab] = useState<AdminControlTab>('overview');
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<string | null>(null);
  const [inspectJournalAnswers, setInspectJournalAnswers] = useState<{
    studentId: string;
    studentName: string;
    habitCode: string;
    habitTitle: string;
    logDate: string;
  } | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // =========================================================================
  // G.1: OVERVIEW STATE
  // =========================================================================
  const [overviewData, setOverviewData] = useState<any>(null);
  const [serverTodayDate, setServerTodayDate] = useState<string>('');

  // =========================================================================
  // JADWAL PENGAMBILAN DATA (DATA COLLECTION PERIOD)
  // =========================================================================
  const [periodForm, setPeriodForm] = useState({
    start_date: '2026-10-15',
    end_date: '2026-11-15',
    end_of_day_time: '22:00',
  });
  const [periodSaving, setPeriodSaving] = useState(false);

  // =========================================================================
  // DATABASE SPREADSHEET VIEWER & AUDIT LOGS
  // =========================================================================
  const [dbTables, setDbTables] = useState<string[]>([]);
  const [selectedDbTable, setSelectedDbTable] = useState<string>('student_habit_answers');
  const [dbTableData, setDbTableData] = useState<{
    tableName: string;
    totalRows: number;
    columns: Array<{ name: string; type: string; pk: boolean; notnull: boolean }>;
    rows: any[];
    limit: number;
    offset: number;
  } | null>(null);
  const [dbTableLoading, setDbTableLoading] = useState(false);
  const [dbTablePage, setDbTablePage] = useState(0);
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);

  // =========================================================================
  // POPUPS & PETUAH BUDAYA BETAWI
  // =========================================================================
  const [popupsList, setPopupsList] = useState<any[]>([]);
  const [editingPopup, setEditingPopup] = useState<any | null>(null);
  const [announcementsSubTab, setAnnouncementsSubTab] = useState<'announcements' | 'petuah'>('announcements');

  // =========================================================================
  // VALIDASI PRESTASI MURID & UPDATE SKEMA RUBRIK (Section 8, 10, 11)
  // =========================================================================
  const [adminAchievements, setAdminAchievements] = useState<any[]>([]);
  const [achievementRubric, setAchievementRubric] = useState<any[]>([]);
  const [achFilterStatus, setAchFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [achSearchQuery, setAchSearchQuery] = useState('');
  const [validatingAch, setValidatingAch] = useState<any | null>(null);
  const [validationForm, setValidationForm] = useState<{
    status: 'approved' | 'rejected';
    points_awarded: number;
    admin_notes: string;
  }>({
    status: 'approved',
    points_awarded: 15,
    admin_notes: '',
  });
  const [rubricEditing, setRubricEditing] = useState<any[]>([]);
  const [isRubricModalOpen, setIsRubricModalOpen] = useState(false);
  const [rubricSaving, setRubricSaving] = useState(false);

  // =========================================================================
  // KLASIFIKASI KELAS & SISWA
  // =========================================================================
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [studentToClassId, setStudentToClassId] = useState<string>('');

  // =========================================================================
  // GURU WALI & BIMBINGAN
  // =========================================================================
  const [selectedGuruWaliId, setSelectedGuruWaliId] = useState<string>('');
  const [studentToWaliId, setStudentToWaliId] = useState<string>('');

  // =========================================================================
  // IMPORT DATA TERPADU
  // =========================================================================
  const [importMode, setImportMode] = useState<'all' | 'students' | 'teachers'>('all');
  const [importRawText, setImportRawText] = useState<string>('');
  const [importLoading, setImportLoading] = useState(false);

  // =========================================================================
  // G.0: MANAJEMEN AKUN ADMIN
  // =========================================================================
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminForm, setAdminForm] = useState<{
    id?: string;
    nip: string;
    name: string;
    username: string;
    password?: string;
    is_active?: boolean;
  }>({
    id: '',
    nip: '',
    name: '',
    username: '',
    password: '123',
    is_active: true,
  });

  // =========================================================================
  // INSTRUMEN 7 KAIH (FULL GUI STATE & INTERACTIVE PREVIEW)
  // =========================================================================
  const [instruments, setInstruments] = useState<any[]>([]);
  const [guiHabitCode, setGuiHabitCode] = useState<string>('bangun');
  const [guiVariant, setGuiVariant] = useState<string>('islam');
  const [instrumentSaving, setInstrumentSaving] = useState(false);

  // Full GUI Configurations for all 7 Habits & Variants
  const [habitConfigs, setHabitConfigs] = useState<Record<string, {
    title: string;
    subtitle: string;
    category: string;
    base_points: number;
    max_daily_sessions: number;
    rubric: Array<{ id: string; label: string; score: number; tag: string }>;
  }>>({
    'bangun': {
      title: 'Bangun Pagi',
      subtitle: 'Pukul 04.00 – 06.40 WIB',
      category: 'Kedisiplinan & Waktu',
      base_points: 100,
      max_daily_sessions: 1,
      rubric: [
        { id: 'bp-1', label: 'Waktu: 04.00 – 04.20 WIB (Awal Waktu)', score: 75, tag: 'Waktu' },
        { id: 'bp-2', label: 'Waktu: 04.21 – 04.40 WIB', score: 70, tag: 'Waktu' },
        { id: 'bp-3', label: 'Waktu: 04.41 – 05.00 WIB', score: 65, tag: 'Waktu' },
        { id: 'bp-4', label: 'Waktu: 05.01 – 06.20 WIB', score: 60, tag: 'Waktu' },
        { id: 'bp-5', label: 'Waktu: 06.21 – 06.40 WIB', score: 55, tag: 'Waktu' },
        { id: 'bp-6', label: 'Kondisi: Sangat Segar & Bugar (5 Bintang)', score: 25, tag: 'Kondisi' },
        { id: 'bp-7', label: 'Kondisi: Cukup Segar (4 Bintang)', score: 20, tag: 'Kondisi' },
        { id: 'bp-8', label: 'Kondisi: Kurang Segar / Mengantuk (3 Bintang)', score: 15, tag: 'Kondisi' },
      ],
    },
    'beribadah_islam': {
      title: 'Beribadah — Shalat 5 Waktu & Sunnah',
      subtitle: 'Subuh, Dzuhur, Ashar, Maghrib, Isya',
      category: 'Karakter Spiritual & Keagamaan',
      base_points: 100,
      max_daily_sessions: 5,
      rubric: [
        { id: 'sh-1', label: 'Shalat Subuh Tepat Waktu', score: 20, tag: 'Wajib' },
        { id: 'sh-2', label: 'Shalat Dzuhur Tepat Waktu', score: 20, tag: 'Wajib' },
        { id: 'sh-3', label: 'Shalat Ashar Tepat Waktu', score: 20, tag: 'Wajib' },
        { id: 'sh-4', label: 'Shalat Maghrib Tepat Waktu', score: 20, tag: 'Wajib' },
        { id: 'sh-5', label: 'Shalat Isya Tepat Waktu', score: 20, tag: 'Wajib' },
        { id: 'sh-6', label: 'Bonus Ibadah Sunnah (Dhuha / Rawatib / Tahajud)', score: 5, tag: 'Bonus Sunnah' },
        { id: 'sh-7', label: "Bonus Tadarus Al-Qur'an (Per Halaman)", score: 5, tag: 'Bonus Literasi' },
      ],
    },
    'beribadah_kristen': {
      title: 'Beribadah — Doa & Saat Teduh',
      subtitle: '5 Sesi Doa Harian & Renungan Alkitab',
      category: 'Karakter Spiritual & Keagamaan',
      base_points: 100,
      max_daily_sessions: 5,
      rubric: [
        { id: 'kr-1', label: 'Doa Pagi Bangun Tidur', score: 20, tag: 'Doa' },
        { id: 'kr-2', label: 'Membaca Alkitab & Saat Teduh', score: 20, tag: 'Firman' },
        { id: 'kr-3', label: 'Doa Saat Makan Siang / Pagi', score: 20, tag: 'Doa' },
        { id: 'kr-4', label: 'Doa Sebelum / Sesudah Belajar', score: 20, tag: 'Doa' },
        { id: 'kr-5', label: 'Doa Malam Sebelum Tidur', score: 20, tag: 'Doa' },
        { id: 'kr-6', label: 'Bonus Pendalaman Kitab Suci & Komitmen Moral', score: 5, tag: 'Bonus' },
      ],
    },
    'beribadah_hindu': {
      title: 'Beribadah — Puja Tri Sandhya',
      subtitle: 'Pagi (06.00), Siang (12.00), Sore (18.00 WIB)',
      category: 'Karakter Spiritual & Keagamaan',
      base_points: 100,
      max_daily_sessions: 3,
      rubric: [
        { id: 'hn-1', label: 'Tri Sandhya Pagi (Ideal 06.00 WIB)', score: 35, tag: 'Tri Sandhya' },
        { id: 'hn-2', label: 'Tri Sandhya Siang (Ideal 12.00 WIB)', score: 35, tag: 'Tri Sandhya' },
        { id: 'hn-3', label: 'Tri Sandhya Sore (Ideal 18.00 WIB)', score: 30, tag: 'Tri Sandhya' },
        { id: 'hn-4', label: 'Bonus Membaca Kitab Suci Weda / Sloka Gita', score: 5, tag: 'Bonus' },
      ],
    },
    'beribadah_halangan': {
      title: 'Beribadah — Khusus Berhalangan',
      subtitle: "5 Amalan Kebaikan & Udzur Syar'i (Tanpa Pengurangan Nilai)",
      category: 'Karakter Spiritual & Keagamaan',
      base_points: 100,
      max_daily_sessions: 1,
      rubric: [
        { id: 'hl-1', label: 'Berdzikir dan Berdoa Memohon Kebaikan', score: 20, tag: 'Amalan' },
        { id: 'hl-2', label: "Mendengarkan atau Muraja'ah Ayat Al-Qur'an / Tausiyah", score: 20, tag: 'Amalan' },
        { id: 'hl-3', label: 'Berbuat Baik dan Bersedekah / Menolong Sesama', score: 20, tag: 'Amalan' },
        { id: 'hl-4', label: 'Belajar Ilmu Agama, Karakter, atau Adab Islami', score: 20, tag: 'Amalan' },
        { id: 'hl-5', label: 'Menjaga Kebersihan Diri dan Lingkungan Sekitar', score: 20, tag: 'Amalan' },
      ],
    },
    'makan_normal': {
      title: 'Makan Bergizi Seimbang (Pola Normal)',
      subtitle: '3 Sesi: Sarapan, Makan Siang, Makan Malam',
      category: 'Pola Hidup Sehat & Gizi',
      base_points: 100,
      max_daily_sessions: 3,
      rubric: [
        { id: 'mn-1', label: 'Waktu Makan Ideal Tepat Waktu', score: 15, tag: 'Waktu' },
        { id: 'mn-2', label: 'Piring Gizi: Karbohidrat Sehat', score: 17.5, tag: 'Piring Gizi' },
        { id: 'mn-3', label: 'Piring Gizi: Lauk Berprotein', score: 17.5, tag: 'Piring Gizi' },
        { id: 'mn-4', label: 'Piring Gizi: Sayur-mayur Berserat', score: 15, tag: 'Piring Gizi' },
        { id: 'mn-5', label: 'Piring Gizi: Buah-buahan Segar', score: 15, tag: 'Piring Gizi' },
        { id: 'mn-6', label: 'Minum Air Putih Cukup (>= 2 Gelas per Sesi)', score: 20, tag: 'Hidrasi' },
        { id: 'mn-7', label: 'Bonus Adiwiyata: Membawa Kotak Makan Sendiri', score: 5, tag: 'Adiwiyata' },
        { id: 'mn-8', label: 'Bonus Adiwiyata: Membawa Tumbler Air Minum Sendiri', score: 5, tag: 'Adiwiyata' },
      ],
    },
    'makan_puasa': {
      title: 'Makan Bergizi — Mode Puasa',
      subtitle: '2 Sesi: Sahur Sehat & Berbuka Puasa',
      category: 'Pola Hidup Sehat & Gizi',
      base_points: 100,
      max_daily_sessions: 2,
      rubric: [
        { id: 'mp-1', label: 'Sahur Tepat Waktu (03.30 – 10m sblm Imsak)', score: 20, tag: 'Waktu' },
        { id: 'mp-2', label: 'Porsi Sahur: Karbohidrat Kompleks & Protein', score: 25, tag: 'Gizi Sahur' },
        { id: 'mp-3', label: 'Hidrasi Sahur: Cukup Air Putih (>= 2 Gelas)', score: 15, tag: 'Hidrasi' },
        { id: 'mp-4', label: 'Berbuka Tepat Waktu saat Adzan Maghrib', score: 20, tag: 'Waktu' },
        { id: 'mp-5', label: 'Porsi Berbuka: Takjil Sehat, Sayur & Buah', score: 20, tag: 'Gizi Berbuka' },
        { id: 'mp-6', label: 'Bonus Adiwiyata: Menghindari Wadah Plastik Sekali Pakai', score: 5, tag: 'Adiwiyata' },
      ],
    },
    'berolahraga': {
      title: 'Berolahraga & Aktivitas Fisik',
      subtitle: 'Senam, Lari, Peregangan, Olahraga Permainan',
      category: 'Kesehatan & Kebugaran',
      base_points: 100,
      max_daily_sessions: 1,
      rubric: [
        { id: 'ol-1', label: 'Aktivitas Fisik Mandiri / Stretching', score: 10, tag: 'Aktivitas' },
        { id: 'ol-2', label: 'Aktivitas Fisik Kelompok / Ekskul Olahraga', score: 10, tag: 'Aktivitas' },
        { id: 'ol-3', label: 'Jalan Kaki / Naik-Turun Tangga Sekolah', score: 10, tag: 'Aktivitas' },
        { id: 'ol-4', label: 'Durasi Olahraga > 30 Menit', score: 45, tag: 'Durasi' },
        { id: 'ol-5', label: 'Durasi Olahraga 15 – 30 Menit', score: 35, tag: 'Durasi' },
        { id: 'ol-6', label: 'Catatan Jurnal Reflektif (>= 15 Karakter)', score: 15, tag: 'Refleksi' },
        { id: 'ol-7', label: 'Bonus Adiwiyata: Bersepeda / Jalan Kaki ke Sekolah', score: 5, tag: 'Adiwiyata' },
      ],
    },
    'belajar': {
      title: 'Gemar Belajar Mandiri & Literasi',
      subtitle: 'Membaca Buku, Mengulang Pelajaran, Eksplorasi Sains',
      category: 'Akademik & Literasi',
      base_points: 100,
      max_daily_sessions: 1,
      rubric: [
        { id: 'bl-1', label: 'Durasi Belajar Mandiri >= 60 Menit', score: 60, tag: 'Durasi' },
        { id: 'bl-2', label: 'Durasi Belajar Mandiri 30 – 59 Menit', score: 40, tag: 'Durasi' },
        { id: 'bl-3', label: 'Jumlah Topik / Mapel Dilatih (>= 2 Mapel)', score: 30, tag: 'Intensitas' },
        { id: 'bl-4', label: 'Ringkasan Catatan Materi Jelas & Reflektif', score: 10, tag: 'Kualitas' },
      ],
    },
    'bermasyarakat': {
      title: 'Bermasyarakat & Kepedulian Sosial',
      subtitle: 'Bakti Sosial, Membantu Orang Tua, Gotong Royong Lingkungan',
      category: 'Sosial & Budi Pekerti',
      base_points: 100,
      max_daily_sessions: 1,
      rubric: [
        { id: 'bm-1', label: 'Membantu Pekerjaan Rumah Tangga Orang Tua', score: 25, tag: 'Keluarga' },
        { id: 'bm-2', label: 'Menerapkan 5S (Senyum, Salam, Sapa, Sopan, Santun)', score: 25, tag: 'Sekolah' },
        { id: 'bm-3', label: 'Aksi Peduli Lingkungan / Pilah Sampah Adiwiyata', score: 25, tag: 'Lingkungan' },
        { id: 'bm-4', label: 'Tolong Menolong Teman atau Warga Sekitar', score: 25, tag: 'Sosial' },
      ],
    },
    'tidur': {
      title: 'Tidur Cepat & Istirahat Cukup',
      subtitle: 'Tidur Sebelum Pukul 22.00 WIB untuk Pemulihan Optimal',
      category: 'Pola Hidup Sehat & Disiplin',
      base_points: 100,
      max_daily_sessions: 1,
      rubric: [
        { id: 'td-1', label: 'Tidur Tepat Waktu Sebelum 21.30 WIB', score: 80, tag: 'Waktu' },
        { id: 'td-2', label: 'Tidur Antara 21.31 – 22.15 WIB', score: 70, tag: 'Waktu' },
        { id: 'td-3', label: 'Tidur Antara 22.16 – 23.00 WIB', score: 55, tag: 'Waktu' },
        { id: 'td-4', label: 'Mematikan Gadget / Layar 15 Menit Sebelum Tidur', score: 10, tag: 'Kualitas' },
        { id: 'td-5', label: 'Mempersiapkan Perlengkapan Sekolah Esok Hari', score: 10, tag: 'Persiapan' },
      ],
    },
  });

  // Interactive Live Student Preview State (Dynamic Simulation)
  const [previewSelections, setPreviewSelections] = useState<Record<string, any>>({
    wakeTime: '04.10',
    wakeFreshness: 5,
    islamSubuh: true,
    islamDzuhur: true,
    islamAshar: true,
    islamMaghrib: true,
    islamIsya: true,
    islamSunnah: true,
    islamQuranPages: 2,
    kristenDoaBangun: true,
    kristenAlkitab: true,
    kristenDoaMakan: true,
    kristenDoaBelajar: true,
    kristenDoaTidur: true,
    hinduTriPagi: true,
    hinduTriSiang: true,
    hinduTriSore: true,
    hinduWeda: true,
    halanganDzikir: true,
    halanganMendengar: true,
    halanganKebaikan: true,
    halanganKajian: true,
    halanganKebersihan: true,
    makanKarbo: true,
    makanLauk: true,
    makanSayur: true,
    makanBuah: true,
    makanAir: 2,
    makanKotak: true,
    makanTumbler: true,
    olahragaAktivitas: 'Mandiri & Stretching',
    olahragaDurasi: '35',
    olahragaDeskripsi: 'Lari pagi mengelilingi lapangan SMAN 28 selama 35 menit.',
    olahragaAdiwiyata: true,
    belajarDurasi: '65',
    belajarTopikCount: 2,
    belajarCatatan: 'Membahas bab 4 kalkulus dan merangkum biologi sel.',
    masyarakatOrtu: true,
    masyarakat5S: true,
    masyarakatAdiwiyata: true,
    masyarakatTolong: true,
    tidurWaktu: '21.20',
    tidurLayar: true,
    tidurPersiapan: true,
  });

  // Helper to determine active key in habitConfigs
  const activeHabitKey =
    guiHabitCode === 'beribadah'
      ? `beribadah_${guiVariant || 'islam'}`
      : guiHabitCode === 'makan'
      ? `makan_${guiVariant || 'normal'}`
      : guiHabitCode;

  // Active configuration for GUI editor
  const currentConfig = habitConfigs[activeHabitKey] || habitConfigs['bangun'];

  // =========================================================================
  // G.2: MANAJEMEN MURID & CSV
  // =========================================================================
  const [adminStudents, setAdminStudents] = useState<Student[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentForm, setStudentForm] = useState<any>({
    id: '',
    nisn: '',
    name: '',
    password: '123',
    gender: 'L',
    religion: 'Islam',
    class_name: 'X-1',
    rombel_name: '',
    wali_name: '',
    angkatan: '2025/2026',
    status: 'ACTIVE',
    is_demo: 0,
  });

  // =========================================================================
  // G.3: MANAJEMEN GURU & ROLE
  // =========================================================================
  const [adminTeachers, setAdminTeachers] = useState<any[]>([]);
  const [teacherFilterRole, setTeacherFilterRole] = useState<string>('ALL');
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [teacherForm, setTeacherForm] = useState<any>({
    id: '',
    nip: '',
    username: '',
    name: '',
    password: '123',
    subject: 'Pendidikan Karakter',
    is_walas: true,
    is_wali: false,
    is_tim_7_kaih: false,
    class_name: 'X-1',
    is_demo: 0,
  });

  // =========================================================================
  // G.4 & G.5: KELAS, GURU WALI (ROMBEL), & ANGKATAN
  // =========================================================================
  const [classesRombelsData, setClassesRombelsData] = useState<{
    classes: any[];
    rombels: any[];
  }>({ classes: [], rombels: [] });
  const [cohortsList, setCohortsList] = useState<any[]>([]);
  const [editingCohortId, setEditingCohortId] = useState<string | null>(null);
  const [editingCohortName, setEditingCohortName] = useState<string>('');
  const [walasModalOpen, setWalasModalOpen] = useState(false);
  const [targetClassForWalas, setTargetClassForWalas] = useState<any | null>(null);
  const [selectedWalasTeacherId, setSelectedWalasTeacherId] = useState<string>('');
  const [selectedGuruWaliTeacherId, setSelectedGuruWaliTeacherId] = useState<string>('');
  const [newClassForm, setNewClassForm] = useState({ name: '', cohort_name: '2025/2026' });
  const [newRombelForm, setNewRombelForm] = useState({ name: '', wali_name: '', cohort_name: '2025/2026' });

  // =========================================================================
  // G.6: DATABASE JURNAL & AUDIT KOREKSI
  // =========================================================================
  const [journalsList, setJournalsList] = useState<AdminJournalEntry[]>([]);
  const [journalFilterDate, setJournalFilterDate] = useState<string>('');
  const [journalFilterHabit, setJournalFilterHabit] = useState<string>('');
  const [editingJournal, setEditingJournal] = useState<AdminJournalEntry | null>(null);
  const [newJournalScore, setNewJournalScore] = useState<number>(100);
  const [correctionReason, setCorrectionReason] = useState<string>('');

  // =========================================================================
  // PENGUMUMAN & QUOTES
  // =========================================================================
  const [announcementsList, setAnnouncementsList] = useState<any[]>([]);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState<{
    id: string;
    type: 'ANNOUNCEMENT' | 'QUOTE';
    title: string;
    content: string;
    author: string;
  }>({
    id: '',
    type: 'QUOTE',
    title: '',
    content: '',
    author: '',
  });

  // Load Main Data
  const loadControlPanelData = async () => {
    try {
      setLoading(true);
      const [ovData, stList, tchList, crData, pData, instData, annList, jRes, admList, dbTbls, aLogs, pops, achList, rubData] = await Promise.all([
        api.getAdminOverview(),
        api.getStudents(),
        api.getTeachers(),
        api.getAdminClassesAndRombels(),
        api.getDataCollectionPeriod().catch(() => ({ startDate: '2026-10-15', endDate: '2026-11-15', endOfDayTime: '22:00' })),
        api.getInstruments().catch(() => []),
        api.getAnnouncements().catch(() => []),
        api.getAdminJournals({}),
        api.getAdminAccounts().catch(() => []),
        api.getDatabaseTables().catch(() => []),
        api.getAuditLogs(100).catch(() => []),
        api.getPopups().catch(() => []),
        api.getAdminAchievements().catch(() => []),
        api.getAchievementRubric().catch(() => ({ rubric: [] })),
      ]);

      setOverviewData(ovData);
      setAdminStudents(stList || []);
      setAdminTeachers(tchList || []);
      setClassesRombelsData(crData || { classes: [], rombels: [] });
      setCohortsList(crData?.cohorts || []);
      if (pData?.startDate && pData?.endDate) {
        setPeriodForm({
          start_date: pData.startDate,
          end_date: pData.endDate,
          end_of_day_time: pData.endOfDayTime || '22:00',
        });
      }
      setInstruments(instData || []);
      setAnnouncementsList(annList || []);
      if (jRes?.journals) setJournalsList(jRes.journals);
      setAdminsList(admList || []);
      setDbTables(dbTbls || []);
      setAuditLogsList(aLogs || []);
      setPopupsList(pops || []);
      if (achList) setAdminAchievements(achList);
      const rubricsList = Array.isArray(rubData) ? rubData : (rubData as any)?.rubric || [];
      if (rubricsList.length > 0) {
        setAchievementRubric(rubricsList);
        setRubricEditing(rubricsList);
      }

      if (crData?.classes?.length && !selectedClassId) {
        setSelectedClassId(crData.classes[0].id || crData.classes[0].name);
      }
      if (tchList?.length && !selectedGuruWaliId) {
        const firstWali = tchList.find((t: Teacher) => t.is_wali || t.roles_csv?.includes('WALI'));
        if (firstWali) setSelectedGuruWaliId(firstWali.id);
      }
    } catch (e) {
      console.error('Failed to load admin control data:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadDbTableRows = async (tableName: string, page = 0) => {
    try {
      setDbTableLoading(true);
      const res = await api.getTableData(tableName, 100, page * 100);
      setDbTableData(res);
      setDbTablePage(page);
    } catch (err: any) {
      console.error('Failed to load table rows:', err);
    } finally {
      setDbTableLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'journals' && selectedDbTable) {
      loadDbTableRows(selectedDbTable, dbTablePage);
    }
  }, [activeTab, selectedDbTable]);

  const fetchTodayDateInfo = async () => {
    try {
      const info = await api.getTodayInfo();
      setServerTodayDate(info.todayDate);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadControlPanelData();
    fetchTodayDateInfo();
  }, []);

  // Save Data Collection Period
  const handleSavePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setPeriodSaving(true);
      await api.saveDataCollectionPeriod({
        startDate: periodForm.start_date,
        endDate: periodForm.end_date,
        endOfDayTime: periodForm.end_of_day_time,
      });
      showToast('Jadwal pengambilan data berhasil diperbarui!');
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan jadwal pengambilan data');
    } finally {
      setPeriodSaving(false);
    }
  };

  // Reset 7 KAIH Instruments to Default
  const handleResetInstruments = async () => {
    if (!confirm('Apakah Anda yakin ingin mereset seluruh instrumen 7 KAIH ke konfigurasi default sistem? Tindakan ini akan mengembalikan instrumen ke konfigurasi awal.')) return;
    try {
      setLoading(true);
      await api.resetInstruments();
      showToast('Instrumen 7 KAIH berhasil direset ke pengaturan awal!');
      await loadControlPanelData();
    } catch (err: any) {
      alert(err.message || 'Gagal mereset instrumen');
    } finally {
      setLoading(false);
    }
  };

  // Save Custom Popup Petuah
  const handleSavePopupQuote = async (popupItem: any) => {
    if (!popupItem) return;
    const text = String(
      popupItem.quote_text || popupItem.quoteText || popupItem.quote || popupItem.text || popupItem.content || ''
    ).trim();
    if (!text) {
      alert('Teks petuah wajib diisi dan tidak boleh kosong.');
      return;
    }
    try {
      setLoading(true);
      await api.savePopup({
        id: popupItem.id || `popup_${popupItem.habit_code || 'umum'}_${Date.now()}`,
        habit_code: popupItem.habit_code || 'umum',
        trigger_condition: popupItem.trigger_condition || 'always',
        title: popupItem.title || 'Petuah Budaya Betawi',
        quote_text: text,
      });
      showToast('Petuah budaya Betawi berhasil disimpan!');
      const updated = await api.getPopups();
      setPopupsList(updated);
      setEditingPopup(null);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan petuah');
    } finally {
      setLoading(false);
    }
  };

  // Achievement Validation Handlers (Section 8, 10, 11)
  const handleOpenValidateModal = (ach: any) => {
    setValidatingAch(ach);
    const r = achievementRubric.find(
      (item: any) => (item.level || '').toLowerCase() === (ach.jenjang || '').toLowerCase()
    );
    const defaultPts = r ? (r.default_points || r.min_points) : 15;
    setValidationForm({
      status: 'approved',
      points_awarded: defaultPts,
      admin_notes: '',
    });
  };

  const handleSaveValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatingAch) return;
    try {
      setLoading(true);
      await api.validateAchievement(validatingAch.id, {
        status: validationForm.status,
        points_awarded: Number(validationForm.points_awarded),
        admin_notes: validationForm.admin_notes.trim(),
        validated_by: `${admin.name} (Admin)`,
      });
      showToast(`Pengajuan prestasi berhasil ${validationForm.status === 'approved' ? 'disetujui' : 'ditolak'}!`);
      setValidatingAch(null);
      const updated = await api.getAdminAchievements();
      setAdminAchievements(updated || []);
      onRefreshStudents?.();
    } catch (err: any) {
      alert(err.message || 'Gagal memvalidasi pengajuan prestasi');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRubric = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setRubricSaving(true);
      await api.saveAchievementRubric(rubricEditing);
      showToast('Skema rubrik penilaian prestasi berhasil diperbarui!');
      setAchievementRubric(rubricEditing);
      setIsRubricModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan skema rubrik');
    } finally {
      setRubricSaving(false);
    }
  };

  // Execute Flexible Bulk Import
  const handleExecuteImport = async () => {
    if (!importRawText.trim()) {
      alert('Silakan tempelkan (paste) data JSON atau CSV terlebih dahulu.');
      return;
    }
    try {
      setImportLoading(true);
      let payload: { students?: any[]; teachers?: any[]; classes?: any[] } = {};
      const trimmed = importRawText.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          if (importMode === 'students') payload.students = parsed;
          else if (importMode === 'teachers') payload.teachers = parsed;
          else payload.students = parsed;
        } else {
          payload = parsed;
        }
      } else {
        const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length < 2) throw new Error('Data CSV membutuhkan baris header dan minimal 1 baris data.');
        const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
        const rows = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
          const rowObj: any = {};
          headers.forEach((h, i) => {
            rowObj[h] = values[i] || '';
          });
          return rowObj;
        });
        if (importMode === 'students') payload.students = rows;
        else if (importMode === 'teachers') payload.teachers = rows;
        else payload.students = rows;
      }

      const res = await api.importData(payload);
      showToast(`Import berhasil! ${res.imported_students || 0} Siswa, ${res.imported_teachers || 0} Guru, ${res.imported_classes || 0} Kelas berhasil diproses.`);
      setImportRawText('');
      await loadControlPanelData();
      onRefreshStudents?.();
    } catch (err: any) {
      alert(err.message || 'Gagal memproses import data.');
    } finally {
      setImportLoading(false);
    }
  };



  // =========================================================================
  // ADMIN ACCOUNT ACTIONS
  // =========================================================================
  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.name.trim() || !adminForm.username.trim()) {
      alert('Nama lengkap dan username admin wajib diisi.');
      return;
    }
    try {
      await api.saveAdminAccount(adminForm);
      setAdminModalOpen(false);
      showToast('Data akun administrator berhasil disimpan!');
      const updated = await api.getAdminAccounts();
      setAdminsList(updated || []);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan akun admin');
    }
  };

  const handleDeleteAdmin = async (id: string, username: string) => {
    if (username === 'admin') {
      alert('Akun Administrator Utama (admin) tidak dapat dihapus.');
      return;
    }
    if (!confirm(`Hapus akun admin '${username}' ini? Tindakan ini permanen.`)) return;
    try {
      setAdminsList((prev) => prev.filter((a) => a.id !== id && a.user_id !== id && a.username !== username));
      await api.deleteAdminAccount(id);
      showToast('Akun admin berhasil dihapus!');
      const updated = await api.getAdminAccounts();
      setAdminsList(updated || []);
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus admin');
      const updated = await api.getAdminAccounts();
      setAdminsList(updated || []);
    }
  };

  // =========================================================================
  // GUI INSTRUMENT EDITOR ACTIONS
  // =========================================================================
  const handleSaveGuiInstrument = async () => {
    try {
      setInstrumentSaving(true);
      await api.saveInstrument({
        habit_code: activeHabitKey,
        habit_name: currentConfig.title,
        subtitle: currentConfig.subtitle,
        category: currentConfig.category,
        max_daily_sessions: currentConfig.max_daily_sessions,
        base_points: currentConfig.base_points,
        rubric_json: JSON.stringify(currentConfig.rubric),
      });
      showToast(`Instrumen ${currentConfig.title} berhasil disimpan ke database!`);
      const updated = await api.getInstruments();
      setInstruments(updated || []);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan instrumen');
    } finally {
      setInstrumentSaving(false);
    }
  };

  const handleAddRubricItem = () => {
    const newItem = {
      id: `${activeHabitKey}-${Date.now()}`,
      label: 'Kriteria / Opsi Pilihan Baru',
      score: 10,
      tag: 'Kriteria',
    };
    setHabitConfigs((prev) => ({
      ...prev,
      [activeHabitKey]: {
        ...prev[activeHabitKey],
        rubric: [...prev[activeHabitKey].rubric, newItem],
      },
    }));
  };

  const handleDeleteRubricItem = (itemId: string) => {
    setHabitConfigs((prev) => ({
      ...prev,
      [activeHabitKey]: {
        ...prev[activeHabitKey],
        rubric: prev[activeHabitKey].rubric.filter((r) => r.id !== itemId),
      },
    }));
  };

  const handleUpdateRubricItem = (itemId: string, field: 'label' | 'score' | 'tag', value: any) => {
    setHabitConfigs((prev) => ({
      ...prev,
      [activeHabitKey]: {
        ...prev[activeHabitKey],
        rubric: prev[activeHabitKey].rubric.map((r) =>
          r.id === itemId ? { ...r, [field]: value } : r
        ),
      },
    }));
  };

  const handleUpdateConfigField = (field: 'title' | 'subtitle' | 'category' | 'base_points' | 'max_daily_sessions', value: any) => {
    setHabitConfigs((prev) => ({
      ...prev,
      [activeHabitKey]: {
        ...prev[activeHabitKey],
        [field]: value,
      },
    }));
  };

  // Student Save & Delete
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveAdminStudent({
        ...studentForm,
        is_demo: 0,
        rombel_name: studentForm.wali_name || studentForm.rombel_name,
      });
      setStudentModalOpen(false);
      showToast('Data akun murid berhasil disimpan!');
      await loadControlPanelData();
      onRefreshStudents?.();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan murid');
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('Hapus akun murid ini secara permanen?')) return;
    try {
      setAdminStudents((prev) => prev.filter((s) => s.id !== id));
      await api.deleteAdminStudent(id);
      showToast('Akun murid berhasil dihapus');
      await loadControlPanelData();
      onRefreshStudents?.();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus murid');
      await loadControlPanelData();
    }
  };

  // Teacher Save & Delete
  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const roles: string[] = [];
      if (teacherForm.is_walas) roles.push('WALAS');
      if (teacherForm.is_wali) roles.push('WALI');
      if (teacherForm.is_tim_7_kaih) roles.push('TIM_7_KAIH');

      await api.saveAdminTeacher({
        ...teacherForm,
        username: teacherForm.username?.trim() || teacherForm.nip?.trim(),
        is_walas: teacherForm.is_walas ? 1 : 0,
        is_wali: teacherForm.is_wali ? 1 : 0,
        is_tim_7_kaih: teacherForm.is_tim_7_kaih ? 1 : 0,
        roles_csv: roles.join(','),
        assignment_type: roles[0] || 'WALAS',
        class_name: teacherForm.is_walas ? teacherForm.class_name : '',
        is_demo: 0,
      });
      setTeacherModalOpen(false);
      showToast('Data akun guru berhasil disimpan!');
      await loadControlPanelData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan guru');
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    if (!confirm('Hapus akun guru ini secara permanen?')) return;
    try {
      setAdminTeachers((prev) => prev.filter((t) => t.id !== id));
      await api.deleteAdminTeacher(id);
      showToast('Akun guru berhasil dihapus');
      await loadControlPanelData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus guru');
      await loadControlPanelData();
    }
  };

  // Classes & Rombels Save & Delete
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassForm.name.trim()) return;
    try {
      await api.saveAdminClass(newClassForm);
      setNewClassForm({ name: '', cohort_name: '2025/2026' });
      showToast('Kelas berhasil disimpan!');
      await loadControlPanelData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan kelas');
    }
  };

  const handleDeleteClass = async (id: string | number) => {
    if (!confirm('Hapus kelas ini? Murid di kelas ini perlu dipindahkan.')) return;
    try {
      setClassesRombelsData((prev) => ({
        ...prev,
        classes: prev.classes.filter((c) => String(c.id) !== String(id) && c.name !== String(id)),
      }));
      await api.deleteClass(id);
      showToast('Kelas berhasil dihapus');
      await loadControlPanelData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus kelas');
      await loadControlPanelData();
    }
  };

  const handleSaveRombel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRombelForm.name.trim() || !newRombelForm.wali_name.trim()) return;
    try {
      await api.saveAdminRombel(newRombelForm);
      setNewRombelForm({ name: '', wali_name: '', cohort_name: '2025/2026' });
      showToast('Guru Wali berhasil disimpan!');
      await loadControlPanelData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan rombel/guru wali');
    }
  };

  const handleDeleteRombel = async (id: string | number) => {
    if (!confirm('Hapus penugasan Guru Wali ini? Murid yang dibimbing akan keluar dari status anak wali.')) return;
    try {
      setClassesRombelsData((prev) => ({
        ...prev,
        rombels: prev.rombels.filter((r) => String(r.id) !== String(id) && r.name !== String(id)),
      }));
      await api.deleteRombel(id);
      showToast('Guru Wali berhasil dihapus');
      await loadControlPanelData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus rombel');
      await loadControlPanelData();
    }
  };

  const handleSaveCohortLabel = async (cohortId: string) => {
    if (!editingCohortName.trim()) return;
    try {
      await api.updateCohort(cohortId, editingCohortName.trim());
      showToast('Label jenjang berhasil diperbarui!');
      setEditingCohortId(null);
      await loadControlPanelData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah label jenjang');
    }
  };

  // Correct Journal
  const handleCorrectJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJournal || !correctionReason.trim()) return;
    try {
      await api.correctAdminJournal({
        log_id: editingJournal.id,
        new_score: Number(newJournalScore),
        reason: correctionReason.trim(),
        corrected_by: `${admin.name} (Admin)`,
      });
      setEditingJournal(null);
      setCorrectionReason('');
      showToast('Koreksi jurnal berhasil disimpan dan diaudit!');
      await loadControlPanelData();
      onRefreshStudents?.();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan koreksi jurnal');
    }
  };

  // Announcements Save & Delete
  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveAnnouncement(announcementForm);
      setAnnouncementModalOpen(false);
      showToast('Pengumuman/Quotes berhasil disimpan!');
      const updated = await api.getAnnouncements();
      setAnnouncementsList(updated);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pengumuman');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Hapus pengumuman ini?')) return;
    try {
      await api.deleteAnnouncement(id);
      showToast('Pengumuman berhasil dihapus');
      const updated = await api.getAnnouncements();
      setAnnouncementsList(updated);
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus pengumuman');
    }
  };

  // Calculate duration between start and end date
  const periodDurationDays = Math.max(
    1,
    Math.round(
      (new Date(`${periodForm.end_date}T12:00:00Z`).getTime() -
        new Date(`${periodForm.start_date}T12:00:00Z`).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1
  );

  const tabs = [
    { id: 'overview' as const, label: 'Ringkasan Sistem', icon: ShieldCheck },
    { id: 'period' as const, label: 'Jadwal Pengambilan Data', icon: Calendar },
    { id: 'instruments' as const, label: 'Instrumen 7 KAIH', icon: Sliders },
    { id: 'achievements' as const, label: 'Validasi Prestasi Murid', icon: Award },
    { id: 'students' as const, label: 'Data Murid', icon: Users },
    { id: 'teachers' as const, label: 'Data Guru & Penugasan', icon: UserCheck },
    { id: 'classes_rombels' as const, label: 'Klasifikasi Kelas & Murid', icon: Layers },
    { id: 'guru_wali' as const, label: 'Bimbingan Guru Wali', icon: HeartHandshake },
    { id: 'journals' as const, label: 'Database & Log Sistem', icon: Database },
    { id: 'import_data' as const, label: 'Import Data Terpadu', icon: UploadCloud },
    { id: 'admins' as const, label: 'Kelola Akun Admin', icon: ShieldCheck },
    { id: 'announcements' as const, label: 'Pengumuman & Petuah Budaya', icon: Quote },
  ];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
        {/* Toast */}
        {toastMsg && (
          <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-lg text-xs font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* ===================================================================
            LEFT SIDEBAR NAVBAR
        =================================================================== */}
        <aside className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-5 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shadow-xs">
                28
              </div>
              <div>
                <h1 className="font-extrabold text-sm text-slate-900 tracking-tight leading-tight">
                  PANEL PENGELOLA ADMIN
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                  SMAN 28 Jakarta
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center font-black text-xs shadow-xs">
                ADM
              </div>
              <div className="overflow-hidden">
                <span className="font-extrabold text-xs text-slate-900 block truncate">
                  {admin.name}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Otoritas: Administrator Sistem
                </span>
              </div>
            </div>
          </div>

          <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 block mb-1">
              Menu Otoritas Admin
            </span>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl font-bold text-xs transition-all text-left cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar Sesi Admin</span>
            </button>
          </div>
        </aside>

        {/* ===================================================================
            RIGHT WORKSPACE CONTENT
        =================================================================== */}
        <main className="flex-1 p-4 sm:p-8 space-y-6 overflow-y-auto max-w-6xl">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Ringkasan &amp; Status Operasional Sistem
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pemantauan real-time akun, kebiasaan, partisipasi, dan integritas 7 KAIH SMAN 28 Jakarta.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
                  <span className="text-xs font-bold text-slate-500 block">Total Murid Terdaftar</span>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 block mt-1">
                    {overviewData?.totalStudents ?? allStudents.length}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold">
                    Terdaftar Aktif di SMAN 28 Jakarta
                  </span>
                </div>
                <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
                  <span className="text-xs font-bold text-slate-500 block">Total Dewan Guru</span>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 block mt-1">
                    {adminTeachers.length}
                  </span>
                  <span className="text-[10px] text-slate-400">Walas, Guru Wali, Tim 7 KAIH</span>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs">
                  <span className="text-xs font-bold text-emerald-800 block">Rata-rata Sekolah</span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-700 block mt-1">
                    {overviewData?.schoolAverage ?? 86.4}
                  </span>
                  <span className="text-[10px] text-emerald-700">Skor Karakter All-Time</span>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl shadow-xs">
                  <span className="text-xs font-bold text-blue-800 block">Partisipasi Hari Ini</span>
                  <span className="text-2xl sm:text-3xl font-black text-blue-700 block mt-1">
                    {overviewData?.participatingToday ?? 0}
                  </span>
                  <span className="text-[10px] text-blue-700">Murid aktif mengisi jurnal</span>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3">
                <h3 className="font-extrabold text-sm text-slate-900">
                  Panduan Pengelolaan Cepat (Quick Access)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                  <div
                    onClick={() => setActiveTab('period')}
                    className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 hover:border-amber-400 cursor-pointer transition-all"
                  >
                    <Calendar className="w-5 h-5 text-amber-700 mb-2" />
                    <span className="font-extrabold text-slate-900 block">Jadwal Pengambilan Data</span>
                    <span className="text-[11px] text-slate-600 mt-1 block">
                      Atur tanggal mulai dan berakhirnya pengisian jurnal murid.
                    </span>
                  </div>
                  <div
                    onClick={() => setActiveTab('instruments')}
                    className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 hover:border-blue-400 cursor-pointer transition-all"
                  >
                    <Sliders className="w-5 h-5 text-blue-700 mb-2" />
                    <span className="font-extrabold text-slate-900 block">Instrumen 7 KAIH</span>
                    <span className="text-[11px] text-slate-600 mt-1 block">
                      Kelola pertanyaan, opsi jawaban, dan bobot poin tiap kebiasaan.
                    </span>
                  </div>
                  <div
                    onClick={() => setActiveTab('admins')}
                    className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 hover:border-indigo-400 cursor-pointer transition-all"
                  >
                    <ShieldCheck className="w-5 h-5 text-indigo-700 mb-2" />
                    <span className="font-extrabold text-slate-900 block">Kelola Akun Admin</span>
                    <span className="text-[11px] text-slate-600 mt-1 block">
                      Tambah akun admin baru, ubah hak akses, dan hapus akun pengelola.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: JADWAL PENGAMBILAN DATA */}
          {activeTab === 'period' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Pengaturan Jadwal Pengambilan Data 7 KAIH
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tentukan rentang tanggal resmi pengisian instrumen 7 Kebiasaan Anak Indonesia Hebat.
                </p>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-6">
                <form onSubmit={handleSavePeriod} className="space-y-6 max-w-xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Tanggal Mulai Pengambilan Data:
                      </label>
                      <input
                        type="date"
                        value={periodForm.start_date}
                        onChange={(e) => setPeriodForm({ ...periodForm, start_date: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Tanggal Selesai Pengambilan Data:
                      </label>
                      <input
                        type="date"
                        value={periodForm.end_date}
                        onChange={(e) => setPeriodForm({ ...periodForm, end_date: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  {/* End of the Day Setting */}
                  <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <label className="block text-xs font-bold text-slate-800">
                      Batas Akhir Pengisian Harian (End of the Day):
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Tentukan jam penutupan pengisian formulir harian bagi murid (misal 20:00 atau 22:00). Anda dapat mengetikkan jam secara fleksibel atau memilih preset di bawah:
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={periodForm.end_of_day_time}
                        onChange={(e) => setPeriodForm({ ...periodForm, end_of_day_time: e.target.value })}
                        placeholder="HH:MM (mis. 22:00)"
                        className="w-36 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      {['20:00', '21:00', '21:30', '22:00', '23:59'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setPeriodForm({ ...periodForm, end_of_day_time: preset })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                            periodForm.end_of_day_time === preset
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-950 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span>Ringkasan Periode Aktif:</span>
                    </div>
                    <p className="text-[11px] text-blue-900">
                      Total Durasi: <strong>{periodDurationDays} Hari</strong> ({periodForm.start_date} s.d. {periodForm.end_date}).
                    </p>
                    <p className="text-[11px] text-blue-800">
                      • Seluruh tanggal dalam rentang ini akan muncul di kalender <strong>Riwayat Pengisian</strong> murid.
                    </p>
                    <p className="text-[11px] text-blue-800">
                      • Bila murid membuka aplikasi di luar tanggal periode ini, beranda tidak akan meminta pengisian lagi dan notifikasi pengingat otomatis dinonaktifkan.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={periodSaving}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {periodSaving ? 'Menyimpan...' : 'Simpan Jadwal Pengambilan Data'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: INSTRUMEN 7 KAIH (FULL GUI EDITOR & LIVE INTERACTIVE PREVIEW) */}
          {activeTab === 'instruments' && (
            <div className="space-y-6">
              {/* Top Banner */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
                      Editor Instrumen Full GUI &amp; Preview
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Kelola Instrumen &amp; Rubrik Penilaian 7 KAIH
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Konfigurasi parameter, opsi pilihan, dan bobot skor 7 Kebiasaan secara visual tanpa JSON mentah. Lengkap dengan live simulator murid sebelum disimpan.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleResetInstruments}
                    disabled={loading}
                    className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    title="Kembalikan semua instrumen 7 KAIH ke konfigurasi default sistem"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset ke Pengaturan Awal</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveGuiInstrument}
                    disabled={instrumentSaving}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{instrumentSaving ? 'Menyimpan...' : 'Simpan Instrumen ke Database'}</span>
                  </button>
                </div>
              </div>

              {/* 7 Habits Navigation Ribbon */}
              <div className="bg-white rounded-3xl p-2.5 border border-slate-200 shadow-xs">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'bangun', label: '1. Bangun Pagi', icon: Sunrise },
                    { id: 'beribadah', label: '2. Beribadah', icon: Heart },
                    { id: 'berolahraga', label: '3. Berolahraga', icon: Dumbbell },
                    { id: 'makan', label: '4. Makan Bergizi', icon: Utensils },
                    { id: 'belajar', label: '5. Gemar Belajar', icon: BookOpen },
                    { id: 'bermasyarakat', label: '6. Bermasyarakat', icon: Users },
                    { id: 'tidur', label: '7. Tidur Cepat', icon: Moon },
                  ].map((h) => {
                    const Icon = h.icon;
                    const isSelected = guiHabitCode === h.id;
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          setGuiHabitCode(h.id);
                          if (h.id === 'beribadah') setGuiVariant('islam');
                          if (h.id === 'makan') setGuiVariant('normal');
                        }}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{h.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Sub-Variant Selector for Beribadah (3 Agama + 1 Berhalangan) */}
                {guiHabitCode === 'beribadah' && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                      Pilih Varian Ibadah:
                    </span>
                    {[
                      { id: 'islam', label: '🕌 Islam (5 Waktu & Sunnah)' },
                      { id: 'kristen', label: '⛪ Kristen / Katolik (Doa & Alkitab)' },
                      { id: 'hindu', label: '🕉️ Hindu (Tri Sandhya & Weda)' },
                      { id: 'halangan', label: '🌸 Khusus Berhalangan (Udzur Syar\'i)' },
                    ].map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setGuiVariant(v.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          guiVariant === v.id
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Sub-Variant Selector for Makan Bergizi (Normal 3 Sesi vs Puasa 2 Sesi) */}
                {guiHabitCode === 'makan' && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                      Pola Makan Bergizi:
                    </span>
                    {[
                      { id: 'normal', label: '🍽️ Pola Normal (3 Sesi: Pagi, Siang, Malam)' },
                      { id: 'puasa', label: '🌙 Mode Puasa (2 Sesi: Sahur & Berbuka)' },
                    ].map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setGuiVariant(v.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          guiVariant === v.id
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Main Two-Column Layout: Left = Full GUI Editor, Right = Live Student Interactive Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT: FULL GUI BUILDER */}
                <div className="lg:col-span-7 space-y-5">
                  {/* Meta Settings Card */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-900">
                          Konfigurasi Dasar Instrumen
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Identitas umum kebiasaan yang dikelola.
                        </p>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                        Kode: {activeHabitKey}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Nama Kebiasaan</label>
                        <input
                          type="text"
                          value={currentConfig.title}
                          onChange={(e) => handleUpdateConfigField('title', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Subjudul / Rentang Waktu</label>
                        <input
                          type="text"
                          value={currentConfig.subtitle}
                          onChange={(e) => handleUpdateConfigField('subtitle', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Kategori Karakter</label>
                        <input
                          type="text"
                          value={currentConfig.category}
                          onChange={(e) => handleUpdateConfigField('category', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Maks Poin</label>
                          <input
                            type="number"
                            min={10}
                            max={100}
                            value={currentConfig.base_points}
                            onChange={(e) => handleUpdateConfigField('base_points', Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-blue-700"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Sesi Harian</label>
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={currentConfig.max_daily_sessions}
                            onChange={(e) => handleUpdateConfigField('max_daily_sessions', Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rubric Items GUI Builder */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-900">
                          Rubrik Opsi Jawaban &amp; Bobot Skor ({currentConfig.rubric.length} Opsi)
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Edit teks pertanyaan/opsi, tag, dan bobot poin secara visual.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddRubricItem}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah Opsi</span>
                      </button>
                    </div>

                    <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
                      {currentConfig.rubric.map((r, idx) => (
                        <div
                          key={r.id || idx}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-3 transition-colors hover:border-slate-300"
                        >
                          <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-black text-[10px] shrink-0">
                            {idx + 1}
                          </span>
                          <div className="flex-1 w-full sm:w-auto">
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              Teks Opsi / Kriteria
                            </label>
                            <input
                              type="text"
                              value={r.label}
                              onChange={(e) => handleUpdateRubricItem(r.id, 'label', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div className="w-24 shrink-0">
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              Tag / Kategori
                            </label>
                            <input
                              type="text"
                              value={r.tag}
                              onChange={(e) => handleUpdateRubricItem(r.id, 'tag', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none"
                            />
                          </div>
                          <div className="w-20 shrink-0">
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                              Skor Poin
                            </label>
                            <input
                              type="number"
                              value={r.score}
                              onChange={(e) => handleUpdateRubricItem(r.id, 'score', Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-black text-emerald-700 text-center focus:outline-none"
                            />
                          </div>
                          <div className="self-end sm:self-center shrink-0">
                            <button
                              type="button"
                              onClick={() => handleDeleteRubricItem(r.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Opsi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                      <span className="text-[11px] text-slate-500">
                        Total {currentConfig.rubric.length} kriteria terdaftar untuk <strong>{currentConfig.title}</strong>.
                      </span>
                      <button
                        type="button"
                        onClick={handleSaveGuiInstrument}
                        disabled={instrumentSaving}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Simpan Perubahan</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* RIGHT: LIVE INTERACTIVE STUDENT PREVIEW */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-5 text-white shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-black tracking-wide uppercase text-slate-200">
                          Live Preview Tampilan Murid
                        </span>
                      </div>
                      <span className="text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        Interaktif
                      </span>
                    </div>

                    {/* Simulated Student Habit Card */}
                    <div className="bg-white text-slate-900 rounded-2xl p-4 shadow-sm space-y-3.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                            {currentConfig.category}
                          </span>
                          <h4 className="font-extrabold text-sm text-slate-900 mt-1">
                            {currentConfig.title}
                          </h4>
                          <p className="text-[11px] text-slate-500">{currentConfig.subtitle}</p>
                        </div>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg shrink-0">
                          Maks {currentConfig.base_points} pt
                        </span>
                      </div>

                      {/* Interactive Simulation Form based on Habit */}
                      <div className="pt-2 border-t border-slate-100 space-y-3 text-xs">
                        {/* 1. BANGUN PAGI PREVIEW */}
                        {guiHabitCode === 'bangun' && (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                                Jam Berapa Kamu Bangun Pagi Hari Ini?
                              </label>
                              <div className="grid grid-cols-2 gap-1.5">
                                {['04.10', '04.30', '04.50', '05.30'].map((timeStr) => (
                                  <button
                                    key={timeStr}
                                    type="button"
                                    onClick={() => setPreviewSelections({ ...previewSelections, wakeTime: timeStr })}
                                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border text-center transition-all cursor-pointer ${
                                      previewSelections.wakeTime === timeStr
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    Pukul {timeStr} WIB
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Kondisi Fisik Saat Bangun:
                              </label>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => setPreviewSelections({ ...previewSelections, wakeFreshness: star })}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer transition-all ${
                                      previewSelections.wakeFreshness >= star
                                        ? 'bg-amber-400 text-amber-950 shadow-xs'
                                        : 'bg-slate-100 text-slate-400'
                                    }`}
                                  >
                                    ★ {star}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 2. BERIBADAH PREVIEW */}
                        {guiHabitCode === 'beribadah' && (
                          <div className="space-y-2">
                            {guiVariant === 'islam' && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                  Checklist Shalat Wajib 5 Waktu:
                                </span>
                                {[
                                  { key: 'islamSubuh', label: 'Shalat Subuh' },
                                  { key: 'islamDzuhur', label: 'Shalat Dzuhur' },
                                  { key: 'islamAshar', label: 'Shalat Ashar' },
                                  { key: 'islamMaghrib', label: 'Shalat Maghrib' },
                                  { key: 'islamIsya', label: 'Shalat Isya' },
                                ].map((s) => (
                                  <label key={s.key} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer font-bold text-[11px]">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(previewSelections[s.key])}
                                      onChange={(e) => setPreviewSelections({ ...previewSelections, [s.key]: e.target.checked })}
                                      className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span>{s.label}</span>
                                    <span className="ml-auto text-emerald-600 font-extrabold">+20 pt</span>
                                  </label>
                                ))}
                                <label className="flex items-center gap-2 p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 cursor-pointer font-bold text-[11px] text-emerald-900 mt-2">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(previewSelections.islamSunnah)}
                                    onChange={(e) => setPreviewSelections({ ...previewSelections, islamSunnah: e.target.checked })}
                                    className="w-4 h-4 text-emerald-600 rounded"
                                  />
                                  <span>Bonus Ibadah Sunnah (Dhuha / Rawatib)</span>
                                  <span className="ml-auto text-emerald-700 font-extrabold">+5 pt</span>
                                </label>
                              </div>
                            )}

                            {guiVariant === 'kristen' && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                  Checklist Ibadah &amp; Doa Harian:
                                </span>
                                {[
                                  { key: 'kristenDoaBangun', label: 'Doa Pagi Bangun Tidur' },
                                  { key: 'kristenAlkitab', label: 'Membaca Alkitab & Saat Teduh' },
                                  { key: 'kristenDoaMakan', label: 'Doa Saat Makan' },
                                  { key: 'kristenDoaBelajar', label: 'Doa Sebelum Belajar' },
                                  { key: 'kristenDoaTidur', label: 'Doa Malam Sebelum Tidur' },
                                ].map((s) => (
                                  <label key={s.key} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer font-bold text-[11px]">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(previewSelections[s.key])}
                                      onChange={(e) => setPreviewSelections({ ...previewSelections, [s.key]: e.target.checked })}
                                      className="w-4 h-4 text-purple-600 rounded"
                                    />
                                    <span>{s.label}</span>
                                    <span className="ml-auto text-purple-700 font-extrabold">+20 pt</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {guiVariant === 'hindu' && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                  Checklist Doa Tri Sandhya:
                                </span>
                                {[
                                  { key: 'hinduTriPagi', label: 'Tri Sandhya Pagi (06.00 WIB)', pt: 35 },
                                  { key: 'hinduTriSiang', label: 'Tri Sandhya Siang (12.00 WIB)', pt: 35 },
                                  { key: 'hinduTriSore', label: 'Tri Sandhya Sore (18.00 WIB)', pt: 30 },
                                ].map((s) => (
                                  <label key={s.key} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer font-bold text-[11px]">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(previewSelections[s.key])}
                                      onChange={(e) => setPreviewSelections({ ...previewSelections, [s.key]: e.target.checked })}
                                      className="w-4 h-4 text-amber-600 rounded"
                                    />
                                    <span>{s.label}</span>
                                    <span className="ml-auto text-amber-700 font-extrabold">+{s.pt} pt</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {guiVariant === 'halangan' && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">
                                  Amalan Pengganti Udzur Syar'i:
                                </span>
                                {[
                                  { key: 'halanganDzikir', label: 'Berdzikir dan Berdoa' },
                                  { key: 'halanganMendengar', label: "Mendengar / Muraja'ah Al-Qur'an" },
                                  { key: 'halanganKebaikan', label: 'Berbuat Baik & Sedekah' },
                                  { key: 'halanganKajian', label: 'Belajar Ilmu Agama / Adab' },
                                  { key: 'halanganKebersihan', label: 'Menjaga Kebersihan & Kebugaran' },
                                ].map((s) => (
                                  <label key={s.key} className="flex items-center gap-2 p-1.5 rounded-lg bg-rose-50/60 border border-rose-100 cursor-pointer font-bold text-[11px] text-rose-900">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(previewSelections[s.key])}
                                      onChange={(e) => setPreviewSelections({ ...previewSelections, [s.key]: e.target.checked })}
                                      className="w-4 h-4 text-rose-600 rounded"
                                    />
                                    <span>{s.label}</span>
                                    <span className="ml-auto text-rose-700 font-extrabold">+20 pt</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 3. MAKAN BERGIZI PREVIEW */}
                        {guiHabitCode === 'makan' && (
                          <div className="space-y-2.5">
                            <div className="p-2 bg-slate-50 rounded-xl space-y-1.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Komposisi Piring Gizi Seimbang:
                              </span>
                              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                {[
                                  { key: 'makanKarbo', label: 'Karbohidrat Sehat', score: 17.5 },
                                  { key: 'makanLauk', label: 'Lauk Berprotein', score: 17.5 },
                                  { key: 'makanSayur', label: 'Sayuran Hijau', score: 15 },
                                  { key: 'makanBuah', label: 'Buah Segar', score: 15 },
                                ].map((item) => (
                                  <label key={item.key} className="flex items-center gap-1.5 font-bold cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(previewSelections[item.key])}
                                      onChange={(e) => setPreviewSelections({ ...previewSelections, [item.key]: e.target.checked })}
                                      className="w-3.5 h-3.5 text-emerald-600 rounded"
                                    />
                                    <span>{item.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <label className="flex-1 flex items-center gap-1.5 p-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-900 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(previewSelections.makanKotak)}
                                  onChange={(e) => setPreviewSelections({ ...previewSelections, makanKotak: e.target.checked })}
                                  className="w-3.5 h-3.5 text-emerald-600 rounded"
                                />
                                <span>Kotak Makan Sendiri (+5)</span>
                              </label>
                              <label className="flex-1 flex items-center gap-1.5 p-1.5 bg-blue-50 border border-blue-200 rounded-lg text-[10px] font-bold text-blue-900 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(previewSelections.makanTumbler)}
                                  onChange={(e) => setPreviewSelections({ ...previewSelections, makanTumbler: e.target.checked })}
                                  className="w-3.5 h-3.5 text-blue-600 rounded"
                                />
                                <span>Tumbler Air Sendiri (+5)</span>
                              </label>
                            </div>
                          </div>
                        )}

                        {/* 4. BEROLAHRAGA PREVIEW */}
                        {guiHabitCode === 'berolahraga' && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">Durasi Olahraga:</label>
                              <div className="grid grid-cols-3 gap-1">
                                {['15', '30', '45'].map((dur) => (
                                  <button
                                    key={dur}
                                    type="button"
                                    onClick={() => setPreviewSelections({ ...previewSelections, olahragaDurasi: dur })}
                                    className={`py-1 rounded-lg text-[11px] font-bold border text-center cursor-pointer ${
                                      previewSelections.olahragaDurasi === dur
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-slate-50 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    {dur} Menit
                                  </button>
                                ))}
                              </div>
                            </div>
                            <label className="flex items-center gap-2 p-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] font-bold text-emerald-900 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(previewSelections.olahragaAdiwiyata)}
                                onChange={(e) => setPreviewSelections({ ...previewSelections, olahragaAdiwiyata: e.target.checked })}
                                className="w-4 h-4 text-emerald-600 rounded"
                              />
                              <span>Bonus Adiwiyata: Bersepeda/Jalan Kaki (+5 pt)</span>
                            </label>
                          </div>
                        )}

                        {/* 5. GEMAR BELAJAR PREVIEW */}
                        {guiHabitCode === 'belajar' && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">Durasi Belajar Mandiri:</label>
                              <div className="grid grid-cols-3 gap-1">
                                {['30', '60', '90'].map((dur) => (
                                  <button
                                    key={dur}
                                    type="button"
                                    onClick={() => setPreviewSelections({ ...previewSelections, belajarDurasi: dur })}
                                    className={`py-1 rounded-lg text-[11px] font-bold border text-center cursor-pointer ${
                                      previewSelections.belajarDurasi === dur
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-slate-50 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    {dur} Menit
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">Catatan Hasil Belajar:</label>
                              <input
                                type="text"
                                value={previewSelections.belajarCatatan}
                                onChange={(e) => setPreviewSelections({ ...previewSelections, belajarCatatan: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                              />
                            </div>
                          </div>
                        )}

                        {/* 6. BERMASYARAKAT PREVIEW */}
                        {guiHabitCode === 'bermasyarakat' && (
                          <div className="space-y-1.5">
                            {[
                              { key: 'masyarakatOrtu', label: 'Membantu Pekerjaan Rumah Tangga' },
                              { key: 'masyarakat5S', label: 'Menerapkan 5S di Lingkungan' },
                              { key: 'masyarakatAdiwiyata', label: 'Aksi Pilah Sampah / Kerja Bakti' },
                              { key: 'masyarakatTolong', label: 'Tolong Menolong Teman / Sesama' },
                            ].map((m) => (
                              <label key={m.key} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer font-bold text-[11px]">
                                <input
                                  type="checkbox"
                                  checked={Boolean(previewSelections[m.key])}
                                  onChange={(e) => setPreviewSelections({ ...previewSelections, [m.key]: e.target.checked })}
                                  className="w-4 h-4 text-emerald-600 rounded"
                                />
                                <span>{m.label}</span>
                                <span className="ml-auto text-emerald-700 font-extrabold">+25 pt</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {/* 7. TIDUR CEPAT PREVIEW */}
                        {guiHabitCode === 'tidur' && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">Jam Berapa Kamu Mulai Tidur?</label>
                              <div className="grid grid-cols-2 gap-1.5">
                                {['21.15', '21.45', '22.15', '22.45'].map((timeStr) => (
                                  <button
                                    key={timeStr}
                                    type="button"
                                    onClick={() => setPreviewSelections({ ...previewSelections, tidurWaktu: timeStr })}
                                    className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border text-center transition-all cursor-pointer ${
                                      previewSelections.tidurWaktu === timeStr
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    Pukul {timeStr} WIB
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[11px] font-bold cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(previewSelections.tidurLayar)}
                                  onChange={(e) => setPreviewSelections({ ...previewSelections, tidurLayar: e.target.checked })}
                                  className="w-3.5 h-3.5 text-indigo-600 rounded"
                                />
                                <span>Matikan Gadget 15m Sebelum Tidur (+10 pt)</span>
                              </label>
                              <label className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[11px] font-bold cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(previewSelections.tidurPersiapan)}
                                  onChange={(e) => setPreviewSelections({ ...previewSelections, tidurPersiapan: e.target.checked })}
                                  className="w-3.5 h-3.5 text-indigo-600 rounded"
                                />
                                <span>Siapkan Seragam &amp; Buku Esok Hari (+10 pt)</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Live Calculated Score Bar */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Simulasi Skor Murid:
                          </span>
                          <span className="text-xl font-black text-emerald-700">
                            100 / 100 pt
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-xl">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Status: Sempurna</span>
                        </div>
                      </div>
                    </div>

                    {/* Explanatory Tip */}
                    <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-[11px] text-slate-300 space-y-1">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pratinjau Murid Otomatis:</span>
                      </div>
                      <p>
                        Setiap perubahan pada nama, opsi jawaban, dan skor di panel sebelah kiri langsung tercermin pada formulir interaktif di atas sehingga Anda dapat memverifikasi pengalaman murid sebelum menyimpannya ke database.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: VALIDASI PRESTASI MURID & UPDATE SKEMA PENILAIAN (Section 8, 10, 11) */}
          {activeTab === 'achievements' && (
            <div className="space-y-6">
              {/* Header Card */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      Modul Prestasi Siswa
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">• Validasi &amp; Poin Hebat</span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight mt-1">
                    Validasi Pengajuan Prestasi Murid (Total: {adminAchievements.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
                    Verifikasi sertifikat, piagam, dan kejuaraan siswa. Admin memiliki hak prerogatif untuk mengetik nilai akhir yang diberikan sesuai skema penilaian jenjang kompetisi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRubricEditing(JSON.parse(JSON.stringify(achievementRubric)));
                    setIsRubricModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-sm cursor-pointer flex items-center justify-center gap-2 shrink-0 transition-all"
                >
                  <Sliders className="w-4 h-4 text-amber-400" />
                  Update Skema Penilaian
                </button>
              </div>

              {/* Status Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Pengajuan</span>
                  <span className="text-2xl font-black text-slate-900 block mt-1">{adminAchievements.length}</span>
                  <span className="text-[11px] text-slate-500 font-medium">Sertifikat terdaftar</span>
                </div>
                <div className="bg-amber-50/80 p-4 rounded-3xl border border-amber-200 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">Menunggu Validasi</span>
                  <span className="text-2xl font-black text-amber-900 block mt-1">
                    {adminAchievements.filter((a) => a.status === 'pending').length}
                  </span>
                  <span className="text-[11px] text-amber-700 font-medium">Perlu ditinjau</span>
                </div>
                <div className="bg-emerald-50/80 p-4 rounded-3xl border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">Disetujui</span>
                  <span className="text-2xl font-black text-emerald-900 block mt-1">
                    {adminAchievements.filter((a) => a.status === 'approved').length}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-medium">Poin telah masuk</span>
                </div>
                <div className="bg-rose-50/80 p-4 rounded-3xl border border-rose-200 shadow-2xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 block">Ditolak</span>
                  <span className="text-2xl font-black text-rose-900 block mt-1">
                    {adminAchievements.filter((a) => a.status === 'rejected').length}
                  </span>
                  <span className="text-[11px] text-rose-700 font-medium">Tidak memenuhi kriteria</span>
                </div>
              </div>

              {/* Skema Penilaian Aktif Card */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Skema Acuan Nilai Per Jenjang (Dapat Diperbarui Sewaktu-waktu):
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold italic">
                    Admin berhak mengetik nilai yang fleksibel
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-0.5"
                    >
                      <span className="text-[10px] font-black uppercase text-slate-600 block truncate">
                        {item.level}
                      </span>
                      <span className="text-base font-black text-amber-700 block">
                        +{item.default_points || item.min_points} pt
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium block">
                        {item.min_points} – {item.max_points} pt
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table of Submissions */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {[
                      { id: 'all' as const, label: 'Semua Status' },
                      { id: 'pending' as const, label: 'Menunggu Validasi' },
                      { id: 'approved' as const, label: 'Disetujui' },
                      { id: 'rejected' as const, label: 'Ditolak' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setAchFilterStatus(f.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          achFilterStatus === f.id
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Cari murid, NIS, nama prestasi..."
                      value={achSearchQuery}
                      onChange={(e) => setAchSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 text-[11px] font-extrabold text-slate-500 uppercase border-b border-slate-200">
                        <th className="py-3 px-3.5">Murid</th>
                        <th className="py-3 px-3.5">Nama Prestasi &amp; Bukti</th>
                        <th className="py-3 px-3.5">Jenis &amp; Jenjang</th>
                        <th className="py-3 px-3.5">Kategori</th>
                        <th className="py-3 px-3.5">Tanggal</th>
                        <th className="py-3 px-3.5">Pencapaian</th>
                        <th className="py-3 px-3.5">Status &amp; Nilai</th>
                        <th className="py-3 px-3.5 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminAchievements
                        .filter((item) => {
                          if (achFilterStatus !== 'all' && item.status !== achFilterStatus) return false;
                          if (achSearchQuery.trim()) {
                            const q = achSearchQuery.toLowerCase();
                            const matchesName = (item.student_name || '').toLowerCase().includes(q);
                            const matchesNis = (item.student_nis || '').includes(q);
                            const matchesClass = (item.student_class || '').toLowerCase().includes(q);
                            const matchesPres = (item.nama_prestasi || '').toLowerCase().includes(q);
                            if (!matchesName && !matchesNis && !matchesClass && !matchesPres) return false;
                          }
                          return true;
                        })
                        .map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3.5">
                              <span className="font-bold text-slate-900 block">{item.student_name || 'Murid'}</span>
                              <span className="text-[10px] text-slate-400 block font-medium">
                                NIS: {item.student_nis || '-'} • Kelas {item.student_class || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-3.5">
                              <span className="font-black text-slate-900 block">{item.nama_prestasi}</span>
                              {item.cerita && (
                                <span className="text-[10px] text-slate-500 block truncate max-w-xs mt-0.5 italic">
                                  &quot;{item.cerita}&quot;
                                </span>
                              )}
                              {item.bukti_url && (
                                <a
                                  href={item.bukti_url.startsWith('http') ? item.bukti_url : `https://${item.bukti_url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-blue-600 font-semibold underline block truncate max-w-xs mt-0.5"
                                >
                                  Bukti: {item.bukti_url}
                                </a>
                              )}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px] block w-fit mb-1">
                                {item.jenis_prestasi}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-extrabold text-[10px] block w-fit">
                                {item.jenjang}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-slate-600 font-medium whitespace-nowrap">
                              {item.kategori || 'Individu'}
                            </td>
                            <td className="py-3 px-3.5 text-slate-600 font-medium whitespace-nowrap">
                              {item.tanggal || '-'}
                            </td>
                            <td className="py-3 px-3.5 font-semibold text-slate-800">
                              {item.pencapaian || '-'}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              {item.status === 'approved' ? (
                                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] inline-flex items-center gap-1 shadow-2xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Approved (+{item.points_awarded} pt)
                                </span>
                              ) : item.status === 'rejected' ? (
                                <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-black text-[10px]">
                                  Ditolak
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-black text-[10px] inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  Menunggu Validasi
                                </span>
                              )}
                              {item.admin_notes && (
                                <span className="text-[10px] text-slate-400 italic block mt-0.5 truncate max-w-[140px]">
                                  Catatan: {item.admin_notes}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenValidateModal(item)}
                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-all"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                Validasi
                              </button>
                            </td>
                          </tr>
                        ))}
                      {adminAchievements.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                            Belum ada murid yang mengajukan prestasi atau sertifikat.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* MODAL VALIDASI PRESTASI OLEH ADMIN */}
              {validatingAch && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                          <Award className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-base text-slate-900">
                            Validasi Prestasi Murid
                          </h3>
                          <p className="text-xs text-slate-500">
                            Hak prerogatif admin untuk memberikan skor &amp; feedback
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setValidatingAch(null)}
                        className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Summary Info */}
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-semibold">Nama Murid:</span>
                        <strong className="text-slate-900">{validatingAch.student_name} ({validatingAch.student_class})</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-semibold">Nama Prestasi:</span>
                        <strong className="text-slate-900">{validatingAch.nama_prestasi}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-semibold">Jenjang &amp; Jenis:</span>
                        <span className="font-bold text-amber-800">{validatingAch.jenjang} • {validatingAch.jenis_prestasi} ({validatingAch.kategori})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-semibold">Pencapaian:</span>
                        <strong className="text-slate-900">{validatingAch.pencapaian || '-'}</strong>
                      </div>
                      {validatingAch.cerita && (
                        <div className="pt-1 border-t border-slate-200 text-slate-600 italic">
                          &quot;{validatingAch.cerita}&quot;
                        </div>
                      )}
                      {validatingAch.bukti_url && (
                        <div className="pt-1 border-t border-slate-200">
                          <span className="text-slate-500 block text-[11px]">Link / File Bukti:</span>
                          <a
                            href={validatingAch.bukti_url.startsWith('http') ? validatingAch.bukti_url : `https://${validatingAch.bukti_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline font-semibold truncate block"
                          >
                            {validatingAch.bukti_url}
                          </a>
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleSaveValidation} className="space-y-4 text-xs">
                      {/* Status Selection */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1.5">
                          Keputusan Validasi:
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                          <label
                            onClick={() => setValidationForm({ ...validationForm, status: 'approved' })}
                            className={`p-3 rounded-2xl border-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                              validationForm.status === 'approved'
                                ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500 text-emerald-950 font-black'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            <input
                              type="radio"
                              name="val_status"
                              checked={validationForm.status === 'approved'}
                              onChange={() => setValidationForm({ ...validationForm, status: 'approved' })}
                              className="text-emerald-600"
                            />
                            <span>Disetujui (Approved)</span>
                          </label>

                          <label
                            onClick={() => setValidationForm({ ...validationForm, status: 'rejected' })}
                            className={`p-3 rounded-2xl border-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                              validationForm.status === 'rejected'
                                ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500 text-rose-950 font-black'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            <input
                              type="radio"
                              name="val_status"
                              checked={validationForm.status === 'rejected'}
                              onChange={() => setValidationForm({ ...validationForm, status: 'rejected' })}
                              className="text-rose-600"
                            />
                            <span>Ditolak (Rejected)</span>
                          </label>
                        </div>
                      </div>

                      {/* Points input (Admin Prerogative, typed in) */}
                      {validationForm.status === 'approved' && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block font-bold text-slate-700">
                              Nilai Poin Hebat yang Diberikan (Ketik Nilai):
                            </label>
                            <span className="text-[10px] text-amber-700 font-extrabold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              Hak Prerogatif Admin
                            </span>
                          </div>
                          <input
                            type="number"
                            min="1"
                            max="300"
                            required
                            value={validationForm.points_awarded}
                            onChange={(e) =>
                              setValidationForm({ ...validationForm, points_awarded: Number(e.target.value) })
                            }
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-black text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden text-base"
                          />
                          <p className="text-[11px] text-slate-500 mt-1">
                            Rekomendasi skema jenjang <strong>{validatingAch.jenjang}</strong>:{' '}
                            {achievementRubric.find((r) => r.level.toLowerCase() === (validatingAch.jenjang || '').toLowerCase())?.min_points || 10}{' '}
                            s.d.{' '}
                            {achievementRubric.find((r) => r.level.toLowerCase() === (validatingAch.jenjang || '').toLowerCase())?.max_points || 50}{' '}
                            poin. Nilai ini langsung ditambahkan ke Poin Hebat murid.
                          </p>
                        </div>
                      )}

                      {/* Admin Notes */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Catatan / Feedback untuk Murid (Opsional):
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Contoh: Selamat atas perolehan medali emas OSN! Tetap rendah hati dan giat belajar."
                          value={validationForm.admin_notes}
                          onChange={(e) => setValidationForm({ ...validationForm, admin_notes: e.target.value })}
                          className="w-full p-3 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden resize-y"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setValidatingAch(null)}
                          className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black shadow-sm cursor-pointer transition-all"
                        >
                          {loading ? 'Menyimpan...' : 'Simpan Keputusan'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* MODAL UPDATE SKEMA RUBRIK PENILAIAN */}
              {isRubricModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                          <Sliders className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-base text-slate-900">
                            Update Skema Rubrik Penilaian Prestasi
                          </h3>
                          <p className="text-xs text-slate-500">
                            Sesuaikan rentang skor poin per jenjang kompetisi sewaktu-waktu
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsRubricModalOpen(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleSaveRubric} className="space-y-4">
                      <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px]">
                              <th className="py-2.5 px-3">Tingkat Jenjang</th>
                              <th className="py-2.5 px-3">Poin Minimal</th>
                              <th className="py-2.5 px-3">Poin Maksimal</th>
                              <th className="py-2.5 px-3">Poin Standar / Rekomendasi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rubricEditing.map((r, idx) => (
                              <tr key={r.level}>
                                <td className="py-2.5 px-3 font-black text-slate-900">
                                  {r.level}
                                </td>
                                <td className="py-2.5 px-3">
                                  <input
                                    type="number"
                                    min="1"
                                    max="500"
                                    required
                                    value={r.min_points}
                                    onChange={(e) => {
                                      const updated = [...rubricEditing];
                                      updated[idx].min_points = Number(e.target.value);
                                      setRubricEditing(updated);
                                    }}
                                    className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 font-bold text-center"
                                  />
                                </td>
                                <td className="py-2.5 px-3">
                                  <input
                                    type="number"
                                    min="1"
                                    max="500"
                                    required
                                    value={r.max_points}
                                    onChange={(e) => {
                                      const updated = [...rubricEditing];
                                      updated[idx].max_points = Number(e.target.value);
                                      setRubricEditing(updated);
                                    }}
                                    className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 font-bold text-center"
                                  />
                                </td>
                                <td className="py-2.5 px-3">
                                  <input
                                    type="number"
                                    min="1"
                                    max="500"
                                    required
                                    value={r.default_points || r.min_points}
                                    onChange={(e) => {
                                      const updated = [...rubricEditing];
                                      updated[idx].default_points = Number(e.target.value);
                                      setRubricEditing(updated);
                                    }}
                                    className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 font-black text-amber-700 text-center"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setIsRubricModalOpen(false)}
                          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={rubricSaving}
                          className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black shadow-sm cursor-pointer transition-all"
                        >
                          {rubricSaving ? 'Menyimpan...' : 'Simpan Perubahan Skema'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DATA MURID (DROPDOWNS FOR KELAS & WALI, DEMO CHECKBOX, CRUD) */}
          {activeTab === 'students' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Data Akun Murid (Total: {adminStudents.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Input, edit, dan hapus akun murid. Pilihan kelas dan guru wali menggunakan dropdown data master.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStudentForm({
                      id: '',
                      nisn: '',
                      name: '',
                      password: '123',
                      gender: 'L',
                      religion: 'Islam',
                      class_name: classesRombelsData.classes[0]?.name || 'X-1',
                      rombel_name: classesRombelsData.rombels[0]?.name || 'Rombel A',
                      wali_name: classesRombelsData.rombels[0]?.wali_name || '',
                      angkatan: 'XI',
                      status: 'ACTIVE',
                      is_demo: 0,
                    });
                    setStudentModalOpen(true);
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Murid Baru</span>
                </button>
              </div>

              {/* Filter Bar */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3 text-xs">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari nama atau NIS murid..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-semibold focus:outline-none"
                  />
                </div>
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="ALL">Semua Kelas</option>
                  {classesRombelsData.classes.map((c) => (
                    <option key={c.id || c.name} value={c.name}>Kelas {c.name}</option>
                  ))}
                </select>
              </div>

              {/* Students Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase">
                      <th className="py-3 px-4">Nama Murid</th>
                      <th className="py-3 px-4">Kelas &amp; Jenjang</th>
                      <th className="py-3 px-4">Guru Wali</th>
                      <th className="py-3 px-4 text-center">Agama</th>
                      <th className="py-3 px-4 text-center">Status Akun</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {adminStudents
                      .filter((s) => {
                        if (studentSearch) {
                          const q = studentSearch.toLowerCase();
                          if (!s.name.toLowerCase().includes(q) && !s.nisn.includes(q)) return false;
                        }
                        if (filterClass !== 'ALL' && s.class_name !== filterClass) return false;
                        return true;
                      })
                      .map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div>{s.name}</div>
                            <span className="text-[10px] text-slate-400 font-normal">NIS: {s.nisn}</span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-700">
                            <div>Kelas {s.class_name}</div>
                            <span className="text-[10px] text-blue-600 font-extrabold">Jenjang {s.angkatan || 'XI'}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{s.wali_name || s.rombel_name || '-'}</td>
                          <td className="py-3 px-4 text-center text-slate-700 font-medium">{s.religion || 'Islam'}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              {s.account_status || 'ACTIVE'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setStudentForm({
                                    id: s.id,
                                    nisn: s.nisn,
                                    name: s.name,
                                    password: s.password || '123',
                                    gender: s.gender || 'L',
                                    religion: s.religion || 'Islam',
                                    class_name: s.class_name,
                                    rombel_name: s.rombel_name,
                                    wali_name: s.wali_name || s.rombel_name,
                                    angkatan: s.angkatan || 'XI',
                                    status: s.account_status || 'ACTIVE',
                                    is_demo: s.is_demo ? 1 : 0,
                                  });
                                  setStudentModalOpen(true);
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                                title="Edit Murid"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStudent(s.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg cursor-pointer"
                                title="Hapus Murid"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Student Create / Edit Modal */}
              {studentModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-base text-slate-900">
                        {studentForm.id ? 'Edit Data Murid' : 'Tambah Murid Baru'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setStudentModalOpen(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleSaveStudent} className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">NIS (Wajib)</label>
                          <input
                            type="text"
                            value={studentForm.nisn}
                            onChange={(e) => setStudentForm({ ...studentForm, nisn: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                            required
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Password Login (Dapat Dilihat)</label>
                          <input
                            type="text"
                            value={studentForm.password}
                            onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Murid</label>
                        <input
                          type="text"
                          value={studentForm.name}
                          onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Jenis Kelamin</label>
                          <select
                            value={studentForm.gender}
                            onChange={(e) => setStudentForm({ ...studentForm, gender: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                          >
                            <option value="L">Laki-laki (L)</option>
                            <option value="P">Perempuan (P)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Agama</label>
                          <select
                            value={studentForm.religion}
                            onChange={(e) => setStudentForm({ ...studentForm, religion: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                          >
                            <option value="Islam">Islam</option>
                            <option value="Kristen">Kristen</option>
                            <option value="Katolik">Katolik</option>
                            <option value="Hindu">Hindu</option>
                            <option value="Buddha">Buddha</option>
                            <option value="Konghucu">Konghucu</option>
                          </select>
                        </div>
                      </div>

                      {/* Dropdowns for Kelas, Jenjang, & Guru Wali */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Pilih Kelas</label>
                          <select
                            value={studentForm.class_name}
                            onChange={(e) => setStudentForm({ ...studentForm, class_name: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                            required
                          >
                            {classesRombelsData.classes.map((c) => (
                              <option key={c.id || c.name} value={c.name}>Kelas {c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Jenjang</label>
                          <select
                            value={studentForm.angkatan || 'XI'}
                            onChange={(e) => setStudentForm({ ...studentForm, angkatan: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                            required
                          >
                            <option value="X">Jenjang X (Kelas 10)</option>
                            <option value="XI">Jenjang XI (Kelas 11)</option>
                            <option value="XII">Jenjang XII (Kelas 12)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Guru Wali</label>
                          <select
                            value={studentForm.wali_name || studentForm.rombel_name}
                            onChange={(e) =>
                              setStudentForm({
                                ...studentForm,
                                wali_name: e.target.value,
                                rombel_name: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                            required
                          >
                            <option value="">-- Pilih Guru Wali --</option>
                            {classesRombelsData.rombels.map((r) => (
                              <option key={r.id || r.name} value={r.wali_name || r.name}>
                                {r.wali_name || r.name}
                              </option>
                            ))}
                            {adminTeachers
                              .filter((t) => t.is_wali || t.roles_csv?.includes('WALI'))
                              .map((t) => (
                                <option key={t.id} value={t.name}>
                                  {t.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>



                      <div className="pt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setStudentModalOpen(false)}
                          className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                        >
                          Simpan Data Murid
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DATA GURU & ROLE CHECKBOXES */}
          {activeTab === 'teachers' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Data Dewan Guru &amp; Penugasan (Total: {adminTeachers.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Penugasan guru berbasis checkbox wewenang ganda (Walas, Guru Wali, Tim 7 KAIH).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTeacherForm({
                      id: '',
                      nip: '',
                      name: '',
                      password: '123',
                      subject: 'Pendidikan Karakter',
                      is_walas: true,
                      is_wali: false,
                      is_tim_7_kaih: false,
                      class_name: classesRombelsData.classes[0]?.name || 'X-1',
                      is_demo: 0,
                    });
                    setTeacherModalOpen(true);
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Guru Baru</span>
                </button>
              </div>

              {/* Teachers Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase">
                      <th className="py-3 px-4">Nama Guru</th>
                      <th className="py-3 px-4">Username Login</th>
                      <th className="py-3 px-4">Wewenang / Penugasan</th>
                      <th className="py-3 px-4">Kelas Binaan Walas</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {adminTeachers.map((t) => {
                      const tWalas = Boolean(t.is_walas || t.roles_csv?.includes('WALAS') || t.assignment_type === 'WALAS');
                      const tWali = Boolean(t.is_wali || t.roles_csv?.includes('WALI') || t.assignment_type === 'WALI');
                      const tTim = Boolean(t.is_tim_7_kaih || t.roles_csv?.includes('TIM_7_KAIH') || t.assignment_type === 'TIM_7_KAIH');

                      return (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div>{t.name}</div>
                            <span className="text-[10px] text-slate-400 font-normal">NIP: {t.nip || '-'}</span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">{t.username || t.nip || '-'}</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {tWalas && (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                  Walas
                                </span>
                              )}
                              {tWali && (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-purple-100 text-purple-800">
                                  Guru Wali
                                </span>
                              )}
                              {tTim && (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-blue-100 text-blue-800">
                                  Tim 7 KAIH
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {tWalas ? `Kelas ${t.class_name || '-'}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setTeacherForm({
                                    id: t.id,
                                    nip: t.nip,
                                    username: t.username || t.nip,
                                    name: t.name,
                                    password: t.password || '123',
                                    subject: t.subject || 'Pendidikan Karakter',
                                    is_walas: tWalas,
                                    is_wali: tWali,
                                    is_tim_7_kaih: tTim,
                                    class_name: t.class_name || 'X-1',
                                    is_demo: t.is_demo ? 1 : 0,
                                  });
                                  setTeacherModalOpen(true);
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                                title="Edit Guru"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTeacher(t.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg cursor-pointer"
                                title="Hapus Guru"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Teacher Create / Edit Modal */}
              {teacherModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-base text-slate-900">
                        {teacherForm.id ? 'Edit Data Guru & Penugasan' : 'Tambah Guru Baru'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setTeacherModalOpen(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleSaveTeacher} className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">NIP Guru</label>
                          <input
                            type="text"
                            value={teacherForm.nip}
                            onChange={(e) => setTeacherForm({ ...teacherForm, nip: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                            required
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Username Login</label>
                          <input
                            type="text"
                            value={teacherForm.username || ''}
                            onChange={(e) => setTeacherForm({ ...teacherForm, username: e.target.value })}
                            placeholder={teacherForm.nip ? `guru_${teacherForm.nip}` : 'Opsional (default: NIP)'}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Guru</label>
                          <input
                            type="text"
                            value={teacherForm.name}
                            onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                            required
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Password Login (Dapat Dilihat)</label>
                          <input
                            type="text"
                            value={teacherForm.password}
                            onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold"
                            placeholder="123"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Mata Pelajaran</label>
                        <input
                          type="text"
                          value={teacherForm.subject}
                          onChange={(e) => setTeacherForm({ ...teacherForm, subject: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200"
                        />
                      </div>

                      {/* Checkbox Roles (Multi-Role) */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                        <label className="block font-extrabold text-slate-800">
                          Wewenang / Penugasan Guru (Bisa pilih 2 atau lebih):
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <label className="flex items-center gap-2 font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(teacherForm.is_walas)}
                              onChange={(e) =>
                                setTeacherForm({
                                  ...teacherForm,
                                  is_walas: e.target.checked,
                                  class_name: e.target.checked ? teacherForm.class_name || 'X-1' : '',
                                })
                              }
                              className="w-4 h-4 text-emerald-600 rounded"
                            />
                            <span>Wali Kelas</span>
                          </label>

                          <label className="flex items-center gap-2 font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(teacherForm.is_wali)}
                              onChange={(e) =>
                                setTeacherForm({ ...teacherForm, is_wali: e.target.checked })
                              }
                              className="w-4 h-4 text-purple-600 rounded"
                            />
                            <span>Guru Wali</span>
                          </label>

                          <label className="flex items-center gap-2 font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(teacherForm.is_tim_7_kaih)}
                              onChange={(e) =>
                                setTeacherForm({ ...teacherForm, is_tim_7_kaih: e.target.checked })
                              }
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span>Tim 7 KAIH</span>
                          </label>
                        </div>
                      </div>

                      {/* Kelas Binaan Walas Dropdown (Enabled ONLY when Walas is checked) */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Kelas Binaan Walas: {!teacherForm.is_walas && <span className="text-slate-400 font-normal">(Centang Walas untuk memilih)</span>}
                        </label>
                        <select
                          value={teacherForm.class_name || ''}
                          disabled={!teacherForm.is_walas}
                          onChange={(e) => setTeacherForm({ ...teacherForm, class_name: e.target.value })}
                          className={`w-full px-3 py-2 rounded-xl border font-bold text-xs ${
                            teacherForm.is_walas
                              ? 'bg-white border-emerald-300 text-slate-900 cursor-pointer'
                              : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <option value="">-- Pilih Kelas Binaan --</option>
                          {classesRombelsData.classes.map((c) => (
                            <option key={c.id || c.name} value={c.name}>
                              Kelas {c.name} {c.walas_name && c.walas_name !== teacherForm.name ? `(Walas: ${c.walas_name})` : '(Tersedia)'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="pt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setTeacherModalOpen(false)}
                          className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                        >
                          Simpan Data Guru
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: KLASIFIKASI MURID (JENJANG, KELAS, & GURU WALI) */}
          {activeTab === 'classes_rombels' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Klasifikasi Murid (Jenjang, Kelas &amp; Guru Wali)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kelola klasifikasi jenjang (X, XI, XII), pembuatan kelas dan penugasan Walas, serta kelompok bimbingan Guru Wali sekolah.
                </p>
              </div>

              {/* 0. Master Jenjang Murid (Fixed 3 Cohorts: X, XI, XII) */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">
                      Master Jenjang Murid (Tingkat X, XI, XII)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Tingkat jenjang bersifat tetap (X, XI, XII). Anda dapat mengubah nama label untuk setiap tingkatan di bawah ini.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Tingkat Jenjang</th>
                        <th className="py-2.5 px-3">Label / Nama Jenjang</th>
                        <th className="py-2.5 px-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cohortsList.map((coh) => (
                        <tr key={coh.id}>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg font-black text-xs">
                              Tingkat {coh.grade_level || coh.id.replace('coh-', '')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            {editingCohortId === coh.id ? (
                              <input
                                type="text"
                                value={editingCohortName}
                                onChange={(e) => setEditingCohortName(e.target.value)}
                                className="px-2.5 py-1.5 rounded-xl border border-blue-400 font-bold text-xs w-full max-w-sm focus:outline-none"
                                autoFocus
                              />
                            ) : (
                              <span className="font-bold text-slate-800">{coh.name}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {editingCohortId === coh.id ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSaveCohortLabel(coh.id)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] cursor-pointer"
                                >
                                  Simpan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCohortId(null)}
                                  className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg font-bold text-[11px] cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCohortId(coh.id);
                                  setEditingCohortName(coh.name);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Ubah Label</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* KONTAINER 1: MASTER KELAS SMAN 28 */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      Kontainer 1 (Atas)
                    </span>
                    <h3 className="font-extrabold text-base text-slate-900 mt-1">
                      Master Kelas SMAN 28 ({classesRombelsData.classes.length} Kelas)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pilih baris kelas untuk mengelola daftar murid di kontainer bawah. Walas dapat ditugaskan langsung.
                    </p>
                  </div>

                  <form onSubmit={handleSaveClass} className="flex gap-2 text-xs">
                    <input
                      type="text"
                      value={newClassForm.name}
                      onChange={(e) => setNewClassForm({ ...newClassForm, name: e.target.value })}
                      placeholder="Nama Kelas (mis. X-5)"
                      className="w-44 px-3 py-2 rounded-xl border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shrink-0 shadow-xs"
                    >
                      + Tambah Kelas
                    </button>
                  </form>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Nama Kelas</th>
                        <th className="py-2.5 px-3">Wali Kelas (Walas)</th>
                        <th className="py-2.5 px-3 text-center">Jumlah Murid</th>
                        <th className="py-2.5 px-3 text-center">Status Pemilihan</th>
                        <th className="py-2.5 px-3 text-center">Aksi Hapus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {classesRombelsData.classes.map((c) => {
                        const hasWalas = Boolean(c.walas_name && c.walas_name !== '-');
                        const studentCount = allStudents.filter((s) => s.class_name === c.name).length;
                        const isSelected =
                          selectedClassId === c.id ||
                          selectedClassId === c.name ||
                          (!selectedClassId && classesRombelsData.classes[0]?.id === c.id);

                        return (
                          <tr
                            key={c.id || c.name}
                            onClick={() => setSelectedClassId(c.name)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-blue-50/70 font-semibold' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              <span className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-blue-600' : 'bg-slate-300'}`} />
                                Kelas {c.name}
                              </span>
                            </td>
                            <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                              {hasWalas ? (
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-semibold text-slate-800">{c.walas_name}</span>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!confirm(`Copot ${c.walas_name} dari wali kelas ${c.name}?`)) return;
                                      try {
                                        await api.unassignWalasFromClass(c.id);
                                        showToast(`Wali kelas ${c.name} berhasil dicopot`);
                                        await loadControlPanelData();
                                      } catch (err: any) {
                                        alert(err.message || 'Gagal mencopot wali kelas');
                                      }
                                    }}
                                    className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded cursor-pointer"
                                  >
                                    Copot
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetClassForWalas(c);
                                    setSelectedWalasTeacherId('');
                                    setWalasModalOpen(true);
                                  }}
                                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Tugaskan Walas</span>
                                </button>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px]">
                                {studentCount} Siswa
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedClassId(c.name)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {isSelected ? '✓ Terpilih' : 'Pilih Kelas'}
                              </button>
                            </td>
                            <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => handleDeleteClass(c.id)}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                title="Hapus Kelas"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* KONTAINER 2: DAFTAR SISWA DALAM KELAS TERPILIH (FULL WIDTH) */}
              {(() => {
                const activeClass =
                  classesRombelsData.classes.find(
                    (c) => c.name === selectedClassId || c.id === selectedClassId
                  ) || classesRombelsData.classes[0];
                const activeClassName = activeClass?.name || '';
                const studentsInClass = allStudents.filter((s) => s.class_name === activeClassName);
                const otherStudents = allStudents.filter((s) => s.class_name !== activeClassName);

                return (
                  <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          Kontainer 2 (Bawah • Full-Width)
                        </span>
                        <h3 className="font-extrabold text-base text-slate-900 mt-1">
                          Daftar Siswa Kelas {activeClassName || '(Pilih Kelas)'} ({studentsInClass.length} Siswa)
                        </h3>
                        <p className="text-xs text-slate-500">
                          Wali Kelas: <strong>{activeClass?.walas_name || 'Belum Ditugaskan'}</strong>. Anda dapat memasukkan siswa dari kelas lain atau mengeluarkan siswa dari kelas ini.
                        </p>
                      </div>

                      {/* Quick Add Student to this class */}
                      {activeClassName && (
                        <div className="flex items-center gap-2 text-xs">
                          <select
                            value={studentToClassId}
                            onChange={(e) => setStudentToClassId(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-slate-200 font-bold max-w-xs"
                          >
                            <option value="">-- Pilih Siswa Masuk Kelas {activeClassName} --</option>
                            {otherStudents.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.class_name && s.class_name !== '-' ? `Kelas: ${s.class_name}` : 'Tanpa Kelas'})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!studentToClassId}
                            onClick={async () => {
                              if (!studentToClassId) return;
                              try {
                                await api.moveStudentGroup(studentToClassId, activeClassName, undefined);
                                setStudentToClassId('');
                                showToast(`Siswa berhasil dimasukkan ke Kelas ${activeClassName}!`);
                                await loadControlPanelData();
                                onRefreshStudents?.();
                              } catch (err: any) {
                                alert(err.message || 'Gagal memindahkan siswa');
                              }
                            }}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer disabled:opacity-50 shrink-0 shadow-xs"
                          >
                            + Masukkan ke Kelas
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3 text-center">No</th>
                            <th className="py-2.5 px-3">NISN</th>
                            <th className="py-2.5 px-3">Nama Lengkap Siswa</th>
                            <th className="py-2.5 px-3 text-center">L/P</th>
                            <th className="py-2.5 px-3">Agama</th>
                            <th className="py-2.5 px-3">Guru Wali</th>
                            <th className="py-2.5 px-3 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentsInClass.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                                Belum ada siswa terdaftar di Kelas {activeClassName}. Silakan tambahkan siswa menggunakan dropdown di atas.
                              </td>
                            </tr>
                          ) : (
                            studentsInClass.map((st, idx) => (
                              <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{st.nisn}</td>
                                <td className="py-2.5 px-3 font-bold text-slate-900">{st.name}</td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-600">{st.gender}</td>
                                <td className="py-2.5 px-3 text-slate-600">{st.religion}</td>
                                <td className="py-2.5 px-3 text-slate-700 font-semibold">{st.wali_name || '-'}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!confirm(`Keluarkan ${st.name} dari Kelas ${activeClassName}?`)) return;
                                      try {
                                        await api.moveStudentGroup(st.id, '-', undefined);
                                        showToast(`${st.name} dikeluarkan dari Kelas ${activeClassName}`);
                                        await loadControlPanelData();
                                        onRefreshStudents?.();
                                      } catch (err: any) {
                                        alert(err.message || 'Gagal mengeluarkan siswa');
                                      }
                                    }}
                                    className="px-2.5 py-1 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg font-bold text-[11px] cursor-pointer"
                                  >
                                    Keluarkan
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Walas Assignment Modal */}
              {walasModalOpen && targetClassForWalas && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-base text-slate-900">
                        Tugaskan Wali Kelas {targetClassForWalas.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setWalasModalOpen(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      <p className="text-slate-500">
                        Pilih dewan guru yang memiliki wewenang Walas dan belum ditugaskan di kelas manapun:
                      </p>

                      {(() => {
                        const availableWalas = adminTeachers.filter(
                          (t) =>
                            (t.is_walas || t.roles_csv?.includes('WALAS')) &&
                            (!t.class_name || t.class_name === '-' || t.class_name.trim() === '')
                        );

                        if (availableWalas.length === 0) {
                          return (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 space-y-2">
                              <p className="font-bold">
                                Tidak ada guru berwewenang Walas yang sedang kosong / belum bertugas.
                              </p>
                              <p className="text-[11px] text-amber-700">
                                Silakan aktifkan wewenang <strong>Wali Kelas</strong> pada guru di tab <strong>Data Guru &amp; Penugasan</strong> terlebih dahulu.
                              </p>
                              <div className="pt-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setWalasModalOpen(false)}
                                  className="px-3 py-1.5 bg-amber-200 text-amber-900 font-bold rounded-lg cursor-pointer"
                                >
                                  Tutup
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            <select
                              value={selectedWalasTeacherId}
                              onChange={(e) => setSelectedWalasTeacherId(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                            >
                              <option value="">-- Pilih Guru Walas --</option>
                              {availableWalas.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} (NIP: {t.nip || '-'})
                                </option>
                              ))}
                            </select>

                            <div className="flex justify-end gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setWalasModalOpen(false)}
                                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                disabled={!selectedWalasTeacherId}
                                onClick={async () => {
                                  if (!selectedWalasTeacherId) return;
                                  try {
                                    await api.assignWalasToClass(targetClassForWalas.id, selectedWalasTeacherId);
                                    setWalasModalOpen(false);
                                    showToast(`Wali kelas ${targetClassForWalas.name} berhasil ditugaskan!`);
                                    await loadControlPanelData();
                                  } catch (err: any) {
                                    alert(err.message || 'Gagal menugaskan wali kelas');
                                  }
                                }}
                                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer disabled:opacity-50"
                              >
                                Tugaskan Walas
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: BIMBINGAN GURU WALI (2 KONTAINER) */}
          {activeTab === 'guru_wali' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Bimbingan Guru Wali Siswa SMAN 28
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Guru Wali mendampingi karakter pembiasaan 7 KAIH siswa secara langsung tanpa sekat rombel. Dua kontainer: Master Guru Wali (atas) dan Daftar Murid Bimbingan (bawah).
                </p>
              </div>

              {/* KONTAINER 1: MASTER DEWAN GURU WALI */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                      Kontainer 1 (Atas)
                    </span>
                    <h3 className="font-extrabold text-base text-slate-900 mt-1">
                      Master Dewan Guru Wali
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pilih baris Guru Wali untuk melihat dan mengelola siswa binaannya pada kontainer bawah.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 text-xs">
                    <select
                      value={selectedGuruWaliTeacherId}
                      onChange={(e) => setSelectedGuruWaliTeacherId(e.target.value)}
                      className="w-56 px-3 py-2 rounded-xl border border-slate-200 font-bold"
                    >
                      <option value="">-- Pilih Guru yang belum jadi Wali --</option>
                      {adminTeachers
                        .filter((t) => !t.is_wali && !t.roles_csv?.includes('WALI'))
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (NIP: {t.nip || '-'})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={!selectedGuruWaliTeacherId}
                      onClick={async () => {
                        if (!selectedGuruWaliTeacherId) return;
                        try {
                          await api.assignGuruWali(selectedGuruWaliTeacherId);
                          setSelectedGuruWaliTeacherId('');
                          showToast('Guru berhasil ditugaskan sebagai Guru Wali!');
                          await loadControlPanelData();
                        } catch (err: any) {
                          alert(err.message || 'Gagal menambahkan Guru Wali');
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer shrink-0 disabled:opacity-50 shadow-xs"
                    >
                      + Tambah Guru Wali
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Nama Guru Wali</th>
                        <th className="py-2.5 px-3">NIP</th>
                        <th className="py-2.5 px-3 text-center">Jumlah Anak Bimbingan</th>
                        <th className="py-2.5 px-3 text-center">Status Pemilihan</th>
                        <th className="py-2.5 px-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminTeachers
                        .filter((t) => t.is_wali || t.roles_csv?.includes('WALI'))
                        .map((t) => {
                          const menteesCount = allStudents.filter((s) => s.wali_name === t.name).length;
                          const isSelected = selectedGuruWaliId === t.id || selectedGuruWaliId === t.name;

                          return (
                            <tr
                              key={t.id}
                              onClick={() => setSelectedGuruWaliId(t.id)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? 'bg-purple-50/70 font-semibold' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                <span className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-purple-600' : 'bg-slate-300'}`} />
                                  {t.name}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600">{t.nip || '-'}</td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px]">
                                  {menteesCount} Murid
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setSelectedGuruWaliId(t.id)}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-purple-600 text-white shadow-xs'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  {isSelected ? '✓ Terpilih' : 'Pilih Guru Wali'}
                                </button>
                              </td>
                              <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!confirm(`Copot status Guru Wali dari ${t.name}? Murid bimbingan akan dilepaskan.`)) return;
                                    try {
                                      const rombelMatch = classesRombelsData.rombels.find(
                                        (r) => r.wali_name === t.name || r.name === t.name
                                      );
                                      if (rombelMatch) {
                                        await api.deleteRombel(rombelMatch.id);
                                      }
                                      showToast(`Status Guru Wali ${t.name} berhasil dicopot`);
                                      await loadControlPanelData();
                                    } catch (err: any) {
                                      alert(err.message || 'Gagal mencopot status Guru Wali');
                                    }
                                  }}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                  title="Copot Guru Wali"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* KONTAINER 2: DAFTAR ANAK WALI BIMBINGAN (FULL WIDTH) */}
              {(() => {
                const activeWali =
                  adminTeachers.find(
                    (t) =>
                      (t.is_wali || t.roles_csv?.includes('WALI')) &&
                      (t.id === selectedGuruWaliId || t.name === selectedGuruWaliId)
                  ) || adminTeachers.find((t) => t.is_wali || t.roles_csv?.includes('WALI'));
                const activeWaliName = activeWali?.name || '';
                const mentees = allStudents.filter((s) => s.wali_name === activeWaliName);
                const otherStudents = allStudents.filter((s) => s.wali_name !== activeWaliName);

                return (
                  <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                          Kontainer 2 (Bawah • Full-Width)
                        </span>
                        <h3 className="font-extrabold text-base text-slate-900 mt-1">
                          Daftar Anak Wali Bimbingan: {activeWaliName || '(Pilih Guru Wali)'} ({mentees.length} Murid)
                        </h3>
                        <p className="text-xs text-slate-500">
                          Siswa yang berada di bawah bimbingan langsung <strong>{activeWaliName}</strong>.
                        </p>
                      </div>

                      {/* Quick Add Student to Wali */}
                      {activeWaliName && (
                        <div className="flex items-center gap-2 text-xs">
                          <select
                            value={studentToWaliId}
                            onChange={(e) => setStudentToWaliId(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-slate-200 font-bold max-w-xs"
                          >
                            <option value="">-- Pilih Siswa Masuk Bimbingan {activeWaliName} --</option>
                            {otherStudents.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.class_name ? `Kelas: ${s.class_name}` : ''} • {s.wali_name ? `Wali: ${s.wali_name}` : 'Belum Ada Wali'})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!studentToWaliId}
                            onClick={async () => {
                              if (!studentToWaliId) return;
                              try {
                                await api.moveStudentGroup(studentToWaliId, undefined, activeWaliName);
                                setStudentToWaliId('');
                                showToast(`Siswa berhasil ditugaskan ke bimbingan ${activeWaliName}!`);
                                await loadControlPanelData();
                                onRefreshStudents?.();
                              } catch (err: any) {
                                alert(err.message || 'Gagal menambahkan anak bimbingan');
                              }
                            }}
                            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer disabled:opacity-50 shrink-0 shadow-xs"
                          >
                            + Tambah Bimbingan
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3 text-center">No</th>
                            <th className="py-2.5 px-3">NISN</th>
                            <th className="py-2.5 px-3">Nama Lengkap Murid</th>
                            <th className="py-2.5 px-3">Kelas</th>
                            <th className="py-2.5 px-3 text-center">L/P</th>
                            <th className="py-2.5 px-3">Agama</th>
                            <th className="py-2.5 px-3 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {mentees.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                                Belum ada murid bimbingan untuk {activeWaliName}. Silakan tambahkan anak bimbingan dari dropdown di atas.
                              </td>
                            </tr>
                          ) : (
                            mentees.map((st, idx) => (
                              <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{st.nisn}</td>
                                <td className="py-2.5 px-3 font-bold text-slate-900">{st.name}</td>
                                <td className="py-2.5 px-3 font-semibold text-slate-700">{st.class_name || '-'}</td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-600">{st.gender}</td>
                                <td className="py-2.5 px-3 text-slate-600">{st.religion}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!confirm(`Lepaskan bimbingan ${st.name} dari Guru Wali ${activeWaliName}?`)) return;
                                      try {
                                        await api.moveStudentGroup(st.id, undefined, '-');
                                        showToast(`Bimbingan ${st.name} berhasil dilepaskan`);
                                        await loadControlPanelData();
                                        onRefreshStudents?.();
                                      } catch (err: any) {
                                        alert(err.message || 'Gagal melepaskan bimbingan');
                                      }
                                    }}
                                    className="px-2.5 py-1 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg font-bold text-[11px] cursor-pointer"
                                  >
                                    Lepas Bimbingan
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 8: DATABASE & LOG SISTEM (3 KONTAINER: KIRI LOG, KANAN TABEL, BAWAH EXCEL SPREADSHEET VIEWER) */}
          {activeTab === 'journals' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Database Sistem &amp; Spreadsheet Viewer
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Audit log sistem scrollable (kiri), daftar tabel SQLite (kanan), dan spreadsheet penampil tabel berdimensi tak terhingga mirip Excel (bawah).
                </p>
              </div>

              {/* TOP ROW: DUA KONTAINER (KIRI LOG AUDIT, KANAN LIST TABEL) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* KONTAINER KIRI: AUDIT LOG SISTEM (READ-ONLY, SCROLLABLE) */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3 flex flex-col">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                        Kontainer Kiri • Audit Log
                      </span>
                      <h3 className="font-extrabold text-sm text-slate-900 mt-1">
                        Audit Log Sistem (Histori Perubahan)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Catatan aktivitas immutable: mutasi murid, koreksi nilai &amp; sistem.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setAuditLogsLoading(true);
                          const logs = await api.getAuditLogs(100);
                          setAuditLogsList(logs);
                          showToast('Audit log diperbarui!');
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setAuditLogsLoading(false);
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
                      title="Refresh Audit Log"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${auditLogsLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {/* Scrollable Audit Log Container */}
                  <div className="max-h-[380px] overflow-y-auto space-y-2 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                    {auditLogsList.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 italic">
                        Belum ada riwayat audit log tercatat.
                      </div>
                    ) : (
                      auditLogsList.map((log: any, idx: number) => (
                        <div
                          key={log.id || idx}
                          className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-1 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-mono text-slate-400">
                              {log.created_at || log.timestamp || '-'}
                            </span>
                            <span className="font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                              {log.action || 'LOG'}
                            </span>
                          </div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-500">{log.actor_role || 'USER'}:</span>
                            <span>{log.actor_username || 'Sistem'}</span>
                          </div>
                          {log.entity_type && (
                            <div className="text-[11px] text-slate-600 font-mono">
                              Entitas: <strong>{log.entity_type}</strong> {log.entity_id ? `(${log.entity_id})` : ''}
                            </div>
                          )}
                          {log.reason && (
                            <p className="text-[11px] text-amber-800 italic bg-amber-50/60 px-2 py-0.5 rounded">
                              Alasan: "{log.reason}"
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* KONTAINER KANAN: LIST TABEL DATABASE (SQLITE) */}
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3 flex flex-col">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                        Kontainer Kanan • Database
                      </span>
                      <h3 className="font-extrabold text-sm text-slate-900 mt-1">
                        Daftar Tabel Database ({dbTables.length} Tabel)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Klik nama tabel untuk langsung membukanya di Spreadsheet Viewer (bawah).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const tbls = await api.getDatabaseTables();
                          setDbTables(tbls);
                          showToast('Daftar tabel diperbarui!');
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
                      title="Refresh Tabel"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Scrollable Table List Container */}
                  <div className="max-h-[380px] overflow-y-auto space-y-1.5 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                    {dbTables.map((tbl) => {
                      const isSelected = selectedDbTable === tbl;
                      return (
                        <button
                          key={tbl}
                          type="button"
                          onClick={() => {
                            setSelectedDbTable(tbl);
                            loadDbTableRows(tbl, 0);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl font-bold transition-all text-left cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-blue-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <TableIcon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                            <span className="font-mono text-xs truncate">{tbl}</span>
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {isSelected ? 'Sedang Dibuka' : 'Buka Tabel'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* KONTAINER BAWAH: PENAMPIL TABEL EXCEL SPREADSHEET (DIMENSI TAK TERHINGGA) */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-black shadow-xs">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 font-mono tracking-tight">
                          TABEL: {selectedDbTable}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Dimensi: {dbTableData?.totalRows ?? 0} Baris × {dbTableData?.columns?.length ?? 0} Kolom
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tampilan spreadsheet interaktif bergaya Excel dengan header kolom A, B, C... dan penomoran baris 1, 2, 3...
                      </p>
                    </div>
                  </div>

                  {/* Controls: Search & Pagination */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={dbSearchQuery}
                        onChange={(e) => setDbSearchQuery(e.target.value)}
                        placeholder="Cari dalam baris..."
                        className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs w-44 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={dbTablePage === 0 || dbTableLoading}
                      onClick={() => loadDbTableRows(selectedDbTable, dbTablePage - 1)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 font-bold hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    >
                      ← Prev (100)
                    </button>

                    <span className="text-[11px] font-bold text-slate-600 px-1 font-mono">
                      Hal {dbTablePage + 1} / {Math.ceil((dbTableData?.totalRows || 1) / 100) || 1}
                    </span>

                    <button
                      type="button"
                      disabled={
                        !dbTableData ||
                        (dbTablePage + 1) * 100 >= dbTableData.totalRows ||
                        dbTableLoading
                      }
                      onClick={() => loadDbTableRows(selectedDbTable, dbTablePage + 1)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 font-bold hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                    >
                      Next (100) →
                    </button>

                    <button
                      type="button"
                      onClick={() => loadDbTableRows(selectedDbTable, dbTablePage)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      title="Muat Ulang Baris"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${dbTableLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Spreadsheet Grid Viewer */}
                {dbTableLoading ? (
                  <div className="text-center py-16 space-y-2">
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-bold text-slate-500">Memuat data tabel dari SQLite...</p>
                  </div>
                ) : !dbTableData || dbTableData.rows.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 italic">
                    Tabel <strong>{selectedDbTable}</strong> tidak memiliki baris data saat ini.
                  </div>
                ) : (
                  <div className="border border-slate-300 rounded-2xl overflow-x-auto overflow-y-auto max-h-[520px] bg-white shadow-inner font-mono text-[11px] select-text">
                    <table className="w-full border-collapse border-slate-300 text-left">
                      <thead>
                        {/* Row 1: Excel Column Header (A, B, C...) + Column Names */}
                        <tr className="bg-slate-100 border-b border-slate-300 sticky top-0 z-20">
                          {/* Top-Left Corner Cell: # */}
                          <th className="sticky left-0 top-0 z-30 bg-slate-200 border-r border-b border-slate-300 text-center font-bold text-slate-600 px-3 py-2 w-14 select-none">
                            #
                          </th>
                          {dbTableData.columns.map((col, cIdx) => (
                            <th
                              key={col.name}
                              className="border-r border-slate-300 bg-slate-100 px-3 py-2 text-slate-700 font-bold whitespace-nowrap min-w-[130px]"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] text-slate-400 font-black">
                                  {getExcelColumnLabel(cIdx)}
                                </span>
                                <span className="text-slate-900 font-extrabold">{col.name}</span>
                                <span className="text-[9px] text-slate-400 font-normal">
                                  ({col.type || 'TEXT'})
                                </span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {dbTableData.rows
                          .filter((r) => {
                            if (!dbSearchQuery.trim()) return true;
                            return JSON.stringify(r).toLowerCase().includes(dbSearchQuery.toLowerCase());
                          })
                          .map((row, rIdx) => {
                            const rowNumber = dbTablePage * 100 + rIdx + 1;
                            return (
                              <tr key={rIdx} className="hover:bg-blue-50/50 transition-colors">
                                {/* Leftmost Row Number Cell (Excel style) */}
                                <td className="sticky left-0 z-10 bg-slate-100 border-r border-slate-300 text-center font-bold text-slate-500 px-2 py-1.5 select-none w-14 shadow-2xs">
                                  {rowNumber}
                                </td>
                                {dbTableData.columns.map((col) => {
                                  const val = row[col.name];
                                  return (
                                    <td
                                      key={col.name}
                                      className="border-r border-slate-200 px-3 py-1.5 text-slate-800 whitespace-nowrap max-w-xs truncate"
                                      title={val !== null && val !== undefined ? String(val) : 'NULL'}
                                    >
                                      {val === null || val === undefined ? (
                                        <span className="text-slate-300 italic font-sans text-[10px]">NULL</span>
                                      ) : typeof val === 'object' ? (
                                        <span className="text-purple-700">{JSON.stringify(val)}</span>
                                      ) : (
                                        String(val)
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* AUDIT KOREKSI NILAI JURNAL SISWA */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">
                      Koreksi Nilai Jurnal Siswa &amp; Audit Skor
                    </h3>
                    <p className="text-xs text-slate-500">
                      Penyesuaian nilai jurnal murid secara terkontrol beserta alasan resmi.
                    </p>
                  </div>
                </div>

                {editingJournal && (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-amber-900">
                        Koreksi: {editingJournal.student_name} ({editingJournal.habit_title} • {editingJournal.log_date}) — Skor Saat Ini: {editingJournal.final_score}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setEditingJournal(null)}
                        className="text-xs text-slate-500 hover:text-slate-700 font-bold cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                    <form onSubmit={handleCorrectJournal} className="flex flex-wrap items-center gap-3 text-xs">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={newJournalScore}
                        onChange={(e) => setNewJournalScore(Number(e.target.value))}
                        className="w-28 px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-bold"
                        placeholder="Skor baru"
                        required
                      />
                      <input
                        type="text"
                        value={correctionReason}
                        onChange={(e) => setCorrectionReason(e.target.value)}
                        className="flex-1 min-w-[200px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white"
                        placeholder="Alasan koreksi audit wajib diisi..."
                        required
                      />
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl cursor-pointer"
                      >
                        Simpan Koreksi
                      </button>
                    </form>
                  </div>
                )}

                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase">
                        <th className="py-2.5 px-3">Tanggal</th>
                        <th className="py-2.5 px-3">Nama Murid</th>
                        <th className="py-2.5 px-3">Kebiasaan</th>
                        <th className="py-2.5 px-3 text-center">Skor Akhir</th>
                        <th className="py-2.5 px-3">Audit Koreksi</th>
                        <th className="py-2.5 px-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {journalsList.slice(0, 20).map((j) => (
                        <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{j.log_date}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            <div>{j.student_name}</div>
                            <span className="text-[10px] text-slate-400 font-normal">{j.class_name}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{j.habit_title}</td>
                          <td className="py-2.5 px-3 text-center font-black text-blue-700">{j.final_score}</td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {j.correction_reason ? (
                              <span className="text-amber-700 italic">
                                "{j.correction_reason}" oleh {j.corrected_by}
                              </span>
                            ) : (
                              <span className="text-slate-400">Belum ada koreksi</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setInspectJournalAnswers({
                                    studentId: j.student_id,
                                    studentName: j.student_name,
                                    habitCode: j.habit_code,
                                    habitTitle: j.habit_title,
                                    logDate: j.log_date,
                                  })
                                }
                                className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-[#1c5ddc] rounded-lg text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 border border-blue-200"
                              >
                                <Database className="w-3 h-3" />
                                <span>Jawaban</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingJournal(j);
                                  setNewJournalScore(j.final_score);
                                }}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer"
                              >
                                Koreksi
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: IMPORT DATA TERPADU (SISWA, GURU & KELAS) */}
          {activeTab === 'import_data' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  Import Data Terpadu (Siswa, Guru &amp; Kelas)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Unggah data massal dalam format JSON atau CSV secara fleksibel untuk mempercepat input master data SMAN 28.
                </p>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-5">
                {/* Mode Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Pilih Mode Import:</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'all' as const, label: 'Semua (Siswa, Guru & Kelas)' },
                      { id: 'students' as const, label: 'Hanya Data Siswa' },
                      { id: 'teachers' as const, label: 'Hanya Data Guru (Walas/Wali)' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setImportMode(m.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          importMode === m.id
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preset / Template Loaders */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 block">
                    Muat Contoh Format Template (Klik untuk mengisi otomatis):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setImportMode('students');
                        setImportRawText(
                          JSON.stringify(
                            [
                              {
                                nisn: '0071234567',
                                name: 'Ahmad Fauzi',
                                username: 'ahmad_fauzi',
                                gender: 'L',
                                religion: 'Islam',
                                class_name: 'X-1',
                                wali_name: 'Budi Santoso, M.Pd.',
                                password: '123',
                              },
                              {
                                nisn: '0071234568',
                                name: 'Siti Sarah',
                                username: 'siti_sarah',
                                gender: 'P',
                                religion: 'Islam',
                                class_name: 'X-1',
                                wali_name: 'Budi Santoso, M.Pd.',
                                password: '123',
                              },
                            ],
                            null,
                            2
                          )
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      Contoh JSON Siswa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImportMode('teachers');
                        setImportRawText(
                          JSON.stringify(
                            [
                              {
                                nip: '198501012010011005',
                                name: 'Dra. Endang Sulastri',
                                username: 'endang_sulastri',
                                gender: 'P',
                                is_walas: true,
                                is_wali: true,
                                password: '123',
                              },
                            ],
                            null,
                            2
                          )
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      Contoh JSON Guru
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImportMode('students');
                        setImportRawText(
                          'nisn,name,username,gender,religion,class_name,wali_name,password\n' +
                          '0079988771,Bambang Pamungkas,bambang_p,L,Islam,X-2,Dra. Endang Sulastri,123\n' +
                          '0079988772,Dewi Sartika,dewi_s,P,Kristen,X-2,Dra. Endang Sulastri,123'
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      Contoh CSV Siswa
                    </button>
                  </div>
                </div>

                {/* Raw Text Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tempelkan (Paste) Data JSON atau CSV:
                  </label>
                  <textarea
                    rows={8}
                    value={importRawText}
                    onChange={(e) => setImportRawText(e.target.value)}
                    placeholder="Paste data JSON array atau teks CSV dengan baris header di sini..."
                    className="w-full p-3 font-mono text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="button"
                  disabled={importLoading || !importRawText.trim()}
                  onClick={handleExecuteImport}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{importLoading ? 'Memproses Import...' : 'Jalankan Import Data'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 8: KELOLA AKUN ADMIN */}
          {activeTab === 'admins' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                      Hak Akses Otoritas Tertinggi
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Kelola Akun Administrator (Total: {adminsList.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tambah akun admin baru, ubah kata sandi, status aktif, dan kelola otoritas pengelola sistem 7 KAIH.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAdminForm({
                      id: '',
                      nip: '',
                      name: '',
                      username: '',
                      password: '123',
                      is_active: true,
                    });
                    setAdminModalOpen(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Admin Baru</span>
                </button>
              </div>

              {/* Admins Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase">
                      <th className="py-3 px-4">Nama Lengkap Admin</th>
                      <th className="py-3 px-4">Username Login</th>
                      <th className="py-3 px-4">NIP / Identitas</th>
                      <th className="py-3 px-4 text-center">Status Akun</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {adminsList.map((adm) => {
                      const isRootAdmin = adm.username === 'admin';
                      return (
                        <tr key={adm.id || adm.user_id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span>{adm.name}</span>
                              {isRootAdmin && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-200">
                                  Utama
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ID: {adm.id || adm.user_id}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                            {adm.username}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {adm.nip || '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                adm.account_status === 'ACTIVE' || adm.is_active
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {adm.account_status === 'ACTIVE' || adm.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setAdminForm({
                                    id: adm.id || adm.user_id,
                                    nip: adm.nip || '',
                                    name: adm.name,
                                    username: adm.username,
                                    password: adm.password || '123',
                                    is_active: adm.account_status === 'ACTIVE' || Boolean(adm.is_active),
                                  });
                                  setAdminModalOpen(true);
                                }}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                                title="Edit Akun Admin"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              {!isRootAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAdmin(adm.id || adm.user_id, adm.username)}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg cursor-pointer"
                                  title="Hapus Akun Admin"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Admin Create / Edit Modal */}
              {adminModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-base text-slate-900">
                        {adminForm.id ? 'Edit Data Akun Admin' : 'Tambah Akun Admin Baru'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setAdminModalOpen(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleSaveAdmin} className="space-y-3 text-xs">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Nama Lengkap</label>
                        <input
                          type="text"
                          value={adminForm.name}
                          onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                          placeholder="misal: Dr. H. Administrator, M.Pd"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Username Login</label>
                          <input
                            type="text"
                            value={adminForm.username}
                            onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold"
                            placeholder="misal: admin_tu"
                            required
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">NIP (Opsional)</label>
                          <input
                            type="text"
                            value={adminForm.nip}
                            onChange={(e) => setAdminForm({ ...adminForm, nip: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200"
                            placeholder="19800101..."
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Password Login (Dapat Dilihat)</label>
                        <input
                          type="text"
                          value={adminForm.password}
                          onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono font-bold"
                          placeholder="123"
                          required
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          Default password awal: <strong>123</strong>
                        </span>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div>
                          <label className="font-bold text-slate-800 block">Status Akun Aktif</label>
                          <span className="text-[10px] text-slate-500">
                            Hanya akun aktif yang dapat login ke Panel Admin.
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(adminForm.is_active)}
                          onChange={(e) => setAdminForm({ ...adminForm, is_active: e.target.checked })}
                          className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                        />
                      </div>

                      <div className="pt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setAdminModalOpen(false)}
                          className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-xs"
                        >
                          Simpan Akun Admin
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 11: PENGUMUMAN & PETUAH BUDAYA BETAWI */}
          {activeTab === 'announcements' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Pengumuman &amp; Petuah Budaya Betawi
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Kelola pesan moral, kata bijak, dan popup petuah Betawi otomatis untuk Bangun Pagi, Tidur Cepat, dan Tadarus.
                  </p>
                </div>

                {/* Sub-Tab Switcher */}
                <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 shrink-0 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setAnnouncementsSubTab('announcements')}
                    className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                      announcementsSubTab === 'announcements'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pengumuman Sekolah
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnnouncementsSubTab('petuah')}
                    className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                      announcementsSubTab === 'petuah'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Petuah Budaya Betawi ({popupsList.length})
                  </button>
                </div>
              </div>

              {/* SUB-TAB 1: PENGUMUMAN SEKOLAH */}
              {announcementsSubTab === 'announcements' && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setAnnouncementForm({
                          id: '',
                          type: 'QUOTE',
                          title: 'Kata Mutiara 7 KAIH',
                          content: '',
                          author: 'SMAN 28 Jakarta',
                        });
                        setAnnouncementModalOpen(true);
                      }}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Pengumuman Baru</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {announcementsList.map((ann) => (
                      <div
                        key={ann.id}
                        className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">
                              {ann.type}
                            </span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setAnnouncementForm({
                                    id: ann.id,
                                    type: ann.type,
                                    title: ann.title,
                                    content: ann.content,
                                    author: ann.author || '',
                                  });
                                  setAnnouncementModalOpen(true);
                                }}
                                className="p-1 text-slate-500 hover:text-slate-800 rounded cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAnnouncement(ann.id)}
                                className="p-1 text-rose-500 hover:text-rose-800 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <h4 className="font-extrabold text-sm text-slate-900 mt-2">{ann.title}</h4>
                          <p className="text-xs text-slate-600 italic mt-1">"{ann.content}"</p>
                        </div>
                        {ann.author && (
                          <span className="text-[10px] font-bold text-slate-400 block text-right pt-2 border-t border-slate-100">
                            Oleh: {ann.author}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUB-TAB 2: PETUAH BUDAYA BETAWI */}
              {announcementsSubTab === 'petuah' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900">
                        Daftar Petuah &amp; Kata Betawi Otomatis ({popupsList.length} Petuah)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Petuah ini dimunculkan otomatis kepada siswa sebagai popup motivasi setelah menyelesaikan konfirmasi kejujuran atau submit instrumen terkait.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingPopup({
                          id: `popup_${Date.now()}`,
                          habit_code: 'umum',
                          trigger_condition: 'always',
                          title: 'Petuah Budaya Betawi',
                          quote_text: '',
                        })
                      }
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah Petuah Baru
                    </button>
                  </div>

                  {editingPopup && (
                    <div className="bg-white rounded-3xl p-6 border-2 border-purple-300 shadow-md space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full">
                            Edit Petuah Budaya
                          </span>
                          <h3 className="text-sm font-extrabold text-slate-900 mt-1">
                            Petuah: {editingPopup.id} ({editingPopup.habit_code || 'umum'})
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingPopup(null)}
                          className="text-xs font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">Judul Popup:</label>
                            <input
                              type="text"
                              value={editingPopup.title || ''}
                              onChange={(e) => setEditingPopup({ ...editingPopup, title: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                            />
                          </div>
                          <div>
                            <label className="block font-bold text-slate-700 mb-1">Kebiasaan (Habit Code):</label>
                            <select
                              value={editingPopup.habit_code || 'umum'}
                              onChange={(e) => setEditingPopup({ ...editingPopup, habit_code: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                            >
                              <option value="bangun">Bangun Pagi</option>
                              <option value="ibadah">Beribadah</option>
                              <option value="olahraga">Berolahraga</option>
                              <option value="makan">Makan Bergizi</option>
                              <option value="belajar">Gemar Belajar</option>
                              <option value="masyarakat">Bermasyarakat</option>
                              <option value="tidur">Tidur Cepat</option>
                              <option value="umum">Umum</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Isi Petuah / Kalimat Betawi:</label>
                          <textarea
                            rows={3}
                            value={editingPopup.quote_text || ''}
                            onChange={(e) => setEditingPopup({ ...editingPopup, quote_text: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300"
                            required
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingPopup(null)}
                            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSavePopupQuote(editingPopup)}
                            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer shadow-xs"
                          >
                            Simpan Petuah
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {popupsList.map((pop) => (
                      <div
                        key={pop.id}
                        className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">
                              {pop.habit_code} • {pop.trigger_condition}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingPopup(pop)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                              title="Edit Petuah"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <h4 className="font-extrabold text-sm text-slate-900 mt-2">{pop.title}</h4>
                          <p className="text-xs text-purple-900 font-semibold italic mt-1 bg-purple-50/60 p-3 rounded-2xl border border-purple-100">
                            "{pop.quote_text}"
                          </p>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-100 flex justify-between">
                          <span>Kondisi: {pop.trigger_condition}</span>
                          <span>ID: {pop.id}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Announcement Modal */}
              {announcementModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-base text-slate-900">
                        {announcementForm.id ? 'Edit Pengumuman' : 'Tambah Pengumuman Baru'}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setAnnouncementModalOpen(false)}
                        className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleSaveAnnouncement} className="space-y-3 text-xs">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Tipe</label>
                        <select
                          value={announcementForm.type}
                          onChange={(e) =>
                            setAnnouncementForm({
                              ...announcementForm,
                              type: e.target.value as 'ANNOUNCEMENT' | 'QUOTE',
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                        >
                          <option value="QUOTE">Kata Bijak (Quote)</option>
                          <option value="ANNOUNCEMENT">Pengumuman Resmi</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Judul</label>
                        <input
                          type="text"
                          value={announcementForm.title}
                          onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Isi Pesan / Kutipan</label>
                        <textarea
                          rows={4}
                          value={announcementForm.content}
                          onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Penulis / Tokoh</label>
                        <input
                          type="text"
                          value={announcementForm.author}
                          onChange={(e) => setAnnouncementForm({ ...announcementForm, author: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200"
                        />
                      </div>

                      <div className="pt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setAnnouncementModalOpen(false)}
                          className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                        >
                          Simpan
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modal Rapor Murid untuk Administrator */}
      {selectedStudentForReport && (
        <StudentReportModal
          studentId={selectedStudentForReport}
          canEditNotes={true}
          onClose={() => setSelectedStudentForReport(null)}
        />
      )}

      {/* Modal Rincian Jawaban Instrumen Murid dari Database SQLite */}
      {inspectJournalAnswers && (
        <HabitAnswersModal
          studentId={inspectJournalAnswers.studentId}
          studentName={inspectJournalAnswers.studentName}
          habitCode={inspectJournalAnswers.habitCode}
          habitTitle={inspectJournalAnswers.habitTitle}
          logDate={inspectJournalAnswers.logDate}
          onClose={() => setInspectJournalAnswers(null)}
        />
      )}
    </ErrorBoundary>
  );
};
