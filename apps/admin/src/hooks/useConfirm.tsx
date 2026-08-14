import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ConfirmDialog, type ConfirmOptions } from '../components/ui/ConfirmDialog';

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// Drop-in async replacement for window.confirm()/confirm() -- those render the
// browser's own unstyled dialog (shows the raw origin, e.g. "admin.mechbazar.com
// says", can't be themed) and block the JS thread while open. This renders the
// same ConfirmDialog every page already uses, resolved to true/false once the
// user picks a button, so call sites just change `if (!confirm(msg)) return;`
// to `if (!(await confirm(msg))) return;` inside the (already-async) handler.
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setOptions(typeof opts === 'string' ? { message: opts } : opts);
      resolveRef.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        isOpen={options !== null}
        title={options?.title}
        message={options?.message ?? ''}
        confirmLabel={options?.confirmLabel}
        cancelLabel={options?.cancelLabel}
        variant={options?.variant}
        onCancel={() => settle(false)}
        onConfirm={() => settle(true)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm() must be used within a <ConfirmProvider>');
  }
  return ctx;
}
