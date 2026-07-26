# MechBazar — Production Readiness Report

**Audit date:** 2026-07-26
**Scope:** Expo config, React Native app, Node/Express backend, PostgreSQL/Prisma,
Firebase Auth + Storage + FCM, Google Maps, phone-OTP authentication, policy
content, Google Play & Apple App Store compliance.

**Payment model confirmed:** **Cash on Delivery only.** A full-tree scan found
**no** Razorpay, Stripe, PhonePe, Paytm, UPI, card, net-banking or wallet
integration anywhere in the codebase. Every fix and every policy in this pass
reflects that.

**Verification performed:** `tsc --noEmit` clean on both `apps/backend` and
`apps/mobile`; `npx expo config --type prebuild` resolves with all plugins; the
resolved manifest was inspected field-by-field.

---

## ✅ Fixed Issues

### A. Expo configuration — [apps/mobile/app.config.js](../apps/mobile/app.config.js)

| # | Issue | Impact before fix | Fix |
|---|---|---|---|
| A1 | `expo.name` was `'mobile'` | App would install and list on both stores under the name **"mobile"** | Set to `MechBazar` |
| A2 | No `scheme` | Deep links, Android App Links and `expo-dev-client` all non-functional | Added `scheme: 'mechbazar'` |
| A3 | No `ITSAppUsesNonExemptEncryption` | App Store Connect blocks **every** upload pending an export-compliance answer | Set `false` (HTTPS-only exemption) |
| A4 | No splash screen configured | SDK 57 removed the legacy `expo.splash` key, so the app launched on a blank white frame | Installed + configured `expo-splash-screen` with light/dark variants |
| A5 | No `runtimeVersion` | OTA updates could be delivered to an incompatible native binary the day `expo-updates` is added | `{ policy: 'appVersion' }` |
| A6 | `versionCode` / `buildNumber` unmanaged | Resubmissions rejected for a non-incrementing build number | Confirmed EAS remote versioning (`appVersionSource: "remote"` + `autoIncrement`) — the **only** mode that works with a dynamic `app.config.js`; documented in-file so nobody hard-codes a value that would be silently ignored |
| A7 | No `assetBundlePatterns`, no `primaryColor` | Assets missing from OTA payloads; no brand colour on Android notifications | Added both |
| A8 | `usesCleartextTraffic` unset | Release builds accepted plaintext HTTP, so a hostile network could downgrade API traffic **carrying Bearer tokens** | `expo-build-properties` + iOS ATS now allow cleartext **only** in the `development` EAS profile |
| A9 | No `minSdk`/`targetSdk`/`deploymentTarget` pinned | Build reproducibility; Play target-API deadlines | `minSdk 24`, `compile/target 36`, iOS `16.4` |

### B. Expo plugins & permissions — the iOS crash

| # | Issue | Impact before fix | Fix |
|---|---|---|---|
| B1 | **`expo-image-picker` was a dependency with no plugin entry** | `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` were never generated. **iOS crashed the first time a user opened the camera or gallery** for a return photo, and Apple rejects the binary under Guideline 5.1.1 | Plugin added with specific, feature-naming purpose strings |
| B2 | **`expo-notifications` was a dependency with no plugin entry** | Android notification icon/colour and `POST_NOTIFICATIONS` handling never configured | Plugin added with monochrome icon + brand colour + default channel |
| B3 | Android declared only the 2 location permissions | Play's Data Safety form must match the **merged** manifest; camera/media/notification permissions were arriving invisibly via library merge | Explicit 9-permission allowlist |
| B4 | No `blockedPermissions` | `RECORD_AUDIO` was in fact being merged in by a dependency (confirmed in the resolved manifest). Background location, contacts and legacy storage were all reachable via merge | 8 permissions explicitly stripped, incl. `ACCESS_BACKGROUND_LOCATION` (which triggers Play's most onerous review track) |
| B5 | `expo-location` background flags unset | Risk of background-location permission appearing without a background feature | All three background flags set `false` |
| B6 | Four iOS purpose strings missing | Guaranteed 5.1.1 rejection | Camera, Photo Library, Photo Library Add, Location — all written to name the concrete user-facing feature (generic strings are rejected) |

**Packages installed:** `expo-splash-screen`, `expo-build-properties`,
`expo-secure-store`.

> **Deliberately not added:** `expo-camera`, `expo-media-library`,
> `expo-document-picker`. Nothing in the codebase imports them, and
> `expo-image-picker` already covers both camera and gallery. Adding them would
> inject permissions the app never exercises — which breaks Data Safety accuracy
> and invites an Apple rejection for unjustified permissions. Adding a plugin for
> an uninstalled package would also hard-fail the build.

### C. Account deletion — the hardest store blocker

**Before:** `handleDeleteAccount` displayed *"Account deletion isn't self-service
yet — please contact support."* There was **no deletion API at all**. This is an
outright rejection under **Apple Guideline 5.1.1(v)** and **Google Play's Data
Deletion policy**, both of which require in-app deletion for any app that
creates accounts.

**Built end to end:**

| Layer | File | Change |
|---|---|---|
| Schema | [`prisma/schema.prisma`](../apps/backend/prisma/schema.prisma) | `User.deletedAt`, `User.deletionReason` (additive, nullable) |
| API | [`customer.controller.ts`](../apps/backend/src/controllers/customer.controller.ts) | `deleteMyAccount` — 164 lines |
| Route | [`customer.routes.ts`](../apps/backend/src/routes/customer.routes.ts) | `DELETE /api/customers/me` |
| Session | [`middlewares/auth.ts`](../apps/backend/src/middlewares/auth.ts) | Tokens for deleted accounts now rejected |
| UI | [`AccountScreen.tsx`](../apps/mobile/src/screens/AccountScreen.tsx) | Two-step destructive confirmation, spinner, session teardown, logout |

**Design — anonymise in place, not row delete.** Order, ServiceBooking and
Payment rows are statutory records (Companies Act 2013 s.128; CGST Act 2017
s.36 — 8 years) and carry non-nullable FKs to `User`, so a hard delete would
either fail or cascade away the records we are legally obliged to keep. Instead:

- **Erased:** name, email, avatar, gender, DOB, company/GST fields, Expo + FCM
  push tokens, Firebase Auth user, garage vehicles, wishlist, notifications.
- **Scrubbed in place:** addresses (street detail wiped; state/pincode kept —
  "place of supply" is a mandatory GST invoice field).
- **`phone` → `deleted:<uuid>` sentinel** — frees the unique constraint so the
  number can register fresh later, and guarantees the account can never be
  logged into again (login resolves users by verified E.164 phone).
- **Blocked** while an order is in transit or a booking is in progress (409 with
  counts, so the app can tell the user what to finish).
- **Blocked** for vendor/mechanic/rider accounts — they carry payout settlement
  and KYC retention obligations and are offboarded by ops.

### D. Cash-on-Delivery correctness

| # | Issue | Fix |
|---|---|---|
| D1 | **`ServiceBookingScreen` displayed a "Pay Online (UPI / Card / Net Banking)" row** | Removed. Advertising a payment method that does not exist is misleading functionality to both stores and contradicted every policy page |
| D2 | **Backend accepted `paymentMethod: 'online'` from the client** and wrote `Payment.method = 'ONLINE'` — while fulfilling it exactly like COD, with no charge | [`payment.service.ts`](../apps/backend/src/services/payment.service.ts) now hard-locks to `'COD'` server-side. The platform could otherwise hand a customer a record saying their order was paid online when no money had moved — a misrepresentation under the Consumer Protection (E-Commerce) Rules, 2020 |
| D3 | Help Center said online payment was "coming soon" and described refunds to a wallet | Rewritten COD-only; added an anti-fraud FAQ |
| D4 | In-app policy pages referenced UPI/card refunds | [`staticPages.ts`](../apps/mobile/src/data/staticPages.ts) rewritten; 4 new pages added (Refund, Cancellation, Account Deletion, Contact) |
| D5 | `docs/legal/` pack was written for COD **and** prepaid | Refund Policy fully rewritten; Terms §9, Privacy §3/§6/§9, Cancellation §6–7, Shipping §8–9, Account Deletion and README all corrected |

### E. Security

| # | Severity | Issue | Fix |
|---|---|---|---|
| E1 | **Critical** | [`utils/jwt.ts`](../apps/backend/src/utils/jwt.ts) fell back to a hardcoded `'supersecretkey123'` — **a secret published in this repository.** Anyone reading it could forge a token for any `userId` and role, including `SUPER_ADMIN`, against any deployment that booted without `JWT_SECRET` | Fallback removed; module now throws. Second line of defence for scripts/seeds that bypass `env.ts` |
| E2 | **High** | No token revocation anywhere. A 7-day JWT stayed valid after account deletion, admin deletion, ban, or role demotion | `authenticate` and `optionalAuthenticate` now re-resolve the user per request (indexed PK lookup) and reject deleted/missing accounts. **Role is read from the row, not the token** — a demoted admin loses privileges immediately |
| E3 | **Medium** | OTP phone match used `verifiedPhone.includes(claimedDigits)` — a **substring test guarding an authentication boundary** | Exact last-10-digit comparison. Also enabled `verifyIdToken(token, true)` so revoked/deleted Firebase users are rejected rather than accepted until expiry |
| E4 | **Medium** | `JWT_SECRET` weakness undetected in production | Boot-time rejection of a known-placeholder list; `[SECURITY]` error log if under 32 chars |
| E5 | **Medium** | CORS defaulted to fully open with no production signal | Loud `[SECURITY]` boot error when `CORS_ALLOWED_ORIGINS` is unset in production |
| E6 | **Medium** | `"build": "... (tsc \|\| true) ..."` — **TypeScript errors were swallowed and broken code shipped** | `\|\| true` removed; the build now fails on a type error |
| E7 | Low | No rate limit on the destructive account endpoint | Per-token bucket (30 / 15 min) on `/api/customers/me` |
| E8 | Low | `.env.example` shipped `JWT_SECRET="supersecretkey123"` as the suggested value | Replaced with an obvious placeholder + `openssl rand` instructions; CORS documented as production-required |

> **Deliberately made warnings, not boot failures:** E4's length check and E5.
> Both describe a weaker-than-ideal but *functional* configuration. Failing fast
> would have taken your live Hostinger VPS deployment offline on its next
> restart — a consequence you did not ask for. They are listed under Manual
> Actions instead.

### F. Store compliance

| # | Issue | Fix |
|---|---|---|
| F1 | **Policy pages were unreachable on mobile.** `StaticPage` was linked only from `DesktopFooter`, i.e. the web build. On the actual iOS/Android app there was **no route to the Privacy Policy at all** — both stores require it in-app | New **Legal & Policies** section in `AccountScreen` linking all 9 documents |
| F2 | Footer missing Refund, Cancellation and Account Deletion links | Added |
| F3 | No reviewer login path for an OTP-only app | [`docs/legal/store-reviewer-access.md`](legal/store-reviewer-access.md) — Firebase fictional-test-number setup plus copy-paste text for both consoles |

---

## ⚠ Manual Actions Required

Ordered by what blocks a submission soonest.

### M1 — 🔴 Register Android SHA fingerprints in Firebase *(OTP login is broken in release builds without this)*

`apps/mobile/google-services.json` has an **empty `certificate_hash` list for
every Android client.** Firebase Phone Auth verifies Android apps through Play
Integrity, which requires the signing certificate's fingerprint. Without it,
`signInWithPhoneNumber` fails in the released AAB with `auth/app-not-authorized`.
**Real users will not be able to log in.**

```bash
eas credentials -p android      # → Keystore → copy SHA-1 + SHA-256
# Play Console → Release → Setup → App signing → copy SHA-1 + SHA-256
```

Register **both** key sets in Firebase Console → Project settings →
`com.mechbazar.mobile`, then **re-download `google-services.json`** and replace
the file. Verify the new file contains non-empty `certificate_hash` values.

### M2 — 🔴 Add `GoogleService-Info.plist` *(iOS cannot ship without it)*

No iOS app is registered in Firebase project `mech-bazar-8fd86`, and the plist
does not exist in the repo. `@react-native-firebase/app` cannot initialise
without it, so Firebase — and therefore the only login path — is completely
non-functional on iOS.

1. Firebase Console → Add app → iOS → bundle ID `com.mechbazar.mobile`
2. Download `GoogleService-Info.plist` → `apps/mobile/GoogleService-Info.plist`
3. Upload an **APNs auth key (.p8)** → Project settings → Cloud Messaging
   *(iOS Phone Auth verifies via silent push; without it, it degrades to a
   reCAPTCHA web view)*

`app.config.js` already references the file conditionally — dropping it in is
the only step. It currently prints a startup warning naming this gap.

### M3 — 🔴 Provision the reviewer test number

Firebase Console → Authentication → Sign-in method → Phone → **Phone numbers for
testing**: add `+91 9000000001` / `123456`. Then seed that account with an
address, garage vehicles, and order/booking history.

Full instructions and console-ready text: [`store-reviewer-access.md`](legal/store-reviewer-access.md).

> Do **not** implement a hardcoded bypass OTP in app code — it is a permanent
> authentication backdoor that works on every account and cannot be revoked
> without a new build. `utils/otp.ts` was written specifically to prevent this.

### M4 — 🔴 Apply the schema change

```bash
cd apps/backend && npx prisma db push    # adds User.deletedAt, User.deletionReason
```

Additive and nullable — safe on the live database. **The account-deletion
endpoint will 500 until this runs.**

### M5 — 🟠 Add the Maps key to EAS

`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is in the gitignored local `.env` but **not**
in `eas.json`'s production env and not an EAS secret. Production builds
therefore ship with **no Maps key** → `MAPS_ENABLED === false` → address picker
and live tracking silently degrade to placeholders.

```bash
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value "<key>"
```

Then restrict the key in Google Cloud Console to Android package
`com.mechbazar.mobile` + SHA-1, and iOS bundle `com.mechbazar.mobile`. It ships
inside a public client bundle either way.

### M6 — 🟠 Set production environment variables

On the Hostinger VPS, in the backend's environment:

```bash
JWT_SECRET=$(openssl rand -base64 48)     # if the current one is under 32 chars
CORS_ALLOWED_ORIGINS=https://mechbazar.com,https://admin.mechbazar.com,https://vendor.mechbazar.com
```

Both now log a `[SECURITY]` error at boot when misconfigured. **Rotating
`JWT_SECRET` invalidates all existing sessions** — every user is logged out
once. Do it during a quiet window.

### M7 — 🟠 Publish the policy pages

The nine documents in [`docs/legal/`](legal/) still contain `[PLACEHOLDER]`
tokens. Fill them via the table in [`legal/README.md`](legal/README.md), then
publish to the URLs in the checklist. Reviewers open these **logged out, from a
desktop browser** — a 404 or a live page containing `[COMPANY_LEGAL_NAME]` is a
rejection. `[WEBSITE_URL]/account-deletion` must exist and be reachable **without
installing the app** (a hard Google Play requirement).

### M8 — 🟡 Delete or quarantine the stray root Expo config

`/app.json` (tracked in git) declares package **`com.tanu40647.mechbazarworkspace`**
and EAS project `d88b51d3-…` — neither matches the real app. Running `eas build`
from the repo root instead of `apps/mobile/` produces a phantom app with the
wrong package name. `/eas.json` has the same problem.

I have not deleted them, since they are tracked files and removal is your call.
Recommendation: delete both, or move them to `tools/` with a README explaining
what they were for.

### M9 — 🟡 Decide on iPad support

`ios.supportsTablet: true` obliges you to ship **13" iPad screenshots** and to
pass review on iPad layout. There is no evidence of iPad testing in this
codebase. Either test properly on iPad, or set `supportsTablet: false` and ship
iPhone-only (fully permitted).

### M10 — 🟡 Firebase Console hardening

- Enable **Blaze billing** — Phone Auth beyond the free daily quota fails with
  `auth/quota-exceeded` under real traffic
- **Restrict SMS regions to India** — the primary defence against SMS-pumping
  fraud, where an attacker drives OTPs to premium international numbers on your bill
- Set a **daily SMS budget alert**
- Enable **Android Device Verification** and **Play Integrity** APIs

### M11 — 🟡 Complete the store declarations

Data Safety (Play) and App Privacy (Apple) tables are pre-drafted in
[`legal/app-store-submission-checklist.md`](legal/app-store-submission-checklist.md)
§2.4 / §3.3. Two corrections now apply given COD-only:

- **"Payment info"** — declare **not collected**. You hold no payment-instrument
  data. The only financial field is a refund bank/UPI ID the user volunteers.
- **"Financial features"** — answer **No**.

Also add a `PrivacyInfo.xcprivacy` privacy manifest for the iOS build.

---

## ❌ Remaining Blocking Issues

Nothing in the **code** blocks a build — both projects typecheck clean and the
Expo config resolves with every plugin. The blockers are all
credential/console-side and cannot be done from this repository:

| # | Blocker | Blocks | Owner action |
|---|---|---|---|
| 1 | Android SHA fingerprints unregistered → phone OTP fails in release builds | **Play submission** and real-user login | M1 |
| 2 | `GoogleService-Info.plist` absent; no iOS app in Firebase | **All iOS builds** | M2 |
| 3 | No reviewer test number | **Both stores** (Apple 2.1 / Play App Access) | M3 |
| 4 | `prisma db push` not yet run against production | Account deletion returns 500 → **Apple 5.1.1(v)** | M4 |
| 5 | Policy pages not published at public URLs | **Both stores** | M7 |

---

## Untested — please verify before submitting

I could not exercise these at runtime; they are verified only by typecheck and
config resolution:

1. **The deletion flow end to end.** Create a throwaway account against a
   staging database, delete it, and confirm: (a) login with that number now
   creates a *new* account, (b) the old JWT returns 401, (c) orders survive with
   `name = "Deleted User"`, (d) push notifications stop.
2. **The 409 path** — place an order, then attempt deletion, and confirm the
   "finish your active orders first" alert appears.
3. **iOS camera/gallery**, which previously crashed. Needs a real device build
   after M2.
4. **`authenticate` latency.** It now performs one indexed PK lookup per
   authenticated request. Expected ~1 ms; worth watching p99 on the VPS after
   deploy. If it ever matters, cache it — but do not remove the deleted-account
   check.
5. **`edgeToEdgeEnabled: true`** (Android 15 requirement) may shift layout under
   the status/nav bars. Check the main screens on an Android 15 device.

---

## Noted, not changed

- **Root `package.json` `overrides`** uses keys `"admin"` and `"vendor"`. npm
  `overrides` keys are **package names, not workspace names** — and `admin` is a
  real package on npm. These two blocks are no-ops. Harmless, but they are not
  doing what they appear to.
- **`apps/mobile` is absent from the root `workspaces` array** yet its
  dependencies are hoisted into the root `node_modules`. This is the same class
  of duplicate-package hazard that caused the earlier `Component auth is not
  registered` incident. It works today; it is fragile.
- **`firebase` (JS SDK) and `@react-native-firebase/*` are both dependencies.**
  Intentional — the JS SDK serves the web build's reCAPTCHA phone-auth path,
  RN Firebase serves native. Worth a comment in `package.json` so nobody
  "cleans up" the duplicate.
- **`userInterfaceStyle: 'light'`** while `themeSlice` supports dark. Native
  components stay light when the JS theme goes dark. Not a store blocker; a
  visual inconsistency. Left alone to avoid an unrequested appearance change.

---

## Changed files

**Backend (11):** `.env.example`, `package.json`, `prisma/schema.prisma`,
`src/config/env.ts`, `src/controllers/customer.controller.ts`, `src/index.ts`,
`src/middlewares/auth.ts`, `src/routes/customer.routes.ts`,
`src/services/payment.service.ts`, `src/utils/jwt.ts`, `src/utils/otp.ts`

**Mobile (8):** `app.config.js`, `package.json`, `package-lock.json`,
`src/components/desktop/footer/DesktopFooter.tsx`, `src/data/staticPages.ts`,
`src/screens/AccountScreen.tsx`, `src/screens/HelpCenterScreen.tsx`,
`src/screens/services/ServiceBookingScreen.tsx`

**Docs (12 new):** `docs/PRODUCTION_READINESS_REPORT.md`, `docs/legal/` —
README, privacy-policy, terms-and-conditions, refund-policy, shipping-policy,
cancellation-policy, return-replacement-policy, contact-us, about-us,
account-deletion-policy, app-store-submission-checklist, store-reviewer-access

*924 insertions, 127 deletions across 19 tracked files.*
