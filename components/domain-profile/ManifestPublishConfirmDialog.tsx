'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ManifestPublishConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  draftVersion: number;
  publishedVersion: number;
  isFirstPublish: boolean;
  onConfirm: () => void;
};

export default function ManifestPublishConfirmDialog({
  open,
  onOpenChange,
  projectName,
  draftVersion,
  publishedVersion,
  isFirstPublish,
  onConfirm,
}: ManifestPublishConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publish entity profile to client domain?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                This will promote draft v{draftVersion} for <strong>{projectName}</strong> to the
                live manifest served at <code>/.well-known/domain-profile.json</code>
                {isFirstPublish ? ' for the first time' : ` (replacing published v${publishedVersion})`}.
              </p>
              <p>
                Connected webhooks will receive the published JSON. Client-facing PDFs will use this
                published entity name — not unsaved draft edits in the brand profile.
              </p>
              <p className="font-medium text-foreground">
                Double-check brand name, URL, NAP, and entity type before continuing.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={onConfirm}
          >
            Publish to client domain
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
