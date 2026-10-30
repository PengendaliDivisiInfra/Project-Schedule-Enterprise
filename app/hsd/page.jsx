'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import LoadingSpinner from '../../components/LoadingSpinner';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function HSDPage() {
  const [hsdList, setHsdList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [projectId, setProjectId] = useState(null);
  
  // State Form
  const [formData, setFormData] = useState({
    id: null, kode: '', resource_type: 'Bahan', item_name: '', unit: '', base_price: 0
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Ambil Project ID
      let { data: projects } = await supabase.from('projects').select('id').limit(1);
      let pid = projects?.[0]?.id;
      if (!pid) {
        let { data: tData } = await supabase.from('master_hsd').select('project_id').limit(1);
        pid = tData?.[0]?.project_id;
      }
      setProjectId(pid);

      // Ambil Master HSD
      const { data: hsd } = await supabase.from('master_hsd').select('*').order('resource_type').order('item_name');
      
      // Ambil Data Penggunaan (Traceability)
      const { data: usages } = await supabase.from('ahsp_details').select(`
        hsd_id, ahsp_templates ( name, wbs_tasks ( wbs_code, name ) )
      `);

      // Gabungkan data penggunaan
      const usageMap = {};
      usages?.forEach(u => {
        if (!u.hsd_id) return;
        if (!usageMap[u.hsd_id]) usageMap[u.hsd_id] = [];
        
        const templateName = u.ahsp_templates?.name;
        if (templateName && !usageMap[u.hsd_id].includes(templateName)) {
          usageMap[u.hsd_id].push(templateName);
        }
      });

      const combined = (hsd || []).map(item => ({
        ...item,
        used_in: usageMap[item.id] || []
      }));

      setHsdList(combined);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        const { error } = await supabase.from('master_hsd').update({
          kode: formData.kode, resource_type: formData.resource_type,
          item_name: formData.item_name, unit: formData.unit, base_price: formData.base_price
        }).eq('id', formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('master_hsd').insert([{
          project_id: projectId, kode: formData.kode, resource_type: formData.resource_type,
          item_name: formData.item_name, unit: formData.unit, base_price: formData.base_price
        }]);
        if (error) throw error;
      }
      
      setIsAdding(false);
      setIsEditing(false);
      setFormData({ id: null, kode: '', resource_type: 'Bahan', item_name: '', unit: '', base_price: 0 });
      fetchData();
    } catch (err) {
      alert('Gagal menyimpan: ' + err.message);
    }
  };

  const handleEdit = (item) => {
    setFormData(item);
    setIsEditing(true);
    setIsAdding(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus HSD ini? Data di AHSP yang menggunakan HSD ini mungkin akan error.')) return;
    await supabase.from('master_hsd').delete().eq('id', id);
    fetchData();
  };

  const getTypeColor = (type) => {
    const t = type?.toLowerCase();
    if (t === 'upah' || t === 'work') return 'bg-green-100 text-green-700';
    if (t === 'bahan' || t === 'material') return 'bg-blue-100 text-blue-700';
    return 'bg-orange-100 text-orange-700';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Harga Satuan Dasar (HSD)</h1>
          <p className="text-sm text-gray-500 mt-1">Database induk Material, Upah, dan Alat. Perubahan harga di sini akan mempengaruhi seluruh AHSP dan Task.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fetchData()} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 transition">
            🔄 Refresh
          </button>
          <button onClick={() => { setFormData({ id: null, kode: '', resource_type: 'Bahan', item_name: '', unit: '', base_price: 0 }); setIsEditing(false); setIsAdding(!isAdding); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition shadow-sm">
            {isAdding && !isEditing ? 'Batal' : '+ Tambah HSD Baru'}
          </button>
        </div>
      </div>

      {/* Form Tambah/Edit */}
      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-sm border mb-6">
          <h3 className="font-bold mb-4">{isEditing ? 'Edit HSD' : 'Tambah HSD Baru'}</h3>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium mb-1">Kode (Opsional)</label>
              <input type="text" value={formData.kode} onChange={e => setFormData({...formData, kode: e.target.value})} className="w-full border rounded p-2 text-sm" placeholder="M.01" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Tipe</label>
              <select value={formData.resource_type} onChange={e => setFormData({...formData, resource_type: e.target.value})} className="w-full border rounded p-2 text-sm">
                <option value="Bahan">Bahan / Material</option>
                <option value="Upah">Tenaga Kerja / Upah</option>
                <option value="Alat">Peralatan / Alat</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1">Nama Item</label>
              <input type="text" required value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value})} className="w-full border rounded p-2 text-sm" placeholder="Semen Portland" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Satuan</label>
              <input type="text" required value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full border rounded p-2 text-sm" placeholder="Zak / OH" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Harga Dasar (Rp)</label>
              <input type="number" required value={formData.base_price} onChange={e => setFormData({...formData, base_price: e.target.value})} className="w-full border rounded p-2 text-sm" />
            </div>
            <div className="md:col-span-4 flex justify-end mt-2">
              <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700">
                {isEditing ? 'Simpan Perubahan' : 'Tambahkan ke Master'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabel HSD */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        {loading ? <LoadingSpinner text="Memuat Data HSD..." /> : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b text-sm font-semibold text-gray-600">
              <tr>
                <th className="p-4 w-24">Tipe</th>
                <th className="p-4 w-24">Kode</th>
                <th className="p-4">Nama Item</th>
                <th className="p-4 w-24">Satuan</th>
                <th className="p-4 text-right">Harga Dasar</th>
                <th className="p-4 w-1/3">Digunakan Pada (AHSP)</th>
                <th className="p-4 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {hsdList.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getTypeColor(r.resource_type)}`}>
                      {r.resource_type}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-xs">{r.kode || '-'}</td>
                  <td className="p-4 font-medium">{r.item_name}</td>
                  <td className="p-4 text-gray-600">{r.unit}</td>
                  <td className="p-4 text-right font-bold text-gray-800">Rp {r.base_price?.toLocaleString('id-ID')}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {r.used_in.length > 0 ? r.used_in.map((ahsp, idx) => (
                        <span key={idx} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded border">
                          {ahsp}
                        </span>
                      )) : (
                        <span className="text-xs text-gray-400 italic">Belum digunakan</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 flex justify-center gap-2">
                    <button onClick={() => handleEdit(r)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:underline text-xs">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {hsdList.length === 0 && !loading && (
          <div className="p-10 text-center text-gray-500">
            Database HSD masih kosong. Silakan klik &quot;+ Tambah HSD Baru&quot; untuk memasukkan data material/upah.
          </div>
        )}
      </div>
    </div>
  );
}
