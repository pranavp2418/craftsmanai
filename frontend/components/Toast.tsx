'use client';

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ToastContainer } from 'react-toastify';

// ─── Context ─────────────────────────────────────────────────────────────────

interface ToastContextValue {
  show: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Provider + Portal ───────────────────────────────────────────────────────

interface ToastState {
  message: string;
  visible: boolean;
  key: number;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const show = useCallback((message: string) => {
    setToast({ message, visible: true, key: Date.now() });
  }, []);

  // Auto-dismiss
  useEffect(() => {
    if (!toast?.visible) return;
    const timeout = setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, visible: false } : null));
    }, 2200);
    const cleanup = setTimeout(() => setToast(null), 2500);
    return () => { clearTimeout(timeout); clearTimeout(cleanup); };
  }, [toast?.key]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <ToastContainer
        position="top-right"
        autoClose={2200}
        hideProgressBar
        closeOnClick
        pauseOnHover
        newestOnTop
        theme="colored"
        style={{ zIndex: 100000 }}
      />
      {mounted && toast && createPortal(
        <div
          key={toast.key}
          role="status"
          aria-live="polite"
          className={[
            'fixed top-6 right-6 flex items-center gap-2.5 px-5 py-3 rounded-lg',
            'text-body-sm font-medium text-white shadow-lg bg-[#07bc0c]',
            'transition-all duration-300 ease-out',
            toast.visible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 -translate-y-2 pointer-events-none',
          ].join(' ')}
          style={{ zIndex: 100000 }}
        >
          <span className="w-4 h-4 flex items-center justify-center ri-checkbox-circle-line text-ui-md" />
          {toast.message}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
