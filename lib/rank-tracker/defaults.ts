const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  ms: 'Malay',
  zh: 'Chinese',
  id: 'Indonesian',
  th: 'Thai',
  vi: 'Vietnamese',
};

export function languageLabelFromCode(code: string): string {
  const normalized = code.trim().toLowerCase();
  return LANGUAGE_LABELS[normalized] ?? 'English';
}
