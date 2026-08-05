import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';
import { signOut } from 'firebase/auth';
import { useDispatch } from 'react-redux';
import { useSelector } from 'react-redux';
import type { RootState } from './store';
import { updateVendorProfile, logout } from './store/slices/authSlice';
import { auth } from './config/firebase';
import { registerForWebPushAsync } from './services/webPush';
import Layout from './components/Layout';
import PageLoader from './components/PageLoader';
import { API_URL } from './config/api';

// Route-level code-splitting, same as apps/admin's App.tsx -- each page is
// its own chunk, fetched only when its route is actually visited, instead of
// every page shipping in the single bundle every vendor downloads just to
// see the login screen.
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const AuthAction = lazy(() => import('./pages/AuthAction'));
const Register = lazy(() => import('./pages/Register'));
const PendingApproval = lazy(() => import('./pages/PendingApproval'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const Orders = lazy(() => import('./pages/Orders'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Wallet = lazy(() => import('./pages/Wallet'));
const Profile = lazy(() => import('./pages/Profile'));
const Coupons = lazy(() => import('./pages/Coupons'));
const Notifications = lazy(() => import('./pages/Notifications'));
const NotificationPreferences = lazy(() => import('./pages/NotificationPreferences'));
const Returns = lazy(() => import('./pages/Returns'));

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, vendorProfile } = useSelector((state: RootState) => state.auth);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (vendorProfile?.status !== 'APPROVED') return <Navigate to="/pending-approval" replace />;
  return <>{children}</>;
};

function App() {
  const dispatch = useDispatch();
  const { token } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (!token) return;

    const syncVendorProfile = async () => {
      try {
        const res = await axios.get(`${API_URL}/vendors/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        dispatch(updateVendorProfile(res.data));
      } catch (error: any) {
        if (error?.response?.status === 401 || error?.response?.status === 403) {
          dispatch(logout());
          signOut(auth).catch(() => {});
        }
      }
    };

    syncVendorProfile();
  }, [token, dispatch]);

  // Browser push -- writes to User.fcmToken (separate from the native apps'
  // Expo token column), so a vendor who's also logged into a native app
  // doesn't have one channel's registration overwrite the other's.
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const fcmToken = await registerForWebPushAsync();
        if (!fcmToken) return;
        await axios.patch(
          `${API_URL}/auth/push-token`,
          { token: fcmToken, type: 'fcm' },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (e) {
        console.error('Failed to register web push token:', e);
      }
    })();
  }, [token]);

  const Wrapped = (Page: React.ComponentType) => (
    <ProtectedRoute><Layout><Page /></Layout></ProtectedRoute>
  );

  return (
    <>
      <Toaster toastOptions={{ style: { background: '#171717', color: '#fff', border: '1px solid #262626' } }} />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/auth-action" element={<AuthAction />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pending-approval" element={<PendingApproval />} />
          <Route path="/dashboard" element={Wrapped(Dashboard)} />
          <Route path="/products" element={Wrapped(Products)} />
          <Route path="/orders" element={Wrapped(Orders)} />
          <Route path="/inventory" element={Wrapped(Inventory)} />
          <Route path="/wallet" element={Wrapped(Wallet)} />
          <Route path="/profile" element={Wrapped(Profile)} />
          <Route path="/coupons" element={Wrapped(Coupons)} />
          <Route path="/notifications" element={Wrapped(Notifications)} />
          <Route path="/notification-preferences" element={Wrapped(NotificationPreferences)} />
          <Route path="/returns" element={Wrapped(Returns)} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
}

export default App;
