'use client';

import { useState } from 'react';
import { Printer, FileText, Loader2, ArrowLeft } from 'lucide-react';
import { getBAOPData } from '@/lib/services/subcon.service';

interface BAOPViewProps {
  projectId: string;
  spks: any[];
  onClose: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function BAOPView({ projectId, spks, onClose, showToast }: BAOPViewProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ contract: any, opnames: any[] } | null>(null);
  
  const currentMonthRoman = new Date().toLocaleString('id-ID', { month: 'long' });
  
  const [form, setForm] = useState({
    contractId: '',
    nomorBAOP: `001/KL-BAOP/BKP/${currentMonthRoman.toUpperCase()}/${new Date().getFullYear()}`,
    tglMulai: new Date().toISOString().split('T')[0],
    tglSelesai: new Date().toISOString().split('T')[0],
  });

  const handleGenerate = async () => {
    if (!form.contractId) {
      showToast('Pilih Mandor terlebih dahulu', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const res = await getBAOPData(form.contractId, form.tglMulai, form.tglSelesai);
      setData(res);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    const printElement = document.getElementById('baop-print-area');
    if (!printElement) return;

    // Ambil HTML beserta style murni yang ada di dalamnya
    const htmlContent = printElement.innerHTML;
    
    const fullHtml = `
      <html>
        <head>
          <style>
            /* Reset & Setup A4 */
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 0; background: #fff; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `;

    try {
      setLoading(true);
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Karena CSS sudah ada di dalam htmlContent, puppeteer cukup render
        body: JSON.stringify({ html: fullHtml, format: 'A4', isLandscape: false, margin: '0' })
      });
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BAOP_${form.nomorBAOP.replace(/\//g, '_')}.pdf`;
      a.click();
      showToast('PDF berhasil diunduh', 'success');
    } catch (err: any) {
      showToast('Gagal cetak PDF: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const totalNilaiOpname = data?.opnames.reduce((sum, op) => sum + Number(op.total), 0) || 0;
  const nilaiKontrak = data?.contract?.contract_value || 1;
  const persentaseProgres = ((totalNilaiOpname / nilaiKontrak) * 100).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 bg-slate-200 flex flex-col overflow-y-auto">
      {/* HEADER BAR UI */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft size={20} /></button>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FileText className="text-amber-600" /> Generate BAOP</h2>
        </div>
        {data && (
          <button onClick={handlePrint} disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Printer size={18} />} Cetak BAOP (PDF)
          </button>
        )}
      </div>

      <div className="p-6 max-w-[900px] mx-auto w-full space-y-6 print:hidden">
        {/* FORM INPUT */}
        <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-bold mb-1 text-slate-700">Pilih Mandor</label>
              <select value={form.contractId} onChange={(e) => setForm({...form, contractId: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none">
                <option value="">-- Pilih Mandor / SPK --</option>
                {spks.map(s => <option key={s.id} value={s.id}>{s.subcontractor_name} - {s.spk_number}</option>)}
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-bold mb-1 text-slate-700">Nomor BAOP</label>
              <input type="text" value={form.nomorBAOP} onChange={(e) => setForm({...form, nomorBAOP: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-slate-700">Tgl Mulai</label>
              <input type="date" value={form.tglMulai} onChange={(e) => setForm({...form, tglMulai: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1 text-slate-700">Tgl Selesai</label>
              <input type="date" value={form.tglSelesai} onChange={(e) => setForm({...form, tglSelesai: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
          </div>
          <button onClick={handleGenerate} disabled={loading} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-lg font-bold transition-colors">
            {loading ? 'Memuat Data...' : 'Generate BAOP Otomatis'}
          </button>
        </div>
      </div>

      {/* PREVIEW AREA (Simulasi Kertas A4) */}
      {data && (
        <div className="w-full flex justify-center pb-10 print:pb-0">
          <div 
            id="baop-print-area" 
            style={{ 
              width: '210mm', 
              minHeight: '297mm', 
              backgroundColor: '#fff', 
              padding: '20mm', 
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              fontFamily: "'Times New Roman', Times, serif",
              color: '#000',
              fontSize: '11pt',
              lineHeight: '1.5'
            }}
          >
            {/* CSS Khusus untuk Cetak (Murni CSS agar terbaca Puppeteer) */}
            <style dangerouslySetInnerHTML={{__html: `
              .header-kop { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
              .header-kop h1 { margin: 0; font-size: 18pt; font-weight: bold; text-transform: uppercase; }
              .header-kop p { margin: 2px 0 0 0; font-size: 10pt; }
              
              .doc-title { text-align: center; margin-bottom: 25px; }
              .doc-title h2 { margin: 0; font-size: 14pt; font-weight: bold; text-decoration: underline; text-transform: uppercase; }
              .doc-title p { margin: 5px 0 0 0; font-size: 11pt; font-weight: bold; }
              
              .paragraph { text-align: justify; margin-bottom: 15px; text-indent: 30px; }
              
              .pihak-grid { display: flex; gap: 20px; margin-bottom: 20px; }
              .pihak-col { flex: 1; }
              .pihak-table { width: 100%; border-collapse: collapse; font-size: 11pt; }
              .pihak-table td { padding: 2px 0; vertical-align: top; }
              .pihak-table td:first-child { width: 80px; font-weight: bold; }
              
              .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; font-size: 11pt; }
              .data-table th, .data-table td { border: 1px solid #000; padding: 6px 8px; }
              .data-table th { background-color: #f2f2f2; text-align: center; font-weight: bold; }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .font-bold { font-weight: bold; }
              
              .signature-area { display: flex; justify-content: space-between; margin-top: 50px; text-align: center; page-break-inside: avoid; }
              .sig-box { width: 45%; }
              .sig-space { height: 80px; }
              .sig-name { font-weight: bold; text-decoration: underline; margin-bottom: 2px; }
            `}} />

            {/* KOP SURAT */}
            <div className="header-kop">
              {/* Fallback Logo jika ada di project settings */}
              <img src="/logo-perusahaan.png" alt="Logo" style={{ maxHeight: '60px', marginBottom: '10px', display: 'block', margin: '0 auto' }} onError={(e) => e.currentTarget.style.display = 'none'} />
              <h1>{data.contract.projects?.contractor_name || 'PT. BANGUN KONSTRUKSI PERSADA'}</h1>
              <p>GENERAL CONTRACTOR & SUPPLIER</p>
            </div>

            {/* TITLE */}
            <div className="doc-title">
              <h2>BERITA ACARA OPNAME PEKERJAAN (BAOP)</h2>
              <p>NOMOR: {form.nomorBAOP}</p>
            </div>

            {/* PEMBUKA */}
            <p className="paragraph">
              Pada hari ini, <b>{new Date(form.tglSelesai).toLocaleDateString('id-ID', { weekday: 'long' })}</b> tanggal <b>{new Date(form.tglSelesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</b>, 
              bertempat di lokasi proyek <b>{data.contract.projects?.name}</b> yang beralamat di <b>{data.contract.projects?.location}</b>, 
              kami yang bertanda tangan di bawah ini:
            </p>

            {/* PIHAK PERTAMA & KEDUA */}
            <div className="pihak-grid">
              <div className="pihak-col">
                <table className="pihak-table">
                  <tbody>
                    <tr><td>1. Nama</td><td>: {data.contract.projects?.owner_name || 'Pemberi Tugas'}</td></tr>
                    <tr><td>Jabatan</td><td>: Direktur / PPK</td></tr>
                    <tr><td>Perusahaan</td><td>: {data.contract.projects?.owner_name}</td></tr>
                    <tr><td>Alamat</td><td>: -</td></tr>
                  </tbody>
                </table>
                <p style={{ marginTop: '10px', fontWeight: 'bold' }}>Selanjutnya disebut sebagai <b>PIHAK KESATU</b></p>
              </div>
              <div className="pihak-col">
                <table className="pihak-table">
                  <tbody>
                    <tr><td>2. Nama</td><td>: {data.contract.subcontractors?.contact_person || 'Mandor'}</td></tr>
                    <tr><td>Jabatan</td><td>: Direktur</td></tr>
                    <tr><td>Perusahaan</td><td>: {data.contract.subcontractors?.company_name}</td></tr>
                    <tr><td>Alamat</td><td>: {data.contract.subcontractors?.address}</td></tr>
                  </tbody>
                </table>
                <p style={{ marginTop: '10px', fontWeight: 'bold' }}>Selanjutnya disebut sebagai <b>PIHAK KEDUA</b></p>
              </div>
            </div>

            {/* PERNYATAAN */}
            <p className="paragraph">
              Dengan ini menerangkan bahwa <b>PIHAK KESATU</b> dan <b>PIHAK KEDUA</b> telah melakukan pemeriksaan, pengukuran, dan opname fisik bersama secara komprehensif 
              untuk periode {new Date(form.tglMulai).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} s/d {new Date(form.tglSelesai).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}, 
              terhadap pekerjaan <b>{data.contract.work_description}</b> sebagai berikut:
            </p>

            <div style={{ marginBottom: '20px', fontSize: '11pt' }}>
              <table style={{ width: '100%' }}>
                <tbody>
                  <tr><td style={{ width: '120px', fontWeight: 'bold' }}>Nama Pekerjaan</td><td>: {data.contract.work_description}</td></tr>
                  <tr><td style={{ fontWeight: 'bold' }}>Lokasi Proyek</td><td>: {data.contract.projects?.location}</td></tr>
                  <tr><td style={{ fontWeight: 'bold' }}>Acuan Kontrak</td><td>: {data.contract.projects?.contract_number || '-'}</td></tr>
                </tbody>
              </table>
            </div>

            {/* RINCIAN TABLE */}
            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: '5px' }}>I. Rincian Capaian Prestasi Fisik Pekerjaan</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>No</th>
                  <th>Uraian Pekerjaan</th>
                  <th style={{ width: '80px' }}>Satuan</th>
                  <th style={{ width: '100px' }}>Volume</th>
                  <th style={{ width: '150px' }}>Total (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {data.opnames.length === 0 ? (
                  <tr><td colSpan={5} className="text-center" style={{ padding: '20px' }}>Tidak ada data opname pada periode ini.</td></tr>
                ) : (
                  data.opnames.map((op, idx) => (
                    <tr key={op.id}>
                      <td className="text-center">{idx + 1}</td>
                      <td>{op.subcontractor_spk_items?.description}</td>
                      <td className="text-center">{op.subcontractor_spk_items?.unit}</td>
                      <td className="text-right">{op.volume}</td>
                      <td className="text-right">
                        {new Intl.NumberFormat('id-ID').format(op.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="font-bold" style={{ backgroundColor: '#f9f9f9' }}>
                  <td colSpan={4} className="text-right">Total Nilai Prestasi Periode Ini:</td>
                  <td className="text-right">
                    {new Intl.NumberFormat('id-ID').format(totalNilaiOpname)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* RINGKASAN FINANSIAL */}
            <h3 style={{ fontSize: '11pt', fontWeight: 'bold', marginBottom: '5px' }}>II. Ringkasan Nilai Finansial Hasil Opname</h3>
            <div style={{ fontSize: '11pt', marginBottom: '30px' }}>
              <p style={{ margin: '2px 0' }}>Total Nilai Prestasi Periode Ini: <b>Rp {new Intl.NumberFormat('id-ID').format(totalNilaiOpname)}</b></p>
              <p style={{ margin: '2px 0' }}>Akumulasi Total Progres Fisik: <b>{persentaseProgres}%</b> terhadap keseluruhan Nilai Kontrak Kerja.</p>
            </div>

            {/* TANDA TANGAN */}
            <div className="signature-area">
              <div className="sig-box">
                <p className="font-bold">PIHAK KESATU</p>
                <p>{data.contract.projects?.contractor_name || 'Kontraktor'}</p>
                <div className="sig-space"></div>
                <p className="sig-name">SAIFUDDIN FAHMI</p>
                <p>Site Engineer</p>
              </div>
              <div className="sig-box">
                <p className="font-bold">PIHAK KEDUA</p>
                <p>{data.contract.subcontractors?.company_name || 'Mandor'}</p>
                <div className="sig-space"></div>
                <p className="sig-name">{data.contract.subcontractors?.contact_person || 'Nama Mandor'}</p>
                <p>Direktur / Pimpinan</p>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}