// Single source of truth for the backend URL. Every admin page previously hardcoded
// its own copy of this string, which is exactly how it drifted out of sync (several
// pages were still pointing at the backend's old port 5000 after it moved to 5005,
// silently breaking Orders, Login, Dashboard, Vendors, and Riders. SERVER_ORIGIN is
// the bare backend origin (no /api suffix) used to build absolute URLs for uploaded
// images/documents served from /uploads. Override via VITE_API_URL / VITE_SERVER_ORIGIN
// for non-local environments.
const DEFAULT_BACKEND_PORT = Number(import.meta.env.VITE_BACKEND_PORT || 5001);
const runtimeHost = typeof window !== 'undefined' && window.location?.hostname
  ? window.location.hostname
  : 'localhost';
export const SERVER_ORIGIN = import.meta.env.VITE_SERVER_ORIGIN || `http://${runtimeHost}:${DEFAULT_BACKEND_PORT}`;
export const API_URL = import.meta.env.VITE_API_URL || `${SERVER_ORIGIN}/api`;

/**
 * Turns a stored upload path into a URL the browser can actually load.
 *
 * POST /upload returns an absolute URL when a Firebase Storage bucket is
 * configured and a bare "/uploads/<file>" path when it falls back to local
 * disk, and seeded catalogue rows hold absolute URLs of their own. Pages that
 * hardcoded `${SERVER_ORIGIN}${path}` therefore produced
 * "http://host:5001https://..." for every absolute URL -- which is every
 * product image in the live catalogue -- and pages that used the raw value
 * broke the relative case instead. Handling both is the whole job, so it lives
 * here next to SERVER_ORIGIN rather than being re-derived per page.
 */
export const resolveUploadUrl = (path?: string | null): string | undefined => {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SERVER_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
};
