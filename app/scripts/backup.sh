#!/usr/bin/env bash
set -euo pipefail
# Backup: pg_dump to a timestamped file in ./backups/
# Usage: npm run db:backup
# Requires: docker compose ps db | grep "healthy"

BACKUP_DIR="$(dirname "$0")/../../backups"
mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/gradientrip-$TS.sql.gz"

echo "Dumping database to $FILE..."
docker compose exec -T db pg_dump -U gradientrip gradientrip | gzip > "$FILE"

echo "Backup complete: $FILE"
ls -lh "$FILE"
