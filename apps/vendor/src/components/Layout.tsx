import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { Logo } from '@mechbazar/shared/web';
import Sidebar from './Sidebar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-neutral-950 text-white">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 min-w-0 overflow-y-auto bg-neutral-950">
        <div className="flex items-center gap-3 px-4 pt-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-neutral-300 hover:text-white"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          {/* Dark tone: the mobile top bar sits on bg-neutral-950. */}
          <Logo tone="dark" width={130} />
        </div>
        <div className="p-4 sm:p-8 overflow-x-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
