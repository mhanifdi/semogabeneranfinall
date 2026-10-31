/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface RadarItem {
  habit: string;
  label: string;
  score: number;
}

interface RadarChartProps {
  data: RadarItem[];
  compareData?: { label: string; color: string; scores: number[] }[];
  size?: number;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  data,
  compareData,
  size = 320,
}) => {
  const center = size / 2;
  const radius = size * 0.38;
  const totalAxes = data.length || 7;
  const angleStep = (Math.PI * 2) / totalAxes;

  // Background concentric polygons (20, 40, 60, 80, 100)
  const levels = [0.2, 0.4, 0.6, 0.8, 1.0];

  const getCoordinates = (value: number, index: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (Math.min(100, Math.max(0, value)) / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  // Primary polygon points
  const primaryPoints = data
    .map((item, i) => {
      const { x, y } = getCoordinates(item.score || 0, i);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="flex flex-col items-center justify-center p-2">
      <svg width={size} height={size} className="overflow-visible">
        {/* Background webs */}
        {levels.map((lvl, lvlIdx) => {
          const pts = Array.from({ length: totalAxes })
            .map((_, i) => {
              const angle = i * angleStep - Math.PI / 2;
              const r = lvl * radius;
              return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
            })
            .join(' ');
          return (
            <polygon
              key={lvlIdx}
              points={pts}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray={lvlIdx < 4 ? '2 2' : 'none'}
            />
          );
        })}

        {/* Axes lines & labels */}
        {data.map((item, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const xEnd = center + radius * Math.cos(angle);
          const yEnd = center + radius * Math.sin(angle);
          const labelDist = radius + 22;
          const xLabel = center + labelDist * Math.cos(angle);
          const yLabel = center + labelDist * Math.sin(angle);

          return (
            <g key={i}>
              <line
                x1={center}
                y1={center}
                x2={xEnd}
                y2={yEnd}
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              <text
                x={xLabel}
                y={yLabel}
                textAnchor="middle"
                dominantBaseline="central"
                className="text-[10px] font-bold fill-slate-700 select-none"
              >
                {item.label}
              </text>
            </g>
          );
        })}

        {/* Comparison polygons (Class / School) */}
        {compareData?.map((comp, compIdx) => {
          const compPts = comp.scores
            .map((val, i) => {
              const { x, y } = getCoordinates(val, i);
              return `${x},${y}`;
            })
            .join(' ');
          return (
            <polygon
              key={compIdx}
              points={compPts}
              fill="none"
              stroke={comp.color}
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity="0.8"
            />
          );
        })}

        {/* Primary Data polygon */}
        <polygon
          points={primaryPoints}
          fill="rgba(28, 93, 220, 0.2)"
          stroke="#1c5ddc"
          strokeWidth="2.5"
        />

        {/* Primary data vertex dots */}
        {data.map((item, i) => {
          const { x, y } = getCoordinates(item.score || 0, i);
          const scoreNum = Number(item.score || 0);
          const displayScore = scoreNum % 1 === 0 ? Math.round(scoreNum) : scoreNum.toFixed(1);
          return (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r="4"
                fill="#1c5ddc"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <text
                x={x}
                y={y - 8}
                textAnchor="middle"
                className="text-[9px] font-black fill-[#1c5ddc]"
              >
                {displayScore}
              </text>
            </g>
          );
        })}
      </svg>

      {compareData && compareData.length > 0 && (
        <div className="flex items-center justify-center gap-3 mt-2 flex-wrap text-[10px] font-bold">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1c5ddc]" />
            <span className="text-slate-700">Murid</span>
          </div>
          {compareData.map((c, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <span className="w-2.5 h-1 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="text-slate-600">{c.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
