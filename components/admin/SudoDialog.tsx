'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { verifySudoMode } from '@/app/actions/admin';
import { toast } from '@/components/ui/sonner';

interface SudoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  title?: string;
  description?: string;
}

export default function SudoDialog({
  open,
  onOpenChange,
  onVerified,
  title = 'Confirm Identity',
  description = 'Re-enter your admin password to access sensitive operations.',
}: SudoDialogProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await verifySudoMode(password);
    setLoading(false);

    if (result.success) {
      toast.success('Identity verified');
      setPassword('');
      onOpenChange(false);
      onVerified();
    } else {
      toast.error(result.error ?? 'Verification failed');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sudo-password">Admin Password</Label>
              <Input
                id="sudo-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !password.trim()}>
              {loading ? 'Verifying…' : 'Verify'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
