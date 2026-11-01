'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import AssignmentModal from '../../components/AssignmentModal';
import { Plus, Trash2 } from 'lucide-react';

export default function AhspPage() {
  const [ahspList, setAhspList] = useState([]);
  const [selectedAhsp, setSelectedAhsp] = useState(null);
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);

  // State Modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchAhspList = async () => {
    setLoading(true);
    const { data } = await supabase.from('ahsp_templates').select('*').order('name');
    if (data) {
      setAhspList(data);
      if (data.length > 0 && !selectedAhsp) {
        setSelectedAhsp(data[0]);
      }
    }
    setLoading(false);
  };

  const fetchAhspDetails = async (ahspId) => {
    if (!ahspId) return;
    const { data } = await supabase
      .from('ahsp_details')
      .select('*, master_hsd(nama_item, satuan, harga_dasar, tipe)')
      .eq('ahsp_template_id', ahspId);
    if (data) setDetails(data);
  };

  useEffect(() => { fetchAhspList(); }, []);
  
  useEffect(() => {
    if (selectedAhsp) fetchAhspDetails(selectedAhsp.id);
  }, [selectedAhsp]);

  // Handle Refresh dari Modal
  const handleRefreshDetails = () => {
    if (selectedAhsp) fetchAhspDetails(selectedAhsp.id);
  };

  if (loading) return <LoadingSpinner text="Memuat Katalog AHSP..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen flex gap-6">
      
      {/* PANEL KIRI: DAFTAR AHSP */}
      <div className="w-1/3 bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-140px)]">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h2 className="text-sm font-bold text-slate-800">Daftar Katalog AHSP</h2>
          <button className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Plus size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {ahspList.map(ahsp => (
            <button
              key={ahsp.id}
              onClick={() => setSelectedAhsp(ahsp)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors border ${selectedAhsp?.id === ahsp.id ? 'bg-blue-50 border-blue-200' : 'border-transparent hover:bg-slate-50'}`}
            >
              <p className={`text-sm font-bold ${selectedAhsp?.id === ahsp.id ? 'text-blue-700' : 'text-slate-700'}`}>{ahsp.name}</p>
              <p className="text-xs text-slate-500">Satuan: {ahsp.unit}</p>
            </button>
          ))}
        </div>
      </div>

      {/* PANEL KANAN: DETAIL KOMPONEN */}
      <div className="w-2/3 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-140px)]">
        {selectedAhsp ? (
          <>
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{selectedAhsp.name}</h2>
                <p className="text-xs text-slate-500">Satuan: {selectedAhsp.unit}</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow transition-colors flex items-center gap-2"
              >
                <Plus size={16} /> Tambah Komponen
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2 border">No</th>
                    <th className="p-2 border">Uraian</th>
                    <th className="p-2 border">Kode</th>
                    <th className="p-2 border text-center">Satuan</th>
                    <th className="p-2 border text-center">Koefisien</th>
                    <th className="p-2 border text-right">Harga Satuan</th>
                    <th className="p-2 border text-right">Jumlah Harga</th>
                  </tr>
                </thead>
                <tbody>
                  {details.length === 0 && (
                    <tr><td colSpan={7} className="text-center p-6 text-slate-400 italic">Belum ada komponen.</td></tr>
                  )}
                  {details.map((d, idx) => {
                    const hsd = d.master_hsd || {};
                    const jumlah = (Number(d.koefisien) * Number(hsd.harga_dasar || 0));
                    return (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="p-2 border text-center">{idx + 1}</td>
                        <td className="p-2 border">{hsd.nama_item || '-'}</td>
                        <td className="p-2 border text-xs text-slate-500">{hsd.tipe || '-'}</td>
                        <td className="p-2 border text-center">{hsd.satuan || '-'}</td>
                        <td className="p-2 border text-center">{d.koefisien}</td>
                        <td className="p-2 border text-right">Rp {Number(hsd.harga_dasar || 0).toLocaleString('id-ID')}</td>
                        <td className="p-2 border text-right font-bold">Rp {jumlah.toLocaleString('id-ID')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">Pilih AHSP di sebelah kiri</div>
        )}
      </div>

      {/* RENDER MODAL DENGAN PROPS YANG BENAR */}
      <AssignmentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        ahspId={selectedAhsp?.id} 
        onRefresh={handleRefreshDetails} 
      />
    </div>
  );
}
