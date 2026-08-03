import { Request, Response } from 'express';

// Minimal shape shared by every Prisma model delegate (prisma.warehouse,
// prisma.supplier, ...) -- typed loosely on purpose. Prisma's generated
// per-model types don't unify cleanly across models with a single generic
// (each model's `where`/`data`/`include` are structurally different types),
// and fighting that for an internal admin-CRUD factory isn't worth the
// payoff -- the real safety net is still each resource's own buildCreateData/
// buildUpdateData, which return typed Prisma input objects at the call site.
export interface CrudDelegate {
  findMany: (args?: any) => Promise<any[]>;
  create: (args: { data: any }) => Promise<any>;
  update: (args: { where: { id: string }; data: any }) => Promise<any>;
  delete: (args: { where: { id: string } }) => Promise<any>;
}

export interface CrudFactoryConfig {
  delegate: CrudDelegate;
  // Lowercase singular noun for error messages, e.g. "warehouse" ->
  // "Failed to fetch warehouses" / "Warehouse deleted successfully".
  resourceName: string;
  list?: { include?: any; orderBy?: any };
  // Maps req.body to the Prisma `data` payload. Kept as a hook rather than
  // "pick every body key" so each resource keeps its own field allowlist,
  // Number()/synthesized-field coercions, etc. -- the same responsibility
  // warehouse.controller.ts and supplier.controller.ts already had inline.
  buildCreateData: (body: any) => any | Promise<any>;
  buildUpdateData: (body: any) => any | Promise<any>;
  // Runs before create/delete; returning { error } short-circuits with a 400
  // and never calls Prisma, matching the existing "code already exists" /
  // "has related rows" guards these controllers had before this factory.
  beforeCreate?: (body: any) => Promise<{ error: string } | void> | { error: string } | void;
  beforeDelete?: (id: string) => Promise<{ error: string } | void> | { error: string } | void;
}

export interface CrudHandlers {
  list: (req: Request, res: Response) => Promise<void>;
  create: (req: Request, res: Response) => Promise<void>;
  update: (req: Request, res: Response) => Promise<void>;
  remove: (req: Request, res: Response) => Promise<void>;
}

// Produces the four handlers a plain single-model CRUD controller needs,
// matching the response shape already established by warehouse.controller.ts
// / supplier.controller.ts (this factory's reference implementations, see
// their headers): bare model object/array on success, 201 on create, 200
// elsewhere, { message } on delete, { error } + console.error + 500 on any
// unhandled exception. Deliberately does NOT wrap responses in { data: ... }
// or add pagination -- introducing either here would be a behavior change to
// every route this factory touches, not a refactor.
//
// Not a fit for a resource with real domain logic in the write path (stock
// decrements, multi-model transactions, notifications) -- see order.controller.ts
// for that shape instead. This factory is for the "just CRUD on one model"
// tier: banner, category, offer, warehouse, supplier and similar.
export function createCrudHandlers(config: CrudFactoryConfig): CrudHandlers {
  const { delegate, resourceName, list, buildCreateData, buildUpdateData, beforeCreate, beforeDelete } = config;
  const label = resourceName.charAt(0).toUpperCase() + resourceName.slice(1);

  const listHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const rows = await delegate.findMany({ include: list?.include, orderBy: list?.orderBy });
      res.status(200).json(rows);
    } catch (error) {
      console.error(`Error fetching ${resourceName}s:`, error);
      res.status(500).json({ error: `Failed to fetch ${resourceName}s` });
    }
  };

  const createHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      if (beforeCreate) {
        const guard = await beforeCreate(req.body);
        if (guard && guard.error) {
          res.status(400).json({ error: guard.error });
          return;
        }
      }
      const data = await buildCreateData(req.body);
      const row = await delegate.create({ data });
      res.status(201).json(row);
    } catch (error) {
      console.error(`Error creating ${resourceName}:`, error);
      res.status(500).json({ error: `Failed to create ${resourceName}` });
    }
  };

  const updateHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = String(req.params.id);
      const data = await buildUpdateData(req.body);
      const row = await delegate.update({ where: { id }, data });
      res.status(200).json(row);
    } catch (error) {
      console.error(`Error updating ${resourceName}:`, error);
      res.status(500).json({ error: `Failed to update ${resourceName}` });
    }
  };

  const removeHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = String(req.params.id);
      if (beforeDelete) {
        const guard = await beforeDelete(id);
        if (guard && guard.error) {
          res.status(400).json({ error: guard.error });
          return;
        }
      }
      await delegate.delete({ where: { id } });
      res.status(200).json({ message: `${label} deleted successfully` });
    } catch (error) {
      console.error(`Error deleting ${resourceName}:`, error);
      res.status(500).json({ error: `Failed to delete ${resourceName}` });
    }
  };

  return { list: listHandler, create: createHandler, update: updateHandler, remove: removeHandler };
}
