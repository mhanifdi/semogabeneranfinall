/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Sistem Tema Warna SMAN 28 Jakarta
 * 6 Pilihan Warna Dasar sesuai preferensi pengguna:
 * #eb30a2, #feb52b, #1c5ddc, #0000fe, #fc351c, #19ae5d
 */

export interface ThemeOption {
  id: string;
  name: string;
  hex: string;
  darkHex: string;
  tintBg: string;
  softBorder: string;
  tagline: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'biru-edukasi',
    name: 'Biru Edukasi SMAN 28 (Default)',
    hex: '#1c5ddc',
    darkHex: '#1446a8',
    tintBg: 'rgba(28, 93, 220, 0.05)',
    softBorder: 'rgba(28, 93, 220, 0.25)',
    tagline: 'Karakter Cerdas & Wawasan Global',
  },
  {
    id: 'pink-jawara',
    name: 'Pink Magenta Jawara',
    hex: '#eb30a2',
    darkHex: '#bd1b7f',
    tintBg: 'rgba(235, 48, 162, 0.06)',
    softBorder: 'rgba(235, 48, 162, 0.25)',
    tagline: 'Semangat Kreatif & Humanis',
  },
  {
    id: 'kuning-emas',
    name: 'Kuning Emas Kehormatan',
    hex: '#feb52b',
    darkHex: '#d89417',
    tintBg: 'rgba(254, 181, 43, 0.08)',
    softBorder: 'rgba(254, 181, 43, 0.35)',
    tagline: 'Prestasi Luhur & Integritas',
  },
  {
    id: 'biru-elektrik',
    name: 'Biru Elektrik Modern',
    hex: '#0000fe',
    darkHex: '#0000c2',
    tintBg: 'rgba(0, 0, 254, 0.06)',
    softBorder: 'rgba(0, 0, 254, 0.25)',
    tagline: 'Tegas, Logis & Visioner',
  },
  {
    id: 'merah-semangat',
    name: 'Merah Semangat Juara',
    hex: '#fc351c',
    darkHex: '#cb230d',
    tintBg: 'rgba(252, 53, 28, 0.06)',
    softBorder: 'rgba(252, 53, 28, 0.25)',
    tagline: 'Keberanian & Tanggung Jawab',
  },
  {
    id: 'hijau-adiwiyata',
    name: 'Hijau Adiwiyata Mandiri',
    hex: '#19ae5d',
    darkHex: '#128647',
    tintBg: 'rgba(25, 174, 93, 0.07)',
    softBorder: 'rgba(25, 174, 93, 0.28)',
    tagline: 'Kelestarian Alam & Peduli Lingkungan',
  },
];

export const DEFAULT_THEME = THEME_OPTIONS[0];

export function applyTheme(hex: string) {
  if (typeof window === 'undefined') return;
  const theme = THEME_OPTIONS.find((t) => t.hex.toLowerCase() === hex.toLowerCase()) || DEFAULT_THEME;
  const root = document.documentElement;
  root.style.setProperty('--primary-color', theme.hex);
  root.style.setProperty('--primary-dark', theme.darkHex);
  root.style.setProperty('--theme-tint-bg', theme.tintBg);
  root.style.setProperty('--theme-soft-border', theme.softBorder);
  localStorage.setItem('jawara28_theme_hex', theme.hex);
}

export function getSavedTheme(): ThemeOption {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const saved = localStorage.getItem('jawara28_theme_hex');
  if (!saved) return DEFAULT_THEME;
  return THEME_OPTIONS.find((t) => t.hex.toLowerCase() === saved.toLowerCase()) || DEFAULT_THEME;
}
