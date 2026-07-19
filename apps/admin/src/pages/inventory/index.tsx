import { useState } from 'react';
import { Warehouse, Users, FileText, BarChart2 } from 'lucide-react';
import InventoryDashboard from './InventoryDashboard';
import Warehouses from './Warehouses';
import Suppliers from './Suppliers';
import PurchaseOrders from './PurchaseOrders';

const TABS = [
  { id: 'dashboard', label: 'Stock Ledger', icon: BarChart2 },
  { id: 'warehouses', label: 'Warehouses', icon: Warehouse },
  { id: 'suppliers', label: 'Suppliers', icon: Users },
  { id: 'pos', label: 'Purchase Orders', icon: FileText },
];

export default function InventorySystem() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex flex-col h-full">
      {/* Header & Tabs */}
      <div className="flex flex-col mb-6">
        <h1 className="text-3xl font-bold text-primary-500 mb-4">Inventory Management</h1>
        
        <div className="flex space-x-2 border-b border-neutral-800">
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

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'dashboard' && <InventoryDashboard />}
        {activeTab === 'warehouses' && <Warehouses />}
        {activeTab === 'suppliers' && <Suppliers />}
        {activeTab === 'pos' && <PurchaseOrders />}
      </div>
    </div>
  );
}
