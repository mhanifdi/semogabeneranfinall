/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Typed Relational Schema Metadata (Drizzle-compatible PostgreSQL Schema Definition)
 * Matches 001_initial_postgresql_schema.sql and 002_views_and_analytics_indexes.sql.
 */

export interface TableColumnDefinition {
  name: string;
  pgType: string;
  nullable: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  defaultValue?: string;
  references?: { table: string; column: string; onDelete: 'CASCADE' | 'RESTRICT' | 'SET NULL' };
  checkConstraint?: string;
  description: string;
}

export interface TableSchemaDefinition {
  tableName: string;
  domain: 'AUTH_RBAC' | 'ACADEMIC_PROFILES' | 'HABITS_JOURNALS' | 'GAMIFICATION_POINTS' | 'ADMIN_AUDIT';
  description: string;
  columns: TableColumnDefinition[];
  uniqueConstraints?: string[][];
  indexes?: { name: string; columns: string[] }[];
}

export const JAWARA28_RELATIONAL_SCHEMA: TableSchemaDefinition[] = [
  {
    tableName: 'users',
    domain: 'AUTH_RBAC',
    description: 'Tabel induk akun autentikasi untuk seluruh peran (Siswa, Guru Walas, Guru Wali, Tim 7 KAIH, Super Admin).',
    columns: [
      { name: 'id', pgType: 'VARCHAR(64)', nullable: false, primaryKey: true, description: 'ID unik pengguna (contoh: usr-std-siswa, usr-adm-admin)' },
      { name: 'username', pgType: 'VARCHAR(64)', nullable: false, unique: true, description: 'Username login unik' },
      { name: 'email', pgType: 'VARCHAR(160)', nullable: true, unique: true, description: 'Alamat email pengguna (opsional)' },
      { name: 'password_hash', pgType: 'TEXT', nullable: false, description: 'Hash password kriptografis (scrypt$N$r$p$salt$hash)' },
      { name: 'password_algo', pgType: 'VARCHAR(32)', nullable: false, defaultValue: "'scrypt'", description: 'Algoritma hash password yang digunakan' },
      { name: 'full_name', pgType: 'VARCHAR(160)', nullable: false, description: 'Nama lengkap pemilik akun' },
      { name: 'account_status', pgType: 'VARCHAR(24)', nullable: false, defaultValue: "'ACTIVE'", checkConstraint: "account_status IN ('ACTIVE','INACTIVE','SUSPENDED','ARCHIVED')", description: 'Status aktif akun' },
      { name: 'failed_login_attempts', pgType: 'INTEGER', nullable: false, defaultValue: '0', description: 'Jumlah percobaan gagal login berturut-turut' },
      { name: 'locked_until', pgType: 'TIMESTAMPTZ', nullable: true, description: 'Waktu kunci sementara akibat brute-force' },
      { name: 'last_login_at', pgType: 'TIMESTAMPTZ', nullable: true, description: 'Waktu login berhasil terakhir' },
      { name: 'created_at', pgType: 'TIMESTAMPTZ', nullable: false, defaultValue: 'CURRENT_TIMESTAMP', description: 'Waktu pembuatan akun' },
      { name: 'updated_at', pgType: 'TIMESTAMPTZ', nullable: false, defaultValue: 'CURRENT_TIMESTAMP', description: 'Waktu pembaruan akun terakhir' },
    ],
  },
  {
    tableName: 'roles',
    domain: 'AUTH_RBAC',
    description: 'Master peran pengguna (SISWA, GURU_WALAS, GURU_WALI, TIM_7_KAIH, SUPER_ADMIN).',
    columns: [
      { name: 'id', pgType: 'VARCHAR(64)', nullable: false, primaryKey: true, description: 'ID unik role' },
      { name: 'code', pgType: 'VARCHAR(64)', nullable: false, unique: true, description: 'Kode role standar' },
      { name: 'name', pgType: 'VARCHAR(120)', nullable: false, description: 'Nama tampilan role' },
      { name: 'description', pgType: 'TEXT', nullable: true, description: 'Deskripsi wewenang role' },
      { name: 'created_at', pgType: 'TIMESTAMPTZ', nullable: false, defaultValue: 'CURRENT_TIMESTAMP', description: 'Waktu pembuatan' },
    ],
  },
  {
    tableName: 'permissions',
    domain: 'AUTH_RBAC',
    description: 'Daftar izin granular (fine-grained permissions) untuk setiap modul.',
    columns: [
      { name: 'id', pgType: 'VARCHAR(64)', nullable: false, primaryKey: true, description: 'ID unik permission' },
      { name: 'code', pgType: 'VARCHAR(100)', nullable: false, unique: true, description: 'Kode permission (contoh: journal:submit:self)' },
      { name: 'module', pgType: 'VARCHAR(64)', nullable: false, description: 'Nama modul terkait' },
      { name: 'description', pgType: 'TEXT', nullable: false, description: 'Penjelasan hak akses' },
      { name: 'created_at', pgType: 'TIMESTAMPTZ', nullable: false, defaultValue: 'CURRENT_TIMESTAMP', description: 'Waktu pembuatan' },
    ],
  },
  {
    tableName: 'role_permissions',
    domain: 'AUTH_RBAC',
    description: 'Pemetaan many-to-many antara roles dan permissions.',
    columns: [
      { name: 'role_id', pgType: 'VARCHAR(64)', nullable: false, primaryKey: true, references: { table: 'roles', column: 'id', onDelete: 'CASCADE' }, description: 'FK ke roles.id' },
      { name: 'permission_id', pgType: 'VARCHAR(64)', nullable: false, primaryKey: true, references: { table: 'permissions', column: 'id', onDelete: 'CASCADE' }, description: 'FK ke permissions.id' },
      { name: 'granted_at', pgType: 'TIMESTAMPTZ', nullable: false, defaultValue: 'CURRENT_TIMESTAMP', description: 'Waktu pemberian izin' },
    ],
  },
  {
    tableName: 'user_roles',
    domain: 'AUTH_RBAC',
    description: 'Penugasan role dan cakupan akses (scope_type & scope_id) kepada pengguna.',
    columns: [
      { name: 'id', pgType: 'VARCHAR(64)', nullable: false, primaryKey: true, description: 'ID penugasan role' },
      { name: 'user_id', pgType: 'VARCHAR(64)', nullable: false, references: { table: 'users', column: 'id', onDelete: 'CASCADE' }, description: 'FK ke users.id' },
      { name: 'role_id', pgType: 'VARCHAR(64)', nullable: false, references: { table: 'roles', column: 'id', onDelete: 'RESTRICT' }, description: 'FK ke roles.id' },
      { name: 'scope_type', pgType: 'VARCHAR(32)', nullable: false, defaultValue: "'GLOBAL'", description: 'Cakupan akses: SELF, CLASS, ROMBEL, COHORT, SCHOOL, GLOBAL' },
      { name: 'scope_id', pgType: 'VARCHAR(64)', nullable: true, description: 'ID/nama target scope (contoh: XI-MIPA-1 atau Rombel Sains & Riset A)' },
      { name: 'is_active', pgType: 'BOOLEAN', nullable: false, defaultValue: 'TRUE', description: 'Status aktif penugasan role' },
      { name: 'assigned_by', pgType: 'VARCHAR(64)', nullable: true, references: { table: 'users', column: 'id', onDelete: 'SET NULL' }, description: 'Admin yang menugaskan' },
      { name: 'assigned_at', pgType: 'TIMESTAMPTZ', nullable: false, defaultValue: 'CURRENT_TIMESTAMP', description: 'Waktu penugasan' },
    ],
    uniqueConstraints: [['user_id', 'role_id', 'scope_type', 'scope_id']],
  },
  {
    tableName: 'sessions',
    domain: 'AUTH_RBAC',
    description: 'Sesi autentikasi aktif di database dengan dukungan masa berlaku (expiry) dan pencabutan (revocation).',
    columns: [
      { name: 'id', pgType: 'VARCHAR(64)', nullable: false, primaryKey: true, description: 'ID sesi' },
      { name: 'user_id', pgType: 'VARCHAR(64)', nullable: false, references: { table: 'users', column: 'id', onDelete: 'CASCADE' }, description: 'FK ke users.id' },
      { name: 'token_hash', pgType: 'VARCHAR(128)', nullable: false, unique: true, description: 'SHA-256 hash dari bearer token sesi' },
      { name: 'active_role', pgType: 'VARCHAR(64)', nullable: false, description: 'Role aktif saat sesi dibuat' },
      { name: 'ip_address', pgType: 'VARCHAR(64)', nullable: true, description: 'IP address klien' },
      { name: 'user_agent', pgType: 'TEXT', nullable: true, description: 'User-Agent browser/klien' },
      { name: 'expires_at', pgType: 'TIMESTAMPTZ', nullable: false, description: 'Batas waktu kedaluwarsa sesi' },
      { name: 'revoked_at', pgType: 'TIMESTAMPTZ', nullable: true, description: 'Waktu sesi dicabut (logout / force revoke)' },
      { name: 'revoked_reason', pgType: 'VARCHAR(160)', nullable: true, description: 'Alasan pencabutan sesi' },
      { name: 'created_at', pgType: 'TIMESTAMPTZ', nullable: false, defaultValue: 'CURRENT_TIMESTAMP', description: 'Waktu pembuatan sesi' },
    ],
  },
];
