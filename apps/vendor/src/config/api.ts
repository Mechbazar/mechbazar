// Single source of truth for the backend URL, mirroring apps/admin/src/config/api.ts.
// Products.tsx previously hardcoded 'http://localhost:5000/api' directly, out of sync
// with the backend's actual port. SERVER_ORIGIN is the bare backend origin (no /api
// suffix) used to build absolute URLs for uploaded images/documents served from
// /uploads. Override via VITE_API_URL / VITE_SERVER_ORIGIN for non-local environments
// (the docker-compose stack, which serves the backend on 5005, needs VITE_SERVER_ORIGIN
// set at build time).
const DEFAULT_BACKEND_PORT = Number(import.meta.env.VITE_BACKEND_PORT || 5001);
export const SERVER_ORIGIN = import.meta.env.VITE_SERVER_ORIGIN || `http://localhost:${DEFAULT_BACKEND_PORT}`;
export const API_URL = import.meta.env.VITE_API_URL || `${SERVER_ORIGIN}/api`;

/**
 * Turns a stored upload path into a URL the browser can actually load.
 *
 * POST /upload returns an absolute URL when a Firebase Storage bucket is
 * configured and a bare "/uploads/<file>" path when it falls back to local
 * disk, and seeded catalogue rows hold absolute URLs of their own. Prefixing
 * SERVER_ORIGIN unconditionally corrupts the absolute case; using the raw
 * value breaks the relative one. Mirrors apps/admin/src/config/api.ts.
 */
export const resolveUploadUrl = (path?: string | null): string | undefined => {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SERVER_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
};
