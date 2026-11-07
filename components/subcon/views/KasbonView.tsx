'use client';

import { useState, useEffect } from 'react';
import { Printer, FileText, Loader2, Save, Settings } from 'lucide-react';
import { createKasbonRequest, getAllKasbonHistory } from '@/lib/services/subcon.service';
import { MoneyText } from '@/components/ui/MoneyText';
import { SignatureItem } from '@/lib/types/subcon';
import { SignatureSettings } from '@/components/shared/SignatureSettings';

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
    contractId: '',
    no_form: `REQ-KL/PLBJ/${currentMonthRoman.toUpperCase()}/${new Date().getFullYear()}`,
    tanggal: new Date().toISOString().split('T')[0],
    metode: 'Transfer',
    nominal: 0,
    tujuan: '1. Pembayaran Upah Tenaga Kerja Mingguan\n2. Pembelian Material Darurat & Mobilisasi Alat Bantu',
    rekening: '',
    vendor_name: ''
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
        ...prev,
        contractId: id,
        rekening: `${spk.bank_name || 'Bank'} - A/C: ${spk.bank_account || '-'} a.n ${spk.subcontractor_name || '-'}`,
        vendor_name: spk.subcontractor_name
      }));
    } else {
      setForm(prev => ({ ...prev, contractId: '', rekening: '', vendor_name: '' }));
    }
  };

  const handleSave = async () => {
    if (!selectedSPK) return showToast('Pilih Mandor / SPK terlebih dahulu', 'error');
    if (form.nominal <= 0) return showToast('Nominal kasbon harus lebih dari 0', 'error');

    setLoading(true);
    try {
      await createKasbonRequest({
        project_id: projectId,
        contract_id: selectedSPK.id,
        payment_number: form.no_form,
        payment_date: form.tanggal,
        amount: form.nominal,
        description: form.tujuan,
        payment_method: form.metode,
        bank_account: form.rekening,
        signatures: signatures // <-- FIXED: Added comma
      });

      showToast('Pengajuan Kasbon berhasil disimpan (Pending)', 'success');
      
      await loadHistory();
      setIsReprint(false);
      
      setForm({
        contractId: selectedSPK.id,
        no_form: `REQ-KL/PLBJ/${currentMonthRoman.toUpperCase()}/${new Date().getFullYear()}`,
        tanggal: new Date().toISOString().split('T')[0],
        metode: 'Transfer',
        nominal: 0,
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
      a.download = `Kasbon_${form.no_form.replace(/\//g, '_')}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);

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
      contractId: item.contract_id,
      no_form: item.payment_number,
      tanggal: item.payment_date,
      metode: 'Transfer',
      nominal: item.amount,
      tujuan: item.description,
      rekening: `${item.subcontractor_contracts?.subcontractors?.company_name || 'Bank'} - A/C: -`,
      vendor_name: item.subcontractor_contracts?.subcontractors?.company_name || ''
    });

    if (item.signatures) {
      setSignatures(item.signatures);
    }

    setIsReprint(true);
  };

  return (
    <div className="space-y-6">
      
      {/* FORM INPUT */}
      <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4 print:hidden">
        <div className="flex justify-between items-center border-b pb-2 mb-2">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <FileText className="text-emerald-600" /> Formulir Pengajuan Kasbon Mandor
          </h3>
          <button onClick={() => setShowSigSettings(!showSigSettings)} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-md">
            <Settings size={16} /> Pengaturan Tanda Tangan
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold mb-1 text-slate-700">Pilih Mandor / SPK</label>
            <select value={form.contractId} onChange={handleSelectSPK} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="">-- Pilih Mandor --</option>
              {spks.map(s => <option key={s.id} value={s.id}>{s.subcontractor_name} - {s.spk_number}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-slate-700">No. Form</label>
            <input type="text" value={form.no_form} onChange={e => setForm({...form, no_form: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" disabled={isReprint} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-slate-700">Tanggal Pengajuan</label>
            <input type="date" value={form.tanggal} onChange={e => setForm({...form, tanggal: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" disabled={isReprint} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-slate-700">Metode Pembayaran</label>
            <select value={form.metode} onChange={e => setForm({...form, metode: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" disabled={isReprint}>
              <option value="Transfer">Transfer Bank</option>
              <option value="Tunai">Tunai (Cash)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-bold mb-1 text-slate-700">Jumlah Nominal Kasbon (Rp)</label>
            <input type="number" value={form.nominal === 0 ? '' : form.nominal} onChange={e => setForm({...form, nominal: Number(e.target.value)})} className="w-full border border-amber-300 bg-amber-50 rounded-lg p-2 text-lg font-bold focus:ring-2 focus:ring-amber-500 outline-none" placeholder="0" disabled={isReprint} />
            <p className="text-xs text-emerald-700 font-bold mt-1 italic">Terbilang: {form.nominal === 0 ? 'Nol' : terbilang(form.nominal)} Rupiah</p>
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-bold mb-1 text-slate-700">Tujuan Penggunaan Dana</label>
            <textarea rows={2} value={form.tujuan} onChange={e => setForm({...form, tujuan: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" disabled={isReprint} />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-bold mb-1 text-slate-700">Detail Rekening Penerima</label>
            <input type="text" value={form.rekening} onChange={e => setForm({...form, rekening: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" disabled={isReprint} />
          </div>
        </div>

        {showSigSettings && (
          <SignatureSettings signatures={signatures} onChange={setSignatures} colorTheme="emerald" />
        )}

        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
          {isReprint && (
             <button onClick={() => setIsReprint(false)} className="px-6 py-2.5 bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-bold shadow-md transition-colors">
               Batal Cetak Ulang
             </button>
          )}
          {!isReprint && (
            <button onClick={handleSave} disabled={loading || !selectedSPK} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-md transition-colors">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} Simpan Pengajuan
            </button>
          )}
          <button onClick={handlePrint} disabled={loading || !selectedSPK} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-md transition-colors">
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Printer size={20} />} Cetak PDF
          </button>
        </div>
      </div>

      {/* PREVIEW AREA (Web UI) */}
      {selectedSPK && (
        <div className="w-full flex flex-col items-center pb-10 bg-slate-200 p-6 rounded-xl print:hidden">
          <p className="text-xs text-center text-slate-500 mb-4 font-bold tracking-widest uppercase">Pratinjau Dokumen A4 Landscape</p>
          
          <div className="w-[297mm] bg-white p-8 shadow-2xl border border-slate-300">
             
             <div className="text-center border-b-2 border-black pb-3 mb-4">
                {projectData?.logo_url && <img src={projectData.logo_url} alt="Logo" style={{ maxHeight: '45px', margin: '0 auto 5px' }} />}
                <h1 className="text-xl font-bold uppercase m-0">{projectData?.company_name || 'PT. NAMA PERUSAHAAN'}</h1>
                <p className="text-sm m-0">{projectData?.contractor_address || 'Alamat Perusahaan'}</p>
                <p className="text-sm m-0">GENERAL CONTRACTOR & SUPPLIER</p>
             </div>

             <div id="kasbon-print-area" style={{ border: '2px solid #0f766e', borderRadius: '8px', padding: '20px 30px', display: 'flex', flexDirection: 'column' }}>
                
                <div style={{ textAlign: 'center', fontSize: '15pt', fontWeight: 'bold', color: '#0f766e', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  FORMULIR PENGAJUAN KASBON MANDOR
                </div>
                <div style={{ textAlign: 'center', fontSize: '10pt', fontWeight: 'bold', color: '#0f766e', marginBottom: '20px' }}>
                  (ADVANCE PAYMENT REQUEST)
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px', tableLayout: 'fixed' }}>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 'bold', width: '20%', backgroundColor: '#f8fafc', border: '1px solid #64748b', padding: '8px 12px' }}>Nama Mandor / Perusahaan:</td>
                      <td style={{ border: '1px solid #64748b', padding: '8px 12px', width: '30%' }}>{form.vendor_name}</td>
                      <td style={{ fontWeight: 'bold', width: '15%', backgroundColor: '#f8fafc', border: '1px solid #64748b', padding: '8px 12px' }}>No. Form:</td>
                      <td style={{ border: '1px solid #64748b', padding: '8px 12px', width: '35%' }}>{form.no_form}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc', border: '1px solid #64748b', padding: '8px 12px' }}>Nama Proyek & Lokasi:</td>
                      <td style={{ border: '1px solid #64748b', padding: '8px 12px' }}>{projectData?.name} - {projectData?.location}</td>
                      <td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc', border: '1px solid #64748b', padding: '8px 12px' }}>Tanggal:</td>
                      <td style={{ border: '1px solid #64748b', padding: '8px 12px' }}>{new Date(form.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc', border: '1px solid #64748b', padding: '8px 12px' }}>Nomor SPK:</td>
                      <td style={{ border: '1px solid #64748b', padding: '8px 12px' }}>{selectedSPK.spk_number}</td>
                      <td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc', border: '1px solid #64748b', padding: '8px 12px' }}>Metode:</td>
                      <td style={{ border: '1px solid #64748b', padding: '8px 12px' }}>{form.metode === 'Transfer' ? 'Transfer Bank [✓] Tunai [ ]' : 'Transfer Bank [ ] Tunai [✓]'}</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ fontWeight: 'bold', color: '#0f766e', marginBottom: '10px', fontSize: '11pt', textTransform: 'uppercase', marginTop: '5px' }}>I. RINCIAN PERMOHONAN DANA & ALOKASI AKUNTANSI</div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', tableLayout: 'fixed' }}>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 'bold', width: '20%', backgroundColor: '#f8fafc', border: '1px solid #64748b', padding: '8px 12px' }}>Jumlah Nominal Kasbon</td>
                      <td style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '11pt', border: '1px solid #64748b', padding: '8px 12px' }}>Rp {form.nominal.toLocaleString('id-ID')}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc', border: '1px solid #64748b', padding: '8px 12px' }}>Terbilang</td>
                      <td style={{ fontStyle: 'italic', border: '1px solid #64748b', padding: '8px 12px' }}>{form.nominal === 0 ? 'Nol' : terbilang(form.nominal)} Rupiah</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc', border: '1px solid #64748b', padding: '8px 12px' }}>Tujuan Penggunaan Dana</td>
                      <td style={{ whiteSpace: 'pre-wrap', border: '1px solid #64748b', padding: '8px 12px' }}>{form.tujuan}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', backgroundColor: '#f8fafc', border: '1px solid #64748b', padding: '8px 12px' }}>Detail Rekening Penerima</td>
                      <td style={{ border: '1px solid #64748b', padding: '8px 12px' }}>{form.rekening}</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                    <tbody>
                      <tr>
                        {signatures.map((sig, idx) => (
                          <td key={idx} style={{ width: '20%', verticalAlign: 'bottom', padding: '0 5px', border: 'none' }}>
                            <div style={{ marginBottom: '60px', fontWeight: 'bold', fontSize: '10pt', whiteSpace: 'pre-wrap' }}>{sig.title}</div>
                            <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '2px', fontSize: '10pt' }}>{sig.name}</div>
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
      <div className="bg-white border rounded-xl shadow-sm overflow-x-auto mt-10">
        <div className="p-4 border-b bg-slate-50 font-bold text-slate-700 flex justify-between items-center">
          <span>Riwayat Seluruh Pengajuan Kasbon Proyek</span>
          {loadingHistory && <Loader2 className="animate-spin text-slate-500" size={16} />}
        </div>
        <table className="w-full text-left text-sm min-w-[800px]">
          <thead className="bg-slate-50 text-slate-600 border-b">
            <tr>
              <th className="p-4 border-b">No. Form</th>
              <th className="p-4 border-b">Tanggal</th>
              <th className="p-4 border-b">Mandor</th>
              <th className="p-4 border-b">Tujuan</th>
              <th className="p-4 border-b">Nominal</th>
              <th className="p-4 border-b">Status</th>
              <th className="p-4 border-b text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id} className="hover:bg-slate-50 border-b last:border-0">
                <td className="p-4 font-bold text-emerald-700">{h.payment_number}</td>
                <td className="p-4">{new Date(h.payment_date).toLocaleDateString('id-ID')}</td>
                <td className="p-4 font-medium">{h.subcontractor_contracts?.subcontractors?.company_name || '-'}</td>
                <td className="p-4 text-slate-500 max-w-xs truncate">{h.description}</td>
                <td className="p-4 font-bold"><MoneyText value={h.amount} /></td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${h.status === 'Pending' || !h.status ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                    {h.status || 'Pending'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => handleReprint(h)} className="text-blue-600 hover:underline text-xs font-medium bg-blue-50 px-3 py-1.5 rounded">
                    Lihat / Cetak Ulang
                  </button>
                </td>
              </tr>
            ))}
            {history.length === 0 && !loadingHistory && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                  Belum ada riwayat pengajuan kasbon untuk proyek ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}