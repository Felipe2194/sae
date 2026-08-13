import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const RUTAS_PUBLICAS = ['/login', '/registro', '/pendiente-de-aprobacion'];

export const proxy = auth((req) => {
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
  // api/health queda afuera a propósito: lo pegan monitores externos sin
  // sesión (uptime checks, balanceadores de carga).
  matcher: ['/((?!api/auth|api/health|_next/static|_next/image|favicon\\.ico).*)'],
};
