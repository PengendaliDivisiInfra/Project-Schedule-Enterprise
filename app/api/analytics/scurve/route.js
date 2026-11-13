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

    let minDate = new Date(Math.min(...leafTasks.map(t => new Date(t.start_date))));
    let maxDate = new Date(Math.max(...leafTasks.map(t => new Date(t.end_date))));
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const chartData = [];
    let curDate = new Date(minDate);
    let cumulativePV = 0;

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

      let currentEV = 0;
      let currentAC = 0;

      if (curDate <= today) {
        leafTasks.forEach(t => {
          const cost = Number(t.cost) || 0;
          const progress = Number(t.progress_percent) || 0;
          const actualCost = Number(t.realisasi_cost) || 0; 
          const tStart = new Date(t.start_date);
          const tEnd = new Date(t.end_date);

          if (progress > 0 && curDate >= tStart) {
            let ratio = 1;
            
            // Logika kunci: Jika hari ini, rasio 1 (nilai penuh). Jika masa lalu, interpolasi.
            if (curDate < today) {
              const totalElapsedToToday = today - tStart;
              const timeElapsed = curDate - tStart;
              ratio = totalElapsedToToday > 0 ? Math.min(1, timeElapsed / totalElapsedToToday) : 1;
            }
            
            currentEV += (cost * (progress / 100)) * ratio;
            currentAC += actualCost * ratio;
          }
        });
      }

      const monthLabel = curDate.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });

      if (chartData.length === 0 || chartData[chartData.length - 1].month !== monthLabel) {
        chartData.push({
          month: monthLabel,
          date: curDate.toISOString().split('T')[0],
          planned_cost_cumulative: Math.round(cumulativePV),
          earned_value_cumulative: curDate <= today ? Math.round(currentEV) : null,
          actual_cost_cumulative: curDate <= today ? Math.round(currentAC) : null
        });
      }

      curDate.setDate(curDate.getDate() + 1);
    }

    return NextResponse.json({ ok: true, data: chartData });
  } catch (err) {
    console.error("S-Curve API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}