'use client';

import { useEffect, useState } from 'react';
import { useProject } from '@/components/projects/ProjectProvider';
import { resolveClientBrandLabel } from '@/lib/projects/client-brand-shared';

type ClientBrandState = {
  brandLabel: string;
  primaryUrl: string | null;
  isLoading: boolean;
};

export function useClientBrand(): ClientBrandState {
  const { activeProject, activeProjectId, isLoading: projectsLoading } = useProject();
  const [primaryUrl, setPrimaryUrl] = useState<string | null>(null);
  const [profileLabel, setProfileLabel] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!activeProjectId) {
      setPrimaryUrl(null);
      setProfileLabel(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsFetching(true);
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(activeProjectId)}/aeo-brand`,
          { cache: 'no-store' }
        );
        if (!response.ok) {
          if (!cancelled) {
            setPrimaryUrl(null);
            setProfileLabel(null);
          }
          return;
        }

        const data = (await response.json()) as {
          profile?: { brandLabel?: string; primaryUrl?: string } | null;
        };

        if (!cancelled) {
          setProfileLabel(data.profile?.brandLabel?.trim() || null);
          setPrimaryUrl(data.profile?.primaryUrl?.trim() || null);
        }
      } catch {
        if (!cancelled) {
          setPrimaryUrl(null);
          setProfileLabel(null);
        }
      } finally {
        if (!cancelled) {
          setIsFetching(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const brandLabel = resolveClientBrandLabel({
    brandLabel: profileLabel,
    projectName: activeProject?.name,
  });

  return {
    brandLabel,
    primaryUrl,
    isLoading: projectsLoading || isFetching,
  };
}
