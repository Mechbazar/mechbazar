import { motion } from 'framer-motion';

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  layoutId?: string;
  className?: string;
}

export function Tabs({ tabs, value, onChange, layoutId = 'tabs-underline', className = '' }: TabsProps) {
  return (
    <div className={`inline-flex items-center gap-1 rounded-xl bg-surface-sunken p-1 border border-border-default ${className}`}>
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
              active ? 'text-white' : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-brand-primary"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
