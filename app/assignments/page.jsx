'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function AssignmentsPage() {
  const [tasks, setTasks] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- ENGINE ROLLUP WBS (BOTTOM-UP) ---
  const runRollupEngine = (inputTasks) => {
    const taskMap = {};
    const roots = [];

    inputTasks.forEach(task => {
      taskMap[task.id] = { ...task, children: [] };
    });

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
        taskMap[parentId].is_summary = true;
      } else {
        roots.push(mappedItem);
      }
    });

    const executeRollup = (node) => {
      if (!node.children || node.children.length === 0) {
        return node.cost;
      }
      let accumulatedCost = 0;
      node.children.forEach(child => {
        accumulatedCost += executeRollup(child);
      });
      node.cost = accumulatedCost;
      node.volume = 0; 
      return node.cost;
    };

    roots.forEach(root => executeRollup(root));

    const flatResult = [];
    const flatten = (node) => {
      const { children, ...clean } = node;
      flatResult.push(clean);
      if (children) children.forEach(flatten);
    };
    roots.forEach(flatten);

    return flatResult.sort((a, b) => a.wbs_code.localeCompare(b.wbs_code, undefined, { numeric: true }));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: tData } = await supabase.from('wbs_tasks').select('*').order('wbs_code');
      const { data: aData } = await supabase.from('ahsp_templates').select('id, name, unit, total_harga_ahsp');
      
      if (tData) {
        const uniqueTasks = Array.from(new Map(tData.map(item => [item.wbs_code, item])).values());
        
        let formattedTasks = uniqueTasks.map(t => ({
          ...t,
          volume: Number(t.volume || 0),
          cost: Number(t.cost || 0),
          is_summary: t.summary === 'Yes'
        }));

        // ⚡ OTOMATISASI: Jalankan Rollup di frontend agar UI PASTI benar
        const rolledUpTasks = runRollupEngine(formattedTasks);
        setTasks(rolledUpTasks);
      }
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
      // Kirim data ke database, Trigger DB yang akan menghitung cost
      const { error } = await supabase.from('wbs_tasks')
        .update({ 
          ahsp_template_id: templateId || null, 
          volume: Number(volume) || 0
        })
        .eq('id', taskId);
      
      if (error) throw error;
      
      // Tarik ulang data agar angka terbaru dari database langsung muncul
      fetchData(); 
    } catch (err) {
      alert('Gagal update: ' + err.message);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold">Assignment: WBS ke AHSP</h1>
          <p className="text-sm text-gray-500 mt-1">Biaya task dikalkulasi otomatis secara <em>real-time</em> oleh Database Trigger.</p>
        </div>
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
                    {t.is_summary ? (
                      <span className="text-gray-400 italic text-xs block text-center py-2 bg-gray-50 rounded border border-dashed">— Induk (Otomatis) —</span>
                    ) : (
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
                    )}
                  </td>
                  <td className="p-4">
                    {t.is_summary ? (
                      <span className="text-gray-400 italic text-xs block text-center py-2">-</span>
                    ) : (
                      <input 
                        type="number" 
                        value={t.volume || 0} 
                        onChange={(e) => handleAssign(t.id, t.ahsp_template_id, e.target.value)} 
                        className="w-full border rounded-lg p-2 text-sm" 
                      />
                    )}
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
