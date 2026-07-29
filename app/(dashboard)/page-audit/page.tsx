import AppMain from '@/components/layout/AppMain';
import PageAuditClient from './PageAuditClient';

export default function PageAuditPage() {
  return (
    <AppMain>
      <div className="min-h-full w-full min-w-0 max-w-full overflow-x-hidden p-4 sm:p-8">
        <PageAuditClient />
      </div>
    </AppMain>
  );
}
