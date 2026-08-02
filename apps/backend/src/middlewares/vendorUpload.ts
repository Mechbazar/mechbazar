import multer from 'multer';

// Vendor KYC documents (PAN, Aadhaar, GST, business license, cancelled
// cheque) are as sensitive as the rider/technician KYC documents already
// stored this way -- see riderUpload.ts. Buffered in memory here; the
// controller (vendor.controller.ts's addDocument) persists the buffer into
// VendorDocument.fileData (Postgres), never disk or public object storage.
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP and PDF are allowed.'));
  }
};

export const vendorUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter,
});
