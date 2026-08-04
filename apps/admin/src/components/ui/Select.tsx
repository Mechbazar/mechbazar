import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Select: React.FC<SelectProps> = ({ label, error, size = 'md', className = '', children, ...props }) => {
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-3.5 py-2.5 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  const borderColor = error
    ? 'border-danger-500 focus:ring-danger-500/40 focus:border-danger-500'
    : 'border-border-default focus:ring-brand-primary/30 focus:border-brand-primary';

  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-content-secondary mb-1.5">{label}</label>}
      <div className="relative">
        <select
          className={`w-full appearance-none ${sizes[size]} pr-9 rounded-xl border bg-surface-card text-content-primary transition-colors duration-150 focus:outline-none focus:ring-4 disabled:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-60 ${borderColor} ${className}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none" />
      </div>
      {error && <p className="text-danger-500 text-xs mt-1.5 font-medium">{error}</p>}
    </div>
  );
};
