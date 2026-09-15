#!/bin/sh
# Deploy con zero-downtime a un servidor propio con Docker Swarm (un solo
# nodo alcanza). Ver docs/migracion-servidores-propios.md sección 3.
#
# Requisitos en el servidor, una sola vez:
#   docker swarm init
#   cp .env.example .env.prod   # y completar con los valores reales de producción
#   (DATABASE_URL acá debe apuntar a "db", no a localhost: dentro de la red
#   overlay de Swarm el servicio se resuelve por nombre — ver docker-stack.prod.yml)
#
# Uso: ./scripts/deploy.sh   (correr desde la raíz del repo, con el código
# ya actualizado — git pull antes de esto)

set -eu

STACK=sae
SHA=$(git rev-parse --short HEAD)
IMAGE="sae-app:${SHA}"

if [ ! -f .env.prod ]; then
  echo "Falta .env.prod (copiar .env.example a .env.prod y completar con los valores de producción)." >&2
  exit 1
fi

# La red debe existir ANTES del primer `docker stack deploy` y ser
# `--attachable`: la crea `docker stack deploy` si no se le da `external`,
# pero sin --attachable el contenedor de migraciones (docker run suelto, no
# parte del stack) no podría unirse. Crearla acá, idempotente, cubre tanto
# el primer deploy (todavía no existe) como los siguientes (ya existe, no-op).
docker network inspect sae_net >/dev/null 2>&1 || \
  docker network create --driver overlay --attachable sae_net

echo "==> Build de la imagen de la app (${IMAGE})"
docker build --target runner -t "${IMAGE}" .

echo "==> Build de la imagen de migraciones"
docker build --target migrator -t sae-migrator:"${SHA}" .

# Importante: si esta migración agrega una columna NOT NULL sin default, o
# borra/renombra algo que el código VIEJO todavía usa, la ventana de
# start-first de más abajo (donde vieja y nueva conviven unos segundos)
# puede romper la versión vieja a mitad de camino. Migraciones que solo
# agregan (columnas nullable, tablas, índices) son siempre seguras acá;
# migraciones destructivas conviene partirlas en dos deploys (agregar/migrar
# datos en uno, borrar la columna vieja recién en el siguiente).
echo "==> Aplicando migraciones"
docker run --rm --network sae_net --env-file .env.prod \
  sae-migrator:"${SHA}"

echo "==> Rolling update (la versión vieja sigue respondiendo hasta que la nueva pasa el healthcheck)"
IMAGE="${IMAGE}" docker stack deploy -c docker-stack.prod.yml "${STACK}"

echo "==> Esperando a que converja..."
ATTEMPTS=0
while [ "$ATTEMPTS" -lt 60 ]; do
  REPLICAS=$(docker service ls --filter "name=${STACK}_app" --format '{{.Replicas}}')
  echo "   ${STACK}_app: ${REPLICAS}"
  case "$REPLICAS" in
    */*) DESIRED=${REPLICAS#*/}; RUNNING=${REPLICAS%/*}; [ "$RUNNING" = "$DESIRED" ] && break ;;
  esac
  ATTEMPTS=$((ATTEMPTS + 1))
  sleep 2
done

docker stack services "${STACK}"
echo "==> Listo. Si algo salió mal: docker service rollback ${STACK}_app"
