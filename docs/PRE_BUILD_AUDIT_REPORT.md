# MechBazar — Pre-Build Production Audit (Pass 2)

**Audit date:** 2026-07-26
**Constraint honoured:** no APK/AAB/IPA/EAS build was created, no build profile
was modified, no release process was started. `eas.json` is untouched.

**Payment model:** Cash on Delivery only — re-verified across **all 8 projects**
this pass, not just the customer app and backend.

**Verification:** all 8 projects `tsc --noEmit` **clean**; `expo config --type
prebuild` **resolves**; 0 broken relative imports found in mobile or backend.

> This is the second pass. Pass 1 ([PRODUCTION_READINESS_REPORT.md](PRODUCTION_READINESS_REPORT.md))
> covered Expo config, plugins, permissions, account deletion, COD enforcement
> and the core security fixes. This pass covers what pass 1 did not: error
> handling, production logging, dead code, the other six apps, Firebase Storage
> rules, and runtime crash paths.

---

## ✅ Fixed This Pass

### 1. 🔴 Production API-server override shipped in the released app

**[`WelcomeScreen.tsx`](../apps/mobile/src/screens/auth/WelcomeScreen.tsx)** — a
gear icon on the **login screen**, present in every build, opened an "API Server
Configuration" modal letting anyone repoint the app's backend to an arbitrary
URL.

This is not untidiness. The login flow posts the phone number and the **Firebase
ID token** — the credential the real backend trusts — to whatever host is
configured. A single *"tap settings and paste this URL"* support-impersonation
call hands an attacker a working session. It is also precisely the
development/test functionality Apple rejects under Guideline 2.1.

Both entry points are now gated behind `DEV_TOOLS_ENABLED = __DEV__`, which
compiles them out of release bundles entirely. Confirmed the override was
component-local `useState` and never persisted, so no stale value can survive.

### 2. 🔴 No React error boundary anywhere in the app

Any render-phase exception — one null field in an API response — unmounted the
entire tree to a blank screen with no recovery but a force-quit. Both stores
treat that as a crash.

Added [`ErrorBoundary.tsx`](../apps/mobile/src/components/shared/ErrorBoundary.tsx),
wrapped **outside** the Redux `Provider` in `App.tsx` so a store-hydration
failure is caught too. Shows a branded recovery screen with a "Try Again" that
remounts the subtree; logs via `console.error` (deliberately preserved by the
console-stripping below) so a crash reporter can pick it up later.

### 3. 🟠 Firebase Storage rules were never deployable

`firebase/storage.rules` correctly locks client writes to nobody — but there was
**no `firebase.json` anywhere in the repo**, so the file has never been
deployable and the bucket has been running whatever the console has.

The Firebase console default for a new bucket is
`allow read, write: if request.auth != null` — meaning **any customer who can
complete phone-OTP login could write arbitrary objects straight into the
bucket**, bypassing the backend's mimetype allowlist and 5 MB cap entirely.

Created [`firebase.json`](../firebase.json) wiring the rules, and documented the
exposure in the rules file itself. `firebase deploy --only storage` now works
(one CLI command — see Manual Actions).

### 4. 🟠 5xx responses leaked internal error detail

[`errorHandler.ts`](../apps/backend/src/middlewares/errorHandler.ts) returned
`err.message` verbatim for 500s. For Prisma that routinely includes failing SQL,
table and column names, constraint names, and sometimes the offending values — a
free schema map for an attacker. Production 5xx now returns a generic
`Internal server error`; 4xx messages (ours, written for users) still pass
through. Stack traces remain non-production only.

### 5. 🟠 Debug logging shipped in release bundles

React Native does **not** strip `console.*` — everything logged in a release
build is readable over `adb logcat`/Console.app to anyone with the device, and
is swept up by any log collector.

- [`notifications.ts`](../apps/mobile/src/services/notifications.ts) logged the
  **full Expo push token**. Anyone reading it can push arbitrary notifications
  to that device. Now logs only that registration succeeded.
- Added [`babel.config.js`](../apps/mobile/babel.config.js) (none existed) with
  `transform-remove-console` in production, **excluding `error` and `warn`** —
  they are the only production-diagnostics channel this app has. Verified the
  config emits the plugin only when `NODE_ENV=production`.

### 6. 🟠 PII written into backend logs

Two handlers logged `JSON.stringify(req.body)` on failure:
`customer.controller.ts` (garage vehicle — **registration number**) and
`service.controller.ts` (booking — address id, registration number, free-text
issue description). Both now log **field names only**.

### 7. 🟠 Unbounded authenticated file upload

`POST /api/upload` is open to every role including `CUSTOMER`, and each request
writes up to 5 MB into a publicly-readable bucket nothing garbage-collects.
Under the global limit alone one account could push ~3 GB per 15 minutes. Added
a per-token bucket of 40 / 15 min.

### 8. 🟡 Deep-link crash vector introduced by pass 1

Adding `scheme: 'mechbazar'` made `StaticPageScreen` reachable from an external
link carrying an arbitrary `page` param. `STATIC_PAGES[route.params.page]` was
unguarded — an unknown key threw on `content.title` and white-screened the app.
Now falls back to a real page. Swept the rest of the app: **no other unguarded
`route.params.*` usage exists.**

### 9. 🟡 Dead dependencies

`cheerio` — a web-scraping library with **zero imports** — removed from the
backend's production dependencies. `@types/multer` moved from `dependencies` to
`devDependencies` where it belongs. Backend still typechecks clean.

### 10. 🟡 COD type narrowing + stale Firebase comment

- `service.service.ts` declared `payment_method: 'COD' | 'online'`. Narrowed to
  `'COD'` so no future caller can construct a payload implying online payment
  exists.
- `services/firebase.ts` carried a stale *"USER ACTION REQUIRED: Replace these
  with your actual Firebase config"* banner over long-correct values. Rewritten
  to source from `EXPO_PUBLIC_FIREBASE_*` env vars with the current project as
  defaults — matching the pattern `apps/admin` already uses — and documented as
  the **web-only** path (native goes through RN Firebase).

---

## ✅ Verified Clean — No Action Needed

| Area | Finding |
|---|---|
| **TypeScript** | All 8 projects `tsc --noEmit` clean: backend, mobile, admin, vendor, mechanic, rider, admin-mobile, seller-mobile |
| **Broken imports** | **Zero** unresolvable relative imports across mobile (115 files) and backend (81 files) |
| **COD across all apps** | Every `UPI` hit in admin/rider/admin-mobile is a **rider payout UPI ID** — how MechBazar *pays partners*, unrelated to customer payment. No customer-facing online-payment path anywhere |
| **Product checkout** | `CartScreen` already renders a single non-interactive "Cash on Delivery" row — correct |
| **Committed secrets** | Only `.env.example` files are tracked. No `.env`, no service account, no `.p8`/`.p12`/keystore |
| **Upload hardening** | Extension derived from validated mimetype, not the client filename — closes the stored-XSS vector. Memory storage, 5 MB cap, auth required |
| **Storage rules content** | Correct: public read, client writes denied (Admin SDK bypasses) |
| **Policy page wiring** | 11 `STATIC_PAGES` keys — **0 defined-but-unreachable, 0 linked-but-undefined**. All reachable from `AccountScreen` (native) and `DesktopFooter` (web) |
| **Deep-link exposure** | No `linking` config on `NavigationContainer`, so the new scheme opens the app but cannot route to arbitrary screens |
| **Session persistence** | Hydrates from AsyncStorage, refreshes on login transitions, `sessionGuard` patches global `fetch` to force logout on any 401. Confirmed imported at `App.tsx:16` |
| **Other apps' debug UI** | No API-override or debug surfaces in admin, vendor, rider, mechanic, admin-mobile, seller-mobile |
| **HTTPS** | `helmet()` sets HSTS by default; `usesCleartextTraffic`/ATS now deny plaintext outside the development profile (pass 1) |

---

## ⚠ Manual Actions Still Required

Only **one** new item this pass, and it is a single CLI command — no console
click-through.

### New

**N1 — Deploy the Storage rules** *(one command, no console)*

```bash
firebase deploy --only storage --project mech-bazar-8fd86
```

Until this runs, the bucket may still be on the console default that lets any
signed-in customer write to it directly. Confirm afterwards in Firebase Console
→ Storage → Rules that `allow write: if false` is live.

### Carried forward from pass 1 (unchanged)

| # | Action | Why it can't be done from the repo |
|---|---|---|
| M1 | Register Android **SHA-1/SHA-256** in Firebase, re-download `google-services.json` | `certificate_hash` is empty for every client → **phone OTP fails in release builds**. Needs the signing key fingerprints |
| M2 | Add **`GoogleService-Info.plist`** + register an iOS app in Firebase | RN Firebase cannot initialise → iOS login non-functional. `app.config.js` already references it conditionally |
| M3 | Provision the **reviewer test number** (Firebase fictional number) | See [store-reviewer-access.md](legal/store-reviewer-access.md) |
| M4 | Run `npx prisma db push` | Adds `User.deletedAt` / `deletionReason`; deletion endpoint 500s without it |
| M5 | `eas secret:create EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Not in the repo; production builds otherwise ship with maps silently disabled |
| M6 | Set `JWT_SECRET` (≥32 random chars) and `CORS_ALLOWED_ORIGINS` in production | Both now log `[SECURITY]` at boot when weak/unset |
| M7 | Fill placeholders in `docs/legal/` and publish the pages | Reviewers open them logged out from a desktop browser |
| M8 | Delete or quarantine the stray root `/app.json` + `/eas.json` | They declare package `com.tanu40647.mechbazarworkspace`; building from the repo root produces a phantom app. **Tracked files — deletion is your call** |
| M9 | Decide on iPad support (`ios.supportsTablet`) | Product decision |
| M10 | Firebase console hardening: Blaze billing, **SMS region → India only**, budget alert | SMS-pumping fraud defence |

---

## ❌ Remaining Blockers

**No code blocks a build.** All 8 projects typecheck clean and the Expo config
resolves with every plugin. Every remaining blocker is credential- or
console-side, unchanged from pass 1:

| # | Blocker | Consequence |
|---|---|---|
| 1 | Android SHA fingerprints unregistered | **Phone OTP fails in release builds** — real users cannot log in |
| 2 | No `GoogleService-Info.plist` | **iOS cannot ship** |
| 3 | No reviewer test number | Rejection under Apple 2.1 / Play App Access |
| 4 | `prisma db push` not run in production | Account deletion 500s → Apple 5.1.1(v) |
| 5 | Policy pages not published at public URLs | Both stores |

---

## Flagged, Deliberately Not Changed

These need a build to verify, and the brief was explicitly no-build. Each is
safe to action later:

| Item | Detail | Recommendation |
|---|---|---|
| `@react-native-firebase/messaging` | **Zero imports.** Push uses `expo-notifications`; the web path uses `firebase/messaging` (JS SDK), a different package. This is an autolinked native module carrying its own weight for nothing | Remove, then rebuild and confirm Android push still arrives |
| `react-native-webview` | **Zero imports.** Good news for Apple 4.2 (nothing core is a web wrapper), but it is dead native weight | Remove, then rebuild |
| `expo-dev-client` | In `dependencies`, so autolinked into every build including production | Verify the production profile excludes it, or move to `devDependencies` |
| `userInterfaceStyle: 'light'` | `themeSlice` supports dark; native components stay light when the JS theme goes dark | Set `'automatic'` and re-test screens |
| Root `package.json` `overrides` | Keys `"admin"`/`"vendor"` are **package names, not workspace names** (`admin` is a real npm package). These blocks are no-ops | Remove or rewrite |
| `apps/mobile` outside `workspaces` | Deps hoist to root `node_modules` anyway — the same duplicate-package class that caused the earlier `Component auth is not registered` incident | Works today; fragile |
| Backend `src/scripts/*` (11 files) | Standalone `tsx` CLI scripts, correctly not imported. `test_api_flow.ts` logs an OTP from a response shape that no longer exists post-Firebase-only auth | Prune `test_api_flow.ts` when convenient |

---

## Still Untested — Needs a Real Device Run

Verified by typecheck and config resolution only:

1. **Account deletion end to end** — delete a throwaway account; confirm the
   number can register fresh, the old JWT 401s, orders survive as
   `"Deleted User"`, push stops.
2. **The 409 path** — place an order, attempt deletion, expect the
   "finish your active orders first" alert.
3. **iOS camera/gallery** — previously crashed; needs M2 first.
4. **ErrorBoundary** — force a render throw and confirm the recovery screen and
   "Try Again" behave.
5. **Console stripping** — confirm a release bundle has no `console.log` but
   retains `console.error`.
6. **`authenticate` latency** — now one indexed PK lookup per authenticated
   request (~1 ms expected). Watch p99 after deploy. If it ever matters, cache
   it — but do **not** remove the deleted-account check.
7. **`edgeToEdgeEnabled: true`** — check main screens on an Android 15 device.

---

## Changed This Pass

**Backend (5):** `package.json`, `src/index.ts`,
`src/middlewares/errorHandler.ts`, `src/controllers/customer.controller.ts`,
`src/controllers/service.controller.ts`

**Mobile (7):** `App.tsx`, `babel.config.js` *(new)*, `package.json`,
`src/components/shared/ErrorBoundary.tsx` *(new)*,
`src/screens/auth/WelcomeScreen.tsx`, `src/screens/StaticPageScreen.tsx`,
`src/services/firebase.ts`, `src/services/notifications.ts`,
`src/services/service.service.ts`

**Root (2):** `firebase.json` *(new)*, `firebase/storage.rules`

**Docs (1):** this report
