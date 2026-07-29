'use client';

import { AnalysisProvider } from '@/components/analysis/AnalysisProvider';
import { ProjectProvider } from '@/components/projects/ProjectProvider';
import { TeamAccessProvider } from '@/components/team/TeamAccessProvider';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import QueryProvider from '@/components/providers/QueryProvider';
import GuidedTourOrchestrator from '@/components/tour/GuidedTourOrchestrator';
import { Toaster } from '@/components/ui/sonner';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <ProjectProvider>
          <TeamAccessProvider>
            <AnalysisProvider>
              {/* Toaster before children so it subscribes before page effects fire */}
              <Toaster richColors position="top-right" />
              {children}
              <GuidedTourOrchestrator />
            </AnalysisProvider>
          </TeamAccessProvider>
        </ProjectProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
