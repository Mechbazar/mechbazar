// Most screens in this app call the global `fetch` directly with a manually
// attached `Authorization: Bearer <token>` header (rather than going through
// the shared axios `api` instance in services/api.ts), so a per-call 401 check
// would mean editing dozens of call sites one at a time -- exactly the kind of
// page-by-page patching we want to avoid. Instead, patch `global.fetch` once,
// here, so ANY expired/invalid-token response anywhere in the app forces a
// real logout (clearing Redux + the persisted session via App.tsx's own
// effect) instead of leaving the user stuck on a screen that looks logged-in
// but silently fails.
//
// Imported once, for its side effect only, at the top of App.tsx so it wraps
// fetch before any screen has a chance to call it.
import { API_BASE_URL } from './api';

const apiOrigin = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return null;
  }
})();

const globalScope = globalThis as any;
const originalFetch = globalScope.fetch.bind(globalScope);

globalScope.fetch = async (...args: Parameters<typeof fetch>) => {
  const response = await originalFetch(...args);

  if (response.status === 401) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url;
    const isOurApi = !apiOrigin || !url ? true : url.startsWith(API_BASE_URL) || url.startsWith(apiOrigin);
    // Lazy-required to dodge a store <-> service require cycle. A logged-out
    // user hitting a 401 (e.g. a failed login/send-otp attempt) is expected
    // and must not trigger anything -- only react when a session actually
    // existed and this request belonged to our own backend.
    if (isOurApi) {
      const { store } = require('../store');
      const { logout } = require('../store/authSlice');
      if (store.getState().auth.token) {
        store.dispatch(logout());
      }
    }
  }

  return response;
};
