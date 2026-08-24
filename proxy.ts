import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const RUTAS_PUBLICAS = ['/login', '/registro', '/pendiente-de-aprobacion'];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Ya no hay landing: la raíz manda directo a donde corresponda según la
  // sesión, en vez de servir una página propia.
  if (pathname === '/') {
    return NextResponse.redirect(new URL(isLoggedIn ? '/hoy' : '/login', req.url));
  }

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
  // sesión (uptime checks, balanceadores de carga). El patrón final excluye
  // cualquier archivo de /public (contiene un punto: logo.png, icon.jpg,
  // etc.) — antes solo favicon.ico estaba exceptuado, así que el resto de
  // los assets públicos (p. ej. mascota-tigre.png en /login) quedaban
  // atrapados por el redirect a /login para visitantes sin sesión.
  matcher: ['/((?!api/auth|api/health|_next/static|_next/image|.*\\..*).*)'],
};
