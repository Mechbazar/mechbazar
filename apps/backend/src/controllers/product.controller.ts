import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/auth';
import { Role, VendorStatus } from '@prisma/client';
import { normalizeVehicleType, parseVehicleTypeFilter } from '../utils/vehicleType';

// The admin product form has no vendor picker -- products added directly by
// an admin (not on behalf of a specific seller) are attributed to this single,
// stable "house" vendor rather than a randomly-fabricated one-off vendor per
// missed lookup (the previous behaviour). Idempotent: created once, reused
// after that. NOTE: '0000000000' and '9999999999' are already reserved by
// seed-admin.ts and seed(-from-live).ts respectively -- don't reuse those.
const HOUSE_VENDOR_PHONE = '0000000002';

const getOrCreateHouseVendor = async () => {
  const existingUser = await prisma.user.findUnique({ where: { phone: HOUSE_VENDOR_PHONE }, include: { vendorProfile: true } });
  if (existingUser?.vendorProfile) return existingUser.vendorProfile;

  const user = existingUser ?? await prisma.user.create({
    data: { phone: HOUSE_VENDOR_PHONE, name: 'MechBazar Direct', role: Role.VENDOR },
  });
  return prisma.vendor.create({
    data: { userId: user.id, storeName: 'MechBazar Direct', status: VendorStatus.APPROVED },
  });
};

// Shared by createProduct/bulkCreateProducts: a VENDOR can only ever create
// products under their own vendor profile; an admin-tier caller may pass an
// explicit vendorId (product created on that vendor's behalf), or fall back
// to the house vendor when adding a direct/in-house product.
const resolveVendorForWrite = async (req: AuthRequest, bodyVendorId?: string) => {
  if (req.user!.role === Role.VENDOR) {
    return prisma.vendor.findUnique({ where: { userId: req.user!.userId } });
  }
  if (bodyVendorId) {
    return prisma.vendor.findUnique({ where: { id: bodyVendorId } });
  }
  return getOrCreateHouseVendor();
};

export const getBrands = async (req: Request, res: Response) => {
  try {
    const { vehicle, vehicleType } = req.query;
    const rawVehicleType = vehicle || vehicleType;
    const resolved = parseVehicleTypeFilter(rawVehicleType);
    if (rawVehicleType && !resolved) {
      res.status(400).json({ error: `Invalid vehicleType "${rawVehicleType}". Must be CAR or BIKE.` });
      return;
    }
    const brands = await prisma.brand.findMany({
      where: resolved ? { vehicleType: resolved } : {},
    });
    res.json(brands);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
};

const ADMIN_PRODUCT_ROLES: string[] = [Role.ADMIN, Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.VENDOR_MANAGER];

export const getProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { vehicleId, categoryId, category_id, categoryName, q, search, vehicleMake, vehicleModel, vehicleType, vehicle_type, status } = req.query;
    // Public/customer callers only ever see APPROVED products (unchanged
    // behaviour). An authenticated admin caller manages the catalog from this
    // same list (Products.tsx has no separate "pending review" view) and
    // previously could never see or re-approve a product they'd set to
    // PENDING/INACTIVE/REJECTED, since it would vanish from their own list --
    // let them pass an explicit status filter, or see every status by default.
    const isAdminCaller = !!req.user && ADMIN_PRODUCT_ROLES.includes(req.user.role);
    const statusFilter = isAdminCaller
      ? (status ? { status: String(status) as any } : {})
      : { status: 'APPROVED' as const };
    const resolvedCategoryId = categoryId || category_id;
    const resolvedSearch = q || search;
    const rawVehicleType = vehicleType || vehicle_type;
    const resolvedVehicleType = parseVehicleTypeFilter(rawVehicleType);
    if (rawVehicleType && !resolvedVehicleType) {
      res.status(400).json({ error: `Invalid vehicleType "${rawVehicleType}". Must be CAR or BIKE.` });
      return;
    }
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    // Core Compatibility Engine filtering. vehicleType is a first-class field on
    // Product (and Category) -- filtering by it here is independent of, and
    // composes with, the make/model/vehicleId compatibility filters below.
    const products = await prisma.product.findMany({
      where: {
        ...statusFilter,
        ...(resolvedCategoryId && { categoryId: String(resolvedCategoryId) }),
        ...(categoryName && { category: { name: String(categoryName) } }),
        ...(resolvedSearch && {
          OR: [
            { name: { contains: String(resolvedSearch) } }, // No mode insensitive since Prisma MySQL doesn't strictly need it if collation is CI, but can add it if needed.
            { oemNumber: { contains: String(resolvedSearch) } },
            { description: { contains: String(resolvedSearch) } }
          ]
        }),
        ...((vehicleId || vehicleMake || vehicleModel) && {
          compatibilities: {
            some: {
              ...(vehicleId && { vehicleId: String(vehicleId) }),
              vehicle: {
                ...(vehicleMake && { manufacturer: { name: String(vehicleMake) } }),
                ...(vehicleModel && { model: { name: String(vehicleModel) } })
              }
            },
          },
        }),
        ...(resolvedVehicleType && { vehicleType: resolvedVehicleType }),
      },
      include: {
        category: true,
        brand: true,
      },
      // Without an explicit order, Postgres doesn't guarantee newest-first (or
      // any stable order at all) -- a vendor's freshly added product could land
      // anywhere in the result set. Since callers like the mobile Home screen's
      // "trending" list just take the first N results (`getTrendingProducts`
      // slices to 5), an unordered query meant new products routinely never
      // appeared within that window even though they were correctly in the DB.
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { 
        id: String(id),
        status: 'APPROVED'
      },
      include: {
        category: true,
        brand: true,
        compatibilities: {
          include: {
            vehicle: true,
          }
        },
        reviews: true,
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { name, category, oem, price, mrp, b2bPrice, lowStockThreshold, stock, vehicleType, vendorId } = req.body;

    const vendor = await resolveVendorForWrite(req, vendorId);
    if (!vendor) {
      res.status(400).json({ error: 'No vendor profile found for this account, and the provided vendorId does not exist.' });
      return;
    }

    const resolvedVehicleType = normalizeVehicleType(vehicleType);

    // Category is unique on [name, vehicleType] -- a name-only lookup is
    // ambiguous once both a CAR and a BIKE category can share the same name,
    // so the vehicleType must be part of the lookup/create key too.
    let cat = await prisma.category.findFirst({ where: { name: category, vehicleType: resolvedVehicleType } });
    if (!cat) {
      cat = await prisma.category.create({ data: { name: category, vehicleType: resolvedVehicleType } });
    }

    let brand = await prisma.brand.findFirst();
    if (!brand) {
      brand = await prisma.brand.create({ data: { name: 'Generic Brand' } });
    }

    const newProduct = await prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: cat.id,
        brandId: brand.id,
        name,
        description: 'New product',
        price: Number(price) || 0,
        mrp: Number(mrp) || Number(price) || 0,
        stock: Number(stock) || 0,
        oemNumber: oem || null,
        vehicleType: resolvedVehicleType,
        b2bPrice: b2bPrice !== undefined && b2bPrice !== '' ? Number(b2bPrice) : null,
        ...(lowStockThreshold !== undefined && lowStockThreshold !== '' && { lowStockThreshold: Number(lowStockThreshold) }),
      },
    });

    res.status(201).json(newProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

export const updateProductStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { status } = req.body;

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { status }
    });

    res.json(updatedProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update product status' });
  }
};

export const bulkCreateProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Body stays a raw array (matches the existing vendor-app CSV importer); an
    // admin-tier caller identifies the target vendor via ?vendorId= instead,
    // since only a VENDOR caller can resolve one implicitly from their profile.
    const productsArray = req.body;

    if (!Array.isArray(productsArray) || productsArray.length === 0) {
      res.status(400).json({ error: 'Invalid payload. Expected an array of products.' });
      return;
    }

    const vendor = await resolveVendorForWrite(req, req.query.vendorId as string | undefined);
    if (!vendor) {
      res.status(400).json({ error: 'vendorId is required and must reference an existing vendor.' });
      return;
    }

    let brand = await prisma.brand.findFirst();
    if (!brand) brand = await prisma.brand.create({ data: { name: 'Generic Brand' } });

    // Deduplicate and ensure categories exist
    const categoriesToEnsure = Array.from(new Set(productsArray.map((p: any) => p.category)));
    const existingCats = await prisma.category.findMany({
      where: { name: { in: categoriesToEnsure } }
    });
    
    const existingCatNames = existingCats.map(c => c.name);
    const newCatsToCreate = categoriesToEnsure.filter(c => !existingCatNames.includes(c));
    
    if (newCatsToCreate.length > 0) {
      await prisma.category.createMany({
        data: newCatsToCreate.map(name => ({ name }))
      });
    }
    
    // Refetch all categories needed
    const allRelevantCats = await prisma.category.findMany({
      where: { name: { in: categoriesToEnsure } }
    });
    const catMap = new Map(allRelevantCats.map(c => [c.name, c.id]));

    const productsToInsert = productsArray.map((p: any) => ({
      vendorId: vendor?.id || '',
      brandId: brand?.id || '',
      categoryId: catMap.get(p.category) || allRelevantCats[0].id,
      name: p.name,
      description: p.description || 'Bulk uploaded product',
      price: Number(p.basePrice) || Number(p.price) || 0,
      mrp: Number(p.basePrice) || Number(p.price) || 0,
      stock: Number(p.stock) || 0,
      oemNumber: p.oem || null,
      status: 'APPROVED'
    }));

    // Since we need to trigger inventory creation (which might be complex via triggers or middleware),
    // we'll just insert products first.
    const created = await prisma.product.createMany({
      data: productsToInsert,
      skipDuplicates: true
    });

    res.status(201).json({ message: `Successfully created ${created.count} products`, count: created.count });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ error: 'Failed to bulk upload products' });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { name, category, oemNumber, partNumber, price, mrp, b2bPrice, lowStockThreshold, stock, status, images, vehicleType } = req.body;

    // A category rename/reassignment must resolve against the *new* vehicleType
    // if one was also provided in this same request, since Category is unique
    // on [name, vehicleType] -- otherwise fall back to the product's current
    // vehicleType so an update that only changes, say, price doesn't
    // accidentally look up the wrong-vehicle category of the same name.
    let categoryData = {};
    if (category) {
      const vehicleTypeForLookup = vehicleType
        ? normalizeVehicleType(vehicleType)
        : (await prisma.product.findUnique({ where: { id }, select: { vehicleType: true } }))?.vehicleType;
      let cat = await prisma.category.findFirst({ where: { name: category, vehicleType: vehicleTypeForLookup } });
      if (!cat) {
        cat = await prisma.category.create({ data: { name: category, vehicleType: vehicleTypeForLookup } });
      }
      categoryData = { categoryId: cat.id };
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name,
        oemNumber,
        partNumber,
        price: price ? Number(price) : undefined,
        mrp: mrp ? Number(mrp) : undefined,
        stock: stock !== undefined ? Number(stock) : undefined,
        status,
        // Empty string means the admin cleared the field in the UI -- persist that as
        // "no B2B price" rather than leaving the previous value in place. Undefined
        // (field absent from the request) means don't touch it.
        b2bPrice: b2bPrice !== undefined ? (b2bPrice === '' ? null : Number(b2bPrice)) : undefined,
        lowStockThreshold: lowStockThreshold !== undefined && lowStockThreshold !== '' ? Number(lowStockThreshold) : undefined,
        ...(images && { images }),
        ...(vehicleType !== undefined && { vehicleType: normalizeVehicleType(vehicleType) }),
        ...categoryData
      }
    });

    res.json(updatedProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    // Check for order items linking to this product to avoid FK constraints breaking
    const orderItems = await prisma.orderItem.count({ where: { productId: id } });
    if (orderItems > 0) {
       res.status(400).json({ error: 'Cannot delete product that has been ordered. Mark it as INACTIVE instead.' });
       return;
    }

    // The schema has no onDelete cascade, so Inventory/StockMovement/
    // ProductCompatibility/Review/Wishlist rows referencing this product must
    // be cleaned up first, or the delete below throws an FK-violation 500 --
    // which it did for almost every real product, since vendor.controller.ts's
    // createProduct auto-creates an Inventory row for any product with stock.
    // Mirrors vendor.controller.ts's deleteMyProduct, which already does this.
    await prisma.$transaction(async (tx) => {
      const inventories = await tx.inventory.findMany({ where: { productId: id }, select: { id: true } });
      await tx.stockMovement.deleteMany({ where: { inventoryId: { in: inventories.map((i) => i.id) } } });
      await tx.inventory.deleteMany({ where: { productId: id } });
      await tx.productCompatibility.deleteMany({ where: { productId: id } });
      await tx.review.deleteMany({ where: { productId: id } });
      await tx.wishlist.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};
