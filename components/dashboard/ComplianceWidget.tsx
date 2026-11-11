'use client';
import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useProject } from '@/context/ProjectContext';
import Link from 'next/link';

export default function ComplianceWidget() {
  const { activeProjectId } = useProject();
  const [status, setStatus] = useState({
    hasUnreceivedPO: false,
    todayCashFlowCount: 0
  });

  useEffect(() => {
    const checkCompliance = async () => {
      if (!activeProjectId) return;
      const today = new Date().toISOString().split('T')[0];

      // 1. Cek PO yang belum di-GRN
      const { data: poData } = await supabase
        .from('purchase_orders')
        .select('id, purchase_order_items(received_qty, ordered_qty)')
        .eq('project_id', activeProjectId)
        .neq('status', 'Void');
      
      const hasUnreceived = poData?.some(po => 
        po.purchase_order_items?.some((item: any) => item.received_qty < item.ordered_qty)
      ) || false;

      // 2. Cek Cash Flow hari ini
      const { count } = await supabase
        .from('cash_flows')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', activeProjectId)
        .eq('transaction_date', today);

      setStatus({
        hasUnreceivedPO: hasUnreceived,
        todayCashFlowCount: count || 0
      });
    };
    checkCompliance();
  }, [activeProjectId]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 w-full">
      <div className="flex items-center justify-between mb-4 border-b pb-2">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <ShieldAlert className="text-indigo-600" size={20} /> 
          Daily Compliance Check
        </h3>
        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-bold">Berdasarkan SOP</span>
      </div>

      <div className="space-y-3">
        {/* Cek 1: PO Belum GRN */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
          <span className="text-sm font-medium text-slate-700">Penerimaan Barang (GRN)</span>
          {status.hasUnreceivedPO ? (
            <span className="text-xs font-bold text-red-600 flex items-center gap-1"><AlertCircle size={14}/> Ada PO Belum Diterima</span>
          ) : (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle size={14}/> Semua PO Sesuai</span>
          )}
        </div>

        {/* Cek 2: Input Kas Hari Ini */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
          <span className="text-sm font-medium text-slate-700">Input Kas Harian</span>
          {status.todayCashFlowCount > 0 ? (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle size={14}/> {status.todayCashFlowCount} Transaksi Diinput</span>
          ) : (
            <span className="text-xs font-bold text-amber-600 flex items-center gap-1"><AlertCircle size={14}/> Belum ada input hari ini</span>
          )}
        </div>
      </div>
      
      <div className="mt-4 text-center">
        <Link href="/sop" className="text-xs font-bold text-indigo-600 hover:underline">Baca SOP Lengkap &rarr;</Link>
      </div>
    </div>
  );
}