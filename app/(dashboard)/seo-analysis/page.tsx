import AppMain from '@/components/layout/AppMain';
import SeoAnalysisClient from './SeoAnalysisClient';

export const dynamic = 'force-dynamic';

export default function SeoAnalysisPage() {
  return (
    <AppMain>
      <div className="min-h-full min-w-0 max-w-full overflow-x-hidden p-4 sm:p-6 lg:p-8">
        <SeoAnalysisClient />
      </div>
    </AppMain>
  );
}
