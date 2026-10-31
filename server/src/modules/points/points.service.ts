/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Points & Gamification Ledger Service — VERTIKAL SMA JAWARA 28
 * Records immutable `point_transactions` with UNIQUE(student_id, point_bucket, source_type, source_id)
 * to guarantee idempotency and prevent duplicate point awards.
 */

import crypto from 'node:crypto';
import { RelationalDatabase } from '../../database/client.ts';

export class PointsService {
  private readonly db: RelationalDatabase;

  constructor(db: RelationalDatabase) {
    this.db = db;
  }

  /**
   * Awards or updates points in `point_transactions` idempotently.
   */
  public recordTransaction(params: {
    studentId: string;
    transactionDate: string;
    pointBucket: 'XP' | 'POIN_HEBAT' | 'STREAK_BONUS';
    sourceType: 'HABIT_COMPLETION' | 'EVENT_OVERFLOW' | 'STREAK_MILESTONE' | 'ADMIN_ADJUSTMENT' | 'MIGRATION';
    sourceId: string;
    amount: number;
    description: string;
    createdBy?: string | null;
  }): void {
    const cleanAmount = Math.round(Number(params.amount || 0));
    if (cleanAmount <= 0 && params.sourceType !== 'ADMIN_ADJUSTMENT') {
      return;
    }

    const existing = this.db.queryOne<{ id: string; amount: number }>(
      `SELECT id, amount FROM point_transactions
       WHERE student_id = ? AND point_bucket = ? AND source_type = ? AND source_id = ?`,
      [params.studentId, params.pointBucket, params.sourceType, params.sourceId]
    );

    if (existing) {
      if (existing.amount === cleanAmount) {
        return; // Already recorded with exact same amount — idempotent no-op
      }
      this.db.execute(
        `UPDATE point_transactions
         SET amount = ?, description = ?, created_at = datetime('now')
         WHERE id = ?`,
        [cleanAmount, params.description, existing.id]
      );
      return;
    }

    const currentBalanceRow = this.db.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM point_transactions
       WHERE student_id = ? AND point_bucket = ?`,
      [params.studentId, params.pointBucket]
    );
    const balanceAfter = Math.max(0, Number(currentBalanceRow?.total || 0) + cleanAmount);
    const txId = `ptx-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    this.db.execute(
      `INSERT INTO point_transactions
       (id, student_id, transaction_date, point_bucket, source_type, source_id, amount, balance_after, description, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        txId,
        params.studentId,
        params.transactionDate,
        params.pointBucket,
        params.sourceType,
        params.sourceId,
        cleanAmount,
        balanceAfter,
        params.description,
        params.createdBy || null,
      ]
    );
  }

  public getStudentTransactions(studentId: string, limit = 50) {
    return this.db.queryAll(
      `SELECT * FROM point_transactions WHERE student_id = ? ORDER BY transaction_date DESC, created_at DESC LIMIT ?`,
      [studentId, limit]
    );
  }
}
