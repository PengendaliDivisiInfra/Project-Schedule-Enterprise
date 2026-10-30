'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import AhspTemplateModal from '../../components/AhspTemplateModal';
import AssignmentModal from '../../components/AssignmentModal';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AHSPPage() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [details, setDetails] = useState([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [overhead, setOverhead] = useState(15);
  const [projectId, setProjectId] = useState(null);

  const fetchTemplates = async () => {
    try {
      let { data: projects } = await supabase.from('projects').select('id').limit(1);
      setProjectId(projects?.[0]?.id || null);

      const { data, error } = await supabase.from('ahsp_templates').select('*');
      if (error) throw error;
      
      setTemplates(data || []);
      if (selectedTemplate) {
        const updated = data.find(t => t.id === selectedTemplate.id);
        if (updated) setSelectedTemplate(updated);
      } else if (data?.length > 0) {
        setSelectedTemplate(data[0]);
      }
    } catch (err) { console.error(err); }
  };

  const fetchDetails = async (templateId) => {
    const { data } = await supabase.from('ahsp_details')
      .select(`id, koefisien, master_hsd(*)`)
      .eq('ahsp_template_id', templateId);
    setDetails(data || []);
  };

  useEffect(() => { fetchTemplates(); }, []);
  useEffect(() => {
    if (selectedTemplate) {
      fetchDetails(selectedTemplate.id);
      setOverhead(selectedTemplate.overhead_percent || 15);
    }
  }, [selectedTemplate]);

  const handleSaveTemplate = async (formData, isEdit) => {
    let error;
    if (isEdit && selectedTemplate) {
      // Mode Edit: Update berdasarkan ID dari selectedTemplate
      const res = await supabase.from('ahsp_templates').update(formData).eq('id', selectedTemplate.id);
      error = res.error;
    } else {
      // Mode Tambah: Insert data baru
      const res = await supabase.from('ahsp_templates').insert([{ ...formData, project_id: projectId }]);
      error = res.error;
    }

    if (error) { alert('Gagal: ' + error.message); throw error; }
    else { 
      setIsTemplateModalOpen(false); 
      setIsEditMode(false); 
      fetchTemplates(); 
    }
  };

  const handleDeleteComponent = async (detailId) => {
    if (!confirm('Hapus komponen ini dari AHSP?')) return;
    const { error } = await supabase.from('ahsp_details').delete().eq('id', detailId);
    if (error) alert(error.message);
    else fetchDetails(selectedTemplate.id);
  };

  const handleUpdateOverhead = async (val) => {
    setOverhead(val);
    if (selectedTemplate) {
      await supabase.from('ahsp_templates').update({ overhead_percent: val }).eq('id', selectedTemplate.id);
    }
  };

  const upah = details.filter(d => d.master_hsd?.resource_type?.toLowerCase() === 'upah');
  const bahan = details.filter(d => d.master_hsd?.resource_type?.toLowerCase() === 'bahan');
  const alat = details.filter(d => d.master_hsd?.resource_type?.toLowerCase() === 'alat');

  const calcTotal = (items) => items.reduce((sum, item) => sum + (item.koefisien * (item.master_hsd?.base_price || 0)), 0);
  const totalA = calcTotal(upah);
  const totalB = calcTotal(bahan);
  const totalC = calcTotal(alat);
  const totalD = totalA + totalB + totalC;
  const totalE = totalD * (overhead / 100);
  const totalF = totalD + totalE;

  const renderRow = (item, index) => {
    const hargaSatuan = item.master_hsd?.base_price || 0;
    const jumlahHarga = item.koefisien * hargaSatuan;
    return (
      <tr key={item.id || index} className="border-b hover:bg-gray-50 group">
        <td className="p-2 text-center text-sm">{index + 1}</td>
        <td className="p-2 text-sm">{item.master_hsd?.item_name}</td>
        <td className="p-2 text-sm text-center">{item.master_hsd?.kode || '-'}</td>
        <td className="p-2 text-sm text-center">{item.master_hsd?.unit}</td>
        <td className="p-2 text-sm text-center">{item.koefisien}</td>
        <td className="p-2 text-sm text-right">Rp {hargaSatuan.toLocaleString('id-ID')}</td>
        <td className="p-2 text-sm text-right font-medium">Rp {jumlahHarga.toLocaleString('id-ID')}</td>
        <td className="p-2 text-center">
          <button onClick={() => handleDeleteComponent(item.id)} className="text-red-500 opacity-0 group-hover:opacity-100 transition text-xs font-bold">Hapus</button>
        </td>
      </tr>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Katalog AHSP (Standar PUPR)</h1>
        <button onClick={() => { setSelectedTemplate(null); setIsEditMode(false); setIsTemplateModalOpen(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ Buat AHSP Baru</button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-fit">
          <h2 className="font-bold mb-3 border-b pb-2">Daftar Katalog AHSP</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {templates.map(t => (
              <button key={t.id} onClick={() => setSelectedTemplate(t)} className={`w-full text-left p-3 rounded-lg border transition ${selectedTemplate?.id === t.id ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`}>
                <div className="text-sm font-bold text-gray-800">{t.name}</div>
                <div className="text-xs text-gray-500 mt-1">Satuan: {t.unit}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {!selectedTemplate ? (
            <div className="text-center text-gray-500 py-20">Pilih atau buat Katalog AHSP baru.</div>
          ) : (
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold">{selectedTemplate.name}</h2>
                    <button onClick={() => { setIsEditMode(true); setIsTemplateModalOpen(true); }} className="text-xs bg-gray-200 text-gray-700 hover:bg-gray-300 px-2 py-1 rounded border border-gray-300 transition">
                      ✏️ Edit Nama/Satuan
                    </button>
                  </div>
                  <p className="text-sm text-gray-500">Satuan: {selectedTemplate.unit}</p>
                </div>
                <button onClick={() => setIsDetailModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ Tambah Komponen</button>
              </div>

              <table className="w-full border-collapse border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 p-2 text-sm w-10">No</th>
                    <th className="border border-gray-300 p-2 text-sm">Uraian</th>
                    <th className="border border-gray-300 p-2 text-sm w-20">Kode</th>
                    <th className="border border-gray-300 p-2 text-sm w-16">Satuan</th>
                    <th className="border border-gray-300 p-2 text-sm w-20">Koefisien</th>
                    <th className="border border-gray-300 p-2 text-sm w-32">Harga Satuan</th>
                    <th className="border border-gray-300 p-2 text-sm w-32">Jumlah Harga</th>
                    <th className="border border-gray-300 p-2 text-sm w-16">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-gray-50 font-bold"><td className="border border-gray-300 p-2 text-sm" colSpan={8}>A. Tenaga Kerja</td></tr>
                  {upah.map((item, i) => renderRow(item, i))}
                  <tr className="bg-gray-50 font-semibold"><td className="border border-gray-300 p-2 text-sm text-right" colSpan={6}>Jumlah Harga Tenaga Kerja (A)</td><td className="border border-gray-300 p-2 text-sm text-right" colSpan={2}>Rp {totalA.toLocaleString('id-ID')}</td></tr>

                  <tr className="bg-gray-50 font-bold"><td className="border border-gray-300 p-2 text-sm" colSpan={8}>B. Bahan</td></tr>
                  {bahan.map((item, i) => renderRow(item, i))}
                  <tr className="bg-gray-50 font-semibold"><td className="border border-gray-300 p-2 text-sm text-right" colSpan={6}>Jumlah Harga Bahan (B)</td><td className="border border-gray-300 p-2 text-sm text-right" colSpan={2}>Rp {totalB.toLocaleString('id-ID')}</td></tr>

                  <tr className="bg-gray-50 font-bold"><td className="border border-gray-300 p-2 text-sm" colSpan={8}>C. Peralatan</td></tr>
                  {alat.map((item, i) => renderRow(item, i))}
                  <tr className="bg-gray-50 font-semibold"><td className="border border-gray-300 p-2 text-sm text-right" colSpan={6}>Jumlah Harga Peralatan (C)</td><td className="border border-gray-300 p-2 text-sm text-right" colSpan={2}>Rp {totalC.toLocaleString('id-ID')}</td></tr>

                  <tr className="font-semibold"><td className="border border-gray-300 p-2 text-sm" colSpan={6}>D. Jumlah Harga (A+B+C)</td><td className="border border-gray-300 p-2 text-sm text-right" colSpan={2}>Rp {totalD.toLocaleString('id-ID')}</td></tr>
                  <tr className="font-semibold">
                    <td className="border border-gray-300 p-2 text-sm" colSpan={5}>E. Overhead + Profit</td>
                    <td className="border border-gray-300 p-2 text-sm text-right flex items-center justify-end gap-1">
                      <input type="number" value={overhead} onChange={(e) => handleUpdateOverhead(e.target.value)} className="w-16 border rounded p-1 text-right text-xs" /> %
                    </td>
                    <td className="border border-gray-300 p-2 text-sm text-right" colSpan={2}>Rp {totalE.toLocaleString('id-ID')}</td>
                  </tr>
                  <tr className="bg-blue-50 font-bold text-blue-900"><td className="border border-gray-300 p-2 text-sm" colSpan={6}>F. Harga Satuan Pekerjaan (D+E)</td><td className="border border-gray-300 p-2 text-sm text-right" colSpan={2}>Rp {totalF.toLocaleString('id-ID')}</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AhspTemplateModal 
        isOpen={isTemplateModalOpen} 
        onClose={() => { setIsTemplateModalOpen(false); setIsEditMode(false); }} 
        onSave={(formData) => handleSaveTemplate(formData, isEditMode)} 
        initialData={isEditMode ? selectedTemplate : null} 
      />
      <AssignmentModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} ahspTemplate={selectedTemplate} onSaveSuccess={() => fetchDetails(selectedTemplate?.id)} />
    </div>
  );
}
