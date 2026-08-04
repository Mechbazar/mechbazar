import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { Search, X, Package, Users, Store, Wrench, ShoppingBag, Tag, Loader2 } from 'lucide-react';
import type { RootState } from '../../store';
import { API_URL } from '../../config/api';

interface SearchCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

type ResultGroupKey = 'orders' | 'customers' | 'vendors' | 'technicians' | 'products' | 'coupons';

const GROUP_META: Record<ResultGroupKey, { label: string; icon: React.ElementType; path: string }> = {
  orders: { label: 'Orders', icon: Package, path: '/orders' },
  customers: { label: 'Customers', icon: Users, path: '/customers' },
  vendors: { label: 'Vendors', icon: Store, path: '/vendors' },
  technicians: { label: 'Mechanics', icon: Wrench, path: '/mechanics' },
  products: { label: 'Products', icon: ShoppingBag, path: '/products' },
  coupons: { label: 'Coupons', icon: Tag, path: '/coupons' },
};

export function SearchCommandPalette({ isOpen, onClose }: SearchCommandPaletteProps) {
  const { token } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Record<ResultGroupKey, any[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults(null);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !query.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await axios.get(`${API_URL}/admin/search`, {
          params: { q: query },
          headers: { Authorization: `Bearer ${token}` },
        });
        setResults(res.data.results);
      } catch (error) {
        console.error('Global search failed', error);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, isOpen, token]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const groups = (Object.keys(GROUP_META) as ResultGroupKey[]).filter((k) => (results?.[k]?.length || 0) > 0);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4">
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            className="relative z-10 w-full max-w-xl bg-surface-overlay border border-border-default rounded-2xl shadow-popover overflow-hidden"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
          >
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-default">
              <Search size={18} className="text-content-muted shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search orders, customers, vendors, products, mechanics, coupons…"
                className="flex-1 bg-transparent outline-none text-sm text-content-primary placeholder-content-muted"
              />
              {loading && <Loader2 size={16} className="animate-spin text-content-muted shrink-0" />}
              <button onClick={onClose} className="text-content-muted hover:text-content-primary transition-colors shrink-0">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {query.trim() && !loading && groups.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-content-muted">No results for "{query}"</p>
              )}
              {!query.trim() && (
                <p className="px-4 py-8 text-center text-sm text-content-muted">Start typing to search across the platform</p>
              )}
              {groups.map((key) => {
                const meta = GROUP_META[key];
                return (
                  <div key={key} className="py-2">
                    <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-content-muted">{meta.label}</p>
                    {results![key].map((item: any) => (
                      <button
                        key={item.id}
                        onClick={() => { navigate(meta.path); onClose(); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-hover transition-colors"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-content-secondary">
                          <meta.icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-content-primary">
                            {resultTitle(key, item)}
                          </span>
                          <span className="block truncate text-xs text-content-muted">{resultSubtitle(key, item)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function resultTitle(key: ResultGroupKey, item: any): string {
  switch (key) {
    case 'orders': return `Order #${String(item.id).slice(-6).toUpperCase()}`;
    case 'customers': return item.name || item.phone;
    case 'vendors': return item.vendorProfile?.storeName || item.name || item.phone;
    case 'technicians': return item.name || item.phone;
    case 'products': return item.name;
    case 'coupons': return item.code;
    default: return '';
  }
}

function resultSubtitle(key: ResultGroupKey, item: any): string {
  switch (key) {
    case 'orders': return `${item.user?.name || item.user?.phone || 'Unknown'} • ₹${item.finalAmount?.toLocaleString('en-IN')} • ${item.status}`;
    case 'customers': return item.phone;
    case 'vendors': return `${item.phone} • ${item.vendorProfile?.status || ''}`;
    case 'technicians': return `${item.phone} • ${item.technicianProfile?.status || ''}`;
    case 'products': return `₹${item.price?.toLocaleString('en-IN')} • ${item.status}`;
    case 'coupons': return item.isActive ? 'Active' : 'Inactive';
    default: return '';
  }
}
