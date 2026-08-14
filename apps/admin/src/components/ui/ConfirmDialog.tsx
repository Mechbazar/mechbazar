import React from 'react';
import { AlertTriangle, HelpCircle, ShieldAlert } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export type ConfirmVariant = 'danger' | 'warning' | 'default';

export interface ConfirmOptions {
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

interface ConfirmDialogProps extends ConfirmOptions {
  isOpen: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_STYLES: Record<ConfirmVariant, { icon: React.ReactNode; badge: string; button: 'danger' | 'primary' }> = {
  danger: {
    icon: <AlertTriangle size={20} />,
    badge: 'bg-danger-500/10 text-danger-500',
    button: 'danger',
  },
  warning: {
    icon: <ShieldAlert size={20} />,
    badge: 'bg-warning-500/10 text-warning-600',
    button: 'danger',
  },
  default: {
    icon: <HelpCircle size={20} />,
    badge: 'bg-brand-primary/10 text-brand-primary',
    button: 'primary',
  },
};

// The themed replacement for window.confirm() across admin -- see useConfirm()
// for the imperative API call sites actually use. Built on the same
// Modal/Button primitives as the rest of the premium admin UI (not the
// browser's native dialog, which can't be styled and shows the raw origin,
// e.g. "admin.mechbazar.com says").
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const style = VARIANT_STYLES[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title || 'Are you sure?'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={style.button} size="sm" onClick={onConfirm} isLoading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.badge}`}>
          {style.icon}
        </div>
        <p className="pt-2 text-sm text-content-secondary leading-relaxed">{message}</p>
      </div>
    </Modal>
  );
}
