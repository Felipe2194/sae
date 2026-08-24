# SAE — Documentación técnica

> Para entender el repositorio desde cero, sin el historial de conversaciones
> que lo construyó. Para el estado de avance y qué queda pendiente ver
> [`estado-del-proyecto.md`](./estado-del-proyecto.md); para "cómo se usa
> cada pantalla" ver [`manual-de-usuario.md`](./manual-de-usuario.md); para
> instalar una instancia nueva ver
> [`guia-instalacion.md`](./guia-instalacion.md).

---

## 1. Stack

| Capa | Elección |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript, sin `/src` |
| Estilos | Tailwind CSS v4 |
| Componentes UI | shadcn/ui — **usa [Base UI](https://base-ui.com), no Radix** (ver gotcha abajo) |
| Base de datos | PostgreSQL 17, cliente [`postgres.js`](https://github.com/porsager/postgres) (`lib/db.ts`) |
| Auth | Auth.js v5 (NextAuth) — Credentials + Google OAuth, sesiones JWT (sin adapter/tablas de sesión) |
| Multi-tenancy | Row Level Security de Postgres, no un filtro a nivel de aplicación |
| Testing | Vitest (`npm test`) |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |

No hay Supabase: el proyecto arrancó con Supabase (Postgres + Auth + Storage
gestionados) y se migró a Postgres puro en Docker + Auth.js propio para
simplificar el entorno local (un contenedor en vez de la pila completa de
Supabase CLI) y tener control directo sobre RLS y las políticas.
`lib/supabase/` (`client.ts`, `server.ts`) y el directorio `supabase/` de la
etapa pre-migración eran código muerto sin ninguna referencia en el código
actual, y se eliminaron del repo.

## 2. Arquitectura multi-organización

El schema está preparado para múltiples organizaciones (secretarías/
regionales) desde el día uno, aunque hoy en producción corre una sola. Toda
tabla de datos de negocio tiene una columna `organizacion_id`.

**El aislamiento se hace con RLS, no con `WHERE organizacion_id = ...` a
mano en cada query:**

- Rol de Postgres `sae_app` (`NOLOGIN`) — las queries de la app corren bajo
  este rol, no como superusuario.
- `lib/db.ts` expone `withUser(userId, fn)`: abre una transacción, hace
  `SET LOCAL ROLE sae_app` y `set_config('app.user_id', userId, true)`.
  Ambos son `LOCAL`, se revierten solos al cerrar la transacción.
- Funciones helper en SQL (`SECURITY DEFINER`, para no recursar contra sus
  propias políticas RLS): `mi_usuario_id()`, `mi_organizacion_id()`,
  `mi_rol()`. Las queries de la app las usan en vez de pasar el
  `organizacion_id` a mano — es imposible que una query autenticada lea o
  escriba datos de otra organización sin que Postgres mismo lo bloquee.
- El aislamiento tiene un test automatizado real:
  `db/tests/rls-aislamiento.test.ts` crea dos organizaciones de prueba y
  verifica que una no puede leer ni escribir datos de la otra.
- Desde M4.2, `withUser` también fija `set_config('timezone', ...)` con la
  `zona_horaria` de la organización del usuario — así `current_date`/
  `current_time` en SQL (usados por el indicador "en la oficina ahora", la
  bitácora diaria y los informes) quedan en la hora de esa organización y no
  en la del contenedor de Postgres (UTC por defecto).

Casi todas las mutaciones de la app usan `withUser`. Las pocas excepciones
son operaciones sin sesión todavía (alta de usuario en `/registro`, branding
de las pantallas de login) que usan el `sql` exportado directamente de
`lib/db.ts` — conexión con privilegios de superusuario, sin RLS.

## 3. Modelo de datos

`db/migrations/` tiene 14 migraciones SQL, aplicadas en orden y trackeadas
en la tabla `_migraciones` (`npm run db:migrate`, ver `db/migrate.ts`). Las
más relevantes para entender el esquema:

| Migración | Qué agrega |
| --- | --- |
| `001_schema.sql` | Tablas base: `organizacion`, `usuario`, `area`, `tarea`, `comentario`, `adjunto`, `acceso_rapido`, `turno`, `bitacora_diaria`, y los enums (`rol_usuario`, `estado_usuario`, `estado_tarea`, `prioridad_tarea`, `tipo_adjunto`). |
| `002_rls.sql` | Rol `sae_app`, GRANTs, políticas RLS y las funciones `mi_*()`. |
| `003_tareas_v2.sql` | `subtarea`. |
| `004_notas_area.sql` | `nota_area` (bitácora por área). |
| `005_tarea_log.sql` | Historial de cambios por tarea. |
| `006_notificaciones.sql` | `notificacion` in-app. |
| `007_rate_limit.sql` | `intento_auth` (rate limiting de login/registro). |
| `008_tarea_archivada.sql` | Columna `archivada` en vez de borrado físico. |
| `009_duracion_ausencias_plantillas.sql` | Duración estimada/real, `excepcion_turno` (ausencias), `plantilla_area`/`plantilla_item`. |
| `010_playlist_usuario.sql` | Playlist personal en `/perfil`. |
| `011_avatar_color.sql` | Color de avatar. |
| `012_tracking_informes.sql` | `usuario.ultimo_login`, tracking de uso de plantillas. |
| `013_plantilla_area_update_policy.sql` | Política de `update` que le faltaba a `plantilla_area`. |
| `014_organizacion_personalizacion.sql` | `organizacion.color_principal`. |

`types/database.ts` mantiene a mano (sin generador) los tipos `Row`/
`Insert`/`Update` por tabla — cualquier cambio de columna en una migración
tiene que reflejarse ahí también.

## 4. Estructura de carpetas

```
/app
  /login           pantalla de login — diseño propio, fuera de (auth),
                    sin sesión todavía
  /(auth)          registro, pendiente-de-aprobacion — layout con
                    branding de la organización, sin sesión todavía
  /(app)           rutas protegidas: hoy, tablero, areas, cronograma,
                    calendario, coordinacion, informes, admin, perfil
  /api             route handlers: auth (NextAuth), calendar/events, health
/components
  /ui              shadcn/ui (Base UI) — no editar a mano, regenerar con
                    `npx shadcn@latest add <componente> --overwrite`
  /features        componentes de dominio (sidebar, notificaciones, tema...)
/lib
  db.ts            pool de conexión + withUser()
  logger.ts        logging estructurado en JSON, sin dependencias
  telegram.ts      notificaciones opcionales al grupo del equipo
  rate-limit.ts    rate limiting de login/registro
  google/          vacío — reservado, la integración de Calendar vive en
                    app/api/calendar/events y la de Drive Picker en
                    app/(app)/tablero/drive-picker-button.tsx (carga scripts
                    de Google en el cliente, no usa este directorio)
/types
  database.ts      tipos Row/Insert/Update a mano por tabla
/db
  migrations/      SQL versionado, ver sección 3
  migrate.ts       runner de migraciones
  seed.ts          datos de prueba (bcrypt para passwords)
  tests/           tests de Vitest contra una base real
/docs              este directorio
```

## 5. Gotcha: shadcn/ui usa Base UI, no Radix

El `shadcn init` de este proyecto instaló componentes sobre
[Base UI](https://base-ui.com) en vez de Radix (lo más común en tutoriales y
en la documentación pública de shadcn):

- Composición polimórfica: prop **`render`**, no `asChild`. Ejemplo:
  `<Button render={<Link href="/x" />}>Texto</Button>` — los hijos van en el
  componente exterior, no en el elemento de `render`.
- Cuando el elemento de `render` no es un `<button>` nativo, pasar
  `nativeButton={false}` explícito en los componentes que lo soportan
  (`Button`, `CollapsibleTrigger`, `DropdownMenuItem`...) o Base UI tira un
  warning. **`SidebarMenuButton` NO acepta `nativeButton`** — no pasárselo.
- Si el CLI pide sobreescribir un archivo existente, `-y` a veces no
  alcanza — pasar `--overwrite` explícito.

## 6. Convenciones

- Lógica de negocio vive en la app (Server Actions y Route Handlers), no en
  funciones propietarias de ningún proveedor — así una migración de hosting
  no depende de reescribir lógica.
- Cada Server Action de mutación sigue el mismo patrón: `requireAuth()`/
  `requireAdmin()`/`requireCoord()` → `withUser(...)` → `revalidatePath(...)`
  (ver `app/(app)/admin/actions.ts` como referencia).
- Componentes base de UI en `components/ui` (generados); componentes de
  dominio en `components/features` o junto a la página que los usa.
- Variables de entorno: `NEXT_PUBLIC_*` son las únicas expuestas al cliente
  (usadas para claves no secretas como el client ID de OAuth y API keys ya
  restringidas por dominio/API) — todo lo demás queda server-only.

## 7. Seguridad y hardening ya aplicado

- Headers de seguridad en `next.config.ts`: CSP, `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS en
  producción. La CSP whitelistea explícitamente los hosts externos que la
  app sí necesita (YouTube embed, Google Identity Services/Picker/Drive) —
  cualquier integración nueva que cargue un script o abra un iframe externo
  tiene que sumarse ahí o el navegador la bloquea en silencio.
- Rate limiting en login/registro (`lib/rate-limit.ts`, tabla
  `intento_auth`).
- `/api/health`, sin autenticación, para monitoreo externo — confirma que
  el proceso responde y que la base es alcanzable.
- Falta (documentado en `estado-del-proyecto.md`): Sentry o similar para
  trazas de errores con stack completo.
