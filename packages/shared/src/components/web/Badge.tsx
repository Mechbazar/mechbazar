import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  /** Tinted-on-dark look (transparent bg + bright text) instead of the opaque light-theme pill. */
  dark?: boolean;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'primary',
  size = 'md',
  // Both current consumers (Admin, Vendor) are dark-themed dashboards, so
  // default to the tinted-on-dark look; pass dark={false} for a light context.
  dark = true,
  className = '',
  children,
  ...props
}) => {
  const variants = {
    primary: 'bg-primary-100 text-primary-700',
    secondary: 'bg-navy-100 text-navy-700',
    success: 'bg-success-100 text-success-700',
    warning: 'bg-warning-100 text-warning-700',
    danger: 'bg-danger-100 text-danger-700',
    info: 'bg-info-100 text-info-700',
    neutral: 'bg-neutral-100 text-neutral-700',
  };

  const darkVariants = {
    primary: 'bg-primary-500/10 text-primary-400',
    secondary: 'bg-navy-500/10 text-navy-400',
    success: 'bg-success-500/10 text-success-400',
    warning: 'bg-warning-500/10 text-warning-400',
    danger: 'bg-danger-500/10 text-danger-400',
    info: 'bg-info-500/10 text-info-400',
    neutral: 'bg-neutral-800 text-neutral-300',
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs font-medium rounded',
    md: 'px-3 py-1 text-sm font-semibold rounded',
    lg: 'px-4 py-2 text-base font-semibold rounded-md',
  };

  return (
    <span className={`inline-block ${dark ? darkVariants[variant] : variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </span>
  );
};
