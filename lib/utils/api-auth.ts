import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isApproverRole, normalizeRoleName } from '@/lib/config/permissions';

export interface RequestAuditMeta {
  ipAddress: string;
  userAgent: string;
}

export interface ProjectAuthSuccess {
  ok: true;
  user: User;
  role: string;
  globalRole: string | null;
  projectRole: string | null;
  isApprover: boolean;
  aal: string | null;
  supabase: SupabaseClient;
  auditMeta: RequestAuditMeta;
}

export interface ProjectAuthFailure {
  ok: false;
  response: NextResponse;
}

export type ProjectAuthResult = ProjectAuthSuccess | ProjectAuthFailure;

export interface RequireProjectAccessOptions {
  /** Daftar peran yang diizinkan (case-insensitive). Owner & Super Admin selalu diizinkan. */
  allowedRoles?: string[];
  /** Jika true, menolak peran read-only seperti Auditor & Viewer. */
  requireWrite?: boolean;
  /** Jika true, mewajibkan sesi AAL2 bila approver sudah mengaktifkan 2FA TOTP. */
  requireMfaForApprover?: boolean;
}

export function extractRequestAuditMeta(request: Request): RequestAuditMeta {
  const forwarded = request.headers.get('x-forwarded-for') || '';
  const firstIp = forwarded.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  const cfIp = request.headers.get('cf-connecting-ip')?.trim();
  return {
    ipAddress: firstIp || realIp || cfIp || 'unknown',
    userAgent: (request.headers.get('user-agent') || 'unknown').slice(0, 300),
  };
}

/**
 * Memverifikasi sesi pengguna (Cookie SSR atau Header Authorization Bearer),
 * memvalidasi Hybrid RBAC (Global Role + Project Role), serta (opsional) status 2FA AAL2.
 */
export async function requireProjectAccess(
  request: Request,
  projectId: string | null | undefined,
  options?: RequireProjectAccessOptions
): Promise<ProjectAuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Konfigurasi kredensial Supabase server belum lengkap.' },
        { status: 500 }
      ),
    };
  }

  if (!projectId || !String(projectId).trim()) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Parameter project_id wajib diisi.' },
        { status: 400 }
      ),
    };
  }

  const safeProjectId = String(projectId).trim();
  const auditMeta = extractRequestAuditMeta(request);

  // 1. Autentikasi pengguna via Bearer token atau Cookie sesi SSR
  let user: User | null = null;
  let aal: string | null = null;
  let needsMfaUpgrade = false;
  const authHeader = request.headers.get('authorization') || '';

  const authClient = authHeader.startsWith('Bearer ')
    ? createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : (() => {
        const cookieStore = cookies();
        return createServerClient(supabaseUrl, supabaseAnonKey, {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options: cookieOpts }) =>
                  cookieStore.set(name, value, cookieOpts)
                );
              } catch {
                // Abaikan jika dipanggil pada konteks read-only
              }
            },
          },
        });
      })();

  const { data: userData, error: userErr } = await authClient.auth.getUser();
  if (!userErr && userData?.user) {
    user = userData.user;
    try {
      const { data: aalData } = await authClient.auth.mfa.getAuthenticatorAssuranceLevel();
      aal = aalData?.currentLevel || 'aal1';
      needsMfaUpgrade = aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== 'aal2';
    } catch {
      aal = 'aal1';
    }
  }

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Unauthorized: Sesi login tidak valid atau telah berakhir.' },
        { status: 401 }
      ),
    };
  }

  // 2. Verifikasi Hybrid RBAC (Global Role + Project Role)
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let profileRes = await serviceClient
    .from('profiles')
    .select('role, global_role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileRes.error && String(profileRes.error.message || '').includes('global_role')) {
    profileRes = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
  }

  const [projectRes, memberRes] = await Promise.all([
    serviceClient.from('projects').select('id, owner_id').eq('id', safeProjectId).maybeSingle(),
    serviceClient
      .from('project_members')
      .select('role')
      .eq('project_id', safeProjectId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (projectRes.error || !projectRes.data) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Proyek tidak ditemukan.' },
        { status: 404 }
      ),
    };
  }

  const rawGlobal = (profileRes.data as any)?.global_role || (profileRes.data as any)?.role || null;
  const globalRole = rawGlobal && normalizeRoleName(rawGlobal) !== 'user' ? normalizeRoleName(rawGlobal) : null;
  const projectRole = memberRes.data?.role ? normalizeRoleName(memberRes.data.role) : null;

  const isCorporateAdmin =
    globalRole === 'owner' || globalRole === 'super admin' || projectRes.data.owner_id === user.id;
  const isGlobalReader =
    isCorporateAdmin ||
    globalRole === 'finance manager' ||
    globalRole === 'central procurement' ||
    globalRole === 'auditor';

  const effectiveRole = isCorporateAdmin
    ? globalRole || 'owner'
    : globalRole || projectRole || '';

  if (!effectiveRole || (!isGlobalReader && effectiveRole === 'guest')) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Forbidden: Anda tidak memiliki akses ke proyek ini.' },
        { status: 403 }
      ),
    };
  }

  // Tolak operasi tulis bagi Auditor atau Viewer
  if (options?.requireWrite && (globalRole === 'auditor' || projectRole === 'viewer')) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Forbidden: Akun Auditor/Viewer hanya memiliki akses baca (read-only).' },
        { status: 403 }
      ),
    };
  }

  if (options?.allowedRoles && options.allowedRoles.length > 0 && !isCorporateAdmin) {
    const allowedNormalized = options.allowedRoles.map((r) => normalizeRoleName(r));
    const matchesAllowed =
      (globalRole && allowedNormalized.includes(globalRole)) ||
      (projectRole && allowedNormalized.includes(projectRole));

    if (!matchesAllowed) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: 'Forbidden: Peran Anda tidak diizinkan menjalankan aksi ini.' },
          { status: 403 }
        ),
      };
    }
  }

  const approverFlag = isApproverRole(globalRole, projectRole);
  if (options?.requireMfaForApprover && approverFlag && needsMfaUpgrade) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'MFA Required: Verifikasi kode 2FA TOTP diperlukan sebelum menjalankan aksi ini.' },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    user,
    role: effectiveRole,
    globalRole,
    projectRole,
    isApprover: approverFlag,
    aal,
    supabase: serviceClient,
    auditMeta,
  };
}
