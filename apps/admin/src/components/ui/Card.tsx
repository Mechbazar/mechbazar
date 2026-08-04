import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface CardProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'flat' | 'glass';
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-7 sm:p-8',
};

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  hover = false,
  padding = 'md',
  className = '',
  children,
  ...props
}) => {
  const variants = {
    default: 'bg-surface-card border border-border-default shadow-card',
    flat: 'bg-surface-sunken border border-border-default',
    glass: 'glass-surface border border-border-default shadow-elevated',
  };

  return (
    <motion.div
      className={`rounded-2xl transition-colors duration-200 ${variants[variant]} ${paddings[padding]} ${hover ? 'cursor-pointer' : ''} ${className}`}
      whileHover={hover ? { y: -3, boxShadow: 'var(--shadow-elevated)' } : undefined}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  );
};
