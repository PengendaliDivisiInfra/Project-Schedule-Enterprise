import { useEffect, useState } from 'react';
import { supabase } from '../supabase'; // Sesuaikan path jika berbeda
import { checkPermission, PERMISSIONS } from '../config/permissions'; // Sesuaikan path

export function useRole(projectId?: string) {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async (userId: string) => {
      try {
        let finalRole: string | null = null;

        // 1. Cek Owner Global (Profile)
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();
          
        if (profile?.role && profile.role.toLowerCase() === 'owner') {
          finalRole = 'Owner';
        } 
        
        // 2. Cek Role Proyek (Project Members)
        if (!finalRole && projectId) {
          const { data: member } = await supabase
            .from('project_members')
            .select('role')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .maybeSingle(); // Gunakan maybeSingle agar tidak error jika bukan member
          
          if (member?.role) {
            finalRole = member.role;
          }
        }

        // 3. JIKA TIDAK PUNYA AKSES, JADIKAN 'Guest' (BUKAN SITE ADMIN)
        if (!finalRole) {
          finalRole = 'Guest'; 
        }
        
        setRole(finalRole);
      } catch (err) {
        console.error("Error mengambil role:", err);
        setRole('Guest');
      } finally {
        setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchRole(session.user.id);
      else setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) fetchRole(session.user.id);
      else { setRole(null); setLoading(false); }
    });

    return () => { authListener.subscription.unsubscribe(); };
  }, [projectId]);

  // Fungsi pemanggil permission
  const can = (permissionKey: keyof typeof PERMISSIONS) => {
    if (role === 'Guest') return false; // Blokir akses total jika Guest
    return checkPermission(role, permissionKey);
  };

  return { role, loading, can };
}