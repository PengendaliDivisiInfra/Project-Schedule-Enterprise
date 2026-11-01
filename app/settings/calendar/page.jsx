'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import LoadingSpinner from '../../../components/LoadingSpinner';

export default function CalendarSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // State Hari Kerja (0=Minggu, 1=Senin, dst)
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5]);
  
  // State Hari Libur
  const [holidays, setHolidays] = useState([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayDesc, setNewHolidayDesc] = useState('');

  useEffect(() => {
    fetchCalendarSettings();

        const channel = supabase.channel('realtime-calendar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_exceptions' }, () => {
        fetchCalendarSettings(); // Update kalender jika ada hari libur baru
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchCalendarSettings = async () => {
    setLoading(true);
    // Mengambil data dari tabel projects (Asumsi: setting kalender disimpan di tabel projects)
    const { data, error } = await supabase.from('projects').select('id, working_days, exceptions').limit(1).maybeSingle();
    
    if (data) {
      if (data.working_days) setWorkingDays(Array.isArray(data.working_days) ? data.working_days.map(Number) : [1,2,3,4,5]);
      if (data.exceptions) setHolidays(data.exceptions);
    }
    setLoading(false);
  };

  const toggleDay = (dayIndex) => {
    setWorkingDays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex) 
        : [...prev, dayIndex].sort()
    );
  };

  const handleAddHoliday = () => {
    if (!newHolidayDate) return alert("Pilih tanggal libur terlebih dahulu!");
    const newException = { exception_date: newHolidayDate, description: newHolidayDesc || 'Hari Libur' };
    
    // Cek duplikasi
    if (holidays.some(h => h.exception_date === newHolidayDate)) {
      return alert("Tanggal tersebut sudah ada di daftar libur.");
    }

    setHolidays(prev => [...prev, newException].sort((a, b) => new Date(a.exception_date) - new Date(b.exception_date)));
    setNewHolidayDate('');
    setNewHolidayDesc('');
  };

  const handleRemoveHoliday = (dateToRemove) => {
    setHolidays(prev => prev.filter(h => h.exception_date !== dateToRemove));
  };

  const handleSave = async () => {
    setSaving(true);
    // Menyimpan ke tabel projects. Pastikan kolom working_days dan exceptions bertipe JSONB di Supabase.
    const { error } = await supabase
      .from('projects')
      .update({ 
        working_days: workingDays,
        exceptions: holidays
      })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Update semua baris proyek (biasanya cuma 1)

    setSaving(false);
    if (error) {
      alert("Gagal menyimpan kalender: " + error.message);
    } else {
      alert("✅ Kalender Kerja berhasil disimpan!");
    }
  };

  const daysMap = [
    { label: 'Minggu', val: 0 },
    { label: 'Senin', val: 1 },
    { label: 'Selasa', val: 2 },
    { label: 'Rabu', val: 3 },
    { label: 'Kamis', val: 4 },
    { label: 'Jumat', val: 5 },
    { label: 'Sabtu', val: 6 },
  ];

  if (loading) return <LoadingSpinner text="Memuat pengaturan kalender..." />;

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-800">📅 Konfigurasi Kalender Kerja Proyek</h1>
            <p className="text-sm text-slate-500">Atur hari kerja mingguan dan hari libur nasional untuk menggerakkan CPM Engine secara otomatis.</p>
          </div>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className={`px-6 py-2 rounded-lg font-bold text-white shadow transition-colors ${saving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {saving ? 'Menyimpan...' : '💾 Simpan Kalender'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Hari Kerja Mingguan */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h2 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <span className="text-indigo-500">🕒</span> Hari Kerja Mingguan
            </h2>
            <p className="text-xs text-slate-500 mb-4">Pilih hari apa saja dalam seminggu di mana aktivitas pekerjaan lapangan legal dilaksanakan.</p>
            
            <div className="space-y-2">
              {daysMap.map(day => (
                <label 
                  key={day.val} 
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${workingDays.includes(day.val) ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                >
                  <span className={`text-sm ${workingDays.includes(day.val) ? 'font-bold text-indigo-700' : 'text-slate-600'}`}>{day.label}</span>
                  <input 
                    type="checkbox" 
                    checked={workingDays.includes(day.val)}
                    onChange={() => toggleDay(day.val)}
                    className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Hari Libur / Exceptions */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h2 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
              <span className="text-red-500">🚫</span> Pengecualian Hari Libur (Holidays)
            </h2>
            
            <div className="flex gap-2 mb-4">
              <input 
                type="date" 
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                className="border border-slate-300 rounded p-2 text-sm flex-1 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <input 
                type="text" 
                placeholder="Keterangan (Opsional)"
                value={newHolidayDesc}
                onChange={(e) => setNewHolidayDesc(e.target.value)}
                className="border border-slate-300 rounded p-2 text-sm flex-1 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button 
                onClick={handleAddHoliday}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded font-bold text-sm shadow"
              >
                Tambah
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Keterangan</th>
                    <th className="p-3 w-16 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {holidays.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-slate-400 italic">Belum ada pengecualian hari libur.</td>
                    </tr>
                  ) : (
                    holidays.map((h, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-700">{new Date(h.exception_date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'})}</td>
                        <td className="p-3 text-slate-500">{h.description}</td>
                        <td className="p-3 text-center">
                          <button onClick={() => handleRemoveHoliday(h.exception_date)} className="text-red-500 hover:text-red-700 font-bold p-1">🗑️</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}



