import { Router } from 'express';
import { uploadFile } from '../controllers/upload.controller';
import { upload } from '../middlewares/upload';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Endpoint to upload a single file (image or PDF)
router.post('/', authenticate, upload.single('file'), uploadFile);

export default router;
