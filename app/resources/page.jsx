'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ResourcesPage() {
  const [activeTab, setActiveTab] = useState('sheet');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Resource Management</h1>
        <p className="text-sm text-gray-500 mt-1">Kelola Master Data Sumber Daya dan lihat agregasi kebutuhan (BoQ).</p>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        <button 
          onClick={() => setActiveTab('sheet')} 
          className={`px-6 py-3 text-sm font-medium border-b-2 transition ${activeTab === 'sheet' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          📋 Resource Sheet (Master)
        </button>
        <button 
          onClick={() => setActiveTab('usage')} 
          className={`px-6 py-3 text-sm font-medium border-b-2 transition ${activeTab === 'usage' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          📊 Resource Usage (BoQ)
        </button>
      </div>

      {activeTab === 'sheet' ? <ResourceSheet /> : <ResourceUsage />}
    </div>
  );
}

// ==========================================
// KOMPONEN 1: RESOURCE SHEET (CRUD MASTER)
// ==========================================
function ResourceSheet() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [projectId, setProjectId] = useState(null);
  
  const [formData, setFormData] = useState({
    resource_type: 'WORK', item_name: '', unit: '', base_price: 0, max_units: 1, cost_per_use: 0, accrue_at: 'Prorated'
  });

  const fetchResources = async () => {
    setLoading(true);
    let { data: projects } = await supabase.from('projects').select('id').limit(1);
    let pid = projects?.[0]?.id;
    if (!pid) {
      let { data: tData } = await supabase.from('master_hsd').select('project_id').limit(1);
      pid = tData?.[0]?.project_id;
    }
    setProjectId(pid);

    const { data } = await supabase.from('master_hsd').select('*').order('resource_type');
    setResources(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchResources(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      project_id: projectId,
      resource_type: formData.resource_type === 'WORK' ? 'Upah' : formData.resource_type === 'MATERIAL' ? 'Bahan' : 'Alat'
    };

    const { error } = await supabase.from('master_hsd').insert([payload]);
    if (error) alert(error.message);
    else {
      setIsAdding(false);
      setFormData({ resource_type: 'WORK', item_name: '', unit: '', base_price: 0, max_units: 1, cost_per_use: 0, accrue_at: 'Prorated' });
      fetchResources();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus resource ini dari Master?')) return;
    await supabase.from('master_hsd').delete().eq('id', id);
    fetchResources();
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setIsAdding(!isAdding)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          {isAdding ? 'Batal' : '+ Tambah Resource Baru'}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-sm border mb-6">
          <h3 className="font-bold mb-4">Tambah Master Resource</h3>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium mb-1">Tipe Dasar</label>
              <select value={formData.resource_type} onChange={e => setFormData({...formData, resource_type: e.target.value})} className="w-full border rounded p-2 text-sm">
                <option value="WORK">Work (Tenaga/Alat)</option>
                <option value="MATERIAL">Material (Bahan)</option>
                <option value="COST">Cost (Biaya Langsung)</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1">Nama Resource</label>
              <input type="text" required value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value})} className="w-full border rounded p-2 text-sm" placeholder="Contoh: Semen Portland / Mandor" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Satuan</label>
              <input type="text" required value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full border rounded p-2 text-sm" placeholder="Zak / OH / Hari" />
            </div>
            
            <div>
              <label className="block text-xs font-medium mb-1">Tarif Standar / Harga Dasar (Rp)</label>
              <input type="number" required value={formData.base_price} onChange={e => setFormData({...formData, base_price: e.target.value})} className="w-full border rounded p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Max Units (Kapasitas)</label>
              <input type="number" step="0.01" required value={formData.max_units} onChange={e => setFormData({...formData, max_units: e.target.value})} className="w-full border rounded p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Cost Per Use (Rp)</label>
              <input type="number" value={formData.cost_per_use} onChange={e => setFormData({...formData, cost_per_use: e.target.value})} className="w-full border rounded p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Accrue At</label>
              <select value={formData.accrue_at} onChange={e => setFormData({...formData, accrue_at: e.target.value})} className="w-full border rounded p-2 text-sm">
                <option value="Start">Start</option>
                <option value="Prorated">Prorated</option>
                <option value="End">End</option>
              </select>
            </div>
            <div className="md:col-span-4 flex justify-end mt-2">
              <button type="submit" className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700">Simpan ke Master</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        {loading ? <LoadingSpinner text="Memuat Master Resource..." /> : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b text-sm font-semibold text-gray-600">
              <tr>
                <th className="p-4">Tipe</th>
                <th className="p-4">Nama Resource</th>
                <th className="p-4">Satuan</th>
                <th className="p-4 text-right">Harga Dasar (D)</th>
                <th className="p-4 text-center">Max Units</th>
                <th className="p-4 text-center">Cost Per Use</th>
                <th className="p-4 text-center">Accrue At</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {resources.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="p-4 capitalize font-medium text-xs">
                    <span className={`px-2 py-1 rounded-full ${
                      r.resource_type?.toLowerCase() === 'upah' ? 'bg-green-100 text-green-700' : 
                      r.resource_type?.toLowerCase() === 'bahan' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {r.resource_type}
                    </span>
                  </td>
                  <td className="p-4 font-medium">{r.item_name}</td>
                  <td className="p-4">{r.unit}</td>
                  <td className="p-4 text-right">Rp {r.base_price?.toLocaleString('id-ID')}</td>
                  <td className="p-4 text-center">{r.max_units || 1}</td>
                  <td className="p-4 text-center">Rp {(r.cost_per_use || 0).toLocaleString('id-ID')}</td>
                  <td className="p-4 text-center text-xs text-gray-500">{r.accrue_at || 'Prorated'}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleDelete(r.id)} className="text-red-500 text-xs hover:underline">Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ==========================================
// KOMPONEN 2: RESOURCE USAGE (BOQ AGREGATION + ACTUAL PO)
// ==========================================
function ResourceUsage() {
  const [aggregated, setAggregated] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: tasks } = await supabase.from('wbs_tasks').select('*').not('ahsp_template_id', 'is', null);
      if (!tasks || tasks.length === 0) { setLoading(false); return; }

      const { data: details } = await supabase.from('ahsp_details').select('*');
      const { data: hsdItems } = await supabase.from('master_hsd').select('*');
      const { data: templates } = await supabase.from('ahsp_templates').select('*');

      const hsdMap = {};
      hsdItems?.forEach(h => { hsdMap[h.id] = h; });

      const templateMap = {};
      templates?.forEach(t => { templateMap[t.id] = t; });

      const detailsByTemplate = {};
      details?.forEach(d => {
        if (!detailsByTemplate[d.ahsp_template_id]) {
          detailsByTemplate[d.ahsp_template_id] = [];
        }
        detailsByTemplate[d.ahsp_template_id].push(d);
      });

      const grouped = {};
      tasks.forEach(task => {
        const taskDetails = detailsByTemplate[task.ahsp_template_id] || [];
        const volume = task.volume || 0;
        
        const template = templateMap[task.ahsp_template_id];
        const overheadPercent = template?.overhead_percent || 15;
        
        taskDetails.forEach(detail => {
          const hsd = hsdMap[detail.hsd_id];
          if (!hsd) return;

          const totalVol = volume * detail.koefisien;
          
          // Rencana (AHSP)
          const hargaDasar = hsd.base_price || 0;
          const overheadAmount = hargaDasar * (overheadPercent / 100);
          const hargaSatuanAHSP = hargaDasar + overheadAmount;
          const totalAHSP = totalVol * hargaSatuanAHSP;

          // Actual (PO)
          const actualPrice = hsd.actual_price || 0;
          const ppnRate = hsd.ppn_rate || 11;
          const pphRate = hsd.pph_rate || 2;
          
          const ppnAmount = actualPrice * (ppnRate / 100);
          const pphAmount = actualPrice * (pphRate / 100);
          
          // Total Actual = (Harga PO + PPN - PPh) * Volume
          // Asumsi PPh dipotong dari pembayaran
          const totalActual = totalVol * (actualPrice + ppnAmount - pphAmount);

          if (!grouped[hsd.id]) {
            grouped[hsd.id] = { 
              ...hsd, 
              total_volume: 0, 
              harga_dasar: hargaDasar,
              overhead_amount: overheadAmount,
              harga_ahsp: hargaSatuanAHSP,
              total_ahsp: 0,
              // Actual
              ppn_amount: ppnAmount,
              pph_amount: pphAmount,
              total_actual: 0
            };
          }
          grouped[hsd.id].total_volume += totalVol;
          grouped[hsd.id].total_ahsp += totalAHSP;
          grouped[hsd.id].total_actual += totalActual;
        });
      });

      const sorted = Object.values(grouped).sort((a, b) => a.resource_type.localeCompare(b.resource_type));
      setAggregated(sorted);
    } catch (err) { 
      console.error("Gagal load BoQ:", err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleActualUpdate = async (id, field, value) => {
    try {
      await supabase.from('master_hsd').update({ [field]: value }).eq('id', id);
      loadData(); // Refresh kalkulasi
    } catch (err) {
      alert("Gagal update Actual: " + err.message);
    }
  };

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        {loading ? <LoadingSpinner text="Menghitung agregasi..." /> : (
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-gray-50 border-b font-semibold text-gray-600">
              <tr>
                <th className="p-3 border-r" rowSpan={2}>Tipe</th>
                <th className="p-3 border-r" rowSpan={2}>Nama Item</th>
                <th className="p-3 border-r text-center" rowSpan={2}>Vol</th>
                <th className="p-3 border-r" rowSpan={2}>Satuan</th>
                
                {/* Grup Rencana AHSP */}
                <th className="p-2 border-r border-b text-center bg-blue-50 text-blue-800" colSpan={4}>Rencana (AHSP)</th>
                
                {/* Grup Actual PO */}
                <th className="p-2 border-b text-center bg-orange-50 text-orange-800" colSpan={5}>Actual (PO Vendor)</th>
              </tr>
              <tr>
                {/* Sub-header Rencana */}
                <th className="p-2 border-r text-right bg-blue-50/50">D (Dasar)</th>
                <th className="p-2 border-r text-right bg-blue-50/50">E (Ovh)</th>
                <th className="p-2 border-r text-right bg-blue-50/50">F (AHSP)</th>
                <th className="p-2 border-r text-right bg-blue-50/50">Total AHSP</th>
                
                {/* Sub-header Actual */}
                <th className="p-2 border-r text-right bg-orange-50/50">Harga PO</th>
                <th className="p-2 border-r text-center bg-orange-50/50">PPN %</th>
                <th className="p-2 border-r text-center bg-orange-50/50">PPh %</th>
                <th className="p-2 border-r text-right bg-orange-50/50">Total Actual</th>
                <th className="p-2 text-right bg-orange-50/50">Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {aggregated.map((r) => {
                const variance = r.total_ahsp - r.total_actual;
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="p-3 border-r capitalize font-medium">
                      <span className={`px-2 py-0.5 rounded-full ${
                        r.resource_type?.toLowerCase() === 'upah' ? 'bg-green-100 text-green-700' : 
                        r.resource_type?.toLowerCase() === 'bahan' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {r.resource_type}
                      </span>
                    </td>
                    <td className="p-3 border-r font-medium">{r.item_name}</td>
                    <td className="p-3 border-r text-center font-bold">{r.total_volume.toFixed(2)}</td>
                    <td className="p-3 border-r">{r.unit}</td>
                    
                    {/* Kolom Rencana */}
                    <td className="p-3 border-r text-right text-gray-500">Rp {r.harga_dasar?.toLocaleString('id-ID')}</td>
                    <td className="p-3 border-r text-right text-gray-500">Rp {r.overhead_amount?.toLocaleString('id-ID')}</td>
                    <td className="p-3 border-r text-right font-bold text-blue-700">Rp {r.harga_ahsp?.toLocaleString('id-ID')}</td>
                    <td className="p-3 border-r text-right font-bold text-gray-800">Rp {r.total_ahsp.toLocaleString('id-ID')}</td>
                    
                    {/* Kolom Actual (Editable) */}
                    <td className="p-1 border-r text-right bg-orange-50/30">
                      <input 
                        type="number" 
                        defaultValue={r.actual_price || 0} 
                        onBlur={(e) => handleActualUpdate(r.id, 'actual_price', Number(e.target.value))}
                        className="w-24 text-right border border-transparent hover:border-gray-300 focus:border-orange-500 rounded px-1 py-0.5 bg-transparent text-xs font-semibold"
                      />
                    </td>
                    <td className="p-1 border-r text-center bg-orange-50/30">
                      <input 
                        type="number" 
                        defaultValue={r.ppn_rate || 11} 
                        onBlur={(e) => handleActualUpdate(r.id, 'ppn_rate', Number(e.target.value))}
                        className="w-10 text-center border border-transparent hover:border-gray-300 focus:border-orange-500 rounded px-1 py-0.5 bg-transparent text-xs"
                      />
                    </td>
                    <td className="p-1 border-r text-center bg-orange-50/30">
                      <input 
                        type="number" 
                        defaultValue={r.pph_rate || 2} 
                        onBlur={(e) => handleActualUpdate(r.id, 'pph_rate', Number(e.target.value))}
                        className="w-10 text-center border border-transparent hover:border-gray-300 focus:border-orange-500 rounded px-1 py-0.5 bg-transparent text-xs"
                      />
                    </td>
                    <td className="p-3 border-r text-right font-bold text-orange-700 bg-orange-50/50">Rp {r.total_actual.toLocaleString('id-ID')}</td>
                    
                    {/* Selisih */}
                    <td className={`p-3 text-right font-bold ${variance < 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                      Rp {variance.toLocaleString('id-ID')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {aggregated.length === 0 && !loading && <div className="p-10 text-center text-gray-500">Belum ada Task yang di-assign ke AHSP atau Volume belum diisi.</div>}
      </div>
    </div>
  );
}
