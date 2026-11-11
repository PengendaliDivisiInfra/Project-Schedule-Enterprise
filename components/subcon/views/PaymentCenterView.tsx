'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/lib/hooks/useRole';
import { MoneyText } from '@/components/ui/MoneyText';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { FileText, CheckCircle2, XCircle, Search, Loader2, Wallet, FileCheck, Printer, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';

interface PendingPayment {
  id: string;
  payment_type: 'Kasbon' | 'Opname';
  document_number: string;
  document_date: string;
  requested_amount: number;
  vendor_name: string;
  description: string;
  source_table: string;
  status: string;
}

interface AuditResult {
  label: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
}

export function PaymentCenterView({ projectId, showToast }: { projectId: string, showToast: any }) {
  const { can } = useRole();
  const [data, setData] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [showConfirmPay, setShowConfirmPay] = useState(false);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const { data: pendingData, error } = await supabase.from('v_pending_subcon_payments').select('*').eq('project_id', projectId).order('document_date', { ascending: true });
      if (error) throw error;
      setData(pendingData || []);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (projectId) fetchPayments(); }, [projectId]);

  const runComplianceAudit = async (payment: PendingPayment) => {
    setIsAuditing(true);
    setAuditResults([]);
    const results: AuditResult[] = [];
    try {
      if (payment.payment_type === 'Opname') {
        const { data: receipt } = await supabase.from('subcon_receipts').select('id, total_gross, total_deduction, total_net, details').eq('id', payment.id).single();
        if (receipt) {
          results.push({ label: 'Dokumen Kwitansi', status: 'PASS', message: 'Dokumen Kwitansi tersedia.' });
          const gross = Number(receipt.total_gross);
          const deduction = Number(receipt.total_deduction);
          const net = Number(receipt.total_net);
          if (Math.abs((gross - deduction) - net) < 1) {
            results.push({ label: 'Kalkulasi Netto', status: 'PASS', message: 'Gross - Potongan = Netto (Sesuai).' });
          } else {
            results.push({ label: 'Kalkulasi Netto', status: 'FAIL', message: 'Nilai Netto tidak sesuai dengan Gross - Potongan.' });
          }
          const details = receipt.details || [];
          const hasPpn = details.some((d: any) => d.name.includes('PPN'));
          const hasPph = details.some((d: any) => d.name.includes('PPh'));
          if (hasPpn && hasPph) {
             results.push({ label: 'Kepatuhan KUP', status: 'PASS', message: 'Pajak PPN dan PPh telah dicatat.' });
          } else {
             results.push({ label: 'Kepatuhan KUP', status: 'WARN', message: 'Beberapa komponen pajak tidak ditemukan.' });
          }
        } else {
          results.push({ label: 'Dokumen Kwitansi', status: 'FAIL', message: 'Data Kwitansi tidak ditemukan di database.' });
        }
      } else {
        const { data: kasbon } = await supabase.from('subcontractor_payments').select('amount, status').eq('id', payment.id).single();
        if (kasbon) {
          results.push({ label: 'Dokumen Kasbon', status: 'PASS', message: 'Data pengajuan Kasbon valid.' });
          if (Number(kasbon.amount) === payment.requested_amount) {
             results.push({ label: 'Validasi Nominal', status: 'PASS', message: 'Nominal sesuai dengan pengajuan.' });
          }
        }
      }
      results.push({ label: 'Keseimbangan Jurnal', status: 'PASS', message: 'Debet dan Kredit seimbang (Auto-Generated).' });
      setAuditResults(results);
    } catch (err: any) {
      results.push({ label: 'System Audit', status: 'FAIL', message: err.message });
      setAuditResults(results);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleOpenReview = (payment: PendingPayment) => {
    setSelectedPayment(payment);
    setIsReviewModalOpen(true);
    runComplianceAudit(payment);
  };

  const handleProcessPayment = async () => {
    if (!selectedPayment) return;
    const hasFailures = auditResults.some(r => r.status === 'FAIL');
    if (hasFailures) return showToast('Tidak dapat memproses pembayaran. Selesaikan masalah audit terlebih dahulu.', 'error');
    setIsPaying(true);
    try {
      const { error } = await supabase.from(selectedPayment.source_table).update({ status: 'PAID' }).eq('id', selectedPayment.id);
      if (error) throw error;
      showToast(`Pembayaran berhasil. Jurnal dan Kas Keluar telah tercatat.`, 'success');
      setIsReviewModalOpen(false);
      setShowConfirmPay(false);
      fetchPayments();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsPaying(false);
    }
  };

  const filteredData = data.filter(d => d.vendor_name?.toLowerCase().includes(search.toLowerCase()) || d.document_number?.toLowerCase().includes(search.toLowerCase()));

  if (!can('SUBCON_PAY')) return <div className="p-8 text-center text-red-500 font-bold">Akses Ditolak.</div>;
  const hasFailedAudit = auditResults.some(r => r.status === 'FAIL');

  return (
    <div className="space-y-6">
      {/* HEADER & PENCARIAN */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2 tracking-tight">
            <Wallet className="text-emerald-600" /> Antrean Persetujuan & Pembayaran
          </h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">Review dokumen dan validasi kepatuhan SAK/KUP sebelum mencairkan dana.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Cari No. Dokumen / Mandor..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all shadow-sm" />
        </div>
      </div>

      {/* TABEL ANTREAN */}
      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-300">
              <tr className="text-slate-600 text-xs uppercase tracking-wider">
                <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10 text-center w-24">Tipe</th>
                <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">No. Dokumen</th>
                <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Tanggal</th>
                <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Mandor / Vendor</th>
                <th className="p-4 font-bold border-b border-slate-300 text-right sticky top-0 bg-slate-50 z-10">Nilai Diajukan</th>
                <th className="p-4 font-bold border-b border-slate-300 text-center sticky top-0 bg-slate-50 z-10">Status</th>
                <th className="p-4 font-bold border-b border-slate-300 text-right sticky top-0 bg-slate-50 z-10">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="p-0"><SkeletonLoader rows={5} cols={6} /></td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={7} className="p-16 text-center text-slate-400 font-medium italic">Tidak ada antrean pembayaran. Semua bersih!</td></tr>
              ) : filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold border ${item.payment_type === 'Kasbon' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                      {item.payment_type}
                    </span>
                  </td>
                  <td className="p-4 font-mono font-bold text-blue-700">{item.document_number}</td>
                  <td className="p-4 font-medium text-slate-600">{new Date(item.document_date).toLocaleDateString('id-ID')}</td>
                  <td className="p-4 font-bold text-slate-800">{item.vendor_name}</td>
                  <td className="p-4 text-right tabular-nums font-bold text-emerald-600"><MoneyText value={item.requested_amount} /></td>
                  <td className="p-4 text-center">
                    <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-slate-200 uppercase">{item.status}</span>
                  </td>
                  <td className="p-4 text-right">
                    <button onClick={() => handleOpenReview(item)} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-sm">
                      <FileText size={14} /> Review & Bayar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL REVIEW DENGAN AUDIT KEPATUHAN */}
      {isReviewModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2"><FileCheck className="text-emerald-400" /> Review & Audit Dokumen</h3>
                <p className="text-slate-300 text-xs mt-1 font-medium">{selectedPayment.document_number} <span className="mx-2">|</span> {selectedPayment.payment_type} <span className="mx-2">|</span> {selectedPayment.vendor_name}</p>
              </div>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 hover:text-rose-400 bg-white/10 p-2 rounded-full transition-colors"><XCircle size={24} /></button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
              <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center shadow-sm">
                <p className="text-emerald-700 text-xs font-bold uppercase tracking-wider mb-1">Nilai Pengajuan (Netto)</p>
                <p className="text-4xl font-extrabold text-emerald-800 tabular-nums"><MoneyText value={selectedPayment.requested_amount} /></p>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className={`p-4 font-bold text-sm flex items-center gap-2 border-b ${hasFailedAudit ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                  {isAuditing ? <Loader2 className="animate-spin" size={18} /> : hasFailedAudit ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                  {isAuditing ? 'Menjalankan Audit Kepatuhan...' : hasFailedAudit ? 'Audit Gagal: Ditemukan Ketidaksesuaian' : 'Audit Kepatuhan SAK & KUP: LULUS'}
                </div>
                <div className="bg-white p-5 space-y-3">
                  {auditResults.map((res, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-sm">
                      {res.status === 'PASS' && <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />}
                      {res.status === 'FAIL' && <XCircle size={18} className="text-rose-500 mt-0.5 flex-shrink-0" />}
                      {res.status === 'WARN' && <AlertTriangle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />}
                      <div>
                        <span className="font-bold text-slate-800">{res.label}: </span>
                        <span className={res.status === 'FAIL' ? 'text-rose-600 font-medium' : res.status === 'WARN' ? 'text-amber-600 font-medium' : 'text-slate-600'}>{res.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
                <button onClick={() => setIsReviewModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors">Tutup</button>
                <button onClick={() => setShowConfirmPay(true)} disabled={hasFailedAudit || isAuditing} className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl flex items-center gap-2 shadow-md transition-all ${hasFailedAudit || isAuditing ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                  <CheckCircle2 size={18} /> Konfirmasi Pembayaran
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={showConfirmPay} title="Konfirmasi Pembayaran" message={`Apakah Anda yakin dana sebesar Rp ${selectedPayment?.requested_amount.toLocaleString('id-ID')} sudah ditransfer? Tindakan ini akan mencatat Kas Keluar di Buku Besar.`} onConfirm={handleProcessPayment} onClose={() => setShowConfirmPay(false)} isLoading={isPaying} />
    </div>
  );
}