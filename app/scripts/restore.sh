#!/usr/bin/env bash
set -euo pipefail
# Restore: load a backup into the running db container
# Usage: npm run db:restore -- backups/gradientrip-20240910-120000.sql.gz
# WARNING: drops and recreates the database.

if [ -z "${1:-}" ]; then
    echo "Usage: npm run db:restore -- <backup-file>"
    exit 1
fi

FILE="$1"
if [ ! -f "$FILE" ]; then
    echo "File not found: $FILE"
    exit 1
fi

echo "Restoring from $FILE..."
gunzip -c "$FILE" | docker compose exec -T db psql -U gradientrip gradientrip

echo "Restore complete."
