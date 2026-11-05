import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { checkPermission, PERMISSIONS } from '../config/permissions';

export function useRole(projectId?: string) {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async (userId: string) => {
      try {
        let finalRole = null;

        // 1. Cek Owner Global
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
        if (profile?.role && profile.role.toLowerCase() === 'owner') {
          finalRole = 'Owner';
        } 
        
        // 2. Cek Role Proyek
        if (!finalRole && projectId) {
          const { data: member } = await supabase
            .from('project_members')
            .select('role')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .single();
          
          if (member?.role) finalRole = member.role;
        }

        if (!finalRole) finalRole = 'Site Admin';
        setRole(finalRole);
      } catch (err) {
        setRole('Site Admin');
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
    return checkPermission(role, permissionKey);
  };

  return { role, loading, can };
}