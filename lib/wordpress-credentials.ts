export type WordPressCredentials = {
  siteUrl: string;
  username: string;
  applicationPassword: string;
};

const STORAGE_KEY = 'omglaunch-wordpress-credentials';

export function loadWordPressCredentials(): WordPressCredentials | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as WordPressCredentials;
    if (
      typeof parsed.siteUrl !== 'string' ||
      typeof parsed.username !== 'string' ||
      typeof parsed.applicationPassword !== 'string'
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveWordPressCredentials(credentials: WordPressCredentials): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

export function clearWordPressCredentials(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
