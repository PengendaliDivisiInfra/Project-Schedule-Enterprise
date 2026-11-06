'use client';

import { useEffect, useState } from 'react';
import { getSPKHistory } from '@/lib/services/subcon.service';
import { supabase } from '@/lib/supabase';
import { X, History, FileText } from 'lucide-react';

export function HistoryModal({ isOpen, onClose, contractId }: { isOpen: boolean, onClose: () => void, contractId: string | null }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [addendums, setAddendums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'addendum' | 'audit'>('addendum');

  useEffect(() => {
    if (isOpen && contractId) {
      setLoading(true);
      
      const fetchHistory = async () => {
        // 1. Ambil Audit Logs
        const auditData = await getSPKHistory(contractId);
        setLogs(auditData);

        // 2. Ambil Data Addendum
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6 max-h-[85vh] flex flex-col">
        
        {/* Header Modal */}
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-bold flex items-center gap-2"><History className="text-blue-600"/> Riwayat Perubahan</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-4">
          <button onClick={() => setActiveTab('addendum')} className={`pb-2 px-1 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'addendum' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
            <FileText size={16}/> Riwayat Addendum
          </button>
          <button onClick={() => setActiveTab('audit')} className={`pb-2 px-1 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'audit' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
            <History size={16}/> Audit Sistem (Log)
          </button>
        </div>
        
        <div className="overflow-y-auto flex-1 space-y-4 pr-2">
          {loading ? (
            <p className="text-center text-slate-500 py-8">Memuat riwayat...</p>
          ) : (
            <>
              {/* TAB 1: ADDENDUM */}
              {activeTab === 'addendum' && (
                <>
                  {addendums.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">Belum ada riwayat Addendum pada SPK ini.</p>
                  ) : (
                    addendums.map((add) => (
                      <div key={add.id} className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Addendum #{add.addendum_no}</span>
                            <h4 className="font-bold text-amber-900 mt-1">{add.title}</h4>
                            <p className="text-sm text-amber-800">{add.description}</p>
                          </div>
                          <span className="text-xs text-amber-600 font-medium">{new Date(add.created_at).toLocaleDateString('id-ID')}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-3 text-sm border-t border-amber-200 pt-2">
                          <div>
                            <p className="text-slate-500 text-xs">Nilai Kontrak Lama</p>
                            <p className="font-bold text-slate-700">Rp {Number(add.old_contract_value).toLocaleString('id-ID')}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 text-xs">Nilai Kontrak Baru</p>
                            <p className="font-bold text-green-700">Rp {Number(add.new_contract_value).toLocaleString('id-ID')}</p>
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
                    <p className="text-center text-slate-500 py-8">Belum ada log sistem.</p>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className="bg-slate-50 p-4 rounded-lg border text-sm">
                        <div className="flex justify-between text-xs text-slate-500 mb-3 border-b pb-2">
                          <span>Aksi: <strong className="uppercase text-blue-600 bg-blue-100 px-2 py-0.5 rounded">{log.action}</strong></span>
                          <span>{new Date(log.created_at).toLocaleString('id-ID')}</span>
                        </div>
                        {log.action === 'UPDATE' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-red-50 p-2 rounded text-xs text-red-700 overflow-x-auto">
                              <p className="font-bold mb-1">Sebelum:</p>
                              <pre>{JSON.stringify(log.old_data, null, 2)}</pre>
                            </div>
                            <div className="bg-green-50 p-2 rounded text-xs text-green-700 overflow-x-auto">
                              <p className="font-bold mb-1">Sesudah:</p>
                              <pre>{JSON.stringify(log.new_data, null, 2)}</pre>
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