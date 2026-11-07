'use client';

import { useRef } from 'react';
import { Printer } from 'lucide-react';

export function BPUTKPrintView({ data, mandorInfo, onClose }: { data: any, mandorInfo: any, onClose: () => void }) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    const originalContent = document.body.innerHTML;
    
    if (printContent) {
      // Simple print trick for Next.js
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`
          <html>
            <head>
              <title>Print BPUTK</title>
              <style>
                @page { size: A4 landscape; margin: 10mm; }
                body { font-family: Arial, sans-serif; font-size: 11px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #000; padding: 4px; }
                th { background-color: #f1f5f9; font-weight: bold; text-align: center; }
                .bg-yellow { background-color: #fef08a; }
                .bg-gray { background-color: #f1f5f9; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .font-bold { font-weight: bold; }
                .header-title { font-size: 14px; font-weight: bold; text-align: center; margin-bottom: 20px; }
                .sig-grid { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; margin-top: 30px; }
              </style>
            </head>
            <body>${printContent}</body>
          </html>
        `);
        win.document.close();
        win.print();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 flex flex-col items-center overflow-y-auto p-4">
      <div className="w-full max-w-7xl flex justify-between items-center mb-4 bg-white p-3 rounded-lg shadow">
        <h2 className="font-bold text-lg">Preview Cetak: Biaya Pembayaran Upah</h2>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded text-slate-600 hover:bg-slate-50">Tutup</button>
          <button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded font-bold flex items-center gap-2">
            <Printer size={18} /> Cetak PDF
          </button>
        </div>
      </div>

      {/* AREA YANG AKAN DI-CETAK */}
      <div className="bg-white p-8 w-full max-w-7xl shadow-lg text-xs" ref={printRef}>
        <div className="header-title">BIAYA PEMBAYARAN UPAH TENAGA KERJA</div>
        
        <div className="mb-4">
          <table className="w-1/2">
            <tbody>
              <tr><td className="w-32 font-bold">Mandor / Pelaksana</td><td>: {mandorInfo.company_name}</td></tr>
              <tr><td className="font-bold">Nomor SPK</td><td>: {mandorInfo.spk_number}</td></tr>
              <tr><td className="font-bold">Periode Opname</td><td>: {data.periode}</td></tr>
            </tbody>
          </table>
        </div>

        <table>
          <thead>
            <tr>
              <th rowSpan={2}>No</th>
              <th rowSpan={2}>Uraian Kegiatan</th>
              <th rowSpan={2} className="bg-gray">Sat</th>
              <th colSpan={4} className="bg-gray">HARGA KONTRAK</th>
              <th colSpan={2} className="bg-gray">Periode s/d Lalu</th>
              <th colSpan={2} className="bg-yellow">Periode Saat Ini</th>
              <th colSpan={2} className="bg-gray">S/D Saat Ini</th>
              <th colSpan={2} className="bg-gray">Sisa Progress</th>
            </tr>
            <tr>
              <th className="bg-gray">Vol</th>
              <th className="bg-gray">Harga Satuan</th>
              <th className="bg-gray">Jumlah Kontrak</th>
              <th className="bg-gray">Bobot (%)</th>
              <th className="bg-gray">Vol</th>
              <th className="bg-gray">Nilai</th>
              <th className="bg-yellow">Vol</th>
              <th className="bg-yellow">Nilai</th>
              <th className="bg-gray">Vol</th>
              <th className="bg-gray">Nilai</th>
              <th className="bg-gray">Vol</th>
              <th className="bg-gray">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item: any, idx: number) => (
              <tr key={idx}>
                <td className="text-center">{idx + 1}</td>
                <td>{item.name}</td>
                <td className="text-center">{item.unit}</td>
                <td className="text-right">{item.volKontrak}</td>
                <td className="text-right">{item.harga.toLocaleString('id-ID')}</td>
                <td className="text-right">{item.totalKontrak.toLocaleString('id-ID')}</td>
                <td className="text-center">{item.bobot}</td>
                <td className="text-right">{item.volLalu}</td>
                <td className="text-right">{item.nilaiLalu.toLocaleString('id-ID')}</td>
                <td className="text-right bg-yellow font-bold">{item.volSaatIni}</td>
                <td className="text-right bg-yellow font-bold">{item.nilaiSaatIni.toLocaleString('id-ID')}</td>
                <td className="text-right">{item.volSd}</td>
                <td className="text-right">{item.nilaiSd.toLocaleString('id-ID')}</td>
                <td className="text-right">{item.volSisa}</td>
                <td className="text-right">{item.nilaiSisa.toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray font-bold">
              <td colSpan={5} className="text-right">SUB TOTAL PEMBAYARAN MANDOR :</td>
              <td className="text-right">{data.totalKontrak.toLocaleString('id-ID')}</td>
              <td className="text-center">{data.totalBobot}%</td>
              <td className="text-right">{data.totalNilaiLalu.toLocaleString('id-ID')}</td>
              <td></td>
              <td className="text-right bg-yellow">{data.totalNilaiSaatIni.toLocaleString('id-ID')}</td>
              <td></td>
              <td className="text-right">{data.totalNilaiSd.toLocaleString('id-ID')}</td>
              <td></td>
              <td className="text-right">{data.totalNilaiSisa.toLocaleString('id-ID')}</td>
            </tr>
          </tfoot>
        </table>

        {/* KOTAK REKONSILIASI */}
        <div className="mt-2 border border-black p-2 bg-yellow-50">
           <div className="font-bold text-[9px] mb-1">
             📐 RUMUS SAK/KUP: <span className="font-mono bg-white px-1 border border-yellow-300">Net = A − F + D − R − K</span> | 
             <span className="font-mono ml-2">Retensi = DPP × {data.retensiRate}%</span> | 
             <span className="font-mono ml-2">PPh 4(2) = DPP × {data.pphRate}%</span>
           </div>
           <div className="text-[8px] text-yellow-800 italic">Dasar: SAK ETAP Bab 23 • UU PPh Pasal 4(2) — PP No. 9/2022 • UU PPN No. 7/2021</div>
        </div>

        {/* RINGKASAN NILAI */}
        <div className="mt-4 w-full">
          <table className="w-full">
             <tbody>
               <tr><td className="text-right font-bold w-3/4">NILAI BERSIH DIBAYARKAN (NETTO) PERIODE LALU :</td><td className="text-right font-bold">Rp {data.sak.Net_transfer.toLocaleString('id-ID')}</td></tr>
               <tr><td className="text-right font-bold">SUBTOTAL TAGIHAN BRUTTO PERIODE INI [A] :</td><td className="text-right font-bold">Rp {data.sak.A_bruto.toLocaleString('id-ID')}</td></tr>
               <tr className="text-red-600"><td className="text-right font-bold">(−) POTONGAN PPH PASAL 4(2) [F = DPP × {data.pphRate}%] :</td><td className="text-right font-bold">− Rp {data.sak.F_pph42.toLocaleString('id-ID')}</td></tr>
               <tr className="text-blue-600"><td className="text-right font-bold">(+) PAJAK PPN {data.ppnRate}% [D = DPP × {data.ppnRate}%] :</td><td className="text-right font-bold">Rp {data.sak.D_ppn.toLocaleString('id-ID')}</td></tr>
               <tr className="text-yellow-700"><td className="text-right font-bold">(−) RETENSI PROYEK ({data.retensiRate}%) [R = DPP × {data.retensiRate}%] :</td><td className="text-right font-bold">− Rp {data.sak.R_retensi.toLocaleString('id-ID')}</td></tr>
               <tr className="text-yellow-700"><td className="text-right font-bold">(−) PENGEMBALIAN KASBON / ALAT [K] :</td><td className="text-right font-bold">− Rp {data.sak.K_kasbon.toLocaleString('id-ID')}</td></tr>
               <tr className="bg-green-50 text-green-700 font-bold text-sm"><td className="text-right">NILAI BERSIH DIBAYARKAN (NETTO) PERIODE INI [A − F + D − R − K] :</td><td className="text-right">Rp {data.sak.Net_transfer.toLocaleString('id-ID')}</td></tr>
             </tbody>
          </table>
        </div>

        {/* TANDA TANGAN */}
        <div className="sig-grid mt-10">
          <div><div className="mb-12">Direksi</div><div className="font-bold underline">RIZQI BILLAH BASALAMAH</div></div>
          <div><div className="mb-12">KA. DIVISI INFRA</div><div className="font-bold underline">MEI SUNARKO</div></div>
          <div><div className="mb-12">Ass. DIVISI INFRA</div><div className="font-bold underline">ARIF DARMAWAN</div></div>
          <div><div className="mb-12">Ka. Pembelian</div><div className="font-bold underline">M. MAULIDIN</div></div>
          <div><div className="mb-12">Pengendali</div><div className="font-bold underline">PENGENDALI</div></div>
          <div><div className="mb-12">Site Engineer</div><div className="font-bold underline">SAIFUDDIN FAHMI</div></div>
          <div><div className="mb-12">Dibuat Oleh,<br/>Kepala Mandor</div><div className="font-bold underline">{mandorInfo.company_name}</div></div>
        </div>
      </div>
    </div>
  );
}