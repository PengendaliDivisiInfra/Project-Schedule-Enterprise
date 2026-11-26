import { NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/utils/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const statusDate =
      searchParams.get('status_date') || new Date().toISOString().split('T')[0];
    const windowDays = Math.max(1, Number(searchParams.get('window_days')) || 7);

    const auth = await requireProjectAccess(request, projectId);
    if (!auth.ok) return auth.response;

    const { supabase } = auth;

    const statusD = new Date(statusDate);
    if (isNaN(statusD.getTime())) {
      return NextResponse.json(
        { ok: false, error: 'Format status_date tidak valid.' },
        { status: 400 }
      );
    }

    const windowEnd = new Date(statusD);
    windowEnd.setDate(windowEnd.getDate() + windowDays);

    const [tasksRes, readinessRes] = await Promise.all([
      supabase.from('wbs_tasks').select('*').eq('project_id', projectId),
      supabase.from('lookahead_readiness').select('*').eq('project_id', projectId),
    ]);

    if (tasksRes.error) throw tasksRes.error;

    const tasks = tasksRes.data || [];
    const readinessMap = new Map(
      (readinessRes.data || []).map((r) => [r.task_id, r])
    );

    const rows = tasks
      .filter((t) => {
        if (t.summary === 'Yes') return false;
        const startVal = t.start_date;
        const finishVal = t.end_date || t.finish_date;
        if (!startVal || !finishVal) return false;
        const s = new Date(startVal);
        const f = new Date(finishVal);
        if (isNaN(s.getTime()) || isNaN(f.getTime())) return false;
        return s <= windowEnd && f >= statusD;
      })
      .map((t) => {
        const finishVal = t.end_date || t.finish_date;
        const rd = readinessMap.get(t.id) || {
          material_ready: false,
          alat_ready: false,
          tenaga_ready: false,
          volume: Number(t.volume) || 0,
        };
        const duration = Math.max(1, Number(t.duration) || 1);
        const dailyTarget =
          rd.volume > 0 ? +(Number(rd.volume) / duration).toFixed(2) : 0;

        const isOverdue =
          new Date(finishVal) < statusD && Number(t.progress_percent || 0) < 100;
        const isOngoing =
          new Date(t.start_date) <= statusD && new Date(finishVal) >= statusD;

        return {
          id: t.id,
          wbs: t.wbs_code || t.wbs || '-',
          name: t.task_name || t.name || '-',
          start: t.start_date,
          finish: finishVal,
          duration,
          progress: Number(t.progress_percent) || 0,
          volume: Number(rd.volume) || 0,
          dailyTarget,
          materialReady: Boolean(rd.material_ready),
          alatReady: Boolean(rd.alat_ready),
          tenagaReady: Boolean(rd.tenaga_ready),
          status: isOverdue ? 'OVERDUE' : isOngoing ? 'ONGOING' : 'UPCOMING',
        };
      });

    return NextResponse.json({ ok: true, statusDate, windowDays, rows });
  } catch (err) {
    console.error('Lookahead API Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}