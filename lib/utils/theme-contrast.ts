// lib/utils/theme-contrast.ts
// Enterprise Adaptive Theme Engine: Degradasi Warna Eksekutif + Auto Warna Font (WCAG 2.1 AA/AAA)

export interface ExecutiveThemePreset {
  id: string;
  name: string;
  subtitle: string;
  from: string;
  via: string;
  to: string;
  accent: string;
  softBg: string;
  softBorder: string;
  glow: string;
}

export interface AutoContrastPalette {
  textColor: '#ffffff' | '#0f172a';
  mutedTextColor: string;
  badgeBg: string;
  badgeBorder: string;
  contrastRatio: number;
  isLightBackground: boolean;
}

export const EXECUTIVE_THEME_STORAGE_KEY = 'infracontrol_executive_theme_v1';
export const EXECUTIVE_CUSTOM_HEX_STORAGE_KEY = 'infracontrol_custom_brand_hex_v1';

export const EXECUTIVE_THEMES: ExecutiveThemePreset[] = [
  {
    id: 'indigo',
    name: 'Executive Indigo',
    subtitle: 'Deep Indigo • Royal Blue',
    from: '#312e81',
    via: '#4f46e5',
    to: '#0284c7',
    accent: '#4f46e5',
    softBg: 'rgba(79, 70, 229, 0.08)',
    softBorder: 'rgba(79, 70, 229, 0.24)',
    glow: 'rgba(79, 70, 229, 0.45)',
  },
  {
    id: 'emerald',
    name: 'Sovereign Emerald',
    subtitle: 'Forest • Teal Prestige',
    from: '#064e3b',
    via: '#059669',
    to: '#0d9488',
    accent: '#059669',
    softBg: 'rgba(5, 150, 105, 0.08)',
    softBorder: 'rgba(5, 150, 105, 0.25)',
    glow: 'rgba(5, 150, 105, 0.42)',
  },
  {
    id: 'sapphire',
    name: 'Ocean Sapphire',
    subtitle: 'Navy • Azure Cyan',
    from: '#0c4a6e',
    via: '#0284c7',
    to: '#06b6d4',
    accent: '#0284c7',
    softBg: 'rgba(2, 132, 199, 0.08)',
    softBorder: 'rgba(2, 132, 199, 0.25)',
    glow: 'rgba(2, 132, 199, 0.42)',
  },
  {
    id: 'gold',
    name: 'Royal Amber Gold',
    subtitle: 'Gold • Auto Dark Font',
    from: '#f59e0b',
    via: '#fbbf24',
    to: '#fde047',
    accent: '#d97706',
    softBg: 'rgba(245, 158, 11, 0.12)',
    softBorder: 'rgba(217, 119, 6, 0.30)',
    glow: 'rgba(245, 158, 11, 0.45)',
  },
  {
    id: 'crimson',
    name: 'Corporate Crimson',
    subtitle: 'Burgundy • Executive Rose',
    from: '#881337',
    via: '#e11d48',
    to: '#ea580c',
    accent: '#e11d48',
    softBg: 'rgba(225, 29, 72, 0.08)',
    softBorder: 'rgba(225, 29, 72, 0.24)',
    glow: 'rgba(225, 29, 72, 0.42)',
  },
];

export function normalizeHex(hex: string): string {
  const clean = String(hex || '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return (
      '#' +
      clean
        .split('')
        .map((c) => c + c)
        .join('')
        .toLowerCase()
    );
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return '#' + clean.toLowerCase();
  }
  return '#4f46e5';
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const full = normalizeHex(hex).slice(1);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Menghitung Relative Luminance sesuai standar W3C WCAG 2.1.
 */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (channel: number) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Menghitung rasio kontras WCAG 2.1 antara dua warna HEX (rentang 1.0 - 21.0).
 */
export function getContrastRatio(hexA: string, hexB: string): number {
  const l1 = getRelativeLuminance(hexA);
  const l2 = getRelativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * Menentukan Auto Warna Font paling optimal (#ffffff atau #0f172a) berdasarkan kontras WCAG
 * terhadap satu warna latar atau rata-rata beberapa stop warna degradasi.
 */
export function getAutoGradientContrast(hexStops: string[]): AutoContrastPalette {
  const stops = Array.isArray(hexStops) && hexStops.length > 0 ? hexStops : ['#4f46e5'];
  const rgbs = stops.map(hexToRgb);
  const avgHex = rgbToHex(
    rgbs.reduce((s, c) => s + c.r, 0) / rgbs.length,
    rgbs.reduce((s, c) => s + c.g, 0) / rgbs.length,
    rgbs.reduce((s, c) => s + c.b, 0) / rgbs.length
  );

  const whiteContrast = getContrastRatio(avgHex, '#ffffff');
  const darkContrast = getContrastRatio(avgHex, '#0f172a');
  const useDarkText = darkContrast > whiteContrast;

  return {
    textColor: useDarkText ? '#0f172a' : '#ffffff',
    mutedTextColor: useDarkText ? 'rgba(15, 23, 42, 0.76)' : 'rgba(255, 255, 255, 0.82)',
    badgeBg: useDarkText ? 'rgba(15, 23, 42, 0.10)' : 'rgba(255, 255, 255, 0.16)',
    badgeBorder: useDarkText ? 'rgba(15, 23, 42, 0.20)' : 'rgba(255, 255, 255, 0.26)',
    contrastRatio: Math.max(whiteContrast, darkContrast),
    isLightBackground: useDarkText,
  };
}

export function getAutoContrastColor(bgHex: string): '#ffffff' | '#0f172a' {
  return getAutoGradientContrast([bgHex]).textColor;
}

/**
 * Membuat preset degradasi 3-stop harmonis dari 1 warna HEX pilihan pengguna.
 */
export function buildCustomGradientTheme(baseHex: string): ExecutiveThemePreset {
  const norm = normalizeHex(baseHex);
  const { r, g, b } = hexToRgb(norm);
  const darker = rgbToHex(r * 0.68, g * 0.68, b * 0.78);
  const lighter = rgbToHex(r + (255 - r) * 0.22, g + (255 - g) * 0.22, b + (255 - b) * 0.18);
  return {
    id: 'custom',
    name: 'Custom Brand',
    subtitle: norm.toUpperCase(),
    from: darker,
    via: norm,
    to: lighter,
    accent: norm,
    softBg: `rgba(${r}, ${g}, ${b}, 0.10)`,
    softBorder: `rgba(${r}, ${g}, ${b}, 0.28)`,
    glow: `rgba(${r}, ${g}, ${b}, 0.42)`,
  };
}

export function resolveExecutiveTheme(
  themeId?: string | null,
  customHex?: string | null
): { preset: ExecutiveThemePreset; contrast: AutoContrastPalette } {
  if (themeId === 'custom' && customHex) {
    const preset = buildCustomGradientTheme(customHex);
    const contrast = getAutoGradientContrast([preset.from, preset.via, preset.to]);
    return { preset, contrast };
  }
  const preset =
    EXECUTIVE_THEMES.find((t) => t.id === themeId) || EXECUTIVE_THEMES[0];
  const contrast = getAutoGradientContrast([preset.from, preset.via, preset.to]);
  return { preset, contrast };
}

/**
 * Menerapkan CSS Variables Degradasi Warna & Auto Warna Font ke dokumen aktif secara instan.
 */
export function applyExecutiveThemeToDom(themeId: string, customHex?: string): {
  preset: ExecutiveThemePreset;
  contrast: AutoContrastPalette;
} {
  const resolved = resolveExecutiveTheme(themeId, customHex);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    const { preset, contrast } = resolved;
    root.style.setProperty('--brand-from', preset.from);
    root.style.setProperty('--brand-via', preset.via);
    root.style.setProperty('--brand-to', preset.to);
    root.style.setProperty(
      '--brand-gradient',
      `linear-gradient(135deg, ${preset.from} 0%, ${preset.via} 52%, ${preset.to} 100%)`
    );
    root.style.setProperty('--brand-accent', preset.accent);
    root.style.setProperty('--brand-soft-bg', preset.softBg);
    root.style.setProperty('--brand-soft-border', preset.softBorder);
    root.style.setProperty('--brand-glow', preset.glow);
    root.style.setProperty('--brand-on-primary', contrast.textColor);
    root.style.setProperty('--brand-on-primary-muted', contrast.mutedTextColor);
    root.style.setProperty('--brand-badge-bg', contrast.badgeBg);
    root.style.setProperty('--brand-badge-border', contrast.badgeBorder);
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(EXECUTIVE_THEME_STORAGE_KEY, resolved.preset.id);
      if (resolved.preset.id === 'custom' && customHex) {
        localStorage.setItem(EXECUTIVE_CUSTOM_HEX_STORAGE_KEY, normalizeHex(customHex));
      }
    } catch {}
  }
  return resolved;
}
