'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, CreditCard, Download } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import type { SettingsBundle } from '@/app/actions/settings';
import { deleteWorkspace } from '@/app/actions/settings';
import SettingsSection from '@/components/settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type BillingTabProps = {
  data: SettingsBundle;
};

export default function BillingTab({ data }: BillingTabProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmName, setConfirmName] = useState('');

  function handleExport() {
    toast.info('Export feature coming soon — your workspace data will be available as CSV.');
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteWorkspace(confirmName);
        toast.success('Workspace deleted');
        window.location.href = '/';
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to delete workspace');
      }
    });
  }

  return (
    <div className="space-y-6">
      <SettingsSection title="Subscription">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-5 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-teal-950/30">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{data.workspace.planName}</p>
              <p className="text-sm text-muted-foreground">Full access to all SEO tools</p>
            </div>
          </div>
          <Button variant="outline">Manage Billing</Button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Data Portability"
        description="Export all workspace data for backup or migration."
      >
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" />
          Export Workspace Data (CSV)
        </Button>
      </SettingsSection>

      <section className="rounded-xl border-2 border-red-200 bg-red-50/50 p-6 dark:border-red-900/50 dark:bg-red-950/20">
        <div className="mb-5 flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <h3 className="text-base font-semibold text-red-900 dark:text-red-200">Danger Zone</h3>
            <p className="mt-1 text-sm text-red-700/80 dark:text-red-300/80">
              Permanently delete this workspace and all associated projects, keywords, and settings.
              This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-delete" className="text-red-900 dark:text-red-200">
              Type <strong>{data.workspace.name}</strong> to confirm
            </Label>
            <Input
              id="confirm-delete"
              value={confirmName}
              onChange={event => setConfirmName(event.target.value)}
              placeholder={data.workspace.name}
              className="border-red-200 bg-card dark:border-red-900"
            />
          </div>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending || confirmName.trim() !== data.workspace.name.trim()}
          >
            Delete Workspace
          </Button>
        </div>
      </section>
    </div>
  );
}
