import type { Prisma } from '@prisma/client';
import { buildPostalAddressJsonLd } from '@/lib/ai-visibility/structured-address';
import {
  AIDD_SPEC,
  type DomainProfile,
  type EntityType,
  parseDomainProfile,
} from './schema';

export type WorkspaceDomainContext = {
  workspaceId: string;
  brandName: string;
  website: string;
  description: string;
  contactEmail?: string | null;
  contactTelephone?: string | null;
  contactUrl?: string | null;
  address?: string | null;
  entityType?: EntityType;
  sameAs?: string[];
};

function normalizeWebsiteUrl(website: string): string {
  const trimmed = website.trim();
  if (!trimmed) return 'https://example.com';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/+$/, '');
  }
  return `https://${trimmed.replace(/\/+$/, '')}`;
}

export function buildDomainProfileManifest(
  context: WorkspaceDomainContext,
  publishedArticleRefs: Array<{ slug: string; title: string; cluster: string | null }>
): DomainProfile {
  const website = normalizeWebsiteUrl(context.website);
  const entityType = context.entityType ?? 'Organization';

  const organizationNode: Record<string, unknown> = {
    '@type': entityType,
    '@id': `${website}/#organization`,
    name: context.brandName,
    url: website,
    description: context.description,
  };

  if (context.sameAs && context.sameAs.length > 0) {
    organizationNode.sameAs = context.sameAs;
  }

  if (context.address?.trim()) {
    organizationNode.address = buildPostalAddressJsonLd(context.address);
  }

  if (context.contactEmail?.trim()) {
    organizationNode.email = context.contactEmail.trim();
  }

  if (context.contactTelephone?.trim()) {
    organizationNode.telephone = context.contactTelephone.trim();
  }

  const graph: Record<string, unknown>[] = [organizationNode];

  if (publishedArticleRefs.length > 0) {
    organizationNode.hasPart = publishedArticleRefs.slice(0, 50).map(article => ({
      '@type': 'Article',
      name: article.title,
      url: `${website}/articles/${article.slug}`,
    }));
  }

  const contact: DomainProfile['contact'] = {};
  if (context.contactEmail?.trim()) {
    contact.email = context.contactEmail.trim();
  }
  if (context.contactTelephone?.trim()) {
    contact.telephone = context.contactTelephone.trim();
  }
  if (context.contactUrl?.trim()) {
    contact.url = context.contactUrl.trim();
  } else {
    contact.url = website;
  }

  const manifest: DomainProfile = {
    spec: AIDD_SPEC,
    name: context.brandName,
    website,
    description: context.description,
    contact,
    entity_type: entityType,
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': graph as DomainProfile['jsonld']['@graph'],
    },
  };

  return parseDomainProfile(manifest);
}

export function manifestToPrismaJson(manifest: DomainProfile): Prisma.InputJsonValue {
  return manifest as unknown as Prisma.InputJsonValue;
}
