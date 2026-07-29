import { redirect } from 'next/navigation';
import { ProjectAccessError, resolveTeamAccess } from '@/lib/projects/team-access';

/** Default landing when a viewer hits a staff-only page. */
export const VIEWER_DEFAULT_PATH = '/rank-tracker';

const VIEWER_ALLOWED_EXACT = new Set([
  '/dashboard',
  '/rank-tracker',
  '/ai-visibility',
  '/settings',
]);

const VIEWER_ALLOWED_PREFIXES = [
  '/dashboard/local-dominance',
  '/rank-tracker/',
  '/ai-visibility/',
];

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split('?')[0]?.split('#')[0] ?? pathname;
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery || '/';
}

/** Whether a dashboard page path is accessible to Client/Viewer accounts. */
export function isViewerAllowedPage(pathname: string): boolean {
  const normalized = normalizePathname(pathname);

  if (VIEWER_ALLOWED_EXACT.has(normalized)) {
    return true;
  }

  for (const prefix of VIEWER_ALLOWED_PREFIXES) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return true;
    }
  }

  return false;
}

/**
 * Server-side guard for dashboard routes. Redirects viewers away from staff-only pages.
 * Call from the dashboard layout with the request pathname (via middleware header).
 */
export async function enforceViewerPageAccess(pathname: string): Promise<void> {
  if (pathname && isViewerAllowedPage(pathname)) {
    return;
  }

  try {
    const access = await resolveTeamAccess();
    const isViewer = !access.isWorkspaceOwner && access.role === 'VIEWER';
    // Fail closed: missing pathname or staff-only path → redirect viewers.
    if (isViewer) {
      redirect(VIEWER_DEFAULT_PATH);
    }
  } catch (error) {
    if (error instanceof ProjectAccessError && error.message === 'Unauthenticated') {
      redirect('/');
    }
    throw error;
  }
}
