'use server';

import { revalidatePath } from 'next/cache';
import { getAuthenticatedSession } from '@/lib/projects/authenticated-workspace';
import { requireWorkspaceId } from '@/lib/projects/tenant-scope';
import { validateProjectDomainChange } from '@/lib/projects/project-domain-update';
import { getPrisma } from '@/lib/prisma';
import {
  ONBOARDING_CREDIT_GRANT,
  ONBOARDING_INDUSTRIES,
} from '@/lib/onboarding/constants';

export type OnboardingState = {
  hasCompletedOnboarding: boolean;
};

export type CompleteOnboardingInput = {
  workspaceName: string;
  targetDomain: string;
  primaryIndustry: string;
};

export type CompleteOnboardingResult =
  | { success: true }
  | { success: false; error: string };

function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

export async function getOnboardingState(): Promise<OnboardingState | null> {
  const session = await getAuthenticatedSession();
  if (!session?.user?.id) {
    return null;
  }

  const user = await getPrisma().user.findUnique({
    where: { id: session.user.id },
    select: { hasCompletedOnboarding: true },
  });

  if (!user) {
    return null;
  }

  return { hasCompletedOnboarding: user.hasCompletedOnboarding };
}

export async function completeOnboarding(
  input: CompleteOnboardingInput
): Promise<CompleteOnboardingResult> {
  const session = await getAuthenticatedSession();
  if (!session?.user?.id) {
    return { success: false, error: 'You must be signed in to continue.' };
  }

  const workspaceName = input.workspaceName.trim();
  const targetDomain = normalizeDomain(input.targetDomain);
  const primaryIndustry = input.primaryIndustry.trim();

  if (!workspaceName) {
    return { success: false, error: 'Workspace name is required.' };
  }

  if (!targetDomain) {
    return { success: false, error: 'Primary target domain is required.' };
  }

  if (!primaryIndustry || !ONBOARDING_INDUSTRIES.includes(primaryIndustry as never)) {
    return { success: false, error: 'Please select a primary industry or niche.' };
  }

  const workspaceId = await requireWorkspaceId();
  const prisma = getPrisma();

  const existingUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { hasCompletedOnboarding: true, credits: true },
  });

  if (!existingUser) {
    return { success: false, error: 'User account not found.' };
  }

  if (existingUser.hasCompletedOnboarding) {
    return { success: true };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.workspaceSettings.upsert({
        where: { workspaceId },
        create: {
          workspaceId,
          name: workspaceName,
          primaryIndustry,
        },
        update: {
          name: workspaceName,
          primaryIndustry,
        },
      });

      await tx.aiConfig.upsert({
        where: { workspaceId },
        create: { workspaceId },
        update: {},
      });

      await tx.integrationConfig.upsert({
        where: { workspaceId },
        create: { workspaceId },
        update: {},
      });

      const existingOwner = await tx.teamMember.findFirst({
        where: { workspaceId, email: session.user.email },
      });

      if (!existingOwner) {
        await tx.teamMember.create({
          data: {
            workspaceId,
            email: session.user.email,
            name: session.user.name,
            role: 'OWNER',
            status: 'active',
            joinedAt: new Date(),
          },
        });
      }

      const existingProject = await tx.project.findFirst({
        where: { workspaceId },
        select: { id: true },
      });

      if (!existingProject) {
        await tx.project.create({
          data: {
            workspaceId,
            name: workspaceName,
            domain: targetDomain,
          },
        });
      } else {
        const domainValidation = await validateProjectDomainChange(
          existingProject.id,
          targetDomain
        );
        if (!domainValidation.ok) {
          throw new Error(domainValidation.error);
        }

        await tx.project.update({
          where: { id: existingProject.id },
          data: {
            name: workspaceName,
            domain: targetDomain,
          },
        });
      }

      await tx.user.update({
        where: { id: session.user.id },
        data: {
          hasCompletedOnboarding: true,
          credits: existingUser.credits + ONBOARDING_CREDIT_GRANT,
        },
      });
    });

    revalidatePath('/dashboard');
    revalidatePath('/settings');

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to complete onboarding.';
    return { success: false, error: message };
  }
}
