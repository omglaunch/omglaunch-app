'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ViewId } from '@/components/dashboard/Dashboard';
import type SidebarComponent from '@/components/dashboard/Sidebar';

type KeywordAuditSidebarProps = {
  Sidebar: typeof SidebarComponent;
};

export default function KeywordAuditSidebar({ Sidebar }: KeywordAuditSidebarProps) {
  const router = useRouter();
  const [activeView, setActiveView] = useState<ViewId>('keyword-audit');

  function onNavigate(id: ViewId) {
    setActiveView(id);
    router.push('/dashboard');
  }

  return <Sidebar activeView={activeView} onNavigate={onNavigate} />;
}
