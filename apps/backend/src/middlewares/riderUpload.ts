import multer from 'multer';

// Rider KYC documents (Aadhaar, DL, RC, insurance, PUC, selfie) are more
// sensitive than product images or the vendor documents that already go
// through middlewares/upload.ts -- they're stored as bytes in Postgres
// (RiderDocument.fileData) rather than disk or public object storage, so
// they're never reachable by a bare URL. Buffered in memory here; the
// controller (rider.controller.ts's uploadMyDocument) persists the buffer.
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP and PDF are allowed.'));
  }
};

export const riderUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter,
});
