import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Helper untuk mengubah string format Rupiah (misal: "32.175.000") menjadi Number murni
const parseCost = (val) => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // Hapus titik (ribuan), ganti koma (desimal) jadi titik
    const cleanStr = val.replace(/\./g, '').replace(/,/g, '.');
    return Number(cleanStr) || 0;
  }
  return 0;
};

export async function GET(request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const wbsFilter = searchParams.get('wbs');

    if (!projectId) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    const { data: tasks, error } = await supabase.from('wbs_tasks').select('*').eq('project_id', projectId);
    if (error) throw error;

    let filteredTasks = tasks;
    if (wbsFilter) {
      filteredTasks = tasks.filter(t => String(t.wbs || '').startsWith(wbsFilter));
    }

    const leafTasks = filteredTasks.filter(t => t.summary !== 'Yes');
    if (!leafTasks.length) return NextResponse.json({ ok: true, labels: [], planned: [], earned: [], actual: [] });

    // 1. PERBAIKAN: Cari tanggal start & finish paling ekstrem dari tasks
    let pStart = null;
    let pFinish = null;
    
    leafTasks.forEach(t => {
      if (t.start_date) {
        const d = new Date(t.start_date);
        if (!isNaN(d) && (!pStart || d < pStart)) pStart = d;
      }
      if (t.finish_date) {
        const d = new Date(t.finish_date);
        if (!isNaN(d) && (!pFinish || d > pFinish)) pFinish = d;
      }
    });

    // Fallback jika tanggal tidak ditemukan
    if (!pStart) pStart = new Date();
    if (!pFinish) pFinish = new Date();

    const labels = [];
    const planned = [];
    const earned = [];
    const actual = [];
    
    let cur = new Date(pStart);
    pFinish.setDate(pFinish.getDate() + 7); // Tambah 7 hari agar grafik mencapai 100% di akhir

    while (cur <= pFinish) {
      labels.push(cur.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }));
      
      let pv = 0; let ev = 0; let ac = 0;
      leafTasks.forEach(t => {
        // 2. PERBAIKAN: Gunakan parseCost agar aman dari format "32.175.000"
        const bac = parseCost(t.cost);
        const actCost = parseCost(t.actual_cost);
        const progress = Number(t.progress_percent) || 0;
        const tStart = new Date(t.start_date);
        const tFinish = new Date(t.finish_date);
        
        // Hitung Planned Value (PV)
        if (cur >= tFinish) {
          pv += bac;
        } else if (cur >= tStart) {
          const dur = Math.max(1, Number(t.duration));
          const elapsed = Math.ceil((cur - tStart) / (1000 * 3600 * 24));
          pv += bac * Math.min(1, elapsed / dur);
        }

        // Hitung Earned Value (EV) & Actual Cost (AC)
        // Hanya dihitung jika task sudah dimulai
        if (cur >= tStart) {
           ev += bac * (progress / 100);
           ac += actCost;
        }
      });

      planned.push(Math.round(pv));
      earned.push(Math.round(ev));
      actual.push(Math.round(ac));
      cur.setDate(cur.getDate() + 7); 
    }

    return NextResponse.json({
      ok: true,
      labels,
      planned,
      earned,
      actual,
      summary: {
        bac: leafTasks.reduce((s, t) => s + parseCost(t.cost), 0),
        pv: planned[planned.length - 1],
        ev: earned[earned.length - 1],
        ac: actual[actual.length - 1]
      }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}