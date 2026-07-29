'use client';

import { Menu } from 'lucide-react';
import CreditIndicator from '@/components/dashboard/CreditIndicator';
import ProjectSelector from '@/components/projects/ProjectSelector';
import { useDashboardShell } from '@/components/layout/DashboardShellContext';
import { useClientBrand } from '@/hooks/useClientBrand';
import { useTeamAccess } from '@/components/team/TeamAccessProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function AppHeader() {
  const shell = useDashboardShell();
  const { isViewer, agencyName, hideApiCostsFromViewer } = useTeamAccess();
  const { brandLabel } = useClientBrand();
  const showCredits = !isViewer || !hideApiCostsFromViewer;

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border bg-card px-4">
      <div className="flex min-w-0 shrink items-center justify-start gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-ml-2 md:hidden"
          onClick={() => shell?.setMobileOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={shell?.mobileOpen ?? false}
        >
          <Menu className="h-5 w-5" />
        </Button>
        {isViewer ? (
          <Badge
            variant="secondary"
            className="hidden max-w-[min(100%,280px)] truncate text-[10px] sm:inline-flex"
            title={`${brandLabel} · Client portal · ${agencyName}`}
          >
            {brandLabel} · client brand, not agency workspace
          </Badge>
        ) : null}
      </div>

      <div className="ml-auto flex shrink-0 items-center justify-end gap-3">
        {showCredits ? <CreditIndicator /> : null}
        <ProjectSelector />
      </div>
    </header>
  );
}
