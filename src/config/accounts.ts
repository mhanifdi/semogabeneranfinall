/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ============================================================================
 * DIRECTORY KONFIGURASI AKUN DEMO (VERTIKAL SMA JAWARA 28)
 * ============================================================================
 * Akun demo dilabeli jelas (`is_demo: 1`) dan mendukung seluruh Role & Penugasan:
 * - Siswa (Islam L, Islam P untuk uji Checkbox Berhalangan, Kristen, Hindu)
 * - Guru Walas (Monitoring Kelas)
 * - Guru Wali (Analitik Rombel)
 * - Guru Tim 7 KAIH (Operasional Program 7 KAIH, Analitik Sekolah, Validasi Top 10)
 * - Admin (Control Panel Sistem, login khusus melalui /admin)
 */

import { TeacherAssignmentType } from '../types';

export interface UserAccountConfig {
  id: string;
  username: string;
  password: string;
  name: string;
  role: 'siswa' | 'guru' | 'admin';
  class_name: string;
  rombel_name?: string;
  angkatan?: string;
  religion?: 'Islam' | 'Kristen' | 'Katolik' | 'Hindu';
  gender?: 'L' | 'P';
  walas_name?: string;
  walas_nip?: string;
  wali_name?: string;
  wali_nip?: string;
  assignment_type?: TeacherAssignmentType;
  subject?: string;
  is_demo?: number;
}

export const USER_ACCOUNTS: UserAccountConfig[] = [
  {
    id: 'std-siswa',
    username: 'siswa',
    password: '123',
    name: 'Andi Pratama (Siswa Jawara)',
    role: 'siswa',
    class_name: 'XI-MIPA-1',
    rombel_name: 'Rombel B',
    angkatan: '2025/2026',
    religion: 'Islam',
    gender: 'L',
    walas_name: 'Dra. Hj. Nurhidayah, M.Pd.',
    walas_nip: '197405101999032001',
    wali_name: 'Budi Santoso, S.Pd., M.Si.',
    wali_nip: '198002152005011002',
    is_demo: 1,
  },
  {
    id: 'std-siswai',
    username: 'siswai',
    password: '123',
    name: 'Siti Rahmawati (Islam P)',
    role: 'siswa',
    class_name: 'XI-MIPA-1',
    rombel_name: 'Rombel A',
    angkatan: '2025/2026',
    religion: 'Islam',
    gender: 'P',
    walas_name: 'Dra. Hj. Nurhidayah, M.Pd.',
    walas_nip: '197405101999032001',
    wali_name: 'Dra. Hj. Nurhidayah, M.Pd.',
    wali_nip: '197405101999032001',
    is_demo: 1,
  },
  {
    id: 'std-siswak',
    username: 'siswak',
    password: '123',
    name: 'Daniel Pratama (Kristen)',
    role: 'siswa',
    class_name: 'XI-MIPA-1',
    rombel_name: 'Rombel B',
    angkatan: '2025/2026',
    religion: 'Kristen',
    gender: 'L',
    walas_name: 'Dra. Hj. Nurhidayah, M.Pd.',
    walas_nip: '197405101999032001',
    wali_name: 'Budi Santoso, S.Pd., M.Si.',
    wali_nip: '198002152005011002',
    is_demo: 1,
  },
  {
    id: 'std-siswah',
    username: 'siswah',
    password: '123',
    name: 'I Wayan Aditya (Hindu)',
    role: 'siswa',
    class_name: 'XI-MIPA-2',
    rombel_name: 'Rombel B',
    angkatan: '2025/2026',
    religion: 'Hindu',
    gender: 'L',
    walas_name: 'Budi Santoso, S.Pd., M.Si.',
    walas_nip: '198002152005011002',
    wali_name: 'Budi Santoso, S.Pd., M.Si.',
    wali_nip: '198002152005011002',
    is_demo: 1,
  },
  // 1. Guru Walas (Monitoring Kelas XI-MIPA-1)
  {
    id: 'tch-guru',
    username: 'guru',
    password: '123',
    name: 'Dra. Hj. Nurhidayah, M.Pd.',
    role: 'guru',
    assignment_type: 'WALAS',
    class_name: 'XI-MIPA-1',
    rombel_name: 'Rombel A',
    walas_nip: '197405101999032001',
    subject: 'Guru Walas XI-MIPA-1',
    is_demo: 1,
  },
  // 2. Guru Wali (Analitik Rombel B)
  {
    id: 'tch-wali',
    username: 'guruwali',
    password: '123',
    name: 'Budi Santoso, S.Pd., M.Si.',
    role: 'guru',
    assignment_type: 'WALI',
    class_name: 'XI-MIPA-2',
    rombel_name: 'Rombel B',
    walas_nip: '198002152005011002',
    subject: 'Guru Wali Rombel B',
    is_demo: 1,
  },
  // 3. Guru Tim 7 KAIH (Mewarisi seluruh kewenangan operasional Admin lama)
  {
    id: 'tch-kaih',
    username: 'tim7kaih',
    password: '123',
    name: 'Drs. H. Ubaidillah, M.M.',
    role: 'guru',
    assignment_type: 'TIM_7_KAIH',
    class_name: 'Semua Kelas',
    rombel_name: 'Semua Rombel',
    walas_nip: '196904121995031004',
    subject: 'Koordinator Guru Tim 7 KAIH',
    is_demo: 1,
  },
  // 4. Admin Baru (Pengelola Control Panel Sistem via /admin)
  {
    id: 'adm-admin',
    username: 'admin',
    password: '123',
    name: 'Administrator Sistem Jawara 28',
    role: 'admin',
    class_name: 'Control Panel Sistem',
    walas_nip: '199001012015031001',
    subject: 'Administrator Control Panel Website',
    is_demo: 1,
  },
];
