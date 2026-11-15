import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  let res = NextResponse.next({
    request: { headers: req.headers },
  })

  const pathname = req.nextUrl.pathname;

  // 🟢 LEWATI SEMUA REQUEST INTERNAL, API, FILE STATIS, DAN AUTH
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api') || 
    pathname.startsWith('/auth') || // Jangan ganggu proses callback OAuth
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
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => req.cookies.set(name, value))
          res = NextResponse.next({
            request: { headers: req.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let session = null;
  try {
    const { data } = await supabase.auth.getSession();
    session = data?.session;
  } catch (error) {
    // Abaikan error jika offline
    const hasAuthCookie = req.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));
    if (hasAuthCookie) return res;
  }
  
  const isAuthRoute = pathname.startsWith('/login');

  if (!session && !isAuthRoute) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.search = '' 
    return NextResponse.redirect(redirectUrl)
  }

  if (session && isAuthRoute && pathname === '/login') {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/'
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*|fallback-.*|api/|auth/|.*_rsc=.*|.*\\..*).*)',
  ],
}