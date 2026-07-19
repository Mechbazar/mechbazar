import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  children?: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  message,
  dismissible = false,
  onDismiss,
  className = '',
  children,
  ...props
}) => {
  const [isDismissed, setIsDismissed] = React.useState(false);

  if (isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  // Tinted-on-dark look — matches the dark shell both Admin and Vendor use.
  const typeConfig = {
    success: {
      bg: 'bg-success-500/10',
      border: 'border-success-500/30',
      text: 'text-success-300',
      icon: <CheckCircle2 size={20} className="text-success-400" />,
    },
    error: {
      bg: 'bg-danger-500/10',
      border: 'border-danger-500/30',
      text: 'text-danger-300',
      icon: <AlertCircle size={20} className="text-danger-400" />,
    },
    warning: {
      bg: 'bg-warning-500/10',
      border: 'border-warning-500/30',
      text: 'text-warning-300',
      icon: <AlertTriangle size={20} className="text-warning-400" />,
    },
    info: {
      bg: 'bg-info-500/10',
      border: 'border-info-500/30',
      text: 'text-info-300',
      icon: <Info size={20} className="text-info-400" />,
    },
  };

  const config = typeConfig[type];

  return (
    <div
      className={`${config.bg} ${config.border} ${config.text} border rounded-lg p-4 flex gap-3 ${className}`}
      role="alert"
      {...props}
    >
      <div className="flex-shrink-0">{config.icon}</div>
      <div className="flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {message && <p className="text-sm">{message}</p>}
        {children}
      </div>
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-current opacity-70 hover:opacity-100 transition-opacity"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
};
