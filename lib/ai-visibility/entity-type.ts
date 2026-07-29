import {
  EntityTypeSchema,
  type EntityType,
} from '@/lib/domain-profile/schema';

export type { EntityType };

export const DEFAULT_ENTITY_TYPE: EntityType = 'Organization';

/** UI labels for Schema.org entity types used in client brand profiles. */
export const ENTITY_TYPE_OPTIONS: Array<{
  value: EntityType;
  label: string;
  description: string;
}> = [
  {
    value: 'Organization',
    label: 'Organization',
    description: 'General business or brand (default)',
  },
  {
    value: 'LocalBusiness',
    label: 'Local Business',
    description: 'Physical location, service area, or storefront',
  },
  {
    value: 'MedicalOrganization',
    label: 'Medical Organization',
    description: 'Clinics, practices, hospitals',
  },
  {
    value: 'LegalService',
    label: 'Legal Service',
    description: 'Law firms and legal practices',
  },
  {
    value: 'ProfessionalService',
    label: 'Professional Service',
    description: 'Consultants, agencies, B2B services',
  },
  {
    value: 'Corporation',
    label: 'Corporation',
    description: 'Incorporated company entity',
  },
  {
    value: 'FinancialService',
    label: 'Financial Service',
    description: 'Banks, advisors, insurance',
  },
  {
    value: 'EducationalOrganization',
    label: 'Educational Organization',
    description: 'Schools, training providers',
  },
  {
    value: 'GovernmentOrganization',
    label: 'Government Organization',
    description: 'Public sector entities',
  },
  {
    value: 'NGO',
    label: 'NGO / Non-profit',
    description: 'Charities and non-profit organizations',
  },
];

export function normalizeEntityType(value: unknown): EntityType {
  const parsed = EntityTypeSchema.safeParse(
    typeof value === 'string' ? value.trim() : value
  );
  return parsed.success ? parsed.data : DEFAULT_ENTITY_TYPE;
}

export function entityTypeLabel(value: EntityType): string {
  return ENTITY_TYPE_OPTIONS.find(option => option.value === value)?.label ?? value;
}
