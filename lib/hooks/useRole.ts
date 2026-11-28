import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import {
  checkPermission,
  isApproverRole,
  normalizeRoleName,
  type PermissionKey,
} from '../config/permissions';
import { getFromCache, saveToCache } from '../utils/cache';
import { useProject } from '@/context/ProjectContext';

interface CachedRoleState {
  role: string;
  globalRole: string | null;
  projectRole: string | null;
}

export function useRole(projectId?: string) {
  const { activeProjectId } = useProject();
  const effectiveProjectId = projectId || activeProjectId || undefined;

  const [role, setRole] = useState<string | null>(null);
  const [globalRole, setGlobalRole] = useState<string | null>(null);
  const [projectRole, setProjectRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async (userId: string) => {
      const cacheKey = `user_hybrid_role_${userId}_${effectiveProjectId || 'global'}`;

      try {
        if (typeof window !== 'undefined' && !navigator.onLine) {
          const cached = getFromCache(cacheKey) as CachedRoleState | null;
          if (cached?.role) {
            setRole(cached.role);
            setGlobalRole(cached.globalRole);
            setProjectRole(cached.projectRole);
            setLoading(false);
            return;
          }
        }

        // 1. Ambil Global Role dari profiles (mendukung kolom global_role baru & fallback kolom role lama)
        let resolvedGlobal: string | null = null;
        let profileRes = await supabase
          .from('profiles')
          .select('role, global_role')
          .eq('id', userId)
          .maybeSingle();

        if (profileRes.error && String(profileRes.error.message || '').includes('global_role')) {
          profileRes = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle();
        }

        const rawGlobal = (profileRes.data as any)?.global_role || (profileRes.data as any)?.role || null;
        if (rawGlobal && normalizeRoleName(rawGlobal) !== 'user') {
          resolvedGlobal = rawGlobal;
        }

        // 2. Ambil Project Role dari project_members
        let resolvedProject: string | null = null;
        if (effectiveProjectId) {
          const { data: member } = await supabase
            .from('project_members')
            .select('role')
            .eq('project_id', effectiveProjectId)
            .eq('user_id', userId)
            .maybeSingle();

          if (member?.role) {
            resolvedProject = member.role;
          }
        }

        const effectiveRole = resolvedGlobal || resolvedProject || 'Guest';

        setRole(effectiveRole);
        setGlobalRole(resolvedGlobal);
        setProjectRole(resolvedProject);
        saveToCache(cacheKey, {
          role: effectiveRole,
          globalRole: resolvedGlobal,
          projectRole: resolvedProject,
        });
      } catch (err) {
        console.error('Error mengambil Hybrid RBAC role:', err);
        const cached = getFromCache(cacheKey) as CachedRoleState | null;
        setRole(cached?.role || 'Guest');
        setGlobalRole(cached?.globalRole || null);
        setProjectRole(cached?.projectRole || null);
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
      else {
        setRole(null);
        setGlobalRole(null);
        setProjectRole(null);
        setLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [effectiveProjectId]);

  const can = (permissionKey: PermissionKey) => {
    if (role === 'Guest' && !globalRole) return false;
    return checkPermission(projectRole || role, permissionKey, globalRole);
  };

  const isApprover = isApproverRole(globalRole, projectRole || role);
  const isAuditor = normalizeRoleName(globalRole) === 'auditor';

  return { role, globalRole, projectRole, loading, can, isApprover, isAuditor };
}
