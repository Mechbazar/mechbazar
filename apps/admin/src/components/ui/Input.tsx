import React from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Input: React.FC<InputProps> = ({ label, error, helperText, icon, size = 'md', className = '', ...props }) => {
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
        {icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted">{icon}</div>}
        <input
          className={`w-full ${sizes[size]} rounded-xl border bg-surface-card text-content-primary placeholder-content-muted transition-colors duration-150 focus:outline-none focus:ring-4 disabled:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-60 ${icon ? 'pl-10' : ''} ${borderColor} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-danger-500 text-xs mt-1.5 font-medium">{error}</p>}
      {helperText && !error && <p className="text-content-muted text-xs mt-1.5">{helperText}</p>}
    </div>
  );
};
