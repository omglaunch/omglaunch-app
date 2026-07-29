'use client';

import { useState, useTransition } from 'react';
import { Upload } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import type { SettingsBundle } from '@/app/actions/settings';
import { updateWorkspaceSettings } from '@/app/actions/settings';
import SettingsSection from '@/components/settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type AgencyTabProps = {
  data: SettingsBundle;
  onRefresh: () => void;
};

export default function AgencyTab({ data, onRefresh }: AgencyTabProps) {
  const [, startTransition] = useTransition();
  const [brandColor, setBrandColor] = useState(data.workspace.brandPrimaryColor);
  const [customDomain, setCustomDomain] = useState(data.workspace.customDomain ?? '');

  function save(partial: Parameters<typeof updateWorkspaceSettings>[0]) {
    startTransition(async () => {
      try {
        await updateWorkspaceSettings(partial);
        toast.success('Agency settings saved');
        onRefresh();
      } catch {
        toast.error('Failed to save agency settings');
      }
    });
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Custom Branding"
        description="Agency white-label for report delivery — logo and colors wrap client data; client brand comes from each project's AEO profile."
      >
        <div className="space-y-2">
          <Label>Custom Report Logo</Label>
          <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted">
            <div className="text-center">
              <Upload className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-2 text-sm text-muted-foreground">
                Drag & drop or click to upload
              </p>
              <p className="text-xs text-muted-foreground">PNG, SVG up to 2MB</p>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand-color">Brand Primary Color</Label>
          <div className="flex items-center gap-3">
            <Input
              id="brand-color"
              type="color"
              value={brandColor}
              onChange={event => setBrandColor(event.target.value)}
              onBlur={() => save({ brandPrimaryColor: brandColor })}
              className="h-10 w-16 cursor-pointer p-1"
            />
            <Input
              value={brandColor}
              onChange={event => setBrandColor(event.target.value)}
              onBlur={() => save({ brandPrimaryColor: brandColor })}
              className="font-mono text-sm"
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Custom Domain (CNAME)"
        description="Map a custom domain for white-label report delivery."
      >
        <div className="space-y-2">
          <Label htmlFor="custom-domain">Domain</Label>
          <Input
            id="custom-domain"
            placeholder="reports.agency.com"
            value={customDomain}
            onChange={event => setCustomDomain(event.target.value)}
            onBlur={() => save({ customDomain: customDomain || null })}
          />
          <p className="text-xs text-muted-foreground">
            Point a CNAME record to <code className="rounded bg-muted px-1">reports.omglaunch.app</code>
          </p>
        </div>
      </SettingsSection>
    </div>
  );
}
