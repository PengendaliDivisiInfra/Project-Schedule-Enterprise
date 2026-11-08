'use client';

import { useState, useEffect } from 'react';
import { Printer, FileText, Loader2, CheckSquare, Zap, RefreshCw, CheckCircle2 } from 'lucide-react';
import { getBAPPData } from '@/lib/services/subcon.service';
import { useCOA } from '@/lib/hooks/useCOA';
import { hitungSAK } from '@/lib/utils/sak-calculator';

// --- FUNGSI TERBILANG ---
function terbilang(angka: number): string {
  if (angka === 0) return "Nol";
  const huruf = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  const helper = (n: number): string => {
    if (n < 12) return huruf[n];
    if (n < 20) return helper(n - 10) + " Belas";
    if (n < 100) return helper(Math.floor(n / 10)) + " Puluh " + helper(n % 10);
    if (n < 200) return "Seratus " + helper(n - 100);
    if (n < 1000) return helper(Math.floor(n / 100)) + " Ratus " + helper(n % 100);
    if (n < 2000) return "Seribu " + helper(n - 1000);
    if (n < 1000000) return helper(Math.floor(n / 1000)) + " Ribu " + helper(n % 1000);
    if (n < 1000000000) return helper(Math.floor(n / 1000000)) + " Juta " + helper(n % 1000000);
    if (n < 1000000000000) return helper(Math.floor(n / 1000000000)) + " Milyar " + helper(n % 1000000000);
    return "";
  };
  return helper(Math.abs(angka)).replace(/\s+/g, ' ').trim();
}

interface CoaItem {
  code: string;
  name: string;
  type: 'GROSS' | 'DEDUCTION';
  isChecked: boolean;
  amount: number;
}

export function KwitansiView({ projectId, projectData, spks, showToast }: { projectId: string, projectData: any, spks: any[], showToast: any }) {
  const [loading, setLoading] = useState(false);
  const [coaList, setCoaList] = useState<CoaItem[]>([]);
  
  // INTEGRASI COA HOOK
  const { getAccountCode, loading: loadingCOA } = useCOA();

  // State Form
  const [form, setForm] = useState({
    contractId: '',
    receipt_number: `001/PEM.KB/MDR/CKMT/X/2026`,
    receipt_date: new Date().toISOString().split('T')[0],
    location: projectData?.location || '',
    period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    vendor_name: '',
    spk_number: '',
    work_description: '',
  });

  // Inisialisasi Dynamic COA List ketika data master COA selesai dimuat
  useEffect(() => {
    if (!loadingCOA) {
      const codeUpah = getAccountCode('Beban Upah Mandor') || '5101';
      const codePiutang = getAccountCode('Piutang Opname') || '1151';
      const codeKasbon = getAccountCode('Kasbon Mandor') || '1152';
      const codePph = getAccountCode('PPh Pasal 21') || '2122';
      const codePpn = getAccountCode('PPN Masukan') || '1161';
      const codeRetensi = getAccountCode('Retensi Proyek') || '2131';

      const dynamicCoa: CoaItem[] = [
        { code: `${codeUpah}.001`, name: 'Beban Upah Mandor', type: 'GROSS', isChecked: true, amount: 0 },
        { code: `${codePiutang}.001`, name: 'Piutang Opname', type: 'GROSS', isChecked: false, amount: 0 },
        { code: `${codeKasbon}.001`, name: 'Kasbon Mandor (Potongan)', type: 'DEDUCTION', isChecked: false, amount: 0 },
        { code: `${codeKasbon}.002`, name: 'Kasbon Mandor (Penambahan)', type: 'GROSS', isChecked: false, amount: 0 },
        { code: `${codePph}.001`, name: 'PPh 21/23 Jasa Mandor (Potongan)', type: 'DEDUCTION', isChecked: false, amount: 0 },
        { code: `${codePpn}.001`, name: 'PPN Masukan', type: 'GROSS', isChecked: false, amount: 0 },
        { code: `${codeRetensi}.001`, name: 'Retensi Proyek (Potongan)', type: 'DEDUCTION', isChecked: false, amount: 0 },
      ];
      setCoaList(dynamicCoa);
    }
  }, [loadingCOA, getAccountCode]);

  const handleSelectSPK = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const spkId = e.target.value;
    const spk = spks.find(s => s.id === spkId);
    
    if (spk) {
      setForm(prev => ({
        ...prev,
        contractId: spk.id,
        vendor_name: spk.subcontractor_name,
        spk_number: spk.spk_number,
        work_description: spk.work_description || '-'
      }));
    } else {
      setForm(prev => ({ ...prev, contractId: '', vendor_name: '', spk_number: '', work_description: '' }));
    }
  };

  const handleAutoFill = async () => {
    if (!form.contractId) return showToast('Pilih Mandor / SPK terlebih dahulu', 'error');
    
    setLoading(true);
    try {
      const res = await getBAPPData(form.contractId, form.period_start, form.period_end);
      
      const hitung = hitungSAK({
        bruttoSd: res.totalOpnameSdIni,
        nilaiKontrak: res.contract.contract_value,
        nilaiDP: res.nilaiDP,
        pphRate: res.contract.pph_pct || 2,
        ppnRate: res.contract.ppn_pct || 11,
        retensiRate: res.contract.retention_pct || 5,
        kasbonDeduct: res.totalPotongan,
        taxMode: res.contract.tax_mode || 'EXCLUDE'
      });

      // Gunakan nama item untuk mapping Auto-Fill agar kebal terhadap perubahan kode COA
      setCoaList(prev => prev.map(coa => {
        let amount = 0;
        let isChecked = true;

        switch (coa.name) {
          case 'Beban Upah Mandor': amount = hitung.A_bruto; break; 
          case 'PPN Masukan': amount = hitung.D_ppn; isChecked = hitung.D_ppn > 0; break; 
          case 'PPh 21/23 Jasa Mandor (Potongan)': amount = hitung.F_pph42; isChecked = hitung.F_pph42 > 0; break; 
          case 'Piutang Opname': amount = 0; isChecked = false; break; 
          case 'Kasbon Mandor (Potongan)': amount = hitung.K_kasbon; isChecked = hitung.K_kasbon > 0; break; 
          case 'Retensi Proyek (Potongan)': amount = hitung.R_retensi; isChecked = hitung.R_retensi > 0; break;
          default: return coa; 
        }

        return { ...coa, amount, isChecked };
      }));

      showToast('Nominal berhasil di Auto-Fill berdasarkan SAK', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCoaList(prev => prev.map(c => ({ ...c, amount: 0, isChecked: c.name === 'Beban Upah Mandor' })));
    showToast('Form berhasil di-reset', 'success');
  };

  const totalGross = coaList.filter(c => c.isChecked && c.type === 'GROSS').reduce((sum, c) => sum + c.amount, 0);
  const totalDeduction = coaList.filter(c => c.isChecked && c.type === 'DEDUCTION').reduce((sum, c) => sum + c.amount, 0);
  const totalNet = totalGross - totalDeduction;

  const handlePrint = async () => {
    const printArea = document.getElementById('kwitansi-print-area');
    if (!printArea) return;

    try {
      setLoading(true);
      const htmlContent = printArea.innerHTML;
      
      // CSS PRINT 100% MURNI (TANPA FLEXBOX, MENGGUNAKAN ABSOLUTE POSITIONING)
      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { size: A4 landscape; margin: 10mm 15mm; }
              body { margin: 0; padding: 0; background: #fff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10pt; color: #1e293b; }
              
              /* CONTAINER DI-LOCK TINGGINYA */
              .container { position: relative; border: 2px solid #0f766e; border-radius: 8px; padding: 25px 35px; height: 185mm; box-sizing: border-box; page-break-inside: avoid; }
              
              /* HEADER */
              .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 3px double #0f766e; padding-bottom: 10px; }
              .logo-img { height: 45px; max-width: 150px; object-fit: contain; }
              .company-name { font-size: 16pt; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.2; }
              .company-sub { font-size: 8.5pt; font-weight: 600; color: #64748b; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 1px; }
              .doc-title { font-size: 24pt; font-weight: 800; color: #0f766e; letter-spacing: 2px; margin: 0; text-transform: uppercase; text-align: right; }
              .doc-subtitle { font-size: 9pt; font-weight: 500; color: #475569; margin: 3px 0 0 0; text-align: right; }
              
              /* INFO GRID */
              .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
              .info-grid td { padding: 10px 15px; vertical-align: top; }
              .info-label { font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 7.5pt; letter-spacing: 0.5px; width: 120px; }
              .info-val { font-weight: 600; color: #0f172a; font-size: 9pt; }

              /* TABEL LEDGER */
              .ledger-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; }
              .ledger-table th { background-color: #0f766e; color: white; font-weight: bold; text-align: center; text-transform: uppercase; font-size: 8pt; letter-spacing: 0.5px; padding: 12px 10px; border: 1px solid #0f766e; }
              .ledger-table td { padding: 12px 10px; font-size: 9pt; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; }
              .ledger-table tr:nth-child(even) { background-color: #f8fafc; }
              
              .text-right { text-align: right; } .text-center { text-align: center; }
              .font-mono { font-family: 'Courier New', Courier, monospace; font-weight: 600; }
              
              /* BARIS TOTAL */
              .total-row td { background-color: #f0fdfa !important; font-weight: bold; font-size: 11pt; border-top: 3px double #0f766e; border-bottom: 3px double #0f766e; color: #064e3b; padding: 15px 10px; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; }

              /* TERBILANG BOX */
              .terbilang-box { background-color: #0f766e; color: white; padding: 15px 20px; border-radius: 6px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
              .terbilang-label { font-weight: bold; text-transform: uppercase; font-size: 9pt; letter-spacing: 1px; border-right: 2px solid #2dd4bf; padding-right: 15px; margin-right: 15px; }
              .terbilang-val { font-style: italic; font-weight: bold; font-size: 12pt; color: #ccfbf1; }

              /* TANDA TANGAN DIKUNCI ABSOLUT DI BOTTOM */
              .sig-wrapper { position: absolute; bottom: 20px; left: 35px; right: 35px; }
              .sig-table { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: avoid; }
              .sig-table td { text-align: center; vertical-align: bottom; padding: 0 10px; border: none; }
              .sig-space { height: 65px; }
              .sig-line { border-top: 1px solid #64748b; width: 85%; margin: 0 auto 8px auto; }
              .sig-name { font-weight: bold; font-size: 9pt; color: #0f172a; }
              .sig-title { font-size: 8pt; color: #64748b; margin-bottom: 5px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; }
            </style>
          </head>
          <body>
            <div class="container">
              ${htmlContent}
            </div>
          </body>
        </html>
      `;
      
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: fullHtml, format: 'A4', isLandscape: true })
      });
      if (!res.ok) throw new Error('Gagal generate PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Kwitansi_${form.receipt_number.replace(/\//g, '_')}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fRp = (val: number) => new Intl.NumberFormat('id-ID').format(val);

  if (loadingCOA) return <div className="p-10 text-center font-bold text-slate-500">Memuat Master COA...</div>;

  return (
    <div className="space-y-6">
      {/* WEB UI PENGATURAN */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 text-teal-700 rounded-lg">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Form Kwitansi Pembayaran</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Sesuaikan data mandor dan rincian akun yang akan dibayarkan.</p>
            </div>
          </div>
          <button onClick={handleReset} className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
            <RefreshCw size={14} /> Reset Form
          </button>
        </div>

        <div className="p-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pilih Mandor / SPK</label>
                <select value={form.contractId} onChange={handleSelectSPK} className="w-full border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none shadow-sm font-medium">
                  <option value="">-- Pilih Mandor --</option>
                  {spks.map(s => <option key={s.id} value={s.id}>{s.subcontractor_name} - {s.spk_number}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">No. Kwitansi</label>
                <input type="text" value={form.receipt_number} onChange={(e) => setForm({ ...form, receipt_number: e.target.value })} className="w-full border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none shadow-sm" />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tanggal Kwitansi</label>
                <input type="date" value={form.receipt_date} onChange={(e) => setForm({ ...form, receipt_date: e.target.value })} className="w-full border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none shadow-sm" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mulai</label>
                  <input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} className="w-full border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none shadow-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Selesai</label>
                  <input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} className="w-full border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-teal-500 outline-none shadow-sm" />
                </div>
              </div>
            </div>

            <div className="flex items-end pb-0.5">
              <button onClick={handleAutoFill} disabled={loading || !form.contractId} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all hover:shadow-lg disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} className="text-amber-400" />} 
                Auto-Fill (SAK)
              </button>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-end mb-3">
              <div>
                <h4 className="font-bold text-slate-800 text-base">Rincian Akun (COA Dinamis)</h4>
                <p className="text-xs text-slate-500">Centang akun, isi nominal, lalu cetak.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCoaList(prev => prev.map(c => ({...c, isChecked: true})))} className="text-xs font-bold text-slate-600 hover:bg-slate-200 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 transition-colors">Pilih Semua</button>
                <button onClick={() => setCoaList(prev => prev.map(c => ({...c, isChecked: false})))} className="text-xs font-bold text-slate-600 hover:bg-slate-200 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 transition-colors">Kosongkan</button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              {coaList.map((coa, idx) => (
                <div key={idx} className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 border-b border-slate-100 last:border-0 transition-colors ${coa.isChecked ? 'bg-teal-50/30' : 'hover:bg-slate-50'}`}>
                  <button 
                    onClick={() => {
                      const newList = [...coaList];
                      newList[idx].isChecked = !newList[idx].isChecked;
                      setCoaList(newList);
                    }} 
                    className={`flex items-center gap-3 flex-1 text-left outline-none`}
                  >
                    <div className={`p-1.5 rounded-lg border ${coa.isChecked ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-300 text-transparent'}`}>
                      <CheckSquare size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">{coa.code}</span>
                        <span className={`font-bold text-sm ${coa.isChecked ? 'text-slate-800' : 'text-slate-500'}`}>{coa.name}</span>
                      </div>
                    </div>
                  </button>

                  <div className="w-full sm:w-64">
                    <div className="relative">
                      <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold ${coa.isChecked ? 'text-slate-400' : 'text-slate-300'}`}>Rp</span>
                      <input 
                        type="number" 
                        disabled={!coa.isChecked}
                        value={coa.amount || ''} 
                        onChange={(e) => {
                          const newList = [...coaList];
                          newList[idx].amount = Number(e.target.value);
                          setCoaList(newList);
                        }}
                        className={`w-full border rounded-lg pl-10 pr-3 py-2 text-right font-mono font-bold text-sm transition-all outline-none focus:ring-2 focus:ring-teal-500 ${coa.isChecked ? 'border-slate-300 bg-white text-slate-800 shadow-sm' : 'border-slate-100 bg-slate-50 text-slate-400'}`} 
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button onClick={handlePrint} disabled={loading} className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Printer size={20} />} Cetak PDF Kwitansi
            </button>
          </div>
        </div>
      </div>

      {/* AREA PREVIEW (STRUKTUR TABLE MURNI UNTUK PDF) */}
      {form.contractId && (
        <div className="w-full flex flex-col items-center pb-10 bg-slate-300/50 p-6 rounded-2xl print:bg-white print:p-0 overflow-x-auto">
          <div className="flex items-center gap-2 mb-4 text-slate-500 print:hidden">
            <CheckCircle2 size={18} className="text-teal-600" />
            <p className="text-xs font-bold tracking-widest uppercase">Live Preview Dokumen Kwitansi</p>
          </div>

          <div className="w-[297mm] bg-white p-10 shadow-2xl border border-slate-300">
            <div id="kwitansi-print-area" style={{ position: 'relative', minHeight: '165mm' }}>
              
              {/* KOP SURAT (DOUBLE BORDER) */}
              <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '3px double #0f766e', paddingBottom: '10px', marginBottom: '20px' }}>
                <tbody>
                  <tr>
                    <td style={{ verticalAlign: 'bottom' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {projectData?.logo_url ? (
                          <img src={projectData.logo_url} alt="Logo" style={{ height: '45px', maxWidth: '150px', objectFit: 'contain' }} />
                        ) : (
                          <div style={{ height: '45px', width: '45px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#94a3b8', fontSize: '10px' }}>LOGO</div>
                        )}
                        <div>
                          <h2 style={{ fontSize: '18pt', fontWeight: '800', textTransform: 'uppercase', margin: 0, color: '#0f172a', letterSpacing: '0.5px', lineHeight: '1.2' }}>{projectData?.company_name || 'PT. NAMA PERUSAHAAN'}</h2>
                          <p style={{ fontSize: '9pt', fontWeight: '600', color: '#64748b', margin: '2px 0 0 0', textTransform: 'uppercase', letterSpacing: '1px' }}>general contractor & supplier</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', verticalAlign: 'bottom' }}>
                      <h1 style={{ fontSize: '26pt', fontWeight: '800', color: '#0f766e', letterSpacing: '2px', margin: 0, textTransform: 'uppercase' }}>KWITANSI</h1>
                      <p style={{ fontSize: '9.5pt', fontWeight: '500', color: '#475569', margin: '3px 0 0 0' }}>No. Voucher: <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{form.receipt_number}</span></p>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* INFO GRID */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '50%', padding: '12px 20px', verticalAlign: 'top', borderRight: '1px solid #e2e8f0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ fontSize: '8pt', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', paddingBottom: '5px', width: '130px' }}>Sudah Terima Dari</td>
                            <td style={{ fontSize: '9.5pt', fontWeight: '600', color: '#0f172a', paddingBottom: '5px' }}>: {projectData?.company_name || '-'}</td>
                          </tr>
                          <tr>
                            <td style={{ fontSize: '8pt', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', paddingBottom: '5px' }}>Diserahkan Kepada</td>
                            <td style={{ fontSize: '9.5pt', fontWeight: 'bold', color: '#0f766e', paddingBottom: '5px' }}>: {form.vendor_name}</td>
                          </tr>
                          <tr>
                            <td style={{ fontSize: '8pt', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Jenis Pekerjaan</td>
                            <td style={{ fontSize: '9.5pt', fontWeight: '500', color: '#0f172a' }}>: {form.work_description}</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                    <td style={{ width: '50%', padding: '12px 20px', verticalAlign: 'top' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr>
                            <td style={{ fontSize: '8pt', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', paddingBottom: '5px', width: '90px' }}>Tanggal</td>
                            <td style={{ fontSize: '9.5pt', fontWeight: '500', color: '#0f172a', paddingBottom: '5px' }}>: {new Date(form.receipt_date).toLocaleDateString('id-ID', {day: '2-digit', month: 'long', year: 'numeric'})}</td>
                          </tr>
                          <tr>
                            <td style={{ fontSize: '8pt', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Lokasi Proyek</td>
                            <td style={{ fontSize: '9.5pt', fontWeight: '500', color: '#0f172a' }}>: {form.location}</td>
                          </tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* TABEL LEDGER */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f766e', color: 'white' }}>
                    <th style={{ padding: '12px 15px', fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', border: '1px solid #0f766e', width: '100px' }}>Kode Akun</th>
                    <th style={{ padding: '12px 15px', fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left', border: '1px solid #0f766e' }}>Deskripsi Rincian Pekerjaan / Potongan</th>
                    <th style={{ padding: '12px 15px', fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right', border: '1px solid #0f766e', width: '140px' }}>Nilai Kotor (Gross)</th>
                    <th style={{ padding: '12px 15px', fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right', border: '1px solid #0f766e', width: '140px' }}>Potongan (Deduction)</th>
                    <th style={{ padding: '12px 15px', fontSize: '8.5pt', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right', border: '1px solid #0f766e', width: '140px' }}>Jumlah Bersih (Net)</th>
                  </tr>
                </thead>
                <tbody>
                  {coaList.filter(c => c.isChecked && c.amount > 0).map((c, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '12px 15px', textAlign: 'center', fontFamily: 'Courier New', fontWeight: 'bold', fontSize: '9pt', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{c.code}</td>
                      <td style={{ padding: '12px 15px', fontWeight: '500', fontSize: '9.5pt', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{c.name}</td>
                      <td style={{ padding: '12px 15px', textAlign: 'right', fontFamily: 'Courier New', fontWeight: '600', fontSize: '9.5pt', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{c.type === 'GROSS' ? fRp(c.amount) : '-'}</td>
                      <td style={{ padding: '12px 15px', textAlign: 'right', fontFamily: 'Courier New', fontWeight: '600', fontSize: '9.5pt', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{c.type === 'DEDUCTION' ? fRp(c.amount) : '-'}</td>
                      <td style={{ padding: '12px 15px', textAlign: 'right', fontFamily: 'Courier New', fontWeight: 'bold', fontSize: '9.5pt', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                        {c.type === 'GROSS' ? fRp(c.amount) : `(${fRp(c.amount)})`}
                      </td>
                    </tr>
                  ))}
                  {coaList.filter(c => c.isChecked && c.amount > 0).length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '25px', textAlign: 'center', fontStyle: 'italic', color: '#94a3b8', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>Belum ada akun dengan nominal yang dipilih.</td></tr>
                  )}
                  
                  {/* TOTAL ROW */}
                  <tr style={{ backgroundColor: '#f0fdfa', fontWeight: 'bold', fontSize: '11pt', color: '#064e3b' }}>
                    <td colSpan={2} style={{ padding: '15px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px', borderTop: '3px double #0f766e', borderBottom: '3px double #0f766e', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>Total Pembayaran Bersih (Net Take Home Pay)</td>
                    <td style={{ padding: '15px', textAlign: 'right', fontFamily: 'Courier New', borderTop: '3px double #0f766e', borderBottom: '3px double #0f766e', borderRight: '1px solid #e2e8f0' }}>{fRp(totalGross)}</td>
                    <td style={{ padding: '15px', textAlign: 'right', fontFamily: 'Courier New', borderTop: '3px double #0f766e', borderBottom: '3px double #0f766e', borderRight: '1px solid #e2e8f0' }}>{fRp(totalDeduction)}</td>
                    <td style={{ padding: '15px', textAlign: 'right', fontFamily: 'Courier New', fontSize: '14pt', color: '#be123c', borderTop: '3px double #0f766e', borderBottom: '3px double #0f766e', borderRight: '1px solid #e2e8f0' }}>{fRp(totalNet)}</td>
                  </tr>
                </tbody>
              </table>

              {/* TERBILANG BOX */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <tbody>
                  <tr>
                    <td style={{ backgroundColor: '#0f766e', padding: '15px 20px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: 'white', fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '1px', borderRight: '2px solid #2dd4bf', paddingRight: '15px', marginRight: '15px' }}>Terbilang</span>
                      <span style={{ fontStyle: 'italic', fontWeight: 'bold', color: '#ccfbf1', fontSize: '12pt' }}>{totalNet === 0 ? 'Nol' : terbilang(totalNet)} Rupiah</span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* TANDA TANGAN DENGAN ABSOLUTE POSITIONING (PDF RULE COMPLIANT) */}
              <div className="sig-wrapper">
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <tbody>
                    <tr>
                      <td style={{ textAlign: 'center', verticalAlign: 'bottom', padding: '0 10px' }}>
                        <div style={{ fontSize: '8.5pt', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>KA. Divisi Infra</div>
                        <div style={{ height: '60px' }}></div>
                        <div style={{ borderTop: '1px solid #64748b', width: '85%', margin: '0 auto 8px auto' }}></div>
                        <div style={{ fontWeight: 'bold', fontSize: '9.5pt', color: '#0f172a' }}>MEI SUNARKO</div>
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'bottom', padding: '0 10px' }}>
                        <div style={{ fontSize: '8.5pt', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>Ass. Divisi Infra</div>
                        <div style={{ height: '60px' }}></div>
                        <div style={{ borderTop: '1px solid #64748b', width: '85%', margin: '0 auto 8px auto' }}></div>
                        <div style={{ fontWeight: 'bold', fontSize: '9.5pt', color: '#0f172a' }}>ARIF DARMAWAN</div>
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'bottom', padding: '0 10px' }}>
                        <div style={{ fontSize: '8.5pt', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>Ka. Pembelian</div>
                        <div style={{ height: '60px' }}></div>
                        <div style={{ borderTop: '1px solid #64748b', width: '85%', margin: '0 auto 8px auto' }}></div>
                        <div style={{ fontWeight: 'bold', fontSize: '9.5pt', color: '#0f172a' }}>M. MAULIDIN</div>
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'bottom', padding: '0 10px' }}>
                        <div style={{ fontSize: '8.5pt', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>Site Engineer</div>
                        <div style={{ height: '60px' }}></div>
                        <div style={{ borderTop: '1px solid #64748b', width: '85%', margin: '0 auto 8px auto' }}></div>
                        <div style={{ fontWeight: 'bold', fontSize: '9.5pt', color: '#0f172a' }}>SAIFUDDIN FAHMI</div>
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'bottom', padding: '0 10px' }}>
                        <div style={{ fontSize: '8.5pt', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>Direktur / Mandor</div>
                        <div style={{ height: '60px' }}></div>
                        <div style={{ borderTop: '1px solid #64748b', width: '85%', margin: '0 auto 8px auto' }}></div>
                        <div style={{ fontWeight: 'bold', fontSize: '9.5pt', color: '#0f766e' }}>{form.vendor_name || '-'}</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}