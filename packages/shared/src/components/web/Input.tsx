import React from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  icon,
  size = 'md',
  className = '',
  ...props
}) => {
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-4 py-3 text-lg',
  };

  const borderColor = error ? 'border-danger-500 focus:ring-danger-500' : 'border-border-default focus:ring-primary-500 focus:border-primary-500';

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-content-secondary mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-content-muted">{icon}</div>}
        <input
          className={`
            w-full ${sizes[size]} rounded-lg border-2 font-medium
            bg-surface-sunken text-content-primary placeholder-content-muted transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60
            ${icon ? 'pl-10' : ''}
            ${borderColor}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && <p className="text-danger-500 dark:text-danger-400 text-sm mt-1 font-medium">{error}</p>}
      {helperText && !error && <p className="text-content-muted text-sm mt-1">{helperText}</p>}
    </div>
  );
};
