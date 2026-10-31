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
        <button onClick={() => setActiveTab('sheet')} className={`px-6 py-3 text-sm font-medium border-b-2 transition ${activeTab === 'sheet' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          📋 Resource Sheet (Master)
        </button>
        <button onClick={() => setActiveTab('usage')} className={`px-6 py-3 text-sm font-medium border-b-2 transition ${activeTab === 'usage' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          📊 Resource Usage (BoQ)
        </button>
      </div>

      {activeTab === 'sheet' ? <ResourceSheet /> : <ResourceUsage />}
    </div>
  );
}

function ResourceSheet() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResources() {
      const { data } = await supabase.from('master_hsd').select('*').order('resource_type');
      setResources(data || []);
      setLoading(false);
    }
    fetchResources();
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
      {loading ? <LoadingSpinner text="Memuat Master Resource..." /> : (
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b font-semibold text-gray-600">
            <tr>
              <th className="p-4">Tipe</th>
              <th className="p-4">Nama Resource</th>
              <th className="p-4">Satuan</th>
              <th className="p-4 text-right">Harga Dasar (D)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {resources.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="p-4 capitalize">{r.resource_type}</td>
                <td className="p-4 font-medium">{r.item_name}</td>
                <td className="p-4">{r.unit}</td>
                <td className="p-4 text-right">Rp {r.base_price?.toLocaleString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

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

      const hsdMap = {}; hsdItems?.forEach(h => { hsdMap[h.id] = h; });
      const templateMap = {}; templates?.forEach(t => { templateMap[t.id] = t; });
      const detailsByTemplate = {};
      details?.forEach(d => {
        if (!detailsByTemplate[d.ahsp_template_id]) detailsByTemplate[d.ahsp_template_id] = [];
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
          const hargaDasar = hsd.base_price || 0;
          const overheadAmount = hargaDasar * (overheadPercent / 100);
          const hargaSatuanAHSP = hargaDasar + overheadAmount;
          const totalAHSP = totalVol * hargaSatuanAHSP;

          const actualPrice = hsd.actual_price || 0;
          const ppnRate = hsd.ppn_rate || 11;
          const pphRate = hsd.pph_rate || 2;
          const ppnAmount = actualPrice * (ppnRate / 100);
          const pphAmount = actualPrice * (pphRate / 100);
          const totalActual = totalVol * (actualPrice + ppnAmount - pphAmount);

          if (!grouped[hsd.id]) {
            grouped[hsd.id] = { 
              ...hsd, total_volume: 0, harga_dasar: hargaDasar, overhead_amount: overheadAmount,
              harga_ahsp: hargaSatuanAHSP, total_ahsp: 0, total_actual: 0
            };
          }
          grouped[hsd.id].total_volume += totalVol;
          grouped[hsd.id].total_ahsp += totalAHSP;
          grouped[hsd.id].total_actual += totalActual;
        });
      });

      setAggregated(Object.values(grouped).sort((a, b) => a.resource_type.localeCompare(b.resource_type)));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  // ⚡ OPTIMISTIC UPDATE: Tanpa Loading!
  const handleUpdate = async (id, field, value) => {
    try {
      await supabase.from('master_hsd').update({ [field]: value }).eq('id', id);
      
      setAggregated(prev => prev.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          // Recalculate row
          const vol = updated.total_volume;
          const actualPrice = field === 'actual_price' ? Number(value) : (updated.actual_price || 0);
          const ppnRate = field === 'ppn_rate' ? Number(value) : (updated.ppn_rate || 11);
          const pphRate = field === 'pph_rate' ? Number(value) : (updated.pph_rate || 2);
          
          const ppnAmount = actualPrice * (ppnRate / 100);
          const pphAmount = actualPrice * (pphRate / 100);
          
          updated.actual_price = actualPrice;
          updated.ppn_rate = ppnRate;
          updated.pph_rate = pphRate;
          updated.total_actual = vol * (actualPrice + ppnAmount - pphAmount);
          return updated;
        }
        return item;
      }));
    } catch (err) { alert("Gagal update: " + err.message); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
      {loading ? <LoadingSpinner text="Menghitung agregasi..." /> : (
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-gray-50 border-b font-semibold text-gray-600">
            <tr>
              <th className="p-3 border-r" rowSpan={2}>Tipe</th>
              <th className="p-3 border-r" rowSpan={2}>Nama Item</th>
              <th className="p-3 border-r text-center" rowSpan={2}>Vol</th>
              <th className="p-3 border-r" rowSpan={2}>Satuan</th>
              <th className="p-2 border-r border-b text-center bg-blue-50 text-blue-800" colSpan={4}>Rencana (AHSP)</th>
              <th className="p-2 border-b text-center bg-orange-50 text-orange-800" colSpan={7}>Actual (PO Vendor)</th>
            </tr>
            <tr>
              <th className="p-2 border-r text-right bg-blue-50/50">D (Dasar)</th>
              <th className="p-2 border-r text-right bg-blue-50/50">E (Ovh)</th>
              <th className="p-2 border-r text-right bg-blue-50/50">F (AHSP)</th>
              <th className="p-2 border-r text-right bg-blue-50/50">Total AHSP</th>
              
              <th className="p-2 border-r text-right bg-orange-50/50">Harga PO</th>
              <th className="p-2 border-r text-center bg-orange-50/50">PPN %</th>
              <th className="p-2 border-r text-center bg-orange-50/50">PPh %</th>
              <th className="p-2 border-r text-right bg-orange-50/50">Total Actual</th>
              <th className="p-2 border-r text-center bg-orange-50/50">Vendor</th>
              <th className="p-2 border-r text-center bg-orange-50/50">No. PO</th>
              <th className="p-2 text-right bg-orange-50/50">Selisih</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {aggregated.map((r) => {
              const variance = r.total_ahsp - r.total_actual;
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="p-3 border-r capitalize font-medium">
                    <span className={`px-2 py-0.5 rounded-full ${r.resource_type?.toLowerCase() === 'upah' ? 'bg-green-100 text-green-700' : r.resource_type?.toLowerCase() === 'bahan' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{r.resource_type}</span>
                  </td>
                  <td className="p-3 border-r font-medium">{r.item_name}</td>
                  <td className="p-3 border-r text-center font-bold">{r.total_volume.toFixed(2)}</td>
                  <td className="p-3 border-r">{r.unit}</td>
                  
                  <td className="p-3 border-r text-right text-gray-500">Rp {r.harga_dasar?.toLocaleString('id-ID')}</td>
                  <td className="p-3 border-r text-right text-gray-500">Rp {r.overhead_amount?.toLocaleString('id-ID')}</td>
                  <td className="p-3 border-r text-right font-bold text-blue-700">Rp {r.harga_ahsp?.toLocaleString('id-ID')}</td>
                  <td className="p-3 border-r text-right font-bold text-gray-800">Rp {r.total_ahsp.toLocaleString('id-ID')}</td>
                  
                  <td className="p-1 border-r text-right bg-orange-50/30">
                    <input type="number" defaultValue={r.actual_price || 0} onBlur={(e) => handleUpdate(r.id, 'actual_price', e.target.value)} className="w-24 text-right border border-transparent hover:border-gray-300 focus:border-orange-500 rounded px-1 py-0.5 bg-transparent text-xs font-semibold" />
                  </td>
                  <td className="p-1 border-r text-center bg-orange-50/30">
                    <input type="number" defaultValue={r.ppn_rate || 11} onBlur={(e) => handleUpdate(r.id, 'ppn_rate', e.target.value)} className="w-10 text-center border border-transparent hover:border-gray-300 focus:border-orange-500 rounded px-1 py-0.5 bg-transparent text-xs" />
                  </td>
                  <td className="p-1 border-r text-center bg-orange-50/30">
                    <input type="number" defaultValue={r.pph_rate || 2} onBlur={(e) => handleUpdate(r.id, 'pph_rate', e.target.value)} className="w-10 text-center border border-transparent hover:border-gray-300 focus:border-orange-500 rounded px-1 py-0.5 bg-transparent text-xs" />
                  </td>
                  <td className="p-3 border-r text-right font-bold text-orange-700 bg-orange-50/50">Rp {r.total_actual.toLocaleString('id-ID')}</td>
                  
                  <td className="p-1 border-r bg-orange-50/30">
                    <input type="text" defaultValue={r.vendor_name || ''} placeholder="Vendor..." onBlur={(e) => handleUpdate(r.id, 'vendor_name', e.target.value)} className="w-24 border border-transparent hover:border-gray-300 focus:border-orange-500 rounded px-1 py-0.5 bg-transparent text-xs" />
                  </td>
                  <td className="p-1 border-r bg-orange-50/30">
                    <input type="text" defaultValue={r.po_number || ''} placeholder="No. PO..." onBlur={(e) => handleUpdate(r.id, 'po_number', e.target.value)} className="w-24 border border-transparent hover:border-gray-300 focus:border-orange-500 rounded px-1 py-0.5 bg-transparent text-xs" />
                  </td>
                  
                  <td className={`p-3 text-right font-bold ${variance < 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                    Rp {variance.toLocaleString('id-ID')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
