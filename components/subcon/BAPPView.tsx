'use client';

import { useState, useEffect } from 'react';
import { Printer, FileText, Loader2, Settings, Trash2, AlertTriangle } from 'lucide-react';
import { getBAPPData, saveBAPPDocument, getBAPPHistory, deleteBAPPDocument } from '@/lib/services/subcon.service';
import { hitungSAK } from '@/lib/utils/sak-calculator';
import { BAPPData, SignatureItem } from '@/lib/types/subcon';
import { MoneyText } from '@/components/ui/MoneyText';
import { SignatureSettings } from '@/components/shared/SignatureSettings'; // FIXED: Typo 'iimport'

interface BAPPViewProps {
  projectId: string;
  spks: any[];
  showToast: (msg: string, type: 'success' | 'error') => void;
  onSuccess: () => void;
}

export function BAPPView({ projectId, spks, showToast, onSuccess }: BAPPViewProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<BAPPData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reprintSnapshot, setReprintSnapshot] = useState<any>(null);
  const [isReprint, setIsReprint] = useState(false);

  const currentMonthRoman = new Date().toLocaleString('id-ID', { month: 'long' });
  
  const [form, setForm] = useState({
    contractId: '',
    nomorBAPP: `001/KL-BAPP/BKP/${currentMonthRoman.toUpperCase()}/${new Date().getFullYear()}`,
    tglMulai: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    tglSelesai: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
    potonganKasbon: 0,
  });

  const [showSigSettings, setShowSigSettings] = useState(false);

  // FIXED: Hapus deklarasi ganda, sisakan satu state yang benar
  const [signatures, setSignatures] = useState<SignatureItem[]>([
    { title: 'Direksi', name: 'RIZQI BILLAH BASALAMAH' },
    { title: 'KA. Divisi Infra', name: 'MEI SUNARKO' },
    { title: 'Ass. Divisi Infra', name: 'ARIF DARMAWAN' },
    { title: 'Ka. Pembelian', name: 'M. MAULIDIN' },
    { title: 'Site Engineer', name: 'SAIFUDDIN FAMI' },
    { title: 'Mandor / Direktur', name: 'HAERUL' },
  ]);

  const loadHistory = async () => {
    try {
      const res = await getBAPPHistory(projectId);
      setHistory(res);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [projectId]);

  const fetchData = async (contractId: string, startDate: string, endDate: string, reprint: boolean) => {
    if (!contractId) return showToast('Silakan pilih Mandor / SPK terlebih dahulu', 'error');
    
    setIsReprint(reprint);
    setLoading(true);
    setData(null); 
    try {
      const res = await getBAPPData(contractId, startDate, endDate);
      setData(res);
      
      if (res.contract.subcontractors?.contact_person) {
        setSignatures(prev => {
          const newSigs = [...prev];
          newSigs[5].name = res.contract.subcontractors.contact_person.toUpperCase();
          return newSigs;
        });
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(form.contractId, form.tglMulai, form.tglSelesai, false);
  };

  const handleReprint = (item: any) => {
    setForm({
      ...form,
      contractId: item.contract_id,
      nomorBAPP: item.bapp_number,
      tglMulai: item.period_start,
      tglSelesai: item.period_end,
      potonganKasbon: 0,
    });
    
    setReprintSnapshot(item);
    if (item.signatures) setSignatures(item.signatures);
    fetchData(item.contract_id, item.period_start, item.period_end, true);
  };

  const handlePrint = async () => {
    const printElement = document.getElementById('bapp-print-area');
    if (!printElement || !data || !sakResult) return;

    try {
      setSaving(true);
      
      if (!isReprint) {
        await saveBAPPDocument({
          project_id: projectId,
          contract_id: form.contractId,
          bapp_number: form.nomorBAPP,
          period_start: form.tglMulai,
          period_end: form.tglSelesai,
          total_value: sakResult.Net_transfer,
          tax_mode: data.contract.tax_mode || 'EXCLUDE',
          nilai_dpp: sakResult.C_dpp,
          nilai_ppn: sakResult.D_ppn,
          nilai_pph: sakResult.F_pph42,
          signatures: signatures // FIXED: Tambahkan koma
        });
        loadHistory();
        onSuccess();
      }

      const htmlContent = printElement.innerHTML;
      
      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { size: A4 landscape; margin: 8mm 12mm; }
              body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; font-family: 'Arial', sans-serif; font-size: 8pt; color: #000; }
              
              .doc-container { width: 100%; display: flex; flex-direction: column; }
              
              .header-title { text-align: center; font-size: 11pt; font-weight: bold; color: #0f766e; text-decoration: underline; margin-bottom: 2px; margin-top: 0; }
              .header-subtitle { text-align: center; font-size: 8pt; font-weight: bold; margin-bottom: 10px; }
              
              .section-title { font-weight: bold; color: #0f766e; margin-bottom: 3px; margin-top: 8px; font-size: 8pt; }
              
              .table-layout { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
              .table-layout td { vertical-align: top; }
              
              .data-table { width: 100%; border-collapse: collapse; }
              .data-table td { padding: 1px 0; vertical-align: top; font-size: 7.5pt; }
              
              .list-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 7.5pt; }
              .list-table td { padding: 3px 4px; border-bottom: 1px solid #e2e8f0; }
              
              .bill-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 7.5pt; border: 1px solid #64748b; }
              .bill-table th { background-color: #f1f5f9; border: 1px solid #64748b; padding: 4px; text-align: center; font-weight: bold; }
              .bill-table td { border: 1px solid #64748b; padding: 4px; vertical-align: middle; }
              
              .bg-yellow { background-color: #fef08a !important; }
              .bg-green { background-color: #dcfce7 !important; }
              .bg-gray { background-color: #f1f5f9 !important; }
              
              .text-right { text-align: right; } .text-center { text-align: center; } .font-bold { font-weight: bold; }
              
              .sig-table { width: 100%; border-collapse: collapse; text-align: center; margin-top: 15px; page-break-inside: avoid; }
              .sig-table td { width: 16.6%; vertical-align: bottom; padding: 0 5px; }
              .sig-space { height: 40px; }
              .sig-name { font-weight: bold; text-decoration: underline; margin-bottom: 2px; font-size: 8pt; }
              .sig-title { font-size: 7pt; color: #475569; }
            </style>
          </head>
          <body>
            ${htmlContent}
          </body>
        </html>
      `;

      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: fullHtml, format: 'A4', isLandscape: true })
      });
      
      if (!res.ok) throw new Error('Gagal generate PDF dari server');
      const blob = await res.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BAPP_${form.nomorBAPP.replace(/\//g, '_')}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      showToast(isReprint ? 'PDF berhasil diunduh' : 'BAPP berhasil disimpan & diunduh', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteBAPPDocument(deleteTarget);
      showToast('Riwayat BAPP berhasil dihapus', 'success');
      loadHistory();
      setDeleteTarget(null);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const sakResult = data ? (
    isReprint && reprintSnapshot ? {
      A_bruto: data.totalOpnameSdIni, 
      B_potonganDP: data.nilaiDP,
      C_dpp: Number(reprintSnapshot.nilai_dpp || 0),
      D_ppn: Number(reprintSnapshot.nilai_ppn || 0),
      E_invoice: Number(reprintSnapshot.nilai_dpp || 0) + Number(reprintSnapshot.nilai_ppn || 0),
      F_pph42: Number(reprintSnapshot.nilai_pph || 0),
      G_invoiceBersih: (Number(reprintSnapshot.nilai_dpp || 0) + Number(reprintSnapshot.nilai_ppn || 0)) - Number(reprintSnapshot.nilai_pph || 0),
      R_retensi: 0,
      K_kasbon: form.potonganKasbon,
      Net_transfer: Number(reprintSnapshot.total_value || 0),
      persenProgres: data.contract.contract_value > 0 ? (data.totalOpnameSdIni / data.contract.contract_value) : 0,
      taxMode: reprintSnapshot.tax_mode || 'EXCLUDE',
      ppnPct: data.contract.ppn_pct || 11,
      pphPct: data.contract.pph_pct || 2,
      retPct: data.contract.retention_pct || 5
    } : hitungSAK({
      bruttoSd: data.totalOpnameSdIni,
      nilaiKontrak: data.contract.contract_value,
      nilaiDP: data.nilaiDP,
      pphRate: data.contract.pph_pct || 2,
      ppnRate: data.contract.ppn_pct || 11,
      retensiRate: data.contract.retention_pct || 5,
      kasbonDeduct: form.potonganKasbon,
      taxMode: data.contract.tax_mode || 'EXCLUDE'
    })
  ) : null;

  const formatRp = (val: number) => {
    if (!val) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val).replace('Rp', 'Rp ');
  };

  const webStyles = `
    .bapp-preview { width: 297mm; min-height: 210mm; padding: 8mm 12mm; background: #fff; box-sizing: border-box; font-family: 'Arial', sans-serif; font-size: 8pt; color: #000; box-shadow: 0 10px 25px rgba(0,0,0,0.1); position: relative; }
    .bapp-preview .header-title { text-align: center; font-size: 11pt; font-weight: bold; color: #0f766e; text-decoration: underline; margin-bottom: 2px; margin-top: 0; }
    .bapp-preview .header-subtitle { text-align: center; font-size: 8pt; font-weight: bold; margin-bottom: 10px; }
    .bapp-preview .section-title { font-weight: bold; color: #0f766e; margin-bottom: 3px; margin-top: 8px; font-size: 8pt; }
    .bapp-preview .table-layout { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
    .bapp-preview .table-layout td { vertical-align: top; }
    .bapp-preview .data-table { width: 100%; border-collapse: collapse; }
    .bapp-preview .data-table td { padding: 1px 0; vertical-align: top; font-size: 7.5pt; }
    .bapp-preview .list-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 7.5pt; }
    .bapp-preview .list-table td { padding: 3px 4px; border-bottom: 1px solid #e2e8f0; }
    .bapp-preview .bill-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 7.5pt; border: 1px solid #64748b; }
    .bapp-preview .bill-table th { background-color: #f1f5f9; border: 1px solid #64748b; padding: 4px; text-align: center; font-weight: bold; }
    .bapp-preview .bill-table td { border: 1px solid #64748b; padding: 4px; vertical-align: middle; }
    .bapp-preview .bg-yellow { background-color: #fef08a !important; }
    .bapp-preview .bg-green { background-color: #dcfce7 !important; }
    .bapp-preview .bg-gray { background-color: #f1f5f9 !important; }
    .bapp-preview .text-right { text-align: right; } .bapp-preview .text-center { text-align: center; } .bapp-preview .font-bold { font-weight: bold; }
    .bapp-preview .sig-table { width: 100%; border-collapse: collapse; text-align: center; margin-top: 15px; page-break-inside: avoid; }
    .bapp-preview .sig-table td { width: 16.6%; vertical-align: bottom; padding: 0 5px; }
    .bapp-preview .sig-space { height: 40px; }
    .bapp-preview .sig-name { font-weight: bold; text-decoration: underline; margin-bottom: 2px; font-size: 8pt; }
    .bapp-preview .sig-title { font-size: 7pt; color: #475569; }
  `;

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{__html: webStyles}} />

      {/* FORM INPUT FULL PAGE */}
      <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4 print:hidden">
        <div className="flex justify-between items-center border-b pb-2 mb-2">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <FileText className="text-teal-600" /> Form Berita Acara Pembayaran Prestasi (BAPP)
          </h3>
          <button onClick={() => setShowSigSettings(!showSigSettings)} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-md">
            <Settings size={16} /> Pengaturan Tanda Tangan
          </button>
        </div>
        
        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-bold mb-1 text-slate-700">Pilih Mandor / SPK</label>
            <select value={form.contractId} onChange={(e) => setForm({...form, contractId: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none">
              <option value="">-- Pilih Mandor --</option>
              {spks.map(s => <option key={s.id} value={s.id}>{s.subcontractor_name} - {s.spk_number}</option>)}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-bold mb-1 text-slate-700">Nomor BAPP</label>
            <input type="text" value={form.nomorBAPP} onChange={(e) => setForm({...form, nomorBAPP: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-slate-700">Dari Tanggal</label>
            <input type="date" value={form.tglMulai} onChange={(e) => setForm({...form, tglMulai: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-slate-700">Sampai Tanggal</label>
            <input type="date" value={form.tglSelesai} onChange={(e) => setForm({...form, tglSelesai: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-bold mb-1 text-slate-700">Mode Harga (Mengikuti SPK)</label>
            <div className="w-full border rounded-lg p-2 text-sm bg-slate-100 font-bold text-slate-700">
              {data ? data.contract.tax_mode : 'Pilih Mandor untuk melihat Mode Harga'}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold mb-1 text-slate-700">Potongan Kasbon Periode Ini - Rp</label>
            <input type="number" value={form.potonganKasbon} onChange={(e) => setForm({...form, potonganKasbon: Number(e.target.value)})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
            {data && form.potonganKasbon > (data.totalKasbon - data.totalPotongan) && (
              <p className="text-red-500 text-xs mt-1 font-bold">Warning: Melebihi Sisa Kasbon ({formatRp(data.totalKasbon - data.totalPotongan)})</p>
            )}
          </div>
          
          <div className="md:col-span-4 flex justify-end mt-2">
            <button type="submit" disabled={loading} className="px-6 bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors w-full md:w-auto">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />} Generate BAPP
            </button>
          </div>
        </form>

        {/* FIXED: Komponen SignatureSettings sekarang dipasang di sini */}
        {showSigSettings && (
          <SignatureSettings signatures={signatures} onChange={setSignatures} colorTheme="teal" />
        )}
      </div>

      {/* PREVIEW AREA (A4 LANDSCAPE) - Hanya dirender 1 kali */}
      {data && sakResult && (
        <div className="w-full flex flex-col items-center pb-10 overflow-x-auto bg-slate-200 p-6 rounded-xl print:hidden">
          <div id="bapp-print-area" className="bapp-preview">
            
            <div style={{ height: '100%', position: 'relative' }}>
              
              <div className="header-title">BERITA ACARA PEMBAYARAN PRESTASI (BAPP)</div>
              <div className="header-subtitle">NO. {form.nomorBAPP}</div>

              <table className="table-layout">
                <tbody>
                  <tr>
                    <td style={{ width: '50%', paddingRight: '15px' }}>
                      
                      <div className="section-title">DATA - DATA</div>
                      <table className="data-table">
                        <tbody>
                          <tr><td style={{ width: '80px' }}>Pekerjaan</td><td>: {data.contract.work_description}</td></tr>
                          <tr><td>Nama Proyek</td><td>: {data.contract.projects?.name}</td></tr>
                        </tbody>
                      </table>

                      <div className="section-title">KONTRAK</div>
                      <table className="data-table">
                        <tbody>
                          <tr><td style={{ width: '80px' }}>Tanggal</td><td>: {new Date(data.contract.created_at).toLocaleDateString('id-ID', {day:'2-digit', month:'long', year:'numeric'})}</td></tr>
                          <tr><td>Nilai</td><td>: {formatRp(data.contract.contract_value)}</td></tr>
                          <tr><td>Periode Kontrak</td><td>: -</td></tr>
                          <tr><td>No. Addendum</td><td>: -</td></tr>
                          <tr><td>Tanggal Addendum</td><td>: -</td></tr>
                        </tbody>
                      </table>

                      <div className="section-title">PIHAK I</div>
                      <table className="data-table">
                        <tbody>
                          <tr><td style={{ width: '80px' }}>Nama</td><td>: {data.contract.projects?.contractor_pic_name || '-'}</td></tr>
                          <tr><td>Jabatan</td><td>: {data.contract.projects?.contractor_pic_title || '-'}</td></tr>
                          <tr><td>Atas Nama</td><td>: {data.contract.projects?.company_name || '-'}</td></tr>
                        </tbody>
                      </table>

                      <div className="section-title">PIHAK II</div>
                      <table className="data-table">
                        <tbody>
                          <tr><td style={{ width: '80px' }}>Nama</td><td>: {data.contract.subcontractors?.contact_person || '-'}</td></tr>
                          <tr><td>Jabatan</td><td>: Mandor / Direktur</td></tr>
                          <tr><td>Atas Nama</td><td>: {data.contract.subcontractors?.company_name || '-'}</td></tr>
                          <tr><td>Alamat</td><td>: {data.contract.subcontractors?.address || '-'}</td></tr>
                        </tbody>
                      </table>

                      <div className="section-title">BAP</div>
                      <table className="data-table">
                        <tbody>
                          <tr><td style={{ width: '80px' }}>Tanggal</td><td>: {new Date(form.tglSelesai).toLocaleDateString('id-ID', {day:'2-digit', month:'long', year:'numeric'})}</td></tr>
                          <tr><td>Hari</td><td>: {new Date(form.tglSelesai).toLocaleDateString('id-ID', {weekday:'long'})}</td></tr>
                          <tr><td>No. BAOP</td><td>: {data.baop_number || '-'}</td></tr>
                          <tr><td>No. BAPP</td><td>: {form.nomorBAPP}</td></tr>
                          <tr><td>Periode</td><td>: {new Date(form.tglMulai).toLocaleDateString('id-ID')} s/d {new Date(form.tglSelesai).toLocaleDateString('id-ID')}</td></tr>
                        </tbody>
                      </table>

                    </td>
                    <td style={{ width: '50%' }}>
                      
                      <div className="section-title">RINCIAN PEMBAYARAN — REKONSILIASI BILLING (A → C)</div>
                      <table className="list-table">
                        <tbody>
                          <tr>
                            <td style={{ width: '70%' }}>1. Nilai Prestasi s/d Periode Lalu (Bruto)</td>
                            <td className="text-right">: {formatRp(data.totalOpnameSdIni - data.opnames.reduce((sum, o) => sum + Number(o.total), 0))}</td>
                          </tr>
                          <tr>
                            <td>2. Nilai Prestasi Periode Ini (Bruto)</td>
                            <td className="text-right">: {formatRp(data.opnames.reduce((sum, o) => sum + Number(o.total), 0))}</td>
                          </tr>
                          <tr>
                            <td>3. Total Prestasi s/d Saat Ini (Bruto) [A]</td>
                            <td className="text-right font-bold">: {formatRp(sakResult.A_bruto)}</td>
                          </tr>
                          <tr>
                            <td>4. (-) Potongan Pengembalian DP [B]</td>
                            <td className="text-right">: ({formatRp(sakResult.B_potonganDP)})</td>
                          </tr>
                          <tr className="bg-yellow">
                            <td className="font-bold">5. Dasar Pengenaan Pajak (DPP) [C = A - B]</td>
                            <td className="text-right font-bold">: {formatRp(sakResult.C_dpp)}</td>
                          </tr>
                          <tr>
                            <td>6. (+) Pajak Pertambahan Nilai (PPN {data.contract.ppn_pct || 11}%) [D]</td>
                            <td className="text-right">: {formatRp(sakResult.D_ppn)}</td>
                          </tr>
                          <tr className="bg-green">
                            <td className="font-bold">7. Total Nilai Invoice / Piutang [E = C + D]</td>
                            <td className="text-right font-bold">: {formatRp(sakResult.E_invoice)}</td>
                          </tr>
                          <tr>
                            <td>8. (-) Pajak Penghasilan PPh Pasal 4(2) [{data.contract.pph_pct || 2}%] [F]</td>
                            <td className="text-right">: ({formatRp(sakResult.F_pph42)})</td>
                          </tr>
                          <tr>
                            <td>9. (-) Retensi Proyek ({data.contract.retention_pct || 5}%) [R]</td>
                            <td className="text-right">: ({formatRp(sakResult.R_retensi)})</td>
                          </tr>
                          <tr>
                            <td>10. (-) Potongan Kasbon & Pembayaran Lainnya [K]</td>
                            <td className="text-right">: ({formatRp(sakResult.K_kasbon)})</td>
                          </tr>
                          <tr>
                            <td className="font-bold pt-2">TOTAL DIBAYARKAN (NETTO) PERIODE INI [E - F - R - K]</td>
                            <td className="text-right font-bold pt-2 text-teal-700">: {formatRp(sakResult.Net_transfer)}</td>
                          </tr>
                          <tr>
                            <td className="font-bold">Akumulasi Pembayaran (Netto) s/d Saat Ini</td>
                            <td className="text-right font-bold">: {formatRp(sakResult.Net_transfer)}</td>
                          </tr>
                        </tbody>
                      </table>

                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="section-title" style={{ textAlign: 'center', marginTop: '15px', borderTop: '2px solid #0f766e', paddingTop: '10px' }}>
                BILLING STATEMENT — RINGKASAN PERHITUNGAN PENAGIHAN TERMIN
              </div>
              
              <div style={{ textAlign: 'right', fontSize: '7.5pt', marginBottom: '5px' }}>
                MODE HARGA: <span className="font-bold">{data.contract.tax_mode}</span>
              </div>

              <table className="bill-table">
                <thead>
                  <tr>
                    <th style={{ width: '5%' }}>REF</th>
                    <th>KOMPONEN PERHITUNGAN</th>
                    <th style={{ width: '25%' }}>NILAI / RUMUS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-center font-bold">A</td>
                    <td>Nilai Progres Bruto (s/d periode ini)</td>
                    <td className="text-right">{formatRp(sakResult.A_bruto)}</td>
                  </tr>
                  <tr>
                    <td className="text-center font-bold">B</td>
                    <td>Potongan Pengembalian DP</td>
                    <td className="text-right">({formatRp(sakResult.B_potonganDP)})</td>
                  </tr>
                  <tr className="bg-yellow">
                    <td className="text-center font-bold">C</td>
                    <td>Dasar Pengenaan Pajak (DPP) (C = A - B)</td>
                    <td className="text-right">{formatRp(sakResult.C_dpp)}</td>
                  </tr>
                  <tr>
                    <td className="text-center font-bold">D</td>
                    <td>PPN {data.contract.ppn_pct || 11}% (D = C × {data.contract.ppn_pct || 11}%)</td>
                    <td className="text-right">{formatRp(sakResult.D_ppn)}</td>
                  </tr>
                  <tr className="bg-green">
                    <td className="text-center font-bold">E</td>
                    <td>Total Nilai Invoice / Piutang (E = C + D)</td>
                    <td className="text-right font-bold">{formatRp(sakResult.E_invoice)}</td>
                  </tr>
                  <tr>
                    <td className="text-center font-bold">F</td>
                    <td>Potongan PPh Pasal 4 ayat 2 (Jasa Konstruksi) (F = C × Tarif PPh)</td>
                    <td className="text-right">({formatRp(sakResult.F_pph42)})</td>
                  </tr>
                  <tr>
                    <td className="text-center font-bold">G</td>
                    <td>Sisa Kas yang Diterima (Net Transfer) (G = E - F)</td>
                    <td className="text-right font-bold">{formatRp(sakResult.G_invoiceBersih)}</td>
                  </tr>
                </tbody>
              </table>

              <table className="table-layout">
                <tbody>
                  <tr>
                    <td style={{ width: '50%', paddingRight: '10px' }}>
                      <div className="bill-table bg-gray" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px' }}>
                        <span className="font-bold">Nilai Kontrak:</span>
                        <span className="font-bold">{formatRp(data.contract.contract_value)}</span>
                      </div>
                    </td>
                    <td style={{ width: '50%' }}>
                      <div className="bill-table bg-gray" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px' }}>
                        <span className="font-bold">% Progress Opname:</span>
                        <span className="font-bold">{sakResult.persenProgres > 0 ? (sakResult.persenProgres * 100).toFixed(2) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ paddingRight: '10px' }}>
                      <div className="bill-table bg-yellow" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px' }}>
                        <span className="font-bold">Nilai DP Awal:</span>
                        <span className="font-bold">{formatRp(data.nilaiDP)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="bill-table bg-green" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px' }}>
                        <span className="font-bold">Retensi ({data.contract.retention_pct || 5}%):</span>
                        <span className="font-bold">{formatRp(sakResult.R_retensi)}</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '8pt', fontWeight: 'bold' }}>
                Di opname bersama | Tanggal : {new Date(form.tglSelesai).toLocaleDateString('id-ID', {day:'2-digit', month:'long', year:'numeric'})}
              </div>

              <div className="sig-table">
                <table className="sig-table">
                  <tbody>
                    <tr>
                      {signatures.map((sig, idx) => (
                        <td key={idx}>
                          <div className="sig-space"></div>
                          <div className="sig-name">{sig.name}</div>
                          <div className="sig-title">{sig.title}</div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>
          </div>
          
          <div className="mt-6 flex justify-end w-full max-w-[297mm] print:hidden">
             <button onClick={handlePrint} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 shadow-md transition-colors">
              {saving ? <Loader2 className="animate-spin" size={20} /> : <Printer size={20} />} {isReprint ? 'Cetak Ulang PDF' : 'Cetak & Simpan BAPP'}
             </button>
          </div>
        </div>
      )}

      {/* HISTORY TABLE */}
      <div className="bg-white border rounded-xl shadow-sm overflow-x-auto print:hidden mt-10">
        <div className="p-4 border-b bg-slate-50 font-bold text-slate-700">Riwayat Pembuatan BAPP</div>
        <table className="w-full text-left text-sm min-w-[800px]">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-4 border-b">No. BAPP</th>
              <th className="p-4 border-b">Tanggal Dibuat</th>
              <th className="p-4 border-b">Vendor / SPK</th>
              <th className="p-4 border-b">Periode</th>
              <th className="p-4 border-b">Nilai Netto</th>
              <th className="p-4 border-b text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {history.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className="p-4 border-b font-bold text-teal-700">{b.bapp_number}</td>
                <td className="p-4 border-b">{new Date(b.created_at).toLocaleDateString('id-ID')}</td>
                <td className="p-4 border-b">
                  <span className="font-bold">{b.subcontractor_contracts?.subcontractors?.company_name}</span>
                  <span className="block text-xs text-slate-500">{b.subcontractor_contracts?.spk_number}</span>
                </td>
                <td className="p-4 border-b">{new Date(b.period_start).toLocaleDateString('id-ID')} - {new Date(b.period_end).toLocaleDateString('id-ID')}</td>
                <td className="p-4 border-b font-bold"><MoneyText value={b.total_value} /></td>
                <td className="p-4 border-b text-right flex justify-end items-center gap-3">
                  <button onClick={() => handleReprint(b)} className="text-blue-600 hover:underline text-xs font-medium">
                    Lihat / Cetak Ulang
                  </button>
                  <button onClick={() => setDeleteTarget(b.id)} className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 hover:bg-red-100 rounded-md transition-colors" title="Hapus Riwayat">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {history.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Belum ada riwayat BAPP.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ENTERPRISE MODAL CONFIRMATION */}
      {!!deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus Riwayat BAPP</h3>
              <p className="text-sm text-slate-500">
                Apakah Anda yakin ingin menghapus data riwayat ini? Tindakan ini tidak dapat dibatalkan dan akan menghapus data secara permanen.
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-end border-t">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                Batal
              </button>
              <button onClick={handleDeleteConfirm} disabled={isDeleting} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm flex items-center gap-2 transition-colors">
                {isDeleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />} Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}