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

CMD ["node", "server.js"]
