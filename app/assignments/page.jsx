'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import LoadingSpinner from '../../components/LoadingSpinner';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AssignmentsPage() {
  const [tasks, setTasks] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: tData } = await supabase.from('wbs_tasks').select('*').eq('summary', 'No').order('wbs_code');
      const { data: aData } = await supabase.from('ahsp_templates').select('id, name, unit, total_harga_ahsp');
      
      const uniqueTasks = tData ? Array.from(new Map(tData.map(item => [item.wbs_code, item])).values()) : [];
      setTasks(uniqueTasks);
      setTemplates(aData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAssign = async (taskId, templateId, volume) => {
    try {
      let calculatedCost = 0;
      if (templateId) {
        const tpl = templates.find(t => t.id === templateId);
        calculatedCost = (tpl?.total_harga_ahsp || 0) * (Number(volume) || 0);
      }

      const { error } = await supabase.from('wbs_tasks')
        .update({ ahsp_template_id: templateId || null, volume: Number(volume) || 0, cost: calculatedCost })
        .eq('id', taskId);
      
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert('Gagal update: ' + err.message);
    }
  };

  const handleSyncAll = async () => {
    if (!confirm('Sinkronisasi ulang semua harga task berdasarkan AHSP terbaru?')) return;
    setSyncing(true);
    try {
      for (const task of tasks) {
        if (task.ahsp_template_id) {
          const tpl = templates.find(t => t.id === task.ahsp_template_id);
          const calculatedCost = (tpl?.total_harga_ahsp || 0) * (task.volume || 0);
          await supabase.from('wbs_tasks').update({ cost: calculatedCost }).eq('id', task.id);
        }
      }
      fetchData();
      alert('Sinkronisasi harga berhasil! Kurva-S akan ter-update.');
    } catch (err) {
      alert('Gagal sinkronisasi: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Assignment: WBS ke AHSP</h1>
          <p className="text-sm text-gray-500 mt-1">Biaya task dihitung otomatis (Volume × Harga AHSP).</p>
        </div>
        <button onClick={handleSyncAll} disabled={syncing} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 shadow-sm">
          {syncing ? <LoadingSpinner text="Sync..." /> : 'Sync Harga Semua Task'}
        </button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        {loading ? <LoadingSpinner text="Memuat data Assignment..." /> : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b text-sm font-semibold text-gray-600">
              <tr>
                <th className="p-4">WBS</th>
                <th className="p-4">Nama Task</th>
                <th className="p-4 w-1/3">Pilih AHSP Template</th>
                <th className="p-4 w-24">Volume</th>
                <th className="p-4 text-right">Total Biaya (Rp)</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {tasks.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="p-4 font-mono">{t.wbs_code}</td>
                  <td className="p-4 font-medium">{t.name}</td>
                  <td className="p-4">
                    <select value={t.ahsp_template_id || ''} onChange={(e) => handleAssign(t.id, e.target.value, t.volume)} className="w-full border rounded-lg p-2 text-sm">
                      <option value="">-- Belum di-assign --</option>
                      {templates.map(tpl => (
                        <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.unit})</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4">
                    <input type="number" defaultValue={t.volume || 0} onBlur={(e) => handleAssign(t.id, t.ahsp_template_id, e.target.value)} className="w-full border rounded-lg p-2 text-sm" />
                  </td>
                  <td className="p-4 text-right font-bold text-gray-800">Rp {(t.cost || 0).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
