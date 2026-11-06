import { supabase } from '@/lib/supabase';

export async function listAuditLogs(projectId?: string) {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(150);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data: logs, error } = await query;
  if (error) throw new Error(error.message);
  if (!logs || logs.length === 0) return [];

  // 1. Kumpulkan user_id yang unik
  const userIds = [...new Set(logs.map(log => log.user_id).filter(Boolean))];
  
  let profilesMap: Record<string, any> = {};
  
  // 2. Ambil profil user
  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*') // Ambil semua kolom agar aman
      .in('id', userIds);
      
    if (!profileError && profiles) {
      profiles.forEach(p => {
        profilesMap[p.id] = p;
      });
    }
  }

  // 3. Gabungkan data log dengan profil
  return logs.map(log => {
    const profile = profilesMap[log.user_id];
    
    // Ambil name, jika kosong ambil email, jika kosong tampilkan ID
    const displayName = profile?.name || profile?.email || (log.user_id ? `User (${log.user_id.substring(0, 5)})` : 'System');
    
    // Ambil role dari profil, jika kosong tampilkan 'Unknown'
    const displayRole = profile?.role || 'User';

    return {
      ...log,
      user_name: displayName,
      user_role: displayRole
    };
  });
}