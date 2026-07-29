/**
 * Seed brand profiles, gap articles, manifests, and audit entries
 * for all workspace projects so automated QA covers real project rows.
 *
 * Run: npx tsx scripts/seed-qa-manifest-data.ts
 * Safe to re-run — upserts idempotently by project.
 */
import { PrismaClient } from '@prisma/client';
import { buildBrandAliases, serializeBrandProfile } from '../lib/ai-visibility/aeo-brand-profile';
import {
  AUDIT_CATEGORY,
  logBrandProfileAudit,
  logManifestDraftRegeneratedAudit,
  logManifestPublishedAudit,
  SYSTEM_AUDIT_ACTOR,
} from '../lib/audit/brand-manifest-audit';
import {
  publishDomainProfileManifest,
  regenerateDomainProfileDraft,
} from '../lib/domain-profile/regenerate';

const prisma = new PrismaClient();

const SEED_ACTOR = {
  actorName: 'QA Seed',
  actorEmail: 'qa-seed@omglaunch.local',
};

type ProjectSeedSpec = {
  projectId?: string;
  matchName: string;
  domain: string;
  brandLabel: string;
  primaryUrl: string;
  entityType: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  sameAsUrls?: string[];
  extraAliases?: string[];
  articles: Array<{ slug: string; title: string; cluster: string }>;
  /** If true, leave a pending draft after seeding (published stays at initial). */
  pendingDraft?: boolean;
};

const PROJECT_SPECS: ProjectSeedSpec[] = [
  {
    projectId: 'default-workspace',
    matchName: 'Main Project',
    domain: 'demo-client.example.com',
    brandLabel: 'Demo Client Co',
    primaryUrl: 'https://demo-client.example.com',
    entityType: 'Organization',
    contactEmail: 'hello@demo-client.example.com',
    contactPhone: '+60-3-555-0100',
    address: '10 Jalan Demo, Kuala Lumpur, WP 50450',
    sameAsUrls: ['https://www.linkedin.com/company/demo-client-co'],
    extraAliases: ['Demo Client', 'DemoClient'],
    articles: [
      {
        slug: 'demo-client-ai-visibility-guide',
        title: 'AI Visibility Guide for Demo Client Co',
        cluster: 'AI Visibility',
      },
    ],
  },
  {
    matchName: 'Decathlon test',
    domain: 'www.decathlon.my',
    brandLabel: 'Decathlon Malaysia',
    primaryUrl: 'https://www.decathlon.my',
    entityType: 'Organization',
    contactEmail: 'contact@decathlon.my',
    sameAsUrls: [
      'https://www.facebook.com/decathlonmy',
      'https://www.instagram.com/decathlonmy',
    ],
    extraAliases: ['Decathlon MY', 'Decathlon Malaysia'],
    articles: [
      {
        slug: 'decathlon-running-shoes-malaysia',
        title: 'Best Running Shoes in Malaysia — Decathlon Guide',
        cluster: 'Running',
      },
      {
        slug: 'decathlon-cycling-gear-kuala-lumpur',
        title: 'Cycling Gear in Kuala Lumpur — Decathlon Picks',
        cluster: 'Cycling',
      },
    ],
    pendingDraft: true,
  },
];

function minimalGapMetadata(title: string, cluster: string) {
  return {
    title,
    targetEntities: [title.split('—')[0]?.trim() || title],
    cluster,
    geo: { locationId: '2458', label: 'Malaysia' },
    faqSchemas: [
      {
        question: `What is ${title}?`,
        answer: `This article covers ${cluster} topics for the client brand.`,
      },
      {
        question: `Who is this guide for?`,
        answer: 'Shoppers and researchers looking for authoritative brand content.',
      },
    ],
    authoritativeUrls: ['https://www.example.com/reference'],
    keywordTargets: [cluster.toLowerCase(), 'malaysia'],
    aeoBlocks: [{ type: 'summary', content: `Overview of ${title}.` }],
    seoTitle: title.slice(0, 120),
    metaDescription: `Learn about ${cluster} from the client brand.`,
  };
}

function minimalJsonLd(title: string) {
  return {
    article: { '@type': 'Article', headline: title },
    faq: { '@type': 'FAQPage' },
    combined: { '@type': 'Article', headline: title },
  };
}

async function resolveProject(spec: ProjectSeedSpec) {
  if (spec.projectId) {
    const byId = await prisma.project.findUnique({ where: { id: spec.projectId } });
    if (byId) return byId;
  }

  const byName = await prisma.project.findFirst({
    where: { name: spec.matchName },
  });
  if (byName) return byName;

  throw new Error(`Project not found for seed spec: ${spec.matchName}`);
}

async function seedProject(spec: ProjectSeedSpec) {
  const project = await resolveProject(spec);
  const workspaceId = project.workspaceId;

  console.log(`\n→ Seeding "${project.name}" (${project.id})`);

  await prisma.project.update({
    where: { id: project.id },
    data: { domain: spec.domain },
  });

  const brandAliases = buildBrandAliases({
    brandLabel: spec.brandLabel,
    primaryUrl: spec.primaryUrl,
    extraAliases: spec.extraAliases,
  });

  const beforeProfile = await prisma.aeoBrandProfile.findUnique({
    where: { projectId: project.id },
  });

  const brand = await prisma.aeoBrandProfile.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      brandLabel: spec.brandLabel,
      primaryUrl: spec.primaryUrl,
      brandAliases,
      entityType: spec.entityType,
      contactPhone: spec.contactPhone ?? null,
      contactEmail: spec.contactEmail ?? null,
      address: spec.address ?? null,
      sameAsUrls: spec.sameAsUrls ?? [],
      manifestRegenCompletedAt: new Date(),
    },
    update: {
      brandLabel: spec.brandLabel,
      primaryUrl: spec.primaryUrl,
      brandAliases,
      entityType: spec.entityType,
      contactPhone: spec.contactPhone ?? null,
      contactEmail: spec.contactEmail ?? null,
      address: spec.address ?? null,
      sameAsUrls: spec.sameAsUrls ?? [],
      manifestRegenCompletedAt: new Date(),
    },
  });

  await logBrandProfileAudit({
    workspaceId,
    projectId: project.id,
    actor: SEED_ACTOR,
    before: beforeProfile ? serializeBrandProfile(beforeProfile) : null,
    after: serializeBrandProfile(brand),
    source: 'qa_seed',
  });

  for (const article of spec.articles) {
    await prisma.publishedGapArticle.upsert({
      where: {
        projectId_slug: {
          projectId: project.id,
          slug: article.slug,
        },
      },
      create: {
        workspaceId,
        projectId: project.id,
        slug: article.slug,
        title: article.title,
        content: `<p>QA seed article for ${article.title}</p>`,
        metadata: minimalGapMetadata(article.title, article.cluster),
        jsonLd: minimalJsonLd(article.title),
        cluster: article.cluster,
        geoLabel: 'Malaysia',
      },
      update: {
        projectId: project.id,
        title: article.title,
        content: `<p>QA seed article for ${article.title}</p>`,
        metadata: minimalGapMetadata(article.title, article.cluster),
        jsonLd: minimalJsonLd(article.title),
        cluster: article.cluster,
        geoLabel: 'Malaysia',
      },
    });
    console.log(`  · article: ${article.slug}`);
  }

  const regen = await regenerateDomainProfileDraft(project.id, {
    workspaceId,
    actor: SEED_ACTOR,
    source: 'qa_seed',
  });

  await logManifestDraftRegeneratedAudit({
    workspaceId,
    projectId: project.id,
    actor: SEED_ACTOR,
    draftVersion: regen.draftVersion,
    publishedVersion: regen.publishedVersion,
    status: regen.status,
    source: 'qa_seed',
  });

  if (spec.pendingDraft) {
    // First publish baseline, then regen again to create a pending draft.
    await publishDomainProfileManifest(project.id, null, {
      workspaceId,
      actor: SEED_ACTOR,
      source: 'qa_seed',
    });

    await logManifestPublishedAudit({
      workspaceId,
      projectId: project.id,
      actor: SEED_ACTOR,
      publishedVersion: regen.publishedVersion + 1,
      entityType: spec.entityType,
      source: 'qa_seed',
    });

    await prisma.aeoBrandProfile.update({
      where: { projectId: project.id },
      data: { brandLabel: `${spec.brandLabel} (draft bump)` },
    });

    const regen2 = await regenerateDomainProfileDraft(project.id, {
      workspaceId,
      actor: SEED_ACTOR,
      source: 'qa_seed_pending_draft',
    });

    console.log(
      `  · manifest: published v${regen2.publishedVersion}, draft v${regen2.draftVersion}, pending=${regen2.hasPendingDraft}`
    );
  } else {
    await publishDomainProfileManifest(project.id, null, {
      workspaceId,
      actor: SEED_ACTOR,
      source: 'qa_seed',
    });

    await logManifestPublishedAudit({
      workspaceId,
      projectId: project.id,
      actor: SEED_ACTOR,
      publishedVersion: regen.publishedVersion,
      entityType: spec.entityType,
      source: 'qa_seed',
    });

    console.log(`  · manifest: published v${regen.publishedVersion}, no pending draft`);
  }

  console.log(`  · brand: ${spec.brandLabel}`);
}

async function main() {
  console.log('=== Seeding QA manifest data for real projects ===');

  for (const spec of PROJECT_SPECS) {
    await seedProject(spec);
  }

  const summary = await prisma.project.findMany({
    select: {
      name: true,
      domain: true,
      aeoBrandProfile: { select: { brandLabel: true } },
      domainProfileManifest: {
        select: { manifestStatus: true, manifestVersion: true, draftManifestVersion: true },
      },
      _count: { select: { publishedGapArticles: true } },
    },
  });

  console.log('\n=== Seed summary ===');
  for (const row of summary) {
    const m = row.domainProfileManifest;
    console.log(
      `${row.name}: brand=${row.aeoBrandProfile?.brandLabel ?? '—'}, articles=${row._count.publishedGapArticles}, manifest=${m ? `${m.manifestStatus} pub:v${m.manifestVersion} draft:v${m.draftManifestVersion}` : 'none'}`
    );
  }

  const auditCount = await prisma.auditLogEntry.count({
    where: { category: { in: [AUDIT_CATEGORY.BRAND, AUDIT_CATEGORY.MANIFEST] } },
  });
  console.log(`\nAudit entries (brand + manifest): ${auditCount}`);
  console.log('\nRun: npx tsx scripts/qa-manifest-ship-readiness.ts\n');
}

main()
  .catch(error => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
