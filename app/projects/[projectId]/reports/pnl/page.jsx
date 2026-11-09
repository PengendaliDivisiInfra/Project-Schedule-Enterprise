'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Printer, History, CheckCircle2, Loader2, FileSpreadsheet, TrendingUp, TrendingDown, Banknote, Settings } from 'lucide-react';

export default function ProfitLossPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  
  const [revenueData, setRevenueData] = useState([]);
  const [hppData, setHppData] = useState([]);
  const [opexData, setOpexData] = useState([]);

  const [totals, setTotals] = useState({
    revenue: 0, hpp: 0, opex: 0, grossProfit: 0, netProfit: 0, margin: 0
  });

  const [historyData, setHistoryData] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // State Pengaturan Tanda Tangan (Dengan Inisialisasi LocalStorage)
  const [isSigSettingsOpen, setIsSigSettingsOpen] = useState(false);
  const [signatures, setSignatures] = useState(() => {
    if (typeof window !== 'undefined' && projectId) {
      const saved = localStorage.getItem(`pnl_sig_${projectId}`);
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return {
      financeName: 'Finance / Admin',
      financeTitle: '',
      pmName: 'Project Manager',
      pmTitle: ''
    };
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Simpan Otomatis ke LocalStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      localStorage.setItem(`pnl_sig_${projectId}`, JSON.stringify(signatures));
    }
  }, [signatures, projectId]);

  // 2. Ambil Nama User Login (FIX: Menggunakan full_name)
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Ambil full_name dan email sesuai skema database Anda
        const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle();
        
        let displayName = 'Finance / Admin';
        
        // Prioritaskan full_name dari tabel profiles
        if (profile?.full_name) {
          displayName = profile.full_name;
        } 
        // Fallback ke email jika full_name kosong
        else if (user.email) {
          const emailPrefix = user.email.split('@')[0];
          displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
        }
        
        setSignatures(prev => {
          if (prev.financeName === 'Finance / Admin') {
            return { ...prev, financeName: displayName };
          }
          return prev;
        });
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!projectId) return;
      setLoading(true);

      try {
        const { data: proj } = await supabase
          .from('projects')
          .select('name, contract_value, company_name, location')
          .eq('id', projectId)
          .single();
        setProject(proj);

        const { data: termins } = await supabase
          .from('project_termins')
          .select('id, name, gross_amount, termin_no, sp2d_number')
          .eq('project_id', projectId)
          .not('sp2d_number', 'is', null)
          .order('termin_no', { ascending: true });

        const { data: flows } = await supabase
          .from('cash_flows')
          .select('id, category, amount')
          .eq('project_id', projectId)
          .eq('type', 'OUT')
          .eq('approval_status', 'Approved')
          .is('voided_at', null);

        let totalRev = 0, totalHpp = 0, totalOpex = 0;
        const revList = (termins || []).map(t => {
          totalRev += Number(t.gross_amount);
          return { ...t, amount: Number(t.gross_amount) };
        });

        const hppCategories = ['Material', 'Upah', 'Alat', 'Subkon'];
        const hppList = [];
        const opexList = [];

        (flows || []).forEach(f => {
          const amt = Number(f.amount);
          if (hppCategories.includes(f.category)) {
            totalHpp += amt;
            hppList.push({ ...f, amount: amt });
          } else {
            totalOpex += amt;
            opexList.push({ ...f, amount: amt });
          }
        });

        const groupByCategory = (list) => {
          return Object.values(list.reduce((acc, curr) => {
            if (!acc[curr.category]) acc[curr.category] = { category: curr.category, amount: 0, count: 0 };
            acc[curr.category].amount += curr.amount;
            acc[curr.category].count += 1;
            return acc;
          }, {}));
        };

        setRevenueData(revList);
        setHppData(groupByCategory(hppList));
        setOpexData(groupByCategory(opexList));

        const grossProfit = totalRev - totalHpp;
        const netProfit = grossProfit - totalOpex;
        const margin = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;

        setTotals({
          revenue: totalRev, hpp: totalHpp, opex: totalOpex, grossProfit, netProfit, margin
        });

        const { data: history } = await supabase
          .from('pnl_snapshots')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });
        
        if (history) setHistoryData(history);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId]);

  const handlePrintAndSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('pnl_snapshots').insert({
        project_id: projectId,
        created_by: signatures.financeName,
        period_end: new Date().toISOString().split('T')[0],
        total_revenue: totals.revenue,
        total_hpp: totals.hpp,
        total_opex: totals.opex,
        gross_profit: totals.grossProfit,
        net_profit: totals.netProfit,
        margin: totals.margin,
        data_json: { revenue: revenueData, hpp: hppData, opex: opexData, signatures }
      });

      if (error) throw error;

      showToast('Snapshot laporan berhasil disimpan.', 'success');

      const { data: history } = await supabase
        .from('pnl_snapshots')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (history) setHistoryData(history);

      setTimeout(() => {
        window.print();
      }, 500);

    } catch (err) {
      showToast('Gagal menyimpan riwayat: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const formatRp = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
  };

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Memuat Laporan...</div>;
  if (!project) return <div className="p-10 text-center text-red-500">Proyek tidak ditemukan.</div>;

  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <style jsx global>{`
        @media print {
          @page { margin: 0; size: A4 portrait; }
          body * { visibility: hidden; background: white !important; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { 
            position: absolute; left: 0; top: 0; 
            width: 100% !important; max-width: 100% !important;
            padding: 20mm !important;
            margin: 0 !important;
            box-shadow: none !important; border: none !important;
            background: white !important;
          }
          .a4-paper {
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .table-formal { width: 100% !important; border-collapse: collapse !important; font-family: 'Times New Roman', Times, serif !important; font-size: 11pt !important; table-layout: fixed; }
          .table-formal th, .table-formal td { padding: 6px 8px !important; border-bottom: 1px solid #cbd5e1; }
          .table-formal th { border-bottom: 2px solid #000 !important; font-weight: bold !important; text-align: left; }
          .table-formal .text-right { text-align: right !important; }
          .grand-total { border-bottom: 3px double #000 !important; font-weight: bold !important; font-size: 12pt !important; }
          .text-emerald-700, .text-rose-700, .text-indigo-700 { color: #000 !important; }
          .bg-slate-50, .bg-emerald-50, .bg-rose-50, .bg-indigo-50 { background-color: transparent !important; }
        }
      `}</style>

      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <CheckCircle2 size={18} /> {toast.msg}
        </div>
      )}

      <div className="w-full min-h-screen bg-slate-100 p-4 md:p-8 flex flex-col items-center">
        
        <div className="w-full max-w-[210mm] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button onClick={() => router.back()} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors shadow-sm">
                <ArrowLeft size={18} className="text-slate-600" />
              </button>
              <h1 className="text-2xl font-bold text-slate-800">Laporan Laba Rugi (P&L)</h1>
            </div>
            <p className="text-slate-500 text-sm ml-11">Analisis pendapatan dan pengeluaran proyek secara real-time.</p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => setIsSigSettingsOpen(!isSigSettingsOpen)} 
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm transition-all"
            >
              <Settings size={16} /> Atur TTD
            </button>
            <button 
              onClick={handlePrintAndSave} 
              disabled={isSaving} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg shadow-indigo-500/30 transition-all disabled:bg-slate-400 disabled:shadow-none"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} 
              {isSaving ? 'Menyimpan...' : 'Cetak & Simpan'}
            </button>
          </div>
        </div>

        {isSigSettingsOpen && (
          <div className="w-full max-w-[210mm] bg-white p-5 rounded-xl border border-slate-200 shadow-sm print:hidden animate-fade-in mb-6">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-slate-800">Pengaturan Tanda Tangan</h3>
              <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">✓ Tersimpan Otomatis</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 bg-slate-50 p-4 rounded-lg border">
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Kolom Kiri (Dibuat Oleh)</p>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nama Lengkap</label>
                  <input type="text" value={signatures.financeName} onChange={e => setSignatures({...signatures, financeName: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Cth: Safuddin Fahmi" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Jabatan</label>
                  <input type="text" value={signatures.financeTitle} onChange={e => setSignatures({...signatures, financeTitle: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Cth: Site Engineer" />
                </div>
              </div>
              <div className="space-y-3 bg-slate-50 p-4 rounded-lg border">
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Kolom Kanan (Disetujui Oleh)</p>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Nama Lengkap</label>
                  <input type="text" value={signatures.pmName} onChange={e => setSignatures({...signatures, pmName: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Cth: Mei Sunarko" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Jabatan</label>
                  <input type="text" value={signatures.pmTitle} onChange={e => setSignatures({...signatures, pmTitle: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Cth: KaDiv Infra" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-[210mm] grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm border-l-4 border-l-emerald-500 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Pendapatan</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{formatRp(totals.revenue)}</p>
            </div>
            <TrendingUp className="text-emerald-500 opacity-50" size={40} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm border-l-4 border-l-rose-500 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Biaya (HPP + Opex)</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{formatRp(totals.hpp + totals.opex)}</p>
            </div>
            <TrendingDown className="text-rose-500 opacity-50" size={40} />
          </div>
          <div className={`bg-white rounded-xl border border-slate-200 p-5 shadow-sm border-l-4 flex items-center justify-between ${totals.netProfit >= 0 ? 'border-l-indigo-500' : 'border-l-red-500'}`}>
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Laba Bersih (Net Profit)</p>
              <p className={`text-2xl font-bold mt-1 ${totals.netProfit >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>{formatRp(totals.netProfit)}</p>
              <p className="text-xs font-bold text-slate-500 mt-1">Margin: {totals.margin.toFixed(2)}%</p>
            </div>
            <Banknote className={totals.netProfit >= 0 ? 'text-indigo-500 opacity-50' : 'text-red-500 opacity-50'} size={40} />
          </div>
        </div>

        <div className="print-container w-full flex justify-center">
          <div className="a4-paper bg-white shadow-2xl border border-slate-300 w-full max-w-[210mm] min-h-[297mm] p-[20mm] flex flex-col relative overflow-hidden">
            
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <tbody>
                <tr style={{ borderBottom: '3px double #000' }}>
                  <td style={{ width: '60%', verticalAlign: 'bottom', paddingBottom: '10px' }}>
                    <h1 style={{ fontSize: '18pt', fontWeight: 'bold', margin: 0, textTransform: 'uppercase', fontFamily: 'Times New Roman, serif' }}>
                      {project.company_name || 'PT. BANGUN KONSTRUKSI PERSADA'}
                    </h1>
                    <p style={{ fontSize: '10pt', margin: '5px 0 0 0', color: '#475569' }}>Sistem ERP Konstruksi Terpadu</p>
                  </td>
                  <td style={{ width: '40%', verticalAlign: 'bottom', textAlign: 'right', paddingBottom: '10px' }}>
                    <h2 style={{ fontSize: '16pt', fontWeight: 'bold', margin: 0, textTransform: 'uppercase', fontFamily: 'Times New Roman, serif' }}>Laporan Laba Rugi</h2>
                    <p style={{ fontSize: '10pt', margin: '5px 0 0 0', color: '#475569' }}>Periode s/d {today}</p>
                  </td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
              <tbody>
                <tr>
                  <td style={{ width: '150px', padding: '4px 0', fontWeight: 'bold', fontSize: '11pt' }}>Nama Proyek</td>
                  <td style={{ padding: '4px 0', fontSize: '11pt' }}>: {project.name}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 0', fontWeight: 'bold', fontSize: '11pt' }}>Lokasi</td>
                  <td style={{ padding: '4px 0', fontSize: '11pt' }}>: {project.location || '-'}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 0', fontWeight: 'bold', fontSize: '11pt' }}>Nilai Kontrak</td>
                  <td style={{ padding: '4px 0', fontSize: '11pt', fontWeight: 'bold' }}>: {formatRp(project.contract_value)}</td>
                </tr>
              </tbody>
            </table>

            <table className="table-formal" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '75%' }}>Keterangan</th>
                  <th style={{ width: '25%', textAlign: 'right' }}>Jumlah (Rp)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-slate-50 print:bg-transparent">
                  <td className="font-bold py-3 uppercase tracking-wider text-xs text-slate-600">A. Pendapatan Usaha</td>
                  <td></td>
                </tr>
                {revenueData.map((rev, i) => (
                  <tr key={i}>
                    <td className="pl-6">Termin {rev.termin_no} - {rev.name} <span className="text-xs text-slate-500">(SP2D: {rev.sp2d_number})</span></td>
                    <td className="text-right">{formatRp(rev.amount)}</td>
                  </tr>
                ))}
                {revenueData.length === 0 && <tr><td className="pl-6 italic text-slate-400">Belum ada pendapatan</td><td className="text-right">Rp 0</td></tr>}
                <tr className="border-t-2 border-slate-800 print:border-black">
                  <td className="font-bold text-right pr-4">Total Pendapatan</td>
                  <td className="text-right font-bold border-b-2 border-slate-800 print:border-black">{formatRp(totals.revenue)}</td>
                </tr>

                <tr className="bg-slate-50 print:bg-transparent">
                  <td className="font-bold py-3 pt-6 uppercase tracking-wider text-xs text-slate-600">B. Harga Pokok Penjualan (Biaya Langsung)</td>
                  <td></td>
                </tr>
                {hppData.map((hpp, i) => (
                  <tr key={i}>
                    <td className="pl-6">{hpp.category} <span className="text-xs text-slate-500">({hpp.count} transaksi)</span></td>
                    <td className="text-right">{formatRp(hpp.amount)}</td>
                  </tr>
                ))}
                {hppData.length === 0 && <tr><td className="pl-6 italic text-slate-400">Belum ada biaya HPP</td><td className="text-right">Rp 0</td></tr>}
                <tr className="border-t-2 border-slate-800 print:border-black">
                  <td className="font-bold text-right pr-4">Total HPP</td>
                  <td className="text-right font-bold border-b-2 border-slate-800 print:border-black">{formatRp(totals.hpp)}</td>
                </tr>

                <tr className="bg-slate-100 print:bg-transparent">
                  <td className="font-bold text-right pr-4 py-4 text-sm uppercase">Laba Kotor (A - B)</td>
                  <td className="text-right font-bold py-4 text-sm border-y-4 border-double border-slate-800 print:border-black">{formatRp(totals.grossProfit)}</td>
                </tr>

                <tr className="bg-slate-50 print:bg-transparent">
                  <td className="font-bold py-3 uppercase tracking-wider text-xs text-slate-600">C. Beban Operasional</td>
                  <td></td>
                </tr>
                {opexData.map((opex, i) => (
                  <tr key={i}>
                    <td className="pl-6">{opex.category} <span className="text-xs text-slate-500">({opex.count} transaksi)</span></td>
                    <td className="text-right">{formatRp(opex.amount)}</td>
                  </tr>
                ))}
                {opexData.length === 0 && <tr><td className="pl-6 italic text-slate-400">Belum ada beban operasional</td><td className="text-right">Rp 0</td></tr>}
                <tr className="border-t-2 border-slate-800 print:border-black">
                  <td className="font-bold text-right pr-4">Total Beban Operasional</td>
                  <td className="text-right font-bold border-b-2 border-slate-800 print:border-black">{formatRp(totals.opex)}</td>
                </tr>

                <tr>
                  <td className="font-bold text-right pr-4 py-6 text-base uppercase">Laba Bersih (Laba Kotor - C)</td>
                  <td className="text-right font-bold py-6 text-base grand-total">{formatRp(totals.netProfit)}</td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', marginTop: '80px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'bottom' }}>
                    <p style={{ margin: '0 0 70px 0', fontSize: '11pt' }}>Dibuat Oleh,</p>
                    <div style={{ display: 'inline-block', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '11pt', padding: '0 15px 2px 15px', borderBottom: '1px solid #000' }}>
                        {signatures.financeName || '........................'}
                      </p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '9pt', color: '#475569' }}>
                        {signatures.financeTitle || 'Finance / Admin'}
                      </p>
                    </div>
                  </td>
                  <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'bottom' }}>
                    <p style={{ margin: '0 0 70px 0', fontSize: '11pt' }}>Disetujui Oleh,</p>
                    <div style={{ display: 'inline-block', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '11pt', padding: '0 15px 2px 15px', borderBottom: '1px solid #000' }}>
                        {signatures.pmName || '........................'}
                      </p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '9pt', color: '#475569' }}>
                        {signatures.pmTitle || 'Project Manager'}
                      </p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ textAlign: 'center', fontSize: '8pt', color: '#94a3b8', marginTop: 'auto', paddingTop: '40px' }}>
              Dokumen ini di-generate secara otomatis oleh Sistem InfraControl PRO pada {new Date().toLocaleString('id-ID')}
            </div>

          </div>
        </div>

        <div className="w-full max-w-7xl print:hidden bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden mt-12 mb-10">
          <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <History size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Riwayat Cetak Laporan</h3>
                <p className="text-xs text-slate-500">Daftar laporan yang telah dibekukan (snapshot) dan dicetak.</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-white text-slate-500 font-semibold border-b">
                <tr>
                  <th className="p-4">Waktu Cetak</th>
                  <th className="p-4">Oleh</th>
                  <th className="p-4 text-right">Pendapatan</th>
                  <th className="p-4 text-right">HPP</th>
                  <th className="p-4 text-right">Opex</th>
                  <th className="p-4 text-right">Laba Bersih</th>
                  <th className="p-4 text-center">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400 italic">
                      <FileSpreadsheet size={32} className="mx-auto mb-2 opacity-50" />
                      Belum ada riwayat laporan yang disimpan.
                    </td>
                  </tr>
                ) : (
                  historyData.map((hist, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-700">{new Date(hist.created_at).toLocaleString('id-ID')}</td>
                      <td className="p-4 font-bold text-indigo-700">{hist.created_by}</td>
                      <td className="p-4 text-right font-mono text-slate-600">{formatRp(hist.total_revenue)}</td>
                      <td className="p-4 text-right font-mono text-slate-600">{formatRp(hist.total_hpp)}</td>
                      <td className="p-4 text-right font-mono text-slate-600">{formatRp(hist.total_opex)}</td>
                      <td className={`p-4 text-right font-bold font-mono ${hist.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatRp(hist.net_profit)}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${hist.net_profit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {Number(hist.margin).toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
}