'use client';

import { useEffect, useState } from 'react';
import type { SettingsBundle } from '@/app/actions/settings';
import { getAeoBrandProfile } from '@/app/actions/aeo-brand-profile';
import type { AeoBrandProfileRecord } from '@/lib/ai-visibility/aeo-brand-profile';
import { entityTypeLabel } from '@/lib/ai-visibility/entity-type';
import { hasNapData, hasSameAsData } from '@/lib/ai-visibility/nap-sameas';
import { resolveClientBrandLabel } from '@/lib/projects/client-brand-shared';
import { useTeamAccess } from '@/components/team/TeamAccessProvider';
import SettingsSection from '@/components/settings/SettingsSection';
import { Badge } from '@/components/ui/badge';

type ClientPortalTabProps = {
  data: SettingsBundle;
};

export default function ClientPortalTab({ data }: ClientPortalTabProps) {
  const { assignedProjectIds, agencyName } = useTeamAccess();
  const assignedProjects = data.projects.filter(project =>
    assignedProjectIds.includes(project.id)
  );
  const primaryProject = assignedProjects[0] ?? data.projects[0] ?? null;
  const [profile, setProfile] = useState<AeoBrandProfileRecord | null>(null);

  useEffect(() => {
    if (!primaryProject?.id) {
      setProfile(null);
      return;
    }

    void getAeoBrandProfile(primaryProject.id).then(setProfile);
  }, [primaryProject?.id]);

  const brandLabel = primaryProject
    ? resolveClientBrandLabel({
        brandLabel: profile?.brandLabel,
        projectName: primaryProject.name,
      })
    : 'Client Brand';

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Client portal"
        description="Read-only access to your assigned client brand, visibility matrix, and reports. Agency workspace settings are hidden."
      >
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Client brand
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">{brandLabel}</p>
          {profile?.primaryUrl ? (
            <p className="mt-1 text-sm text-muted-foreground">{profile.primaryUrl}</p>
          ) : primaryProject?.domain ? (
            <p className="mt-1 text-sm text-muted-foreground">{primaryProject.domain}</p>
          ) : null}
          {profile?.entityType ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Entity type: {entityTypeLabel(profile.entityType)}
            </p>
          ) : null}
          {profile && hasNapData(profile) ? (
            <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
              {profile.contactPhone ? (
                <div>
                  <dt className="sr-only">Phone</dt>
                  <dd>{profile.contactPhone}</dd>
                </div>
              ) : null}
              {profile.contactEmail ? (
                <div>
                  <dt className="sr-only">Email</dt>
                  <dd>{profile.contactEmail}</dd>
                </div>
              ) : null}
              {profile.address ? (
                <div>
                  <dt className="sr-only">Address</dt>
                  <dd className="whitespace-pre-line">{profile.address}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          {profile && hasSameAsData(profile.sameAsUrls) ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {profile.sameAsUrls.length} linked profile
              {profile.sameAsUrls.length === 1 ? '' : 's'}
            </p>
          ) : null}
          <Badge variant="secondary" className="mt-3">
            Read-only · Viewer
          </Badge>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Your account"
        description="Profile managed by your agency. Contact them to change access."
      >
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium text-foreground">{data.user.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium text-foreground">{data.user.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Prepared by</dt>
            <dd className="font-medium text-foreground">{agencyName}</dd>
          </div>
        </dl>
      </SettingsSection>

      <p className="text-xs text-muted-foreground">
        Reports and exports use your client brand name — never the agency workspace name.
      </p>
    </div>
  );
}
