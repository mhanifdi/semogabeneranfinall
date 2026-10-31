/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Environment Configuration — VERTIKAL SMA JAWARA 28
 * Separates development, test, and production settings clearly.
 */

import path from 'node:path';

export type NodeEnv = 'development' | 'test' | 'production';
export type DatabaseDialect = 'postgresql' | 'sqlite';

export interface AppEnvConfig {
  nodeEnv: NodeEnv;
  port: number;
  dbDialect: DatabaseDialect;
  databaseUrl: string;
  sqliteDbPath: string;
  legacySqliteDbPath: string;
  backupDirPath: string;
  sessionTtlHours: number;
  passwordHashAlgorithm: 'scrypt';
  scryptCost: number;
  scryptBlockSize: number;
  scryptParallelization: number;
  scryptKeyLength: number;
  allowDemoSeed: boolean;
  defaultAcademicYear: string;
  schoolTimezone: string;
}

const rawEnv = (process.env.NODE_ENV || 'development').toLowerCase();
const nodeEnv: NodeEnv =
  rawEnv === 'production' || rawEnv === 'test' ? (rawEnv as NodeEnv) : 'development';

const rootDir = process.cwd();
const databaseUrl = process.env.DATABASE_URL || '';
const dbDialect: DatabaseDialect =
  databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')
    ? 'postgresql'
    : 'sqlite';

const defaultSqliteFile =
  nodeEnv === 'test'
    ? path.resolve(rootDir, 'database', 'test_jawara28.db')
    : path.resolve(rootDir, 'database', 'jawara28_relational.db');

export const env: AppEnvConfig = {
  nodeEnv,
  port: Number(process.env.PORT || 3000),
  dbDialect,
  databaseUrl,
  sqliteDbPath: process.env.SQLITE_DB_PATH
    ? path.resolve(rootDir, process.env.SQLITE_DB_PATH)
    : defaultSqliteFile,
  legacySqliteDbPath: path.resolve(rootDir, 'database', 'local_habit.db'),
  backupDirPath: path.resolve(rootDir, 'database', 'backups'),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS || 24),
  passwordHashAlgorithm: 'scrypt',
  scryptCost: Number(process.env.SCRYPT_COST || 4096),
  scryptBlockSize: 8,
  scryptParallelization: 1,
  scryptKeyLength: 64,
  allowDemoSeed:
    process.env.ALLOW_DEMO_SEED !== undefined
      ? process.env.ALLOW_DEMO_SEED === 'true'
      : nodeEnv !== 'production',
  defaultAcademicYear: process.env.DEFAULT_ACADEMIC_YEAR || '2026/2027',
  schoolTimezone: process.env.SCHOOL_TIMEZONE || 'Asia/Jakarta',
};
