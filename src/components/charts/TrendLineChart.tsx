/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HabitMetricComparison } from '../../types';

interface TrendLineChartProps {
  metrics: HabitMetricComparison[];
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({ metrics }) => {
  const width = 640;
  const height = 240;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 45;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const getX = (idx: number) => {
    return paddingLeft + (idx / Math.max(1, metrics.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.min(100, Math.max(0, val));
    return paddingTop + chartHeight - (clamped / 100) * chartHeight;
  };

  // Generate paths
  const makePath = (key: 'studentScore' | 'classAvg' | 'angkatanAvg' | 'schoolAvg') => {
    return metrics
      .map((m, idx) => {
        const x = getX(idx);
        const y = getY(m[key] || 0);
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[500px]">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mb-2 text-xs font-semibold px-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#1c5ddc]" />
            <span className="text-slate-800">Capaian Murid</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 bg-[#feb52b] rounded" />
            <span className="text-slate-600">Rata-rata Kelas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 bg-[#19ae5d] rounded" />
            <span className="text-slate-600">Rata-rata Jenjang</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 bg-[#fc351c] rounded" />
            <span className="text-slate-600">Rata-rata Sekolah</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {/* Horizontal Grid lines (0, 25, 50, 75, 100) */}
          {[0, 25, 50, 75, 100].map((val) => {
            const y = getY(val);
            return (
              <g key={val}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[9px] fill-slate-400 font-medium"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* School avg line */}
          <path
            d={makePath('schoolAvg')}
            fill="none"
            stroke="#fc351c"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity="0.6"
          />

          {/* Angkatan avg line */}
          <path
            d={makePath('angkatanAvg')}
            fill="none"
            stroke="#19ae5d"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity="0.7"
          />

          {/* Class avg line */}
          <path
            d={makePath('classAvg')}
            fill="none"
            stroke="#feb52b"
            strokeWidth="2"
            opacity="0.8"
          />

          {/* Student line (Primary thick) */}
          <path
            d={makePath('studentScore')}
            fill="none"
            stroke="#1c5ddc"
            strokeWidth="3"
          />

          {/* Points for student */}
          {metrics.map((m, idx) => {
            const x = getX(idx);
            const y = getY(m.studentScore || 0);
            return (
              <g key={idx}>
                <circle cx={x} cy={y} r="4.5" fill="#1c5ddc" stroke="#fff" strokeWidth="2" />
                {/* Habit label at bottom */}
                <text
                  x={x}
                  y={height - 12}
                  textAnchor="middle"
                  className="text-[10px] font-bold fill-slate-700"
                >
                  {m.label.split(' ')[0]}
                </text>
                <text
                  x={x}
                  y={height - 2}
                  textAnchor="middle"
                  className="text-[9px] font-medium fill-slate-500"
                >
                  {m.label.split(' ').slice(1).join(' ')}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
