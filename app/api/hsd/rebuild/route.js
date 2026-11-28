import { NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/utils/api-auth';

export const dynamic = 'force-dynamic';

/**
 * Menghitung ulang total biaya langsung (total_direct_cost) dan harga satuan
 * AHSP (total_harga_ahsp = direct * (1 + overhead/100)) pada tabel ahsp_templates
 * berdasarkan koefisien di ahsp_details x harga_dasar aktual di master_hsd.
 *
 * CATATAN KEAMANAN RUMUS:
 * Endpoint ini TIDAK lagi menimpa master_hsd.harga_dasar / base_price dengan
 * hasil perkalian koefisien (yang sebelumnya merusak harga satuan dasar material/upah).
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { project_id, overhead_pct } = body || {};

    const auth = await requireProjectAccess(request, project_id, {
      allowedRoles: ['Owner', 'Project Manager', 'Site Admin', 'DCC/Logistic'],
    });
    if (!auth.ok) return auth.response;

    const { supabase } = auth;
    const defaultOverheadPct =
      typeof overhead_pct === 'number' && overhead_pct >= 0 ? overhead_pct : 15;

    // 1. Ambil seluruh template AHSP, detail koefisien, dan master HSD aktual
    const [templatesRes, detailsRes, hsdRes] = await Promise.all([
      supabase.from('ahsp_templates').select('id, overhead_pct'),
      supabase.from('ahsp_details').select('id, ahsp_template_id, hsd_id, koefisien'),
      supabase.from('master_hsd').select('id, harga_dasar'),
    ]);

    if (templatesRes.error) throw templatesRes.error;
    if (detailsRes.error) throw detailsRes.error;
    if (hsdRes.error) throw hsdRes.error;

    const hsdPriceMap = new Map(
      (hsdRes.data || []).map((h) => [h.id, Number(h.harga_dasar) || 0])
    );

    const directCostByTemplate = new Map();
    (detailsRes.data || []).forEach((d) => {
      if (!d.ahsp_template_id || !d.hsd_id) return;
      const unitPrice = hsdPriceMap.get(d.hsd_id) || 0;
      const coef = Number(d.koefisien) || 0;
      const prev = directCostByTemplate.get(d.ahsp_template_id) || 0;
      directCostByTemplate.set(d.ahsp_template_id, prev + unitPrice * coef);
    });

    const templates = templatesRes.data || [];
    let updatedCount = 0;

    for (const tpl of templates) {
      const directCost = Number((directCostByTemplate.get(tpl.id) || 0).toFixed(2));
      const ovPct =
        tpl.overhead_pct !== null && tpl.overhead_pct !== undefined
          ? Number(tpl.overhead_pct)
          : defaultOverheadPct;
      const grandTotal = Number((directCost * (1 + ovPct / 100)).toFixed(2));

      const { error: updErr } = await supabase
        .from('ahsp_templates')
        .update({
          total_direct_cost: directCost,
          total_harga_ahsp: grandTotal,
        })
        .eq('id', tpl.id);

      if (updErr) throw updErr;
      updatedCount++;
    }

    return NextResponse.json({
      ok: true,
      recalculated_templates: updatedCount,
      total: updatedCount,
    });
  } catch (err) {
    console.error('HSD/AHSP Rebuild API Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}