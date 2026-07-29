import { LEGACY_DEFAULT_SCOPE_ID } from '@/lib/projects/constants';

/** Legacy alias — tool history and hub-spoke scope ids map to project ids. */
export const DEFAULT_WORKSPACE_ID = LEGACY_DEFAULT_SCOPE_ID;

export const LOCAL_MIGRATION_FLAG_PREFIX = 'omg-history-migrated:';

export function localMigrationFlag(tool: string): string {
  return `${LOCAL_MIGRATION_FLAG_PREFIX}${tool}`;
}
