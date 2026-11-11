'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Printer, FileText, Loader2, Calendar, Settings, Info } from 'lucide-react';

interface CashFlowCategory {
  category: string;
  total: number;
  details: any[];
}

interface ActivityData {
  inflow: CashFlowCategory[];
  outflow: CashFlowCategory[];
  totalInflow: number;
  totalOutflow: number;
  net: number;
}

interface CashFlowStatementData {
  periodStart: string;
  periodEnd: string;
  saldoAwal: number;
  operating: ActivityData;
  investing: ActivityData;
  financing: ActivityData;
  netIncrease: number;
  saldoAkhir: number;
}

export default function CashFlowStatementView({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [data, setData] = useState<CashFlowStatementData | null>(null);
  
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const [showSigSettings, setShowSigSettings] = useState(false);
  const [signatures, setSignatures] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cashflow_signatures');
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
    localStorage.setItem('cashflow_signatures', JSON.stringify(newSigs));
  };

  const formatNum = (val: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(val || 0);
  const formatOutflow = (val: number) => {
    if (!val || val === 0) return '0';
    return `(${formatNum(val)})`;
  };

  const groupByCategory = (flows: any[], type: 'IN' | 'OUT'): CashFlowCategory[] => {
    const filtered = flows.filter(f => type === 'IN' ? ['IN', 'Income'].includes(f.type) : ['OUT', 'Expense'].includes(f.type));
    const grouped: Record<string, CashFlowCategory> = {};

    filtered.forEach(f => {
      let label = f.category;
      
      if (type === 'IN') {
        if (label === 'DP') label = 'Penerimaan Uang Muka (DP) / Termin';
        if (label === 'Termin') label = 'Penerimaan Termin Proyek';
        if (label === 'Retensi') label = 'Pencairan Retensi';
      } 
      else {
        if (['Material'].includes(label)) label = 'Pembayaran Material (Supplier)';
        else if (['Upah'].includes(label)) label = 'Pembayaran Upah & Mandor';
        else if (['Subkon', 'Alat'].includes(label)) label = 'Pembayaran Subkon & Sewa Alat';
        else if (['Operasional', 'Lainnya'].includes(label)) label = 'Pembayaran Biaya Operasional Lapangan';
      }

      if (!grouped[label]) grouped[label] = { category: label, total: 0, details: [] };
      grouped[label].total += Number(f.amount);
      grouped[label].details.push(f);
    });

    return Object.values(grouped).sort((a, b) => b.total - a.total);
  };

  const fetchReport = async () => {
    if (!projectId) return; 
    setLoading(true);
    try {
      const { data: prevFlows } = await supabase
        .from('cash_flows')
        .select('type, amount')
        .eq('project_id', projectId)
        .eq('approval_status', 'Approved')
        .is('voided_at', null)
        .lt('transaction_date', startDate);

      let saldoAwal = 0;
      if (prevFlows) {
        prevFlows.forEach(f => {
          const isIn = ['IN', 'Income'].includes(f.type);
          saldoAwal += isIn ? Number(f.amount) : -Number(f.amount);
        });
      }

      const { data: flows, error } = await supabase
        .from('cash_flows')
        .select('*')
        .eq('project_id', projectId)
        .eq('approval_status', 'Approved')
        .is('voided_at', null)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: true });

      if (error) throw new Error(error.message);

      const operatingFlows: any[] = [];
      const investingFlows: any[] = [];
      const financingFlows: any[] = [];

      flows?.forEach(f => {
        if (f.category === 'Alat') investingFlows.push(f);
        else if (['Droping', 'Pinjaman', 'Modal', 'Dividen', 'Transfer Internal'].includes(f.category)) financingFlows.push(f);
        else operatingFlows.push(f);
      });

      const buildActivityData = (activityFlows: any[]): ActivityData => {
        const inflow = groupByCategory(activityFlows, 'IN');
        const outflow = groupByCategory(activityFlows, 'OUT');
        const totalInflow = inflow.reduce((sum, item) => sum + item.total, 0);
        const totalOutflow = outflow.reduce((sum, item) => sum + item.total, 0);
        return { inflow, outflow, totalInflow, totalOutflow, net: totalInflow - totalOutflow };
      };

      const operating = buildActivityData(operatingFlows);
      const investing = buildActivityData(investingFlows);
      const financing = buildActivityData(financingFlows);

      const netIncrease = operating.net + investing.net + financing.net;
      const saldoAkhir = saldoAwal + netIncrease;

      setData({ periodStart: startDate, periodEnd: endDate, saldoAwal, operating, investing, financing, netIncrease, saldoAkhir });
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchReport();
  }, [projectId, startDate, endDate]);

  const handlePrintAndSave = async () => {
    if (!data || !projectId) return;
    setIsPrinting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('cash_flow_snapshots').insert([{
        project_id: projectId, period_start: startDate, period_end: endDate, data: data, created_by: user?.id
      }]);

      const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
      const companyName = project?.contractor_name || project?.company_name || 'NAMA PERUSAHAAN';
      const companyAddress = project?.contractor_address || project?.address || 'Alamat Perusahaan Belum Diatur';
      const contractNumber = project?.contract_number || project?.project_code || '-';
      
      const docNumber = `DOC/FIN-CF/${new Date().getFullYear()}/${(new Date().getMonth()+1).toString().padStart(2, '0')}/${Date.now().toString().slice(-4)}`;
      const printTime = new Date().toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

      const renderRow = (label: string, value: number, isBold = false, indent = 0, isNegative = false) => {
        const padding = indent === 1 ? 'padding-left: 30px;' : indent === 2 ? 'padding-left: 50px;' : 'padding-left: 20px;';
        const valStr = isNegative ? formatOutflow(value) : formatNum(value);
        const color = (isNegative && value > 0) ? '#b91c1c' : '#0f172a';
        return `
          <tr>
            <td style="${padding} ${isBold ? 'font-weight: 700;' : ''}">${label}</td>
            <td class="text-right" style="color: ${color}; ${isBold ? 'font-weight: 700;' : ''}">${valStr}</td>
          </tr>
        `;
      };

      const renderSectionPDF = (title: string, subTotalText: string, activity: ActivityData) => {
        const standardOutflowLabels = [
          'Pembayaran Material (Supplier)',
          'Pembayaran Upah & Mandor',
          'Pembayaran Subkon & Sewa Alat',
          'Pembayaran Biaya Operasional Lapangan'
        ];
        
        let outflowHtml = '';
        if (title.includes('OPERASI')) {
          standardOutflowLabels.forEach(label => {
            const found = activity.outflow.find(o => o.category === label);
            const val = found ? found.total : 0;
            outflowHtml += renderRow(label, val, false, 1, true);
          });
        } else {
          outflowHtml = activity.outflow.map(cat => renderRow(cat.category, cat.total, false, 1, true)).join('');
        }

        return `
          <tr class="bg-section"><td colspan="2" style="padding: 4px 10px; font-weight: 700;">${title}</td></tr>
          ${activity.inflow.map(cat => renderRow(cat.category, cat.total, false, 1)).join('')}
          <tr>
            <td style="padding-left: 20px; font-weight: 700; color: #475569;">Total Penerimaan Kas</td>
            <td class="text-right" style="color: #0f172a;">${formatNum(activity.totalInflow)}</td>
          </tr>
          
          ${outflowHtml}
          <tr>
            <td style="padding-left: 20px; font-weight: 700; color: #475569;">Total Pengeluaran Kas</td>
            <td class="text-right" style="color: ${activity.totalOutflow > 0 ? '#b91c1c' : '#0f172a'};">${formatOutflow(activity.totalOutflow)}</td>
          </tr>

          <tr class="total-section">
            <td style="padding-left: 20px;">${subTotalText}</td>
            <td class="text-right">${formatNum(activity.net)}</td>
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
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9.5pt; color: #0f172a; margin: 0; padding: 0; }
              
              .print-container { position: relative; min-height: 265mm; display: flex; flex-direction: column; font-variant-numeric: tabular-nums; }
              
              .header-table { width: 100%; border-collapse: collapse; margin-bottom: 2px; table-layout: fixed; }
              .header-table > tbody > tr > td { vertical-align: bottom; padding: 0; }
              
              .logo-img { max-height: 85px; max-width: 200px; object-fit: contain; }
              
              .company-name { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 13pt; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; line-height: 1.1; }
              .company-address { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 7.5pt; margin: 2px 0 0 0; color: #475569; line-height: 1.2; }
              
              .doc-title-wrapper { text-align: right; }
              .doc-title { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 14pt; font-weight: 900; margin: 0; text-transform: uppercase; color: #0f172a; letter-spacing: 1px; white-space: nowrap; }
              .doc-subtitle { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 8.5pt; font-weight: 700; margin: 2px 0 0 0; color: #475569; letter-spacing: 0.5px; }
              
              .header-line-1 { border-top: 3px solid #0f172a; margin-top: 5px; }
              .header-line-2 { border-top: 1px solid #0f172a; margin-top: 2px; margin-bottom: 10px; }
              
              .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 10px; border: 1px solid #cbd5e1; }
              .info-grid td { padding: 5px 8px; vertical-align: top; width: 50%; }
              .info-label { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 7.5pt; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1px; }
              .info-value { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 9pt; font-weight: 700; color: #0f172a; margin: 0; }
              .info-sub { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 8pt; color: #475569; margin-top: 1px; }
              
              .report-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
              .report-table th { background-color: #f8fafc; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; padding: 5px 10px; font-size: 8.5pt; text-transform: uppercase; text-align: left; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; }
              
              .report-table td { padding: 3px 10px; vertical-align: middle; border-bottom: 1px solid #e2e8f0; }
              
              .text-right { text-align: right; font-family: 'Courier New', Courier, monospace; font-size: 9.5pt; font-weight: 700; }
              
              .bg-section { background-color: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
              
              .total-section td { font-weight: 800; background-color: #f8fafc; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; color: #0f172a; }
              
              .grand-total-row td { background-color: #0f172a; color: #ffffff; font-weight: 800; font-size: 10.5pt; padding: 8px 10px; border: none; letter-spacing: 0.5px; }
              
              .final-row td { font-weight: 800; border-top: 3px double #0f172a; border-bottom: 3px double #0f172a; background-color: #f8fafc; font-size: 10.5pt; padding: 8px 10px; color: #0f172a; }
              
              .bottom-wrapper { margin-top: auto; width: 100%; page-break-inside: avoid; padding-top: 10px; }
              
              .sig-wrapper { margin-bottom: 10px; margin-top: 15px; page-break-inside: avoid; }
              .sig-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
              .sig-table td { text-align: center; vertical-align: bottom; padding: 0 10px; }
              .sig-status { font-size: 8.5pt; color: #64748b; margin: 0; }
              .sig-role { font-size: 9.5pt; font-weight: 700; color: #0f172a; margin: 2px 0 0 0; }
              
              .sig-space { height: 40px; }
              
              /* FIX: Garis Nama Tanda Tangan */
              .sig-name { font-weight: 700; font-size: 9.5pt; margin: 0; border-bottom: 1px solid #000; display: inline-block; min-width: 160px; padding-bottom: 2px; min-height: 18px; color: #0f172a; }
              .sig-meta { font-size: 7.5pt; color: #64748b; margin: 2px 0 0 0; }
              
              .footer-meta { border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 7.5pt; color: #64748b; }
              .footer-meta table { width: 100%; }
              .footer-meta td { padding: 0; }
            </style>
          </head>
          <body>
            <div class="print-container">
              <!-- FIX: KOP SURAT DENGAN NESTED TABLE (Sama seperti Neraca & P&L) -->
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
                    <h1 class="doc-title">LAPORAN ARUS KAS</h1>
                    <p class="doc-subtitle">PROYEK KONSTRUKSI (INTERNAL)</p>
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
                    <div class="info-sub">Nomor Kontrak: <strong>${contractNumber}</strong></div>
                  </td>
                  <td>
                    <div class="info-label">Periode Laporan</div>
                    <p class="info-value">${new Date(startDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})} - ${new Date(endDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
                    <div class="info-sub">Mata Uang: IDR (Rupiah)</div>
                  </td>
                </tr>
              </table>

              <table class="report-table">
                <thead>
                  <tr>
                    <th style="width: 75%;">Keterangan</th>
                    <th style="width: 25%; text-align: right;">Jumlah (Rp)</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderSectionPDF('A. ARUS KAS DARI AKTIVITAS OPERASI', 'Kas Bersih dari Aktivitas Operasi', data.operating)}
                  ${renderSectionPDF('B. ARUS KAS DARI AKTIVITAS INVESTASI', 'Kas Bersih dari Aktivitas Investasi', data.investing)}
                  ${renderSectionPDF('C. ARUS KAS DARI AKTIVITAS PENDANAAN (DROPING)', 'Kas Bersih dari Aktivitas Pendanaan', data.financing)}

                  <tr><td colspan="2" style="border: none; height: 5px;"></td></tr>

                  <tr class="grand-total-row">
                    <td>KENAIKAN (PENURUNAN) KAS BERSIH</td>
                    <td class="text-right">${formatNum(data.netIncrease)}</td>
                  </tr>
                  <tr style="background-color: #f8fafc;">
                    <td style="padding: 6px 10px; font-weight: 700; color: #475569;">SALDO KAS AWAL PERIODE</td>
                    <td class="text-right" style="padding: 6px 10px; color: #475569;">${formatNum(data.saldoAwal)}</td>
                  </tr>
                  <tr class="final-row">
                    <td style="padding: 8px 10px;">SALDO KAS AKHIR PERIODE</td>
                    <td class="text-right" style="padding: 8px 10px;">${formatNum(data.saldoAkhir)}</td>
                  </tr>
                </tbody>
              </table>

              <div class="bottom-wrapper">
                <div style="font-size: 7.5pt; color: #64748b; font-style: italic; page-break-inside: avoid; padding-bottom: 10px;">
                  * Catatan: Penerimaan Termin dicatat sebesar nilai kas bersih (Net) yang diterima di rekening setelah pemotongan PPh Final Konstruksi dan/atau Retensi (tidak termasuk PPN Wapu). Dana Droping Kantor Pusat diklasifikasikan sebagai Aktivitas Pendanaan (Inter-office Account).
                </div>

                <div class="sig-wrapper">
                  <table class="sig-table">
                    <tr>
                      ${signatures.map(sig => `
                        <td>
                          <p class="sig-status">${sig.status},</p>
                          <p class="sig-role">${sig.role}</p>
                          <div class="sig-space"></div>
                          <p class="sig-name">${sig.name}</p>
                          <p class="sig-meta">${sig.meta}</p>
                        </td>
                      `).join('')}
                    </tr>
                  </table>
                </div>

                <div class="footer-meta">
                  <table>
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
      a.download = `CashFlow_${project?.name || 'Proyek'}_${startDate}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);

    } catch (err: any) {
      console.error(err);
    } finally {
      setIsPrinting(false);
    }
  };

  if (!projectId) {
    return <div className="bg-white p-10 rounded-lg shadow-sm border border-slate-200 text-center"><p className="text-slate-500 font-bold">Project ID tidak ditemukan.</p></div>;
  }

  const renderUIBlock = (title: string, subTotalText: string, activity: ActivityData) => {
    const standardOutflowLabels = [
      'Pembayaran Material (Supplier)',
      'Pembayaran Upah & Mandor',
      'Pembayaran Subkon & Sewa Alat',
      'Pembayaran Biaya Operasional Lapangan'
    ];

    return (
      <>
        <tr className="bg-slate-50 font-bold text-slate-800 border-t-2 border-slate-300">
          <td colSpan={2} className="p-3">{title}</td>
        </tr>
        
        {activity.inflow.map((cat, idx) => (
          <tr key={`in-${idx}`} className="hover:bg-slate-50">
            <td className="p-3 pl-8 text-slate-600">{cat.category}</td>
            <td className="p-3 text-right font-mono text-emerald-600">{formatNum(cat.total)}</td>
          </tr>
        ))}
        <tr className="bg-slate-50/50">
          <td className="p-3 pl-8 font-bold text-slate-700">Total Penerimaan Kas</td>
          <td className="p-3 text-right font-mono font-bold text-emerald-700">{formatNum(activity.totalInflow)}</td>
        </tr>

        {title.includes('OPERASI') ? (
          standardOutflowLabels.map((label, idx) => {
            const found = activity.outflow.find(o => o.category === label);
            const val = found ? found.total : 0;
            return (
              <tr key={`out-${idx}`} className="hover:bg-slate-50">
                <td className="p-3 pl-8 text-slate-600">{label}</td>
                <td className={`p-3 text-right font-mono ${val > 0 ? 'text-red-600' : 'text-slate-400'}`}>{formatOutflow(val)}</td>
              </tr>
            )
          })
        ) : (
          activity.outflow.map((cat, idx) => (
            <tr key={`out-${idx}`} className="hover:bg-slate-50">
              <td className="p-3 pl-8 text-slate-600">{cat.category}</td>
              <td className="p-3 text-right font-mono text-red-600">{formatOutflow(cat.total)}</td>
            </tr>
          ))
        )}

        <tr className="bg-slate-50/50">
          <td className="p-3 pl-8 font-bold text-slate-700">Total Pengeluaran Kas</td>
          <td className={`p-3 text-right font-mono font-bold ${activity.totalOutflow > 0 ? 'text-red-700' : 'text-slate-800'}`}>{formatOutflow(activity.totalOutflow)}</td>
        </tr>

        <tr className="font-bold bg-slate-100 border-t border-slate-300">
          <td className="p-3 pl-8 text-indigo-900">{subTotalText}</td>
          <td className="p-3 text-right font-mono text-indigo-700">{formatNum(activity.net)}</td>
        </tr>
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText className="text-indigo-600" /> Laporan Arus Kas Proyek (Internal)
            </h2>
            <p className="text-sm text-slate-500 mt-1">Rincian arus kas operasi, investasi, dan pendanaan (droping dana) untuk pelaporan ke Kantor Pusat.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowSigSettings(!showSigSettings)} className="px-4 py-2 text-sm font-bold border rounded-lg hover:bg-slate-50 flex items-center gap-2">
              <Settings size={16} /> Atur TTD
            </button>
            <button onClick={handlePrintAndSave} disabled={loading || isPrinting || !data} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50">
              {isPrinting ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} 
              {isPrinting ? 'Memproses PDF...' : 'Cetak Laporan'}
            </button>
          </div>
        </div>

        {showSigSettings && (
          <div className="mb-6 p-5 bg-indigo-50 border border-indigo-100 rounded-xl">
            <h3 className="text-sm font-bold text-indigo-900 mb-4">Pengaturan Tanda Tangan Laporan (Tersimpan Otomatis)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {signatures.map((sig, idx) => (
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
                    <input type="text" value={sig.meta} onChange={(e) => handleUpdateSignature(idx, 'meta', e.target.value)} className="w-full border border-slate-300 p-2 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="cth: NIP. 12345 atau Tgl: 12/11/2026" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-lg border">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-slate-400" />
            <span className="text-sm font-bold text-slate-600">Periode:</span>
          </div>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded p-2 text-sm" />
          <span className="text-slate-400">s/d</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded p-2 text-sm" />
          <button onClick={fetchReport} disabled={loading} className="ml-auto bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={16} /> : 'Tampilkan Data'}
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg text-sm flex items-start gap-3">
        <Info className="mt-0.5 flex-shrink-0" size={18} />
        <div>
          <p className="font-bold mb-1">Catatan Pelaporan Internal:</p>
          <ul className="list-disc ml-4 space-y-1">
            <li>Penerimaan Termin diasumsikan sebagai <strong>Kas Bersih (Net)</strong> yang masuk ke rekening proyek.</li>
            <li>Dana Droping / Pinjaman Internal dipisahkan ke dalam <strong>Aktivitas Pendanaan</strong> agar tidak menggelembungkan Pendapatan Proyek.</li>
            <li>Rincian pengeluaran dikelompokkan berdasarkan kategori konstruksi (Material, Upah, Subkon & Alat, Operasional).</li>
          </ul>
        </div>
      </div>

      {loading && (
        <div className="bg-white p-10 rounded-xl shadow-sm border text-center flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600 mb-3" size={32} />
          <p className="text-slate-500 font-bold">Menghitung Laporan Arus Kas...</p>
        </div>
      )}

      {!loading && data && (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
              <tr>
                <th className="p-4 w-3/4">Keterangan</th>
                <th className="p-4 w-1/4 text-right">Jumlah (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {renderUIBlock('A. ARUS KAS DARI AKTIVITAS OPERASI', 'Kas Bersih dari Aktivitas Operasi', data.operating)}
              {renderUIBlock('B. ARUS KAS DARI AKTIVITAS INVESTASI', 'Kas Bersih dari Aktivitas Investasi', data.investing)}
              {renderUIBlock('C. ARUS KAS DARI AKTIVITAS PENDANAAN (DROPING)', 'Kas Bersih dari Aktivitas Pendanaan', data.financing)}

              <tr className="bg-indigo-600 text-white font-bold text-base border-t-2 border-indigo-700">
                <td className="p-4">KENAIKAN (PENURUNAN) KAS BERSIH</td>
                <td className="p-4 text-right font-mono">{formatNum(data.netIncrease)}</td>
              </tr>
              <tr className="font-bold bg-white">
                <td className="p-4 text-slate-700">SALDO KAS AWAL PERIODE</td>
                <td className="p-4 text-right font-mono text-slate-700">{formatNum(data.saldoAwal)}</td>
              </tr>
              <tr className="font-bold bg-emerald-50 border-t-4 border-emerald-500 text-emerald-900 text-lg">
                <td className="p-5">SALDO KAS AKHIR PERIODE</td>
                <td className="p-5 text-right font-mono">{formatNum(data.saldoAkhir)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}