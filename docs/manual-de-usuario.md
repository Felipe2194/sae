# SAE — Manual de usuario

> Guía práctica de "cómo hacer X" para quien usa el sistema día a día. Para el
> detalle técnico de cómo está construido, ver
> [`documentacion-tecnica.md`](./documentacion-tecnica.md); para qué falta o
> quedó afuera a propósito, ver la sección 6 de
> [`documentacion-funcional.md`](./documentacion-funcional.md).

---

## 1. Qué es SAE

SAE (Sistema de Actividades Estudiantiles) es el panel operativo interno de
la Secretaría de Asuntos Estudiantiles de UTN FRVM. Reemplaza WhatsApp y
planillas sueltas para coordinar el trabajo del equipo: qué hay que hacer,
quién lo hace, quién está de turno y qué quedó pendiente cada día.

Todo se organiza en dos niveles nada más: **Área** (una línea de trabajo,
como Becas o Deportes) y **Tarea** (algo concreto para hacer dentro de un
área). No hay sub-proyectos ni sprints.

## 2. Ingresar al sistema

- **Con email y contraseña**: entrá a `/login` con las credenciales que te
  dieron. Si todavía no tenés cuenta, andá a `/registro` — queda pendiente
  de aprobación hasta que un administrador te active.
- **Con Google**: botón "Continuar con Google" en `/login`. Si es tu primera
  vez, se crea la cuenta automáticamente en estado pendiente, igual que el
  registro manual.
- Mientras tu cuenta esté **pendiente de aprobación**, vas a ver una pantalla
  de espera al intentar entrar — avisale a un administrador para que te
  active.

## 3. Roles: qué puede hacer cada uno

| Rol | Qué puede hacer |
|---|---|
| **Miembro** (por defecto) | Ver `/hoy`, usar el tablero, cambiar el estado de sus propias tareas, comentar, cargar su bitácora diaria. |
| **Coordinador** | Todo lo del miembro + crear/asignar tareas a cualquiera, gestionar áreas y accesos rápidos, armar el cronograma de turnos, ver `/coordinacion` e `/informes`. |
| **Administrador** | Todo lo del coordinador + `/admin`: aprobar registros, cambiar roles, activar/desactivar cuentas, asignar tareas sin dueño, y ahora también configurar nombre/logo/color/zona horaria de la organización. |

El sidebar solo muestra las secciones a las que tenés acceso.

## 4. `/hoy` — tu pantalla de inicio

Responde "¿qué tengo que hacer hoy?" sin que tengas que ir a buscarlo:

- **Vencidas** (en rojo, si tenés alguna) y **tareas de hoy**: marcalas como
  hechas con un clic desde acá mismo. Cuando llegás a cero, hay un pequeño
  confetti de feedback.
- **Próximamente**: lo que viene, colapsado por defecto.
- **Bitácora del día**: contá qué hiciste, qué quedó pendiente y
  observaciones. Se precarga sola con lo que ya completaste ese día, para
  que no tengas que reescribirlo.
- **Música de la oficina**: un reproductor de YouTube de fondo. Podés elegir
  entre la playlist de la organización o la tuya propia (configurable en
  `/perfil`).
- **En la oficina ahora**: quién está de turno en este momento, según el
  cronograma.
- **Accesos rápidos**: enlaces a Drive, planillas y formularios que usa el
  equipo seguido.

## 5. `/tablero` — el trabajo del día a día

Kanban con tres columnas fijas: **Por hacer · En progreso · Hecha**.

- **Crear una tarea**: título + área, nada más — el resto lo completás
  después si hace falta.
- **Arrastrá** una tarjeta entre columnas para cambiar su estado.
- **Abrí una tarjeta** (clic) para ver o editar: descripción, tipo,
  prioridad, fecha de vencimiento, repetición, responsable, horas
  estimadas/reales, subtareas, comentarios, adjuntos e historial de cambios.
- **Adjuntar un archivo**: desde el panel de la tarea, "Enlace" para pegar
  una URL a mano, o el botón "Drive" para elegirlo directamente desde tu
  Google Drive (si está configurado — si no aparece, es que falta esa
  credencial, seguís pudiendo usar "Enlace"). Los adjuntos de Drive muestran
  un botón "Ver" con una vista previa embebida.
- **Tareas que se repiten**: marcá una repetición (diaria/semanal/mensual).
  Al completarla, se crea sola la siguiente ocurrencia.
- **Archivar** en vez de borrar: preserva el historial. Hay una vista aparte
  para ver y restaurar tareas archivadas.

## 6. `/areas` — las líneas de trabajo

Tarjetas con color, responsable y % de tareas completadas por área. Si sos
coordinador o admin, podés crear, editar o archivar áreas.

Al entrar a una área específica:
- Sus tareas, agrupadas por estado.
- **Plantillas**: un nombre + una lista de títulos reutilizable, para
  procesos que se repiten (inscripciones, torneos). "Aplicar" clona esos
  títulos como tareas nuevas en Por hacer.
- **Bitácora del área**: novedades y observaciones que no son una tarea
  puntual — el banner de "última novedad" en `/hoy` sale de acá.

## 7. `/cronograma` — quién está de turno

Grilla semanal de lunes a viernes. Coordinadores/admins editan; el resto ve
en solo lectura.

- **Marcar tu ausencia**: cualquiera puede hacerlo para su propio turno
  (coordinador/admin, para el de cualquiera). Ese bloque se ve atenuado ese
  día, y deja de contar en "En la oficina ahora".
- Cuando alguien deja el equipo, su turno se **cierra** (no se borra) — así
  el histórico de coordinación queda correcto.

## 8. `/calendario`

Vista mensual que junta en un mismo grid las tareas del sistema con fecha de
vencimiento y los eventos del calendario compartido de Google de la
secretaría (si está configurado).

## 9. `/coordinacion` — para coordinar el equipo (coordinador/admin)

Foto del estado *actual* del trabajo: totales, las tareas abiertas más
viejas sin resolver, carga por persona, avance por área y precisión de
estimación (horas estimadas vs. reales).

## 10. `/informes` — actividad a lo largo del tiempo (coordinador/admin)

Complementa a `/coordinacion` con la evolución en el tiempo: tareas por
semana, ritmo de cierre por área, actividad de bitácora, antigüedad de
tareas vencidas, uso de plantillas, colaboración por comentarios, ausencias
y último login por persona.

## 11. `/admin` — configuración del sistema (solo administrador)

- **Organización**: nombre, logo, color principal y zona horaria de la
  organización — se aplican en todo el sistema (sidebar, pantallas de
  login, y el cálculo de "hoy" en bitácora/cronograma/informes).
- **Usuarios**: aprobar registros pendientes, cambiar rol, activar/
  desactivar cuentas.
- **Asignar tareas**: tareas abiertas sin responsable, o para reasignar.
- **Accesos rápidos**: los enlaces que ve todo el equipo en `/hoy`.
- **Google Calendar**: estado de la conexión e instrucciones si falta
  configurar.

## 12. `/perfil`

Tus datos básicos, color de avatar (se ve reflejado al toque en el sidebar)
y un link opcional a tu playlist de YouTube/YouTube Music, que después
aparece como opción en el widget de música de `/hoy`.

## 13. Elementos que están en todas las páginas

- **Búsqueda global** (`Cmd/Ctrl+K`): buscá tareas y áreas por texto, o
  usá acciones rápidas (nueva tarea, ir a la bitácora de hoy, cronograma,
  coordinación/admin según tu rol).
- **Notificaciones**: campana con no leídas, cuando te asignan una tarea o
  alguien comenta en una tuya. Si el equipo configuró Telegram, también te
  llega un aviso ahí.
- **Modo oscuro**: la app arranca en oscuro; podés cambiarlo con el botón
  sol/luna del header.
