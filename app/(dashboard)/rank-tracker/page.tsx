import AppMain from '@/components/layout/AppMain';
import RankTrackerClient from './RankTrackerClient';

export const dynamic = 'force-dynamic';

export default function RankTrackerPage() {
  return (
    <AppMain>
      <div className="min-h-full p-8">
        <RankTrackerClient />
      </div>
    </AppMain>
  );
}
