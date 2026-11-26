import { NextRequest, NextResponse } from 'next/server';
import { addWorkingDays, isWorkingDay } from '@/lib/cpmEngine';
import { requireProjectAccess } from '@/lib/utils/api-auth';

export const dynamic = 'force-dynamic';

function subtractWorkingDays(
  endDateStr: string,
  durationInDays: number,
  workingDays: number[],
  exceptions: Set<string>
): string {
  const result = new Date(endDateStr);
  let remaining = Math.max(1, Math.round(durationInDays)) - 1;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    if (isWorkingDay(result, workingDays, exceptions)) {
      remaining--;
    }
  }
  return result.toISOString().split('T')[0];
}

function shiftCalendarDays(dateMs: number, lagDays: number): number {
  const d = new Date(dateMs);
  d.setDate(d.getDate() + (Number(lagDays) || 0));
  return d.getTime();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const project_id = body?.project_id as string | undefined;

    const auth = await requireProjectAccess(req, project_id);
    if (!auth.ok) return auth.response;

    const { supabase } = auth;

    // 1. Fetch Tasks, Dependencies, Calendar, dan Actual Cost
    const [tasksRes, depsRes, calRes, acRes] = await Promise.all([
      supabase.from('wbs_tasks').select('*').eq('project_id', project_id),
      supabase.from('task_dependencies').select('*').eq('project_id', project_id),
      supabase
        .from('calendars')
        .select('id, work_days')
        .eq('project_id', project_id)
        .maybeSingle(),
      supabase
        .from('actual_costs')
        .select('cost_amount, reference_type')
        .eq('project_id', project_id)
        .eq('is_deleted', false)
        .is('voided_at', null),
    ]);

    if (tasksRes.error) throw tasksRes.error;
    const rawTasks = tasksRes.data || [];
    const deps = depsRes.data || [];
    const calData = calRes.data;

    let workingDays = [1, 2, 3, 4, 5];
    const exceptionsSet = new Set<string>();

    if (calData) {
      if (calData.work_days) {
        const parsed = String(calData.work_days)
          .split(',')
          .map(Number)
          .filter((n: number) => !isNaN(n));
        if (parsed.length > 0) workingDays = parsed;
      }
      const { data: excData } = await supabase
        .from('calendar_exceptions')
        .select('exception_date')
        .eq('calendar_id', calData.id);

      if (excData) {
        excData.forEach((e: any) => {
          if (e?.exception_date) exceptionsSet.add(String(e.exception_date));
        });
      }
    }

    if (rawTasks.length === 0) {
      return NextResponse.json({
        ok: true,
        tasks: [],
        critical_path: [],
        evm: { bac: 0, pv: 0, ev: 0, ac: 0, spi: 1, cpi: 1, status_spi: 'ON_TRACK', status_cpi: 'ON_BUDGET' },
        resource_explosion: [],
      });
    }

    // 2. Build Graph & Topological Sort (dengan proteksi siklus)
    const taskMap = new Map<string, any>(
      rawTasks.map((t: any) => [
        t.id,
        {
          ...t,
          predecessors: [] as Array<{ id: string; type: string; lag: number }>,
          es: 0,
          ef: 0,
          ls: 0,
          lf: 0,
          slack: 0,
        },
      ])
    );

    deps.forEach((d: any) => {
      taskMap.get(d.target_task_id)?.predecessors.push({
        id: d.source_task_id,
        type: String(d.dependency_type || 'FS').toUpperCase(),
        lag: Number(d.lag_days) || 0,
      });
    });

    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string) => {
      if (visited.has(id) || visiting.has(id)) return;
      visiting.add(id);
      taskMap.get(id)?.predecessors.forEach((p: any) => visit(p.id));
      visiting.delete(id);
      visited.add(id);
      order.push(id);
    };
    taskMap.forEach((_, id) => visit(id));

    const defaultStartIso = new Date().toISOString().split('T')[0];

    // 3. Forward Pass (FS, SS, FF, SF + Working Days)
    order.forEach((id) => {
      const task = taskMap.get(id)!;
      const dur = Math.max(1, Number(task.duration) || 1);
      const baseStart = task.start_date
        ? new Date(task.start_date).getTime()
        : new Date(defaultStartIso).getTime();

      let maxEsMs = baseStart;

      task.predecessors.forEach((p: any) => {
        const pred = taskMap.get(p.id);
        if (!pred) return;

        let candEs = 0;
        if (p.type === 'FS') {
          candEs = shiftCalendarDays(pred.ef, (p.lag || 0) + 1);
        } else if (p.type === 'SS') {
          candEs = shiftCalendarDays(pred.es, p.lag || 0);
        } else if (p.type === 'FF') {
          const targetEfIso = new Date(shiftCalendarDays(pred.ef, p.lag || 0))
            .toISOString()
            .split('T')[0];
          candEs = new Date(
            subtractWorkingDays(targetEfIso, dur, workingDays, exceptionsSet)
          ).getTime();
        } else if (p.type === 'SF') {
          const targetEfIso = new Date(shiftCalendarDays(pred.es, p.lag || 0))
            .toISOString()
            .split('T')[0];
          candEs = new Date(
            subtractWorkingDays(targetEfIso, dur, workingDays, exceptionsSet)
          ).getTime();
        }

        if (candEs > maxEsMs) maxEsMs = candEs;
      });

      const esDateStr = new Date(maxEsMs).toISOString().split('T')[0];
      const efDateStr = addWorkingDays(esDateStr, dur, workingDays, exceptionsSet);

      task.es = new Date(esDateStr).getTime();
      task.ef = new Date(efDateStr).getTime();
    });

    const projectFinish = Math.max(
      ...Array.from(taskMap.values()).map((t) => t.ef),
      1
    );

    // 4. Backward Pass berbasis Working Days
    [...order].reverse().forEach((id) => {
      const task = taskMap.get(id)!;
      const dur = Math.max(1, Number(task.duration) || 1);
      const successors = Array.from(taskMap.values()).filter((t) =>
        t.predecessors.some((p: any) => p.id === id)
      );

      if (successors.length === 0) {
        task.lf = projectFinish;
      } else {
        let minLf = Infinity;
        successors.forEach((succ) => {
          const link = succ.predecessors.find((p: any) => p.id === id)!;
          let candLf = succ.ls;
          if (link.type === 'FS') {
            candLf = shiftCalendarDays(succ.ls, -((link.lag || 0) + 1));
          } else if (link.type === 'SS') {
            const targetLsIso = new Date(shiftCalendarDays(succ.ls, -(link.lag || 0)))
              .toISOString()
              .split('T')[0];
            candLf = new Date(
              addWorkingDays(targetLsIso, dur, workingDays, exceptionsSet)
            ).getTime();
          } else if (link.type === 'FF') {
            candLf = shiftCalendarDays(succ.lf, -(link.lag || 0));
          } else if (link.type === 'SF') {
            candLf = shiftCalendarDays(succ.lf, -(link.lag || 0));
          }
          minLf = Math.min(minLf, candLf);
        });
        task.lf = Number.isFinite(minLf) ? minLf : projectFinish;
      }

      const lfDateStr = new Date(task.lf).toISOString().split('T')[0];
      const lsDateStr = subtractWorkingDays(lfDateStr, dur, workingDays, exceptionsSet);
      task.ls = new Date(lsDateStr).getTime();
      task.slack = Math.round((task.ls - task.es) / 86400000);
    });

    const criticalPath = Array.from(taskMap.values())
      .filter((t) => t.slack <= 0)
      .map((t) => t.id);

    // 5. Project-level EVM Summary (menggunakan AC aktual dari actual_costs)
    const todayMs = new Date().setHours(23, 59, 59, 999);
    let bac = 0;
    let pv = 0;
    let ev = 0;

    rawTasks
      .filter((t: any) => t.summary !== 'Yes')
      .forEach((t: any) => {
        const cost = Number(t.cost) || 0;
        const prog = Number(t.progress_percent) || 0;
        bac += cost;
        ev += cost * (prog / 100);

        const sMs = t.start_date ? new Date(t.start_date).getTime() : 0;
        const eMs = (t.end_date || t.finish_date)
          ? new Date(t.end_date || t.finish_date).getTime()
          : 0;

        if (sMs && eMs) {
          if (todayMs >= eMs) {
            pv += cost;
          } else if (todayMs > sMs) {
            const ratio = Math.min(1, Math.max(0, (todayMs - sMs) / Math.max(86400000, eMs - sMs)));
            pv += cost * ratio;
          }
        }
      });

    const ac = (acRes.data || []).reduce(
      (sum: number, r: any) => sum + (Number(r.cost_amount) || 0),
      0
    );

    const spi = pv > 0 ? Number((ev / pv).toFixed(3)) : 1;
    const cpi = ac > 0 ? Number((ev / ac).toFixed(3)) : 1;

    return NextResponse.json({
      ok: true,
      project_finish: projectFinish,
      tasks: Array.from(taskMap.values()),
      critical_path: criticalPath,
      evm: {
        bac: Math.round(bac),
        pv: Math.round(pv),
        ev: Math.round(ev),
        ac: Math.round(ac),
        spi,
        cpi,
        status_spi: spi >= 1 ? 'ON_TRACK' : 'BEHIND',
        status_cpi: cpi >= 1 ? 'UNDER_BUDGET' : 'OVER_BUDGET',
      },
      resource_explosion: [],
    });
  } catch (error: any) {
    console.error('[API CPM Error]:', error?.message);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}