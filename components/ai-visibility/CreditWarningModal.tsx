'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  creditsEstimate?: number;
};

export default function CreditWarningModal({
  open,
  onOpenChange,
  onConfirm,
  creditsEstimate = 12,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-200 dark:border-zinc-800 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Base Knowledge scan uses credits</DialogTitle>
          <DialogDescription>
            ChatGPT Base Knowledge results are not cached for this filter yet.
            Fetching will consume approximately{' '}
            <span className="font-medium text-foreground">
              {creditsEstimate} credits
            </span>{' '}
            and is excluded from automated cron syncs.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            className="border-zinc-200 dark:border-zinc-800"
            onClick={() => onOpenChange(false)}
          >
            Stay on Live Web
          </Button>
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={onConfirm}
          >
            Use {creditsEstimate} credits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
