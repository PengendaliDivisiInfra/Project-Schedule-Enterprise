'use client';
import { useEffect, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useRole } from '@/lib/hooks/useRole';
import { listAuditLogs } from '@/lib/services/logs.service'; // Import Service Baru
import { ShieldAlert, Search, Info, X, Clock, User, Database, FileJson, Loader2 } from 'lucide-react';

export default function AuditLogsPage() {
  const { activeProjectId } = useProject();
  const { role, loading: loadingRole } = useRole(activeProjectId);

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      const data = await listAuditLogs(activeProjectId);
      setLogs(data);
    } catch (error) {
      console.error("Gagal memuat log:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Perbaikan: Cek role dengan huruf kecil semua agar aman
    if (role?.toLowerCase() === 'owner') {
      fetchLogs();
    } else if (!loadingRole) {
      setLoading(false);
    }
  }, [activeProjectId, role, loadingRole]);

  const filteredLogs = logs.filter(log => 
    (log.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.table_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.action || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const getActionColor = (action) => {
    if (action === 'INSERT') return 'bg-emerald-100 text-emerald-700';
    if (action === 'UPDATE') return 'bg-amber-100 text-amber-700';
    if (action === 'DELETE') return 'bg-rose-100 text-rose-700';
    return 'bg-slate-100 text-slate-700';
  };

  const renderDataRows = (data) => {
    if (!data) return null;
    const hiddenKeys = ['id', 'created_at', 'updated_at', 'project_id'];
    
    return Object.entries(data)
      .filter(([key]) => !hiddenKeys.includes(key))
      .map(([key, value]) => (
        <div key={key} className="flex justify-between py-1 border-b border-slate-100 last:border-0">
          <span className="text-xs text-slate-500 font-semibold uppercase">{key.replace(/_/g, ' ')}</span>
          <span className="text-xs text-slate-800 font-mono text-right truncate max-w-[200px]" title={String(value)}>
            {value === null ? '-' : String(value)}
          </span>
        </div>
      ));
  };

  if (loadingRole) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Perbaikan: Cek role dengan huruf kecil semua
  if (role?.toLowerCase() !== 'owner') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center text-rose-500">
          <ShieldAlert size={48} className="mx-auto mb-4" />
          <h1 className="text-xl font-bold">Akses Ditolak</h1>
          <p className="text-sm">Hanya Owner yang dapat mengakses halaman ini.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldAlert className="text-indigo-600" /> System Activity Logs
            </h1>
            <p className="text-sm text-slate-500 mt-1">Audit trail terenkripsi untuk seluruh perubahan data proyek.</p>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari nama user, tabel, atau aksi..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-72 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm" 
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 text-xs uppercase border-b">
              <tr>
                <th className="p-4 font-bold">Waktu</th>
                <th className="p-4 font-bold">User & Role</th>
                <th className="p-4 font-bold text-center">Aksi</th>
                <th className="p-4 font-bold">Tabel / Modul</th>
                <th className="p-4 font-bold text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2"/> Memuat data log...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500">Belum ada aktivitas yang tercatat.</td></tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-600 font-mono text-xs">{formatDate(log.created_at)}</td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{log.user_name}</div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase">{log.user_role}</div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-indigo-600 font-semibold">{log.table_name}</td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => setSelectedLog(log)}
                        className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded transition-colors"
                        title="Lihat Detail Perubahan"
                      >
                        <Info size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETAIL PERUBAHAN */}
      {selectedLog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center px-6 py-4 border-b bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileJson className="text-indigo-600 w-5 h-5" /> Detail Perubahan
                </h2>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <Clock size={12} /> {formatDate(selectedLog.created_at)} • 
                  <User size={12} /> {selectedLog.user_name} • 
                  <Database size={12} /> {selectedLog.table_name}
                </p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              {selectedLog.action === 'INSERT' && (
                <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
                  <h3 className="text-sm font-bold text-emerald-700 mb-3">Data Baru Ditambahkan</h3>
                  <div className="space-y-1">{renderDataRows(selectedLog.new_data)}</div>
                </div>
              )}

              {selectedLog.action === 'DELETE' && (
                <div className="bg-rose-50 rounded-lg p-4 border border-rose-100">
                  <h3 className="text-sm font-bold text-rose-700 mb-3">Data Dihapus</h3>
                  <div className="space-y-1">{renderDataRows(selectedLog.old_data)}</div>
                </div>
              )}

              {selectedLog.action === 'UPDATE' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-500 mb-3">Sebelumnya (Old)</h3>
                    <div className="space-y-1">{renderDataRows(selectedLog.old_data)}</div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                    <h3 className="text-sm font-bold text-emerald-700 mb-3">Sesudah (New)</h3>
                    <div className="space-y-1">{renderDataRows(selectedLog.new_data)}</div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t flex justify-end">
              <button onClick={() => setSelectedLog(null)} className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}