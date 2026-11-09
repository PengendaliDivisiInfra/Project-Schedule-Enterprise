// lib/utils/spk-helper.ts

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

// 5. Terbilang (Simple implementation)
export const terbilang = (nilai: number): string => {
  const angka = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  const hitung = (n: number): string => {
    if (n < 12) return angka[n];
    if (n < 20) return hitung(n - 10) + " Belas";
    if (n < 100) return hitung(Math.floor(n / 10)) + " Puluh " + hitung(n % 10);
    if (n < 200) return "Seratus " + hitung(n - 100);
    if (n < 1000) return hitung(Math.floor(n / 100)) + " Ratus " + hitung(n % 100);
    if (n < 2000) return "Seribu " + hitung(n - 1000);
    if (n < 1000000) return hitung(Math.floor(n / 1000)) + " Ribu " + hitung(n % 1000);
    if (n < 1000000000) return hitung(Math.floor(n / 1000000)) + " Juta " + hitung(n % 1000000);
    return "";
  };
  return hitung(nilai).trim() + " Rupiah";
};