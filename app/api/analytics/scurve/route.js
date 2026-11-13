import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getWorkingDaysDiff } from '@/lib/cpmEngine';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    const { data: project } = await supabase.from('projects').select('working_days, exceptions').eq('id', projectId).single();
    
    let workingDays = project?.working_days || [1,2,3,4,5];
    if (typeof workingDays === 'string') {
      try { workingDays = JSON.parse(workingDays); } catch(e) { workingDays = [1,2,3,4,5]; }
    }
    
    let exceptionsData = project?.exceptions || [];
    if (typeof exceptionsData === 'string') {
      try { exceptionsData = JSON.parse(exceptionsData); } catch(e) { exceptionsData = []; }
    }

    const { data: tasks, error } = await supabase.from('wbs_tasks').select('*').eq('project_id', projectId);
    if (error) throw error;
    if (!tasks || tasks.length === 0) return NextResponse.json({ ok: true, data: [] });

    const leafTasks = tasks.filter(t => {
      if (t.summary === 'Yes') return false;
      if (!t.start_date || !t.end_date) return false;
      const s = new Date(t.start_date);
      const e = new Date(t.end_date);
      return !isNaN(s.getTime()) && !isNaN(e.getTime());
    });

    if (!leafTasks.length) return NextResponse.json({ ok: true, data: [] });

    // 1. Hitung EV_Hari_Ini (Total Nilai Hasil Saat Ini)
    let evToday = 0;
    leafTasks.forEach(t => {
      const cost = Number(t.cost) || 0;
      const progress = Number(t.progress_percent) || 0;
      evToday += cost * (progress / 100);
    });

    let minDate = new Date(Math.min(...leafTasks.map(t => new Date(t.start_date))));
    let maxDate = new Date(Math.max(...leafTasks.map(t => new Date(t.end_date))));
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const rawChartData = [];
    let curDate = new Date(minDate);
    let cumulativePV = 0;
    let pvToday = 0;

    // 2. Loop untuk menghitung PV Harian
    while (curDate <= maxDate) {
      let dailyPV = 0;
      
      leafTasks.forEach(t => {
        const cost = Number(t.cost) || 0;
        const tStart = new Date(t.start_date);
        const tEnd = new Date(t.end_date);
        const duration = Math.max(1, getWorkingDaysDiff(t.start_date, t.end_date, workingDays, exceptionsData));
        
        if (curDate >= tStart && curDate <= tEnd) {
           const dayOfWeek = curDate.getDay();
           const dateStr = curDate.toISOString().split('T')[0];
           const isHoliday = exceptionsData.some(e => (e.exception_date || e) === dateStr);
           
           if (workingDays.includes(dayOfWeek) && !isHoliday) {
             dailyPV += cost / duration;
           }
        }
      });

      cumulativePV += dailyPV;

      // Simpan PV pada saat HARI INI sebagai basis pengali
      if (curDate <= today) {
         pvToday = cumulativePV;
      }

      const monthLabel = curDate.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });

      if (rawChartData.length === 0 || rawChartData[rawChartData.length - 1].month !== monthLabel) {
        rawChartData.push({
          month: monthLabel,
          date: curDate.toISOString().split('T')[0],
          pv: cumulativePV
        });
      }

      curDate.setDate(curDate.getDate() + 1);
    }

    if (pvToday === 0) pvToday = cumulativePV; 

    // 3. Distribusikan EV secara Proporsional terhadap PV
    // Ini akan membuat lengkungan kurva S yang sempurna mengejar Plan
    const finalData = rawChartData.map(d => {
      const isPastOrToday = new Date(d.date) <= today;
      let ev = null;
      let ac = null;

      if (isPastOrToday) {
        if (pvToday > 0) {
          // Rumus Proporsional: EV(t) = EV_Today * (PV(t) / PV_Today)
          ev = Math.round(evToday * (d.pv / pvToday));
          ac = ev; // Asumsi CPI = 1.0 (Hemat/Sesuai)
        } else {
          ev = 0;
          ac = 0;
        }
      }

      return {
        month: d.month,
        date: d.date,
        planned_cost_cumulative: Math.round(d.pv),
        earned_value_cumulative: ev,
        actual_cost_cumulative: ac
      };
    });

    return NextResponse.json({ ok: true, data: finalData });
  } catch (err) {
    console.error("S-Curve API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}