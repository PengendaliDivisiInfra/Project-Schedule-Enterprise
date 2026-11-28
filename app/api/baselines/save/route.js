import { NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/utils/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { project_id, name } = body || {};

    const auth = await requireProjectAccess(request, project_id, {
      allowedRoles: ['Owner', 'Project Manager', 'Site Admin', 'DCC/Logistic'],
    });
    if (!auth.ok) return auth.response;

    const { supabase } = auth;

    const { data: tasks, error } = await supabase
      .from('wbs_tasks')
      .select('id, wbs_code, task_code, start_date, end_date, finish_date, duration, cost')
      .eq('project_id', project_id);

    if (error) throw error;

    const safeTasks = tasks || [];
    const snapshot = safeTasks.map((t) => ({
      id: t.id,
      task_code: t.task_code || t.wbs_code || null,
      start: t.start_date,
      finish: t.end_date || t.finish_date || null,
      duration: Number(t.duration) || 0,
      cost: Number(t.cost) || 0,
    }));

    const { data, error: insertErr } = await supabase
      .from('baselines')
      .insert({
        project_id,
        name: name || `Baseline ${new Date().toLocaleDateString('id-ID')}`,
        data: snapshot,
        task_count: safeTasks.length,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({ ok: true, baseline: data });
  } catch (err) {
    console.error('Baselines Save API Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}