'use client';

import React, { useState, useEffect } from 'react';
import { Printer, FileText, Settings, Loader2 } from 'lucide-react';
import { hitungSAK } from '@/lib/utils/sak-calculator';
import { SignatureSettings } from '@/components/shared/SignatureSettings';
import { resolveProjectBranding, buildEnterpriseSignatureHtml, escapePrintHtml } from '@/lib/utils/print-branding';
import { supabase } from '@/lib/supabase';
import { terbilang } from '@/lib/utils/terbilang';


interface InvoicePrintViewProps {
  projectId: string;
  projectData: any;
  bappData: any; // Data dari BAPP yang sudah Approved
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export default function InvoicePrintView({ projectId, projectData, bappData, showToast }: InvoicePrintViewProps) {
  const [loading, setLoading] = useState(false);
  const [showSigSettings, setShowSigSettings] = useState(false);

  // State Form & Snapshot
  const [form, setForm] = useState({
    invoiceNumber: `001/INV/BKP/${new Date().toLocaleString('id-ID', { month: 'long' }).toUpperCase()}/${new Date().getFullYear()}`,
    invoiceDate: new Date().toISOString().split('T')[0],
    status: 'DRAFT' as 'DRAFT' | 'SENT' | 'PAID',
    clientName: projectData?.client_name || 'Pemberi Kerja',
    clientAddress: projectData?.client_address || 'Alamat Klien'
  });

  // State Tanda Tangan (3 Pihak — tersimpan otomatis per proyek)
  const [signatures, setSignatures] = useState(() => {
    if (typeof window !== 'undefined' && projectId) {
      try {
        const saved = localStorage.getItem(`invoice_sig_${projectId}`);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    const b = resolveProjectBranding(projectData);
    return [
      { title: 'Hormat Kami,\nDirektur Utama / CFO', name: '' },
      { title: `Diperiksa Oleh,\n${b.picTitle || 'Project Manager'}`, name: b.picName ? b.picName.toUpperCase() : '' },
      { title: 'Diterima Oleh,\nPemberi Kerja', name: projectData?.client_name || b.ownerName || '' },
    ];
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      localStorage.setItem(`invoice_sig_${projectId}`, JSON.stringify(signatures));
    }
  }, [signatures, projectId]);

  // 1. HITUNG FINANSIAL MENGGUNAKAN ENGINE (Absolute Rule)
  // Asumsi: bappData memiliki nilai_bruto, dp_deduct, retensi_deduct dari BAPP yang dipilih
  const fin = hitungSAK({
    bruttoSd: bappData?.nilai_bruto || 0,
    nilaiKontrak: projectData?.contract_value || 0,
    nilaiDP: bappData?.potongan_dp || 0,
    pphRate: projectData?.pph_pct || 2,
    ppnRate: projectData?.ppn_pct || 11,
    retensiRate: projectData?.retention_pct || 5,
    kasbonDeduct: 0, // Kasbon tidak masuk ke invoice tagihan klien
    taxMode: projectData?.tax_mode || 'EXCLUDE'
  });

  // 2. LOGIKA PEMBULATAN PPN (Standar DJP: Floor ke Rupiah Penuh)
  const ppnRounded = Math.floor(fin.D_ppn);
  const totalTagihan = fin.C_dpp + ppnRounded;
  const netTransfer = totalTagihan - fin.F_pph42;

  const handlePrintAndSave = async () => {
    try {
      setLoading(true);

      // --- SIMPAN SNAPSHOT KE DATABASE ---
      const { error: dbError } = await supabase.from('termin_invoices').insert([{
        project_id: projectId,
        bapp_id: bappData?.id,
        invoice_number: form.invoiceNumber,
        invoice_date: form.invoiceDate,
        client_name: form.clientName,
        client_address: form.clientAddress,
        nilai_bruto: bappData?.nilai_bruto || 0,
        potongan_dp: bappData?.potongan_dp || 0,
        potongan_retensi: fin.R_retensi,
        nilai_dpp: fin.C_dpp,
        nilai_ppn: ppnRounded,
        nilai_pph: fin.F_pph42,
        total_tagihan: totalTagihan,
        net_transfer: netTransfer,
        status: form.status,
        signatures: signatures
      }]);

      if (dbError) throw new Error(dbError.message);

      // --- GENERATE PDF (PURE HTML/CSS) ---
      // WATERMARK LOGIC
      let watermarkHtml = '';
      if (form.status === 'DRAFT') watermarkHtml = '<div class="watermark">DRAFT</div>';
      if (form.status === 'PAID') watermarkHtml = '<div class="watermark" style="color: rgba(16, 185, 129, 0.1);">LUNAS</div>';

      const branding = resolveProjectBranding(projectData);
      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              /* MANDATORY PDF RULES */
              @page { size: A4 portrait; margin: 15mm 20mm; }
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9pt; color: #1e293b; margin: 0; padding: 0; }
              
              /* CONTAINER LOCK */
              .container { position: relative; min-height: 262mm; display: flex; flex-direction: column; }
              
              /* WATERMARK */
              .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 150px; font-weight: bold; color: rgba(0,0,0,0.06); z-index: -1; text-transform: uppercase; }
              
              /* KOP SURAT */
              .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2px solid #0f766e; }
              .header-table td { padding-bottom: 10px; vertical-align: bottom; }
              .company-name { font-size: 16pt; font-weight: bold; margin: 0; text-transform: uppercase; color: #0f172a; }
              .doc-title { font-size: 24pt; font-weight: bold; text-align: right; margin: 0; color: #0f766e; text-transform: uppercase; }
              
              /* INFO GRID (PURE TABLE) */
              .info-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
              .info-table td { vertical-align: top; padding: 0; }
              .info-box { border: 1px solid #cbd5e1; padding: 12px; background: #f8fafc; margin-right: 10px; }
              .info-box-right { margin-right: 0; margin-left: 10px; }
              .info-title { font-size: 8pt; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 5px; }
              .info-val { font-size: 10pt; font-weight: bold; color: #0f172a; margin: 0; }
              
              /* TABEL SUMMARY (PURE TABLE) */
              .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; }
              .summary-table th { background-color: #0f766e; color: white; padding: 10px; font-size: 8.5pt; text-transform: uppercase; border: 1px solid #0f766e; text-align: left; }
              .summary-table td { padding: 10px; border: 1px solid #cbd5e1; vertical-align: middle; }
              .text-right { text-align: right; } .text-center { text-align: center; }
              .font-mono { font-family: 'Courier New', Courier, monospace; font-weight: bold; }
              
              /* TOTAL BOX */
              .total-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              .total-table td { padding: 8px 10px; border-bottom: 1px solid #cbd5e1; }
              .total-label { font-weight: bold; color: #475569; text-align: right; width: 70%; }
              .total-val { font-weight: bold; font-family: 'Courier New', Courier, monospace; text-align: right; color: #0f172a; width: 30%; }
              .grand-total td { background-color: #f0fdfa; border-top: 2px double #0f766e; border-bottom: 2px double #0f766e; color: #064e3b; font-size: 11pt; }
              .net-cash td { background-color: #fffbeb; color: #b45309; font-size: 10pt; border-bottom: 1px solid #fcd34d; }
              
              /* TERBILANG */
              .terbilang-box { background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; font-style: italic; font-weight: bold; margin-bottom: 20px; }
              
              /* TANDA TANGAN (ABSOLUTE BOTTOM) */
              .sig-wrapper { margin-top: auto; padding-top: 24px; width: 100%; page-break-inside: avoid; break-inside: avoid; }
              .sig-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
              .sig-table td { text-align: center; vertical-align: bottom; padding: 0 10px; }
              .sig-space { height: 70px; }
              .sig-name { font-weight: bold; text-decoration: underline; font-size: 9.5pt; margin-bottom: 2px; }
              .sig-title { font-size: 8pt; color: #64748b; white-space: pre-wrap; }
            </style>
          </head>
          <body>
            ${watermarkHtml}
            
            <div class="container">
              <!-- KOP SURAT -->
              <table class="header-table">
                <tr>
                  <td style="width: 62%;">
                    <table style="border-collapse: collapse; width: 100%;">
                      <tr>
                        ${branding.logoUrl ? `<td style="width: 68px; padding-right: 12px; padding-bottom: 0; vertical-align: middle;"><img src="${escapePrintHtml(branding.logoUrl)}" style="max-height: 54px; max-width: 130px; object-fit: contain; display: block;" /></td>` : ''}
                        <td style="padding-bottom: 0; vertical-align: middle;">
                          <h2 class="company-name">${escapePrintHtml(branding.companyName)}</h2>
                          <p style="font-size: 8.5pt; color: #475569; margin: 3px 0 0 0; line-height: 1.35;">${escapePrintHtml(branding.companyAddress)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="width: 40%; text-align: right;">
                    <h1 class="doc-title">INVOICE PENAGIHAN</h1>
                    <p style="font-size: 9pt; margin: 5px 0 0 0; font-weight: bold;">No: ${form.invoiceNumber}</p>
                    <p style="font-size: 9pt; margin: 2px 0 0 0;">Tanggal: ${new Date(form.invoiceDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
                  </td>
                </tr>
              </table>

              <!-- INFO TAGIHAN -->
              <table class="info-table">
                <tr>
                  <td style="width: 50%;">
                    <div class="info-box">
                      <div class="info-title">Ditagihkan Kepada:</div>
                      <p class="info-val">${form.clientName}</p>
                      <p style="font-size: 8.5pt; margin: 2px 0 0 0; color: #475569;">${form.clientAddress}</p>
                    </div>
                  </td>
                  <td style="width: 50%;">
                    <div class="info-box info-box-right">
                      <div class="info-title">Informasi Proyek:</div>
                      <p class="info-val">${projectData?.project_name}</p>
                      <p style="font-size: 8.5pt; margin: 2px 0 0 0; color: #475569;">No. Kontrak: ${projectData?.contract_number || '-'}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- TABEL SUMMARY (Hanya DPP, PPN, PPh) -->
              <table class="summary-table">
                <thead>
                  <tr>
                    <th style="width: 60%;">Deskripsi Penagihan</th>
                    <th style="width: 40%; text-align: right;">Jumlah (IDR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Nilai Progres Bruto (BAPP Approved)</td>
                    <td class="text-right font-mono">Rp ${(bappData?.nilai_bruto || 0).toLocaleString('id-ID')}</td>
                  </tr>
                  <tr>
                    <td>(-) Potongan Uang Muka (DP)</td>
                    <td class="text-right font-mono" style="color: #dc2626;">- Rp ${(bappData?.potongan_dp || 0).toLocaleString('id-ID')}</td>
                  </tr>
                  <tr>
                    <td>(-) Potongan Retensi (${projectData?.retention_pct || 5}%)</td>
                    <td class="text-right font-mono" style="color: #dc2626;">- Rp ${fin.R_retensi.toLocaleString('id-ID')}</td>
                  </tr>
                  <tr style="background-color: #f8fafc;">
                    <td style="font-weight: bold;">DASAR PENGENAAN PAJAK (DPP)</td>
                    <td class="text-right font-mono" style="font-weight: bold;">Rp ${fin.C_dpp.toLocaleString('id-ID')}</td>
                  </tr>
                  <tr>
                    <td>(+) PPN ${projectData?.ppn_pct || 11}%</td>
                    <td class="text-right font-mono">Rp ${ppnRounded.toLocaleString('id-ID')}</td>
                  </tr>
                </tbody>
              </table>

              <!-- TOTAL TAGIHAN & INFO PPH -->
              <table class="total-table">
                <tr class="grand-total">
                  <td class="total-label">TOTAL TAGIHAN (DPP + PPN):</td>
                  <td class="total-val">Rp ${totalTagihan.toLocaleString('id-ID')}</td>
                </tr>
                <tr class="net-cash">
                  <td class="total-label">Informasi: PPh 4(2) Dipotong oleh Klien (${projectData?.pph_pct || 2}%)</td>
                  <td class="total-val" style="color: #dc2626;">- Rp ${fin.F_pph42.toLocaleString('id-ID')}</td>
                </tr>
                <tr class="net-cash">
                  <td class="total-label" style="color: #b45309;">ESTIMASI NILAI BERSIH DITERIMA (NETTO):</td>
                  <td class="total-val" style="color: #b45309;">Rp ${netTransfer.toLocaleString('id-ID')}</td>
                </tr>
              </table>

              <!-- TERBILANG -->
              <div class="terbilang-box">
                Terbilang: <span style="color: #0f766e;">${terbilang(totalTagihan)} Rupiah</span>
              </div>

              <!-- TANDA TANGAN PROFESIONAL (ANTI-OVERLAP) -->
              <div class="sig-wrapper">
                ${buildEnterpriseSignatureHtml(
                  signatures.map((sig: any) => ({ title: sig.title, name: sig.name })),
                  { spaceHeightPx: 64, marginTopPx: 10 }
                )}
              </div>

            </div>
          </body>
        </html>
      `;

      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: fullHtml, format: 'A4', isLandscape: false })
      });

      if (!res.ok) throw new Error('Gagal generate PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_${form.invoiceNumber.replace(/\//g, '_')}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      showToast('Invoice berhasil disimpan dan diunduh', 'success');

    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* WEB UI (TAILWIND BOLEH DI SINI) */}
      <div className="bg-white p-6 rounded-xl border shadow-sm print:hidden">
        <div className="flex justify-between items-center border-b pb-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Penerbitan Invoice Termin</h2>
            <p className="text-sm text-slate-500">Snapshot data keuangan dan cetak dokumen legal.</p>
          </div>
          <button onClick={() => setShowSigSettings(!showSigSettings)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold text-slate-700">
            <Settings size={16} /> Atur Tanda Tangan
          </button>
        </div>

        {showSigSettings && (
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <SignatureSettings signatures={signatures} onChange={setSignatures} colorTheme="teal" />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">No. Invoice</label>
            <input type="text" value={form.invoiceNumber} onChange={e => setForm({...form, invoiceNumber: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Tanggal</label>
            <input type="date" value={form.invoiceDate} onChange={e => setForm({...form, invoiceDate: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Status Dokumen</label>
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value as any})} className="w-full border rounded-lg p-2 text-sm">
              <option value="DRAFT">DRAFT (Watermark)</option>
              <option value="SENT">SENT (Bersih)</option>
              <option value="PAID">PAID / LUNAS (Watermark)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={handlePrintAndSave} disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Printer size={18} />} Cetak & Simpan Invoice
            </button>
          </div>
        </div>

        <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm border border-blue-200">
          <p><strong>Kalkulasi Otomatis:</strong></p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>DPP: Rp {fin.C_dpp.toLocaleString('id-ID')}</li>
            <li>PPN (Floor): Rp {ppnRounded.toLocaleString('id-ID')}</li>
            <li>PPh 4(2) (Info): Rp {fin.F_pph42.toLocaleString('id-ID')}</li>
            <li>Total Tagihan: <strong>Rp {totalTagihan.toLocaleString('id-ID')}</strong></li>
          </ul>
        </div>
      </div>
    </div>
  );
}