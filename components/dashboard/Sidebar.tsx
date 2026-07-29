'use client';

import { cn } from '@/lib/utils';
import type { ViewId } from './Dashboard';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Globe,
  Sparkles,
  Microscope,
  ArrowLeftRight,
  Users,
  Search,
  BarChart3,
  ListPlus,
  TrendingUp,
  PenTool,
  Snowflake,
  ChevronDown,
  FileText,
  Network,
  LayoutDashboard,
  Crosshair,
  MapPin,
  Layers,
  LifeBuoy,
  Eye,
} from 'lucide-react';
import { useState } from 'react';
import SidebarProfileMenu from '@/components/dashboard/SidebarProfileMenu';
import { useClientBrand } from '@/hooks/useClientBrand';
import { useTeamAccess } from '@/components/team/TeamAccessProvider';

interface NavItem {
  id?: ViewId;
  href?: string;
  label: string;
  icon: React.ElementType;
}

interface NavSection {
  category: string;
  items: NavItem[];
}

const DASHBOARD_ITEM: NavItem = {
  href: '/dashboard',
  label: 'Dashboard',
  icon: LayoutDashboard,
};

const LOCAL_DOMINANCE_ITEM: NavItem = {
  href: '/dashboard/local-dominance',
  label: 'Local Dominance',
  icon: MapPin,
};

const NAV_SECTIONS: NavSection[] = [
  {
    category: 'SEO Analysis',
    items: [
      { href: '/page-audit', label: 'Page Audit', icon: FileText },
      { href: '/seo-analysis', label: 'Page SEO analysis', icon: Globe },
      { href: '/analysis-ai', label: 'Analysis AI', icon: Sparkles },
      { href: '/semantic-analysis', label: 'Semantic analysis', icon: Microscope },
      { href: '/page-optimizer', label: 'Page Optimizer', icon: Users },
      { href: '/dashboard/competitor-intel', label: 'Competitor Intel', icon: Crosshair },
      { href: '/hub-and-spoke', label: 'Hub & Spoke', icon: Network },
      { href: '/dashboard/silo-builder', label: 'Silo Builder', icon: Layers },
      { href: '/query-comparison', label: 'Query comparison', icon: ArrowLeftRight },
    ],
  },
  {
    category: 'Keywords',
    items: [
      { href: '/keyword-audit', label: 'Keyword audit', icon: Search },
      { href: '/research', label: 'Research volumes', icon: BarChart3 },
      { href: '/suggested-keywords', label: 'Suggested keywords', icon: ListPlus },
    ],
  },
  {
    category: 'Core Workflow',
    items: [
      { href: '/rank-tracker', label: 'Rank Tracker', icon: TrendingUp },
      { href: '/revenue-rescue', label: 'Revenue Rescue', icon: LifeBuoy },
      { href: '/ai-visibility', label: 'AI Visibility Engine', icon: Eye },
      { href: '/article-studio', label: 'Article Studio', icon: PenTool },
    ],
  },
];

const VIEWER_NAV_SECTIONS: NavSection[] = [
  {
    category: 'Client Reports',
    items: [
      { href: '/rank-tracker', label: 'Rank Tracker', icon: TrendingUp },
      { href: '/ai-visibility', label: 'AI Visibility Engine', icon: Eye },
      { href: '/dashboard/local-dominance', label: 'Local Dominance', icon: MapPin },
    ],
  },
];

interface SidebarProps {
  activeView: ViewId;
  onNavigate: (id: ViewId) => void;
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

export default function Sidebar({
  activeView,
  onNavigate,
  isOpen = false,
  onClose,
  className,
}: SidebarProps) {
  const pathname = usePathname();
  const { isViewer, agencyName } = useTeamAccess();
  const { brandLabel } = useClientBrand();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const navSections = isViewer ? VIEWER_NAV_SECTIONS : NAV_SECTIONS;
  const showLocalDominance = !isViewer;

  function isItemActive(item: NavItem) {
    if (item.href) {
      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    }
    return pathname === '/dashboard' && activeView === item.id;
  }

  const navItemClassName = (isActive: boolean) =>
    cn(
      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150 text-left',
      isActive
        ? 'bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground'
    );

  const navIconClassName = (isActive: boolean) =>
    cn(
      'shrink-0',
      isActive
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-zinc-600 dark:text-muted-foreground'
    );

  function toggleSection(category: string) {
    setCollapsed(prev => ({ ...prev, [category]: !prev[category] }));
  }

  function handleNavigate(id: ViewId) {
    onNavigate(id);
    onClose?.();
  }

  const isMobileDrawer = Boolean(onClose);

  return (
    <aside
      className={cn(
        'h-full w-60 shrink-0 flex-col border-r border-border bg-card',
        isMobileDrawer ? 'flex' : 'hidden md:flex',
        className
      )}
      aria-hidden={isMobileDrawer ? !isOpen : undefined}
    >
      {/* Logo / client portal header */}
      <div className="border-b border-border px-5 py-5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 text-inherit no-underline transition-opacity hover:opacity-90"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 shadow-sm">
            <Snowflake className="h-[18px] w-[18px] text-white" />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-[15px] font-semibold tracking-tight text-foreground">
              {isViewer ? brandLabel : 'OMG Launch'}
            </span>
            {isViewer ? (
              <span className="block truncate text-[10px] text-muted-foreground">
                Client portal · {agencyName}
              </span>
            ) : null}
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {(() => {
          const Icon = DASHBOARD_ITEM.icon;
          const isDashboardActive = isItemActive(DASHBOARD_ITEM);
          return (
            <Link
              href={DASHBOARD_ITEM.href!}
              className={cn(navItemClassName(isDashboardActive), 'mb-3')}
              onClick={() => onClose?.()}
            >
              <Icon size={15} className={navIconClassName(isDashboardActive)} />
              <span className="truncate">{DASHBOARD_ITEM.label}</span>
              {isDashboardActive && (
                <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              )}
            </Link>
          );
        })()}

        {showLocalDominance
          ? (() => {
          const Icon = LOCAL_DOMINANCE_ITEM.icon;
          const isActive = isItemActive(LOCAL_DOMINANCE_ITEM);
          return (
            <Link
              href={LOCAL_DOMINANCE_ITEM.href!}
              className={cn(navItemClassName(isActive), 'mb-3')}
              onClick={() => onClose?.()}
            >
              <Icon size={15} className={navIconClassName(isActive)} />
              <span className="truncate">{LOCAL_DOMINANCE_ITEM.label}</span>
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              )}
            </Link>
          );
        })()
          : null}

        {navSections.map(section => (
          <div key={section.category} className="mb-2">
            <button
              onClick={() => toggleSection(section.category)}
              className="w-full flex items-center justify-between px-2 py-1.5 mb-1 group"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors group-hover:text-foreground">
                {section.category}
              </span>
              <ChevronDown
                size={12}
                className={cn(
                  'text-muted-foreground transition-transform duration-200',
                  collapsed[section.category] && '-rotate-90'
                )}
              />
            </button>

            {!collapsed[section.category] && (
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon;
                  const isActive = isItemActive(item);
                  const key = item.href ?? item.id;

                  if (item.href) {
                    return (
                      <Link
                        key={key}
                        id={item.href === '/hub-and-spoke' ? 'tour-hub-nav' : undefined}
                        href={item.href}
                        className={navItemClassName(isActive)}
                        onClick={() => onClose?.()}
                      >
                        <Icon size={15} className={navIconClassName(isActive)} />
                        <span className="truncate">{item.label}</span>
                        {isActive && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        )}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={key}
                      onClick={() => item.id && handleNavigate(item.id)}
                      className={navItemClassName(isActive)}
                    >
                      <Icon size={15} className={navIconClassName(isActive)} />
                      <span className="truncate">{item.label}</span>
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      <SidebarProfileMenu />
    </aside>
  );
}
