# Commits that existed only on the production VPS

On 2026-07-28, deploying the wordmark logo required resetting the VPS working
copy at `/opt/mechbazar` to `origin/main`. That copy was **three commits ahead
of GitHub** — work committed directly on the server and never pushed. This file
records what those commits were, where they went, and what still needs a
decision, so none of it is lost.

## Why this happened

The VPS repo is a full clone with `origin` pointing at
`github.com/Mechbazar/mechbazar`, and people had been committing into it
directly. Nothing pushes from the server, so those commits existed in exactly
one place: a directory on a single host, with no backup.

## Where the commits are now

Nothing was deleted. All three are recoverable from the production VPS:

| Ref | What it is |
|---|---|
| `vps-local-backup-2026-07-28` | Branch pinned to the pre-reset HEAD (`71c350d`) |
| `vps-state-before-logo-deploy` | Tag on the same commit |
| `/root/mechbazar-vps-20260728-1918.bundle` | 24 MB `git bundle --all`, a complete standalone copy |

To inspect or recover:

```bash
ssh mechbazar-vps
cd /opt/mechbazar
git log vps-local-backup-2026-07-28

# or, from anywhere, treat the bundle as a remote:
git clone /root/mechbazar-vps-20260728-1918.bundle recovered
```

⚠️ The bundle lives on the same host as the repo it backs up. If that host is
lost, so is the bundle. Copy it somewhere else if these commits still matter.

## The three commits

### `d6af26c` — "Fix Expo configuration and local build issues" (2026-07-27)
48 files, +7369 / −505. The message undersells it: alongside Expo config this
carries the whole emergency-dispatch backend — `dispatch.service.ts`,
`job.controller.ts`, `jobAdmin.controller.ts`, the realtime gateway and events,
Prisma schema changes, and the admin panel's LiveOps screens.

**Status: already in `main`, by a different route.** The same work reached the
repo through the `expo-dev-client-builds` branch. Comparing every one of the 54
files that differed between the VPS and that branch: **39 byte-identical, 0
missing**, and the 15 differences were all build config plus two inert
`.vps-backup` files. No functionality from this commit was lost.

### `8d559c2` — "Build production APKs (not AAB) and inject Maps key" (2026-07-28)
3 files: `apps/{mobile,rider,seller-mobile}/eas.json`.

**Status: deliberately superseded — needs your call.** This pinned the
production profile to `buildType: "apk"`. `main` now does the opposite: the
production profiles build `app-bundle`, because Play rejects APK uploads for
new apps and Play distribution is the only thing that removes the reCAPTCHA
browser step from phone-OTP login.

If local APK artifacts are still wanted, take them from the `preview` profile,
which builds an installable APK. Do not repoint `production` back at `apk`
without also giving up the Play route.

### `71c350d` — "Point rider/mechanic/seller EAS project IDs at the mechbazar account" (2026-07-28)
3 files: `apps/mechanic/app.json`, `apps/rider/app.json`,
`apps/seller-mobile/app.config.js`.

**Status: already in `main`, verified.** Compared the IDs this commit wrote
against what `main` carries today — all three match exactly:

| App | Project ID |
|---|---|
| mechanic | `d126f519-e4c8-478e-92c2-891f0a6db7e3` |
| rider | `feb7d6d9-305e-432e-82bf-08331cfb3402` |
| seller-mobile | `a10f3278-fe1d-4992-8b9a-f424028408ec` |

Nothing to recover; the reset cost this commit nothing.

## Stopping this recurring

The VPS should be a deployment target, not a place work originates. Two rules:

1. **Never commit on the server.** Change code locally, push, then pull on the
   VPS. `git status` on the VPS should always be clean apart from untracked
   build artifacts.
2. **Check before deploying.** `git log origin/main..HEAD` on the VPS must be
   empty. If it is not, something exists only there — push or bundle it before
   any reset.

The VPS working copy currently has untracked build artifacts (`APK-DOWNLOADS/`,
several `build-*.apk`, `apps/mobile/Task`, `apps/admin-mobile/SDK`). They are
untracked, so a reset leaves them alone, but they do bloat the Docker build
context — see the exclusions added to `.dockerignore`.
