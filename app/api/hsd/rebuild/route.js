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
    const { project_id } = body;

    if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 });

    const { data: ahspDetails } = await supabase
      .from('ahsp_details')
      .select(`
        koefisien,
        master_hsd (id, resource_type, item_name, unit, base_price)
      `)
      .eq('project_id', project_id); 

    if (!ahspDetails) return NextResponse.json({ ok: true, total: 0 });

    const buckets = {};
    ahspDetails.forEach(detail => {
      const hsd = detail.master_hsd;
      if (!hsd) return;
      const key = `${hsd.resource_type}||${hsd.item_name}||${hsd.unit}`;
      
      if (!buckets[key]) {
        buckets[key] = {
          resource_type: hsd.resource_type,
          item_name: hsd.item_name,
          unit: hsd.unit,
          total_harga: 0,
          count: 0
        };
      }
      buckets[key].total_harga += Number(hsd.base_price) * Number(detail.koefisien);
      buckets[key].count += 1;
    });

    const upserts = Object.values(buckets).map(b => ({
      project_id,
      resource_type: b.resource_type,
      item_name: b.item_name,
      unit: b.unit,
      base_price: b.total_harga / b.count,
      updated_at: new Date().toISOString()
    }));

    if (upserts.length > 0) {
      const { error } = await supabase.from('master_hsd').upsert(upserts, { onConflict: 'project_id,item_name,unit' });
      if (error) throw error;
    }

    return NextResponse.json({ ok: true, total: upserts.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}