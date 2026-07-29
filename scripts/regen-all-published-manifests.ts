/**
 * Regenerate draft manifests from current brand profiles and publish them.
 * Use after schema/generator upgrades (e.g. structured address, JSON-LD email).
 *
 * Run: npx tsx scripts/regen-all-published-manifests.ts
 */
import { PrismaClient } from '@prisma/client';
import { validateLocalEntityNap } from '../lib/domain-profile/entity-publish-requirements';
import {
  publishDomainProfileManifest,
  regenerateDomainProfileDraft,
} from '../lib/domain-profile/regenerate';
import { normalizeEntityType } from '../lib/ai-visibility/entity-type';

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      workspaceId: true,
      aeoBrandProfile: {
        select: {
          entityType: true,
          contactPhone: true,
          address: true,
        },
      },
      domainProfileManifest: { select: { id: true } },
    },
    orderBy: { name: 'asc' },
  });

  if (projects.length === 0) {
    console.log('No projects found.');
    return;
  }

  console.log(`\n=== Regenerating ${projects.length} project manifest(s) ===\n`);

  let regenCount = 0;
  let publishCount = 0;
  let skipped = 0;

  for (const project of projects) {
    if (!project.aeoBrandProfile || !project.domainProfileManifest) {
      console.log(`- SKIP ${project.name}: missing brand profile or manifest record`);
      skipped += 1;
      continue;
    }

    const entityType = normalizeEntityType(project.aeoBrandProfile.entityType);
    const nap = validateLocalEntityNap({
      entityType,
      contactPhone: project.aeoBrandProfile.contactPhone,
      address: project.aeoBrandProfile.address,
    });

    try {
      const regen = await regenerateDomainProfileDraft(project.id, {
        workspaceId: project.workspaceId,
        source: 'ship_readiness_regen',
      });
      regenCount += 1;
      console.log(
        `- REGEN ${project.name}: draft v${regen.draftVersion}, published v${regen.publishedVersion}`
      );

      if (!nap.ok) {
        console.log(`  · publish skipped — ${nap.message}`);
        skipped += 1;
        continue;
      }

      const published = await publishDomainProfileManifest(project.id, null, {
        workspaceId: project.workspaceId,
        source: 'ship_readiness_publish',
      });
      publishCount += 1;
      console.log(
        `  · published v${published.version} (${published.manifest.name})`
      );
    } catch (error) {
      skipped += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`- ERROR ${project.name}: ${message}`);
    }
  }

  console.log(
    `\nDone. Regenerated: ${regenCount}, Published: ${publishCount}, Skipped/errors: ${skipped}\n`
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
