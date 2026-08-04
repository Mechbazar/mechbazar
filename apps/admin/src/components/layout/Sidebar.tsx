import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { RootState } from '../../store';
import { NAV_ROLES } from '../../config/navRoles';
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
    label: 'Catalog',
    links: [
      { to: '/categories', icon: 'categories', label: 'Categories' },
      { to: '/inventory', icon: 'warehouses', label: 'Inventory' },
      { to: '/services', icon: 'service_catalog', label: 'Service Catalog' },
      { to: '/vehicles', icon: 'vehicles', label: 'Vehicle Master' },
    ],
  },
  {
    label: 'Network',
    links: [
      { to: '/vendors', icon: 'vendors', label: 'Vendors' },
      { to: '/customers', icon: 'customers', label: 'Customers' },
    ],
  },
  {
    label: 'Marketing',
    links: [
      { to: '/cms', icon: 'banners', label: 'Banners & CMS' },
      { to: '/coupons', icon: 'coupons', label: 'Coupons' },
    ],
  },
  {
    label: 'Finance & Reports',
    links: [
      { to: '/payouts', icon: 'payouts', label: 'Payouts' },
      { to: '/reports', icon: 'reports', label: 'Reports' },
      { to: '/audit-logs', icon: 'audit', label: 'Audit Logs' },
    ],
  },
];

const COLLAPSE_KEY = 'admin-sidebar-collapsed';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const role = useSelector((state: RootState) => state.auth.user?.role);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    links: group.links.filter((link) => !NAV_ROLES[link.to] || (role && NAV_ROLES[link.to].includes(role))),
  })).filter((group) => group.links.length > 0);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onMobileClose} />
      )}

      <motion.aside
        animate={{ width: collapsed ? 84 : 272 }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-surface-card border-r border-border-default transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 lg:flex-shrink-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-4 border-b border-border-default flex items-center justify-between shrink-0">
          {!collapsed ? <Logo width={150} /> : <span className="mx-auto h-8 w-8 rounded-lg bg-brand-primary" />}
          <button onClick={onMobileClose} className="lg:hidden text-content-secondary hover:text-content-primary" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-2.5 mb-1 text-[11px] font-semibold uppercase tracking-wide text-content-muted">{group.label}</p>
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
                      className={`relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors ${
                        active ? 'text-brand-primary' : 'text-content-secondary hover:text-content-primary hover:bg-surface-hover'
                      } ${collapsed ? 'justify-center' : ''}`}
                    >
                      {active && (
                        <motion.span
                          layoutId="sidebar-active-pill"
                          className="absolute inset-0 rounded-xl bg-brand-primary/10"
                          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        />
                      )}
                      <Icon3D name={link.icon} size={22} eager className="relative shrink-0" />
                      {!collapsed && <span className="relative text-sm font-medium truncate">{link.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <button
          onClick={() => setCollapsed((v) => !v)}
          className="hidden lg:flex items-center justify-center gap-2 m-2.5 py-2 rounded-xl text-content-muted hover:text-content-primary hover:bg-surface-hover transition-colors shrink-0"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span className="text-xs font-medium">Collapse</span></>}
        </button>
      </motion.aside>
    </>
  );
}
