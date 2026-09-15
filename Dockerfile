# Imagen de producción de la app Next.js (self-hosting — ver
# docs/migracion-servidores-propios.md). No la usa Vercel, que buildea la app
# directamente sin Docker; esto es para levantarla en un servidor propio.
#
# Requiere una base de datos Postgres aparte, alcanzable por DATABASE_URL
# (docker-compose.yml en la raíz del repo solo levanta esa base, no la app).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Variables necesarias solo para que `next build` no falle al validar env
# vars al importar módulos server-only (lib/db.ts) — los valores reales de
# producción se pasan en runtime, no en build.
ENV DATABASE_URL=postgresql://placeholder:placeholder@placeholder:5432/placeholder
ENV AUTH_SECRET=placeholder-build-only
RUN npm run build

# Imagen para aplicar migraciones (db/migrate.ts) contra un Postgres de
# producción. Se construye aparte con `--target migrator` y NO es la imagen
# que se despliega — la de abajo (runner) es standalone y no incluye tsx ni
# la carpeta db/, así que `docker compose exec app ...` con esa imagen no
# puede correr migraciones (ver docs/migracion-servidores-propios.md). Esta
# reusa `builder`, que ya tiene el repo completo + devDependencies.
FROM builder AS migrator
WORKDIR /app
CMD ["node_modules/.bin/tsx", "db/migrate.ts"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usado por el orquestador (Swarm/Compose) para saber cuándo el contenedor
# nuevo ya está listo antes de cortarle el tráfico al viejo — ver
# docs/migracion-servidores-propios.md sección "Zero-downtime". Sin curl/wget
# instalados en la imagen (alpine no los trae por defecto): el fetch global
# de Node 22 alcanza, sin sumar paquetes.
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
