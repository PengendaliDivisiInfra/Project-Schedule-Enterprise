import { supabase } from '@/lib/supabase';
import { 
  Subcontractor, SubcontractorContract, SubcontractorPayment, 
  SubcontractorAddendum, AddendumItemChange 
} from '@/lib/types/subcon';

export async function listSubcontractors(projectId: string) {
  const { data, error } = await supabase.from('subcontractors').select('*').eq('project_id', projectId).eq('is_active', true).order('company_name');
  if (error) throw new Error(error.message);
  return data as Subcontractor[];
}

export async function createSubcontractor(payload: Partial<Subcontractor>) {
  const { data, error } = await supabase.from('subcontractors').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function softDeleteSubcontractor(id: string) {
  const { error } = await supabase.from('subcontractors').update({ is_active: false }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listSPK(projectId: string) {
  const { data, error } = await supabase
    .from('subcontractor_contracts')
    .select(`
      *,
      subcontractors ( company_name ),
      subcontractor_payments ( amount, payment_type ),
      subcontractor_addendums ( amount )
    `)
    .eq('project_id', projectId)
    .neq('status', 'Void')
    .order('created_at', { ascending: false });
  
  if (error) throw new Error(error.message);
  
  return data.map((d: any) => {
    const total_paid = d.subcontractor_payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
    const total_kasbon = d.subcontractor_payments?.filter((p: any) => p.payment_type === 'Kasbon')
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
    const total_addendum = d.subcontractor_addendums?.reduce((sum: number, a: any) => sum + Number(a.amount), 0) || 0;
    
    return {
      ...d,
      subcontractor_name: d.subcontractors?.company_name,
      total_paid,
      total_kasbon,
      total_addendum,
      final_contract_value: d.contract_value
    };
  }) as (SubcontractorContract & { 
    total_paid: number; 
    total_kasbon: number;
    total_addendum: number; 
    final_contract_value: number; 
  })[];
}

export async function createSPK(payload: Partial<SubcontractorContract>) {
  const { data, error } = await supabase.from('subcontractor_contracts').insert([payload]).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSPK(id: string, payload: Partial<SubcontractorContract>) {
  const { data, error } = await supabase.from('subcontractor_contracts').update(payload).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function softDeleteSPK(id: string) {
  const { error } = await supabase.from('subcontractor_contracts').update({ status: 'Void' }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getSPKItems(contractId: string) {
  const { data, error } = await supabase
    .from('subcontractor_spk_items')
    .select('*')
    .eq('contract_id', contractId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
}

export async function createAddendum(payload: {
  contract_id: string;
  addendum_no: number;
  title: string;
  description: string;
  amount: number;
  new_contract_value: number;
  items: AddendumItemChange[];
}) {
  const { data, error } = await supabase.rpc('rpc_create_addendum', {
    p_contract_id: payload.contract_id,
    p_addendum_no: payload.addendum_no,
    p_title: payload.title,
    p_description: payload.description,
    p_amount_diff: payload.amount,
    p_new_contract_value: payload.new_contract_value,
    p_items: payload.items
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getSPKHistory(contractId: string) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('table_name', 'subcontractor_contracts')
    .eq('record_id', contractId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function paySubcontractor(contractId: string, payload: { 
  payment_number: string; 
  payment_date: string; 
  amount: number; 
  description?: string;
  payment_type: 'Kasbon' | 'Opname';
  progress_pct: number;
  ppn_amount: number;
  pph_amount: number;
}) {
  const { data, error } = await supabase.rpc('rpc_pay_subcontractor', {
    p_contract_id: contractId,
    p_payment_number: payload.payment_number,
    p_payment_date: payload.payment_date,
    p_amount: payload.amount,
    p_description: payload.description,
    p_payment_type: payload.payment_type,
    p_progress_pct: payload.progress_pct,
    p_ppn_amount: payload.ppn_amount,
    p_pph_amount: payload.pph_amount
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function getBAOPData(contractId: string, startDate: string, endDate: string) {
  const { data: contract, error: cError } = await supabase
    .from('subcontractor_contracts')
    .select(`
      id, spk_number, work_description, contract_value,
      subcontractors ( company_name, address, contact_person ),
      projects ( name, location, contractor_name, owner_name, contract_number )
    `)
    .eq('id', contractId)
    .single();
    
  if (cError) throw new Error(cError.message);

  const { data: opnames, error: oError } = await supabase
    .from('subcon_opnames')
    .select(`
      id, opname_date, volume, price, total,
      subcontractor_spk_items ( description, unit )
    `)
    .eq('contract_id', contractId)
    .gte('opname_date', startDate)
    .lte('opname_date', endDate)
    .order('opname_date', { ascending: true });

  if (oError) throw new Error(oError.message);

  return { contract, opnames: opnames || [] };
}