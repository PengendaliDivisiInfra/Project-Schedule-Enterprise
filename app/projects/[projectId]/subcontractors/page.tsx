'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useRole } from '@/lib/hooks/useRole';
import { supabase } from '@/lib/supabase';
import { listSubcontractors, listSPK, softDeleteSubcontractor, softDeleteSPK } from '@/lib/services/subcon.service';
import { Subcontractor, SubcontractorContract } from '@/lib/types/subcon';
import { MoneyText } from '@/components/ui/MoneyText';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SubcontractorModal } from '@/components/subcon/SubcontractorModal';
import { SPKModal } from '@/components/subcon/SPKModal';
import { HistoryModal } from '@/components/subcon/HistoryModal';
import { AddendumModal } from '@/components/subcon/AddendumModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { 
  Plus, Users, FileText, Trash2, Pencil, Printer, 
  FileSignature, Receipt, FileSpreadsheet, Wallet, Activity, BookOpen, AlertCircle, ShieldCheck, MoreHorizontal, ArrowRight, CheckCircle2
} from 'lucide-react';
import { BAOPView } from '@/components/subcon/BAOPView';
import { BAPPView } from '@/components/subcon/BAPPView';
import { BPUTKView } from '@/components/subcon/views/BPUTKView';
import { KasbonView } from '@/components/subcon/views/KasbonView';
import { LampiranBAPPView } from '@/components/subcon/views/LampiranBAPPView';
import { KwitansiView } from '@/components/subcon/views/KwitansiView';
import { PaymentCenterView } from '@/components/subcon/views/PaymentCenterView';
import { WorkflowStepper } from '@/components/shared/WorkflowStepper';
import { GuideDrawer } from '@/components/shared/GuideDrawer';

export default function SubcontractorsPage() {
  const params = useParams();
  const projectId = params?.projectId as string;
  const { can } = useRole();

  const [subcons, setSubcons] = useState<Subcontractor[]>([]);
  const [spks, setSpks] = useState<any[]>([]);
  const [projectData, setProjectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('master');

  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [isSubconModalOpen, setIsSubconModalOpen] = useState(false);
  const [editingSubcon, setEditingSubcon] = useState<Subcontractor | null>(null); 
  
  const [isSPKModalOpen, setIsSPKModalOpen] = useState(false);
  const [selectedSPK, setSelectedSPK] = useState<any>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isAddendumModalOpen, setIsAddendumModalOpen] = useState(false);
  const [editingSPK, setEditingSPK] = useState<SubcontractorContract | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'vendor' | 'spk' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getStepFromTab = (tab: string) => {
    if (tab === 'master' || tab === 'spk') return 1;
    if (tab === 'bputk') return 2;
    if (tab === 'baop' || tab === 'bapp' || tab === 'lampiran_bapp' || tab === 'kasbon') return 3;
    if (tab === 'kwitansi') return 4;
    if (tab === 'payment') return 5;
    return 0; 
  };

  const getGuideContent = () => {
    switch (activeTab) {
      case 'bputk':
        return {
          title: 'Tahap 2: Input Progres (BPUTK)',
          content: (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                <h4 className="font-bold text-amber-800 mb-1 flex items-center gap-2"><AlertCircle size={16} /> Penting untuk PM</h4>
                <p className="text-amber-700 text-xs leading-relaxed">Input volume fisik di sini adalah <strong>Single Source of Truth</strong>. Jangan memasukkan angka pajak atau retensi. Sistem menghitungnya otomatis di BAPP.</p>
              </div>
            </div>
          )
        };
      case 'bapp':
      case 'baop':
        return {
          title: 'Tahap 3: Dokumen Finansial (BAPP/BAOP)',
          content: (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl">
                <h4 className="font-bold text-indigo-800 mb-1 flex items-center gap-2"><AlertCircle size={16} /> Validasi SAK & KUP</h4>
                <p className="text-indigo-700 text-xs leading-relaxed">Pilih BPUTK yang belum ditagih. Sistem akan mengunci BPUTK (Anti Double Billing) dan menghitung PPN 11%, PPh 4(2), serta Retensi secara otomatis.</p>
              </div>
            </div>
          )
        };
      case 'kasbon':
        return {
          title: 'Tahap 3: Pengajuan Kasbon',
          content: (
             <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                <h4 className="font-bold text-amber-800 mb-1 flex items-center gap-2"><AlertCircle size={16} /> Fasilitas Pinjaman</h4>
                <p className="text-amber-700 text-xs leading-relaxed">Kasbon yang sudah diapprove akan masuk ke antrean pembayaran. Kasbon yang belum dibayar akan menjadi pengurang otomatis pada BAPP berikutnya.</p>
              </div>
            </div>
          )
        };
      case 'kwitansi':
        return {
          title: 'Tahap 4: Penagihan (Kwitansi)',
          content: (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                <h4 className="font-bold text-emerald-800 mb-1 flex items-center gap-2"><AlertCircle size={16} /> Penagihan Mandor</h4>
                <p className="text-emerald-700 text-xs leading-relaxed">Pilih Dokumen Referensi (BAPP). Sistem akan menarik nilai Netto secara otomatis dan menyimpannya ke antrean pembayaran (Status: PENDING).</p>
              </div>
            </div>
          )
        };
      case 'payment':
        return {
          title: 'Tahap 5: Otorisasi Pembayaran',
          content: (
            <div className="space-y-4">
              <div className="bg-slate-800 text-white p-4 rounded-xl">
                <h4 className="font-bold mb-1 flex items-center gap-2"><ShieldCheck size={16} /> Finance Control</h4>
                <p className="text-slate-300 text-xs leading-relaxed">Gunakan fitur Review & Audit. Jika Audit SAK/KUP gagal (merah), Anda tidak bisa mencairkan dana. Pastikan semua dokumen sesuai sebelum klik "Konfirmasi Pembayaran".</p>
              </div>
            </div>
          )
        };
      default:
        return {
          title: 'Panduan Umum',
          content: (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">Pilih tab alur kerja (BPUTK, BAPP, Kwitansi, Pembayaran) untuk melihat panduan spesifik.</p>
            </div>
          )
        };
    }
  };

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [s, sp, proj] = await Promise.all([
        listSubcontractors(projectId), 
        listSPK(projectId),
        supabase.from('projects').select('name, location, company_name, contractor_address, logo_url').eq('id', projectId).single()
      ]);
      setSubcons(s);
      setSpks(sp);
      setProjectData(proj.data);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [projectId]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'vendor') {
        await softDeleteSubcontractor(deleteTarget.id);
        showToast('Vendor berhasil dihapus', 'success');
      } else {
        await softDeleteSPK(deleteTarget.id);
        showToast('SPK berhasil dibatalkan (Void)', 'success');
      }
      loadData();
      setDeleteTarget(null);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!can('SUBCON_VIEW')) return <div className="p-8 text-center text-red-500 font-bold">Anda tidak memiliki akses ke modul Subcontractor.</div>;

  const guide = getGuideContent();
  const tabClass = (isActive: boolean) => `py-3 px-4 border-b-2 font-bold text-sm flex items-center gap-2 whitespace-nowrap transition-all rounded-t-xl ${isActive ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`;
  const actionBtnClass = "p-1.5 rounded-lg border transition-colors flex items-center justify-center";

  return (
    <div className="p-6 w-full space-y-6 relative bg-slate-50 min-h-screen">
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-xl shadow-xl text-white font-bold animate-in slide-in-from-top-4 fade-in flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          <CheckCircle2 size={18} /> {toast.msg}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2 tracking-tight"><Users className="text-indigo-600" /> Subcontractor Management</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Kelola Vendor, SPK, Pembayaran, dan Dokumen Opname.</p>
        </div>
        
        {activeTab === 'master' && can('SUBCON_CREATE') && (
          <button onClick={() => { setEditingSubcon(null); setIsSubconModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md shadow-indigo-500/20 font-bold text-sm transition-all">
            <Plus size={18} /> Tambah Vendor
          </button>
        )}
        {activeTab === 'spk' && can('SUBCON_CREATE') && (
          <button onClick={() => { setEditingSPK(null); setIsSPKModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md shadow-indigo-500/20 font-bold text-sm transition-all">
            <Plus size={18} /> Buat SPK
          </button>
        )}
      </div>

      <WorkflowStepper currentStep={getStepFromTab(activeTab)} />

      <div className="flex gap-2 border-b border-slate-200 mt-2 overflow-x-auto pb-px">
        <button onClick={() => setActiveTab('master')} className={tabClass(activeTab === 'master')}>
          <Users size={18} /> Master Vendor
        </button>
        <button onClick={() => setActiveTab('spk')} className={tabClass(activeTab === 'spk')}>
          <FileText size={18} /> Daftar SPK
        </button>
        <button onClick={() => setActiveTab('bputk')} className={tabClass(activeTab === 'bputk')}>
          <Activity size={18} /> Progres (BPUTK)
        </button>
        <button onClick={() => setActiveTab('baop')} className={tabClass(activeTab === 'baop')}>
          <FileText size={18} /> BAOP
        </button>
        <button onClick={() => setActiveTab('bapp')} className={tabClass(activeTab === 'bapp')}>
          <FileText size={18} /> BAPP
        </button>
        <button onClick={() => setActiveTab('lampiran_bapp')} className={tabClass(activeTab === 'lampiran_bapp')}>
          <FileSpreadsheet size={18} /> Lampiran BAPP
        </button>
        <button onClick={() => setActiveTab('kasbon')} className={tabClass(activeTab === 'kasbon')}>
          <FileSignature size={18} /> Kasbon
        </button>
        <button onClick={() => setActiveTab('kwitansi')} className={tabClass(activeTab === 'kwitansi')}>
          <Receipt size={18} /> Kwitansi
        </button>
        <button onClick={() => setActiveTab('payment')} className={tabClass(activeTab === 'payment')}>
          <Wallet size={18} /> Pembayaran
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <SkeletonLoader rows={6} cols={6} />
        </div>
      ) : (
        <div className={['master', 'spk'].includes(activeTab) ? 'bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col' : ''}>
          
          {activeTab === 'master' && ( 
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="bg-slate-50 border-b border-slate-300">
                  <tr className="text-slate-600 text-xs uppercase tracking-wider">
                    <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Nama Perusahaan</th>
                    <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Contact Person</th>
                    <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">No. Telepon</th>
                    <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Bank & Rekening</th>
                    <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Kualifikasi PPh</th>
                    <th className="p-4 font-bold border-b border-slate-300 text-right sticky top-0 bg-slate-50 z-10">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subcons.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-16 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <Users className="w-12 h-12 mb-3 opacity-20" />
                          <p className="font-bold text-lg text-slate-600">Belum ada vendor subkon.</p>
                          <p className="text-sm mt-1">Tambahkan vendor baru untuk mulai membuat SPK.</p>
                        </div>
                      </td>
                    </tr>
                  ) : subcons.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold text-slate-800">
                        {s.company_name}
                        {s.address && <span className="block text-xs text-slate-500 font-normal mt-1">{s.address}</span>}
                      </td>
                      <td className="p-4 font-medium text-slate-600">{s.contact_person || '-'}</td>
                      <td className="p-4 text-slate-600">{s.phone || '-'}</td>
                      <td className="p-4 text-slate-600">{s.bank_name ? `${s.bank_name} - ${s.bank_account}` : '-'}</td>
                      <td className="p-4 text-xs text-indigo-700 font-bold">
                        {s.pph_category || 'Kecil (1.75%)'}
                      </td>
                      <td className="p-4 text-right">
                        {can('SUBCON_CREATE') && (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => { setEditingSubcon(s); setIsSubconModalOpen(true); }} className={`${actionBtnClass} text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-200`} title="Edit Vendor">
                              <Pencil size={16} />
                            </button>
                            <button onClick={() => setDeleteTarget({ id: s.id, type: 'vendor' })} className={`${actionBtnClass} text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-200`} title="Hapus Vendor">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'spk' && ( 
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full text-left text-sm min-w-[1100px]">
                <thead className="bg-slate-50 border-b border-slate-300">
                  <tr className="text-slate-600 text-xs uppercase tracking-wider">
                    <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">No. SPK</th>
                    <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Vendor Subkon</th>
                    <th className="p-4 font-bold border-b border-slate-300 sticky top-0 bg-slate-50 z-10">Pekerjaan</th>
                    <th className="p-4 font-bold border-b border-slate-300 text-right sticky top-0 bg-slate-50 z-10">Nilai SPK (Akhir)</th>
                    <th className="p-4 font-bold border-b border-slate-300 text-right sticky top-0 bg-slate-50 z-10">Total Dibayar</th>
                    <th className="p-4 font-bold border-b border-slate-300 text-right sticky top-0 bg-slate-50 z-10">Sisa Kasbon</th>
                    <th className="p-4 font-bold border-b border-slate-300 text-center sticky top-0 bg-slate-50 z-10">Status</th>
                    <th className="p-4 font-bold border-b border-slate-300 text-right sticky top-0 bg-slate-50 z-10">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {spks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-16 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <FileText className="w-12 h-12 mb-3 opacity-20" />
                          <p className="font-bold text-lg text-slate-600">Belum ada SPK.</p>
                          <p className="text-sm mt-1">Buat SPK baru untuk memulai kontrak pekerjaan.</p>
                        </div>
                      </td>
                    </tr>
                  ) : spks.map((spk) => (
                    <tr key={spk.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold font-mono text-blue-700">{spk.spk_number}</td>
                      <td className="p-4 font-medium text-slate-800">{spk.subcontractor_name}</td>
                      <td className="p-4 text-slate-500 max-w-[200px] truncate" title={spk.work_description}>{spk.work_description}</td>
                      <td className="p-4 text-right tabular-nums font-semibold text-slate-700">
                        <MoneyText value={spk.final_contract_value || spk.contract_value} />
                        {spk.total_addendum !== 0 && (
                          <div className="text-[10px] text-slate-500 mt-1 font-medium">
                            Awal: {new Intl.NumberFormat('id-ID').format(spk.contract_value)}<br/>
                            Addendum: {new Intl.NumberFormat('id-ID').format(spk.total_addendum || 0)}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right tabular-nums font-semibold text-emerald-600"><MoneyText value={spk.total_paid} /></td>
                      <td className="p-4 text-right tabular-nums font-semibold text-amber-600">
                        {spk.total_kasbon > 0 ? <MoneyText value={spk.total_kasbon} /> : '-'}
                      </td>
                      <td className="p-4 text-center"><StatusBadge status={spk.status} /></td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap max-w-[250px] ml-auto">
                          <Link 
                            href={`/projects/${projectId}/subcontractors/spk/${spk.id}/print`}
                            className={`${actionBtnClass} text-slate-600 bg-slate-50 hover:bg-slate-100 border-slate-200`}
                            title="Cetak PDF SPK"
                          >
                            <Printer size={14} />
                          </Link>

                          <button onClick={() => { setSelectedSPK(spk); setIsHistoryModalOpen(true); }} className={`${actionBtnClass} text-slate-600 bg-slate-50 hover:bg-slate-100 border-slate-200`} title="History & Log">
                            <Activity size={14} />
                          </button>

                          <button onClick={() => { setSelectedSPK(spk); setIsAddendumModalOpen(true); }} className={`${actionBtnClass} text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-200`} title="Tambah Addendum">
                            <Plus size={14} />
                          </button>

                          {spk.status === 'Active' && can('SUBCON_PAY') && (
                            <button 
                              onClick={() => { setActiveTab('kasbon'); setSelectedSPK(spk); }} 
                              className={`${actionBtnClass} text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-200`}
                              title="Ajukan Kasbon"
                            >
                              <FileSignature size={14} />
                            </button>
                          )}

                          {can('SUBCON_CREATE') && (
                            <>
                              <button onClick={() => { setEditingSPK(spk); setIsSPKModalOpen(true); }} className={`${actionBtnClass} text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200`} title="Edit SPK">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => setDeleteTarget({ id: spk.id, type: 'spk' })} className={`${actionBtnClass} text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-200`} title="Batalkan / Hapus SPK">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'bputk' && <BPUTKView projectId={projectId} spks={spks} showToast={showToast} />}
          {activeTab === 'baop' && <BAOPView projectId={projectId} spks={spks} onSuccess={loadData} showToast={showToast} />}
          {activeTab === 'bapp' && <BAPPView projectId={projectId} spks={spks} onSuccess={loadData} showToast={showToast} />}
          {activeTab === 'lampiran_bapp' && <LampiranBAPPView projectId={projectId} spks={spks} showToast={showToast} />}
          {activeTab === 'kasbon' && <KasbonView projectId={projectId} projectData={projectData} spks={spks} showToast={showToast} />}
          {activeTab === 'kwitansi' && <KwitansiView projectId={projectId} projectData={projectData} spks={spks} showToast={showToast} />}
          {activeTab === 'payment' && <PaymentCenterView projectId={projectId} showToast={showToast} />}
        </div>
      )}

      {activeTab !== 'workflow' && (
        <button 
          onClick={() => setIsGuideOpen(true)}
          className="fixed bottom-8 right-8 z-[80] flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-full shadow-2xl shadow-indigo-500/30 transition-transform hover:-translate-y-1 print:hidden"
        >
          <BookOpen size={20} />
          <span className="font-bold">Panduan</span>
        </button>
      )}

      <GuideDrawer isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} title={guide.title}>{guide.content}</GuideDrawer>
      <SubcontractorModal isOpen={isSubconModalOpen} onClose={() => { setIsSubconModalOpen(false); setEditingSubcon(null); }} projectId={projectId} onSuccess={loadData} showToast={showToast} editingSubcon={editingSubcon} />
      <SPKModal isOpen={isSPKModalOpen} onClose={() => { setIsSPKModalOpen(false); setEditingSPK(null); }} projectId={projectId} subcontractors={subcons} onSuccess={loadData} showToast={showToast} editingSPK={editingSPK} />
      <HistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} contractId={selectedSPK?.id || null} />
      <AddendumModal isOpen={isAddendumModalOpen} onClose={() => setIsAddendumModalOpen(false)} spk={selectedSPK} onSuccess={loadData} showToast={showToast} />
      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm} title={deleteTarget?.type === 'vendor' ? 'Hapus Vendor' : 'Batalkan SPK'} message={deleteTarget?.type === 'vendor' ? 'Hapus vendor ini?' : 'Batalkan SPK ini?'} isLoading={isDeleting} />
    </div>
  );
}