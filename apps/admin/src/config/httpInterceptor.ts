// Global axios response interceptor for the admin panel.
//
// Every page in this app calls the bare `axios` singleton directly (axios.get/post/...)
// rather than a shared pre-configured instance, so patching interceptors on that same
// singleton here (once, at app startup) is enough to cover every request without
// touching each page. Previously there was no 401 handling at all outside of each
// page's own try/catch (which just showed an error toast), so an expired/invalid
// token left the user staring at a blank or stale screen instead of being sent back
// to /login. This clears the stored session and redirects, mirroring the vendor app's
// existing (page-scoped) 401 handling in App.tsx.
import axios from 'axios';
import { store, logout } from '../store';

let redirecting = false;

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && !redirecting) {
      redirecting = true;
      store.dispatch(logout());
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
