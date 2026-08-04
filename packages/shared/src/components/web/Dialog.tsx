import React from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}) => {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className={`relative z-50 bg-surface-overlay rounded-xl shadow-2xl w-full mx-4 ${sizes[size]} max-h-[90vh] flex flex-col overflow-hidden`}>
        {/* Header */}
        {(title || true) && (
          <div className="flex items-center justify-between p-6 border-b border-border-default shrink-0">
            {title && <h2 className="text-2xl font-bold text-content-primary">{title}</h2>}
            <button
              onClick={onClose}
              className="ml-auto text-content-muted hover:text-content-primary transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        )}

        {/* Content - the only part that scrolls, so header/footer stay pinned in view */}
        <div className="p-6 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && <div className="flex gap-3 p-6 border-t border-border-default justify-end shrink-0">{footer}</div>}
      </div>
    </div>
  );
};
