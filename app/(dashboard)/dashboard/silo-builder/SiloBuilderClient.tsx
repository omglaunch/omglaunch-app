'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Network } from 'lucide-react';
import InitForm from '@/components/silo-builder/InitForm';
import Workspace from '@/components/silo-builder/Workspace';
import SiloHistorySidebar from '@/components/silo-builder/SiloHistorySidebar';
import {
  parseSiloBuilderDeepLinkParams,
  type SiloInitPrefill,
} from '@/lib/silo-builder/deep-link';
import type { SiloProjectDto, SiloProjectSummary } from '@/lib/silo-builder/types';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';

export default function SiloBuilderClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const importHandledRef = useRef<string | null>(null);
  const deepLinkHandledRef = useRef(false);
  const [initPrefill, setInitPrefill] = useState<SiloInitPrefill | null>(null);
  const [activeProject, setActiveProject] = useState<SiloProjectDto | null>(null);
  const [savedProjects, setSavedProjects] = useState<SiloProjectSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSavedProjects = useCallback(async () => {
    const response = await fetch('/api/silo-builder/projects');
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload !== null && 'error' in payload
          ? String(payload.error)
          : 'Failed to load saved silos.';
      throw new Error(message);
    }

    const projects =
      typeof payload === 'object' && payload !== null && 'projects' in payload
        ? (payload.projects as SiloProjectSummary[])
        : [];

    setSavedProjects(projects);
    return projects;
  }, []);

  const loadProjectById = useCallback(async (id: string) => {
    setIsLoadingProject(true);

    try {
      const response = await fetch(`/api/silo-builder/projects/${id}`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String(payload.error)
            : 'Failed to load silo.';
        throw new Error(message);
      }

      const project =
        typeof payload === 'object' && payload !== null && 'project' in payload
          ? (payload.project as SiloProjectDto)
          : null;

      if (!project) {
        throw new Error('Silo returned invalid data.');
      }

      setActiveProject(project);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load silo.');
    } finally {
      setIsLoadingProject(false);
    }
  }, []);

  useEffect(() => {
    setIsLoadingList(true);
    void (async () => {
      try {
        await fetchSavedProjects();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load saved silos.');
      } finally {
        setIsLoadingList(false);
      }
    })();
  }, [fetchSavedProjects]);

  useEffect(() => {
    if (deepLinkHandledRef.current) {
      return;
    }

    const topicalMapId = searchParams.get('import')?.trim();
    if (topicalMapId) {
      return;
    }

    const prefill = parseSiloBuilderDeepLinkParams(searchParams);
    if (!prefill?.seedKeyword) {
      return;
    }

    deepLinkHandledRef.current = true;
    setInitPrefill(prefill);
    router.replace('/dashboard/silo-builder', { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    const topicalMapId = searchParams.get('import')?.trim();
    if (!topicalMapId || importHandledRef.current === topicalMapId) {
      return;
    }

    importHandledRef.current = topicalMapId;
    setIsLoadingProject(true);

    void (async () => {
      try {
        const response = await fetch('/api/silo-builder/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topicalMapId }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message =
            typeof payload === 'object' && payload !== null && 'error' in payload
              ? String(payload.error)
              : 'Failed to import legacy map.';
          throw new Error(message);
        }

        const project =
          typeof payload === 'object' && payload !== null && 'project' in payload
            ? (payload.project as SiloProjectDto)
            : null;

        if (!project) {
          throw new Error('Import returned invalid data.');
        }

        const alreadyImported =
          typeof payload === 'object' &&
          payload !== null &&
          'alreadyImported' in payload &&
          Boolean(payload.alreadyImported);

        setActiveProject(project);
        try {
          await fetchSavedProjects();
        } catch {
          // list refresh is best-effort after import
        }

        toast.success(
          alreadyImported
            ? 'Opened your existing Silo Builder project.'
            : 'Imported into Silo Builder.'
        );
      } catch (error) {
        importHandledRef.current = null;
        toast.error(error instanceof Error ? error.message : 'Failed to import legacy map.');
      } finally {
        setIsLoadingProject(false);
        router.replace('/dashboard/silo-builder', { scroll: false });
      }
    })();
  }, [fetchSavedProjects, router, searchParams]);

  async function handleProjectCreated(project: SiloProjectDto) {
    setActiveProject(project);
    try {
      await fetchSavedProjects();
    } catch {
      // list refresh is best-effort after create
    }
  }

  async function handleDelete(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    setDeletingId(id);

    try {
      const response = await fetch(`/api/silo-builder/projects/${id}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String(payload.error)
            : 'Failed to delete silo.';
        throw new Error(message);
      }

      setSavedProjects(prev => prev.filter(project => project.id !== id));

      if (activeProject?.id === id) {
        setActiveProject(null);
      }

      toast.success('Silo deleted.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete silo.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-4 overflow-x-hidden lg:h-full lg:min-h-0 lg:flex-row lg:gap-6">
      <SiloHistorySidebar
        projects={savedProjects}
        activeProjectId={activeProject?.id ?? null}
        isLoading={isLoadingList}
        isLoadingProject={isLoadingProject}
        deletingId={deletingId}
        onSelect={id => void loadProjectById(id)}
        onDelete={(id, event) => void handleDelete(id, event)}
      />

      <div className="min-w-0 w-full flex-1 overflow-x-hidden lg:min-h-0 lg:overflow-y-auto">
        <div className="w-full min-w-0 space-y-6 lg:space-y-8">
          <div
            className={cn(
              'flex min-w-0 items-start gap-4',
              !activeProject && !isLoadingProject && 'hidden lg:flex'
            )}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-sm dark:bg-indigo-600">
              <Network className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-foreground">Silo Builder</h1>
              <p className="mt-1 max-w-full text-sm text-muted-foreground">
                Architect Hub &amp; Spoke keyword silos or reverse-engineer competitor gaps. Reports
                are saved automatically so you can return anytime.
              </p>
            </div>
          </div>

          {isLoadingProject ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading silo…
            </div>
          ) : !activeProject ? (
            <InitForm onProjectCreated={handleProjectCreated} initialPrefill={initPrefill} />
          ) : (
            <Workspace
              project={activeProject}
              onProjectUpdate={setActiveProject}
              onBack={() => setActiveProject(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
