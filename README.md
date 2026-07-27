# SAE — Sistema de Gestión de Actividades para Secretarías

Panel operativo diario para la Secretaría de Asuntos Estudiantiles (SAE) de UTN FRVM: tareas, responsables, cronograma y calendario en un solo lugar. Multi-organización desde el diseño, para poder replicarse en otras secretarías.

La especificación completa y el plan de construcción viven en [`docs/`](docs/):

- [`docs/contexto.md`](docs/contexto.md) — especificación del producto.
- [`docs/planes_extraidos/plan-de-construccion.md`](docs/planes_extraidos/plan-de-construccion.md) — plan de trabajo por etapas/módulos/pasos.

## Stack

Next.js (App Router) + TypeScript, Tailwind CSS + shadcn/ui, Supabase (Postgres + Auth + Storage + RLS), dnd-kit, deploy en Vercel.

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
npm run build          # build de producción
```

## Estructura de carpetas

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
    /admin
  /api
/components
  /ui              shadcn/ui
  /features        componentes por dominio (tareas, areas, turnos...)
/lib
  /supabase        clientes y queries
  /google          integración calendar
  utils.ts
/types
/docs              especificación y plan de construcción
```

## Convenciones

- Componentes base de UI van en `components/ui` (generados con `npx shadcn@latest add <componente>`); componentes de dominio en `components/features`.
- La lógica de negocio vive en la app (no en Edge Functions propietarias de Supabase), para que una eventual migración a self-hosted sea trivial.
- Modelo de datos y políticas de RLS: ver sección 5 y el módulo M0.3 en `docs/`.
