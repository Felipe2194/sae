# Operación en producción

Cómo se despliega, se respalda y se vigila el sistema una vez que está en uso
real. Producción corre en Vercel (región `gru1`) con la base en Neon, y tiene
datos reales desde el 2026-09-23.

> **Antes que nada:** en la máquina de desarrollo, `.env.local` puede apuntar
> a la base de producción (queda así después de un `vercel env pull`). Para
> trabajar contra la base local de Docker hay que pasar la cadena de conexión
> explícita:
>
> ```bash
> docker compose up -d
> export DATABASE_URL=postgresql://postgres:postgres@localhost:5433/sae
> npm run db:migrate && npm run dev
> ```
>
> Los seeds (`db:seed`, `db:seed-demo`, `db:seed-proyectos-demo`) y `npm test`
> se niegan a correr contra una base que no sea local (ver
> `db/exigir-base-local.ts`).

## 1. Desplegar

Un push a `main` dispara el deploy en Vercel, que ejecuta `vercel-build`
(`scripts/vercel-build.mjs`):

1. **Aplica las migraciones pendientes** de `db/migrations/` — solo cuando el
   deploy es de producción (`VERCEL_ENV=production`); los de preview las
   saltean.
2. Compila con `next build`.

Si una migración falla, el build falla y el deploy no sale: producción sigue
en la versión anterior.

**Regla para escribir migraciones:** tienen que ser compatibles con el código
que ya está corriendo, porque entre que se aplican y que el deploy nuevo queda
activo pasan unos minutos. Agregar columnas (nullable o con default), tablas e
índices es seguro. Renombrar o borrar algo en uso se hace en dos deploys:
primero el código deja de usarlo, después la migración lo quita.

Dos gotchas que ya costaron un 500 en producción:

- Una **columna nueva en `usuario`** que se escriba desde una acción vía
  `withUser()` necesita su `grant update (columna) on usuario to sae_app` en
  la misma migración (ver `041` y `048`).
- Un `INSERT … RETURNING` hecho **a nombre de otro usuario** falla por RLS:
  Postgres re-chequea la policy de SELECT sobre la fila devuelta.

### Checklist antes de mergear a `main`

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5433/sae
npm run lint && npx tsc --noEmit && npm run db:migrate && npm test && npm run build
```

Es lo mismo que corre CI (`.github/workflows/ci.yml`) en cada PR y en cada
push a `main`.

## 2. Backups

Neon guarda historial para restaurar a un punto en el tiempo, pero la ventana
depende del plan (en el gratuito son horas) y vive en el mismo proveedor que
la base. Además de eso:

```bash
npm run db:backup
```

Deja un volcado completo en `backups/sae-AAAAMMDD-HHMMSS.sql.gz` (conserva los
últimos 30). Necesita Docker andando: usa `pg_dump` de la imagen oficial de
Postgres 18 (la versión de Neon), no hace falta instalar nada más.

- La carpeta `backups/` está fuera de git **y tiene que seguir así**: son
  datos personales reales (DNI, teléfonos y mails de estudiantes y contactos
  de colegios). Guardar una copia en un lugar privado — un disco externo o un
  Drive personal, nunca un repositorio.
- Conviene correrlo antes de cada deploy que traiga migraciones y, como
  mínimo, una vez por semana.
- **Probar la restauración** una vez, contra una base vacía:

  ```bash
  docker run -d --name sae-restore -e POSTGRES_PASSWORD=postgres -p 5434:5432 postgres:17-alpine
  docker exec sae-restore createdb -U postgres sae
  gunzip -c backups/sae-AAAAMMDD-HHMMSS.sql.gz | docker exec -i sae-restore psql -U postgres sae
  ```

  Un backup que nunca se restauró no es un backup todavía.

## 3. Enterarse de los errores

`instrumentation.ts` registra cada error de servidor inesperado (un 500 en una
página, una acción o una ruta) como una línea JSON en los logs de Vercel y, si
está configurado, lo manda por Telegram:

| Variable | Para qué |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | El bot (el mismo de las notificaciones del equipo). |
| `TELEGRAM_ALERTAS_CHAT_ID` | Chat **aparte** del grupo del equipo, solo para quien mantiene el sistema. |

El mismo error repetido avisa una vez cada 10 minutos. Los errores "para la
persona" (validaciones, permisos — ver más abajo) no se reportan.

Para monitoreo de disponibilidad, `/api/health` responde sin sesión y
verifica que la base esté alcanzable: se puede apuntar ahí cualquier servicio
de uptime gratuito.

## 4. Mensajes de error que ve la gente

En producción Next oculta el mensaje de cualquier `throw` de una Server Action.
Para que un mensaje escrito a mano llegue igual a la pantalla:

- **En la acción:** `throw new ErrorDeUsuario("Solo el responsable puede…")`
  (`lib/errores.ts`), o devolver `{ error: "…" }` como valor.
- **En el componente:** `catch (err) { toast.error(mensajeDeError(err, "No se pudo guardar.")) }`.

Nunca envolver en `ErrorDeUsuario` un error de la base o de un servicio
externo: esos tienen que quedar ocultos y llegar por la alerta de la sección 3.

Para las guardas de sesión, usar `requireAuth()` / `requireAdmin()` de
`lib/sesion.ts`.

Las acciones de una sección opcional (Cronograma, Proyectos, Visitas, Viajes)
usan `requireSeccion("clave")` / `requireAdminEnSeccion("clave")`: además de
la sesión, rechazan el pedido si la sección está desactivada o es "solo
administradores" y quien llama no lo es — la misma regla que aplica la página.
`/api/calendar/events` hace lo propio con Calendario. Las acciones de tareas
(`tablero/actions.ts`) quedan afuera a propósito: las tareas se usan también
desde Hoy, Proyectos y Viajes aunque el Tablero esté apagado.

## 5. Cuentas y accesos

- **Cuenta de oficina (genérica):** permite elegir un perfil sin contraseña en
  las computadoras compartidas. Los perfiles **administradores piden su
  propia contraseña** para entrar por esa vía, y las cuentas ocultas no se
  pueden elegir. Aun así, si la cuenta de oficina tiene rol administrador,
  quien conozca su clave administra: conviene que sea `miembro` una vez que
  haya al menos un administrador con cuenta propia.
- **Contraseñas:** cada persona cambia la suya en *Mi perfil → Contraseña*.
  Si la olvidó, un administrador se la resetea desde Configuración. La de la
  cuenta de oficina se resetea desde `/plataforma`.
- **Altas:** por invitación (link de 7 días) o por registro/Google con
  aprobación de un administrador.

## 6. Base de datos

- **Índices:** toda clave foránea tiene índice (migración `053`), más los
  compuestos de las consultas frecuentes (visitas por organización+fecha,
  bitácora por organización+día, tareas archivadas recientes).
- **Listas que crecen sin techo están paginadas:** tareas archivadas del
  tablero (de a 30) y auditoría en Configuración (de a 50, por cursor). Las
  notificaciones y los historiales ya tenían límite. El resto de las listas
  están acotadas por naturaleza (tareas activas, visitas de un año, inscriptos
  de un viaje).
- **RLS:** todas las tablas con datos de una organización lo tienen activo.
  Un trigger impide que alguien se cambie su propio rol, estado o tipo de
  cuenta; la auditoría solo acepta registros a nombre de quien está logueado.

## 7. Datos personales de inscriptos a viajes

La inscripción pública a un viaje guarda nombre, DNI, legajo, mail y teléfono
de cada estudiante. Pasado el viaje ya no hacen falta, así que un
**administrador** puede borrarlos desde *Viajes → el viaje → Inscriptos →
Borrar datos personales*. El botón aparece solo cuando el viaje está
**Realizado** o **Cancelado**, pide confirmación y deja registro en Auditoría.
Nada se borra solo.

No elimina a los inscriptos: los anonimiza (migración `054`, función
`anonimizar_inscriptos_viaje`). Cada uno queda como "Inscripto N", sin DNI,
legajo, mail, teléfono ni notas internas, y sus pagos pierden el link al
comprobante. Se conservan carrera, año, estado, monto y pagos, así Informes y
Costos siguen dando los mismos números.

- **Es irreversible** (salvo restaurando un backup, sección 2).
- **Sacar antes el reporte para la cooperadora** si todavía hace falta: es lo
  único que usa DNI y legajo, y después de borrar sale con "Inscripto N".
- Los volcados de `npm run db:backup` anteriores al borrado siguen teniendo
  los datos: descartarlos cuando ya no se necesiten.

## 8. Pendientes conocidos

- **Multi-organización a medias:** el registro, el alta por Google y la
  pantalla de login asumen la organización `sae-frvm`, y Telegram usa un único
  chat global. Hay que resolverlo antes de sumar una segunda secretaría.
- **Login con Google:** requiere `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` en
  Vercel y autorizar el callback del dominio de producción en Google Cloud.
- **Recuperación de contraseña por mail:** no existe (no hay servicio de
  correo configurado); la resetea un administrador.
- **Infraestructura propia (Docker/Swarm):** los archivos están, pero el
  camino no se probó en un servidor real.
