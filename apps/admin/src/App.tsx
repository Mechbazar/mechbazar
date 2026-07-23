import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Car, ShoppingBag, Users, Layers, Package, LogOut, Store, Navigation, Warehouse, Image, Tag, CreditCard, Bike, Wrench, ClipboardList, Layers3, Menu, X } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { logout } from './store';
import Vehicles from './pages/Vehicles';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Vendors from './pages/Vendors';
import Riders from './pages/Riders';
import Banners from './pages/Banners';
import Coupons from './pages/Coupons';
import Categories from './pages/Categories';
import Orders from './pages/Orders';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import InventorySystem from './pages/inventory';
import ServicesManagement from './pages/services';
import ServiceBookingsPage from './pages/ServiceBookingsPage';
import MechanicsPage from './pages/MechanicsPage';
import Payouts from './pages/Payouts';
import RiderPayouts from './pages/RiderPayouts';
import { ProtectedRoute } from './components/ProtectedRoute';
import NotificationBell from './components/NotificationBell';
import OfflineBanner from './components/OfflineBanner';

function MainLayout({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
  };

  const navLinks = [
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
  ];

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
            <h1 className="text-2xl font-bold text-neutral-900 tracking-wide">MECH<span className="text-primary-500">BAZAR</span></h1>
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
        <div className="p-4 border-t border-neutral-200">
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-neutral-100 px-4 py-3 text-neutral-700 hover:text-primary transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

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
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        
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
    </Router>
    </div>
  );
}

export default App;
