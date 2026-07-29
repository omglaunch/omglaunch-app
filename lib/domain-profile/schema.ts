import { z } from 'zod';

/** AIDD v0.1.1 — AI Domain Data Standard strict schema */
export const AIDD_SPEC = 'https://ai-domain-data.org/spec/v0.1' as const;

export const EntityTypeSchema = z.enum([
  'Organization',
  'LocalBusiness',
  'Corporation',
  'ProfessionalService',
  'MedicalOrganization',
  'LegalService',
  'FinancialService',
  'EducationalOrganization',
  'GovernmentOrganization',
  'NGO',
]);

export type EntityType = z.infer<typeof EntityTypeSchema>;

export const ContactSchema = z
  .object({
    email: z.string().email().optional(),
    telephone: z.string().min(1).optional(),
    url: z.string().url().optional(),
  })
  .strict();

export const PostalAddressSchema = z
  .object({
    '@type': z.literal('PostalAddress'),
    streetAddress: z.string().min(1),
    addressLocality: z.string().min(1).optional(),
    addressRegion: z.string().min(1).optional(),
    postalCode: z.string().min(1).optional(),
  })
  .strict();

export const JsonLdGraphNodeSchema = z
  .object({
    '@type': z.string().min(1),
    '@id': z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    url: z.string().url().optional(),
    description: z.string().optional(),
    email: z.string().email().optional(),
    telephone: z.string().min(1).optional(),
    address: PostalAddressSchema.optional(),
    sameAs: z.array(z.string().url()).optional(),
    hasPart: z
      .array(
        z
          .object({
            '@type': z.string().min(1),
            name: z.string().min(1),
            url: z.string().url(),
          })
          .strict()
      )
      .optional(),
  })
  .strict();

export const JsonLdSchema = z
  .object({
    '@context': z.literal('https://schema.org'),
    '@graph': z.array(JsonLdGraphNodeSchema).min(1),
  })
  .strict();

export const DomainProfileSchema = z
  .object({
    spec: z.literal(AIDD_SPEC),
    name: z.string().min(1),
    website: z.string().url(),
    description: z.string().min(1),
    contact: ContactSchema,
    entity_type: EntityTypeSchema,
    jsonld: JsonLdSchema,
  })
  .strict();

export type DomainProfile = z.infer<typeof DomainProfileSchema>;
export type DomainProfileContact = z.infer<typeof ContactSchema>;

export function parseDomainProfile(value: unknown): DomainProfile {
  return DomainProfileSchema.parse(value);
}

export function safeParseDomainProfile(
  value: unknown
): { success: true; data: DomainProfile } | { success: false; error: string } {
  const result = DomainProfileSchema.safeParse(value);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '),
  };
}
