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

El repo también tiene, para producción:
- `docker-stack.prod.yml` — stack de Docker Swarm (db + app) con
  healthchecks, límites de recursos y rolling update.
- `scripts/deploy.sh` — build + migraciones + deploy con zero-downtime.
- `scripts/backup-db.sh` — backup diario de Postgres (pensado para cron).

### Zero-downtime al reconstruir la app

Un `docker compose up -d --build` a secas **para el contenedor viejo antes
de levantar el nuevo** — hay una ventana real sin servir nada. Para que la
versión vieja siga respondiendo mientras la nueva termina de arrancar y
pasa su healthcheck (recién ahí se corta la vieja), hace falta Docker Swarm
en vez de Compose a secas — no requiere un cluster, funciona igual con un
solo nodo:

```bash
docker swarm init          # una sola vez, en el servidor
cp .env.example .env.prod  # y completar con los valores reales de producción
                            # (DATABASE_URL acá apunta a "db", no a localhost)
./scripts/deploy.sh
```

`scripts/deploy.sh` hace, en orden: build de la imagen de la app, build de
la imagen de migraciones (`--target migrator` del `Dockerfile` — la imagen
de la app es standalone y no incluye `tsx` ni `db/`, por eso migrar hace
falta una imagen aparte, no `docker exec` sobre el contenedor de la app),
aplica las migraciones, y recién ahí despliega la imagen nueva con
`docker stack deploy` usando `docker-stack.prod.yml` (que tiene
`update_config: order: start-first`: arranca el contenedor nuevo, espera a
que el `HEALTHCHECK` del `Dockerfile` lo marque sano, y solo entonces para
el viejo).

Si el rollout falla el healthcheck, Swarm hace rollback solo
(`failure_action: rollback` en el stack file); para forzarlo a mano:
`docker service rollback sae_app`.

**Ojo con las migraciones**: durante la ventana de `start-first` la versión
vieja y la nueva del código conviven unos segundos contra la misma base.
Una migración que solo agrega (columna nullable, tabla, índice) es segura
en cualquier momento; una que borra o renombra algo que el código viejo
todavía usa puede romper esa versión vieja mientras sigue recibiendo
tráfico — conviene partirla en dos deploys (agregar/migrar datos primero,
borrar la columna vieja recién en el siguiente, cuando ya no queda ningún
contenedor corriendo la versión anterior).

### Backups

`scripts/backup-db.sh` hace `pg_dump` desde dentro del contenedor de la
base (no necesita `psql` instalado en el host) y borra los backups más
viejos que `RETENCION_DIAS` (14 por defecto). Agregarlo a cron en el
servidor:

```
0 3 * * * /ruta/al/repo/scripts/backup-db.sh >> /var/log/sae-backup.log 2>&1
```

Restaurar: `gunzip -c archivo.sql.gz | docker exec -i <container_db> psql -U postgres sae`.

### Reverse proxy

Falta un reverse proxy con TLS delante (Caddy, Traefik o nginx) — no está
incluido porque depende de cómo esté armada la infraestructura del
servidor destino. Como el stack publica el puerto de la app de forma
estable (`3000:3000` en `docker-stack.prod.yml`), el proxy no necesita
enterarse de nada durante un deploy: sigue apuntando al mismo puerto y es
Swarm quien decide, puertas adentro, qué contenedor responde en cada
momento.

**Importante en nginx** (u otro proxy): configurarlo para que REESCRIBA
`X-Forwarded-For` con la IP real de quien conecta, no que solo le agregue un
valor a lo que ya venga del cliente.

```nginx
proxy_set_header X-Forwarded-For $remote_addr;   # correcto
# NO: proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

`lib/rate-limit.ts` (`obtenerIp`) usa ese header para el límite de intentos
de login — con `$proxy_add_x_forwarded_for` (el default de muchas guías),
cualquiera puede seguir mandando su propio `X-Forwarded-For` falso en cada
intento y evadir el límite por IP.

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
