import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, KeyRound, LogOut, ChevronDown, UserCircle } from 'lucide-react';
import type { RootState } from '../../store';
import { NAV_ROLES } from '../../config/navRoles';
import { useTheme } from '../../hooks/useTheme';
import { Icon3D } from '../ui/Icon3D';
import type { Icon3DName } from '../../assets/icons3d/manifest';
import { Logo } from '@mechbazar/shared/web';

interface NavLink {
  to: string;
  icon: Icon3DName;
  label: string;
}

interface NavGroup {
  label: string;
  links: NavLink[];
}

const NAV_GROUPS: NavGroup[] = [
  { label: 'Overview', links: [{ to: '/', icon: 'dashboard', label: 'Dashboard' }] },
  {
    label: 'Operations',
    links: [
      { to: '/orders', icon: 'orders', label: 'Product Orders' },
      { to: '/service-bookings', icon: 'bookings', label: 'Service Bookings' },
      { to: '/mechanics', icon: 'mechanics', label: 'Mechanics' },
      { to: '/riders', icon: 'riders', label: 'Riders' },
    ],
  },
  {
    label: 'Management',
    links: [
      { to: '/vendors', icon: 'vendors', label: 'Vendors' },
      { to: '/customers', icon: 'customers', label: 'Customers' },
      { to: '/inventory', icon: 'warehouses', label: 'Inventory' },
      { to: '/categories', icon: 'categories', label: 'Categories' },
      { to: '/services', icon: 'service_catalog', label: 'Service Catalog' },
      { to: '/vehicles', icon: 'vehicles', label: 'Vehicle Master' },
    ],
  },
  {
    label: 'Marketing',
    links: [
      { to: '/coupons', icon: 'coupons', label: 'Coupons' },
      { to: '/cms', icon: 'banners', label: 'Banners & CMS' },
      { to: '/broadcast', icon: 'megaphone', label: 'Broadcast' },
    ],
  },
  {
    label: 'Reports',
    links: [
      { to: '/payouts', icon: 'payouts', label: 'Payouts' },
      { to: '/reports', icon: 'reports', label: 'Reports' },
      { to: '/notification-analytics', icon: 'bell', label: 'Notification Analytics' },
      { to: '/audit-logs', icon: 'audit', label: 'Audit Logs' },
    ],
  },
  {
    label: 'Settings',
    links: [
      { to: '/commission-settings', icon: 'gear', label: 'Commission & Payout Settings' },
      { to: '/admin-management', icon: 'shield', label: 'Administrators' },
      // No NAV_ROLES entry -- the backend endpoint is open to every
      // authenticated role (GET/PATCH /customers/notification-preferences
      // has no role check, unlike commission-settings above), so every
      // admin-panel login should see this.
      { to: '/notification-preferences', icon: 'bell', label: 'Notification Preferences' },
    ],
  },
];

const COLLAPSE_KEY = 'admin-sidebar-collapsed';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose, onChangePassword, onLogout }: SidebarProps) {
  const location = useLocation();
  const { theme } = useTheme();
  const user = useSelector((state: RootState) => state.auth.user);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    links: group.links.filter((link) => !NAV_ROLES[link.to] || (user?.role && NAV_ROLES[link.to].includes(user.role))),
  })).filter((group) => group.links.length > 0);

  const initials = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onMobileClose} />
      )}

      <motion.aside
        animate={{ width: collapsed ? 84 : 272 }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-surface-card border-r border-border-default transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 lg:flex-shrink-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-4 border-b border-border-default flex items-center justify-between shrink-0">
          {!collapsed ? (
            <div className="min-w-0">
              <Logo width={132} tone={theme === 'dark' ? 'dark' : 'light'} />
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-content-muted">Admin Portal</p>
            </div>
          ) : (
            <span className="mx-auto h-8 w-8 rounded-lg icon-tile" />
          )}
          <button
            onClick={() => (mobileOpen ? onMobileClose() : setCollapsed((v) => !v))}
            className="p-1.5 -mr-1 rounded-lg text-content-muted hover:text-content-primary hover:bg-surface-hover transition-colors shrink-0"
            aria-label={mobileOpen ? 'Close menu' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="lg:hidden"><X size={18} /></span>
            <span className="hidden lg:block"><Menu size={18} /></span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-content-muted">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.links.map((link) => {
                  const active = location.pathname === link.to;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={onMobileClose}
                      title={collapsed ? link.label : undefined}
                      className={`relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors ${
                        active ? 'text-white' : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
                      } ${collapsed ? 'justify-center' : ''}`}
                    >
                      {active && (
                        <motion.span
                          layoutId="sidebar-active-pill"
                          className="absolute inset-0 rounded-xl icon-tile"
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        />
                      )}
                      <Icon3D name={link.icon} size={18} strokeWidth={1.75} className="relative shrink-0" />
                      {!collapsed && <span className="relative text-sm font-medium truncate">{link.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div ref={profileRef} className="relative shrink-0 border-t border-border-default p-2.5">
          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full left-2.5 right-2.5 mb-2 rounded-2xl border border-border-default bg-surface-overlay shadow-popover overflow-hidden"
              >
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-content-primary hover:bg-surface-hover transition-colors"
                >
                  <UserCircle size={15} /> My Profile
                </Link>
                <button
                  onClick={() => { setProfileOpen(false); onChangePassword(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-content-primary hover:bg-surface-hover transition-colors"
                >
                  <KeyRound size={15} /> Change Password
                </button>
                <button
                  onClick={() => { setProfileOpen(false); onLogout(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-danger-500 hover:bg-surface-hover transition-colors"
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setProfileOpen((v) => !v)}
            className={`w-full flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-surface-hover transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full icon-tile text-white text-sm font-semibold">
              {initials}
            </span>
            {!collapsed && (
              <>
                <span className="flex-1 min-w-0 text-left leading-tight">
                  <span className="block text-sm font-semibold text-content-primary truncate">{user?.name || 'Admin'}</span>
                  <span className="block text-[11px] text-content-muted truncate">{user?.email}</span>
                </span>
                <ChevronDown size={14} className="text-content-muted shrink-0" />
              </>
            )}
          </button>
        </div>
      </motion.aside>
    </>
  );
}
