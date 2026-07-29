'use client';

import AppHeader from '@/components/layout/AppHeader';

type AppMainProps = {
  children: React.ReactNode;
  className?: string;
  scrollable?: boolean;
};

export default function AppMain({
  children,
  className,
  scrollable = true,
}: AppMainProps) {
  return (
    <main className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
      <AppHeader />
      <div
        className={
          scrollable
            ? `min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto${className ? ` ${className}` : ''}`
            : className ?? 'flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden'
        }
      >
        {children}
      </div>
    </main>
  );
}
