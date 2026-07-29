'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Toaster as Sonner, toast as sonnerToast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

declare global {
  interface Window {
    /** Layout-mounted sonner toast — shared across App Router client chunks */
    __OMG_SONNER_TOAST__?: typeof sonnerToast;
  }
}

/**
 * Shared Sonner entry. Import `toast` from here (not `sonner` directly).
 *
 * Next App Router can bundle `sonner` into both layout + page chunks with
 * separate module state. The Toaster registers its chunk's `toast` on
 * `window`; the exported proxy always prefers that singleton.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    window.__OMG_SONNER_TOAST__ = sonnerToast;
    return () => {
      if (window.__OMG_SONNER_TOAST__ === sonnerToast) {
        delete window.__OMG_SONNER_TOAST__;
      }
    };
  }, []);

  return (
    <Sonner
      theme={(resolvedTheme as ToasterProps['theme']) ?? 'system'}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

function getToast(): typeof sonnerToast {
  if (typeof window !== 'undefined' && window.__OMG_SONNER_TOAST__) {
    return window.__OMG_SONNER_TOAST__;
  }
  return sonnerToast;
}

export const toast: typeof sonnerToast = new Proxy(
  function ToastBridge(message: Parameters<typeof sonnerToast>[0], data?: Parameters<typeof sonnerToast>[1]) {
    return getToast()(message, data);
  } as typeof sonnerToast,
  {
    get(_target, prop) {
      const impl = getToast();
      const value = Reflect.get(impl, prop, impl);
      return typeof value === 'function' ? value.bind(impl) : value;
    },
  }
);

export { Toaster };
