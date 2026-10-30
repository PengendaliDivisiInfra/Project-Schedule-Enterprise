import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const timescale = searchParams.get('timescale') || 'week';
    const wbsFilter = searchParams.get('wbs');

    if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    // 1. Ambil data tasks dari Supabase
    let query = supabase.from('wbs_tasks').select('*').eq('project_id', projectId);
    const { data: tasks, error } = await query;
    if (error) throw error;

    // Filter WBS jika ada
    let filteredTasks = tasks;
    if (wbsFilter) {
      filteredTasks = tasks.filter(t => String(t.wbs || '').startsWith(wbsFilter));
    }

    const leafTasks = filteredTasks.filter(t => t.summary !== 'Yes');
    if (!leafTasks.length) return NextResponse.json({ ok: true, labels: [], planned: [], earned: [], actual: [] });

    // 2. Tentukan Timeline
    let pStart = new Date();
    let pFinish = new Date();
    leafTasks.forEach(t => {
      if (t.start_date && new Date(t.start_date) < pStart) pStart = new Date(t.start_date);
      if (t.finish_date && new Date(t.finish_date) > pFinish) pFinish = new Date(t.finish_date);
    });

    // 3. Generate Label Waktu (Sederhana per Minggu)
    const labels = [];
    const planned = [];
    const earned = [];
    const actual = [];
    
    let cur = new Date(pStart);
    pFinish.setDate(pFinish.getDate() + 7); // buffer 1 minggu

    while (cur <= pFinish) {
      labels.push(cur.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
      
      let pv = 0; let ev = 0; let ac = 0;
      leafTasks.forEach(t => {
        const bac = Number(t.cost) || 0;
        const tStart = new Date(t.start_date);
        const tFinish = new Date(t.finish_date);
        
        // Hitung PV (Planned Value)
        if (cur >= tFinish) pv += bac;
        else if (cur >= tStart) {
          const dur = Math.max(1, Number(t.duration));
          const elapsed = Math.ceil((cur - tStart) / (1000 * 3600 * 24));
          pv += bac * Math.min(1, elapsed / dur);
        }

        // Hitung EV (Earned Value)
        const progress = Number(t.progress_percent) || 0;
        ev += bac * (progress / 100);

        // Hitung AC (Actual Cost)
        ac += Number(t.actual_cost) || 0;
      });

      planned.push(Math.round(pv));
      earned.push(Math.round(ev));
      actual.push(Math.round(ac));
      cur.setDate(cur.getDate() + 7); // increment 1 minggu
    }

    return NextResponse.json({
      ok: true,
      labels,
      planned,
      earned,
      actual,
      summary: {
        bac: leafTasks.reduce((s, t) => s + (Number(t.cost) || 0), 0),
        pv: planned[planned.length - 1],
        ev: earned[earned.length - 1],
        ac: actual[actual.length - 1]
      }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
