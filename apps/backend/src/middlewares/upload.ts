import multer from 'multer';

// Buffered in memory rather than written straight to disk: Vercel's serverless
// functions have no writable/persistent filesystem outside /tmp, so the upload
// controller decides where the buffer ultimately goes (Vercel Blob in
// production, a local uploads/ dir in docker/dev -- see upload.controller.ts).
const storage = multer.memoryStorage();

// File filter to only allow images and PDFs
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP and PDF are allowed.'));
  }
};

export const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});
