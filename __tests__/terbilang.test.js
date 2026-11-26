import { terbilang, terbilangRupiah } from '@/lib/utils/terbilang';

describe('Utilitas Terbilang Indonesia (terbilang & terbilangRupiah)', () => {
  test('menangani nol, satuan, belasan, dan kelipatan bulat tanpa bug kata "Nol"', () => {
    expect(terbilang(0)).toBe('Nol');
    expect(terbilang(1)).toBe('Satu');
    expect(terbilang(11)).toBe('Sebelas');
    expect(terbilang(12)).toBe('Dua Belas');
    expect(terbilang(20)).toBe('Dua Puluh');
    expect(terbilang(100)).toBe('Seratus');
    expect(terbilang(1000)).toBe('Seribu');
    expect(terbilang(2026)).toBe('Dua Ribu Dua Puluh Enam');
    expect(terbilangRupiah(35_000_000)).toBe('Tiga Puluh Lima Juta Rupiah');
    expect(terbilangRupiah(50_000_000)).toBe('Lima Puluh Juta Rupiah');
  });

  test('mendukung nominal Milyar dan Triliun dengan akurat', () => {
    expect(terbilang(24_224_221_000)).toBe(
      'Dua Puluh Empat Milyar Dua Ratus Dua Puluh Empat Juta Dua Ratus Dua Puluh Satu Ribu'
    );
    expect(terbilangRupiah(1_250_000_000_000)).toBe(
      'Satu Triliun Dua Ratus Lima Puluh Milyar Rupiah'
    );
  });

  test('membulatkan desimal (slip gaji) dengan tepat dan aman terhadap negatif/NaN', () => {
    expect(terbilangRupiah(254_545.45)).toBe(
      'Dua Ratus Lima Puluh Empat Ribu Lima Ratus Empat Puluh Lima Rupiah'
    );
    expect(terbilang(-15_000)).toBe('Minus Lima Belas Ribu');
    expect(terbilang(Number.NaN)).toBe('Nol');
    expect(terbilang(Number.POSITIVE_INFINITY)).toBe('Nol');
  });
});
