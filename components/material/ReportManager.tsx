"use client";
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Printer, TrendingDown, Wallet, Info, Building2, Settings, X, Save, UserCircle } from 'lucide-react';

export function ReportManager({ projectId }: { projectId: string }) {
  const [activeReport, setActiveReport] = useState<'material' | 'payment'>('material');
  const [loading, setLoading] = useState(true);
  const [filterKategori, setFilterKategori] = useState('All');
  
  const [materialRecap, setMaterialRecap] = useState<any[]>([]);
  const [paymentRecap, setPaymentRecap] = useState<any[]>([]);
  
  // State untuk Data Proyek (Kop Surat)
  const [projectData, setProjectData] = useState<any>(null);

  // State untuk Pengaturan TTD (LocalStorage)
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [signatures, setSignatures] = useState({
    creatorName: 'Admin Logistik', creatorTitle: 'Staff Logistik',
    checkerName: 'Quantity Surveyor', checkerTitle: 'QS',
    approverName: 'Project Manager', approverTitle: 'PM'
  });

  useEffect(() => {
    fetchReports();
  }, [projectId]);

  const resolveLogoUrl = (proj: any) => {
    if (!proj) return null;
    const rawLogo = proj.logo_url || proj.logo;
    if (!rawLogo) return null;
    if (rawLogo.startsWith('http://') || rawLogo.startsWith('https://')) return rawLogo;
    const { data } = supabase.storage.from('project-assets').getPublicUrl(rawLogo);
    return data?.publicUrl || null;
  };

  const fetchReports = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data: proj } = await supabase.from('projects').select('*').eq('id', projectId).single();
      setProjectData(proj);

      const savedSigs = localStorage.getItem(`report_sig_${projectId}`);
      if (savedSigs) {
        setSignatures(JSON.parse(savedSigs));
      } else if (proj) {
        setSignatures({
          creatorName: 'Admin Logistik', creatorTitle: 'Staff Logistik',
          checkerName: 'Quantity Surveyor', checkerTitle: 'QS',
          approverName: proj.contractor_pic_name || 'Project Manager', 
          approverTitle: proj.contractor_pic_title || 'Site Engineer'
        });
      }

      const { data: reqData } = await supabase.from('task_material_requirements').select(`hsd_id, volume_requirement, master_hsd(nama_item, satuan, kategori_akun)`);
      const { data: poData } = await supabase.from('purchase_order_items').select(`hsd_id, ordered_qty, received_qty, purchase_orders!inner(project_id)`).eq('purchase_orders.project_id', projectId);
      const { data: invData } = await supabase.from('inventory_materials').select('hsd_id, stok_on_hand').eq('project_id', projectId);

      const matMap = new Map();
      
      invData?.forEach(i => {
        matMap.set(i.hsd_id, {
          hsd_id: i.hsd_id, nama_item: 'Memuat...', satuan: '', kategori_akun: 'Material Utama',
          total_kebutuhan: 0, total_dipesan: 0, total_diterima: 0, stok_gudang: i.stok_on_hand || 0
        });
      });

      reqData?.forEach((r: any) => {
        if (!r.hsd_id) return;
        const hsdRel = Array.isArray(r.master_hsd) ? r.master_hsd[0] : r.master_hsd;
        if (!matMap.has(r.hsd_id)) {
          matMap.set(r.hsd_id, {
            hsd_id: r.hsd_id, nama_item: hsdRel?.nama_item || 'Unknown', satuan: hsdRel?.satuan || '',
            kategori_akun: hsdRel?.kategori_akun || 'Material Utama', total_kebutuhan: 0, total_dipesan: 0, total_diterima: 0, stok_gudang: 0
          });
        }
        const currentMat = matMap.get(r.hsd_id);
        currentMat.total_kebutuhan += (r.volume_requirement || 0);
        if (hsdRel) {
          currentMat.nama_item = hsdRel.nama_item;
          currentMat.satuan = hsdRel.satuan;
          currentMat.kategori_akun = hsdRel.kategori_akun;
        }
      });

      poData?.forEach((p: any) => {
        if (!p.hsd_id) return;
        if (matMap.has(p.hsd_id)) {
          matMap.get(p.hsd_id).total_dipesan += (p.ordered_qty || 0);
          matMap.get(p.hsd_id).total_diterima += (p.received_qty || 0);
        }
      });

      const { data: hsdData } = await supabase.from('master_hsd').select('id, nama_item, satuan, kategori_akun');
      hsdData?.forEach((h: any) => {
        if (matMap.has(h.id)) {
          matMap.get(h.id).nama_item = h.nama_item;
          matMap.get(h.id).satuan = h.satuan;
          matMap.get(h.id).kategori_akun = h.kategori_akun || 'Material Utama';
        }
      });

      const processedMat = Array.from(matMap.values()).map(m => {
        const belum_dipesan = Math.max(0, m.total_kebutuhan - m.total_dipesan - m.stok_gudang);
        const belum_datang = Math.max(0, m.total_dipesan - m.total_diterima);
        return { ...m, belum_dipesan, belum_datang };
      }).filter(m => m.total_kebutuhan > 0 || m.total_dipesan > 0 || m.stok_gudang > 0);

      setMaterialRecap(processedMat);

      const { data: poPayments } = await supabase.from('purchase_orders')
        .select(`id, po_number, po_date, grand_total, paid_amount, payment_status, vendor:vendors(name)`)
        .eq('project_id', projectId)
        .order('po_date', { ascending: false });

      setPaymentRecap(poPayments || []);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSignatures = () => {
    localStorage.setItem(`report_sig_${projectId}`, JSON.stringify(signatures));
    setIsSigModalOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const formatRp = (num: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num || 0);
  const formatNum = (num: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num || 0);

  return (
    <div className="space-y-4">
      {/* HEADER LAPORAN (Hanya Layar) */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 print:hidden">
        <div className="flex gap-2">
          <button onClick={() => setActiveReport('material')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeReport === 'material' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <TrendingDown className="w-4 h-4" /> Rekap Material & Shortage
          </button>
          <button onClick={() => setActiveReport('payment')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeReport === 'payment' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <Wallet className="w-4 h-4" /> Rekap Pembayaran PO
          </button>
        </div>
        
        <div className="flex gap-2">
          <button onClick={() => setIsSigModalOpen(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm border border-slate-300 transition-colors">
            <Settings className="w-4 h-4" /> Pengaturan TTD
          </button>
          <button onClick={handlePrint} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors">
            <Printer className="w-4 h-4" /> Cetak Laporan Lengkap
          </button>
        </div>
      </div>

      {/* AREA TAMPILAN LAYAR (Hanya terlihat di Web) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 print:hidden">
        {loading ? (
          <div className="text-center py-10 text-slate-500">Memuat data laporan...</div>
        ) : activeReport === 'material' ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Filter Kategori:</label>
                <select value={filterKategori} onChange={e => setFilterKategori(e.target.value)} className="border rounded-md p-1.5 text-sm focus:ring-1 focus:ring-blue-500 font-semibold">
                  <option value="All">Semua Kategori</option>
                  <option value="Material Utama">Material Utama (AHSP)</option>
                  <option value="Alat Bantu">Alat Bantu</option>
                  <option value="Consumables">Consumables</option>
                </select>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1"><Info className="w-3 h-3"/> Data terintegrasi WBS, PO, & Gudang.</div>
            </div>
            <table className="w-full text-left text-sm" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-3 border border-slate-300">Nama Material</th>
                  <th className="p-3 border border-slate-300 text-center">Kategori</th>
                  <th className="p-3 border border-slate-300 text-center">Satuan</th>
                  <th className="p-3 border border-slate-300 text-right">Kebutuhan</th>
                  <th className="p-3 border border-slate-300 text-right bg-sky-50 text-sky-700">Stok Gudang</th>
                  <th className="p-3 border border-slate-300 text-right">Dipesan</th>
                  <th className="p-3 border border-slate-300 text-right">Diterima</th>
                  <th className="p-3 border border-slate-300 text-right bg-rose-50 text-rose-700">Shortage</th>
                  <th className="p-3 border border-slate-300 text-right bg-amber-50 text-amber-700">Belum Datang</th>
                </tr>
              </thead>
              <tbody>
                {materialRecap.filter(m => filterKategori === 'All' || m.kategori_akun === filterKategori).map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 border border-slate-300 font-semibold">{m.nama_item}</td>
                    <td className="p-3 border border-slate-300 text-center text-xs">{m.kategori_akun}</td>
                    <td className="p-3 border border-slate-300 text-center">{m.satuan}</td>
                    <td className="p-3 border border-slate-300 text-right font-mono">{formatNum(m.total_kebutuhan)}</td>
                    <td className="p-3 border border-slate-300 text-right font-mono font-bold text-sky-600 bg-sky-50/30">{formatNum(m.stok_gudang)}</td>
                    <td className="p-3 border border-slate-300 text-right font-mono">{formatNum(m.total_dipesan)}</td>
                    <td className="p-3 border border-slate-300 text-right font-mono text-emerald-600">{formatNum(m.total_diterima)}</td>
                    <td className={`p-3 border border-slate-300 text-right font-mono font-bold ${m.belum_dipesan > 0 ? 'text-rose-600 bg-rose-50/30' : 'text-slate-400'}`}>{formatNum(m.belum_dipesan)}</td>
                    <td className={`p-3 border border-slate-300 text-right font-mono font-bold ${m.belum_datang > 0 ? 'text-amber-600 bg-amber-50/30' : 'text-slate-400'}`}>{formatNum(m.belum_datang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <table className="w-full text-left text-sm" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="p-3 border border-slate-300">No. PO</th>
                <th className="p-3 border border-slate-300">Vendor</th>
                <th className="p-3 border border-slate-300">Tanggal</th>
                <th className="p-3 border border-slate-300 text-right">Grand Total</th>
                <th className="p-3 border border-slate-300 text-right">Sudah Dibayar</th>
                <th className="p-3 border border-slate-300 text-right bg-rose-50 text-rose-700">Sisa Hutang</th>
                <th className="p-3 border border-slate-300 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {paymentRecap.map((p, idx) => {
                const sisa = p.grand_total - (p.paid_amount || 0);
                return (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 border border-slate-300 font-mono font-semibold">{p.po_number}</td>
                    <td className="p-3 border border-slate-300">{p.vendor?.name}</td>
                    <td className="p-3 border border-slate-300">{new Date(p.po_date).toLocaleDateString('id-ID')}</td>
                    <td className="p-3 border border-slate-300 text-right font-mono">{formatRp(p.grand_total)}</td>
                    <td className="p-3 border border-slate-300 text-right font-mono text-emerald-600">{formatRp(p.paid_amount)}</td>
                    <td className={`p-3 border border-slate-300 text-right font-mono font-bold ${sisa > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{formatRp(sisa)}</td>
                    <td className="p-3 border border-slate-300 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${p.payment_status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : p.payment_status === 'Partially Paid' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        {p.payment_status === 'Partially Paid' ? 'Bayar Sebagian' : p.payment_status === 'Paid' ? 'Lunas' : 'Belum Bayar'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ========================================================= */}
      {/* AREA KHUSUS CETAK (PRINT ONLY) - PURE INLINE STYLE        */}
      {/* ========================================================= */}
      <div id="print-area" className="hidden print:block w-full text-black bg-white" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
        
        {/* KOP SURAT ENTERPRISE (LAYOUT TENGAH) */}
        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
          
          {/* Logo Perusahaan */}
          {resolveLogoUrl(projectData) ? (
            <img 
              src={resolveLogoUrl(projectData)!} 
              alt="Logo" 
              style={{ maxHeight: '70px', maxWidth: '180px', objectFit: 'contain', marginBottom: '8px', display: 'inline-block' }} 
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                document.getElementById('logo-fallback')!.style.display = 'block';
              }}
            />
          ) : null}
          
          {/* Fallback Icon */}
          <div id="logo-fallback" style={{ display: resolveLogoUrl(projectData) ? 'none' : 'block', marginBottom: '8px', color: '#333' }}>
            <Building2 style={{ width: '50px', height: '50px', margin: '0 auto' }} />
          </div>

          {/* Nama Perusahaan (Font Diperkecil ke 22px) */}
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 3px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {projectData?.contractor_name || projectData?.company_name || 'NAMA PERUSAHAAN KONTRAKTOR'}
          </h1>

          {/* Alamat Perusahaan */}
          <p style={{ fontSize: '12px', margin: '0 0 4px 0', color: '#000' }}>
            {projectData?.contractor_address || 'Alamat Perusahaan Belum Diatur'}
          </p>
          
          {/* Kontak (Phone & Email) */}
          {(projectData?.company_phone || projectData?.company_email) && (
            <p style={{ fontSize: '11px', margin: '0 0 6px 0', color: '#000' }}>
              {projectData?.company_phone ? `Telp: ${projectData.company_phone}` : ''} 
              {projectData?.company_phone && projectData?.company_email ? ' | ' : ''}
              {projectData?.company_email ? `Email: ${projectData.company_email}` : ''}
            </p>
          )}

          {/* NAMA PROYEK (DIPINDAH KE HEADER) */}
          <div style={{ marginTop: '4px' }}>
            <p style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>
              PROYEK: {projectData?.name || '-'}
            </p>
          </div>
        </div>
        
        {/* Garis Ganda Pembatas Kop Surat */}
        <div style={{ borderBottom: '3px solid #000', marginBottom: '2px' }}></div>
        <div style={{ borderBottom: '1px solid #000', marginBottom: '20px' }}></div>

        {/* JUDUL LAPORAN (LEBIH BERSIH) */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', textDecoration: 'underline', margin: '0 0 5px 0', textTransform: 'uppercase' }}>Laporan Rekapitulasi Material & Pembayaran PO</h2>
          <p style={{ fontSize: '12px', margin: 0 }}>Dicetak pada: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* BAGIAN A: MATERIAL */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', backgroundColor: '#e2e8f0', padding: '6px', border: '1px solid black', marginBottom: '8px', textTransform: 'uppercase' }}>A. Rekapitulasi Kebutuhan & Pengadaan Material</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid black', padding: '6px', backgroundColor: '#f1f5f9', width: '20%' }}>Nama Material</th>
                <th style={{ border: '1px solid black', padding: '6px', backgroundColor: '#f1f5f9', width: '12%' }}>Kategori</th>
                <th style={{ border: '1px solid black', padding: '6px', backgroundColor: '#f1f5f9', width: '7%' }}>Satuan</th>
                <th style={{ border: '1px solid black', padding: '6px', backgroundColor: '#f1f5f9', width: '10%' }}>Kebutuhan (AHSP)</th>
                <th style={{ border: '1px solid black', padding: '6px', backgroundColor: '#e0f2fe', width: '10%' }}>Stok Gudang</th>
                <th style={{ border: '1px solid black', padding: '6px', backgroundColor: '#f1f5f9', width: '10%' }}>Dipesan (PO)</th>
                <th style={{ border: '1px solid black', padding: '6px', backgroundColor: '#f1f5f9', width: '10%' }}>Diterima</th>
                <th style={{ border: '1px solid black', padding: '6px', backgroundColor: '#ffe4e6', width: '11%' }}>Shortage (Belum Dipesan)</th>
                <th style={{ border: '1px solid black', padding: '6px', backgroundColor: '#fef3c7', width: '10%' }}>Belum Datang</th>
              </tr>
            </thead>
            <tbody>
              {materialRecap.map((m, idx) => (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ border: '1px solid black', padding: '6px', fontWeight: 'bold' }}>{m.nama_item}</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontSize: '10px' }}>{m.kategori_akun}</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{m.satuan}</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'right' }}>{formatNum(m.total_kebutuhan)}</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'right', color: '#0284c7', fontWeight: 'bold' }}>{formatNum(m.stok_gudang)}</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'right' }}>{formatNum(m.total_dipesan)}</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'right', color: '#059669', fontWeight: 'bold' }}>{formatNum(m.total_diterima)}</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'right', color: m.belum_dipesan > 0 ? '#e11d48' : '#64748b', fontWeight: 'bold' }}>{formatNum(m.belum_dipesan)}</td>
                  <td style={{ border: '1px solid black', padding: '6px', textAlign: 'right', color: m.belum_datang > 0 ? '#d97706' : '#64748b', fontWeight: 'bold' }}>{formatNum(m.belum_datang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* BAGIAN B: PEMBAYARAN */}
        <div style={{ marginBottom: '30px', pageBreakBefore: 'always' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', backgroundColor: '#e2e8f0', padding: '6px', border: '1px solid black', marginBottom: '8px', textTransform: 'uppercase' }}>B. Rekapitulasi Pembayaran Purchase Order (PO)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid black', padding: '6px', backgroundColor: '#f1f5f9', width: '15%' }}>No. PO</th>
                <th style={{ border: '1px solid black', padding: '6px', backgroundColor: '#f1f5f9', width: '20%' }}>Vendor</th>
                <th style={{ border: '1px solid black', padding: '6px', backgroundColor: '#f1f5f9', width: '12%' }}>Tanggal</th>
                <th style={{ border: '1px solid black', padding: '6px', backgroundColor: '#f1f5f9', width: '15%' }}>Grand Total</th>
                <th style={{ border: '1px solid black', padding: '6px', backgroundColor: '#f1f5f9', width: '15%' }}>Sudah Dibayar</th>
                <th style={{ border: '1px solid black', padding: '6px', backgroundColor: '#ffe4e6', width: '15%' }}>Sisa Hutang</th>
                <th style={{ border: '1px solid black', padding: '6px', backgroundColor: '#f1f5f9', width: '8%' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {paymentRecap.map((p, idx) => {
                const sisa = p.grand_total - (p.paid_amount || 0);
                return (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ border: '1px solid black', padding: '6px', fontWeight: 'bold' }}>{p.po_number}</td>
                    <td style={{ border: '1px solid black', padding: '6px' }}>{p.vendor?.name}</td>
                    <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center' }}>{new Date(p.po_date).toLocaleDateString('id-ID')}</td>
                    <td style={{ border: '1px solid black', padding: '6px', textAlign: 'right' }}>{formatRp(p.grand_total)}</td>
                    <td style={{ border: '1px solid black', padding: '6px', textAlign: 'right', color: '#059669', fontWeight: 'bold' }}>{formatRp(p.paid_amount)}</td>
                    <td style={{ border: '1px solid black', padding: '6px', textAlign: 'right', color: sisa > 0 ? '#e11d48' : '#64748b', fontWeight: 'bold' }}>{formatRp(sisa)}</td>
                    <td style={{ border: '1px solid black', padding: '6px', textAlign: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                      {p.payment_status === 'Partially Paid' ? 'Sebagian' : p.payment_status === 'Paid' ? 'Lunas' : 'Belum Bayar'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* TANDA TANGAN DINAMIS */}
        <table style={{ width: '100%', marginTop: '60px', pageBreakInside: 'avoid' }}>
          <tbody>
            <tr>
              <td style={{ width: '33.33%', textAlign: 'center', verticalAlign: 'top' }}>
                <p style={{ marginBottom: '70px', fontSize: '13px' }}>Dibuat Oleh,</p>
                <div style={{ display: 'inline-block', borderBottom: '1px solid black', paddingBottom: '2px', minWidth: '150px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase' }}>{signatures.creatorName}</span>
                </div>
                <p style={{ fontSize: '12px', color: '#333', margin: '4px 0 0 0' }}>{signatures.creatorTitle}</p>
              </td>
              
              <td style={{ width: '33.33%', textAlign: 'center', verticalAlign: 'top' }}>
                <p style={{ marginBottom: '70px', fontSize: '13px' }}>Diperiksa Oleh,</p>
                <div style={{ display: 'inline-block', borderBottom: '1px solid black', paddingBottom: '2px', minWidth: '150px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase' }}>{signatures.checkerName}</span>
                </div>
                <p style={{ fontSize: '12px', color: '#333', margin: '4px 0 0 0' }}>{signatures.checkerTitle}</p>
              </td>
              
              <td style={{ width: '33.33%', textAlign: 'center', verticalAlign: 'top' }}>
                <p style={{ marginBottom: '70px', fontSize: '13px' }}>Disetujui Oleh,</p>
                <div style={{ display: 'inline-block', borderBottom: '1px solid black', paddingBottom: '2px', minWidth: '150px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase' }}>{signatures.approverName}</span>
                </div>
                <p style={{ fontSize: '12px', color: '#333', margin: '4px 0 0 0' }}>{signatures.approverTitle}</p>
              </td>
            </tr>
          </tbody>
        </table>

        {/* FOOTER */}
        <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '10px', color: '#666', borderTop: '1px solid #ccc', paddingTop: '8px' }}>
          Dokumen ini dihasilkan secara otomatis oleh Sistem ERP InfraControl PRO. Rahasia & Tidak untuk disebarluaskan.
        </div>
      </div>

      {/* MODAL PENGATURAN TANDA TANGAN */}
      {isSigModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in print:hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><UserCircle className="w-5 h-5 text-blue-600" /> Pengaturan Tanda Tangan Laporan</h2>
              <button onClick={() => setIsSigModalOpen(false)} className="text-slate-400 hover:text-red-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg border border-blue-200">
                Pengaturan ini disimpan di browser Anda (LocalStorage) dan akan otomatis muncul pada cetakan PDF.
              </div>

              <div className="space-y-2 border p-3 rounded-lg bg-slate-50">
                <p className="text-xs font-bold text-slate-700 uppercase">1. Dibuat Oleh (Logistik)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Nama Lengkap</label>
                    <input type="text" value={signatures.creatorName} onChange={e => setSignatures({...signatures, creatorName: e.target.value})} className="w-full border rounded p-1.5 text-sm focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Jabatan</label>
                    <input type="text" value={signatures.creatorTitle} onChange={e => setSignatures({...signatures, creatorTitle: e.target.value})} className="w-full border rounded p-1.5 text-sm focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <div className="space-y-2 border p-3 rounded-lg bg-slate-50">
                <p className="text-xs font-bold text-slate-700 uppercase">2. Diperiksa Oleh (QS)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Nama Lengkap</label>
                    <input type="text" value={signatures.checkerName} onChange={e => setSignatures({...signatures, checkerName: e.target.value})} className="w-full border rounded p-1.5 text-sm focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Jabatan</label>
                    <input type="text" value={signatures.checkerTitle} onChange={e => setSignatures({...signatures, checkerTitle: e.target.value})} className="w-full border rounded p-1.5 text-sm focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              <div className="space-y-2 border p-3 rounded-lg bg-slate-50">
                <p className="text-xs font-bold text-slate-700 uppercase">3. Disetujui Oleh (PM)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Nama Lengkap</label>
                    <input type="text" value={signatures.approverName} onChange={e => setSignatures({...signatures, approverName: e.target.value})} className="w-full border rounded p-1.5 text-sm focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Jabatan</label>
                    <input type="text" value={signatures.approverTitle} onChange={e => setSignatures({...signatures, approverTitle: e.target.value})} className="w-full border rounded p-1.5 text-sm focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setIsSigModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border rounded-lg hover:bg-slate-100">Batal</button>
              <button onClick={handleSaveSignatures} className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2">
                <Save className="w-4 h-4" /> Simpan Pengaturan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}