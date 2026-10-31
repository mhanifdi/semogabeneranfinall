/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Authentication Middleware — VERTIKAL SMA JAWARA 28
 */

import { RelationalDatabase } from '../database/client.ts';
import { AuthService } from '../modules/auth/auth.service.ts';
import type { AuthSessionContext } from '../modules/auth/auth.service.ts';
import { UnauthorizedError } from '../shared/errors/app-error.ts';

export function extractBearerToken(headers?: Record<string, string | string[] | undefined>): string | null {
  if (!headers) return null;
  const authHeader = headers['authorization'] || headers['Authorization'];
  const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^Bearer\s+/i, '').trim();
}

export function resolveAuthSession(
  db: RelationalDatabase,
  headers?: Record<string, string | string[] | undefined>,
  required = true
): AuthSessionContext | null {
  const token = extractBearerToken(headers);
  if (!token) {
    if (required) {
      throw new UnauthorizedError('Akses ditolak: Header Authorization Bearer token wajib disertakan.');
    }
    return null;
  }
  const authService = new AuthService(db);
  return authService.verifySessionToken(token);
}
