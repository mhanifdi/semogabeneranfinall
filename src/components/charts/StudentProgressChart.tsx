/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentProgressChart — Spesifikasi Final Section 13 (Grafik Perkembangan Siswa)
 * - Pilihan untuk menampilkan salah satu dari 7 kebiasaan atau Rata-rata Harian
 * - Pilihan untuk berpindah antara Grafik Garis (Line Chart) dan Grafik Batang (Bar Chart)
 * - Menampilkan data dari hari pertama hingga hari terakhir yang tersedia di database (14 hari)
 */

import React, { useState } from 'react';
import { TrendingUp, BarChart3, Filter } from 'lucide-react';

export interface DailyProgressPoint {
  dayIndex: number;
  date: string;
  label: string;
  fullLabel: string;
  bangun: number;
  ibadah: number;
  olahraga: number;
  makan: number;
  belajar: number;
  masyarakat: number;
  tidur: number;
  rataRata: number;
  completedCount: number;
  status: string;
}

interface StudentProgressChartProps {
  series: DailyProgressPoint[];
  title?: string;
}

const HABIT_OPTIONS: { key: keyof DailyProgressPoint; label: string; color: string }[] = [
  { key: 'rataRata', label: 'Rata-rata 7 KAIH', color: '#1c5ddc' },
  { key: 'bangun', label: '1. Bangun Pagi', color: '#0284c7' },
  { key: 'ibadah', label: '2. Beribadah', color: '#19ae5d' },
  { key: 'olahraga', label: '3. Berolahraga', color: '#fc351c' },
  { key: 'makan', label: '4. Makan Bergizi', color: '#f59e0b' },
  { key: 'belajar', label: '5. Gemar Belajar', color: '#4f46e5' },
  { key: 'masyarakat', label: '6. Bermasyarakat', color: '#0d9488' },
  { key: 'tidur', label: '7. Tidur Cepat', color: '#7c3aed' },
];

export const StudentProgressChart: React.FC<StudentProgressChartProps> = ({ series }) => {
  const [selectedHabit, setSelectedHabit] = useState<keyof DailyProgressPoint>('rataRata');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const activeMeta = HABIT_OPTIONS.find((h) => h.key === selectedHabit) || HABIT_OPTIONS[0];
  const dataPoints = series && series.length > 0 ? series : [];

  const width = 680;
  const height = 220;
  const padLeft = 36;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  return (
    <div className="space-y-3">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-bold text-slate-700">Pilih Kebiasaan:</span>
          <select
            value={selectedHabit}
            onChange={(e) => setSelectedHabit(e.target.value as keyof DailyProgressPoint)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1c5ddc]"
          >
            {HABIT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Toggle Line vs Bar */}
        <div className="inline-flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setChartType('line')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              chartType === 'line'
                ? 'bg-white text-[#1c5ddc] shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Grafik Garis
          </button>
          <button
            type="button"
            onClick={() => setChartType('bar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              chartType === 'bar'
                ? 'bg-white text-[#1c5ddc] shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Grafik Batang
          </button>
        </div>
      </div>

      {/* SVG Visualization */}
      {dataPoints.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
          Belum ada riwayat nilai perkembangan untuk ditampilkan.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-3 overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto min-w-[480px]"
          >
            {/* Horizontal grid lines (0, 25, 50, 75, 100) */}
            {[0, 25, 50, 75, 100].map((val) => {
              const y = padTop + plotH - (val / 100) * plotH;
              return (
                <g key={val}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeDasharray={val === 0 ? undefined : '4 4'}
                    strokeWidth="1"
                  />
                  <text
                    x={padLeft - 6}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="9"
                    fill="#64748b"
                    fontWeight="bold"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {chartType === 'bar' ? (
              /* BAR CHART */
              dataPoints.map((pt, idx) => {
                const val = Math.max(0, Math.min(100, Number(pt[selectedHabit] || 0)));
                const stepW = plotW / Math.max(1, dataPoints.length);
                const barW = Math.min(28, stepW * 0.62);
                const x = padLeft + idx * stepW + (stepW - barW) / 2;
                const barH = (val / 100) * plotH;
                const y = padTop + plotH - barH;
                return (
                  <g key={pt.date}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(2, barH)}
                      rx="5"
                      fill={activeMeta.color}
                      opacity={val > 0 ? 0.9 : 0.2}
                    />
                    {val > 0 && (
                      <text
                        x={x + barW / 2}
                        y={y - 5}
                        textAnchor="middle"
                        fontSize="8.5"
                        fontWeight="bold"
                        fill="#1e293b"
                      >
                        {val}
                      </text>
                    )}
                    <text
                      x={x + barW / 2}
                      y={height - 14}
                      textAnchor="middle"
                      fontSize="8.5"
                      fontWeight="600"
                      fill="#475569"
                    >
                      {pt.label}
                    </text>
                  </g>
                );
              })
            ) : (
              /* LINE CHART */
              (() => {
                const coords = dataPoints.map((pt, idx) => {
                  const val = Math.max(0, Math.min(100, Number(pt[selectedHabit] || 0)));
                  const x =
                    dataPoints.length === 1
                      ? padLeft + plotW / 2
                      : padLeft + (idx / (dataPoints.length - 1)) * plotW;
                  const y = padTop + plotH - (val / 100) * plotH;
                  return { x, y, val, label: pt.label, date: pt.date };
                });

                const polylinePts = coords.map((c) => `${c.x},${c.y}`).join(' ');
                const areaPts = `${coords[0].x},${padTop + plotH} ${polylinePts} ${
                  coords[coords.length - 1].x
                },${padTop + plotH}`;

                return (
                  <g>
                    <polygon points={areaPts} fill={activeMeta.color} opacity="0.12" />
                    <polyline
                      fill="none"
                      stroke={activeMeta.color}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={polylinePts}
                    />
                    {coords.map((c) => (
                      <g key={c.date}>
                        <circle
                          cx={c.x}
                          cy={c.y}
                          r="4"
                          fill="#ffffff"
                          stroke={activeMeta.color}
                          strokeWidth="2.5"
                        />
                        {c.val > 0 && (
                          <text
                            x={c.x}
                            y={c.y - 7}
                            textAnchor="middle"
                            fontSize="8.5"
                            fontWeight="bold"
                            fill="#0f172a"
                          >
                            {c.val}
                          </text>
                        )}
                        <text
                          x={c.x}
                          y={height - 14}
                          textAnchor="middle"
                          fontSize="8.5"
                          fontWeight="600"
                          fill="#475569"
                        >
                          {c.label}
                        </text>
                      </g>
                    ))}
                  </g>
                );
              })()
            )}
          </svg>
        </div>
      )}
    </div>
  );
};
