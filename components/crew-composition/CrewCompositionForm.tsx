"use client";
import { useState } from "react";
import type { CrewComposition, CrewCompositionInput } from "@/types/resource-plan";

const EMPTY: CrewCompositionInput = { project_id: null, code: "", name: "", mandor_count: 1, tukang_count: 2, pekerja_count: 4, capacity_per_day: 10, unit: "unit", daily_cost: 0, notes: null, is_active: true };

export function CrewCompositionForm({ initial, onSubmit, onCancel }: { initial?: CrewComposition | null, onSubmit: (i: CrewCompositionInput) => Promise<void>, onCancel: () => void }) {
  const [form, setForm] = useState<CrewCompositionInput>(initial ? { ...initial } : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (k: keyof CrewCompositionInput, v: any) => setForm(f => ({ ...f, [k]: v }));
  const num = (v: string) => v === "" ? 0 : Number(v);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!form.code.trim() || !form.name.trim()) return setError("Kode dan Nama wajib diisi.");
    setSaving(true);
    try { await onSubmit(form); } catch (err: any) { setError(err.message); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-2 text-sm text-red-700 bg-red-50 rounded">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm"><span className="block mb-1 font-medium">Kode *</span><input value={form.code} onChange={e => update("code", e.target.value)} className="w-full px-2 py-1.5 border rounded" /></label>
        <label className="text-sm"><span className="block mb-1 font-medium">Nama Tim *</span><input value={form.name} onChange={e => update("name", e.target.value)} className="w-full px-2 py-1.5 border rounded" /></label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="text-sm"><span className="block mb-1 font-medium">Mandor</span><input type="number" value={form.mandor_count} onChange={e => update("mandor_count", num(e.target.value))} className="w-full px-2 py-1.5 border rounded" /></label>
        <label className="text-sm"><span className="block mb-1 font-medium">Tukang</span><input type="number" value={form.tukang_count} onChange={e => update("tukang_count", num(e.target.value))} className="w-full px-2 py-1.5 border rounded" /></label>
        <label className="text-sm"><span className="block mb-1 font-medium">Pekerja</span><input type="number" value={form.pekerja_count} onChange={e => update("pekerja_count", num(e.target.value))} className="w-full px-2 py-1.5 border rounded" /></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm"><span className="block mb-1 font-medium">Kapasitas/Hari *</span><input type="number" value={form.capacity_per_day} onChange={e => update("capacity_per_day", num(e.target.value))} className="w-full px-2 py-1.5 border rounded" /></label>
        <label className="text-sm"><span className="block mb-1 font-medium">Satuan</span><input value={form.unit} onChange={e => update("unit", e.target.value)} className="w-full px-2 py-1.5 border rounded" /></label>
      </div>
      <label className="block text-sm"><span className="block mb-1 font-medium">Biaya Harian Tim (Rp)</span><input type="number" value={form.daily_cost} onChange={e => update("daily_cost", num(e.target.value))} className="w-full px-2 py-1.5 border rounded font-semibold text-emerald-700" /></label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Batal</button>
        <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm font-semibold text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan"}</button>
      </div>
    </form>
  );
}