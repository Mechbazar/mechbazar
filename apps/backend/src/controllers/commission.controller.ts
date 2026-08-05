import { Request, Response } from 'express';
import { SettlementCycle } from '@prisma/client';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth';
import { getPlatformCommissionSettings, round2 } from '../services/commission.service';
import { recordAuditLog } from '../utils/auditLog';
import { notifyUser } from '../utils/notify';

// ============ Global settings ============

export const getCommissionSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await getPlatformCommissionSettings();
    res.status(200).json(settings);
  } catch (error) {
    console.error('Error fetching commission settings:', error);
    res.status(500).json({ error: 'Failed to fetch commission settings' });
  }
};

const SETTINGS_NUMERIC_FIELDS = [
  'defaultProductCommissionPct', 'defaultServiceCommissionPct', 'gatewayFeePercent',
  'riderBasePickupFee', 'riderPerKmRate', 'riderWaitingChargePerMin', 'riderNightBonus', 'riderRainBonus',
  'riderWeeklyIncentive', 'riderMonthlyIncentive', 'riderWeeklyIncentiveJobs', 'riderMonthlyIncentiveJobs',
] as const;

// Super-Admin-only (enforced at the route level) -- these are the platform-
// wide defaults every commission/payout resolution falls back to.
export const updateCommissionSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const body = req.body;
    const data: Record<string, any> = {};

    for (const field of SETTINGS_NUMERIC_FIELDS) {
      if (body[field] !== undefined) {
        const n = Number(body[field]);
        if (!Number.isFinite(n) || n < 0) {
          res.status(400).json({ error: `${field} must be a non-negative number` });
          return;
        }
        if (field.endsWith('Pct') && n > 100) {
          res.status(400).json({ error: `${field} must be between 0 and 100` });
          return;
        }
        data[field] = n;
      }
    }
    if (body.rainModeActive !== undefined) {
      data.rainModeActive = !!body.rainModeActive;
    }
    if (body.defaultSettlementCycle !== undefined) {
      if (!Object.values(SettlementCycle).includes(body.defaultSettlementCycle)) {
        res.status(400).json({ error: `defaultSettlementCycle must be one of ${Object.values(SettlementCycle).join(', ')}` });
        return;
      }
      data.defaultSettlementCycle = body.defaultSettlementCycle;
    }
    data.updatedByUserId = req.user!.userId;

    const settings = await prisma.platformCommissionSettings.upsert({
      where: { id: 'GLOBAL' },
      update: data,
      create: { id: 'GLOBAL', ...data },
    });

    recordAuditLog({
      userId: req.user!.userId,
      action: 'UPDATE_COMMISSION_SETTINGS',
      entity: 'PlatformCommissionSettings',
      entityId: 'GLOBAL',
      details: JSON.stringify(data),
      req,
    });

    res.status(200).json(settings);
  } catch (error) {
    console.error('Error updating commission settings:', error);
    res.status(500).json({ error: 'Failed to update commission settings' });
  }
};

// ============ Commission overrides (vendor / category / service-category / product / service-package) ============
//
// All five override tables share the exact same shape (a zero-or-one row per
// entity: commissionPercent, isActive, validFrom/validTo, updatedByUserId) --
// see schema.prisma. Rather than five near-identical controllers, this is one
// config-driven set of handlers parameterized by `kind`, bound per-route in
// commission.routes.ts (e.g. upsertOverride('vendor')).

type OverrideKind = 'vendor' | 'category' | 'service-category' | 'product' | 'service-package';

const OVERRIDE_CONFIG: Record<
  OverrideKind,
  {
    delegate: () => any;
    idField: string;
    label: string;
    parentExists: (id: string) => Promise<boolean>;
    // Included on list so the admin panel can show a name instead of a raw
    // id, and a mapper to flatten that relation into a flat `entityName`.
    include: Record<string, any>;
    entityName: (row: any) => string;
  }
> = {
  vendor: {
    delegate: () => prisma.vendorCommission,
    idField: 'vendorId',
    label: 'Vendor',
    parentExists: async (id) => !!(await prisma.vendor.findUnique({ where: { id }, select: { id: true } })),
    include: { vendor: { select: { storeName: true } } },
    entityName: (row) => row.vendor?.storeName || 'Unknown vendor',
  },
  category: {
    delegate: () => prisma.categoryCommission,
    idField: 'categoryId',
    label: 'Category',
    parentExists: async (id) => !!(await prisma.category.findUnique({ where: { id }, select: { id: true } })),
    include: { category: { select: { name: true } } },
    entityName: (row) => row.category?.name || 'Unknown category',
  },
  'service-category': {
    delegate: () => prisma.serviceCategoryCommission,
    idField: 'categoryId',
    label: 'ServiceCategory',
    parentExists: async (id) => !!(await prisma.serviceCategory.findUnique({ where: { id }, select: { id: true } })),
    include: { category: { select: { name: true } } },
    entityName: (row) => row.category?.name || 'Unknown category',
  },
  product: {
    delegate: () => prisma.productCommission,
    idField: 'productId',
    label: 'Product',
    parentExists: async (id) => !!(await prisma.product.findUnique({ where: { id }, select: { id: true } })),
    include: { product: { select: { name: true } } },
    entityName: (row) => row.product?.name || 'Unknown product',
  },
  'service-package': {
    delegate: () => prisma.servicePackageCommission,
    idField: 'packageId',
    label: 'ServicePackage',
    parentExists: async (id) => !!(await prisma.servicePackage.findUnique({ where: { id }, select: { id: true } })),
    include: { package: { select: { name: true } } },
    entityName: (row) => row.package?.name || 'Unknown service',
  },
};

export const listOverrides = (kind: OverrideKind) => async (req: Request, res: Response): Promise<void> => {
  try {
    const cfg = OVERRIDE_CONFIG[kind];
    const rows = await (cfg.delegate() as any).findMany({ orderBy: { updatedAt: 'desc' }, include: cfg.include });
    res.status(200).json(rows.map((row: any) => ({ ...row, entityName: cfg.entityName(row) })));
  } catch (error) {
    console.error(`Error listing ${kind} commission overrides:`, error);
    res.status(500).json({ error: 'Failed to fetch overrides' });
  }
};

// Super-Admin-only (enforced at the route level).
export const upsertOverride = (kind: OverrideKind) => async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cfg = OVERRIDE_CONFIG[kind];
    const entityId = String(req.params.entityId);
    const { commissionPercent, isActive, validFrom, validTo } = req.body;

    const pct = Number(commissionPercent);
    if (commissionPercent == null || !Number.isFinite(pct) || pct < 0 || pct > 100) {
      res.status(400).json({ error: 'commissionPercent must be between 0 and 100' });
      return;
    }
    if (!(await cfg.parentExists(entityId))) {
      res.status(404).json({ error: `${cfg.label} not found` });
      return;
    }

    const data = {
      commissionPercent: pct,
      isActive: isActive ?? true,
      validFrom: validFrom ? new Date(validFrom) : null,
      validTo: validTo ? new Date(validTo) : null,
      updatedByUserId: req.user!.userId,
    };

    const row = await (cfg.delegate() as any).upsert({
      where: { [cfg.idField]: entityId },
      update: data,
      create: { [cfg.idField]: entityId, ...data },
    });

    recordAuditLog({
      userId: req.user!.userId,
      action: 'UPSERT_COMMISSION_OVERRIDE',
      entity: `${cfg.label}Commission`,
      entityId: row.id,
      details: JSON.stringify({ entityId, ...data }),
      req,
    });

    res.status(200).json(row);
  } catch (error) {
    console.error(`Error upserting ${kind} commission override:`, error);
    res.status(500).json({ error: 'Failed to save override' });
  }
};

// Super-Admin-only (enforced at the route level).
export const deleteOverride = (kind: OverrideKind) => async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const cfg = OVERRIDE_CONFIG[kind];
    const entityId = String(req.params.entityId);

    await (cfg.delegate() as any).delete({ where: { [cfg.idField]: entityId } }).catch(() => null);

    recordAuditLog({
      userId: req.user!.userId,
      action: 'DELETE_COMMISSION_OVERRIDE',
      entity: `${cfg.label}Commission`,
      entityId,
      req,
    });

    res.status(200).json({ message: 'Override removed' });
  } catch (error) {
    console.error(`Error deleting ${kind} commission override:`, error);
    res.status(500).json({ error: 'Failed to delete override' });
  }
};

// ============ Per-payee settlement cycle ============

type SettlementCycleKind = 'vendor' | 'rider' | 'mechanic';

const SETTLEMENT_CYCLE_CONFIG: Record<SettlementCycleKind, { delegate: () => any; label: string }> = {
  vendor: { delegate: () => prisma.vendor, label: 'Vendor' },
  rider: { delegate: () => prisma.deliveryPartner, label: 'Rider' },
  mechanic: { delegate: () => prisma.serviceTechnician, label: 'Mechanic' },
};

// Super-Admin-only (enforced at the route level).
export const updateSettlementCycle = (kind: SettlementCycleKind) => async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { settlementCycle } = req.body;
    if (!Object.values(SettlementCycle).includes(settlementCycle)) {
      res.status(400).json({ error: `settlementCycle must be one of ${Object.values(SettlementCycle).join(', ')}` });
      return;
    }

    const cfg = SETTLEMENT_CYCLE_CONFIG[kind];
    const updated = await (cfg.delegate() as any)
      .update({ where: { id }, data: { settlementCycle } })
      .catch(() => null);
    if (!updated) {
      res.status(404).json({ error: `${cfg.label} not found` });
      return;
    }

    recordAuditLog({
      userId: req.user!.userId,
      action: 'UPDATE_SETTLEMENT_CYCLE',
      entity: cfg.label,
      entityId: id,
      details: settlementCycle,
      req,
    });

    res.status(200).json({ id, settlementCycle });
  } catch (error) {
    console.error(`Error updating ${kind} settlement cycle:`, error);
    res.status(500).json({ error: 'Failed to update settlement cycle' });
  }
};

// ============ Rider incentives (batch) ============

// Super-Admin-only (enforced at the route level). Weekly/monthly incentives
// aren't per-order -- this is the batch action that pays out
// PlatformCommissionSettings' configured incentive to every rider who
// crossed the configured job-count threshold in the trailing period.
export const runRiderIncentives = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { period } = req.body;
    if (period !== 'WEEKLY' && period !== 'MONTHLY') {
      res.status(400).json({ error: "period must be 'WEEKLY' or 'MONTHLY'" });
      return;
    }

    const settings = await getPlatformCommissionSettings();
    const incentiveAmount = period === 'WEEKLY' ? settings.riderWeeklyIncentive : settings.riderMonthlyIncentive;
    const thresholdJobs = period === 'WEEKLY' ? settings.riderWeeklyIncentiveJobs : settings.riderMonthlyIncentiveJobs;
    if (incentiveAmount <= 0 || thresholdJobs <= 0) {
      res.status(400).json({ error: `Configure a positive ${period.toLowerCase()} incentive amount and job threshold in Commission Settings first.` });
      return;
    }

    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - (period === 'WEEKLY' ? 7 : 30));

    const riders = await prisma.deliveryPartner.findMany({ where: { isActive: true }, select: { id: true, userId: true } });
    let ridersPaid = 0;
    for (const rider of riders) {
      const jobCount = await prisma.order.count({
        where: { deliveryPartnerId: rider.id, status: 'DELIVERED', updatedAt: { gte: windowStart } },
      });
      if (jobCount >= thresholdJobs) {
        await prisma.deliveryPartner.update({ where: { id: rider.id }, data: { walletBalance: { increment: incentiveAmount } } });
        notifyUser(
          rider.userId,
          `${period === 'WEEKLY' ? 'Weekly' : 'Monthly'} incentive credited`,
          `You earned a ₹${incentiveAmount.toFixed(2)} incentive for completing ${jobCount} deliveries.`,
          { period }
        );
        ridersPaid++;
      }
    }

    recordAuditLog({
      userId: req.user!.userId,
      action: 'RUN_RIDER_INCENTIVES',
      entity: 'DeliveryPartner',
      details: `period=${period} ridersPaid=${ridersPaid}`,
      req,
    });

    res.status(200).json({ period, ridersPaid, incentiveAmount, thresholdJobs });
  } catch (error) {
    console.error('Error running rider incentives:', error);
    res.status(500).json({ error: 'Failed to run rider incentives' });
  }
};

// ============ Commission reports ============

export const getCommissionReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query;
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(String(from));
    if (to) dateFilter.lte = new Date(String(to));
    const where = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

    const [totalAgg, productAgg, serviceAgg, byVendor, byTechnician, pendingCounts, completedCounts] = await Promise.all([
      prisma.commissionRecord.aggregate({ where, _sum: { commissionAmount: true, grossAmount: true } }),
      prisma.commissionRecord.aggregate({ where: { ...where, sourceType: 'PRODUCT_ORDER' }, _sum: { commissionAmount: true, grossAmount: true } }),
      prisma.commissionRecord.aggregate({ where: { ...where, sourceType: 'SERVICE_BOOKING' }, _sum: { commissionAmount: true, grossAmount: true } }),
      prisma.commissionRecord.groupBy({
        by: ['vendorId'],
        where: { ...where, vendorId: { not: null } },
        _sum: { netPayoutAmount: true, commissionAmount: true, grossAmount: true },
      }),
      prisma.commissionRecord.groupBy({
        by: ['technicianId'],
        where: { ...where, technicianId: { not: null } },
        _sum: { netPayoutAmount: true, commissionAmount: true, grossAmount: true },
      }),
      Promise.all([
        prisma.vendorSettlement.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
        prisma.riderSettlement.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
        prisma.technicianSettlement.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
      ]),
      Promise.all([
        prisma.vendorSettlement.count({ where: { status: 'COMPLETED' } }),
        prisma.riderSettlement.count({ where: { status: 'COMPLETED' } }),
        prisma.technicianSettlement.count({ where: { status: 'COMPLETED' } }),
      ]),
    ]);

    const vendorIds = byVendor.map((v) => v.vendorId).filter((id): id is string => !!id);
    const technicianIds = byTechnician.map((t) => t.technicianId).filter((id): id is string => !!id);
    const [vendors, technicians] = await Promise.all([
      prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, storeName: true } }),
      prisma.serviceTechnician.findMany({ where: { id: { in: technicianIds } }, include: { user: { select: { name: true } } } }),
    ]);
    const vendorNameById = new Map(vendors.map((v) => [v.id, v.storeName]));
    const technicianNameById = new Map(technicians.map((t) => [t.id, t.user?.name || 'Unknown']));

    // Revenue by product category -- CommissionRecord has no categoryId of
    // its own, so this joins back through the snapshotted orderItemId.
    const productRecords = await prisma.commissionRecord.findMany({
      where: { ...where, sourceType: 'PRODUCT_ORDER', orderItemId: { not: null } },
      select: { orderItemId: true, grossAmount: true },
    });
    const orderItems = await prisma.orderItem.findMany({
      where: { id: { in: productRecords.map((r) => r.orderItemId!).filter(Boolean) } },
      select: { id: true, product: { select: { category: { select: { name: true } } } } },
    });
    const categoryByOrderItemId = new Map(orderItems.map((oi) => [oi.id, oi.product?.category?.name || 'Uncategorized']));
    const revenueByCategoryMap = new Map<string, number>();
    for (const rec of productRecords) {
      const cat = categoryByOrderItemId.get(rec.orderItemId!) || 'Uncategorized';
      revenueByCategoryMap.set(cat, round2((revenueByCategoryMap.get(cat) || 0) + rec.grossAmount));
    }

    // Revenue by service (package name) -- same idea via serviceBookingId.
    const serviceRecords = await prisma.commissionRecord.findMany({
      where: { ...where, sourceType: 'SERVICE_BOOKING', serviceBookingId: { not: null } },
      select: { serviceBookingId: true, grossAmount: true },
    });
    const bookings = await prisma.serviceBooking.findMany({
      where: { id: { in: serviceRecords.map((r) => r.serviceBookingId!).filter(Boolean) } },
      select: { id: true, package: { select: { name: true } } },
    });
    const packageByBookingId = new Map(bookings.map((b) => [b.id, b.package?.name || 'Unknown Service']));
    const revenueByServiceMap = new Map<string, number>();
    for (const rec of serviceRecords) {
      const svc = packageByBookingId.get(rec.serviceBookingId!) || 'Unknown Service';
      revenueByServiceMap.set(svc, round2((revenueByServiceMap.get(svc) || 0) + rec.grossAmount));
    }

    // Rider earnings: riders carry no commission split (no CommissionRecord
    // rows), so their report comes from Order.riderPayoutAmount directly.
    const riderPayouts = await prisma.order.groupBy({
      by: ['deliveryPartnerId'],
      where: {
        deliveryPartnerId: { not: null },
        riderPayoutAmount: { not: null },
        ...(Object.keys(dateFilter).length ? { updatedAt: dateFilter } : {}),
      },
      _sum: { riderPayoutAmount: true },
      _count: { _all: true },
    });
    const riderIds = riderPayouts.map((r) => r.deliveryPartnerId).filter((id): id is string => !!id);
    const riders = await prisma.deliveryPartner.findMany({ where: { id: { in: riderIds } }, include: { user: { select: { name: true } } } });
    const riderNameById = new Map(riders.map((r) => [r.id, r.user?.name || 'Unknown']));

    res.status(200).json({
      range: { from: from || null, to: to || null },
      totalCommissionEarned: round2(totalAgg._sum.commissionAmount || 0),
      totalGrossRevenue: round2(totalAgg._sum.grossAmount || 0),
      productCommission: round2(productAgg._sum.commissionAmount || 0),
      serviceCommission: round2(serviceAgg._sum.commissionAmount || 0),
      vendorEarnings: byVendor.map((v) => ({
        vendorId: v.vendorId,
        name: vendorNameById.get(v.vendorId!) || 'Unknown',
        netPayout: round2(v._sum.netPayoutAmount || 0),
        commission: round2(v._sum.commissionAmount || 0),
        gross: round2(v._sum.grossAmount || 0),
      })),
      mechanicEarnings: byTechnician.map((t) => ({
        technicianId: t.technicianId,
        name: technicianNameById.get(t.technicianId!) || 'Unknown',
        netPayout: round2(t._sum.netPayoutAmount || 0),
        commission: round2(t._sum.commissionAmount || 0),
        gross: round2(t._sum.grossAmount || 0),
      })),
      riderEarnings: riderPayouts.map((r) => ({
        riderId: r.deliveryPartnerId,
        name: riderNameById.get(r.deliveryPartnerId!) || 'Unknown',
        totalPayout: round2(r._sum.riderPayoutAmount || 0),
        deliveries: r._count._all,
      })),
      pendingSettlements: pendingCounts[0] + pendingCounts[1] + pendingCounts[2],
      completedSettlements: completedCounts[0] + completedCounts[1] + completedCounts[2],
      revenueByCategory: [...revenueByCategoryMap.entries()].map(([category, revenue]) => ({ category, revenue })),
      revenueByService: [...revenueByServiceMap.entries()].map(([service, revenue]) => ({ service, revenue })),
      revenueByVendor: byVendor.map((v) => ({ vendor: vendorNameById.get(v.vendorId!) || 'Unknown', revenue: round2(v._sum.grossAmount || 0) })),
    });
  } catch (error) {
    console.error('Error building commission report:', error);
    res.status(500).json({ error: 'Failed to build commission report' });
  }
};
