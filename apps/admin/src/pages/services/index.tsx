import { useState } from 'react';
import { motion } from 'framer-motion';
import ServicesDashboard from './ServicesDashboard';
import ServiceCategories from './ServiceCategories';
import ServicePackages from './ServicePackages';
import ServiceTimeSlots from './ServiceTimeSlots';
import LiveOps from './LiveOps';
import { Tabs, Icon3D } from '../../components/ui';
import type { TabItem } from '../../components/ui';
import { fadeInUp } from '../../utils/motion';

// Bookings and Technicians are now dedicated top-level pages (Service
// Bookings / Mechanics in the sidebar) -- this tab set is just the service
// catalog/config side (categories, packages, time slots) plus the
// emergency-dispatch live-ops board. Technician payouts moved into the
// unified Payouts page (vendor + rider + mechanic in one place) instead of
// living here as its own tab.
const TABS: TabItem[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'live-ops', label: 'Live Ops' },
  { id: 'categories', label: 'Categories' },
  { id: 'packages', label: 'Packages' },
  { id: 'slots', label: 'Time Slots' },
];

export default function ServicesManagement() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="flex flex-col h-full">
      <div className="flex flex-col mb-6">
        <h1 className="text-2xl font-bold text-content-primary tracking-tight mb-4 flex items-center gap-3">
          <Icon3D name="service_catalog" size={30} eager /> Doorstep Services Management
        </h1>

        <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab} layoutId="services-tabs" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'dashboard' && <ServicesDashboard />}
        {activeTab === 'live-ops' && <LiveOps />}
        {activeTab === 'categories' && <ServiceCategories />}
        {activeTab === 'packages' && <ServicePackages />}
        {activeTab === 'slots' && <ServiceTimeSlots />}
      </div>
    </motion.div>
  );
}
