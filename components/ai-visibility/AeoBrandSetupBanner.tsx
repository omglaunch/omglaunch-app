'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import AeoBrandProfileForm, {
  EMPTY_AEO_BRAND_FORM,
  type AeoBrandProfileFormValues,
} from '@/components/ai-visibility/AeoBrandProfileForm';
import {
  deriveManualAliasesFromProfile,
  formatSameAsUrlsInput,
  parseExtraAliasesInput,
  parseSameAsUrlsInput,
  type AeoBrandProfileRecord,
} from '@/lib/ai-visibility/aeo-brand-profile';
import { useProject } from '@/components/projects/ProjectProvider';

type Props = {
  projectId: string;
  /** Shown when profile is missing */
  variant?: 'banner' | 'inline';
  onProfileSaved?: (profile: AeoBrandProfileRecord) => void;
};

export default function AeoBrandSetupBanner({
  projectId,
  variant = 'banner',
  onProfileSaved,
}: Props) {
  const { activeProject } = useProject();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AeoBrandProfileRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AeoBrandProfileFormValues>(EMPTY_AEO_BRAND_FORM);

  useEffect(() => {
    if (!projectId?.trim()) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/aeo-brand`
        );
        if (!res.ok) throw new Error('Failed to load brand profile');
        const data = (await res.json()) as { profile: AeoBrandProfileRecord | null };
        if (cancelled) return;
        setProfile(data.profile);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  function openSetupDialog() {
    setForm(
      profile
        ? {
            brandLabel: profile.brandLabel,
            primaryUrl: profile.primaryUrl,
            extraAliases: deriveManualAliasesFromProfile(profile).join('\n'),
            entityType: profile.entityType,
            contactPhone: profile.contactPhone ?? '',
            contactEmail: profile.contactEmail ?? '',
            address: profile.address ?? '',
            sameAsUrls: formatSameAsUrlsInput(profile.sameAsUrls),
          }
        : EMPTY_AEO_BRAND_FORM
    );
    setDialogOpen(true);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const aliases = parseExtraAliasesInput(form.extraAliases);
      const sameAsUrls = parseSameAsUrlsInput(form.sameAsUrls);

      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/aeo-brand`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandLabel: form.brandLabel,
            primaryUrl: form.primaryUrl,
            brandAliases: aliases.length ? aliases : undefined,
            entityType: form.entityType,
            contactPhone: form.contactPhone,
            contactEmail: form.contactEmail,
            address: form.address,
            sameAsUrls,
          }),
        }
      );
      const data = (await res.json()) as {
        profile?: AeoBrandProfileRecord;
        rowsUpdated?: number;
        domainWarning?: string;
        manifestRegenScheduled?: boolean;
        error?: string;
      };
      if (!res.ok || !data.profile) {
        throw new Error(data.error ?? 'Failed to save brand profile');
      }
      setProfile(data.profile);
      onProfileSaved?.(data.profile);
      setDialogOpen(false);
      toast.success(
        (data.rowsUpdated ?? 0) > 0
          ? `Client brand saved · ${data.rowsUpdated} matrix row(s) updated`
          : 'Client brand profile saved'
      );
      if (data.domainWarning) {
        toast.message('Domain tip', { description: data.domainWarning });
      }
      if (data.manifestRegenScheduled) {
        toast.message('Domain manifest', {
          description:
            'Draft will refresh in the background. Publish from Settings → Domain Manifest when ready.',
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    if (variant === 'inline') return null;
    return (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-muted-foreground dark:border-zinc-800 dark:bg-zinc-900/50">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading client brand…
      </div>
    );
  }

  if (profile) {
    if (variant === 'inline') return null;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <span className="text-emerald-900 dark:text-emerald-200">
          Tracking brand:{' '}
          <span className="font-semibold">{profile.brandLabel}</span>
          <span className="mx-1.5 text-emerald-700/60 dark:text-emerald-400/60">·</span>
          <span className="text-emerald-800/80 dark:text-emerald-300/80">
            {profile.primaryUrl}
          </span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-emerald-800 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
          onClick={openSetupDialog}
        >
          Edit brand
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-emerald-800 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
          asChild
        >
          <Link href="/settings?tab=aeo-brand">Settings</Link>
        </Button>
        <BrandDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          form={form}
          onFormChange={patch => setForm(prev => ({ ...prev, ...patch }))}
          saving={saving}
          onSubmit={handleSave}
          projectDomain={activeProject?.domain ?? null}
        />
      </div>
    );
  }

  const missingContent =
    variant === 'inline' ? (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1 space-y-2">
            <p>
              Set this project&apos;s client brand before committing prompts. Gap
              analysis and citation tracking use the brand name and website — not
              your workspace name.
            </p>
            <Button
              type="button"
              size="sm"
              className="h-7 bg-amber-600 text-white hover:bg-amber-500"
              onClick={openSetupDialog}
            >
              Configure client brand
            </Button>
          </div>
        </div>
        <BrandDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          form={form}
          onFormChange={patch => setForm(prev => ({ ...prev, ...patch }))}
          saving={saving}
          onSubmit={handleSave}
          projectDomain={activeProject?.domain ?? null}
        />
      </div>
    ) : (
      <>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p>
              No client brand configured for this project. Set brand name and website
              before seeding prompts or running gap analysis.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-7 shrink-0 bg-amber-600 text-white hover:bg-amber-500"
            onClick={openSetupDialog}
          >
            Set up brand
          </Button>
        </div>
        <BrandDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          form={form}
          onFormChange={patch => setForm(prev => ({ ...prev, ...patch }))}
          saving={saving}
          onSubmit={handleSave}
          projectDomain={activeProject?.domain ?? null}
        />
      </>
    );

  return missingContent;
}

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: AeoBrandProfileFormValues;
  onFormChange: (patch: Partial<AeoBrandProfileFormValues>) => void;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  projectDomain?: string | null;
};

function BrandDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  saving,
  onSubmit,
  projectDomain = null,
}: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-200 dark:border-zinc-800 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Client brand profile</DialogTitle>
          <DialogDescription>
            Used for citation matching, gap analysis, and auto-generated articles.
            This is your client&apos;s brand — not your agency workspace name.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <AeoBrandProfileForm
            idPrefix="aeo-banner"
            values={form}
            onChange={onFormChange}
            disabled={saving}
            projectDomain={projectDomain}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save brand'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
