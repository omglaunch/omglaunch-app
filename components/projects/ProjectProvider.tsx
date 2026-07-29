'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createProject,
  getProjects,
  type KeywordManagerProject,
} from '@/app/actions/keyword-manager';
import { authClient } from '@/lib/auth-client';
import { ACTIVE_PROJECT_STORAGE_KEY } from '@/lib/projects/constants';

type ProjectContextValue = {
  projects: KeywordManagerProject[];
  activeProject: KeywordManagerProject | null;
  activeProjectId: string;
  isLoading: boolean;
  setActiveProjectId: (id: string) => void;
  refreshProjects: () => Promise<KeywordManagerProject[]>;
  addProject: (name: string, domain?: string) => Promise<KeywordManagerProject>;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

function readStoredProjectId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
}

function writeStoredProjectId(id: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, id);
  document.cookie = `${ACTIVE_PROJECT_STORAGE_KEY}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
}

function resolveActiveProjectId(
  projects: KeywordManagerProject[],
  storedId: string | null
): string {
  if (storedId && projects.some(project => project.id === storedId)) {
    return storedId;
  }
  return projects[0]?.id ?? '';
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const workspaceId = session?.user?.id;

  const [projects, setProjects] = useState<KeywordManagerProject[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState('');
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);

  const refreshProjects = useCallback(async () => {
    const nextProjects = await getProjects();
    setProjects(nextProjects);
    return nextProjects;
  }, []);

  useEffect(() => {
    if (isSessionPending) {
      return;
    }

    if (!workspaceId) {
      setProjects([]);
      setActiveProjectIdState('');
      setIsProjectsLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsProjectsLoading(true);

      try {
        const nextProjects = await refreshProjects();
        if (cancelled) return;

        const storedId = readStoredProjectId();
        const validId = resolveActiveProjectId(nextProjects, storedId);
        setActiveProjectIdState(validId);
        if (validId) {
          writeStoredProjectId(validId);
        }
      } finally {
        if (!cancelled) {
          setIsProjectsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSessionPending, refreshProjects, workspaceId]);

  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id);
    writeStoredProjectId(id);
  }, []);

  const addProject = useCallback(
    async (name: string, domain?: string): Promise<KeywordManagerProject> => {
      const project = await createProject(name, domain);
      await refreshProjects();
      setActiveProjectId(project.id);
      return project;
    },
    [refreshProjects, setActiveProjectId]
  );

  const activeProject = useMemo(
    () =>
      activeProjectId
        ? projects.find(project => project.id === activeProjectId) ?? null
        : null,
    [activeProjectId, projects]
  );

  const isLoading = isSessionPending || isProjectsLoading;

  const value = useMemo(
    () => ({
      projects,
      activeProject,
      activeProjectId,
      isLoading,
      setActiveProjectId,
      refreshProjects,
      addProject,
    }),
    [
      activeProject,
      activeProjectId,
      addProject,
      isLoading,
      projects,
      refreshProjects,
      setActiveProjectId,
    ]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

/** Active project ID for scoping tool history. Safe outside provider during SSR. */
export function useProjectId(): string {
  const context = useContext(ProjectContext);
  return context?.activeProjectId ?? '';
}
