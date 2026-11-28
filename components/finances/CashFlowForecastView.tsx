'use client';

import React, { useEffect, useState } from 'react';
import { getCashFlowForecast, CashFlowForecastData } from '@/lib/services/cashflow-forecast.service';
import { Loader2, TrendingUp, AlertTriangle, Printer, FileText, Settings, CheckCircle2, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';

export default function CashFlowForecastView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<CashFlowForecastData | null>(null);
  const [projectData, setProjectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // STATE UNTUK PENGATURAN TTD
  const [showSigSettings, setShowSigSettings] = useState(false);
  const [signatures, setSignatures] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cashflow_forecast_signatures');
      if (saved) return JSON.parse(saved);
    }
    return [
      { status: 'Disusun oleh', role: 'Finance Proyek', name: 'NAMA FINANCE', meta: 'NIP. -' },
      { status: 'Diperiksa oleh', role: 'Project Manager', name: 'NAMA PM', meta: 'NIP. -' },
      { status: 'Disetujui oleh', role: 'Direktur', name: 'NAMA DIREKTUR', meta: 'NIP. -' },
    ];
  });

  const handleUpdateSignature = (index: number, field: string, value: string) => {
    const newSigs = [...signatures];
    newSigs[index] = { ...newSigs[index], [field]: value };
    setSignatures(newSigs);
    localStorage.setItem('cashflow_forecast_signatures', JSON.stringify(newSigs));
  };

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        // Fetch Forecast Data
        const res = await getCashFlowForecast(projectId);
        setData(res);
        
        // Fetch Project Data untuk Kop Surat PDF (Tambahkan company_name)
        const { data: proj } = await supabase
          .from('projects')
          .select('name, contract_number, contractor_name, company_name, contractor_address, logo_url')
          .eq('id', projectId)
          .single();
        if (proj) setProjectData(proj);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (projectId) load();
  }, [projectId]);

  const formatRp = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
  const formatNum = (num: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(num || 0);

  const handlePrintForecast = async () => {
    if (!data || !projectData) return;
    setIsPrinting(true);

    try {
      // PERBAIKAN: Ambil dari contractor_name atau fallback ke company_name
      const companyName = projectData?.contractor_name || projectData?.company_name || 'NAMA PERUSAHAAN';
      const companyAddress = projectData?.contractor_address || 'Alamat Perusahaan Belum Diatur';
      const contractNumber = projectData?.contract_number || '-';
      const logoUrl = projectData?.logo_url || '';
      
      const printTime = new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const docNumber = `DOC/FIN-CFF/${new Date().getFullYear()}/${(new Date().getMonth()+1).toString().padStart(2, '0')}/${Date.now().toString().slice(-4)}`;

      // RENDER TABEL PROYEKSI BULANAN
      const monthlyRows = data.months.map(m => `
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold;">${m.monthLabel}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; color: #059669;">${formatNum(m.inflow)}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; color: #dc2626;">${formatNum(m.outflow)}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: ${m.net >= 0 ? '#0f172a' : '#dc2626'};">${formatNum(m.net)}</td>
        </tr>
      `).join('');

      // RENDER TABEL DETAIL ITEM
      const detailRows = data.details.map((item, idx) => `
        <tr>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 9pt;">${idx + 1}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 9pt;">${new Date(item.date).toLocaleDateString('id-ID')}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 9pt;">${item.category}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 9pt;">${item.description}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 9pt; text-align: center; font-weight: bold; color: ${item.type === 'INFLOW' ? '#059669' : '#dc2626'};">
            ${item.type === 'INFLOW' ? 'MASUK' : 'KELUAR'}
          </td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 9pt; text-align: right; font-weight: bold;">${formatNum(item.amount)}</td>
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { size: A4 landscape; margin: 15mm 20mm; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9.5pt; color: #0f172a; margin: 0; padding: 0; }
              
              /* CONTAINER LOCK */
              .print-container { position: relative; min-height: 176mm; display: flex; flex-direction: column; font-variant-numeric: tabular-nums; }
              
              /* KOP SURAT */
              .header-table { width: 100%; border-collapse: collapse; margin-bottom: 2px; table-layout: fixed; }
              .header-table > tbody > tr > td { vertical-align: bottom; padding: 0; }
              .logo-img { max-height: 60px; max-width: 150px; object-fit: contain; }
              .company-name { font-size: 14pt; font-weight: 900; margin: 0; text-transform: uppercase; color: #0f172a; }
              .company-address { font-size: 8pt; margin: 2px 0 0 0; color: #475569; }
              .doc-title { font-size: 16pt; font-weight: 900; margin: 0; text-transform: uppercase; color: #0f172a; text-align: right; }
              .doc-subtitle { font-size: 9pt; font-weight: 700; margin: 2px 0 0 0; color: #475569; text-align: right; }
              
              .header-line-1 { border-top: 3px solid #0f172a; margin-top: 5px; }
              .header-line-2 { border-top: 1px solid #0f172a; margin-top: 2px; margin-bottom: 15px; }
              
              /* INFO GRID */
              .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1px solid #cbd5e1; }
              .info-grid td { padding: 6px 10px; vertical-align: top; width: 33%; border-right: 1px solid #cbd5e1; }
              .info-label { font-size: 7.5pt; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }
              .info-value { font-size: 10pt; font-weight: 700; color: #0f172a; margin: 0; }
              
              /* TABEL */
              .report-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
              .report-table th { background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; font-size: 9pt; text-transform: uppercase; text-align: left; font-weight: bold; color: #0f172a; }
              .report-table td { padding: 8px; border: 1px solid #cbd5e1; }
              
              /* SIGNATURE (ABSOLUTE FOOTER) */
              .bottom-wrapper { margin-top: auto; padding-top: 20px; width: 100%; page-break-inside: avoid; break-inside: avoid; }
              .sig-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 20px; }
              .sig-table td { text-align: center; vertical-align: bottom; padding: 0 10px; }
              .sig-space { height: 64px; }
              .sig-name { font-weight: bold; font-size: 9.5pt; margin: 0; border-bottom: 1.25px solid #0f172a; display: inline-block; min-width: 165px; padding: 0 10px 2px 10px; text-transform: uppercase; }
              .sig-title { font-size: 8pt; color: #64748b; margin: 2px 0 0 0; }
              
              .footer-meta { border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 7.5pt; color: #64748b; margin-top: 15px; }
            </style>
          </head>
          <body>
            <div class="print-container">
              <!-- KOP SURAT -->
              <table class="header-table">
                <tr>
                  <td style="width: 60%;">
                    <table style="border-collapse: collapse; width: 100%;">
                      <tr>
                        ${logoUrl ? `<td style="width: 80px; padding-right: 15px;"><img src="${logoUrl}" class="logo-img" /></td>` : ''}
                        <td>
                          <h2 class="company-name">${companyName}</h2>
                          <p class="company-address">${companyAddress}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="width: 40%;">
                    <h1 class="doc-title">CASH FLOW FORECAST</h1>
                    <p class="doc-subtitle">PROYEKSI ARUS KAS 3 BULAN</p>
                  </td>
                </tr>
              </table>
              <div class="header-line-1"></div>
              <div class="header-line-2"></div>

              <!-- INFO PROYEK -->
              <table class="info-grid">
                <tr>
                  <td>
                    <div class="info-label">Informasi Proyek</div>
                    <p class="info-value">${projectData?.name || 'NAMA PROYEK'}</p>
                  </td>
                  <td>
                    <div class="info-label">Nomor Kontrak</div>
                    <p class="info-value">${contractNumber}</p>
                  </td>
                  <td style="border-right: none;">
                    <div class="info-label">Saldo Kas Saat Ini</div>
                    <p class="info-value" style="color: #4338ca;">${formatRp(data.currentBalance)}</p>
                  </td>
                </tr>
              </table>

              <!-- TABEL RINGKASAN BULANAN -->
              <div style="font-weight: bold; font-size: 10pt; margin-bottom: 5px; color: #0f172a;">A. RINGKASAN PROYEKSI BULANAN</div>
              <table class="report-table">
                <thead>
                  <tr>
                    <th style="width: 25%;">Periode Bulan</th>
                    <th style="width: 25%; text-align: right;">Estimasi Kas Masuk (Rp)</th>
                    <th style="width: 25%; text-align: right;">Estimasi Kas Keluar (Rp)</th>
                    <th style="width: 25%; text-align: right;">Arus Kas Bersih (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  ${monthlyRows}
                </tbody>
              </table>

              <!-- TABEL DETAIL ITEM -->
              <div style="font-weight: bold; font-size: 10pt; margin-bottom: 5px; color: #0f172a; margin-top: 20px;">B. RINCIAN ITEM PROYEKSI</div>
              <table class="report-table">
                <thead>
                  <tr>
                    <th style="width: 5%; text-align: center;">No</th>
                    <th style="width: 15%;">Estimasi Tanggal</th>
                    <th style="width: 20%;">Kategori</th>
                    <th style="width: 35%;">Keterangan</th>
                    <th style="width: 10%; text-align: center;">Tipe</th>
                    <th style="width: 15%; text-align: right;">Nominal (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  ${detailRows || '<tr><td colspan="6" style="text-align:center; font-style:italic;">Tidak ada data proyeksi.</td></tr>'}
                </tbody>
              </table>

              <!-- TANDA TANGAN & FOOTER -->
              <div class="bottom-wrapper">
                <div class="sig-table">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      ${signatures.map((sig: any) => `
                        <td>
                          <p class="sig-title">${sig.status},</p>
                          <p class="sig-title" style="font-weight: bold; color: #0f172a;">${sig.role}</p>
                          <div class="sig-space"></div>
                          <p class="sig-name">${sig.name}</p>
                          <p class="sig-title" style="font-size: 7.5pt; margin-top: 2px;">${sig.meta}</p>
                        </td>
                      `).join('')}
                    </tr>
                  </table>
                </div>

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, format: 'A4', isLandscape: true }) // Landscape!
      });

      if (!res.ok) throw new Error('Gagal generate PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CashFlowForecast_${projectData?.name || 'Proyek'}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);

    } catch (err: any) {
      console.error(err);
      showToast('error', 'Gagal mencetak PDF: ' + (err?.message || 'Terjadi kesalahan'));
    } finally {
      setIsPrinting(false);
    }
  };

  if (loading) return <div className="p-10 flex justify-center text-indigo-600"><Loader2 className="animate-spin" size={32} /></div>;
  if (!data) return <div className="p-6 text-red-600 font-bold">Gagal memuat data forecast.</div>;

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-5 py-3 rounded-xl shadow-xl text-white text-sm font-bold flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          <CheckCircle2 size={16} /> {toast.message}
        </div>
      )}
      {/* HEADER & ACTIONS */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="text-indigo-600" size={20} /> Proyeksi Arus Kas
          </h2>
          <p className="text-sm text-slate-500 mt-1">Estimasi Kas Masuk & Keluar berdasarkan Invoice & Hutang Aktif.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSigSettings(!showSigSettings)} className="px-4 py-2 text-sm font-bold border rounded-lg hover:bg-slate-50 flex items-center gap-2">
            <Settings size={16} /> Atur TTD
          </button>
          <button onClick={handlePrintForecast} disabled={isPrinting} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50">
            {isPrinting ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} 
            {isPrinting ? 'Memproses...' : 'Cetak PDF Forecast'}
          </button>
        </div>
      </div>

      {/* PENGATURAN TTD (Tampil jika diklik) */}
      {showSigSettings && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-indigo-900">Pengaturan Tanda Tangan Laporan (Tersimpan Otomatis)</h3>
            <button onClick={() => setShowSigSettings(false)} className="text-indigo-400 hover:text-indigo-700"><X size={18}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {signatures.map((sig: any, idx: number) => (
              <div key={idx} className="space-y-3 bg-white p-4 rounded-lg shadow-sm border border-indigo-100">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Status Alur</label>
                  <input type="text" value={sig.status} onChange={(e) => handleUpdateSignature(idx, 'status', e.target.value)} className="w-full border border-slate-300 p-2 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="cth: Disetujui oleh" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Jabatan</label>
                  <input type="text" value={sig.role} onChange={(e) => handleUpdateSignature(idx, 'role', e.target.value)} className="w-full border border-slate-300 p-2 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nama Lengkap</label>
                  <input type="text" value={sig.name} onChange={(e) => handleUpdateSignature(idx, 'name', e.target.value)} className="w-full border border-slate-300 p-2 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-900" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">NIP / Tanggal Pengesahan</label>
                  <input type="text" value={sig.meta} onChange={(e) => handleUpdateSignature(idx, 'meta', e.target.value)} className="w-full border border-slate-300 p-2 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="cth: NIP. 12345" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KARTU RINGKASAN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-indigo-500">
          <p className="text-xs font-bold text-slate-500 uppercase">Saldo Kas Saat Ini</p>
          <p className="text-2xl font-bold text-indigo-700 mt-1">{formatRp(data.currentBalance)}</p>
        </div>
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-amber-500">
          <p className="text-xs font-bold text-slate-500 uppercase">Proyeksi 3 Bulan Ke Depan</p>
          <p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
            <AlertTriangle size={14} className="text-amber-500"/> Berdasarkan Invoice Outstanding & Hutang Jatuh Tempo.
          </p>
        </div>
      </div>

      {/* GRAFIK PROYEKSI */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Proyeksi Arus Kas (3 Bulan)</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.months} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(val) => `Rp ${val / 1000000} Jt`} tick={{ fontSize: 12 }} width={90} />
              <Tooltip formatter={(value: number) => formatRp(value)} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="inflow" name="Estimasi Masuk" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="outflow" name="Estimasi Keluar" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TABEL DETAIL FORECAST */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileText size={18} className="text-indigo-600"/> Rincian Item Proyeksi</h3>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
            <tr>
              <th className="p-3">Estimasi Tanggal</th>
              <th className="p-3 text-center">Tipe</th>
              <th className="p-3">Kategori</th>
              <th className="p-3">Keterangan</th>
              <th className="p-3 text-right">Nominal (Rp)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.details.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="p-3 text-xs">{new Date(item.date).toLocaleDateString('id-ID')}</td>
                <td className="p-3 text-center">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${item.type === 'INFLOW' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {item.type === 'INFLOW' ? 'MASUK' : 'KELUAR'}
                  </span>
                </td>
                <td className="p-3 text-xs font-semibold">{item.category}</td>
                <td className="p-3 text-xs text-slate-500">{item.description}</td>
                <td className={`p-3 text-right font-bold ${item.type === 'INFLOW' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatRp(item.amount)}
                </td>
              </tr>
            ))}
            {data.details.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-slate-500 italic">Tidak ada proyeksi arus kas untuk 3 bulan ke depan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}