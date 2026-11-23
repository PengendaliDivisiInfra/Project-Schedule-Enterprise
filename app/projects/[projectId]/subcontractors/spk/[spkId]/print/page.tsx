// app/projects/[projectId]/subcontractors/spk/[spkId]/print/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import PrintClientWrapper from './PrintClientWrapper';

export default async function SPKPrintPage({
  params,
}: {
  params: { projectId: string; spkId: string };
}) {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  const { data: spk } = await supabase
    .from('subcontractor_contracts')
    .select('*')
    .eq('id', params.spkId)
    .single();

  if (!spk) {
    return (
      <div className="p-8 text-center text-red-500 font-bold">
        Data SPK tidak ditemukan.
      </div>
    );
  }

  const [{ data: templates }, { data: project }, { data: subcontractor }, { data: activeItems }] =
    await Promise.all([
      supabase.from('spk_templates').select('*').order('order_index'),
      supabase.from('projects').select('*').eq('id', params.projectId).single(),
      supabase.from('subcontractors').select('*').eq('id', spk.subcontractor_id).single(),
      supabase
        .from('subcontractor_spk_items')
        .select('*')
        .eq('contract_id', params.spkId)
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
    ]);

  // Prioritaskan item RAB aktif terbaru (termasuk hasil Addendum), fallback ke bq_items awal
  const bqItems =
    activeItems && activeItems.length > 0
      ? activeItems
      : Array.isArray(spk.bq_items)
      ? spk.bq_items
      : [];

  if (!project || !subcontractor) {
    return (
      <div className="p-8 text-center text-red-500 font-bold">
        Data Proyek atau Vendor Subkon belum lengkap.
      </div>
    );
  }

  const enrichedSpk = { ...spk, bq_items: bqItems };

  return (
    <PrintClientWrapper
      spk={enrichedSpk}
      templates={templates || []}
      project={project}
      subcontractor={subcontractor}
      filename={`SPK_${(spk.spk_number || 'DOKUMEN').replace(/\//g, '_')}.pdf`}
    />
  );
}