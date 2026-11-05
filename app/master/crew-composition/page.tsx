"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { CrewCompositionTable } from "@/components/crew-composition/CrewCompositionTable";
import { CrewCompositionForm } from "@/components/crew-composition/CrewCompositionForm";
import { listCrewCompositions, createCrewComposition, updateCrewComposition, deactivateCrewComposition } from "@/lib/services/crew-composition-service";
import type { CrewComposition, CrewCompositionInput } from "@/types/resource-plan";

export default function CrewCompositionPage() {
  const [rows, setRows] = useState<CrewComposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CrewComposition | null>(null);
  const [showForm, setShowForm] = useState(false);

  const reload = async () => {
    setLoading(true); setError(null);
    try { setRows(await listCrewCompositions()); } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, []);

  const handleSubmit = async (input: CrewCompositionInput) => {
    if (editing) await updateCrewComposition(editing.id, input); else await createCrewComposition(input);
    setShowForm(false); setEditing(null); await reload();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Master Komposisi Tim</h1><p className="text-sm text-gray-500">Definisikan kapasitas & biaya harian tim.</p></div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700"><Plus size={16}/> Tambah Komposisi</button>
      </div>
      {showForm && <div className="p-4 bg-white border rounded-lg shadow-sm"><h2 className="mb-3 font-semibold">{editing ? `Edit: ${editing.name}` : "Tambah Komposisi Baru"}</h2><CrewCompositionForm initial={editing} onSubmit={handleSubmit} onCancel={() => { setShowForm(false); setEditing(null); }} /></div>}
      {error && <div className="p-3 text-sm text-red-700 bg-red-50 rounded">{error}</div>}
      {loading ? <div className="p-8 text-center text-sm text-gray-500">Memuat...</div> : <CrewCompositionTable rows={rows} onEdit={(r) => { setEditing(r); setShowForm(true); }} onDeactivate={async (r) => { if(confirm("Nonaktifkan?")) { await deactivateCrewComposition(r.id); await reload(); } }} />}
    </div>
  );
}