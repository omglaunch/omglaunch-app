'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ViewId } from '@/components/dashboard/Dashboard';
import type SidebarComponent from '@/components/dashboard/Sidebar';

type SidebarProps = {
  Sidebar: typeof SidebarComponent;
};

export default function CompetitorCompareSidebar({ Sidebar }: SidebarProps) {
  const router = useRouter();
  const [activeView, setActiveView] = useState<ViewId>('page-seo');

  function onNavigate(id: ViewId) {
    setActiveView(id);
    router.push('/dashboard');
  }

  return <Sidebar activeView={activeView} onNavigate={onNavigate} />;
}
