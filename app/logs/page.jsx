'use client';
import { ShieldCheck, Search } from 'lucide-react';

export default function AuditLogsPage() {
  // Data Mockup untuk tampilan UI
  const mockLogs = [
    { time: '2026-11-01 08:12:45', user: 'Admin User', role: 'Owner', action: 'UPDATE', module: 'Tasks', detail: 'Mengubah durasi WBS 1.1 dari 5 menjadi 9 hari', ip: '192.168.1.10' },
    { time: '2026-11-01 08:15:20', user: 'Admin User', role: 'Owner', action: 'CREATE', module: 'AHSP', detail: 'Menambahkan template AHSP Mobilisasi Alat', ip: '192.168.1.10' },
    { time: '2026-11-01 09:01:11', user: 'Siti Aminah', role: 'Control Team', action: 'DELETE', module: 'Progress', detail: 'Menghapus laporan harian tanggal 31 Okt', ip: '192.168.1.22' },
    { time: '2026-11-01 09:30:00', user: 'Budi Santoso', role: 'Owner', action: 'LOGIN', module: 'System', detail: 'Berhasil login', ip: '10.0.0.5' },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-140px)]">
      <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-blue-600" /> System Activity Logs
          </h1>
          <p className="text-sm text-slate-500">Audit trail terenkripsi untuk memantau seluruh perubahan data.</p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Cari log..." className="pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-64" />
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0 border-b border-slate-200 z-10">
            <tr>
              <th className="p-3">Waktu</th>
              <th className="p-3">User</th>
              <th className="p-3">Role</th>
              <th className="p-3">Aksi</th>
              <th className="p-3">Modul</th>
              <th className="p-3">Detail Perubahan</th>
              <th className="p-3">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mockLogs.map((log, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="p-3 text-slate-500 whitespace-nowrap">{log.time}</td>
                <td className="p-3 font-semibold text-slate-700">{log.user}</td>
                <td className="p-3"><span className="text-[10px] bg-slate-200 px-2 py-1 rounded font-bold uppercase">{log.role}</span></td>
                <td className="p-3">
                  <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${
                    log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700' :
                    log.action === 'UPDATE' ? 'bg-amber-100 text-amber-700' :
                    log.action === 'DELETE' ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>{log.action}</span>
                </td>
                <td className="p-3 font-medium text-slate-600">{log.module}</td>
                <td className="p-3 text-slate-600 truncate max-w-xs" title={log.detail}>{log.detail}</td>
                <td className="p-3 font-mono text-xs text-slate-400">{log.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
