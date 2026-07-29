'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  buildReportBranding,
  resolveClientBrandLabel,
  type ReportBranding,
} from '@/lib/projects/client-brand-shared';
import { useProject } from '@/components/projects/ProjectProvider';
import { useTeamAccess } from '@/components/team/TeamAccessProvider';

type ManifestPreview = {
  publishedManifestLabel: string | null;
  hasPendingDraft: boolean;
  isManifestPublished: boolean;
};

const EMPTY_MANIFEST: ManifestPreview = {
  publishedManifestLabel: null,
  hasPendingDraft: false,
  isManifestPublished: false,
};

export function useReportBranding(): ReportBranding {
  const { activeProject, activeProjectId } = useProject();
  const { agencyName, reportLogoUrl, brandPrimaryColor } = useTeamAccess();
  const [primaryUrl, setPrimaryUrl] = useState<string | null>(null);
  const [profileLabel, setProfileLabel] = useState<string | null>(null);
  const [manifestPreview, setManifestPreview] = useState<ManifestPreview>(EMPTY_MANIFEST);

  useEffect(() => {
    if (!activeProjectId) {
      setPrimaryUrl(null);
      setProfileLabel(null);
      setManifestPreview(EMPTY_MANIFEST);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [brandResponse, manifestResponse] = await Promise.all([
          fetch(`/api/projects/${encodeURIComponent(activeProjectId)}/aeo-brand`, {
            cache: 'no-store',
          }),
          fetch(
            `/api/article-studio/domain-profile?projectId=${encodeURIComponent(activeProjectId)}`,
            { cache: 'no-store' }
          ),
        ]);

        if (cancelled) return;

        if (brandResponse.ok) {
          const data = (await brandResponse.json()) as {
            profile?: { brandLabel?: string; primaryUrl?: string } | null;
          };
          setProfileLabel(data.profile?.brandLabel?.trim() || null);
          setPrimaryUrl(data.profile?.primaryUrl?.trim() || null);
        } else {
          setProfileLabel(null);
          setPrimaryUrl(null);
        }

        if (manifestResponse.ok) {
          const manifest = (await manifestResponse.json()) as {
            publishedManifest?: { name?: string } | null;
            publishedVersion?: number;
            hasPendingDraft?: boolean;
          };
          const publishedName = manifest.publishedManifest?.name?.trim() || null;
          const isManifestPublished =
            (manifest.publishedVersion ?? 0) > 0 && Boolean(publishedName);
          setManifestPreview({
            publishedManifestLabel: publishedName,
            hasPendingDraft: manifest.hasPendingDraft ?? false,
            isManifestPublished,
          });
        } else {
          setManifestPreview(EMPTY_MANIFEST);
        }
      } catch {
        if (!cancelled) {
          setPrimaryUrl(null);
          setProfileLabel(null);
          setManifestPreview(EMPTY_MANIFEST);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  return useMemo(() => {
    const savedBrandLabel = resolveClientBrandLabel({
      brandLabel: profileLabel,
      projectName: activeProject?.name,
    });

    return buildReportBranding({
      savedBrandLabel,
      publishedManifestLabel: manifestPreview.publishedManifestLabel,
      primaryUrl: primaryUrl ?? activeProject?.domain ?? null,
      agencyName,
      reportLogoUrl,
      brandPrimaryColor,
      hasPendingDraft: manifestPreview.hasPendingDraft,
      isManifestPublished: manifestPreview.isManifestPublished,
    });
  }, [
    activeProject?.domain,
    activeProject?.name,
    agencyName,
    brandPrimaryColor,
    manifestPreview.hasPendingDraft,
    manifestPreview.isManifestPublished,
    manifestPreview.publishedManifestLabel,
    primaryUrl,
    profileLabel,
    reportLogoUrl,
  ]);
}
