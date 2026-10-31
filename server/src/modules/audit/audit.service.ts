/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Audit Logging Service — VERTIKAL SMA JAWARA 28
 * Records immutable audit trails for every sensitive action:
 * - Login / Logout / Failed Login
 * - Account creation, update, deactivation, archival
 * - Class & Rombel membership mutations
 * - Journal score corrections & admin validations
 * - App settings & schedule updates
 */

import crypto from 'node:crypto';
import { RelationalDatabase } from '../../database/client.ts';

export interface AuditLogInput {
  actor_user_id?: string | null;
  actor_username?: string | null;
  actor_role?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_state?: unknown;
  after_state?: unknown;
  reason?: string | null;
  ip_address?: string | null;
}

export class AuditService {
  private readonly db: RelationalDatabase;

  constructor(db: RelationalDatabase) {
    this.db = db;
  }

  public log(input: AuditLogInput): string {
    const id = `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    this.db.execute(
      `INSERT INTO audit_logs
       (id, actor_user_id, actor_username, actor_role, action, entity_type, entity_id, before_state_json, after_state_json, reason, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        input.actor_user_id || null,
        input.actor_username || 'system',
        input.actor_role || 'SYSTEM',
        input.action,
        input.entity_type,
        input.entity_id,
        input.before_state !== undefined ? JSON.stringify(input.before_state) : null,
        input.after_state !== undefined ? JSON.stringify(input.after_state) : null,
        input.reason || null,
        input.ip_address || null,
      ]
    );
    return id;
  }

  public getRecentAuditLogs(limit = 100, entityType?: string) {
    if (entityType) {
      return this.db.queryAll(
        `SELECT * FROM audit_logs WHERE entity_type = ? ORDER BY created_at DESC LIMIT ?`,
        [entityType, limit]
      );
    }
    return this.db.queryAll(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?`, [limit]);
  }
}
