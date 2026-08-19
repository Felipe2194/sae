# SAE — Migración a servidores propios

> Expande la nota de `contexto.md` sección 8 ("Sobre la migración futura a
> servidores de la facultad"). Esa nota asumía todavía Supabase; el proyecto
> se movió a Postgres puro + Node antes de esta migración hipotética, así
> que en los hechos **el camino es más simple de lo que se planeó
> originalmente**: no depende de ningún proveedor gestionado, es Postgres +
> Next.js corriendo donde sea.

---

## 1. Por qué es viable sin trabajo extra

- **Base de datos**: siempre fue Postgres estándar (17), sin extensiones ni
  servicios propietarios de ningún proveedor. `pg_dump`/`pg_restore` (o
  simplemente correr las migraciones de `db/migrations/` contra el Postgres
  nuevo) alcanza.
- **Backend**: toda la lógica de negocio vive en la app (Server Actions y
  Route Handlers de Next.js), no en funciones o triggers propietarios de
  ningún hosting — es la decisión de arquitectura documentada en
  `documentacion-tecnica.md` sección 6, tomada justamente para que esto
  fuera así.
- **Auth**: Auth.js v5 con sesiones JWT, sin tablas de sesión ni adapter
  atado a un proveedor.

Lo único atado a Vercel específicamente son los headers/optimizaciones que
Next.js aplica igual en cualquier lado (no hay uso de Vercel KV, Blob, Edge
Config, ni Vercel Postgres en este código).

## 2. Qué necesita el servidor propio

- Un Postgres 17 alcanzable por red desde donde corra la app (puede ser el
  mismo servidor, con Docker, o uno separado).
- Node.js 22+ (o Docker, ver sección 3) para correr la app Next.js.
- Un dominio con HTTPS — `AUTH_URL` y las credenciales de Google OAuth (si
  se usan) están atadas a la URL exacta, hay que reconfigurarlas si cambia
  (ver `credenciales-pendientes.md`).

## 3. Con Docker (recomendado)

El repo tiene:
- `docker-compose.yml` — levanta **solo** Postgres (pensado para desarrollo
  local, con el puerto expuesto al host).
- `Dockerfile` (raíz del repo) — build multi-stage de la app Next.js usando
  `output: "standalone"` (`next.config.ts`), pensado para producción.
- `.dockerignore`.

Para levantar la base **y** la app juntas en un servidor propio, un
`docker-compose` de producción se arma agregando un servicio a partir del
`Dockerfile` existente:

```yaml
# docker-compose.prod.yml — ejemplo, no versionado en el repo porque las
# variables de entorno reales no deben commitearse.
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: sae
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: <elegir una contraseña real>
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:<misma-contraseña>@db:5432/sae
      AUTH_SECRET: <openssl rand -base64 32>
      AUTH_URL: https://tu-dominio.ejemplo.com
      # + las variables opcionales de credenciales-pendientes.md que se usen
    depends_on:
      - db
    restart: unless-stopped

volumes:
  postgres_data:
```

```bash
docker compose -f docker-compose.prod.yml up -d --build
# primera vez: aplicar migraciones dentro del contenedor de la app
docker compose -f docker-compose.prod.yml exec app node_modules/.bin/tsx db/migrate.ts
```

Falta un reverse proxy con TLS delante (Caddy, Traefik o nginx) — no está
incluido porque depende de cómo esté armada la infraestructura del
servidor destino.

## 4. Sin Docker (Node directo)

```bash
npm ci
npm run build        # usa output: "standalone" igual, aunque acá se corre
                      # con npm en vez del Dockerfile
npm run db:migrate
npm start             # next start, sirve en el puerto 3000 por defecto
```

Usar un manejador de procesos (`pm2`, `systemd`) para que la app se
reinicie sola si el proceso cae, y un reverse proxy para TLS — igual que en
el punto anterior.

## 5. Variables de entorno necesarias

Mismas que en desarrollo (`.env.example`), con estos cambios obligatorios
respecto a local:

- `DATABASE_URL` → apuntando al Postgres del servidor propio.
- `AUTH_SECRET` → uno nuevo, no el de desarrollo.
- `AUTH_URL` → el dominio real, con HTTPS.
- Si se usa login con Google, Calendar o el selector de Drive: las
  credenciales de Google Cloud hay que **recrearlas o reconfigurar los
  orígenes/redirects autorizados** para el dominio nuevo (ver
  `credenciales-pendientes.md` — están atadas a `AUTH_URL`).

## 6. Qué NO hace falta migrar

- No hay Storage de archivos en uso (los adjuntos son enlaces, no archivos
  subidos) — nada que mover en ese frente todavía.
- No hay funciones serverless propietarias de ningún proveedor.
- No hay cron jobs ni workers separados del proceso principal de Next.js.
