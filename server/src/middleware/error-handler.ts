/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Centralized Error Handler — VERTIKAL SMA JAWARA 28
 * Formats errors safely without leaking stack traces, SQL internals,
 * session tokens, or password hashes.
 */

import { AppError } from '../shared/errors/app-error.ts';

export interface FormattedErrorResponse {
  statusCode: number;
  body: {
    status: 'error';
    code: string;
    error: string;
    details?: unknown;
  };
}

export function formatErrorResponse(err: unknown): FormattedErrorResponse {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      body: {
        status: 'error',
        code: err.code,
        error: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    };
  }

  const msg = err instanceof Error ? err.message : String(err);
  console.error('[SERVER ERROR]', err);

  if (msg.includes('UNIQUE constraint failed') || msg.includes('duplicate key value')) {
    return {
      statusCode: 409,
      body: {
        status: 'error',
        code: 'CONFLICT_DUPLICATE',
        error: 'Data duplikat terdeteksi (melanggar constraint keunikan database).',
      },
    };
  }

  if (msg.includes('FOREIGN KEY constraint failed') || msg.includes('violates foreign key')) {
    return {
      statusCode: 400,
      body: {
        status: 'error',
        code: 'FOREIGN_KEY_VIOLATION',
        error: 'Referensi data induk tidak ditemukan atau masih terkait dengan data lain.',
      },
    };
  }

  if (msg.includes('NOT NULL constraint failed')) {
    return {
      statusCode: 400,
      body: {
        status: 'error',
        code: 'NOT_NULL_VIOLATION',
        error: 'Data wajib belum lengkap: ' + msg.split(':').pop()?.trim(),
      },
    };
  }

  if (msg.includes('CHECK constraint failed')) {
    return {
      statusCode: 400,
      body: {
        status: 'error',
        code: 'CHECK_CONSTRAINT_VIOLATION',
        error: 'Nilai data tidak memenuhi batas aturan validasi database.',
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      error: 'Terjadi kesalahan internal pada server.',
      details: err instanceof Error ? err.message : String(err),
    },
  };
}
