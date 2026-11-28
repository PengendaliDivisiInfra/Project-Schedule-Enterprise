import { NextResponse } from 'next/server';
import { getWorkingDaysDiff } from '@/lib/cpmEngine';
import { requireProjectAccess } from '@/lib/utils/api-auth';

export const dynamic = 'force-dynamic';

const ACCRUAL_BACKED_CF_REF_TYPES = new Set([
  'subcontractor_payment',
  'subcon_payment',
  'payment',
  'bar_payment',
  'bar_payment_reversal',
  'fuel_po',
  'payroll',
  'po_payment',
]);

const ACCRUAL_BACKED_CF_VENDORS = new Set([
  'payroll',
  'purchase order',
  'void po',
]);

function isAccrualBackedCashFlow(cf) {
  const refType = String(cf?.reference_type || '').toLowerCase().trim();
  const vendor = String(cf?.vendor_or_ref || '').toLowerCase().trim();
  return ACCRUAL_BACKED_CF_REF_TYPES.has(refType) || ACCRUAL_BACKED_CF_VENDORS.has(vendor);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    const auth = await requireProjectAccess(request, projectId);
    if (!auth.ok) return auth.response;

    const { supabase } = auth;

    const [projRes, tasksRes, acRes, cfRes, subconRes] = await Promise.all([
      supabase
        .from('projects')
        .select('working_days, exceptions')
        .eq('id', projectId)
        .single(),
      supabase
        .from('wbs_tasks')
        .select('*')
        .eq('project_id', projectId),
      supabase
        .from('actual_costs')
        .select('cost_amount, recorded_at, reference_type')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .is('voided_at', null),
      supabase
        .from('cash_flows')
        .select('amount, transaction_date, type, category, reference_type, vendor_or_ref')
        .eq('project_id', projectId)
        .in('type', ['OUT', 'Expense'])
        .eq('approval_status', 'Approved')
        .eq('is_deleted', false)
        .is('voided_at', null),
      supabase
        .from('subcontractor_payments')
        .select('amount, payment_date, payment_type, status')
        .eq('project_id', projectId)
        .eq('is_deleted', false)
        .is('voided_at', null)
        .in('status', ['Approved', 'Paid']),
    ]);

    if (tasksRes.error) throw tasksRes.error;
    const tasks = tasksRes.data || [];
    if (tasks.length === 0) {
      return NextResponse.json({
        ok: true,
        data: [],
        labels: [],
        planned: [],
        earned: [],
        actual: [],
      });
    }

    const project = projRes.data;
    let workingDays = project?.working_days || [1, 2, 3, 4, 5];
    if (typeof workingDays === 'string') {
      try {
        workingDays = JSON.parse(workingDays);
      } catch {
        workingDays = [1, 2, 3, 4, 5];
      }
    }

    let exceptionsData = project?.exceptions || [];
    if (typeof exceptionsData === 'string') {
      try {
        exceptionsData = JSON.parse(exceptionsData);
      } catch {
        exceptionsData = [];
      }
    }

    const leafTasks = tasks.filter((t) => {
      if (t.summary === 'Yes') return false;
      const sStr = t.start_date;
      const eStr = t.end_date || t.finish_date;
      if (!sStr || !eStr) return false;
      const s = new Date(sStr);
      const e = new Date(eStr);
      return !isNaN(s.getTime()) && !isNaN(e.getTime());
    });

    if (!leafTasks.length) {
      return NextResponse.json({
        ok: true,
        data: [],
        labels: [],
        planned: [],
        earned: [],
        actual: [],
      });
    }

    // 1. Kumpulkan event Actual Cost (AC) NYATA berdasarkan tanggal (bebas double counting)
    // Sumber AC:
    //  - actual_costs (kecuali subcon payment yang sudah dicatat di subcontractor_payments)
    //  - subcontractor_payments (Opname Approved/Paid; Kasbon/DP adalah uang muka)
    //  - cash_flows keluar manual/langsung (bukan pasangan jurnal akrual)
    const acEvents = [];

    (acRes.data || []).forEach((ac) => {
      const refType = String(ac.reference_type || '').toLowerCase().trim();
      if (['subcontractor_payment', 'subcon_payment', 'payment'].includes(refType)) {
        return;
      }
      const amt = Number(ac.cost_amount) || 0;
      const dateStr = ac.recorded_at ? String(ac.recorded_at).slice(0, 10) : null;
      if (dateStr && amt !== 0) {
        acEvents.push({ date: dateStr, amount: amt });
      }
    });

    (subconRes.data || []).forEach((sp) => {
      if (sp.payment_type === 'Kasbon' || sp.payment_type === 'DP') return;
      const amt = Number(sp.amount) || 0;
      const dateStr = sp.payment_date ? String(sp.payment_date).slice(0, 10) : null;
      if (dateStr && amt > 0) {
        acEvents.push({ date: dateStr, amount: amt });
      }
    });

    (cfRes.data || []).forEach((cf) => {
      if (isAccrualBackedCashFlow(cf)) return;
      if (['Droping', 'Pinjaman', 'Modal', 'Transfer Internal'].includes(cf.category)) return;
      const amt = Number(cf.amount) || 0;
      const dateStr = cf.transaction_date ? String(cf.transaction_date).slice(0, 10) : null;
      if (dateStr && amt > 0) {
        acEvents.push({ date: dateStr, amount: amt });
      }
    });

    // 2. Hitung EV kumulatif saat ini dari progres fisik WBS
    let evToday = 0;
    leafTasks.forEach((t) => {
      const cost = Number(t.cost) || 0;
      const progress = Number(t.progress_percent) || 0;
      evToday += cost * (progress / 100);
    });

    const minDate = new Date(
      Math.min(...leafTasks.map((t) => new Date(t.start_date).getTime()))
    );
    const maxDate = new Date(
      Math.max(...leafTasks.map((t) => new Date(t.end_date || t.finish_date).getTime()))
    );

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const todayIso = today.toISOString().split('T')[0];

    // 3. Bangun kurva PV bulanan berdasarkan hari kerja & pengecualian kalender
    const monthlyBuckets = new Map();
    let curDate = new Date(minDate);
    let cumulativePV = 0;
    let pvToday = 0;

    while (curDate <= maxDate) {
      let dailyPV = 0;
      const dateStr = curDate.toISOString().split('T')[0];
      const dayOfWeek = curDate.getDay();
      const isHoliday = exceptionsData.some(
        (e) => (e?.exception_date || e) === dateStr
      );

      if (workingDays.includes(dayOfWeek) && !isHoliday) {
        leafTasks.forEach((t) => {
          const cost = Number(t.cost) || 0;
          const tEndStr = t.end_date || t.finish_date;
          const tStart = new Date(t.start_date);
          const tEnd = new Date(tEndStr);
          if (curDate >= tStart && curDate <= tEnd) {
            const duration = Math.max(
              1,
              getWorkingDaysDiff(t.start_date, tEndStr, workingDays, exceptionsData)
            );
            dailyPV += cost / duration;
          }
        });
      }

      cumulativePV += dailyPV;
      if (curDate <= today) {
        pvToday = cumulativePV;
      }

      const monthKey = dateStr.slice(0, 7); // YYYY-MM
      const monthLabel = curDate.toLocaleDateString('id-ID', {
        month: 'short',
        year: '2-digit',
      });

      // Simpan snapshot akhir bulan (bukan tanggal 1) agar PV & AC akurat sampai penutupan bulan
      monthlyBuckets.set(monthKey, {
        monthKey,
        month: monthLabel,
        date: dateStr,
        pv: cumulativePV,
      });

      curDate.setDate(curDate.getDate() + 1);
    }

    if (pvToday === 0) pvToday = cumulativePV;

    // 4. Gabungkan PV, EV, dan AC NYATA per bulan
    const rawChartData = Array.from(monthlyBuckets.values()).sort((a, b) =>
      a.monthKey.localeCompare(b.monthKey)
    );

    const currentMonthKey = todayIso.slice(0, 7);

    const finalData = rawChartData.map((d) => {
      const isPastOrCurrentMonth = d.monthKey <= currentMonthKey;
      let ev = null;
      let ac = null;

      if (isPastOrCurrentMonth) {
        const cutoffDate = d.date <= todayIso ? d.date : todayIso;

        // EV proporsional terhadap kurva PV sampai hari ini (terbatas maksimum evToday)
        if (pvToday > 0) {
          ev = Math.round(Math.min(evToday, evToday * (d.pv / pvToday)));
        } else {
          ev = Math.round(evToday);
        }

        // AC murni kumulatif dari transaksi keuangan/akrual hingga cutoffDate (TIDAK lagi ac = ev)
        const acSum = acEvents.reduce((sum, evItem) => {
          return evItem.date <= cutoffDate ? sum + evItem.amount : sum;
        }, 0);
        ac = Math.max(0, Math.round(acSum));
      }

      return {
        month: d.month,
        date: d.date,
        planned_cost_cumulative: Math.round(d.pv),
        earned_value_cumulative: ev,
        actual_cost_cumulative: ac,
      };
    });

    return NextResponse.json({
      ok: true,
      data: finalData,
      labels: finalData.map((d) => d.month),
      planned: finalData.map((d) => d.planned_cost_cumulative),
      earned: finalData.map((d) => d.earned_value_cumulative),
      actual: finalData.map((d) => d.actual_cost_cumulative),
    });
  } catch (err) {
    console.error('S-Curve API Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}