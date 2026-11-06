'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useRole } from '@/lib/hooks/useRole';
import { getDocuments, getPhotos, softDeleteDocument, softDeletePhoto } from '@/lib/services/vault.service';
import { ProjectDocument, ProjectPhoto } from '@/lib/types/vault';
import { UploadModal } from '@/components/vault/UploadModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { FileText, Image as ImageIcon, Trash2, Plus, ExternalLink } from 'lucide-react';

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

  // State untuk Custom Confirm Modal
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
    return <div className="p-8 text-center text-red-500">Anda tidak memiliki akses ke Vault.</div>;
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded shadow-lg text-white font-medium z-[100] ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Document & Photo Vault</h1>
          <p className="text-slate-500 text-sm">Pusat penyimpanan dokumen legal dan foto progress lapangan.</p>
        </div>
        {can(activeTab === 'dokumen' ? 'VAULT_UPLOAD_DOC' : 'VAULT_UPLOAD_PHOTO') && (
          <button onClick={() => setIsUploadModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Plus size={18} /> Upload File
          </button>
        )}
      </div>

      <div className="border-b border-slate-200 mt-6">
        <nav className="flex gap-6 -mb-px">
          <button onClick={() => setActiveTab('dokumen')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'dokumen' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
            <FileText size={18} /> Dokumen Legal
          </button>
          <button onClick={() => setActiveTab('foto')} className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'foto' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
            <ImageIcon size={18} /> Foto Progress
          </button>
        </nav>
      </div>

      {loading ? (
        <div className="text-center p-12 text-slate-500">Memuat data...</div>
      ) : (
        <div className="bg-white border rounded-xl shadow-sm p-6">
          {activeTab === 'dokumen' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {docs.map((doc) => (
                <div key={doc.id} className="border rounded-lg p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded text-slate-600">{doc.category}</span>
                      {can('VAULT_DELETE') && (
                        <button onClick={() => setDeleteTarget({ id: doc.id, type: 'doc' })} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm line-clamp-2">{doc.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{doc.file_name}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t flex justify-between items-center">
                    <span className="text-xs text-slate-400">{new Date(doc.created_at).toLocaleDateString('id-ID')}</span>
                    <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm flex items-center gap-1 hover:underline">
                      Buka <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              ))}
              {docs.length === 0 && <div className="col-span-full text-center py-8 text-slate-500">Belum ada dokumen.</div>}
            </div>
          )}

          {activeTab === 'foto' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative border rounded-lg overflow-hidden aspect-square bg-slate-100">
                  <img src={photo.photo_url} alt={photo.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3 text-white">
                    <div>
                      <p className="font-bold text-sm">{photo.title}</p>
                      <p className="text-xs text-slate-300 mt-1">{new Date(photo.created_at).toLocaleDateString('id-ID')}</p>
                    </div>
                    <div className="flex justify-end gap-2">
                      {can('VAULT_DELETE') && (
                        <button onClick={() => setDeleteTarget({ id: photo.id, type: 'photo' })} className="p-2 bg-red-500/80 rounded hover:bg-red-600"><Trash2 size={16} /></button>
                      )}
                      <a href={photo.photo_url} target="_blank" rel="noreferrer" className="p-2 bg-blue-500/80 rounded hover:bg-blue-600"><ExternalLink size={16} /></a>
                    </div>
                  </div>
                </div>
              ))}
              {photos.length === 0 && <div className="col-span-full text-center py-8 text-slate-500">Belum ada foto progress.</div>}
            </div>
          )}
        </div>
      )}

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        projectId={projectId}
        type={activeTab === 'dokumen' ? 'document' : 'photo'}
        onSuccess={loadData}
        showToast={showToast}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Hapus File"
        message="Apakah Anda yakin ingin menghapus file ini? Tindakan ini akan menyembunyikan file dari daftar (Soft Delete)."
        isLoading={isDeleting}
      />
    </div>
  );
}