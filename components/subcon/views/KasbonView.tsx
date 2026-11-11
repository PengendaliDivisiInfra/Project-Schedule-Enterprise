'use client';

import { useState, useEffect } from 'react';
import { Printer, FileText, Loader2, Save, Settings, Pencil, Trash2, AlertTriangle, Wallet, CheckCircle2 } from 'lucide-react';
import { createKasbonRequest, getAllKasbonHistory } from '@/lib/services/subcon.service';
import { supabase } from '@/lib/supabase';
import { MoneyText } from '@/components/ui/MoneyText';
import { SignatureItem } from '@/lib/types/subcon';
import { SignatureSettings } from '@/components/shared/SignatureSettings';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';

interface KasbonViewProps {
  projectId: string;
  projectData: any;
  spks: any[];
  showToast: (msg: string, type: 'success' | 'error') => void;
}

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

export function KasbonView({ projectId, projectData, spks, showToast }: KasbonViewProps) {
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedSPK, setSelectedSPK] = useState<any>(null);
  const [isReprint, setIsReprint] = useState(false);

  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [showSigSettings, setShowSigSettings] = useState(false);
  const [signatures, setSignatures] = useState<SignatureItem[]>([
    { title: 'Diketahui Oleh,\nDireksi', name: 'RIZQI BILLAH BASALAMAH' },
    { title: 'Disetujui Oleh,\nKA. Divisi Infra', name: 'MEI SUNARKO' },
    { title: 'Diperiksa Oleh,\nAss. Divisi Infra', name: 'ARIF DARMAWAN' },
    { title: 'Dibuat Oleh,\nSite Engineer', name: 'SAIFUDDIN FAHMI' },
    { title: 'Pemohon,\nMandor / Pelaksana', name: 'HAERUL' },
  ]);

  const currentMonthRoman = new Date().toLocaleString('id-ID', { month: 'long' });
  
  const [form, setForm] = useState({
    contractId: '', no_form: `REQ-KL/PLBJ/${currentMonthRoman.toUpperCase()}/${new Date().getFullYear()}`,
    tanggal: new Date().toISOString().split('T')[0], metode: 'Transfer', nominal: 0,
    tujuan: '1. Pembayaran Upah Tenaga Kerja Mingguan\n2. Pembelian Material Darurat & Mobilisasi Alat Bantu',
    rekening: '', vendor_name: ''
  });

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await getAllKasbonHistory(projectId);
      setHistory(res);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [projectId]);

  const handleSelectSPK = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const spk = spks.find(s => s.id === id);
    setSelectedSPK(spk);
    
    if (spk) {
      setForm(prev => ({
        ...prev, contractId: id,
        rekening: `${spk.bank_name || 'Bank'} - A/C: ${spk.bank_account || '-'} a.n ${spk.subcontractor_name || '-'}`,
        vendor_name: spk.subcontractor_name
      }));
    } else {
      setForm(prev => ({ ...prev, contractId: '', rekening: '', vendor_name: '' }));
    }
  };

  const handleEdit = (item: any) => {
    if (item.status !== 'Pending') return showToast('Hanya Kasbon berstatus PENDING yang dapat diedit sesuai aturan SAK.', 'error');
    const spk = spks.find(s => s.id === item.contract_id);
    if (spk) setSelectedSPK(spk);

    setForm({
      contractId: item.contract_id, no_form: item.payment_number, tanggal: item.payment_date, metode: 'Transfer',
      nominal: item.amount, tujuan: item.description,
      rekening: `${spk?.bank_name || 'Bank'} - A/C: ${spk?.bank_account || '-'} a.n ${spk?.subcontractor_name || '-'}`,
      vendor_name: spk?.subcontractor_name || ''
    });

    if (item.signatures) setSignatures(item.signatures);
    setEditTarget(item.id);
    setIsReprint(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!selectedSPK) return showToast('Pilih Mandor / SPK terlebih dahulu', 'error');
    if (form.nominal <= 0) return showToast('Nominal kasbon harus lebih dari 0', 'error');

    setLoading(true);
    try {
      if (editTarget) {
        const { error } = await supabase.from('subcontractor_payments').update({ amount: form.nominal, description: form.tujuan, signatures: signatures }).eq('id', editTarget);
        if (error) throw error;
        showToast('Pengajuan Kasbon berhasil diperbarui', 'success');
        setEditTarget(null);
      } else {
        await createKasbonRequest({
          project_id: projectId, contract_id: selectedSPK.id, payment_number: form.no_form, payment_date: form.tanggal,
          amount: form.nominal, description: form.tujuan, payment_method: form.metode, bank_account: form.rekening, signatures: signatures
        });
        showToast('Pengajuan Kasbon berhasil disimpan (Pending)', 'success');
      }
      
      await loadHistory();
      setIsReprint(false);
      
      setForm({
        contractId: selectedSPK.id, no_form: `REQ-KL/PLBJ/${currentMonthRoman.toUpperCase()}/${new Date().getFullYear()}`,
        tanggal: new Date().toISOString().split('T')[0], metode: 'Transfer', nominal: 0,
        tujuan: '1. Pembayaran Upah Tenaga Kerja Mingguan\n2. Pembelian Material Darurat & Mobilisasi Alat Bantu',
        rekening: `${selectedSPK.bank_name || 'Bank'} - A/C: ${selectedSPK.bank_account || '-'} a.n ${selectedSPK.subcontractor_name || '-'}`,
        vendor_name: selectedSPK.subcontractor_name
      });
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const itemToDelete = history.find(h => h.id === deleteTarget);
      if (itemToDelete?.status === 'Pending') {
        const { error } = await supabase.from('subcontractor_payments').delete().eq('id', deleteTarget);
        if (error) throw error;
        showToast('Draft Kasbon berhasil dihapus permanen.', 'success');
      } else {
        const { error } = await supabase.from('subcontractor_payments').update({ status: 'Void' }).eq('id', deleteTarget);
        if (error) throw error;
        showToast('Kasbon berhasil dibatalkan (VOID). Jurnal terkait akan disesuaikan.', 'success');
      }
      loadHistory();
      setDeleteTarget(null);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrint = async () => {
    if (!selectedSPK) return showToast('Pilih Mandor terlebih dahulu', 'error');
    const printArea = document.getElementById('kasbon-print-area');
    if (!printArea) return;

    try {
      setLoading(true);
      const htmlContent = printArea.innerHTML;
      
      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { size: A4 landscape; margin: 10mm; }
              body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; }
              .header-kop { text-align: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px; }
              .header-kop img { max-height: 45px; margin-bottom: 5px; display: block; margin: 0 auto; }
              .header-kop h1 { margin: 0; font-size: 16pt; font-weight: bold; text-transform: uppercase; }
              .header-kop p { margin: 2px 0; font-size: 9pt; }
              .container { border: 2px solid #0f766e; border-radius: 8px; padding: 20px 30px; height: 155mm; display: flex; flex-direction: column; box-sizing: border-box; page-break-inside: avoid; }
              .header-title { text-align: center; font-size: 15pt; font-weight: bold; color: #0f766e; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 1px; }
              .header-subtitle { text-align: center; font-size: 10pt; font-weight: bold; color: #0f766e; margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 15px; table-layout: fixed; }
              th, td { border: 1px solid #64748b; padding: 8px 12px; vertical-align: middle; font-size: 9.5pt; }
              .label { font-weight: bold; background-color: #f8fafc; width: 20%; }
              .section-title { font-weight: bold; color: #0f766e; margin-bottom: 10px; font-size: 11pt; text-transform: uppercase; }
              .sig-wrapper { margin-top: auto; padding-top: 20px; }
              .sig-table { width: 100%; border-collapse: collapse; text-align: center; }
              .sig-table td { border: none !important; vertical-align: bottom; width: 20%; padding: 0 5px; }
              .sig-space { height: 60px; }
              .sig-name { font-weight: bold; text-decoration: underline; margin-bottom: 2px; font-size: 9.5pt; }
              .sig-title { font-size: 8.5pt; color: #475569; white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <div class="header-kop">
              ${projectData?.logo_url ? `<img src="${projectData.logo_url}" alt="Logo" />` : ''}
              <h1>${projectData?.company_name || 'PT. NAMA PERUSAHAAN'}</h1>
              <p>${projectData?.contractor_address || 'Alamat Perusahaan'}</p>
              <p>GENERAL CONTRACTOR & SUPPLIER</p>
            </div>
            <div class="container">${htmlContent}</div>
          </body>
        </html>
      `;

      const res = await fetch('/api/generate-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html: fullHtml, format: 'A4', isLandscape: true })
      });

      if (!res.ok) throw new Error('Gagal generate PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `Kasbon_${form.no_form.replace(/\//g, '_')}.pdf`;
      a.click(); window.URL.revokeObjectURL(url);
      showToast('PDF berhasil diunduh', 'success');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReprint = (item: any) => {
    const spk = spks.find(s => s.id === item.contract_id);
    if (spk) setSelectedSPK(spk);
    setForm({
      contractId: item.contract_id, no_form: item.payment_number, tanggal: item.payment_date, metode: 'Transfer',
      nominal: item.amount, tujuan: item.description,
      rekening: `${item.subcontractor_contracts?.subcontractors?.company_name || 'Bank'} - A/C: -`,
      vendor_name: item.subcontractor_contracts?.subcontractors?.company_name || ''
    });
    if (item.signatures) setSignatures(item.signatures);
    setEditTarget(null); setIsReprint(true);
  };

  const handleCancelEdit = () => {
    setEditTarget(null); setIsReprint(false);
    setForm({
      contractId: selectedSPK?.id || '', no_form: `REQ-KL/PLBJ/${currentMonthRoman.toUpperCase()}/${new Date().getFullYear()}`,
      tanggal: new Date().toISOString().split('T')[0], metode: 'Transfer', nominal: 0,
      tujuan: '1. Pembayaran Upah Tenaga Kerja Mingguan\n2. Pembelian Material Darurat & Mobilisasi Alat Bantu',
      rekening: `${selectedSPK?.bank_name || 'Bank'} - A/C: ${selectedSPK?.bank_account || '-'} a.n ${selectedSPK?.subcontractor_name || '-'}`,
      vendor_name: selectedSPK?.subcontractor_name || ''
    });
  };

  return (
    <div className="space-y-6">
      {/* FORM INPUT */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 print:hidden">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Wallet className="text-emerald-600" /> {editTarget ? 'Edit Pengajuan Kasbon' : 'Formulir Pengajuan Kasbon Mandor'}
          </h3>
          <button onClick={() => setShowSigSettings(!showSigSettings)} className="text-sm font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors border border-slate-200">
            <Settings size={16} /> Pengaturan TTD
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Pilih Mandor / SPK</label>
            <select value={form.contractId} onChange={handleSelectSPK} disabled={!!editTarget || isReprint} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium disabled:bg-slate-100 disabled:text-slate-500">
              <option value="">-- Pilih Mandor --</option>
              {spks.map(s => <option key={s.id} value={s.id}>{s.subcontractor_name} - {s.spk_number}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">No. Form</label>
            <input type="text" value={form.no_form} onChange={e => setForm({...form, no_form: e.target.value})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-mono disabled:bg-slate-100 disabled:text-slate-500" disabled={!!editTarget || isReprint} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Tanggal Pengajuan</label>
            <input type="date" value={form.tanggal} onChange={e => setForm({...form, tanggal: e.target.value})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500" disabled={!!editTarget || isReprint} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Metode Pembayaran</label>
            <select value={form.metode} onChange={e => setForm({...form, metode: e.target.value})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium disabled:bg-slate-100 disabled:text-slate-500" disabled={!!editTarget || isReprint}>
              <option value="Transfer">Transfer Bank</option>
              <option value="Tunai">Tunai (Cash)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Jumlah Nominal Kasbon (Rp)</label>
            <input type="number" value={form.nominal === 0 ? '' : form.nominal} onChange={e => setForm({...form, nominal: Number(e.target.value)})} className="w-full border border-amber-300 bg-amber-50 rounded-xl p-3 text-xl font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all tabular-nums disabled:bg-slate-100 disabled:text-slate-500 disabled:border-slate-300" placeholder="0" disabled={isReprint} />
            <p className="text-xs text-emerald-700 font-bold mt-2 italic bg-emerald-50 p-2 rounded-lg border border-emerald-100 inline-block">Terbilang: {form.nominal === 0 ? 'Nol' : terbilang(form.nominal)} Rupiah</p>
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Tujuan Penggunaan Dana</label>
            <textarea rows={2} value={form.tujuan} onChange={e => setForm({...form, tujuan: e.target.value})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none disabled:bg-slate-100 disabled:text-slate-500" disabled={isReprint} />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Detail Rekening Penerima</label>
            <input type="text" value={form.rekening} onChange={e => setForm({...form, rekening: e.target.value})} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500" disabled={isReprint} />
          </div>
        </div>

        {showSigSettings && <SignatureSettings signatures={signatures} onChange={setSignatures} colorTheme="emerald" />}

        <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 mt-6">
          {editTarget && <button onClick={handleCancelEdit} className="px-5 py-2.5 text-sm font-bold text-white bg-slate-500 hover:bg-slate-600 rounded-xl shadow-md transition-colors">Batal Edit</button>}
          {isReprint && <button onClick={() => setIsReprint(false)} className="px-5 py-2.5 text-sm font-bold text-white bg-slate-500 hover:bg-slate-600 rounded-xl shadow-md transition-colors">Batal Cetak Ulang</button>}
          {!isReprint && (
            <button onClick={handleSave} disabled={loading || !selectedSPK} className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-md flex items-center gap-2 transition-all disabled:opacity-50 ${editTarget ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'}`}>
              {loading ? <Loader2 className="animate-spin" size={18} /> : (editTarget ? <Pencil size={18} /> : <Save size={18} />)} 
              {editTarget ? 'Update Kasbon' : 'Simpan Pengajuan'}
            </button>
          )}
          <button onClick={handlePrint} disabled={loading || !selectedSPK} className="px-6 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-500/20 flex items-center gap-2 transition-all disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Printer size={18} />} Cetak PDF
          </button>
        </div>
      </div>

      {/* PREVIEW AREA */}
      {selectedSPK && (
        <div className="w-full flex flex-col items-center pb-10 overflow-x-auto bg-slate-200 p-6 rounded-2xl print:hidden">
          <p className="text-[10px] text-center text-slate-500 mb-4 font-bold tracking-widest uppercase bg-white px-3 py-1 rounded-full shadow-sm">Pratinjau Dokumen A4 Landscape</p>
          
          <div className="w-[297mm] bg-white p-8 shadow-2xl border border-slate-300">
             <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
                {projectData?.logo_url && <img src={projectData.logo_url} alt="Logo" className="max-h-[45px] mx-auto mb-2" />}
                <h1 className="text-2xl font-extrabold uppercase m-0 text-slate-800 tracking-tight">{projectData?.company_name || 'PT. NAMA PERUSAHAAN'}</h1>
                <p className="text-sm font-medium text-slate-500 m-0 mt-1">{projectData?.contractor_address || 'Alamat Perusahaan'}</p>
                <p className="text-xs font-bold text-slate-400 m-0 mt-0.5 tracking-widest uppercase">GENERAL CONTRACTOR & SUPPLIER</p>
             </div>

             <div id="kasbon-print-area" className="border-2 border-teal-600 rounded-xl p-8 flex flex-col min-h-[150mm]">
                <div className="text-center mb-6">
                  <div className="text-xl font-extrabold text-teal-700 uppercase tracking-widest">FORMULIR PENGAJUAN KASBON MANDOR</div>
                  <div className="text-xs font-bold text-teal-600 mt-1 uppercase tracking-wider">(ADVANCE PAYMENT REQUEST)</div>
                </div>

                <table className="w-full border-collapse mb-6 table-fixed text-sm">
                  <tbody>
                    <tr>
                      <td className="font-bold w-[20%] bg-slate-50 border border-slate-400 p-3">Nama Mandor / Perusahaan:</td>
                      <td className="border border-slate-400 p-3 w-[30%] font-bold text-slate-800">{form.vendor_name}</td>
                      <td className="font-bold w-[15%] bg-slate-50 border border-slate-400 p-3">No. Form:</td>
                      <td className="border border-slate-400 p-3 font-mono w-[35%]">{form.no_form}</td>
                    </tr>
                    <tr>
                      <td className="font-bold bg-slate-50 border border-slate-400 p-3">Nama Proyek & Lokasi:</td>
                      <td className="border border-slate-400 p-3">{projectData?.name} - {projectData?.location}</td>
                      <td className="font-bold bg-slate-50 border border-slate-400 p-3">Tanggal:</td>
                      <td className="border border-slate-400 p-3">{new Date(form.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
                    </tr>
                    <tr>
                      <td className="font-bold bg-slate-50 border border-slate-400 p-3">Nomor SPK:</td>
                      <td className="border border-slate-400 p-3 font-mono">{selectedSPK.spk_number}</td>
                      <td className="font-bold bg-slate-50 border border-slate-400 p-3">Metode:</td>
                      <td className="border border-slate-400 p-3 font-bold">{form.metode === 'Transfer' ? 'Transfer Bank [✓] Tunai [ ]' : 'Transfer Bank [ ] Tunai [✓]'}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="font-extrabold text-teal-700 mb-3 text-sm uppercase tracking-wider">I. RINCIAN PERMOHONAN DANA & ALOKASI AKUNTANSI</div>
                
                <table className="w-full border-collapse mb-8 table-fixed text-sm">
                  <tbody>
                    <tr>
                      <td className="font-bold w-[20%] bg-slate-50 border border-slate-400 p-3">Jumlah Nominal Kasbon</td>
                      <td className="text-emerald-600 font-extrabold text-lg border border-slate-400 p-3 tabular-nums">Rp {form.nominal.toLocaleString('id-ID')}</td>
                    </tr>
                    <tr>
                      <td className="font-bold bg-slate-50 border border-slate-400 p-3">Terbilang</td>
                      <td className="italic font-medium border border-slate-400 p-3 bg-amber-50 text-amber-900">{form.nominal === 0 ? 'Nol' : terbilang(form.nominal)} Rupiah</td>
                    </tr>
                    <tr>
                      <td className="font-bold bg-slate-50 border border-slate-400 p-3">Tujuan Penggunaan Dana</td>
                      <td className="whitespace-pre-wrap border border-slate-400 p-3 leading-relaxed">{form.tujuan}</td>
                    </tr>
                    <tr>
                      <td className="font-bold bg-slate-50 border border-slate-400 p-3">Detail Rekening Penerima</td>
                      <td className="border border-slate-400 p-3 font-mono">{form.rekening}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="mt-auto pt-6">
                  <table className="w-full border-collapse text-center">
                    <tbody>
                      <tr>
                        {signatures.map((sig, idx) => (
                          <td key={idx} className="w-[20%] align-bottom p-0 px-2 border-none">
                            <div className="mb-16 font-bold text-[10px] whitespace-pre-wrap leading-tight text-slate-600">{sig.title}</div>
                            <div className="font-extrabold underline mb-1 text-sm text-slate-800">{sig.name}</div>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* HISTORY TABLE */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden mt-10">
        <div className="p-4 border-b bg-slate-50 font-bold text-slate-700 flex justify-between items-center">
          <span>Riwayat Seluruh Pengajuan Kasbon Proyek</span>
          {loadingHistory && <Loader2 className="animate-spin text-slate-500" size={16} />}
        </div>
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-300">
              <tr className="text-slate-600 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">No. Form</th>
                <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Tanggal</th>
                <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Mandor</th>
                <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Tujuan</th>
                <th className="p-4 font-bold border-b border-slate-300 text-right sticky top-0 bg-slate-50 z-10">Nominal</th>
                <th className="p-4 font-bold border-b border-slate-300 text-center sticky top-0 bg-slate-50 z-10">Status</th>
                <th className="p-4 font-bold border-b border-slate-300 text-right sticky top-0 bg-slate-50 z-10">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingHistory ? (
                <tr><td colSpan={7} className="p-0"><SkeletonLoader rows={5} cols={6} /></td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={7} className="p-16 text-center text-slate-400 font-medium italic">Belum ada riwayat pengajuan kasbon untuk proyek ini.</td></tr>
              ) : history.map((h) => (
                <tr key={h.id} className={`hover:bg-slate-50/80 transition-colors ${h.status === 'Void' ? 'bg-rose-50/30' : ''}`}>
                  <td className="p-4 font-bold font-mono text-emerald-700">{h.payment_number}</td>
                  <td className="p-4 font-medium text-slate-600">{new Date(h.payment_date).toLocaleDateString('id-ID')}</td>
                  <td className="p-4 font-bold text-slate-800">{h.subcontractor_contracts?.subcontractors?.company_name || '-'}</td>
                  <td className="p-4 text-slate-500 max-w-xs truncate" title={h.description}>{h.description}</td>
                  <td className="p-4 text-right tabular-nums font-bold text-slate-800"><MoneyText value={h.amount} /></td>
                  <td className="p-4 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold border ${
                      h.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                      h.status === 'Void' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      h.status === 'Approved' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {h.status || 'Pending'}
                    </span>
                  </td>
                  <td className="p-4 text-right flex justify-end gap-2 items-center">
                    <button onClick={() => handleReprint(h)} className="text-blue-600 hover:text-blue-800 text-xs font-bold bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors">
                      Cetak
                    </button>
                    {h.status === 'Pending' && (
                      <button onClick={() => handleEdit(h)} className="text-amber-600 hover:text-amber-800 p-1.5 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors" title="Edit Kasbon">
                        <Pencil size={14} />
                      </button>
                    )}
                    {h.status !== 'Void' && h.status !== 'Paid' && (
                      <button onClick={() => setDeleteTarget(h.id)} className="text-rose-500 hover:text-rose-700 p-1.5 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors" title={h.status === 'Pending' ? 'Hapus Draft' : 'Batalkan (Void)'}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!!deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-rose-100 mb-4 border border-rose-200">
                <AlertTriangle className="h-8 w-8 text-rose-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {history.find(h => h.id === deleteTarget)?.status === 'Pending' ? 'Hapus Draft Kasbon' : 'Batalkan Kasbon (VOID)'}
              </h3>
              <p className="text-sm text-slate-500 font-medium">
                {history.find(h => h.id === deleteTarget)?.status === 'Pending' 
                  ? 'Draft kasbon ini akan dihapus permanen karena belum masuk ranah finansial.' 
                  : 'Kasbon yang sudah diapprove tidak boleh dihapus permanen. Status akan diubah menjadi VOID untuk menjaga Audit Trail (SAK). Lanjutkan?'}
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-end border-t border-slate-100">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Batal</button>
              <button onClick={handleDeleteConfirm} disabled={isDeleting} className="px-6 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-500/20 flex items-center gap-2 transition-all">
                {isDeleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />} Ya, Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}