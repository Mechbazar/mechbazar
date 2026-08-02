import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Car, ShoppingBag, Users, Layers, Package, LogOut, Store, Navigation, Warehouse, Image, Tag, CreditCard, Bike, Wrench, ClipboardList, Layers3, Menu, X, FileText, ScrollText, KeyRound } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { Logo } from '@mechbazar/shared/web';
import { useDispatch, useSelector } from 'react-redux';
import { signOut } from 'firebase/auth';
import { logout } from './store';
import type { RootState } from './store';
import { auth } from './config/firebase';
import { ProtectedRoute } from './components/ProtectedRoute';
import NotificationBell from './components/NotificationBell';
import OfflineBanner from './components/OfflineBanner';
import ChangePasswordDialog from './components/ChangePasswordDialog';
import PageLoader from './components/PageLoader';

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
const RiderPayouts = lazy(() => import('./pages/RiderPayouts'));
const Reports = lazy(() => import('./pages/Reports'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));

// Mirrors each page's real backend authorization (the `admins`/`inventoryAdmins`/
// etc. arrays in apps/backend/src/routes/*.routes.ts) -- server-side authorize()
// already enforces these correctly, so this is UX polish only: without it, a
// lower-privilege login (e.g. CUSTOMER_SUPPORT) saw every nav item and only
// found out which ones it couldn't use by clicking into a raw 403. A path with
// no entry here has no role restriction server-side either (e.g. Vehicle
// Master), so every authenticated admin-panel role can see it.
const NAV_ROLES: Record<string, string[]> = {
  '/': ['SUPER_ADMIN', 'ADMIN'],
  '/orders': ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER', 'VENDOR_MANAGER', 'FINANCE_MANAGER', 'CUSTOMER_SUPPORT'],
  '/service-bookings': ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER'],
  '/mechanics': ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER'],
  '/products': ['ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER', 'VENDOR_MANAGER'],
  '/categories': ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER'],
  '/inventory': ['ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER', 'OPERATIONS_MANAGER', 'VENDOR_MANAGER'],
  '/services': ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER'],
  '/vendors': ['ADMIN', 'SUPER_ADMIN', 'VENDOR_MANAGER'],
  '/riders': ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER'],
  '/customers': ['ADMIN', 'SUPER_ADMIN', 'CUSTOMER_SUPPORT'],
  '/cms': ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER', 'VENDOR_MANAGER'],
  '/coupons': ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER', 'FINANCE_MANAGER'],
  '/payouts': ['ADMIN', 'SUPER_ADMIN', 'VENDOR_MANAGER'],
  '/rider-payouts': ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER'],
  '/reports': ['SUPER_ADMIN', 'ADMIN'],
  '/audit-logs': ['SUPER_ADMIN', 'ADMIN'],
};

function MainLayout({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();
  const location = useLocation();
  const role = useSelector((state: RootState) => state.auth.user?.role);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    // Best-effort -- app-JWT logout must succeed even if this fails (e.g.
    // Firebase session already gone), so it's not awaited/blocking.
    signOut(auth).catch(() => {});
  };

  const allNavLinks = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/orders', icon: Package, label: 'Product Orders' },
    { to: '/service-bookings', icon: ClipboardList, label: 'Service Bookings' },
    { to: '/mechanics', icon: Wrench, label: 'Mechanics' },
    { to: '/products', icon: ShoppingBag, label: 'Products' },
    { to: '/categories', icon: Layers, label: 'Categories' },
    { to: '/inventory', icon: Warehouse, label: 'Inventory' },
    { to: '/services', icon: Layers3, label: 'Service Catalog' },
    { to: '/vendors', icon: Store, label: 'Vendors' },
    { to: '/riders', icon: Navigation, label: 'Riders' },
    { to: '/customers', icon: Users, label: 'Customers' },
    { to: '/vehicles', icon: Car, label: 'Vehicle Master' },
    { to: '/cms', icon: Image, label: 'Banners & CMS' },
    { to: '/coupons', icon: Tag, label: 'Coupons' },
    { to: '/payouts', icon: CreditCard, label: 'Payouts' },
    { to: '/rider-payouts', icon: Bike, label: 'Rider Payouts' },
    { to: '/reports', icon: FileText, label: 'Reports' },
    { to: '/audit-logs', icon: ScrollText, label: 'Audit Logs' },
  ];
  const navLinks = allNavLinks.filter((link) => !NAV_ROLES[link.to] || (role && NAV_ROLES[link.to].includes(role)));

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      {/* Backdrop, mobile/laptop only, closes the sidebar when tapped outside it */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-white border-r border-neutral-200 transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 lg:flex-shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
          <div>
            {/* Light tone: the sidebar is a white surface. */}
            <Logo width={190} />
            <p className="text-xs text-neutral-500 mt-1 uppercase tracking-wider font-semibold">Admin Portal</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-neutral-500 hover:text-neutral-800"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="mt-4 flex-1 overflow-y-auto px-2">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors border-l-4 ${
                location.pathname === link.to
                  ? 'bg-primary-50 border-primary text-primary shadow-sm'
                  : 'border-transparent text-neutral-600 hover:bg-neutral-100 hover:text-primary'
              }`}
            >
              <link.icon className="w-5 h-5" />
              <span className="font-medium">{link.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-neutral-200 space-y-2">
          <button
            onClick={() => {
              setSidebarOpen(false);
              setShowChangePassword(true);
            }}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-neutral-100 px-4 py-3 text-neutral-700 hover:text-primary transition-colors"
          >
            <KeyRound className="w-5 h-5" />
            <span className="font-medium">Change Password</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-neutral-100 px-4 py-3 text-neutral-700 hover:text-primary transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      <ChangePasswordDialog isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />

      <main className="flex-1 min-w-0 overflow-y-auto bg-neutral-50">
        <OfflineBanner />
        <div className="flex items-center justify-between px-4 sm:px-8 pt-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-neutral-600 hover:text-neutral-900"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <NotificationBell />
        </div>
        <div className="p-4 sm:p-8 pt-2 overflow-x-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <div className="admin-light">
      <Toaster />
      <Router>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route path="/*" element={
          <ProtectedRoute>
            <MainLayout>
              <Routes>
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
                <Route path="rider-payouts" element={<RiderPayouts />} />
                <Route path="reports" element={<Reports />} />
                <Route path="audit-logs" element={<AuditLogs />} />
                <Route path="vehicles" element={<Vehicles />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/products" element={<Products />} />
                <Route path="/inventory/*" element={<InventorySystem />} />
                <Route path="/services/*" element={<ServicesManagement />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </MainLayout>
          </ProtectedRoute>
        } />
      </Routes>
      </Suspense>
    </Router>
    </div>
  );
}

export default App;
