import { supabase } from '@/lib/supabase';

export interface AuditEventInput {
  projectId?: string | null;
  tableName: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'VOID' | 'MFA_ENROLL' | 'MFA_DISABLE';
  recordId?: string | null;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
}

/**
 * Mencatat aktivitas ke Immutable Audit Log via server API agar IP Address,
 * User-Agent, dan Actor Role terekam otomatis tanpa bisa dimanipulasi dari browser.
 */
export async function recordAuditEvent(event: AuditEventInput): Promise<void> {
  try {
    await fetch('/api/audit-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch (err) {
    console.warn('Gagal mengirim audit event:', err);
  }
}

export async function listAuditLogs(projectId?: string) {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data: logs, error } = await query;
  if (error) throw new Error(error.message);
  if (!logs || logs.length === 0) return [];

  const userIds = [...new Set(logs.map((log) => log.user_id).filter(Boolean))];
  const profilesMap: Record<string, any> = {};

  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    if (!profileError && profiles) {
      profiles.forEach((p) => {
        profilesMap[p.id] = p;
      });
    }
  }

  return logs.map((log) => {
    const profile = profilesMap[log.user_id];
    const displayName =
      profile?.full_name ||
      profile?.email ||
      (log.user_id ? `User (${String(log.user_id).substring(0, 5)})` : 'System');

    const displayRole =
      log.actor_role ||
      profile?.global_role ||
      profile?.role ||
      'User';

    return {
      ...log,
      user_name: displayName,
      user_role: displayRole,
      ip_address: log.ip_address || '-',
      user_agent: log.user_agent || '-',
    };
  });
}
