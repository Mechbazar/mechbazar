import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  className?: string;
}

const sizes = {
  sm: 'h-5 w-5 border-t-2',
  md: 'h-10 w-10 border-t-2',
  lg: 'h-14 w-14 border-t-4',
};

export const Loader: React.FC<LoaderProps> = ({ size = 'md', fullScreen = false, className = '' }) => {
  const spinner = <div className={`animate-spin rounded-full border-brand-primary border-r-transparent ${sizes[size]} ${className}`} />;
  if (fullScreen) return <div className="flex items-center justify-center h-64">{spinner}</div>;
  return spinner;
};
