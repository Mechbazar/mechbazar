#!/usr/bin/env bash
set -euo pipefail
cd /opt/mechbazar

echo "== Current DATABASE_URL line (before) =="
grep '^DATABASE_URL=' apps/backend/.env

# Quote-agnostic this time: matches DATABASE_URL=..., with or without
# surrounding quotes, as long as the host is localhost or 127.0.0.1.
sed -i -E 's/^(DATABASE_URL=.*@)(localhost|127\.0\.0\.1)(:5432)/\1host.docker.internal\3/' apps/backend/.env
sed -i '/^DIRECT_URL=/d' apps/backend/.env

echo "== DATABASE_URL line (after) =="
grep '^DATABASE_URL=' apps/backend/.env

if grep -q '^DATABASE_URL=.*host\.docker\.internal' apps/backend/.env; then
  echo "OK -- host.docker.internal is now in DATABASE_URL"
else
  echo "STILL NOT FIXED -- paste the 'before' line above, the format doesn't match what this script expects"
  exit 1
fi

echo "== Recreating the backend container so it picks up the new .env =="
docker compose up -d --force-recreate backend

echo "== Waiting for it to settle =="
sleep 8
docker compose ps backend
echo "--- backend logs (last 30 lines) ---"
docker compose logs backend --tail 30
echo "--- local health/status ---"
curl -sf http://127.0.0.1:5005/status && echo
