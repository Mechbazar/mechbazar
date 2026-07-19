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
