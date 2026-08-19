# Estado del proyecto — contexto para retomar el trabajo

> Este documento resume decisiones y estado de la implementación. La especificación
> de producto completa está en [`contexto.md`](./contexto.md) y el plan de trabajo
> paso a paso en [`planes_extraidos/plan-de-construccion.md`](./planes_extraidos/plan-de-construccion.md).
> Este archivo es el complemento: qué se decidió al implementar, qué está hecho y
> cómo retomarlo. Para el detalle técnico completo del repo tal como quedó, ver
> [`documentacion-tecnica.md`](./documentacion-tecnica.md); para instalar una
> instancia nueva, [`guia-instalacion.md`](./guia-instalacion.md).

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
  - Migraciones activas en `db/migrations/` (aplicadas en orden, trackeadas en
    la tabla `_migraciones`): `001_schema.sql` (9 tablas base + 5 enums),
    `002_rls.sql` (RLS + GRANTs), `003_tareas_v2.sql` (subtareas),
    `004_notas_area.sql` (bitácora), `005_tarea_log.sql` (historial de
    cambios), `006_notificaciones.sql`, `007_rate_limit.sql` (control de
    intentos de login/registro).
  - Seed en `db/seed.ts` (TypeScript, usa bcryptjs para hashear passwords).
  - Tipos TS en `types/database.ts` — mantenidos a mano, sin generador.
  - Las migraciones anteriores de Supabase están en `supabase/migrations/` como
    referencia histórica, pero ya no se usan.
- [x] **M0.3 — Seguridad multi-organización (RLS + GRANTs)**: completado a
      nivel de código — cada tabla nueva agrega su propia política RLS en su
      migración (verificado: `subtarea`, `nota_area`, `tarea_log`,
      `notificacion` la tienen).
  - Rol PostgreSQL `sae_app` (NOLOGIN): las queries de la app hacen
    `SET LOCAL ROLE sae_app` + `set_config('app.user_id', uuid, true)` al inicio
    de cada transacción. RLS se activa automáticamente para `sae_app`.
  - Funciones helper `mi_usuario_id()`, `mi_organizacion_id()`, `mi_rol()`
    (las dos últimas con `SECURITY DEFINER` para evitar recursión RLS).
  - El helper `withUser(userId, fn)` en `lib/db.ts` encapsula el patrón.
  - **Sigue pendiente de validar en la práctica**: nunca se probó el
    aislamiento con una segunda organización real (paso 0.3.8 del plan) ni hay
    un test automatizado que lo cubra. Es la garantía de seguridad central del
    diseño — conviene cerrarlo antes de producción.
- [ ] **M0.4 — Despliegue**: pendiente. Falta decidir el proveedor de Postgres
      gestionado (Vercel ya no ofrece Postgres propio — se provisiona vía
      Marketplace: Neon, Supabase Cloud, etc.) y confirmar Vercel como destino
      de deploy. Sin esto no hay dónde desplegar.

### Front — conectado a la base real

Ya no usa `lib/mock-data.ts` (queda el archivo pero no se importa en ninguna
página). Todo el front lee/escribe contra Postgres vía `withUser()`:

- Layout `(app)` con sidebar + header + búsqueda global (Cmd/Ctrl+K).
- `/hoy` — panel del día, accesos rápidos configurables.
- `/tablero` — Kanban con drag-and-drop (dnd-kit), filtros, subtareas,
  comentarios, adjuntos (solo enlaces, no upload de archivos), historial de
  cambios por tarea.
- `/areas` y `/areas/[areaId]` — CRUD para coordinadores/admins + bitácora de
  notas por área.
- `/cronograma` — turnos del equipo, timeline visual.
- `/calendario` — integra Google Calendar API (opcional; sin las env vars
  muestra eventos de ejemplo) + tareas del sistema.
- `/coordinacion`, `/admin` — gestión de usuarios (aprobar, cambiar rol,
  activar/desactivar), configuración.
- `/login` (Credentials + Google OAuth), `/registro`, `/pendiente-de-aprobacion`
  — conectados a Auth.js v5 real. Login y registro tienen rate limiting básico
  (`lib/rate-limit.ts`, tabla `intento_auth`).
- Notificaciones in-app (polling cada 30s — no escala mucho más allá de un
  puñado de usuarios simultáneos, pero alcanza para el uso actual).

### Etapa 4 (parcial) — personalización, Drive y documentación

Sin M4.1 (alta autogestionada de organizaciones — no aplica sin una segunda
organización real usando el sistema):

- **M4.2 Personalización**: `/admin` → sección "Organización" para nombre,
  logo, color principal y zona horaria. `withUser()` (`lib/db.ts`) aplica la
  zona horaria configurada a la sesión de Postgres, así `current_date`/
  `current_time` (bitácora, "en la oficina ahora", informes) quedan en la
  hora real de la organización en vez de la del contenedor.
- **M4.3 Drive**: botón "Drive" al adjuntar un archivo en `/tablero` (Google
  Picker, scope `drive.file`, sin guardar tokens en el servidor) + vista
  previa embebida de adjuntos de Drive. Requiere credenciales opcionales,
  ver `credenciales-pendientes.md` sección 6.
- **M4.4 Documentación**: manual de usuario, documentación técnica, guía de
  instalación e instructivo de migración a servidores propios — los cuatro
  nuevos en `docs/`.

---

## Checklist para producción (pendiente, en orden de prioridad)

- [ ] Elegir proveedor de Postgres gestionado y confirmar deploy en Vercel
      (M0.4 — ver arriba).
- [ ] Validar aislamiento multi-organización con una segunda org de prueba.
- [ ] Tests automatizados y CI (hoy no hay ni test runner ni `.github/`) — nada
      impide que un commit con código roto llegue a `main`.
- [ ] Observabilidad: no hay Sentry ni logging estructurado ni endpoint de
      health-check.
- [ ] Headers de seguridad (CSP, HSTS, X-Frame-Options) en `next.config.ts`.
- [ ] `robots.txt` / sitemap (bajo impacto por ser app interna).

Ya resueltos en la última revisión (2026-08-11): build roto en `main` (JSX mal
cerrado en `tarea-sheet.tsx`), 16 errores de tipos por `onValueChange` de los
`Select` de Base UI recibiendo `string | null`, errores de ESLint que
bloqueaban el build, validación de `DATABASE_URL` al arrancar,
`error.tsx`/`not-found.tsx`/`global-error.tsx`, rate limiting en login/registro,
variables de Google OAuth documentadas en `.env.example`.

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

**Cerrar M0.4**: decidir proveedor de Postgres gestionado + confirmar Vercel,
y con eso hacer el primer deploy real. En paralelo, probar el aislamiento
multi-organización (única deuda de seguridad pendiente de M0.3) antes de dar
por cerrada esa etapa. Ver el checklist de producción arriba para el resto.
