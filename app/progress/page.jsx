'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ProgressGridPage() {
  const [tasks, setTasks] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateRange, setDateRange] = useState([]);

  useEffect(() => {
    const dates = [];
    const start = new Date(startDate);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    setDateRange(dates);
  }, [startDate]);

  const fetchData = async () => {
    setLoading(true);
    const { data: tData } = await supabase
      .from('wbs_tasks')
      .select(`id, name, wbs_code, summary, volume, cost, ahsp_templates ( unit )`)
      .order('wbs_code');
    
    if (tData) {
      const uniqueTasks = Array.from(new Map(tData.map(item => [item.wbs_code, item])).values());
      setTasks(uniqueTasks.map(task => {
        const hasChildren = uniqueTasks.some(other => other.wbs_code !== task.wbs_code && other.wbs_code.startsWith(task.wbs_code + '.'));
        return {
          ...task,
          is_parent: hasChildren || task.summary === 'Yes',
          satuan_hsd: task.ahsp_templates?.unit || 'unit',
          volume: Number(task.volume) || 0,
          cost: Number(task.cost) || 0,
          harga_satuan: (Number(task.volume) > 0) ? (Number(task.cost) / Number(task.volume)) : 0
        };
      }));
    }
    
    // ⚡ Ambil SEMUA data history, bukan cuma minggu ini
    const { data: pData } = await supabase.from('daily_progress').select('*');
    setRecords(pData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const tableData = useMemo(() => {
    return tasks.map(task => {
      const taskRecords = records.filter(r => r.task_id === task.id);
      const totalKumulatif = taskRecords.reduce((sum, r) => sum + Number(r.completed_volume), 0);
      const progressPercent = task.volume > 0 ? Math.min((totalKumulatif / task.volume) * 100, 100) : 0;
      const totalRealisasi = totalKumulatif * task.harga_satuan;
      
      const dailyMap = {};
      taskRecords.forEach(r => { dailyMap[r.record_date] = r.completed_volume; });

      return { ...task, totalKumulatif, progressPercent, totalRealisasi, dailyMap };
    });
  }, [tasks, records]);

  const handleCellUpdate = async (taskId, dateStr, volume) => {
    const numVolume = Number(volume);
    if (isNaN(numVolume) || numVolume < 0) return;

    try {
      const existingRecord = records.find(r => r.task_id === taskId && r.record_date === dateStr);
      if (existingRecord) {
        await supabase.from('daily_progress').update({ completed_volume: numVolume }).eq('id', existingRecord.id);
      } else {
        await supabase.from('daily_progress').insert([{
          task_id: taskId, record_date: dateStr, completed_volume: numVolume, actual_cost: 0, progress_percent: 0
        }]);
      }
      
      if (existingRecord) {
        setRecords(prev => prev.map(r => r.id === existingRecord.id ? { ...r, completed_volume: numVolume } : r));
      } else {
        setRecords(prev => [...prev, { task_id: taskId, record_date: dateStr, completed_volume: numVolume }]);
      }
    } catch (err) {
      alert('Gagal simpan sel: ' + err.message);
    }
  };

  return (
    <div className="p-4 bg-gray-50 h-screen flex flex-col">
      <div className="mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Rekapitulasi Progres Harian</h1>
          <p className="text-sm text-gray-500 mt-1">Input horizontal. Data lama tetap tersimpan aman di database meski tanggal diubah.</p>
        </div>
        <div className="flex gap-2 items-center bg-white p-2 rounded-lg shadow-sm border">
          <label className="text-xs font-bold text-gray-600">Mulai Tanggal Tampilan:</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border border-gray-300 p-1 rounded text-sm" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden flex-1 flex flex-col">
        {loading ? <LoadingSpinner text="Memuat data grid..." /> : (
          <div className="flex-1 overflow-auto relative">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-gray-100 border-b border-gray-300 sticky top-0 z-20 shadow-sm text-gray-700">
                <tr>
                  <th className="p-2 border-r border-gray-300 w-12 text-center bg-gray-200 sticky left-0 z-30">No</th>
                  <th className="p-2 border-r border-gray-300 w-64 bg-gray-200 sticky left-[48px] z-30">Uraian Pekerjaan</th>
                  <th className="p-2 border-r border-gray-300 w-20 text-center bg-gray-200">Vol Kontrak</th>
                  <th className="p-2 border-r border-gray-300 w-16 text-center bg-gray-200">Satuan</th>
                  {dateRange.map(date => (
                    <th key={date} className="p-2 border-r border-gray-300 w-20 text-center bg-blue-50 text-blue-800 font-bold">
                      {new Date(date).toLocaleDateString('id-ID', {day:'2-digit', month:'short'})}
                    </th>
                  ))}
                  <th className="p-2 border-r border-gray-300 w-24 text-center bg-gray-200 font-bold">Vol Kumulatif</th>
                  <th className="p-2 border-r border-gray-300 w-20 text-center bg-gray-200 font-bold">Prog (%)</th>
                  <th className="p-2 border-r border-gray-300 w-32 text-right bg-gray-200 font-bold">Total Realisasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tableData.map((t) => (
                  <tr key={t.id} className={`hover:bg-blue-50 ${t.is_parent ? 'bg-gray-100 font-bold' : ''}`}>
                    <td className={`p-2 border-r border-gray-200 text-center bg-white sticky left-0 z-10 ${t.is_parent ? 'bg-gray-100' : ''}`}>{t.wbs_code}</td>
                    <td className={`p-2 border-r border-gray-200 bg-white sticky left-[48px] z-10 truncate max-w-[250px] ${t.is_parent ? 'bg-gray-100' : ''}`} title={t.name}>
                      {t.is_parent ? '📁 ' : '📄 '} {t.name}
                    </td>
                    <td className="p-2 border-r border-gray-200 text-center">{t.volume}</td>
                    <td className="p-2 border-r border-gray-200 text-center">{t.satuan_hsd}</td>
                    {dateRange.map(date => (
                      <td key={date} className="p-1 border-r border-gray-200 bg-blue-50/20">
                        {!t.is_parent && (
                          <input 
                            type="number" step="0.01" defaultValue={t.dailyMap[date] || ''} onBlur={(e) => handleCellUpdate(t.id, date, e.target.value)}
                            className="w-full h-8 text-center border border-transparent hover:border-blue-300 focus:border-blue-500 focus:bg-white rounded bg-transparent text-xs font-semibold" placeholder="-"
                          />
                        )}
                      </td>
                    ))}
                    <td className="p-2 border-r border-gray-200 text-right font-bold text-slate-700">{t.totalKumulatif.toFixed(2)}</td>
                    <td className="p-2 border-r border-gray-200 text-center">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${t.progressPercent >= 100 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {t.progressPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-2 border-r border-gray-200 text-right font-bold text-indigo-700">Rp {t.totalRealisasi.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
