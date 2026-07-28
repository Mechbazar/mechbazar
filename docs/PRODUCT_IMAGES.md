# Product images: how they are stored, resolved, and why some are blank

## Storage

`POST /upload` (any authenticated role — admin, vendor, seller app) returns
**one of two shapes**, and every consumer has to handle both:

| Condition | Returned `url` |
|---|---|
| `FIREBASE_STORAGE_BUCKET` set | `https://storage.googleapis.com/<bucket>/<file>` |
| otherwise (local disk) | `/uploads/<file>` |

Seeded catalogue rows hold a third form: absolute `https://images.unsplash.com/…`
URLs from the original import.

## Resolution — the bug this caused

Prefixing the API origin unconditionally corrupts the absolute case; using the
stored value raw breaks the relative one. Both mistakes existed in the panels
simultaneously, producing URLs like:

```
http://mechbazar.com:5001https://images.unsplash.com/photo-1507133750069…
```

Since **every** image in the live catalogue is an absolute URL, that meant the
admin dashboard's product thumbnails, delivery proof photos and KYC document
links were broken for every record.

Use the helper, never a template literal:

| App | Import |
|---|---|
| `apps/admin` | `resolveUploadUrl` from `src/config/api.ts` |
| `apps/vendor` | `resolveUploadUrl` from `src/config/api.ts` |
| React Native apps | `resolveUploadUrl` from `@mechbazar/shared` |
| `apps/mobile` product lists | `mapBackendProduct` already does it |

## Where images can be attached

| Surface | Status |
|---|---|
| admin panel product form | ✅ upload + preview + remove |
| vendor panel product form | ✅ upload + preview + remove |
| seller mobile app | ✅ (predates the above) |
| vendor CSV bulk import | image column only, no upload |

Both web forms were missing the field entirely until recently — the backend has
always accepted `images`, nothing was sending it, so every product created
through either panel saved an empty `images[]`.

`PUT /vendors/products/:id` also silently discarded `images`, `categoryId` and
`brandId`. It now persists all three, and only writes `images` when the key is
actually present, so a partial `PUT` cannot wipe a product's photos.

## Products with no image

They are **not broken**. `apps/mobile`'s `NO_IMAGE_PLACEHOLDER`
(`src/services/product.service.ts`) renders an inline SVG — deliberately inline,
because an external placeholder host broke production once already. They just
look blank.

As of 2026-07-28 the live catalogue had **6 of 48** with no image:

| Product | Category |
|---|---|
| VDO 5WK97004Z Mass air flow sensor | Air Filter |
| BREMBO P 85 144 Brake pad set | Brake Pads |
| PHILIPS 12626CP Dashboard bulb | Battery |
| DT Spare Parts 9.78132 Bulb | Headlight |
| CASTROL DOT 4 15036B Brake Fluid | Engine Oil |
| **E2E Test Brake Pad** | **E2E Test Category** |

The last one is leftover test data, live and `APPROVED` and visible to
customers. It should be **deleted, not photographed** — see below.

(Several of the others are also mis-categorised — brake fluid filed under Engine
Oil, a dashboard bulb under Battery. Not addressed here.)

### Filling them in

```bash
cd apps/backend
npx tsx prisma/backfill-missing-product-images.ts --dry-run   # inspect first
npx tsx prisma/backfill-missing-product-images.ts
```

It gives every imageless category a generated local placeholder SVG, then has
imageless products adopt their category's image. It **skips rows that look like
test fixtures** and lists them for deletion instead.

⚠️ Must run where `apps/backend/uploads/` is the directory actually served at
`/uploads` — on the VPS, that means inside the backend container or against its
mounted volume. Running it locally writes SVGs nobody will ever fetch.

It is idempotent, and it deliberately does **not** reach for stock photography:
an external image host is a live dependency this app has already been bitten by,
and a placeholder that is honestly a placeholder beats someone else's photo of a
brake pad captioned as this product. Real photographs still have to come from
the vendor or admin via the forms above.

### Removing the test rows

```bash
cd apps/backend
npx tsx prisma/catalog-hygiene.ts
```

Wider in scope — it also merges duplicate categories and **strips the Unsplash
URL from all 42 products that carry one** (external-host policy, see the file
header). That is a bigger and more visible change than filling blanks, which is
why the backfill above is separate. Decide before running it in production.

`catalog-hygiene.ts` had never been run against production: as of 2026-07-28 all
35 live categories still had `image: null`, which is also why the category
fallback had nothing to copy.

## Status

Nothing here has been run against production. The catalogue still shows 6 blank
products and the E2E test row is still live.
