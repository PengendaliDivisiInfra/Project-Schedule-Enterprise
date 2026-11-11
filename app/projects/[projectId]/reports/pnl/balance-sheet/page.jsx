'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Loader2, Settings, ShieldCheck, ShieldAlert, History, Eye, Trash2, AlertTriangle } from 'lucide-react';
import { 
  generateProjectBalanceSheet, 
  saveBalanceSheetSnapshot, 
  getBalanceSheetHistory, 
  softDeleteBalanceSheetSnapshot 
} from '@/lib/services/balance-sheet.service';

export default function BalanceSheetPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [isSigSettingsOpen, setIsSigSettingsOpen] = useState(false);

  // State untuk History & Custom Modal Delete
  const [historyData, setHistoryData] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [signatures, setSignatures] = useState(() => {
    if (typeof window !== 'undefined' && projectId) {
      const saved = localStorage.getItem(`bs_sig_${projectId}`);
      if (saved) {
        try { 
          const parsed = JSON.parse(saved);
          if (parsed.financeName === parsed.financeTitle) {
            parsed.financeName = '........................';
            parsed.pmName = '........................';
            parsed.kadivName = '........................';
          }
          return parsed; 
        } catch (e) { console.error(e); }
      }
    }
    return { 
      financeName: '........................', financeTitle: 'Finance / Admin', 
      pmName: '........................', pmTitle: 'Project Manager',
      kadivName: '........................', kadivTitle: 'KaDiv Infra'
    };
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      localStorage.setItem(`bs_sig_${projectId}`, JSON.stringify(signatures));
    }
  }, [signatures, projectId]);

  const fetchData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await generateProjectBalanceSheet(projectId, startDate, asOfDate);
      setData(res);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!projectId) return;
    try {
      const res = await getBalanceSheetHistory(projectId);
      setHistoryData(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchHistory();
  }, [projectId, startDate, asOfDate]);

  const handleDeleteHistory = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await softDeleteBalanceSheetSnapshot(deleteTarget.id);
      showToast('Snapshot berhasil dihapus.', 'success');
      setDeleteTarget(null);
      fetchHistory(); // Refresh tabel history
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLoadHistory = (hist) => {
    // Muat data dari JSON ke state utama untuk dilihat/dicetak ulang
    setData(hist.data_json);
    setStartDate(hist.period_start);
    setAsOfDate(hist.period_end);
    showToast('Data Snapshot berhasil dimuat ke layar.', 'success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
  const formatNum = (num) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(num || 0);
  const today = new Date(asOfDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const periodStartStr = new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const handlePrintAndSave = async () => {
    if (!data) return;
    if (!data.isBalanced) return showToast('Tidak dapat mencetak: Neraca tidak seimbang.', 'error');
    
    setIsSaving(true);
    try {
      // 1. Simpan Snapshot ke Database
      await saveBalanceSheetSnapshot(projectId, startDate, asOfDate, data, signatures.financeName);
      showToast('Snapshot berhasil disimpan.', 'success');
      
      // 2. Refresh History
      fetchHistory();

      // 3. Lanjut Generate PDF
      const project = data.project;
      const companyName = project?.contractor_name || project?.company_name || 'PT. BANGUN KONSTRUKSI PERSADA';
      const companyAddress = project?.contractor_address || project?.address || 'Alamat Perusahaan Belum Diatur';
      
      const docNumber = `DOC/FIN-BS/${new Date().getFullYear()}/${(new Date().getMonth()+1).toString().padStart(2, '0')}/${Date.now().toString().slice(-4)}`;
      const printTime = new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

      const renderRow = (label, item, isBold = false, indent = 0) => {
        const padding = indent === 1 ? 'padding-left: 30px;' : 'padding-left: 20px;';
        return `
          <tr>
            <td style="${padding} ${isBold ? 'font-weight: 700;' : ''}">${label}</td>
            <td class="text-right">${formatNum(item.awal)}</td>
            <td class="text-right">${formatNum(item.mutasi)}</td>
            <td class="text-right ${isBold ? 'font-weight: 700;' : ''}">${formatNum(item.akhir)}</td>
          </tr>
        `;
      };

      const logoUrl = project?.logo_url || '';

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { size: A4 portrait; margin: 12mm 20mm; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 8.5pt; color: #0f172a; margin: 0; padding: 0; }
              .print-container { position: relative; min-height: 265mm; display: flex; flex-direction: column; font-variant-numeric: tabular-nums; }
              
              .header-table { width: 100%; border-collapse: collapse; margin-bottom: 2px; table-layout: fixed; }
              .header-table > tbody > tr > td { vertical-align: bottom; padding: 0; }
              
              .logo-img { max-height: 85px; max-width: 200px; object-fit: contain; }
              
              .company-name { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 13pt; font-weight: 900; margin: 0; text-transform: uppercase; color: #0f172a; }
              .company-address { font-size: 7.5pt; margin: 2px 0 0 0; color: #475569; }
              
              .doc-title-wrapper { text-align: right; }
              .doc-title { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 14pt; font-weight: 900; margin: 0; text-transform: uppercase; color: #0f172a; }
              .header-line-1 { border-top: 3px solid #0f172a; margin-top: 5px; }
              .header-line-2 { border-top: 1px solid #0f172a; margin-top: 2px; margin-bottom: 10px; }
              
              .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 10px; border: 1px solid #cbd5e1; }
              .info-grid td { padding: 5px 8px; vertical-align: top; width: 50%; }
              .info-label { font-size: 7.5pt; font-weight: 700; color: #64748b; text-transform: uppercase; }
              .info-value { font-size: 9pt; font-weight: 700; color: #0f172a; margin: 0; }
              
              .report-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 8pt; }
              .report-table th { background-color: #f8fafc; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; padding: 5px 8px; text-transform: uppercase; text-align: left; font-weight: 800; color: #0f172a; }
              .report-table th.text-right { text-align: right; }
              .report-table td { padding: 4px 8px; border-bottom: 1px solid #e2e8f0; }
              .text-right { text-align: right; font-family: 'Courier New', Courier, monospace; font-size: 8.5pt; }
              
              .bg-section { background-color: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; font-weight: 700; font-size: 8pt; }
              .total-section td { font-weight: 800; background-color: #f8fafc; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; color: #0f172a; }
              .grand-total-row td { background-color: #0f172a; color: #ffffff; font-weight: 800; font-size: 9pt; padding: 6px 8px; border: none; }
              
              .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 7.5pt; border: 1px solid #cbd5e1; }
              .summary-table td { padding: 4px 8px; border-bottom: 1px solid #e2e8f0; }
              .summary-table .label { font-weight: 700; color: #475569; width: 60%; }
              .summary-table .value { text-align: right; font-family: 'Courier New', Courier, monospace; font-weight: 700; }
              
              .bottom-wrapper { margin-top: auto; width: 100%; page-break-inside: avoid; padding-top: 10px; }
              .footer-meta { border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 7pt; color: #64748b; }
            </style>
          </head>
          <body>
            <div class="print-container">
              <table class="header-table">
                <tr>
                  <td style="width: 65%;">
                    <table style="border-collapse: collapse; width: 100%;">
                      <tr>
                        ${logoUrl ? `
                        <td style="width: 100px; vertical-align: bottom; padding-right: 15px; padding-bottom: 5px;">
                          <img src="${logoUrl}" class="logo-img" />
                        </td>
                        ` : ''}
                        <td style="vertical-align: bottom;">
                          <h2 class="company-name">${companyName}</h2>
                          <p class="company-address">${companyAddress}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="width: 35%;" class="doc-title-wrapper">
                    <h1 class="doc-title">NERACA PROYEK</h1>
                    <p style="font-size: 8.5pt; font-weight: 700; margin: 2px 0 0 0; color: #475569;">PROYEK KONSTRUKSI (INTERNAL)</p>
                  </td>
                </tr>
              </table>
              <div class="header-line-1"></div>
              <div class="header-line-2"></div>

              <table class="info-grid">
                <tr>
                  <td style="border-right: 1px solid #cbd5e1;">
                    <div class="info-label">Informasi Proyek</div>
                    <p class="info-value">${project?.name || 'NAMA PROYEK'}</p>
                    <div style="font-size: 7.5pt; color: #475569; margin-top: 1px;">Kontrak: <strong>${project?.contract_number || '-'}</strong></div>
                  </td>
                  <td>
                    <div class="info-label">Periode Laporan</div>
                    <p class="info-value">${periodStartStr} s/d ${today}</p>
                    <div style="font-size: 7.5pt; color: #475569; margin-top: 1px;">Mata Uang: IDR (Rupiah)</div>
                  </td>
                </tr>
              </table>

              <table class="report-table">
                <thead>
                  <tr>
                    <th style="width: 40%;">Keterangan Akun</th>
                    <th style="width: 20%; text-align: right;">Saldo Awal (Rp)</th>
                    <th style="width: 20%; text-align: right;">Mutasi (Rp)</th>
                    <th style="width: 20%; text-align: right;">Saldo Akhir (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="bg-section"><td colspan="4" style="padding: 4px 8px;">A. ASET PROYEK</td></tr>
                  ${renderRow('Kas & Bank Proyek', data.assets.kasBank, false, 1)}
                  ${renderRow('Piutang Usaha / Termin (Billed)', data.assets.piutangUsaha, false, 1)}
                  ${renderRow('Piutang Retensi (Jaminan)', data.assets.piutangRetensi, false, 1)}
                  ${renderRow('Aset Kontrak (Unbilled PSAK 115)', data.assets.asetKontrak, false, 1)}
                  ${renderRow('Persediaan Material Gudang', data.assets.persediaan, false, 1)}
                  ${renderRow('Uang Muka / Kasbon Proyek', data.assets.uangMuka, false, 1)}
                  ${renderRow('PPh Final Dibayar Dimuka', data.assets.pphDibayarDimuka, false, 1)}
                  <tr class="total-section">
                    <td style="padding-left: 20px;">TOTAL ASET</td><td class="text-right">${formatNum(data.assets.total.awal)}</td><td class="text-right">${formatNum(data.assets.total.mutasi)}</td><td class="text-right">${formatNum(data.assets.total.akhir)}</td>
                  </tr>

                  <tr class="bg-section"><td colspan="4" style="padding: 4px 8px;">B. LIABILITAS PROYEK</td></tr>
                  ${renderRow('Utang Usaha & Material', data.liabilitiesEquity.utangUsaha, false, 1)}
                  ${renderRow('Utang Subkontraktor', data.liabilitiesEquity.utangSubkon, false, 1)}
                  ${renderRow('Biaya Masih Harus Dibayar (Accrued)', data.liabilitiesEquity.biayaAkrual, false, 1)}
                  ${renderRow('Liabilitas Kontrak (Unearned PSAK 115)', data.liabilitiesEquity.liabilitasKontrak, false, 1)}
                  ${renderRow('Utang Retensi Subkontraktor', data.liabilitiesEquity.utangRetensiSubkon, false, 1)}
                  
                  <tr class="bg-section"><td colspan="4" style="padding: 4px 8px;">C. EKUITAS (INTER-OFFICE)</td></tr>
                  ${renderRow('Rekening Koran Kantor Pusat (Droping)', data.liabilitiesEquity.rkPusat, false, 1)}
                  ${renderRow('Laba / (Rugi) Berjalan Proyek', data.liabilitiesEquity.labaBerjalan, false, 1)}

                  <tr class="grand-total-row">
                    <td>TOTAL LIABILITAS & EKUITAS</td>
                    <td class="text-right">${formatNum(data.liabilitiesEquity.total.awal)}</td>
                    <td class="text-right">${formatNum(data.liabilitiesEquity.total.mutasi)}</td>
                    <td class="text-right">${formatNum(data.liabilitiesEquity.total.akhir)}</td>
                  </tr>
                </tbody>
              </table>

              <div style="margin-top: 10px;">
                <p style="font-weight: 700; font-size: 8pt; margin-bottom: 5px; color: #0f172a;">RINGKASAN STATUS KONTRAK & KONTROL PROYEK</p>
                <table class="summary-table">
                  <tr><td class="label">Nilai Kontrak Induk (Excl. PPN)</td><td class="value">Rp ${formatNum(data.summary.contractValue)}</td></tr>
                  <tr><td class="label">Total Pagu Anggaran (RAP)</td><td class="value">Rp ${formatNum(data.summary.totalRAP)}</td></tr>
                  <tr><td class="label">Progres Keuangan (PoC PSAK 115)</td><td class="value">${data.summary.pocPercent.toFixed(2)}%</td></tr>
                  <tr><td class="label">Total Tagihan Termin / SP2D Terbit</td><td class="value">Rp ${formatNum(data.summary.totalInvoiced)} (${((data.summary.totalInvoiced / data.summary.contractValue) * 100).toFixed(2)}%)</td></tr>
                  <tr><td class="label">Sisa Nilai Kontrak Belum Ditagih</td><td class="value">Rp ${formatNum(data.summary.remainingContract)}</td></tr>
                </table>
              </div>

              <div class="bottom-wrapper">
                <div style="font-size: 7pt; color: #64748b; font-style: italic; page-break-inside: avoid; padding-bottom: 10px;">
                  * Catatan: Neraca Proyek ini di-generate secara otomatis (Strict Accrual). Pos PPh Final dan Retensi disesuaikan dengan sisa outstanding pada invoice. Total Aset dan Liabilitas+Ekuitas telah tervalidasi SEIMBANG (Balance).
                </div>

                <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 20px; page-break-inside: avoid;">
                  <tr>
                    <td style="width: 33.33%; text-align: center; vertical-align: top; padding: 0 10px;">
                      <p style="font-size: 9pt; color: #475569; margin: 0;">Disiapkan Oleh,</p>
                      <div style="height: 60px;"></div>
                      <p style="font-weight: 700; font-size: 9pt; margin: 0; border-bottom: 1px solid #000; display: inline-block; min-width: 160px; padding-bottom: 2px; min-height: 18px;">${signatures.financeName || '........................'}</p>
                      <p style="font-size: 8.5pt; color: #475569; margin: 4px 0 0 0;">${signatures.financeTitle || 'Finance / Admin'}</p>
                    </td>
                    <td style="width: 33.33%; text-align: center; vertical-align: top; padding: 0 10px;">
                      <p style="font-size: 9pt; color: #475569; margin: 0;">Diperiksa Oleh,</p>
                      <div style="height: 60px;"></div>
                      <p style="font-weight: 700; font-size: 9pt; margin: 0; border-bottom: 1px solid #000; display: inline-block; min-width: 160px; padding-bottom: 2px; min-height: 18px;">${signatures.pmName || '........................'}</p>
                      <p style="font-size: 8.5pt; color: #475569; margin: 4px 0 0 0;">${signatures.pmTitle || 'Project Manager'}</p>
                    </td>
                    <td style="width: 33.33%; text-align: center; vertical-align: top; padding: 0 10px;">
                      <p style="font-size: 9pt; color: #475569; margin: 0;">Disetujui Oleh,</p>
                      <div style="height: 60px;"></div>
                      <p style="font-weight: 700; font-size: 9pt; margin: 0; border-bottom: 1px solid #000; display: inline-block; min-width: 160px; padding-bottom: 2px; min-height: 18px;">${signatures.kadivName || '........................'}</p>
                      <p style="font-size: 8.5pt; color: #475569; margin: 4px 0 0 0;">${signatures.kadivTitle || 'KaDiv Infra'}</p>
                    </td>
                  </tr>
                </table>

                <div class="footer-meta">
                  <table style="width: 100%;">
                    <tr>
                      <td style="text-align: left;">Dokumen: <strong>${docNumber}</strong></td>
                      <td style="text-align: center;">Dicetak otomatis oleh sistem pada: <strong>${printTime}</strong></td>
                      <td style="text-align: right;">Halaman 1 dari 1</td>
                    </tr>
                  </table>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      const res = await fetch('/api/generate-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, format: 'A4', isLandscape: false })
      });

      if (!res.ok) throw new Error('Gagal generate PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Neraca_${project?.name || 'Proyek'}_${asOfDate}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && !data) return <div className="p-10 text-center font-bold text-slate-500">Memuat Neraca Proyek...</div>;
  if (!data) return <div className="p-10 text-center text-red-500">Gagal memuat data.</div>;

  return (
    <div className="w-full min-h-screen bg-slate-100 p-4 md:p-8 flex flex-col items-center">
      
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-lg shadow-xl text-white font-bold flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="w-full max-w-6xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors shadow-sm"><ArrowLeft size={18} className="text-slate-600" /></button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Neraca Proyek (Project Balance Sheet)</h1>
            <p className="text-slate-500 text-sm">Jembatan penyeimbang Akrual P&L (PSAK 115) & Arus Kas (PSAK 207)</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsSigSettingsOpen(!isSigSettingsOpen)} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm transition-all"><Settings size={16} /> Atur TTD</button>
          <button onClick={handlePrintAndSave} disabled={isSaving || !data.isBalanced} className={`px-6 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg transition-all ${!data.isBalanced ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} {isSaving ? 'Memproses PDF...' : 'Cetak & Simpan'}
          </button>
        </div>
      </div>

      {isSigSettingsOpen && (
        <div className="w-full max-w-6xl bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3 bg-slate-50 p-4 rounded-lg border">
              <p className="text-xs font-bold text-indigo-700 uppercase mb-2">Disiapkan Oleh (Kiri)</p>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Nama</label><input type="text" value={signatures.financeName} onChange={e => setSignatures({...signatures, financeName: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm" placeholder="Masukkan Nama Asli" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Jabatan</label><input type="text" value={signatures.financeTitle} onChange={e => setSignatures({...signatures, financeTitle: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm" /></div>
            </div>
            <div className="space-y-3 bg-slate-50 p-4 rounded-lg border">
              <p className="text-xs font-bold text-indigo-700 uppercase mb-2">Diperiksa Oleh (Tengah)</p>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Nama</label><input type="text" value={signatures.pmName} onChange={e => setSignatures({...signatures, pmName: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm" placeholder="Masukkan Nama Asli" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Jabatan</label><input type="text" value={signatures.pmTitle} onChange={e => setSignatures({...signatures, pmTitle: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm" /></div>
            </div>
            <div className="space-y-3 bg-slate-50 p-4 rounded-lg border">
              <p className="text-xs font-bold text-indigo-700 uppercase mb-2">Disetujui Oleh (Kanan)</p>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Nama</label><input type="text" value={signatures.kadivName} onChange={e => setSignatures({...signatures, kadivName: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm" placeholder="Masukkan Nama Asli" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Jabatan</label><input type="text" value={signatures.kadivTitle} onChange={e => setSignatures({...signatures, kadivTitle: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm" /></div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-6xl bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-wrap items-center gap-4">
        <span className="text-sm font-bold text-slate-600">Periode Neraca:</span>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded p-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" />
        <span className="text-slate-400">s/d</span>
        <input type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} className="border rounded p-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      {!data.isBalanced && (
        <div className="w-full max-w-6xl mb-6 bg-red-50 border border-red-200 text-red-800 p-5 rounded-xl flex items-start gap-4 shadow-sm">
          <ShieldAlert size={28} className="shrink-0 mt-0.5 text-red-600" />
          <div>
            <h4 className="font-bold text-lg">Peringatan Audit: Neraca Tidak Seimbang</h4>
            <p className="text-sm mt-1">Selisih: <strong>{formatRp(data.variance)}</strong>. Cetak PDF diblokir hingga selisih ditemukan.</p>
          </div>
        </div>
      )}
      {data.isBalanced && (
        <div className="w-full max-w-6xl mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 shadow-sm">
          <ShieldCheck size={24} className="text-emerald-600" />
          <p className="text-sm font-bold">Neraca SEIMBANG (Balance). Semua transaksi Akrual & Kas telah terekonsiliasi sempurna.</p>
        </div>
      )}

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm border-l-4 border-l-blue-500">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Aset Proyek (Akhir)</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatRp(data.assets.total.akhir)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm border-l-4 border-l-purple-500">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Liabilitas & Ekuitas</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatRp(data.liabilitiesEquity.total.akhir)}</p>
        </div>
        <div className={`bg-white rounded-xl border border-slate-200 p-5 shadow-sm border-l-4 flex flex-col justify-center ${data.isBalanced ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Status Keseimbangan</p>
          <p className={`text-xl font-bold mt-1 ${data.isBalanced ? 'text-emerald-700' : 'text-red-700'}`}>
            {data.isBalanced ? 'BALANCE (Rp 0)' : `SELISIH ${formatRp(data.variance)}`}
          </p>
        </div>
      </div>

      <div className="w-full max-w-6xl bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden mb-10">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
            <tr>
              <th className="p-4 w-1/2 border-r border-slate-200">Keterangan Akun</th>
              <th className="p-4 text-right">Saldo Awal</th>
              <th className="p-4 text-right">Mutasi</th>
              <th className="p-4 text-right">Saldo Akhir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr><td colSpan={4} className="bg-slate-200 font-bold py-2 px-4 text-xs uppercase text-slate-700">A. Aset Proyek</td></tr>
            <tr><td className="p-4 text-slate-600">Kas & Bank Proyek</td><td className="p-4 text-right font-mono">{formatRp(data.assets.kasBank.awal)}</td><td className="p-4 text-right font-mono">{formatRp(data.assets.kasBank.mutasi)}</td><td className="p-4 text-right font-mono font-bold">{formatRp(data.assets.kasBank.akhir)}</td></tr>
            <tr><td className="p-4 text-slate-600">Piutang Usaha / Termin</td><td className="p-4 text-right font-mono">{formatRp(data.assets.piutangUsaha.awal)}</td><td className="p-4 text-right font-mono">{formatRp(data.assets.piutangUsaha.mutasi)}</td><td className="p-4 text-right font-mono font-bold">{formatRp(data.assets.piutangUsaha.akhir)}</td></tr>
            <tr><td className="p-4 text-slate-600">Piutang Retensi</td><td className="p-4 text-right font-mono">{formatRp(data.assets.piutangRetensi.awal)}</td><td className="p-4 text-right font-mono">{formatRp(data.assets.piutangRetensi.mutasi)}</td><td className="p-4 text-right font-mono font-bold">{formatRp(data.assets.piutangRetensi.akhir)}</td></tr>
            <tr><td className="p-4 text-slate-600">Aset Kontrak (Unbilled)</td><td className="p-4 text-right font-mono">{formatRp(data.assets.asetKontrak.awal)}</td><td className="p-4 text-right font-mono">{formatRp(data.assets.asetKontrak.mutasi)}</td><td className="p-4 text-right font-mono font-bold">{formatRp(data.assets.asetKontrak.akhir)}</td></tr>
            <tr><td className="p-4 text-slate-600">Persediaan Material Gudang</td><td className="p-4 text-right font-mono">{formatRp(data.assets.persediaan.awal)}</td><td className="p-4 text-right font-mono">{formatRp(data.assets.persediaan.mutasi)}</td><td className="p-4 text-right font-mono font-bold">{formatRp(data.assets.persediaan.akhir)}</td></tr>
            <tr><td className="p-4 text-slate-600">Uang Muka / Kasbon</td><td className="p-4 text-right font-mono">{formatRp(data.assets.uangMuka.awal)}</td><td className="p-4 text-right font-mono">{formatRp(data.assets.uangMuka.mutasi)}</td><td className="p-4 text-right font-mono font-bold">{formatRp(data.assets.uangMuka.akhir)}</td></tr>
            <tr><td className="p-4 text-slate-600">PPh Final Dibayar Dimuka</td><td className="p-4 text-right font-mono">{formatRp(data.assets.pphDibayarDimuka.awal)}</td><td className="p-4 text-right font-mono">{formatRp(data.assets.pphDibayarDimuka.mutasi)}</td><td className="p-4 text-right font-mono font-bold">{formatRp(data.assets.pphDibayarDimuka.akhir)}</td></tr>
            <tr className="bg-slate-50"><td className="p-4 font-bold text-slate-800">TOTAL ASET</td><td className="p-4 text-right font-mono font-bold">{formatRp(data.assets.total.awal)}</td><td className="p-4 text-right font-mono font-bold">{formatRp(data.assets.total.mutasi)}</td><td className="p-4 text-right font-mono font-bold text-slate-800">{formatRp(data.assets.total.akhir)}</td></tr>

            <tr><td colSpan={4} className="bg-slate-200 font-bold py-2 px-4 text-xs uppercase text-slate-700">B. Liabilitas Proyek</td></tr>
            <tr><td className="p-4 text-slate-600">Utang Usaha & Material</td><td className="p-4 text-right font-mono">{formatRp(data.liabilitiesEquity.utangUsaha.awal)}</td><td className="p-4 text-right font-mono">{formatRp(data.liabilitiesEquity.utangUsaha.mutasi)}</td><td className="p-4 text-right font-mono font-bold">{formatRp(data.liabilitiesEquity.utangUsaha.akhir)}</td></tr>
            <tr><td className="p-4 text-slate-600">Utang Subkontraktor</td><td className="p-4 text-right font-mono">{formatRp(data.liabilitiesEquity.utangSubkon.awal)}</td><td className="p-4 text-right font-mono">{formatRp(data.liabilitiesEquity.utangSubkon.mutasi)}</td><td className="p-4 text-right font-mono font-bold">{formatRp(data.liabilitiesEquity.utangSubkon.akhir)}</td></tr>
            <tr><td className="p-4 text-slate-600">Biaya Akrual</td><td className="p-4 text-right font-mono">{formatRp(data.liabilitiesEquity.biayaAkrual.awal)}</td><td className="p-4 text-right font-mono">{formatRp(data.liabilitiesEquity.biayaAkrual.mutasi)}</td><td className="p-4 text-right font-mono font-bold">{formatRp(data.liabilitiesEquity.biayaAkrual.akhir)}</td></tr>
            <tr><td className="p-4 text-slate-600">Liabilitas Kontrak (Unearned)</td><td className="p-4 text-right font-mono">{formatRp(data.liabilitiesEquity.liabilitasKontrak.awal)}</td><td className="p-4 text-right font-mono">{formatRp(data.liabilitiesEquity.liabilitasKontrak.mutasi)}</td><td className="p-4 text-right font-mono font-bold">{formatRp(data.liabilitiesEquity.liabilitasKontrak.akhir)}</td></tr>
            <tr><td className="p-4 text-slate-600">Utang Retensi Subkon</td><td className="p-4 text-right font-mono">{formatRp(data.liabilitiesEquity.utangRetensiSubkon.awal)}</td><td className="p-4 text-right font-mono">{formatRp(data.liabilitiesEquity.utangRetensiSubkon.mutasi)}</td><td className="p-4 text-right font-mono font-bold">{formatRp(data.liabilitiesEquity.utangRetensiSubkon.akhir)}</td></tr>
            
            <tr><td colSpan={4} className="bg-slate-200 font-bold py-2 px-4 text-xs uppercase text-slate-700">C. Ekuitas</td></tr>
            <tr><td className="p-4 text-slate-600">RK-Pusat (Droping)</td><td className="p-4 text-right font-mono">{formatRp(data.liabilitiesEquity.rkPusat.awal)}</td><td className="p-4 text-right font-mono">{formatRp(data.liabilitiesEquity.rkPusat.mutasi)}</td><td className="p-4 text-right font-mono font-bold">{formatRp(data.liabilitiesEquity.rkPusat.akhir)}</td></tr>
            <tr><td className="p-4 text-slate-600">Laba Berjalan (P&L)</td><td className="p-4 text-right font-mono">{formatRp(data.liabilitiesEquity.labaBerjalan.awal)}</td><td className="p-4 text-right font-mono">{formatRp(data.liabilitiesEquity.labaBerjalan.mutasi)}</td><td className="p-4 text-right font-mono font-bold text-indigo-700">{formatRp(data.liabilitiesEquity.labaBerjalan.akhir)}</td></tr>
            <tr className="bg-slate-50"><td className="p-4 font-bold text-slate-800">TOTAL LIABILITAS & EKUITAS</td><td className="p-4 text-right font-mono font-bold">{formatRp(data.liabilitiesEquity.total.awal)}</td><td className="p-4 text-right font-mono font-bold">{formatRp(data.liabilitiesEquity.total.mutasi)}</td><td className="p-4 text-right font-mono font-bold text-slate-800">{formatRp(data.liabilitiesEquity.total.akhir)}</td></tr>
          </tbody>
        </table>
      </div>

      {/* === TABEL HISTORY === */}
      <div className="w-full max-w-6xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden mb-10">
        <div className="p-6 border-b bg-slate-50 flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><History size={20} /></div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Riwayat Cetak Neraca (Snapshot)</h3>
            <p className="text-xs text-slate-500">Daftar laporan Neraca yang telah dibekukan dan disimpan secara permanen.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-slate-500 font-semibold border-b">
              <tr>
                <th className="p-4">Waktu Simpan</th>
                <th className="p-4">Oleh</th>
                <th className="p-4">Periode Laporan</th>
                <th className="p-4 text-right">Total Aset</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyData.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400 italic">Belum ada riwayat Neraca yang disimpan.</td></tr>
              ) : (
                historyData.map((hist, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-700">{new Date(hist.created_at).toLocaleString('id-ID')}</td>
                    <td className="p-4 font-bold text-indigo-700">{hist.created_by}</td>
                    <td className="p-4 text-slate-600">{new Date(hist.period_start).toLocaleDateString('id-ID')} s/d {new Date(hist.period_end).toLocaleDateString('id-ID')}</td>
                    <td className="p-4 text-right font-mono font-bold text-slate-700">{formatRp(hist.data_json?.assets?.total?.akhir || 0)}</td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${hist.data_json?.isBalanced ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {hist.data_json?.isBalanced ? 'BALANCE' : 'UNBALANCE'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleLoadHistory(hist)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Lihat Data Ini">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => setDeleteTarget(hist)} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="Hapus">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* === CUSTOM MODAL UNTUK HAPUS === */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus Snapshot Neraca?</h3>
              <p className="text-slate-500 text-sm">
                Anda akan menghapus riwayat snapshot periode <strong>{new Date(deleteTarget.period_start).toLocaleDateString('id-ID')} s/d {new Date(deleteTarget.period_end).toLocaleDateString('id-ID')}</strong>.
                Tindakan ini tidak dapat dibatalkan (Soft Delete).
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors">
                Batal
              </button>
              <button onClick={handleDeleteHistory} disabled={isDeleting} className="px-4 py-2 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 flex items-center gap-2 transition-colors">
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Hapus
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}