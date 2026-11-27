import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { extractRequestAuditMeta } from '@/lib/utils/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return NextResponse.json({ ok: false, error: 'Server config incomplete' }, { status: 500 });
    }

    const cookieStore = cookies();
    const ssrClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Read-only context
          }
        },
      },
    });

    const { data: userData, error: userErr } = await ssrClient.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, tableName, action, recordId, oldData, newData } = body || {};

    if (!tableName || !action) {
      return NextResponse.json(
        { ok: false, error: 'tableName dan action wajib diisi.' },
        { status: 400 }
      );
    }

    const { ipAddress, userAgent } = extractRequestAuditMeta(req);
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Tentukan snapshot actor_role saat aksi dilakukan
    let actorRole = 'User';
    const [profRes, memRes] = await Promise.all([
      serviceClient.from('profiles').select('role, global_role').eq('id', userData.user.id).maybeSingle(),
      projectId
        ? serviceClient
            .from('project_members')
            .select('role')
            .eq('project_id', projectId)
            .eq('user_id', userData.user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const gRole = (profRes.data as any)?.global_role || (profRes.data as any)?.role;
    const pRole = (memRes.data as any)?.role;
    if (gRole && gRole.toLowerCase() !== 'user') {
      actorRole = gRole;
    } else if (pRole) {
      actorRole = pRole;
    }

    const insertPayload: Record<string, any> = {
      project_id: projectId || null,
      user_id: userData.user.id,
      actor_role: actorRole,
      table_name: String(tableName),
      action: String(action).toUpperCase(),
      record_id: recordId ? String(recordId) : null,
      old_data: oldData ?? null,
      new_data: newData ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
    };

    const { error: insertErr } = await serviceClient.from('audit_logs').insert(insertPayload);
    if (insertErr) {
      // Fallback aman bila kolom baru (actor_role/ip_address/user_agent) belum dimigrasi
      if (insertErr.code === '42703') {
        const { error: fallbackErr } = await serviceClient.from('audit_logs').insert({
          project_id: projectId || null,
          user_id: userData.user.id,
          table_name: String(tableName),
          action: String(action).toUpperCase(),
          old_data: oldData ?? null,
          new_data: newData ?? null,
        });
        if (fallbackErr) {
          return NextResponse.json({ ok: false, error: fallbackErr.message }, { status: 500 });
        }
      } else {
        return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Gagal mencatat audit log' },
      { status: 500 }
    );
  }
}
