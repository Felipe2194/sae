# Credenciales pendientes — qué falta cargar y dónde conseguirlo

> La lógica de código para todo esto ya está escrita y probada. Lo único que falta es
> que alguien con acceso a la cuenta de Google de la secretaría genere estas
> credenciales y las pegue en `.env.local` (desarrollo) o en las variables de entorno
> del proveedor de hosting (producción). Nada de esto requiere volver a tocar código.

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

---

## 3. Música de la oficina — no requiere credenciales

El widget "Música de la oficina" de `/hoy` quedó resuelto con una radio lofi pública
(SomaFM, streaming directo por `<audio>`) que funciona sin ninguna cuenta ni clave. Es
configurable si se quiere apuntar a otra emisora, pero no hace falta tocar nada para que
funcione:

```
NEXT_PUBLIC_RADIO_STREAM_URL=<url de streaming mp3/ogg directo>
NEXT_PUBLIC_RADIO_NOMBRE=<nombre a mostrar>
```

Si más adelante se quiere integrar con una cuenta de Spotify compartida (mostrar/
controlar lo que suena ahí en vez de una radio fija), va a hacer falta un
`SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` desde
[developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) y un refresh
token de esa cuenta — no está implementado, es un upgrade posible a futuro.

## 4. Pendiente de decidir (se documenta acá cuando se resuelva)

- **Despliegue en producción**: cuando se elija proveedor de Postgres gestionado (Neon,
  Supabase Cloud, etc. — Vercel ya no ofrece Postgres propio), va a hacer falta la
  connection string de ese proveedor como `DATABASE_URL` en las env vars de producción,
  más un `AUTH_SECRET` distinto al de desarrollo (`openssl rand -base64 32`) y el
  `AUTH_URL` apuntando al dominio real.
