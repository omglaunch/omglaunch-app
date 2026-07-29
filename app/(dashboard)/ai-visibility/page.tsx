import AppMain from '@/components/layout/AppMain';
import AiVisibilityClient from './AiVisibilityClient';

export const dynamic = 'force-dynamic';

export default function AiVisibilityPage() {
  return (
    <AppMain>
      <div className="min-h-full min-w-0 w-full max-w-full overflow-x-hidden bg-slate-50 p-4 dark:bg-[#0a0a0a] sm:p-6 lg:p-8">
        <AiVisibilityClient />
      </div>
    </AppMain>
  );
}
