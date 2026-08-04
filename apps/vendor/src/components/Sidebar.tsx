import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { signOut } from 'firebase/auth';
import type { RootState } from '../store';
import { logout } from '../store/slices/authSlice';
import { auth } from '../config/firebase';
import {
  LayoutDashboard, Package, ShoppingCart, Warehouse, Wallet, Settings, LogOut, Store, X, Tag, Bell, RotateCcw, KeyRound, Sun, Moon
} from 'lucide-react';
import { Logo } from '@mechbazar/shared/web';
import ChangePasswordDialog from './ChangePasswordDialog';
import { useTheme } from '../hooks/useTheme';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      aria-pressed={isDark}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${isDark ? 'bg-primary' : 'bg-surface-hover border border-border-default'}`}
    >
      <span
        className={`absolute top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-all ${isDark ? 'right-0.5 text-primary' : 'left-0.5 text-content-muted'}`}
      >
        {isDark ? <Moon size={11} strokeWidth={2.5} /> : <Sun size={11} strokeWidth={2.5} />}
      </span>
    </button>
  );
}

const navItems = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/products',      icon: Package,         label: 'Products' },
  { to: '/orders',        icon: ShoppingCart,    label: 'Orders' },
  { to: '/inventory',     icon: Warehouse,       label: 'Inventory' },
  { to: '/returns',       icon: RotateCcw,       label: 'Returns' },
  { to: '/coupons',       icon: Tag,             label: 'Coupons' },
  { to: '/notifications', icon: Bell,            label: 'Notifications' },
  { to: '/wallet',        icon: Wallet,          label: 'Wallet & Payouts' },
  { to: '/profile',       icon: Settings,        label: 'Profile & Settings' },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const dispatch = useDispatch();
  const { user, vendorProfile } = useSelector((state: RootState) => state.auth);

  const { theme } = useTheme();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col h-screen bg-surface-card border-r border-border-default text-content-primary transform transition-transform duration-200 ease-in-out lg:static lg:sticky lg:top-0 lg:translate-x-0 lg:flex-shrink-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="p-5 border-b border-border-default">
        <div className="flex items-center justify-between mb-3">
          <Logo tone={theme === 'dark' ? 'dark' : 'light'} width={170} />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={onClose}
              className="lg:hidden text-content-muted hover:text-content-primary"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Store className="w-5 h-5 text-primary" />
          </div>
          <div className="overflow-hidden">
            <p className="text-content-primary font-bold text-sm truncate">Seller Central</p>
            <p className="text-primary text-xs truncate">{vendorProfile?.storeName || user?.name || 'My Store'}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
              }`
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border-default">
        <div className="flex items-center gap-3 px-3 py-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-primary text-xs font-bold">{user?.name?.[0]?.toUpperCase() || 'V'}</span>
          </div>
          <div className="overflow-hidden flex-1">
            <p className="text-content-primary text-xs font-semibold truncate">{user?.name}</p>
            <p className="text-content-muted text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => setShowChangePassword(true)}
          className="flex items-center gap-3 w-full px-4 py-3 mb-2 rounded-2xl text-sm font-medium text-content-secondary hover:bg-surface-hover transition-all"
        >
          <KeyRound className="w-4 h-4" /> Change Password
        </button>
        <button
          onClick={() => {
            dispatch(logout());
            signOut(auth).catch(() => {});
          }}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-sm font-medium text-danger-300 hover:bg-danger-300/10 transition-all"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>

      <ChangePasswordDialog isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </aside>
  );
}
