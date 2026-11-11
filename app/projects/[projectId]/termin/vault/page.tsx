'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRole } from '@/lib/hooks/useRole';
import { getDocuments, getPhotos, softDeleteDocument, softDeletePhoto } from '@/lib/services/vault.service';
import { ProjectDocument, ProjectPhoto } from '@/lib/types/vault';
import { UploadModal } from '@/components/vault/UploadModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { FileText, Image as ImageIcon, Trash2, Plus, ExternalLink, FolderOpen } from 'lucide-react';

export default function VaultPage() {
  const params = useParams();
  const projectId = params?.projectId as string;
  const { can } = useRole();

  const [docs, setDocs] = useState<ProjectDocument[]>([]);
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dokumen');
  
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'doc' | 'photo' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [d, p] = await Promise.all([getDocuments(projectId), getPhotos(projectId)]);
      setDocs(d);
      setPhotos(p);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  if (!can('VAULT_VIEW')) {
    return <div className="p-8 text-center text-red-500 font-bold">Anda tidak memiliki akses ke Vault.</div>;
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'doc') await softDeleteDocument(deleteTarget.id);
      else await softDeletePhoto(deleteTarget.id);
      
      showToast('File berhasil dihapus', 'success');
      loadData();
      setDeleteTarget(null);
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const tabClass = (isActive: boolean) => 
    `flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap rounded-t-xl ${
      isActive 
        ? 'border-blue-600 text-blue-700 bg-blue-50/80 shadow-[inset_0_-2px_0_0_#2563eb]' 
        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
    }`;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-xl shadow-xl text-white font-bold animate-in slide-in-from-top-4 fade-in flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2 tracking-tight"><FolderOpen className="text-indigo-600" /> Document & Photo Vault</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Pusat penyimpanan dokumen legal dan foto progress lapangan.</p>
        </div>
        {can(activeTab === 'dokumen' ? 'VAULT_UPLOAD_DOC' : 'VAULT_UPLOAD_PHOTO') && (
          <button onClick={() => setIsUploadModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold text-sm shadow-md transition-all">
            <Plus size={18} /> Upload File
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200 mt-2 overflow-x-auto pb-px">
        <button onClick={() => setActiveTab('dokumen')} className={tabClass(activeTab === 'dokumen')}>
          <FileText size={18} /> Dokumen Legal
        </button>
        <button onClick={() => setActiveTab('foto')} className={tabClass(activeTab === 'foto')}>
          <ImageIcon size={18} /> Foto Progress
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
          <SkeletonLoader rows={4} cols={3} />
        </div>
      ) : (
        <div className="bg-white border rounded-2xl shadow-sm p-6">
          {activeTab === 'dokumen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {docs.length === 0 ? (
                <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400">
                  <FolderOpen size={48} className="mb-4 opacity-20" />
                  <p className="font-bold text-lg text-slate-600">Belum ada dokumen legal.</p>
                  <p className="text-sm">Klik "Upload File" untuk menambahkan dokumen.</p>
                </div>
              ) : docs.map((doc) => (
                <div key={doc.id} className="border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:shadow-lg hover:border-indigo-300 transition-all group bg-white">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg">{doc.category}</span>
                      {can('VAULT_DELETE') && (
                        <button onClick={() => setDeleteTarget({ id: doc.id, type: 'doc' })} className="text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"><Trash2 size={16} /></button>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm line-clamp-2 leading-snug group-hover:text-indigo-600 transition-colors">{doc.title}</h3>
                    <p className="text-xs text-slate-500 mt-1.5 truncate">{doc.file_name}</p>
                  </div>
                  <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{new Date(doc.created_at).toLocaleDateString('id-ID')}</span>
                    <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs font-bold flex items-center gap-1 hover:underline bg-indigo-50 px-2 py-1 rounded-md">
                      Buka <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'foto' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.length === 0 ? (
                <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400">
                  <ImageIcon size={48} className="mb-4 opacity-20" />
                  <p className="font-bold text-lg text-slate-600">Belum ada foto progress.</p>
                  <p className="text-sm">Klik "Upload File" untuk mengunggah foto.</p>
                </div>
              ) : photos.map((photo) => (
                <div key={photo.id} className="group relative border border-slate-200 rounded-xl overflow-hidden aspect-square bg-slate-100 shadow-sm">
                  <img src={photo.photo_url} alt={photo.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4 text-white">
                    <div>
                      <p className="font-bold text-sm leading-tight line-clamp-2">{photo.title}</p>
                      <p className="text-[10px] text-slate-300 mt-1 uppercase font-bold tracking-wider">{new Date(photo.created_at).toLocaleDateString('id-ID')}</p>
                    </div>
                    <div className="flex justify-end gap-2">
                      {can('VAULT_DELETE') && (
                        <button onClick={() => setDeleteTarget({ id: photo.id, type: 'photo' })} className="p-2 bg-rose-500/80 hover:bg-rose-600 rounded-lg backdrop-blur-sm transition-colors"><Trash2 size={16} /></button>
                      )}
                      <a href={photo.photo_url} target="_blank" rel="noreferrer" className="p-2 bg-indigo-500/80 hover:bg-indigo-600 rounded-lg backdrop-blur-sm transition-colors"><ExternalLink size={16} /></a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <UploadModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} projectId={projectId} type={activeTab === 'dokumen' ? 'document' : 'photo'} onSuccess={loadData} showToast={showToast} />
      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm} title="Hapus File" message="Apakah Anda yakin ingin menghapus file ini? Tindakan ini akan menyembunyikan file dari daftar (Soft Delete)." isLoading={isDeleting} />
    </div>
  );
}