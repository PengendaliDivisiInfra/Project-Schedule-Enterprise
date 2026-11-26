'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { terbilang as angkaTerbilang } from '@/lib/utils/terbilang';
import { ArrowLeft, Printer, Loader2, Settings, X, CheckCircle2, FileText, Lock } from 'lucide-react';

type PayrollPrintPageProps = {
  params: { payrollId: string };
};

export default function PayrollPrintPage({ params }: PayrollPrintPageProps) {
  const router = useRouter();
  const payrollId = params.payrollId;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [payroll, setPayroll] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  
  const [isSigSettingsOpen, setIsSigSettingsOpen] = useState(false);
  const [toast, setToast] = useState<any>(null);

  const [signatures, setSignatures] = useState(() => {
    if (typeof window !== 'undefined' && payrollId) {
      const saved = localStorage.getItem(`payroll_sig_${payrollId}`);
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return { 
      adminName: 'Admin Payroll', adminTitle: 'Finance Dept',
      financeName: 'Finance Accounting', financeTitle: 'Head of Finance',
      pmName: 'Project Manager', pmTitle: 'Project Manager'
    };
  });

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && payrollId) {
      localStorage.setItem(`payroll_sig_${payrollId}`, JSON.stringify(signatures));
    }
  }, [signatures, payrollId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!payrollId) return;
      setLoading(true);
      try {
        const { data: prData } = await supabase.from('payrolls').select('*').eq('id', payrollId).single();
        if (!prData) return;
        setPayroll(prData);

        const { data: projData } = await supabase.from('projects').select('*').eq('id', prData.project_id).single();
        setProject(projData);

        const { data: itemsData } = await supabase
          .from('payroll_items')
          .select(`*, employees (name, nik, role_title, bank_name, bank_account, employee_type, base_salary, tunjangan, daily_rate)`)
          .eq('payroll_id', payrollId);
        
        setItems(itemsData || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [payrollId]);

  const handlePrint = () => {
    window.print();
  };

  const formatRp = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
  const formatDate = (dateStr: string) => dateStr ? new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
  const formatDateTime = (dateStr: string) => dateStr ? new Date(dateStr).toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
  
  const printDate = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  const docNumber = `PAY-${payrollId.substring(0, 8).toUpperCase()}`;
  const isVoid = payroll?.status === 'Voided';

  const getBreakdown = (item: any) => {
    const emp = item.employees;
    const isOffice = emp?.employee_type === 'Office';
    let displayGajiPokok = 0;
    let displayTunjangan = 0;

    if (isOffice) {
      const prorata = item.days_present >= 21 ? 1 : (item.days_present / 21);
      displayGajiPokok = (Number(emp?.base_salary) || 0) * prorata;
      displayTunjangan = (Number(emp?.tunjangan) || 0) * prorata;
    } else {
      displayGajiPokok = item.days_present * (Number(emp?.daily_rate) || 0);
      displayTunjangan = Number(emp?.tunjangan) || 0;
    }

    const totalBase = displayGajiPokok + displayTunjangan;
    if (totalBase > 0 && Math.abs(totalBase - item.base_pay) > 1) {
        displayGajiPokok = item.base_pay;
        displayTunjangan = 0;
    }
    return { displayGajiPokok, displayTunjangan };
  };


  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0b1120]"><Loader2 className="animate-spin text-indigo-500 w-10 h-10" /></div>;
  if (!payroll || !project) return <div className="p-10 text-center font-bold text-white bg-[#0b1120] min-h-screen">Data tidak ditemukan.</div>;

  return (
    <>
      <style jsx global>{`
        /* --- SCREEN PREVIEW STYLES --- */
        body { background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        
        .workspace-canvas {
          padding-top: 100px;
          padding-bottom: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 50px;
          overflow-x: auto;
        }

        .a4-paper {
          background-color: white;
          width: 297mm;
          height: 210mm;
          padding: 10mm 15mm; 
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.05);
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
        }

        .print-table { 
          width: 100%; 
          border-collapse: collapse; 
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
          font-size: 10px; 
          margin-bottom: 15px; 
          position: relative; 
          z-index: 10; 
          table-layout: fixed; 
        }
        .print-table th, .print-table td { 
          border: 1px solid #cbd5e1;
          padding: 6px; 
          vertical-align: middle;
          word-wrap: break-word;
        }
        .print-table th { 
          background-color: #f1f5f9; 
          font-weight: 700; 
          text-transform: uppercase; 
          font-size: 9px;
          letter-spacing: 0.2px; 
          color: #334155;
          text-align: center;
          line-height: 1.2;
        }
        
        .doc-header { text-align: center; border-bottom: 3px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; position: relative; z-index: 10; }
        .doc-title { font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; text-decoration: underline; margin-bottom: 15px; position: relative; z-index: 10; text-align: center; color: #0f172a; }

        .watermark-container {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none; z-index: 1; overflow: hidden;
        }
        .watermark-text {
          font-size: 180px; font-weight: 900; color: rgba(220, 38, 38, 0.10);
          text-transform: uppercase; font-family: 'Arial Black', Impact, sans-serif;
          letter-spacing: 15px; white-space: nowrap;
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%) rotate(-35deg);
        }

        /* --- PRINT ENGINE (BULLETPROOF VERSION) --- */
        @media print {
          @page { 
            size: A4 landscape; 
            margin: 0; 
          }

          body, html {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            height: auto !important;
          }

          .no-print { display: none !important; }
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }

          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            gap: 0 !important;
            background: white !important;
            overflow: hidden !important; 
          }

          .a4-paper {
            width: 297mm !important;
            height: 205mm !important; 
            margin: 0 !important;
            padding: 10mm 15mm !important; 
            box-sizing: border-box !important;
            box-shadow: none !important;
            border: none !important;
            position: relative !important;
            overflow: hidden !important;
            background: white !important;
            display: flex !important;
            flex-direction: column !important;
          }

          .a4-paper:not(:first-child) {
            page-break-before: always !important;
            break-before: page !important;
          }

          .a4-paper:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .print-table { page-break-inside: auto; }
          .print-table tr { page-break-inside: avoid; }
          .print-table thead { display: table-header-group; }
          .signature-block { page-break-inside: avoid; break-inside: avoid; }
        }
      `}</style>

      {toast && (
        <div className={`fixed top-24 right-6 z-[9999] px-6 py-3 rounded-lg shadow-2xl text-white font-bold flex items-center gap-2 no-print animate-in slide-in-from-top-4 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          <CheckCircle2 size={18} /> {toast.msg}
        </div>
      )}

      <div className="no-print fixed top-0 left-0 right-0 h-16 bg-[#0b1120]/95 backdrop-blur-xl border-b border-slate-800 flex justify-between items-center px-6 z-50 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 shadow-sm">
            <ArrowLeft size={18} />
          </button>
          <div className="h-6 w-px bg-slate-700"></div>
          <div className="flex flex-col">
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest flex items-center gap-1.5"><Lock size={10} /> Secure Preview (A4 Landscape)</span>
            <span className="text-sm font-semibold flex items-center gap-2 text-slate-200"><FileText size={14} /> Payroll - {docNumber}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSigSettingsOpen(true)} className="bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all text-xs">
            <Settings size={16} /> Konfigurasi TTD
          </button>
          <button onClick={handlePrint} className={`px-5 py-2 rounded-lg font-bold flex items-center gap-2 transition-all text-xs shadow-lg ${isVoid ? 'bg-slate-600 hover:bg-slate-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'}`}>
            <Printer size={16} /> Cetak Dokumen
          </button>
        </div>
      </div>

      {isSigSettingsOpen && (
        <div className="no-print fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#1e293b] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200 text-white">
            <div className="flex justify-between items-center p-5 border-b border-slate-700 bg-[#0f172a]/50">
              <div>
                <h3 className="font-bold text-lg">Konfigurasi Tanda Tangan</h3>
                <p className="text-xs text-slate-400 mt-1">Pengaturan ini disimpan di perangkat Anda.</p>
              </div>
              <button onClick={() => setIsSigSettingsOpen(false)} className="text-slate-400 hover:text-red-400 transition-colors bg-slate-800 p-2 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4 bg-[#0f172a]/50 p-4 rounded-xl border border-slate-700/50">
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider border-b border-slate-700 pb-2">Kolom 1 (Kiri)</p>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Nama Lengkap</label>
                  <input type="text" value={signatures.adminName} onChange={e => setSignatures({...signatures, adminName: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Jabatan</label>
                  <input type="text" value={signatures.adminTitle} onChange={e => setSignatures({...signatures, adminTitle: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-white" />
                </div>
              </div>
              <div className="space-y-4 bg-[#0f172a]/50 p-4 rounded-xl border border-slate-700/50">
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider border-b border-slate-700 pb-2">Kolom 2 (Tengah)</p>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Nama Lengkap</label>
                  <input type="text" value={signatures.financeName} onChange={e => setSignatures({...signatures, financeName: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Jabatan</label>
                  <input type="text" value={signatures.financeTitle} onChange={e => setSignatures({...signatures, financeTitle: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-white" />
                </div>
              </div>
              <div className="space-y-4 bg-[#0f172a]/50 p-4 rounded-xl border border-slate-700/50">
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider border-b border-slate-700 pb-2">Kolom 3 (Kanan)</p>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Nama Lengkap</label>
                  <input type="text" value={signatures.pmName} onChange={e => setSignatures({...signatures, pmName: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Jabatan</label>
                  <input type="text" value={signatures.pmTitle} onChange={e => setSignatures({...signatures, pmTitle: e.target.value})} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-white" />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-700 bg-[#0f172a]/50 flex justify-end">
              <button onClick={() => { setIsSigSettingsOpen(false); showToast('Konfigurasi TTD berhasil disimpan.'); }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg shadow-indigo-600/20 text-sm">
                Simpan Pengaturan
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="workspace-canvas print-area">
        
        {/* ========================================== */}
        {/* KERTAS A4 1: LAPORAN PENGAJUAN GAJI */}
        {/* ========================================== */}
        <div className="a4-paper">
          
          {isVoid && (
            <div className="watermark-container">
              <div className="watermark-text">VOID / BATAL</div>
            </div>
          )}

          {/* MAIN CONTENT WRAPPER */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="doc-header">
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
                {project.logo_url && (
                  <img src={project.logo_url} alt="Logo" style={{ maxHeight: '60px', maxWidth: '90px', objectFit: 'contain' }} />
                )}
                <div style={{ textAlign: 'left' }}>
                  <h1 style={{ fontSize: '20px', margin: '0 0 4px 0', textTransform: 'uppercase', color: '#0f172a', fontWeight: 800 }}>
                    {project.company_name || project.contractor_name || 'NAMA PERUSAHAAN BELUM DIATUR'}
                  </h1>
                  <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>{project.contractor_address || 'Alamat Perusahaan Belum Diatur'}</p>
                  {(project.company_phone || project.company_email) && (
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#475569' }}>
                      {project.company_phone ? `Telp: ${project.company_phone}` : ''} 
                      {project.company_phone && project.company_email ? ' | ' : ''}
                      {project.company_email ? `Email: ${project.company_email}` : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {isVoid && (
              <div style={{ border: '2px solid #dc2626', backgroundColor: '#fef2f2', padding: '12px', marginBottom: '15px', textAlign: 'center', position: 'relative', zIndex: 10, borderRadius: '4px' }}>
                <h3 style={{ color: '#dc2626', margin: '0 0 6px 0', fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px' }}>DOKUMEN INI TELAH DIBATALKAN (VOID)</h3>
                <p style={{ margin: 0, fontSize: '11px', color: '#991b1b' }}>Alasan: <strong>{payroll.void_reason || 'Tidak ada keterangan'}</strong></p>
                <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#991b1b' }}>Waktu Pembatalan: <strong>{payroll.voided_at ? formatDateTime(payroll.voided_at) : 'Data Lama'}</strong></p>
              </div>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px', position: 'relative', zIndex: 10 }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', verticalAlign: 'top' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: '12px', lineHeight: '1.6' }}>
                      <tbody>
                        <tr><td style={{ fontWeight: 'bold', color: '#475569', width: '100px' }}>No. Dokumen</td><td style={{ color: '#0f172a' }}>: {docNumber}</td></tr>
                        <tr><td style={{ fontWeight: 'bold', color: '#475569' }}>Tanggal Cetak</td><td style={{ color: '#0f172a' }}>: {printDate}</td></tr>
                      </tbody>
                    </table>
                  </td>
                  <td style={{ width: '50%', verticalAlign: 'top', textAlign: 'right' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: '12px', lineHeight: '1.6', marginLeft: 'auto' }}>
                      <tbody>
                        <tr><td style={{ fontWeight: 'bold', color: '#475569', textAlign: 'left', width: '80px' }}>Proyek</td><td style={{ color: '#0f172a', textAlign: 'left' }}>: {project.name}</td></tr>
                        <tr><td style={{ fontWeight: 'bold', color: '#475569', textAlign: 'left' }}>Periode</td><td style={{ color: '#0f172a', textAlign: 'left' }}>: {formatDate(payroll.period_start)} s/d {formatDate(payroll.period_end)}</td></tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="doc-title">Laporan Pengajuan Gaji Karyawan</div>

            <table className="print-table">
              <colgroup>
                <col style={{ width: '3%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '9%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>No</th>
                  <th style={{ textAlign: 'left' }}>Nama Karyawan</th>
                  <th>Tipe</th>
                  <th>Hadir</th>
                  <th style={{ textAlign: 'right' }}>Gaji Pokok / Harian</th>
                  <th style={{ textAlign: 'right' }}>Tunjangan</th>
                  <th style={{ textAlign: 'right' }}>Uang Makan</th>
                  <th style={{ textAlign: 'right' }}>Lembur</th>
                  <th style={{ textAlign: 'right' }}>Potongan</th>
                  <th style={{ textAlign: 'right', backgroundColor: '#e2e8f0', color: '#000' }}>Total Diterima</th>
                  <th>Transfer Ke</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const { displayGajiPokok, displayTunjangan } = getBreakdown(item);
                  const isOffice = item.employees?.employee_type === 'Office';

                  return (
                    <tr key={item.id} style={{ color: isVoid ? '#64748b' : 'inherit' }}>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600, textDecoration: isVoid ? 'line-through' : 'none' }}>{item.employees?.name}</td>
                      <td style={{ textAlign: 'center', fontSize: '8.5px' }}>{isOffice ? 'Bulanan' : 'Harian'}</td>
                      <td style={{ textAlign: 'center' }}>{item.days_present}</td>
                      <td style={{ textAlign: 'right' }}>{formatRp(displayGajiPokok)}</td>
                      <td style={{ textAlign: 'right' }}>{formatRp(displayTunjangan)}</td>
                      <td style={{ textAlign: 'right' }}>{formatRp(item.meal_pay)}</td>
                      <td style={{ textAlign: 'right' }}>{formatRp(item.overtime_pay)}</td>
                      <td style={{ textAlign: 'right' }}>{formatRp(item.deductions || 0)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', textDecoration: isVoid ? 'line-through' : 'none', backgroundColor: isVoid ? '#fca5a5' : '#ecfdf5', color: isVoid ? '#991b1b' : '#047857' }}>
                        {formatRp(item.total_pay)}
                      </td>
                      <td style={{ fontSize: '8px', lineHeight: '1.2', textAlign: 'center' }}>
                        {item.employees?.bank_name || '-'} <br/> 
                        {item.employees?.bank_account || '-'}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ backgroundColor: isVoid ? '#e2e8f0' : '#f8fafc' }}>
                  <td colSpan={9} style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px 10px', color: '#0f172a' }}>TOTAL PENGELUARAN GAJI</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', textDecoration: isVoid ? 'line-through' : 'none', fontSize: '12px', padding: '12px 10px', backgroundColor: isVoid ? '#fca5a5' : '#ecfdf5', color: isVoid ? '#991b1b' : '#047857' }}>{formatRp(payroll.total_amount)}</td>
                  <td style={{ backgroundColor: '#f8fafc' }}></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* BOTTOM WRAPPER (TTD & FOOTER) */}
          <div style={{ marginTop: 'auto' }}>
            <div className="signature-block" style={{ marginBottom: '5mm' }}>
              <table style={{ width: '100%', fontSize: '12px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                <tbody>
                  <tr>
                    <td style={{ width: '33%', verticalAlign: 'top' }}>
                      <p style={{ marginBottom: '30px', color: '#475569' }}>Dibuat Oleh (HR/Admin),</p>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12px', padding: '0 10px 4px 10px', borderBottom: '1px solid #0f172a', display: 'inline-block', minWidth: '160px', color: '#0f172a' }}>{signatures.adminName || '........................'}</p>
                      <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#475569' }}>{signatures.adminTitle || '........................'}</p>
                    </td>
                    <td style={{ width: '34%', verticalAlign: 'top' }}>
                      <p style={{ marginBottom: '30px', color: '#475569' }}>Diperiksa Oleh (Finance),</p>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12px', padding: '0 10px 4px 10px', borderBottom: '1px solid #0f172a', display: 'inline-block', minWidth: '160px', color: '#0f172a' }}>{signatures.financeName || '........................'}</p>
                      <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#475569' }}>{signatures.financeTitle || '........................'}</p>
                    </td>
                    <td style={{ width: '33%', verticalAlign: 'top' }}>
                      <p style={{ marginBottom: '30px', color: '#475569' }}>Disetujui Oleh (PM),</p>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12px', padding: '0 10px 4px 10px', borderBottom: '1px solid #0f172a', display: 'inline-block', minWidth: '160px', color: '#0f172a' }}>{signatures.pmName || '........................'}</p>
                      <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#475569' }}>{signatures.pmTitle || '........................'}</p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ borderTop: '2px solid #0f172a', paddingTop: '8px', fontSize: '9px', color: '#64748b', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', textTransform: 'uppercase' }}>
              <span>Dicetak otomatis oleh InfraControl PRO</span>
              <span>Halaman 1</span>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* KERTAS A4 2+: SLIP GAJI (STANDAR HR INDONESIA) */}
        {/* ========================================== */}
        {items.map((item, index) => {
          const { displayGajiPokok, displayTunjangan } = getBreakdown(item);
          const grossPay = item.total_pay + (item.deductions || 0);
          const terbilangText = angkaTerbilang(item.total_pay) + ' Rupiah';

          return (
            <div key={item.id} className="a4-paper">
              
              {isVoid && (
                <div className="watermark-container">
                  <div className="watermark-text">VOID</div>
                </div>
              )}

              <div style={{ position: 'absolute', top: '10mm', right: '15mm', color: '#dc2626', fontWeight: 'bold', fontSize: '12px', border: '1px solid #dc2626', padding: '2px 8px', borderRadius: '4px', zIndex: 10 }}>
                RAHASIA
              </div>

              {/* MAIN CONTENT WRAPPER */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', borderBottom: '2px solid #0f172a', paddingBottom: '15px', marginBottom: '15px', position: 'relative', zIndex: 10 }}>
                  {project.logo_url && (
                    <img src={project.logo_url} alt="Logo" style={{ maxHeight: '60px', maxWidth: '90px', objectFit: 'contain', flexShrink: 0 }} />
                  )}
                  <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '20px', textTransform: 'uppercase', color: '#0f172a', fontWeight: 800 }}>
                      {project.company_name || project.contractor_name || 'NAMA PERUSAHAAN'}
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#475569' }}>{project.contractor_address || 'Alamat Perusahaan Belum Diatur'}</p>
                    {(project.company_phone || project.company_email) && (
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#475569' }}>
                        {project.company_phone ? `Telp: ${project.company_phone}` : ''} 
                        {project.company_phone && project.company_email ? ' | ' : ''}
                        {project.company_email ? `Email: ${project.company_email}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold', textDecoration: 'underline', marginBottom: '15px', color: '#0f172a', position: 'relative', zIndex: 10 }}>
                  SLIP GAJI KARYAWAN
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px', position: 'relative', zIndex: 10 }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '50%', verticalAlign: 'top' }}>
                        <table style={{ borderCollapse: 'collapse', fontSize: '13px', lineHeight: '1.8' }}>
                          <tbody>
                            <tr><td style={{ fontWeight: 'bold', color: '#475569', width: '130px' }}>Nama Karyawan</td><td style={{ color: '#0f172a', fontWeight: 600 }}>: {item.employees?.name}</td></tr>
                            <tr><td style={{ fontWeight: 'bold', color: '#475569' }}>NIK / ID</td><td style={{ color: '#0f172a' }}>: {item.employees?.nik || '-'}</td></tr>
                            <tr><td style={{ fontWeight: 'bold', color: '#475569' }}>Jabatan / Divisi</td><td style={{ color: '#0f172a' }}>: {item.employees?.role_title}</td></tr>
                            <tr><td style={{ fontWeight: 'bold', color: '#475569' }}>Status Karyawan</td><td style={{ color: '#0f172a' }}>: {item.employees?.employee_type === 'Office' ? 'Bulanan (Kantor)' : 'Harian (Proyek)'}</td></tr>
                          </tbody>
                        </table>
                      </td>
                      <td style={{ width: '50%', verticalAlign: 'top', textAlign: 'right' }}>
                        <table style={{ borderCollapse: 'collapse', fontSize: '13px', lineHeight: '1.8', marginLeft: 'auto' }}>
                          <tbody>
                            <tr><td style={{ fontWeight: 'bold', color: '#475569', textAlign: 'left', width: '130px' }}>Periode Pembayaran</td><td style={{ color: '#0f172a', textAlign: 'left' }}>: {formatDate(payroll.period_start)} - {formatDate(payroll.period_end)}</td></tr>
                            <tr><td style={{ fontWeight: 'bold', color: '#475569', textAlign: 'left' }}>No. Dokumen</td><td style={{ color: '#0f172a', textAlign: 'left' }}>: {docNumber}</td></tr>
                            <tr><td style={{ fontWeight: 'bold', color: '#475569', textAlign: 'left' }}>Metode Pembayaran</td><td style={{ color: '#0f172a', textAlign: 'left' }}>: Transfer Bank</td></tr>
                            <tr><td style={{ fontWeight: 'bold', color: '#475569', textAlign: 'left' }}>Rekening Tujuan</td><td style={{ color: '#0f172a', textAlign: 'left' }}>: {item.employees?.bank_name || '-'} - {item.employees?.bank_account || '-'}</td></tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table className="print-table" style={{ marginBottom: '15px', fontSize: '12px' }}>
                  <colgroup>
                    <col style={{ width: '40%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '15%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px' }}>PENDAPATAN (EARNINGS)</th>
                      <th style={{ textAlign: 'right', padding: '12px' }}>Jumlah (Rp)</th>
                      <th style={{ textAlign: 'left', padding: '12px' }}>POTONGAN (DEDUCTIONS)</th>
                      <th style={{ textAlign: 'right', padding: '12px' }}>Jumlah (Rp)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '10px 12px' }}>Gaji Pokok / Upah Harian ({item.days_present} Hari)</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px' }}>{formatRp(displayGajiPokok)}</td>
                      <td style={{ padding: '10px 12px' }}>PPh 21</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px' }}>{formatRp(item.tax_deduction || 0)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 12px' }}>Tunjangan Tetap</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px' }}>{formatRp(displayTunjangan)}</td>
                      <td style={{ padding: '10px 12px' }}>BPJS Kesehatan</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px' }}>{formatRp(item.bpjs_kes || 0)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 12px' }}>Tunjangan Makan & Transport</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px' }}>{formatRp(item.meal_pay)}</td>
                      <td style={{ padding: '10px 12px' }}>BPJS Ketenagakerjaan</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px' }}>{formatRp(item.bpjs_tk || 0)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '10px 12px' }}>Upah Lembur ({item.total_overtime_hours} Jam)</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px' }}>{formatRp(item.overtime_pay)}</td>
                      <td style={{ padding: '10px 12px' }}>Pinjaman / Kasbon</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px' }}>{formatRp(item.loan_deduction || 0)}</td>
                    </tr>
                    <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold', borderTop: '1px solid #cbd5e1' }}>
                      <td style={{ textAlign: 'right', color: '#0f172a', padding: '12px' }}>TOTAL PENDAPATAN (GROSS)</td>
                      <td style={{ textAlign: 'right', color: '#0f172a', padding: '12px' }}>{formatRp(grossPay)}</td>
                      <td style={{ textAlign: 'right', color: '#0f172a', padding: '12px' }}>TOTAL POTONGAN</td>
                      <td style={{ textAlign: 'right', color: '#0f172a', padding: '12px' }}>{formatRp(item.deductions || 0)}</td>
                    </tr>
                    <tr style={{ backgroundColor: isVoid ? '#fca5a5' : '#ecfdf5', fontWeight: 'bold', fontSize: '14px', borderTop: '2px solid #0f172a', borderBottom: '2px solid #0f172a' }}>
                      <td colSpan={3} style={{ textAlign: 'right', paddingRight: '20px', color: isVoid ? '#991b1b' : '#047857', padding: '15px', textTransform: 'uppercase' }}>
                        TAKE HOME PAY (GAJI BERSIH)
                      </td>
                      <td style={{ textAlign: 'right', textDecoration: isVoid ? 'line-through' : 'none', color: isVoid ? '#991b1b' : '#047857', padding: '15px' }}>
                        {formatRp(item.total_pay)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', marginBottom: '10px', fontStyle: 'italic', fontSize: '12px', position: 'relative', zIndex: 10 }}>
                  <strong>Terbilang:</strong> {isVoid ? 'DOKUMEN DIBATALKAN' : `( ${terbilangText} )`}
                </div>
              </div>

              {/* BOTTOM WRAPPER (TTD & FOOTER) */}
              <div style={{ marginTop: 'auto' }}>
                <div className="signature-block" style={{ marginBottom: '5mm' }}>
                  <table style={{ width: '100%', fontSize: '12px', textAlign: 'center', position: 'relative', zIndex: 10 }}>
                    <tbody>
                      <tr>
                        <td style={{ width: '50%', verticalAlign: 'top' }}>
                          <p style={{ marginBottom: '30px', color: '#475569' }}>Diterima & Disetujui Oleh (Karyawan),</p>
                          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12px', padding: '0 10px 4px 10px', borderBottom: '1px solid #0f172a', display: 'inline-block', minWidth: '200px', color: '#0f172a' }}>{item.employees?.name}</p>
                        </td>
                        <td style={{ width: '50%', verticalAlign: 'top' }}>
                          <p style={{ marginBottom: '30px', color: '#475569' }}>Diterbitkan Oleh (HR / Finance),</p>
                          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12px', padding: '0 10px 4px 10px', borderBottom: '1px solid #0f172a', display: 'inline-block', minWidth: '200px', color: '#0f172a' }}>{signatures.adminName || '........................'}</p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#475569' }}>{signatures.adminTitle || '........................'}</p>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ borderTop: '2px solid #0f172a', paddingTop: '8px', fontSize: '9px', color: '#64748b', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  <span>Dokumen ini bersifat RAHASIA dan diterbitkan secara sah oleh sistem ERP InfraControl PRO.</span>
                  <span>Halaman {index + 2}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}