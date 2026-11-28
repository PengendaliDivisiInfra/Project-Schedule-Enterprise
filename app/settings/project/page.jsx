'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useProject } from '../../../context/ProjectContext';
import { useRole } from '@/lib/hooks/useRole';
import { recordAuditEvent } from '@/lib/services/logs.service';
import {
  Save,
  Loader2,
  Building2,
  FileText,
  Calendar,
  ShieldCheck,
  Upload,
  ImageIcon,
  CheckCircle,
  XCircle,
  Lock,
  Wallet,
  AlertTriangle,
} from 'lucide-react';

export default function ProjectSettingsPage() {
  const { activeProjectId } = useProject();
  const { can, isApprover } = useRole(activeProjectId || undefined);
  const canEditFinancialGuards = can('APPROVE_FINANCE') || isApprover;

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [formData, setFormData] = useState({});
  const [initialGuards, setInitialGuards] = useState(null);

  const [toast, setToast] = useState(null);

  const showToast = (msg, type) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const fetchProject = async () => {
      if (!activeProjectId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('id', activeProjectId)
        .maybeSingle();

      if (data) {
        setFormData({
          ...data,
          budget_hard_stop: data.budget_hard_stop !== false,
          ring_fenced_cashflow: data.ring_fenced_cashflow !== false,
          hq_dropping_limit: Number(data.hq_dropping_limit || 0),
        });
        setInitialGuards({
          budget_hard_stop: data.budget_hard_stop !== false,
          ring_fenced_cashflow: data.ring_fenced_cashflow !== false,
          hq_dropping_limit: Number(data.hq_dropping_limit || 0),
        });
      }
      setLoading(false);
    };
    fetchProject();
  }, [activeProjectId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!activeProjectId) return;
    setIsSaving(true);

    try {
      const payload = { ...formData };
      delete payload.id;
      delete payload.created_at;

      if (payload.contract_value === '' || payload.contract_value === null) {
        payload.contract_value = 0;
      } else {
        payload.contract_value = Number(payload.contract_value);
      }

      if (canEditFinancialGuards) {
        payload.budget_hard_stop = Boolean(formData.budget_hard_stop);
        payload.ring_fenced_cashflow = Boolean(formData.ring_fenced_cashflow);
        payload.hq_dropping_limit = Math.max(0, Number(formData.hq_dropping_limit || 0));
      } else {
        delete payload.budget_hard_stop;
        delete payload.ring_fenced_cashflow;
        delete payload.hq_dropping_limit;
      }

      let { error } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', activeProjectId);

      // Fallback aman bila kolom proteksi belum tersedia di lingkungan lama
      if (error && error.code === '42703') {
        const {
          budget_hard_stop: _b,
          ring_fenced_cashflow: _r,
          hq_dropping_limit: _h,
          ...legacyPayload
        } = payload;
        const retry = await supabase
          .from('projects')
          .update(legacyPayload)
          .eq('id', activeProjectId);
        error = retry.error;
      }

      if (error) throw error;

      const newGuards = {
        budget_hard_stop: Boolean(formData.budget_hard_stop),
        ring_fenced_cashflow: Boolean(formData.ring_fenced_cashflow),
        hq_dropping_limit: Math.max(0, Number(formData.hq_dropping_limit || 0)),
      };

      await recordAuditEvent({
        projectId: activeProjectId,
        tableName: 'projects',
        action: 'UPDATE',
        recordId: activeProjectId,
        oldData: initialGuards,
        newData: {
          name: formData.name,
          contract_value: payload.contract_value,
          ...(canEditFinancialGuards ? newGuards : {}),
        },
      });

      setInitialGuards(newGuards);
      showToast('Pengaturan Proyek & Kontrol Proteksi berhasil disimpan!', 'success');
    } catch (err) {
      showToast('Gagal menyimpan: ' + (err?.message || 'Terjadi kesalahan'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (event) => {
    try {
      setIsUploadingLogo(true);
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Ukuran file maksimal 2MB');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${activeProjectId}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('project-assets').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('project-assets').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('projects').update({ logo_url: data.publicUrl }).eq('id', activeProjectId);
      if (updateError) throw updateError;

      setFormData((prev) => ({ ...prev, logo_url: data.publicUrl }));
      showToast('Logo berhasil diunggah!', 'success');
    } catch (error) {
      showToast('Gagal mengunggah logo: ' + error.message, 'error');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const formatRp = (num) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Number(num) || 0);

  if (!activeProjectId) {
    return (
      <div className="p-10 text-center text-slate-500 font-bold">
        Silakan pilih proyek terlebih dahulu di menu Manajemen Proyek.
      </div>
    );
  }
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen relative">
      {/* TOAST NOTIFICATION */}
      {toast && (
        <div
          className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg text-white font-medium z-[100] flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="text-indigo-600" /> Pengaturan Proyek (Standar PUPR &amp; Enterprise)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola informasi legalitas, administrasi, pihak proyek, serta kebijakan proteksi anggaran &amp; arus kas mandiri.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Logo Perusahaan */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center gap-2">
              <ImageIcon size={18} className="text-slate-600" />
              <h2 className="font-bold text-slate-800">Logo Perusahaan / Instansi</h2>
            </div>
            <div className="p-6 flex items-center gap-6">
              <div className="w-32 h-32 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center overflow-hidden relative group">
                {formData.logo_url ? (
                  <>
                    <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                    <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-all">
                      <span className="text-white text-xs font-bold">Ganti Logo</span>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-slate-400 text-center px-2">Belum ada logo</span>
                )}
              </div>
              <div>
                <label className="cursor-pointer bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition w-fit">
                  {isUploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {isUploadingLogo ? 'Mengunggah...' : 'Upload Logo Baru'}
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/svg+xml"
                    className="hidden"
                    onChange={handleLogoUpload}
                    disabled={isUploadingLogo}
                  />
                </label>
                <p className="text-xs text-slate-500 mt-2">
                  Format: PNG, JPG, SVG. Maksimal 2MB. <br />
                  Disarankan rasio 1:1 atau horizontal.
                </p>
              </div>
            </div>
          </div>

          {/* KONTROL PROTEKSI ANGGARAN & ARUS KAS MANDIRI (ENTERPRISE) */}
          <div className="bg-white rounded-xl shadow-sm border border-indigo-200 overflow-hidden">
            <div className="px-6 py-4 border-b bg-indigo-50/70 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock size={18} className="text-indigo-600" />
                <h2 className="font-bold text-indigo-950">Proteksi Anggaran &amp; Arus Kas Mandiri (Enterprise Guard)</h2>
              </div>
              {!canEditFinancialGuards && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Khusus Owner / Finance Manager / PM
                </span>
              )}
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                    formData.budget_hard_stop ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                  } ${canEditFinancialGuards ? 'cursor-pointer' : 'opacity-70 cursor-not-allowed'}`}
                >
                  <input
                    type="checkbox"
                    name="budget_hard_stop"
                    checked={Boolean(formData.budget_hard_stop)}
                    onChange={handleChange}
                    disabled={!canEditFinancialGuards}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-sm font-bold text-slate-800">
                      Hard-Stop Pagu RAB (3 Lapisan)
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Otomatis memblokir PO &amp; Kas Keluar bila melebihi Available Budget (Pagu - Committed - Actual).
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-colors ${
                    formData.ring_fenced_cashflow ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200'
                  } ${canEditFinancialGuards ? 'cursor-pointer' : 'opacity-70 cursor-not-allowed'}`}
                >
                  <input
                    type="checkbox"
                    name="ring_fenced_cashflow"
                    checked={Boolean(formData.ring_fenced_cashflow)}
                    onChange={handleChange}
                    disabled={!canEditFinancialGuards}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="block text-sm font-bold text-slate-800">
                      Ring-Fenced Cashflow Guard
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Mencegah pengeluaran proyek defisit menyedot kas kantor pusat di luar plafon Dropping HQ.
                    </span>
                  </div>
                </label>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <label className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Wallet size={14} className="text-indigo-600" /> Plafon Dropping Dana Kantor Pusat / HQ (Rp)
                  </span>
                  <span className="font-mono text-indigo-700">{formatRp(formData.hq_dropping_limit)}</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={100000}
                  name="hq_dropping_limit"
                  value={formData.hq_dropping_limit ?? 0}
                  onChange={handleChange}
                  disabled={!canEditFinancialGuards}
                  placeholder="0"
                  className="w-full border border-slate-300 p-2.5 rounded-lg text-sm font-mono font-bold bg-white disabled:bg-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-amber-600 shrink-0" />
                  Nilai <b>Rp 0</b> berarti proyek wajib 100% swadana dari DP/Termin klien. Naikkan plafon hanya jika direksi menyetujui talangan sementara dari kas pusat.
                </p>
              </div>
            </div>
          </div>

          {/* Informasi Dasar */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center gap-2">
              <FileText size={18} className="text-slate-600" />
              <h2 className="font-bold text-slate-800">Informasi Utama</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">Nama Proyek</label>
                <input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Lokasi</label>
                <input type="text" name="location" value={formData.location || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nama Pemberi Tugas (Owner)</label>
                <input type="text" name="owner_name" value={formData.owner_name || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="cth: Kementerian PUPR" />
              </div>
            </div>
          </div>

          {/* Data Kontraktor (Pihak Kesatu) */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center gap-2">
              <Building2 size={18} className="text-slate-600" />
              <h2 className="font-bold text-slate-800">Data Kontraktor (Pihak Kesatu)</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">Nama Perusahaan (Kontraktor)</label>
                <input type="text" name="company_name" value={formData.company_name || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">Alamat Perusahaan</label>
                <input type="text" name="contractor_address" value={formData.contractor_address || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Alamat lengkap perusahaan..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nama Penanggung Jawab (PIC)</label>
                <input type="text" name="contractor_pic_name" value={formData.contractor_pic_name || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="cth: Budi Santoso" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Jabatan Penanggung Jawab</label>
                <input type="text" name="contractor_pic_title" value={formData.contractor_pic_title || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="cth: Site Engineer" />
              </div>
            </div>
          </div>

          {/* Pihak Lain */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center gap-2">
              <FileText size={18} className="text-slate-600" />
              <h2 className="font-bold text-slate-800">Pihak Pengawas</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">Nama Konsultan Pengawas</label>
                <input type="text" name="consultant_name" value={formData.consultant_name || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
          </div>

          {/* Legalitas & Kontrak */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center gap-2">
              <ShieldCheck size={18} className="text-slate-600" />
              <h2 className="font-bold text-slate-800">Legalitas &amp; Kontrak</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Nomor Kontrak</label><input type="text" name="contract_number" value={formData.contract_number || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Nilai Kontrak (Rp)</label><input type="number" name="contract_value" value={formData.contract_value || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Kontrak</label><input type="date" name="contract_date" value={formData.contract_date || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Nomor SPMK</label><input type="text" name="spmk_number" value={formData.spmk_number || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Tanggal SPMK</label><input type="date" name="spmk_date" value={formData.spmk_date || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Berakhir (PHO)</label><input type="date" name="end_date" value={formData.end_date || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
            </div>
          </div>

          {/* Addendum */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center gap-2">
              <Calendar size={18} className="text-slate-600" />
              <h2 className="font-bold text-slate-800">Addendum (Jika Ada)</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Nomor Addendum</label><input type="text" name="addendum_number" value={formData.addendum_number || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
              <div><label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Addendum</label><input type="date" name="addendum_date" value={formData.addendum_date || ''} onChange={handleChange} className="w-full border p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-60">
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Simpan Pengaturan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
