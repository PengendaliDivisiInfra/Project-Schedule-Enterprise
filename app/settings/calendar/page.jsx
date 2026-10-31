'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Calendar, Clock, Plus, Trash2, ShieldAlert, Check } from 'lucide-react';

export default function CalendarConfiguration() {
  const [calendarId, setCalendarId] = useState(null);
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5]); 
  const [holidays, setHolidays] = useState([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const daysOfWeek = [
    { value: 0, label: 'Minggu' },
    { value: 1, label: 'Senin' },
    { value: 2, label: 'Selasa' },
    { value: 3, label: 'Rabu' },
    { value: 4, label: 'Kamis' },
    { value: 5, label: 'Jumat' },
    { value: 6, label: 'Sabtu' }
  ];

  useEffect(() => {
    async function loadCalendar() {
      try {
        let { data: projects } = await supabase.from('projects').select('id').limit(1);
        let projectId = projects?.[0]?.id;
        if (!projectId) return;

        // Ambil Kalender
        let { data: cal } = await supabase.from('project_calendars').select('*').eq('project_id', projectId).limit(1).single();
        
        if (!cal) {
          // Buat baru jika belum ada
          const { data: newCal } = await supabase.from('project_calendars').insert([{ project_id: projectId }]).select().single();
          cal = newCal;
        }

        if (cal) {
          setCalendarId(cal.id);
          setWorkingDays(cal.working_days);
          
          // Ambil Hari Libur
          let { data: exc } = await supabase.from('calendar_exceptions').select('*').eq('calendar_id', cal.id).order('exception_date');
          setHolidays(exc || []);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    }
    loadCalendar();
  }, []);

  const handleDayToggle = (dayValue) => {
    if (workingDays.includes(dayValue)) {
      setWorkingDays(workingDays.filter(d => d !== dayValue));
    } else {
      setWorkingDays([...workingDays, dayValue].sort());
    }
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName || !calendarId) return;

    const { data, error } = await supabase.from('calendar_exceptions').insert([{
      calendar_id: calendarId,
      exception_date: newHolidayDate,
      description: newHolidayName
    }]).select().single();

    if (!error) {
      setHolidays([...holidays, data].sort((a, b) => a.exception_date.localeCompare(b.exception_date)));
      setNewHolidayDate('');
      setNewHolidayName('');
    }
  };

  const handleDeleteHoliday = async (id) => {
    await supabase.from('calendar_exceptions').delete().eq('id', id);
    setHolidays(holidays.filter(h => h.id !== id));
  };

  const handleSaveCalendar = async () => {
    if (!calendarId) return;
    setSaving(true);
    await supabase.from('project_calendars').update({ working_days: workingDays }).eq('id', calendarId);
    setSaving(false);
    alert('Kalender Kerja Berhasil Disimpan! Silakan cek Gantt Workspace.');
    window.location.reload();
  };

  if (loading) return <div className="p-10 text-center">Memuat Kalender...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Konfigurasi Kalender Kerja Proyek
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Atur hari kerja mingguan dan hari libur nasional untuk menggerakkan CPM Engine secara otomatis.
          </p>
        </div>
        <button 
          onClick={handleSaveCalendar} 
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md shadow transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Check className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Kalender'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-slate-500" />
            Hari Kerja Mingguan
          </h2>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Pilih hari apa saja dalam seminggu di mana aktivitas pekerjaan lapangan legal dilaksanakan.
          </p>

          <div className="space-y-2">
            {daysOfWeek.map((day) => {
              const isActive = workingDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => handleDayToggle(day.value)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{day.label}</span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                    isActive ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                  }`}>
                    {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-slate-500" />
            Pengecualian Hari Libur (Holidays)
          </h2>

          <form onSubmit={handleAddHoliday} className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
            <div className="sm:col-span-1">
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Tanggal Libur</label>
              <input
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Nama Keterangan</label>
              <input
                type="text"
                placeholder="Misal: Libur Idul Fitri"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-1 flex items-end">
              <button
                type="submit"
                className="w-full p-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded shadow transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4" /> Tambah Hari
              </button>
            </div>
          </form>

          <div className="border border-slate-200 rounded-lg overflow-hidden flex-1">
            <table className="w-full border-collapse text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="p-3 w-1/3">Tanggal</th>
                  <th className="p-3">Keterangan Hari Libur</th>
                  <th className="p-3 w-16 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {holidays.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="p-4 text-center text-slate-400 italic">
                      Belum ada pengecualian hari libur yang ditambahkan.
                    </td>
                  </tr>
                ) : (
                  holidays.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-medium text-slate-700">
                        {new Date(h.exception_date).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </td>
                      <td className="p-3 text-slate-600">{h.description}</td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteHoliday(h.id)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
  );
}
