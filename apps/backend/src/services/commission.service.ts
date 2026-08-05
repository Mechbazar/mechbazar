import { Prisma, PrismaClient, MechanicType, CommissionSourceType } from '@prisma/client';
import prisma from '../config/prisma';
import { haversineKm } from '../utils/geo';

// Accepts either the top-level client or a $transaction callback's tx --
// every resolver here only ever reads, so both work identically. Callers
// that need the resolved rate to actually stick (checkout, job completion)
// pass their transaction so the read is consistent with the write that
// follows it in the same commit.
type Db = Prisma.TransactionClient | PrismaClient;

type Override = {
  commissionPercent: number;
  isActive: boolean;
  validFrom: Date | null;
  validTo: Date | null;
};

// Shared by every resolver below: an override only applies if it's active
// AND (no validFrom/validTo set, or "now" falls inside the window). This is
// the one place that gives promotional/seasonal commission rates and
// zero-commission vendors somewhere to live without a dedicated campaign UI.
function isEffective(row: Override | null | undefined, now: Date): row is Override {
  if (!row || !row.isActive) return false;
  if (row.validFrom && row.validFrom > now) return false;
  if (row.validTo && row.validTo < now) return false;
  return true;
}

// Self-healing: if the singleton settings row was never seeded (or was
// somehow deleted), create it with the schema's own @default values instead
// of throwing and breaking checkout -- those defaults ARE the admin-editable
// values (see prisma/seed-commission-settings.ts), not a second hardcoded
// copy of them.
export async function getPlatformCommissionSettings(db: Db = prisma) {
  return db.platformCommissionSettings.upsert({
    where: { id: 'GLOBAL' },
    update: {},
    create: { id: 'GLOBAL' },
  });
}

export type ResolvedCommission = { percent: number; source: 'PRODUCT' | 'VENDOR' | 'CATEGORY' | 'GLOBAL' | 'SERVICE_PACKAGE' | 'SERVICE_CATEGORY' };

/**
 * Priority order per the brief: product-specific > vendor-specific >
 * category > global default.
 */
export async function resolveProductCommissionPercent(
  db: Db,
  params: { productId: string; vendorId: string; categoryId: string },
  now: Date = new Date()
): Promise<ResolvedCommission> {
  const [productOverride, vendorOverride, categoryOverride, settings] = await Promise.all([
    db.productCommission.findUnique({ where: { productId: params.productId } }),
    db.vendorCommission.findUnique({ where: { vendorId: params.vendorId } }),
    db.categoryCommission.findUnique({ where: { categoryId: params.categoryId } }),
    getPlatformCommissionSettings(db),
  ]);

  if (isEffective(productOverride, now)) return { percent: productOverride.commissionPercent, source: 'PRODUCT' };
  if (isEffective(vendorOverride, now)) return { percent: vendorOverride.commissionPercent, source: 'VENDOR' };
  if (isEffective(categoryOverride, now)) return { percent: categoryOverride.commissionPercent, source: 'CATEGORY' };
  return { percent: settings.defaultProductCommissionPct, source: 'GLOBAL' };
}

/**
 * Priority order: service-package-specific > service-category > global
 * default. This is the PLATFORM's cut of the service, independent of how the
 * assigned mechanic is personally paid -- see resolveMechanicPayout below.
 */
export async function resolveServiceCommissionPercent(
  db: Db,
  params: { packageId: string; categoryId: string },
  now: Date = new Date()
): Promise<ResolvedCommission> {
  const [packageOverride, categoryOverride, settings] = await Promise.all([
    db.servicePackageCommission.findUnique({ where: { packageId: params.packageId } }),
    db.serviceCategoryCommission.findUnique({ where: { categoryId: params.categoryId } }),
    getPlatformCommissionSettings(db),
  ]);

  if (isEffective(packageOverride, now)) return { percent: packageOverride.commissionPercent, source: 'SERVICE_PACKAGE' };
  if (isEffective(categoryOverride, now)) return { percent: categoryOverride.commissionPercent, source: 'SERVICE_CATEGORY' };
  return { percent: settings.defaultServiceCommissionPct, source: 'GLOBAL' };
}

export type MechanicPayoutResult = {
  mechanicShare: number;
  platformShare: number;
  // The platform's effective commission % for this job (100% for SALARY,
  // since the mechanic keeps nothing of the job amount itself).
  platformCommissionPercent: number;
  mechanicType: MechanicType;
};

/**
 * Maps a mechanic's pay model (SALARY / COMMISSION / HYBRID) onto a single
 * completed job's payout split. `platformServicePct` is the already-resolved
 * platform commission % for this specific service (from
 * resolveServiceCommissionPercent) -- used as the fallback mechanic split
 * when the mechanic has no personal commissionPercent override.
 *
 *  - SALARY: platform keeps 100%; the mechanic is paid separately via a
 *    SALARY-type settlement, never out of a per-job wallet credit ("salary
 *    mechanics should not receive service commission").
 *  - COMMISSION / HYBRID: mechanic keeps `commissionPercent` (their own
 *    override) or, if unset, `100 - platformServicePct`. HYBRID additionally
 *    accrues a monthly salary, handled entirely outside this per-job split
 *    (see the "Pay Salary" admin action).
 */
export async function resolveMechanicPayout(
  db: Db,
  params: { technicianId: string; finalAmount: number; platformServicePct: number }
): Promise<MechanicPayoutResult> {
  const profile = await db.mechanicPayProfile.findUnique({ where: { technicianId: params.technicianId } });
  const mechanicType = profile?.mechanicType ?? MechanicType.COMMISSION;

  if (mechanicType === MechanicType.SALARY) {
    return { mechanicShare: 0, platformShare: params.finalAmount, platformCommissionPercent: 100, mechanicType };
  }

  const mechanicPct = profile?.commissionPercent ?? Math.max(0, 100 - params.platformServicePct);
  const mechanicShare = round2((params.finalAmount * mechanicPct) / 100);
  const platformShare = round2(params.finalAmount - mechanicShare);
  const platformCommissionPercent = params.finalAmount > 0 ? round2((platformShare / params.finalAmount) * 100) : 0;

  return { mechanicShare, platformShare, platformCommissionPercent, mechanicType };
}

export type RiderPayoutResult = {
  amount: number;
  distanceKm: number | null;
  breakdown: { basePickupFee: number; distanceFee: number; nightBonus: number; rainBonus: number };
};

/**
 * Rider payout formula per the brief: base pickup fee + per-km rate ×
 * distance + a night bonus (fixed 10pm-6am window -- not itself admin
 * configurable, only its amount is) + a rain bonus, applied only while an
 * admin has flipped PlatformCommissionSettings.rainModeActive on (there is no
 * weather API integration). Waiting charge is NOT included here: no
 * waiting-time is tracked anywhere for a product delivery, so there is
 * nothing to compute it from automatically -- the configured rate exists for
 * a future manual/tracked entry point, not wired into this automatic path.
 * Distance is straight-line (haversine) between the pickup and drop points,
 * not a routed distance -- there is no live GPS trail for product orders the
 * way there is for service jobs (JobLocationPing).
 */
export async function resolveRiderPayout(
  db: Db,
  params: {
    pickupLat: number | null;
    pickupLng: number | null;
    dropLat: number | null;
    dropLng: number | null;
    deliveredAt: Date;
  }
): Promise<RiderPayoutResult> {
  const settings = await getPlatformCommissionSettings(db);

  const distanceKm =
    params.pickupLat != null && params.pickupLng != null && params.dropLat != null && params.dropLng != null
      ? haversineKm(params.pickupLat, params.pickupLng, params.dropLat, params.dropLng)
      : null;

  const basePickupFee = settings.riderBasePickupFee;
  const distanceFee = distanceKm != null ? round2(distanceKm * settings.riderPerKmRate) : 0;

  const hour = params.deliveredAt.getHours();
  const isNight = hour >= 22 || hour < 6;
  const nightBonus = isNight ? settings.riderNightBonus : 0;
  const rainBonus = settings.rainModeActive ? settings.riderRainBonus : 0;

  const amount = round2(basePickupFee + distanceFee + nightBonus + rainBonus);

  return { amount, distanceKm, breakdown: { basePickupFee, distanceFee, nightBonus, rainBonus } };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type RecordCommissionParams = {
  sourceType: CommissionSourceType;
  orderId?: string;
  orderItemId?: string;
  serviceBookingId?: string;
  vendorId?: string;
  technicianId?: string;
  grossAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  netPayoutAmount: number;
  reversalOfId?: string;
};

/**
 * Writes one CommissionRecord row -- the ledger every Commission Report
 * query aggregates over. Always called inside the same transaction as the
 * wallet credit it corresponds to, so the two can never disagree.
 */
export async function recordCommission(tx: Prisma.TransactionClient, params: RecordCommissionParams) {
  return tx.commissionRecord.create({ data: params });
}

/**
 * Single shared credit path for a completed service booking -- replaces the
 * three call sites (job.controller.ts's completeJob, service.controller.ts's
 * updateMyBookingStatus, and its admin updateBookingStatus) that used to each
 * independently credit the technician the full finalAmount. Resolves the
 * platform service commission %, resolves the mechanic's own payout split via
 * resolveMechanicPayout, credits only the mechanic's share (₹0 for SALARY
 * mechanics), and writes the CommissionRecord ledger row -- all inside the
 * caller's transaction.
 */
export async function creditServiceCompletion(
  tx: Prisma.TransactionClient,
  booking: { id: string; categoryId: string; packageId: string; finalAmount: number },
  technicianId: string
): Promise<{ mechanicShare: number; platformShare: number }> {
  const platform = await resolveServiceCommissionPercent(tx, { packageId: booking.packageId, categoryId: booking.categoryId });
  const payout = await resolveMechanicPayout(tx, {
    technicianId,
    finalAmount: booking.finalAmount,
    platformServicePct: platform.percent,
  });

  await tx.serviceTechnician.update({
    where: { id: technicianId },
    data: {
      // SALARY mechanics still get totalJobs credited even though there's no
      // wallet credit -- it feeds rating/stats displays that shouldn't go
      // stale just because this mechanic isn't paid per job.
      ...(payout.mechanicShare > 0 ? { walletBalance: { increment: payout.mechanicShare } } : {}),
      totalJobs: { increment: 1 },
    },
  });

  await recordCommission(tx, {
    sourceType: CommissionSourceType.SERVICE_BOOKING,
    serviceBookingId: booking.id,
    technicianId,
    grossAmount: booking.finalAmount,
    commissionPercent: payout.platformCommissionPercent,
    commissionAmount: round2(payout.platformShare),
    netPayoutAmount: round2(payout.mechanicShare),
  });

  return { mechanicShare: payout.mechanicShare, platformShare: payout.platformShare };
}
