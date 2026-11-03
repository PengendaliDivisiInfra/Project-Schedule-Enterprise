'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Plus, X, Loader2, Save, CheckCircle2, UploadCloud, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function CashFlowPage() {
  const [flows, setFlows] = useState([]);
  const [tasks, setTasks] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedWbsBudget, setSelectedWbsBudget] = useState(null);
  const [activeTab, setActiveTab] = useState('ledger');
  const [costControlData, setCostControlData] = useState([]);

  const [formData, setFormData] = useState({
    type: 'OUT', 
    category: 'Material', 
    description: '', 
    amount: 0, 
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: 'Transfer',
    vendor_or_ref: '',
    wbs_code: '',
    approval_status: 'Pending',
    overbudget_reason: ''
  });

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: flowData } = await supabase.from('cash_flows').select('*').order('transaction_date', { ascending: false });
    if (flowData) setFlows(flowData);

    // Fetch WBS beserta sisa anggarannya
    const { data: taskData } = await supabase.from('v_cost_control_wbs').select('*').order('wbs_code');
    if (taskData) setTasks(taskData);

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (activeTab === 'cost_control') {
      const fetchCostControl = async () => {
        const { data, error } = await supabase
          .from('v_cost_control_wbs')
          .select('*')
          .order('wbs_code', { ascending: true });
        
        if (!error && data) {
          setCostControlData(data);
        }
      };
      fetchCostControl();
    }
  }, [activeTab]);

  // Fungsi saat WBS dipilih di form
  const handleWbsChange = (e) => {
    const wbsCode = e.target.value;
    setFormData({ ...formData, wbs_code: wbsCode });
    
    const wbsData = tasks.find(t => t.wbs_code === wbsCode);
    setSelectedWbsBudget(wbsData ? wbsData.sisa_anggaran_plafon : null);
  };

  // Fungsi Approval
  const handleApprove = async (id) => {
    const { error } = await supabase.from('cash_flows').update({ approval_status: 'Approved' }).eq('id', id);
    if (!error) {
      showToast('success', 'Transaksi berhasil di-approve!');
      fetchData();
    }
  };

  const handleReject = async (id) => {
    const { error } = await supabase.from('cash_flows').update({ approval_status: 'Rejected' }).eq('id', id);
    if (!error) {
      showToast('danger', 'Transaksi ditolak.');
      fetchData();
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Validasi wajib file
    const isUploadRequired = formData.type === 'OUT' && (formData.payment_method === 'Petty Cash' || formData.payment_method === 'Tunai');
    if (isUploadRequired && !file) {
      alert("Wajib mengunggah bukti nota/kuitansi untuk pembayaran Tunai atau Petty Cash!");
      return;
    }

    // Validasi wajib alasan jika Overbudget
    if (isOverbudget && !formData.overbudget_reason) {
      alert("Wajib mengisi alasan overbudget!");
      return;
    }
    
    setIsSaving(true);
    let finalAttachmentUrl = null;

    try {
      if (file) {
        setIsUploading(true);
        const fileExt = file.name.split('.').pop();
        const fileName = `fin_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('evidence').upload(fileName, file);
        if (uploadError) throw new Error("Gagal upload nota: " + uploadError.message);
        const { data: urlData } = supabase.storage.from('evidence').getPublicUrl(fileName);
        finalAttachmentUrl = urlData.publicUrl;
      }

      // Tentukan status berdasarkan ketersediaan anggaran
      const finalStatus = isOverbudget ? 'Pending Overbudget' : 'Pending';

      const payload = { 
        ...formData, 
        approval_status: finalStatus, // Status otomatis di-escalate
        amount: Number(formData.amount),
        attachment_url: finalAttachmentUrl 
      };
      
      const { error } = await supabase.from('cash_flows').insert([payload]);
      if (error) throw error;

      setIsModalOpen(false);
      showToast('success', 'Transaksi berhasil diajukan!');
      setFormData({ type: 'OUT', category: 'Material', description: '', amount: 0, transaction_date: new Date().toISOString().split('T')[0], payment_method: 'Transfer', vendor_or_ref: '', wbs_code: '',
    approval_status: 'Pending',
    overbudget_reason: '' });
      setFile(null);
      setSelectedWbsBudget(null);
      fetchData();

    } catch (error) {
      alert(error.message);
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  // Hanya transaksi APPROVED yang masuk kalkulasi total
  const totalIn = flows.filter(f => f.type === 'IN' && f.approval_status === 'Approved').reduce((sum, f) => sum + Number(f.amount), 0);
  const totalOut = flows.filter(f => f.type === 'OUT' && f.approval_status === 'Approved').reduce((sum, f) => sum + Number(f.amount), 0);
  const netCash = totalIn - totalOut;

  const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
  const isOverbudget = selectedWbsBudget !== null && Number(formData.amount) > selectedWbsBudget;

  if (loading) return <LoadingSpinner text="Memuat Data Keuangan..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen relative">
      
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <CheckCircle2 size={18} /> {toast.message}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Wallet className="text-indigo-600" /> Cash Flow Management
            </h1>
            <p className="text-sm text-slate-500 mt-1">Pantau arus kas aktual (Approved) dan pengajuan transaksi baru.</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition-colors flex items-center gap-2">
            <Plus size={16} /> Tambah Transaksi
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-emerald-500 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Kas Masuk (Approved)</p>
              <p className="text-xl font-bold text-emerald-600">{formatRp(totalIn)}</p>
            </div>
            <ArrowDownCircle className="text-emerald-500 opacity-50" size={40} />
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-red-500 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Kas Keluar (Approved)</p>
              <p className="text-xl font-bold text-red-600">{formatRp(totalOut)}</p>
            </div>
            <ArrowUpCircle className="text-red-500 opacity-50" size={40} />
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-indigo-500 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-1">Saldo Bersih (Net)</p>
              <p className={`text-xl font-bold ${netCash >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>{formatRp(netCash)}</p>
            </div>
            <Wallet className="text-indigo-500 opacity-50" size={40} />
          </div>
        </div>        
                {/* Navigasi Tab */}
        <div className="flex space-x-6 mb-4 border-b border-slate-200 mt-6">
          <button onClick={() => setActiveTab('ledger')} className={`pb-3 font-medium transition-colors ${activeTab === 'ledger' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
            Riwayat Transaksi (Ledger)
          </button>
          <button onClick={() => setActiveTab('cost_control')} className={`pb-3 font-medium transition-colors ${activeTab === 'cost_control' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
            Kontrol Anggaran (Cost Control)
          </button>
        </div>

        {activeTab === 'ledger' && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-24">Tanggal</th>
                  <th className="p-3 w-20 text-center">Tipe</th>
                  <th className="p-3 w-32">Kategori</th>
                  <th className="p-3 w-20">WBS</th>
                  <th className="p-3 w-24 text-center">Status</th>
                  <th className="p-3 text-right">Nominal (Rp)</th>
                  <th className="p-3 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {flows.length === 0 && (
                  <tr><td colSpan={7} className="p-10 text-center text-slate-500 italic">Belum ada data transaksi.</td></tr>
                )}
                {flows.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-600 text-xs">{new Date(f.transaction_date).toLocaleDateString('id-ID')}</td>
                    <td className="p-3 text-center">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${f.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {f.type === 'IN' ? 'MASUK' : 'KELUAR'}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-semibold text-slate-700">{f.category}</td>
                    <td className="p-3 font-mono text-[10px]">{tasks.find(t => t.wbs_code === f.wbs_code)?.task_name || f.wbs_code || '-'}</td>
                    <td className="p-3 text-center">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        f.approval_status === 'Approved' ? 'bg-green-100 text-green-700' : 
                        f.approval_status === 'Rejected' ? 'bg-red-100 text-red-700' : 
                        f.approval_status === 'Pending Overbudget' ? 'bg-orange-100 text-orange-700 border border-orange-300' : 
                        'bg-amber-100 text-amber-700'
                      }`}>{f.approval_status}</span>
                    </td>
                    <td className={`p-3 text-right font-bold ${f.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatRp(f.amount)}
                    </td>
                    <td className="p-3 text-center">
                      {f.approval_status === 'Pending' ? (
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => handleApprove(f.id)} className="bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded text-xs font-bold" title="Approve"><ShieldCheck size={14}/></button>
                          <button onClick={() => handleReject(f.id)} className="bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1 rounded text-xs font-bold" title="Reject"><X size={14}/></button>
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {activeTab === 'cost_control' && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-semibold">Kode WBS</th>
                    <th className="p-4 font-semibold">Nama Pekerjaan</th>
                    <th className="p-4 font-semibold text-right">Pagu RAP (Rp)</th>
                    <th className="p-4 font-semibold text-right">Terpakai (Rp)</th>
                    <th className="p-4 font-semibold text-right">Sisa Plafon (Rp)</th>
                    <th className="p-4 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                                    {costControlData.map((item, index) => {
                    const isParent = !item.wbs_code.includes('.');
                    return (
                    <tr key={index} className={`transition-colors ${isParent ? 'bg-slate-50 border-t-2 border-slate-200' : 'hover:bg-slate-50'}`}>
                      <td className={`p-4 text-sm font-mono ${isParent ? 'text-slate-800 font-bold' : 'text-slate-600'}`}>{item.wbs_code}</td>
                      <td className={`p-4 text-sm ${isParent ? 'text-slate-900 font-bold' : 'text-slate-800 font-medium'}`}>{item.task_name}</td>
                      <td className={`p-4 text-sm text-right ${isParent ? 'font-bold text-slate-800' : 'text-slate-600'}`}>{formatRp(item.pagu_anggaran_rap)}</td>
                      <td className={`p-4 text-sm text-right ${isParent ? 'font-bold text-rose-700' : 'text-rose-600 font-medium'}`}>{formatRp(item.total_pengeluaran_aktual)}</td>
                      <td className={`p-4 text-sm text-right font-bold ${item.sisa_anggaran_plafon < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatRp(item.sisa_anggaran_plafon)}
                      </td>
                      <td className="p-4 text-center">
                        {item.sisa_anggaran_plafon < 0 ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold">
                            <AlertTriangle size={12} /> Overbudget
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                            <ShieldCheck size={12} /> Aman
                          </span>
                        )}
                      </td>
                    </tr>
                  )})}
                  {costControlData.length === 0 && (
                    <tr><td colSpan="6" className="p-8 text-center text-slate-500">Belum ada data kontrol anggaran.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
{/* MODAL TAMBAH TRANSAKSI */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Wallet className="text-indigo-600"/> Ajukan Transaksi</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tipe Transaksi</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value, category: e.target.value === 'IN' ? 'Termin' : 'Material'})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option value="IN">Kas Masuk (Pemasukan)</option>
                    <option value="OUT">Kas Keluar (Pengeluaran)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal</label>
                  <input required type="date" value={formData.transaction_date} onChange={e => setFormData({...formData, transaction_date: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Kategori</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    {formData.type === 'IN' ? (
                      <><option value="DP">Uang Muka (DP)</option><option value="Termin">Termin Pembayaran</option><option value="Retensi">Pencairan Retensi</option><option value="Lainnya">Lainnya</option></>
                    ) : (
                      <><option value="Material">Pembelian Material</option><option value="Upah">Upah Tenaga Kerja</option><option value="Alat">Sewa Alat Berat</option><option value="Operasional">Biaya Operasional</option><option value="Subkon">Pembayaran Subkon</option><option value="Lainnya">Lainnya</option></>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Relasi WBS (Budget Link)</label>
                  <select value={formData.wbs_code} onChange={handleWbsChange} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option value="">-- Tanpa Relasi WBS --</option>
                    {tasks.map(t => <option key={t.wbs_code} value={t.wbs_code}>[{t.wbs_code}] {t.task_name}</option>)}
                  </select>
                  {selectedWbsBudget !== null && (
                        <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1"><ShieldCheck size={12}/> Informasi Anggaran WBS</p>
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-600">Sisa Plafon Tersedia:</span>
        <strong className={`text-sm ${selectedWbsBudget < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatRp(selectedWbsBudget)}</strong>
      </div>
    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Vendor / No. Invoice (Opsional)</label>
                  <input type="text" value={formData.vendor_or_ref} onChange={e => setFormData({...formData, vendor_or_ref: e.target.value})} placeholder="cth: PT. Baja Perkasa / INV-001" className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Metode Pembayaran</label>
                  <select value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option value="Transfer">Transfer Bank</option>
                    <option value="Petty Cash">Petty Cash (Kas Kecil)</option>
                    <option value="Giro">Giro / Cheque</option>
                    <option value="Tunai">Tunai</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nominal (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">Rp</span>
                  <input required type="text" value={formData.amount ? Number(formData.amount).toLocaleString('id-ID') : ''} onChange={(e) => { const rawValue = e.target.value.replace(/\D/g, ''); setFormData({ ...formData, amount: rawValue }); }} className={`w-full border p-2 pl-10 rounded-lg text-sm focus:ring-2 outline-none font-bold text-lg ${isOverbudget ? 'border-red-500 bg-red-50 text-red-700 focus:ring-red-500' : 'border-slate-300 focus:ring-indigo-500'}`} placeholder="0" />
                </div>
                {isOverbudget && (
                  <>
                    <p className="text-xs text-red-600 font-bold mt-1 flex items-center gap-1"><AlertTriangle size={12}/> Nominal melebihi sisa anggaran WBS!</p>
                    <div className="mt-3 bg-red-50 p-3 rounded-lg border border-red-200">
                      <label className="block text-xs font-bold text-red-700 mb-1">Alasan Overbudget (Wajib Diisi)</label>
                      <textarea 
                        required 
                        rows="2" 
                        value={formData.overbudget_reason} 
                        onChange={e => setFormData({...formData, overbudget_reason: e.target.value})} 
                        placeholder="cth: Kenaikan harga material mendadak / perubahan spesifikasi di lapangan" 
                        className="w-full border border-red-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none bg-white text-slate-800" 
                      />
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Keterangan Tambahan</label>
                <textarea rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="cth: Pembelian besi 10mm 50 batang" className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Upload Bukti Transaksi (Nota/Kuitansi) {(formData.type === 'OUT' && (formData.payment_method === 'Tunai' || formData.payment_method === 'Petty Cash')) && <span className="text-red-500">*</span>}</label>
                <div className="flex items-center gap-3">
                  <label className={`cursor-pointer border px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${(formData.type === 'OUT' && (formData.payment_method === 'Tunai' || formData.payment_method === 'Petty Cash')) && !file ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'}`}>
                    <UploadCloud size={16} /> Pilih File
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files[0])} className="hidden" />
                  </label>
                  <span className="text-xs text-slate-500 truncate max-w-[200px]">{file ? file.name : (formData.type === 'OUT' && (formData.payment_method === 'Tunai' || formData.payment_method === 'Petty Cash') ? 'Wajib diisi!' : 'Belum ada file (Opsional)')}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Batal</button>
                <button type="submit" disabled={isSaving || isUploading} className={`px-6 py-2 text-sm font-bold text-white rounded-lg shadow-md transition-all flex items-center gap-2 ${(isSaving || isUploading) ? 'bg-indigo-400 cursor-not-allowed' : isOverbudget ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                  {(isSaving || isUploading) ? <><Loader2 size={16} className="animate-spin" /> Memproses...</> : isOverbudget ? <><AlertTriangle size={16}/> Ajukan (Overbudget)</> : <><Save size={16}/> Ajukan Transaksi</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


