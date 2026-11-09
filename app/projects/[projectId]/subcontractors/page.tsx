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
import { 
  Plus, Users, FileText, Trash2, Pencil, Printer, 
  FileSignature, Receipt, FileSpreadsheet, Wallet, Activity, BookOpen, AlertCircle, ShieldCheck
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
  const [editingSubcon, setEditingSubcon] = useState<Subcontractor | null>(null); // <-- STATE BARU
  
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
                <h4 className="font-bold text-amber-800 mb-1 flex items-center gap-2">
                  <AlertCircle size={16} /> Penting untuk PM
                </h4>
                <p className="text-amber-700 text-xs leading-relaxed">
                  Input volume fisik di sini adalah <strong>Single Source of Truth</strong>. Jangan memasukkan angka pajak atau retensi. Sistem menghitungnya otomatis di BAPP.
                </p>
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
                <h4 className="font-bold text-indigo-800 mb-1 flex items-center gap-2">
                  <AlertCircle size={16} /> Validasi SAK & KUP
                </h4>
                <p className="text-indigo-700 text-xs leading-relaxed">
                  Pilih BPUTK yang belum ditagih. Sistem akan mengunci BPUTK (Anti Double Billing) dan menghitung PPN 11%, PPh 4(2), serta Retensi secara otomatis.
                </p>
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
                <h4 className="font-bold text-amber-800 mb-1 flex items-center gap-2">
                  <AlertCircle size={16} /> Fasilitas Pinjaman
                </h4>
                <p className="text-amber-700 text-xs leading-relaxed">
                  Kasbon yang sudah diapprove akan masuk ke antrean pembayaran. Kasbon yang belum dibayar akan menjadi pengurang otomatis pada BAPP berikutnya.
                </p>
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
                <h4 className="font-bold text-emerald-800 mb-1 flex items-center gap-2">
                  <AlertCircle size={16} /> Penagihan Mandor
                </h4>
                <p className="text-emerald-700 text-xs leading-relaxed">
                  Pilih Dokumen Referensi (BAPP). Sistem akan menarik nilai Netto secara otomatis dan menyimpannya ke antrean pembayaran (Status: PENDING).
                </p>
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
                <h4 className="font-bold mb-1 flex items-center gap-2">
                  <ShieldCheck size={16} /> Finance Control
                </h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Gunakan fitur Review & Audit. Jika Audit SAK/KUP gagal (merah), Anda tidak bisa mencairkan dana. Pastikan semua dokumen sesuai sebelum klik "Konfirmasi Pembayaran".
                </p>
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

  if (!can('SUBCON_VIEW')) return <div className="p-8 text-center text-red-500">Anda tidak memiliki akses ke modul Subcontractor.</div>;

  const guide = getGuideContent();

  return (
    <div className="p-6 w-full space-y-6 relative">
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded shadow-lg text-white font-medium z-[100] ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Subcontractor Management</h1>
          <p className="text-slate-500 text-sm">Kelola Vendor, SPK, Pembayaran, dan Dokumen Opname.</p>
        </div>
        
        {activeTab === 'master' && can('SUBCON_CREATE') && (
          <button onClick={() => { setEditingSubcon(null); setIsSubconModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium">
            <Users size={18} /> Tambah Vendor
          </button>
        )}
        {activeTab === 'spk' && can('SUBCON_CREATE') && (
          <button onClick={() => { setEditingSPK(null); setIsSPKModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium">
            <Plus size={18} /> Buat SPK
          </button>
        )}
      </div>

      <WorkflowStepper currentStep={getStepFromTab(activeTab)} />

      <div className="border-b border-slate-200 mt-2">
        <nav className="flex gap-6 -mb-px overflow-x-auto pb-2">
           <button onClick={() => setActiveTab('master')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'master' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Users size={18} /> 1. Master Vendor
          </button>
          <button onClick={() => setActiveTab('spk')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'spk' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <FileText size={18} /> 2. Daftar SPK
          </button>
          <button onClick={() => setActiveTab('bputk')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'bputk' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Activity size={18} /> 3. Input Progres (BPUTK)
          </button>
          <button onClick={() => setActiveTab('baop')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'baop' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <FileText size={18} /> 4. Dokumen BAOP
          </button>
          <button onClick={() => setActiveTab('bapp')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'bapp' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <FileText size={18} /> 5. Dokumen BAPP
          </button>
          <button onClick={() => setActiveTab('lampiran_bapp')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'lampiran_bapp' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <FileSpreadsheet size={18} /> 6. Lampiran BAPP
          </button>
          <button onClick={() => setActiveTab('kasbon')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'kasbon' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <FileSignature size={18} /> 7. Pengajuan Kasbon
          </button>
          <button onClick={() => setActiveTab('kwitansi')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'kwitansi' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Receipt size={18} /> 8. Kwitansi
          </button>
          <button onClick={() => setActiveTab('payment')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'payment' ? 'border-slate-800 text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Wallet size={18} /> 9. Persetujuan & Pembayaran
          </button>
        </nav>
      </div>

      {loading ? (
        <div className="text-center p-12 text-slate-500">Memuat data...</div>
      ) : (
        <div className={['master', 'spk'].includes(activeTab) ? 'bg-white border rounded-xl shadow-sm overflow-x-auto' : ''}>
          
          {activeTab === 'master' && ( 
            <table className="w-full text-left text-sm min-w-[800px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-4 border-b">Nama Perusahaan</th>
                  <th className="p-4 border-b">Contact Person</th>
                  <th className="p-4 border-b">No. Telepon</th>
                  <th className="p-4 border-b">Bank & Rekening</th>
                  <th className="p-4 border-b">Kualifikasi PPh</th>
                  <th className="p-4 border-b text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {subcons.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-4 border-b font-bold text-slate-800">
                      {s.company_name}
                      {s.address && <span className="block text-xs text-slate-500 font-normal mt-1">{s.address}</span>}
                    </td>
                    <td className="p-4 border-b">{s.contact_person || '-'}</td>
                    <td className="p-4 border-b">{s.phone || '-'}</td>
                    <td className="p-4 border-b">{s.bank_name ? `${s.bank_name} - ${s.bank_account}` : '-'}</td>
                    <td className="p-4 border-b text-xs text-indigo-700 font-medium">
                      {s.pph_category || 'Kecil (1.75%)'}
                    </td>
                    <td className="p-4 border-b text-right">
                      {can('SUBCON_CREATE') && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setEditingSubcon(s); setIsSubconModalOpen(true); }} className="text-indigo-600 hover:text-indigo-800 p-2 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors" title="Edit Vendor">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => setDeleteTarget({ id: s.id, type: 'vendor' })} className="text-red-500 hover:text-red-700 p-2 bg-red-50 rounded-lg hover:bg-red-100 transition-colors" title="Hapus Vendor">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {subcons.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">Belum ada vendor subkon.</td></tr>}
              </tbody>
            </table>
          )}

          {activeTab === 'spk' && ( 
            <table className="w-full text-left text-sm min-w-[1000px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-4 border-b">No. SPK</th>
                  <th className="p-4 border-b">Vendor Subkon</th>
                  <th className="p-4 border-b">Pekerjaan</th>
                  <th className="p-4 border-b">Nilai SPK (Akhir)</th>
                  <th className="p-4 border-b">Total Dibayar</th>
                  <th className="p-4 border-b">Sisa Kasbon</th>
                  <th className="p-4 border-b">Status</th>
                  <th className="p-4 border-b text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {spks.map((spk) => (
                  <tr key={spk.id} className="hover:bg-slate-50">
                    <td className="p-4 border-b font-bold">{spk.spk_number}</td>
                    <td className="p-4 border-b">{spk.subcontractor_name}</td>
                    <td className="p-4 border-b text-slate-500">{spk.work_description}</td>
                    <td className="p-4 border-b">
                      <MoneyText value={spk.final_contract_value || spk.contract_value} />
                      {spk.total_addendum !== 0 && (
                        <div className="text-[10px] text-slate-500 mt-1">
                          Awal: {new Intl.NumberFormat('id-ID').format(spk.contract_value)}<br/>
                          Addendum: {new Intl.NumberFormat('id-ID').format(spk.total_addendum || 0)}
                        </div>
                      )}
                    </td>
                    <td className="p-4 border-b text-green-600"><MoneyText value={spk.total_paid} /></td>
                    <td className="p-4 border-b text-amber-600">
                      {spk.total_kasbon > 0 ? <MoneyText value={spk.total_kasbon} /> : '-'}
                    </td>
                    <td className="p-4 border-b"><StatusBadge status={spk.status} /></td>
                    <td className="p-4 border-b text-right space-x-2">
                      
                      <Link 
                        href={`/projects/${projectId}/subcontractors/spk/${spk.id}/print`}
                        className="text-slate-600 hover:text-slate-900 text-xs font-medium inline-flex items-center gap-1"
                        title="Cetak PDF SPK"
                      >
                        <Printer size={14} /> Cetak
                      </Link>
                      <span className="text-slate-300">|</span>

                      {spk.status === 'Active' && can('SUBCON_PAY') && (
                        <button 
                          onClick={() => { 
                            setActiveTab('kasbon'); 
                            setSelectedSPK(spk); 
                          }} 
                          className="text-amber-600 hover:underline text-sm font-bold inline-flex items-center gap-1 bg-amber-50 px-2 py-1 rounded"
                        >
                          <FileSignature size={14} /> Ajukan Kasbon
                        </button>
                      )}

                      <button onClick={() => { setSelectedSPK(spk); setIsHistoryModalOpen(true); }} className="text-slate-500 hover:text-slate-800 text-xs font-medium">
                        History
                      </button>
                      <span className="text-slate-300">|</span>
                      <button onClick={() => { setSelectedSPK(spk); setIsAddendumModalOpen(true); }} className="text-amber-600 hover:text-amber-800 text-xs font-medium">
                        + Addendum
                      </button>
                      {can('SUBCON_CREATE') && (
                        <>
                          <span className="text-slate-300">|</span>
                          <button onClick={() => { setEditingSPK(spk); setIsSPKModalOpen(true); }} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">
                            <Pencil size={14} className="inline mr-1" /> Edit
                          </button>
                          <span className="text-slate-300">|</span>
                          <button onClick={() => setDeleteTarget({ id: spk.id, type: 'spk' })} className="text-red-500 hover:text-red-700 text-xs font-medium">
                            Hapus
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {spks.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">Belum ada SPK.</td></tr>}
              </tbody>
            </table>
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

      <GuideDrawer 
        isOpen={isGuideOpen} 
        onClose={() => setIsGuideOpen(false)} 
        title={guide.title}
      >
        {guide.content}
      </GuideDrawer>

      <SubcontractorModal 
        isOpen={isSubconModalOpen} 
        onClose={() => { setIsSubconModalOpen(false); setEditingSubcon(null); }} 
        projectId={projectId} 
        onSuccess={loadData} 
        showToast={showToast} 
        editingSubcon={editingSubcon} 
      />
      
      <SPKModal 
        isOpen={isSPKModalOpen} 
        onClose={() => { setIsSPKModalOpen(false); setEditingSPK(null); }} 
        projectId={projectId} 
        subcontractors={subcons} 
        onSuccess={loadData} 
        showToast={showToast} 
        editingSPK={editingSPK} 
      />
      
      <HistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} contractId={selectedSPK?.id || null} />
      <AddendumModal isOpen={isAddendumModalOpen} onClose={() => setIsAddendumModalOpen(false)} spk={selectedSPK} onSuccess={loadData} showToast={showToast} />
      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm} title={deleteTarget?.type === 'vendor' ? 'Hapus Vendor' : 'Batalkan SPK'} message={deleteTarget?.type === 'vendor' ? 'Hapus vendor ini?' : 'Batalkan SPK ini?'} isLoading={isDeleting} />
    </div>
  );
}