#!/usr/bin/env bash
# Run on the Hostinger VPS. Restores production data from Neon (the DB in
# use as of commit 792d817, 2026-07-22) into the fresh local Hostinger
# Postgres instance, which currently has the right schema but zero rows.
set -euo pipefail

LOCAL_DB_USER="mechbazar"
LOCAL_DB_NAME="mechbazar"
LOCAL_DB_HOST="localhost"
# Fill in from the local .env's DATABASE_URL if this doesn't match:
LOCAL_DB_PASSWORD="Mechbazargoal@9699"

echo "== Step 1: checking for an existing dump file already on this VPS =="
EXISTING=$(sudo find / -xdev \( -iname "*neon*dump*" -o -iname "*neon*backup*" -o -iname "*mechbazar*.sql" -o -iname "*mechbazar*.dump" \) -not -path "/opt/mechbazar/deploy/*" 2>/dev/null | head -20)
if [ -n "$EXISTING" ]; then
  echo "Found candidate dump file(s):"
  echo "$EXISTING"
  echo "If one of these is the real backup, skip to Step 3 and restore it directly instead of re-dumping from Neon."
else
  echo "No existing dump found on disk."
fi

echo ""
echo "== Step 2: dump from Neon =="
echo "Fill in NEON_DATABASE_URL below (from the Neon dashboard -> your project"
echo "-> Connection Details -> use the DIRECT / unpooled connection string,"
echo "not the pooled one) before running this script for real."
NEON_DATABASE_URL="postgresql://<user>:<password>@<your-project>.neon.tech/<dbname>?sslmode=require"

if [[ "$NEON_DATABASE_URL" == *"<user>"* ]]; then
  echo "STOP: edit this script and fill in NEON_DATABASE_URL first (nano deploy/vps-migrate-neon-data.sh)."
  exit 1
fi

pg_dump --no-owner --no-privileges --clean --if-exists "$NEON_DATABASE_URL" > /tmp/neon_backup.sql
ls -lh /tmp/neon_backup.sql

echo ""
echo "== Step 3: restore into local Hostinger Postgres =="
PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -f /tmp/neon_backup.sql

echo ""
echo "== Step 4: verify row counts =="
PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c \
  'SELECT '"'"'User'"'"' AS "table", count(*) FROM "User"
   UNION ALL SELECT '"'"'Product'"'"', count(*) FROM "Product"
   UNION ALL SELECT '"'"'Order'"'"', count(*) FROM "Order";'

echo ""
echo "== Step 5: restart the backend so it's using a warm connection pool against the restored data =="
cd /opt/mechbazar
docker compose restart backend
sleep 5
curl -sf http://127.0.0.1:5005/status && echo
