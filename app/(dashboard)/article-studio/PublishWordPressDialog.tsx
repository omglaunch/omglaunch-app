'use client';

import { useEffect, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Switch } from '@/components/ui/switch';
import {
  loadWordPressCredentials,
  saveWordPressCredentials,
  type WordPressCredentials,
} from '@/lib/wordpress-credentials';

type PublishWordPressDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  content: string;
  disabled?: boolean;
  siloSync?: {
    siloNodeId: string;
    articleStudioHistoryId?: string | null;
  };
};

function showPublishSuccessToast(isLive: boolean, viewUrl: string) {
  const message = isLive
    ? 'Article is live! Click to view.'
    : 'Draft saved successfully. Click to view.';

  toast.success(message, {
    action: {
      label: 'View',
      onClick: () => window.open(viewUrl, '_blank', 'noopener,noreferrer'),
    },
  });
}

export default function PublishWordPressDialog({
  open,
  onOpenChange,
  title,
  content,
  disabled = false,
  siloSync,
}: PublishWordPressDialogProps) {
  const [siteUrl, setSiteUrl] = useState('');
  const [username, setUsername] = useState('');
  const [applicationPassword, setApplicationPassword] = useState('');
  const [publishLive, setPublishLive] = useState(false);
  const [saveCredentials, setSaveCredentials] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const saved = loadWordPressCredentials();
    if (saved) {
      setSiteUrl(saved.siteUrl);
      setUsername(saved.username);
      setApplicationPassword(saved.applicationPassword);
      setSaveCredentials(true);
    }
  }, [open]);

  async function handlePublish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!content.trim()) {
      toast.error('No article content available to publish.');
      return;
    }

    if (!title.trim()) {
      toast.error('Article title is required.');
      return;
    }

    if (!siteUrl.trim() || !username.trim() || !applicationPassword.trim()) {
      toast.error('WordPress site URL, username, and application password are required.');
      return;
    }

    setIsPublishing(true);

    try {
      const response = await fetch('/api/publish-wordpress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          url: siteUrl.trim(),
          username: username.trim(),
          password: applicationPassword,
          publishLive,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String(payload.error)
            : 'WordPress publishing failed. Please try again.';
        throw new Error(message);
      }

      const viewUrl =
        typeof payload === 'object' && payload !== null && 'viewUrl' in payload
          ? String(payload.viewUrl)
          : '';
      const isLive =
        typeof payload === 'object' && payload !== null && 'isLive' in payload
          ? Boolean(payload.isLive)
          : publishLive;

      if (!viewUrl) {
        throw new Error('WordPress publishing returned an invalid response.');
      }

      if (siloSync?.siloNodeId) {
        const wpPostId =
          typeof payload === 'object' && payload !== null && 'id' in payload
            ? Number(payload.id)
            : NaN;

        if (Number.isFinite(wpPostId) && wpPostId > 0) {
          try {
            await fetch(`/api/silo-builder/nodes/${siloSync.siloNodeId}/sync-status`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                wpPostId,
                wpPostStatus: isLive ? 'publish' : 'draft',
                articleStudioHistoryId: siloSync.articleStudioHistoryId ?? null,
              }),
            });
          } catch (syncError) {
            console.error('Failed to sync silo node after WordPress publish:', syncError);
          }
        }
      }

      if (saveCredentials) {
        saveWordPressCredentials({
          siteUrl: siteUrl.trim(),
          username: username.trim(),
          applicationPassword,
        } satisfies WordPressCredentials);
      }

      showPublishSuccessToast(isLive, viewUrl);
      onOpenChange(false);
    } catch (publishError) {
      toast.error(
        publishError instanceof Error
          ? publishError.message
          : 'WordPress publishing failed. Please try again.'
      );
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish to WordPress</DialogTitle>
          <DialogDescription>
            Use your WordPress login username and an Application Password from Users → Profile →
            Application Passwords (not your normal login password). Being logged into wp-admin in
            the browser does not authenticate this API publish.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handlePublish} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wp-site-url">WordPress Site URL</Label>
            <Input
              id="wp-site-url"
              type="url"
              placeholder="https://yourdomain.com"
              value={siteUrl}
              onChange={event => setSiteUrl(event.target.value)}
              disabled={isPublishing || disabled}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wp-username">WordPress Username</Label>
            <Input
              id="wp-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={event => setUsername(event.target.value)}
              disabled={isPublishing || disabled}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wp-app-password">Application Password</Label>
            <Input
              id="wp-app-password"
              type="password"
              autoComplete="current-password"
              placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
              value={applicationPassword}
              onChange={event => setApplicationPassword(event.target.value)}
              disabled={isPublishing || disabled}
              required
            />
            <p className="text-xs text-muted-foreground">
              Generate this in WordPress under Users → Profile → Application Passwords. Regular
              account passwords will fail.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-3">
            <div className="space-y-0.5 pr-4">
              <Label htmlFor="wp-publish-live">Publish Live Immediately</Label>
              <p className="text-xs text-muted-foreground">
                When off, the post is saved as a draft in WordPress.
              </p>
            </div>
            <Switch
              id="wp-publish-live"
              checked={publishLive}
              onCheckedChange={setPublishLive}
              disabled={isPublishing || disabled}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="wp-save-credentials"
              checked={saveCredentials}
              onCheckedChange={checked => setSaveCredentials(checked === true)}
              disabled={isPublishing || disabled}
            />
            <Label htmlFor="wp-save-credentials" className="text-sm font-normal leading-none">
              Save credentials securely in browser
            </Label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPublishing}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPublishing || disabled} className="bg-emerald-600 hover:bg-emerald-500">
              {isPublishing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Publishing…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Publish to WordPress
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
