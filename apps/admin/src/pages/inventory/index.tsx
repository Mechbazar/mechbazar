import { useState } from 'react';
import { motion } from 'framer-motion';
import InventoryDashboard from './InventoryDashboard';
import Warehouses from './Warehouses';
import Suppliers from './Suppliers';
import PurchaseOrders from './PurchaseOrders';
import { Tabs, Icon3D } from '../../components/ui';
import type { TabItem } from '../../components/ui';
import { fadeInUp } from '../../utils/motion';

const TABS: TabItem[] = [
  { id: 'dashboard', label: 'Stock Ledger' },
  { id: 'warehouses', label: 'Warehouses' },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'pos', label: 'Purchase Orders' },
];

export default function InventorySystem() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="flex flex-col h-full max-w-7xl mx-auto">
      {/* Header & Tabs */}
      <div className="flex flex-col mb-6">
        <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3 mb-4">
          <Icon3D name="warehouses" size={30} eager /> Inventory Management
        </h1>

        <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab} layoutId="inventory-tabs" />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'dashboard' && <InventoryDashboard />}
        {activeTab === 'warehouses' && <Warehouses onViewStock={() => setActiveTab('dashboard')} />}
        {activeTab === 'suppliers' && <Suppliers />}
        {activeTab === 'pos' && <PurchaseOrders />}
      </div>
    </motion.div>
  );
}
