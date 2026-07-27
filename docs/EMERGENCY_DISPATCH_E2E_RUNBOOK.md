# Emergency Dispatch — E2E Test Runbook (Hostinger VPS)

Runs the automated test suite (`apps/backend/src/scripts/e2e-dispatch-test.ts`)
against a **fully isolated** Postgres + backend instance on the VPS. It never
touches the production database, the production `mechbazar` Docker Compose
project, or the production Postgres instance running natively on the host.
Everything here lives in its own Docker network and is torn down at the end.

Why this shape: Claude has no shell access to the VPS (only the Hostinger
Docker/VPS management API, which lists/inspects containers but cannot execute
arbitrary commands), so these are commands for **you** to run over SSH. Every
step is copy-pasteable in order.

## 0. What you need

- SSH access to `srv1848001.hstgr.cloud` (200.141.2.27), the VM already
  running the production `mechbazar` Compose project.
- Your production Firebase Admin SDK credentials (`FIREBASE_PROJECT_ID`,
  `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) — reused only because
  `config/env.ts` refuses to boot without them. The test suite never
  exercises phone auth (it mints JWTs directly with a throwaway secret), so
  this is just satisfying a startup check, not a real dependency.

## 1. Copy the code to the VPS, into its own directory

**Do NOT `git push` this branch to `main`** — this repo auto-deploys `main`
to production (backend/admin/vendor) on push. Copy the working tree directly
instead, so nothing touches GitHub or the deploy pipeline until you've
reviewed it.

From your Windows machine (PowerShell), from the repo root:

```powershell
# Package the backend + the shared package it needs (skip node_modules/dist —
# rebuilt fresh on the VPS).
tar --exclude="node_modules" --exclude="dist" --exclude=".git" -czf mechbazar-e2e.tar.gz apps/backend packages/shared

scp mechbazar-e2e.tar.gz root@200.141.2.27:/opt/mechbazar-e2e-test.tar.gz
```

On the VPS:

```bash
ssh root@200.141.2.27

mkdir -p /opt/mechbazar-e2e-test
tar -xzf /opt/mechbazar-e2e-test.tar.gz -C /opt/mechbazar-e2e-test
cd /opt/mechbazar-e2e-test
```

## 2. Create an isolated Docker network + test Postgres

```bash
docker network create mechbazar-e2e-net

docker run -d --name mechbazar-e2e-pg \
  --network mechbazar-e2e-net \
  -e POSTGRES_USER=e2e \
  -e POSTGRES_PASSWORD=e2e_throwaway_pw \
  -e POSTGRES_DB=mechbazar_e2e_test \
  postgres:16

# Wait for it to accept connections (~5-10s).
sleep 8
docker exec mechbazar-e2e-pg pg_isready -U e2e
```

This Postgres container is brand new, on its own Docker network, with no
port published to the host or the internet — it is unreachable from
anywhere except containers on `mechbazar-e2e-net`. It is entirely separate
from the production Postgres instance running natively on this same VM.

## 3. Build the backend image and push the schema

```bash
cd /opt/mechbazar-e2e-test/apps/backend
docker build -t mechbazar-e2e-backend .
```

Create an env file for the test run — **fill in your real Firebase values,
everything else can stay exactly as shown**:

```bash
cat > /opt/mechbazar-e2e-test/e2e.env <<'EOF'
NODE_ENV=development
PORT=5099
DATABASE_URL=postgresql://e2e:e2e_throwaway_pw@mechbazar-e2e-pg:5432/mechbazar_e2e_test?schema=public
JWT_SECRET=e2e-throwaway-secret-do-not-use-in-prod-32chars-min
REDIS_URL=
FIREBASE_PROJECT_ID=REPLACE_ME
FIREBASE_CLIENT_EMAIL=REPLACE_ME
FIREBASE_PRIVATE_KEY="REPLACE_ME"
GOOGLE_MAPS_SERVER_API_KEY=
# Tightened so the NO_MECHANIC_FOUND section of the test finishes in ~15s
# instead of the production default (~100s across 3 waves at 30s each).
DISPATCH_WAVE_RADII_KM=5,10
DISPATCH_OFFER_TTL_SECONDS=5
DISPATCH_MAX_PER_WAVE=8
DISPATCH_STALE_LOCATION_SECONDS=300
JOB_OTP_SECRET=e2e-throwaway-otp-secret
EOF
```

Push the new schema to the test database (no migration history needed for a
throwaway DB):

```bash
docker run --rm \
  --network mechbazar-e2e-net \
  --env-file /opt/mechbazar-e2e-test/e2e.env \
  mechbazar-e2e-backend \
  npx prisma db push --accept-data-loss
```

You should see `Your database is now in sync with your Prisma schema.`

## 4. Start the test backend

```bash
docker run -d --name mechbazar-e2e-backend \
  --network mechbazar-e2e-net \
  --env-file /opt/mechbazar-e2e-test/e2e.env \
  mechbazar-e2e-backend

sleep 3
docker logs mechbazar-e2e-backend --tail 30
```

You're looking for `[startup] Server is running on port 5099` and
`[db] Connected to database`. If Firebase credentials were wrong you'll see
a `[FATAL]` line — fix `e2e.env` and re-run this step.

## 5. Run the E2E suite

```bash
docker run --rm \
  --network mechbazar-e2e-net \
  --env-file /opt/mechbazar-e2e-test/e2e.env \
  -e E2E_API_URL=http://mechbazar-e2e-backend:5099/api \
  mechbazar-e2e-backend \
  node dist/scripts/e2e-dispatch-test.js
```

Expect output like:

```
🚨 MechBazar Emergency Dispatch E2E — run <id>
   API: http://mechbazar-e2e-backend:5099/api

▶ Connectivity: health check
  ✅ GET /api/health returns 200 (backend reachable)

▶ Security: unauthenticated + wrong-role requests are rejected
  ✅ GET /jobs/active with no token -> 401
  ✅ GET /jobs/offers as CUSTOMER -> 403 (mechanic-only)
  ✅ POST /jobs with scheduledDate -> 400 NOT_SCHEDULABLE (instant-only enforced)

▶ Sockets: connect as customer + both mechanics
  ...

============================================================
RESULT: 47 passed, 0 failed
============================================================
```

Exit code is `0` on full pass, `1` if anything failed (with a printed list of
which assertions failed) — safe to check with `echo $?` or wire into a CI
step later.

## 6. Tear down

Everything created above is disposable. Remove it all:

```bash
docker rm -f mechbazar-e2e-backend mechbazar-e2e-pg
docker network rm mechbazar-e2e-net
docker image rm mechbazar-e2e-backend
rm -rf /opt/mechbazar-e2e-test /opt/mechbazar-e2e-test.tar.gz
```

Production (`mechbazar_backend`, `mechbazar_admin`, `mechbazar_mobile`,
`mechbazar_vendor`, and the native Postgres instance) was never touched by
any of the above — different network, different containers, different
database, different port, nothing published beyond the isolated Docker
network.

## Troubleshooting

- **`docker: command not found`** — this VPS runs production via Docker
  Compose already (confirmed via the Hostinger API), so Docker is installed;
  if this happens you're likely not on the right host.
- **`prisma db push` hangs or times out** — check
  `docker logs mechbazar-e2e-pg`; give the container a few more seconds to
  finish initializing before retrying.
- **E2E run times out waiting for `offer:new`** — almost always a
  coordinates issue: the seeded mechanics/customer are all within a few km
  of each other in Bengaluru by default (see `CUSTOMER_LOC`/`MECH_A_LOC`/
  `MECH_B_LOC` in the script) and `DISPATCH_WAVE_RADII_KM=5,10` comfortably
  covers that. If you changed those constants, make sure the radii still
  reach them.
- **Re-running after a partial failure** — the script cleans up its own
  seeded rows in a `finally` block even on failure, so re-running immediately
  is safe. If a run was killed hard (e.g. `docker kill`), stray rows can be
  removed with:
  `docker exec mechbazar-e2e-pg psql -U e2e -d mechbazar_e2e_test -c "DELETE FROM \"User\" WHERE phone LIKE '9%0001' OR phone LIKE '9%0002' OR phone LIKE '9%0003' OR phone LIKE '9%0004';"`
  (cascades will need the same explicit-delete-order the script uses if
  bookings exist — see `cleanup()` in the script for the exact order).
