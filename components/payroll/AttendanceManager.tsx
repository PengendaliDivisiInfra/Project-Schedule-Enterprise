"use client";
import { useEffect, useState, useMemo } from 'react';
import { 
  CalendarDays, Save, CheckCircle, AlertCircle, UserCheck, Clock, FileText, Loader2, 
  Users, Search, Filter, CheckSquare, AlertTriangle, MapPin, Fingerprint, LayoutGrid, List, X,
  Paperclip
} from 'lucide-react';
import { getMonthlyAttendance, getAttendanceByDate, saveAttendance } from '@/lib/services/payroll-service';
import { useRole } from '@/lib/hooks/useRole';
import LoadingSpinner from '@/components/LoadingSpinner';

// Helper untuk format tanggal
const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
const getDayName = (date: Date) => ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][date.getDay()];

export function AttendanceManager({ projectId }: { projectId: string }) {
  const { can } = useRole(projectId);
  const canEdit = can('MANAGE_COA');

  // State Mode & Waktu
  const [viewMode, setViewMode] = useState<'matrix' | 'daily'>('matrix');
  const [monthStr, setMonthStr] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false); 
  
  // State Filter & Pencarian
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'Project' | 'Office'>('ALL');

  // State Peringatan (Daily Mode)
  const [showUnmarkedWarning, setShowUnmarkedWarning] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });

  // State Quick Edit (Matrix Mode)
  const [editingCell, setEditingCell] = useState<{ empId: string, date: string, empName: string } | null>(null);
  const [popoverData, setPopoverData] = useState({ status: 'Present', clock_in: '08:00', clock_out: '17:00', overtime_hours: 0, notes: '' });
  const [isSavingCell, setIsSavingCell] = useState(false);

  const showToast = (msg: string, type = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast({ show: false, msg: '', type: 'success' }), 3000);
  };

  // ==========================================
  // FETCH DATA
  // ==========================================
  const loadData = async () => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    setIsSaved(false);
    try {
      if (viewMode === 'matrix') {
        const { result } = await getMonthlyAttendance(projectId, monthStr);
        setData(result || []); 
      } else {
        const res = await getAttendanceByDate(projectId, dateStr);
        setData(res || []); 
        const hasUnmarked = res.some((row: any) => row.status === 'Unmarked');
        if (!hasUnmarked && res.length > 0) setIsSaved(true);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [projectId, viewMode, monthStr, dateStr]);

  // ==========================================
  // LOGIKA MATRIX BULANAN
  // ==========================================
  const matrixDates = useMemo(() => {
    const year = parseInt(monthStr.split('-')[0]);
    const month = parseInt(monthStr.split('-')[1]);
    const days = getDaysInMonth(year, month);
    
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(year, month - 1, i + 1);
      const dStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      const isWeekend = d.getDay() === 0; // Minggu
      return { day: i + 1, dateStr: dStr, dayName: getDayName(d), isWeekend };
    });
  }, [monthStr]);

  const getStatusStyle = (status: string, isWeekend = false) => {
    if (isWeekend) return 'bg-slate-100 text-slate-400';
    switch (status) {
      case 'Present': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Sick': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Leave': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Cut': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Absent': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-white text-slate-300 border-transparent';
    }
  };

  const getStatusLetter = (status: string) => {
    switch (status) {
      case 'Present': return 'H';
      case 'Sick': return 'S';
      case 'Leave': return 'I';
      case 'Cut': return 'C';
      case 'Absent': return 'A';
      default: return '';
    }
  };

  const handleCellClick = (emp: any, date: string) => {
    if (!canEdit) return;
    const existing = emp.attendanceMap?.[date] || { status: 'Unmarked', clock_in: '', clock_out: '', overtime_hours: 0, notes: '' };
    
    setEditingCell({ empId: emp.id, date, empName: emp.name });
    setPopoverData({
      status: existing.status === 'Unmarked' ? 'Present' : existing.status,
      clock_in: existing.clock_in || (existing.status === 'Unmarked' ? '08:00' : ''),
      clock_out: existing.clock_out || (existing.status === 'Unmarked' ? '17:00' : ''),
      overtime_hours: existing.overtime_hours || 0,
      notes: existing.notes || ''
    });
  };

  const handleSavePopover = async () => {
    if (!editingCell || !projectId) return;
    setIsSavingCell(true);
    try {
      await saveAttendance({
        employee_id: editingCell.empId,
        attendance_date: editingCell.date,
        status: popoverData.status,
        clock_in: popoverData.status === 'Present' ? popoverData.clock_in : '',
        clock_out: popoverData.status === 'Present' ? popoverData.clock_out : '',
        overtime_hours: Number(popoverData.overtime_hours) || 0,
        notes: popoverData.notes
      });
      showToast("Absensi berhasil diperbarui.", "success");
      setEditingCell(null);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSavingCell(false);
    }
  };

  // ==========================================
  // LOGIKA DETAIL HARIAN
  // ==========================================
  const handleDailyChange = (employeeId: string, field: string, value: any) => {
    setData(prev => prev.map(row => {
      if (row.id === employeeId) {
        let updatedRow = { ...row, [field]: value };
        
        if (field === 'status') {
          if (value === 'Present') {
            if (!updatedRow.clock_in) updatedRow.clock_in = '08:00';
            if (!updatedRow.clock_out) updatedRow.clock_out = '17:00';
          } else {
            updatedRow.clock_in = '';
            updatedRow.clock_out = '';
            updatedRow.overtime_hours = 0; 
          }
        }
        return updatedRow;
      }
      return row;
    }));
    setIsSaved(false);
  };

  const markAllPresent = () => {
    if (!canEdit) return;
    setData(prev => prev.map(row => {
      if (row.status === 'Unmarked' || row.status === 'Absent') {
        return { ...row, status: 'Present', clock_in: '08:00', clock_out: '17:00' };
      }
      return row;
    }));
    setIsSaved(false);
  };

  const executeDailySave = async () => {
    if (!canEdit || !projectId) return;
    const validData = data.filter(row => row.status !== 'Unmarked');
    if (validData.length === 0) return showToast("Tidak ada data yang diubah.", "error");

    setIsSaving(true);
    setShowUnmarkedWarning(false);
    try {
      for (const row of validData) {
        await saveAttendance({
          employee_id: row.id,
          attendance_date: dateStr,
          status: row.status,
          clock_in: row.clock_in,
          clock_out: row.clock_out,
          overtime_hours: Number(row.overtime_hours) || 0,
          notes: row.notes || ''
        });
      }
      showToast("Absensi berhasil disimpan!", "success");
      setIsSaved(true);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDailySaveClick = () => {
    const unmarkedCount = data.filter(d => d.status === 'Unmarked').length;
    if (unmarkedCount > 0) {
      setShowUnmarkedWarning(true);
    } else {
      executeDailySave();
    }
  };

  const calculateDuration = (start: string, end: string) => {
    if (!start || !end) return null;
    const s = new Date(`1970-01-01T${start}:00`);
    const e = new Date(`1970-01-01T${end}:00`);
    const diffMs = e.getTime() - s.getTime();
    if (diffMs < 0) return null; 
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}j ${mins}m`;
  };

  const calculateLateness = (clockIn: string) => {
    if (!clockIn) return null;
    const standardStart = '08:00';
    if (clockIn > standardStart) {
      const s = new Date(`1970-01-01T${standardStart}:00`);
      const e = new Date(`1970-01-01T${clockIn}:00`);
      const diffMs = e.getTime() - s.getTime();
      const mins = Math.floor(diffMs / 60000);
      return `Telat ${mins} mnt`;
    }
    return null;
  };

  // ==========================================
  // FILTER & SUMMARY
  // ==========================================
  const filteredData = useMemo(() => {
    return data.filter(row => {
      const matchSearch = row.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFilter = filterType === 'ALL' || row.employee_type === filterType;
      return matchSearch && matchFilter;
    });
  }, [data, searchQuery, filterType]);

  const dailySummary = useMemo(() => {
    if (viewMode !== 'daily') return { hadir: 0, sakit: 0, izin: 0, cuti: 0, alpa: 0, belumDiabsen: 0, totalLembur: 0 };
    return {
      hadir: data.filter(d => d.status === 'Present').length,
      sakit: data.filter(d => d.status === 'Sick').length,
      izin: data.filter(d => d.status === 'Leave').length,
      cuti: data.filter(d => d.status === 'Cut').length,
      alpa: data.filter(d => d.status === 'Absent').length,
      belumDiabsen: data.filter(d => d.status === 'Unmarked').length,
      totalLembur: data.reduce((sum, d) => sum + (Number(d.overtime_hours) || 0), 0)
    };
  }, [data, viewMode]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300 relative">
      {toast.show && (
        <div className={`fixed top-5 right-5 z-[10000] flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border animate-in slide-in-from-top-4 fade-in ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-6 h-6 text-emerald-500" /> : <AlertCircle className="w-6 h-6 text-red-500" />}
          <span className="font-bold text-sm">{toast.msg}</span>
        </div>
      )}

      {/* ========================================= */}
      {/* HEADER & TOOLBAR */}
      {/* ========================================= */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <CalendarDays className="text-indigo-600" size={24} />
            Absensi Karyawan
          </h3>
          <p className="text-sm text-slate-500 mt-1">Pantau kehadiran harian & rekapitulasi bulanan.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* View Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setViewMode('matrix')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'matrix' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
              <LayoutGrid size={16} /> Matriks
            </button>
            <button onClick={() => setViewMode('daily')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'daily' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
              <List size={16} /> Harian
            </button>
          </div>

          {/* Date Picker */}
          {viewMode === 'matrix' ? (
            <input type="month" value={monthStr} onChange={e => setMonthStr(e.target.value)} className="border border-slate-300 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
          ) : (
             <input type="date" value={dateStr} max={new Date().toISOString().split('T')[0]} onChange={e => setDateStr(e.target.value)} className="border border-slate-300 rounded-xl px-4 py-2 font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
          )}

          {/* Legend (Hanya di Matrix Mode) */}
          {viewMode === 'matrix' && (
            <div className="hidden md:flex gap-2 text-[10px] font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <span className="text-emerald-600">H: Hadir</span>
              <span className="text-amber-600">S: Sakit</span>
              <span className="text-blue-600">I: Izin</span>
              <span className="text-purple-600">C: Cuti</span>
              <span className="text-rose-600">A: Alpa</span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================= */}
      {/* FILTER TOOLBAR */}
      {/* ========================================= */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Cari nama karyawan..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-500" />
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer w-full md:w-auto">
            <option value="ALL">Semua Penempatan</option>
            <option value="Project">Karyawan Proyek</option>
            <option value="Office">Karyawan Kantor</option>
          </select>
        </div>
      </div>

      {/* ========================================= */}
      {/* VIEW MODE: MATRIX BULANAN (ENTERPRISE) */}
      {/* ========================================= */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-10"><LoadingSpinner text="Memuat matriks absensi..." /></div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar relative max-h-[75vh]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-800 text-white sticky top-0 z-30">
                  <tr>
                    {/* STICKY LEFT: Identitas */}
                    <th className="p-3 sticky left-0 z-40 bg-slate-800 border-r border-slate-700 min-w-[250px]">
                      Karyawan & Posisi
                    </th>
                    
                    {/* DATES */}
                    {matrixDates.map(d => (
                      <th key={d.dateStr} className={`p-1 text-center border-r border-slate-700 min-w-[36px] ${d.isWeekend ? 'bg-slate-700' : ''}`}>
                        <div className="font-bold text-[10px]">{d.day}</div>
                        <div className="text-[9px] text-slate-300 font-normal">{d.dayName}</div>
                      </th>
                    ))}

                    {/* STICKY RIGHT: Rekap */}
                    <th className="p-2 sticky right-0 z-40 bg-slate-800 border-l border-slate-700 text-center min-w-[50px]">H</th>
                    <th className="p-2 sticky right-[50px] z-40 bg-slate-800 border-l border-slate-700 text-center min-w-[50px]">S/I/C</th>
                    <th className="p-2 sticky right-[100px] z-40 bg-slate-800 border-l border-slate-700 text-center min-w-[50px]">A</th>
                    <th className="p-2 sticky right-[150px] z-40 bg-slate-800 border-l border-slate-700 text-center min-w-[60px]">Lembur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.length === 0 ? (
                    <tr><td colSpan={matrixDates.length + 5} className="p-10 text-center text-slate-500">Tidak ada data karyawan.</td></tr>
                  ) : filteredData.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      {/* STICKY LEFT: Nama & Info */}
                      <td className="p-3 sticky left-0 z-20 bg-white border-r border-slate-200 group-hover:bg-slate-50">
                        <div className="font-bold text-slate-800 text-sm">{emp.name}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 rounded">{emp.nik || '-'}</span>
                          <span className="text-[10px] text-slate-500 truncate max-w-[100px]">{emp.role_title}</span>
                          
                          {/* MICRO-POLISH 3: Menampilkan Badge Lokasi di Mode Matriks */}
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${emp.employee_type === 'Office' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                            {emp.work_location ? (
                              <><MapPin size={8} className="shrink-0"/><span className="max-w-[80px] truncate" title={emp.work_location}>{emp.work_location}</span></>
                            ) : (emp.employee_type === 'Office' ? 'Kantor' : 'Proyek')}
                          </span>
                        </div>
                      </td>

                      {/* DATE CELLS */}
                      {matrixDates.map(d => {
                        const att = emp.attendanceMap?.[d.dateStr];
                        const hasOvertime = Number(att?.overtime_hours) > 0;
                        const statusLetter = att ? getStatusLetter(att.status) : '';
                        
                        return (
                          <td 
                            key={d.dateStr} 
                            onClick={() => handleCellClick(emp, d.dateStr)}
                            className={`p-0 border-r border-slate-200 text-center cursor-pointer transition-colors relative align-middle h-[48px] group
                              ${d.isWeekend ? 'bg-slate-100/50' : 'hover:bg-indigo-50'}
                            `}
                          >
                            {att && att.status !== 'Unmarked' ? (
                              <div className={`m-1 rounded-md border py-1 flex flex-col items-center justify-center ${getStatusStyle(att.status, d.isWeekend)}`}>
                                <span className="font-bold text-[11px]">{statusLetter}</span>
                                {hasOvertime && <span className="text-[8px] font-bold opacity-80">+{att.overtime_hours}j</span>}
                              </div>
                            ) : (
                              // Memastikan sel kosong bisa diklik
                              <div className="w-full h-full flex items-center justify-center text-slate-200 group-hover:text-indigo-400 group-hover:bg-indigo-50/50 transition-colors">
                                <span className="opacity-0 group-hover:opacity-100 text-xs font-bold">+</span>
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* STICKY RIGHT: Rekap Otomatis */}
                      <td className="p-2 sticky right-0 z-20 bg-white border-l border-slate-200 text-center font-bold text-emerald-600">{emp.summary?.totalHadir || 0}</td>
                      <td className="p-2 sticky right-[50px] z-20 bg-white border-l border-slate-200 text-center font-bold text-amber-600">{emp.summary?.totalSakitIzinCuti || 0}</td>
                      <td className="p-2 sticky right-[100px] z-20 bg-white border-l border-slate-200 text-center font-bold text-rose-600">{emp.summary?.totalAlpa || 0}</td>
                      <td className="p-2 sticky right-[150px] z-20 bg-white border-l border-slate-200 text-center font-bold text-indigo-600">{emp.summary?.totalLembur || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================= */}
      {/* VIEW MODE: DETAIL HARIAN */}
      {/* ========================================= */}
      {viewMode === 'daily' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* HEADER ACTIONS HARIAN */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border flex items-center gap-1 whitespace-nowrap transition-colors ${isSaved ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-amber-600 bg-amber-50 border-amber-200'}`}>
                {isSaved ? <><CheckCircle size={12}/> Tersimpan</> : <><AlertCircle size={12}/> Belum Disimpan</>}
              </span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              {canEdit && (
                <button onClick={markAllPresent} className="flex-1 sm:flex-none bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors" title="Tandai Hadir & Jam Default">
                  <CheckSquare className="w-4 h-4" /> Semua Hadir
                </button>
              )}
              {canEdit && (
                <button onClick={handleDailySaveClick} disabled={isSaving} className="flex-1 sm:flex-none bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} 
                  {isSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              )}
            </div>
          </div>

          {/* WIDGET RINGKASAN HARIAN */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-emerald-500 flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Hadir</p><p className="text-xl font-black text-emerald-600">{dailySummary.hadir}</p>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-amber-500 flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Sakit</p><p className="text-xl font-black text-amber-600">{dailySummary.sakit}</p>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-blue-500 flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Izin</p><p className="text-xl font-black text-blue-600">{dailySummary.izin}</p>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-purple-500 flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Cuti</p><p className="text-xl font-black text-purple-600">{dailySummary.cuti}</p>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-rose-500 flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Alpa</p><p className="text-xl font-black text-rose-600">{dailySummary.alpa}</p>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-slate-400 flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Belum Diabsen</p><p className="text-xl font-black text-slate-600">{dailySummary.belumDiabsen}</p>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-indigo-500 flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Total Lembur</p><p className="text-xl font-black text-indigo-600">{dailySummary.totalLembur} <span className="text-sm font-bold">Jam</span></p>
            </div>
          </div>

          {/* TABEL HARIAN */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left whitespace-nowrap">
                <thead className="bg-slate-800 text-slate-300 text-[11px] uppercase tracking-wider border-b border-slate-700">
                  <tr>
                    <th className="p-4 font-bold"><div className="flex items-center gap-2 text-white"><Users size={16}/> Nama / NIK / Jabatan</div></th>
                    <th className="p-4 font-bold text-center"><div className="flex items-center justify-center gap-2 text-white"><CheckCircle size={16}/> Status</div></th>
                    <th className="p-4 font-bold text-center"><div className="flex items-center justify-center gap-2 text-white"><Clock size={16}/> Jam Masuk</div></th>
                    <th className="p-4 font-bold text-center"><div className="flex items-center justify-center gap-2 text-white"><Clock size={16}/> Jam Pulang</div></th>
                    <th className="p-4 font-bold text-center"><div className="flex items-center justify-center gap-2 text-white"><Clock size={16}/> Lembur</div></th>
                    <th className="p-4 font-bold w-full"><div className="flex items-center gap-2 text-white"><FileText size={16}/> Catatan</div></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <LoadingSpinner text="Memuat data absensi..." />
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr><td colSpan={6} className="p-16 text-center"><div className="flex flex-col items-center justify-center text-slate-400"><UserCheck className="w-12 h-12 mb-3 opacity-20" /><p className="font-bold text-lg text-slate-600">Tidak ada data.</p></div></td></tr>
                  ) : filteredData.map((row) => {
                    const duration = calculateDuration(row.clock_in, row.clock_out);
                    const lateness = calculateLateness(row.clock_in);

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="p-4">
                          <div className={`font-bold text-base ${row.employment_status !== 'Active' ? 'text-slate-400' : 'text-slate-800'}`}>{row.name}</div>
                          <div className="flex gap-2 mt-1 items-center flex-wrap">
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"><Fingerprint size={10} className="inline mr-0.5"/>{row.nik || '-'}</span>
                            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{row.role_title}</span>
                            
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 ${row.employee_type === 'Office' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                              {row.work_location ? (
                                <><MapPin size={10} className="shrink-0"/><span className="max-w-[150px] truncate" title={row.work_location}>{row.work_location}</span></>
                              ) : (row.employee_type === 'Office' ? 'Kantor' : 'Proyek')}
                            </span>
                          </div>
                        </td>
                        
                        <td className="p-4 text-center">
                          <div className="relative inline-block w-full max-w-[130px]">
                            <select value={row.status} onChange={e => handleDailyChange(row.id, 'status', e.target.value)} disabled={!canEdit} className={`w-full appearance-none px-3 py-1.5 rounded-lg text-xs font-bold border-2 text-center cursor-pointer outline-none transition-colors ${getStatusStyle(row.status)} ${!canEdit ? 'opacity-70 cursor-not-allowed' : ''}`}>
                              <option value="Unmarked">-- Pilih --</option>
                              <option value="Present">Hadir</option>
                              <option value="Sick">Sakit</option>
                              <option value="Leave">Izin</option>
                              <option value="Cut">Cuti</option>
                              <option value="Absent">Alpa</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                          </div>
                        </td>
                        
                        <td className="p-4 text-center">
                          <input 
                            type="time" 
                            value={row.clock_in || ''} 
                            onChange={e => handleDailyChange(row.id, 'clock_in', e.target.value)} 
                            disabled={!canEdit || row.status !== 'Present'} 
                            className={`w-24 border rounded-lg p-1.5 text-center font-mono text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400 transition-colors ${lateness ? 'text-rose-600 font-bold border-rose-300' : 'text-slate-700 border-slate-300'}`} 
                          />
                          {lateness && <div className="text-[9px] text-rose-500 font-bold mt-0.5 bg-rose-50 px-1 rounded inline-block">{lateness}</div>}
                        </td>

                        <td className="p-4 text-center">
                          <input 
                            type="time" 
                            value={row.clock_out || ''} 
                            onChange={e => handleDailyChange(row.id, 'clock_out', e.target.value)} 
                            disabled={!canEdit || row.status !== 'Present'} 
                            className="w-24 border border-slate-300 rounded-lg p-1.5 text-center font-mono text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400" 
                          />
                          {duration && <div className="text-[9px] text-emerald-600 font-bold mt-0.5 bg-emerald-50 px-1 rounded inline-block">Total: {duration}</div>}
                        </td>
                        
                        <td className="p-4 text-center">
                          <div className="relative inline-block w-20">
                            <input 
                              type="number" 
                              min="0" 
                              step="0.5" 
                              value={row.overtime_hours} 
                              onChange={e => handleDailyChange(row.id, 'overtime_hours', e.target.value)} 
                              disabled={!canEdit || row.status !== 'Present'} 
                              className="w-full border border-slate-300 rounded-lg p-1.5 text-center font-mono font-bold text-slate-700 bg-white focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200" 
                            />
                          </div>
                        </td>
                        
                        <td className="p-4 w-full">
                          <div className="flex items-center gap-2">
                            <input type="text" value={row.notes} onChange={e => handleDailyChange(row.id, 'notes', e.target.value)} disabled={!canEdit || row.status === 'Unmarked'} placeholder="Tambahkan keterangan..." className="w-full min-w-[150px] border border-slate-300 hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white rounded-lg p-2 text-sm outline-none transition-all disabled:bg-slate-50 disabled:border-slate-200 placeholder:text-slate-400 font-medium" />
                            {(row.status === 'Sick' || row.status === 'Leave') && canEdit && (
                              <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Lampirkan Surat Dokter/Bukti">
                                <Paperclip className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* QUICK EDIT POPOVER (MODAL) */}
      {/* ========================================= */}
      {editingCell && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 border border-slate-200">
            
            <div className="px-5 py-3 border-b bg-slate-50 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-800 text-sm truncate w-48">{editingCell.empName}</h4>
                <p className="text-xs text-indigo-600 font-semibold">{new Date(editingCell.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <button onClick={() => setEditingCell(null)} className="text-slate-400 hover:text-rose-500 p-1.5 bg-white rounded-md border border-slate-200"><X size={16}/></button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Status Kehadiran</label>
                <select 
                  value={popoverData.status} 
                  onChange={e => setPopoverData({...popoverData, status: e.target.value})}
                  className="w-full border border-slate-300 p-2 rounded-lg text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="Present">Hadir</option>
                  <option value="Sick">Sakit</option>
                  <option value="Leave">Izin</option>
                  <option value="Cut">Cuti</option>
                  <option value="Absent">Alpa</option>
                </select>
              </div>

              {popoverData.status === 'Present' && (
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Jam Masuk</label>
                    <input type="time" value={popoverData.clock_in} onChange={e => setPopoverData({...popoverData, clock_in: e.target.value})} className="w-full border border-slate-300 rounded-md p-1.5 text-center font-mono text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Jam Pulang</label>
                    <input type="time" value={popoverData.clock_out} onChange={e => setPopoverData({...popoverData, clock_out: e.target.value})} className="w-full border border-slate-300 rounded-md p-1.5 text-center font-mono text-sm outline-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Lembur (Jam)</label>
                    <input type="number" min="0" step="0.5" value={popoverData.overtime_hours} onChange={e => setPopoverData({...popoverData, overtime_hours: Number(e.target.value)})} className="w-full border border-slate-300 rounded-md p-1.5 text-center font-mono font-bold text-sm outline-none" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Catatan</label>
                <input type="text" value={popoverData.notes} onChange={e => setPopoverData({...popoverData, notes: e.target.value})} placeholder="Opsional..." className="w-full border border-slate-300 p-2 rounded-lg text-sm outline-none" />
              </div>
            </div>

            <div className="px-5 py-3 border-t bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setEditingCell(null)} className="px-4 py-1.5 text-xs font-bold text-slate-600 bg-white border rounded-md">Batal</button>
              <button onClick={handleSavePopover} disabled={isSavingCell} className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm">
                {isSavingCell ? 'Menyimpan...' : 'Simpan Sel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* CUSTOM MODAL: PERINGATAN BELUM DIABSEN */}
      {/* ========================================= */}
      {showUnmarkedWarning && viewMode === 'daily' && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 flex flex-col p-6 text-center">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-10 h-10 text-amber-600" /></div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Peringatan Absensi</h3>
            <p className="text-sm text-slate-600 mb-6">Masih terdapat <strong className="text-rose-600">{dailySummary.belumDiabsen} karyawan</strong> yang berstatus <strong>"Belum Diabsen"</strong>. Karyawan tersebut tidak akan dimasukkan ke dalam perhitungan gaji (Payroll) bulan ini.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setShowUnmarkedWarning(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">Kembali & Lengkapi</button>
              <button onClick={executeDailySave} disabled={isSaving} className="px-5 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-2 shadow-sm transition-colors">{isSaving ? 'Memproses...' : 'Tetap Simpan'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}