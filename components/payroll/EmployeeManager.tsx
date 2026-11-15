"use client";
import { useEffect, useState } from 'react';
import { Users, Plus, X, CheckCircle, AlertCircle, Edit3, Save, Trash2, Building, Calculator } from 'lucide-react';
import { getEmployees, createEmployee, updateEmployee, softDeleteEmployee } from '@/lib/services/payroll-service';
import { useRole } from '@/lib/hooks/useRole';
import type { Employee } from '@/types/payroll';
import LoadingSpinner from '@/components/LoadingSpinner';

export function EmployeeManager({ projectId }: { projectId: string }) {
  const { can } = useRole(projectId);
  const canEdit = can('MANAGE_COA'); 

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  const [form, setForm] = useState<Partial<Employee>>({
    name: '', role_title: '', nik: '', work_location: '', employee_type: 'Project', 
    is_all_in: false,
    base_salary: 0, tunjangan: 0, daily_rate: 0, overtime_rate: 0, meal_allowance: 0, 
    bank_name: '', bank_account: '',
    employment_status: 'Active', resignation_date: null
  });

  const [salaryInput, setSalaryInput] = useState({ base: '0', tunjangan: '0', daily: '0', overtime: '0', meal: '0' });

  const showToast = (msg: string, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3000);
  };

  const formatNumber = (val: number | string) => {
    const num = typeof val === 'string' ? parseInt(val.replace(/\./g, ''), 10) : val;
    if (isNaN(num)) return '0';
    return new Intl.NumberFormat('id-ID').format(num);
  };

  const handleNumericChange = (field: keyof typeof salaryInput, value: string, stateKey: keyof Employee) => {
    const rawValue = value.replace(/\D/g, '');
    setForm(prev => ({ ...prev, [stateKey]: Number(rawValue) || 0 }));
    setSalaryInput(prev => ({ ...prev, [field]: formatNumber(rawValue) }));
  };

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await getEmployees(projectId);
      setEmployees(data);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [projectId]);

  const handleOpenModal = (emp: Employee | null = null) => {
    setSelectedEmp(emp);
    if (emp) {
      setForm({ ...emp, resignation_date: emp.resignation_date ? emp.resignation_date.split('T')[0] : null });
      setSalaryInput({
        base: formatNumber(emp.base_salary),
        tunjangan: formatNumber(emp.tunjangan || 0),
        daily: formatNumber(emp.daily_rate),
        overtime: formatNumber(emp.overtime_rate),
        meal: formatNumber(emp.meal_allowance)
      });
    } else {
      setForm({
        name: '', role_title: '', nik: '', work_location: '', employee_type: 'Project', 
        is_all_in: false,
        base_salary: 0, tunjangan: 0, daily_rate: 0, overtime_rate: 0, meal_allowance: 0, 
        bank_name: '', bank_account: '',
        employment_status: 'Active', resignation_date: null
      });
      setSalaryInput({ base: '0', tunjangan: '0', daily: '0', overtime: '0', meal: '0' });
    }
    setShowDeleteConfirm(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    if (!form.name || !form.role_title) return showToast("Nama dan Jabatan wajib diisi!", "error");
    
    setIsSaving(true);
    try {
      const payload = {
        ...form,
        project_id: projectId,
        resignation_date: form.employment_status !== 'Active' ? form.resignation_date : null
      };

      if (selectedEmp) {
        await updateEmployee(selectedEmp.id, payload);
        showToast("Data Karyawan diperbarui!");
      } else {
        await createEmployee(payload);
        showToast("Karyawan baru ditambahkan!");
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmp) return;
    setIsDeleting(true);
    try {
      await softDeleteEmployee(selectedEmp.id);
      showToast("Data Karyawan telah diarsipkan.");
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatRp = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);

  return (
    <div className="space-y-4 animate-in fade-in">
      {toast.show && (
        <div className={`fixed top-5 right-5 z-[10000] flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
          <span className="font-semibold text-sm">{toast.msg}</span>
        </div>
      )}

      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-600" /> Master Karyawan (Payroll)</h3>
          <p className="text-sm text-slate-500">Kelola data staf kantor dan staf proyek beserta status kepegawaian.</p>
        </div>
        {canEdit && (
          <button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-colors">
            <Plus className="w-4 h-4" /> Tambah Karyawan
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-800 text-white text-xs uppercase border-b">
            <tr>
              <th className="p-3 font-bold">Nama / NIK</th>
              <th className="p-3 font-bold text-center">Status</th>
              <th className="p-3 font-bold text-center">Tipe & Skema</th>
              <th className="p-3 font-bold text-right">Gaji Pokok / Tunjangan</th>
              <th className="p-3 font-bold text-right">Upah Harian</th>
              <th className="p-3 font-bold text-right">Lembur / Makan</th>
              <th className="p-3 font-bold text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-0">
                  <LoadingSpinner text="Memuat data karyawan..." />
                </td>
              </tr>
            ) : employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50">
                <td className="p-3">
                  <div className={`font-semibold ${emp.employment_status !== 'Active' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{emp.name}</div>
                  <div className="flex gap-2 items-center mt-0.5">
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">NIK: {emp.nik || '-'}</span>
                    <span className="text-xs text-slate-500">{emp.role_title}</span>
                  </div>
                </td>
                <td className="p-3 text-center">
                   <span className={`px-2 py-1 rounded text-[10px] font-bold ${emp.employment_status === 'Active' ? 'bg-emerald-100 text-emerald-700' : emp.employment_status === 'Resigned' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                    {emp.employment_status === 'Active' ? 'Aktif' : emp.employment_status === 'Resigned' ? 'Resign' : 'Pindah'}
                   </span>
                </td>
                <td className="p-3 text-center">
                  <div className="flex flex-col gap-1 items-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${emp.employee_type === 'Office' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                      {emp.employee_type === 'Office' ? 'Kantor (Bulanan)' : 'Proyek (Harian)'}
                    </span>
                    {emp.is_all_in ? (
                      <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded flex items-center gap-1"><Calculator size={10}/> All-In</span>
                    ) : (
                      <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded">Reguler</span>
                    )}
                  </div>
                </td>
                
                <td className="p-3 text-right font-mono">
                  <div className="font-bold text-slate-700">{emp.employee_type === 'Office' ? formatRp(emp.base_salary) : '-'}</div>
                  {emp.tunjangan > 0 && <div className="text-[10px] text-emerald-600 font-semibold">+ Tunj: {formatRp(emp.tunjangan)}</div>}
                </td>

                <td className="p-3 text-right font-mono font-bold text-slate-700">
                  {emp.employee_type === 'Project' ? formatRp(emp.daily_rate) : '-'}
                </td>

                <td className="p-3 text-right font-mono text-slate-600 text-xs">
                  {emp.is_all_in ? (
                    <div className="text-[10px] text-purple-600 font-bold">L: {formatRp(emp.overtime_rate)}/jam</div>
                  ) : (
                    <>
                      <div>L: {formatRp(emp.overtime_rate)}/jam</div>
                    </>
                  )}
                  <div className="text-slate-400">M: {formatRp(emp.meal_allowance)}/hari</div>
                </td>

                <td className="p-3 text-center">
                  {canEdit && <button onClick={() => handleOpenModal(emp)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg"><Edit3 className="w-4 h-4" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 flex flex-col">
            <div className="p-4 border-b bg-indigo-50 flex justify-between items-center">
              <h3 className="font-bold text-indigo-800">{selectedEmp ? 'Edit Karyawan' : 'Tambah Karyawan'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-indigo-500 hover:text-indigo-700"><X className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Nama Lengkap *</label>
                    <input type="text" required value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="w-full border p-2 rounded-md font-semibold outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">NIK Karyawan</label>
                    <input type="text" value={form.nik || ''} onChange={e => setForm({...form, nik: e.target.value})} className="w-full border p-2 rounded-md font-mono outline-none" placeholder="EMP-001" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Jabatan *</label>
                    <input type="text" required value={form.role_title || ''} onChange={e => setForm({...form, role_title: e.target.value})} className="w-full border p-2 rounded-md font-semibold outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Lokasi Penempatan</label>
                    <input type="text" value={form.work_location || ''} onChange={e => setForm({...form, work_location: e.target.value})} className="w-full border p-2 rounded-md outline-none" placeholder="Contoh: D.I Saddang / HQ" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Status Kepegawaian</label>
                    <select value={form.employment_status} onChange={e => setForm({...form, employment_status: e.target.value as any})} className="w-full border p-2 rounded-md bg-white font-semibold outline-none">
                      <option value="Active">Aktif</option>
                      <option value="Resigned">Resign / Keluar</option>
                      <option value="Transferred">Pindah Proyek</option>
                    </select>
                  </div>
                  {form.employment_status !== 'Active' && (
                    <div>
                      <label className="block text-xs font-bold text-rose-600 mb-1">Tanggal Efektif Keluar/Pindah</label>
                      <input type="date" required value={form.resignation_date || ''} onChange={e => setForm({...form, resignation_date: e.target.value})} className="w-full border border-rose-300 p-2 rounded-md font-semibold outline-none text-rose-700" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Tipe Karyawan *</label>
                  <select value={form.employee_type} onChange={e => setForm({...form, employee_type: e.target.value as any})} className="w-full border p-2 rounded-md bg-white font-semibold outline-none">
                    <option value="Project">Karyawan Proyek (Sistem Mingguan / Harian)</option>
                    <option value="Office">Karyawan Kantor (Sistem Bulanan)</option>
                  </select>
                </div>

                {/* TOGGLE SWITCH ALL-IN */}
                <div className="flex items-center justify-between bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div>
                    <label className="block text-sm font-bold text-purple-900 flex items-center gap-2"><Calculator size={16}/> Sistem Gaji All-In (Lump Sum)</label>
                    <p className="text-xs text-purple-600 mt-1">Gaji tetap dibayar penuh, Uang Makan dipotong jika tidak masuk.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, is_all_in: !form.is_all_in })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_all_in ? 'bg-purple-600' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.is_all_in ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* FORM KOMPONEN GAJI (TIDAK DISABLE, TETAP BISA DIISI) */}
                <div className="bg-slate-50 p-4 rounded-lg border space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase">Komponen Gaji</h4>
                  
                  {form.employee_type === 'Office' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Gaji Pokok Bulanan (Rp)</label>
                      <input type="text" value={salaryInput.base} onChange={e => handleNumericChange('base', e.target.value, 'base_salary')} className="w-full border p-2 rounded-md font-mono text-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Upah Harian (Rp)</label>
                      <input type="text" value={salaryInput.daily} onChange={e => handleNumericChange('daily', e.target.value, 'daily_rate')} className="w-full border p-2 rounded-md font-mono text-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-indigo-700 mb-1">Tunjangan Tetap (Rp)</label>
                    <input type="text" value={salaryInput.tunjangan} onChange={e => handleNumericChange('tunjangan', e.target.value, 'tunjangan')} className="w-full border border-indigo-200 bg-indigo-50/50 p-2 rounded-md font-mono text-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Contoh: 500.000" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Upah Lembur / Jam (Rp)</label>
                      <input type="text" value={salaryInput.overtime} onChange={e => handleNumericChange('overtime', e.target.value, 'overtime_rate')} className="w-full border p-2 rounded-md font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Uang Makan / Hari (Rp)</label>
                      <input type="text" value={salaryInput.meal} onChange={e => handleNumericChange('meal', e.target.value, 'meal_allowance')} className="w-full border p-2 rounded-md font-mono outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Nama Bank</label>
                    <input type="text" value={form.bank_name || ''} onChange={e => setForm({...form, bank_name: e.target.value})} className="w-full border p-2 rounded-md outline-none" placeholder="BCA / Mandiri" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">No. Rekening</label>
                    <input type="text" value={form.bank_account || ''} onChange={e => setForm({...form, bank_account: e.target.value})} className="w-full border p-2 rounded-md font-mono outline-none" placeholder="12345678" />
                  </div>
                </div>

                {selectedEmp && canEdit && (
                  <div className="pt-3 border-t border-slate-200">
                    <button type="button" onClick={() => setShowDeleteConfirm(true)} className="w-full px-4 py-2 text-sm font-bold text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-100 rounded-lg flex justify-center items-center gap-2 transition-colors">
                      <Trash2 className="w-4 h-4" /> Nonaktifkan / Arsipkan Karyawan
                    </button>
                  </div>
                )}
              </div>

              <div className="p-3 border-t bg-slate-50 flex justify-end gap-2 mt-auto">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border rounded-md">Batal</button>
                <button type="submit" disabled={isSaving} className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm flex items-center gap-2">
                  {isSaving ? 'Menyimpan...' : <><Save className="w-4 h-4"/> Simpan Karyawan</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL: CONFIRM DELETE */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 flex flex-col p-6 text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle className="w-8 h-8 text-rose-600" /></div>
            <h3 className="text-lg font-bold text-slate-800">Arsipkan Karyawan?</h3>
            <p className="text-sm text-slate-600 mt-2 mb-6">Data akan disembunyikan dari sistem (Soft Delete). Riwayat absensi dan gaji tetap tersimpan untuk audit.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-lg">Batal</button>
              <button onClick={handleDelete} disabled={isDeleting} className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-2 shadow-sm">
                {isDeleting ? 'Memproses...' : 'Ya, Arsipkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}