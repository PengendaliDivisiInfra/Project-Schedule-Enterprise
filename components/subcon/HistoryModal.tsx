'use client';

import { useEffect, useState } from 'react';
import { getSPKHistory } from '@/lib/services/subcon.service';
import { supabase } from '@/lib/supabase';
import { X, History, FileText, Activity, AlertCircle, CheckCircle2 } from 'lucide-react'; // <-- CheckCircle2 DITAMBAHKAN DI SINI

export function HistoryModal({ isOpen, onClose, contractId }: { isOpen: boolean, onClose: () => void, contractId: string | null }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [addendums, setAddendums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'addendum' | 'audit'>('addendum');

  useEffect(() => {
    if (isOpen && contractId) {
      setLoading(true);
      const fetchHistory = async () => {
        const auditData = await getSPKHistory(contractId);
        setLogs(auditData);

        const { data: addData } = await supabase
          .from('subcontractor_addendums')
          .select('*')
          .eq('contract_id', contractId)
          .order('created_at', { ascending: false });
        
        setAddendums(addData || []);
        setLoading(false);
      };
      fetchHistory();
    }
  }, [isOpen, contractId]);

  if (!isOpen) return null;

  const tabClass = (isActive: boolean) => `pb-3 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${isActive ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><History className="text-indigo-600"/> Riwayat Perubahan</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-rose-500 bg-white p-1.5 rounded-lg border border-slate-200 transition-colors"><X size={20}/></button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-6 px-6 pt-4 border-b border-slate-200 bg-slate-50/50">
          <button onClick={() => setActiveTab('addendum')} className={tabClass(activeTab === 'addendum')}>
            <FileText size={16}/> Riwayat Addendum
          </button>
          <button onClick={() => setActiveTab('audit')} className={tabClass(activeTab === 'audit')}>
            <Activity size={16}/> Audit Sistem (Log)
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50">
          {loading ? (
            <p className="text-center text-slate-500 py-10 font-bold">Memuat riwayat...</p>
          ) : (
            <>
              {/* TAB 1: ADDENDUM */}
              {activeTab === 'addendum' && (
                <>
                  {addendums.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                      <FileText size={48} className="mb-4 opacity-20" />
                      <p className="font-bold text-lg text-slate-600">Belum ada riwayat Addendum.</p>
                    </div>
                  ) : (
                    addendums.map((add) => (
                      <div key={add.id} className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200 uppercase tracking-wider">Addendum #{add.addendum_no}</span>
                            <h4 className="font-bold text-slate-800 text-base mt-1">{add.title}</h4>
                            <p className="text-sm text-slate-600 font-medium mt-1">{add.description}</p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{new Date(add.created_at).toLocaleDateString('id-ID')}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                          <div>
                            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Nilai Kontrak Lama</p>
                            <p className="font-bold text-slate-700 tabular-nums">Rp {Number(add.old_contract_value).toLocaleString('id-ID')}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">Nilai Kontrak Baru</p>
                            <p className="font-bold text-emerald-600 tabular-nums">Rp {Number(add.new_contract_value).toLocaleString('id-ID')}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* TAB 2: AUDIT LOGS */}
              {activeTab === 'audit' && (
                <>
                  {logs.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                      <Activity size={48} className="mb-4 opacity-20" />
                      <p className="font-bold text-lg text-slate-600">Belum ada log sistem.</p>
                    </div>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between text-xs mb-3 border-b border-slate-100 pb-2">
                          <span className="font-bold text-slate-600">Aksi: <strong className="uppercase text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{log.action}</strong></span>
                          <span className="font-bold text-slate-400">{new Date(log.created_at).toLocaleString('id-ID')}</span>
                        </div>
                        {log.action === 'UPDATE' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-rose-50 p-3 rounded-lg border border-rose-100 text-[11px] text-rose-800 overflow-x-auto">
                              <p className="font-bold mb-1 flex items-center gap-1"><AlertCircle size={12}/> Sebelum:</p>
                              <pre className="font-mono">{JSON.stringify(log.old_data, null, 2)}</pre>
                            </div>
                            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-[11px] text-emerald-800 overflow-x-auto">
                              <p className="font-bold mb-1 flex items-center gap-1"><CheckCircle2 size={12}/> Sesudah:</p>
                              <pre className="font-mono">{JSON.stringify(log.new_data, null, 2)}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}