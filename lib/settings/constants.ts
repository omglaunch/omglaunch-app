export const TEAM_ROLES = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Asia/Kuala_Lumpur',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
] as const;

export const COUNTRIES = [
  { value: 'Malaysia', label: 'Malaysia' },
  { value: 'United States', label: 'United States' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'Australia', label: 'Australia' },
] as const;

export const GOOGLE_DOMAINS = [
  { value: 'google.com.my', label: 'google.com.my' },
  { value: 'google.com', label: 'google.com' },
  { value: 'google.co.uk', label: 'google.co.uk' },
  { value: 'google.com.sg', label: 'google.com.sg' },
  { value: 'google.com.au', label: 'google.com.au' },
] as const;

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ms', label: 'Malay' },
  { value: 'zh', label: 'Chinese' },
] as const;

export const ANALYSIS_AI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'o1-mini'] as const;
export const ARTICLE_STUDIO_MODELS = ['claude-3-5-sonnet', 'gpt-4o'] as const;

export const ROLE_LABELS: Record<TeamRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  EDITOR: 'Editor',
  VIEWER: 'Client/Viewer',
};
