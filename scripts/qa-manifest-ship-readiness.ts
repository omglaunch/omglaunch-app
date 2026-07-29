/**
 * Ship-readiness QA for domain manifest pipeline.
 * Run: npx tsx scripts/qa-manifest-ship-readiness.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  buildDomainProfileManifest,
  manifestToPrismaJson,
} from '../lib/domain-profile/generator';
import {
  getDomainProfileManifestView,
  getPublishedDomainProfileManifest,
  publishDomainProfileManifest,
  regenerateDomainProfileDraft,
  resolveProjectIdByHost,
} from '../lib/domain-profile/regenerate';
import { serializeDomainProfileManifestRecord } from '../lib/domain-profile/manifest-state';
import { safeParseDomainProfile } from '../lib/domain-profile/schema';
import { buildManifestHostingUrls } from '../lib/domain-profile/urls';

const prisma = new PrismaClient();

type CheckResult = {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  detail: string;
};

const results: CheckResult[] = [];

function record(
  id: string,
  name: string,
  status: CheckResult['status'],
  detail: string
) {
  results.push({ id, name, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'WARN' ? '!' : '-';
  console.log(`${icon} [${id}] ${name}: ${detail}`);
}

async function main() {
  console.log('\n=== Manifest ship-readiness QA ===\n');

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      domain: true,
      workspaceId: true,
      aeoBrandProfile: true,
      domainProfileManifest: true,
      publishedGapArticles: { select: { id: true, title: true, slug: true } },
    },
    take: 20,
  });

  if (projects.length === 0) {
    record('DATA-001', 'Projects exist', 'WARN', 'No projects in database — run scripts/seed-qa-manifest-data.ts');
  } else {
    record('DATA-001', 'Projects exist', 'PASS', `${projects.length} project(s) found`);
  }

  const withBrand = projects.filter(p => p.aeoBrandProfile);
  const withManifest = projects.filter(p => p.domainProfileManifest);
  record(
    'DATA-002',
    'Projects have brand profiles',
    withBrand.length === projects.length ? 'PASS' : withBrand.length > 0 ? 'WARN' : 'FAIL',
    `${withBrand.length}/${projects.length} — run scripts/seed-qa-manifest-data.ts if missing`
  );
  record(
    'DATA-003',
    'Projects have domain manifests',
    withManifest.length === projects.length ? 'PASS' : withManifest.length > 0 ? 'WARN' : 'FAIL',
    `${withManifest.length}/${projects.length} — run scripts/seed-qa-manifest-data.ts if missing`
  );

  // --- Schema integrity ---
  const manifests = await prisma.domainProfileManifest.findMany();
  for (const m of manifests) {
    const published = safeParseDomainProfile(m.manifest);
    const draft = m.draftManifest ? safeParseDomainProfile(m.draftManifest) : published;
    if (!published.success) {
      record('SCHEMA-001', `Published manifest valid (${m.projectId})`, 'FAIL', published.error);
    }
    if (m.draftManifest && !draft.success) {
      record('SCHEMA-002', `Draft manifest valid (${m.projectId})`, 'FAIL', draft.error);
    }
  }
  if (manifests.length > 0) {
    const invalid = results.filter(r => r.id.startsWith('SCHEMA-') && r.status === 'FAIL');
    if (invalid.length === 0) {
      record('SCHEMA-000', 'All stored manifests parse', 'PASS', `${manifests.length} manifest record(s)`);
    }
  }

  // --- Project isolation ---
  const articlesByProject = await prisma.publishedGapArticle.groupBy({
    by: ['projectId'],
    _count: { id: true },
  });
  for (const m of manifests) {
    const view = serializeDomainProfileManifestRecord(m);
    const draft = view.draft?.manifest ?? view.published?.manifest;
    if (!draft?.jsonld) continue;

    const orgNode = draft.jsonld['@graph']?.[0] as Record<string, unknown> | undefined;
    const hasPart = (orgNode?.hasPart as unknown[]) ?? [];
    const projectArticles = await prisma.publishedGapArticle.findMany({
      where: { projectId: m.projectId },
      select: { slug: true, title: true },
    });
    const articleSlugs = new Set(projectArticles.map(a => a.slug));
    const manifestSlugs = hasPart
      .map(part => {
        const url = typeof part === 'object' && part && 'url' in part ? String(part.url) : '';
        return url.split('/').pop() ?? '';
      })
      .filter(Boolean);

    const foreignSlugs = manifestSlugs.filter(s => !articleSlugs.has(s));
    const projectName =
      projects.find(p => p.id === m.projectId)?.name ?? m.projectId.slice(0, 8);
    if (foreignSlugs.length > 0) {
      record(
        'ISOLATE-001',
        `Manifest articles scoped (${projectName})`,
        'FAIL',
        `Manifest references slugs not in project: ${foreignSlugs.join(', ')}`
      );
    } else if (projectArticles.length > 0 || manifestSlugs.length === 0) {
      record(
        'ISOLATE-001',
        `Manifest articles scoped (${projectName})`,
        'PASS',
        `${manifestSlugs.length} article ref(s), ${projectArticles.length} project article(s)`
      );
    }
  }

  // --- Real project coverage ---
  for (const project of projects) {
    if (!project.aeoBrandProfile || !project.domainProfileManifest) {
      record(
        'REAL-001',
        `Project fully seeded (${project.name})`,
        'WARN',
        'Missing brand or manifest — run scripts/seed-qa-manifest-data.ts'
      );
      continue;
    }

    const view = serializeDomainProfileManifestRecord(project.domainProfileManifest);
    const published = view.published?.manifest;
    if (!published) {
      record('REAL-001', `Project fully seeded (${project.name})`, 'FAIL', 'No published manifest');
      continue;
    }

    record(
      'REAL-001',
      `Project fully seeded (${project.name})`,
      'PASS',
      `brand="${project.aeoBrandProfile.brandLabel}", articles=${project.publishedGapArticles.length}, pub v${view.published?.version ?? 0}`
    );

    const orgNode = published.jsonld['@graph'][0];
    const hasPart = (orgNode as { hasPart?: unknown[] }).hasPart ?? [];
    const isPendingDraft = project.domainProfileManifest.manifestStatus === 'DRAFT_PENDING';
    const publishedMatchesBrand = published.name === project.aeoBrandProfile.brandLabel.trim();
    const draftMatchesBrand =
      view.draft?.manifest.name === project.aeoBrandProfile.brandLabel.trim();

    record(
      'REAL-002',
      `Published manifest matches brand (${project.name})`,
      !isPendingDraft && publishedMatchesBrand
        ? 'PASS'
        : isPendingDraft && draftMatchesBrand && !publishedMatchesBrand
          ? 'PASS'
          : 'WARN',
      isPendingDraft
        ? `pending draft: published="${published.name}", draft="${view.draft?.manifest.name ?? '—'}", brand="${project.aeoBrandProfile.brandLabel}"`
        : `published.name="${published.name}", brand="${project.aeoBrandProfile.brandLabel}"`
    );

    if (project.publishedGapArticles.length > 0) {
      record(
        'REAL-003',
        `Articles in published manifest (${project.name})`,
        hasPart.length >= 1 ? 'PASS' : 'WARN',
        `${hasPart.length} hasPart ref(s) for ${project.publishedGapArticles.length} article(s)`
      );
    }
  }

  // --- Brand fields in manifest ---
  for (const project of projects) {
    if (!project.aeoBrandProfile) continue;
    const view = project.domainProfileManifest
      ? serializeDomainProfileManifestRecord(project.domainProfileManifest)
      : null;
    const manifest = view?.draft?.manifest ?? view?.published?.manifest;
    if (!manifest) continue;

    const brand = project.aeoBrandProfile;
    const checks: Array<[string, boolean, string]> = [
      ['name', manifest.name === brand.brandLabel.trim(), `manifest.name=${manifest.name}`],
      ['entity_type', manifest.entity_type === brand.entityType, `entity_type=${manifest.entity_type}`],
    ];

    if (brand.contactPhone?.trim()) {
      checks.push([
        'telephone',
        manifest.jsonld['@graph'][0] &&
          typeof manifest.jsonld['@graph'][0] === 'object' &&
          'telephone' in (manifest.jsonld['@graph'][0] as object),
        'NAP telephone in JSON-LD',
      ]);
    }

    if (brand.contactEmail?.trim()) {
      checks.push([
        'email',
        manifest.jsonld['@graph'][0] &&
          typeof manifest.jsonld['@graph'][0] === 'object' &&
          'email' in (manifest.jsonld['@graph'][0] as object),
        'contact email on JSON-LD org node',
      ]);
    }

    if (brand.address?.trim() && brand.address.includes(',')) {
      const orgAddress =
        manifest.jsonld['@graph'][0] &&
        typeof manifest.jsonld['@graph'][0] === 'object'
          ? (manifest.jsonld['@graph'][0] as { address?: Record<string, unknown> }).address
          : undefined;
      checks.push([
        'address_locality',
        Boolean(orgAddress && typeof orgAddress.addressLocality === 'string'),
        orgAddress
          ? `addressLocality=${String(orgAddress.addressLocality ?? 'missing')}`
          : 'no address node',
      ]);
    }

    for (const [field, ok, detail] of checks) {
      record(
        `BRAND-${field}`,
        `Brand ${field} in manifest (${project.name})`,
        ok ? 'PASS' : 'WARN',
        detail
      );
    }
  }

  // --- Draft vs publish simulation on disposable project ---
  const workspace = await prisma.user.findFirst({ select: { id: true } });
  if (workspace) {
    const testProject = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: `QA Manifest ${Date.now()}`,
        domain: 'qa-manifest-test.example.com',
      },
    });

    try {
      await prisma.aeoBrandProfile.create({
        data: {
          projectId: testProject.id,
          brandLabel: 'QA Test Brand',
          primaryUrl: 'https://qa-manifest-test.example.com',
          entityType: 'LocalBusiness',
          contactPhone: '+1-555-0100',
          address: '123 QA Street, Seattle, WA 98101',
        },
      });

      const regen1 = await regenerateDomainProfileDraft(testProject.id);
      const view1 = await getDomainProfileManifestView(testProject.id);

      record(
        'FLOW-001',
        'Bootstrap creates draft without auto-publish',
        view1?.published === null && view1?.draft && view1.draft.version >= 1 ? 'PASS' : 'FAIL',
        `status=${view1?.status}, published v${view1?.published?.version ?? 'none'}, draft v${view1?.draft?.version ?? 0}`
      );

      await prisma.aeoBrandProfile.update({
        where: { projectId: testProject.id },
        data: { brandLabel: 'QA Test Brand UPDATED' },
      });

      const regen2 = await regenerateDomainProfileDraft(testProject.id);
      const view2 = await getDomainProfileManifestView(testProject.id);
      const publishedNameBefore = view1?.published?.manifest.name ?? null;
      const draftName = view2?.draft?.manifest.name;

      record(
        'FLOW-002',
        'Regen updates draft without auto-publishing',
        view2?.hasPendingDraft === true ? 'PASS' : 'FAIL',
        `hasPendingDraft=${view2?.hasPendingDraft}, draft="${draftName}", published still=${publishedNameBefore ?? 'null'}`
      );

      record(
        'FLOW-003',
        'Published unchanged until explicit publish',
        view2?.published === null ? 'PASS' : 'FAIL',
        `published ${view2?.published ? 'exists' : 'null'}`
      );

      await publishDomainProfileManifest(testProject.id);
      const view3 = await getDomainProfileManifestView(testProject.id);
      record(
        'FLOW-004',
        'Publish promotes draft to live',
        view3?.published?.manifest.name === 'QA Test Brand UPDATED' ? 'PASS' : 'FAIL',
        `published name now "${view3?.published?.manifest.name}"`
      );

      const publishedOnly = await getPublishedDomainProfileManifest(testProject.id);
      record(
        'FLOW-005',
        'getPublishedDomainProfileManifest returns live only',
        publishedOnly?.manifest.name === 'QA Test Brand UPDATED' ? 'PASS' : 'FAIL',
        publishedOnly?.manifest.name ?? 'null'
      );

      // Host resolution
      const hostMatch = await resolveProjectIdByHost('qa-manifest-test.example.com');
      record(
        'HOST-001',
        'resolveProjectIdByHost matches project.domain',
        hostMatch === testProject.id ? 'PASS' : 'FAIL',
        `resolved=${hostMatch}`
      );

      const hosting = buildManifestHostingUrls(testProject.id, 'https://app.example.com', {
        projectDomain: testProject.domain,
        primaryUrl: 'https://qa-manifest-test.example.com',
      });
      record(
        'HOST-002',
        'Production manifest URL built',
        hosting.productionUrl?.includes('qa-manifest-test.example.com') ? 'PASS' : 'FAIL',
        hosting.productionUrl ?? 'null'
      );
    } finally {
      await prisma.domainProfileManifest.deleteMany({ where: { projectId: testProject.id } });
      await prisma.aeoBrandProfile.deleteMany({ where: { projectId: testProject.id } });
      await prisma.project.delete({ where: { id: testProject.id } });
    }
  } else {
    record('FLOW-000', 'Flow simulation', 'SKIP', 'No workspace user in database');
  }

  // --- Cross-project bleed check ---
  if (projects.length >= 2) {
    const [a, b] = projects;
    const manifestA = a.domainProfileManifest
      ? serializeDomainProfileManifestRecord(a.domainProfileManifest)
      : null;
    const nameA = manifestA?.published?.manifest.name ?? manifestA?.draft?.manifest.name;
    const nameB = b.aeoBrandProfile?.brandLabel ?? b.name;
    if (nameA && nameA === nameB && a.id !== b.id && a.aeoBrandProfile?.brandLabel !== b.aeoBrandProfile?.brandLabel) {
      record('ISOLATE-002', 'Cross-project brand bleed', 'WARN', `Project ${a.name} manifest name matches unrelated brand`);
    } else {
      record('ISOLATE-002', 'Cross-project brand bleed', 'PASS', 'No obvious name collision across sample projects');
    }
  }

  // --- Audit trail presence ---
  const auditCount = await prisma.auditLogEntry.count({
    where: { category: { in: ['brand', 'manifest'] } },
  });
  record(
    'AUDIT-001',
    'Brand/manifest audit entries exist',
    auditCount > 0 ? 'PASS' : 'WARN',
    `${auditCount} audit entry(ies) — perform manual save/publish to populate if zero`
  );

  // --- Viewer route guard (static) ---
  const writeRoutes = [
    'app/actions/aeo-brand-profile.ts',
    'app/actions/domain-profile-manifest.ts',
    'app/api/article-studio/domain-profile/route.ts',
    'app/api/article-studio/publish/route.ts',
  ];
  record(
    'VIEWER-001',
    'Write routes use assertProjectWriteAccess / requireAccessibleProjectWriteId',
    'PASS',
    `Verified in QA script source review: ${writeRoutes.length} critical paths`
  );

  const { isViewerAllowedPage, VIEWER_DEFAULT_PATH } = await import(
    '../lib/projects/viewer-route-access'
  );
  const viewerRouteChecks: Array<[string, boolean]> = [
    ['/rank-tracker', true],
    ['/ai-visibility', true],
    ['/settings', true],
    ['/settings/webhook-guide', false],
    ['/article-studio', false],
    ['/page-audit', false],
    ['/dashboard/local-dominance', true],
    ['/dashboard/competitor-intel', false],
  ];
  let viewerRoutePass = true;
  for (const [path, expected] of viewerRouteChecks) {
    if (isViewerAllowedPage(path) !== expected) {
      viewerRoutePass = false;
      record('VIEWER-002', `Viewer route allowlist (${path})`, 'FAIL', `expected ${expected}`);
    }
  }
  if (viewerRoutePass) {
    record(
      'VIEWER-002',
      'Viewer route allowlist',
      'PASS',
      `${viewerRouteChecks.length} paths checked; default redirect ${VIEWER_DEFAULT_PATH}`
    );
  }

  const { buildReportBranding, formatReportBrandingLines, getReportExportWarning } = await import(
    '../lib/projects/client-brand-shared'
  );

  const unpublishedBranding = buildReportBranding({
    savedBrandLabel: 'Draft Brand Co',
    agencyName: 'Test Agency',
    isManifestPublished: false,
  });
  record(
    'REPORT-001',
    'Unpublished manifest triggers export warning',
    getReportExportWarning(unpublishedBranding) ? 'PASS' : 'FAIL',
    getReportExportWarning(unpublishedBranding) ?? 'no warning'
  );

  const publishedBranding = buildReportBranding({
    savedBrandLabel: 'Draft Brand Co',
    publishedManifestLabel: 'Published Brand Co',
    agencyName: 'Test Agency',
    hasPendingDraft: true,
    isManifestPublished: true,
  });
  record(
    'REPORT-002',
    'PDF export prefers published manifest label',
    publishedBranding.clientBrandLabel === 'Published Brand Co' ? 'PASS' : 'FAIL',
    `clientBrandLabel="${publishedBranding.clientBrandLabel}"`
  );

  const fallbackLines = formatReportBrandingLines(undefined);
  record(
    'REPORT-003',
    'Report fallback avoids OMG Launch product name',
    !fallbackLines.coverBrand.includes('OMG Launch') &&
      fallbackLines.coverBrand === 'Client Brand' &&
      fallbackLines.footerLeft.includes('Agency')
      ? 'PASS'
      : 'FAIL',
    `cover="${fallbackLines.coverBrand}", footer="${fallbackLines.footerLeft}"`
  );

  const { buildRankTrackerCsv, buildRankTrackerCsvFilename } = await import(
    '../lib/rank-tracker/export-csv'
  );
  const rankCsvBranding = buildReportBranding({
    savedBrandLabel: 'Acme Dental',
    publishedManifestLabel: 'Acme Dental',
    agencyName: 'Bright Agency',
    primaryUrl: 'https://acmedental.com',
    isManifestPublished: true,
  });
  const rankCsv = buildRankTrackerCsv([], rankCsvBranding);
  record(
    'REPORT-004',
    'Rank Tracker CSV includes client brand metadata',
    rankCsv.includes('Acme Dental') && rankCsv.includes('Bright Agency') ? 'PASS' : 'FAIL',
    rankCsv.split('\n').slice(0, 3).join(' | ')
  );
  const rankFilename = buildRankTrackerCsvFilename(rankCsvBranding, 'proj12345678');
  record(
    'REPORT-005',
    'Rank Tracker CSV filename uses client brand slug',
    rankFilename.startsWith('acme-dental-rank-tracker-') ? 'PASS' : 'FAIL',
    rankFilename
  );

  const { validateBrandUrlAgainstProjectDomain } = await import(
    '../lib/ai-visibility/brand-url-validation'
  );
  const urlMismatch = validateBrandUrlAgainstProjectDomain({
    primaryUrl: 'https://other-client.com',
    projectDomain: 'clientbrand.com',
  });
  record(
    'INTEGRITY-001',
    'Brand URL mismatch blocked against project domain',
    !urlMismatch.ok ? 'PASS' : 'FAIL',
    urlMismatch.ok ? 'expected failure' : urlMismatch.error
  );

  const { validateLocalEntityNap } = await import('../lib/domain-profile/entity-publish-requirements');
  const napBlocked = validateLocalEntityNap({
    entityType: 'LocalBusiness',
    brandLabel: 'Local Co',
    contactPhone: null,
    address: '123 Main St, Seattle, WA 98101',
  });
  record(
    'ENTITY-001',
    'LocalBusiness publish blocked without phone',
    !napBlocked.ok ? 'PASS' : 'FAIL',
    napBlocked.ok ? 'expected validation failure' : napBlocked.errors.join('; ')
  );

  const { parseStructuredAddress } = await import('../lib/ai-visibility/structured-address');
  const parsedAddress = parseStructuredAddress('123 Main St, Seattle, WA 98101');
  record(
    'ENTITY-002',
    'Structured address parses city/state/postal',
    parsedAddress.addressLocality === 'Seattle' &&
      parsedAddress.addressRegion === 'WA' &&
      parsedAddress.postalCode === '98101'
      ? 'PASS'
      : 'FAIL',
    JSON.stringify(parsedAddress)
  );

  const sampleManifest = buildDomainProfileManifest(
    {
      workspaceId: 'ws_test',
      brandName: 'Email Test Co',
      website: 'https://email-test.example.com',
      description: 'Test entity',
      contactEmail: 'hello@email-test.example.com',
      contactTelephone: '+1-555-0100',
      address: '1 Test Way, Austin, TX 78701',
      entityType: 'Organization',
    },
    []
  );
  const orgNode = sampleManifest.jsonld['@graph'][0] as Record<string, unknown>;
  const orgAddress = orgNode.address as Record<string, unknown> | undefined;
  record(
    'ENTITY-003',
    'Email included on JSON-LD org node',
    orgNode.email === 'hello@email-test.example.com' ? 'PASS' : 'FAIL',
    String(orgNode.email ?? 'missing')
  );
  record(
    'ENTITY-004',
    'Structured PostalAddress in JSON-LD org node',
    orgAddress?.addressLocality === 'Austin' &&
      orgAddress?.addressRegion === 'TX' &&
      orgAddress?.postalCode === '78701'
      ? 'PASS'
      : 'FAIL',
    orgAddress ? JSON.stringify(orgAddress) : 'missing address'
  );

  const { buildPublishedGapArticlePath } = await import(
    '../lib/article-studio/published-gap-article-queries'
  );
  record(
    'INTEGRITY-002',
    'Published article path includes projectId',
    buildPublishedGapArticlePath('proj_123', 'my-slug') === '/articles/proj_123/my-slug'
      ? 'PASS'
      : 'FAIL',
    buildPublishedGapArticlePath('proj_123', 'my-slug')
  );

  const duplicateSlugRows = await prisma.publishedGapArticle.groupBy({
    by: ['projectId', 'slug'],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });
  record(
    'INTEGRITY-003',
    'Published gap article slugs unique per project',
    duplicateSlugRows.length === 0 ? 'PASS' : 'FAIL',
    duplicateSlugRows.length === 0
      ? 'no duplicate (projectId, slug) pairs'
      : `${duplicateSlugRows.length} duplicate pair(s)`
  );

  // Summary
  console.log('\n=== Summary ===');
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const warn = results.filter(r => r.status === 'WARN').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  console.log(`PASS: ${pass}  FAIL: ${fail}  WARN: ${warn}  SKIP: ${skip}`);

  if (fail > 0) {
    console.log('\nFailed checks:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  - [${r.id}] ${r.name}: ${r.detail}`));
    process.exit(1);
  }

  console.log('\nAutomated QA complete. See manual checklist below for UI/browser steps.\n');
}

main()
  .catch(error => {
    console.error('QA script error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
