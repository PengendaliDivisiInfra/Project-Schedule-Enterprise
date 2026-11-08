'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BookOpen, RefreshCw, Loader2 } from 'lucide-react';
import { MoneyText } from '@/components/ui/MoneyText';

interface JournalEntry {
  id: string;
  transaction_date: string;
  reference_no: string;
  description: string;
  account_code: string;
  debit: number;
  credit: number;
}

export default function GeneralLedgerView({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setEntries(data || []);
    } catch (err: any) {
      console.error('Gagal load jurnal:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchLedger();
  }, [projectId]);

  // Agregasi Saldo per Akun (Untuk Ringkasan Atas)
  const aggregatedBalances = entries.reduce((acc, entry) => {
    if (!acc[entry.account_code]) {
      acc[entry.account_code] = { debit: 0, credit: 0 };
    }
    acc[entry.account_code].debit += entry.debit;
    acc[entry.account_code].credit += entry.credit;
    return acc;
  }, {} as Record<string, { debit: number; credit: number }>);

  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

  return (
    <div className="space-y-6">
      {/* HEADER & REFRESH */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
            <BookOpen size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Buku Besar (General Ledger)</h2>
            <p className="text-sm text-slate-500">Jurnal otomatis dari penerbitan SP2D dan transaksi lainnya.</p>
          </div>
        </div>
        <button onClick={fetchLedger} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors">
          {loading ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />} Refresh
        </button>
      </div>

      {/* RINGKASAN BALANCE (DEBET vs KREDIT) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm border-l-4 border-l-blue-500">
          <p className="text-sm text-slate-500 font-bold uppercase">Total Debet</p>
          <p className="text-2xl font-bold text-slate-800 mt-1"><MoneyText value={totalDebit} /></p>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm border-l-4 border-l-rose-500">
          <p className="text-sm text-slate-500 font-bold uppercase">Total Kredit</p>
          <p className="text-2xl font-bold text-slate-800 mt-1"><MoneyText value={totalCredit} /></p>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-sm text-slate-500 font-bold uppercase">Status Balance</p>
          <p className={`text-2xl font-bold mt-1 ${totalDebit === totalCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
            {totalDebit === totalCredit ? 'SEIMBANG (BALANCE)' : 'TIDAK SEIMBANG'}
          </p>
        </div>
      </div>

      {/* TABEL JURNAL UMUM */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
              <tr>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">No. Referensi</th>
                <th className="px-4 py-3">Kode Akun</th>
                <th className="px-4 py-3">Keterangan</th>
                <th className="px-4 py-3 text-right">Debet (Rp)</th>
                <th className="px-4 py-3 text-right">Kredit (Rp)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">Memuat data jurnal...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">Belum ada jurnal. Silakan input SP2D di menu Termin.</td></tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3">{new Date(entry.transaction_date).toLocaleDateString('id-ID')}</td>
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">{entry.reference_no || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-700 border">
                        {entry.account_code}
                      </span>
                    </td>
                    <td className="px-4 py-3">{entry.description}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-800">{entry.debit > 0 ? <MoneyText value={entry.debit} /> : '-'}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-800">{entry.credit > 0 ? <MoneyText value={entry.credit} /> : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}