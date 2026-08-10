import prisma from '../config/prisma';

// Indian PIN codes are always 6 digits, but geocoded/free-text addresses
// occasionally carry stray whitespace -- normalize before comparing/storing.
function normalizePincode(pincode: string): string {
  return String(pincode || '').trim();
}

/**
 * Whether MechBazar currently delivers/services a given pincode.
 *
 * Bootstrap rule: an EMPTY ServiceablePincode table means unrestricted --
 * every pincode is serviceable. This is deliberate: the table starts empty on
 * a fresh deploy of this feature, and the alternative (empty = nothing is
 * serviceable) would silently block every single order/booking platform-wide
 * the instant this shipped, before any admin had a chance to populate it.
 * Restriction only takes effect once an admin adds at least one row here --
 * see apps/admin/src/pages/ServiceableAreas.tsx.
 */
export async function isPincodeServiceable(pincode: string): Promise<boolean> {
  const normalized = normalizePincode(pincode);
  if (!normalized) return true; // nothing to check against -- don't block on missing address data

  const total = await prisma.serviceablePincode.count();
  if (total === 0) return true;

  const match = await prisma.serviceablePincode.findFirst({
    where: { pincode: normalized, isActive: true },
    select: { id: true },
  });
  return !!match;
}

export { normalizePincode };
