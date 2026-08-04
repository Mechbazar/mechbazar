import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  /** Accepted for drop-in compatibility with the shared Badge's prop shape; styling
   * is theme-token driven (auto light/dark) so this has no effect here. */
  dark?: boolean;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', size = 'md', className = '', children, dark: _dark, ...props }) => {
  const variants = {
    primary: 'bg-brand-primary/10 text-brand-primary',
    secondary: 'bg-navy-500/10 text-navy-600 dark:text-navy-300',
    success: 'bg-success-500/10 text-success-600 dark:text-success-400',
    warning: 'bg-warning-500/10 text-warning-600 dark:text-warning-400',
    danger: 'bg-danger-500/10 text-danger-600 dark:text-danger-400',
    info: 'bg-info-500/10 text-info-600 dark:text-info-400',
    neutral: 'bg-surface-hover text-content-secondary',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs font-medium rounded-md',
    md: 'px-2.5 py-1 text-xs font-semibold rounded-lg',
    lg: 'px-3 py-1.5 text-sm font-semibold rounded-lg',
  };

  return (
    <span className={`inline-flex items-center gap-1 ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </span>
  );
};
