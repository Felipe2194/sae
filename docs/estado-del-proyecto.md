# Estado del proyecto — contexto para retomar el trabajo

> Este documento resume decisiones y estado de la implementación. La especificación
> de producto completa está en [`contexto.md`](./contexto.md) y el plan de trabajo
> paso a paso en [`planes_extraidos/plan-de-construccion.md`](./planes_extraidos/plan-de-construccion.md).
> Este archivo es el complemento: qué se decidió al implementar, qué está hecho y
> cómo retomarlo.

---

## Decisión clave: PostgreSQL puro en Docker, sin Supabase

Se migró de Supabase CLI a un stack más simple:
- **`docker-compose.yml`** levanta solo PostgreSQL 17 (sin Auth Server, sin Studio, sin Storage).
- **`postgres.js`** reemplaza `@supabase/supabase-js` como cliente de base de datos.
- **Auth.js v5** (NextAuth con Credentials provider + JWT sessions) reemplaza Supabase Auth.
- El directorio `supabase/` (migraciones anteriores) queda como referencia histórica; las
  migraciones activas están en `db/migrations/`.

Variables de entorno relevantes (en `.env.local`):
- `DATABASE_URL` — cadena de conexión a Postgres.
- `AUTH_SECRET` — clave JWT de Auth.js (generar en prod con `openssl rand -base64 32`).
- `AUTH_URL` — URL base de la app.

Si en algún momento se retoma trabajo: `docker compose up -d` levanta la base y
`npm run db:migrate && npm run db:seed` deja todo listo.

---

## Stack técnico

| Capa           | Elección                                                              |
| -------------- | --------------------------------------------------------------------- |
| Frontend       | Next.js 16 (App Router) + TypeScript, sin `/src`                      |
| Estilos        | Tailwind CSS v4                                                       |
| Componentes UI | shadcn/ui — **ojo: usa Base UI, no Radix** (ver más abajo)            |
| Backend / DB   | PostgreSQL 17 en Docker (`docker-compose.yml`), cliente `postgres.js`  |
| Auth           | Auth.js v5 (NextAuth) — Credentials provider + JWT sessions            |
| Deploy futuro  | Vercel (app) — a definir cuándo se conecta una base real               |

### Gotcha importante: shadcn/ui con Base UI, no Radix

El `shadcn init` de este entorno instaló componentes basados en
[Base UI](https://base-ui.com) en vez de Radix (lo más común en tutoriales y
en la documentación pública de shadcn). La diferencia práctica:

- Para composición polimórfica se usa la prop **`render`**, no `asChild`.
  Ejemplo: `<Button render={<Link href="/x" />}>Texto</Button>` (los hijos van
  en el componente exterior, no en el elemento de `render`).
- Cuando el elemento de `render` **no** es un `<button>` nativo (un `<a>`, un
  `<div>`, un `next/link`), hay que pasar `nativeButton={false}` explícitamente
  en los componentes que lo soportan (`Button`, `CollapsibleTrigger`,
  `DropdownMenuItem`, etc.) o Base UI tira un warning en consola.
  **`SidebarMenuButton` NO acepta `nativeButton`** — no pasárselo (rompe con
  error de tipos y además el prop se filtra al DOM).
- Si se agregan más componentes de shadcn (`npx shadcn@latest add <x>`) y el
  CLI pide sobreescribir un archivo existente (`button.tsx`, `input.tsx`, etc.)
  con `-y` a veces no alcanza — hay que pasar `--overwrite` explícito.

---

## Estado actual (checklist del plan de construcción)

### ETAPA 0 — Cimientos

- [x] **M0.1 — Repositorio y proyecto base**: Next.js + Tailwind + shadcn/ui +
      ESLint/Prettier + estructura de carpetas. Git local inicializado
      (`git init`), **sin repo remoto todavía** (no hay `gh` autenticado en este
      entorno; falta que el usuario cree el repo en GitHub y se agregue como
      `origin` cuando quiera).
- [x] **M0.2 — Base de datos**: migrado a PostgreSQL 17 puro en Docker.
  - Migraciones activas en `db/migrations/`:
    - `001_schema.sql` — 9 tablas + 5 enums + índices. La tabla `usuario` tiene
      `password_hash` propio (sin FK a `auth.users` de Supabase).
    - `002_rls.sql` — RLS + GRANTs (ver M0.3).
  - Seed en `db/seed.ts` (TypeScript, usa bcryptjs para hashear passwords).
  - Tipos TS en `types/database.ts` — mantenidos a mano, sin generador.
  - Las migraciones anteriores de Supabase están en `supabase/migrations/` como
    referencia histórica, pero ya no se usan.
- [x] **M0.3 — Seguridad multi-organización (RLS + GRANTs)**: completado.
  - Rol PostgreSQL `sae_app` (NOLOGIN): las queries de la app hacen
    `SET LOCAL ROLE sae_app` + `set_config('app.user_id', uuid, true)` al inicio
    de cada transacción. RLS se activa automáticamente para `sae_app`.
  - Funciones helper `mi_usuario_id()`, `mi_organizacion_id()`, `mi_rol()`
    (las dos últimas con `SECURITY DEFINER` para evitar recursión RLS).
  - Políticas completas en las 9 tablas (SELECT/INSERT/UPDATE/DELETE).
  - El helper `withUser(userId, fn)` en `lib/db.ts` encapsula el patrón.
  - **Pendiente de validar**: probar aislamiento con segunda organización de
    prueba (paso 0.3.8 del plan). Se considera cerrado cuando ese test pase.
- [ ] **M0.4 — Despliegue**: pendiente (requiere decidir Vercel + qué hacer con
      la base — Supabase Cloud vs. self-hosted).

### Front (adelantado fuera de orden, a pedido, con datos mock)

Se armó la navegación completa de la app con datos hardcodeados
(`lib/mock-data.ts`) para poder verla, **sin esperar a M0.3/M1.1**:

- Layout `(app)` con sidebar + header.
- `/hoy` — Panel del día (interactivo: checkbox marca tarea como hecha).
- `/tablero` — Kanban estático (sin drag and drop todavía).
- `/areas` y `/areas/[areaId]` — listado y detalle.
- `/login`, `/registro`, `/pendiente-de-aprobacion` — solo UI, sin conectar a
  Supabase Auth todavía.
- `/calendario`, `/cronograma`, `/coordinacion`, `/admin` — placeholders "en
  construcción" con referencia al módulo del plan que los implementa.

**Importante:** estas pantallas usan datos mock, no la base real. Cuando se
resuelva M0.3 (GRANTs + RLS) hay que reemplazar `lib/mock-data.ts` por queries
reales a Supabase (`lib/supabase/client.ts` / `lib/supabase/server.ts`, ya
creados) — es el trabajo de M1.1 en adelante.

---

## Cómo levantar el proyecto (checklist rápida)

```bash
# 1. Docker Desktop tiene que estar corriendo

# 2. Levantar PostgreSQL
docker compose up -d

# 3. Aplicar migraciones y seed (solo la primera vez, o después de docker compose down -v)
npm run db:migrate
npm run db:seed

# 4. Front
npm run dev
```

- App: http://localhost:3000
- Credenciales de `.env.local`: ya están seteadas; no es necesario cambiarlas.
- Para conectarse directo a la base: `psql postgresql://postgres:postgres@localhost:5432/sae`
- Para resetear datos: `docker compose down -v && docker compose up -d && npm run db:migrate && npm run db:seed`

Scripts útiles:

```bash
npm run lint          # ESLint
npm run format        # Prettier (escribe)
npx tsc --noEmit       # chequeo de tipos
```

---

## Próximo paso sugerido

**Validar M0.3 + arrancar M1.1**: levantar el stack (`docker compose up -d &&
npm run db:migrate && npm run db:seed`), verificar que el login funcione con
`admin@sae.test / password123`, y probar el aislamiento con una segunda
organización de prueba. Una vez validado, reemplazar `lib/mock-data.ts` por
queries reales usando `withUser()` de `lib/db.ts` — es el trabajo de M1.1.
