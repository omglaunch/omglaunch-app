'use client';

import { format } from 'date-fns';
import { Loader2, Map, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SiloProjectSummary } from '@/lib/silo-builder/types';
import { cn } from '@/lib/utils';

type SiloHistorySidebarProps = {
  projects: SiloProjectSummary[];
  activeProjectId: string | null;
  isLoading: boolean;
  isLoadingProject: boolean;
  deletingId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, event: React.MouseEvent) => void;
};

function projectLabel(project: SiloProjectSummary): string {
  if (project.type === 'KEYWORD') {
    return project.seedKeyword ?? project.title;
  }
  return project.domain ?? project.title;
}

function projectMeta(project: SiloProjectSummary): string {
  const location = project.geography ?? 'Global';
  const typeLabel = project.type === 'KEYWORD' ? 'Keyword' : 'Competitor';
  return `${location} · ${typeLabel} · ${format(new Date(project.createdAt), 'MMM d, yyyy · h:mm a')}`;
}

export default function SiloHistorySidebar({
  projects,
  activeProjectId,
  isLoading,
  isLoadingProject,
  deletingId,
  onSelect,
  onDelete,
}: SiloHistorySidebarProps) {
  return (
    <aside className="flex w-full min-w-0 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm max-h-[min(42vh,320px)] min-h-0 lg:h-full lg:max-h-none lg:w-1/4 lg:max-w-xs">
      <div className="border-b border-border px-4 py-3 lg:py-4">
        <h2 className="text-sm font-semibold text-foreground">Saved Silos</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {projects.length} reports stored
          {projects.length > 0 ? (
            <span className="lg:hidden"> · scroll list, then build below</span>
          ) : null}
        </p>
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="h-full overflow-y-auto overscroll-contain p-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-8 text-center">
            <Map className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-xs font-medium text-foreground">No saved silos yet</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Generate a keyword or competitor silo to save your first architecture.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {projects.map(project => {
              const isActive = project.id === activeProjectId;

              return (
                <li key={project.id}>
                  <div
                    className={cn(
                      'group flex items-start gap-1 rounded-lg border transition-all',
                      isActive
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900 shadow-sm dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-50'
                        : 'border-transparent hover:border-border hover:bg-muted/50'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(project.id)}
                      disabled={isLoadingProject && activeProjectId === project.id}
                      className="min-w-0 flex-1 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-1"
                    >
                      <p
                        className={cn(
                          'truncate text-sm font-medium',
                          isActive ? 'text-emerald-900 dark:text-foreground' : 'text-foreground'
                        )}
                      >
                        {projectLabel(project)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{projectMeta(project)}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {project.nodeCount} nodes
                      </p>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mr-1 mt-1.5 h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      disabled={deletingId === project.id}
                      onClick={event => onDelete(project.id, event)}
                      aria-label={`Delete ${projectLabel(project)}`}
                    >
                      {deletingId === project.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        </div>
        {projects.length > 2 ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card via-card/80 to-transparent lg:hidden"
            aria-hidden
          />
        ) : null}
      </div>
    </aside>
  );
}
