#!/bin/sh
# Backup de la base de producción. Agregar a cron en el servidor, por ejemplo
# todos los días a las 3am:
#   0 3 * * * /ruta/al/repo/scripts/backup-db.sh >> /var/log/sae-backup.log 2>&1
#
# No requiere estar en la carpeta del repo ni tener psql instalado en el
# host: usa pg_dump de DENTRO del contenedor de la base vía `docker exec`.

set -eu

STACK="${STACK:-sae}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/sae}"
RETENCION_DIAS="${RETENCION_DIAS:-14}"

mkdir -p "$BACKUP_DIR"

CONTAINER=$(docker ps --filter "name=${STACK}_db" --format '{{.ID}}' | head -n1)
if [ -z "$CONTAINER" ]; then
  echo "No se encontró un contenedor corriendo con nombre ${STACK}_db" >&2
  exit 1
fi

TS=$(date +%Y%m%d-%H%M%S)
ARCHIVO="${BACKUP_DIR}/sae-${TS}.sql.gz"
TMP="${ARCHIVO}.tmp"

# `pg_dump | gzip` en /bin/sh no tiene `pipefail`: si pg_dump falla a mitad
# de camino, gzip igual termina bien y queda un .sql.gz "exitoso" pero
# incompleto/vacío. Volcar a un archivo sin comprimir primero y chequear el
# exit code de pg_dump por separado evita ese falso positivo.
if ! docker exec "$CONTAINER" pg_dump -U postgres sae > "$TMP"; then
  echo "pg_dump falló, no se generó backup" >&2
  rm -f "$TMP"
  exit 1
fi

gzip -c "$TMP" > "$ARCHIVO"
rm -f "$TMP"
echo "Backup guardado en ${ARCHIVO} ($(du -h "$ARCHIVO" | cut -f1))"

# Housekeeping: no dejar que los backups crezcan sin límite en el disco del
# servidor. Restaurar uno: gunzip -c archivo.sql.gz | docker exec -i <container> psql -U postgres sae
find "$BACKUP_DIR" -name 'sae-*.sql.gz' -mtime "+${RETENCION_DIAS}" -delete
