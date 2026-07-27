import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const RUTAS_PUBLICAS = ['/login', '/registro', '/pendiente-de-aprobacion'];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isPublica = RUTAS_PUBLICAS.some((r) => pathname.startsWith(r));

  if (!isLoggedIn && !isPublica) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isLoggedIn && (pathname === '/login' || pathname === '/registro')) {
    return NextResponse.redirect(new URL('/hoy', req.url));
  }
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon\\.ico).*)'],
};
