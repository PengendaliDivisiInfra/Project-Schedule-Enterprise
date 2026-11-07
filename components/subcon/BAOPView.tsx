'use client';

import { useState, useEffect } from 'react';
import { Printer, FileText, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { getBAOPData, saveBAOPDocument, getBAOPHistory, deleteBAOPDocument } from '@/lib/services/subcon.service';
import { MoneyText } from '@/components/ui/MoneyText';

interface BAOPViewProps {
  projectId: string;
  spks: any[];
  onSuccess: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

function terbilang(angka: number): string {
  // PERBAIKAN: Handle angka 0
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
  
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReprint, setIsReprint] = useState(false);

  const currentMonthRoman = new Date().toLocaleString('id-ID', { month: 'long' });
  
  const [form, setForm] = useState({
    contractId: '',
    nomorBAOP: `001/KL-BAOP/BKP/${currentMonthRoman.toUpperCase()}/${new Date().getFullYear()}`,
    tglMulai: new Date().toISOString().split('T')[0],
    tglSelesai: new Date().toISOString().split('T')[0],
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

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contractId) {
      showToast('Pilih Mandor terlebih dahulu', 'error');
      return;
    }
    
    setIsReprint(false);
    setLoading(true);
    try {
      const res = await getBAOPData(form.contractId, form.tglMulai, form.tglSelesai);
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
      tglMulai: item.period_start,
      tglSelesai: item.period_end
    });

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
    if (!printElement) return;

    try {
      setLoading(true);
      
      if (!isReprint) {
        await saveBAOPDocument({
          project_id: projectId,
          contract_id: form.contractId,
          baop_number: form.nomorBAOP,
          period_start: form.tglMulai,
          period_end: form.tglSelesai,
          total_value: totalNilaiOpname
        });
      }

      const htmlContent = printElement.innerHTML;
      
      // CSS LEBIH KETAT AGAR TANDA TANGAN MASUK KE HALAMAN 1
      const fullHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { size: A4 portrait; margin: 10mm 15mm; } /* Margin diperkecil */
              body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; font-family: 'Times New Roman', Times, serif; font-size: 10.5pt; color: #000; line-height: 1.3; } /* Font sedikit dikecilkan & line-height dirapatkan */
              
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
              
              /* KUNCI TANDA TANGAN */
              .sig-area { width: 100%; margin-top: 25px; page-break-inside: avoid; }
              .sig-table { width: 100%; border-collapse: collapse; text-align: center; }
              .sig-table td { width: 50%; vertical-align: bottom; padding: 0 10px; }
              .sig-space { height: 60px; } /* Jarak TTD dirapatkan dari 80px ke 60px */
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
      await deleteBAOPDocument(deleteTarget);
      showToast('Riwayat BAOP berhasil dihapus', 'success');
      loadHistory();
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

  // CSS UNTUK TAMPILAN WEB (SAMA DENGAN PDF)
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

      {/* FORM INPUT */}
      <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4 print:hidden">
        <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-2 flex items-center gap-2">
          <FileText className="text-amber-600" /> Buat Dokumen BAOP Baru
        </h3>
        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-bold mb-1 text-slate-700">Pilih Mandor / SPK</label>
            <select value={form.contractId} onChange={(e) => setForm({...form, contractId: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none">
              <option value="">-- Pilih Mandor --</option>
              {spks.map(s => <option key={s.id} value={s.id}>{s.subcontractor_name} - {s.spk_number}</option>)}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-bold mb-1 text-slate-700">Nomor BAOP</label>
            <input type="text" value={form.nomorBAOP} onChange={(e) => setForm({...form, nomorBAOP: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-slate-700">Tgl Mulai</label>
            <input type="date" value={form.tglMulai} onChange={(e) => setForm({...form, tglMulai: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1 text-slate-700">Tgl Selesai</label>
            <input type="date" value={form.tglSelesai} onChange={(e) => setForm({...form, tglSelesai: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
          </div>
          <div className="md:col-span-4 flex justify-end mt-2">
            <button type="submit" disabled={loading} className="px-6 bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />} Tampilkan Pratinjau
            </button>
          </div>
        </form>
      </div>

      {/* PREVIEW AREA (UI) */}
      {data && (
        <div className="w-full flex flex-col items-center pb-10">
          <div className="bg-white shadow-xl" style={{ width: '210mm' }}>
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
                  Pada hari ini, <b>{new Date(form.tglSelesai).toLocaleDateString('id-ID', { weekday: 'long' })}</b> tanggal <b>{new Date(form.tglSelesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</b>, 
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
                  untuk periode {new Date(form.tglMulai).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} s/d {new Date(form.tglSelesai).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}, 
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
             <button onClick={handlePrint} disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 shadow-md transition-colors">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Printer size={20} />} {isReprint ? 'Cetak Ulang PDF' : 'Cetak & Simpan BAOP'}
            </button>
          </div>
        </div>
      )}

      {/* HISTORY TABLE */}
      <div className="bg-white border rounded-xl shadow-sm overflow-x-auto print:hidden mt-10">
        <div className="p-4 border-b bg-slate-50 font-bold text-slate-700">Riwayat Pembuatan BAOP</div>
        <table className="w-full text-left text-sm min-w-[800px]">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-4 border-b">No. BAOP</th>
              <th className="p-4 border-b">Tanggal Dibuat</th>
              <th className="p-4 border-b">Vendor / SPK</th>
              <th className="p-4 border-b">Periode</th>
              <th className="p-4 border-b">Total Nilai</th>
              <th className="p-4 border-b text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {history.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className="p-4 border-b font-bold text-amber-700">{b.baop_number}</td>
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
            {history.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Belum ada riwayat BAOP.</td></tr>}
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
              <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus Riwayat BAOP</h3>
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