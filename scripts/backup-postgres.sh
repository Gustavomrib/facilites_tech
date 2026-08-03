#!/usr/bin/env bash
# Dumps the database at DATABASE_URL to a timestamped, gzip-compressed file.
# Portable: runs equally in CI (backup.yml, uploading the result as a build
# artifact) or on a cron on the DB host itself, wherever it's invoked from.
#
# Usage: DATABASE_URL=postgresql://... backup-postgres.sh [output_dir]
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"

# Prisma's DATABASE_URL uses "?schema=public" to pick the default schema — a
# Prisma-specific extension, not a real libpq URI parameter. pg_dump rejects
# it outright ("invalid URI query parameter: schema"), so it has to be
# stripped before use. This app only ever uses the "public" schema, which
# pg_dump includes by default with no flag needed.
PG_DUMP_URL="${DATABASE_URL%%\?*}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
out_file="$OUT_DIR/meu-negocio-no-bolso-${timestamp}.sql.gz"

echo "Dumping database to $out_file..."
pg_dump "$PG_DUMP_URL" --no-owner --no-privileges | gzip > "$out_file"

size=$(du -h "$out_file" | cut -f1)
echo "Backup written: $out_file ($size)"
