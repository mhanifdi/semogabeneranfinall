/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Semicircle Gauge Chart
 * Uniform color matching the active score tier:
 * - Hijau (>= 90): Sangat Baik (Jawara)
 * - Biru (80 - 89.9): Baik & Konsisten
 * - Kuning (70 - 79.9): Cukup (Perlu Pembiasaan)
 * - Merah (< 70): Kurang (Perlu Perhatian)
 */

import React from 'react';

interface GaugeChartProps {
  score: number; // 0 to 100
  title?: string;
  size?: number;
}

export const GaugeChart: React.FC<GaugeChartProps> = ({
  score = 0,
  title = 'Rata-Rata Skor',
  size = 220,
}) => {
  const normalized = Math.min(100, Math.max(0, Number(score) || 0));
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size * 0.56;
  const strokeWidth = 14;

  // Determine active color and status text based on current score
  const getScoreMeta = (val: number) => {
    if (val >= 90) {
      return {
        color: '#10b981', // emerald-500
        status: 'Sangat Baik (Jawara)',
        badgeBg: '#d1fae5',
        badgeText: '#065f46',
      };
    }
    if (val >= 80) {
      return {
        color: '#2563eb', // blue-600
        status: 'Baik & Konsisten',
        badgeBg: '#dbeafe',
        badgeText: '#1e40af',
      };
    }
    if (val >= 70) {
      return {
        color: '#f59e0b', // amber-500
        status: 'Cukup (Perlu Pembiasaan)',
        badgeBg: '#fef3c7',
        badgeText: '#92400e',
      };
    }
    if (val > 0) {
      return {
        color: '#ef4444', // red-500
        status: 'Kurang (Perlu Perhatian)',
        badgeBg: '#fee2e2',
        badgeText: '#991b1b',
      };
    }
    return {
      color: '#94a3b8', // slate-400
      status: 'Belum Ada Data Entri',
      badgeBg: '#f1f5f9',
      badgeText: '#475569',
    };
  };

  const meta = getScoreMeta(normalized);

  // Angle formula: 0% -> Math.PI (180 deg, left) ; 100% -> 0 (0 deg, right)
  const getAngle = (pct: number) => Math.PI - (pct / 100) * Math.PI;

  const getCoordinates = (pct: number, radius = r) => {
    const angle = getAngle(pct);
    return {
      x: cx + radius * Math.cos(angle),
      y: cy - radius * Math.sin(angle),
    };
  };

  // Background arc: full semicircle from 0% to 100%
  // In SVG, clockwise arc (sweep-flag=1) from (cx - r, cy) to (cx + r, cy)
  const bgArcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  // Active arc: from 0% to normalized%
  // Since normalized <= 100, the arc angle is <= 180 deg, so large-arc-flag is always 0.
  const activeArcPath = (() => {
    if (normalized <= 0) return '';
    const endPoint = getCoordinates(normalized);
    // If normalized === 100, exact end is cx + r, cy
    return `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${endPoint.x} ${endPoint.y}`;
  })();

  // Needle tip
  const needleAngle = getAngle(normalized);
  const needleLength = r - 6;
  const nx = cx + needleLength * Math.cos(needleAngle);
  const ny = cy - needleLength * Math.sin(needleAngle);

  // Threshold ticks at 70, 80, 90
  const ticks = [
    { pct: 70, label: '70' },
    { pct: 80, label: '80' },
    { pct: 90, label: '90' },
  ];

  return (
    <div className="flex flex-col items-center justify-center p-3 select-none">
      <svg
        width={size}
        height={size * 0.65}
        viewBox={`0 0 ${size} ${size * 0.65}`}
        className="overflow-visible"
      >
        {/* Background Neutral Track */}
        <path
          d={bgArcPath}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Threshold divider ticks */}
        {ticks.map((t) => {
          const inner = getCoordinates(t.pct, r - strokeWidth / 2 - 1);
          const outer = getCoordinates(t.pct, r + strokeWidth / 2 + 1);
          return (
            <line
              key={`tick-${t.pct}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="butt"
            />
          );
        })}

        {/* Single Solid Active Track in the pointed color */}
        {normalized > 0 && (
          <path
            d={activeArcPath}
            fill="none"
            stroke={meta.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}

        {/* Needle Line */}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="#0f172a"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Pivot Center Cap */}
        <circle cx={cx} cy={cy} r="7" fill="#0f172a" />
        <circle cx={cx} cy={cy} r="3" fill="#ffffff" />

        {/* Min & Max Labels */}
        <text
          x={cx - r}
          y={cy + 18}
          className="text-[10px] fill-slate-400 font-semibold"
          textAnchor="middle"
        >
          0
        </text>
        <text
          x={cx + r}
          y={cy + 18}
          className="text-[10px] fill-slate-400 font-semibold"
          textAnchor="middle"
        >
          100
        </text>

        {/* Threshold labels */}
        {ticks.map((t) => {
          const pos = getCoordinates(t.pct, r + strokeWidth / 2 + 10);
          return (
            <text
              key={`label-${t.pct}`}
              x={pos.x}
              y={pos.y + 3}
              className="text-[9px] fill-slate-400 font-medium"
              textAnchor="middle"
            >
              {t.label}
            </text>
          );
        })}
      </svg>

      {/* Numeric Score & Status Card */}
      <div className="text-center mt-1">
        <div
          className="text-3xl font-black tracking-tight"
          style={{ color: meta.color }}
        >
          {normalized > 0 ? normalized.toFixed(1) : '0%'}
        </div>
        <div className="text-xs font-bold text-slate-700 mt-0.5">{title}</div>
        <div
          className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold mt-1"
          style={{ backgroundColor: meta.badgeBg, color: meta.badgeText }}
        >
          {meta.status}
        </div>
      </div>

      {/* Clean category legend */}
      <div className="flex items-center justify-center gap-2 mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> &lt;70
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> 70-79
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span> 80-89
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> 90+
        </span>
      </div>
    </div>
  );
};
