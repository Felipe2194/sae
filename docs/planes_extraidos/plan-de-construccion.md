# Plan de Construcción — Sistema de Gestión de Actividades

> Complemento de la especificación. Este documento es la **lista de trabajo**: qué se construye, en qué orden y cómo saber que cada parte está terminada.

---

## Cómo leer este documento

El trabajo está organizado en tres niveles:

```
ETAPA        →  un bloque con sentido propio (E0, E1, E2...)
  MÓDULO     →  una funcionalidad completa dentro de la etapa (M1.1, M1.2...)
    PASO     →  una unidad de trabajo de una sentada (1.1.1, 1.1.2...)
```

Cada módulo tiene un **Listo cuando** — la condición concreta que define que está terminado. Si no se cumple, el módulo no está cerrado, aunque el código funcione.

**Regla de oro:** no se empieza una etapa nueva hasta que la anterior esté desplegada y usable. Nada de tres módulos a medias en paralelo.

---

# ETAPA 0 — Cimientos

*No produce nada visible. Es la base sobre la que se apoya todo lo demás.*

## M0.1 — Repositorio y proyecto base

- [ ] 0.1.1 Crear repositorio en GitHub (privado), con README y `.gitignore`
- [ ] 0.1.2 Inicializar Next.js con App Router y TypeScript
- [ ] 0.1.3 Instalar y configurar Tailwind
- [ ] 0.1.4 Inicializar shadcn/ui e instalar los componentes base (button, input, dialog, select, card, dropdown-menu, avatar, badge, toast)
- [ ] 0.1.5 Configurar ESLint y Prettier
- [ ] 0.1.6 Definir estructura de carpetas y dejarla documentada en el README
- [ ] 0.1.7 Primer commit y push

**Estructura de carpetas propuesta:**

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
  /ui              shadcn
  /features        componentes por dominio (tareas, areas, turnos...)
/lib
  /supabase        clientes y queries
  /google          integración calendar
  /utils
/types
```

**Listo cuando:** `npm run dev` levanta la app y se ve una página vacía con Tailwind aplicado.

---

## M0.2 — Base de datos

- [ ] 0.2.1 Crear proyecto en Supabase
- [ ] 0.2.2 Escribir la migración inicial con las tablas: `organizacion`, `usuario`, `area`, `tarea`, `comentario`, `adjunto`, `acceso_rapido`, `turno`, `bitacora_diaria`
- [ ] 0.2.3 Definir tipos enumerados: `rol_usuario`, `estado_usuario`, `estado_tarea`, `prioridad`, `tipo_adjunto`
- [ ] 0.2.4 Crear índices sobre las columnas de filtrado frecuente: `organizacion_id`, `responsable_id`, `estado`, `fecha_vencimiento`
- [ ] 0.2.5 Trigger para que al crearse un usuario en `auth.users` se cree su fila en `usuario` con estado `pendiente`
- [ ] 0.2.6 Generar los tipos de TypeScript desde el esquema (`supabase gen types`)
- [ ] 0.2.7 Cargar datos de prueba: una organización, las 13 áreas de SAE, tres usuarios ficticios, quince tareas

**Listo cuando:** las tablas existen, los tipos están generados y se pueden consultar los datos de prueba desde la app.

---

## M0.3 — Seguridad multi-organización

Este módulo es corto pero es **el más importante de la Etapa 0**. Si queda mal, se filtran datos entre secretarías.

- [ ] 0.3.1 Activar RLS en todas las tablas sin excepción
- [ ] 0.3.2 Crear la función `mi_organizacion()` que devuelve el `organizacion_id` del usuario autenticado
- [ ] 0.3.3 Crear la función `mi_rol()`
- [ ] 0.3.4 Políticas de lectura: todo filtrado por `organizacion_id = mi_organizacion()`
- [ ] 0.3.5 Políticas de escritura de tareas: el miembro solo modifica el estado de tareas propias; el coordinador modifica cualquiera de su organización
- [ ] 0.3.6 Políticas de áreas, turnos y accesos rápidos: lectura para todos, escritura solo coordinador o superior
- [ ] 0.3.7 Política de usuarios: cada uno edita su propio perfil; solo el administrador cambia roles y estados
- [ ] 0.3.8 **Probar el aislamiento**: crear una segunda organización con datos y verificar desde la app que un usuario de la primera no ve absolutamente nada de la segunda

**Listo cuando:** el paso 0.3.8 pasa. No antes.

---

## M0.4 — Despliegue

- [ ] 0.4.1 Conectar el repositorio a Vercel
- [ ] 0.4.2 Cargar las variables de entorno
- [ ] 0.4.3 Verificar que el deploy de producción levanta
- [ ] 0.4.4 Dejar `main` como rama de producción y trabajar con ramas por funcionalidad

**Listo cuando:** hay una URL pública funcionando.

> **Por qué desplegar tan temprano:** desplegar al final siempre trae sorpresas. Hacerlo con la app vacía significa que todos los deploys posteriores son de un solo cambio y los problemas se detectan al instante.

---

# ETAPA 1 — Núcleo utilizable

*Al terminar esta etapa el sistema reemplaza a Jira y Notion. Este es el hito que importa.*

## M1.1 — Autenticación y usuarios

- [ ] 1.1.1 Cliente de Supabase para servidor y para navegador
- [ ] 1.1.2 Pantalla de login (email y contraseña)
- [ ] 1.1.3 Pantalla de registro
- [ ] 1.1.4 Pantalla de "cuenta pendiente de aprobación"
- [ ] 1.1.5 Middleware que protege las rutas de `/(app)` y redirige según el estado del usuario
- [ ] 1.1.6 Recuperación de contraseña
- [ ] 1.1.7 Layout general: barra lateral de navegación, encabezado con avatar y menú de usuario, cierre de sesión
- [ ] 1.1.8 Página de perfil propio (nombre y avatar)

**Flujo de estados del usuario:**

```
registro → pendiente → (aprobación del coordinador) → activo
                                                        ↓
                                                     inactivo
```

**Listo cuando:** alguien se registra, queda bloqueado en la pantalla de espera, un coordinador lo aprueba desde la base de datos, y al recargar entra al sistema.

---

## M1.2 — Administración de usuarios

- [ ] 1.2.1 Listado de usuarios de la organización con rol y estado
- [ ] 1.2.2 Bandeja de registros pendientes con acciones de aprobar y rechazar
- [ ] 1.2.3 Cambio de rol desde la interfaz
- [ ] 1.2.4 Desactivar usuario (nunca borrar: rompería el histórico de tareas)
- [ ] 1.2.5 Ocultar la sección completa a quien no sea administrador

**Listo cuando:** el paso 1.1.8 ya no necesita tocar la base de datos a mano para aprobar a nadie.

---

## M1.3 — Áreas

- [ ] 1.3.1 Listado de áreas en formato de tarjetas, con color y contador de tareas abiertas
- [ ] 1.3.2 Crear y editar área (nombre, color, descripción, responsable)
- [ ] 1.3.3 Archivar área (con las tareas asociadas preservadas)
- [ ] 1.3.4 Vista de detalle del área con sus tareas
- [ ] 1.3.5 Selector de color con una paleta acotada de diez opciones

**Listo cuando:** las 13 áreas de SAE están cargadas desde la interfaz, sin scripts.

> **Nota de diseño:** paleta acotada, no selector libre de color. Con colores arbitrarios el tablero termina ilegible.

---

## M1.4 — Tareas

El corazón del sistema.

- [ ] 1.4.1 Modelo de datos y queries: crear, leer, actualizar, archivar
- [ ] 1.4.2 Formulario de creación rápida: **solo título, área y responsable**
- [ ] 1.4.3 Panel de detalle de tarea (se abre lateralmente, no como página aparte): descripción, prioridad, fecha de vencimiento, responsable, área
- [ ] 1.4.4 Cambio de estado
- [ ] 1.4.5 Reasignación de responsable
- [ ] 1.4.6 Archivar tarea
- [ ] 1.4.7 Registro de `completada_en` al pasar a "hecha"

**Listo cuando:** se puede crear una tarea en menos de diez segundos y sin scrollear el formulario.

---

## M1.5 — Tablero Kanban

- [ ] 1.5.1 Estructura de tres columnas: Por hacer · En progreso · Hecha
- [ ] 1.5.2 Tarjeta de tarea: título, color del área, avatar del responsable, fecha de vencimiento si la tiene
- [ ] 1.5.3 Drag and drop con dnd-kit
- [ ] 1.5.4 Persistir el cambio de estado al soltar la tarjeta
- [ ] 1.5.5 Persistir el orden dentro de la columna
- [ ] 1.5.6 Filtros: por área, por responsable, y atajo de "solo mis tareas"
- [ ] 1.5.7 Botón de crear tarea desde el encabezado de cada columna
- [ ] 1.5.8 Actualización optimista (la tarjeta se mueve al instante, la base se actualiza detrás)
- [ ] 1.5.9 Comportamiento en pantalla chica: las columnas se apilan y el cambio de estado pasa a ser un menú desplegable

**Listo cuando:** arrastrar una tarjeta se siente instantáneo y el cambio persiste al recargar.

---

## M1.6 — Panel del día

La pantalla de inicio, y probablemente la más usada de todo el sistema.

- [ ] 1.6.1 Encabezado: fecha en formato largo y saludo con el nombre
- [ ] 1.6.2 Bloque "Mis tareas de hoy": vencen hoy, están vencidas, o están en progreso. Con checkbox para completar en un clic
- [ ] 1.6.3 Bloque "Esta semana": las próximas, plegado por defecto
- [ ] 1.6.4 Bloque "Accesos rápidos"
- [ ] 1.6.5 Estados vacíos que no den lástima ("No tenés nada pendiente para hoy")
- [ ] 1.6.6 Esqueletos de carga en cada bloque
- [ ] 1.6.7 Definir esta ruta como la de inicio tras el login

**Listo cuando:** el panel carga en menos de un segundo y marcar una tarea como hecha requiere exactamente un clic.

---

## M1.7 — Accesos rápidos

- [ ] 1.7.1 Configuración desde el panel de administración: etiqueta, URL, ícono, orden
- [ ] 1.7.2 Asociación opcional a un área
- [ ] 1.7.3 Componente de botones para el panel del día
- [ ] 1.7.4 Mostrar los accesos del área dentro de la vista de detalle del área
- [ ] 1.7.5 Reordenar arrastrando

**Listo cuando:** las carpetas de Drive que hoy se buscan a mano están a un clic desde el inicio.

---

### 🚩 Hito 1 — Migración

Antes de seguir a la Etapa 2:

- [ ] Cargar las tareas reales que hoy viven en Jira
- [ ] Dar de alta a todo el equipo
- [ ] Usarlo durante **dos semanas** como único sistema
- [ ] Recolectar lo que molesta y corregirlo antes de agregar nada nuevo

> Esta pausa no es opcional. Agregar funcionalidad sobre una base que el equipo todavía no adoptó es la forma más común de que un proyecto interno muera.

---

# ETAPA 2 — Operación diaria

*Lo que convierte al sistema en el lugar donde el equipo realmente trabaja.*

## M2.1 — Cronograma semanal

- [ ] 2.1.1 Grilla de lunes a viernes por franja horaria
- [ ] 2.1.2 Bloques de turno mostrando avatar y nombre
- [ ] 2.1.3 Crear turno (persona, día, hora de inicio y fin)
- [ ] 2.1.4 Editar y eliminar turno, solo coordinador
- [ ] 2.1.5 Manejo de vigencia: al cerrar un turno se completa `vigente_hasta` en vez de borrarlo
- [ ] 2.1.6 Indicador de "quién está ahora" en el panel del día
- [ ] 2.1.7 Detección visual de solapamientos y de franjas sin cobertura

**Listo cuando:** se puede responder "¿quién está el jueves a las 16?" sin preguntarle a nadie.

---

## M2.2 — Bitácora diaria

- [ ] 2.2.1 Formulario en el panel del día: qué hice, qué quedó pendiente, observaciones
- [ ] 2.2.2 Un registro por usuario y por fecha (se edita, no se duplica)
- [ ] 2.2.3 Recordatorio visual si no se cargó la del día
- [ ] 2.2.4 Historial propio de bitácoras
- [ ] 2.2.5 Precarga de las tareas completadas ese día como punto de partida del texto

**Listo cuando:** cargar la bitácora lleva menos de un minuto.

> El paso 2.2.5 es el que decide la adopción de este módulo: si el campo aparece prellenado con lo que ya hiciste, se completa; si aparece vacío, no.

---

## M2.3 — Comentarios y adjuntos

- [ ] 2.3.1 Hilo de comentarios en el panel de detalle de tarea
- [ ] 2.3.2 Adjuntar enlace (nombre + URL)
- [ ] 2.3.3 Subir archivo a Supabase Storage con límite de tamaño
- [ ] 2.3.4 Listado de adjuntos con ícono según tipo
- [ ] 2.3.5 Eliminar adjunto (autor o coordinador)

**Listo cuando:** una tarea puede llevar adjunto el documento que necesita para hacerse.

---

## M2.4 — Google Calendar (lectura)

- [ ] 2.4.1 Configurar el proyecto en Google Cloud Console y habilitar la API de Calendar
- [ ] 2.4.2 Flujo OAuth a nivel organización, desde el panel de administración
- [ ] 2.4.3 Guardado seguro de tokens y renovación automática
- [ ] 2.4.4 Selector del calendario a sincronizar
- [ ] 2.4.5 Traer los eventos del día para el panel
- [ ] 2.4.6 Vista de calendario mensual y semanal, con eventos y tareas juntos
- [ ] 2.4.7 Sincronización incremental con `syncToken`
- [ ] 2.4.8 Manejo de errores: token vencido, permisos revocados, calendario eliminado

**Listo cuando:** los eventos del calendario de la secretaría se ven en la app sin abrir Google Calendar.

---

# ETAPA 3 — Coordinación

## M3.1 — Panel del coordinador

- [ ] 3.1.1 Métricas del período: completadas, pendientes, vencidas
- [ ] 3.1.2 Distribución de carga por persona
- [ ] 3.1.3 Distribución por área
- [ ] 3.1.4 Listado de tareas vencidas y de tareas sin responsable
- [ ] 3.1.5 Bitácoras del equipo agrupadas por fecha
- [ ] 3.1.6 Selector de rango de fechas
- [ ] 3.1.7 Exportar a CSV

**Listo cuando:** se puede preparar un informe mensual de gestión sin abrir una planilla.

---

## M3.2 — Google Calendar (escritura)

- [ ] 3.2.1 Al crear una tarea con fecha, opción de generar el evento
- [ ] 3.2.2 Guardar `google_event_id` y mantener la asociación
- [ ] 3.2.3 Propagar ediciones de fecha y título hacia el evento
- [ ] 3.2.4 Eliminar el evento al archivar la tarea
- [ ] 3.2.5 Resolución de conflictos si el evento se modificó del lado de Google

---

## M3.3 — Tareas recurrentes

- [ ] 3.3.1 Configuración de recurrencia en el formulario (diaria, semanal, mensual)
- [ ] 3.3.2 Generación automática de instancias mediante tarea programada
- [ ] 3.3.3 Distinción visual entre plantilla e instancia
- [ ] 3.3.4 Editar la serie completa o una sola instancia
- [ ] 3.3.5 Finalizar una recurrencia sin borrar el histórico

---

## M3.4 — Notificaciones

- [ ] 3.4.1 Decidir el canal (ver decisiones pendientes de la especificación)
- [ ] 3.4.2 Preferencias de notificación por usuario
- [ ] 3.4.3 Aviso al recibir una tarea asignada
- [ ] 3.4.4 Recordatorio de tareas que vencen hoy
- [ ] 3.4.5 Resumen semanal para coordinadores

---

# ETAPA 4 — Producto

*Solo tiene sentido con la Etapa 1 funcionando de verdad en SAE.*

## M4.1 — Alta autogestionada de organizaciones
- [ ] 4.1.1 Flujo de creación de organización
- [ ] 4.1.2 Asistente inicial: datos, áreas sugeridas, primer usuario administrador
- [ ] 4.1.3 Invitación de miembros por enlace

## M4.2 — Personalización
- [ ] 4.2.1 Logo y color principal por organización
- [ ] 4.2.2 Zona horaria
- [ ] 4.2.3 Plantillas de áreas según tipo de secretaría

## M4.3 — Integración con Drive
- [ ] 4.3.1 Buscador de archivos de Drive dentro de la app
- [ ] 4.3.2 Adjuntar desde el explorador de Drive
- [ ] 4.3.3 Vista previa embebida

## M4.4 — Documentación
- [ ] 4.4.1 Guía de instalación para otras regionales
- [ ] 4.4.2 Manual de usuario breve
- [ ] 4.4.3 Documentación técnica del repositorio
- [ ] 4.4.4 Instructivo de migración a servidores propios

---

# Orden de ejecución y dependencias

```
E0 ─────────────────────────────────────────────► base obligatoria

E1  M1.1 ─► M1.2
     │
     └─► M1.3 ─► M1.4 ─┬─► M1.5
                       └─► M1.6 ◄── M1.7

     🚩 HITO 1 — dos semanas de uso real

E2  M2.1   M2.2   M2.3        (independientes entre sí)
                   M2.4 ─────► requiere cuenta de Google

E3  M3.1 ◄── requiere datos acumulados de E1 y E2
    M3.2 ◄── requiere M2.4
    M3.3   M3.4

E4 ◄── requiere Etapa 1 en uso real
```

---

# Qué construir primero, en una línea

**M0.1 → M0.2 → M0.3 → M0.4 → M1.1 → M1.3 → M1.4 → M1.5 → M1.6 → M1.7 → HITO**

Ese es el camino crítico hasta tener algo que el equipo pueda usar. Todo lo demás se apoya en esto.

---

# Errores a evitar

1. **Empezar por el calendario.** Es lo más vistoso y lo más lento de construir. Va en la Etapa 2 por una razón.
2. **Postergar RLS.** Agregarlo después implica auditar cada consulta del sistema.
3. **Hacer las columnas del Kanban configurables.** Es exactamente la complejidad que estás tratando de evitar.
4. **Sumar funciones antes del Hito 1.** Si el equipo no adoptó el núcleo, más funciones no lo van a arreglar.
5. **Generalizar para otras secretarías desde el principio.** Multi-tenancy sí; el resto, cuando exista una segunda secretaría real pidiéndolo.
