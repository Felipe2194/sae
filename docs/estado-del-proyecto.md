# Estado del proyecto — contexto para retomar el trabajo

> Este documento resume decisiones y estado de la implementación. La especificación
> de producto completa está en [`contexto.md`](./contexto.md) y el plan de trabajo
> paso a paso en [`planes_extraidos/plan-de-construccion.md`](./planes_extraidos/plan-de-construccion.md).
> Este archivo es el complemento: qué se decidió al implementar, qué está hecho y
> cómo retomarlo.

---

## Decisión clave: base de datos en Docker local, NO Supabase Cloud

**Nunca se creó un proyecto en la nube de Supabase.** Toda la base de datos corre
localmente con Docker a través del CLI de Supabase (`npx supabase start`), que
levanta Postgres + Auth + Storage + Studio como contenedores en la máquina.

Esto significa:

- No hay `Project URL` ni claves de un proyecto remoto en supabase.com.
- Las credenciales de `.env.local` son las que devuelve `npx supabase status`
  (siempre las mismas para cualquiera que levante el proyecto local — no son secretas).
- El deploy a producción (Vercel + Supabase Cloud, o self-hosted en servidores de
  la facultad) es una decisión que se toma más adelante (Fase 4 del plan / M0.4).
  Por ahora **todo el desarrollo es local**.
- Si en algún momento se retoma trabajo y hay dudas: correr `docker ps` para ver
  los contenedores de Supabase corriendo (`supabase_db_sae`, `supabase_auth_sae`,
  etc.) y `npx supabase status` para las URLs/keys vigentes.

---

## Stack técnico

| Capa           | Elección                                                              |
| -------------- | --------------------------------------------------------------------- |
| Frontend       | Next.js 16 (App Router) + TypeScript, sin `/src`                      |
| Estilos        | Tailwind CSS v4                                                       |
| Componentes UI | shadcn/ui — **ojo: usa Base UI, no Radix** (ver más abajo)            |
| Backend / DB   | Supabase local vía Docker (Postgres + Auth + Storage), CLI `supabase` |
| Deploy futuro  | Vercel (app) — a definir cuándo se conecta una base real              |

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
- [x] **M0.2 — Base de datos**: local en Docker vía Supabase CLI.
  - Migración inicial (`supabase/migrations/20260727222326_esquema_inicial.sql`):
    las 9 tablas del modelo de datos + 5 enums + índices + trigger
    `al_crear_usuario` (crea la fila en `usuario` con estado `pendiente` al
    registrarse alguien en `auth.users`, usando `organizacion_id` del
    `raw_user_meta_data`).
  - Seed (`supabase/seed.sql`): organización SAE FRVM, 13 áreas, 3 usuarios de
    prueba (`admin@sae.test` / `coordinador@sae.test` / `miembro@sae.test`,
    password `password123`), 15 tareas.
  - Tipos TS generados en `types/database.ts` (regenerar con
    `npx supabase gen types typescript --local > types/database.ts` —
    **cuidado**: redirigir con `2>/dev/null` o el log "Connecting to db..." del
    CLI corrompe el archivo).
  - **Hallazgo importante, pendiente para M0.3**: en esta versión de Supabase
    ninguna tabla nueva tiene privilegios por defecto para `anon` /
    `authenticated` / `service_role` (ni siquiera `service_role` tiene
    `SELECT`). Hace falta agregar **GRANTs explícitos** junto con las políticas
    de RLS — ya no alcanza con escribir solo las políticas.
- [ ] **M0.3 — Seguridad multi-organización (RLS + GRANTs)**: pendiente.
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

# 2. Base de datos local (levanta contenedores; aplica migraciones + seed)
npx supabase start
# o, si ya está iniciado y solo se quiere resetear datos:
npx supabase db reset

# 3. Front
npm run dev
```

- App: http://localhost:3000
- Supabase Studio (para ver los datos a ojo): http://127.0.0.1:54323
- Credenciales de `.env.local`: ya están seteadas para el stack local; si se
  reinicia Docker y las keys cambiaran, correr `npx supabase status` y
  actualizar `.env.local` (no se commitea — ver `.env.example`).

Scripts útiles:

```bash
npm run lint          # ESLint
npm run format        # Prettier (escribe)
npx tsc --noEmit       # chequeo de tipos
```

---

## Próximo paso sugerido

**M0.3 — Seguridad multi-organización**: escribir GRANTs + políticas de RLS
para las 9 tablas, crear las funciones `mi_organizacion()` y `mi_rol()`, y
probar el aislamiento con una segunda organización de prueba (paso 0.3.8 del
plan, no se considera cerrado el módulo hasta que ese test pase). Recién ahí
tiene sentido reemplazar los datos mock del front por datos reales.
