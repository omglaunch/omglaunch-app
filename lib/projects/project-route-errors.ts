import { NextResponse } from 'next/server';
import { isProjectIdRequiredError, isTenantAccessDeniedError } from '@/lib/projects/project-scope';
import { isProjectAccessError } from '@/lib/projects/team-access';

export function handleProjectScopedRouteError(
  error: unknown,
  fallbackMessage: string
): NextResponse {
  if (isProjectAccessError(error)) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  const message = error instanceof Error ? error.message : fallbackMessage;

  if (isProjectIdRequiredError(message)) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (isTenantAccessDeniedError(message)) {
    return NextResponse.json({ error: message }, { status: 404 });
  }

  return NextResponse.json({ error: message }, { status: 500 });
}
