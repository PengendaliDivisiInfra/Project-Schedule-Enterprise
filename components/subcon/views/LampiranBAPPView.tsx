'use client';

import { useState, useEffect } from 'react';
import { Printer, FileText, Loader2, Settings, Calculator } from 'lucide-react';
import { getBAPPData, getBPUTKData, getBAPPHistory } from '@/lib/services/subcon.service';
import { hitungSAK } from '@/lib/utils/sak-calculator';
import { MoneyText } from '@/components/ui/MoneyText';
import { SignatureItem } from '@/lib/types/subcon';
import { SignatureSettings } from '@/components/shared/SignatureSettings';

export function LampiranBAPPView({ projectId, spks, showToast }: { projectId: string, spks: any[], showToast: any }) {
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [bappHistory, setBappHistory] = useState<any[]>([]);
  const [selectedBapp, setSelectedBapp] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [sakResult, setSakResult] = useState<any>(null);

  const [showSigSettings, setShowSigSettings] = useState(false);
  const [signatures, setSignatures] = useState<SignatureItem[]>([
    { title: 'Direksi', name: 'RIZQI BILLAH BASALAMAH' },
    { title: 'KA. Divisi Infra', name: 'MEI SUNARKO' },
    { title: 'Ass. Divisi Infra', name: 'ARIF DARMAWAN' },
    { title: 'Ka. Pembelian', name: 'M. MAULIDIN' },
    { title: 'Site Engineer', name: 'SAIFUDDIN FAHMI' },
    { title: 'Direktur / Mandor', name: 'HAERUL' },
  ]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await getBAPPHistory(projectId);
        setBappHistory(res || []);
      } catch (error: any) {
        showToast('Gagal memuat riwayat BAPP: ' + error.message, 'error');
      } finally {
        setLoadingHistory(false);
      }
    };
    loadHistory();
  }, [projectId]);

  const handleSelectBAPP = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const bappId = e.target.value;
    if (!bappId) {
      setSelectedBapp(null);
      setData(null);
      setSakResult(null);
      return;
    }

    const bapp = bappHistory.find(b => b.id === bappId);
    setSelectedBapp(bapp);

    if (bapp) {
      setLoading(true);
      try {
        const [bappRes, bputkRes] = await Promise.all([
          getBAPPData(bapp.contract_id, bapp.period_start, bapp.period_end),
          getBPUTKData(bapp.contract_id, bapp.period_start, bapp.period_end)
        ]);
        setData({ bapp: bappRes, bputk: bputkRes });

        if (bappRes.contract.subcontractors?.contact_person) {
          setSignatures(prev => {
            const newSigs = [...prev];
            newSigs[5].name = bappRes.contract.subcontractors.contact_person.toUpperCase();
            return newSigs;
          });
        }

        const hitung = hitungSAK({
          bruttoSd: bappRes.totalOpnameSdIni,
          nilaiKontrak: bappRes.contract.contract_value,
          nilaiDP: bappRes.nilaiDP,
          pphRate: bappRes.contract.pph_pct || 2,
          ppnRate: bappRes.contract.ppn_pct || 11,
          retensiRate: bappRes.contract.retention_pct || 5,
          kasbonDeduct: bappRes.totalPotongan,
          taxMode: bappRes.contract.tax_mode || 'EXCLUDE'
        });
        setSakResult(hitung);
        
      } catch (error: any) {
        showToast(error.message, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const getTimeline = () => {
    if (!data) return [];
    const events: any[] = [];
    data.bapp.opnames.forEach((o: any) => events.push({ date: o.opname_date, type: 'OPNAME', amount: Number(o.total), ...o }));
    data.bapp.kasbons.forEach((k: any) => events.push({ date: k.log_date, type: 'KASBON', amount: Number(k.amount), ...k }));
    data.bapp.potongan.forEach((p: any) => events.push({ date: p.log_date, type: 'POTONGAN', amount: Number(p.amount), ...p }));
    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const timeline = getTimeline();

  const handlePrint = async () => {
    const printArea = document.getElementById('lampiran-bapp-print-area');
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
              @page { size: A3 landscape; margin: 10mm 15mm; }
              body { margin: 0; padding: 0; background: #fff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10.5pt; color: #1e293b; }
              
              /* CONTAINER A3 LANDSCAPE - MENGGUNAKAN FLEXBOX */
              .container { border: 2px solid #0f766e; border-radius: 8px; padding: 25px 35px; height: 275mm; box-sizing: border-box; display: flex; flex-direction: column; }
              
              .header-kop { text-align: center; border-bottom: 3px double #0f766e; padding-bottom: 10px; margin-bottom: 20px; }
              .header-kop img { max-height: 50px; margin-bottom: 5px; display: block; margin: 0 auto; }
              .header-kop h1 { margin: 0; font-size: 18pt; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 1px; }
              .header-kop p { margin: 2px 0; font-size: 9.5pt; color: #475569; }
              .header-title { text-align: center; font-size: 13pt; font-weight: bold; color: #0f766e; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px; }
              .header-subtitle { text-align: center; font-size: 11pt; font-weight: bold; margin-bottom: 20px; color: #334155; }
              
              .hide-on-print { display: none !important; }
              
              /* TABEL DATA */
              .data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9.5pt; }
              .data-table th { background-color: #f1f5f9; color: #0f766e; text-align: center; font-weight: bold; padding: 8px; border-bottom: 2px solid #0f766e; border-top: 1px solid #cbd5e1; border-left: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1; }
              .data-table td { padding: 8px; border-bottom: 1px solid #e2e8f0; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; }
              .data-table tr:nth-child(even) { background-color: #f8fafc; }
              
              .text-right { text-align: right; } .text-center { text-align: center; } .font-bold { font-weight: bold; }
              
              /* LAYOUT 3 KARTU */
              .card-table { width: 100%; border-collapse: separate; border-spacing: 15px 0; margin-left: -15px; margin-right: -15px; table-layout: fixed; margin-bottom: 30px; }
              .card-td { vertical-align: top; height: 100%; }
              .card-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; background: #fff; height: 100%; box-sizing: border-box; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; flex-direction: column; }
              .card-title { font-weight: bold; color: #0f766e; font-size: 10.5pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 10px; }
              
              /* TANDA TANGAN - MARGIN TOP FIX AGAR TIDAK JAUH KE BAWAH */
              .sig-table { width: 100%; margin-top: auto; border-collapse: collapse; table-layout: fixed; page-break-inside: avoid; }
              .sig-table td { border: none; vertical-align: bottom; text-align: center; padding: 0 5px; width: 16.66%; }
              .sig-space { height: 65px; }
              .sig-line { border-top: 1px solid #64748b; width: 90%; margin: 0 auto 6px auto; }
              .sig-name { font-weight: bold; font-size: 9.5pt; color: #0f172a; word-wrap: break-word; line-height: 1.2; }
              .sig-title { font-size: 8.5pt; color: #475569; margin-bottom: 5px; }
            </style>
          </head>
          <body><div class="container">${htmlContent}</div></body>
        </html>
      `;
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: fullHtml, format: 'A3', isLandscape: true })
      });
      if (!res.ok) throw new Error('Gagal generate PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Lampiran_BAPP_${selectedBapp?.bapp_number.replace(/\//g, '_')}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fRp = (val: number) => new Intl.NumberFormat('id-ID').format(val);

  return (
    <div className="space-y-6">
      {/* FORM INPUT */}
      <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4 print:hidden">
        <div className="flex justify-between items-center border-b pb-2 mb-2">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <FileText className="text-teal-600" /> Lampiran BAPP (Rekapitulasi)
          </h3>
          <button onClick={() => setShowSigSettings(!showSigSettings)} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-md transition-colors">
            <Settings size={16} /> Pengaturan Tanda Tangan
          </button>
        </div>
        
        <div>
          <label className="block text-sm font-bold mb-1 text-slate-700">Pilih Dokumen BAPP</label>
          <select 
            value={selectedBapp?.id || ''} 
            onChange={handleSelectBAPP} 
            className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
            disabled={loadingHistory}
          >
            <option value="">{loadingHistory ? 'Memuat data...' : '-- Pilih No. BAPP --'}</option>
            {bappHistory.map(b => (
              <option key={b.id} value={b.id}>
                {b.bapp_number} | {b.subcontractor_contracts?.subcontractors?.company_name} | {new Date(b.period_start).toLocaleDateString('id-ID')} - {new Date(b.period_end).toLocaleDateString('id-ID')}
              </option>
            ))}
          </select>
        </div>

        {showSigSettings && (
          <SignatureSettings signatures={signatures} onChange={setSignatures} colorTheme="teal" />
        )}
      </div>

      {loading && (
        <div className="w-full flex justify-center p-12">
          <Loader2 className="animate-spin text-teal-600" size={32} />
        </div>
      )}

      {!loading && data && sakResult && (
        <div className="w-full flex flex-col items-center pb-10 overflow-x-auto bg-slate-200 p-6 rounded-xl print:bg-white print:p-0">
          <div className="w-[420mm] bg-white p-10 shadow-2xl border border-slate-300">
            
            {/* WEB PREVIEW (DISAMAKAN PERSIS DENGAN PDF) */}
            <div id="lampiran-bapp-print-area" style={{ display: 'flex', flexDirection: 'column', minHeight: '245mm' }}>
              
              {/* KOP SURAT */}
              <div style={{ textAlign: 'center', borderBottom: '3px double #0f766e', paddingBottom: '10px', marginBottom: '20px' }}>
                {data.bapp.contract.projects?.logo_url && (
                  <img src={data.bapp.contract.projects.logo_url} alt="Logo" style={{ maxHeight: '50px', margin: '0 auto 5px', display: 'block' }} />
                )}
                <h1 style={{ margin: 0, fontSize: '18pt', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', letterSpacing: '1px' }}>{data.bapp.contract.projects?.company_name || 'PT. NAMA PERUSAHAAN'}</h1>
                <p style={{ margin: '2px 0', fontSize: '9.5pt', color: '#475569' }}>{data.bapp.contract.projects?.contractor_address || 'Alamat Perusahaan'}</p>
                <p style={{ margin: '2px 0', fontSize: '9.5pt', color: '#475569', textTransform: 'uppercase' }}>GENERAL CONTRACTOR & SUPPLIER</p>
              </div>

              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '13pt', fontWeight: 'bold', color: '#0f766e', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>LAMPIRAN BERITA ACARA PEMBAYARAN PRESTASI (BAPP)</h2>
                <p style={{ fontSize: '11pt', fontWeight: 'bold', marginTop: '5px', color: '#334155' }}>NO. {selectedBapp?.bapp_number || '-'}</p>
              </div>
              
              {/* IDENTITAS */}
              <table style={{ width: '100%', marginBottom: '20px', fontSize: '9.5pt', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '20px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr><td style={{ fontWeight: 'bold', color: '#475569', padding: '3px 0', width: '100px' }}>1. Nama</td><td style={{ padding: '3px 0', width: '15px' }}>:</td><td style={{ padding: '3px 0' }}>{data.bapp.contract.projects?.contractor_pic_name}</td></tr>
                          <tr><td style={{ fontWeight: 'bold', color: '#475569', padding: '3px 0' }}>Jabatan</td><td style={{ padding: '3px 0' }}>:</td><td style={{ padding: '3px 0' }}>{data.bapp.contract.projects?.contractor_pic_title}</td></tr>
                          <tr><td style={{ fontWeight: 'bold', color: '#475569', padding: '3px 0' }}>2. Nama</td><td style={{ padding: '3px 0' }}>:</td><td style={{ padding: '3px 0' }}>{data.bapp.contract.subcontractors?.contact_person}</td></tr>
                          <tr><td style={{ fontWeight: 'bold', color: '#475569', padding: '3px 0' }}>Jabatan</td><td style={{ padding: '3px 0' }}>:</td><td style={{ padding: '3px 0' }}>Mandor / Direktur</td></tr>
                        </tbody>
                      </table>
                    </td>
                    <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '20px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr><td style={{ fontWeight: 'bold', color: '#475569', padding: '3px 0', width: '100px' }}>No SPK</td><td style={{ padding: '3px 0', width: '15px' }}>:</td><td style={{ padding: '3px 0' }}>{data.bapp.contract.spk_number}</td></tr>
                          <tr><td style={{ fontWeight: 'bold', color: '#475569', padding: '3px 0' }}>Nilai SPK</td><td style={{ padding: '3px 0' }}>:</td><td style={{ padding: '3px 0' }}>Rp {fRp(data.bapp.contract.contract_value)}</td></tr>
                          <tr><td style={{ fontWeight: 'bold', color: '#475569', padding: '3px 0' }}>TOTAL</td><td style={{ padding: '3px 0' }}>:</td><td style={{ padding: '3px 0', fontWeight: 'bold' }}>Rp {fRp(data.bapp.contract.contract_value)}</td></tr>
                        </tbody>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* BAGIAN A: TIMELINE */}
              <div style={{ fontWeight: 'bold', color: '#0f766e', fontSize: '9.5pt', marginBottom: '5px' }}>A. Perhitungan Opname dan Realisasi Pembayaran Opname :</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '9pt', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ backgroundColor: '#f1f5f9', color: '#0f766e', padding: '8px', borderBottom: '2px solid #0f766e', borderTop: '1px solid #cbd5e1', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', width: '40px' }}>No</th>
                    <th colSpan={4} style={{ backgroundColor: '#f1f5f9', color: '#0f766e', padding: '8px', borderBottom: '1px solid #cbd5e1', borderTop: '1px solid #cbd5e1', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1' }}>OPNAME PEKERJAAN</th>
                    <th colSpan={2} style={{ backgroundColor: '#f1f5f9', color: '#0f766e', padding: '8px', borderBottom: '1px solid #cbd5e1', borderTop: '1px solid #cbd5e1', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1' }}>KASBON, K3, ALAT DLL</th>
                    <th colSpan={2} style={{ backgroundColor: '#f1f5f9', color: '#0f766e', padding: '8px', borderBottom: '1px solid #cbd5e1', borderTop: '1px solid #cbd5e1', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1' }}>POTONGAN KASBON, K3, ALAT DLL</th>
                    <th colSpan={2} style={{ backgroundColor: '#f1f5f9', color: '#0f766e', padding: '8px', borderBottom: '2px solid #0f766e', borderTop: '1px solid #cbd5e1', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1' }}>SISA PEMBAYARAN</th>
                  </tr>
                  <tr>
                    <th style={{ backgroundColor: '#f8fafc', padding: '6px', borderBottom: '2px solid #0f766e', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '8.5pt' }}>Tanggal</th>
                    <th style={{ backgroundColor: '#f8fafc', padding: '6px', borderBottom: '2px solid #0f766e', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '8.5pt' }}>Jumlah (Rp)</th>
                    <th style={{ backgroundColor: '#f8fafc', padding: '6px', borderBottom: '2px solid #0f766e', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '8.5pt' }}>Retensi %</th>
                    <th style={{ backgroundColor: '#f8fafc', padding: '6px', borderBottom: '2px solid #0f766e', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '8.5pt' }}>Opname - Retensi</th>
                    <th style={{ backgroundColor: '#f8fafc', padding: '6px', borderBottom: '2px solid #0f766e', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '8.5pt' }}>Tanggal</th>
                    <th style={{ backgroundColor: '#f8fafc', padding: '6px', borderBottom: '2px solid #0f766e', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '8.5pt' }}>Jumlah (Rp)</th>
                    <th style={{ backgroundColor: '#f8fafc', padding: '6px', borderBottom: '2px solid #0f766e', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '8.5pt' }}>Tanggal</th>
                    <th style={{ backgroundColor: '#f8fafc', padding: '6px', borderBottom: '2px solid #0f766e', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '8.5pt' }}>Jumlah (Rp)</th>
                    <th style={{ backgroundColor: '#f8fafc', padding: '6px', borderBottom: '2px solid #0f766e', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '8.5pt' }}>Jumlah (Rp)</th>
                    <th style={{ backgroundColor: '#f8fafc', padding: '6px', borderBottom: '2px solid #0f766e', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', fontWeight: 'bold', fontSize: '8.5pt' }}>Bobot (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((tx: any, idx: number) => {
                    const isOpname = tx.type === 'OPNAME';
                    const isKasbon = tx.type === 'KASBON';
                    const isPotongan = tx.type === 'POTONGAN';
                    const sisa = isOpname ? tx.amount : 0;

                    return (
                      <tr key={idx} style={{ textAlign: 'center', backgroundColor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                        <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{idx + 1}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{isOpname ? new Date(tx.date).toLocaleDateString('id-ID') : ''}</td>
                        <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{isOpname ? fRp(tx.amount) : ''}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{isOpname ? `${data.bapp.contract.retention_pct}%` : ''}</td>
                        <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{isOpname ? fRp(tx.amount * (1 - data.bapp.contract.retention_pct/100)) : ''}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{isKasbon ? new Date(tx.date).toLocaleDateString('id-ID') : ''}</td>
                        <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{isKasbon ? fRp(tx.amount) : ''}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{isPotongan ? new Date(tx.date).toLocaleDateString('id-ID') : ''}</td>
                        <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{isPotongan ? fRp(tx.amount) : ''}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: sisa < 0 ? '#dc2626' : '#000', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{isOpname ? fRp(sisa) : ''}</td>
                        <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{isOpname ? ((tx.amount / data.bapp.contract.contract_value) * 100).toFixed(2) + '%' : ''}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold', textAlign: 'center' }}>
                    <td colSpan={4} style={{ padding: '10px 8px', borderBottom: '2px solid #0f766e', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', color: '#0f766e' }}>TOTAL</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '2px solid #0f766e', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', color: '#0f766e' }}>{fRp(data.bapp.totalOpnameSdIni)}</td>
                    <td colSpan={2} style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '2px solid #0f766e', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', color: '#0f766e' }}>{fRp(data.bputk.totalKasbon)}</td>
                    <td colSpan={2} style={{ padding: '10px 8px', textAlign: 'right', borderBottom: '2px solid #0f766e', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', color: '#0f766e' }}>{fRp(data.bputk.totalPotongan)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#059669', borderBottom: '2px solid #0f766e', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1' }}>{fRp(data.bapp.totalOpnameSdIni - data.bputk.totalPotongan)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: '#0f766e', borderBottom: '2px solid #0f766e', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1' }}>100%</td>
                  </tr>
                </tbody>
              </table>

              {/* BAGIAN B: RUMUS SAK (HANYA TAMPIL DI WEB) */}
              <div style={{ fontWeight: 'bold', color: '#0f766e', fontSize: '9.5pt', marginBottom: '5px' }}>B. Rekapitulasi Pembayaran :</div>
              
              <div className="hide-on-print" style={{ border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderRadius: '8px', padding: '15px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #cbd5e1', paddingBottom: '8px', marginBottom: '12px' }}>
                  <Calculator size={16} className="text-teal-700" />
                  <h3 style={{ margin: 0, fontSize: '10.5pt', fontWeight: 'bold', color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rumus Perhitungan SAK & KUP</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ backgroundColor: '#ccfbf1', color: '#0f766e', fontWeight: 'bold', padding: '1px 6px', borderRadius: '4px', minWidth: '25px', textAlign: 'center', fontSize: '8.5pt' }}>A</span>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1e293b', fontSize: '9pt' }}>= Σ Nilai Opname Bruto</div>
                        <div style={{ fontSize: '7.5pt', color: '#64748b', fontStyle: 'italic' }}>SAK ETAP Bab 23</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ backgroundColor: '#ccfbf1', color: '#0f766e', fontWeight: 'bold', padding: '1px 6px', borderRadius: '4px', minWidth: '25px', textAlign: 'center', fontSize: '8.5pt' }}>B</span>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1e293b', fontSize: '9pt' }}>= %Progres × Nilai DP Awal</div>
                        <div style={{ fontSize: '7.5pt', color: '#64748b', fontStyle: 'italic' }}>Pengembalian Uang Muka proporsional</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ backgroundColor: '#ccfbf1', color: '#0f766e', fontWeight: 'bold', padding: '1px 6px', borderRadius: '4px', minWidth: '25px', textAlign: 'center', fontSize: '8.5pt' }}>C</span>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1e293b', fontSize: '9pt' }}>= A − B</div>
                        <div style={{ fontSize: '7.5pt', color: '#64748b', fontStyle: 'italic' }}>DPP sesuai UU PPN 42/2009</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ backgroundColor: '#ccfbf1', color: '#0f766e', fontWeight: 'bold', padding: '1px 6px', borderRadius: '4px', minWidth: '25px', textAlign: 'center', fontSize: '8.5pt' }}>D</span>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1e293b', fontSize: '9pt' }}>= C × {data.bapp.contract.ppn_pct}%</div>
                        <div style={{ fontSize: '7.5pt', color: '#64748b', fontStyle: 'italic' }}>PPN sesuai UU PPh No. 7/2021</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ backgroundColor: '#ccfbf1', color: '#0f766e', fontWeight: 'bold', padding: '1px 6px', borderRadius: '4px', minWidth: '25px', textAlign: 'center', fontSize: '8.5pt' }}>F</span>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1e293b', fontSize: '9pt' }}>= C × Tarif PPh {data.bapp.contract.pph_pct}%</div>
                        <div style={{ fontSize: '7.5pt', color: '#64748b', fontStyle: 'italic' }}>PP No. 9/2022</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ backgroundColor: '#ccfbf1', color: '#0f766e', fontWeight: 'bold', padding: '1px 6px', borderRadius: '4px', minWidth: '25px', textAlign: 'center', fontSize: '8.5pt' }}>R</span>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1e293b', fontSize: '9pt' }}>= C × Tarif Retensi {data.bapp.contract.retention_pct}%</div>
                        <div style={{ fontSize: '7.5pt', color: '#64748b', fontStyle: 'italic' }}>Perpres 16/2018 (bebas pajak)</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#0f766e', color: 'white', padding: '10px 15px', borderRadius: '6px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '10pt', letterSpacing: '1px', marginRight: '10px' }}>NET</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '10pt' }}>= (A − F + D) − R − K</span>
                  </div>
                </div>
              </div>

              {/* 3 KARTU REKAPITULASI */}
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '15px 0', marginLeft: '-15px', marginRight: '-15px', tableLayout: 'fixed', marginBottom: '20px' }}>
                <tbody>
                  <tr>
                    {/* KARTU 1: URAIAN OPNAME */}
                    <td style={{ width: '40%', height: '100%', verticalAlign: 'top' }}>
                      <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '15px', fontSize: '9pt', background: '#fff', height: '100%', boxSizing: 'border-box', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontWeight: 'bold', color: '#0f766e', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '10px', fontSize: '10pt' }}>Uraian Opname</div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span>Opname s/d saat ini <b style={{ color: '#0f766e', backgroundColor: '#f0fdfa', padding: '0 4px', borderRadius: '4px' }}>A</b></span><span style={{ fontWeight: 'bold' }}>{fRp(sakResult.A_bruto)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span>Retensi {data.bapp.contract.retention_pct}% dari DPP <b style={{ color: '#0f766e', backgroundColor: '#f0fdfa', padding: '0 4px', borderRadius: '4px' }}>R = C x {data.bapp.contract.retention_pct}%</b></span><span style={{ fontWeight: 'bold', color: '#dc2626' }}>-{fRp(sakResult.R_retensi)}</span></div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontWeight: 'bold', paddingTop: '6px', borderTop: '1px solid #e2e8f0', marginTop: '6px' }}><span>Total Opname dipotong retensi</span><span>{fRp(sakResult.A_bruto - sakResult.R_retensi)}</span></div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', marginTop: '10px' }}><span>Realisasi Pembayaran Lalu</span><span>0</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span>Potongan Kasbon s/d saat ini <b style={{ color: '#0f766e', backgroundColor: '#f0fdfa', padding: '0 4px', borderRadius: '4px' }}>K</b></span><span style={{ fontWeight: 'bold', color: '#dc2626' }}>-{fRp(sakResult.K_kasbon)}</span></div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontWeight: 'bold', paddingTop: '8px', borderTop: '1px solid #cbd5e1' }}><span>Sisa Pembayaran (Bruto)</span><span>{fRp(sakResult.A_bruto - sakResult.R_retensi - sakResult.K_kasbon)}</span></div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb', marginTop: '8px' }}><span>Ditambah: PPN <b style={{ backgroundColor: '#eff6ff', padding: '0 4px', borderRadius: '4px' }}>D = C x {data.bapp.contract.ppn_pct}%</b></span><span>+{fRp(sakResult.D_ppn)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}><span>Dikurangi: PPh <b style={{ backgroundColor: '#fef2f2', padding: '0 4px', borderRadius: '4px' }}>F = C x {data.bapp.contract.pph_pct}%</b></span><span>-{fRp(sakResult.F_pph42)}</span></div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5pt', fontWeight: 'bold', color: '#065f46', marginTop: 'auto', paddingTop: '10px', borderTop: '2px solid #059669', backgroundColor: '#f0fdfa', padding: '10px', borderRadius: '6px' }}>
                          <span>TOTAL YANG DIBAYARKAN (NETTO)</span>
                          <span>{fRp(sakResult.Net_transfer)}</span>
                        </div>
                      </div>
                    </td>
                    
                    {/* KARTU 2: URAIAN KASBON */}
                    <td style={{ width: '30%', height: '100%', verticalAlign: 'top' }}>
                      <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '15px', fontSize: '9pt', background: '#fff', height: '100%', boxSizing: 'border-box', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontWeight: 'bold', color: '#0f766e', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '10px', fontSize: '10pt' }}>Uraian Kasbon</div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span>Total Kasbon / Hutang</span><span style={{ fontWeight: 'bold' }}>{fRp(data.bputk.totalKasbon)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span>Total Potongan / Pengembalian</span><span style={{ fontWeight: 'bold', color: '#dc2626' }}>-{fRp(data.bputk.totalPotongan)}</span></div>
                        
                        <div style={{ marginTop: '5px', marginBottom: '10px', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '8pt', fontWeight: 'bold', color: '#64748b', marginBottom: '3px' }}>Detail Kasbon:</div>
                          {data.bapp.kasbons.length > 0 ? data.bapp.kasbons.map((k: any, i: number) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', color: '#475569', marginBottom: '2px' }}>
                              <span>{new Date(k.log_date).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})} - {k.description.substring(0, 15)}...</span>
                              <span>{fRp(k.amount)}</span>
                            </div>
                          )) : <div style={{ fontSize: '8pt', color: '#94a3b8', fontStyle: 'italic' }}>Tidak ada kasbon</div>}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 'auto', paddingTop: '10px', borderTop: '2px solid #fee2e2', backgroundColor: '#fef2f2', borderRadius: '6px', padding: '10px' }}>
                          <div style={{ fontSize: '8pt', color: '#dc2626', fontWeight: 'bold', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '1px' }}>Sisa Kasbon Mandor</div>
                          <div style={{ fontSize: '14pt', fontWeight: 'bold', color: '#991b1b' }}>{fRp(data.bputk.totalKasbon - data.bputk.totalPotongan)}</div>
                        </div>
                      </div>
                    </td>

                    {/* KARTU 3: URAIAN PEKERJAAN */}
                    <td style={{ width: '30%', height: '100%', verticalAlign: 'top' }}>
                      <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '15px', fontSize: '9pt', background: '#fff', height: '100%', boxSizing: 'border-box', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontWeight: 'bold', color: '#0f766e', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '10px', fontSize: '10pt' }}>Uraian Pekerjaan</div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span>Nilai SPK</span><span style={{ fontWeight: 'bold' }}>{fRp(data.bapp.contract.contract_value)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span>Opname s.d saat ini <b style={{ color: '#0f766e', backgroundColor: '#f0fdfa', padding: '0 4px', borderRadius: '4px' }}>A</b></span><span style={{ fontWeight: 'bold' }}>{fRp(sakResult.A_bruto)}</span></div>
                        
                        <div style={{ marginTop: '5px', marginBottom: '10px', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8pt', marginBottom: '3px' }}>
                            <span style={{ color: '#64748b' }}>Progress Opname:</span>
                            <span style={{ fontWeight: 'bold', color: '#0f766e' }}>{(sakResult.persenProgres * 100).toFixed(2)}%</span>
                          </div>
                          <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${sakResult.persenProgres * 100}%`, height: '100%', backgroundColor: '#0f766e' }}></div>
                          </div>
                        </div>

                        <div style={{ border: '1px solid #a7f3d0', borderRadius: '8px', padding: '10px', backgroundColor: '#ecfdf5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 'auto' }}>
                          <div style={{ fontSize: '8pt', color: '#047857', fontWeight: 'bold', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '1px' }}>Sisa Pekerjaan</div>
                          <div style={{ fontSize: '14pt', fontWeight: 'bold', color: '#064e3b' }}>{fRp(data.bapp.contract.contract_value - sakResult.A_bruto)}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* TANDA TANGAN - MARGIN TOP FIX AGAR TIDAK JAUH KE BAWAH */}
              <table style={{ width: '100%', marginTop: 'auto', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <tbody>
                  <tr>
                    {signatures.map((sig, idx) => (
                      <td key={idx} style={{ width: '16.66%', textAlign: 'center', verticalAlign: 'bottom', padding: '0 5px', border: 'none' }}>
                        <div style={{ fontSize: '8.5pt', color: '#475569', marginBottom: '5px', fontWeight: 'bold' }}>{sig.title}</div>
                        <div style={{ height: '65px' }}></div>
                        <div style={{ borderTop: '1px solid #64748b', width: '90%', margin: '0 auto 6px auto' }}></div>
                        <div style={{ fontWeight: 'bold', fontSize: '9.5pt', color: '#0f172a', wordWrap: 'break-word', lineHeight: '1.2' }}>{sig.name}</div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            
          </div>
          <div className="mt-6 flex justify-end w-full max-w-[420mm] print:hidden">
            <button onClick={handlePrint} disabled={loading} className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 shadow-md transition-colors">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Printer size={20} />} Cetak Lampiran PDF (A3)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}