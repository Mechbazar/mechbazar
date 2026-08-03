# Business & Legal Completion Checklist

Owner-supplied facts and decisions still needed before the legal/policy pack
(`docs/legal/`) can be published. Engineering has already substituted every
value it was given (entity name, CIN, registered office, Grievance Officer
identity, several SLA defaults). Everything below is a business decision or a
fact only the business owner can supply — not an engineering task.

Must be resolved and substituted (find `Information Required` in `docs/legal/`)
before the app is submitted to Google Play / Apple App Store, since store
reviewers open these pages logged out.

## 1. Support & operations
- [ ] Customer support working hours (IST) — appears in privacy-policy, contact-us, refund/cancellation/return/shipping/terms/about-us, account-deletion
- [ ] Vendor onboarding contact/inbox (or confirm `sellers@mechbazar.com`)
- [ ] Mechanic/partner onboarding contact/inbox (or confirm `partners@mechbazar.com`)
- [ ] Privacy-specific contact email (or confirm `privacy@mechbazar.com`)
- [ ] Nodal Contact Person name + email (E-Commerce Rules, 2020)
- [ ] Data Protection Officer/contact name + email (DPDP Act)
- [ ] Account-deletion offboarding SLA (vendor/mechanic side) — two `Information Required` values in account-deletion-policy.md:89

## 2. Serviceability & delivery
- [ ] Cities/regions currently served (about-us, shipping-policy)
- [ ] Express/Quick Delivery time promise (minutes) and which PIN codes qualify
- [ ] Standard delivery window (business days)
- [ ] Late service-cancellation fee (cancellation-policy.md:63)

## 3. Pricing
- [ ] Free-delivery order-value threshold
- [ ] Standard delivery fee (orders below the free threshold)
- [ ] Express/Quick-delivery fee
- [ ] COD handling fee, if any (shipping-policy, terms-and-conditions)

## 4. Legal/jurisdiction
- [ ] Seat and venue of arbitration
- [ ] Courts of exclusive jurisdiction (city + state)

## 5. Store listings (fill once published)
- [ ] Google Play Store listing URL
- [ ] Apple App Store listing URL

## 6. Confirm already-decided values are consistent
The facts below were decided in earlier commits — confirm they're still
correct, since they're now asserted as fact across every document:
- Return window: **10 days**
- Payments: **Cash on Delivery only**, no gateway
- Grievance Officer: **Raish Khan**, support@mechbazar.com, +91 9772704981

## 7. Payment gateway go-live — technical prerequisites
The checkout/backend is now built Razorpay-ready (order creation, webhook
handling, signature verification, checkout UI) but stays Cash-on-Delivery-only
until these are supplied — nothing else needs to change in code:
- [ ] Razorpay **Key ID** and **Key Secret** (Live mode) — Razorpay Dashboard → Settings → API Keys
- [ ] Razorpay **Webhook Secret** — create a webhook in the Dashboard pointed at `POST https://<api-host>/api/payments/razorpay/webhook`, subscribed to at least `payment.captured` and `payment.failed`, then copy the secret it generates
- [ ] Confirmation that Razorpay settlement bank account / KYC is complete (business's responsibility with Razorpay, not engineering)
- [ ] Decision: once live, should "Pay Online" default to selected, or stay opt-in alongside COD?
- [ ] **This legal pack must be revised before going live with a real gateway** — every document currently states, correctly, that MechBazar is COD-only; that stops being true the moment keys are set, and the COD-only/no-online-payment language, refund-to-source language, and fraud warnings all need business/legal review before publishing alongside a live gateway.

---
*Not an engineering task*: once the business supplies the values above, apply
them with a single find-and-replace across `docs/legal/*.md` per the token
table in `docs/legal/README.md`, mirroring how the GST/CIN/Grievance Officer
values were applied in commits `643bec4`, `cdb0909`, `8bba792`, `452e5d2`,
`70aa7b3`.
