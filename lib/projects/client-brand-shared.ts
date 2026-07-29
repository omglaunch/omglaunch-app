/** Client-safe brand label helpers — no Prisma or server imports. */

export type ClientBrandContext = {
  projectId: string;
  brandLabel: string;
  primaryUrl: string | null;
  projectName: string;
  projectDomain: string | null;
};

export type ReportBranding = {
  /** Brand name used on exported PDFs (published manifest when available). */
  clientBrandLabel: string;
  /** Saved AEO brand / project label — may differ from published manifest. */
  savedBrandLabel: string;
  publishedManifestLabel: string | null;
  clientWebsite: string | null;
  agencyName: string;
  reportLogoUrl: string | null;
  brandPrimaryColor: string;
  hasPendingDraft: boolean;
  isManifestPublished: boolean;
};

/** Resolve display label: AEO brand → project name → fallback. */
export function resolveClientBrandLabel(input: {
  brandLabel?: string | null;
  projectName?: string | null;
  fallback?: string;
}): string {
  const fromBrand = input.brandLabel?.trim();
  if (fromBrand) return fromBrand;

  const fromProject = input.projectName?.trim();
  if (fromProject) return fromProject;

  return input.fallback ?? 'Client Brand';
}

export function buildReportBranding(input: {
  savedBrandLabel: string;
  publishedManifestLabel?: string | null;
  primaryUrl?: string | null;
  agencyName: string;
  reportLogoUrl?: string | null;
  brandPrimaryColor?: string;
  hasPendingDraft?: boolean;
  isManifestPublished?: boolean;
}): ReportBranding {
  const savedBrandLabel = resolveClientBrandLabel({
    brandLabel: input.savedBrandLabel,
    fallback: 'Client Brand',
  });
  const publishedManifestLabel = input.publishedManifestLabel?.trim() || null;
  const isManifestPublished = input.isManifestPublished ?? false;
  const clientBrandLabel =
    isManifestPublished && publishedManifestLabel
      ? publishedManifestLabel
      : savedBrandLabel;

  return {
    clientBrandLabel,
    savedBrandLabel,
    publishedManifestLabel,
    clientWebsite: input.primaryUrl?.trim() || null,
    agencyName: input.agencyName.trim() || 'Agency',
    reportLogoUrl: input.reportLogoUrl ?? null,
    brandPrimaryColor: input.brandPrimaryColor ?? '#059669',
    hasPendingDraft: input.hasPendingDraft ?? false,
    isManifestPublished,
  };
}

/**
 * Warn before client-facing PDF export when branding is not aligned with the
 * published entity profile on the client domain.
 */
export function getReportExportWarning(branding: ReportBranding): string | null {
  if (!branding.isManifestPublished) {
    return `No entity profile is published for this client yet. This PDF will use "${branding.savedBrandLabel}" from the saved brand draft — not the live /.well-known/ manifest. Publish from Settings → Domain Manifest before client delivery.`;
  }

  if (
    branding.hasPendingDraft &&
    branding.publishedManifestLabel &&
    branding.savedBrandLabel !== branding.publishedManifestLabel
  ) {
    return `Your saved brand ("${branding.savedBrandLabel}") differs from the published entity profile ("${branding.publishedManifestLabel}"). This PDF will use the published name. Publish the draft manifest if the saved brand is correct.`;
  }

  return null;
}

export function formatReportBrandingLines(branding?: ReportBranding): {
  coverBrand: string;
  footerLeft: string;
  author: string;
} {
  const agency = branding?.agencyName?.trim() || 'Agency';
  const client = branding?.clientBrandLabel?.trim() || 'Client Brand';

  return {
    coverBrand: client,
    footerLeft: `${client} · Prepared by ${agency}`,
    author: client,
  };
}
