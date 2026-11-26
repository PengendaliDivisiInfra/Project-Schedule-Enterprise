// lib/utils/spk-helper.ts
import { terbilangRupiah } from '@/lib/utils/terbilang';

// 1. Konversi Bulan ke Romawi
export const monthToRoman = (month: number): string => {
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return roman[month - 1] || "I";
};

// 2. Generator Nomor SPK
export const generateSpkNumber = (
  projectCode: string, 
  companyCode: string, 
  sequence: number, 
  date: Date = new Date()
): string => {
  const seqStr = sequence.toString().padStart(3, '0');
  const romanMonth = monthToRoman(date.getMonth() + 1);
  const year = date.getFullYear();
  return `SP3/${projectCode}/${companyCode}/${seqStr}/${romanMonth}/${year}`;
};

// 3. Pembulatan Ke Ribuan Terdekat (Sesuai Word: 604.090.264,89 -> 604.090.000)
export const roundSPK_Thousands = (val: number): number => {
  return Math.floor(val / 1000) * 1000;
};

// 4. Format Rupiah
export const formatRupiah = (val: number): string => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
};

// 5. Terbilang Rupiah (Terpusat — mendukung hingga Triliunan & bebas bug "Nol")
export const terbilang = (nilai: number): string => {
  return terbilangRupiah(nilai);
};