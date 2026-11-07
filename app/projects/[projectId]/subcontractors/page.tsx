'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRole } from '@/lib/hooks/useRole';
import { listSubcontractors, listSPK, softDeleteSubcontractor, softDeleteSPK } from '@/lib/services/subcon.service';
import { Subcontractor, SubcontractorContract } from '@/lib/types/subcon';
import { MoneyText } from '@/components/ui/MoneyText';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SubcontractorModal } from '@/components/subcon/SubcontractorModal';
import { SPKModal } from '@/components/subcon/SPKModal';
import { PaySubconModal } from '@/components/subcon/PaySubconModal';
import { HistoryModal } from '@/components/subcon/HistoryModal';
import { AddendumModal } from '@/components/subcon/AddendumModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Plus, Users, FileText, CheckCircle, Trash2, Pencil } from 'lucide-react';
import { BAOPView } from '@/components/subcon/BAOPView';

export default function SubcontractorsPage() {
  const params = useParams();
  const projectId = params?.projectId as string;
  const { can } = useRole();

  const [subcons, setSubcons] = useState<Subcontractor[]>([]);
  const [spks, setSpks] = useState<(SubcontractorContract & { total_paid: number, total_kasbon: number, total_addendum: number, final_contract_value: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('master');

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const [isSubconModalOpen, setIsSubconModalOpen] = useState(false);
  const [isSPKModalOpen, setIsSPKModalOpen] = useState(false);
  const [selectedSPK, setSelectedSPK] = useState<any>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isAddendumModalOpen, setIsAddendumModalOpen] = useState(false);

  const [editingSPK, setEditingSPK] = useState<SubcontractorContract | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'vendor' | 'spk' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBAOPOpen, setIsBAOPOpen] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [s, sp] = await Promise.all([listSubcontractors(projectId), listSPK(projectId)]);
      setSubcons(s);
      setSpks(sp);
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
          <p className="text-slate-500 text-sm">Kelola Vendor, SPK, Pembayaran Opname, dan Kasbon Subkon.</p>
        </div>
        {activeTab === 'master' && can('SUBCON_CREATE') && (
          <button onClick={() => setIsSubconModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Users size={18} /> Tambah Vendor
          </button>
        )}
        {activeTab === 'spk' && can('SUBCON_CREATE') && (
          <button onClick={() => { setEditingSPK(null); setIsSPKModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Plus size={18} /> Buat SPK
          </button>
        )}
      </div>

      <div className="border-b border-slate-200 mt-6">
        <nav className="flex gap-6 -mb-px">
          <button onClick={() => setActiveTab('master')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'master' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
            <Users size={18} /> Master Vendor Subkon
          </button>
          <button onClick={() => setActiveTab('spk')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'spk' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
            <FileText size={18} /> Daftar SPK & Pembayaran
          </button>
        </nav>
      </div>

      {loading ? (
        <div className="text-center p-12 text-slate-500">Memuat data...</div>
      ) : (
        <div className="bg-white border rounded-xl shadow-sm overflow-x-auto">
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
                        <button onClick={() => { setSelectedSPK(spk); setIsPayModalOpen(true); }} className="text-blue-600 hover:underline text-sm font-medium inline-flex items-center gap-1">
                          <CheckCircle size={14} /> Bayar
                        </button>
                      )}
                      <button onClick={() => { setSelectedSPK(spk); setIsHistoryModalOpen(true); }} className="text-slate-500 hover:text-slate-800 text-xs font-medium">
                        History
                      </button>
                      <button onClick={() => { setSelectedSPK(spk); setIsBAOPOpen(true); }} className="text-amber-600 hover:text-amber-800 text-xs font-medium">
                        Cetak BAOP
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
        </div>
      )}

      <SubcontractorModal isOpen={isSubconModalOpen} onClose={() => setIsSubconModalOpen(false)} projectId={projectId} onSuccess={loadData} showToast={showToast} />
      
      <SPKModal 
        isOpen={isSPKModalOpen} 
        onClose={() => { setIsSPKModalOpen(false); setEditingSPK(null); }} 
        projectId={projectId} 
        subcontractors={subcons} 
        onSuccess={loadData} 
        showToast={showToast} 
        editingSPK={editingSPK} 
      />
      
      <PaySubconModal isOpen={isPayModalOpen} onClose={() => setIsPayModalOpen(false)} spk={selectedSPK} onSuccess={loadData} showToast={showToast} />
      
      <HistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} contractId={selectedSPK?.id || null} />
      
      <AddendumModal isOpen={isAddendumModalOpen} onClose={() => setIsAddendumModalOpen(false)} spk={selectedSPK} onSuccess={loadData} showToast={showToast} />
      
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={deleteTarget?.type === 'vendor' ? 'Hapus Vendor Subkon' : 'Batalkan SPK'}
        message={deleteTarget?.type === 'vendor' ? 'Apakah Anda yakin ingin menghapus vendor ini?' : 'Apakah Anda yakin ingin membatalkan SPK ini?'}
        isLoading={isDeleting}
      />

      {isBAOPOpen && selectedSPK && (
        <BAOPView 
          projectId={projectId} 
          spks={spks} 
          onClose={() => setIsBAOPOpen(false)} 
          showToast={showToast} 
        />
      )}
    </div>
  );
}