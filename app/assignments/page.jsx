'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AssignmentsPage() {
  const [tasks, setTasks] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = async () => {
    try {
      const { data: tData } = await supabase.from('wbs_tasks').select('*').eq('summary', 'No').order('wbs_code');
      const { data: aData } = await supabase.from('ahsp_templates').select('*');
      
      const uniqueTasks = tData 
        ? Array.from(new Map(tData.map(item => [item.wbs_code, item])).values())
        : [];

      setTasks(uniqueTasks);
      setTemplates(aData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Fungsi untuk menghitung Total F dari AHSP dengan query yang lebih akurat
  const calculateAhspTotal = async (templateId) => {
    // ⚠️ PERBAIKAN: Gunakan foreign key eksplisit (hsd_id) agar relasi terbaca sempurna
    const { data: details, error: detailErr } = await supabase.from('ahsp_details')
      .select(`
        koefisien, 
        master_hsd!hsd_id (base_price)
      `)
      .eq('ahsp_template_id', templateId);
      
    if (detailErr) console.error("Error detail:", detailErr);

    const { data: template, error: tempErr } = await supabase.from('ahsp_templates')
      .select('overhead_percent')
      .eq('id', templateId)
      .single();

    if (tempErr) console.error("Error template:", tempErr);

    let totalABC = 0;
    if (details && details.length > 0) {
      details.forEach(d => {
        // Pastikan data harganya ada
        const price = d.master_hsd?.base_price || 0;
        totalABC += Number(d.koefisien) * Number(price);
      });
    }

    const overhead = Number(template?.overhead_percent) || 15;
    const totalF = totalABC * (1 + (overhead / 100));
    
    // Cegah error NaN
    return isNaN(totalF) ? 0 : totalF;
  };

  const handleAssign = async (taskId, templateId, volume) => {
    try {
      let calculatedCost = 0;
      
      if (templateId) {
        const ahspTotal = await calculateAhspTotal(templateId);
        calculatedCost = ahspTotal * (Number(volume) || 0);
      }

      const { error } = await supabase.from('wbs_tasks')
        .update({ 
          ahsp_template_id: templateId || null, 
          volume: Number(volume) || 0,
          cost: calculatedCost
        })
        .eq('id', taskId);
      
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert('Gagal update: ' + err.message);
    }
  };

  const handleSyncAll = async () => {
    if (!confirm('Sinkronisasi ulang semua harga task berdasarkan AHSP?')) return;
    setSyncing(true);
    try {
      for (const task of tasks) {
        if (task.ahsp_template_id) {
          const ahspTotal = await calculateAhspTotal(task.ahsp_template_id);
          const calculatedCost = ahspTotal * (task.volume || 0);
          await supabase.from('wbs_tasks').update({ cost: calculatedCost }).eq('id', task.id);
        }
      }
      fetchData();
      alert('Sinkronisasi harga berhasil! Biaya Task telah di-update.');
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
          <p className="text-sm text-gray-500 mt-1">Hubungkan pekerjaan jadwal (WBS) dengan Katalog AHSP. Biaya task dihitung otomatis (Volume × Harga AHSP).</p>
        </div>
        <button 
          onClick={handleSyncAll} 
          disabled={syncing}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          {syncing ? 'Menyinkronkan...' : 'Sync Harga Semua Task'}
        </button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b text-sm font-semibold text-gray-600">
            <tr>
              <th className="p-4">WBS</th>
              <th className="p-4">Nama Task (Jadwal)</th>
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
                  <select 
                    value={t.ahsp_template_id || ''} 
                    onChange={(e) => handleAssign(t.id, e.target.value, t.volume)}
                    className="w-full border rounded-lg p-2 text-sm"
                  >
                    <option value="">-- Belum di-assign --</option>
                    {templates.map(tpl => (
                      <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.unit})</option>
                    ))}
                  </select>
                </td>
                <td className="p-4">
                  <input 
                    type="number" 
                    defaultValue={t.volume || 0} 
                    onBlur={(e) => handleAssign(t.id, t.ahsp_template_id, e.target.value)}
                    className="w-full border rounded-lg p-2 text-sm" 
                  />
                </td>
                <td className="p-4 text-right font-bold text-gray-800">
                  Rp {(t.cost || 0).toLocaleString('id-ID')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tasks.length === 0 && !loading && (
          <div className="p-10 text-center text-gray-500">
            Belum ada data WBS Task.
          </div>
        )}
      </div>
    </div>
  );
}
