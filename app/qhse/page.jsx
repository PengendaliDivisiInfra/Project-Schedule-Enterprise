'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ShieldCheck, HardHat, CheckCircle2, AlertTriangle, Plus, Edit, X, Loader2, Save, Image as ImageIcon, UploadCloud } from 'lucide-react';

export default function QhsePage() {
  const [activeTab, setActiveTab] = useState('qc'); // 'qc' | 'hse'
  const [qcData, setQcData] = useState([]);
  const [hseData, setHseData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // States for Modals
  const [isQcModalOpen, setIsQcModalOpen] = useState(false);
  const [isHseModalOpen, setIsHseModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [qcFile, setQcFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState(null);

  // Form States (QA/QC)
  const [qcForm, setQcForm] = useState({ 
    wbs_code: '', inspector_name: '', status: 'Pending', notes: '', 
    testing_method: '', reference_standard: '', evidence_url: '', ncr_action: '' 
  });

  // Form States (HSE)
  const [hseForm, setHseForm] = useState({ 
    type: 'Safety Briefing', description: '', reporter_name: '', severity: 'Low', 
    action_taken: '', preventive_action: '', hse_manager_approval: '' 
  });

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: qc } = await supabase.from('qc_inspections').select('*').order('created_at', { ascending: false });
    if (qc) setQcData(qc);

    const { data: hse } = await supabase.from('hse_logs').select('*').order('created_at', { ascending: false });
    if (hse) setHseData(hse);
    
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveQc = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    let finalEvidenceUrl = qcForm.evidence_url; // Simpan url lama jika ada

    try {
      // 1. JIKA ADA FILE YANG DIPILIH, UPLOAD KE SUPABASE STORAGE
      if (qcFile) {
        setIsUploading(true);
        const fileExt = qcFile.name.split('.').pop();
        const fileName = `qc_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('evidence')
          .upload(fileName, qcFile);
          
        if (uploadError) throw new Error("Gagal upload file: " + uploadError.message);

        // 2. DAPATKAN LINK PUBLIC
        const { data: urlData } = supabase.storage
          .from('evidence')
          .getPublicUrl(fileName);
          
        finalEvidenceUrl = urlData.publicUrl;
      }

      // 3. SIMPAN DATA KE DATABASE
      const payload = { ...qcForm, evidence_url: finalEvidenceUrl, inspection_date: new Date().toISOString() };
      const { error } = await supabase.from('qc_inspections').insert([payload]);
      
      if (error) throw error;

      setIsQcModalOpen(false);
      showToast('success', 'Data Inspeksi QA/QC berhasil disimpan!');
      setQcForm({ wbs_code: '', inspector_name: '', status: 'Pending', notes: '', testing_method: '', reference_standard: '', evidence_url: '', ncr_action: '' });
      setQcFile(null); // Reset file
      fetchData();

    } catch (error) {
      alert(error.message);
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  const handleSaveHse = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const payload = { ...hseForm, log_date: new Date().toISOString() };
    const { error } = await supabase.from('hse_logs').insert([payload]);
    
    if (error) alert(error.message);
    else {
      setIsHseModalOpen(false);
      showToast('success', 'Laporan HSE berhasil disimpan!');
      setHseForm({ type: 'Safety Briefing', description: '', reporter_name: '', severity: 'Low', action_taken: '', preventive_action: '', hse_manager_approval: '' });
      fetchData();
    }
    setIsSaving(false);
  };

  if (loading) return <LoadingSpinner text="Memuat Data QHSE..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen relative">
      
      {/* TOAST */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          <CheckCircle2 size={18} /> {toast.message}
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-4">
        
        {/* HEADER & TABS */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="text-blue-600" /> Quality, Health, Safety & Environment (QHSE)
            </h1>
            <p className="text-sm text-slate-500 mt-1">Pusat kendali mutu pekerjaan dan keselamatan kerja lapangan.</p>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setActiveTab('qc')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'qc' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>QA/QC (Mutu)</button>
            <button onClick={() => setActiveTab('hse')} className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeTab === 'hse' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>HSE (K3L)</button>
          </div>
        </div>

        {/* TAB CONTENT: QA/QC */}
        {activeTab === 'qc' && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-blue-50/50">
              <h2 className="font-bold text-blue-800 flex items-center gap-2"><ShieldCheck size={18}/> Laporan Inspeksi Mutu (QA/QC)</h2>
              <button onClick={() => setIsQcModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow transition-colors flex items-center gap-2">
                <Plus size={16} /> Buat Inspeksi
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Tanggal</th><th className="p-3">WBS</th><th className="p-3">Inspektur</th>
                    <th className="p-3">Metode / Standar</th>
                    <th className="p-3 text-center">Status</th><th className="p-3">Tindakan NCR</th><th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {qcData.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">Belum ada data inspeksi.</td></tr>}
                  {qcData.map(qc => (
                    <tr key={qc.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-600 whitespace-nowrap">{new Date(qc.inspection_date).toLocaleDateString('id-ID')}</td>
                      <td className="p-3 font-mono font-bold">{qc.wbs_code}</td>
                      <td className="p-3">{qc.inspector_name}</td>
                      <td className="p-3 text-xs">
                        <span className="block font-medium">{qc.testing_method || '-'}</span>
                        <span className="text-slate-400">{qc.reference_standard || '-'}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${
                          qc.status === 'Approved' ? 'bg-green-100 text-green-700' : 
                          qc.status === 'Rejected' ? 'bg-red-100 text-red-700' : 
                          'bg-amber-100 text-amber-700'
                        }`}>{qc.status}</span>
                      </td>
                      <td className="p-3 text-slate-600 text-xs max-w-xs truncate" title={qc.ncr_action}>{qc.ncr_action || '-'}</td>
                      <td className="p-3 text-center text-blue-600 font-medium text-xs">
                        <button className="hover:underline"><Edit size={14} className="inline mr-1"/> Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB CONTENT: HSE */}
        {activeTab === 'hse' && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-amber-50/50">
              <h2 className="font-bold text-amber-800 flex items-center gap-2"><HardHat size={18}/> Laporan Keselamatan Kerja (HSE)</h2>
              <button onClick={() => setIsHseModalOpen(true)} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow transition-colors flex items-center gap-2">
                <Plus size={16} /> Buat Laporan
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Tanggal</th><th className="p-3">Tipe Laporan</th><th className="p-3">Deskripsi</th>
                    <th className="p-3 text-center">Severity</th><th className="p-3">Pencegahan</th><th className="p-3">Approval</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hseData.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">Belum ada laporan HSE.</td></tr>}
                  {hseData.map(hse => (
                    <tr key={hse.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-600 whitespace-nowrap">{new Date(hse.log_date).toLocaleDateString('id-ID')}</td>
                      <td className="p-3 font-bold">{hse.type}</td>
                      <td className="p-3 text-slate-700 max-w-xs truncate" title={hse.description}>{hse.description}</td>
                      <td className="p-3 text-center">
                        <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${
                          hse.severity === 'Critical' ? 'bg-red-600 text-white' : 
                          hse.severity === 'High' ? 'bg-orange-500 text-white' : 
                          hse.severity === 'Medium' ? 'bg-amber-400 text-slate-800' : 
                          'bg-green-100 text-green-700'
                        }`}>{hse.severity}</span>
                      </td>
                      <td className="p-3 text-slate-600 text-xs max-w-xs truncate" title={hse.preventive_action}>{hse.preventive_action || '-'}</td>
                      <td className="p-3 text-xs font-semibold">{hse.hse_manager_approval || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL QA/QC */}
      {isQcModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ShieldCheck className="text-blue-600"/> Form Inspeksi QA/QC</h2>
              <button onClick={() => setIsQcModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveQc} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Kode WBS</label><input required type="text" value={qcForm.wbs_code} onChange={e => setQcForm({...qcForm, wbs_code: e.target.value})} placeholder="cth: 3.1" className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Nama Inspektur</label><input required type="text" value={qcForm.inspector_name} onChange={e => setQcForm({...qcForm, inspector_name: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Metode Pengujian</label><input type="text" value={qcForm.testing_method} onChange={e => setQcForm({...qcForm, testing_method: e.target.value})} placeholder="cth: Slump Test / Uji Tarik" className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Standar Acuan (SNI/ASTM)</label><input type="text" value={qcForm.reference_standard} onChange={e => setQcForm({...qcForm, reference_standard: e.target.value})} placeholder="cth: SNI 2847:2019" className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              </div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Status</label><select value={qcForm.status} onChange={e => setQcForm({...qcForm, status: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"><option value="Pending">Pending (Menunggu)</option><option value="Approved">Approved (Lulus QC)</option><option value="Rejected">Rejected (Gagal QC / NCR)</option></select></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Catatan Lapangan (Keterangan)</label><textarea rows="2" value={qcForm.notes} onChange={e => setQcForm({...qcForm, notes: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Tindakan NCR (Jika Rejected)</label><textarea rows="2" value={qcForm.ncr_action} onChange={e => setQcForm({...qcForm, ncr_action: e.target.value})} placeholder="Tindakan perbaikan yang diminta..." className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" /></div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Upload Bukti Visual (Foto Lapangan)</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2">
                    <UploadCloud size={16} /> Pilih File Foto
                    <input type="file" accept="image/*" onChange={(e) => setQcFile(e.target.files[0])} className="hidden" />
                  </label>
                  <span className="text-xs text-slate-500 truncate max-w-[200px]">
                    {qcFile ? qcFile.name : 'Belum ada file dipilih'}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t"><button type="button" onClick={() => setIsQcModalOpen(false)} className="px-4 py-2 text-sm font-bold border rounded-lg hover:bg-slate-50">Batal</button><button type="submit" disabled={isSaving || isUploading} className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:bg-blue-400">
                  {(isSaving || isUploading) ? <><Loader2 size={16} className="animate-spin"/> Mengunggah...</> : <><Save size={16}/> Simpan</>}
                </button></div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HSE */}
      {isHseModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><HardHat className="text-amber-600"/> Form Laporan HSE (K3L)</h2>
              <button onClick={() => setIsHseModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveHse} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Tipe Laporan</label><select value={hseForm.type} onChange={e => setHseForm({...hseForm, type: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white">
                  <option value="Safety Briefing">Safety Briefing (Toolbox Meeting)</option>
                  <option value="Unsafe Act">Unsafe Act (Tindakan Tidak Aman)</option>
                  <option value="Unsafe Condition">Unsafe Condition (Kondisi Tidak Aman)</option>
                  <option value="Nearmiss">Nearmiss (Hampir Celaka)</option>
                  <option value="Accident">Accident (Kecelakaan)</option>
                  <option value="PAK">Penyakit Akibat Kerja (PAK)</option>
                </select></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Tingkat Keparahan</label><select value={hseForm.severity} onChange={e => setHseForm({...hseForm, severity: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white"><option value="Low">Low (Rendah)</option><option value="Medium">Medium (Sedang)</option><option value="High">High (Tinggi)</option><option value="Critical">Critical (Kritis)</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Nama Pelapor</label><input required type="text" value={hseForm.reporter_name} onChange={e => setHseForm({...hseForm, reporter_name: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Approval HSE Manager</label><input type="text" value={hseForm.hse_manager_approval} onChange={e => setHseForm({...hseForm, hse_manager_approval: e.target.value})} placeholder="Nama Manager HSE" className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" /></div>
              </div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Deskripsi Kejadian / Temuan</label><textarea required rows="2" value={hseForm.description} onChange={e => setHseForm({...hseForm, description: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Tindakan Langsung (Action Taken)</label><textarea rows="2" value={hseForm.action_taken} onChange={e => setHseForm({...hseForm, action_taken: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Rencana Pencegahan (Preventive Action)</label><textarea rows="2" value={hseForm.preventive_action} onChange={e => setHseForm({...hseForm, preventive_action: e.target.value})} className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none" /></div>
              
              <div className="flex justify-end gap-3 pt-4 border-t"><button type="button" onClick={() => setIsHseModalOpen(false)} className="px-4 py-2 text-sm font-bold border rounded-lg hover:bg-slate-50">Batal</button><button type="submit" disabled={isSaving} className="px-6 py-2 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 flex items-center gap-2">{isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Simpan</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

