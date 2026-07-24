#!/usr/bin/env bash
# Run on the Hostinger VPS. The precleanup Neon backup at
# /root/mechbazar_precleanup_backup_20260722_165806/db/mechbazar_neon_backup.dump
# was made with pg_dump from Postgres 17 (archive format 1.16); this VPS
# only has Postgres 16 client tools, which can't read it. Installs just the
# PG17 client (not the server -- the running PG16 server stays as-is) from
# the official PGDG apt repo and restores with that.
set -euo pipefail

DUMP_FILE="/root/mechbazar_precleanup_backup_20260722_165806/db/mechbazar_neon_backup.dump"
LOCAL_DB_USER="mechbazar"
LOCAL_DB_NAME="mechbazar"
LOCAL_DB_HOST="localhost"
LOCAL_DB_PASSWORD="Mechbazargoal@9699"

echo "== Installing Postgres 17 client tools (PGDG repo) =="
sudo apt-get install -y curl ca-certificates gnupg
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
CODENAME=$(lsb_release -cs)
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt ${CODENAME}-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt-get update
sudo apt-get install -y postgresql-client-17

PG_RESTORE_17="/usr/lib/postgresql/17/bin/pg_restore"
if [ ! -x "$PG_RESTORE_17" ]; then
  echo "ERROR: $PG_RESTORE_17 not found after install"
  exit 1
fi
"$PG_RESTORE_17" --version

echo ""
echo "== Restoring $DUMP_FILE into local Postgres 16 server =="
PGPASSWORD="$LOCAL_DB_PASSWORD" "$PG_RESTORE_17" --no-owner --no-privileges --clean --if-exists \
  -h "$LOCAL_DB_HOST" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" "$DUMP_FILE"

echo ""
echo "== Row counts after restore =="
PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c \
  'SELECT '"'"'User'"'"' AS "table", count(*) FROM "User"
   UNION ALL SELECT '"'"'Product'"'"', count(*) FROM "Product"
   UNION ALL SELECT '"'"'Order'"'"', count(*) FROM "Order";'

echo ""
echo "== Restarting backend =="
cd /opt/mechbazar
docker compose restart backend
sleep 5
curl -sf http://127.0.0.1:5005/status && echo
