# MechBazar — Legal & Policy Pack

Publish-ready policy content for the MechBazar automotive parts quick-commerce
marketplace (Android / iOS / web), drafted for Indian law and for Google Play +
Apple App Store review.

> **Not legal advice.** These documents are commercially standard drafts that
> track current Indian statutory requirements. Have them reviewed and signed off
> by your company's counsel before publication, especially the arbitration,
> limitation-of-liability, and data-transfer clauses.

---

## 1. Contents

| # | Document | File | Must be a public URL? |
|---|----------|------|----------------------|
| 1 | Privacy Policy | [privacy-policy.md](privacy-policy.md) | **Yes** — required by both stores |
| 2 | Terms and Conditions | [terms-and-conditions.md](terms-and-conditions.md) | Yes (Apple EULA slot) |
| 3 | Refund Policy | [refund-policy.md](refund-policy.md) | Yes |
| 4 | Shipping Policy | [shipping-policy.md](shipping-policy.md) | Yes |
| 5 | Cancellation Policy | [cancellation-policy.md](cancellation-policy.md) | Yes |
| 6 | Return & Replacement Policy | [return-replacement-policy.md](return-replacement-policy.md) | Yes |
| 7 | Contact Us | [contact-us.md](contact-us.md) | Yes |
| 8 | About Us | [about-us.md](about-us.md) | Recommended |
| 9 | Account Deletion Policy | [account-deletion-policy.md](account-deletion-policy.md) | **Yes** — Google Play mandates a deletion URL reachable without installing the app |
| 10 | App Store Submission Checklist | [app-store-submission-checklist.md](app-store-submission-checklist.md) | Internal only |

---

## 2. Placeholders — fill these before publishing

Every document uses the same tokens. Do a single find-and-replace across the
folder.

| Token | Meaning | Example |
|-------|---------|---------|
| `[COMPANY_LEGAL_NAME]` | Registered entity name | ABC Auto Commerce Private Limited |
| `[BRAND_NAME]` | Consumer-facing brand | MechBazar |
| `[CIN]` | Corporate Identity Number (MCA) | U52100XX2024PTC000000 |
| `[GSTIN]` | GST registration number | 07AAAAA0000A1Z5 |
| `[REGISTERED_ADDRESS]` | Registered office, full postal address with PIN | |
| `[OPERATIONAL_ADDRESS]` | Corporate/operations office, if different | |
| `[WEBSITE_URL]` | Primary website | https://www.mechbazar.com |
| `[SUPPORT_EMAIL]` | Customer support inbox | support@mechbazar.com |
| `[SUPPORT_PHONE]` | Support helpline, with STD/country code | +91-XXXXXXXXXX |
| `[SUPPORT_HOURS]` | Support window, IST | Mon–Sat, 9:00 AM – 8:00 PM IST |
| `[GRIEVANCE_OFFICER_NAME]` | Grievance Officer (IT Rules, 2021) | |
| `[GRIEVANCE_EMAIL]` | Grievance Officer email | grievance@mechbazar.com |
| `[GRIEVANCE_PHONE]` | Grievance Officer phone | |
| `[NODAL_OFFICER_NAME]` | Nodal Contact Person (E-Commerce Rules, 2020) | |
| `[NODAL_EMAIL]` | Nodal officer email | nodal@mechbazar.com |
| `[DPO_NAME]` | Data Protection Officer / contact under DPDP Act | |
| `[DPO_EMAIL]` | Data protection contact | privacy@mechbazar.com |
| `[VENDOR_EMAIL]` | Seller/vendor onboarding inbox | sellers@mechbazar.com |
| `[MECHANIC_EMAIL]` | Mechanic onboarding inbox | partners@mechbazar.com |
| `[JURISDICTION_CITY]` | Courts of exclusive jurisdiction | New Delhi |
| `[JURISDICTION_STATE]` | State | Delhi |
| `[ARBITRATION_SEAT]` | Seat of arbitration | New Delhi |
| `[EFFECTIVE_DATE]` | Date the policy takes effect | 1 August 2026 |
| `[LAST_UPDATED]` | Last revision date | 26 July 2026 |
| `[PLAY_STORE_URL]` | Play Store listing | |
| `[APP_STORE_URL]` | App Store listing | |
| `[SERVICE_CITIES]` | Cities currently served | Delhi NCR, Bengaluru, Pune |
| `[DELIVERY_SLA_EXPRESS]` | Quick-commerce delivery promise | 60–120 minutes |
| `[DELIVERY_SLA_STANDARD]` | Standard delivery window | 2–5 business days |
| `[RETURN_WINDOW_DAYS]` | Return window | 10 |
| `[REFUND_TAT_COD]` | Refund turnaround (bank/UPI transfer of cash already paid) | 7–10 business days |
| `[FREE_DELIVERY_THRESHOLD]` | Order value for free delivery | ₹999 |
| `[DELIVERY_FEE]` | Standard delivery fee | ₹49 |
| `[EXPRESS_FEE]` | Express/quick-delivery fee | ₹79 |
| `[COD_FEE]` | COD handling fee, if any | ₹25 |
| `[CANCELLATION_FEE_SERVICE]` | Late service-cancellation fee | ₹99 |
| `[LOGISTICS_PARTNERS]` | 3PL partners | Delhivery, Shadowfax |
| `[ANALYTICS_PROVIDERS]` | Analytics SDKs in the build | Firebase Analytics |

---

## 3. Facts these drafts assume about the app

Written to match what the product actually does today, so the policies don't
contradict the in-app experience:

- Login is **OTP-based on an Indian mobile number** (Firebase Phone Auth).
- **Marketplace model** — parts are listed and fulfilled by independent vendors;
  doorstep servicing is performed by independent verified mechanics.
- **Garage** — users save vehicles (make / model / variant / year) for fitment
  filtering.
- **Push notifications** via Firebase Cloud Messaging; images via Firebase Storage.
- **Location** used for serviceability, address capture and rider/mechanic ETA.
- Return window is **10 days** (matches Help Center FAQ + `staticPages.ts`).

### 💵 Payments: Cash on Delivery only

**Every document in this pack states that [BRAND_NAME] accepts Cash on Delivery
and nothing else.** There is no payment gateway in the product — no Razorpay,
Stripe, PhonePe, Paytm, UPI, card, net-banking or wallet integration — and the
backend hard-locks the payment method server-side
([`payment.service.ts`](../../apps/backend/src/services/payment.service.ts)), so
a client cannot create an order marked as paid online.

Consequences that are deliberately reflected throughout the pack:

- A cancellation produces **no refund**, because nothing was ever charged.
- A refund arises **only** where cash was already handed over — an approved
  return, a wrong or damaged item already paid for, or an overcharge.
- Refunds are paid to a **bank account or UPI ID the customer supplies**, since
  there is no original transaction to reverse.
- Each policy carries an explicit **fraud warning**: a COD-only business never
  asks for advance payment, card details, UPI PIN, OTPs, or QR scans. This is
  the single most common vector used against Indian COD customers, and stating
  it plainly is both a consumer-protection duty and a support-cost saver.

**If a gateway is ever integrated, this pack must be revised before it goes
live** — not after. See the note at the bottom of `payment.service.ts` for what
"integrated" has to mean technically.

### ⚠️ One thing to reconcile before you publish

**Quick-commerce SLA.** `[DELIVERY_SLA_EXPRESS]` is stated as a promise. Only
publish a minutes-level SLA for pincodes where you can actually meet it; keep
`[DELIVERY_SLA_STANDARD]` as the fallback everywhere else.

---

## 4. Using this content inside the app

The mobile app already renders static pages from
[`apps/mobile/src/data/staticPages.ts`](../../apps/mobile/src/data/staticPages.ts)
via the `StaticPage` screen, keyed by `StaticPageKey`. To ship the full versions:

- Keep the in-app copy as the **summary**, and link out to `[WEBSITE_URL]/legal/...`
  for the full text, **or**
- Expand `STATIC_PAGES` with the new keys (`refund`, `cancellation`,
  `account-deletion`, `contact`) and paste the section headings/bodies from these
  files.

Either way the **web URLs must exist and be publicly reachable** — store reviewers
open them directly, logged out, from a desktop browser.
