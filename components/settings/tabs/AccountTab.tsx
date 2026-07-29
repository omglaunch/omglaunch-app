'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from '@/components/ui/sonner';
import { useTheme } from 'next-themes';
import type { SettingsBundle } from '@/app/actions/settings';
import { updateWorkspaceSettings } from '@/app/actions/settings';
import SettingsSection from '@/components/settings/SettingsSection';
import ProfileAvatarUpload from '@/components/settings/ProfileAvatarUpload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TIMEZONES } from '@/lib/settings/constants';

type AccountTabProps = {
  data: SettingsBundle;
  onRefresh: () => void;
};

export default function AccountTab({ data, onRefresh }: AccountTabProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();
  const [workspaceName, setWorkspaceName] = useState(data.workspace.name);
  const [timezone, setTimezone] = useState(data.workspace.timezone);
  const [hideApiCosts, setHideApiCosts] = useState(data.workspace.hideApiCostsFromViewer);
  const [hideUsage, setHideUsage] = useState(data.workspace.hideUsageMetricsFromViewer);

  useEffect(() => {
    setMounted(true);
  }, []);

  function saveWorkspace(partial?: Parameters<typeof updateWorkspaceSettings>[0]) {
    startTransition(async () => {
      try {
        await updateWorkspaceSettings({
          name: workspaceName,
          timezone,
          hideApiCostsFromViewer: hideApiCosts,
          hideUsageMetricsFromViewer: hideUsage,
          ...partial,
        });
        toast.success('Settings saved');
        onRefresh();
      } catch {
        toast.error('Failed to save settings');
      }
    });
  }

  function handleThemeChange(value: string) {
    setTheme(value);
    startTransition(() => {
      void updateWorkspaceSettings({ theme: value }).catch(() => {
        toast.error('Failed to save theme preference');
      });
    });
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="My Profile"
        description="Update how you appear across OMG Launch."
      >
        <ProfileAvatarUpload
          name={data.user.name}
          email={data.user.email}
          initialImage={data.user.image}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input value={data.user.name} readOnly className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={data.user.email} readOnly className="bg-muted" />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Workspace Info"
        description="Your workspace is isolated by tenant ID for secure multi-tenant data access."
      >
        <div className="space-y-2">
          <Label>Workspace ID</Label>
          <Input value={data.workspaceId} readOnly className="bg-muted font-mono text-xs" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace Name</Label>
            <Input
              id="workspace-name"
              value={workspaceName}
              onChange={event => setWorkspaceName(event.target.value)}
              onBlur={() => saveWorkspace()}
            />
          </div>
          <div className="space-y-2">
            <Label>Workspace Timezone</Label>
            <Select
              value={timezone}
              onValueChange={value => {
                setTimezone(value);
                saveWorkspace({ timezone: value });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="UI Preferences">
        <div className="space-y-2">
          <Label>Theme</Label>
          <Select
            value={mounted ? (theme ?? 'system') : 'system'}
            onValueChange={handleThemeChange}
          >
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Client access"
        description="Client access is via exported reports and share links; team invites aren't available yet. Share links from Rank Tracker, AI Visibility, and Page Audit create read-only client snapshots."
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Hide API costs</p>
            <p className="text-xs text-muted-foreground">Mask custom API token spend from viewers.</p>
          </div>
          <Switch
            checked={hideApiCosts}
            onCheckedChange={checked => {
              setHideApiCosts(checked);
              saveWorkspace({ hideApiCostsFromViewer: checked });
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Hide usage metrics</p>
            <p className="text-xs text-muted-foreground">Hide token usage charts from viewers.</p>
          </div>
          <Switch
            checked={hideUsage}
            onCheckedChange={checked => {
              setHideUsage(checked);
              saveWorkspace({ hideUsageMetricsFromViewer: checked });
            }}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Audit Log" description="Recent workspace activity (read-only).">
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.auditLog.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No activity recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                data.auditLog.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.action}</TableCell>
                    <TableCell>
                      <div className="text-sm">{entry.actorName}</div>
                      <div className="text-xs text-muted-foreground">{entry.actorEmail}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.details ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SettingsSection>
    </div>
  );
}
