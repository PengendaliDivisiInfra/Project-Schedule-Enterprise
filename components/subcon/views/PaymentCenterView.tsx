'use client';

import { useState, useEffect } from 'react';
import { useRole } from '@/lib/hooks/useRole';
import {
  listAllProjectPayments,
  updatePaymentStatus,
  voidSubconPayment,
  softDeleteSubconPayment,
} from '@/lib/services/subcon.service';
import { MoneyText } from '@/components/ui/MoneyText';
import {
  Wallet,
  Search,
  FileText,
  Ban,
  Trash2,
  Loader2,
  AlertTriangle,
  X,
  CheckCircle2,
  ShieldCheck,
  Clock,
} from 'lucide-react';

interface PaymentCenterViewProps {
  projectId: string;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

export function PaymentCenterView({ projectId, showToast }: PaymentCenterViewProps) {
  const { can } = useRole(projectId);

  const [items, setItems] = useState<any[]>([]);
  const [softDeletedIds, setSoftDeletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'PENDING' | 'APPROVED' | 'PAID' | 'VOID'
  >('ALL');

  // State Modal Review & Bayar
  const [reviewItem, setReviewItem] = useState<any | null>(null);
  const [auditChecked, setAuditChecked] = useState(true);
  const [isProcessingPay, setIsProcessingPay] = useState(false);

  // State Modal Batal (Void) & Hapus (Soft Delete)
  const [actionModal, setActionModal] = useState<{
    type: 'VOID' | 'DELETE';
    item: any;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const loadPayments = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await listAllProjectPayments(projectId);
      setItems(data || []);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat antrean pembayaran', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [projectId]);

  const handleAuthorizePayment = async (targetStatus: 'Approved' | 'Paid') => {
    if (!reviewItem) return;
    if (!auditChecked) {
      showToast('Centang verifikasi kepatuhan SAK/KUP terlebih dahulu', 'error');
      return;
    }

    setIsProcessingPay(true);
    try {
      await updatePaymentStatus(reviewItem.id, targetStatus);
      showToast(
        targetStatus === 'Approved'
          ? `Dokumen ${reviewItem.payment_number} berhasil disetujui (APPROVED)`
          : `Pembayaran ${reviewItem.payment_number} berhasil dicairkan (PAID)`,
        'success'
      );
      setReviewItem(null);
      await loadPayments();
    } catch (err: any) {
      showToast(err.message || 'Gagal memproses otorisasi pembayaran', 'error');
    } finally {
      setIsProcessingPay(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!actionModal) return;
    if (actionModal.type === 'VOID' && !reason.trim()) {
      showToast('Alasan pembatalan wajib diisi', 'error');
      return;
    }

    setIsSubmittingAction(true);
    try {
      if (actionModal.type === 'VOID') {
        const res = await voidSubconPayment(actionModal.item.id, reason.trim());
        const counts = res?.voided_counts;
        const summary = counts
          ? ` (Cash Flow: ${counts.cash_flows}, Log Subkon: ${counts.subcon_financial_logs}, Actual Cost: ${counts.actual_costs}, Jurnal: ${counts.journal_entries})`
          : '';
        showToast(
          `Dokumen ${actionModal.item.payment_number} berhasil di-VOID${summary}`,
          'success'
        );
      } else {
        await softDeleteSubconPayment(
          actionModal.item.id,
          reason.trim() || 'Dihapus dari antrean pembayaran'
        );
        setSoftDeletedIds((prev) => {
          const next = new Set(prev);
          next.add(actionModal.item.id);
          return next;
        });
        setItems((prev) => prev.filter((row) => row.id !== actionModal.item.id));
        showToast(
          `Dokumen ${actionModal.item.payment_number} berhasil dihapus dari antrean`,
          'success'
        );
      }

      setActionModal(null);
      setReason('');
      await loadPayments();
    } catch (err: any) {
      showToast(err.message || 'Gagal memproses aksi', 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (item.is_deleted || softDeletedIds.has(item.id)) return false;

    const statusUpper = (item.status || 'Pending').toUpperCase();
    if (statusFilter !== 'ALL' && statusUpper !== statusFilter) return false;

    const q = searchQuery.toLowerCase();
    if (!q) return true;

    const docNo = (item.payment_number || '').toLowerCase();
    const vendor = (
      item.subcontractor_contracts?.subcontractors?.contact_person ||
      item.subcontractor_contracts?.subcontractors?.company_name ||
      ''
    ).toLowerCase();
    return docNo.includes(q) || vendor.includes(q);
  });

  const getStatusBadge = (status: string) => {
    const s = (status || 'Pending').toLowerCase();
    if (s === 'paid') {
      return (
        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">
          PAID
        </span>
      );
    }
    if (s === 'approved') {
      return (
        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200 uppercase">
          APPROVED
        </span>
      );
    }
    if (s === 'void') {
      return (
        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200 uppercase">
          VOID
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
        PENDING
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header & Filter */}
      <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-2">
            <Wallet className="text-emerald-600" size={20} /> Antrean Persetujuan &amp; Pembayaran
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Review dokumen dan validasi kepatuhan SAK/KUP sebelum mencairkan dana.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            {(['ALL', 'PENDING', 'APPROVED', 'PAID', 'VOID'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1.5 rounded-lg transition-colors ${
                  statusFilter === st
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {st === 'ALL' ? 'Semua' : st}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari No. Dokumen / Mandor..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Tabel Antrean */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[1000px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="p-4 font-bold">Tipe</th>
              <th className="p-4 font-bold">No. Dokumen</th>
              <th className="p-4 font-bold">Tanggal</th>
              <th className="p-4 font-bold">Mandor / Vendor</th>
              <th className="p-4 font-bold text-right">Nilai Diajukan</th>
              <th className="p-4 font-bold text-center">Status</th>
              <th className="p-4 font-bold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-10 text-center">
                  <Loader2 className="animate-spin mx-auto text-indigo-600" size={24} />
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-400 italic">
                  Tidak ada antrean pembayaran yang sesuai filter.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const statusLower = (item.status || 'Pending').toLowerCase();
                const isVoid = statusLower === 'void';
                const isPaid = statusLower === 'paid';
                const isKasbon = (item.payment_type || '').toLowerCase() === 'kasbon';
                const vendorLabel =
                  item.subcontractor_contracts?.subcontractors?.contact_person ||
                  item.subcontractor_contracts?.subcontractors?.company_name ||
                  '-';

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isVoid ? 'bg-slate-50/80 opacity-75' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase ${
                          isKasbon
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {(item.payment_type || 'OPNAME').toUpperCase()}
                      </span>
                    </td>

                    <td className="p-4 font-bold font-mono text-indigo-700 text-xs">
                      <span className={isVoid ? 'line-through text-slate-400' : ''}>
                        {item.payment_number}
                      </span>
                      {isVoid && item.void_reason && (
                        <span className="block font-sans font-normal text-[11px] text-rose-600 mt-0.5">
                          Alasan batal: {item.void_reason}
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-slate-600 text-xs">
                      {item.payment_date
                        ? new Date(item.payment_date).toLocaleDateString('id-ID')
                        : '-'}
                    </td>

                    <td className="p-4 font-bold text-slate-800 uppercase text-xs">
                      {vendorLabel}
                    </td>

                    <td
                      className={`p-4 text-right font-bold tabular-nums ${
                        isVoid ? 'line-through text-slate-400' : 'text-emerald-600'
                      }`}
                    >
                      <MoneyText value={item.amount} />
                    </td>

                    <td className="p-4 text-center">{getStatusBadge(item.status)}</td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {can('SUBCON_PAY') && !isVoid && !isPaid && (
                          <button
                            type="button"
                            onClick={() => {
                              setAuditChecked(true);
                              setReviewItem(item);
                            }}
                            className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <FileText size={13} /> Review &amp; Bayar
                          </button>
                        )}

                        {can('SUBCON_PAY') && !isVoid && (
                          <button
                            type="button"
                            onClick={() => {
                              setReason('');
                              setActionModal({ type: 'VOID', item });
                            }}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                            title="Batalkan Transaksi & Sinkronkan Lintas Modul (VOID)"
                          >
                            <Ban size={13} /> {isPaid ? 'Void' : 'Batal'}
                          </button>
                        )}

                        {can('SUBCON_PAY') && !isPaid && (
                          <button
                            type="button"
                            onClick={() => {
                              setReason('');
                              setActionModal({ type: 'DELETE', item });
                            }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                            title="Hapus dari Antrean (Soft Delete)"
                          >
                            <Trash2 size={13} /> Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL REVIEW & OTORISASI PEMBAYARAN */}
      {reviewItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck size={19} className="text-emerald-600" />
                Review &amp; Otorisasi Pembayaran
              </h4>
              <button
                type="button"
                onClick={() => setReviewItem(null)}
                disabled={isProcessingPay}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nomor Dokumen</span>
                  <span className="font-mono font-bold text-slate-900">
                    {reviewItem.payment_number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tipe Pengajuan</span>
                  <span className="font-bold text-indigo-700 uppercase">
                    {reviewItem.payment_type || 'OPNAME'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">No. SPK</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {reviewItem.subcontractor_contracts?.spk_number || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mandor / Vendor</span>
                  <span className="font-bold text-slate-800 uppercase">
                    {reviewItem.subcontractor_contracts?.subcontractors?.contact_person ||
                      reviewItem.subcontractor_contracts?.subcontractors?.company_name ||
                      '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Rekening Tujuan</span>
                  <span className="font-semibold text-slate-700">
                    {reviewItem.subcontractor_contracts?.subcontractors?.bank_name
                      ? `${reviewItem.subcontractor_contracts.subcontractors.bank_name} - ${
                          reviewItem.subcontractor_contracts.subcontractors.bank_account || ''
                        }`
                      : '-'}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-2.5 flex justify-between items-center">
                  <span className="font-bold text-slate-700">Nominal Netto Pencairan</span>
                  <span className="text-base font-extrabold text-emerald-600 tabular-nums">
                    <MoneyText value={reviewItem.amount} />
                  </span>
                </div>
              </div>

              {reviewItem.description && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-amber-900">
                  <span className="font-bold block mb-1">Keterangan / Tujuan:</span>
                  <p className="whitespace-pre-line">{reviewItem.description}</p>
                </div>
              )}

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={auditChecked}
                  onChange={(e) => setAuditChecked(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-slate-700 leading-relaxed font-medium">
                  Saya telah memverifikasi kelengkapan dokumen fisik, perhitungan pajak
                  (PPN/PPh 4 ayat 2), dan kesesuaian saldo SPK sesuai standar SAK/KUP.
                </span>
              </label>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setReviewItem(null)}
                disabled={isProcessingPay}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Tutup
              </button>

              {(reviewItem.status || 'Pending').toLowerCase() === 'pending' && (
                <button
                  type="button"
                  onClick={() => handleAuthorizePayment('Approved')}
                  disabled={isProcessingPay}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  {isProcessingPay ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Clock size={14} />
                  )}
                  Approve (Setujui)
                </button>
              )}

              <button
                type="button"
                onClick={() => handleAuthorizePayment('Paid')}
                disabled={isProcessingPay}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
              >
                {isProcessingPay ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                Konfirmasi Pembayaran (PAID)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL KONFIRMASI BATAL (VOID) & HAPUS (SOFT DELETE) */}
      {actionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle
                  size={18}
                  className={actionModal.type === 'VOID' ? 'text-amber-600' : 'text-rose-600'}
                />
                {actionModal.type === 'VOID'
                  ? 'Batalkan Pembayaran (Sync VOID Lintas Modul)'
                  : 'Hapus Pengajuan dari Antrean'}
              </h4>
              <button
                type="button"
                onClick={() => setActionModal(null)}
                disabled={isSubmittingAction}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Dokumen:{' '}
                <strong className="font-mono text-slate-800">
                  {actionModal.item.payment_number}
                </strong>
                <br />
                {actionModal.type === 'VOID'
                  ? 'Status dokumen akan diubah menjadi VOID dan secara otomatis membalikkan pencatatan di Buku Subkon, Arus Kas (cash_flows), Realisasi Biaya (actual_costs), serta membuka kembali kunci BPUTK terkait.'
                  : 'Dokumen akan dihapus dari tampilan antrean (Soft Delete) dan tetap tersimpan pada log audit sistem.'}
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {actionModal.type === 'VOID'
                    ? 'Alasan Pembatalan (Wajib)'
                    : 'Catatan Penghapusan (Opsional)'}
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    actionModal.type === 'VOID'
                      ? 'Contoh: Nominal pengajuan salah / revisi volume opname...'
                      : 'Contoh: Duplikat input draft...'
                  }
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                disabled={isSubmittingAction}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={isSubmittingAction}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 shadow-sm transition-colors ${
                  actionModal.type === 'VOID'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmittingAction ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                {actionModal.type === 'VOID' ? 'Ya, Batalkan (VOID)' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}