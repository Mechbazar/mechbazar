// prisma.user.findMany/findUnique/create/update return every scalar column
// by default, including the bcrypt password hash -- nothing strips it before
// these records reach res.json(), so every endpoint that serializes a User
// (login/register responses, admin list endpoints) was leaking it to the
// client. Wrap any User-shaped object/array with this before sending it out.
export function sanitizeUser<T extends { password?: string | null }>(user: T): Omit<T, 'password'> {
  const { password, ...rest } = user;
  return rest;
}

export function sanitizeUsers<T extends { password?: string | null }>(users: T[]): Omit<T, 'password'>[] {
  return users.map(sanitizeUser);
}

// order.controller.ts nests a raw User both directly (order.user) and one
// level deeper (order.deliveryPartner.user) via Prisma `include`. Handles
// both without a generic recursive walk, which would risk mangling Date/
// Bytes fields elsewhere in the schema.
type OrderWithUsers = {
  user?: { password?: string | null } | null;
  deliveryPartner?: ({ user?: { password?: string | null } | null } & Record<string, unknown>) | null;
} & Record<string, unknown>;

export function sanitizeOrder<T extends OrderWithUsers>(order: T): T {
  return {
    ...order,
    ...(order.user ? { user: sanitizeUser(order.user) } : {}),
    ...(order.deliveryPartner
      ? {
          deliveryPartner: {
            ...order.deliveryPartner,
            ...(order.deliveryPartner.user ? { user: sanitizeUser(order.deliveryPartner.user) } : {}),
          },
        }
      : {}),
  };
}

export function sanitizeOrders<T extends OrderWithUsers>(orders: T[]): T[] {
  return orders.map(sanitizeOrder);
}

// deliveryOtp must only ever reach the order's own owner (the customer) --
// the rider is who's supposed to receive it FROM the customer, and
// admin/vendor list views have no legitimate reason to see it either.
// Apply to any order-shaped response that ISN'T the customer's own
// getMyOrders/getOrderById(isOwner) -- admin/vendor/rider list & action
// endpoints. Mirrors ServiceBooking.completionOtp's handling.
export function stripDeliveryOtp<T extends Record<string, unknown>>(order: T): T {
  return { ...order, deliveryOtp: undefined, deliveryOtpGeneratedAt: undefined };
}

export function stripDeliveryOtps<T extends Record<string, unknown>>(orders: T[]): T[] {
  return orders.map(stripDeliveryOtp);
}

// service.controller.ts nests a raw User both directly (booking.user) and one
// level deeper (booking.technician.user) via Prisma `include` -- same shape
// as sanitizeOrder above.
type BookingWithUsers = {
  user?: { password?: string | null } | null;
  technician?: ({ user?: { password?: string | null } | null } & Record<string, unknown>) | null;
} & Record<string, unknown>;

export function sanitizeBooking<T extends BookingWithUsers>(booking: T): T {
  return {
    ...booking,
    ...(booking.user ? { user: sanitizeUser(booking.user) } : {}),
    ...(booking.technician
      ? {
          technician: {
            ...booking.technician,
            ...(booking.technician.user ? { user: sanitizeUser(booking.technician.user) } : {}),
          },
        }
      : {}),
  };
}

export function sanitizeBookings<T extends BookingWithUsers>(bookings: T[]): T[] {
  return bookings.map(sanitizeBooking);
}
