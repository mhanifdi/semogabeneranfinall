/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cryptographic Password & Token Security — VERTIKAL SMA JAWARA 28
 * Uses Node.js native `crypto.scryptSync` (memory-hard KDF) with per-password
 * 16-byte random cryptographic salt and constant-time `timingSafeEqual`.
 * No plain text or static-salt SHA-256 is permitted.
 */

import crypto from 'node:crypto';
import { env } from '../../config/env.ts';

/**
 * Generates a memory-hard scrypt password hash with a unique 16-byte random salt.
 * Format: `scrypt$N$r$p$<saltHex>$<derivedKeyHex>`
 */
export function hashPassword(plainPassword: string): string {
  const clean = String(plainPassword ?? '');
  if (!clean) {
    throw new Error('Password tidak boleh kosong');
  }
  const salt = crypto.randomBytes(16);
  const N = env.scryptCost;
  const r = env.scryptBlockSize;
  const p = env.scryptParallelization;
  const keyLen = env.scryptKeyLength;

  const derivedKey = crypto.scryptSync(clean, salt, keyLen, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
}

/**
 * Verifies a password against a stored `scrypt$...` hash using constant-time comparison.
 * Never accepts plain text or backdoor strings.
 */
export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  if (!plainPassword || !storedHash || typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltHex = parts[4];
  const expectedKeyHex = parts[5];

  if (!N || !r || !p || !saltHex || !expectedKeyHex) {
    return false;
  }

  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expectedBuffer = Buffer.from(expectedKeyHex, 'hex');
    const derivedBuffer = crypto.scryptSync(plainPassword, salt, expectedBuffer.length, { N, r, p });
    if (derivedBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(derivedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

/**
 * Generates a cryptographically secure random bearer token and its SHA-256 storage hash.
 * Only the SHA-256 hash is persisted in the `sessions` table so that a database leak
 * cannot be used to hijack active sessions.
 */
export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const rawToken = `jwr28_${crypto.randomBytes(32).toString('hex')}`;
  const tokenHash = hashSessionToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}
