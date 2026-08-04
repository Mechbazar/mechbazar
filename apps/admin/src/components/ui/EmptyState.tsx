import React from 'react';
import { motion } from 'framer-motion';
import { Icon3D } from './Icon3D';
import type { Icon3DName } from '../../assets/icons3d/manifest';
import { fadeInUp } from '../../utils/motion';

interface EmptyStateProps {
  icon: Icon3DName;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className={`flex flex-col items-center justify-center text-center py-14 px-6 ${className}`}
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-hover border border-border-default text-content-muted">
        <Icon3D name={icon} size={34} strokeWidth={1.5} />
      </div>
      <h3 className="mt-5 text-base font-semibold text-content-primary">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-content-muted max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
