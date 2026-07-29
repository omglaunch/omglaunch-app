export const ONBOARDING_CREDIT_GRANT = 100;

export const ONBOARDING_INDUSTRIES = [
  'E-commerce / Retail',
  'SaaS / Technology',
  'Healthcare',
  'Finance / Legal',
  'Local Services',
  'Real Estate',
  'Education',
  'Travel / Hospitality',
  'Other',
] as const;

export type OnboardingIndustry = (typeof ONBOARDING_INDUSTRIES)[number];
