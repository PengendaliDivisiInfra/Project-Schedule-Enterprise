/**
 * Utilitas Terbilang Bahasa Indonesia (Standar Dokumen Keuangan & Kontrak Konstruksi).
 * - Mendukung nominal hingga Triliunan (< 10^15).
 * - Bebas bug "Nol" pada kelipatan bulat (mis. 35.000.000 -> "Tiga Puluh Lima Juta").
 * - Aman terhadap angka desimal, negatif, null, undefined, dan NaN.
 */

const SATUAN = [
  '',
  'Satu',
  'Dua',
  'Tiga',
  'Empat',
  'Lima',
  'Enam',
  'Tujuh',
  'Delapan',
  'Sembilan',
  'Sepuluh',
  'Sebelas',
];

function convertPositiveInt(n: number): string {
  if (n === 0) return '';
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${convertPositiveInt(n - 10)} Belas`;
  if (n < 100) {
    const puluhan = Math.floor(n / 10);
    const sisa = n % 10;
    return sisa > 0
      ? `${convertPositiveInt(puluhan)} Puluh ${convertPositiveInt(sisa)}`
      : `${convertPositiveInt(puluhan)} Puluh`;
  }
  if (n < 200) {
    const sisa = n - 100;
    return sisa > 0 ? `Seratus ${convertPositiveInt(sisa)}` : 'Seratus';
  }
  if (n < 1000) {
    const ratusan = Math.floor(n / 100);
    const sisa = n % 100;
    return sisa > 0
      ? `${convertPositiveInt(ratusan)} Ratus ${convertPositiveInt(sisa)}`
      : `${convertPositiveInt(ratusan)} Ratus`;
  }
  if (n < 2000) {
    const sisa = n - 1000;
    return sisa > 0 ? `Seribu ${convertPositiveInt(sisa)}` : 'Seribu';
  }
  if (n < 1_000_000) {
    const ribuan = Math.floor(n / 1000);
    const sisa = n % 1000;
    return sisa > 0
      ? `${convertPositiveInt(ribuan)} Ribu ${convertPositiveInt(sisa)}`
      : `${convertPositiveInt(ribuan)} Ribu`;
  }
  if (n < 1_000_000_000) {
    const jutaan = Math.floor(n / 1_000_000);
    const sisa = n % 1_000_000;
    return sisa > 0
      ? `${convertPositiveInt(jutaan)} Juta ${convertPositiveInt(sisa)}`
      : `${convertPositiveInt(jutaan)} Juta`;
  }
  if (n < 1_000_000_000_000) {
    const milyaran = Math.floor(n / 1_000_000_000);
    const sisa = n % 1_000_000_000;
    return sisa > 0
      ? `${convertPositiveInt(milyaran)} Milyar ${convertPositiveInt(sisa)}`
      : `${convertPositiveInt(milyaran)} Milyar`;
  }
  if (n < 1_000_000_000_000_000) {
    const triliunan = Math.floor(n / 1_000_000_000_000);
    const sisa = n % 1_000_000_000_000;
    return sisa > 0
      ? `${convertPositiveInt(triliunan)} Triliun ${convertPositiveInt(sisa)}`
      : `${convertPositiveInt(triliunan)} Triliun`;
  }
  return 'Angka Terlalu Besar';
}

/**
 * Mengubah angka menjadi teks terbilang Bahasa Indonesia (tanpa kata "Rupiah").
 * Contoh: terbilang(35000000) -> "Tiga Puluh Lima Juta"
 */
export function terbilang(angka: number): string {
  const num = Number(angka);
  if (!Number.isFinite(num)) return 'Nol';

  const rounded = Math.round(Math.abs(num));
  if (rounded === 0) return 'Nol';

  const words = convertPositiveInt(rounded).replace(/\s+/g, ' ').trim();
  return num < 0 ? `Minus ${words}` : words;
}

/**
 * Mengubah angka menjadi teks terbilang lengkap dengan akhiran "Rupiah".
 * Contoh: terbilangRupiah(35000000) -> "Tiga Puluh Lima Juta Rupiah"
 */
export function terbilangRupiah(angka: number): string {
  return `${terbilang(angka)} Rupiah`;
}