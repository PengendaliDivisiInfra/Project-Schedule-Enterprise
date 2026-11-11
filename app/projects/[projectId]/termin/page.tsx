'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRole } from '@/lib/hooks/useRole';
import { getContractByProject, listTermins, approveTermin } from '@/lib/services/termin.service';
import { listReceipts } from '@/lib/services/cash-in.service';
import { listReleases } from '@/lib/services/retention.service';
import { ClientContract, ProjectTermin, ClientReceipt, RetentionRelease } from '@/lib/types/termin';
import { MoneyText } from '@/components/ui/MoneyText';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { TerminFormModal } from '@/components/termin/TerminFormModal';
import { ReceiptModal } from '@/components/termin/ReceiptModal';
import { VoidReceiptModal } from '@/components/termin/VoidReceiptModal';
import { RetentionReleaseModal } from '@/components/termin/RetentionReleaseModal';
import { ContractFormModal } from '@/components/termin/ContractFormModal';
import { InputPencairanModal } from '@/components/termin/InputPencairanModal';
import { Plus, FileText, CheckCircle, Landmark, Pencil, AlertTriangle } from 'lucide-react';

export default function TerminPage() {
  const params = useParams();
  const projectId = params?.projectId as string;
  const { can } = useRole();

  const [contract, setContract] = useState<ClientContract | null>(null);
  const [termins, setTermins] = useState<ProjectTermin[]>([]);
  const [receipts, setReceipts] = useState<ClientReceipt[]>([]);
  const [releases, setReleases] = useState<RetentionRelease[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rencana'); 
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  
  const [isTerminModalOpen, setIsTerminModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isPencairanModalOpen, setIsPencairanModalOpen] = useState(false);

  const [selectedTermin, setSelectedTermin] = useState<ProjectTermin | null>(null); 
  const [selectedReceipt, setSelectedReceipt] = useState<ClientReceipt | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const c = await getContractByProject(projectId);
      if (c) {
        setContract(c);
        const [t, r, rel] = await Promise.all([
          listTermins(projectId),
          listReceipts(projectId),
          listReleases(c.id)
        ]);
        setTermins(t);
        setReceipts(r);
        setReleases(rel);
      } else {
        setContract(null);
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleApproveTermin = async (id: string) => {
    try {
      await approveTermin(id);
      showToast('Termin berhasil di-approve', 'success');
      loadData();
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const handleOpenPencairan = (termin: ProjectTermin) => {
    setSelectedTermin(termin);
    setIsPencairanModalOpen(true);
  };

  if (!can('TERMIN_VIEW')) {
    return <div className="p-8 text-center text-red-500 font-bold">Anda tidak memiliki akses ke modul Termin.</div>;
  }

  const totalRetentionHeld = termins.reduce((sum, t) => sum + Number(t.retention_amount || 0), 0);
  const totalRetentionReleased = releases.reduce((sum, rel) => sum + Number(rel.amount || 0), 0);
  const retentionBalance = totalRetentionHeld - totalRetentionReleased;
  const totalCashReceived = receipts.filter(r => !r.voided_at).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const tabClass = (isActive: boolean) => 
    `flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap rounded-t-xl ${
      isActive 
        ? 'border-blue-600 text-blue-700 bg-blue-50/80 shadow-[inset_0_-2px_0_0_#2563eb]' 
        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
    }`;

  return (
    <div className="p-6 w-full space-y-6 bg-slate-50 min-h-screen">
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-xl shadow-xl text-white font-bold animate-in slide-in-from-top-4 fade-in flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          <CheckCircle size={18} /> {toast.msg}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2 tracking-tight"><Landmark className="text-indigo-600" /> Termin & Progress Klien</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Kelola rencana penagihan dan penerimaan kas dari instansi.</p>
        </div>
        {can('TERMIN_CREATE') && contract && (
          <button onClick={() => setIsTerminModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold text-sm shadow-md transition-all">
            <Plus size={18} /> Tambah Rencana Termin
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <SkeletonLoader rows={6} cols={5} />
        </div>
      ) : !contract ? (
        <div className="bg-amber-50 text-amber-800 p-8 rounded-2xl border border-amber-200 flex flex-col items-center justify-center text-center space-y-4 shadow-sm">
          <AlertTriangle size={48} className="text-amber-500 mb-2 opacity-50" />
          <p className="font-bold text-lg">Kontrak Klien Belum Dibuat</p>
          <p className="text-sm">Proyek ini belum memiliki Kontrak Klien aktif. Silakan buat kontrak terlebih dahulu untuk melanjutkan.</p>
          {can('TERMIN_CREATE') && (
            <button onClick={() => setIsContractModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md transition-all mt-2">
              + Buat Kontrak Klien
            </button>
          )}
        </div>
      ) : (
        <>
          {/* DASHBOARD CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nilai Kontrak</p>
              <p className="text-xl font-bold text-slate-800 tabular-nums"><MoneyText value={contract.contract_value} /></p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Kas Diterima</p>
              <p className="text-xl font-bold text-emerald-600 tabular-nums"><MoneyText value={totalCashReceived} /></p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Saldo Retensi Ditahan</p>
              <p className="text-xl font-bold text-amber-600 tabular-nums"><MoneyText value={retentionBalance} /></p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-indigo-500">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">PPN / Retensi Kontrak</p>
              <p className="text-xl font-bold text-slate-800">{contract.ppn_pct}% <span className="text-slate-400 text-sm">/</span> {contract.retention_pct}%</p>
            </div>
          </div>

          {/* TABS */}
          <div className="flex gap-2 border-b border-slate-200 mt-6 overflow-x-auto pb-px">
            <button onClick={() => setActiveTab('rencana')} className={tabClass(activeTab === 'rencana')}>1. Rencana Termin & SP2D</button>
            <button onClick={() => setActiveTab('kas')} className={tabClass(activeTab === 'kas')}>2. Penerimaan Kas</button>
            <button onClick={() => setActiveTab('retensi')} className={tabClass(activeTab === 'retensi')}>3. Pencairan Retensi</button>
          </div>

          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col">
            {/* TAB 1: RENCANA TERMIN */}
            {activeTab === 'rencana' && (
              <div className="overflow-x-auto max-h-[70vh]">
                <table className="w-full text-left text-sm min-w-[900px]">
                  <thead className="bg-slate-50 border-b border-slate-300">
                    <tr className="text-slate-600 text-xs uppercase tracking-wider">
                      <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10 text-center w-12">No</th>
                      <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Nama Termin</th>
                      <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10 text-center">Rencana (%)</th>
                      <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10 text-center">Aktual (%)</th>
                      <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10 text-right">DPP (Gross)</th>
                      <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10 text-right">Retensi</th>
                      <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10 text-center">Status</th>
                      <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {termins.length === 0 ? (
                      <tr><td colSpan={8} className="p-16 text-center text-slate-400 font-medium italic">Belum ada rencana termin.</td></tr>
                    ) : termins.map((t) => {
                      const hasSp2d = !!(t as any).sp2d_number;
                      return (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 text-center font-mono font-bold text-slate-500">{t.termin_no}</td>
                        <td className="p-4 font-bold text-slate-800">
                          {t.name}
                          {hasSp2d && (
                            <span className="block text-[10px] text-emerald-600 font-bold mt-1 bg-emerald-50 px-2 py-0.5 rounded w-max border border-emerald-200">
                              SP2D: {(t as any).sp2d_number}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center tabular-nums font-medium">{t.planned_progress_pct}%</td>
                        <td className="p-4 text-center tabular-nums font-medium">{t.actual_progress_pct}%</td>
                        <td className="p-4 text-right tabular-nums font-semibold text-slate-700"><MoneyText value={t.gross_amount} /></td>
                        <td className="p-4 text-right tabular-nums font-medium text-rose-600"><MoneyText value={t.retention_amount} /></td>
                        <td className="p-4 text-center">
                          {t.status === 'Approved' && !hasSp2d ? (
                            <span className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] uppercase font-bold rounded-lg border border-amber-200">Approved (Belum SP2D)</span>
                          ) : (
                            <StatusBadge status={t.status} />
                          )}
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2">
                          {t.status === 'Draft' && can('TERMIN_CREATE') ? (
                            <button onClick={() => handleApproveTermin(t.id)} className="text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors">
                              <CheckCircle size={14} /> Approve
                            </button>
                          ) : t.status === 'Approved' && !hasSp2d ? (
                            <button onClick={() => handleOpenPencairan(t)} className="text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors shadow-sm">
                              <Landmark size={14} /> Input SP2D
                            </button>
                          ) : hasSp2d ? (
                             <button onClick={() => handleOpenPencairan(t)} className="text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors" title="Edit SP2D">
                               <Pencil size={14} /> Edit SP2D
                             </button>
                          ) : null}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 2: PENERIMAAN KAS */}
            {activeTab === 'kas' && (
              <div className="overflow-x-auto max-h-[70vh]">
                <table className="w-full text-left text-sm min-w-[800px]">
                  <thead className="bg-slate-50 border-b border-slate-300">
                    <tr className="text-slate-600 text-xs uppercase tracking-wider">
                      <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">No. Kuitansi</th>
                      <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Tanggal</th>
                      <th className="p-4 font-bold border-b border-slate-300 text-right sticky top-0 bg-slate-50 z-10">Nominal</th>
                      <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Bank / Ref</th>
                      <th className="p-4 font-bold border-b border-slate-300 text-center sticky top-0 bg-slate-50 z-10">Status</th>
                      <th className="p-4 font-bold border-b border-slate-300 text-right sticky top-0 bg-slate-50 z-10">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receipts.length === 0 ? (
                      <tr><td colSpan={6} className="p-16 text-center text-slate-400 font-medium italic">Belum ada penerimaan kas.</td></tr>
                    ) : receipts.map((r) => (
                      <tr key={r.id} className={`hover:bg-slate-50/80 transition-colors ${r.voided_at ? 'bg-rose-50/30' : ''}`}>
                        <td className="p-4 font-bold text-slate-800">
                          {r.receipt_number}
                          {r.voided_at && <span className="block text-[10px] text-rose-500 font-normal mt-1">Void: {r.void_reason}</span>}
                        </td>
                        <td className="p-4 font-medium text-slate-600">{new Date(r.receipt_date).toLocaleDateString('id-ID')}</td>
                        <td className="p-4 text-right tabular-nums font-bold text-emerald-600"><MoneyText value={r.amount} /></td>
                        <td className="p-4 text-slate-600">{r.bank_name} {r.reference_no && `(${r.reference_no})`}</td>
                        <td className="p-4 text-center"><StatusBadge status={r.voided_at ? 'Void' : r.approval_status} /></td>
                        <td className="p-4 text-right">
                          {!r.voided_at && can('CASH_IN_VOID') && (
                            <button onClick={() => { setSelectedReceipt(r); setIsVoidModalOpen(true); }} className="text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                              Void Kas
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 3: RETENSI */}
            {activeTab === 'retensi' && (
              <div className="p-6">
                <div className="flex justify-between items-center mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-sm font-bold text-slate-600 uppercase tracking-wider">
                    Saldo Retensi Tersedia: <span className="text-amber-600 text-xl ml-2 tabular-nums"><MoneyText value={retentionBalance} /></span>
                  </div>
                  {can('RETENTION_RELEASE') && retentionBalance > 0 && (
                    <button onClick={() => setIsReleaseModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-md transition-all">
                      <FileText size={16} /> Cairkan Retensi
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-300">
                      <tr className="text-slate-600 text-xs uppercase tracking-wider">
                        <th className="p-4 font-bold border-b border-slate-300">No. Pencairan</th>
                        <th className="p-4 font-bold border-b border-slate-300">Tanggal</th>
                        <th className="p-4 font-bold border-b border-slate-300 text-right">Nominal Cair</th>
                        <th className="p-4 font-bold border-b border-slate-300 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {releases.length === 0 ? (
                        <tr><td colSpan={4} className="p-16 text-center text-slate-400 font-medium italic">Belum ada pencairan retensi.</td></tr>
                      ) : releases.map((rel) => (
                        <tr key={rel.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 font-bold text-slate-800">Batch #{rel.release_no}</td>
                          <td className="p-4 font-medium text-slate-600">{rel.release_date ? new Date(rel.release_date).toLocaleDateString('id-ID') : '-'}</td>
                          <td className="p-4 text-right tabular-nums font-bold text-emerald-600"><MoneyText value={rel.amount} /></td>
                          <td className="p-4 text-center"><StatusBadge status={rel.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODALS */}
      {contract && (
        <>
          <TerminFormModal isOpen={isTerminModalOpen} onClose={() => setIsTerminModalOpen(false)} projectId={projectId} contractId={contract.id} onSuccess={loadData} showToast={showToast} />
          <ReceiptModal isOpen={isReceiptModalOpen} onClose={() => setIsReceiptModalOpen(false)} invoice={null} onSuccess={loadData} showToast={showToast} />
          <VoidReceiptModal isOpen={isVoidModalOpen} onClose={() => setIsVoidModalOpen(false)} receipt={selectedReceipt} onSuccess={loadData} showToast={showToast} />
          <RetentionReleaseModal isOpen={isReleaseModalOpen} onClose={() => setIsReleaseModalOpen(false)} contract={contract} onSuccess={loadData} showToast={showToast} />
          <InputPencairanModal isOpen={isPencairanModalOpen} onClose={() => setIsPencairanModalOpen(false)} terminData={selectedTermin} onSuccess={loadData} showToast={showToast} />
        </>
      )}
      <ContractFormModal isOpen={isContractModalOpen} onClose={() => setIsContractModalOpen(false)} projectId={projectId} onSuccess={loadData} showToast={showToast} />
    </div>
  );
}