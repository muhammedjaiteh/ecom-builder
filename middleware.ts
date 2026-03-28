import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Allow /admin routes to pass through for authenticated users
  // Admin email check happens in the layout component
  if (req.nextUrl.pathname.startsWith('/admin')) {
    return res;
  }

  // If user is NOT logged in AND tries to visit Dashboard...
  if (!session && req.nextUrl.pathname.startsWith('/dashboard')) {
    // ...Kick them back to Login!
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/login';
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};