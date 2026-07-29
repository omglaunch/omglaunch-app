'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  ListOrdered,
  Cpu,
  Activity,
  Shield,
  ArrowLeft,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'User Directory', icon: Users },
  { href: '/admin/queues', label: 'Background Queues', icon: ListOrdered },
  { href: '/admin/ai-config', label: 'AI Engine & API Config', icon: Cpu },
  { href: '/admin/integration-health', label: 'Integration Logs', icon: Activity },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col bg-slate-900 text-slate-100">
      <div className="flex items-center gap-2 border-b border-slate-700 px-5 py-5">
        <Shield className="h-6 w-6 text-amber-400" />
        <div>
          <p className="text-sm font-semibold tracking-wide">Super Admin</p>
          <p className="text-xs text-slate-400">Command Center</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map(item => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-700 p-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
    </aside>
  );
}
