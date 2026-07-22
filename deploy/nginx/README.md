# Nginx configuration snapshot

These files are a reference copy of the live Nginx site configs on the production VPS
(`/etc/nginx/sites-available/`). They are **not deployed from this repo** — the VPS is
still the source of truth at runtime. This directory exists so the repo reflects what's
actually running in production, for disaster recovery and onboarding.

If you change Nginx config on the VPS, update these files to match (or vice versa).

| File | Domain(s) | Proxies to |
|---|---|---|
| `mechbazar` | `mechbazar.com`, `www.mechbazar.com` | `/api/` and `/uploads/` -> backend (5005), everything else -> Customer App (3002) |
| `admin` | `admin.mechbazar.com` | Admin panel (3000) |
| `vendor` | `vendor.mechbazar.com` | Vendor panel (3001) |

SSL certificates for all three are issued via Let's Encrypt / Certbot with automatic renewal.
