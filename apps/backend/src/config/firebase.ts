import * as admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';
import fs from 'fs';
import path from 'path';

// Production/Vercel: credentials come from FIREBASE_* env vars -- no key file
// is ever uploaded there (src/config/firebaseServiceAccount.json is
// gitignored). Local dev: falls back to that gitignored JSON file if present.
// The file path is resolved at runtime (not a literal `require(...)`) so a
// missing file can't break the Vercel build, only this catch block.
function loadServiceAccount(): admin.ServiceAccount | null {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return {
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  const localPath = path.join(__dirname, 'firebaseServiceAccount.json');
  if (fs.existsSync(localPath)) {
    return JSON.parse(fs.readFileSync(localPath, 'utf8'));
  }

  return null;
}

try {
  const serviceAccount = loadServiceAccount();
  if (serviceAccount) {
    if (!getApps().length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin initialized');
    }
  } else {
    console.error('Firebase Admin not initialized: no credentials found (set FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY)');
  }
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
}

export default admin;
