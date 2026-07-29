import AppMain from '@/components/layout/AppMain';
import RevenueRescueClient from './RevenueRescueClient';

export const dynamic = 'force-dynamic';

export default function RevenueRescuePage() {
  return (
    <AppMain>
      <div className="min-h-full min-w-0 w-full max-w-full overflow-x-hidden bg-slate-50 p-4 dark:bg-[#0a0a0a] sm:p-6 lg:p-8">
        <RevenueRescueClient />
      </div>
    </AppMain>
  );
}
