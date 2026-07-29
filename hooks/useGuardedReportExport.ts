'use client';

import { useCallback, useRef, useState } from 'react';
import { useReportBranding } from '@/hooks/useReportBranding';
import { getReportExportWarning } from '@/lib/projects/client-brand-shared';

export function useGuardedReportExport() {
  const branding = useReportBranding();
  const [gateOpen, setGateOpen] = useState(false);
  const pendingExportRef = useRef<(() => Promise<void>) | null>(null);
  const gateMessage = getReportExportWarning(branding);

  const runExport = useCallback(
    (exportFn: () => Promise<void>) => {
      if (gateMessage) {
        pendingExportRef.current = exportFn;
        setGateOpen(true);
        return;
      }
      void exportFn();
    },
    [gateMessage]
  );

  const confirmExport = useCallback(() => {
    setGateOpen(false);
    const fn = pendingExportRef.current;
    pendingExportRef.current = null;
    void fn?.();
  }, []);

  const cancelExport = useCallback(() => {
    pendingExportRef.current = null;
    setGateOpen(false);
  }, []);

  return {
    branding,
    gateOpen,
    gateMessage,
    setGateOpen,
    runExport,
    confirmExport,
    cancelExport,
  };
}
