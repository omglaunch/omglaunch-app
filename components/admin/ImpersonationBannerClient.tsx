'use client';

import { exitImpersonation } from '@/app/actions/admin';
import { Button } from '@/components/ui/button';
import { useTransition } from 'react';

interface ImpersonationBannerClientProps {
  email: string;
}

export default function ImpersonationBannerClient({ email }: ImpersonationBannerClientProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="fixed left-0 right-0 top-0 z-[9999] flex animate-pulse items-center justify-between bg-amber-600 px-4 py-2 text-sm font-medium text-white">
      <span>Impersonating: {email}</span>
      <Button
        variant="secondary"
        size="sm"
        disabled={isPending}
        onClick={() => startTransition(() => exitImpersonation())}
        className="bg-white text-amber-900 hover:bg-amber-50"
      >
        Exit & Return to Admin UI
      </Button>
    </div>
  );
}
