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
  getClientTeamAccess,
  type ClientTeamAccess,
} from '@/app/actions/team-access';
import { authClient } from '@/lib/auth-client';

type TeamAccessContextValue = ClientTeamAccess & {
  isLoading: boolean;
  refreshTeamAccess: () => Promise<ClientTeamAccess>;
};

const defaultAccess: ClientTeamAccess = {
  role: 'OWNER',
  isViewer: false,
  canWrite: true,
  isWorkspaceOwner: true,
  assignedProjectIds: [],
  hideApiCostsFromViewer: false,
  hideUsageMetricsFromViewer: false,
  agencyName: 'Agency',
  reportLogoUrl: null,
  brandPrimaryColor: '#059669',
};

const TeamAccessContext = createContext<TeamAccessContextValue | null>(null);

export function TeamAccessProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [access, setAccess] = useState<ClientTeamAccess>(defaultAccess);
  const [isLoading, setIsLoading] = useState(true);

  const refreshTeamAccess = useCallback(async () => {
    const next = await getClientTeamAccess();
    setAccess(next);
    return next;
  }, []);

  useEffect(() => {
    if (isSessionPending) {
      return;
    }

    if (!session?.user?.id) {
      setAccess(defaultAccess);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      try {
        const next = await getClientTeamAccess();
        if (!cancelled) {
          setAccess(next);
        }
      } catch {
        if (!cancelled) {
          setAccess(defaultAccess);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSessionPending, session?.user?.id]);

  const value = useMemo(
    () => ({
      ...access,
      isLoading: isSessionPending || isLoading,
      refreshTeamAccess,
    }),
    [access, isLoading, isSessionPending, refreshTeamAccess]
  );

  return (
    <TeamAccessContext.Provider value={value}>{children}</TeamAccessContext.Provider>
  );
}

export function useTeamAccess(): TeamAccessContextValue {
  const context = useContext(TeamAccessContext);
  if (!context) {
    throw new Error('useTeamAccess must be used within TeamAccessProvider');
  }
  return context;
}

/** Safe outside provider during SSR — returns non-viewer defaults. */
export function useTeamAccessOptional(): TeamAccessContextValue | null {
  return useContext(TeamAccessContext);
}
