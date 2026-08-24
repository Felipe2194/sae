# SAE — Sistema de Gestión de Actividades para Secretarías

**SAE** es el panel operativo interno de la Secretaría de Asuntos Estudiantiles (SAE) de la UTN FRVM. Reemplaza el uso de WhatsApp y planillas sueltas para coordinar el trabajo diario del equipo: **qué hay que hacer, quién lo hace, quién está de turno ahora mismo y qué quedó pendiente cada día**, todo en un solo lugar.

Está pensado desde el diseño para ser **multi-organización**: aunque hoy corre para la SAE de FRVM, el mismo sistema podría replicarse para otra secretaría o regional sin tocar el código, solo dando de alta una nueva organización.

> Si buscás el detalle técnico exhaustivo (modelo de datos, decisiones de arquitectura, cómo instalar una instancia nueva), este README es la puerta de entrada — los documentos completos viven en [`docs/`](docs/) y están linkeados en cada sección.

---

## Índice

1. [¿Qué es SAE y qué problema resuelve?](#1-qué-es-sae-y-qué-problema-resuelve)
2. [Funcionalidades](#2-funcionalidades)
3. [Roles y permisos](#3-roles-y-permisos)
4. [Tecnologías utilizadas](#4-tecnologías-utilizadas)
5. [Arquitectura, en breve](#5-arquitectura-en-breve)
6. [Cómo se usa el sistema (guía rápida)](#6-cómo-se-usa-el-sistema-guía-rápida)
7. [Cómo levantar el proyecto localmente](#7-cómo-levantar-el-proyecto-localmente)
8. [Estado del proyecto](#8-estado-del-proyecto)
9. [Documentación adicional](#9-documentación-adicional)

---

## 1. ¿Qué es SAE y qué problema resuelve?

Una secretaría estudiantil coordina muchas cosas a la vez: becas, deportes, salud, trámites, eventos. Sin una herramienta común, esa coordinación termina viviendo repartida entre grupos de WhatsApp, planillas de Excel sueltas y memoria de cada persona — información que se pierde, se duplica o nadie sabe dónde quedó.

SAE junta todo eso en un panel web compartido por todo el equipo, con un principio de diseño deliberadamente simple: **jerarquía plana**. Solo existen dos niveles:

- **Área**: una línea de trabajo temática (Becas, Deportes, Salud, etc.), con un responsable y un color propio.
- **Tarea**: algo concreto para hacer dentro de un área.

No hay sub-proyectos, ni sprints, ni la complejidad de una herramienta tipo Jira/Asana — a propósito, para que cualquiera del equipo (técnico o no) lo entienda en cinco minutos y lo use sin fricción todos los días.

---

## 2. Funcionalidades

### 2.1 `/hoy` — Panel del día (pantalla de inicio)

Lo primero que ve cualquiera al entrar. Responde "¿qué tengo que hacer hoy?" sin que la persona tenga que ir a buscarlo:

- Saludo con ícono según la hora del día.
- **Última novedad**: la nota más reciente cargada en cualquier área del equipo.
- **Tareas vencidas** (en rojo) y **tareas de hoy**, marcables como hechas con un clic — al completar todas aparece un confetti de feedback.
- **Próximamente**: lo que viene después, colapsable.
- **Bitácora del día**: "qué hice / qué quedó pendiente / observaciones", que se precarga sola con los títulos de las tareas que la persona completó ese día.
- **Música de la oficina**: reproductor de YouTube de fondo (ver más abajo), con selector entre la playlist de la organización y la playlist personal de cada usuario.
- **En la oficina ahora**: quién está de turno en este momento, según el cronograma (excluye a quien marcó ausencia).
- **Pulso**: contador de tareas abiertas / en progreso / completadas hoy, a nivel de todo el equipo.
- **Accesos rápidos**: botones a enlaces externos (Drive, planillas, formularios) configurados por un administrador.

### 2.2 `/tablero` — Tablero Kanban

Donde vive el trabajo día a día. Tres columnas fijas y no configurables (Por hacer · En progreso · Hecha), a propósito, para evitar la complejidad de un Kanban tipo Jira:

- Tarjetas arrastrables entre columnas (drag-and-drop).
- Filtros por área, responsable y estado.
- Cada tarjeta se abre en un panel con: descripción, tipo (tarea/evento/entrega/reunión), prioridad, fecha de vencimiento, **repetición** (diaria/semanal/mensual — al completarla se clona sola la siguiente), responsable, horas estimadas/reales, **subtareas** (checklist), **comentarios**, **adjuntos** (enlaces, o elegidos directo desde Google Drive) y el **historial de cambios** de la tarea.
- Crear una tarea nueva es un paso: título + área. Todo lo demás es opcional.
- **Archivar en vez de borrar**: preserva el historial y las métricas de los reportes. Hay una vista aparte de tareas archivadas, con opción de restaurar.

### 2.3 `/areas` — Áreas de trabajo

Listado de las líneas de trabajo de la secretaría, con color, responsable y % de tareas completadas. Al entrar a una en particular:

- Sus tareas agrupadas por estado.
- **Plantillas de tareas**: un nombre + una lista de títulos reutilizable, para procesos que se repiten (una inscripción a becas, un torneo). "Aplicar" clona esos títulos como tareas reales.
- **Bitácora de notas del área**: novedades y observaciones libres, sin atar a una tarea puntual.

### 2.4 `/cronograma` — Turnos del equipo

Grilla semanal (lunes a viernes) de quién cubre cada franja horaria. Cuando alguien deja el equipo, su turno se **cierra**, no se borra, así el histórico sigue siendo correcto. Cualquiera puede marcar su propia ausencia (o cambio de turno); ese bloque queda atenuado ese día y deja de contarse en "en la oficina ahora".

### 2.5 `/calendario` — Calendario

Vista mensual que combina en un mismo grid las tareas del sistema con fecha de vencimiento y los eventos de un calendario público de Google Calendar de la secretaría.

### 2.6 `/coordinacion` — Reportes de estado actual (coordinador/admin)

Foto del momento para quien coordina el equipo: totales globales, las tareas abiertas más antiguas sin resolver, carga de trabajo por persona, avance por área y precisión de estimación (horas estimadas vs. reales).

### 2.7 `/informes` — Analíticas en el tiempo (coordinador/admin)

Complementa a `/coordinacion` con la evolución de la actividad: tareas creadas vs. completadas por semana, ritmo de cierre por área, adopción de la bitácora, antigüedad de tareas vencidas, uso de plantillas, colaboración por comentarios, ausencias y último login por persona.

### 2.8 `/admin` — Administración (solo administrador)

- **Organización**: nombre, logo, color principal y zona horaria — se reflejan en toda la app.
- **Usuarios**: aprobar registros pendientes, cambiar rol, activar/desactivar cuentas.
- **Asignar tareas**: tareas abiertas sin responsable, para asignarlas o reasignarlas.
- **Accesos rápidos**: los enlaces que ve todo el equipo en `/hoy`.
- **Google Calendar**: estado de la conexión e instrucciones de configuración.

### 2.9 `/perfil`

Datos básicos del usuario, color de avatar y un link opcional a una playlist propia de YouTube/YouTube Music, que después aparece como opción en el reproductor de `/hoy`.

### 2.10 Presentes en toda la app

- **Búsqueda global** (`Cmd/Ctrl+K`): busca tareas y áreas, y ofrece acciones rápidas (nueva tarea, ir a la bitácora de hoy, cronograma, coordinación/admin según el rol).
- **Notificaciones**: campana con avisos al asignar una tarea o comentar en una de la que alguien es responsable; opcionalmente también se avisa por Telegram al grupo del equipo.
- **Modo oscuro por defecto**, con botón para pasar a claro.

---

## 3. Roles y permisos

El sistema tiene tres roles, que determinan qué se ve en el menú lateral y qué acciones están habilitadas:

| Rol | Puede hacer |
|---|---|
| **Miembro** *(por defecto)* | Ver `/hoy`, usar el tablero, cambiar el estado de sus propias tareas, comentar, cargar su bitácora diaria. |
| **Coordinador** | Todo lo del Miembro + crear/asignar tareas a cualquiera, gestionar áreas y accesos rápidos, armar el cronograma de turnos, ver `/coordinacion` e `/informes`. |
| **Administrador** | Todo lo del Coordinador + `/admin`: aprobar registros, cambiar roles, activar/desactivar cuentas, asignar tareas sin dueño, configurar la organización. |

---

## 4. Tecnologías utilizadas

| Capa | Tecnología |
|---|---|
| Framework web | [Next.js](https://nextjs.org) 16 (App Router) + [TypeScript](https://www.typescriptlang.org) |
| Interfaz visual | [React](https://react.dev) 19, [Tailwind CSS](https://tailwindcss.com) v4, [shadcn/ui](https://ui.shadcn.com) (sobre [Base UI](https://base-ui.com)) |
| Interacciones | [dnd-kit](https://dndkit.com) (drag-and-drop del tablero), [framer-motion](https://motion.dev) (animaciones), [canvas-confetti](https://www.npmjs.com/package/canvas-confetti) |
| Base de datos | [PostgreSQL](https://www.postgresql.org) 17, corriendo en [Docker](https://www.docker.com) en desarrollo, cliente [`postgres.js`](https://github.com/porsager/postgres) |
| Aislamiento multi-organización | Row Level Security (RLS) nativo de PostgreSQL |
| Autenticación | [Auth.js](https://authjs.dev) v5 (NextAuth) — login con email/contraseña y con Google |
| Notificaciones externas | Bot de Telegram (opcional) |
| Integraciones de Google | Google Calendar API, Google Drive Picker, Google Identity Services |
| Reproductor de música | YouTube IFrame API (`youtube-nocookie.com`) |
| Tests | [Vitest](https://vitest.dev) |
| Integración continua | [GitHub Actions](https://github.com/features/actions) |
| Hosting objetivo | [Vercel](https://vercel.com) |

---

## 5. Arquitectura, en breve

- **Server Actions y Route Handlers de Next.js** hacen de backend — no hay un servidor separado ni una API REST tradicional.
- **Multi-organización real, no simulada**: cada tabla de datos tiene una `organizacion_id`, pero el aislamiento entre organizaciones lo aplica PostgreSQL mismo (RLS), no un `WHERE` a mano en cada consulta — así es imposible que un error de código exponga datos de otra organización. Está cubierto por un test automatizado (`db/tests/rls-aislamiento.test.ts`).
- **Todo el modelo de datos vive en `db/migrations/`** como SQL versionado, aplicado con un runner propio (`npm run db:migrate`).

```
/app
  /(auth)          login, registro, pendiente-de-aprobación
  /(app)           rutas protegidas: hoy, tablero, areas, cronograma,
                    calendario, coordinacion, informes, admin, perfil
  /api             route handlers: auth, calendar/events, health
/components
  /ui              componentes base de shadcn/ui
  /features        componentes de dominio (tareas, áreas, turnos, música...)
/lib               conexión a base de datos, RLS, logging, rate limiting...
/types             tipos de la base de datos
/db
  migrations/      esquema de la base de datos, versionado
/docs              documentación completa del proyecto
```

Para el detalle completo (modelo de datos tabla por tabla, convenciones de código, gotchas de shadcn/ui con Base UI en vez de Radix) ver [`docs/documentacion-tecnica.md`](docs/documentacion-tecnica.md).

---

## 6. Cómo se usa el sistema (guía rápida)

1. **Entrar**: con email/contraseña en `/login`, o con el botón "Continuar con Google". Si es tu primera vez, la cuenta se crea automáticamente en estado **pendiente** hasta que un administrador la active.
2. **Empezar el día por `/hoy`**: es la pantalla de inicio. Ahí ves tus tareas de hoy y las vencidas, marcás como hechas las que termines, y completás tu bitácora antes de irte.
3. **El trabajo del equipo vive en `/tablero`**: creá una tarea con título y área, arrastrala entre columnas a medida que avanza, y abrila para sumar detalle (fecha, responsable, subtareas, adjuntos).
4. **Mirá `/areas`** para ver el estado general de cada línea de trabajo, o `/cronograma` para saber quién está de turno.
5. Si sos **coordinador o administrador**, `/coordinacion` e `/informes` te dan la foto del equipo (carga de trabajo, avance, actividad), y `/admin` te deja gestionar usuarios y la configuración general.

Para el detalle pantalla por pantalla, con capturas de flujo, ver [`docs/manual-de-usuario.md`](docs/manual-de-usuario.md).

---

## 7. Cómo levantar el proyecto localmente

Pensado para quien va a desarrollar o probar el sistema, no solo usarlo.

### Requisitos

- [Node.js](https://nodejs.org) 22 o superior, y npm.
- [Docker](https://www.docker.com) (para levantar PostgreSQL local).

### Pasos

```bash
npm install
cp .env.example .env.local     # completar DATABASE_URL y AUTH_SECRET como mínimo
docker compose up -d           # levanta PostgreSQL 17 en localhost:5433
npm run db:migrate
npm run db:seed                # datos de prueba
npm run dev
```

La app queda en [http://localhost:3000](http://localhost:3000). Con el seed de prueba podés entrar con `admin@sae.test` / `password123` (también existen `coordinador@sae.test` y `miembro@sae.test`).

### Scripts disponibles

```bash
npm run dev            # servidor de desarrollo
npm run build           # build de producción
npm start                # servir el build de producción
npm run lint             # ESLint
npm run format           # Prettier (escribe)
npm run format:check     # Prettier (solo chequea)
npx tsc --noEmit          # chequeo de tipos
npm test                  # Vitest
npm run db:migrate        # aplicar migraciones pendientes
npm run db:seed           # cargar datos de prueba
```

Para instalar una instancia nueva (otra secretaría/regional) o desplegar a producción, ver [`docs/guia-instalacion.md`](docs/guia-instalacion.md).

---

## 8. Estado del proyecto

El sistema está en uso activo para la SAE de FRVM. Lo que sigue pendiente, en orden de impacto:

- **Despliegue a producción**: hoy todo corre local con Docker; falta elegir un proveedor de PostgreSQL gestionado y conectar el primer deploy real en Vercel.
- **Adjuntos**: por ahora son solo enlaces (a mano o elegidos desde Drive), no hay carga real de archivos al sistema.
- **Observabilidad**: hay un endpoint de salud (`/api/health`) y logging estructurado en los puntos sensibles de autenticación, pero falta una herramienta de trazas de errores (tipo Sentry).

El detalle completo, con todo lo ya resuelto y las decisiones de por qué, está en [`docs/documentacion-funcional.md`](docs/documentacion-funcional.md) (sección 6) y en [`docs/estado-del-proyecto.md`](docs/estado-del-proyecto.md).

---

## 9. Documentación adicional

- [`docs/contexto.md`](docs/contexto.md) — especificación de producto original.
- [`docs/planes_extraidos/plan-de-construccion.md`](docs/planes_extraidos/plan-de-construccion.md) — plan de trabajo por etapas/módulos.
- [`docs/estado-del-proyecto.md`](docs/estado-del-proyecto.md) — decisiones tomadas y cómo retomar el desarrollo.
- [`docs/manual-de-usuario.md`](docs/manual-de-usuario.md) — cómo usar cada pantalla, en detalle.
- [`docs/documentacion-tecnica.md`](docs/documentacion-tecnica.md) — arquitectura, modelo de datos y convenciones, para entender el repo desde cero.
- [`docs/guia-instalacion.md`](docs/guia-instalacion.md) — instalar una instancia nueva (otra regional/secretaría).
- [`docs/migracion-servidores-propios.md`](docs/migracion-servidores-propios.md) — mover la app a infraestructura propia.
- [`docs/credenciales-pendientes.md`](docs/credenciales-pendientes.md) — qué credenciales opcionales faltan cargar y dónde conseguirlas.

---

*SAE — Secretaría de Asuntos Estudiantiles, UTN Facultad Regional Villa María.*
