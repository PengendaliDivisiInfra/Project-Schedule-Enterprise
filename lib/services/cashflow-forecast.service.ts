import { supabase } from '@/lib/supabase';

export interface ForecastItem {
  date: string;
  type: 'INFLOW' | 'OUTFLOW';
  category: string;
  description: string;
  amount: number;
}

export interface CashFlowForecastData {
  currentBalance: number;
  months: {
    monthLabel: string; // e.g., "Nov 2026"
    inflow: number;
    outflow: number;
    net: number;
  }[];
  details: ForecastItem[];
}

export async function getCashFlowForecast(projectId: string): Promise<CashFlowForecastData> {
  // 1. Dapatkan Saldo Kas Saat Ini (Dari cash_flows Approved & non-void)
  const { data: flows } = await supabase
    .from('cash_flows')
    .select('type, amount')
    .eq('project_id', projectId)
    .eq('approval_status', 'Approved')
    .is('voided_at', null);

  let currentBalance = 0;
  flows?.forEach(f => {
    const isIn = ['IN', 'Income'].includes(f.type);
    currentBalance += isIn ? Number(f.amount) : -Number(f.amount);
  });

  const forecastItems: ForecastItem[] = [];

  // 2. Inflow Forecast (Piutang Klien / Invoice yang Belum Dibayar)
  const { data: invoices } = await supabase
    .from('client_invoices')
    .select('invoice_number, invoice_date, net_payable_amount, paid_amount, status')
    .eq('project_id', projectId)
    .neq('status', 'Paid')
    .neq('status', 'Void');

  invoices?.forEach(inv => {
    const outstanding = Number(inv.net_payable_amount) - Number(inv.paid_amount);
    if (outstanding > 0) {
      // Asumsi termin pembayaran klien 30 hari dari tanggal invoice
      const dueDate = new Date(inv.invoice_date);
      dueDate.setDate(dueDate.getDate() + 30); 
      
      forecastItems.push({
        date: dueDate.toISOString().split('T')[0],
        type: 'INFLOW',
        category: 'Termin Klien',
        description: `Tagihan ${inv.invoice_number}`,
        amount: outstanding
      });
    }
  });

  // 3. Outflow Forecast (Hutang Subkon / AP yang Pending)
  const { data: subconPays } = await supabase
    .from('subcontractor_payments')
    .select(`amount, payment_date, payment_number, subcontractor_contracts ( subcontractors ( company_name ) )`)
    .eq('project_id', projectId)
    .in('status', ['Pending', 'Approved']);

  // FIX: Cast to any[] untuk menghindari error type inference pada nested relation Supabase
  (subconPays as any[])?.forEach(ap => {
    forecastItems.push({
      date: ap.payment_date || new Date().toISOString().split('T')[0],
      type: 'OUTFLOW',
      category: 'Pembayaran Subkon',
      description: `No: ${ap.payment_number} - ${ap.subcontractor_contracts?.subcontractors?.company_name || 'Vendor'}`,
      amount: Number(ap.amount)
    });
  });

  // 4. Agregasi Data per Bulan (3 Bulan ke Depan)
  const monthlyData: Record<string, { inflow: number; outflow: number }> = {};
  const today = new Date();
  
  // Inisialisasi 3 bulan ke depan
  for (let i = 0; i < 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const label = d.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
    monthlyData[label] = { inflow: 0, outflow: 0 };
  }

  forecastItems.forEach(item => {
    const d = new Date(item.date);
    const label = d.toLocaleString('id-ID', { month: 'short', year: 'numeric' });
    if (monthlyData[label]) {
      if (item.type === 'INFLOW') monthlyData[label].inflow += item.amount;
      else monthlyData[label].outflow += item.amount;
    }
  });

  const months = Object.keys(monthlyData).map(key => ({
    monthLabel: key,
    inflow: monthlyData[key].inflow,
    outflow: monthlyData[key].outflow,
    net: monthlyData[key].inflow - monthlyData[key].outflow
  }));

  return {
    currentBalance,
    months,
    details: forecastItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  };
}