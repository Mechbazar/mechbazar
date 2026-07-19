import { useState } from 'react';
import { LayoutDashboard, Layers, Package, Clock3, Wallet } from 'lucide-react';
import ServicesDashboard from './ServicesDashboard';
import ServiceCategories from './ServiceCategories';
import ServicePackages from './ServicePackages';
import ServiceTimeSlots from './ServiceTimeSlots';
import TechnicianPayouts from './TechnicianPayouts';

// Bookings and Technicians are now dedicated top-level pages (Service
// Bookings / Mechanics in the sidebar) -- this tab set is just the service
// catalog/config side (categories, packages, time slots, payouts).
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'categories', label: 'Categories', icon: Layers },
  { id: 'packages', label: 'Packages', icon: Package },
  { id: 'slots', label: 'Time Slots', icon: Clock3 },
  { id: 'payouts', label: 'Technician Payouts', icon: Wallet },
];

export default function ServicesManagement() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col mb-6">
        <h1 className="text-3xl font-bold text-primary-500 mb-4">Doorstep Services Management</h1>

        <div className="flex flex-wrap gap-2 border-b border-neutral-800">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-500 font-bold bg-neutral-950'
                  : 'border-transparent text-neutral-100 hover:text-neutral-100 hover:bg-neutral-950/70'
              }`}
            >
              <tab.icon className="w-5 h-5 mr-2" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'dashboard' && <ServicesDashboard />}
        {activeTab === 'categories' && <ServiceCategories />}
        {activeTab === 'packages' && <ServicePackages />}
        {activeTab === 'slots' && <ServiceTimeSlots />}
        {activeTab === 'payouts' && <TechnicianPayouts />}
      </div>
    </div>
  );
}
