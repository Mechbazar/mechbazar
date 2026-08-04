import { Router } from 'express';
import {
  getManufacturers,
  getModels,
  getVariants,
  getFuelTypes,
  getVehicleByDetails,
  getAllVehiclesAdmin,
  createManufacturer,
  createModel,
  createVariant,
  createFuelType,
  createVehicleAdmin,
  updateVehicleAdmin,
  deleteVehicleAdmin,
} from '../controllers/vehicle.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

const admins = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS_MANAGER, Role.INVENTORY_MANAGER];

// ----------------------------------------------------
// PUBLIC: taxonomy lookup used by the customer app's vehicle picker
// ----------------------------------------------------
router.get('/manufacturers', getManufacturers);
router.get('/models', getModels);
router.get('/variants', getVariants);
router.get('/fuels', getFuelTypes);
router.get('/find', getVehicleByDetails);

// ----------------------------------------------------
// ADMIN: Vehicle Master Management
// ----------------------------------------------------
router.get('/', authenticate, authorize(admins), getAllVehiclesAdmin);
router.post('/', authenticate, authorize(admins), createVehicleAdmin);
router.put('/:id', authenticate, authorize(admins), updateVehicleAdmin);
router.delete('/:id', authenticate, authorize(admins), deleteVehicleAdmin);
router.post('/manufacturers', authenticate, authorize(admins), createManufacturer);
router.post('/models', authenticate, authorize(admins), createModel);
router.post('/variants', authenticate, authorize(admins), createVariant);
router.post('/fuels', authenticate, authorize(admins), createFuelType);

export default router;
