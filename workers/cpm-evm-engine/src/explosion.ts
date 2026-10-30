import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// Inisialisasi Supabase Client untuk Cloudflare Workers
const getSupabase = (env: Env): SupabaseClient => {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const supabase = getSupabase(env);

    try {
      if (url.pathname === '/explosion' && request.method === 'POST') {
        const body: any = await request.json();
        const result = await executeResourceExplosion(supabase, body.taskId, body.volume);
        return new Response(JSON.stringify({ ok: true, data: result }), { headers: { 'Content-Type': 'application/json' } });
      }

      if (url.pathname === '/evm' && request.method === 'GET') {
        const projectId = url.searchParams.get('projectId');
        if (!projectId) throw new Error("projectId required");
        const result = await calculateEVMMetrics(supabase, projectId);
        return new Response(JSON.stringify({ ok: true, data: result }), { headers: { 'Content-Type': 'application/json' } });
      }

      return new Response("Not Found", { status: 404 });
    } catch (err: any) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// FUNGSI 1: RESOURCE EXPLOSION
// ═══════════════════════════════════════════════════════════════════════════
export async function executeResourceExplosion(supabase: SupabaseClient, taskId: string, volume: number) {
  // 1. Ambil data task dan assignment AHSP
  const { data: task } = await supabase.from('wbs_tasks').select('duration').eq('id', taskId).single();
  const { data: assignment } = await supabase.from('task_ahsp_assignments').select('ahsp_id').eq('task_id', taskId).single();
  
  if (!task || !assignment) throw new Error("Task atau AHSP Assignment tidak ditemukan");

  // 2. Kueri relasional: ambil koefisien dari ahsp_details dan base_price dari master_hsd
  const { data: ahspDetails, error } = await supabase
    .from('ahsp_details')
    .select(`
      koefisien,
      master_hsd (
        resource_type,
        base_price
      )
    `)
    .eq('ahsp_id', assignment.ahsp_id);

  if (error || !ahspDetails) throw new Error(`Gagal mengambil data AHSP: ${error?.message}`);

  // 3. Eksekusi Rumus PMBOK
  let totalDirectCost = 0;
  let totalResourceNeeds = 0;

  const breakdown = ahspDetails.map((detail: any) => {
    const koefisien = Number(detail.koefisien);
    const basePrice = Number(detail.master_hsd.base_price);
    const type = detail.master_hsd.resource_type;

    // Rumus: Kebutuhan Total = Volume x Koefisien
    const totalResource = volume * koefisien;
    // Rumus: Total Biaya = Kebutuhan Total x Harga Satuan
    const totalCost = totalResource * basePrice;

    totalResourceNeeds += totalResource;
    totalDirectCost += totalCost;

    // Alokasi per hari
    const perDay = totalResource / (task.duration || 1);

    return { type, koefisien, basePrice, totalResource, totalCost, perDay };
  });

  // 4. Hitung Grand Total RAB (+10% Overhead)
  const indirectCost = totalDirectCost * 0.10;
  const grandTotalRab = totalDirectCost + indirectCost;

  // 5. Cek Warning terhadap master AHSP asli
  const { data: masterAhsp } = await supabase
    .from('ahsp_templates')
    .select('total_direct_cost')
    .eq('id', assignment.ahsp_id)
    .single();

  const masterCost = masterAhsp ? Number(masterAhsp.total_direct_cost) : 0;
  const warning_status = totalDirectCost > masterCost;

  return {
    task_id: taskId,
    volume,
    duration: task.duration,
    direct_cost: totalDirectCost,
    indirect_cost: indirectCost,
    grand_total_rab: grandTotalRab,
    warning_status,
    breakdown
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FUNGSI 2: EVM METRICS & S-CURVE
// ═══════════════════════════════════════════════════════════════════════════
export async function calculateEVMMetrics(supabase: SupabaseClient, projectId: string) {
  // Asumsi: Anggaran Target Pagu RAB = Total Direct Cost dari Task-AHSP yang ter-assign
  const { data: tasks } = await supabase.from('wbs_tasks').select('id, start_date, end_date, progress_percent').eq('project_id', projectId);
  const { data: costs } = await supabase.from('actual_costs').select('cost_amount, recorded_at').in('task_id', tasks?.map(t => t.id) || []);

  if (!tasks) return { summary: {}, timeseries: [] };

  // 1. Kalkulasi Anggaran Proyek (Proxy dari nilai cost saat ini)
  // Dalam sistem riil, ini akan di-join dengan hasil executeResourceExplosion
  const totalBudget = 100_000_000_000; // Placeholder untuk total RAB proyek jika tidak join langsung

  let totalPV = 0;
  let totalEV = 0;
  let totalAC = costs?.reduce((sum, c) => sum + Number(c.cost_amount), 0) || 0;

  // 2. Kalkulasi PV & EV Agregat
  tasks.forEach(t => {
    const progress = Number(t.progress_percent) / 100;
    // Sederhananya: PV = (progress rencana) * budget, EV = (progress aktual) * budget
    // Di sistem riil, PV dihitung berdasarkan timeline, kita asumsikan progress = rencana untuk contoh ini.
    totalPV += (progress * totalBudget) / tasks.length;
    totalEV += (progress * totalBudget) / tasks.length;
  });

  const cpi = totalAC > 0 ? totalEV / totalAC : 1;
  const spi = totalPV > 0 ? totalEV / totalPV : 1;

  // 3. Generate Time-Series Data (Kurva-S)
  // Mengelompokkan pengeluaran aktual berdasarkan tanggal
  const groupedCosts = (costs || []).reduce((acc: any, curr) => {
    const date = new Date(curr.recorded_at).toISOString().split('T')[0];
    if (!acc[date]) acc[date] = 0;
    acc[date] += Number(curr.cost_amount);
    return acc;
  }, {});

  const timeseries = Object.keys(groupedCosts).sort().map(date => ({
    date,
    PV: totalPV, // Nilai konstan untuk simplifikasi; riil-nya berjalan sesuai kurva S
    EV: totalEV,
    AC: groupedCosts[date]
  }));

  return {
    summary: {
      BAC: totalBudget,
      PV: totalPV,
      EV: totalEV,
      AC: totalAC,
      CPI: cpi.toFixed(3),
      SPI: spi.toFixed(3),
      status_cpi: cpi < 1.0 ? 'CRITICAL' : 'NORMAL',
      status_spi: spi < 1.0 ? 'CRITICAL' : 'NORMAL'
    },
    timeseries
  };
}