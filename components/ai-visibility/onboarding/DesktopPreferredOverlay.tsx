'use client';

import { MonitorSmartphone } from 'lucide-react';
import { Z_INDEX } from '@/lib/ai-visibility/onboarding/z-index';

/**
 * Desktop Preferred warning overlay for viewports <768px —
 * prevents touch-target data corruption on staging edits.
 */
export default function DesktopPreferredOverlay({
  active,
}: {
  active: boolean;
}) {
  if (!active) return null;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-white/90 p-6 backdrop-blur-sm dark:bg-[#0a0a0a]/90"
      style={{ zIndex: Z_INDEX.desktopOverlay }}
    >
      <div className="max-w-sm rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <MonitorSmartphone className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        <h3 className="mt-3 text-lg font-semibold text-foreground">
          Desktop Preferred
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Prompt onboarding uses dense editable rows and precise geo mapping.
          Switch to a desktop viewport (≥768px) to avoid touch-target data
          corruption.
        </p>
      </div>
    </div>
  );
}
