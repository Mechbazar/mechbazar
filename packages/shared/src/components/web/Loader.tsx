import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  className?: string;
}

const sizes = {
  sm: 'h-6 w-6 border-t-2',
  md: 'h-12 w-12 border-t-2',
  lg: 'h-16 w-16 border-t-4',
};

export const Loader: React.FC<LoaderProps> = ({ size = 'md', fullScreen = false, className = '' }) => {
  const spinner = <div className={`animate-spin rounded-full border-primary-500 ${sizes[size]} ${className}`} />;

  if (fullScreen) {
    return <div className="flex items-center justify-center h-64">{spinner}</div>;
  }

  return spinner;
};
