'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Clock, FileText, Loader2, AlertTriangle } from 'lucide-react';
import { getPendingPayments, updatePaymentStatus } from '@/lib/services/subcon.service';
import { MoneyText } from '@/components/ui/MoneyText';
import { useRole } from '@/lib/hooks/useRole';

export function ApprovalWorkflowView({ projectId, showToast }: { projectId: string, showToast: (msg: string, type: 'success' | 'error') => void }) {
  const [loading, setLoading] = useState(true);
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [actionTarget, setActionTarget] = useState<{ id: string, status: 'Approved' | 'Paid' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { can } = useRole(projectId);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getPendingPayments(projectId);
      setPendingList(res || []);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleProcess = async () => {
    if (!actionTarget) return;
    setIsProcessing(true);
    try {
      await updatePaymentStatus(actionTarget.id, actionTarget.status);
      showToast(`Pengajuan berhasil diubah menjadi ${actionTarget.status}`, 'success');
      setActionTarget(null);
      loadData();
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!can('SUBCON_PAY')) {
    return (
      <div className="p-8 text-center bg-red-50 text-red-600 rounded-xl border border-red-200">
        <AlertTriangle className="mx-auto mb-2" size={32} />
        <h3 className="font-bold text-lg">Akses Ditolak</h3>
        <p className="text-sm">Anda tidak memiliki izin untuk menyetujui pengajuan keuangan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border shadow-sm">
        <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-4 flex items-center gap-2">
          <CheckCircle className="text-blue-600" /> Persetujuan Pengajuan (Approval)
        </h3>
        <p className="text-sm text-slate-500 mb-4">Daftar pengajuan Kasbon/Opname yang berstatus <b>Pending</b> dan membutuhkan persetujuan Anda.</p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[800px]">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-4 border-b">No. Form</th>
                <th className="p-4 border-b">Tanggal</th>
                <th className="p-4 border-b">Mandor / SPK</th>
                <th className="p-4 border-b">Tipe</th>
                <th className="p-4 border-b">Nominal</th>
                <th className="p-4 border-b text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></td></tr>
              ) : pendingList.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="p-4 border-b font-bold text-blue-700">{item.payment_number}</td>
                  <td className="p-4 border-b">{new Date(item.payment_date).toLocaleDateString('id-ID')}</td>
                  <td className="p-4 border-b">
                    <span className="font-bold">{item.subcontractor_contracts?.subcontractors?.company_name}</span>
                    <span className="block text-xs text-slate-500">{item.subcontractor_contracts?.spk_number}</span>
                  </td>
                  <td className="p-4 border-b">
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold">{item.payment_type}</span>
                  </td>
                  <td className="p-4 border-b font-bold text-slate-800"><MoneyText value={item.amount} /></td>
                  <td className="p-4 border-b text-right flex justify-end gap-2">
                    <button onClick={() => setActionTarget({ id: item.id, status: 'Approved' })} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-bold text-xs shadow-sm flex items-center gap-1">
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button onClick={() => setActionTarget({ id: item.id, status: 'Paid' })} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded font-bold text-xs shadow-sm flex items-center gap-1">
                      Tandai Lunas
                    </button>
                  </td>
                </tr>
              ))}
              {pendingList.length === 0 && !loading && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500 italic">Tidak ada pengajuan yang menunggu persetujuan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL KONFIRMASI AKSI */}
      {!!actionTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 text-center">
              <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 ${actionTarget.status === 'Approved' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {actionTarget.status === 'Approved' ? <CheckCircle size={32} /> : <Clock size={32} />}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Konfirmasi Persetujuan</h3>
              <p className="text-sm text-slate-500">
                Apakah Anda yakin ingin mengubah status pengajuan ini menjadi <b>{actionTarget.status}</b>?
                {actionTarget.status === 'Approved' && " (Data akan dianggap sebagai hutang yang disetujui)"}
                {actionTarget.status === 'Paid' && " (Kasbon akan langsung memotong Kas Flow Proyek)"}
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-end border-t">
              <button onClick={() => setActionTarget(null)} disabled={isProcessing} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg">Batal</button>
              <button onClick={handleProcess} disabled={isProcessing} className={`px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm flex items-center gap-2 ${actionTarget.status === 'Approved' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                {isProcessing ? <Loader2 className="animate-spin" size={16} /> : 'Ya, Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}