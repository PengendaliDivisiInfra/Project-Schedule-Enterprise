'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { AlertTriangle, CheckCircle2, ShieldAlert, Plus, Edit, Trash2, X, Loader2, Save } from 'lucide-react';

export default function RisksPage() {
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const [formData, setFormData] = useState({
    risk_code: '', description: '', category: 'Teknis', probability: 2, impact: 2, mitigation_plan: '', status: 'Open'
  });

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRisks = async () => {
    setLoading(true);
    const { data } = await supabase.from('project_risks').select('*').order('risk_score', { ascending: false });
    if (data) setRisks(data);
    setLoading(false);
  };

  useEffect(() => { fetchRisks(); }, []);

  const handleOpenAdd = () => {
    setEditingRisk(null);
    setFormData({ risk_code: `R-${String(risks.length + 1).padStart(2, '0')}`, description: '', category: 'Teknis', probability: 2, impact: 2, mitigation_plan: '', status: 'Open' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (risk) => {
    setEditingRisk(risk);
    setFormData(risk);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      risk_code: formData.risk_code,
      description: formData.description,
      category: formData.category,
      probability: Number(formData.probability),
      impact: Number(formData.impact),
      mitigation_plan: formData.mitigation_plan,
      status: formData.status
    };

    let errorMsg = null;
    if (editingRisk) {
      const { error } = await supabase.from('project_risks').update(payload).eq('id', editingRisk.id);
      if (error) errorMsg = error.message;
    } else {
      const { error } = await supabase.from('project_risks').insert([payload]);
      if (error) errorMsg = error.message;
    }

    if (errorMsg) {
      alert("Gagal menyimpan: " + errorMsg);
    } else {
      setIsModalOpen(false);
      showToast('success', 'Data risiko berhasil disimpan!');
      fetchRisks();
    }
    setIsSaving(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const { error } = await supabase.from('project_risks').delete().eq('id', deleteTarget.id);
    if (error) {
      alert("Gagal menghapus: " + error.message);
    } else {
      showToast('danger', 'Risiko berhasil dihapus.');
      fetchRisks();
    }
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  if (loading) return <LoadingSpinner text="Memuat Risk Register..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen relative">
      
      {/* TOAST */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {toast.message}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="text-red-600" /> Project Risk Register
            </h1>
            <p className="text-sm text-slate-500 mt-1">Identifikasi risiko, penilaian dampak, dan rencana mitigasi.</p>
          </div>
          <button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition-colors flex items-center gap-2">
            <Plus size={16} /> Identifikasi Risiko Baru
          </button>
        </div>

        {/* MATRIKS RISIKO 3x3 */}
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-700 mb-4 text-center">Matriks Probabilitas vs Dampak</h3>
          <div className="grid grid-cols-4 gap-2 max-w-2xl mx-auto text-center text-xs font-bold text-white">
            <div className="bg-slate-200 text-slate-700 rounded-tl-lg p-2 flex items-center justify-center">Probabilitas \ Dampak</div>
            <div className="bg-slate-200 text-slate-700 p-2">Rendah (1)</div>
            <div className="bg-slate-200 text-slate-700 p-2">Sedang (2)</div>
            <div className="bg-slate-200 text-slate-700 rounded-tr-lg p-2">Tinggi (3)</div>

            <div className="bg-slate-200 text-slate-700 p-2">Tinggi (3)</div>
            <div className="bg-amber-400 p-4 rounded">3 (Medium)</div>
            <div className="bg-orange-500 p-4 rounded">6 (High)</div>
            <div className="bg-red-600 p-4 rounded">9 (Extreme)</div>

            <div className="bg-slate-200 text-slate-700 p-2">Sedang (2)</div>
            <div className="bg-green-500 p-4 rounded">2 (Low)</div>
            <div className="bg-amber-400 p-4 rounded">4 (Medium)</div>
            <div className="bg-orange-500 p-4 rounded">6 (High)</div>

            <div className="bg-slate-200 text-slate-700 p-2 rounded-bl-lg">Rendah (1)</div>
            <div className="bg-green-500 p-4 rounded">1 (Low)</div>
            <div className="bg-green-500 p-4 rounded">2 (Low)</div>
            <div className="bg-amber-400 p-4 rounded">3 (Medium)</div>
          </div>
        </div>

        {/* TABEL RISIKO */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-16">Kode</th>
                  <th className="p-3">Deskripsi Risiko</th>
                  <th className="p-3 w-24">Kategori</th>
                  <th className="p-3 text-center w-20">Skor</th>
                  <th className="p-3 w-64">Rencana Mitigasi</th>
                  <th className="p-3 text-center w-24">Status</th>
                  <th className="p-3 text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {risks.length === 0 && (
                  <tr><td colSpan={7} className="p-10 text-center text-slate-500 italic">Belum ada risiko yang teridentifikasi.</td></tr>
                )}
                {risks.map((risk) => (
                  <tr key={risk.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-700">{risk.risk_code}</td>
                    <td className="p-3 text-slate-800 font-medium">{risk.description}</td>
                    <td className="p-3"><span className="text-[10px] bg-slate-100 px-2 py-1 rounded border">{risk.category}</span></td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded font-bold text-xs ${
                        risk.risk_score >= 6 ? 'bg-red-100 text-red-700' : 
                        risk.risk_score >= 4 ? 'bg-orange-100 text-orange-700' : 
                        'bg-green-100 text-green-700'
                      }`}>
                        {risk.risk_score}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 text-xs">{risk.mitigation_plan || '-'}</td>
                    <td className="p-3 text-center">
                      <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${
                        risk.status === 'Open' ? 'bg-red-50 text-red-600 border border-red-200' : 
                        risk.status === 'Mitigated' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 
                        'bg-green-50 text-green-600 border border-green-200'
                      }`}>{risk.status}</span>
                    </td>
                    <td className="p-3 text-center text-blue-600 font-medium text-xs whitespace-nowrap">
                      <button onClick={() => handleOpenEdit(risk)} className="hover:underline"><Edit size={14} className="inline mr-1"/> Edit</button> | 
                      <button onClick={() => setDeleteTarget(risk)} className="text-red-500 hover:underline ml-1">Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL FORM RISIKO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">{editingRisk ? '✏️ Edit Risiko' : '🚨 Identifikasi Risiko Baru'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Kode Risiko</label>
                  <input required type="text" value={formData.risk_code} onChange={e => setFormData({...formData, risk_code: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">Kategori</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    <option value="Teknis">Teknis / Engineering</option>
                    <option value="Keuangan">Keuangan / Finansial</option>
                    <option value="Cuaca">Cuaca / Alam</option>
                    <option value="Sosial">Sosial / Masyarakat</option>
                    <option value="K3">K3 / Keselamatan</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Deskripsi Risiko</label>
                <textarea required rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="Contoh: Keterlambatan pengiriman besi tulangan akibat cuaca buruk." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Probabilitas (1-3)</label>
                  <select value={formData.probability} onChange={e => setFormData({...formData, probability: Number(e.target.value)})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    <option value="1">1 - Rendah (Kemungkinan kecil terjadi)</option>
                    <option value="2">2 - Sedang (Mungkin terjadi)</option>
                    <option value="3">3 - Tinggi (Sangat mungkin terjadi)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Dampak (1-3)</label>
                  <select value={formData.impact} onChange={e => setFormData({...formData, impact: Number(e.target.value)})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    <option value="1">1 - Rendah (Dampak kecil)</option>
                    <option value="2">2 - Sedang (Mengganggu jadwal/biaya)</option>
                    <option value="3">3 - Tinggi (Menghentikan proyek)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Rencana Mitigasi</label>
                <textarea rows="3" value={formData.mitigation_plan} onChange={e => setFormData({...formData, mitigation_plan: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="Tindakan pencegahan atau rencana cadangan..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="Open">Open (Belum Ditangani)</option>
                  <option value="Mitigated">Mitigated (Sudah Diminimalisir)</option>
                  <option value="Closed">Closed (Selesai/Dilewati)</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Batal</button>
                <button type="submit" disabled={isSaving} className={`px-6 py-2 text-sm font-bold text-white rounded-lg shadow-md transition-all flex items-center gap-2 ${isSaving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {isSaving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan...</> : <><Save size={16}/> Simpan Risiko</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG HAPUS */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in text-center p-6">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Risiko Ini?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Anda akan menghapus <strong className="text-slate-800">{deleteTarget.risk_code}</strong>.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 w-full transition-colors disabled:opacity-50">Batal</button>
              <button onClick={handleDeleteConfirm} disabled={isDeleting} className="px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-md w-full transition-colors flex items-center justify-center gap-2 disabled:bg-red-400">
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
