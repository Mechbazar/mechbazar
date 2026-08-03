import prisma from '../config/prisma';
import { createCrudHandlers } from '../utils/crudFactory';

// Reference implementation for utils/crudFactory.ts -- see that file's header
// for what it does and does not do. This controller's behavior (response
// shapes, status codes, the code-uniqueness and inventory-count guards) is
// unchanged from before this refactor; only the boilerplate around those
// checks moved into the shared factory.

// Synthesizes the legacy free-text `address` field from structured parts when
// the caller sends only those (e.g. a future map-based picker) and omits
// `address` -- keeps existing clients that still read `address` as plain
// text working, even for rows created without ever typing a free-text address.
function synthesizeAddress(parts: { addressLine1?: string; addressLine2?: string; city?: string; state?: string; pincode?: string }) {
  return [parts.addressLine1, parts.addressLine2, parts.city, parts.state, parts.pincode].filter(Boolean).join(', ');
}

const handlers = createCrudHandlers({
  delegate: prisma.warehouse,
  resourceName: 'warehouse',
  list: { include: { _count: { select: { inventory: true } } } },

  buildCreateData: (body) => {
    const {
      name, code, address, managerName, phone, capacity,
      addressLine1, addressLine2, city, state, pincode, country, lat, lng, placeId, formattedAddress,
    } = body;
    const resolvedAddress = address || synthesizeAddress({ addressLine1, addressLine2, city, state, pincode });
    return {
      name, code, address: resolvedAddress, managerName, phone, capacity: Number(capacity) || 0,
      addressLine1, addressLine2, city, state, pincode, country, lat, lng, placeId, formattedAddress,
    };
  },

  buildUpdateData: (body) => {
    const {
      name, address, managerName, phone, capacity, isActive,
      addressLine1, addressLine2, city, state, pincode, country, lat, lng, placeId, formattedAddress,
    } = body;
    return {
      name, address, managerName, phone, capacity: Number(capacity), isActive,
      addressLine1, addressLine2, city, state, pincode, country, lat, lng, placeId, formattedAddress,
    };
  },

  beforeCreate: async (body) => {
    const existing = await prisma.warehouse.findUnique({ where: { code: body.code } });
    if (existing) return { error: 'Warehouse code already exists' };
  },

  beforeDelete: async (id) => {
    const invCount = await prisma.inventory.count({ where: { warehouseId: id } });
    if (invCount > 0) return { error: 'Cannot delete warehouse with existing inventory' };
  },
});

export const getWarehouses = handlers.list;
export const createWarehouse = handlers.create;
export const updateWarehouse = handlers.update;
export const deleteWarehouse = handlers.remove;
