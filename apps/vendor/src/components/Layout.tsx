import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { Logo } from '@mechbazar/shared/web';
import Sidebar from './Sidebar';
import { useTheme } from '../hooks/useTheme';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { theme } = useTheme();

  return (
    <div className="flex min-h-screen bg-surface-page text-content-primary">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 min-w-0 overflow-y-auto bg-surface-page">
        <div className="flex items-center gap-3 px-4 pt-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-content-secondary hover:text-content-primary"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Logo tone={theme === 'dark' ? 'dark' : 'light'} width={130} />
        </div>
        <div className="p-4 sm:p-8 overflow-x-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
