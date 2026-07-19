import { Router } from 'express';
import { getManufacturers, getModels, getVariants, getFuelTypes, getVehicleByDetails } from '../controllers/vehicle.controller';

const router = Router();

router.get('/manufacturers', getManufacturers);
router.get('/models', getModels);
router.get('/variants', getVariants);
router.get('/fuels', getFuelTypes);
router.get('/find', getVehicleByDetails);

export default router;
