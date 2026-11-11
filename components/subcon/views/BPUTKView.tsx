'use client';

import { useState, useEffect } from 'react';
import { Printer, FileText, Loader2, Trash2, AlertTriangle, Save, AlertCircle, Settings, CheckCircle2, Pencil } from 'lucide-react';
import { getBPUTKData, saveBPUTKDocument, getBPUTKHistory, deleteBPUTKDocument, checkOverlappingOpnames, saveOpnameProgress } from '@/lib/services/subcon.service';
import { hitungSAK } from '@/lib/utils/sak-calculator';
import { BPUTKData, BPUTKItem, SignatureItem } from '@/lib/types/subcon';
import { MoneyText } from '@/components/ui/MoneyText';
import { SignatureSettings } from '@/components/shared/SignatureSettings';
import { supabase } from '@/lib/supabase';

interface BPUTKViewProps {
  projectId: string;
  spks: any[];
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function BPUTKView({ projectId, spks, showToast }: BPUTKViewProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<BPUTKData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  
  const [editableVolumes, setEditableVolumes] = useState<Record<string, number>>({});
  
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReprint, setIsReprint] = useState(false);
  const [reprintSnapshot, setReprintSnapshot] = useState<any>(null);
  const [showOverlapModal, setShowOverlapModal] = useState(false);
  
  const [editTarget, setEditTarget] = useState<any | null>(null);

  const [showSigSettings, setShowSigSettings] = useState(false);
  const [signatures, setSignatures] = useState<SignatureItem[]>([
    { title: 'Disetujui Oleh,\nDireksi', name: 'RIZQI BILLAH BASALAMAH' },
    { title: 'KA. DIVISI INFRA', name: 'MEI SUNARKO' },
    { title: 'Ass. KA. DIVISI INFRA', name: 'ARIF DARMAWAN' },
    { title: 'Ka. Pembelian', name: 'M. MAULIDIN' },
    { title: 'Pengendali', name: 'PENGENDALI' },
    { title: 'Site Engineer', name: 'SAIFUDDIN FAHMI' },
    { title: 'Dibuat Oleh,\nKepala Mandor', name: 'HAERUL' },
  ]);  

  const currentMonthRoman = new Date().toLocaleString('id-ID', { month: 'long' });
  
  const [form, setForm] = useState({
    contractId: '',
    nomorBPUTK: `001/KL-BPUTK/BKP/${currentMonthRoman.toUpperCase()}/${new Date().getFullYear()}`,
    tglMulai: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    tglSelesai: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
  });

  const loadHistory = async () => {
    try {
      const res = await getBPUTKHistory(projectId);
      setHistory(res);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [projectId]);

  const fetchData = async (contractId: string, startDate: string, endDate: string, reprint: boolean) => {
    if (!contractId) {
      showToast('Pilih Mandor / SPK terlebih dahulu', 'error');
      return;
    }

    setIsReprint(reprint);
    setLoading(true);
    setData(null);
    try {
      const res = await getBPUTKData(contractId, startDate, endDate);
      setData(res);
      
      const initialVols: Record<string, number> = {};
      res.items.forEach(item => {
        initialVols[item.id] = item.volSaatIni;
      });
      setEditableVolumes(initialVols);

      if (res.contract.subcontractors?.contact_person) {
        setSignatures(prev => {
          const newSigs = [...prev];
          newSigs[6].name = res.contract.subcontractors.contact_person.toUpperCase();
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
    setEditTarget(null);
    fetchData(form.contractId, form.tglMulai, form.tglSelesai, false);
  };

  const handleEdit = (item: any) => {
    if (item.is_billed) {
      return showToast('Tidak dapat mengedit BPUTK yang sudah ditagihkan ke BAPP.', 'error');
    }
    setEditTarget(item);
    setForm({
      contractId: item.contract_id,
      nomorBPUTK: item.bputk_number,
      tglMulai: item.period_start,
      tglSelesai: item.period_end,
    });
    fetchData(item.contract_id, item.period_start, item.period_end, false);
    showToast('Mode Edit Aktif. Silakan ubah volume dan simpan ulang.', 'success');
  };

  const handleReprint = (item: any) => {
    setEditTarget(null);
    setForm({
      contractId: item.contract_id,
      nomorBPUTK: item.bputk_number,
      tglMulai: item.period_start,
      tglSelesai: item.period_end,
    });

    setReprintSnapshot(item);
    if (item.signatures) setSignatures(item.signatures); 
    fetchData(item.contract_id, item.period_start, item.period_end, true);
  };

  const handleVolumeChange = (itemId: string, value: string) => {
    const numValue = value === '' ? 0 : Number(value);
    setEditableVolumes(prev => ({ ...prev, [itemId]: numValue }));
  };

  const getCalculatedData = () => {
    if (!data) return null;
    
    let totalNilaiSaatIni = 0;
    let totalNilaiSd = 0;
    let totalNilaiSisa = 0;

    const calculatedItems = data.items.map(item => {
      const volSaatIni = editableVolumes[item.id] || 0;
      const nilaiSaatIni = volSaatIni * item.hargaSatuan;
      
      const volSd = item.volLalu + volSaatIni;
      const nilaiSd = volSd * item.hargaSatuan;
      
      const volSisa = item.volKontrak - volSd;
      const nilaiSisa = volSisa * item.hargaSatuan;

      totalNilaiSaatIni += nilaiSaatIni;
      totalNilaiSd += nilaiSd;
      totalNilaiSisa += nilaiSisa;

      return {
        ...item, volSaatIni, nilaiSaatIni, volSd, nilaiSd, volSisa, nilaiSisa
      };
    });

    return {
      ...data,
      items: calculatedItems,
      totalNilaiSaatIni,
      totalNilaiSd,
      totalNilaiSisa
    };
  };

  const currentData = getCalculatedData();

  const getFinancials = () => {
    if (!currentData) return null;
    
    if (isReprint && reprintSnapshot) {
      const dpp = Number(reprintSnapshot.nilai_dpp || 0);
      const ppn = Number(reprintSnapshot.nilai_ppn || 0);
      const pph = Number(reprintSnapshot.nilai_pph || 0);
      return {
        A_bruto: currentData.totalNilaiSaatIni, B_potonganDP: 0, C_dpp: dpp, D_ppn: ppn, E_invoice: dpp + ppn, F_pph42: pph, G_invoiceBersih: (dpp + ppn) - pph, R_retensi: 0, K_kasbon: currentData.totalPotongan, Net_transfer: Number(reprintSnapshot.total_value || 0), persenProgres: 0, taxMode: reprintSnapshot.tax_mode as any, ppnPct: currentData.contract.ppn_pct || 11, pphPct: currentData.contract.pph_pct || 2, retPct: currentData.contract.retention_pct || 5
      };
    }

    return hitungSAK({
      bruttoSd: currentData.totalNilaiSaatIni, nilaiKontrak: currentData.contract.contract_value, nilaiDP: 0, pphRate: currentData.contract.pph_pct || 2, ppnRate: currentData.contract.ppn_pct || 11, retensiRate: currentData.contract.retention_pct || 5, kasbonDeduct: currentData.totalPotongan, taxMode: currentData.contract.tax_mode || 'EXCLUDE'
    });
  };

  const fin = getFinancials();

  const handleSaveProgress = async () => {
    if (!data || !currentData || isReprint) return;
    setSaving(true);
    try {
      const isOverlap = await checkOverlappingOpnames(form.contractId, form.tglMulai, form.tglSelesai);
      if (isOverlap) {
        setShowOverlapModal(true);
        setSaving(false);
        return;
      }
      await processSave();
    } catch (error: any) {
      showToast(error.message, 'error');
      setSaving(false);
    }
  };

  const processSave = async () => {
    setSaving(true);
    setShowOverlapModal(false);
    try {
      const itemsToSave = currentData!.items.map(i => ({
        item_id: i.id, volume: i.volSaatIni, price: i.hargaSatuan
      }));
      await saveOpnameProgress(form.contractId, form.tglSelesai, itemsToSave);
      showToast('Progress fisik berhasil disimpan', 'success');
      fetchData(form.contractId, form.tglMulai, form.tglSelesai, isReprint);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    const printElement = document.getElementById('bputk-print-area');
    if (!printElement || !currentData || !fin) return;

    try {
      setLoading(true);
      if (!isReprint) {
        if (editTarget) {
          await supabase.from('bputk_documents').update({
            bputk_number: form.nomorBPUTK, period_start: form.tglMulai, period_end: form.tglSelesai, total_value: fin.Net_transfer, tax_mode: fin.taxMode, nilai_dpp: fin.C_dpp, nilai_ppn: fin.D_ppn, nilai_pph: fin.F_pph42, signatures: signatures
          }).eq('id', editTarget.id);
          showToast('BPUTK berhasil diperbarui', 'success');
          setEditTarget(null);
        } else {
          await saveBPUTKDocument({
            project_id: projectId, contract_id: form.contractId, bputk_number: form.nomorBPUTK, period_start: form.tglMulai, period_end: form.tglSelesai, total_value: fin.Net_transfer, tax_mode: fin.taxMode, nilai_dpp: fin.C_dpp, nilai_ppn: fin.D_ppn, nilai_pph: fin.F_pph42, signatures: signatures
          });
        }
        loadHistory();
      }

      const htmlContent = printElement.innerHTML;
      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { size: A3 landscape; margin: 10mm 15mm; }
              body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; font-family: 'Arial', sans-serif; font-size: 9pt; color: #000; }
              .header-title { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
              .table-bputk { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 8pt; table-layout: fixed; box-sizing: border-box; }
              .table-bputk th, .table-bputk td { border: 1px solid #64748b; padding: 4px 5px; vertical-align: middle; box-sizing: border-box; }
              .table-bputk th { background-color: #f1f5f9; font-weight: bold; text-align: center; }
              .bg-yellow { background-color: #fef08a !important; }
              .bg-gray { background-color: #e2e8f0 !important; }
              .bg-green { background-color: #dcfce7 !important; }
              .text-right { text-align: right; } .text-center { text-align: center; } .font-bold { font-weight: bold; }
              .text-red { color: #dc2626; } .text-blue { color: #2563eb; } .text-yellow { color: #ca8a04; } .text-green { color: #16a34a; }
              .sak-box { border: 1px dashed #ca8a04; background-color: #fefce8; padding: 8px 10px; margin-bottom: 10px; font-size: 8pt; border-radius: 4px; }
              .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 8.5pt; box-sizing: border-box; }
              .summary-table td { border: 1px solid #94a3b8; padding: 6px 10px; box-sizing: border-box; }
              .summary-label { text-align: right; font-weight: bold; width: 75%; }
              .summary-val { text-align: right; font-weight: bold; width: 25%; white-space: nowrap; }
              .mutasi-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; box-sizing: border-box; }
              .mutasi-table td { width: 50%; padding: 0; vertical-align: top; box-sizing: border-box; }
              .mutasi-box { border: 1px solid #16a34a; border-radius: 6px; overflow: hidden; margin: 0 5px; }
              .mutasi-header { background-color: #dcfce7; color: #166534; padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #16a34a; font-size: 9pt; }
              .mutasi-body { padding: 12px; }
              .mutasi-title { font-weight: bold; margin-bottom: 5px; font-size: 9pt; color: #334155; }
              .mutasi-value { font-size: 16pt; font-weight: bold; }
              .sig-table { width: 100%; border-collapse: collapse; text-align: center; margin-top: 30px; page-break-inside: avoid; box-sizing: border-box; }
              .sig-table td { width: 14.28%; vertical-align: bottom; padding: 0 5px; box-sizing: border-box; }
              .sig-space { height: 70px; }
              .sig-name { font-weight: bold; text-decoration: underline; margin-bottom: 2px; font-size: 9pt; }
              .sig-title { font-size: 8.5pt; white-space: pre-wrap; }
              
              .ui-only { display: none !important; }
              .print-only { display: block !important; font-weight: bold; text-align: right; }
            </style>
          </head>
          <body>${htmlContent}</body>
        </html>
      `;

      const res = await fetch('/api/generate-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: fullHtml, format: 'A3', isLandscape: true })
      });

      if (!res.ok) throw new Error('Gagal generate PDF dari server');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BPUTK_${form.nomorBPUTK.replace(/\//g, '_')}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);

      showToast(isReprint ? 'PDF berhasil diunduh' : 'BPUTK berhasil disimpan & diunduh', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteBPUTKDocument(deleteTarget);
      showToast('Riwayat BPUTK berhasil dihapus permanen', 'success');
      loadHistory();
      setDeleteTarget(null);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const webStyles = `
    .bputk-preview { width: 420mm; min-height: 297mm; padding: 10mm 15mm; background: #fff; box-sizing: border-box; font-family: 'Arial', sans-serif; font-size: 9pt; color: #000; box-shadow: 0 10px 25px rgba(0,0,0,0.1); overflow-x: auto; }
    .bputk-preview .header-title { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
    .bputk-preview .table-bputk { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 8pt; table-layout: fixed; box-sizing: border-box; }
    .bputk-preview .table-bputk th, .bputk-preview .table-bputk td { border: 1px solid #64748b; padding: 4px 5px; vertical-align: middle; box-sizing: border-box; }
    .bputk-preview .table-bputk th { background-color: #f1f5f9; font-weight: bold; text-align: center; }
    .bputk-preview .bg-yellow { background-color: #fef08a !important; }
    .bputk-preview .bg-gray { background-color: #e2e8f0 !important; }
    .bputk-preview .bg-green { background-color: #dcfce7 !important; }
    .bputk-preview .text-right { text-align: right; } .bputk-preview .text-center { text-align: center; } .bputk-preview .font-bold { font-weight: bold; }
    .bputk-preview .text-red { color: #dc2626; } .bputk-preview .text-blue { color: #2563eb; } .bputk-preview .text-yellow { color: #ca8a04; } .bputk-preview .text-green { color: #16a34a; }
    .bputk-preview .sak-box { border: 1px dashed #ca8a04; background-color: #fefce8; padding: 8px 10px; margin-bottom: 10px; font-size: 8pt; border-radius: 4px; }
    .bputk-preview .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 8.5pt; box-sizing: border-box; }
    .bputk-preview .summary-table td { border: 1px solid #94a3b8; padding: 6px 10px; box-sizing: border-box; }
    .bputk-preview .summary-label { text-align: right; font-weight: bold; width: 75%; }
    .bputk-preview .summary-val { text-align: right; font-weight: bold; width: 25%; white-space: nowrap; }
    .bputk-preview .mutasi-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; box-sizing: border-box; }
    .bputk-preview .mutasi-table td { width: 50%; padding: 0; vertical-align: top; box-sizing: border-box; }
    .bputk-preview .mutasi-box { border: 1px solid #16a34a; border-radius: 6px; overflow: hidden; margin: 0 5px; }
    .bputk-preview .mutasi-header { background-color: #dcfce7; color: #166534; padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #16a34a; font-size: 9pt; }
    .bputk-preview .mutasi-body { padding: 12px; }
    .bputk-preview .mutasi-title { font-weight: bold; margin-bottom: 5px; font-size: 9pt; color: #334155; }
    .bputk-preview .mutasi-value { font-size: 16pt; font-weight: bold; }
    .bputk-preview .sig-table { width: 100%; border-collapse: collapse; text-align: center; margin-top: 30px; page-break-inside: avoid; box-sizing: border-box; }
    .bputk-preview .sig-table td { width: 14.28%; vertical-align: bottom; padding: 0 5px; box-sizing: border-box; }
    .bputk-preview .sig-space { height: 70px; }
    .bputk-preview .sig-name { font-weight: bold; text-decoration: underline; margin-bottom: 2px; font-size: 9pt; }
    .bputk-preview .sig-title { font-size: 8.5pt; white-space: pre-wrap; }
    
    .input-inline { width: 100%; text-align: right; background-color: #fef08a; border: 1px solid #ca8a04; border-radius: 3px; padding: 2px 4px; font-size: 8pt; font-weight: bold; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
    .input-inline:focus { border-color: #16a34a; box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.2); }
    .input-error { border-color: #dc2626 !important; background-color: #fee2e2 !important; color: #dc2626; }
    
    .ui-only { display: block; }
    .print-only { display: none; }
  `;

  return (
    <div className="space-y-6 relative">
      <style dangerouslySetInnerHTML={{ __html: webStyles }} />

      {/* FORM FILTER */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 print:hidden">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <FileText className="text-emerald-600" /> {editTarget ? 'Edit Progress BPUTK' : 'Input Progress & Cetak BPUTK'}
          </h3>
          <button onClick={() => setShowSigSettings(!showSigSettings)} className="text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors border border-slate-200">
            <Settings size={16} /> Pengaturan TTD
          </button>
        </div>
        
        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm mb-5 border border-blue-200 flex items-start gap-3 shadow-sm">
          <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
          <p className="font-medium"><strong>Informasi:</strong> Silakan edit kolom <b>Periode Saat Ini (Warna Kuning)</b> di tabel bawah, lalu klik <b>Simpan Progress</b>. Volume yang diinput akan dicatat sebagai progress per tanggal <b>{new Date(form.tglSelesai).toLocaleDateString('id-ID')}</b>.</p>
        </div>

        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Pilih Mandor</label>
            <select value={form.contractId} onChange={(e) => setForm({ ...form, contractId: e.target.value })} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium">
              <option value="">-- Pilih Mandor --</option>
              {spks.map(s => <option key={s.id} value={s.id}>{s.subcontractor_name} - {s.spk_number}</option>)}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nomor BPUTK</label>
            <input type="text" value={form.nomorBPUTK} onChange={(e) => setForm({ ...form, nomorBPUTK: e.target.value })} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-mono" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Dari Tanggal</label>
            <input type="date" value={form.tglMulai} onChange={(e) => setForm({ ...form, tglMulai: e.target.value })} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Sampai Tanggal</label>
            <input type="date" value={form.tglSelesai} onChange={(e) => setForm({ ...form, tglSelesai: e.target.value })} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={loading} className="w-full px-4 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-all shadow-md shadow-emerald-500/20">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />} Tampilkan
            </button>
          </div>
        </form>

        {showSigSettings && (
          <SignatureSettings signatures={signatures} onChange={setSignatures} colorTheme="emerald" />
        )}
      </div>

      {/* PREVIEW AREA */}
      {currentData && fin && (
        <div className="w-full flex flex-col items-center pb-10 overflow-x-auto bg-slate-200 p-6 rounded-2xl print:bg-white print:p-0">
          
          <div className="w-full max-w-[420mm] flex justify-between items-center mb-4 print:hidden">
            <div className="text-sm font-bold text-slate-600 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
              Total Netto Periode Ini: <span className="text-emerald-700 text-lg ml-1 tabular-nums"><MoneyText value={fin.Net_transfer} /></span>
            </div>
            <div className="flex gap-3">
              {!isReprint && (
                <button onClick={handleSaveProgress} disabled={saving || loading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md transition-all">
                  {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Simpan Progress
                </button>
              )}
              <button onClick={handlePrint} disabled={loading || saving} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md transition-all">
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Printer size={20} />} {editTarget ? 'Update & Cetak BPUTK' : (isReprint ? 'Cetak Ulang PDF' : 'Cetak & Simpan BPUTK')}
              </button>
            </div>
          </div>

          <div id="bputk-print-area" className="bputk-preview">
            <div className="header-title">BIAYA PEMBAYARAN UPAH TENAGA KERJA</div>
            <table style={{ width: '60%', marginBottom: '15px', fontSize: '9pt' }}>
              <tbody>
                <tr><td style={{ width: '150px', fontWeight: 'bold' }}>Mandor / Pelaksana</td><td style={{ width: '10px' }}>:</td><td>{currentData.contract.subcontractors?.company_name}</td></tr>
                <tr><td style={{ fontWeight: 'bold' }}>Nomor SPK</td><td>:</td><td>{currentData.contract.spk_number}</td></tr>
                <tr><td style={{ fontWeight: 'bold' }}>Periode Opname</td><td>:</td><td>{new Date(form.tglMulai).toLocaleDateString('id-ID')} s/d {new Date(form.tglSelesai).toLocaleDateString('id-ID')}</td></tr>
              </tbody>
            </table>
            
            <table className="table-bputk">
               <thead>
                <tr>
                  <th rowSpan={2} style={{ width: '3%' }}>No</th>
                  <th rowSpan={2} style={{ width: '16%' }}>Uraian Kegiatan</th>
                  <th rowSpan={2} className="bg-gray" style={{ width: '4%' }}>Sat</th>
                  <th colSpan={4} className="bg-gray">HARGA KONTRAK</th>
                  <th colSpan={2} className="bg-gray">Periode s/d Lalu</th>
                  <th colSpan={2} className="bg-yellow">Periode Saat Ini</th>
                  <th colSpan={2} className="bg-gray">S/D Saat Ini</th>
                  <th colSpan={2} className="bg-gray">Sisa Progress Setelah Ini</th>
                </tr>
                <tr>
                  <th className="bg-gray" style={{ width: '5%' }}>Vol</th>
                  <th className="bg-gray" style={{ width: '7%' }}>Harga Satuan (Rp)</th>
                  <th className="bg-gray" style={{ width: '9%' }}>Jumlah Kontrak (Rp)</th>
                  <th className="bg-gray" style={{ width: '5%' }}>Bobot (%)</th>
                  <th className="bg-gray" style={{ width: '5%' }}>Vol</th>
                  <th className="bg-gray" style={{ width: '7%' }}>Nilai (Rp)</th>
                  <th className="bg-yellow" style={{ width: '6%' }}>Vol</th>
                  <th className="bg-yellow" style={{ width: '8%' }}>Nilai (Rp)</th>
                  <th className="bg-gray" style={{ width: '5%' }}>Vol</th>
                  <th className="bg-gray" style={{ width: '7%' }}>Nilai (Rp)</th>
                  <th className="bg-gray" style={{ width: '5%' }}>Vol</th>
                  <th className="bg-gray" style={{ width: '6%' }}>Nilai (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {currentData.items.map((item, idx) => {
                  const isOver = item.volSaatIni > item.volSisa;
                  return (
                    <tr key={idx}>
                      <td className="text-center">{idx + 1}</td>
                      <td>{item.description}</td>
                      <td className="text-center">{item.unit}</td>
                      <td className="text-right">{item.volKontrak.toLocaleString('id-ID')}</td>
                      <td className="text-right">{item.hargaSatuan.toLocaleString('id-ID')}</td>
                      <td className="text-right">{item.jumlahKontrak.toLocaleString('id-ID')}</td>
                      <td className="text-center">{item.bobot.toFixed(2)}%</td>
                      <td className="text-right">{item.volLalu.toLocaleString('id-ID')}</td>
                      <td className="text-right">{item.nilaiLalu.toLocaleString('id-ID')}</td>
                      
                      <td className="text-center bg-yellow p-1">
                        <div className="ui-only">
                          {isReprint ? (
                             <span className="font-bold text-slate-800">{item.volSaatIni.toLocaleString('id-ID')}</span>
                          ) : (
                             <>
                               <input 
                                 type="number" 
                                 className={`input-inline ${isOver ? 'input-error' : ''}`}
                                 value={editableVolumes[item.id] === 0 ? '' : editableVolumes[item.id]}
                                 onChange={(e) => handleVolumeChange(item.id, e.target.value)}
                                 placeholder="0"
                               />
                               {isOver && <div className="text-[7px] text-red-600 font-bold mt-1">⚠️ Melebihi Sisa ({item.volSisa})</div>}
                             </>
                          )}
                        </div>
                        <span className="print-only">{item.volSaatIni.toLocaleString('id-ID')}</span>
                      </td>
                      
                      <td className="text-right bg-yellow font-bold">{item.nilaiSaatIni.toLocaleString('id-ID')}</td>
                      <td className="text-right">{item.volSd.toLocaleString('id-ID')}</td>
                      <td className="text-right">{item.nilaiSd.toLocaleString('id-ID')}</td>
                      <td className="text-right">{item.volSisa.toLocaleString('id-ID')}</td>
                      <td className="text-right">{item.nilaiSisa.toLocaleString('id-ID')}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray font-bold">
                  <td colSpan={5} className="text-right">SUB TOTAL PEMBAYARAN MANDOR :</td>
                  <td className="text-right">{currentData.totalKontrak.toLocaleString('id-ID')}</td>
                  <td className="text-center">{currentData.totalBobot.toFixed(2)}%</td>
                  <td></td>
                  <td className="text-right">{currentData.totalNilaiLalu.toLocaleString('id-ID')}</td>
                  <td className="bg-yellow"></td>
                  <td className="text-right bg-yellow">{currentData.totalNilaiSaatIni.toLocaleString('id-ID')}</td>
                  <td></td>
                  <td className="text-right">{currentData.totalNilaiSd.toLocaleString('id-ID')}</td>
                  <td></td>
                  <td className="text-right">{currentData.totalNilaiSisa.toLocaleString('id-ID')}</td>
                </tr>
              </tfoot>
            </table>

            <div className="sak-box">
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                📐 RUMUS SAK/KUP: <span style={{ background: '#fff', padding: '1px 6px', border: '1px solid #e2e8f0', borderRadius: '3px' }}>Net = A − F + D − R − K</span> | 
                <span style={{ marginLeft: '15px' }}>Retensi = DPP × {fin.retPct}%</span> | 
                <span style={{ marginLeft: '15px' }}>PPh 4(2) = DPP × {fin.pphPct}%</span>
              </div>
              <div style={{ fontSize: '7.5pt', color: '#854d0e', fontStyle: 'italic' }}>
                Dasar: SAK ETAP Bab 23 • UU PPh Pasal 4(2) — PP No. 9/2022 • UU PPN No. 7/2021
              </div>
            </div>

            <table className="summary-table">
               <tbody>
                <tr className="bg-gray">
                  <td className="summary-label">NILAI BERSIH DIBAYARKAN (NETTO) PERIODE LALU :</td>
                  <td className="summary-val">Rp 0</td>
                </tr>
                <tr className="bg-yellow">
                  <td className="summary-label">SUBTOTAL TAGIHAN BRUTTO PERIODE INI [A] :</td>
                  <td className="summary-val">Rp {fin.A_bruto.toLocaleString('id-ID')}</td>
                </tr>
                <tr className="text-red">
                  <td className="summary-label">(−) POTONGAN PPH PASAL 4(2) [F = DPP × {fin.pphPct}%] :</td>
                  <td className="summary-val">− Rp {fin.F_pph42.toLocaleString('id-ID')}</td>
                </tr>
                <tr className="text-blue">
                  <td className="summary-label">(+) PAJAK PPN {fin.ppnPct}% [D = DPP × {fin.ppnPct}%] :</td>
                  <td className="summary-val">Rp {fin.D_ppn.toLocaleString('id-ID')}</td>
                </tr>
                <tr className="text-yellow">
                  <td className="summary-label">(−) RETENSI PROYEK ({fin.retPct}%) [R = DPP × {fin.retPct}%] :</td>
                  <td className="summary-val">− Rp {fin.R_retensi.toLocaleString('id-ID')}</td>
                </tr>
                <tr className="text-yellow">
                  <td className="summary-label">(−) PENGEMBALIAN KASBON / ALAT [K] :</td>
                  <td className="summary-val">− Rp {fin.K_kasbon.toLocaleString('id-ID')}</td>
                </tr>
                <tr className="bg-green text-green" style={{ fontSize: '9.5pt' }}>
                  <td className="summary-label">NILAI BERSIH DIBAYARKAN (NETTO) PERIODE INI [A − F + D − R − K] :</td>
                  <td className="summary-val">Rp {fin.Net_transfer.toLocaleString('id-ID')}</td>
                </tr>
                <tr className="bg-green text-green" style={{ fontSize: '9.5pt' }}>
                  <td className="summary-label">NILAI BERSIH DIBAYARKAN (NETTO) S/D PERIODE INI :</td>
                  <td className="summary-val">Rp {fin.Net_transfer.toLocaleString('id-ID')}</td>
                </tr>
              </tbody>
            </table>

            <table className="mutasi-table">
               <tbody>
                <tr>
                  <td>
                    <div className="mutasi-box" style={{ borderColor: '#dc2626' }}>
                      <div className="mutasi-header" style={{ backgroundColor: '#fee2e2', color: '#991b1b', borderBottomColor: '#dc2626' }}>Mutasi Hutang Piutang Kasbon Mandor</div>
                      <div className="mutasi-body">
                        <div className="mutasi-title">SISA TANGGUNGAN KASBON MANDOR</div>
                        <div className="mutasi-value text-red">Rp {Math.max(0, currentData.totalKasbon - currentData.totalPotongan).toLocaleString('id-ID')}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="mutasi-box">
                      <div className="mutasi-header">&nbsp;</div>
                      <div className="mutasi-body">
                        <div className="mutasi-title">SISA PIUTANG (HAK TAGIH MANDOR)</div>
                        <div className="mutasi-value text-green">Rp {fin.Net_transfer.toLocaleString('id-ID')}</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <table className="sig-table">
              <tbody>
                <tr>
                  {signatures.map((sig, idx) => (
                    <td key={idx}>
                      <div className="sig-title" style={{ marginBottom: '5px' }}>{sig.title}</div>
                      <div className="sig-space"></div>
                      <div className="sig-name">{sig.name}</div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HISTORY TABLE */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden print:hidden mt-10">
        <div className="p-4 border-b bg-slate-50 font-bold text-slate-700 flex justify-between items-center">
          <span>Riwayat Pembuatan BPUTK</span>
        </div>
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-300">
              <tr className="text-slate-600 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">No. BPUTK</th>
                <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Tanggal Dibuat</th>
                <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Vendor / SPK</th>
                <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Periode</th>
                <th className="p-4 font-bold border-b border-slate-300 text-right sticky top-0 bg-slate-50 z-10">Nilai Netto</th>
                <th className="p-4 font-bold border-b border-slate-300 text-center sticky top-0 bg-slate-50 z-10">Status</th>
                <th className="p-4 font-bold border-b border-slate-300 text-right sticky top-0 bg-slate-50 z-10">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr><td colSpan={7} className="p-16 text-center text-slate-400 font-medium italic">Belum ada riwayat BPUTK.</td></tr>
              ) : history.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-bold font-mono text-emerald-700">{b.bputk_number}</td>
                  <td className="p-4 font-medium text-slate-600">{new Date(b.created_at).toLocaleDateString('id-ID')}</td>
                  <td className="p-4">
                    <span className="font-bold text-slate-800">{b.subcontractor_contracts?.subcontractors?.company_name}</span>
                    <span className="block text-xs text-slate-500 font-mono mt-0.5">{b.subcontractor_contracts?.spk_number}</span>
                  </td>
                  <td className="p-4 text-slate-600">{new Date(b.period_start).toLocaleDateString('id-ID')} - {new Date(b.period_end).toLocaleDateString('id-ID')}</td>
                  <td className="p-4 text-right tabular-nums font-bold text-emerald-600"><MoneyText value={b.total_value} /></td>
                  
                  <td className="p-4 text-center">
                    {b.is_billed ? (
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold border border-slate-200">
                        <CheckCircle2 size={12} className="inline mr-1" /> Sudah Ditagih
                      </span>
                    ) : (
                      <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold border border-emerald-200">
                        ● Belum Ditagih
                      </span>
                    )}
                  </td>

                  <td className="p-4 text-right flex justify-end items-center gap-2">
                    <button onClick={() => handleReprint(b)} className="text-blue-600 hover:text-blue-800 text-xs font-bold bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors">
                      Cetak
                    </button>
                    {!b.is_billed ? (
                      <>
                        <button onClick={() => handleEdit(b)} className="text-amber-600 hover:text-amber-800 p-1.5 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors" title="Edit BPUTK">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(b.id)} className="text-rose-500 hover:text-rose-700 p-1.5 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors" title="Hapus Permanen">
                          <Trash2 size={14} />
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">TERKUNCI</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL WARNING OVERLAP */}
      {showOverlapModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 mb-4 border border-amber-200">
                <AlertTriangle className="h-8 w-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Peringatan Tumpang Tindih</h3>
              <p className="text-sm text-slate-500 font-medium">
                Ditemukan data opname sebelumnya pada periode tanggal ini. Jika Anda melanjutkan, data lama akan <b>ditimpa (di-update)</b> dengan data baru yang Anda inputkan. Lanjutkan?
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-end border-t border-slate-100">
              <button onClick={() => setShowOverlapModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
                Batal
              </button>
              <button onClick={processSave} disabled={saving} className="px-6 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all">
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Ya, Timpa Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HAPUS */}
      {!!deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-rose-100 mb-4 border border-rose-200">
                <AlertTriangle className="h-8 w-8 text-rose-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus Riwayat BPUTK</h3>
              <p className="text-sm text-slate-500 font-medium">
                Apakah Anda yakin ingin menghapus data riwayat ini secara permanen? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-end border-t border-slate-100">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">
                Batal
              </button>
              <button onClick={handleDeleteConfirm} disabled={isDeleting} className="px-6 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-500/20 flex items-center gap-2 transition-all">
                {isDeleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />} Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}