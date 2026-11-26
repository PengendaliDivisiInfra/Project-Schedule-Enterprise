import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  let res = NextResponse.next({
    request: { headers: req.headers },
  });

  const pathname = req.nextUrl.pathname;

  // Lewati request internal, API (diamankan di masing-masing route handler), file statis, dan callback auth
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth') ||
    pathname.includes('_rsc') ||
    pathname.includes('fallback-') ||
    pathname.includes('.')
  ) {
    return res;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({
            request: { headers: req.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Gunakan auth.getUser() agar JWT diverifikasi kriptografis oleh server Auth Supabase (bukan sekadar getSession)
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      user = data.user;
    }
  } catch (error) {
    // Fallback offline-safe jika koneksi ke Supabase Auth terputus
    const hasAuthCookie = req.cookies
      .getAll()
      .some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
    if (hasAuthCookie) return res;
  }

  const isAuthRoute = pathname.startsWith('/login');

  if (!user && !isAuthRoute) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthRoute && pathname === '/login') {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/';
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*|fallback-.*|api/|auth/|.*_rsc=.*|.*\\..*).*)',
  ],
};
