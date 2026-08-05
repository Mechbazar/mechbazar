import { OrderStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { emitToOrder, emitToAdmins } from '../realtime/gateway';
import { SERVER_EVENTS, OrderStatusEvent, OrderTimelineStep } from '../realtime/events';

// Order's counterpart to jobState.ts's timeline/broadcast pieces. Deliberately
// not a full port: Order has no per-status timestamp columns the way
// ServiceBooking does (acceptedAt/enRouteAt/etc.), so its timeline is derived
// from OrderStatusHistory rows instead of fixed columns -- see buildOrderTimeline.
// There is also no transitionJob-equivalent state machine here: Order's status
// writes already happen across order.controller.ts/vendor.controller.ts's
// existing update call sites, each already validated for its own flow. This
// module only adds the history row + realtime broadcast alongside those
// existing writes, via broadcastOrderStatus -- it does not gate or replace them.

/** Customer-facing one-liner per status. Single source, so every channel agrees. */
export const ORDER_STATUS_MESSAGE: Record<OrderStatus, string> = {
  PLACED: 'Your order has been placed.',
  ACCEPTED: 'Your order has been accepted.',
  PACKING: 'Your order is being packed.',
  PICKUP: 'Your order is ready for pickup.',
  ON_THE_WAY: 'Your order is out for delivery.',
  DELIVERED: 'Your order has been delivered.',
  CANCELLED: 'This order was cancelled.',
  RETURNED: 'This order was marked returned.',
};

// The happy-path steps shown in a live tracking timeline. CANCELLED/RETURNED
// are exceptions communicated via `status`/`message` directly, not a step --
// same convention jobState.ts's TIMELINE_SPEC uses for CANCELLED.
const ORDER_TIMELINE_SPEC: { key: string; label: string; status: OrderStatus }[] = [
  { key: 'PLACED', label: 'Order Placed', status: 'PLACED' },
  { key: 'ACCEPTED', label: 'Order Accepted', status: 'ACCEPTED' },
  { key: 'PACKING', label: 'Packing', status: 'PACKING' },
  { key: 'PICKUP', label: 'Ready for Pickup', status: 'PICKUP' },
  { key: 'ON_THE_WAY', label: 'Out for Delivery', status: 'ON_THE_WAY' },
  { key: 'DELIVERED', label: 'Delivered', status: 'DELIVERED' },
];

export async function buildOrderTimeline(orderId: string): Promise<OrderTimelineStep[]> {
  const history = await prisma.orderStatusHistory.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
    select: { status: true, createdAt: true },
  });

  // First arrival wins per status, so a later re-notification of the same
  // status (a retried call, an idempotent re-send) can't rewrite history.
  const reachedAt = new Map<OrderStatus, string>();
  for (const row of history) {
    if (!reachedAt.has(row.status)) reachedAt.set(row.status, row.createdAt.toISOString());
  }

  return ORDER_TIMELINE_SPEC.map(({ key, label, status }) => {
    const at = reachedAt.get(status) ?? null;
    return { key, label, at, done: !!at };
  });
}

/**
 * Records an OrderStatusHistory row and broadcasts the new status + timeline.
 * Additive alongside each existing `prisma.order.update({ data: { status } })`
 * call site -- call this right after that update commits, passing the order's
 * new state. Never throws: a realtime/history failure must not roll back an
 * order status change that already succeeded.
 */
export async function broadcastOrderStatus(
  order: { id: string; status: OrderStatus },
  previousStatus: OrderStatus | null,
  changedByUserId?: string | null
): Promise<void> {
  try {
    if (previousStatus === order.status) return; // no-op transition, e.g. a retried request

    await prisma.orderStatusHistory.create({
      data: { orderId: order.id, status: order.status, changedByUserId: changedByUserId || null },
    });

    const at = new Date().toISOString();
    const payload: OrderStatusEvent = {
      orderId: order.id,
      status: order.status,
      previousStatus,
      at,
      message: ORDER_STATUS_MESSAGE[order.status],
    };

    emitToOrder(order.id, SERVER_EVENTS.ORDER_STATUS, payload);
    emitToOrder(order.id, SERVER_EVENTS.ORDER_TIMELINE, {
      orderId: order.id,
      steps: await buildOrderTimeline(order.id),
    });
    emitToAdmins(SERVER_EVENTS.ADMIN_ORDER_UPDATE, { orderId: order.id, status: order.status, at });
  } catch (error) {
    console.error('broadcastOrderStatus error:', error);
  }
}
