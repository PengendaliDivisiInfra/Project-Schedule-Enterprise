'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ProjectsPage() {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProject = async () => {
    setLoading(true);
    const { data } = await supabase.from('projects').select('*').limit(1).maybeSingle();
    if (data) setProject(data);
    else setProject({ name: '', contract_number: '', contract_value: 0, contract_start: '', contract_end: '', location: '', fiscal_year: '', ppk_name: '', contractor_name: '', consultant_name: '' });
    setLoading(false);
  };

  useEffect(() => { fetchProject(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (project.id) {
        const { error } = await supabase.from('projects').update({
          name: project.name,
          contract_number: project.contract_number,
          contract_value: project.contract_value,
          contract_start: project.contract_start,
          contract_end: project.contract_end,
          location: project.location,
          fiscal_year: project.fiscal_year,
          ppk_name: project.ppk_name,
          contractor_name: project.contractor_name,
          consultant_name: project.consultant_name
        }).eq('id', project.id);
        if (error) throw error;
      }
      } catch (err) {
      alert('Gagal menyimpan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner text="Memuat data proyek..." />;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Database Proyek (Standar PUPR)</h1>
        <p className="text-sm text-gray-500">Isi data ini agar seluruh kalkulasi bobot, laporan, dan kurva-S berjalan otomatis.</p>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nama Paket Proyek</label>
            <input type="text" required value={project?.name || ''} onChange={e => setProject({...project, name: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="Cth: Pembangunan Gedung Kantor" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nomor Kontrak</label>
              <input type="text" value={project?.contract_number || ''} onChange={e => setProject({...project, contract_number: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="Cth: HK.02.03/XXX/2026" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nilai Kontrak (Rp)</label>
              <input type="number" required value={project?.contract_value || 0} onChange={e => setProject({...project, contract_value: Number(e.target.value)})} className="w-full border rounded-lg p-2 text-sm font-bold text-indigo-700" placeholder="Cth: 92000000" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tanggal Mulai Kontrak</label>
              <input type="date" required value={project?.contract_start || ''} onChange={e => setProject({...project, contract_start: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tanggal Selesai Kontrak</label>
              <input type="date" required value={project?.contract_end || ''} onChange={e => setProject({...project, contract_end: e.target.value})} className="w-full border rounded-lg p-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Lokasi Proyek</label>
              <input type="text" value={project?.location || ''} onChange={e => setProject({...project, location: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="Cth: Surabaya" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tahun Anggaran</label>
              <input type="text" value={project?.fiscal_year || ''} onChange={e => setProject({...project, fiscal_year: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="Cth: 2026" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nama PPK</label>
              <input type="text" value={project?.ppk_name || ''} onChange={e => setProject({...project, ppk_name: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="Nama PPK" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Kontraktor Pelaksana</label>
              <input type="text" value={project?.contractor_name || ''} onChange={e => setProject({...project, contractor_name: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="PT. SAKA GRAHA INDONESIA" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Konsultan Pengawas</label>
              <input type="text" value={project?.consultant_name || ''} onChange={e => setProject({...project, consultant_name: e.target.value})} className="w-full border rounded-lg p-2 text-sm" placeholder="PT. ELEMEN TIGA TIGA" />
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Simpan Info Proyek'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

