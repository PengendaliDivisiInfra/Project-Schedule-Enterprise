import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const statusDate = searchParams.get('status_date') || new Date().toISOString().split('T')[0];
    const windowDays = Number(searchParams.get('window_days')) || 7;

    if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    const statusD = new Date(statusDate);
    const windowEnd = new Date(statusD);
    windowEnd.setDate(windowEnd.getDate() + windowDays);

    const { data: tasks } = await supabase.from('wbs_tasks').select('*').eq('project_id', projectId);
    const { data: readiness } = await supabase.from('lookahead_readiness').select('*').eq('project_id', projectId);
    
    const readinessMap = new Map((readiness || []).map(r => [r.task_id, r]));

    const rows = tasks.filter(t => {
      if (t.summary === 'Yes') return false;
      const s = new Date(t.start_date);
      const f = new Date(t.finish_date);
      return (s <= windowEnd && f >= statusD);
    }).map(t => {
      const rd = readinessMap.get(t.id) || { material_ready: false, alat_ready: false, tenaga_ready: false, volume: 0 };
      const duration = Math.max(1, Number(t.duration));
      const dailyTarget = rd.volume > 0 ? +(rd.volume / duration).toFixed(2) : 0;
      
      const isOverdue = new Date(t.finish_date) < statusD && Number(t.progress_percent) < 100;
      const isOngoing = new Date(t.start_date) <= statusD && new Date(t.finish_date) >= statusD;

      return {
        id: t.id,
        wbs: t.wbs,
        name: t.name,
        start: t.start_date,
        finish: t.finish_date,
        duration,
        progress: t.progress_percent,
        volume: rd.volume,
        dailyTarget,
        materialReady: rd.material_ready,
        alatReady: rd.alat_ready,
        tenagaReady: rd.tenaga_ready,
        status: isOverdue ? 'OVERDUE' : (isOngoing ? 'ONGOING' : 'UPCOMING')
      };
    });

    return NextResponse.json({ ok: true, statusDate, windowDays, rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}