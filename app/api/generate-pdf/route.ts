import { createServerClient } from '@supabase/ssr';
import { createClient, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MAX_HTML_BYTES = 15 * 1024 * 1024; // 15 MB safety ceiling

async function verifyAuthenticatedUser(req: Request): Promise<User | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const tokenClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await tokenClient.auth.getUser();
    return !error && data?.user ? data.user : null;
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
          // Abaikan jika dipanggil pada konteks read-only
        }
      },
    },
  });

  const { data, error } = await ssrClient.auth.getUser();
  return !error && data?.user ? data.user : null;
}

export async function POST(req: Request) {
  try {
    // 1. Wajib terautentikasi (mencegah penyalahgunaan publik / DoS biaya Railway)
    const user = await verifyAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Sesi login diperlukan untuk mencetak PDF.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { html, scale, format, isLandscape, footerTemplate, margin } = body || {};

    if (!html || typeof html !== 'string') {
      return NextResponse.json(
        { error: 'HTML content is required' },
        { status: 400 }
      );
    }

    if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) {
      return NextResponse.json(
        { error: 'Ukuran dokumen HTML melebihi batas maksimum (15 MB).' },
        { status: 413 }
      );
    }

    let PDF_SERVICE_URL = process.env.PDF_SERVICE_URL;
    if (!PDF_SERVICE_URL) {
      throw new Error(
        'PDF_SERVICE_URL belum diset di Environment Variables Vercel (Production/Preview).'
      );
    }

    if (!PDF_SERVICE_URL.startsWith('http')) {
      PDF_SERVICE_URL = `https://${PDF_SERVICE_URL}`;
    }
    if (PDF_SERVICE_URL.endsWith('/')) {
      PDF_SERVICE_URL = PDF_SERVICE_URL.slice(0, -1);
    }

    const payloadToRailway: Record<string, any> = {
      html,
      scale,
      format,
      isLandscape,
    };

    if (footerTemplate) {
      payloadToRailway.footerTemplate = footerTemplate;
    }

    if (margin) {
      payloadToRailway.margin = margin;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (process.env.PDF_SERVICE_SECRET) {
      headers['x-pdf-secret'] = process.env.PDF_SERVICE_SECRET;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    let response: Response;
    try {
      response = await fetch(PDF_SERVICE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payloadToRailway),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      if (fetchErr?.name === 'AbortError') {
        throw new Error(
          'Timeout (55 detik): Layanan PDF Railway tidak merespons. Periksa status container Railway atau URL gambar/logo di dokumen.'
        );
      }
      throw new Error(
        `Koneksi ke layanan PDF Railway gagal: ${fetchErr?.message || 'Network error'}`
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Railway Error (${response.status}): ${errorText}`);
    }

    const pdfBuffer = await response.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Document.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('=== PROXY PDF ERROR ===');
    console.error('Message:', error.message);

    return NextResponse.json(
      {
        error: 'Gagal generate PDF',
        details: error.message || 'Unknown server error',
      },
      { status: 500 }
    );
  }
}
