// app/projects/[projectId]/subcontractors/spk/[spkId]/print/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import PrintClientWrapper from './PrintClientWrapper';

export default async function SPKPrintPage({ params }: { params: { projectId: string, spkId: string } }) {
  const cookieStore = cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  const { data: spk } = await supabase.from('subcontractor_contracts').select('*').eq('id', params.spkId).single();
  const { data: templates } = await supabase.from('spk_templates').select('*').order('order_index');
  const { data: project } = await supabase.from('projects').select('*').eq('id', params.projectId).single();
  const { data: subcontractor } = await supabase.from('subcontractors').select('*').eq('id', spk?.subcontractor_id).single();
  
  // Fallback: Ambil item RAB dari tabel relasi jika bq_items kosong
  let bqItems = spk?.bq_items;
  if (!bqItems || bqItems.length === 0) {
    const { data: itemsData } = await supabase.from('subcontractor_spk_items').select('*').eq('contract_id', params.spkId);
    bqItems = itemsData || [];
  }

  if (!spk || !templates || !project || !subcontractor) {
    return <div className="p-8 text-center text-red-500">Data tidak ditemukan atau belum lengkap.</div>;
  }

  // Sisipkan bqItems yang sudah dipastikan terisi ke dalam objek spk
  const enrichedSpk = { ...spk, bq_items: bqItems };

  return (
    <PrintClientWrapper 
      spk={enrichedSpk} 
      templates={templates} 
      project={project} 
      subcontractor={subcontractor} 
      filename={`SPK_${spk.spk_number.replace(/\//g, '_')}.pdf`} 
    />
  );
}