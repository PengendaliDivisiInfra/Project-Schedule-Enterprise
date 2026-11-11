'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Printer, History, CheckCircle2, Loader2, FileSpreadsheet, Settings, AlertTriangle } from 'lucide-react';

export default function ProfitLossPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId;

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  
  const [metrics, setMetrics] = useState({
    contractValue: 0, totalRAP: 0, 
    totalActualCost: 0, qualifiedActualCost: 0,
    stockValue: 0, unearnedKasbon: 0,
    pocPercent: 0, revenueRecognized: 0,
    hppMaterial: 0, hppUpah: 0, hppSubkon: 0, hppAlat: 0, totalHpp: 0,
    opexOperasional: 0, totalOpex: 0,
    grossProfit: 0, netProfit: 0, margin: 0,
    totalInvoiced: 0, contractAssetLiability: 0,
    isDataValid: false
  });

  const [historyData, setHistoryData] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [isSigSettingsOpen, setIsSigSettingsOpen] = useState(false);

  const [signatures, setSignatures] = useState(() => {
    if (typeof window !== 'undefined' && projectId) {
      const saved = localStorage.getItem(`pnl_sig_${projectId}`);
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return { financeName: 'Finance / Admin', financeTitle: 'Site Engineer', pmName: 'Project Manager', pmTitle: 'KaDiv Infra' };
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      localStorage.setItem(`pnl_sig_${projectId}`, JSON.stringify(signatures));
    }
  }, [signatures, projectId]);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
        if (profile?.full_name) setSignatures(prev => ({ ...prev, financeName: profile.full_name }));
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!projectId) return;
      setLoading(true);

      try {
        // 1. Proyek & Kontrak
        const { data: proj } = await supabase.from('projects').select('name, contract_value, company_name, location').eq('id', projectId).single();
        setProject(proj);

        const { data: contr } = await supabase.from('client_contracts').select('contract_value').eq('project_id', projectId).eq('is_active', true).maybeSingle();
        const contractVal = contr?.contract_value || proj?.contract_value || 0;

        // 2. RAP
        const { data: wbsData } = await supabase.from('v_cost_control_wbs').select('pagu_anggaran_rap').eq('project_id', projectId);
        const totalRAP = (wbsData || []).reduce((sum, w) => sum + Number(w.pagu_anggaran_rap || 0), 0);

        // 3. Kalkulasi Actual Cost (MURNI AKRUAL)
        
        // A. Material (Goods Receipt / Penerimaan Barang)
        const { data: poItemsData } = await supabase
          .from('purchase_order_items')
          .select(`
            received_qty, 
            unit_price,
            purchase_orders!inner(project_id, status, kategori_akun)
          `)
          .eq('purchase_orders.project_id', projectId)
          .neq('purchase_orders.status', 'Void')
          .gt('received_qty', 0);

        let poMaterial = 0, poAlat = 0;
        (poItemsData || []).forEach(item => {
          const amt = Number(item.received_qty) * Number(item.unit_price);
          if (item.purchase_orders?.kategori_akun === 'Alat') poAlat += amt; 
          else poMaterial += amt;
        });

        // B. Subcon (Opname Akrual)
        const { data: subconData } = await supabase.from('subcontractor_payments').select('amount, payment_type, status').eq('project_id', projectId).in('status', ['Approved', 'Paid']);
        let totalSubconOpname = 0, unearnedKasbon = 0;
        (subconData || []).forEach(s => {
          const amt = Number(s.amount || 0);
          if (s.payment_type === 'Kasbon' || s.payment_type === 'DP') {
            unearnedKasbon += amt;
          } else {
            totalSubconOpname += amt;
          }
        });

        // C. Upah & Alat (Dari Jurnal Akrual `actual_costs` + Kas Keluar)
        const { data: actualCostsData } = await supabase.from('actual_costs').select('cost_amount, resource_type').eq('project_id', projectId);
        let accrualUpah = 0, accrualAlat = 0, accrualOperasional = 0;
        (actualCostsData || []).forEach(ac => {
          const amt = Number(ac.cost_amount || 0);
          if (ac.resource_type === 'Labor' || ac.resource_type === 'Upah') accrualUpah += amt;
          else if (ac.resource_type === 'Equipment' || ac.resource_type === 'Alat') accrualAlat += amt;
          else if (ac.resource_type === 'Overhead' || ac.resource_type === 'Operasional') accrualOperasional += amt;
        });

        const { data: cfData } = await supabase.from('cash_flows').select('amount, category').eq('project_id', projectId).eq('type', 'OUT').eq('approval_status', 'Approved').is('voided_at', null);
        let cfUpah = 0, cfAlat = 0, cfOperasional = 0;
        (cfData || []).forEach(cf => {
          const amt = Number(cf.amount || 0);
          if (cf.category === 'Upah') cfUpah += amt;
          else if (cf.category === 'Alat') cfAlat += amt;
          else if (cf.category === 'Operasional' || cf.category === 'Lainnya') cfOperasional += amt;
        });

        const totalUpah = accrualUpah + cfUpah;
        const totalAlat = accrualAlat + cfAlat;
        const totalOperasional = accrualOperasional + cfOperasional;

        // 4. Nilai Stok Gudang
        const { data: invData } = await supabase.from('inventory_materials').select('stok_on_hand, hsd_id, master_hsd(harga_dasar)').eq('project_id', projectId);
        let stockValue = 0;
        (invData || []).forEach(inv => {
          const price = inv.master_hsd?.harga_dasar || 0;
          stockValue += (Number(inv.stock_on_hand || 0) * Number(price));
        });

        // --- RUMUS PSAK 115: QUALIFIED ACTUAL COST ---
        const totalActualCostRaw = poMaterial + poAlat + totalSubconOpname + totalUpah + totalAlat;
        const hppMaterial = poMaterial > 0 ? Math.max(0, poMaterial - stockValue) : 0; 
        const stockToDeduct = poMaterial > 0 ? Math.min(poMaterial, stockValue) : 0;
        const qualifiedActualCost = Math.max(0, totalActualCostRaw - stockToDeduct - unearnedKasbon);

        // 5. Hitung PoC Murni Cost-to-Cost
        let pocPercent = 0;
        if (qualifiedActualCost > 0 && totalRAP > 0) {
          pocPercent = Math.min(100, (qualifiedActualCost / totalRAP) * 100);
        } else if (qualifiedActualCost > 0 && totalRAP === 0) {
          pocPercent = Math.min(100, (qualifiedActualCost / contractVal) * 100);
        }
        
        const revenueRecognized = Math.round((pocPercent / 100) * contractVal);

        // 6. HPP & COGS
        const hppSubkon = totalSubconOpname;
        const hppAlat = totalAlat;
        const hppUpah = totalUpah;
        const totalHpp = hppMaterial + hppSubkon + hppAlat + hppUpah;
        
        const totalOpex = totalOperasional;
        const grossProfit = revenueRecognized - totalHpp;
        const netProfit = grossProfit - totalOpex;
        const margin = revenueRecognized > 0 ? (netProfit / revenueRecognized) * 100 : 0;

        // 7. Unbilled / Unearned
        const { data: termins } = await supabase.from('project_termins').select('gross_amount').eq('project_id', projectId).not('sp2d_number', 'is', null);
        const totalInvoiced = (termins || []).reduce((sum, t) => sum + Number(t.gross_amount || 0), 0);
        const contractAssetLiability = revenueRecognized - totalInvoiced;

        const isDataValid = totalActualCostRaw > 0;

        setMetrics({
          contractValue: contractVal, totalRAP, 
          totalActualCost: totalActualCostRaw, qualifiedActualCost,
          stockValue: stockToDeduct, unearnedKasbon,
          pocPercent, revenueRecognized,
          hppMaterial, hppUpah, hppSubkon, hppAlat, totalHpp,
          opexOperasional: totalOperasional, totalOpex,
          grossProfit, netProfit, margin, totalInvoiced, contractAssetLiability,
          isDataValid
        });

        const { data: history } = await supabase.from('pnl_snapshots').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
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
    if (!metrics.isDataValid) {
      return showToast('Tidak dapat mencetak: Actual Cost masih Rp 0. Input Penerimaan Barang, Opname Subcon, atau Akrual terlebih dahulu.', 'error');
    }
    
    setIsSaving(true);
    try {
      const { error } = await supabase.from('pnl_snapshots').insert({
        project_id: projectId,
        created_by: signatures.financeName,
        period_end: new Date().toISOString().split('T')[0],
        total_revenue: metrics.revenueRecognized,
        total_hpp: metrics.totalHpp,
        total_opex: metrics.totalOpex,
        gross_profit: metrics.grossProfit,
        net_profit: metrics.netProfit,
        margin: metrics.margin,
        data_json: { metrics, signatures }
      });

      if (error) throw error;
      showToast('Snapshot laporan berhasil disimpan.', 'success');
      const { data: history } = await supabase.from('pnl_snapshots').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
      if (history) setHistoryData(history);
      setTimeout(() => { window.print(); }, 500);
    } catch (err) {
      showToast('Gagal menyimpan: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Memuat Laporan...</div>;
  if (!project) return <div className="p-10 text-center text-red-500">Proyek tidak ditemukan.</div>;

  return (
    <>
      <style jsx global>{`
        @media print {
          @page { margin: 0; size: A4 portrait; }
          body * { visibility: hidden; background: white !important; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100% !important; max-width: 100% !important; padding: 20mm !important; margin: 0 !important; box-shadow: none !important; border: none !important; background: white !important; }
          .a4-paper { box-shadow: none !important; border: none !important; width: 100% !important; max-width: 100% !important; min-height: auto !important; padding: 0 !important; margin: 0 !important; }
          .table-formal { width: 100% !important; border-collapse: collapse !important; font-family: 'Times New Roman', Times, serif !important; font-size: 11pt !important; table-layout: fixed; }
          .table-formal th, .table-formal td { padding: 6px 8px !important; border-bottom: 1px solid #cbd5e1; }
          .table-formal th { border-bottom: 2px solid #000 !important; font-weight: bold !important; text-align: left; }
          .table-formal .text-right { text-align: right !important; }
          .grand-total { border-bottom: 3px double #000 !important; font-weight: bold !important; font-size: 12pt !important; }
        }
      `}</style>

      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-lg shadow-xl text-white font-bold flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <CheckCircle2 size={18} /> {toast.msg}
        </div>
      )}

      <div className="w-full min-h-screen bg-slate-100 p-4 md:p-8 flex flex-col items-center">
        
        <div className="w-full max-w-[210mm] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <button onClick={() => router.back()} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors shadow-sm"><ArrowLeft size={18} className="text-slate-600" /></button>
              <h1 className="text-2xl font-bold text-slate-800">Laporan Laba Rugi (Strict Accrual)</h1>
            </div>
            <p className="text-slate-500 text-sm ml-11">Basis Akrual (GRN, Opname, & Accrued Cost) - PSAK 115 Compliant.</p>
          </div>
          
          <div className="flex gap-3">
            <button onClick={() => setIsSigSettingsOpen(!isSigSettingsOpen)} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm transition-all"><Settings size={16} /> Atur TTD</button>
            <button onClick={handlePrintAndSave} disabled={isSaving || !metrics.isDataValid} className={`px-6 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold shadow-lg transition-all ${!metrics.isDataValid ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} {isSaving ? 'Menyimpan...' : 'Cetak & Simpan'}
            </button>
          </div>
        </div>

        {isSigSettingsOpen && (
          <div className="w-full max-w-[210mm] bg-white p-5 rounded-xl border border-slate-200 shadow-sm print:hidden mb-6">
             <div className="flex justify-between items-center mb-4 border-b pb-2"><h3 className="font-bold text-slate-800">Pengaturan Tanda Tangan</h3></div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 bg-slate-50 p-4 rounded-lg border">
                <p className="text-xs font-bold text-indigo-700 uppercase mb-2">Kolom Kiri (Dibuat Oleh)</p>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Nama Lengkap</label><input type="text" value={signatures.financeName} onChange={e => setSignatures({...signatures, financeName: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm" /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Jabatan</label><input type="text" value={signatures.financeTitle} onChange={e => setSignatures({...signatures, financeTitle: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm" /></div>
              </div>
              <div className="space-y-3 bg-slate-50 p-4 rounded-lg border">
                <p className="text-xs font-bold text-indigo-700 uppercase mb-2">Kolom Kanan (Disetujui Oleh)</p>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Nama Lengkap</label><input type="text" value={signatures.pmName} onChange={e => setSignatures({...signatures, pmName: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm" /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Jabatan</label><input type="text" value={signatures.pmTitle} onChange={e => setSignatures({...signatures, pmTitle: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm" /></div>
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-[210mm] grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm border-l-4 border-l-blue-500">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Progress PoC (Murni)</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{metrics.pocPercent.toFixed(2)}%</p>
            <p className="text-[10px] text-slate-400 mt-1">Cost-to-Cost</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm border-l-4 border-l-emerald-500">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Pendapatan Diakui</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">{formatRp(metrics.revenueRecognized)}</p>
            <p className="text-[10px] text-slate-400 mt-1">PoC x Nilai Kontrak</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm border-l-4 border-l-rose-500">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Actual Cost Sah</p>
            <p className="text-xl font-bold text-rose-600 mt-1">{formatRp(metrics.qualifiedActualCost)}</p>
            <p className="text-[10px] text-slate-400 mt-1">Dikurangi Stok & DP</p>
          </div>
          <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm border-l-4 flex flex-col justify-center ${metrics.netProfit >= 0 ? 'border-l-indigo-500' : 'border-l-red-500'}`}>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Laba Bersih</p>
            <p className={`text-xl font-bold mt-1 ${metrics.netProfit >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>{formatRp(metrics.netProfit)}</p>
            <p className="text-[10px] text-slate-400 mt-1">Margin: {metrics.margin.toFixed(2)}%</p>
          </div>
        </div>

        {/* CONTEXTUAL SOP ALERT: LABA RUGI (P&L) */}
        {!metrics.isDataValid && (
          <div className="w-full max-w-[210mm] mb-4 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-start gap-3 shadow-sm print:hidden">
            <AlertTriangle size={24} className="shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">SOP Alert: Laporan Belum Akurat</h4>
              <p className="text-sm mt-1">Sistem mendeteksi Anda belum menginput <strong>Penerimaan Barang (GRN)</strong> atau <strong>Opname Mandor/Subkon</strong> untuk periode ini (Total Actual Cost masih Rp 0). Sesuai SOP Cut-Off Bulanan, segera input GRN di menu Material dan Opname di menu Subcontractor agar nilai PoC dan Pendapatan di bawah ini valid.</p>
            </div>
          </div>
        )}

        <div className={`print-container w-full flex justify-center ${!metrics.isDataValid ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
          <div className="a4-paper bg-white shadow-2xl border border-slate-300 w-full max-w-[210mm] min-h-[297mm] p-[20mm] flex flex-col relative overflow-hidden">
            
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
              <tbody>
                <tr style={{ borderBottom: '3px double #000' }}>
                  <td style={{ width: '60%', verticalAlign: 'bottom', paddingBottom: '10px' }}>
                    <h1 style={{ fontSize: '18pt', fontWeight: 'bold', margin: 0, textTransform: 'uppercase', fontFamily: 'Times New Roman, serif' }}>{project.company_name || 'PT. BANGUN KONSTRUKSI PERSADA'}</h1>
                    <p style={{ fontSize: '10pt', margin: '5px 0 0 0', color: '#475569' }}>Sistem ERP Konstruksi Terpadu</p>
                  </td>
                  <td style={{ width: '40%', verticalAlign: 'bottom', textAlign: 'right', paddingBottom: '10px' }}>
                    <h2 style={{ fontSize: '16pt', fontWeight: 'bold', margin: 0, textTransform: 'uppercase', fontFamily: 'Times New Roman, serif' }}>Laporan Laba Rugi</h2>
                    <p style={{ fontSize: '10pt', margin: '5px 0 0 0', color: '#475569' }}>Periode s/d {today}</p>
                  </td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <tbody>
                <tr><td style={{ width: '150px', padding: '3px 0', fontWeight: 'bold', fontSize: '10pt' }}>Nama Proyek</td><td style={{ padding: '3px 0', fontSize: '10pt' }}>: {project.name}</td></tr>
                <tr><td style={{ padding: '3px 0', fontWeight: 'bold', fontSize: '10pt' }}>Lokasi</td><td style={{ padding: '3px 0', fontSize: '10pt' }}>: {project.location || '-'}</td></tr>
                <tr><td style={{ padding: '3px 0', fontWeight: 'bold', fontSize: '10pt' }}>Nilai Kontrak (Excl. PPN)</td><td style={{ padding: '3px 0', fontSize: '10pt', fontWeight: 'bold' }}>: {formatRp(metrics.contractValue)}</td></tr>
              </tbody>
            </table>

            <table className="table-formal" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr><th style={{ width: '75%' }}>Keterangan</th><th style={{ width: '25%', textAlign: 'right' }}>Jumlah (Rp)</th></tr>
              </thead>
              <tbody>
                <tr className="bg-slate-50 print:bg-transparent"><td className="font-bold py-2 uppercase tracking-wider text-xs text-slate-600">A. Pendapatan Usaha</td><td></td></tr>
                <tr><td className="pl-6">Pendapatan Diakui (Progres PoC {metrics.pocPercent.toFixed(2)}%)<span className="block text-[10px] text-slate-500 italic mt-0.5">*Berdasarkan Cost-to-Cost Method</span></td><td className="text-right">{formatRp(metrics.revenueRecognized)}</td></tr>
                <tr className="border-t-2 border-slate-800 print:border-black"><td className="font-bold text-right pr-4">Total Pendapatan</td><td className="text-right font-bold border-b-2 border-slate-800 print:border-black">{formatRp(metrics.revenueRecognized)}</td></tr>

                <tr className="bg-slate-50 print:bg-transparent"><td className="font-bold py-2 pt-4 uppercase tracking-wider text-xs text-slate-600">B. Harga Pokok Penjualan (Biaya Langsung)</td><td></td></tr>
                <tr><td className="pl-6">Biaya Material (Terpasang)</td><td className="text-right">{formatRp(metrics.hppMaterial)}</td></tr>
                <tr><td className="pl-6">Biaya Upah & Mandor</td><td className="text-right">{formatRp(metrics.hppUpah)}</td></tr>
                <tr><td className="pl-6">Biaya Subkontraktor (Opname)</td><td className="text-right">{formatRp(metrics.hppSubkon)}</td></tr>
                <tr><td className="pl-6">Biaya Peralatan</td><td className="text-right">{formatRp(metrics.hppAlat)}</td></tr>
                <tr className="border-t-2 border-slate-800 print:border-black"><td className="font-bold text-right pr-4">Total HPP</td><td className="text-right font-bold border-b-2 border-slate-800 print:border-black">{formatRp(metrics.totalHpp)}</td></tr>

                <tr className="bg-slate-100 print:bg-transparent"><td className="font-bold text-right pr-4 py-3 text-sm uppercase">Laba Kotor</td><td className="text-right font-bold py-3 text-sm border-y-4 border-double border-slate-800 print:border-black">{formatRp(metrics.grossProfit)}</td></tr>

                <tr className="bg-slate-50 print:bg-transparent"><td className="font-bold py-2 pt-4 uppercase tracking-wider text-xs text-slate-600">C. Beban Operasional (Site Overhead)</td><td></td></tr>
                <tr><td className="pl-6">Biaya Operasional Lapangan</td><td className="text-right">{formatRp(metrics.opexOperasional)}</td></tr>
                <tr className="border-t-2 border-slate-800 print:border-black"><td className="font-bold text-right pr-4">Total Beban Operasional</td><td className="text-right font-bold border-b-2 border-slate-800 print:border-black">{formatRp(metrics.totalOpex)}</td></tr>

                <tr><td className="font-bold text-right pr-4 py-4 text-base uppercase">Laba Bersih (Accrual)</td><td className="text-right font-bold py-4 text-base grand-total">{formatRp(metrics.netProfit)}</td></tr>
              </tbody>
            </table>

            <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', fontSize: '9pt' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>CALK - Rekonsiliasi PSAK 115:</p>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr><td style={{ width: '60%', padding: '2px 0' }}>Total Actual Cost (Raw)</td><td style={{ textAlign: 'right' }}>{formatRp(metrics.totalActualCost)}</td></tr>
                  <tr><td style={{ padding: '2px 0', color: '#dc2626' }}>(-) Stok Material Belum Terpasang</td><td style={{ textAlign: 'right', color: '#dc2626' }}>- {formatRp(metrics.stockValue)}</td></tr>
                  <tr><td style={{ padding: '2px 0', color: '#dc2626' }}>(-) Kasbon / DP Subkon</td><td style={{ textAlign: 'right', color: '#dc2626' }}>- {formatRp(metrics.unearnedKasbon)}</td></tr>
                  <tr><td style={{ padding: '2px 0', fontWeight: 'bold', borderTop: '1px solid #ccc' }}>Biaya Aktual Sah (Qualified)</td><td style={{ textAlign: 'right', fontWeight: 'bold', borderTop: '1px solid #ccc' }}>{formatRp(metrics.qualifiedActualCost)}</td></tr>
                  <tr><td colSpan={2} style={{ height: '10px' }}></td></tr>
                  <tr><td style={{ padding: '2px 0' }}>Total Tagihan (Termin/SP2D)</td><td style={{ textAlign: 'right' }}>{formatRp(metrics.totalInvoiced)}</td></tr>
                  <tr>
                    <td style={{ padding: '2px 0', fontWeight: 'bold' }}>{metrics.contractAssetLiability >= 0 ? 'Aset Kontrak (Unbilled Receivable)' : 'Liabilitas Kontrak (Unearned Revenue)'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: metrics.contractAssetLiability >= 0 ? '#059669' : '#dc2626' }}>{formatRp(Math.abs(metrics.contractAssetLiability))}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <table style={{ width: '100%', marginTop: '40px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'bottom' }}>
                    <p style={{ margin: '0 0 60px 0', fontSize: '10pt' }}>Dibuat Oleh,</p>
                    <div style={{ display: 'inline-block', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '10pt', padding: '0 15px 2px 15px', borderBottom: '1px solid #000' }}>{signatures.financeName || '........................'}</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '9pt', color: '#475569' }}>{signatures.financeTitle || 'Finance / Admin'}</p>
                    </div>
                  </td>
                  <td style={{ width: '50%', textAlign: 'center', verticalAlign: 'bottom' }}>
                    <p style={{ margin: '0 0 60px 0', fontSize: '10pt' }}>Disetujui Oleh,</p>
                    <div style={{ display: 'inline-block', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', fontSize: '10pt', padding: '0 15px 2px 15px', borderBottom: '1px solid #000' }}>{signatures.pmName || '........................'}</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '9pt', color: '#475569' }}>{signatures.pmTitle || 'Project Manager'}</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ textAlign: 'center', fontSize: '8pt', color: '#94a3b8', marginTop: 'auto', paddingTop: '30px' }}>
              Dokumen ini di-generate secara otomatis oleh Sistem InfraControl PRO (PSAK 115) pada {new Date().toLocaleString('id-ID')}
            </div>

          </div>
        </div>

        {/* HISTORY TABEL */}
        <div className="w-full max-w-7xl print:hidden bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden mt-12 mb-10">
          <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><History size={20} /></div>
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
                  <th className="p-4 text-right">Pendapatan (PoC)</th>
                  <th className="p-4 text-right">HPP</th>
                  <th className="p-4 text-right">Opex</th>
                  <th className="p-4 text-right">Laba Bersih</th>
                  <th className="p-4 text-center">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyData.length === 0 ? (
                  <tr><td colSpan={7} className="p-10 text-center text-slate-400 italic"><FileSpreadsheet size={32} className="mx-auto mb-2 opacity-50" />Belum ada riwayat laporan yang disimpan.</td></tr>
                ) : (
                  historyData.map((hist, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-700">{new Date(hist.created_at).toLocaleString('id-ID')}</td>
                      <td className="p-4 font-bold text-indigo-700">{hist.created_by}</td>
                      <td className="p-4 text-right font-mono text-slate-600">{formatRp(hist.total_revenue)}</td>
                      <td className="p-4 text-right font-mono text-slate-600">{formatRp(hist.total_hpp)}</td>
                      <td className="p-4 text-right font-mono text-slate-600">{formatRp(hist.total_opex)}</td>
                      <td className={`p-4 text-right font-bold font-mono ${hist.net_profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatRp(hist.net_profit)}</td>
                      <td className="p-4 text-center"><span className={`px-3 py-1 rounded-full text-xs font-bold ${hist.net_profit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{Number(hist.margin).toFixed(2)}%</span></td>
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