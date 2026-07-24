import multer from 'multer';

// Technician KYC documents and service-booking photos (issue/before/after) are
// stored as bytes in Postgres (TechnicianDocument.fileData / ServiceImage.fileData)
// rather than disk or public object storage -- mirrors riderUpload.ts exactly,
// same rationale (KYC content must not be reachable by a bare URL).
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP and PDF are allowed.'));
  }
};

export const technicianUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter,
});
