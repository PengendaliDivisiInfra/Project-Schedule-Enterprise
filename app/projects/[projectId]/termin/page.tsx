'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRole } from '@/lib/hooks/useRole';
import { getContractByProject, listTermins, listInvoices } from '@/lib/services/termin.service';
import { listReceipts } from '@/lib/services/cash-in.service';
import { listReleases } from '@/lib/services/retention.service';
import { 
  ClientContract, ProjectTermin, ClientInvoiceSummary, ClientReceipt, RetentionRelease 
} from '@/lib/types/termin';
import { MoneyText } from '@/components/ui/MoneyText';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TerminFormModal } from '@/components/termin/TerminFormModal';
import { InvoiceModal } from '@/components/termin/InvoiceModal';
import { ReceiptModal } from '@/components/termin/ReceiptModal';
import { VoidReceiptModal } from '@/components/termin/VoidReceiptModal';
import { RetentionReleaseModal } from '@/components/termin/RetentionReleaseModal';
import { HelpCircle, Plus, FileText, CheckCircle } from 'lucide-react';

export default function TerminPage() {
  const params = useParams();
  const projectId = params?.projectId as string;
  const { can } = useRole();

  // Data States
  const [contract, setContract] = useState<ClientContract | null>(null);
  const [termins, setTermins] = useState<ProjectTermin[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoiceSummary[]>([]);
  const [receipts, setReceipts] = useState<ClientReceipt[]>([]);
  const [releases, setReleases] = useState<RetentionRelease[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('rencana');

  // Toast & Modal States
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  
  const [isTerminModalOpen, setIsTerminModalOpen] = useState(false);
  const [selectedTermin, setSelectedTermin] = useState<ProjectTermin | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState<ClientInvoiceSummary | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  
  const [selectedReceipt, setSelectedReceipt] = useState<ClientReceipt | null>(null);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);

  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);

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
        const [t, i, r, rel] = await Promise.all([
          listTermins(projectId),
          listInvoices(projectId),
          listReceipts(projectId),
          listReleases(c.id)
        ]);
        setTermins(t);
        setInvoices(i);
        setReceipts(r);
        setReleases(rel);
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

  if (!can('TERMIN_VIEW')) {
    return <div className="p-8 text-center text-red-500 font-semibold">Anda tidak memiliki akses ke modul Termin.</div>;
  }

  // Total Retensi Ditahan (dari invoice yang sudah issued/paid) - Total yang sudah dicairkan
  const totalRetentionHeld = invoices.filter(i => i.status !== 'Void').reduce((sum, inv) => sum + inv.retention_amount, 0);
  const totalRetentionReleased = releases.reduce((sum, rel) => sum + rel.amount, 0);
  const retentionBalance = totalRetentionHeld - totalRetentionReleased;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded shadow-lg text-white font-medium z-[100] ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Termin & Progress Klien</h1>
          <p className="text-slate-500 text-sm">Kelola tagihan, invoice, dan penerimaan kas proyek.</p>
        </div>
        {can('TERMIN_CREATE') && (
          <button onClick={() => setIsTerminModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Plus size={18} /> Tambah Termin
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center p-12 text-slate-500">Memuat data...</div>
      ) : !contract ? (
        <div className="bg-amber-50 text-amber-800 p-4 rounded-lg border border-amber-200">
          Proyek ini belum memiliki Kontrak Klien aktif. Hubungi Project Manager atau Owner untuk membuat kontrak terlebih dahulu.
        </div>
      ) : (
        <>
          {/* Ringkasan Kontrak */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Nilai Kontrak</p>
              <p className="text-lg font-bold text-slate-800"><MoneyText value={contract.contract_value} /></p>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Sisa Tagihan (Outstanding)</p>
              <p className="text-lg font-bold text-red-600"><MoneyText value={invoices.reduce((acc, curr) => acc + curr.outstanding, 0)} /></p>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-slate-500 mb-1">Total Kas Diterima</p>
              <p className="text-lg font-bold text-green-600"><MoneyText value={receipts.filter(r => !r.voided_at).reduce((acc, curr) => acc + curr.amount, 0)} /></p>
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

          {/* Tabs Navigation */}
          <div className="border-b border-slate-200 mt-6">
            <nav className="flex gap-6 -mb-px">
              {['rencana', 'invoice', 'kas', 'retensi'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 px-1 border-b-2 font-medium text-sm capitalize ${
                    activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab === 'rencana' && '1. Rencana Termin'}
                  {tab === 'invoice' && '2. Invoice & Tagihan'}
                  {tab === 'kas' && '3. Penerimaan Kas'}
                  {tab === 'retensi' && '4. Pencairan Retensi'}
                </button>
              ))}
            </nav>
          </div>

          {/* Konten Tab */}
          <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
            {/* TAB 1: RENCANA TERMIN */}
            {activeTab === 'rencana' && (
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-4 border-b">No</th>
                    <th className="p-4 border-b">Nama Termin</th>
                    <th className="p-4 border-b">Progres (%)</th>
                    <th className="p-4 border-b">
                      <div className="flex items-center gap-1">
                        DPP (Gross) <span title="Nilai progres fisik sebelum pajak & retensi">
                          <HelpCircle size={14} className="text-slate-400 cursor-help" />
                        </span>
                      </div>
                    </th>
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
                      <td className="p-4 border-b">{t.actual_progress_pct}%</td>
                      <td className="p-4 border-b"><MoneyText value={t.gross_amount} /></td>
                      <td className="p-4 border-b text-red-600"><MoneyText value={t.retention_amount} /></td>
                      <td className="p-4 border-b"><StatusBadge status={t.status} /></td>
                      <td className="p-4 border-b text-right">
                        {t.status === 'Approved' && can('INVOICE_ISSUE') && (
                          <button onClick={() => { setSelectedTermin(t); setIsInvoiceModalOpen(true); }} className="text-blue-600 hover:underline text-sm font-medium">
                            Buat Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {termins.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">Belum ada data termin.</td></tr>}
                </tbody>
              </table>
            )}

            {/* TAB 2: INVOICE */}
            {activeTab === 'invoice' && (
              <table className="w-full text-left text-sm min-w-[900px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-4 border-b">No. Invoice</th>
                    <th className="p-4 border-b">Tanggal</th>
                    <th className="p-4 border-b">DPP</th>
                    <th className="p-4 border-b">PPN</th>
                    <th className="p-4 border-b">Total Tagihan</th>
                    <th className="p-4 border-b">Outstanding</th>
                    <th className="p-4 border-b">Status</th>
                    <th className="p-4 border-b text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="p-4 border-b font-medium">{inv.invoice_number}</td>
                      <td className="p-4 border-b">{new Date(inv.invoice_date).toLocaleDateString('id-ID')}</td>
                      <td className="p-4 border-b"><MoneyText value={inv.dpp_amount} /></td>
                      <td className="p-4 border-b"><MoneyText value={inv.ppn_amount} /></td>
                      <td className="p-4 border-b"><MoneyText value={inv.net_payable_amount} /></td>
                      <td className="p-4 border-b text-red-600 font-medium"><MoneyText value={inv.outstanding} /></td>
                      <td className="p-4 border-b"><StatusBadge status={inv.status} /></td>
                      <td className="p-4 border-b text-right">
                        {inv.outstanding > 0 && inv.status !== 'Void' && can('CASH_IN_RECORD') && (
                          <button onClick={() => { setSelectedInvoice(inv); setIsReceiptModalOpen(true); }} className="text-green-600 hover:underline text-sm font-medium flex items-center justify-end gap-1">
                            <CheckCircle size={14} /> Catat Kas
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">Belum ada invoice yang diterbitkan.</td></tr>}
                </tbody>
              </table>
            )}

            {/* TAB 3: KAS MASUK */}
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

            {/* TAB 4: RETENSI */}
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

      {/* Modals */}
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
          <InvoiceModal
            isOpen={isInvoiceModalOpen}
            onClose={() => setIsInvoiceModalOpen(false)}
            termin={selectedTermin}
            onSuccess={loadData}
            showToast={showToast}
          />
          <ReceiptModal
            isOpen={isReceiptModalOpen}
            onClose={() => setIsReceiptModalOpen(false)}
            invoice={selectedInvoice}
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
        </>
      )}
    </div>
  );
}