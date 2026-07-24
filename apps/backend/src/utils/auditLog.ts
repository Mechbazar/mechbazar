import { Request } from 'express';
import prisma from '../config/prisma';

// Fire-and-forget by design, same pattern as notify.ts -- an audit trail
// write failing (or being slow) must never block or fail the admin action
// it's recording. Called from admin/vendor-approval/coupon/banner mutation
// endpoints so there's a real record of who changed what, not a UI-only log.
export function recordAuditLog(params: {
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  req?: Request;
}) {
  const ipAddress = params.req
    ? String(params.req.headers['x-forwarded-for'] || params.req.socket.remoteAddress || '')
    : undefined;

  prisma.auditLog
    .create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details,
        ipAddress,
      },
    })
    .catch((err) => console.error('[auditLog] Failed to record entry:', err));
}
