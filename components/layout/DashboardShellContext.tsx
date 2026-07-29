'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

type DashboardShellContextValue = {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  openMobile: () => void;
  closeMobile: () => void;
};

const DashboardShellContext = createContext<DashboardShellContextValue | null>(null);

export function DashboardShellProvider({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <DashboardShellContext.Provider
      value={{ mobileOpen, setMobileOpen, openMobile, closeMobile }}
    >
      {children}
    </DashboardShellContext.Provider>
  );
}

export function useDashboardShell() {
  return useContext(DashboardShellContext);
}
