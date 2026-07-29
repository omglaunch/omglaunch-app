'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import type { ViewId } from '@/components/dashboard/Dashboard';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { DashboardShellProvider, useDashboardShell } from '@/components/layout/DashboardShellContext';

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { mobileOpen, setMobileOpen, closeMobile } = useDashboardShell()!;
  const [activeView, setActiveView] = useState<ViewId>('analysis-ia');

  function onNavigate(id: ViewId) {
    setActiveView(id);
    router.push('/dashboard');
    closeMobile();
  }

  const sidebarProps = {
    activeView,
    onNavigate,
  };

  const mobileSidebarProps = {
    ...sidebarProps,
    isOpen: mobileOpen,
    onClose: closeMobile,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden shrink-0 md:block">
        <Sidebar {...sidebarProps} />
      </div>

      <div className="md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-60 max-w-[85vw] border-r border-border p-0 [&>button]:hidden"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar {...mobileSidebarProps} className="h-full border-r-0" />
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-hidden">{children}</div>
    </div>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShellProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </DashboardShellProvider>
  );
}
