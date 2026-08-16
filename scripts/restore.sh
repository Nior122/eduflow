#!/usr/bin/env bash
# EduFlow — restore a database dump.
# Usage: ./scripts/restore.sh backups/eduflow-<timestamp>.sql[.gz]
# Requires: psql on PATH and DATABASE_URL in the environment.
set -euo pipefail

FILE="${1:?usage: restore.sh <dump file>}"
URL="${DATABASE_URL:?DATABASE_URL is required}"

if [[ ! -f "$FILE" ]]; then
  echo "error: $FILE does not exist" >&2
  exit 1
fi

echo "Restoring $FILE into $URL ..."
if [[ "$FILE" == *.gz ]]; then
  gunzip -c "$FILE" | psql "$URL"
else
  psql "$URL" < "$FILE"
fi
echo "Restore complete."
