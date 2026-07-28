# Password reset and the two credential stores

## The thing to know first

Staff and vendor accounts have a password in **two independent places**, and
both are live:

| Store | Written by | Used to sign in to |
|---|---|---|
| `User.password` (bcrypt, Postgres) | `POST /auth/register`, `registerPersonal`, `PATCH /auth/change-password` | `apps/admin-mobile`, `apps/seller-mobile` |
| Firebase Auth | `registerPersonal` at vendor signup, `seed-admin.ts`, Firebase's own reset page | `apps/admin` (web), `apps/vendor` (web) |

Customer, rider and mechanic apps are not in this table at all — they sign in by
phone OTP and have no password.

Nothing used to keep the two stores in step, which is why "forgot password"
appeared broken. A reset went through Firebase (the only channel that could
deliver a mail), the bcrypt hash kept the old value, and the phone apps went on
answering "Invalid credentials" with no way for the user to find out why.

## How it works now

```
  user taps "Forgot password?"        any app, web or mobile
            |
            v
  POST /auth/forgot-password          rate limited, 5 per 15 min
            |
            +-- no account / deleted / configured-off ....... same 200 either way
            |
            +-- ensureFirebaseAccount()  creates the Firebase user if missing
            |
            v
  Firebase sends the reset email      Firebase's mail servers, not ours
            |
            v
  user sets a new password            on Firebase's hosted page
            |
            v
  next login on a mobile app          bcrypt fails -> reconcilePasswordAfter-
                                      FirebaseReset() confirms against Firebase
                                      and re-hashes locally. Both stores agree
                                      from here on.
```

The reverse direction is covered too: `PATCH /auth/change-password` writes the
bcrypt hash *and* mirrors into Firebase, so changing your password in the seller
app no longer locks you out of vendor web.

## ⚠️ Required configuration: `FIREBASE_WEB_API_KEY`

**Until this is set on the backend, password reset is off.** The endpoint
returns `503` and every app displays "Password reset is not available right
now" — deliberately, because the alternative is telling people a reset link is
on its way when nothing can send one.

### It must not be the key the apps already ship

The project's Browser key (`AIzaSy…V0nKk`, in `apps/admin/src/config/firebase.ts`
and the mobile bundles) is **referrer-restricted**. From a server, which sends no
`Referer` header, Google answers:

```
Requests from referer <empty> are blocked.
```

Confirmed by direct probe, not assumed. The Android and iOS keys happen to have
no such restriction and would work, but they ship inside the apps and cannot be
rotated without a release, so they are the wrong choice too.

### Creating the right key

```bash
gcloud services api-keys create \
  --project=mech-bazar-8fd86 \
  --display-name="Identity Toolkit (backend)" \
  --api-target=service=identitytoolkit.googleapis.com

# take the UID from the output
gcloud services api-keys get-key-string <UID> --project=mech-bazar-8fd86
```

Set the resulting string as `FIREBASE_WEB_API_KEY` in the backend environment
(the VPS `docker-compose` env / `apps/backend/.env`). No application
restriction; the `--api-target` above is what limits its blast radius.

### Verifying it took

```bash
# Unknown address: expect 200 and the generic message.
curl -s -X POST https://mechbazar.com/api/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"no-such-account-9f3a2b@example.com"}'

# {"message":"If an account exists for that email, a password reset link has been sent to it."}
```

A `503` means the key is still missing. A `200` means it is configured; check
the backend log for `Firebase sendOobCode failed` to catch a key that is set but
rejected.

## Why the endpoint never says whether an account exists

`POST /auth/forgot-password` is unauthenticated and accepts any address. If it
distinguished "sent" from "no such user" it would be a way to enumerate who has
an account here. So it returns the same 200 for:

- an address with an account (mail sent),
- an address with none,
- a deleted account (anonymise-in-place leaves the row behind; it must not be
  resurrectable through a reset),
- a customer with no password at all,
- an internal error.

The one case that *is* reported distinctly is the 503 above, and only because it
is true for every address equally and so reveals nothing.

Client screens must keep phrasing the result conditionally — "**If** an account
exists for that email…". Any screen that says "we sent you an email" is claiming
knowledge the response does not carry.

## What was not verified

Exercised against a local backend: routing, validation, the rate limit, the
unconfigured 503, the generic 200, and a direct probe of Identity Toolkit
proving which keys it accepts.

**Not** exercised: a real send to a real account, and the login reconciliation
path. The local database's schema is stale (`User.firebaseUid` missing) and
neither was run against production. Both should be checked once the key is set —
see the verification snippet above, then reset a test account's password through
the emailed link and confirm the new password works in `apps/seller-mobile`.
