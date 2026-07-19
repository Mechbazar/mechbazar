import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { put } from '@vercel/blob';

const uniqueFilename = (originalname: string) => {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  return `file-${uniqueSuffix}${path.extname(originalname)}`;
};

export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const filename = uniqueFilename(req.file.originalname);

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
