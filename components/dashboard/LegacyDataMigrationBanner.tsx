'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

type LegacyDataMigrationBannerProps = {
  initialVisible: boolean;
};

export default function LegacyDataMigrationBanner({
  initialVisible,
}: LegacyDataMigrationBannerProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(initialVisible);
  const [isMigrating, setIsMigrating] = useState(false);

  if (!visible) {
    return null;
  }

  async function handleMigrate() {
    setIsMigrating(true);

    try {
      const response = await fetch('/api/admin/migrate-data', { method: 'POST' });
      const payload = (await response.json()) as {
        success?: boolean;
        total?: number;
        error?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Migration failed');
      }

      toast.success(
        payload.total
          ? `Migrated ${payload.total} record${payload.total === 1 ? '' : 's'} to your account.`
          : 'Migration complete — no legacy records needed updating.'
      );
      setVisible(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Migration failed');
    } finally {
      setIsMigrating(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleMigrate}
      disabled={isMigrating}
      className="mb-6 flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition-colors hover:bg-amber-100 disabled:cursor-wait disabled:opacity-80 dark:border-amber-900/50 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
    >
      {isMigrating ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-600" />
      ) : (
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
      )}
      <span className="text-sm text-amber-950 dark:text-amber-100">
        {isMigrating ? (
          'Migrating…'
        ) : (
          <>
            <strong>Local Data Detected:</strong> Click here to migrate your local tracking
            projects to your Google Account.
          </>
        )}
      </span>
    </button>
  );
}
