# Sistema de Gestión de Actividades para Secretarías — Especificación

> Documento vivo. Versión 1.0 — base para arrancar el desarrollo.

---

## 1. Contexto y problema

La Secretaría de Asuntos Estudiantiles (SAE) de UTN FRVM trabaja con:

- **Múltiples proyectos simultáneos** en distintas áreas temáticas (becas, deportes, salud, tutorías, etc.).
- **Un equipo rotativo**: las personas entran y salen con el paso del tiempo, y cada una cubre rangos horarios distintos.
- **Sin sistema de gestión propio**: las herramientas comerciales son costosas y muchas no se integran con lo que ya se usa (Google Workspace, Drive, Calendar).

El resultado es que no hay un lugar único donde ver *qué hay que hacer hoy, quién lo hace y qué quedó pendiente*.

### Objetivo

Construir una aplicación web propia, simple, que funcione como **panel operativo diario** de la secretaría: tareas, responsables, cronograma y calendario en un solo lugar.

### Objetivo secundario (importante para el diseño)

El sistema debe poder **replicarse en otras secretarías de otras regionales de UTN**. Esto no cambia el MVP, pero sí obliga a una decisión estructural desde el día uno: **multi-organización nativa** (ver sección 4).

---

## 2. Principios de diseño

Estos principios son la guía para resolver cualquier duda de producto durante el desarrollo.

1. **Simplicidad por encima de completitud.** Si una función requiere explicación, está mal diseñada. El usuario objetivo no es técnico.
2. **Jerarquía plana.** Nada de Epic → Historia → Subtarea. Solo dos niveles: **Área** y **Tarea**.
3. **El día de hoy es la pantalla principal.** Todo lo demás es secundario.
4. **Configurable, no hardcodeado.** Áreas, roles, horarios y accesos se cargan desde la interfaz, no desde el código. Es lo que permite que otra secretaría lo use sin tocar nada.
5. **Integrar, no reemplazar.** Google Calendar y Drive siguen siendo la fuente de verdad para eventos y documentos. La app los muestra y los enlaza.

---

## 3. Roles y permisos

Tres roles, sin más:

| Rol | Quién es | Qué puede hacer |
|---|---|---|
| **Miembro** | Cualquier persona del equipo | Ver su panel, ver el tablero, cambiar el estado de sus tareas, cargar su bitácora diaria, comentar |
| **Coordinador** | Secretario y quien él designe | Todo lo del miembro + crear/asignar tareas a cualquiera, gestionar áreas, definir el cronograma semanal, ver reportes |
| **Administrador** | Responsable técnico | Todo lo anterior + gestionar usuarios, aprobar registros, configurar la organización e integraciones |

### Registro

Registro abierto por email, pero con **estado pendiente**: el usuario se registra y queda inactivo hasta que un coordinador lo aprueba y le asigna un rol. Esto evita que cualquiera con el link entre al tablero interno.

---

## 4. Arquitectura multi-organización

Cada secretaría es una **organización** (tenant). Todos los datos cuelgan de un `organizacion_id`.

- Un usuario pertenece a una organización (con posibilidad futura de pertenecer a varias).
- Áreas, tareas, horarios y accesos rápidos son propios de cada organización.
- El aislamiento se garantiza con **Row Level Security de Supabase**: cada consulta filtra automáticamente por la organización del usuario autenticado.

Costo de hacerlo ahora: una columna extra y unas políticas de RLS. Costo de hacerlo después: reescribir el modelo de datos entero.

---

## 5. Modelo de datos

```
organizacion
  id, nombre, slug, logo_url, zona_horaria, creada_en

usuario  (extiende auth.users de Supabase)
  id, organizacion_id, nombre, email, avatar_url,
  rol (miembro | coordinador | administrador),
  estado (pendiente | activo | inactivo)

area                      -- reemplaza al "Epic" de Jira
  id, organizacion_id, nombre, color, descripcion,
  responsable_id (opcional), activa

tarea
  id, organizacion_id, area_id,
  titulo, descripcion,
  responsable_id (nullable),
  estado (por_hacer | en_progreso | hecha),
  prioridad (baja | media | alta),
  fecha_vencimiento (nullable),
  recurrencia (nullable: diaria | semanal | mensual + config),
  google_event_id (nullable),
  creada_por, creada_en, completada_en, orden

comentario
  id, tarea_id, autor_id, contenido, creado_en

adjunto
  id, tarea_id, nombre, tipo (archivo | enlace),
  url, subido_por, creado_en

acceso_rapido            -- los "botones" a carpetas y sistemas
  id, organizacion_id, area_id (nullable),
  etiqueta, url, icono, orden

turno                    -- cronograma semanal
  id, organizacion_id, usuario_id,
  dia_semana (0-6), hora_inicio, hora_fin,
  vigente_desde, vigente_hasta (nullable)

bitacora_diaria          -- el "qué hice hoy"
  id, organizacion_id, usuario_id, fecha,
  hecho, pendiente, observaciones, creada_en
```

### Nota sobre `turno`

Los campos `vigente_desde` / `vigente_hasta` son la respuesta directa a que **el equipo varía con el tiempo**: un turno no se borra cuando alguien deja el equipo, se cierra. Así el histórico queda intacto y los reportes de meses anteriores siguen siendo correctos.

---

## 6. Módulos

### 6.1 Panel del día *(pantalla de inicio)*

Lo primero que ve cualquier persona al entrar:

- Fecha, saludo, y **quién está de turno ahora mismo**.
- **Mis tareas de hoy**: lista con checkbox para marcar como hecha.
- **Vencen esta semana**: las próximas, sin agobiar.
- **Eventos de hoy** traídos de Google Calendar.
- **Accesos rápidos**: los botones a carpetas de Drive y sistemas externos.
- **Bitácora del día**: dos campos de texto ("qué hice" / "qué quedó pendiente") que se cargan al cerrar la jornada.

### 6.2 Tablero Kanban

- Columnas fijas: **Por hacer · En progreso · Hecha**.
- Tarjetas arrastrables entre columnas (drag and drop).
- Filtros por área, por responsable y por vencimiento.
- Crear tarea desde el tablero en un paso: título + área + responsable. Todo lo demás es opcional.

**Decisión clave:** las columnas son fijas y no configurables. Es una restricción a propósito — la configurabilidad de flujos es exactamente lo que vuelve incomprensible a Jira.

### 6.3 Cronograma semanal

- Grilla de lunes a viernes por franja horaria.
- Cada bloque muestra quién cubre ese rango.
- El coordinador edita arrastrando o desde un formulario simple.
- Vista de solo lectura para los miembros.

### 6.4 Calendario

- Vista mensual y semanal.
- Muestra tareas con fecha de vencimiento **y** eventos de Google Calendar juntos.
- Crear una tarea con fecha genera opcionalmente el evento en el calendario compartido de la secretaría.

### 6.5 Áreas

- Listado de las áreas temáticas de la secretaría, con color y responsable.
- Al entrar a un área: sus tareas, sus documentos y sus accesos rápidos.
- Se cargan desde la interfaz. Para SAE FRVM el punto de partida son las 13 ya definidas (Becas, Deportes, Visitas, Seminario de Ingreso, Salud, Charlas y Capacitaciones, Residencias, Viajes, UTN Corre, Tutorías, Relaciones Internacionales, Género, Discapacidad).

### 6.6 Panel del coordinador

- Resumen: tareas completadas vs. pendientes en el período.
- Carga por persona y por área.
- Tareas vencidas y tareas sin responsable asignado.
- Bitácoras diarias del equipo, agrupadas por fecha.

### 6.7 Administración

- Aprobar registros pendientes y asignar roles.
- Gestionar áreas y accesos rápidos.
- Configurar la organización (nombre, logo, zona horaria).
- Conectar la cuenta de Google.

---

## 7. Integración con Google

### Calendar

- OAuth 2.0 a nivel organización (una cuenta de servicio o la cuenta institucional de la secretaría), no por usuario. Simplifica muchísimo el alta de gente nueva.
- Lectura: los eventos del calendario se muestran en el panel y en el calendario de la app.
- Escritura: las tareas con fecha pueden crear un evento; se guarda el `google_event_id` para mantenerlos sincronizados.
- Sincronización incremental con `syncToken`, no polling completo.

### Drive

Para el MVP, **enlaces, no integración**. Los accesos rápidos y los adjuntos son URLs a carpetas y archivos de Drive. Es el 90% del valor con el 10% del trabajo. La integración real con la API de Drive (buscador de archivos embebido) queda para una fase posterior.

---

## 8. Stack técnico

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | **Next.js** (App Router) + TypeScript | Ya está en tu stack |
| Estilos | Tailwind + shadcn/ui | Componentes listos, se ve prolijo sin diseñar desde cero |
| Backend / DB | **Supabase** (Postgres + Auth + Storage + RLS) | Auth y multi-tenancy resueltos de fábrica |
| Kanban | dnd-kit | Liviano y mantenido |
| Calendario | FullCalendar o react-big-calendar | — |
| Deploy | Vercel (app) + Supabase (datos) | Gratis en la escala inicial |

### Sobre la migración futura a servidores de la facultad

Supabase es Postgres estándar y su stack es open source y auto-hospedable. Si más adelante hay que mover todo a infraestructura de UTN, es un `pg_dump` y levantar Supabase self-hosted con Docker. **Recomendación:** mantener toda la lógica de negocio en la app y no en Edge Functions propietarias, para que la migración sea trivial.

---

## 9. Fases de desarrollo

### Fase 1 — Núcleo *(objetivo: usarlo de verdad en la secretaría)*

1. Setup del proyecto, Supabase, esquema y RLS
2. Auth: registro, login, aprobación de usuarios, roles
3. CRUD de áreas
4. CRUD de tareas + tablero Kanban con drag and drop
5. Panel del día
6. Accesos rápidos

Al terminar esta fase el sistema ya reemplaza al setup de Jira + Notion.

### Fase 2 — Operación diaria

7. Cronograma semanal de turnos
8. Bitácora diaria
9. Integración de lectura con Google Calendar
10. Comentarios y adjuntos por enlace

### Fase 3 — Coordinación

11. Panel del coordinador con métricas
12. Escritura hacia Google Calendar
13. Tareas recurrentes
14. Notificaciones (email o Telegram)

### Fase 4 — Producto

15. Onboarding de nuevas organizaciones autogestionado
16. Personalización de marca por secretaría
17. Integración real con Drive
18. Documentación de instalación para otras regionales

---

## 10. Decisiones pendientes

- **Nombre del sistema.** Conviene que sea genérico y no atado a SAE ni a FRVM, dado el objetivo de replicarlo.
- **Idioma de la interfaz.** Español, ¿pero preparado para i18n desde el inicio?
- **Notificaciones.** ¿Email institucional, o algo más inmediato como un bot de Telegram? El equipo probablemente responda mucho mejor a lo segundo.
- **Cuenta de Google.** ¿Existe una cuenta institucional de la secretaría a la que se pueda vincular la app, o hay que crearla?
- **Tareas recurrentes.** ¿Generación anticipada de instancias, o cálculo al vuelo? Afecta al modelo de datos, conviene decidirlo antes de la Fase 3.

---

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| El equipo no adopta la herramienta y vuelve a WhatsApp | La app tiene que ser más rápida que WhatsApp para lo cotidiano. El panel del día debe cargar en menos de un segundo y marcar una tarea debe ser un clic. |
| Sobre-ingeniería por pensar en las otras regionales | Multi-tenancy sí desde el día uno (es barato). Todo lo demás, resolverlo para SAE FRVM y generalizar después con casos reales. |
| Continuidad del proyecto | Documentar en el repositorio desde el principio y evitar dependencias exóticas. |
| Datos personales del equipo | Definir qué se guarda y por cuánto tiempo antes de escalar a otras secretarías. |
