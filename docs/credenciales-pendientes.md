# Credenciales pendientes — qué falta cargar y dónde conseguirlo

> La lógica de código para todo esto ya está escrita y probada. Lo único que falta es
> que alguien con acceso a la cuenta de Google de la secretaría genere estas
> credenciales y las pegue en `.env.local` (desarrollo) o en las variables de entorno
> del proveedor de hosting (producción). Nada de esto requiere volver a tocar código.
>
> **Estado en este entorno de desarrollo (2026-08-13): login con Google y Calendario ya
> configurados y probados end-to-end**, con el proyecto **"SAE-Sistema"** en Google
> Cloud. Las instrucciones de abajo quedan igual porque van a hacer falta de nuevo para
> producción (otro dominio, otro `AUTH_URL`) o si alguien más arma su propio entorno
> local.

---

## 1. Login con Google (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`)

Habilita el botón "Continuar con Google" en `/login`. La lógica de vinculación con la
tabla `usuario` (alta en estado `pendiente`, bloqueo si no está `activo`) ya está en
`auth.ts` — ver `docs/documentacion-funcional.md` sección 6.

**Dónde conseguirlo:**

1. Entrar a [console.cloud.google.com](https://console.cloud.google.com) con la cuenta
   de Google que va a administrar esto (idealmente una cuenta institucional de la
   secretaría, no una personal).
2. Crear un proyecto nuevo (o usar uno existente si ya hay uno para la SAE).
3. Ir a **APIs y servicios → Pantalla de consentimiento OAuth**:
   - Tipo de usuario: **Externo** (a menos que la organización tenga Google Workspace,
     en cuyo caso puede ser "Interno").
   - Completar nombre de la app, email de soporte y logo (opcional).
   - En "Usuarios de prueba", si la app queda en modo "Prueba", agregar los emails del
     equipo que va a loguearse mientras no esté publicada.
4. Ir a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth**:
   - Tipo de aplicación: **Aplicación web**.
   - **Orígenes de JavaScript autorizados**: la URL base de la app (ej.
     `http://localhost:3000` en desarrollo, `https://sae.utnvm.edu.ar` o el dominio que
     se use en producción).
   - **URI de redirección autorizados**: `<AUTH_URL>/api/auth/callback/google` (ej.
     `http://localhost:3000/api/auth/callback/google`).
5. Copiar el **ID de cliente** y el **Secreto del cliente** generados.

**Dónde pegarlo:** `.env.local` (o las env vars del hosting):

```
AUTH_GOOGLE_ID=<el ID de cliente>
AUTH_GOOGLE_SECRET=<el secreto>
```

Reiniciar el servidor después de cargarlas.

---

## 2. Calendario de Google (`GOOGLE_CALENDAR_API_KEY`, `GOOGLE_CALENDAR_ID`)

Habilita que `/calendario` y el panel de `/admin` muestren los eventos del calendario
compartido de la secretaría. Es de **solo lectura** vía API Key — no requiere OAuth ni
que nadie inicie sesión con esa cuenta.

**Dónde conseguirlo:**

1. En el mismo proyecto de Google Cloud (o uno nuevo), ir a **APIs y servicios →
   Biblioteca**, buscar **Google Calendar API** y activarla.
2. Ir a **APIs y servicios → Credenciales → Crear credenciales → Clave de API**.
   - Recomendado: restringir la clave a la **Google Calendar API** únicamente (botón
     "Restringir clave" después de crearla) para que no sirva para otras APIs si se
     filtra.
3. El calendario que se quiere mostrar tiene que estar **compartido públicamente** (o al
   menos "disponible para cualquiera que tenga el enlace, ver todos los detalles del
   evento"):
   - Abrir Google Calendar → configuración del calendario específico (no la cuenta
     entera) → **"Integrar calendario"**.
   - Copiar el **ID de calendario** (termina en `@group.calendar.google.com` para
     calendarios secundarios, o es el email de la cuenta si es el calendario principal).
   - En **"Permisos de acceso"**, marcar "Hacer disponible al público".

**Dónde pegarlo:**

```
GOOGLE_CALENDAR_API_KEY=<la API key>
GOOGLE_CALENDAR_ID=<el ID de calendario>
```

Sin estas variables, `/calendario` sigue funcionando pero solo muestra las tareas del
sistema, sin eventos de Google.

**Gotcha real que nos pasó al configurarlo:** si restringís la API Key *antes* de haber
habilitado la Google Calendar API en el proyecto, la API no aparece en la lista para
marcarla y la clave queda guardada sin ningún permiso — el request falla con
`API_KEY_SERVICE_BLOCKED` aunque la clave y el calendario estén bien. Solución: habilitar
primero la API (Biblioteca → Google Calendar API → Habilitar) y **recién después** editar
la clave y marcarla en Restricciones de API.

---

## 2b. Escritura en Calendario (`GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY`)

Habilita el botón **"Nueva reunión"** de `/admin`: además de crear la tarea en el
sistema, crea el evento real en el Google Calendar de la organización. Una API Key
(sección 2) no alcanza — Google no permite escribir eventos con ese tipo de credencial,
hace falta una **cuenta de servicio**.

**Dónde conseguirlo** (mismo proyecto **"SAE-Sistema"** ya usado para el resto):

1. **IAM y administración → Cuentas de servicio → Crear cuenta de servicio.** Nombre
   sugerido: `sae-calendar-writer`. No hace falta asignarle ningún rol de IAM — el
   permiso que importa es el que se le da más abajo, directo en el calendario.
2. Entrar a la cuenta recién creada → pestaña **Claves → Agregar clave → Crear clave
   nueva → JSON**. Se descarga un archivo `.json` — es un secreto, no subirlo a ningún
   repo.
3. Copiar el **email** de la cuenta de servicio (campo `client_email` del JSON, termina
   en `...iam.gserviceaccount.com`).
4. En Google Calendar → configuración del calendario (el mismo de `GOOGLE_CALENDAR_ID`)
   → **"Compartir con determinadas personas"** → agregar ese email con permiso
   **"Hacer cambios en los eventos"** (no alcanza con "Ver los detalles del evento").

**Dónde pegarlo:**

```
GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL=<client_email del JSON>
GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY=<private_key del JSON, tal cual, con los \n literales>
```

Sin estas variables, "Nueva reunión" sigue creando la tarea en el sistema (visible en
el Tablero y en `/calendario`), solo que sin el evento en Google Calendar.

**Por qué cuenta de servicio y no ampliar el login con Google (`AUTH_GOOGLE_ID`):**
usar el login habría requerido pedirle a cada administrador un consentimiento OAuth
aparte para el scope de Calendar y guardar (y refrescar) un token por usuario. Una
cuenta de servicio es más simple para este caso — un solo calendario compartido de la
organización, no calendarios personales — y no toca el flujo de login de nadie.

---

## 3. Música de la oficina — no requiere credenciales

El widget "Música de la oficina" de `/hoy` es un **embed oficial de YouTube**
(`youtube-nocookie.com`, modo privacy-enhanced) — usa los controles nativos del
reproductor de YouTube, no hace falta cuenta ni credencial. Por defecto apunta a un lofi
24/7 conocido; para cambiarlo a otro video/transmisión/playlist propia:

```
NEXT_PUBLIC_YOUTUBE_EMBED_ID=<el ID del video, la parte después de v= en la URL>
NEXT_PUBLIC_YOUTUBE_EMBED_NOMBRE=<nombre a mostrar>
```

**Por qué no es un `<audio>` apuntando directo a un stream:** se probó primero así con un
stream de SomaFM — funcionaba perfecto probado con `curl`, pero un navegador real recibía
403 (SomaFM rechaza algo del pedido que manda un navegador, no la IP: el mismo pedido
por curl seguía funcionando). Se armó un proxy propio (`/api/radio-proxy`) para esquivar
eso, pero se terminó reemplazando todo por el embed de YouTube porque es más simple, no
depende de mantener un proxy, y el usuario pidió poder elegir su propia música en vez de
una radio fija.

**Por qué no es la cuenta personal de YouTube Music del usuario:** YouTube Music no tiene
una API oficial para mostrar o controlar lo que suena en una cuenta personal (a
diferencia de Spotify). Existen librerías no oficiales que hacen scraping con cookies de
sesión, pero son frágiles y violan los términos de uso de Google — no se implementaron.

Si más adelante se quiere de verdad "lo que estoy escuchando ahora en mi cuenta" (no una
playlist fija), Spotify sí lo permite oficialmente: hace falta un `SPOTIFY_CLIENT_ID` /
`SPOTIFY_CLIENT_SECRET` desde
[developer.spotify.com/dashboard](https://developer.spotify.com/dashboard), un refresh
token de la cuenta, y cuenta Premium si se quiere controlar la reproducción (no solo
mostrarla) — no está implementado, es un upgrade posible a futuro.

## 4. Notificaciones por Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`)

La especificación original dejaba abierto si las notificaciones fuera de la app debían
ser por email o algo más inmediato como Telegram. Quedó implementado Telegram: cuando se
asigna una tarea o alguien comenta, además de la notificación in-app se manda un mensaje
al grupo del equipo. Es "todo el equipo ve todo" (un solo grupo), no mensajes privados
por persona — más simple de armar y, para un equipo chico, probablemente más útil que
notificaciones 1 a 1 que nadie lee.

**Dónde conseguirlo:**

1. En Telegram, hablá con **[@BotFather](https://t.me/BotFather)** (el bot oficial para
   crear bots).
2. Mandale `/newbot`, seguí las instrucciones (nombre del bot, username que termine en
   `bot`). Te devuelve un **token** con este formato: `123456789:AAH...`.
3. Creá (o usá uno existente) un **grupo de Telegram** con el equipo de la secretaría.
4. Agregá al bot recién creado a ese grupo.
5. Para conseguir el **chat_id** del grupo:
   - Mandá cualquier mensaje al grupo (para que quede una actualización pendiente).
   - Abrí en el navegador: `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
   - Buscá `"chat":{"id":-100...` en la respuesta — ese número (negativo, para grupos)
     es el `chat_id`.

**Dónde pegarlo:**

```
TELEGRAM_BOT_TOKEN=<el token de BotFather>
TELEGRAM_CHAT_ID=<el id del grupo, con el signo menos incluido>
```

Sin estas variables, `enviarTelegram()` (`lib/telegram.ts`) no hace nada — las
notificaciones in-app siguen funcionando igual.

## 5. Observabilidad (Sentry) — opcional, no implementado

Si se quiere trazar excepciones con stack trace y alertas (más allá del logging
estructurado que ya corre en `lib/logger.ts`), hace falta:

1. Crear una cuenta en [sentry.io](https://sentry.io) (tiene plan gratuito) y un
   proyecto de tipo Next.js.
2. Copiar el **DSN** que te da al crear el proyecto.
3. Correr `npx @sentry/wizard@latest -i nextjs` en el repo — instala el SDK y genera la
   configuración automáticamente (no hace falta escribirla a mano).

```
SENTRY_DSN=<el DSN del proyecto>
```

## 6. Selector de archivos de Drive (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`)

Habilita el botón "Drive" al adjuntar un archivo a una tarea en `/tablero`: abre
el selector oficial de Google (Picker) para elegir un archivo del Drive
personal de quien está logueado, y lo adjunta como enlace (mismo modelo que un
adjunto manual — nombre + URL, sin subir ni copiar el archivo a ningún lado).
También habilita la vista previa embebida de esos adjuntos.

A diferencia del login y de Calendar, esto **no** usa el flujo de Auth.js: pide
un token de acceso efímero directamente en el navegador (Google Identity
Services), que vive solo mientras el picker está abierto y nunca se guarda en
el servidor. El usuario da acceso únicamente a los archivos que abre desde el
picker (scope `drive.file`), no a todo su Drive.

**Dónde conseguirlo:** mismo proyecto de Google Cloud ("SAE-Sistema") ya usado
para el login y Calendar.

1. En **APIs y servicios → Biblioteca**, activar **Google Drive API** y
   **Google Picker API**.
2. `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: mismo valor que `AUTH_GOOGLE_ID` (sección 1
   de este documento). El client ID de OAuth no es secreto — solo el
   `AUTH_GOOGLE_SECRET` lo es — así que es seguro exponerlo con el prefijo
   `NEXT_PUBLIC_`. Los "Orígenes de JavaScript autorizados" que ya se
   configuraron para el login sirven igual para esto.
3. `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`: crear una **API Key nueva** en
   **Credenciales → Crear credenciales → Clave de API**, y restringirla a la
   **Picker API** únicamente. No reusar `GOOGLE_CALENDAR_API_KEY`: esa ya está
   restringida solo a Calendar y el request de Picker fallaría.

**Dónde pegarlo:**

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<mismo valor que AUTH_GOOGLE_ID>
NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=<la API key nueva>
```

Sin estas variables, el botón "Drive" simplemente no aparece — el adjunto
manual por nombre+URL sigue funcionando igual.

## 7. Pendiente de decidir (se documenta acá cuando se resuelva)

- **Despliegue en producción**: cuando se elija proveedor de Postgres gestionado (Neon,
  Supabase Cloud, etc. — Vercel ya no ofrece Postgres propio), va a hacer falta la
  connection string de ese proveedor como `DATABASE_URL` en las env vars de producción,
  más un `AUTH_SECRET` distinto al de desarrollo (`openssl rand -base64 32`) y el
  `AUTH_URL` apuntando al dominio real.
