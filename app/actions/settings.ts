'use server';

import { getAuthenticatedSession } from '@/lib/projects/authenticated-workspace';
import {
  assertWorkspaceWriteAccess,
  filterProjectsForAccess,
  resolveTeamAccess,
} from '@/lib/projects/team-access';
import {
  requireWorkspaceId,
  runWithAuthenticatedTenantScope,
} from '@/lib/projects/tenant-scope';
import { getPrisma } from '@/lib/prisma';
import { maskSecret, resolveSecretUpdate } from '@/lib/settings/secrets';
import type { TeamRole } from '@/lib/settings/constants';
import { revalidatePath } from 'next/cache';

export type SecretField = { masked: string | null; isSet: boolean };

export type SettingsBundle = {
  workspaceId: string;
  user: {
    name: string;
    email: string;
    image: string | null;
  };
  workspace: {
    name: string;
    timezone: string;
    theme: string;
    hideApiCostsFromViewer: boolean;
    hideUsageMetricsFromViewer: boolean;
    defaultCountry: string;
    defaultState: string;
    defaultGoogleDomain: string;
    defaultLanguage: string;
    defaultDevice: string;
    rankDropThreshold: number;
    cannibalizationNotify: boolean;
    emailDigestWeekly: boolean;
    pushToWebhook: boolean;
    reportLogoUrl: string | null;
    brandPrimaryColor: string;
    customDomain: string | null;
    planName: string;
  };
  ai: {
    openai: SecretField;
    anthropic: SecretField;
    gemini: SecretField;
    perplexity: SecretField;
    analysisAiModel: string;
    articleStudioModel: string;
    localDominanceModel: string;
    brandVoice: string;
    costAlertThreshold: number;
  };
  integrations: {
    dataForSeoLogin: string | null;
    dataForSeoPassword: SecretField;
    googleSearchConsoleConnected: boolean;
    googleAnalyticsConnected: boolean;
    googleBusinessProfileConnected: boolean;
    wordpressSiteUrl: string | null;
    wordpressUsername: string | null;
    wordpressAppPassword: SecretField;
    webhookUrls: string[];
  };
  teamMembers: Array<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    status: string;
    assignedProjectIds: string[];
  }>;
  projects: Array<{
    id: string;
    name: string;
    domain: string | null;
  }>;
  auditLog: Array<{
    id: string;
    action: string;
    actorName: string;
    actorEmail: string;
    details: string | null;
    createdAt: string;
  }>;
};

async function ensureDefaultSettings(workspaceId: string, user: { name: string; email: string }) {
  const prisma = getPrisma();

  await prisma.workspaceSettings.upsert({
    where: { workspaceId },
    create: { workspaceId, name: `${user.name}'s Workspace` },
    update: {},
  });

  await prisma.aiConfig.upsert({
    where: { workspaceId },
    create: { workspaceId },
    update: {},
  });

  await prisma.integrationConfig.upsert({
    where: { workspaceId },
    create: { workspaceId },
    update: {},
  });

  const existingOwner = await prisma.teamMember.findFirst({
    where: { workspaceId, email: user.email },
  });

  if (!existingOwner) {
    await prisma.teamMember.create({
      data: {
        workspaceId,
        email: user.email,
        name: user.name,
        role: 'OWNER',
        status: 'active',
        joinedAt: new Date(),
      },
    });
  }
}

function parseAssignedProjectIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

import { parseWebhookUrls } from '@/lib/integrations/webhook-urls';

export async function getSettingsBundle(): Promise<SettingsBundle> {
  return runWithAuthenticatedTenantScope(async () => {
    const session = await getAuthenticatedSession();
    if (!session?.user) {
      throw new Error('Unauthenticated');
    }

    const workspaceId = await requireWorkspaceId();
    const user = session.user;

    await ensureDefaultSettings(workspaceId, {
      name: user.name,
      email: user.email,
    });

    const prisma = getPrisma();
    const access = await resolveTeamAccess();
    const isViewer = !access.isWorkspaceOwner && access.role === 'VIEWER';

    const [workspace, ai, integrations, teamMembers, auditLog, projects] = await Promise.all([
      prisma.workspaceSettings.findFirstOrThrow({ where: { workspaceId } }),
      isViewer
        ? Promise.resolve(null)
        : prisma.aiConfig.findFirstOrThrow({ where: { workspaceId } }),
      isViewer
        ? Promise.resolve(null)
        : prisma.integrationConfig.findFirstOrThrow({ where: { workspaceId } }),
      isViewer
        ? Promise.resolve([])
        : prisma.teamMember.findMany({
            where: { workspaceId, status: 'active' },
            orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
          }),
      isViewer
        ? Promise.resolve([])
        : prisma.auditLogEntry.findMany({
            where: { workspaceId },
            orderBy: { createdAt: 'desc' },
            take: 10,
          }),
      prisma.project.findMany({
        where: { workspaceId },
        select: { id: true, name: true, domain: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const filteredProjects = await filterProjectsForAccess(projects);

    if (isViewer) {
      return {
        workspaceId,
        user: {
          name: user.name,
          email: user.email,
          image: user.image ?? null,
        },
        workspace: {
          name: workspace.name,
          timezone: workspace.timezone,
          theme: workspace.theme,
          hideApiCostsFromViewer: workspace.hideApiCostsFromViewer,
          hideUsageMetricsFromViewer: workspace.hideUsageMetricsFromViewer,
          defaultCountry: workspace.defaultCountry,
          defaultState: workspace.defaultState,
          defaultGoogleDomain: workspace.defaultGoogleDomain,
          defaultLanguage: workspace.defaultLanguage,
          defaultDevice: workspace.defaultDevice,
          rankDropThreshold: workspace.rankDropThreshold,
          cannibalizationNotify: workspace.cannibalizationNotify,
          emailDigestWeekly: workspace.emailDigestWeekly,
          pushToWebhook: workspace.pushToWebhook,
          reportLogoUrl: workspace.reportLogoUrl,
          brandPrimaryColor: workspace.brandPrimaryColor,
          customDomain: workspace.customDomain,
          planName: workspace.planName,
        },
        ai: {
          openai: { masked: null, isSet: false },
          anthropic: { masked: null, isSet: false },
          gemini: { masked: null, isSet: false },
          perplexity: { masked: null, isSet: false },
          analysisAiModel: '',
          articleStudioModel: '',
          localDominanceModel: '',
          brandVoice: '',
          costAlertThreshold: 0,
        },
        integrations: {
          dataForSeoLogin: null,
          dataForSeoPassword: { masked: null, isSet: false },
          googleSearchConsoleConnected: false,
          googleAnalyticsConnected: false,
          googleBusinessProfileConnected: false,
          wordpressSiteUrl: null,
          wordpressUsername: null,
          wordpressAppPassword: { masked: null, isSet: false },
          webhookUrls: [],
        },
        teamMembers: [],
        projects: filteredProjects,
        auditLog: [],
      };
    }

    if (!ai || !integrations) {
      throw new Error('Workspace configuration missing.');
    }

    return {
      workspaceId,
      user: {
        name: user.name,
        email: user.email,
        image: user.image ?? null,
      },
      workspace: {
        name: workspace.name,
        timezone: workspace.timezone,
        theme: workspace.theme,
        hideApiCostsFromViewer: workspace.hideApiCostsFromViewer,
        hideUsageMetricsFromViewer: workspace.hideUsageMetricsFromViewer,
        defaultCountry: workspace.defaultCountry,
        defaultState: workspace.defaultState,
        defaultGoogleDomain: workspace.defaultGoogleDomain,
        defaultLanguage: workspace.defaultLanguage,
        defaultDevice: workspace.defaultDevice,
        rankDropThreshold: workspace.rankDropThreshold,
        cannibalizationNotify: workspace.cannibalizationNotify,
        emailDigestWeekly: workspace.emailDigestWeekly,
        pushToWebhook: workspace.pushToWebhook,
        reportLogoUrl: workspace.reportLogoUrl,
        brandPrimaryColor: workspace.brandPrimaryColor,
        customDomain: workspace.customDomain,
        planName: workspace.planName,
      },
      ai: {
        openai: maskSecret(ai.openaiApiKey),
        anthropic: maskSecret(ai.anthropicApiKey),
        gemini: maskSecret(ai.geminiApiKey),
        perplexity: maskSecret(ai.perplexityApiKey),
        analysisAiModel: ai.analysisAiModel,
        articleStudioModel: ai.articleStudioModel,
        localDominanceModel: ai.localDominanceModel,
        brandVoice: ai.brandVoice,
        costAlertThreshold: ai.costAlertThreshold,
      },
      integrations: {
        dataForSeoLogin: integrations.dataForSeoLogin,
        dataForSeoPassword: maskSecret(integrations.dataForSeoPassword),
        googleSearchConsoleConnected: integrations.googleSearchConsoleConnected,
        googleAnalyticsConnected: integrations.googleAnalyticsConnected,
        googleBusinessProfileConnected: integrations.googleBusinessProfileConnected,
        wordpressSiteUrl: integrations.wordpressSiteUrl,
        wordpressUsername: integrations.wordpressUsername,
        wordpressAppPassword: maskSecret(integrations.wordpressAppPassword),
        webhookUrls: parseWebhookUrls(integrations.webhookUrls),
      },
      teamMembers: teamMembers.map(member => ({
        id: member.id,
        email: member.email,
        name: member.name,
        role: member.role,
        status: member.status,
        assignedProjectIds: parseAssignedProjectIds(member.assignedProjectIds),
      })),
      projects: filteredProjects.map(project => ({
        id: project.id,
        name: project.name,
        domain: project.domain,
      })),
      auditLog: auditLog.map(entry => ({
        id: entry.id,
        action: entry.action,
        actorName: entry.actorName,
        actorEmail: entry.actorEmail,
        details: entry.details,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  });
}

export async function updateWorkspaceSettings(input: {
  name?: string;
  timezone?: string;
  theme?: string;
  hideApiCostsFromViewer?: boolean;
  hideUsageMetricsFromViewer?: boolean;
  defaultCountry?: string;
  defaultState?: string;
  defaultGoogleDomain?: string;
  defaultLanguage?: string;
  defaultDevice?: string;
  rankDropThreshold?: number;
  cannibalizationNotify?: boolean;
  emailDigestWeekly?: boolean;
  pushToWebhook?: boolean;
  reportLogoUrl?: string | null;
  brandPrimaryColor?: string;
  customDomain?: string | null;
}) {
  return runWithAuthenticatedTenantScope(async () => {
    await assertWorkspaceWriteAccess();
    const workspaceId = await requireWorkspaceId();
    await getPrisma().workspaceSettings.updateMany({
      where: { workspaceId },
      data: input,
    });
    revalidatePath('/settings');
    return { success: true };
  });
}

export async function updateAiConfig(input: {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  perplexityApiKey?: string;
  analysisAiModel?: string;
  articleStudioModel?: string;
  localDominanceModel?: string;
  brandVoice?: string;
  costAlertThreshold?: number;
}) {
  return runWithAuthenticatedTenantScope(async () => {
    await assertWorkspaceWriteAccess();
    const workspaceId = await requireWorkspaceId();
    const prisma = getPrisma();
    const existing = await prisma.aiConfig.findFirstOrThrow({ where: { workspaceId } });

    const data: Record<string, unknown> = {};
    if (input.analysisAiModel !== undefined) data.analysisAiModel = input.analysisAiModel;
    if (input.articleStudioModel !== undefined) data.articleStudioModel = input.articleStudioModel;
    if (input.localDominanceModel !== undefined) data.localDominanceModel = input.localDominanceModel;
    if (input.brandVoice !== undefined) data.brandVoice = input.brandVoice;
    if (input.costAlertThreshold !== undefined) data.costAlertThreshold = input.costAlertThreshold;

    const openai = resolveSecretUpdate(input.openaiApiKey, existing.openaiApiKey);
    if (openai !== undefined) data.openaiApiKey = openai;
    const anthropic = resolveSecretUpdate(input.anthropicApiKey, existing.anthropicApiKey);
    if (anthropic !== undefined) data.anthropicApiKey = anthropic;
    const gemini = resolveSecretUpdate(input.geminiApiKey, existing.geminiApiKey);
    if (gemini !== undefined) data.geminiApiKey = gemini;
    const perplexity = resolveSecretUpdate(input.perplexityApiKey, existing.perplexityApiKey);
    if (perplexity !== undefined) data.perplexityApiKey = perplexity;

    await prisma.aiConfig.updateMany({ where: { workspaceId }, data });
    revalidatePath('/settings');
    return { success: true };
  });
}

export async function updateIntegrationConfig(input: {
  dataForSeoLogin?: string;
  dataForSeoPassword?: string;
  googleSearchConsoleConnected?: boolean;
  googleAnalyticsConnected?: boolean;
  googleBusinessProfileConnected?: boolean;
  wordpressSiteUrl?: string;
  wordpressUsername?: string;
  wordpressAppPassword?: string;
  webhookUrls?: string[];
}) {
  return runWithAuthenticatedTenantScope(async () => {
    await assertWorkspaceWriteAccess();
    const workspaceId = await requireWorkspaceId();
    const prisma = getPrisma();
    const existing = await prisma.integrationConfig.findFirstOrThrow({ where: { workspaceId } });

    const data: Record<string, unknown> = {};
    if (input.dataForSeoLogin !== undefined) data.dataForSeoLogin = input.dataForSeoLogin || null;
    if (input.googleSearchConsoleConnected !== undefined) {
      data.googleSearchConsoleConnected = input.googleSearchConsoleConnected;
    }
    if (input.googleAnalyticsConnected !== undefined) {
      data.googleAnalyticsConnected = input.googleAnalyticsConnected;
    }
    if (input.googleBusinessProfileConnected !== undefined) {
      data.googleBusinessProfileConnected = input.googleBusinessProfileConnected;
    }
    if (input.wordpressSiteUrl !== undefined) data.wordpressSiteUrl = input.wordpressSiteUrl || null;
    if (input.wordpressUsername !== undefined) {
      data.wordpressUsername = input.wordpressUsername || null;
    }
    if (input.webhookUrls !== undefined) data.webhookUrls = input.webhookUrls;

    const password = resolveSecretUpdate(input.dataForSeoPassword, existing.dataForSeoPassword);
    if (password !== undefined) data.dataForSeoPassword = password;
    const wpPassword = resolveSecretUpdate(
      input.wordpressAppPassword,
      existing.wordpressAppPassword
    );
    if (wpPassword !== undefined) data.wordpressAppPassword = wpPassword;

    await prisma.integrationConfig.updateMany({ where: { workspaceId }, data });
    revalidatePath('/settings');
    return { success: true };
  });
}

export async function updateTeamMemberRole(memberId: string, role: TeamRole) {
  return runWithAuthenticatedTenantScope(async () => {
    await assertWorkspaceWriteAccess();
    const workspaceId = await requireWorkspaceId();
    const result = await getPrisma().teamMember.updateMany({
      where: { id: memberId, workspaceId, role: { not: 'OWNER' } },
      data: role === 'VIEWER' ? { role } : { role, assignedProjectIds: [] },
    });
    if (result.count === 0) {
      throw new Error('Cannot update this team member.');
    }
    revalidatePath('/settings');
    return { success: true };
  });
}

export async function updateTeamMemberProjects(
  memberId: string,
  assignedProjectIds: string[]
) {
  return runWithAuthenticatedTenantScope(async () => {
    await assertWorkspaceWriteAccess();
    const workspaceId = await requireWorkspaceId();
    const prisma = getPrisma();

    const member = await prisma.teamMember.findFirst({
      where: { id: memberId, workspaceId, role: 'VIEWER' },
      select: { id: true },
    });
    if (!member) {
      throw new Error('Project access can only be assigned to Client/Viewer members.');
    }

    const ownedProjects = await prisma.project.findMany({
      where: { workspaceId, id: { in: assignedProjectIds } },
      select: { id: true },
    });
    const validIds = ownedProjects.map(project => project.id);

    await prisma.teamMember.update({
      where: { id: memberId },
      data: { assignedProjectIds: validIds },
    });

    revalidatePath('/settings');
    return { success: true, assignedProjectIds: validIds };
  });
}

export async function inviteTeamMember(
  email: string,
  role: TeamRole,
  assignedProjectIds: string[] = []
) {
  return runWithAuthenticatedTenantScope(async () => {
    await assertWorkspaceWriteAccess();
    const workspaceId = await requireWorkspaceId();
    const session = await getAuthenticatedSession();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) throw new Error('Email is required');

    let projectIds: string[] = [];
    if (role === 'VIEWER') {
      if (assignedProjectIds.length === 0) {
        throw new Error('Assign at least one client project for Client/Viewer access.');
      }
      const ownedProjects = await getPrisma().project.findMany({
        where: { workspaceId, id: { in: assignedProjectIds } },
        select: { id: true },
      });
      projectIds = ownedProjects.map(project => project.id);
      if (projectIds.length === 0) {
        throw new Error('Selected client projects were not found.');
      }
    }

    await getPrisma().teamMember.upsert({
      where: { workspaceId_email: { workspaceId, email: normalizedEmail } },
      create: {
        workspaceId,
        email: normalizedEmail,
        role,
        status: 'invited',
        invitedAt: new Date(),
        assignedProjectIds: projectIds,
      },
      update: {
        role,
        status: 'invited',
        invitedAt: new Date(),
        assignedProjectIds: role === 'VIEWER' ? projectIds : [],
      },
    });

    if (session?.user) {
      await getPrisma().auditLogEntry.create({
        data: {
          workspaceId,
          category: 'team',
          action: 'Member Invited',
          actorName: session.user.name,
          actorEmail: session.user.email,
          details: `Invited ${normalizedEmail} as ${role}`,
        },
      });
    }

    revalidatePath('/settings');
    return { success: true };
  });
}

export async function deleteWorkspace(confirmationName: string): Promise<{ success: boolean }> {
  return runWithAuthenticatedTenantScope(async () => {
    await assertWorkspaceWriteAccess();
    const workspaceId = await requireWorkspaceId();
    const workspace = await getPrisma().workspaceSettings.findFirstOrThrow({
      where: { workspaceId },
    });

    if (confirmationName.trim() !== workspace.name.trim()) {
      throw new Error('Workspace name does not match.');
    }

    const prisma = getPrisma();
    await prisma.$transaction([
      prisma.auditLogEntry.deleteMany({ where: { workspaceId } }),
      prisma.teamMember.deleteMany({ where: { workspaceId } }),
      prisma.integrationConfig.deleteMany({ where: { workspaceId } }),
      prisma.aiConfig.deleteMany({ where: { workspaceId } }),
      prisma.workspaceSettings.deleteMany({ where: { workspaceId } }),
      prisma.savedKeyword.deleteMany({ where: { workspaceId } }),
      prisma.project.deleteMany({ where: { workspaceId } }),
    ]);

    revalidatePath('/settings');
    return { success: true };
  });
}
