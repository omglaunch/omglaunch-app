import { Suspense } from 'react';
import AppMain from '@/components/layout/AppMain';
import KeywordAuditClient from './KeywordAuditClient';

export const dynamic = 'force-dynamic';

function KeywordAuditFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading keyword audit…</p>
    </div>
  );
}

export default function KeywordAuditPage() {
  return (
    <AppMain>
      <div className="min-h-full p-8">
        <Suspense fallback={<KeywordAuditFallback />}>
          <KeywordAuditClient />
        </Suspense>
      </div>
    </AppMain>
  );
}
