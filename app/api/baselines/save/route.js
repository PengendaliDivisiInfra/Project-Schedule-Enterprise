import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = await request.json();
    const { project_id, name } = body;

    if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    const { data: tasks, error } = await supabase.from('wbs_tasks').select('id, task_code, start_date, finish_date, duration, cost').eq('project_id', project_id);
    if (error) throw error;

    const snapshot = tasks.map(t => ({
      id: t.id,
      task_code: t.task_code,
      start: t.start_date,
      finish: t.finish_date,
      duration: t.duration,
      cost: t.cost
    }));

    const { data, error: insertErr } = await supabase.from('baselines').insert({
      project_id,
      name: name || `Baseline ${new Date().toLocaleDateString('id-ID')}`,
      data: snapshot,
      task_count: tasks.length
    }).select().single();

    if (insertErr) throw insertErr;

    return NextResponse.json({ ok: true, baseline: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}