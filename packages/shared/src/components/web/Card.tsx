import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'outlined' | 'filled' | 'dark';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'elevated',
  className = '',
  children,
  ...props
}) => {
  const variants = {
    elevated: 'bg-white rounded-lg shadow-md border border-neutral-200',
    outlined: 'bg-white rounded-lg border-2 border-neutral-300',
    filled: 'bg-neutral-50 rounded-lg border border-neutral-200',
    // "dark" is a legacy name (kept so existing call sites don't need to
    // change) -- it's actually theme-aware via the consuming app's
    // surface-*/border-* tokens (see apps/admin and apps/vendor index.css).
    dark: 'bg-surface-card rounded-xl border border-border-default hover:border-primary-500/40 transition-colors',
  };

  return (
    <div className={`p-6 transition-all duration-200 ${variants[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
};
