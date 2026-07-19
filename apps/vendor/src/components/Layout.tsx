import React from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-neutral-950 text-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-neutral-950 p-8">
        {children}
      </main>
    </div>
  );
}
