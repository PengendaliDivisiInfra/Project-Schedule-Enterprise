import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export interface ProjectAuthSuccess {
  ok: true;
  user: User;
  role: string;
  supabase: SupabaseClient;
}

export interface ProjectAuthFailure {
  ok: false;
  response: NextResponse;
}

export type ProjectAuthResult = ProjectAuthSuccess | ProjectAuthFailure;

export interface RequireProjectAccessOptions {
  /** Daftar peran yang diizinkan (case-insensitive). Owner & project owner selalu diizinkan. */
  allowedRoles?: string[];
}

function normalizeRole(role?: string | null): string {
  const r = (role || '').toLowerCase().trim();
  if (r === 'pm') return 'project manager';
  if (r === 'dcc' || r === 'logistic') return 'dcc/logistic';
  return r;
}

/**
 * Memverifikasi sesi pengguna (Cookie SSR atau Header Authorization Bearer)
 * serta memvalidasi kepemilikan/keanggotaan proyek sebelum memberikan akses
 * ke klien Supabase server-side.
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

  // 1. Autentikasi pengguna via Bearer token atau Cookie sesi SSR
  let user: User | null = null;
  const authHeader = request.headers.get('authorization') || '';

  if (authHeader.startsWith('Bearer ')) {
    const tokenClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await tokenClient.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
    }
  } else {
    const cookieStore = cookies();
    const ssrClient = createServerClient(supabaseUrl, supabaseAnonKey, {
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
    const { data, error } = await ssrClient.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
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

  // 2. Gunakan service-role client setelah user terautentikasi untuk memverifikasi keanggotaan proyek
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [profileRes, projectRes, memberRes] = await Promise.all([
    serviceClient.from('profiles').select('role').eq('id', user.id).maybeSingle(),
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

  const globalRole = normalizeRole(profileRes.data?.role);
  const memberRole = normalizeRole(memberRes.data?.role);
  const isOwner = globalRole === 'owner' || projectRes.data.owner_id === user.id;

  const effectiveRole = isOwner ? 'owner' : memberRole;

  if (!effectiveRole || effectiveRole === 'guest') {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Forbidden: Anda tidak memiliki akses ke proyek ini.' },
        { status: 403 }
      ),
    };
  }

  if (options?.allowedRoles && options.allowedRoles.length > 0 && !isOwner) {
    const allowedNormalized = options.allowedRoles.map((r) => normalizeRole(r));
    if (!allowedNormalized.includes(effectiveRole)) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: 'Forbidden: Peran Anda tidak diizinkan menjalankan aksi ini.' },
          { status: 403 }
        ),
      };
    }
  }

  return {
    ok: true,
    user,
    role: effectiveRole,
    supabase: serviceClient,
  };
}