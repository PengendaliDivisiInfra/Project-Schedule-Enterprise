'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRole } from '@/lib/hooks/useRole';
import { getContractByProject, listTermins, approveTermin } from '@/lib/services/termin.service';
import { listReceipts } from '@/lib/services/cash-in.service';
import { listReleases } from '@/lib/services/retention.service';
import { 
  ClientContract, ProjectTermin, ClientReceipt, RetentionRelease 
} from '@/lib/types/termin';
import { MoneyText } from '@/components/ui/MoneyText';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TerminFormModal } from '@/components/termin/TerminFormModal';
import { ReceiptModal } from '@/components/termin/ReceiptModal';
import { VoidReceiptModal } from '@/components/termin/VoidReceiptModal';
import { RetentionReleaseModal } from '@/components/termin/RetentionReleaseModal';
import { ContractFormModal } from '@/components/termin/ContractFormModal';
import { InputPencairanModal } from '@/components/termin/InputPencairanModal';
import { Plus, FileText, CheckCircle, Landmark } from 'lucide-react';

export default function TerminPage() {
  const params = useParams();
  const projectId = params?.projectId as string;
  const { can } = useRole();

  const [contract, setContract] = useState<ClientContract | null>(null);
  const [termins, setTermins] = useState<ProjectTermin[]>([]);
  const [receipts, setReceipts] = useState<ClientReceipt[]>([]);
  const [releases, setReleases] = useState<RetentionRelease[]>([]);
  
  const [loading, setLoading] = useState(true);
  
  // TAB YANG TERSISA: 'rencana', 'kas', 'retensi'
  const [activeTab, setActiveTab] = useState('rencana'); 

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  
  // --- STATE MODALS ---
  const [isTerminModalOpen, setIsTerminModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isPencairanModalOpen, setIsPencairanModalOpen] = useState(false);

  // --- STATE SELECTED DATA ---
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

  if (!can('TERMIN_VIEW')) {
    return <div className="p-8 text-center text-red-500 font-semibold">Anda tidak memiliki akses ke modul Termin.</div>;
  }

  // Hitung retensi (dari sisa tagihan yang ada)
  const totalRetentionHeld = termins.reduce((sum, t) => sum + Number(t.retention_amount || 0), 0);
  const totalRetentionReleased = releases.reduce((sum, rel) => sum + Number(rel.amount || 0), 0);
  const retentionBalance = totalRetentionHeld - totalRetentionReleased;
  
  // Hitung total kas diterima
  const totalCashReceived = receipts.filter(r => !r.voided_at).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  return (
    <div className="p-6 w-full space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded shadow-lg text-white font-medium z-[100] ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Termin & Progress Klien</h1>
          <p className="text-slate-500 text-sm">Kelola rencana penagihan dan penerimaan kas dari instansi.</p>
        </div>
        {can('TERMIN_CREATE') && contract && (
          <button onClick={() => setIsTerminModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Plus size={18} /> Tambah Rencana Termin
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center p-12 text-slate-500">Memuat data...</div>
      ) : !contract ? (
        <div className="bg-amber-50 text-amber-800 p-6 rounded-lg border border-amber-200 flex flex-col items-center justify-center text-center space-y-4">
          <p>Proyek ini belum memiliki Kontrak Klien aktif. Silakan buat kontrak terlebih dahulu.</p>
          {can('TERMIN_CREATE') && (
            <button onClick={() => setIsContractModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium">
              + Buat Kontrak Klien
            </button>
          )}
        </div>
      ) : (
        <>
          {/* DASHBOARD CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Nilai Kontrak</p>
              <p className="text-lg font-bold text-slate-800"><MoneyText value={contract.contract_value} /></p>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Total Kas Diterima</p>
              <p className="text-lg font-bold text-green-600"><MoneyText value={totalCashReceived} /></p>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Saldo Retensi Ditahan</p>
              <p className="text-lg font-bold text-amber-600"><MoneyText value={retentionBalance} /></p>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-slate-500 mb-1">PPN / Retensi Kontrak</p>
              <p className="text-sm font-bold text-slate-800">{contract.ppn_pct}% / {contract.retention_pct}%</p>
            </div>
          </div>

          {/* TABS (Invoice sudah dihapus) */}
          <div className="border-b border-slate-200 mt-6">
            <nav className="flex gap-6 -mb-px">
              {['rencana', 'kas', 'retensi'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 px-1 border-b-2 font-medium text-sm capitalize ${
                    activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab === 'rencana' && '1. Rencana Termin & SP2D'}
                  {tab === 'kas' && '2. Penerimaan Kas'}
                  {tab === 'retensi' && '3. Pencairan Retensi'}
                </button>
              ))}
            </nav>
          </div>

          <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
            {/* TAB 1: RENCANA TERMIN */}
            {activeTab === 'rencana' && (
              <table className="w-full text-left text-sm min-w-[900px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-4 border-b">No</th>
                    <th className="p-4 border-b">Nama Termin</th>
                    {/* TAMBAHKAN 2 KOLOM INI */}
                    <th className="p-4 border-b text-center">Rencana (%)</th>
                    <th className="p-4 border-b text-center">Aktual (%)</th>
                    <th className="p-4 border-b">DPP (Gross)</th>
                    <th className="p-4 border-b">Retensi</th>
                    <th className="p-4 border-b">Status</th>
                    <th className="p-4 border-b text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {termins.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-4 border-b">{t.termin_no}</td>
                      <td className="p-4 border-b font-medium">{t.name}</td>
                      {/* TAMBAHKAN 2 TD INI */}
                      <td className="p-4 border-b text-center">{t.planned_progress_pct}%</td>
                      <td className="p-4 border-b text-center">{t.actual_progress_pct}%</td>
                      
                      <td className="p-4 border-b"><MoneyText value={t.gross_amount} /></td>
                      <td className="p-4 border-b text-red-600"><MoneyText value={t.retention_amount} /></td>
                      <td className="p-4 border-b"><StatusBadge status={t.status} /></td>
                      <td className="p-4 border-b text-right flex justify-end gap-2">
                        {/* ... tombol aksi Anda ... */}
                      </td>
                    </tr>
                  ))}
                  {termins.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">Belum ada rencana termin.</td></tr>}
                </tbody>
              </table>
            )}

            {/* TAB 2: PENERIMAAN KAS */}
            {activeTab === 'kas' && (
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-4 border-b">No. Kuitansi</th>
                    <th className="p-4 border-b">Tanggal</th>
                    <th className="p-4 border-b">Nominal</th>
                    <th className="p-4 border-b">Bank / Ref</th>
                    <th className="p-4 border-b">Status</th>
                    <th className="p-4 border-b text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id} className={`hover:bg-slate-50 ${r.voided_at ? 'bg-red-50/50' : ''}`}>
                      <td className="p-4 border-b font-medium">
                        {r.receipt_number}
                        {r.voided_at && <span className="block text-xs text-red-500 font-normal mt-1">Void: {r.void_reason}</span>}
                      </td>
                      <td className="p-4 border-b">{new Date(r.receipt_date).toLocaleDateString('id-ID')}</td>
                      <td className="p-4 border-b text-green-600 font-medium"><MoneyText value={r.amount} /></td>
                      <td className="p-4 border-b">{r.bank_name} {r.reference_no && `(${r.reference_no})`}</td>
                      <td className="p-4 border-b"><StatusBadge status={r.voided_at ? 'Void' : r.approval_status} /></td>
                      <td className="p-4 border-b text-right">
                        {!r.voided_at && can('CASH_IN_VOID') && (
                          <button onClick={() => { setSelectedReceipt(r); setIsVoidModalOpen(true); }} className="text-red-600 hover:underline text-sm font-medium">
                            Void Kas
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {receipts.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Belum ada penerimaan kas.</td></tr>}
                </tbody>
              </table>
            )}

            {/* TAB 3: RETENSI */}
            {activeTab === 'retensi' && (
              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="text-sm">
                    Saldo Retensi Tersedia: <span className="font-bold text-amber-600 text-lg ml-2"><MoneyText value={retentionBalance} /></span>
                  </div>
                  {can('RETENTION_RELEASE') && retentionBalance > 0 && (
                    <button onClick={() => setIsReleaseModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                      <FileText size={16} /> Cairkan Retensi
                    </button>
                  )}
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-4 border-b">No. Pencairan</th>
                      <th className="p-4 border-b">Tanggal</th>
                      <th className="p-4 border-b">Nominal Cair</th>
                      <th className="p-4 border-b">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {releases.map((rel) => (
                      <tr key={rel.id} className="hover:bg-slate-50">
                        <td className="p-4 border-b font-medium">Batch #{rel.release_no}</td>
                        <td className="p-4 border-b">{rel.release_date ? new Date(rel.release_date).toLocaleDateString('id-ID') : '-'}</td>
                        <td className="p-4 border-b text-green-600 font-medium"><MoneyText value={rel.amount} /></td>
                        <td className="p-4 border-b"><StatusBadge status={rel.status} /></td>
                      </tr>
                    ))}
                    {releases.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-500">Belum ada pencairan retensi.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODALS */}
      {contract && (
        <>
          <TerminFormModal
            isOpen={isTerminModalOpen}
            onClose={() => setIsTerminModalOpen(false)}
            projectId={projectId}
            contractId={contract.id}
            onSuccess={loadData}
            showToast={showToast}
          />
          <ReceiptModal
            isOpen={isReceiptModalOpen}
            onClose={() => setIsReceiptModalOpen(false)}
            invoice={null} // <-- PERHATIAN: Karena invoice dihapus, cek ReceiptModal Anda agar tidak error jika invoice null
            onSuccess={loadData}
            showToast={showToast}
          />
          <VoidReceiptModal
            isOpen={isVoidModalOpen}
            onClose={() => setIsVoidModalOpen(false)}
            receipt={selectedReceipt}
            onSuccess={loadData}
            showToast={showToast}
          />
          <RetentionReleaseModal
            isOpen={isReleaseModalOpen}
            onClose={() => setIsReleaseModalOpen(false)}
            contract={contract}
            onSuccess={loadData}
            showToast={showToast}
          />
          <InputPencairanModal
            isOpen={isPencairanModalOpen}
            onClose={() => setIsPencairanModalOpen(false)}
            terminData={selectedTermin}
            onSuccess={loadData}
            showToast={showToast}
          />
        </>
      )}

      <ContractFormModal
        isOpen={isContractModalOpen}
        onClose={() => setIsContractModalOpen(false)}
        projectId={projectId}
        onSuccess={loadData}
        showToast={showToast}
      />
    </div>
  );
}