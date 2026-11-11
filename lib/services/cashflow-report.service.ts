// lib/services/cashflow-report.service.ts
import { supabase } from '@/lib/supabase';

export interface CashFlowStatementData {
  periodStart: string;
  periodEnd: string;
  saldoAwal: number;
  operating: { inflow: number; outflow: number; details: any[] };
  investing: { inflow: number; outflow: number; details: any[] };
  financing: { inflow: number; outflow: number; details: any[] };
  netIncrease: number;
  saldoAkhir: number;
}

export async function getCashFlowStatement(projectId: string, startDate: string, endDate: string): Promise<CashFlowStatementData> {
  // 1. Ambil Saldo Awal (Semua transaksi sebelum startDate)
  const { data: prevFlows } = await supabase
    .from('cash_flows')
    .select('type, amount')
    .eq('project_id', projectId)
    .eq('approval_status', 'Approved')
    .is('voided_at', null)
    .lt('transaction_date', startDate);

  let saldoAwal = 0;
  if (prevFlows) {
    prevFlows.forEach(f => {
      const isIn = ['IN', 'Income'].includes(f.type);
      saldoAwal += isIn ? Number(f.amount) : -Number(f.amount);
    });
  }

  // 2. Ambil Transaksi dalam Periode
  const { data: flows, error } = await supabase
    .from('cash_flows')
    .select('*')
    .eq('project_id', projectId)
    .eq('approval_status', 'Approved')
    .is('voided_at', null)
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)
    .order('transaction_date', { ascending: true });

  if (error) throw new Error(error.message);

  // 3. Mapping & Kalkulasi
  const result: CashFlowStatementData = {
    periodStart: startDate,
    periodEnd: endDate,
    saldoAwal,
    operating: { inflow: 0, outflow: 0, details: [] },
    investing: { inflow: 0, outflow: 0, details: [] },
    financing: { inflow: 0, outflow: 0, details: [] },
    netIncrease: 0,
    saldoAkhir: 0,
  };

  flows?.forEach(f => {
    const isIn = ['IN', 'Income'].includes(f.type);
    const amount = Number(f.amount);
    
    // Klasifikasi SAK ETAP
    if (f.category === 'Alat') {
      // INVESTASI
      if (isIn) result.investing.inflow += amount;
      else result.investing.outflow += amount;
      result.investing.details.push(f);
    } else if (['Pinjaman', 'Modal', 'Dividen'].includes(f.category)) {
      // PENDANAAN
      if (isIn) result.financing.inflow += amount;
      else result.financing.outflow += amount;
      result.financing.details.push(f);
    } else {
      // OPERASI (Default: Termin, DP, Material, Upah, Subkon, Operasional)
      if (isIn) result.operating.inflow += amount;
      else result.operating.outflow += amount;
      result.operating.details.push(f);
    }
  });

  // Hitung Net
  const totalIn = result.operating.inflow + result.investing.inflow + result.financing.inflow;
  const totalOut = result.operating.outflow + result.investing.outflow + result.financing.outflow;
  
  result.netIncrease = totalIn - totalOut;
  result.saldoAkhir = saldoAwal + result.netIncrease;

  return result;
}