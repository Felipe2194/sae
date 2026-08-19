# SAE — Guía de instalación

> Para otra regional de UTN (u otra secretaría) que quiera correr su propia
> instancia. Si lo que buscás es retomar el desarrollo de este mismo
> repositorio, ver [`estado-del-proyecto.md`](./estado-del-proyecto.md) en
> vez de esta guía.

---

## 1. Requisitos

- Node.js 22+ y npm.
- Docker (para Postgres local) o acceso a un Postgres 17 propio.
- Una cuenta de Google Cloud si vas a usar login con Google, Calendar o el
  selector de Drive (los tres son opcionales — ver
  [`credenciales-pendientes.md`](./credenciales-pendientes.md)).

## 2. Levantar el entorno local

```bash
git clone <tu-fork-o-copia-del-repo>
cd sae
npm install
cp .env.example .env.local   # completar DATABASE_URL y AUTH_SECRET como mínimo
docker compose up -d          # levanta Postgres 17 en localhost:5433
npm run db:migrate
npm run db:seed               # datos de prueba — ver paso 3 para una org real
npm run dev
```

- `AUTH_SECRET`: generar con `openssl rand -base64 32`.
- App en [http://localhost:3000](http://localhost:3000). Login de prueba
  tras el seed: `admin@sae.test` / `password123` (y `coordinador@sae.test`,
  `miembro@sae.test`).
- Reset completo: `docker compose down -v && docker compose up -d && npm run db:migrate && npm run db:seed`.

## 3. Bootstrapear una organización real (en vez del seed de prueba)

No existe todavía una pantalla de alta de organización (queda fuera del
alcance actual — ver `contexto.md` M4.1 "Alta autogestionada"). Para una
instancia real hay que crear la organización y su primer administrador a
mano por SQL, y **el slug tiene que coincidir con el que usa `/registro`**:

`app/(auth)/registro/actions.ts` hoy tiene hardcodeado
`where slug = 'sae-frvm'` — para una organización distinta hay que cambiar
ese literal en el código (es fork-per-organización en este momento, no
multi-tenant self-serve). Guardá el cambio, después:

```sql
insert into organizacion (nombre, slug, zona_horaria)
values ('Nombre de tu secretaría', 'tu-slug', 'America/Argentina/Cordoba')
returning id;

-- con el id devuelto arriba, y un hash bcrypt generado aparte (ver
-- db/seed.ts para el patrón con bcryptjs):
insert into usuario (organizacion_id, nombre, email, password_hash, rol, estado)
values ('<id-de-organizacion>', 'Tu nombre', 'vos@ejemplo.com', '<hash-bcrypt>', 'administrador', 'activo');
```

Con ese usuario ya podés entrar y usar `/admin` → **Organización** para
completar logo, color y zona horaria desde la interfaz, y `/admin` →
**Usuarios** para aprobar a los siguientes que se registren solos.

## 4. Deploy en producción

**Estado real: esto todavía no se hizo para la instancia de UTN FRVM** (es
el módulo M0.4 del plan de construcción, sigue pendiente). Lo que sigue es
el camino recomendado, no algo ya verificado en este repo.

1. **Base de datos gestionada**: Vercel ya no ofrece Postgres propio — se
   provisiona vía Marketplace (Neon es la opción recomendada por soportar
   bien conexiones serverless; Supabase Cloud también sirve, se usa solo
   como Postgres). Da un `DATABASE_URL` de producción.
2. **Deploy de la app**: conectar el repo a un proyecto de Vercel. Framework
   preset "Next.js", sin configuración extra.
3. **Variables de entorno** en el proyecto de Vercel: como mínimo
   `DATABASE_URL` (de arriba) y `AUTH_SECRET` (uno **distinto** al de
   desarrollo — `openssl rand -base64 32`), `AUTH_URL` apuntando al dominio
   real. El resto (`AUTH_GOOGLE_ID`/`SECRET`, `GOOGLE_CALENDAR_*`,
   `NEXT_PUBLIC_GOOGLE_*`, `TELEGRAM_*`) son opcionales, mismo criterio que
   en local — ver `credenciales-pendientes.md`.
4. **Migraciones contra la base de producción**: correr `npm run db:migrate`
   apuntando al `DATABASE_URL` de producción (una sola vez, o en cada
   deploy que agregue migraciones nuevas — no hay todavía un paso
   automático de esto en CI, `ci.yml` migra solo contra el Postgres de
   servicio efímero que usa para los tests).
5. **Primer usuario administrador**: repetir el paso 3 de esta guía contra
   la base de producción.

Si el destino **no** es Vercel sino un servidor propio, ver
[`migracion-servidores-propios.md`](./migracion-servidores-propios.md).

## 5. Verificar que quedó todo bien

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Los cuatro corren en CI (`.github/workflows/ci.yml`) en cada push/PR a
`main` — si pasan local, van a pasar ahí también.
