import AppMain from '@/components/layout/AppMain';
import ResearchClient from './ResearchClient';

export const dynamic = 'force-dynamic';

export default function ResearchPage() {
  return (
    <AppMain>
      <div className="min-h-full min-w-0 w-full max-w-full overflow-x-hidden p-4 sm:p-8">
        <ResearchClient />
      </div>
    </AppMain>
  );
}
