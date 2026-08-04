import React from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, className = '', checked, ...props }) => {
  return (
    <label className={`inline-flex items-center gap-2.5 cursor-pointer select-none ${className}`}>
      <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface-card transition-colors has-checked:bg-brand-primary has-checked:border-brand-primary">
        <input type="checkbox" checked={checked} className="peer absolute inset-0 opacity-0 cursor-pointer" {...props} />
        <Check size={14} className="text-white opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
      </span>
      {label && <span className="text-sm text-content-primary">{label}</span>}
    </label>
  );
};
