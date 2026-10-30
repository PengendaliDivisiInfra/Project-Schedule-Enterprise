import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { project_id } = await req.json();
    if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    // 1. Fetch Tasks & Dependencies
    const { data: rawTasks, error: errTasks } = await supabase
      .from('wbs_tasks').select('*').eq('project_id', project_id);
    
    const { data: deps } = await supabase
      .from('task_dependencies').select('*').eq('project_id', project_id);

    if (errTasks || !rawTasks || rawTasks.length === 0) {
      return NextResponse.json({ ok: true, tasks: [], critical_path: [], evm: null, resource_explosion: [] });
    }

    // 2. Build Graph & Topological Sort
    const taskMap = new Map(rawTasks.map(t => [t.id, { ...t, predecessors: [], es: 0, ef: 0, ls: 0, lf: 0, slack: 0 }]));
    deps?.forEach(d => taskMap.get(d.target_task_id)?.predecessors.push({ id: d.source_task_id, type: d.dependency_type, lag: d.lag_days }));

    const order: string[] = [];
    const visited = new Set<string>();
    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      taskMap.get(id)?.predecessors.forEach((p: any) => visit(p.id));
      order.push(id);
    };
    taskMap.forEach((_, id) => visit(id));

    // 3. Forward Pass (Menghitung ES & EF)
    order.forEach(id => {
      const task = taskMap.get(id)!;
      let maxEF = 0;
      task.predecessors.forEach((p: any) => {
        const pred = taskMap.get(p.id);
        if (!pred) return;
        let cand = 0;
        if (p.type === 'FS') cand = pred.ef + p.lag;
        if (p.type === 'SS') cand = pred.es + p.lag;
        if (p.type === 'FF') cand = pred.ef + p.lag - task.duration;
        if (p.type === 'SF') cand = pred.es + p.lag - task.duration;
        maxEF = Math.max(maxEF, cand);
      });
      task.es = maxEF;
      task.ef = task.es + task.duration;
    });

    const projectFinish = Math.max(...Array.from(taskMap.values()).map(t => t.ef), 1);

    // 4. Backward Pass (Menghitung LS, LF & Slack)
    [...order].reverse().forEach(id => {
      const task = taskMap.get(id)!;
      const successors = Array.from(taskMap.values()).filter(t => t.predecessors.some((p: any) => p.id === id));
      if (successors.length === 0) {
        task.lf = projectFinish;
      } else {
        let minLS = Infinity;
        successors.forEach(succ => {
          const link = succ.predecessors.find((p: any) => p.id === id)!;
          let cand = Infinity;
          if (link.type === 'FS') cand = succ.ls - link.lag;
          if (link.type === 'SS') cand = succ.ls - link.lag + task.duration;
          if (link.type === 'FF') cand = succ.lf - link.lag;
          if (link.type === 'SF') cand = succ.lf - link.lag + task.duration;
          minLS = Math.min(minLS, cand);
        });
        task.lf = minLS;
      }
      task.ls = task.lf - task.duration;
      task.slack = Math.min(task.ls - task.es, task.lf - task.ef);
    });

    const criticalPath = Array.from(taskMap.values()).filter(t => t.slack <= 0).map(t => t.id);

    // 5. Resource Explosion (AHSP PUPR)
    const { data: assignments } = await supabase
      .from('task_ahsp_assignments')
      .select(`
        volume,
        task_id,
        wbs_tasks (duration),
        ahsp_templates (
          nama_analisa,
          ahsp_details ( koefisien, master_hsd ( item_name, resource_type, base_price ) )
        )
      `)
      .eq('wbs_tasks.project_id', project_id);

    let resourceExplosion: any[] = [];
    let totalRABProject = 0;

    if (assignments) {
      resourceExplosion = assignments.map((a: any) => {
        const volume = Number(a.volume);
        const duration = Number(a.wbs_tasks?.duration) || 1;
        const ahsp = a.ahsp_templates;
        let directCost = 0;
        
        const details = ahsp.ahsp_details.map((d: any) => {
          const totalResource = volume * Number(d.koefisien);
          const cost = totalResource * Number(d.master_hsd.base_price);
          directCost += cost;
          return { 
            item: d.master_hsd.item_name, 
            type: d.master_hsd.resource_type, 
            totalResource, 
            perDay: totalResource / duration,
            cost 
          };
        });
        
        const indirectCost = directCost * 0.10; // Overhead 10% (SE DJBK)
        totalRABProject += (directCost + indirectCost);
        
        return { 
          task_id: a.task_id, 
          nama: ahsp.nama_analisa,
          direct_cost: directCost, 
          indirect_cost: indirectCost, 
          grand_total: directCost + indirectCost, 
          details 
        };
      });
    }

    // 6. EVM Calculation (Project Level)
    let totalPV = 0, totalEV = 0;
    taskMap.forEach(t => {
      const taskRAB = resourceExplosion.find(r => r.task_id === t.id)?.grand_total || 0;
      totalPV += taskRAB; // Asumsi PV = RAB rencana
      totalEV += taskRAB * (Number(t.progress_percent) / 100);
    });

    const { data: costs } = await supabase.from('actual_costs').select('cost_amount').in('task_id', Array.from(taskMap.keys()));
    const totalAC = costs?.reduce((sum, c) => sum + Number(c.cost_amount), 0) || 0;

    const cpi = totalAC > 0 ? totalEV / totalAC : 1;
    const spi = totalPV > 0 ? totalEV / totalPV : 1;

    return NextResponse.json({
      ok: true,
      project_finish: projectFinish,
      tasks: Array.from(taskMap.values()),
      critical_path: criticalPath,
      resource_explosion: resourceExplosion,
      evm: {
        bac: totalRABProject, pv: totalPV, ev: totalEV, ac: totalAC,
        cpi: cpi.toFixed(3), spi: spi.toFixed(3),
        status_cpi: cpi < 1 ? 'CRITICAL' : 'NORMAL',
        status_spi: spi < 1 ? 'CRITICAL' : 'NORMAL'
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}