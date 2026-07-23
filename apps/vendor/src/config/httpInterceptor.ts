// Global axios response interceptor for the vendor panel.
//
// Every page in this app calls the bare `axios` singleton directly (axios.get/post/...)
// rather than a shared pre-configured instance, so patching interceptors on that same
// singleton here (once, at app startup) is enough to cover every request without
// touching each page. Previously the only 401 handling was the profile-sync effect in
// App.tsx, which dispatched logout() but only covered that one request -- every other
// page's API calls left a 401 as a plain error toast with stale/blank data on screen.
// This clears the stored session and redirects to /login for any request, anywhere.
import axios from 'axios';
import { store } from '../store';
import { logout } from '../store/slices/authSlice';

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
