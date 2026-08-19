# SAE — Sistema de Gestión de Actividades para Secretarías

Panel operativo diario para la Secretaría de Asuntos Estudiantiles (SAE) de UTN FRVM: tareas, responsables, cronograma y calendario en un solo lugar. Multi-organización desde el diseño, para poder replicarse en otras secretarías.

La especificación completa y el plan de construcción viven en [`docs/`](docs/):

- [`docs/contexto.md`](docs/contexto.md) — especificación del producto.
- [`docs/planes_extraidos/plan-de-construccion.md`](docs/planes_extraidos/plan-de-construccion.md) — plan de trabajo por etapas/módulos/pasos.
- [`docs/estado-del-proyecto.md`](docs/estado-del-proyecto.md) — **empezar por acá para retomar el trabajo**: decisiones tomadas, estado actual y cómo levantar todo local.
- [`docs/manual-de-usuario.md`](docs/manual-de-usuario.md) — cómo usar cada pantalla del sistema.
- [`docs/documentacion-tecnica.md`](docs/documentacion-tecnica.md) — arquitectura, modelo de datos y convenciones, para entender el repo desde cero.
- [`docs/guia-instalacion.md`](docs/guia-instalacion.md) — instalar una instancia nueva (otra regional/secretaría).
- [`docs/migracion-servidores-propios.md`](docs/migracion-servidores-propios.md) — mover la app a infraestructura propia.
- [`docs/credenciales-pendientes.md`](docs/credenciales-pendientes.md) — qué credenciales opcionales faltan cargar y dónde conseguirlas.

## Stack

Next.js (App Router) + TypeScript, Tailwind CSS v4 + shadcn/ui (Base UI, no Radix), PostgreSQL 17 en Docker con `postgres.js` (sin Supabase — ver `docs/estado-del-proyecto.md`), Auth.js v5, dnd-kit, deploy en Vercel (pendiente, ver `docs/guia-instalacion.md`).

## Getting Started

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

Otros scripts:

```bash
npm run lint          # ESLint
npm run format        # Prettier (escribe)
npm run format:check  # Prettier (solo chequea)
npm test               # Vitest
npm run build          # build de producción
```

## Estructura de carpetas

Ver `docs/documentacion-tecnica.md` sección 4 para el detalle completo y
comentado; resumen:

```
/app
  /(auth)          login, registro, pendiente-de-aprobacion
  /(app)           rutas protegidas
    /hoy           panel del día
    /tablero       kanban
    /calendario
    /cronograma
    /areas
    /coordinacion
    /informes
    /admin
  /api
/components
  /ui              shadcn/ui (Base UI, no Radix)
  /features        componentes por dominio (tareas, areas, turnos...)
/lib
  db.ts            pool de conexión + withUser() (RLS)
  utils.ts
/types
  database.ts      tipos Row/Insert/Update a mano
/db
  migrations/      SQL versionado
/docs              especificación, plan de construcción y guías (ver arriba)
```

## Convenciones

- Componentes base de UI van en `components/ui` (generados con `npx shadcn@latest add <componente> --overwrite`); componentes de dominio en `components/features`.
- La lógica de negocio vive en la app (Server Actions/Route Handlers), no en funciones propietarias de ningún proveedor, para que una eventual migración a self-hosted sea trivial (ver `docs/migracion-servidores-propios.md`).
- Modelo de datos y políticas de RLS: ver `docs/documentacion-tecnica.md` secciones 2-3.
