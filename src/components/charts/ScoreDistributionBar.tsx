/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface ScoreDistributionBarProps {
  distribution: {
    under70: number;
    between70_79: number;
    between80_89: number;
    between90_95: number;
    between96_100: number;
    noData?: number;
  };
}

export const ScoreDistributionBar: React.FC<ScoreDistributionBarProps> = ({ distribution }) => {
  const buckets = [
    { label: '< 70', count: distribution.under70, color: '#fc351c', desc: 'Perlu Bimbingan' },
    { label: '70–79', count: distribution.between70_79, color: '#feb52b', desc: 'Cukup' },
    { label: '80–89', count: distribution.between80_89, color: '#1c5ddc', desc: 'Baik' },
    { label: '90–95', count: distribution.between90_95, color: '#19ae5d', desc: 'Sangat Baik' },
    { label: '96–100', count: distribution.between96_100, color: '#0000fe', desc: 'Jawara Istimewa' },
  ];

  const total = buckets.reduce((sum, b) => sum + b.count, 0) + (distribution.noData || 0);
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>Rentang Skor</span>
        <span>Jumlah Murid ({total} total)</span>
      </div>

      <div className="space-y-2">
        {buckets.map((b) => {
          const pct = Math.round((b.count / Math.max(1, total)) * 100);
          const barWidth = Math.round((b.count / maxCount) * 100);
          return (
            <div key={b.label} className="flex items-center gap-3">
              <span className="w-14 text-xs font-bold text-slate-700 shrink-0">{b.label}</span>
              <div className="flex-1 bg-slate-100 h-6 rounded-lg overflow-hidden relative flex items-center">
                <div
                  className="h-full rounded-lg transition-all duration-500 flex items-center px-2"
                  style={{
                    width: `${Math.max(b.count > 0 ? 12 : 0, barWidth)}%`,
                    backgroundColor: b.color,
                  }}
                >
                  {b.count > 0 && (
                    <span className="text-[10px] font-black text-white">{b.count}</span>
                  )}
                </div>
                {b.count === 0 && (
                  <span className="text-[10px] text-slate-400 pl-2">0 murid</span>
                )}
              </div>
              <span className="w-12 text-right text-xs font-semibold text-slate-500 shrink-0">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      {distribution.noData !== undefined && distribution.noData > 0 && (
        <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 flex justify-between">
          <span>Belum mengisi riwayat kebiasaan:</span>
          <span className="font-bold text-slate-700">{distribution.noData} murid</span>
        </div>
      )}
    </div>
  );
};
