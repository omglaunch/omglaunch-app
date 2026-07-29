import AppMain from '@/components/layout/AppMain';
import SuggestedKeywordsClient from './SuggestedKeywordsClient';

export const dynamic = 'force-dynamic';

export default function SuggestedKeywordsPage() {
  return (
    <AppMain>
      <div className="min-h-full p-8">
        <SuggestedKeywordsClient />
      </div>
    </AppMain>
  );
}
