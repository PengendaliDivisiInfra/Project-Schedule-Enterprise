'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
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
import { Plus, Users, FileText, Trash2, Pencil, Printer, FileSignature, Receipt, FileSpreadsheet } from 'lucide-react';
import { BAOPView } from '@/components/subcon/BAOPView';
import { BAPPView } from '@/components/subcon/BAPPView';
import { BPUTKView } from '@/components/subcon/views/BPUTKView';
import { KasbonView } from '@/components/subcon/views/KasbonView';
import { LampiranBAPPView } from '@/components/subcon/views/LampiranBAPPView';
import { KwitansiView } from '@/components/subcon/views/KwitansiView';

export default function SubcontractorsPage() {
  const params = useParams();
  const projectId = params?.projectId as string;
  const { can } = useRole();

  const [subcons, setSubcons] = useState<Subcontractor[]>([]);
  const [spks, setSpks] = useState<any[]>([]);
  const [projectData, setProjectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('master');

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [isSubconModalOpen, setIsSubconModalOpen] = useState(false);
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

  return (
    <div className="p-6 w-full space-y-6">
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
          <button onClick={() => setIsSubconModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium">
            <Users size={18} /> Tambah Vendor
          </button>
        )}
        {activeTab === 'spk' && can('SUBCON_CREATE') && (
          <button onClick={() => { setEditingSPK(null); setIsSPKModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm font-medium">
            <Plus size={18} /> Buat SPK
          </button>
        )}
      </div>

      <div className="border-b border-slate-200 mt-6">
        <nav className="flex gap-6 -mb-px overflow-x-auto">
          <button onClick={() => setActiveTab('master')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'master' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Users size={18} /> Master Vendor Subkon
          </button>
          <button onClick={() => setActiveTab('spk')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'spk' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <FileText size={18} /> Daftar SPK & Pembayaran
          </button>
          <button onClick={() => setActiveTab('baop')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'baop' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <FileText size={18} /> Dokumen BAOP
          </button>
          <button onClick={() => setActiveTab('bapp')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'bapp' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <FileText size={18} /> Dokumen BAPP
          </button>
          <button onClick={() => setActiveTab('lampiran_bapp')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'lampiran_bapp' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <FileSpreadsheet size={18} /> Lampiran BAPP
          </button>
          <button onClick={() => setActiveTab('bputk')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'bputk' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Printer size={18} /> Biaya Upah (BPUTK)
          </button>
          <button onClick={() => setActiveTab('kasbon')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'kasbon' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <FileSignature size={18} /> Pengajuan Kasbon
          </button>
          <button onClick={() => setActiveTab('kwitansi')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${activeTab === 'kwitansi' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <Receipt size={18} /> Kwitansi
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
                    <td className="p-4 border-b text-right">
                      {can('SUBCON_CREATE') && (
                        <button onClick={() => setDeleteTarget({ id: s.id, type: 'vendor' })} className="text-red-500 hover:text-red-700 p-2 bg-red-50 rounded-lg hover:bg-red-100 transition-colors" title="Hapus Vendor">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {subcons.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">Belum ada vendor subkon.</td></tr>}
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

          {activeTab === 'baop' && (
            <BAOPView 
              projectId={projectId} 
              spks={spks} 
              onSuccess={loadData} 
              showToast={showToast} 
            />
          )}

          {activeTab === 'bapp' && (
            <BAPPView 
              projectId={projectId} 
              spks={spks} 
              onSuccess={loadData} 
              showToast={showToast} 
            />
          )}

          {activeTab === 'lampiran_bapp' && (
            <LampiranBAPPView projectId={projectId} spks={spks} showToast={showToast} />
          )}

          {activeTab === 'bputk' && (
            <BPUTKView 
              projectId={projectId} 
              spks={spks} 
              showToast={showToast} 
            />
          )}

          {activeTab === 'kasbon' && (
            <KasbonView 
              projectId={projectId} 
              projectData={projectData} 
              spks={spks} 
              showToast={showToast} 
            />
          )}

          {activeTab === 'kwitansi' && (
            <KwitansiView projectId={projectId} projectData={projectData} spks={spks} showToast={showToast} />
          )}
        </div>
      )}

      {/* --- MODALS --- */}
      <SubcontractorModal isOpen={isSubconModalOpen} onClose={() => setIsSubconModalOpen(false)} projectId={projectId} onSuccess={loadData} showToast={showToast} />
      <SPKModal isOpen={isSPKModalOpen} onClose={() => { setIsSPKModalOpen(false); setEditingSPK(null); }} projectId={projectId} subcontractors={subcons} onSuccess={loadData} showToast={showToast} editingSPK={editingSPK} />
      <HistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} contractId={selectedSPK?.id || null} />
      <AddendumModal isOpen={isAddendumModalOpen} onClose={() => setIsAddendumModalOpen(false)} spk={selectedSPK} onSuccess={loadData} showToast={showToast} />
      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm} title={deleteTarget?.type === 'vendor' ? 'Hapus Vendor' : 'Batalkan SPK'} message={deleteTarget?.type === 'vendor' ? 'Hapus vendor ini?' : 'Batalkan SPK ini?'} isLoading={isDeleting} />
    </div>
  );
}