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
| `MECH BAZAR PRIVATE LIMITED` | Registered entity name | ABC Auto Commerce Private Limited |
| `MechBazar` | Consumer-facing brand | MechBazar |
| `U45300HR2026PTC148525` | Corporate Identity Number (MCA) | U52100XX2024PTC000000 |
| `Not Applicable (GST registration pending)` | GST registration number | 07AAAAA0000A1Z5 |
| `Sector 70A Extension Road, Gurugram, Haryana, India` | Registered office, full postal address with PIN | |
| `Information Required` | Corporate/operations office, if different | |
| `https://mechbazar.com` | Primary website | https://www.mechbazar.com |
| `support@mechbazar.com` | Customer support inbox | support@mechbazar.com |
| `+91 9772704981` | Support helpline, with STD/country code | +91-XXXXXXXXXX |
| `Information Required` | Support window, IST | Mon–Sat, 9:00 AM – 8:00 PM IST |
| `Information Required` | Grievance Officer (IT Rules, 2021) | |
| `Information Required` | Grievance Officer email | grievance@mechbazar.com |
| `Information Required` | Grievance Officer phone | |
| `Information Required` | Nodal Contact Person (E-Commerce Rules, 2020) | |
| `Information Required` | Nodal officer email | nodal@mechbazar.com |
| `Information Required` | Data Protection Officer / contact under DPDP Act | |
| `Information Required` | Data protection contact | privacy@mechbazar.com |
| `Information Required` | Seller/vendor onboarding inbox | sellers@mechbazar.com |
| `Information Required` | Mechanic onboarding inbox | partners@mechbazar.com |
| `Information Required` | Courts of exclusive jurisdiction | New Delhi |
| `Information Required` | State | Delhi |
| `Information Required` | Seat of arbitration | New Delhi |
| `29 July 2026` | Date the policy takes effect | 1 August 2026 |
| `29 July 2026` | Last revision date | 26 July 2026 |
| `Information Required (app not yet published on Google Play)` | Play Store listing | |
| `Information Required (app not yet published on the App Store)` | App Store listing | |
| `Information Required` | Cities currently served | Delhi NCR, Bengaluru, Pune |
| `Information Required` | Quick-commerce delivery promise | 60–120 minutes |
| `Information Required` | Standard delivery window | 2–5 business days |
| `Information Required` | Return window | 10 |
| `5–10 business days` | Refund turnaround (bank/UPI transfer of cash already paid) | 7–10 business days |
| `Information Required` | Order value for free delivery | ₹999 |
| `Information Required` | Standard delivery fee | ₹49 |
| `Information Required` | Express/quick-delivery fee | ₹79 |
| `Information Required` | COD handling fee, if any | ₹25 |
| `Information Required` | Late service-cancellation fee | ₹99 |
| `Information Required` | 3PL partners | Delhivery, Shadowfax |
| `Information Required` | Analytics SDKs in the build | Firebase Analytics |

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

**Every document in this pack states that MechBazar accepts Cash on Delivery
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

**Quick-commerce SLA.** `Information Required` is stated as a promise. Only
publish a minutes-level SLA for pincodes where you can actually meet it; keep
`Information Required` as the fallback everywhere else.

---

## 4. Using this content inside the app

The mobile app already renders static pages from
[`apps/mobile/src/data/staticPages.ts`](../../apps/mobile/src/data/staticPages.ts)
via the `StaticPage` screen, keyed by `StaticPageKey`. To ship the full versions:

- Keep the in-app copy as the **summary**, and link out to `https://mechbazar.com/legal/...`
  for the full text, **or**
- Expand `STATIC_PAGES` with the new keys (`refund`, `cancellation`,
  `account-deletion`, `contact`) and paste the section headings/bodies from these
  files.

Either way the **web URLs must exist and be publicly reachable** — store reviewers
open them directly, logged out, from a desktop browser.
