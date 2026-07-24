#!/usr/bin/env bash
# Run on the Hostinger VPS (/opt/mechbazar) to deploy the latest code and fix
# the backend->Postgres Docker networking issue (backend container can't
# reach Postgres via `localhost` because that resolves to the container
# itself, not the VPS host).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 1. Pull latest code =="
git status --short
git pull origin main

echo "== 2. Let the backend container reach the VPS's local Postgres =="
if ! grep -q "host.docker.internal:host-gateway" docker-compose.yml; then
  sed -i '/container_name: mechbazar_backend/a\    extra_hosts:\n      - "host.docker.internal:host-gateway"' docker-compose.yml
fi
sed -i -E 's#(DATABASE_URL="postgresql://[^@]+@)(localhost|127\.0\.0\.1)(:5432)#\1host.docker.internal\3#' apps/backend/.env
sed -i '/^DIRECT_URL=/d' apps/backend/.env
grep -E "DATABASE_URL|extra_hosts|host.docker.internal" docker-compose.yml apps/backend/.env

echo "== 3. Let Postgres accept connections from the docker bridge =="
NET=$(docker network ls --format '{{.Name}}' | grep mechbazar | grep -v 'bridge$' | head -1)
SUBNET=$(docker network inspect "$NET" --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}')
echo "Docker network: $NET  Subnet: $SUBNET"

PG_CONF=$(sudo find /etc/postgresql -maxdepth 3 -name postgresql.conf | head -1)
PG_HBA="$(dirname "$PG_CONF")/pg_hba.conf"
echo "Postgres config: $PG_CONF"

sudo sed -i "s/^#*listen_addresses.*/listen_addresses = '*'/" "$PG_CONF"
grep -q "$SUBNET" "$PG_HBA" || echo "host    mechbazar    all    $SUBNET    md5" | sudo tee -a "$PG_HBA"
sudo systemctl restart postgresql
sudo systemctl status postgresql --no-pager | head -5

if command -v ufw >/dev/null && sudo ufw status | grep -q "Status: active"; then
  echo "UFW is active -- allowing $SUBNET to reach Postgres"
  sudo ufw allow from "$SUBNET" to any port 5432 proto tcp
fi

echo "== 4. Rebuild and restart the whole stack with the new code + config =="
docker compose up -d --build

echo "== 5. Verify =="
sleep 8
docker compose ps
echo "--- backend health (local) ---"
curl -sf http://127.0.0.1:5005/health && echo " <- backend OK" || { echo " <- backend still failing"; docker compose logs backend --tail 50; }
echo "--- nginx ---"
sudo systemctl status nginx --no-pager | head -5
sudo nginx -t
