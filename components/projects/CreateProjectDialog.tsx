'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useProject } from '@/components/projects/ProjectProvider';
import { upsertAeoBrandProfile } from '@/app/actions/aeo-brand-profile';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AeoBrandProfileForm, {
  EMPTY_AEO_BRAND_FORM,
  type AeoBrandProfileFormValues,
} from '@/components/ai-visibility/AeoBrandProfileForm';
import { parseExtraAliasesInput, parseSameAsUrlsInput } from '@/lib/ai-visibility/aeo-brand-profile';
import type { KeywordManagerProject } from '@/app/actions/keyword-manager';

type CreateProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: KeywordManagerProject) => void;
};

export default function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateProjectDialogProps) {
  const { addProject } = useProject();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [brandForm, setBrandForm] = useState<AeoBrandProfileFormValues>(EMPTY_AEO_BRAND_FORM);

  useEffect(() => {
    if (!brandForm.brandLabel.trim() && name.trim()) {
      setBrandForm(prev => ({ ...prev, brandLabel: name.trim() }));
    }
  }, [name, brandForm.brandLabel]);

  useEffect(() => {
    const trimmedDomain = domain.trim();
    if (!trimmedDomain || brandForm.primaryUrl.trim()) return;
    const normalized = /^https?:\/\//i.test(trimmedDomain)
      ? trimmedDomain
      : `https://${trimmedDomain}`;
    setBrandForm(prev => ({ ...prev, primaryUrl: normalized }));
  }, [domain, brandForm.primaryUrl]);

  function resetForm() {
    setName('');
    setDomain('');
    setBrandForm(EMPTY_AEO_BRAND_FORM);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Project name is required.');
      return;
    }

    const trimmedBrand = brandForm.brandLabel.trim() || trimmedName;
    const trimmedUrl = brandForm.primaryUrl.trim();
    if (!trimmedUrl) {
      toast.error('Client website URL is required for AI visibility tracking.');
      return;
    }

    setIsSubmitting(true);
    try {
      const project = await addProject(trimmedName, domain.trim() || undefined);

      const aliases = parseExtraAliasesInput(brandForm.extraAliases);
      const sameAsUrls = parseSameAsUrlsInput(brandForm.sameAsUrls);

      await upsertAeoBrandProfile(project.id, {
        brandLabel: trimmedBrand,
        primaryUrl: trimmedUrl,
        brandAliases: aliases.length ? aliases : undefined,
        entityType: brandForm.entityType,
        contactPhone: brandForm.contactPhone,
        contactEmail: brandForm.contactEmail,
        address: brandForm.address,
        sameAsUrls,
      });

      onCreated?.(project);
      handleOpenChange(false);
      toast.success('Project and client brand profile created');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create project';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Add a client project with brand details for keyword tracking and AI visibility. Use
            the client&apos;s brand name — not your agency workspace name.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="e.g. Seattle HVAC Pros"
              required
            />
            <p className="text-xs text-muted-foreground">
              Internal label for this client in your workspace. Prefer the client brand name over
              your agency name.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-domain">Target Domain</Label>
            <Input
              id="project-domain"
              value={domain}
              onChange={event => setDomain(event.target.value)}
              placeholder="e.g. seattlehvacpros.com"
            />
            <p className="text-xs text-muted-foreground">
              The client&apos;s website domain. Must align with the primary URL below for
              citation matching.
            </p>
          </div>

          <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              AEO client brand
            </p>
            <p className="text-xs text-muted-foreground">
              This is your client&apos;s brand — not your agency workspace name. It appears on
              reports, exports, and the public entity manifest.
            </p>
            <AeoBrandProfileForm
              idPrefix="create-project-brand"
              values={brandForm}
              onChange={patch => setBrandForm(prev => ({ ...prev, ...patch }))}
              disabled={isSubmitting}
              projectDomain={domain.trim() || null}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
