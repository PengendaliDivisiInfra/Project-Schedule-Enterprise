"use client";
import { useState, useEffect } from 'react';
import { 
  Banknote, Play, CheckCircle, Wallet, Loader2, AlertCircle, 
  FileText, Trash2, History, Eye, X, Printer 
} from 'lucide-react';
import { 
  generatePayroll, savePayroll, approvePayroll, payPayroll, 
  getPayrollHistory, voidPayroll, getPayrollDetails 
} from '@/lib/services/payroll-service';
import { useRole } from '@/lib/hooks/useRole';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export function PayrollManager({ projectId }: { projectId: string }) {
  const { can } = useRole(projectId);
  const canEdit = can('MANAGE_COA');
  const router = useRouter();

  // State Utama
  const [payrollType, setPayrollType] = useState<'Weekly' | 'Monthly'>('Weekly');
  const [wbsTasks, setWbsTasks] = useState<any[]>([]);
  const [selectedWbsCode, setSelectedWbsCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  
  // State Preview & Draft
  const [previewData, setPreviewData] = useState<any>(null);
  const [savedPayrollId, setSavedPayrollId] = useState<string | null>(null);
  
  // State History & Modals
  const [history, setHistory] = useState<any[]>([]);
  const [voidTarget, setVoidTarget] = useState<any | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);
  
  const [viewTarget, setViewTarget] = useState<any | null>(null);
  const [viewDetails, setViewDetails] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  const showToast = (msg: string, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3000);
  };

  // ==========================================
  // FUNGSI FETCH DATA
  // ==========================================
  const loadHistory = async () => {
    if (!projectId) return;
    try {
      const data = await getPayrollHistory(projectId);
      setHistory(data || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  useEffect(() => {
    loadHistory();
    if (projectId) {
      supabase
        .from('wbs_tasks')
        .select('id, wbs_code, name, summary')
        .eq('project_id', projectId)
        .order('wbs_code')
        .then(({ data }) => setWbsTasks((data || []).filter((t: any) => t.summary !== 'Yes')));
    }
  }, [projectId]);

  const handleOpenView = async (payroll: any) => {
    setViewTarget(payroll);
    setLoadingDetail(true);
    try {
      const details = await getPayrollDetails(payroll.id);
      setViewDetails(details || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handlePrint = (payrollId: string) => {
    router.push(`/manpower/print/${payrollId}`);
  };

  // ==========================================
  // FUNGSI GENERATE & PROSES PAYROLL
  // ==========================================
  const handleGenerate = async () => {
    if (!projectId) return showToast("Proyek belum dipilih", "error");
    if (!startDate || !endDate) return showToast("Pilih rentang tanggal!", "error");
    
    setLoading(true);
    setPreviewData(null);
    setSavedPayrollId(null);
    
    try {
      const res = await generatePayroll(projectId, startDate, endDate, payrollType);
      setPreviewData(res);
      showToast("Kalkulasi gaji berhasil dibuat.", "success");
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!previewData || !projectId) return;
    setLoading(true);
    try {
      const matchedTask = wbsTasks.find((t) => t.wbs_code === selectedWbsCode);
      const res = await savePayroll(projectId, startDate, endDate, payrollType, previewData.items, previewData.totalAmount, selectedWbsCode || null, matchedTask?.id || null);
      setSavedPayrollId(res.id);
      showToast("Draft Payroll berhasil disimpan.", "success");
      await loadHistory();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!savedPayrollId || !previewData || !projectId) return;
    setLoading(true);
    try {
      const matchedTask = wbsTasks.find((t) => t.wbs_code === selectedWbsCode);
      await approvePayroll(savedPayrollId, projectId, previewData.totalAmount, endDate, selectedWbsCode || null, matchedTask?.id || null);
      showToast("Payroll di-Approve. Biaya masuk ke Laporan Laba Rugi (HPP).", "success");
      setPreviewData(null);
      setSavedPayrollId(null);
      await loadHistory();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!savedPayrollId || !previewData || !projectId) return;
    setLoading(true);
    try {
      await payPayroll(savedPayrollId, projectId, previewData.totalAmount, endDate);
      showToast("Gaji telah dibayar. Kas Keluar tercatat.", "success");
      setPreviewData(null);
      setSavedPayrollId(null);
      await loadHistory();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVoid = async () => {
    if (!voidTarget || !projectId) return;
    setIsVoiding(true);
    try {
      const desc = `Gaji Karyawan (${voidTarget.payroll_type} s/d ${new Date(voidTarget.period_end).toLocaleDateString('id-ID')})`;
      await voidPayroll(voidTarget.id, projectId, voidTarget.total_amount, voidTarget.status, desc);
      showToast("Payroll berhasil dibatalkan (Void).", "success");
      setVoidTarget(null);
      await loadHistory();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsVoiding(false);
    }
  };

  // ==========================================
  // HELPER
  // ==========================================
  const formatRp = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
  const formatDate = (dateStr: string) => dateStr ? new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* TOAST */}
      {toast.show && (
        <div className={`fixed top-5 right-5 z-[10000] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border animate-in slide-in-from-top-4 fade-in ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-6 h-6 text-emerald-500" /> : <AlertCircle className="w-6 h-6 text-red-500" />}
          <span className="font-bold text-sm">{toast.msg}</span>
        </div>
      )}

      {/* ========================================= */}
      {/* 1. FORM GENERATE PAYROLL */}
      {/* ========================================= */}
      <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4"><Banknote className="w-5 h-5 text-indigo-600" /> Generate Gaji Karyawan</h3>
        
        <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Tipe Payroll</label>
            <select value={payrollType} onChange={e => setPayrollType(e.target.value as any)} className="border border-slate-300 p-2.5 rounded-lg bg-white font-semibold text-sm outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="Weekly">Mingguan (Karyawan Proyek)</option>
              <option value="Monthly">Bulanan (Karyawan Kantor)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Mulai</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Selesai</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="min-w-[220px]">
            <label className="block text-xs font-bold text-slate-600 mb-1">Pos Biaya Tenaga Kerja (WBS RAB)</label>
            <select value={selectedWbsCode} onChange={e => setSelectedWbsCode(e.target.value)} className="w-full border border-slate-300 p-2.5 rounded-lg bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">-- Umum Proyek (Tanpa WBS) --</option>
              {wbsTasks.map((t) => (
                <option key={t.id} value={t.wbs_code}>[{t.wbs_code}] {t.name}</option>
              ))}
            </select>
          </div>
          <button onClick={handleGenerate} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors disabled:opacity-70">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Generate Gaji
          </button>
        </div>
      </div>

      {/* ========================================= */}
      {/* 2. PREVIEW & ACTION (MUNCUL SETELAH GENERATE) */}
      {/* ========================================= */}
      {previewData && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
          <div className="p-4 border-b bg-slate-800 text-white flex justify-between items-center">
            <h4 className="font-bold flex items-center gap-2"><FileText className="w-4 h-4" /> Preview Kalkulasi Gaji</h4>
            <div className="text-xl font-mono font-bold text-emerald-400">{formatRp(previewData.totalAmount)}</div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="p-3">Nama</th>
                  <th className="p-3 text-center">Hadir (Hari)</th>
                  <th className="p-3 text-center">Lembur (Jam)</th>
                  <th className="p-3 text-right">Gaji Dasar</th>
                  <th className="p-3 text-right">Uang Lembur</th>
                  <th className="p-3 text-right">Uang Makan</th>
                  <th className="p-3 text-right">Total Diterima</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewData.items.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-800">{item.name}</td>
                    <td className="p-3 text-center font-mono">{item.days_present}</td>
                    <td className="p-3 text-center font-mono">{item.total_overtime_hours}</td>
                    <td className="p-3 text-right font-mono">{formatRp(item.base_pay)}</td>
                    <td className="p-3 text-right font-mono">{formatRp(item.overtime_pay)}</td>
                    <td className="p-3 text-right font-mono">{formatRp(item.meal_pay)}</td>
                    <td className="p-3 text-right font-mono font-bold text-indigo-700">{formatRp(item.total_pay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
            {!savedPayrollId ? (
              <button onClick={handleSaveDraft} disabled={loading} className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Simpan Draft Payroll
              </button>
            ) : (
              <>
                <button onClick={handleApprove} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Approve (Masuk HPP)
                </button>
                <button onClick={handlePay} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> Bayar (Kas Keluar)
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* 3. TABEL RIWAYAT PAYROLL */}
      {/* ========================================= */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-indigo-600" /> Riwayat Payroll</h3>
          <span className="text-xs text-slate-500 font-semibold bg-slate-200 px-2 py-1 rounded">Klik baris untuk melihat detail</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white text-slate-500 text-xs uppercase border-b">
              <tr>
                <th className="p-4">Tipe / Periode</th>
                <th className="p-4 text-right">Total Gaji</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Belum ada riwayat payroll.</td></tr>
              ) : history.map((h) => (
                <tr key={h.id} onClick={() => handleOpenView(h)} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                  <td className="p-4">
                    <div className="font-bold text-slate-800 group-hover:text-indigo-600">{h.payroll_type === 'Weekly' ? 'Mingguan' : 'Bulanan'}</div>
                    <div className="text-xs text-slate-500">{formatDate(h.period_start)} s/d {formatDate(h.period_end)}</div>
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-slate-700">{formatRp(h.total_amount)}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${h.status === 'Draft' ? 'bg-slate-100 text-slate-600' : h.status === 'Approved' ? 'bg-blue-100 text-blue-700' : h.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {h.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button className="text-slate-400 group-hover:text-indigo-600 p-1.5" title="Lihat Detail"><Eye className="w-4 h-4" /></button>
                      
                      {/* TOMBOL PRINT */}
                      <button onClick={(e) => { e.stopPropagation(); handlePrint(h.id); }} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-colors" title="Cetak Laporan & Slip Gaji">
                        <Printer className="w-4 h-4" />
                      </button>

                      {h.status !== 'Voided' && canEdit && (
                        <button onClick={(e) => { e.stopPropagation(); setVoidTarget(h); }} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors" title="Batalkan (Void)">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================= */}
      {/* 4. MODAL VIEW DETAILS */}
      {/* ========================================= */}
      {viewTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-slate-800 text-white shrink-0">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="w-5 h-5" /> Detail Payroll</h2>
                <p className="text-xs text-slate-300">Periode: {formatDate(viewTarget.period_start)} - {formatDate(viewTarget.period_end)}</p>
              </div>
              <button onClick={() => setViewTarget(null)} className="text-slate-400 hover:text-white bg-slate-700 p-2 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-0 overflow-y-auto">
              {loadingDetail ? (
                <div className="p-8 text-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2"/> Memuat detail...</div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-100 sticky top-0 text-slate-600 text-xs uppercase z-10 shadow-sm">
                    <tr>
                      <th className="p-3">Nama Karyawan</th>
                      <th className="p-3 text-center">Hadir</th>
                      <th className="p-3 text-center">Lembur</th>
                      <th className="p-3 text-right">Gaji Dasar</th>
                      <th className="p-3 text-right">Lembur</th>
                      <th className="p-3 text-right">Uang Makan</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewDetails.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-800">
                          {d.employees?.name || 'Unknown'}
                          <span className="block text-[10px] text-slate-500 font-normal">{d.employees?.role_title}</span>
                        </td>
                        <td className="p-3 text-center font-mono">{d.days_present}</td>
                        <td className="p-3 text-center font-mono">{d.total_overtime_hours} Hr</td>
                        <td className="p-3 text-right font-mono">{formatRp(d.base_pay)}</td>
                        <td className="p-3 text-right font-mono">{formatRp(d.overtime_pay)}</td>
                        <td className="p-3 text-right font-mono">{formatRp(d.meal_pay)}</td>
                        <td className="p-3 text-right font-mono font-bold text-indigo-700">{formatRp(d.total_pay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-3 border-t bg-slate-50 flex justify-between items-center shrink-0">
               <span className="font-bold text-slate-600 ml-2">Total: <span className="text-indigo-700 font-mono text-lg ml-1">{formatRp(viewTarget.total_amount)}</span></span>
               <div className="flex gap-2">
                 <button onClick={() => setViewTarget(null)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border rounded-lg hover:bg-slate-100">Tutup</button>
                 <button onClick={() => handlePrint(viewTarget.id)} className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2 shadow-sm">
                   <Printer className="w-4 h-4" /> Cetak Slip & Laporan
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* 5. MODAL VOID PAYROLL */}
      {/* ========================================= */}
      {voidTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 flex flex-col p-6 text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-rose-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Batalkan Payroll?</h3>
            <p className="text-sm text-slate-600 mt-2 mb-6">Tindakan ini akan membatalkan biaya di Laba Rugi (jika sudah Approve) dan mengembalikan Kas (jika sudah Bayar).</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setVoidTarget(null)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Batal</button>
              <button onClick={handleVoid} disabled={isVoiding} className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-2 shadow-sm transition-colors">
                {isVoiding ? 'Memproses...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}