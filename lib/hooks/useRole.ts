import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { checkPermission, PERMISSIONS } from '../config/permissions';
import { getFromCache, saveToCache } from '../utils/cache'; // IMPORT CACHE

export function useRole(projectId?: string) {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async (userId: string) => {
      const cacheKey = `user_role_${userId}_${projectId || 'global'}`;

      try {
        let finalRole: string | null = null;

        // 🟢 1. Cek Mode Offline Terlebih Dahulu
        if (typeof window !== 'undefined' && !navigator.onLine) {
          const cachedRole = getFromCache(cacheKey);
          if (cachedRole) {
            setRole(cachedRole);
            setLoading(false);
            return;
          }
        }

        // 2. Cek Owner Global (Profile)
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();
          
        if (profile?.role && profile.role.toLowerCase() === 'owner') {
          finalRole = 'Owner';
        } 
        
        // 3. Cek Role Proyek (Project Members)
        if (!finalRole && projectId) {
          const { data: member } = await supabase
            .from('project_members')
            .select('role')
            .eq('project_id', projectId)
            .eq('user_id', userId)
            .maybeSingle();
          
          if (member?.role) {
            finalRole = member.role;
          }
        }

        // 4. JIKA TIDAK PUNYA AKSES, JADIKAN 'Guest'
        if (!finalRole) {
          finalRole = 'Guest'; 
        }
        
        setRole(finalRole);
        saveToCache(cacheKey, finalRole); // Simpan Role ke Cache
        
      } catch (err) {
        console.error("Error mengambil role:", err);
        // 🟢 Fallback ke Cache jika Fetch Gagal
        const cachedRole = getFromCache(cacheKey);
        setRole(cachedRole || 'Guest');
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

  const can = (permissionKey: keyof typeof PERMISSIONS) => {
    if (role === 'Guest') return false;
    return checkPermission(role, permissionKey);
  };

  return { role, loading, can };
}