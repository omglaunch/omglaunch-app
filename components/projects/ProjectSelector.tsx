'use client';

import { useEffect } from 'react';
import type { KeywordManagerProject } from '@/app/actions/keyword-manager';
import CreateProjectDialog from '@/components/projects/CreateProjectDialog';
import { useProject } from '@/components/projects/ProjectProvider';
import { useTeamAccess } from '@/components/team/TeamAccessProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { locationCodeAbbreviation } from '@/lib/projects/display';
import { cn } from '@/lib/utils';
import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/components/ui/sonner';

function ProjectMetaBadge({ project }: { project: KeywordManagerProject }) {
  const location = locationCodeAbbreviation(project.locationCode);

  return (
    <span className="ml-2 flex shrink-0 items-center gap-1.5">
      {project.domain ? (
        <span className="max-w-[72px] truncate text-[10px] font-normal text-muted-foreground">
          {project.domain}
        </span>
      ) : null}
      {location ? (
        <Badge
          variant="secondary"
          className="px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
        >
          {location}
        </Badge>
      ) : null}
    </span>
  );
}

export default function ProjectSelector() {
  const {
    projects,
    activeProject,
    activeProjectId,
    isLoading,
    setActiveProjectId,
  } = useProject();
  const { isViewer, canWrite } = useTeamAccess();
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (isViewer && projects.length === 1 && projects[0]?.id !== activeProjectId) {
      setActiveProjectId(projects[0].id);
    }
  }, [activeProjectId, isViewer, projects, setActiveProjectId]);

  if (isLoading && !activeProject) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading…
      </div>
    );
  }

  const displayName = activeProject?.brandLabel ?? activeProject?.name ?? 'Select Project';
  const lockSelector = isViewer && projects.length <= 1;

  if (lockSelector) {
    return (
      <div className="flex max-w-[260px] flex-col items-end">
        <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
        <span className="text-[10px] text-muted-foreground">Client brand</span>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 max-w-[260px] justify-between gap-1 border-border bg-background px-2.5 font-medium shadow-sm hover:bg-muted"
          >
            <span className="truncate text-sm text-foreground">{displayName}</span>
            {activeProject ? <ProjectMetaBadge project={activeProject} /> : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Client projects
          </DropdownMenuLabel>
          {projects.length === 0 ? (
            <DropdownMenuItem disabled className="text-xs text-muted-foreground">
              No projects yet
            </DropdownMenuItem>
          ) : (
            projects.map(project => (
              <DropdownMenuItem
                key={project.id}
                onClick={() => setActiveProjectId(project.id)}
                className={cn(
                  'flex items-center justify-between gap-2',
                  project.id === activeProjectId && 'bg-blue-50 text-blue-700'
                )}
              >
                <span className="truncate">{project.brandLabel}</span>
                <ProjectMetaBadge project={project} />
              </DropdownMenuItem>
            ))
          )}
          {canWrite ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setCreateOpen(true)}
                className="gap-2 text-blue-600 focus:text-blue-700"
              >
                <Plus className="h-4 w-4" />
                Create New Project
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canWrite ? (
        <CreateProjectDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={project => {
            toast.success(`Project "${project.brandLabel}" created`);
          }}
        />
      ) : null}
    </>
  );
}
