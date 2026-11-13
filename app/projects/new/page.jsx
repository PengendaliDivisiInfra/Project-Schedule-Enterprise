'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useProject } from '../../../context/ProjectContext';
import { 
  Building2, Calendar, ShieldCheck, ChevronRight, ChevronLeft, 
  Loader2, CheckCircle2, AlertCircle 
} from 'lucide-react';

export default function NewProjectWizard() {
  const router = useRouter();
  const { setActiveProjectId } = useProject(); // Asumsi Context Anda punya fungsi ini
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // STATE MANAGEMENT TERPUSAT
  const [formData, setFormData] = useState({
    // Step 1
    name: '',
    location: '',
    contract_value: '',
    // Step 2
    baseline_start: '',
    baseline_finish: '',
    work_days: 'Senin - Jumat',
    hours_per_day: '8',
    overhead_pct: '5',
    // Step 3
    owner_name: '',
    company_name: '',
    consultant_name: '',
    contract_number: '',
    spmk_number: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // VALIDASI TIAP LANGKAH
  const validateStep = () => {
    setErrorMsg('');
    if (step === 1) {
      if (!formData.name || !formData.location) {
        setErrorMsg('Nama Proyek dan Lokasi wajib diisi!');
        return false;
      }
    }
    if (step === 2) {
      if (!formData.baseline_start || !formData.baseline_finish) {
        setErrorMsg('Tanggal Mulai dan Selesai wajib diisi!');
        return false;
      }
      if (new Date(formData.baseline_finish) < new Date(formData.baseline_start)) {
        setErrorMsg('Tanggal Selesai tidak boleh mendahului Tanggal Mulai!');
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) setStep(prev => prev + 1);
  };
  const prevStep = () => {
    setErrorMsg('');
    setStep(prev => prev - 1);
  };

  // FUNGSI EKSEKUSI SIMPAN KE DATABASE
  const handleSubmit = async () => {
    if (!validateStep()) return;
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Dapatkan User ID yang sedang login
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Sesi login tidak valid. Silakan login ulang.');

      // 2. Insert ke tabel PROJECTS
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert([{
          name: formData.name,
          location: formData.location,
          contract_value: parseFloat(formData.contract_value) || 0,
          baseline_start: formData.baseline_start,
          baseline_finish: formData.baseline_finish,
          work_days: formData.work_days,
          hours_per_day: parseFloat(formData.hours_per_day) || 8,
          overhead_pct: parseFloat(formData.overhead_pct) || 0,
          owner_name: formData.owner_name,
          company_name: formData.company_name,
          consultant_name: formData.consultant_name,
          contract_number: formData.contract_number,
          spmk_number: formData.spmk_number,
          owner_id: user.id // Set sebagai pemilik
        }])
        .select()
        .single();

      if (projectError) throw projectError;
      const newProjectId = projectData.id;

      // 3. OTOMATIS DAFTARKAN USER SEBAGAI PROJECT MANAGER
      const { error: memberError } = await supabase
        .from('project_members')
        .insert([{
          project_id: newProjectId,
          user_id: user.id,
          role: 'Project Manager'
        }]);

      if (memberError) throw memberError;

      // 4. Trigger Toast Global (Sesuai Aturan Mutlak)
      window.dispatchEvent(new CustomEvent('app-toast', { 
        detail: { message: 'Proyek berhasil dibuat! Anda terdaftar sebagai Project Manager.', type: 'success' } 
      }));

      // 5. Redirect ke Halaman Tasks
      if (setActiveProjectId) setActiveProjectId(newProjectId);
      router.push('/tasks');

    } catch (error) {
      console.error(error);
      setErrorMsg(error.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex justify-center items-start">
      <div className="max-w-3xl w-full bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        
        {/* HEADER WIZARD */}
        <div className="bg-slate-900 p-6 text-white">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="text-indigo-400" /> Setup Proyek Baru
          </h1>
          <p className="text-slate-400 text-sm mt-1">Langkah {step} dari 3 - Inisialisasi Proyek Konstruksi</p>
          
          {/* Progress Bar */}
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map(i => (
              <div key={i} className={`h-2 flex-1 rounded-full transition-all duration-300 ${i <= step ? 'bg-indigo-500' : 'bg-slate-700'}`} />
            ))}
          </div>
        </div>

        {/* BODY WIZARD */}
        <div className="p-8">
          {errorMsg && (
            <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-200 flex items-center gap-2">
              <AlertCircle size={18} /> {errorMsg}
            </div>
          )}

          {/* LANGKAH 1: INFORMASI UTAMA */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-lg font-bold text-slate-800 border-b pb-2">Informasi Utama</h2>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nama Proyek *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="cth: Pembangunan Jembatan Layang" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Lokasi *</label>
                <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="cth: Jakarta Selatan" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nilai Kontrak (Rp)</label>
                <input type="number" name="contract_value" value={formData.contract_value} onChange={handleChange} placeholder="0" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
          )}

          {/* LANGKAH 2: WAKTU & KALENDER */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2"><Calendar size={20} /> Kalender & Waktu</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tanggal Mulai *</label>
                  <input type="date" name="baseline_start" value={formData.baseline_start} onChange={handleChange} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tanggal Selesai *</label>
                  <input type="date" name="baseline_finish" value={formData.baseline_finish} onChange={handleChange} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Hari Kerja</label>
                  <select name="work_days" value={formData.work_days} onChange={handleChange} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                    <option value="Senin - Jumat">Senin - Jumat</option>
                    <option value="Senin - Sabtu">Senin - Sabtu</option>
                    <option value="Setiap Hari">Setiap Hari</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Jam Kerja / Hari</label>
                  <input type="number" name="hours_per_day" value={formData.hours_per_day} onChange={handleChange} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Overhead (%)</label>
                <input type="number" name="overhead_pct" value={formData.overhead_pct} onChange={handleChange} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
          )}

          {/* LANGKAH 3: LEGALITAS & PIHAK TERKAIT */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2"><ShieldCheck size={20} /> Legalitas & Pihak Terkait</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nama Pemberi Tugas (Owner)</label>
                  <input type="text" name="owner_name" value={formData.owner_name} onChange={handleChange} placeholder="cth: Kementerian PUPR" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nama Perusahaan (Kontraktor)</label>
                  <input type="text" name="company_name" value={formData.company_name} onChange={handleChange} placeholder="cth: PT. Maju Jaya" className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nomor Kontrak</label>
                  <input type="text" name="contract_number" value={formData.contract_number} onChange={handleChange} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nomor SPMK</label>
                  <input type="text" name="spmk_number" value={formData.spmk_number} onChange={handleChange} className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 mt-4">
                <p className="text-sm text-indigo-700 font-medium flex items-center gap-2">
                  <CheckCircle2 size={18} /> Anda akan otomatis terdaftar sebagai <strong>Project Manager (Owner)</strong> untuk proyek ini.
                </p>
              </div>
            </div>
          )}

        </div>

          {/* FOOTER WIZARD (TOMBOL NAVIGASI) */}
        <div className="bg-slate-50 p-6 border-t flex justify-between items-center">
          
          {/* PERBAIKAN: Tombol Kembali tidak lagi disabled. 
              Jika di step 1, klik kembali akan melempar user ke /projects */}
          <button 
            onClick={() => {
              if (step === 1) {
                router.push('/projects'); // Keluar dari wizard
              } else {
                prevStep(); // Mundur ke step sebelumnya
              }
            }} 
            disabled={loading} // Hanya disabled saat loading/saving
            className="flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-colors text-slate-700 hover:bg-slate-200"
          >
            <ChevronLeft size={18} /> {step === 1 ? 'Batal' : 'Kembali'}
          </button>

          {step < 3 ? (
            <button 
              onClick={nextStep} 
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-md transition-colors"
            >
              Lanjut <ChevronRight size={18} />
            </button>
          ) : (
            <button 
              onClick={handleSubmit} 
              disabled={loading}
              className="flex items-center gap-2 px-8 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm shadow-md transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />} 
              {loading ? 'Membuat Proyek...' : 'Buat Proyek Sekarang'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}