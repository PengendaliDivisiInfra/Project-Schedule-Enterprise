'use client';

import { useState, useEffect } from 'react';
import { Printer, FileText, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { getBAOPData, saveBAOPDocument, getBAOPHistory, deleteBAOPDocument, getUnbilledBPUTKs } from '@/lib/services/subcon.service';
import { MoneyText } from '@/components/ui/MoneyText';
import { supabase } from '@/lib/supabase';

interface BAOPViewProps {
  projectId: string;
  spks: any[];
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

function terbilang(angka: number): string {
  if (angka === 0) return "Nol"; 
  angka = Math.abs(angka);
  const huruf = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  let hasil = "";
  if (angka < 12) hasil = huruf[angka];
  else if (angka < 20) hasil = terbilang(angka - 10) + " Belas";
  else if (angka < 100) hasil = terbilang(Math.floor(angka / 10)) + " Puluh " + terbilang(angka % 10);
  else if (angka < 200) hasil = "Seratus " + terbilang(angka - 100);
  else if (angka < 1000) hasil = terbilang(Math.floor(angka / 100)) + " Ratus " + terbilang(angka % 100);
  else if (angka < 2000) hasil = "Seribu " + terbilang(angka - 1000);
  else if (angka < 1000000) hasil = terbilang(Math.floor(angka / 1000)) + " Ribu " + terbilang(angka % 1000);
  else if (angka < 1000000000) hasil = terbilang(Math.floor(angka / 1000000)) + " Juta " + terbilang(angka % 1000000);
  else if (angka < 1000000000000) hasil = terbilang(Math.floor(angka / 1000000000)) + " Milyar " + terbilang(angka % 1000000000);
  return hasil.trim();
}

export function BAOPView({ projectId, spks, onSuccess, showToast }: BAOPViewProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ contract: any, opnames: any[] } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  
  const [availableBPUTKs, setAvailableBPUTKs] = useState<any[]>([]);
  const [selectedBputkId, setSelectedBputkId] = useState('');
  
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReprint, setIsReprint] = useState(false);

  const currentMonthRoman = new Date().toLocaleString('id-ID', { month: 'long' });
  
  const [form, setForm] = useState({
    contractId: '',
    nomorBAOP: `001/KL-BAOP/BKP/${currentMonthRoman.toUpperCase()}/${new Date().getFullYear()}`,
  });

  const loadHistory = async () => {
    try {
      const res = await getBAOPHistory(projectId);
      setHistory(res);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [projectId]);

  const handleSelectSPK = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const contractId = e.target.value;
    setForm({ ...form, contractId });
    setSelectedBputkId('');
    setData(null);

    if (contractId) {
      try {
        setLoading(true);
        const bputks = await getUnbilledBPUTKs(contractId);
        setAvailableBPUTKs(bputks);
      } catch (err: any) {
        showToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    } else {
      setAvailableBPUTKs([]);
    }
  };

  const handleSelectBPUTK = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const bputkId = e.target.value;
    setSelectedBputkId(bputkId);
    
    if (!bputkId) {
      setData(null);
      return;
    }

    const selectedBputk = availableBPUTKs.find(b => b.id === bputkId);
    if (!selectedBputk) return;

    setIsReprint(false);
    setLoading(true);
    try {
      const res = await getBAOPData(form.contractId, selectedBputk.period_start, selectedBputk.period_end);
      setData(res);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReprint = async (item: any) => {
    setForm({
      contractId: item.contract_id,
      nomorBAOP: item.baop_number,
    });
    setSelectedBputkId(item.bputk_id || '');

    setIsReprint(true);
    setLoading(true);
    try {
      const res = await getBAOPData(item.contract_id, item.period_start, item.period_end);
      setData(res);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    const printElement = document.getElementById('baop-print-area');
    if (!printElement || !data) return;

    try {
      setLoading(true);
      
      if (!isReprint) {
        const selectedBputk = availableBPUTKs.find(b => b.id === selectedBputkId);
        
        await saveBAOPDocument({
          project_id: projectId,
          contract_id: form.contractId,
          bputk_id: selectedBputkId,
          baop_number: form.nomorBAOP,
          period_start: selectedBputk.period_start,
          period_end: selectedBputk.period_end,
          total_value: totalNilaiOpname
        });
      }

      const htmlContent = printElement.innerHTML;
      
      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { size: A4 portrait; margin: 10mm 15mm; }
              body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; font-family: 'Times New Roman', Times, serif; font-size: 10.5pt; color: #000; line-height: 1.3; }
              .header-kop { text-align: center; border-bottom: 3px double #000; padding-bottom: 5px; margin-bottom: 15px; }
              .header-kop img { max-height: 50px; max-width: 100px; object-fit: contain; margin-bottom: 5px; display: block; margin: 0 auto; }
              .header-kop h1 { margin: 0; font-size: 14pt; font-weight: bold; text-transform: uppercase; }
              .header-kop p { margin: 1px 0; font-size: 9.5pt; }
              .doc-title { text-align: center; margin-bottom: 15px; }
              .doc-title h2 { margin: 0; font-size: 12pt; font-weight: bold; text-decoration: underline; }
              .doc-title p { margin: 3px 0 0 0; font-size: 10.5pt; font-weight: bold; }
              .paragraph { text-align: justify; margin-bottom: 8px; text-indent: 30px; }
              .identitas-table { width: 100%; border-collapse: collapse; margin-bottom: 3px; }
              .identitas-table td { padding: 1px 0; vertical-align: top; }
              .identitas-label { width: 100px; }
              .identitas-colon { width: 10px; }
              .data-list { margin-bottom: 10px; }
              .data-item { margin-bottom: 6px; }
              .sig-area { width: 100%; margin-top: 25px; page-break-inside: avoid; }
              .sig-table { width: 100%; border-collapse: collapse; text-align: center; }
              .sig-table td { width: 50%; vertical-align: bottom; padding: 0 10px; }
              .sig-space { height: 60px; }
            </style>
          </head>
          <body>${htmlContent}</body>
        </html>
      `;

      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: fullHtml, format: 'A4', isLandscape: false })
      });
      
      if (!res.ok) throw new Error('Gagal generate PDF dari server');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BAOP_${form.nomorBAOP.replace(/\//g, '_')}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      showToast(isReprint ? 'PDF berhasil diunduh' : 'BAOP berhasil disimpan & diunduh', 'success');
      if (!isReprint) {
        loadHistory();
        onSuccess();
        setAvailableBPUTKs(prev => prev.filter(b => b.id !== selectedBputkId));
        setSelectedBputkId('');
      }
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
      const dataToDelete = history.find(h => h.id === deleteTarget);
      await deleteBAOPDocument(deleteTarget); 
      if (dataToDelete?.bputk_id) {
        await supabase.from('bputk_documents').update({ is_billed: false }).eq('id', dataToDelete.bputk_id);
      }
      showToast('Dokumen berhasil dihapus. BPUTK telah dibuka kembali.', 'success');
      loadHistory();
      onSuccess(); 
      setDeleteTarget(null);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };
  
  const totalNilaiOpname = data?.opnames.reduce((sum, op) => sum + Number(op.total), 0) || 0;
  const nilaiKontrak = data?.contract?.contract_value || 1;
  const persentaseProgres = ((totalNilaiOpname / nilaiKontrak) * 100).toFixed(2);

  const formatRp = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val).replace('Rp', 'Rp ');
  };

  const groupedOpnames = data?.opnames.reduce((acc: any, op: any) => {
    const itemName = op.subcontractor_spk_items?.description || 'Item Lainnya';
    if (!acc[itemName]) acc[itemName] = [];
    acc[itemName].push(op);
    return acc;
  }, {});

  const webPreviewStyles = `
    .doc-a4 { width: 210mm; min-height: 297mm; padding: 10mm 15mm; box-sizing: border-box; margin: 0 auto; background: #fff; font-family: 'Times New Roman', Times, serif; font-size: 10.5pt; line-height: 1.3; color: #000; }
    .header-kop { text-align: center; border-bottom: 3px double #000; padding-bottom: 5px; margin-bottom: 15px; }
    .header-kop img { max-height: 50px; max-width: 100px; object-fit: contain; margin-bottom: 5px; display: block; margin: 0 auto; }
    .header-kop h1 { margin: 0; font-size: 14pt; font-weight: bold; text-transform: uppercase; }
    .header-kop p { margin: 1px 0; font-size: 9.5pt; }
    .doc-title { text-align: center; margin-bottom: 15px; }
    .doc-title h2 { margin: 0; font-size: 12pt; font-weight: bold; text-decoration: underline; }
    .doc-title p { margin: 3px 0 0 0; font-size: 10.5pt; font-weight: bold; }
    .paragraph { text-align: justify; margin-bottom: 8px; text-indent: 30px; }
    .identitas-table { width: 100%; border-collapse: collapse; margin-bottom: 3px; }
    .identitas-table td { padding: 1px 0; vertical-align: top; }
    .identitas-label { width: 100px; }
    .identitas-colon { width: 10px; }
    .data-list { margin-bottom: 10px; }
    .data-item { margin-bottom: 6px; }
    .sig-area { width: 100%; margin-top: 25px; page-break-inside: avoid; }
    .sig-table { width: 100%; border-collapse: collapse; text-align: center; }
    .sig-table td { width: 50%; vertical-align: bottom; padding: 0 10px; }
    .sig-space { height: 60px; }
  `;

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{__html: webPreviewStyles}} />

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 print:hidden">
        <h3 className="font-bold text-lg text-slate-800 border-b border-slate-100 pb-3 mb-3 flex items-center gap-2">
          <FileText className="text-amber-600" /> Buat Dokumen BAOP (Berdasarkan BPUTK)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Pilih Mandor / SPK</label>
            <select value={form.contractId} onChange={handleSelectSPK} disabled={isReprint} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-medium">
              <option value="">-- Pilih Mandor --</option>
              {spks.map(s => <option key={s.id} value={s.id}>{s.subcontractor_name} - {s.spk_number}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Pilih BPUTK (Sumber Data)</label>
            <select value={selectedBputkId} onChange={handleSelectBPUTK} disabled={isReprint || availableBPUTKs.length === 0} className="w-full border border-amber-300 bg-amber-50 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-bold text-amber-800">
              <option value="">-- Pilih BPUTK --</option>
              {availableBPUTKs.map(b => (
                <option key={b.id} value={b.id}>
                  {b.bputk_number} ({new Date(b.period_start).toLocaleDateString('id-ID')} - {new Date(b.period_end).toLocaleDateString('id-ID')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nomor BAOP</label>
            <input type="text" value={form.nomorBAOP} onChange={(e) => setForm({...form, nomorBAOP: e.target.value})} disabled={isReprint} className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-mono" />
          </div>
        </div>
      </div>

      {data && (
        <div className="w-full flex flex-col items-center pb-10 overflow-x-auto bg-slate-200 p-6 rounded-2xl print:hidden">
          <div className="bg-white shadow-xl rounded-sm">
             <div id="baop-print-area" className="doc-a4">
                <div className="header-kop">
                  {data.contract.projects?.logo_url && (
                    <img src={data.contract.projects.logo_url} alt="Logo" />
                  )}
                  <h1>{data.contract.projects?.company_name || '-'}</h1>
                  <p>{data.contract.projects?.contractor_address || '-'}</p>
                  <p>GENERAL CONTRACTOR & SUPPLIER</p>
                </div>

                <div className="doc-title">
                  <h2>BERITA ACARA OPNAME PEKERJAAN (BAOP)</h2>
                  <p>NOMOR: {form.nomorBAOP}</p>
                </div>

                <p className="paragraph">
                  Pada hari ini, <b>{new Date(data.contract.period_end).toLocaleDateString('id-ID', { weekday: 'long' })}</b> tanggal <b>{new Date(data.contract.period_end).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</b>, 
                  bertempat di lokasi proyek <b>{data.contract.projects?.name}</b> yang beralamat di <b>{data.contract.projects?.location}</b>, 
                  kami yang bertanda tangan di bawah ini:
                </p>

                <table className="identitas-table">
                  <tbody>
                    <tr><td className="identitas-label">1. Nama</td><td className="identitas-colon">:</td><td><b>{data.contract.projects?.contractor_pic_name || '-'}</b></td></tr>
                    <tr><td className="identitas-label">Jabatan</td><td className="identitas-colon">:</td><td>{data.contract.projects?.contractor_pic_title || '-'}</td></tr>
                    <tr><td className="identitas-label">Perusahaan</td><td className="identitas-colon">:</td><td>{data.contract.projects?.company_name || '-'}</td></tr>
                    <tr><td className="identitas-label">Alamat</td><td className="identitas-colon">:</td><td>{data.contract.projects?.contractor_address || '-'}</td></tr>
                  </tbody>
                </table>
                <p style={{ marginBottom: '10px' }}>Selanjutnya disebut sebagai <b>PIHAK KESATU</b></p>

                <table className="identitas-table">
                  <tbody>
                    <tr><td className="identitas-label">2. Nama</td><td className="identitas-colon">:</td><td><b>{data.contract.subcontractors?.contact_person || '-'}</b></td></tr>
                    <tr><td className="identitas-label">Jabatan</td><td className="identitas-colon">:</td><td>Direktur</td></tr>
                    <tr><td className="identitas-label">Perusahaan</td><td className="identitas-colon">:</td><td>{data.contract.subcontractors?.company_name || '-'}</td></tr>
                    <tr><td className="identitas-label">Alamat</td><td className="identitas-colon">:</td><td>{data.contract.subcontractors?.address || '-'}</td></tr>
                  </tbody>
                </table>
                <p style={{ marginBottom: '10px' }}>Selanjutnya disebut sebagai <b>PIHAK KEDUA</b></p>

                <p className="paragraph">
                  Dengan ini menerangkan bahwa <b>PIHAK KESATU</b> dan <b>PIHAK KEDUA</b> telah melakukan pemeriksaan, pengukuran, dan opname fisik bersama secara komprehensif 
                  untuk periode {new Date(data.contract.period_start).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} s/d {new Date(data.contract.period_end).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}, 
                  terhadap pekerjaan {data.contract.work_description} sebagai berikut:
                </p>

                <table className="identitas-table" style={{ marginBottom: '10px', marginLeft: '10px' }}>
                  <tbody>
                    <tr><td className="identitas-label" style={{ width: '120px' }}>Nama Pekerjaan</td><td className="identitas-colon">:</td><td>{data.contract.work_description}</td></tr>
                    <tr><td className="identitas-label" style={{ width: '120px' }}>Nama Paket Proyek</td><td className="identitas-colon">:</td><td>{data.contract.projects?.name}</td></tr>
                    <tr><td className="identitas-label" style={{ width: '120px' }}>Acuan Kontrak</td><td className="identitas-colon">:</td><td>{data.contract.spk_number || '-'}</td></tr>
                  </tbody>
                </table>

                <h3 style={{ fontSize: '10.5pt', fontWeight: 'bold', marginBottom: '5px', marginTop: '10px' }}>I. Rincian Capaian Prestasi Fisik Pekerjaan</h3>
                
                <div className="data-list">
                  {!groupedOpnames || Object.keys(groupedOpnames).length === 0 ? (
                    <div style={{ fontStyle: 'italic' }}>Tidak ada data opname pada periode ini.</div>
                  ) : (
                    Object.entries(groupedOpnames).map(([itemName, ops]: [string, any], idx) => (
                      <div key={idx} className="data-item">
                        <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>1.{idx + 1}. {itemName}</div>
                        {ops.map((op: any, subIdx: number) => (
                          <div key={subIdx} style={{ paddingLeft: '20px', marginBottom: '2px' }}>
                            - {op.subcontractor_spk_items?.description}: {op.volume} {op.subcontractor_spk_items?.unit} (Prestasi {((op.volume / op.subcontractor_spk_items?.volume) * 100).toFixed(0)}%)
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>

                <h3 style={{ fontSize: '10.5pt', fontWeight: 'bold', marginBottom: '5px', marginTop: '10px' }}>II. Ringkasan Nilai Finansial Hasil Opname</h3>
                <div style={{ marginBottom: '15px' }}>
                  <p style={{ margin: '1px 0' }}>Total Nilai Prestasi Periode Ini: <b>{formatRp(totalNilaiOpname)}</b> ({terbilang(totalNilaiOpname)} Rupiah)</p>
                  <p style={{ margin: '1px 0' }}>Akumulasi Total Progres Fisik: <b>{persentaseProgres}%</b> dari Keseluruhan Nilai Kontrak Kerja.</p>
                </div>

                <div className="sig-area">
                  <table className="sig-table">
                    <tbody>
                      <tr>
                        <td>
                          <p style={{ fontWeight: 'bold', margin: '0 0 3px 0' }}>PIHAK KESATU</p>
                          <p style={{ margin: '0 0 3px 0' }}>{data.contract.projects?.company_name || '-'}</p>
                          <div className="sig-space"></div>
                          <p style={{ fontWeight: 'bold', textDecoration: 'underline', margin: '0 0 2px 0' }}>{data.contract.projects?.contractor_pic_name || '-'}</p>
                          <p style={{ margin: 0 }}>{data.contract.projects?.contractor_pic_title || '-'}</p>
                        </td>
                        <td>
                          <p style={{ fontWeight: 'bold', margin: '0 0 3px 0' }}>PIHAK KEDUA</p>
                          <p style={{ margin: '0 0 3px 0' }}>{data.contract.subcontractors?.company_name || '-'}</p>
                          <div className="sig-space"></div>
                          <p style={{ fontWeight: 'bold', textDecoration: 'underline', margin: '0 0 2px 0' }}>{data.contract.subcontractors?.contact_person || '-'}</p>
                          <p style={{ margin: 0 }}>Direktur</p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
          
          <div className="mt-6 flex justify-end w-full max-w-[210mm] print:hidden">
             <button onClick={handlePrint} disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-md transition-all">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Printer size={20} />} {isReprint ? 'Cetak Ulang PDF' : 'Cetak & Simpan BAOP'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden print:hidden mt-10">
        <div className="p-4 border-b bg-slate-50 font-bold text-slate-700 flex justify-between items-center">
          <span>Riwayat Pembuatan BAOP</span>
        </div>
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-left text-sm min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-300">
              <tr className="text-slate-600 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">No. BAOP</th>
                <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Tanggal Dibuat</th>
                <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Vendor / SPK</th>
                <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Periode</th>
                <th className="p-4 font-bold border-b border-slate-300 text-right sticky top-0 bg-slate-50 z-10">Total Nilai</th>
                <th className="p-4 font-bold border-b border-slate-300 text-right sticky top-0 bg-slate-50 z-10">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr><td colSpan={6} className="p-16 text-center text-slate-400 font-medium italic">Belum ada riwayat BAOP.</td></tr>
              ) : history.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-bold font-mono text-amber-700">{b.baop_number}</td>
                  <td className="p-4 font-medium text-slate-600">{new Date(b.created_at).toLocaleDateString('id-ID')}</td>
                  <td className="p-4">
                    <span className="font-bold text-slate-800">{b.subcontractor_contracts?.subcontractors?.company_name}</span>
                    <span className="block text-xs text-slate-500 font-mono mt-0.5">{b.subcontractor_contracts?.spk_number}</span>
                  </td>
                  <td className="p-4 text-slate-600">{new Date(b.period_start).toLocaleDateString('id-ID')} - {new Date(b.period_end).toLocaleDateString('id-ID')}</td>
                  <td className="p-4 text-right tabular-nums font-bold text-slate-800"><MoneyText value={b.total_value} /></td>
                  <td className="p-4 text-right flex justify-end items-center gap-2">
                    <button onClick={() => handleReprint(b)} className="text-blue-600 hover:text-blue-800 text-xs font-bold bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors">
                      Cetak Ulang
                    </button>
                    <button onClick={() => setDeleteTarget(b.id)} className="text-rose-500 hover:text-rose-700 p-1.5 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors" title="Hapus Riwayat">
                      <Trash2 size={14} />
                    </button>
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
              <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus Riwayat BAOP</h3>
              <p className="text-sm text-slate-500 font-medium">
                Apakah Anda yakin ingin menghapus data riwayat ini? Tindakan ini tidak dapat dibatalkan dan akan menghapus data secara permanen.
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-end border-t border-slate-100">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Batal</button>
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