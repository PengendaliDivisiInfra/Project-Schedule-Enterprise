'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import AssignmentModal from '../../components/AssignmentModal';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AHSPPage() {
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [ahspDetails, setAhspDetails] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchTasks = async () => {
    const { data } = await supabase.from('wbs_tasks').select('*').eq('summary', 'No').order('wbs_code');
    setTasks(data || []);
  };

  const fetchAhspDetails = async (taskId) => {
    const { data } = await supabase.from('ahsp_details')
      .select(`koefisien, master_hsd(*)`)
      .eq('task_id', taskId);
    setAhspDetails(data || []);
  };

  useEffect(() => { fetchTasks(); }, []);
  
  useEffect(() => {
    if (selectedTask) fetchAhspDetails(selectedTask.id);
  }, [selectedTask]);

  // Logika Pengelompokan PUPR
  const upah = ahspDetails.filter(d => d.master_hsd?.resource_type?.toLowerCase() === 'upah' || d.master_hsd?.resource_type?.toLowerCase() === 'tenaga kerja');
  const bahan = ahspDetails.filter(d => d.master_hsd?.resource_type?.toLowerCase() === 'bahan' || d.master_hsd?.resource_type?.toLowerCase() === 'material');
  const alat = ahspDetails.filter(d => d.master_hsd?.resource_type?.toLowerCase() === 'alat' || d.master_hsd?.resource_type?.toLowerCase() === 'peralatan');

  const calcTotal = (items) => items.reduce((sum, item) => sum + (item.koefisien * (item.master_hsd?.base_price || 0)), 0);
  
  const totalA = calcTotal(upah);
  const totalB = calcTotal(bahan);
  const totalC = calcTotal(alat);
  const totalD = totalA + totalB + totalC;
  const totalE = totalD * 0.15; // Asumsi Overhead & Profit 15%
  const totalF = totalD + totalE;

  const renderRow = (item, index, group) => {
    const hargaSatuan = item.master_hsd?.base_price || 0;
    const jumlahHarga = item.koefisien * hargaSatuan;
    return (
      <tr key={item.master_hsd?.id || index} className="border-b hover:bg-gray-50">
        <td className="p-2 text-center text-sm">{index + 1}</td>
        <td className="p-2 text-sm">{item.master_hsd?.item_name}</td>
        <td className="p-2 text-sm text-center">{item.master_hsd?.kode || '-'}</td>
        <td className="p-2 text-sm text-center">{item.master_hsd?.unit}</td>
        <td className="p-2 text-sm text-center">{item.koefisien}</td>
        <td className="p-2 text-sm text-right">Rp {hargaSatuan.toLocaleString('id-ID')}</td>
        <td className="p-2 text-sm text-right font-medium">Rp {jumlahHarga.toLocaleString('id-ID')}</td>
      </tr>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analisa Harga Satuan Pekerjaan (AHSP)</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Panel Kiri: Daftar Pekerjaan */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 h-fit">
          <h2 className="font-bold mb-3 border-b pb-2">Daftar Pekerjaan</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {tasks.map(t => (
              <button 
                key={t.id} 
                onClick={() => setSelectedTask(t)}
                className={`w-full text-left p-3 rounded-lg border transition ${selectedTask?.id === t.id ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`}
              >
                <div className="font-mono text-xs text-gray-500">{t.wbs_code}</div>
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-xs text-gray-400 mt-1">Vol: {t.volume || 0}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Panel Kanan: Tabel AHSP PUPR */}
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {!selectedTask ? (
            <div className="text-center text-gray-500 py-20">Pilih pekerjaan di sebelah kiri untuk melihat AHSP.</div>
          ) : (
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-bold">{selectedTask.name}</h2>
                  <p className="text-sm text-gray-500">WBS: {selectedTask.wbs_code} | Volume Task: {selectedTask.volume || 0}</p>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                  + Tambah Komponen
                </button>
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
                  </tr>
                </thead>
                <tbody>
                  {/* A. TENAGA KERJA */}
                  <tr className="bg-gray-50 font-bold"><td className="border border-gray-300 p-2 text-sm" colSpan={7}>A. Tenaga Kerja</td></tr>
                  {upah.map((item, i) => renderRow(item, i, 'A'))}
                  <tr className="bg-gray-50 font-semibold"><td className="border border-gray-300 p-2 text-sm text-right" colSpan={6}>Jumlah Harga Tenaga Kerja (A)</td><td className="border border-gray-300 p-2 text-sm text-right">Rp {totalA.toLocaleString('id-ID')}</td></tr>

                  {/* B. BAHAN */}
                  <tr className="bg-gray-50 font-bold"><td className="border border-gray-300 p-2 text-sm" colSpan={7}>B. Bahan</td></tr>
                  {bahan.map((item, i) => renderRow(item, i, 'B'))}
                  <tr className="bg-gray-50 font-semibold"><td className="border border-gray-300 p-2 text-sm text-right" colSpan={6}>Jumlah Harga Bahan (B)</td><td className="border border-gray-300 p-2 text-sm text-right">Rp {totalB.toLocaleString('id-ID')}</td></tr>

                  {/* C. PERALATAN */}
                  <tr className="bg-gray-50 font-bold"><td className="border border-gray-300 p-2 text-sm" colSpan={7}>C. Peralatan</td></tr>
                  {alat.map((item, i) => renderRow(item, i, 'C'))}
                  <tr className="bg-gray-50 font-semibold"><td className="border border-gray-300 p-2 text-sm text-right" colSpan={6}>Jumlah Harga Peralatan (C)</td><td className="border border-gray-300 p-2 text-sm text-right">Rp {totalC.toLocaleString('id-ID')}</td></tr>

                  {/* D, E, F */}
                  <tr className="font-semibold"><td className="border border-gray-300 p-2 text-sm" colSpan={6}>D. Jumlah Harga Tenaga, Bahan dan Peralatan (A+B+C)</td><td className="border border-gray-300 p-2 text-sm text-right">Rp {totalD.toLocaleString('id-ID')}</td></tr>
                  <tr className="font-semibold"><td className="border border-gray-300 p-2 text-sm" colSpan={5}>E. Overhead + Profit (15%)</td><td className="border border-gray-300 p-2 text-sm text-right">15% x D</td><td className="border border-gray-300 p-2 text-sm text-right">Rp {totalE.toLocaleString('id-ID')}</td></tr>
                  <tr className="bg-blue-50 font-bold text-blue-900"><td className="border border-gray-300 p-2 text-sm" colSpan={6}>F. Harga Satuan Pekerjaan (D+E)</td><td className="border border-gray-300 p-2 text-sm text-right">Rp {totalF.toLocaleString('id-ID')}</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AssignmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} task={selectedTask} onSaveSuccess={() => fetchAhspDetails(selectedTask.id)} />
    </div>
  );
}
