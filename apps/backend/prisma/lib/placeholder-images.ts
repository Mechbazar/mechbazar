// Locally-generated placeholder artwork for catalogue rows that have no real
// photograph.
//
// Deliberately local files under uploads/, never an external URL. The catalogue
// import left ~42 products pointing at images.unsplash.com, and that class of
// reference has already broken production once (see NO_IMAGE_PLACEHOLDER in
// apps/mobile/src/services/product.service.ts): an external image host is a
// live third-party dependency that can 403, rate-limit, or trip Chrome's
// Opaque Response Blocking. catalog-hygiene.ts strips such URLs on sight, so
// nothing here may reintroduce them.
//
// Shared by catalog-hygiene.ts and backfill-missing-product-images.ts, which
// previously would have needed a copy each.
import fs from 'fs';
import path from 'path';

export const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

const PLACEHOLDER_COLORS = ['#DA3830', '#2ECC71', '#1C7ED6', '#F59F00', '#9C36B5', '#0CA678'];

export function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// A simple, professional placeholder: the category initial in a tinted circle
// over a light card, with the name beneath. Written to disk rather than inlined
// into the DB as a data URI so it is served exactly like every real category
// photo (a plain /uploads/ path) and is trivial to swap for real artwork later.
export function generateCategorySvg(name: string, colorSeed: number): string {
  const color = PLACEHOLDER_COLORS[colorSeed % PLACEHOLDER_COLORS.length];
  const initial = name.trim().charAt(0).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#F8F9FA"/>
  <circle cx="200" cy="170" r="90" fill="${color}" fill-opacity="0.12"/>
  <text x="200" y="200" font-family="Arial, sans-serif" font-size="88" font-weight="700" fill="${color}" text-anchor="middle">${initial}</text>
  <text x="200" y="330" font-family="Arial, sans-serif" font-size="26" font-weight="600" fill="#1B1B1B" text-anchor="middle">${escapeXml(name.length > 22 ? name.slice(0, 20) + '…' : name)}</text>
</svg>`;
}

// The generated SVG is served as image/svg+xml, so an unescaped "&" or "<" in a
// category name is not merely ugly -- it makes the document malformed and the
// image fails to render at all. Category names are admin-entered free text
// ("Nuts & Bolts" is an entirely plausible one), so this cannot be skipped.
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Writes the placeholder for a category and returns the /uploads path to store.
// Idempotent: the filename is derived from the name and vehicle type, so
// re-running overwrites the same file rather than accumulating copies.
export function writeCategoryPlaceholder(name: string, vehicleType: string, colorSeed: number): string {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const filename = `cat-placeholder-${slugify(name)}-${vehicleType.toLowerCase()}.svg`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), generateCategorySvg(name, colorSeed));
  return `/uploads/${filename}`;
}
