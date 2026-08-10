import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import prisma from '../config/prisma';

const MOBILE_VERSION_KEY = 'mobile_latest_version';

// Public -- the customer app calls this from its About screen's "Check for
// Updates" button, passing the version it's actually running.
//
// Bootstrap rule: if no admin has ever set a latest version, echo back
// whatever the client just reported instead of comparing against nothing.
// The alternative (treat "unset" as some fixed default) would either falsely
// claim an update is available on the very first release after this shipped,
// or silently hide a real one -- neither is knowable without an admin having
// actually recorded a value yet. Same defensive shape as
// serviceability.service.ts's empty-table-means-unrestricted rule.
export const getMobileVersion = async (req: Request, res: Response) => {
  try {
    const current = String(req.query.current || '').trim();
    const row = await prisma.platformSetting.findUnique({ where: { key: MOBILE_VERSION_KEY } });
    const latestVersion = row?.value || current || '0.0.0';
    res.json({ latestVersion, upToDate: !current || current === latestVersion });
  } catch (error) {
    console.error('Error fetching mobile app version setting:', error);
    res.status(500).json({ error: 'Failed to check for updates' });
  }
};

const VERSION_REGEX = /^\d+\.\d+\.\d+$/;

// Admin-only (enforced at the route level) -- lets whoever ships a mobile
// release record the new version number so the About screen's update check
// has something real to compare against.
export const setMobileVersion = async (req: AuthRequest, res: Response) => {
  try {
    const version = String(req.body?.version || '').trim();
    if (!VERSION_REGEX.test(version)) {
      res.status(400).json({ error: 'Version must be in x.y.z format, e.g. 1.2.0' });
      return;
    }
    const row = await prisma.platformSetting.upsert({
      where: { key: MOBILE_VERSION_KEY },
      update: { value: version },
      create: { key: MOBILE_VERSION_KEY, value: version },
    });
    res.json({ latestVersion: row.value });
  } catch (error) {
    console.error('Error updating mobile app version setting:', error);
    res.status(500).json({ error: 'Failed to update version' });
  }
};
