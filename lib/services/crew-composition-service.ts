// ================================================================
// Service: Crew Composition CRUD
// ================================================================

// ⚠️ PENYESUAIAN PATH: 
// Karena project Anda menggunakan import '../../lib/supabase' di page.jsx,
// gunakan path relatif atau alias yang sesuai di sini.
// Jika Anda menggunakan alias @ (biasanya mengarah ke root), gunakan '@/lib/supabase'.
// Jika tidak, gunakan path relatif: '../supabase' (karena file ini ada di lib/services/)
import { supabase } from '../supabase'; 

import type { CrewComposition, CrewCompositionInput } from "@/types/resource-plan";

const TABLE = "master_crew_compositions";

export async function listCrewCompositions(projectId?: string): Promise<CrewComposition[]> {
  let query = supabase.from(TABLE).select("*").eq("is_active", true).order("code", { ascending: true });
  if (projectId) query = query.eq("project_id", projectId);
  
  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat komposisi tim: ${error.message}`);
  return (data ?? []) as CrewComposition[];
}

export async function createCrewComposition(input: CrewCompositionInput): Promise<CrewComposition> {
  const { data, error } = await supabase.from(TABLE).insert(input).select().single();
  if (error) throw new Error(`Gagal membuat komposisi tim: ${error.message}`);
  return data as CrewComposition;
}

export async function updateCrewComposition(id: string, input: Partial<CrewCompositionInput>): Promise<CrewComposition> {
  const { data, error } = await supabase.from(TABLE).update(input).eq("id", id).select().single();
  if (error) throw new Error(`Gagal update komposisi tim: ${error.message}`);
  return data as CrewComposition;
}

export async function deactivateCrewComposition(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ is_active: false }).eq("id", id);
  if (error) throw new Error(`Gagal menonaktifkan komposisi tim: ${error.message}`);
}