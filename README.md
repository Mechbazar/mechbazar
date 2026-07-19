# MechBazar

MechBazar is an auto-parts e-commerce and doorstep vehicle-service platform, built as an npm-workspaces monorepo:

```
MechBazar/
├── apps/
│   ├── backend/         Express 5 + Prisma + Postgres API (the only backend)
│   ├── mobile/           Customer app (Expo / React Native)
│   ├── admin/             Admin web panel (Vite + React)
│   ├── vendor/             Vendor web panel (Vite + React)
│   ├── rider/               Delivery-partner app (Expo)
│   ├── mechanic/              Doorstep-service technician app (Expo)
│   ├── admin-mobile/            Admin companion app (Expo)
│   └── seller-mobile/             Seller companion app (Expo)
├── packages/shared/      Shared code used by the workspace apps
├── docker-compose.yml    Postgres + Redis + backend + admin + vendor, containerized
└── package.json          Root orchestration scripts (this file)
```

`apps/backend` and `apps/mobile` are **not** npm workspaces (Expo and Prisma both need their own pinned `node_modules`), so they're installed separately -- see below.

---

## 1. Install

```bash
npm run install:all
```

This runs `npm install` at the root (covers `apps/admin`, `apps/vendor`, `apps/rider`, `apps/mechanic`, `apps/admin-mobile`, `apps/seller-mobile`, `packages/shared`), plus a separate `npm install` inside `apps/backend` and `apps/mobile`. The root and mobile installs use `--legacy-peer-deps` — the workspace mixes multiple Expo/React version ranges (e.g. `react@19.2.3` at the root vs `react@19.2.7` in `apps/vendor`) that npm's default resolver treats as conflicting; this is a pre-existing condition of the monorepo, not something this refactor introduced.

## 2. Configure environment variables

Copy each `.env.example` to `.env` (or `.env.local` for the Vite apps) and fill in real values:

| App | File | Notes |
|---|---|---|
| `apps/backend` | `.env.example` → `.env` | **Required.** Server refuses to start without `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`. |
| `apps/mobile` | `.env.example` → `.env` | Optional in dev -- the app auto-detects your dev machine's LAN IP. |
| `apps/admin` | `.env.example` → `.env.local` | Optional in dev -- defaults to `http://<hostname>:5001`. |
| `apps/vendor` | `.env.example` → `.env.local` | Optional in dev -- defaults to `http://localhost:5001`. |

**The backend port is `5001` everywhere by default.** If you change `PORT` in `apps/backend/.env`, update `EXPO_PUBLIC_BACKEND_PORT` / `VITE_BACKEND_PORT` in the frontend `.env` files to match, or the frontends will fail to reach the backend even though it's running.

You also need Postgres and (optionally) Redis reachable at the URLs in `apps/backend/.env`. Easiest path: `docker compose up postgres redis`.

## 3. Run everything

```bash
npm run dev
```

This starts, in one terminal, with colored/prefixed logs:
- **backend** — `apps/backend` on port 5001 (auto-restarts on file changes)
- **mobile** — the Expo dev server for the customer app
- **admin** — the Vite dev server for the admin panel
- **vendor** — the Vite dev server for the vendor panel

Stop everything with `Ctrl+C`; the backend shuts down gracefully (closes its HTTP server, disconnects Prisma and Redis) instead of leaving a dangling process holding the port.

### Running pieces individually

```bash
npm run backend          # apps/backend only
npm run frontend         # apps/mobile only (alias for dev:mobile)
npm run dev:admin        # apps/admin only
npm run dev:vendor       # apps/vendor only
npm run dev:rider        # apps/rider only
npm run dev:mechanic     # apps/mechanic only
npm run dev:admin-mobile
npm run dev:seller-mobile
```

## 4. Production start (backend)

```bash
npm start
```

Runs `apps/backend`'s production script: `prisma db push --accept-data-loss=false && node dist/index.js` (requires `npm --prefix apps/backend run build` first). In practice, production deploys go through Vercel (`npx vercel --prod` from `apps/backend`) or Render (`render.yaml`), not this script directly -- see **Production deployment** below.

---

## Health checks

The backend exposes two endpoints, unauthenticated, at the root (not under `/api`):

- `GET /health` — liveness: process is up. Always 200 once the server has started. `{ status, uptimeSeconds, version, environment }`
- `GET /status` — readiness: liveness plus live DB/Redis checks. Returns 503 if the database is unreachable. `{ status, dependencies: { database, redis } }`

Use `/status` for anything that needs to know "is this instance actually able to serve requests" (load balancer health checks, `docker compose`'s `depends_on: condition: service_healthy`, a quick manual `curl http://localhost:5001/status` when debugging "backend not running").

---

## Production deployment

- **Backend**: Vercel, deployed straight from the working tree — `npx vercel --prod` run from `apps/backend` (project `mechbazar-backend`). Vercel runs the TypeScript source directly via `api/index.ts`; `vercel.json`'s build command is a no-op. There is no git remote wired to this repo, so nothing auto-deploys from a push — you have to run the CLI yourself, and whatever is in your working tree at that moment is what ships.
- **Mobile**: EAS cloud builds from `apps/mobile` — `npx eas-cli build --platform android --profile preview --non-interactive`. The `preview`/`production` profiles in `eas.json` bake in `EXPO_PUBLIC_API_URL=https://mechbazar-backend.vercel.app/api`, so production/preview builds never depend on your dev machine's LAN IP.
- **Render** (`render.yaml`): an alternative Node deploy target for the backend. Not the current production path (see above) but kept working — `PORT` there is fixed at `5000`, independent of the `5001` local-dev default.
- **Docker** (`docker-compose.yml`): full local stack (Postgres, Redis, backend, admin, vendor) with the backend on port `5005` inside that stack specifically. This is intentionally different from the bare `npm run dev` local default (`5001`) -- pick one workflow (native `npm run dev` *or* `docker compose up`) rather than mixing them, since a frontend configured for one won't reach the backend on the other without overriding its `.env`.

After shipping a new backend feature, it is not live for APK/production users until you've run `prisma db push` (and any needed seed scripts) against the **production** database and redeployed — see the Troubleshooting section.

---

## Troubleshooting

**"Backend Not Running" / frontend can't reach the API**
1. Is the backend process actually up? `curl http://localhost:5001/status` (or open it in a browser). If nothing responds, check the backend terminal for a `[FATAL]` line — most commonly a missing env var or `EADDRINUSE` (something else is already using port 5001; find and stop it, or change `PORT`).
2. If `/status` responds but returns `"database": "down"`, Postgres isn't reachable at `DATABASE_URL` — start it (`docker compose up postgres`) or fix the connection string.
3. If the backend is healthy but the app still can't reach it, it's a port/host mismatch: confirm the frontend's configured port (`EXPO_PUBLIC_BACKEND_PORT` / `VITE_BACKEND_PORT`, or their `.env` files) matches the backend's actual `PORT`. This exact mismatch (frontends defaulting to `5000`, backend running on `5001`/`5005` depending on how it was started) was the root cause of most historical "backend not running" reports — it wasn't down, everyone was just pointed at the wrong port.
4. On a physical phone: `localhost` never works from the phone's perspective. `apps/mobile` auto-detects your dev machine's LAN IP from the Expo dev server; if that fails (e.g. VPN, unusual network setup), set `EXPO_PUBLIC_API_URL` explicitly in `apps/mobile/.env`.

**Server exits immediately on `npm run dev` / `npm start`**
Check for a `[FATAL] Missing required environment variable(s): ...` message — copy `apps/backend/.env.example` to `.env` and fill in `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`.

**`EADDRINUSE` on startup**
Another process (often a previous backend instance that didn't shut down cleanly) is already bound to the port. On Windows: `netstat -ano | findstr :5001` then `taskkill /PID <pid> /F`. Prefer `Ctrl+C` (not killing the terminal window) to stop the dev server next time — the graceful-shutdown handler releases the port properly.

**Database connection errors on startup**
The server retries the DB connection every 3 seconds and logs each attempt instead of crashing — check the logged error for the actual cause (wrong credentials, Postgres container not started, network issue) rather than assuming the backend itself is broken.

**Local dev needs Docker Desktop running** for Postgres/Redis unless you've pointed `DATABASE_URL`/`REDIS_URL` at externally-hosted instances.

---

## Seed accounts (local dev database)

- Admin: `admin@mechbazar.com` / `password` (seed via `npx tsx prisma/seed-admin.ts` in `apps/backend`)
- Retail: `retail@mechbazar.com` / `retail123`
- Wholesale: `wholesale@mechbazar.com` / `wholesale123` (business name "Sharma Auto Traders" — wholesale pricing/MOQ)
