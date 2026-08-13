# SAE — Documentación funcional

> Este documento explica **qué es el sistema, para qué sirve cada sección y qué puede
> hacer un usuario hoy**, mirando el código tal como está implementado (no el plan
> original). Sirve como referencia para no re-explicar el sistema en cada conversación.
>
> Para otros ángulos ya documentados, ver:
> - [`contexto.md`](./contexto.md) — especificación de producto original (visión completa, incluye cosas aún no construidas).
> - [`estado-del-proyecto.md`](./estado-del-proyecto.md) — estado técnico/de implementación, decisiones de stack, checklist de despliegue.
> - [`planes_extraidos/plan-de-construccion.md`](./planes_extraidos/plan-de-construccion.md) — plan paso a paso original.
> - [`credenciales-pendientes.md`](./credenciales-pendientes.md) — qué credenciales faltan cargar (Google OAuth, Google Calendar) y dónde conseguirlas.
>
> Este archivo es el complemento **funcional**: qué existe, sección por sección, y qué
> puede hacer cada rol de usuario.

---

## 1. Qué es SAE

SAE (Sistema de Actividades Estudiantiles) es el panel operativo interno de la
Secretaría de Asuntos Estudiantiles de UTN FRVM. Reemplaza el uso de WhatsApp/planillas
sueltas para coordinar el trabajo del equipo: qué hay que hacer, quién lo hace, quién
está de turno y qué quedó pendiente cada día.

Es una app multi-organización (pensada para poder reutilizarse en otras secretarías/
regionales), pero hoy en la práctica corre para una sola organización: la SAE de FRVM.

**Principio central del diseño:** jerarquía plana. Solo dos niveles: **Área** (línea de
trabajo temática: Becas, Deportes, Salud, etc.) y **Tarea** (lo concreto a hacer dentro
de un área). Nada de sub-proyectos ni sprints.

---

## 2. Roles

Tres roles, controlan qué se ve en el sidebar y qué acciones están habilitadas:

| Rol | Qué puede hacer además de lo básico |
|---|---|
| **Miembro** | Ver su panel (`/hoy`), el tablero, cambiar el estado de sus propias tareas, comentar, cargar su bitácora diaria. Es el rol por defecto. |
| **Coordinador** | Todo lo del miembro + crear/asignar tareas a cualquiera, gestionar áreas y accesos rápidos, definir el cronograma de turnos, ver `/coordinacion` (reportes). |
| **Administrador** | Todo lo del coordinador + `/admin`: aprobar registros, cambiar roles, activar/desactivar usuarios, asignar tareas sin dueño. |

El rol determina qué ítems aparecen en el sidebar (`components/features/app-sidebar.tsx`)
y qué páginas redirigen si el usuario no tiene permiso (cada página valida el rol contra
la sesión al cargar).

---

## 3. Secciones del sistema

### 3.1 `/hoy` — Panel del día (pantalla de inicio)

Lo primero que ve cualquiera al entrar. Busca responder "¿qué tengo que hacer hoy?" sin
que el usuario tenga que ir a buscarlo.

- **Saludo con ícono** según la franja horaria (amanecer/sol/luna).
- **Última novedad**: banner discreto con la nota más reciente de `nota_area` de
  cualquier área de la organización (autor, área, cuándo) — para no tener que entrar a
  cada área a ver si hay algo nuevo. No aparece si todavía no hay ninguna nota cargada.
- **Vencidas**: tareas propias con fecha pasada, resaltadas en rojo — solo aparece si hay alguna.
- **Mis tareas de hoy**: tareas propias en progreso o con vencimiento hoy. Al dejarla en
  cero (se completó todo lo de hoy) tira un confetti como feedback — no vuelve a
  disparar solo por entrar a la página sin nada pendiente.
- **Próximamente**: tareas propias con vencimiento futuro (colapsable).
- **Bitácora del día**: campos "qué hice" / "qué quedó pendiente" / "observaciones". Se
  precarga automáticamente con los títulos de las tareas que el usuario completó ese día.
- **Música de la oficina**: reproductor compacto de una radio lofi (SomaFM) de fondo,
  sin autoplay — arranca pausado y no requiere ninguna cuenta. El audio pasa por
  `/api/radio-proxy` (nuestro servidor reenvía el stream) en vez de que el navegador
  apunte directo al proveedor externo — SomaFM devuelve 403 a pedidos que vienen de un
  navegador real, aunque el mismo pedido server-to-server funciona sin problema.
- **En la oficina ahora**: quién está de turno en este momento, calculado a partir del
  cronograma (`/cronograma`), y ya no cuenta a quien marcó ausencia.
- **Pulso del equipo**: contador de tareas abiertas / en progreso / completadas hoy, a
  nivel de toda la organización (no solo del usuario).
- **Accesos rápidos**: botones a URLs externas (Drive, Sheets, formularios) configurados
  desde `/admin`.

### 3.2 `/tablero` — Kanban

El lugar donde vive el trabajo día a día. Columnas fijas: **Por hacer · En progreso ·
Hecha** (a propósito no configurables — evita la complejidad tipo Jira).

- Tarjetas arrastrables entre columnas (drag-and-drop con `dnd-kit`). Las de prioridad
  alta (y no completadas) tienen un borde sutil para destacarlas de un vistazo.
- Filtros por área, responsable y estado.
- Cada tarjeta abre un panel lateral con: descripción, tipo (tarea/evento/entrega/
  reunión), prioridad, fecha de vencimiento, **repetición** (diaria/semanal/mensual),
  responsable, **horas estimadas/reales**, **subtareas** (checklist), **comentarios**,
  **adjuntos** (solo enlaces — Drive, links; no hay carga de archivos) y **historial de
  cambios** (quién cambió qué campo y cuándo, tabla `tarea_log`).
- **Tareas recurrentes**: si una tarea tiene repetición configurada (y fecha de
  vencimiento), al marcarla "Hecha" se clona automáticamente la siguiente ocurrencia en
  `por_hacer` con la fecha corrida (día, semana o mes). Cálculo al vuelo, no se generan
  instancias futuras por adelantado. Se identifican en el tablero con un ícono de
  repetición junto al título.
- Crear tarea en un paso: título + área. El resto es opcional.
- **Archivar**: en vez de borrar, las tareas se archivan (`archivada = true`). Preserva
  historial y métricas de `/coordinacion`. Hay una vista separada de tareas archivadas
  con opción de restaurar.

### 3.3 `/areas` y `/areas/[areaId]` — Áreas

Listado de las líneas de trabajo temáticas de la secretaría (color, responsable,
descripción, % de tareas completadas). Coordinadores/admins pueden crear, editar y
archivar áreas.

Al entrar a un área específica: sus tareas agrupadas por estado, sus **plantillas de
tareas** (un nombre + una lista de títulos reutilizable — para procesos que se repiten
como inscripciones o torneos; "Aplicar" clona esos títulos como tareas reales en
`por_hacer`), y una **bitácora de notas del área** (`nota_area`) — un registro de
novedades/observaciones libres, separado de las tareas puntuales, para dejar contexto que
no encaja en una tarea concreta.

### 3.4 `/cronograma` — Turnos del equipo

Grilla semanal (lunes a viernes) mostrando quién cubre cada franja horaria. Los turnos
tienen `vigente_desde`/`vigente_hasta`: cuando alguien deja el equipo, el turno se
**cierra**, no se borra — así el histórico de coordinación de meses anteriores sigue
siendo correcto. Coordinadores/admins editan; miembros ven en solo lectura. Este cronograma
alimenta el bloque "En la oficina ahora" de `/hoy`.

**Ausencias**: cualquiera puede marcar su propia ausencia (o un cambio de turno);
coordinador/admin pueden marcar la de cualquiera. El bloque afectado se ve atenuado con
borde punteado ese día, y tanto "En la oficina ahora" (cronograma) como "En la oficina
ahora" de `/hoy` dejan de contar a quien está ausente.

### 3.5 `/calendario` — Calendario

Vista mensual que combina dos fuentes en un mismo grid:
- Tareas del sistema con fecha de vencimiento.
- Eventos de un calendario público de Google Calendar, traídos por API Key (solo
  lectura — ver sección de pendientes).

### 3.6 `/coordinacion` — Reportes (coordinador/admin)

Vista de métricas para quien coordina el equipo, no para uso diario:
- Totales globales (abiertas, completadas, en progreso, vencidas).
- Las 5 tareas abiertas más antiguas sin resolver.
- Carga de trabajo por persona (abiertas, vencidas, hechas, promedio de días para
  completar).
- Avance por área con la misma métrica.
- **Precisión de estimación**: promedio de horas estimadas vs. horas reales, sobre las
  tareas que tienen ambos datos cargados — solo aparece cuando hay al menos una.

### 3.7 `/admin` — Administración (solo administrador)

- **Usuarios**: aprobar registros pendientes, cambiar rol, activar/desactivar cuentas.
- **Asignar tareas**: listado de tareas abiertas sin dueño (o para reasignar) con un
  selector de responsable.
- **Accesos rápidos**: alta/baja de los enlaces que aparecen en `/hoy` para todo el equipo.
- **Google Calendar**: panel de estado (conectado / sin configurar) con instrucciones de
  cómo generar la API Key.

### 3.8 `/perfil`

Datos básicos del usuario logueado (nombre, email, rol). Sin edición de datos sensibles.

### 3.9 Elementos transversales (en el header, en todas las páginas)

- **Búsqueda global** (`Cmd/Ctrl+K`): busca tareas y áreas por texto, navega directo al
  resultado. También ofrece **acciones rápidas** (nueva tarea, ir a la bitácora de hoy,
  cronograma, coordinación/admin según el rol) que aparecen filtradas por lo que se
  escribe, igual que los resultados de búsqueda.
- **Notificaciones**: campana con no-leídas. Se generan al asignar una tarea a alguien o
  al comentar en una tarea de la que alguien es responsable. Polling cada 3 min (más
  refresco al volver a la pestaña y al abrir el panel) — no push/websocket. Las mismas
  dos acciones también mandan un aviso al grupo de Telegram del equipo, si está
  configurado.
- **Modo oscuro por defecto**: toda la app arranca en oscuro (`next-themes`); hay un
  botón sol/luna en el header para cambiar a claro, y la preferencia queda guardada.

---

## 4. Cómo se hace seguimiento (tracking)

El sistema tiene varias capas de seguimiento, cada una con un propósito distinto:

1. **Estado de la tarea** (`por_hacer → en_progreso → hecha`) — el seguimiento más
   básico, visible en el tablero y en `/hoy`.
2. **Historial por tarea** (`tarea_log`) — cada cambio de campo relevante queda
   registrado con quién y cuándo, visible en el panel lateral de la tarea.
3. **Bitácora diaria por persona** (`bitacora_diaria`) — registro manual de "qué hice /
   qué quedó pendiente / observaciones", uno por usuario y por día. Se prellena sola con
   tareas completadas, subtareas resueltas y comentarios dejados ese día, para no
   reescribir a mano lo que ya quedó registrado en otro lado.
4. **Bitácora de notas por área** (`nota_area`) — novedades a nivel de área, no atadas a
   una tarea puntual.
5. **Archivado, no borrado** — tanto tareas como áreas se archivan en vez de eliminarse,
   para no perder el histórico que alimenta los reportes.
6. **Duración estimada vs. real** — campo opcional por tarea; agregado (promedio) en el
   panel de coordinación como una señal temprana de sub/sobre-estimación de carga.
7. **Excepciones de turno** (`excepcion_turno`) — quedan registradas las ausencias y
   cambios de turno, así el cronograma y "En la oficina ahora" no dan falsos positivos.
8. **Panel de coordinación** — agrega todo lo anterior en métricas: carga por persona,
   avance por área, antigüedad de tareas sin resolver, precisión de estimación.

---

## 5. Acceso y autenticación

- **Login con email/contraseña** (Auth.js Credentials + `bcryptjs`), con rate limiting
  básico por IP y por email (`lib/rate-limit.ts`).
- **Registro abierto pero con aprobación**: cualquiera puede crear una cuenta, pero queda
  en estado `pendiente` hasta que un administrador la activa y le asigna un rol
  (`/pendiente-de-aprobacion`).
- **Botón "Continuar con Google"**: conectado y probado en este entorno (proyecto
  "SAE-Sistema" en Google Cloud) — ver sección 6 para el detalle de configuración.

---

## 6. Pendiente / no implementado todavía

En orden de lo que más se nota al usar el sistema:

- ~~Login con Google sin credenciales~~ — **resuelto en este entorno**: proyecto
  "SAE-Sistema" creado en Google Cloud, pantalla de consentimiento OAuth configurada
  (modo Externo/Prueba) y `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` cargados en
  `.env.local`. Verificado end-to-end: alta automática en `pendiente`, activación manual
  y login exitoso a `/hoy`. Mientras la app quede en modo "Prueba", cada persona que se
  quiera loguear con Google tiene que estar agregada a mano como "usuario de prueba" en
  Google Auth Platform → Público — o hay que publicar la app (ver
  `docs/credenciales-pendientes.md`).
- ~~Google Calendar sin configurar~~ — **resuelto en este entorno**: `GOOGLE_CALENDAR_API_KEY`
  y `GOOGLE_CALENDAR_ID` cargados y verificados, `/calendario` ya trae los eventos reales
  del calendario "💙 SAE UTN" en vez de los de ejemplo. Sigue pendiente de la visión
  original:
  - Escritura hacia Calendar: crear un evento de Google al ponerle fecha a una tarea
    (existe la columna `tarea.google_event_id` en el esquema, pero no se usa en ningún
    lugar del código todavía).
  - Autenticación por OAuth de la organización en vez de API Key pública.
- ~~Tareas recurrentes sin usar~~ — **resuelto**: ver sección 3.2. Queda como
  simplificación consciente que no generamos instancias futuras por adelantado (cálculo
  al vuelo, una a la vez, al completar la anterior).
- **Adjuntos son solo enlaces**, no hay carga real de archivos (a propósito, por ahora).
- **Notificaciones**: in-app (polling de 3 min + refresco al volver a la pestaña) +
  **Telegram opcional** (`lib/telegram.ts` — un mensaje al grupo del equipo al asignar
  una tarea o comentar; requiere `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`, ver
  `credenciales-pendientes.md`). Sigue sin haber canal de email.
- ~~Aislamiento multi-organización sin validar en la práctica~~ — **resuelto**: hay un
  test automatizado (`db/tests/rls-aislamiento.test.ts`, `npm test`) que crea dos
  organizaciones de prueba y verifica que RLS bloquea lectura y escritura cruzada.
- **Despliegue (M0.4)**: falta elegir proveedor de Postgres gestionado (Vercel ya no
  ofrece Postgres propio, se provisiona vía Marketplace: Neon, Supabase Cloud, etc.) y
  hacer el primer deploy real. Hoy todo corre local con Docker.
- **Tests automatizados: arrancaron, pero son mínimos.** Hay `vitest` configurado
  (`npm test`) y un test de aislamiento RLS — nada de UI ni de los demás flujos.
- ~~Sin CI~~ — **resuelto**: `.github/workflows/ci.yml` corre en cada push/PR a `main`
  (lint, chequeo de tipos, migraciones contra un Postgres de servicio, tests y build).
  Sigue sin haber deploy automático — este CI valida, no despliega.
- **Observabilidad: parcial.** Hay `/api/health` (sin auth, para monitoreo externo —
  confirma que el proceso responde y que la base es alcanzable) y `lib/logger.ts`
  (logging estructurado en JSON, sin dependencias) conectado en los puntos más
  sensibles de auth (`auth.ts`: alta automática por Google, logins bloqueados). Falta
  Sentry (o similar) para trazas de errores con stack completo y alertas — necesita un
  DSN, se documenta en `credenciales-pendientes.md` cuando se decida sumarlo.
- ~~Sin headers de seguridad~~ — **resuelto**: `next.config.ts` ahora manda CSP (sin
  nonces — ver comentario en el archivo), `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy` y HSTS en producción.
- **Rediseño visual (idea 8) — parcial a propósito, sin navegador real en ningún
  momento de esta sesión.** Lo implementado se limitó a cosas verificables por lógica/
  datos en vez de por ojo: modo oscuro por defecto, confetti al completar las tareas del
  día, widget de música, saludo con ícono según franja horaria, banner de "última
  novedad" (dato real de `nota_area`, no una frase decorativa), borde sutil en tarjetas
  de prioridad alta, y una transición suave (`framer-motion`) al completar tareas en
  `/hoy` — deliberadamente **no** se tocó el tablero Kanban con animaciones para no
  arriesgar interferencia con el drag-and-drop de `dnd-kit`. Lo que sigue pendiente por
  ser más una decisión de gusto que de lógica: glow/neumorfismo más marcado, y cualquier
  ajuste de paleta/espaciado que solo se pueda evaluar mirando la pantalla.

## 7 . Correcciones a lo realizado y mejoras por hacer.
Analizando en detalle la arquitectura funcional, el modelo de datos y las limitaciones documentadas de **SAE**, el diseño general es sólido y está bien enfocado: eliminar fricciones, evitar costos por asiento (*per-seat pricing*) de herramientas comerciales como Jira/Asana y mantener la jerarquía simple (Área → Tarea).

A continuación, presento un análisis crítico dividido en **vulnerabilidades y fallos operativos de alta prioridad**, **cuellos de botella del diseño**, e **ideas para potenciar el sistema**.

### 1. Crítica de alta prioridad: Riesgos y fallos funcionales

#### 1.1. Incompatibilidad de autenticación (Login con Google vs. Credentials)

* **El problema:** La mezcla entre `Credentials` (registro con aprobación) y OAuth de Google sin un adaptador o callback de `signIn`/`jwt` es una brecha funcional severa. Si un usuario inicia sesión con Google usando un correo no registrado previamente, se generará una sesión huérfana (sin `organizacion_id` ni `rol`), o la aplicación fallará al intentar acceder a rutas protegidas que asumen la presencia de un rol.


* **Solución:** Implementar un callback en Auth.js (`signIn` / `jwt`) que consulte la tabla `usuario` por email. Si no existe, crear el registro automático con estado `pendiente` y redirigir a `/pendiente-de-aprobacion`. Si existe pero sigue `pendiente`, denegar el acceso.

#### 1.2. Ineficiencia e impacto del Polling para Notificaciones (30s)

* **El problema:** El polling HTTP constante cada 30 segundos genera peticiones innecesarias a la base de datos. En un servidor local o instancia modesta de PostgreSQL, esto desperdicia recursos y consume ancho de banda en clientes móviles.


* **Solución:** Reemplazar el polling por **Server-Sent Events (SSE)** o una conexión WebSockets ligera (por ejemplo, Supabase Realtime si se usa Supabase, o una ruta de API SSE en Next.js). Si no se quiere sumar infraestructura, cambiar el mecanismo a un aviso bajo demanda al cambiar de página o incrementar la frecuencia de polling a 2-3 minutos.

#### 1.3. Multi-tenancy (RLS + `organizacion_id`) sin pruebas de aislamiento

* **El problema:** El aislamiento multi-inquilino (*multi-tenancy*) es una de las áreas con mayor riesgo de filtración de datos si no se valida mediante pruebas de integración automatizadas.
* **Solución:** Antes de pasar a producción, escribir pruebas (ej. con Vitest o Jest) que intenten acceder a tareas de la Organización B utilizando la sesión de un usuario de la Organización A, verificando que la base de datos o el ORM bloqueen la consulta correctamente.

---

### 2. Crítica al diseño y la usabilidad (Cuellos de botella)

#### 2.1. Gestión de disponibilidad vs. Cronograma rígido

* **Observación:** El cronograma actual gestiona franjas horarias fijas por semana (`/cronograma`). Sin embargo, en entornos educativos u operativos reales existen excepciones frecuentes (parciales, finales, licencias médicas, feriados).


* **Mejora:** Agregar una tabla de `excepciones_turno` (fecha, usuario, tipo: *ausencia / cambio de turno*) para que la sección **"En la oficina ahora"** de `/hoy` no reporte falsos positivos cuando alguien falta a su turno habitual.

#### 2.2. Bitácora diaria aislada de la gestión del trabajo

* **Observación:** La bitácora en `/hoy` precarga los títulos de las tareas completadas, pero si un usuario avanzó en una tarea sin completarla, debe reescribir manualmente qué hizo.


* **Mejora:** Permitir que los comentarios en las tareas o el cambio de subtareas (checklist) alimenten automáticamente la bitácora del día, reduciendo la redundancia de carga.

#### 2.3. Ausencia de notificaciones fuera de la app

* **Observación:** Al depender únicamente de notificaciones *in-app*, los usuarios que no tienen la pestaña abierta no se enterarán de asignaciones urgentes o menciones en comentarios.


* **Mejora:** Integrar un bot sencillo de **Telegram** o webhook a **WhatsApp/Email**. Telegram permite crear bots con `node-telegram-bot-api` sin costo en minutos, ideal para alertar cuando a un usuario le asignan una tarea vencida o de prioridad alta.

---

### 3. Oportunidades y funciones a agregar

1. **Campos de tiempo estimado vs. tiempo real (*Time Tracking* liviano):**
Sin caer en métricas invasivas, agregar dos campos a las tareas: `duracion_estimada_hs` y `duracion_real_hs`. Esto mejorará exponencialmente los reportes de `/coordinacion` para saber si se está subestimando la carga de trabajo.


2. **Carga rápida con Comandos (Kbar / Command Palette):**
Ya cuentan con búsqueda global (`Cmd+K`). Podrían expandir su uso para permitir acciones rápidas directamente desde el teclado: *"Crear tarea en Becas"*, *"Cargar bitácora hoy"*, *"Ver mis vencidas"*.


3. **Checklists y Plantillas de tareas para eventos recurrentes:**
En una secretaría estudiantil hay eventos o procesos institucionales que se repiten año a año (inscripción a becas, torneos, campañas de salud). En lugar de solo implementar tareas recurrentes por tiempo, es muy útil contar con **Plantillas de Área** (ej. "Organización de Torneo") que clonen un conjunto de tareas y subtareas predefinidas.

---

### 4. Checklist sugerido para Salida a Producción (Deployment)

1. **Base de Datos:** Provisionar una instancia gestionada (Neon Postgres o Supabase) con soporte para RLS y conexiones agrupadas (*connection pooling* como PgBouncer).
2. **Seguridad en la Web:** Añadir middleware o configuración en `next.config.ts` para incluir cabeceras de seguridad fundamentales (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`).
3. **Manejo de Errores e Integridad:**
* Configurar **Sentry** (plan gratuito) o un logger simple para no perder de vista los errores en tiempo de ejecución.
* Crear scripts de migración y respaldos (*backups*) automatizados de la base de datos.
---

# 8 . Idea de diseño y reproductor de musica.
Para un panel operativo interno como SAE que el equipo va a usar durante horas todos los días, la estética y la experiencia diaria son clave para evitar la fatiga visual y la monotonía.

Aquí tienes recomendaciones específicas de **diseño estético para dashboards de uso diario** y la **arquitectura técnica para integrar reproductores de música**.

---

### 1. Recomendaciones de Diseño Estético (Dashboards de Alto Uso)

Para que el panel no se sienta aburrido ni "corporativo plano", pero siga siendo funcional y cómodo para trabajar 8 horas seguidas:

#### A. Paleta y Atmósfera (Dark / Slate Minimalista con Accent Colors)

* **Dark / Dimmed Mode por defecto:** Los fondos oscuros o gris pizarra (*Dark Slate* / *Zinc-900*) reducen el cansancio visual drásticamente en comparación con pantallas blancas brillantes.
* **Acentos vivos por Área:** Utiliza el color de cada Área (Becas, Deportes, Salud) como **color de acento** en bordes finos, etiquetas o indicadores visuales. Esto rompe la monotonía visual y ayuda a identificar áreas rápidamente de un vistazo sin recargar la pantalla.
* **Glow subtle / Neumorfismo suave en elementos interactivos:** Aplica efectos de brillo tenue (*soft glow* o `box-shadow` suave) en elementos interactivos activos o tareas de alta prioridad para darle una sensación moderna estilo "control center" o "HUD".

#### B. Componentes Dinámicos y Microinteracciones

* **Sensación de "Sistema Vivo":** Agrega pequeñas microinteracciones y animaciones sutiles (usando `framer-motion` en Next.js):
* Animaciones al mover tarjetas Kanban o marcar tareas como completadas en `/hoy`.
* Efecto de "confeti" o feedback visual gratificante al completar la bitácora del día o liquidar todas las tareas pendientes.


* **Widgets informativos livianos en `/hoy`:**
* **Frase / Novedad del día:** Un banner superior discreto con mensajes del equipo o estados breves.
* **Saludo adaptativo:** Cambiar la bienvenida según la hora (*"Buenos días, Felipe"*, *"Buena jornada de tarde"*) acompañado de un ícono de clima o estado.



---

### 2. Integración de Música en la Pantalla `/hoy`

Integrar un widget de reproductor de música (*Now Playing*) en la pantalla principal del día es una excelente función para humanizar la herramienta y darle un toque dinámico.

#### Opciones de Integración:

#### Opción A: Spotify Web API (Recomendada si el equipo usa Spotify)

Permite mostrar la canción actual, pausar, reproducir y pasar de pista directamente desde la interfaz de SAE.

* **Cómo funciona:**
1. Registras una aplicación en el **Spotify Developer Dashboard** para obtener un `CLIENT_ID` y `CLIENT_SECRET`.
2. Implementas el flujo OAuth 2.0 (o autenticación con Refresh Token para una cuenta de la oficina/secretaría si todos comparten la misma lista).
3. Utilizas los endpoints de la API de Spotify:
* `GET /v1/me/player/currently-playing` — Para obtener el nombre de la canción, artista, carátula y progreso.
* `POST /v1/me/player/next` — Para pasar al siguiente tema.
* `PUT /v1/me/player/play` y `PUT /v1/me/player/pause` — Para pausar y reproducir.




* **Requisito técnico:** Para controlar la reproducción (cambiar de tema, pausar), la cuenta conectada debe ser **Spotify Premium**. Si solo deseas mostrar la canción que está sonando sin controles, funciona con cuentas gratuitas.

#### Opción B: YouTube Music / Apple Music / Embeds de Terceros

* **Spotify Embed Widget / Apple Music Web Player:** Puedes incrustar un `<iframe>` estándar del reproductor Web de Spotify o Apple Music. Es una solución rápida que no requiere desarrollo de API backend, aunque estéticamente es menos personalizable que construir tu propio widget de UI adaptado al tema oscuro de SAE.

#### Opción C: Integración Local de Radio Web / Lofi Streams

* Si la secretaría no quiere depender de cuentas individuales de Spotify, puedes incorporar un reproductor de audio directo en HTML5 (`<audio>`) que sintonice un streaming continuo de música de fondo (ej. radio Lofi o listas públicas de audio libre de copyright).

---

### 3. Propuesta de UI para el Widget de Música en `/hoy`

Para integrar el reproductor en el panel del día sin que robe espacio de trabajo:

1. **Ubicación:** Un mini-widget compacto en la barra lateral o en la esquina superior derecha de `/hoy` (junto al "En la oficina ahora").
2. **Visualización:**
* Muestra la carátula (*album art*) pequeña en miniatura.
* Nombre de la canción y artista con un efecto de desplazamiento continuo si el texto es muy largo (*marquee effect*).
* Barra de progreso de la canción con animación suave.
* Controles flotantes mínimos: `[ Anterior ]` `[ Play / Pause ]` `[ Siguiente ]`.


3. **Modo Minimizante / Colapsable:** Permitir colapsar el widget a solo un ícono pulsante con la nota musical cuando el usuario necesite máxima concentración.