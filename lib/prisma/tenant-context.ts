import { AsyncLocalStorage } from 'node:async_hooks';

type TenantContext = {
  workspaceId: string;
};

const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantWorkspaceId(): string | undefined {
  return tenantStorage.getStore()?.workspaceId;
}

export function runWithTenantScope<T>(
  workspaceId: string,
  fn: () => T
): T {
  return tenantStorage.run({ workspaceId }, fn);
}

export async function runWithTenantScopeAsync<T>(
  workspaceId: string,
  fn: () => Promise<T>
): Promise<T> {
  return tenantStorage.run({ workspaceId }, fn);
}
