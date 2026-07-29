import { PrismaClient } from '@prisma/client';
import { getTenantWorkspaceId } from '@/lib/prisma/tenant-context';

type WhereInput = Record<string, unknown> | undefined;

function withTenantWhere(where: WhereInput, workspaceId: string): WhereInput {
  if (!where) {
    return { workspaceId };
  }

  if (Object.prototype.hasOwnProperty.call(where, 'workspaceId')) {
    return where;
  }

  return { ...where, workspaceId };
}

function injectTenantWorkspace<T extends { where?: WhereInput }>(
  args: T,
  workspaceId: string
): T {
  return {
    ...args,
    where: withTenantWhere(args.where, workspaceId),
  };
}

function injectTenantCreateData<T extends { data?: Record<string, unknown> }>(
  args: T,
  workspaceId: string
): T {
  if (!args.data || Object.prototype.hasOwnProperty.call(args.data, 'workspaceId')) {
    return args;
  }

  return {
    ...args,
    data: {
      ...args.data,
      workspaceId,
    },
  };
}

type QueryHandlerArgs = {
  args: Record<string, unknown>;
  query: (args: Record<string, unknown>) => Promise<unknown>;
};

function createTenantModelExtension() {
  const scopedOperations = {
    findMany({ args, query }: QueryHandlerArgs) {
      const workspaceId = getTenantWorkspaceId();
      if (workspaceId) {
        return query(injectTenantWorkspace(args, workspaceId));
      }
      return query(args);
    },
    findFirst({ args, query }: QueryHandlerArgs) {
      const workspaceId = getTenantWorkspaceId();
      if (workspaceId) {
        return query(injectTenantWorkspace(args, workspaceId));
      }
      return query(args);
    },
    count({ args, query }: QueryHandlerArgs) {
      const workspaceId = getTenantWorkspaceId();
      if (workspaceId) {
        return query(injectTenantWorkspace(args, workspaceId));
      }
      return query(args);
    },
    updateMany({ args, query }: QueryHandlerArgs) {
      const workspaceId = getTenantWorkspaceId();
      if (workspaceId) {
        return query(injectTenantWorkspace(args, workspaceId));
      }
      return query(args);
    },
    deleteMany({ args, query }: QueryHandlerArgs) {
      const workspaceId = getTenantWorkspaceId();
      if (workspaceId) {
        return query(injectTenantWorkspace(args, workspaceId));
      }
      return query(args);
    },
    create({ args, query }: QueryHandlerArgs) {
      const workspaceId = getTenantWorkspaceId();
      if (workspaceId) {
        return query(injectTenantCreateData(args, workspaceId));
      }
      return query(args);
    },
    createMany({ args, query }: QueryHandlerArgs) {
      const workspaceId = getTenantWorkspaceId();
      if (workspaceId && Array.isArray(args.data)) {
        return query({
          ...args,
          data: args.data.map(item =>
            typeof item === 'object' &&
            item !== null &&
            !Object.prototype.hasOwnProperty.call(item, 'workspaceId')
              ? { ...item, workspaceId }
              : item
          ),
        });
      }
      return query(args);
    },
  };

  return {
    project: scopedOperations,
    savedKeyword: scopedOperations,
    workspaceSettings: scopedOperations,
    aiConfig: scopedOperations,
    teamMember: scopedOperations,
    integrationConfig: scopedOperations,
    auditLogEntry: scopedOperations,
    localAuditHistory: scopedOperations,
    cronSchedule: scopedOperations,
    serviceAreaPageJob: scopedOperations,
    siloProject: scopedOperations,
    clientShareLink: scopedOperations,
  };
}

export function createTenantScopedPrismaClient(baseClient: PrismaClient) {
  return baseClient.$extends({
    query: createTenantModelExtension(),
  });
}

export type TenantScopedPrismaClient = ReturnType<typeof createTenantScopedPrismaClient>;
