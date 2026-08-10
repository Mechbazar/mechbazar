import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { signOut } from 'firebase/auth';
import axios from 'axios';
import { logout } from './store';
import type { RootState } from './store';
import { auth } from './config/firebase';
import { registerForWebPushAsync } from './services/webPush';
import { API_URL } from './config/api';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import OfflineBanner from './components/OfflineBanner';
import ChangePasswordDialog from './components/ChangePasswordDialog';
import PageLoader from './components/PageLoader';
import { pageTransition } from './utils/motion';

// Route-level code-splitting: each page is its own chunk, fetched only when
// its route is actually visited, instead of every page's code (and every
// third-party lib only one page uses, e.g. charting on Reports) shipping in
// the single main bundle every user downloads just to see the login screen.
const Vehicles = lazy(() => import('./pages/Vehicles'));
const Products = lazy(() => import('./pages/Products'));
const Customers = lazy(() => import('./pages/Customers'));
const Vendors = lazy(() => import('./pages/Vendors'));
const Riders = lazy(() => import('./pages/Riders'));
const Banners = lazy(() => import('./pages/Banners'));
const Coupons = lazy(() => import('./pages/Coupons'));
const Categories = lazy(() => import('./pages/Categories'));
const Orders = lazy(() => import('./pages/Orders'));
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const InventorySystem = lazy(() => import('./pages/inventory'));
const ServicesManagement = lazy(() => import('./pages/services'));
const ServiceBookingsPage = lazy(() => import('./pages/ServiceBookingsPage'));
const MechanicsPage = lazy(() => import('./pages/MechanicsPage'));
const Payouts = lazy(() => import('./pages/Payouts'));
const Reports = lazy(() => import('./pages/Reports'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const CommissionSettings = lazy(() => import('./pages/CommissionSettings'));
const NotificationPreferences = lazy(() => import('./pages/NotificationPreferences'));
const Broadcast = lazy(() => import('./pages/Broadcast'));
const NotificationAnalytics = lazy(() => import('./pages/NotificationAnalytics'));
const Profile = lazy(() => import('./pages/Profile'));
const AdminManagement = lazy(() => import('./pages/AdminManagement'));
const ServiceableAreas = lazy(() => import('./pages/ServiceableAreas'));
const AppSettings = lazy(() => import('./pages/AppSettings'));

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} variants={pageTransition} initial="initial" animate="animate" exit="exit">
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/service-bookings" element={<ServiceBookingsPage />} />
          <Route path="/mechanics" element={<MechanicsPage />} />
          <Route path="customers" element={<Customers />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="riders" element={<Riders />} />
          <Route path="cms" element={<Banners />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="payouts" element={<Payouts />} />
          <Route path="commission-settings" element={<CommissionSettings />} />
          <Route path="notification-preferences" element={<NotificationPreferences />} />
          <Route path="broadcast" element={<Broadcast />} />
          <Route path="notification-analytics" element={<NotificationAnalytics />} />
          <Route path="reports" element={<Reports />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin-management" element={<AdminManagement />} />
          <Route path="/serviceable-areas" element={<ServiceableAreas />} />
          <Route path="/app-settings" element={<AppSettings />} />
          {/* Deliberately not in the sidebar -- MechBazar doesn't sell
              products directly, only vendors do, so this isn't a top-level
              section of its own. It's still the only place to review pending
              vendor product submissions, low stock, and B2B pricing across
              every vendor, so it stays routable and is linked from the
              Vendors page (and the Dashboard's "Review Products" quick
              action) instead. */}
          <Route path="/products" element={<Products />} />
          <Route path="/inventory/*" element={<InventorySystem />} />
          <Route path="/services/*" element={<ServicesManagement />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function MainLayout() {
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.auth.token);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Browser push -- writes to User.fcmToken. MainLayout only ever renders
  // behind ProtectedRoute, so a token is guaranteed here.
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

  const handleLogout = async () => {
    // A web push token identifies the browser, not the account -- on a
    // shared/reset machine, leaving it registered would keep sending this
    // account's notifications to whoever logs in next. Best-effort: logout
    // proceeds even if this fails.
    if (token) {
      try {
        await axios.delete(`${API_URL}/auth/push-token?type=fcm`, { headers: { Authorization: `Bearer ${token}` } });
      } catch (e) {
        console.error('Failed to clear push token on logout:', e);
      }
    }
    dispatch(logout());
    // Best-effort -- app-JWT logout must succeed even if this fails (e.g.
    // Firebase session already gone), so it's not awaited/blocking.
    signOut(auth).catch(() => {});
  };

  return (
    <div className="flex min-h-screen bg-surface-page text-content-primary">
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
        onChangePassword={() => setShowChangePassword(true)}
        onLogout={handleLogout}
      />

      <ChangePasswordDialog isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          onOpenMobileMenu={() => setSidebarOpen(true)}
          onChangePassword={() => setShowChangePassword(true)}
          onLogout={handleLogout}
        />
        <OfflineBanner />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-auto p-4 sm:p-8">
          <AnimatedRoutes />
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <>
      <Toaster />
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </Router>
    </>
  );
}

export default App;
