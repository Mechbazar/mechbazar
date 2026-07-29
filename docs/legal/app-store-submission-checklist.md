# App Store Submission Checklist — MechBazar

Internal document. **Not for publication.**

**Last Updated:** 29 July 2026
**Target stores:** Google Play (Android) · Apple App Store (iOS)
**Region:** India

---

## Part 0 — Blockers found in this repo (fix before you build)

Verified against [`apps/mobile/app.config.js`](../../apps/mobile/app.config.js)
and [`apps/mobile/package.json`](../../apps/mobile/package.json):

| # | Issue | Why it blocks | Fix |
|---|---|---|---|
| 1 | `expo.name` is **`'mobile'`** and `slug` is `'mobile'` | The app installs with the display name "mobile". Instant rejection on both stores and a broken listing | Set `name: 'MechBazar'`; keep a stable `slug` |
| 2 | **`expo-image-picker` is a dependency but has no plugin entry**, so `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` are never generated | iOS **crashes on first camera/gallery access** and Apple rejects for missing purpose strings (Guideline 5.1.1) | Add the `expo-image-picker` config plugin with `photosPermission` and `cameraPermission` strings |
| 3 | **`expo-notifications` is a dependency but has no plugin entry** | Push registration and notification icons/channels may not be configured on the build | Add the `expo-notifications` plugin; confirm FCM registration end-to-end |
| 4 | No `ios.buildNumber` / `android.versionCode` in config | Every resubmission needs a higher build number; without it, uploads are rejected | Add both, or enable EAS `autoIncrement` |
| 5 | No `ITSAppUsesNonExemptEncryption` in `ios.infoPlist` | App Store Connect prompts an export-compliance answer on every upload | Set `ITSAppUsesNonExemptEncryption: false` (HTTPS-only exemption applies) |
| 6 | Android declares only `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION` | Camera/gallery/notification permissions are auto-merged from libraries — audit the **final merged manifest**, since Play's Data Safety form must match it exactly | Run `npx expo prebuild` and read `android/app/src/main/AndroidManifest.xml` before filling the Data Safety form |
| 7 | `expo-dev-client` present | Must not be active in the production build variant | Confirm the production EAS profile does not include the dev client |
| 8 | `version: '1.0.0'` | Fine for the first release; increment thereafter | — |

**Bundle identifier / package name (both platforms):** `com.mechbazar.mobile`
Once published, **this can never be changed.** Confirm it is correct now.

---

## Part 1 — Legal pages must be live before you submit

Reviewers open these URLs **logged out, from a desktop browser**. A 404, a
login wall, or a "coming soon" page is a rejection.

| Page | Required URL | Status |
|---|---|---|
| Privacy Policy | `https://mechbazar.com/privacy-policy` | ☐ |
| Terms and Conditions | `https://mechbazar.com/terms` | ☐ |
| Refund Policy | `https://mechbazar.com/refund-policy` | ☐ |
| Shipping Policy | `https://mechbazar.com/shipping-policy` | ☐ |
| Cancellation Policy | `https://mechbazar.com/cancellation-policy` | ☐ |
| Return & Replacement Policy | `https://mechbazar.com/return-policy` | ☐ |
| Contact Us | `https://mechbazar.com/contact` | ☐ |
| About Us | `https://mechbazar.com/about` | ☐ |
| **Account Deletion** | `https://mechbazar.com/account-deletion` | ☐ |

Checks for each page:

- ☐ Publicly reachable over **HTTPS**, no login, no redirect loop
- ☐ Valid TLS certificate, no mixed-content warnings
- ☐ Mobile-responsive and readable
- ☐ All bracketed placeholder tokens (e.g. `[COMPANY_LEGAL_NAME]`) replaced — a
  live page still containing a literal `[...]` token is a rejection
- ☐ Company legal name, registered address, email and phone visible
- ☐ Grievance Officer name, email and phone published (mandatory in India)
- ☐ "Last Updated" date present and recent
- ☐ Same pages reachable **inside the app** (Account → Help / Legal)
- ☐ Policy content **matches app behaviour** — if COD is the only payment
  method, the policies must not describe card refunds

---

## Part 2 — Google Play

### 2.1 Console setup

- ☐ Play Console developer account active; **D-U-N-S / identity verification
  complete** (organisation accounts)
- ☐ Developer name, physical address, email and phone verified and public
- ☐ App created with package `com.mechbazar.mobile`
- ☐ App signing by Google Play enabled; **upload key backed up offline**
- ☐ Target API level meets Play's current requirement
- ☐ 64-bit AAB (`.aab`, not `.apk`)

### 2.2 Store listing

- ☐ App name (≤ 30 chars) — e.g. *MechBazar: Auto Parts & Service*
- ☐ Short description (≤ 80 chars)
- ☐ Full description (≤ 4,000 chars) — no keyword stuffing, no unverifiable
  superlatives, no competitor names, no "#1"/"best" claims
- ☐ App icon 512×512 PNG (32-bit, alpha)
- ☐ Feature graphic 1024×500
- ☐ Phone screenshots: min 2, recommended 8 (min 320px, max 3840px)
- ☐ 7-inch and 10-inch tablet screenshots (`ios.supportsTablet` is true, so
  ship tablet assets on both stores)
- ☐ Promo video (optional, YouTube)
- ☐ Category: **Shopping** (or Auto & Vehicles); tags set
- ☐ Contact email, phone and website filled
- ☐ Privacy Policy URL set in the listing **and** in App Content

### 2.3 App Content declarations

- ☐ **Privacy Policy URL**
- ☐ **App access** — provide **test credentials**. Login is OTP-based, so give a
  reviewer test number with a **static bypass OTP**, or a demo account, plus
  written steps. *Reviewers cannot receive an Indian SMS — an OTP-only login
  with no bypass is the single most common rejection for Indian apps.*
- ☐ **Ads** — declare accurately
- ☐ **Content rating** questionnaire completed (IARC) → expect *Rated for 3+*
- ☐ **Target audience** — 18+; confirm the app is not child-directed
- ☐ **News app** — No
- ☐ **COVID-19 apps** — No
- ☐ **Data safety form** (see 2.4)
- ☐ **Government apps** — No
- ☐ **Financial features** — declare if you offer EMI, pay-later or insurance;
  India requires additional documentation for lending features
- ☐ **Health** — No
- ☐ **Account deletion** — URL `https://mechbazar.com/account-deletion` **plus** the
  in-app path. **Mandatory** for any app that allows account creation
- ☐ **Advertising ID** — declare if any SDK collects it
- ☐ **Photo & video permissions** declaration, if `READ_MEDIA_IMAGES` is in the
  merged manifest
- ☐ **Location permissions** declaration — foreground only; confirm no library
  pulls in `ACCESS_BACKGROUND_LOCATION`

### 2.4 Data Safety form — draft answers

Must match the Privacy Policy **and** the actual SDK behaviour. Play audits this.

| Data type | Collected | Shared | Purpose | Optional? |
|---|---|---|---|---|
| Name | Yes | Yes (vendors, mechanics, riders) | App functionality, account management | Required |
| Email address | Yes | No | App functionality, support | Optional |
| **Phone number** | Yes | Yes (delivery/service partners) | Account management, app functionality | Required |
| Physical address | Yes | Yes (delivery/service partners) | App functionality (delivery) | Required |
| **Approximate location** | Yes | No | App functionality (serviceability) | Optional |
| **Precise location** | Yes | No | App functionality (address, live tracking) | Optional |
| Purchase history | Yes | No | App functionality, analytics | Required |
| Payment info | Yes* | Yes (payment aggregator) | App functionality | Required |
| User payment method | Yes | Yes | App functionality | Required |
| Photos | Yes | No | App functionality (returns/claims) | Optional |
| App interactions | Yes | No | Analytics, app functionality | Required |
| Crash logs | Yes | No | Diagnostics | Required |
| Diagnostics / performance | Yes | No | Diagnostics | Required |
| Device or other IDs | Yes | No | App functionality (push), analytics | Required |
| Other user content (reviews) | Yes | No | App functionality | Optional |

\* Payment instrument data is collected **by the payment aggregator**, not stored
by us — declare accordingly and state that card/UPI credentials are not stored.

Security section:

- ☐ Data is **encrypted in transit** — Yes
- ☐ Users can **request data deletion** — Yes, with the deletion URL
- ☐ **Independent security review** — answer honestly
- ☐ Committed to Play **Families Policy** — No (18+ app)

### 2.5 Policy compliance

- ☐ No misleading claims about delivery time, price or genuineness of parts
- ☐ No use of vehicle-manufacturer logos or trademarks in the icon, feature
  graphic or screenshots in a way suggesting endorsement
- ☐ Screenshots show the real app, no mockup frames with fabricated content
- ☐ No fake reviews or incentivised-rating prompts
- ☐ Permissions requested are limited to declared functionality
- ☐ **Restricted goods** — automotive parts are fine, but ensure no listing of
  emission-defeat devices, speed-governor bypass, odometer tampering tools or
  counterfeit parts
- ☐ Payments: physical goods and real-world services **must not** use Google Play
  Billing — external payment is correct here. Confirm nothing digital-only is
  sold in-app
- ☐ Prominent disclosure + runtime consent shown before any sensitive permission

---

## Part 3 — Apple App Store

### 3.1 Account and build

- ☐ Apple Developer Program membership active (Organisation, with D-U-N-S)
- ☐ App ID `com.mechbazar.mobile` registered; capabilities enabled
  (Push Notifications, Maps, Sign in with Apple if applicable)
- ☐ APNs key uploaded to Firebase for FCM on iOS
- ☐ Build uploaded via EAS Submit / Transporter, processed in App Store Connect
- ☐ Export compliance answered (`ITSAppUsesNonExemptEncryption: false`)
- ☐ Built against the current required Xcode/SDK version

### 3.2 Info.plist purpose strings — all must be present and specific

| Key | Required because | Draft string |
|---|---|---|
| `NSLocationWhenInUseUsageDescription` | expo-location | ✅ already set — *"MechBazar uses your location to find nearby vendors, mechanics, and to set your delivery address accurately."* |
| `NSCameraUsageDescription` | **expo-image-picker — MISSING** | *"MechBazar uses your camera to photograph a part, a damaged item or a document when you raise a return, warranty or support request."* |
| `NSPhotoLibraryUsageDescription` | **expo-image-picker — MISSING** | *"MechBazar accesses your photo library so you can attach images to returns, reviews and support requests."* |
| `NSPhotoLibraryAddUsageDescription` | Saving invoices/images (expo-print, expo-sharing) | *"MechBazar saves invoices and order documents to your photo library when you choose to download them."* |
| `NSUserTrackingUsageDescription` | Only if any SDK tracks for advertising | *"Allow tracking so we can measure the effectiveness of our promotions and show you more relevant offers."* |

**Generic strings ("we need camera access") are rejected.** Each must state the
concrete user-facing benefit.

- ☐ **Privacy manifest** (`PrivacyInfo.xcprivacy`) present, declaring required-reason
  APIs and third-party SDK data use — required for App Store submission
- ☐ Third-party SDK privacy manifests and signatures present (Firebase, maps)

### 3.3 App Privacy ("nutrition label") in App Store Connect

Mirror the Play Data Safety table in 2.4. Declare **Data Linked to You** for:
Contact Info (name, email, phone, address), Location (coarse + precise), Purchases,
Identifiers, User Content, Usage Data; and **Data Not Linked to You** for
Diagnostics. Set **Tracking = No** unless an ad SDK is present — if Yes, ATT must
be implemented.

### 3.4 Listing and review information

- ☐ App name (≤ 30 chars), subtitle (≤ 30 chars)
- ☐ Promotional text, description, keywords (≤ 100 chars)
- ☐ Screenshots: **6.9"/6.7" iPhone** and **13" iPad** (tablet support is on)
- ☐ App icon 1024×1024, no alpha, no rounded corners, no transparency
- ☐ Support URL and Marketing URL live
- ☐ Privacy Policy URL live
- ☐ **EULA** — use the standard Apple EULA or paste the
  [Terms and Conditions](terms-and-conditions.md) as a custom licence agreement
- ☐ Age rating: **17+** or **18+** (commerce app, adult contracting capacity)
- ☐ Category: Shopping (secondary: Utilities)
- ☐ Copyright: `© 2026 MECH BAZAR PRIVATE LIMITED`
- ☐ **App Review notes** with:
  - a **demo mobile number and static OTP** that works from outside India
  - a demo account with existing orders, bookings and a saved vehicle, so
    reviewers see populated screens
  - a walkthrough: *sign in → add a vehicle to Garage → add a part to cart →
    checkout (COD) → track order → book a service → find Delete Account*
  - a note that the app serves **India only**, and that reviewers should use the
    pre-set demo address for serviceability
  - a note that physical goods and real-world services are sold, so **IAP does
    not apply** (Guideline 3.1.5(a))
- ☐ Contact name, phone and email for the review team

### 3.5 Common Apple rejection risks for this app

| Guideline | Risk | Mitigation |
|---|---|---|
| 2.1 — App Completeness | OTP login unusable by reviewers | Static test OTP, documented in review notes |
| 2.1 | Empty catalogue for the reviewer's location | Demo account preloaded with a serviceable address |
| 3.1.5(a) | Reviewer mistakes services for digital content | Explicitly state physical goods + real-world services |
| 4.2 — Minimum Functionality | App reads as a website wrapper | Ensure `react-native-webview` is not used for core flows |
| 5.1.1 — Data Collection | Missing/generic purpose strings; account creation not essential | Fix the two missing strings; allow browsing without login |
| 5.1.1(v) — **Account Deletion** | No in-app deletion path | Implement **Account → Settings → Delete Account** in-app; a web-only link is **not sufficient for Apple** |
| 5.1.2 | ATT not implemented while an ad SDK collects IDFA | Implement ATT or remove the SDK |
| 5.3.4 | Marketplace/service claims unverified | Be prepared to show vendor/mechanic verification process |

---

## Part 4 — India-specific compliance

- ☐ **Grievance Officer** name, email, phone and address published on the website
  and in the app (IT Rules, 2021 + Consumer Protection (E-Commerce) Rules, 2020)
- ☐ **Nodal Contact Person** published
- ☐ **Legal entity name, registered address, CIN and GSTIN** displayed
- ☐ **Seller details** (name, address, GSTIN, customer-care contact) displayed on
  every product page — mandatory for marketplace e-commerce entities
- ☐ **Country of origin** displayed on every listing
- ☐ **Total price with a break-up** of all charges shown before payment; no
  post-checkout charges
- ☐ **Expiry / best-before** shown for consumables (oils, fluids, coolants)
- ☐ **Legal Metrology** declarations on packaged goods — MRP inclusive of taxes,
  net quantity, manufacturer/packer/importer name and address, consumer-care
  details, month/year of manufacture or import
- ☐ **BIS marking** shown for goods under mandatory certification (tyres,
  helmets, batteries)
- ☐ **No dark patterns** — no drip pricing, false urgency, forced action,
  basket sneaking, subscription traps, or confirm-shaming, per the CCPA
  Guidelines for Prevention and Regulation of Dark Patterns, 2023
- ☐ **GST-compliant tax invoice** issued for every order, with HSN codes
- ☐ **SMS via DLT-registered** headers and templates (TRAI)
- ☐ **RBI-authorised payment aggregator**; no storage of card data outside
  tokenisation
- ☐ **CERT-In** incident reporting process documented internally (6-hour
  reporting obligation), logs retained 180 days
- ☐ **Battery Waste Management Rules, 2022** — EPR obligations and old-battery
  exchange handled for battery sales
- ☐ **E-Waste Rules** compliance for electronic components, where applicable
- ☐ **DPDP Act, 2023** — consent notice at signup, itemised and withdrawable;
  data-protection contact published

---

## Part 5 — In-app requirements

- ☐ **Browse without login** — reviewers and users can see the catalogue before
  signing in
- ☐ **Consent screen at signup** linking Privacy Policy and Terms, with an
  affirmative (unticked-by-default) checkbox
- ☐ **Account → Legal** section linking all nine policy pages
- ☐ **Account → Settings → Delete Account** implemented in-app (Apple requires
  in-app; Play requires a web URL as well)
- ☐ Notification preferences separating **transactional** from **promotional**
- ☐ **Runtime permission rationale** shown before each system prompt
- ☐ App works with **every permission denied** — no crash, graceful fallback
- ☐ Force-update mechanism and a maintenance screen
- ☐ Crash-free on the current and previous OS versions of both platforms
- ☐ No debug menus, test data, placeholder Lorem Ipsum, or `console` output
  visible in release builds
- ☐ Deep links and app links verified; no dead links in the footer
- ☐ Contact/support reachable from within the app in ≤ 2 taps

---

## Part 6 — Pre-submission smoke test

Run on a **real device**, on the **release build**, on both platforms:

1. ☐ Fresh install → browse catalogue **without logging in**
2. ☐ Sign up with a new number → OTP received → account created
3. ☐ Consent checkbox present; policy links open and render
4. ☐ Add a vehicle to **Garage** → catalogue filters to it
5. ☐ Search a part → open product page → **seller name, GSTIN, country of
   origin, MRP break-up** all visible
6. ☐ Add to cart → checkout → **full price break-up before payment**
7. ☐ Place a COD order → confirmation → track → notification received
8. ☐ Cancel an order → refund flow behaves as the policy states
9. ☐ Raise a return with a photo → camera and gallery both work (**iOS: verify
   this does not crash — see Part 0 item 2**)
10. ☐ Book a service → slot selection → tracking → completion OTP
11. ☐ Deny **every** permission → app still usable
12. ☐ **Account → Delete Account** → OTP → confirmation → login disabled
13. ☐ Airplane mode → sensible offline messaging, no crash
14. ☐ Dark mode / large text / small screen (SE-class) → no clipped UI
15. ☐ All footer legal links resolve to live pages

---

## Part 7 — Submission order

1. Publish all nine legal pages at `https://mechbazar.com` — **do this first**
2. Fix Part 0 blockers, rebuild
3. Run Part 6 smoke test on release builds
4. Google Play: internal testing track → closed testing → production
5. Apple: TestFlight internal → external → App Store review
6. Submit to Play first (faster review), Apple in parallel
7. Keep the demo account **active and populated** through the entire review —
   deactivating it mid-review causes rejection

**Typical review time:** Play 1–7 days (longer for a first release from a new
account) · Apple 24–48 hours.

---

## Part 8 — Post-launch

- ☐ Monitor Play Console **Policy status** and Apple **App Review** messages
- ☐ Respond to store reviews, especially refund and delivery complaints
- ☐ Track ANR and crash rates against Play's bad-behaviour thresholds
- ☐ Re-confirm the **Data Safety** and **App Privacy** forms whenever an SDK is
  added or removed — this is the most commonly missed ongoing obligation
- ☐ Update policy "Last Updated" dates when practices change, and notify users of
  material changes
- ☐ Maintain the **grievance register**: complaints acknowledged in 48 hours,
  resolved in 30 days
- ☐ Watch for annual Play target-API-level deadlines
