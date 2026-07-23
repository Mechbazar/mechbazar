import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { put } from '@vercel/blob';

// The saved extension must come from the validated mimetype, never the
// client-supplied original filename -- multer's fileFilter (upload.ts) checks
// `file.mimetype`, but that's just the multipart part's Content-Type header,
// which a client can spoof independently of the filename. Deriving the
// on-disk extension from the filename instead would let a spoofed upload
// (e.g. Content-Type: image/jpeg, filename: x.html) get saved as .html and
// served back with a text/html Content-Type by the static file server at
// /uploads -- a stored-XSS vector. Mapping from mimetype closes that gap.
const EXTENSION_BY_MIMETYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const uniqueFilename = (mimetype: string) => {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const ext = EXTENSION_BY_MIMETYPE[mimetype] || '';
  return `file-${uniqueSuffix}${ext}`;
};

export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const filename = uniqueFilename(req.file.mimetype);

    // BLOB_READ_WRITE_TOKEN is only set when a Vercel Blob store is attached
    // (production/Vercel deployments). Local docker/dev has no persistent
    // Blob store configured, so it keeps writing to the local uploads/ dir
    // that index.ts already serves at /uploads.
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(filename, req.file.buffer, {
        access: 'public',
        contentType: req.file.mimetype,
      });
      res.status(200).json({
        url: blob.url,
        filename,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
      return;
    }

    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);

    res.status(200).json({
      url: `/uploads/${filename}`,
      filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
};
