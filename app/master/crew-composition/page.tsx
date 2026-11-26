'use client';

import { useEffect, useState } from 'react';
import { Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { CrewCompositionTable } from '@/components/crew-composition/CrewCompositionTable';
import { CrewCompositionForm } from '@/components/crew-composition/CrewCompositionForm';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  listCrewCompositions,
  createCrewComposition,
  updateCrewComposition,
  deactivateCrewComposition,
} from '@/lib/services/crew-composition-service';
import type { CrewComposition, CrewCompositionInput } from '@/types/resource-plan';

export default function CrewCompositionPage() {
  const [rows, setRows] = useState<CrewComposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CrewComposition | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<CrewComposition | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listCrewCompositions());
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat komposisi tim');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const handleSubmit = async (input: CrewCompositionInput) => {
    try {
      if (editing) {
        await updateCrewComposition(editing.id, input);
        showToast('success', 'Komposisi tim berhasil diperbarui.');
      } else {
        await createCrewComposition(input);
        showToast('success', 'Komposisi tim baru berhasil ditambahkan.');
      }
      setShowForm(false);
      setEditing(null);
      await reload();
    } catch (e: any) {
      showToast('error', e?.message || 'Gagal menyimpan komposisi tim.');
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setIsDeactivating(true);
    try {
      await deactivateCrewComposition(deactivateTarget.id);
      showToast('success', `Komposisi "${deactivateTarget.name}" berhasil dinonaktifkan.`);
      setDeactivateTarget(null);
      await reload();
    } catch (e: any) {
      showToast('error', e?.message || 'Gagal menonaktifkan komposisi tim.');
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <div className="p-6 space-y-4 relative">
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[9999] px-5 py-3 rounded-xl shadow-xl text-white text-sm font-bold flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Master Komposisi Tim</h1>
          <p className="text-sm text-gray-500">Definisikan kapasitas &amp; biaya harian tim.</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700"
        >
          <Plus size={16} /> Tambah Komposisi
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-white border rounded-lg shadow-sm">
          <h2 className="mb-3 font-semibold">
            {editing ? `Edit: ${editing.name}` : 'Tambah Komposisi Baru'}
          </h2>
          <CrewCompositionForm
            initial={editing}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
          />
        </div>
      )}

      {error && <div className="p-3 text-sm text-red-700 bg-red-50 rounded">{error}</div>}

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-500">Memuat...</div>
      ) : (
        <CrewCompositionTable
          rows={rows}
          onEdit={(r) => {
            setEditing(r);
            setShowForm(true);
          }}
          onDeactivate={(r) => setDeactivateTarget(r)}
        />
      )}

      <ConfirmModal
        isOpen={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleConfirmDeactivate}
        title="Nonaktifkan Komposisi Tim"
        message={`Apakah Anda yakin ingin menonaktifkan komposisi tim "${deactivateTarget?.name || ''}"? Data historis jadwal tetap aman.`}
        isLoading={isDeactivating}
      />
    </div>
  );
}