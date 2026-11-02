'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Building2, Save, Calendar } from 'lucide-react';

export default function ProjectsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    contract_number: '',
    contract_value: '',
    contract_start: '', // Menggunakan nama kolom database yang benar
    contract_end: '',   // Menggunakan nama kolom database yang benar
    location: '',
    fiscal_year: '',
    ppk_name: '',
    contractor_name: '',
    consultant_name: ''
  });

  useEffect(() => {
    fetchProject();
  }, []);

  const fetchProject = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('projects').select('*').limit(1).maybeSingle();
    if (data) {
      setFormData({
        ...data,
        contract_start: data.contract_start || '',
        contract_end: data.contract_end || ''
      });
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from('projects')
      .update({
        name: formData.name,
        contract_number: formData.contract_number,
        contract_value: Number(formData.contract_value),
        contract_start: formData.contract_start || null,
        contract_end: formData.contract_end || null,
        location: formData.location,
        fiscal_year: formData.fiscal_year,
        ppk_name: formData.ppk_name,
        contractor_name: formData.contractor_name,
        consultant_name: formData.consultant_name
      })
      .eq('id', formData.id);

    setSaving(false);

    if (error) {
      alert("Gagal menyimpan data: " + error.message);
    } else {
      alert("Jadwal Kontrak Berhasil Diperbarui! Seluruh Task di Gantt Chart telah digeser otomatis.");
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Memuat data proyek...</div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="text-indigo-600" /> Database Proyek (Standar PUPR)
          </h1>
          <p className="text-sm text-slate-500 mt-1">Isi data ini agar seluruh kalkulasi beban kerja berjalan otomatis.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <form onSubmit={handleSave} className="space-y-5">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nama Paket Proyek</label>
                <input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nomor Kontrak</label>
                <input type="text" name="contract_number" value={formData.contract_number || ''} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nilai Kontrak (Rp)</label>
                <input type="number" name="contract_value" value={formData.contract_value || ''} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Lokasi Proyek</label>
                <input type="text" name="location" value={formData.location || ''} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
            </div>

            {/* INPUT TANGGAL KONTRAK */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
              <div>
                <label className="block text-xs font-bold text-indigo-700 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> Tanggal Mulai Kontrak</label>
                <input type="date" name="contract_start" value={formData.contract_start || ''} onChange={handleChange} className="w-full p-2 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm font-bold bg-white" required />
                <p className="text-[10px] text-indigo-500 mt-1">Mengubah tanggal ini akan menggeser seluruh jadwal Task.</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-indigo-700 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> Tanggal Selesai Kontrak</label>
                <input type="date" name="contract_end" value={formData.contract_end || ''} onChange={handleChange} className="w-full p-2 border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm font-bold bg-white" required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tahun Anggaran</label>
                <input type="text" name="fiscal_year" value={formData.fiscal_year || ''} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nama PPK</label>
                <input type="text" name="ppk_name" value={formData.ppk_name || ''} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Konsultan Pengawas</label>
                <input type="text" name="consultant_name" value={formData.consultant_name || ''} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Kontraktor Pelaksana</label>
              <input type="text" name="contractor_name" value={formData.contractor_name || ''} onChange={handleChange} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 text-sm" />
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Info Proyek'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}