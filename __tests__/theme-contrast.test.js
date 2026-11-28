import {
  getContrastRatio,
  getAutoContrastColor,
  getAutoGradientContrast,
  resolveExecutiveTheme,
  buildCustomGradientTheme,
} from '@/lib/utils/theme-contrast';

describe('Enterprise Adaptive Gradient & WCAG Auto Font Contrast Engine', () => {
  test('memilih teks putih (#ffffff) otomatis untuk degradasi gelap (Executive Indigo & Sovereign Emerald)', () => {
    const indigo = resolveExecutiveTheme('indigo');
    expect(indigo.contrast.textColor).toBe('#ffffff');
    expect(indigo.contrast.isLightBackground).toBe(false);
    expect(indigo.contrast.contrastRatio).toBeGreaterThanOrEqual(4.5);

    const emerald = resolveExecutiveTheme('emerald');
    expect(emerald.contrast.textColor).toBe('#ffffff');
    expect(emerald.contrast.contrastRatio).toBeGreaterThanOrEqual(4.5);
  });

  test('memilih teks gelap (#0f172a) otomatis untuk degradasi cerah (Royal Amber Gold & warna kuning/mint terang)', () => {
    const gold = resolveExecutiveTheme('gold');
    expect(gold.contrast.textColor).toBe('#0f172a');
    expect(gold.contrast.isLightBackground).toBe(true);
    expect(gold.contrast.contrastRatio).toBeGreaterThanOrEqual(7.0);

    expect(getAutoContrastColor('#fde047')).toBe('#0f172a');
    expect(getAutoContrastColor('#1e1b4b')).toBe('#ffffff');
  });

  test('buildCustomGradientTheme membentuk degradasi 3-stop valid dan rasio kontras WCAG akurat', () => {
    const custom = buildCustomGradientTheme('#38bdf8');
    expect(custom.id).toBe('custom');
    expect(custom.from).toMatch(/^#[0-9a-f]{6}$/);
    expect(custom.via).toBe('#38bdf8');
    expect(custom.to).toMatch(/^#[0-9a-f]{6}$/);

    const contrast = getAutoGradientContrast([custom.from, custom.via, custom.to]);
    expect(contrast.contrastRatio).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio('#ffffff', '#000000')).toBe(21);
  });
});
