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
      const { data: tData } = await supabase.from('wbs_tasks').select('*').order('wbs_code');
      const { data: aData } = await supabase.from('ahsp_templates').select('id, name, unit, total_harga_ahsp');
      
      if (tData) {
        // Konversi awal: pastikan tipe data benar dan tambahkan flag is_summary
        let formattedTasks = tData.map(t => ({
          ...t,
          volume: Number(t.volume || 0),
          cost: Number(t.cost || 0),
          is_summary: t.summary === 'Yes'
        }));

        setTasks(formattedTasks);
      }
      setTemplates(aData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- ENGINE ROLLUP WBS (BOTTOM-UP) ---
  const runRollupEngine = (inputTasks) => {
    const taskMap = {};
    const roots = [];

    // 1. Inisialisasi Map
    inputTasks.forEach(task => {
      taskMap[task.id] = { ...task, children: [] };
    });

    // 2. Bangun Struktur Pohon (Tree) berdasarkan WBS Code
    inputTasks.forEach(task => {
      const mappedItem = taskMap[task.id];
      let parentId = null;

      if (mappedItem.wbs_code && mappedItem.wbs_code.includes('.')) {
        const wbsParts = mappedItem.wbs_code.split('.');
        wbsParts.pop();
        const parentWbs = wbsParts.join('.');
        const parentFound = inputTasks.find(p => p.wbs_code === parentWbs);
        if (parentFound) parentId = parentFound.id;
      }

      if (parentId && taskMap[parentId]) {
        taskMap[parentId].children.push(mappedItem);
        taskMap[parentId].is_summary = true; // Paksa jadi Summary jika punya anak
      } else {
        roots.push(mappedItem);
      }
    });

    // 3. Fungsi Rekursif Bottom-Up Rollup
    const executeRollup = (node) => {
      if (!node.children || node.children.length === 0) {
        // Base Case: Leaf Node (Subtask murni)
        return node.cost;
      }

      let accumulatedCost = 0;
      node.children.forEach(child => {
        accumulatedCost += executeRollup(child);
      });

      // Summary Task mengambil alih total biaya dari anak-anaknya
      node.cost = accumulatedCost;
      node.volume = 0; // Volume induk selalu 0
      return node.cost;
    };

    roots.forEach(root => executeRollup(root));

    // 4. Flatten Tree Kembali
    const flatResult = [];
    const flatten = (node) => {
      const { children, ...clean } = node;
      flatResult.push(clean);
      if (children) children.forEach(flatten);
    };
    roots.forEach(flatten);

    // Kembalikan urutan sesuai WBS
    return flatResult.sort((a, b) => a.wbs_code.localeCompare(b.wbs_code, undefined, { numeric: true }));
  };

  const handleAssign = async (taskId, templateId, volume) => {
    try {
      let updatedTasks = [...tasks];
      const taskIndex = updatedTasks.findIndex(t => t.id === taskId);
      const task = updatedTasks[taskIndex];
      
      if (task.is_summary) return; // Proteksi ganda: Induk tidak boleh diubah

      let calculatedCost = 0;
      if (templateId) {
        const tpl = templates.find(t => t.id === templateId);
        calculatedCost = (tpl?.total_harga_ahsp || 0) * (Number(volume) || 0);
      }

      // Update Task Anak
      updatedTasks[taskIndex] = { 
        ...task, 
        ahsp_template_id: templateId || null, 
        volume: Number(volume) || 0, 
        cost: calculatedCost 
      };

      // Jalankan Rollup
      const rolledUpTasks = runRollupEngine(updatedTasks);
      setTasks(rolledUpTasks); // Update state UI secara instan

      // Simpan ke Database
      const { error } = await supabase.from('wbs_tasks')
        .update({ ahsp_template_id: templateId || null, volume: Number(volume) || 0, cost: calculatedCost })
        .eq('id', taskId);
      
      if (error) throw error;
    } catch (err) {
      alert('Gagal update: ' + err.message);
    }
  };

  const handleSyncAll = async () => {
    if (!confirm('Sinkronisasi ulang semua harga task berdasarkan AHSP terbaru?')) return;
    setSyncing(true);
    try {
      // 1. Hitung ulang semua leaf nodes
      let recalculatedTasks = tasks.map(t => {
        if (!t.is_summary) {
          const tpl = templates.find(tpl => tpl.id === t.ahsp_template_id);
          const cost = tpl ? (tpl.total_harga_ahsp * t.volume) : 0;
          return { ...t, cost: cost };
        }
        return { ...t };
      });

      // 2. Jalankan Rollup ke Induk
      const finalTasks = runRollupEngine(recalculatedTasks);
      setTasks(finalTasks);

      // 3. Bulk Update ke Database
      const updates = finalTasks.map(t => ({
        id: t.id, cost: t.cost, volume: t.volume, ahsp_template_id: t.ahsp_template_id
      }));

      // Looping update per ID (Karena Supabase tidak mendukung multi-row update beda value secara native)
      for (const u of updates) {
        await supabase.from('wbs_tasks').update({ cost: u.cost, volume: u.volume, ahsp_template_id: u.ahsp_template_id }).eq('id', u.id);
      }

      alert('Sinkronisasi harga berhasil! Biaya Induk telah di-rollup.');
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
          <p className="text-sm text-gray-500 mt-1">Biaya task dihitung otomatis (Volume × Harga AHSP). Induk akan menjumlahkan biaya anak.</p>
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
                <tr key={t.id} className={`hover:bg-gray-50 ${t.is_summary ? 'bg-gray-100 font-bold' : ''}`}>
                  <td className="p-4 font-mono">{t.wbs_code}</td>
                  <td className="p-4">{t.is_summary ? '📁 ' : '📄 '} {t.name}</td>
                  <td className="p-4">
                    {/* PROTEKSI: Disable dropdown jika ini Induk */}
                    <select 
                      value={t.ahsp_template_id || ''} 
                      onChange={(e) => handleAssign(t.id, e.target.value, t.volume)} 
                      disabled={t.is_summary}
                      className={`w-full border rounded-lg p-2 text-sm ${t.is_summary ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : ''}`}
                    >
                      <option value="">-- Belum di-assign --</option>
                      {templates.map(tpl => (
                        <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.unit})</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4">
                    {/* PROTEKSI: Disable input jika ini Induk */}
                    <input 
                      type="number" 
                      value={t.volume || 0} 
                      onChange={(e) => handleAssign(t.id, t.ahsp_template_id, e.target.value)} 
                      disabled={t.is_summary}
                      className={`w-full border rounded-lg p-2 text-sm ${t.is_summary ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : ''}`} 
                    />
                  </td>
                  <td className="p-4 text-right text-gray-800">Rp {(t.cost || 0).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
