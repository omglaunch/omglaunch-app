'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { CheckCircle2, Loader2, Target, XCircle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import {
  deriveManualAliasesFromProfile,
  formatSameAsUrlsInput,
  parseExtraAliasesInput,
  parseSameAsUrlsInput,
  type AeoBrandProfileRecord,
} from '@/lib/ai-visibility/aeo-brand-profile';
import {
  listBrandAuditLog,
  listProjectsWithAeoBrand,
  syncAeoBrandToVisibilityRows,
  upsertAeoBrandProfile,
  type BrandAuditEntry,
  type ProjectWithAeoBrand,
} from '@/app/actions/aeo-brand-profile';
import { useProject } from '@/components/projects/ProjectProvider';
import AeoBrandProfileForm, {
  EMPTY_AEO_BRAND_FORM,
  type AeoBrandProfileFormValues,
} from '@/components/ai-visibility/AeoBrandProfileForm';
import {
  DEFAULT_ENTITY_TYPE,
  entityTypeLabel,
} from '@/lib/ai-visibility/entity-type';
import SettingsSection from '@/components/settings/SettingsSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateProjectDomain } from '@/app/actions/keyword-manager';
import { cn } from '@/lib/utils';

function profileToFormValues(
  profile: AeoBrandProfileRecord | null,
  projectName: string,
  projectDomain: string | null
): AeoBrandProfileFormValues {
  if (profile) {
    const manual = deriveManualAliasesFromProfile(profile);
    return {
      brandLabel: profile.brandLabel,
      primaryUrl: profile.primaryUrl,
      extraAliases: manual.join('\n'),
      entityType: profile.entityType,
      contactPhone: profile.contactPhone ?? '',
      contactEmail: profile.contactEmail ?? '',
      address: profile.address ?? '',
      sameAsUrls: formatSameAsUrlsInput(profile.sameAsUrls),
    };
  }

  const domain = projectDomain?.trim() ?? '';
  const primaryUrl =
    domain && !/^https?:\/\//i.test(domain) ? `https://${domain}` : domain;

  return {
    brandLabel: projectName,
    primaryUrl,
    extraAliases: '',
    entityType: DEFAULT_ENTITY_TYPE,
    contactPhone: '',
    contactEmail: '',
    address: '',
    sameAsUrls: '',
  };
}

export default function AeoBrandTab() {
  const {
    activeProjectId,
    activeProject,
    setActiveProjectId,
    refreshProjects,
    isLoading: projectsLoading,
  } = useProject();
  const [projects, setProjects] = useState<ProjectWithAeoBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<AeoBrandProfileFormValues>(EMPTY_AEO_BRAND_FORM);
  const [projectDomain, setProjectDomain] = useState('');
  const [brandAuditLog, setBrandAuditLog] = useState<BrandAuditEntry[]>([]);
  const [isSaving, startSaveTransition] = useTransition();
  const [isSyncing, startSyncTransition] = useTransition();
  const [isSavingDomain, startDomainSaveTransition] = useTransition();

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listProjectsWithAeoBrand();
      setProjects(rows);
    } catch {
      toast.error('Failed to load client brand profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!activeProjectId) {
      setForm(EMPTY_AEO_BRAND_FORM);
      return;
    }
    const row = projects.find(p => p.id === activeProjectId);
    if (!row) {
      if (activeProject) {
        setForm(
          profileToFormValues(null, activeProject.name, activeProject.domain ?? null)
        );
      }
      return;
    }
    setForm(profileToFormValues(row.profile, row.name, row.domain));
  }, [activeProjectId, activeProject, projects]);

  useEffect(() => {
    setProjectDomain(activeProject?.domain ?? '');
  }, [activeProject?.domain, activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) {
      setBrandAuditLog([]);
      return;
    }

    void listBrandAuditLog(activeProjectId).then(setBrandAuditLog);
  }, [activeProjectId, projects]);

  function handleSaveDomain() {
    if (!activeProjectId) {
      toast.error('Select a project to update its domain.');
      return;
    }

    startDomainSaveTransition(async () => {
      try {
        const result = await updateProjectDomain(activeProjectId, projectDomain);
        if (result.domainWarning) {
          toast.message('Domain tip', { description: result.domainWarning });
        }
        toast.success('Project domain updated');
        await refreshProjects();
        await loadProjects();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update project domain');
      }
    });
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!activeProjectId) {
      toast.error('Select a project to save its brand profile.');
      return;
    }

    startSaveTransition(async () => {
      try {
        const aliases = parseExtraAliasesInput(form.extraAliases);
        const sameAsUrls = parseSameAsUrlsInput(form.sameAsUrls);
        const { profile, rowsUpdated, domainWarning } = await upsertAeoBrandProfile(activeProjectId, {
          brandLabel: form.brandLabel,
          primaryUrl: form.primaryUrl,
          brandAliases: aliases.length ? aliases : undefined,
          entityType: form.entityType,
          contactPhone: form.contactPhone,
          contactEmail: form.contactEmail,
          address: form.address,
          sameAsUrls,
        });
        toast.success(
          rowsUpdated > 0
            ? `Brand profile saved · ${rowsUpdated} matrix row(s) updated`
            : 'Brand profile saved'
        );
        toast.message('Domain manifest', {
          description: 'Draft will refresh in the background. Publish from Settings → Domain Manifest when ready.',
        });
        if (domainWarning) {
          toast.message('Domain tip', { description: domainWarning });
        }
        const refreshed = await listProjectsWithAeoBrand();
        setProjects(refreshed);
        const auditEntries = await listBrandAuditLog(activeProjectId);
        setBrandAuditLog(auditEntries);
        const row = refreshed.find(p => p.id === activeProjectId);
        setForm(
          profileToFormValues(
            profile,
            row?.name ?? activeProject?.name ?? '',
            row?.domain ?? activeProject?.domain ?? null
          )
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save brand profile');
      }
    });
  }

  function handleSyncRows() {
    if (!activeProjectId) {
      toast.error('Select a project to sync matrix rows.');
      return;
    }

    startSyncTransition(async () => {
      try {
        const { rowsUpdated } = await syncAeoBrandToVisibilityRows(activeProjectId);
        toast.success(
          rowsUpdated > 0
            ? `Updated ${rowsUpdated} visibility matrix row(s) with current brand`
            : 'No matrix rows to update for this project'
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to sync matrix rows');
      }
    });
  }

  if (projectsLoading || loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading client brands…
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <SettingsSection
        title="Client Brands (AEO)"
        description="Per-client brand identity for AI Visibility, gap analysis, and citation matching."
      >
        <p className="text-sm text-muted-foreground">
          No projects yet. Create a project from the header selector to configure a client brand.
        </p>
      </SettingsSection>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="All client brands"
        description="Each project represents one client. Brand profiles are used for AI Visibility — not your workspace name."
      >
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Project</th>
                <th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium">Entity type</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(project => {
                const isActive = project.id === activeProjectId;
                return (
                  <tr
                    key={project.id}
                    className={cn(
                      'border-t border-border',
                      isActive && 'bg-emerald-50/50 dark:bg-emerald-950/20'
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        className={cn(
                          'text-left font-medium hover:text-emerald-700 dark:hover:text-emerald-300',
                          isActive && 'text-emerald-700 dark:text-emerald-300'
                        )}
                        onClick={() => setActiveProjectId(project.id)}
                      >
                        {project.name}
                      </button>
                      {project.domain ? (
                        <p className="text-xs text-muted-foreground">{project.domain}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {project.profile?.brandLabel ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {project.profile
                        ? entityTypeLabel(project.profile.entityType)
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {project.profile ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Configured
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 border-amber-200 text-amber-800 dark:border-amber-900 dark:text-amber-300"
                        >
                          <XCircle className="h-3 w-3" />
                          Missing
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Edit active project brand"
        description={
          activeProject
            ? `Editing brand for "${activeProject.name}". Switch projects using the table above or the header selector.`
            : 'Select a project to configure its client brand.'
        }
      >
        {!activeProjectId ? (
          <p className="text-sm text-muted-foreground">
            Select a project from the header or the table above.
          </p>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
              <Label htmlFor={`project-domain-${activeProjectId}`}>Project domain</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id={`project-domain-${activeProjectId}`}
                  value={projectDomain}
                  onChange={event => setProjectDomain(event.target.value)}
                  placeholder="e.g. clientbrand.com"
                  disabled={isSavingDomain || isSaving || isSyncing}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSavingDomain || isSaving || isSyncing}
                  onClick={handleSaveDomain}
                >
                  {isSavingDomain ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save domain'
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Must align with the primary website URL below. Changing the domain re-validates
                against the saved brand URL before saving.
              </p>
            </div>

            <AeoBrandProfileForm
              idPrefix={`settings-aeo-${activeProjectId}`}
              values={form}
              onChange={patch => setForm(prev => ({ ...prev, ...patch }))}
              disabled={isSaving || isSyncing}
              projectDomain={projectDomain || activeProject?.domain || null}
            />

            {(() => {
              const row = projects.find(p => p.id === activeProjectId);
              const aliases = row?.profile?.brandAliases ?? [];
              if (!aliases.length) return null;
              return (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Active citation aliases
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {aliases.map(alias => (
                    <Badge key={alias} variant="secondary" className="font-normal">
                      {alias}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Saving the profile automatically updates brand URL and aliases on all existing
                  matrix rows for this project. Use re-sync if rows look stale after onboarding.
                </p>
              </div>
              );
            })()}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                type="submit"
                disabled={isSaving || isSyncing}
                className="bg-emerald-600 text-white hover:bg-emerald-500"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save brand profile'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving || isSyncing || !projects.find(p => p.id === activeProjectId)?.profile}
                onClick={handleSyncRows}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing…
                  </>
                ) : (
                  'Re-sync matrix rows'
                )}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/ai-visibility">
                  <Target className="mr-2 h-4 w-4" />
                  Open AI Visibility
                </Link>
              </Button>
            </div>
          </form>
        )}
      </SettingsSection>

      {activeProjectId ? (
        <SettingsSection
          title="Brand change history"
          description="Recent edits to this project's client brand profile."
        >
          {brandAuditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No brand changes recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {brandAuditLog.map(entry => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{entry.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.actorName} · {entry.actorEmail}
                  </p>
                  {entry.details ? (
                    <p className="mt-1 text-sm text-muted-foreground">{entry.details}</p>
                  ) : null}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/settings?tab=domain-manifest">View manifest history</Link>
              </Button>
            </div>
          )}
        </SettingsSection>
      ) : null}
    </div>
  );
}
