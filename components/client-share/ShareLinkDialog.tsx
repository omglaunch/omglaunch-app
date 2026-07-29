'use client';

import { useState } from 'react';
import { Copy, Link2, Loader2, ShieldOff } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ClientShareReportType } from '@/lib/client-share/types';
import { CLIENT_SHARE_REPORT_LABELS } from '@/lib/client-share/types';

type ShareLinkDialogProps = {
  projectId: string;
  reportType: ClientShareReportType;
  sourceId?: string | number;
  triggerLabel?: string;
  disabled?: boolean;
};

type CreatedShare = {
  id: string;
  shareToken: string;
  shareUrl: string;
  expiresAt: string | null;
};

export default function ShareLinkDialog({
  projectId,
  reportType,
  sourceId,
  triggerLabel = 'Share link',
  disabled = false,
}: ShareLinkDialogProps) {
  const [open, setOpen] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<string>('30');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedShare | null>(null);

  async function handleCreate() {
    setLoading(true);
    try {
      const response = await fetch('/api/client-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          reportType,
          sourceId,
          expiresInDays: expiresInDays === 'never' ? null : Number(expiresInDays),
          password: password.trim() || null,
        }),
      });
      const payload = (await response.json()) as CreatedShare & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to create share link');
      }
      setCreated(payload);
      toast.success('Client share link created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create share link');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!created?.shareUrl) return;
    await navigator.clipboard.writeText(created.shareUrl);
    toast.success('Share link copied');
  }

  async function handleRevoke() {
    if (!created) return;
    setLoading(true);
    try {
      const response = await fetch('/api/client-share', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          shareId: created.id,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to revoke share link');
      }
      toast.success('Share link revoked');
      setCreated(null);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke share link');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setCreated(null);
      setPassword('');
      setExpiresInDays('30');
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={disabled}>
          <Link2 className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share client report link</DialogTitle>
          <DialogDescription>
            Create a read-only link for {CLIENT_SHARE_REPORT_LABELS[reportType]}. Clients can view
            this snapshot without logging in.
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Share URL</Label>
              <div className="flex gap-2">
                <Input value={created.shareUrl} readOnly className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {created.expiresAt ? (
              <p className="text-xs text-muted-foreground">
                Expires {new Date(created.expiresAt).toLocaleString()}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">No expiry set</p>
            )}
            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="destructive" onClick={handleRevoke} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldOff className="mr-2 h-4 w-4" />}
                Revoke link
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Link expiry</Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="never">No expiry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="share-password">Password (optional)</Label>
                <Input
                  id="share-password"
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder="Leave blank for open access"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleCreate} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create share link
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
