import {
  LayoutDashboard, ShoppingBag, CalendarCheck2, Wrench, LayoutGrid, ClipboardList,
  Store, Bike, Users, Car, Image, Ticket, Wallet, BarChart3, FileClock, Warehouse,
  Truck, ClipboardCheck, IndianRupee, Users2, Trophy, Star, CheckCircle2, Search,
  Bell, Megaphone, Settings, Shield, type LucideIcon,
} from 'lucide-react';
import type { Icon3DName } from '../../assets/icons3d/manifest';

// Name kept for backward-compat with the ~30 call sites written against the
// original 3D-icon component; renders a plain Lucide glyph (currentColor)
// now instead, so it drops cleanly into whatever color/background the caller
// already wraps it in (StatCard's gradient tile, a tinted badge, a nav link).
const ICONS: Record<Icon3DName, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: ShoppingBag,
  bookings: CalendarCheck2,
  mechanics: Wrench,
  categories: LayoutGrid,
  service_catalog: ClipboardList,
  vendors: Store,
  riders: Bike,
  customers: Users,
  vehicles: Car,
  banners: Image,
  coupons: Ticket,
  payouts: Wallet,
  reports: BarChart3,
  audit: FileClock,
  warehouses: Warehouse,
  suppliers: Truck,
  purchase_orders: ClipboardCheck,
  revenue: IndianRupee,
  users_total: Users2,
  trophy: Trophy,
  star: Star,
  check: CheckCircle2,
  search: Search,
  bell: Bell,
  megaphone: Megaphone,
  gear: Settings,
  shield: Shield,
};

interface Icon3DProps {
  name: Icon3DName;
  size?: number;
  /** Accepted for drop-in compatibility with the old asset-based API; a
   * vector glyph has no loading strategy so this is a no-op. */
  eager?: boolean;
  /** Accepted for drop-in compatibility; the old 3D renders floated, plain
   * outline glyphs don't. */
  animate?: 'float' | 'none';
  strokeWidth?: number;
  className?: string;
  alt?: string;
}

export function Icon3D({ name, size = 20, strokeWidth = 1.75, className = '', alt }: Icon3DProps) {
  const Glyph = ICONS[name];
  return <Glyph size={size} strokeWidth={strokeWidth} className={className} aria-hidden={alt ? undefined : true} role={alt ? 'img' : undefined} aria-label={alt || undefined} />;
}
