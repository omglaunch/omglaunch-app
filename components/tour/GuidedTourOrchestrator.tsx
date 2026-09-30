'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  advanceGuidedTourToHubSpoke,
  completeGuidedTour,
  useTourState,
} from '@/hooks/useTourState';
import {
  runDashboardTourPhase,
  runHubSpokeTourPhase,
} from '@/lib/tour/guided-mission';

export default function GuidedTourOrchestrator() {
  const pathname = usePathname();
  const router = useRouter();
  const { hasSeenTour, isTourActive, tourPhase } = useTourState();
  const runningPhaseRef = useRef<string | null>(null);

  useEffect(() => {
    if (hasSeenTour || !isTourActive || !tourPhase) {
      runningPhaseRef.current = null;
      return;
    }

    const phaseKey = `${tourPhase}:${pathname}`;
    if (runningPhaseRef.current === phaseKey) {
      return;
    }

    if (tourPhase === 'dashboard' && pathname.startsWith('/hub-and-spoke')) {
      if (runningPhaseRef.current !== 'sync-hub-phase') {
        runningPhaseRef.current = 'sync-hub-phase';
        advanceGuidedTourToHubSpoke();
      }
      return;
    }

    if (tourPhase === 'dashboard' && pathname.startsWith('/dashboard')) {
      runningPhaseRef.current = phaseKey;

      const timer = window.setTimeout(() => {
        void runDashboardTourPhase(() => {
          runningPhaseRef.current = null;
          advanceGuidedTourToHubSpoke();
          router.push('/hub-and-spoke');
        }).catch(() => {
          runningPhaseRef.current = null;
        });
      }, 600);

      return () => {
        window.clearTimeout(timer);
      };
    }

    if (tourPhase === 'hub-spoke' && pathname.startsWith('/hub-and-spoke')) {
      runningPhaseRef.current = phaseKey;

      const timer = window.setTimeout(() => {
        void runHubSpokeTourPhase(() => {
          runningPhaseRef.current = null;
          completeGuidedTour();
        }).catch(() => {
          runningPhaseRef.current = null;
        });
      }, 600);

      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [hasSeenTour, isTourActive, tourPhase, pathname, router]);

  return null;
}
