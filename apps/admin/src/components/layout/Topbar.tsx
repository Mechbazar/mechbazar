import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Search, Sun, Moon, KeyRound, LogOut, ChevronDown } from 'lucide-react';
import type { RootState } from '../../store';
import { useTheme } from '../../hooks/useTheme';
import { SearchCommandPalette } from '../ui/SearchCommandPalette';
import { NotificationCenter } from '../ui/NotificationCenter';

interface TopbarProps {
  onOpenMobileMenu: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
}

export function Topbar({ onOpenMobileMenu, onChangePassword, onLogout }: TopbarProps) {
  const user = useSelector((state: RootState) => state.auth.user);
  const { theme, toggleTheme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const initials = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 sm:gap-3 h-16 px-3 sm:px-6 border-b border-border-default bg-surface-card/80 backdrop-blur-md">
      <button onClick={onOpenMobileMenu} className="lg:hidden p-2 -ml-1 text-content-secondary hover:text-content-primary" aria-label="Open menu">
        <Menu size={20} />
      </button>

      <button
        onClick={() => setSearchOpen(true)}
        className="hidden sm:flex items-center gap-2.5 flex-1 max-w-sm px-3.5 py-2 rounded-xl border border-border-default bg-surface-sunken text-content-muted hover:border-border-strong transition-colors"
      >
        <Search size={15} />
        <span className="text-sm">Search everything…</span>
        <kbd className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-surface-hover text-content-muted">Ctrl K</kbd>
      </button>

      <button onClick={() => setSearchOpen(true)} className="sm:hidden p-2 text-content-secondary hover:text-content-primary" aria-label="Search">
        <Search size={19} />
      </button>

      <div className="flex-1 sm:flex-none" />

      <button
        onClick={toggleTheme}
        className="p-2 rounded-xl text-content-secondary hover:text-content-primary hover:bg-surface-hover transition-colors"
        aria-label="Toggle theme"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 60, scale: 0.6 }}
            transition={{ duration: 0.18 }}
            className="flex"
          >
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </motion.span>
        </AnimatePresence>
      </button>

      <NotificationCenter />

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-xl hover:bg-surface-hover transition-colors"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-white text-sm font-semibold">
            {initials}
          </span>
          <span className="hidden md:flex flex-col items-start leading-tight">
            <span className="text-sm font-semibold text-content-primary max-w-[9rem] truncate">{user?.name || 'Admin'}</span>
            <span className="text-[11px] text-content-muted">{user?.role?.replace(/_/g, ' ')}</span>
          </span>
          <ChevronDown size={14} className="hidden md:block text-content-muted" />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-56 rounded-2xl border border-border-default bg-surface-overlay shadow-popover overflow-hidden z-50"
            >
              <button
                onClick={() => { setMenuOpen(false); onChangePassword(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-content-primary hover:bg-surface-hover transition-colors"
              >
                <KeyRound size={15} /> Change Password
              </button>
              <button
                onClick={() => { setMenuOpen(false); onLogout(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-danger-500 hover:bg-surface-hover transition-colors"
              >
                <LogOut size={15} /> Sign Out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SearchCommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
