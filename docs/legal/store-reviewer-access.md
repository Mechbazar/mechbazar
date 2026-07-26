# Store Reviewer Access & Demo Account Setup

Internal document. **Not for publication.**

**Last Updated:** [LAST_UPDATED]

---

## Why this document exists

MechBazar's only sign-in method is a **one-time password sent by SMS to an
Indian mobile number** (Firebase Phone Authentication). App reviewers at Google
(Mountain View / Bengaluru) and Apple (Cupertino) **cannot receive an Indian
SMS**. Unless you give them a way in, the reviewer reaches the OTP screen, gets
stuck, and the app is rejected under:

- **Apple Guideline 2.1 — App Completeness** ("we were unable to sign in"), and
- **Google Play — App Access** (incomplete access instructions).

This is the single most common rejection reason for Indian OTP-login apps, and
it is entirely avoidable.

---

## The fix: a Firebase fictional test number

Firebase Phone Auth supports **fictional phone numbers** with a fixed
verification code. They never send a real SMS, they work from any country, they
do not consume SMS quota, and they are not subject to rate limiting or Play
Integrity checks. This is Google's own supported mechanism for exactly this
situation — you are **not** hacking around review, and you do **not** need a
special "review mode" or a hardcoded backdoor in the app.

**Do not** implement a hardcoded bypass OTP in application code. A bypass code
compiled into the client is a permanent authentication backdoor, works on every
account, cannot be revoked without shipping a new build, and is exactly what
`apps/backend/src/utils/otp.ts` was deliberately written to prevent.

### Setup (one-time, ~2 minutes)

1. Open the **Firebase Console** → project **`mech-bazar-8fd86`**
2. **Authentication → Sign-in method → Phone**
3. Expand **Phone numbers for testing (optional)**
4. Add:

   | Phone number | Verification code |
   |---|---|
   | `+91 9000000001` | `123456` |

5. Save.

> Pick a number that is **not a real, allocatable Indian mobile number** so it
> can never collide with a genuine customer. Numbers in the `9000000000` range
> are a safe choice; **do not** use a number in a live operator series.

### What happens

- The reviewer enters `9000000001` → taps Send OTP
- Firebase returns a verification session **without sending an SMS**
- The reviewer enters `123456`
- Firebase issues a genuine, fully-valid ID token
- The backend verifies it through `firebase-admin` exactly as it does for a real
  user — no special-casing anywhere in our code

---

## Seed the demo account before you submit

A reviewer who logs in to an empty app sees empty screens and may reject for
"minimum functionality" (Apple 4.2) or simply fail to find the features you
described. Log in as the test number **before submitting** and populate it:

- ☐ Set a **name** on the profile
- ☐ Add a **saved address** in a genuinely serviceable PIN code (otherwise every
  product shows as undeliverable and the reviewer concludes the app is broken)
- ☐ Add **two vehicles to the Garage** — one car, one bike — so fitment
  filtering visibly does something
- ☐ Place and complete **one order** so Orders history is not empty
- ☐ Create **one service booking** so Bookings history is not empty
- ☐ Add **two items to the wishlist**

Then **re-verify the account still works the day you submit**, and leave it
untouched for the whole review window. Deleting or resetting the demo account
mid-review causes a rejection.

> ⚠️ Do **not** use the demo account to exercise **Account → Security & Privacy
> → Delete Account**. That endpoint really deletes it. If you want to test
> deletion, use a second test number.

---

## Text to paste into the store consoles

### Google Play Console → App content → App access

Select **"All or some functionality is restricted"** and add:

> **Name of instructions:** Phone OTP login
>
> **Any other information:**
> MechBazar requires a one-time password sent to an Indian mobile number. A
> Firebase test number is provisioned for review — it does not send a real SMS
> and works from any country.
>
> 1. Open the app and tap **Login / Get Started**
> 2. Enter mobile number: **9000000001** (do not type +91; the app adds it)
> 3. Tap **Send OTP**
> 4. Enter OTP: **123456**
> 5. Tap **Verify** — you are signed in to a pre-populated demo account
>
> The account already has a saved delivery address, two vehicles in the Garage,
> and past orders and service bookings, so all screens show real content.
>
> Notes for the reviewer:
> - The app serves **India only**. Please use the pre-saved address; entering a
>   non-Indian address will correctly show as not serviceable.
> - MechBazar sells **physical automotive parts and real-world doorstep mechanic
>   services**. Payment is **Cash on Delivery only** — no digital goods are sold
>   and no in-app purchase applies.
> - Account deletion is at **Account → Security & Privacy → Delete Account**,
>   and also at [WEBSITE_URL]/account-deletion without installing the app.
> - Browsing the catalogue does **not** require an account; login is needed only
>   to place an order or booking.

### App Store Connect → App Review Information

- **Sign-in required:** Yes
- **User name:** `9000000001`
- **Password:** `123456`

  *(Apple's form has no OTP field. Put the number in User name and the fixed
  code in Password, and explain it in Notes — this is the accepted convention.)*

- **Notes:**

> MechBazar signs in with a phone OTP, not a username/password. The "User name"
> field above is the mobile number and the "Password" field is the fixed OTP.
>
> 1. Tap **Login / Get Started**
> 2. Enter mobile number **9000000001** (enter the 10 digits only; +91 is added
>    automatically)
> 3. Tap **Send OTP**
> 4. Enter **123456** and tap **Verify**
>
> This is a Firebase fictional test number: no SMS is sent and it works from
> outside India. The account is pre-populated with a saved address, two garage
> vehicles, and past orders and bookings.
>
> **What the app does:** MechBazar is an Indian marketplace for genuine car and
> two-wheeler spare parts, plus doorstep mechanic services. Parts are sold by
> independent verified vendors; services are performed by independent verified
> mechanics.
>
> **Guideline 3.1.5(a) — physical goods and services:** everything sold is a
> physical automotive part or a real-world service performed on the user's
> vehicle. Payment is **Cash on Delivery only** — the user pays cash to the
> delivery partner or mechanic at fulfilment. There is no payment gateway, no
> digital content, and in-app purchase does not apply.
>
> **Guideline 5.1.1(v) — account deletion:** in-app at **Account → Security &
> Privacy → Delete Account** (two confirmations, then immediate deletion), and
> on the web at [WEBSITE_URL]/account-deletion.
>
> **Suggested walkthrough:** sign in → Account → My Garage (see saved vehicles)
> → Home (catalogue filtered to the selected vehicle) → open a product → add to
> cart → checkout with the saved address (Cash on Delivery) → Orders → track →
> Services → book a doorstep service → Account → Security & Privacy → Delete
> Account.
>
> **India only:** please use the pre-saved delivery address. Non-Indian
> addresses correctly show as outside our service area.

---

## Firebase Console prerequisites — OTP will fail in release builds without these

These are **not optional**, and each one silently breaks login in a way that
looks like an app bug.

### Android

- ☐ **SHA-1 and SHA-256 fingerprints registered** in Firebase Console → Project
  settings → Your apps → `com.mechbazar.mobile`.

  > The committed `google-services.json` currently has an **empty
  > `certificate_hash` list for every Android client.** Firebase Phone Auth on
  > Android verifies the app through Play Integrity, which requires the signing
  > certificate's fingerprint. Without it, `signInWithPhoneNumber` fails on the
  > release build with `auth/app-not-authorized` or an unexplained reCAPTCHA
  > fallback. **OTP login will not work in the released AAB until this is
  > fixed.**

  You need the fingerprints of **every** key that will sign a shipped build:

  ```bash
  # EAS upload key
  eas credentials -p android          # → Keystore → view fingerprints

  # Google Play App Signing key (the one that signs what users install)
  # Play Console → Release → Setup → App signing → copy SHA-1 and SHA-256
  ```

  Register **both**. Then **re-download `google-services.json`** and replace
  `apps/mobile/google-services.json` — the file must contain the new hashes.

- ☐ **Android Device Verification API** enabled in the Google Cloud console for
  the project
- ☐ **Play Integrity API** enabled and linked to the Play Console app

### iOS

- ☐ **An iOS app registered** in Firebase project `mech-bazar-8fd86` with bundle
  ID `com.mechbazar.mobile`
- ☐ **`GoogleService-Info.plist` downloaded** into `apps/mobile/`

  > This file **does not exist in the repository today.**
  > `@react-native-firebase/app` cannot initialise without it, so Firebase — and
  > therefore the only login path — is completely non-functional on iOS.
  > `app.config.js` already references it conditionally, so dropping the file in
  > is the only step needed. **An iOS build cannot ship before this.**

- ☐ **APNs authentication key (.p8) uploaded** to Firebase → Project settings →
  Cloud Messaging. iOS Phone Auth verifies the app with a silent push; without
  the APNs key it falls back to a reCAPTCHA web view, which needs the
  `REVERSED_CLIENT_ID` URL scheme configured and is a much worse experience.
- ☐ **Push Notifications capability** enabled on the App ID

### Both platforms

- ☐ **Phone sign-in provider enabled** in Firebase → Authentication → Sign-in
  method
- ☐ **Blaze (pay-as-you-go) billing enabled.** Phone Auth SMS beyond the free
  daily quota requires it; on Spark, `sendOtp` starts failing with
  `auth/quota-exceeded` or `auth/billing-not-enabled` under real traffic
- ☐ **Authorised domains** include `[WEBSITE_URL]` and any Vercel preview domain
  used by the web build (web reCAPTCHA flow only)
- ☐ **SMS region policy** configured to allow **India** and to *deny* regions you
  do not serve — this is the primary defence against SMS-pumping fraud, where
  an attacker drives OTPs to premium international numbers and bills you for it
- ☐ **Daily SMS quota / budget alert** set, so a pumping attack shows up as an
  alert rather than as an invoice

---

## Pre-submission verification

Run on a **real device**, on a **release build** (not Expo Go, not a dev
client), before every submission:

1. ☐ Install the release AAB/IPA on a clean device
2. ☐ Log in with a **real Indian number** — a genuine SMS must arrive
   *(this is what proves the SHA fingerprints are correctly registered)*
3. ☐ Log out, then log in with the **test number `9000000001` / `123456`**
4. ☐ Force-quit and reopen — the session must persist
5. ☐ Confirm the demo account shows a saved address, garage vehicles, orders and
   bookings
6. ☐ Confirm **Account → Legal & Policies** opens every policy page
7. ☐ Confirm **Account → Security & Privacy → Delete Account** exists and warns
   before deleting (use a throwaway account to test the actual deletion)
8. ☐ Deny every runtime permission and confirm the app still works

---

## Rotate after approval

Once the app is live:

- ☐ Consider removing the test number from Firebase, or rotating its code,
  between review cycles — a fictional number left in place indefinitely is a
  standing (if low-value) way into one demo account
- ☐ Re-add it before each subsequent submission; **update-review rejections for
  a missing test login are just as common as first-submission ones**
