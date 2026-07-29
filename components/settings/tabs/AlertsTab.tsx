'use client';

import { useState, useTransition } from 'react';
import { toast } from '@/components/ui/sonner';
import type { SettingsBundle } from '@/app/actions/settings';
import { updateWorkspaceSettings } from '@/app/actions/settings';
import SettingsSection from '@/components/settings/SettingsSection';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type AlertsTabProps = {
  data: SettingsBundle;
  onRefresh: () => void;
};

export default function AlertsTab({ data, onRefresh }: AlertsTabProps) {
  const [, startTransition] = useTransition();
  const [rankDrop, setRankDrop] = useState(String(data.workspace.rankDropThreshold));
  const [cannibalization, setCannibalization] = useState(data.workspace.cannibalizationNotify);
  const [emailDigest, setEmailDigest] = useState(data.workspace.emailDigestWeekly);
  const [pushWebhook, setPushWebhook] = useState(data.workspace.pushToWebhook);

  function save(partial: Parameters<typeof updateWorkspaceSettings>[0]) {
    startTransition(async () => {
      try {
        await updateWorkspaceSettings(partial);
        toast.success('Notification settings saved');
        onRefresh();
      } catch {
        toast.error('Failed to save notification settings');
      }
    });
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Rank Drops"
        description="Get alerted when tracked keywords lose significant positions."
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Alert me if a keyword drops more than</span>
          <Input
            type="number"
            min={1}
            className="w-20"
            value={rankDrop}
            onChange={event => setRankDrop(event.target.value)}
            onBlur={() => save({ rankDropThreshold: Number(rankDrop) || 5 })}
          />
          <span>positions.</span>
        </div>
      </SettingsSection>

      <SettingsSection title="Cannibalization">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Keyword cannibalization alerts</p>
            <p className="text-xs text-muted-foreground">
              Notify when multiple pages rank for the exact same keyword.
            </p>
          </div>
          <Switch
            checked={cannibalization}
            onCheckedChange={checked => {
              setCannibalization(checked);
              save({ cannibalizationNotify: checked });
            }}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Delivery Method">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="email-digest"
              checked={emailDigest}
              onCheckedChange={checked => {
                const value = checked === true;
                setEmailDigest(value);
                save({ emailDigestWeekly: value });
              }}
            />
            <Label htmlFor="email-digest" className="cursor-pointer font-normal">
              Email Digest (Weekly)
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Checkbox
              id="push-webhook"
              checked={pushWebhook}
              onCheckedChange={checked => {
                const value = checked === true;
                setPushWebhook(value);
                save({ pushToWebhook: value });
              }}
            />
            <Label htmlFor="push-webhook" className="cursor-pointer font-normal">
              Push to Webhook
            </Label>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
