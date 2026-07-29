type WordPressAuth = {
  username: string;
  applicationPassword: string;
};

type WordPressJsonError = {
  code?: string;
  message?: string;
  data?: { status?: number };
};

export type WordPressRequestResult = {
  ok: boolean;
  status: number;
  payload: Record<string, unknown>;
};

function normalizeApplicationPassword(password: string): string {
  return password.replace(/\s+/g, '');
}

export function normalizeWordPressSiteUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('WordPress site URL is required');
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('WordPress site URL must use http or https');
  }

  return `${parsed.protocol}//${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '')}`;
}

function buildBasicAuthHeader(auth: WordPressAuth): string {
  const token = Buffer.from(
    `${auth.username.trim()}:${normalizeApplicationPassword(auth.applicationPassword)}`
  ).toString('base64');
  return `Basic ${token}`;
}

function buildAuthenticatedSiteUrl(siteUrl: string, auth: WordPressAuth): string {
  const parsed = new URL(siteUrl);
  parsed.username = auth.username.trim();
  parsed.password = normalizeApplicationPassword(auth.applicationPassword);
  return parsed.toString().replace(/\/+$/, '');
}

async function readJsonPayload(response: Response): Promise<Record<string, unknown>> {
  const payload = await response.json().catch(() => ({}));
  return payload && typeof payload === 'object'
    ? (payload as Record<string, unknown>)
    : {};
}

async function wordpressFetch(
  url: string,
  init: RequestInit
): Promise<WordPressRequestResult> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
  });

  return {
    ok: response.ok,
    status: response.status,
    payload: await readJsonPayload(response),
  };
}

export async function wordpressAuthenticatedFetch(
  siteUrl: string,
  auth: WordPressAuth,
  path: string,
  init: RequestInit = {}
): Promise<WordPressRequestResult> {
  const normalizedSiteUrl = normalizeWordPressSiteUrl(siteUrl);
  const headers = new Headers(init.headers);
  headers.set('Authorization', buildBasicAuthHeader(auth));

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const headerAuthResult = await wordpressFetch(`${normalizedSiteUrl}${path}`, {
    ...init,
    headers,
  });

  if (headerAuthResult.ok || headerAuthResult.status !== 401) {
    return headerAuthResult;
  }

  // Some hosts (LiteSpeed/CGI) strip Authorization headers before PHP.
  // Retry with credentials in the URL as a compatibility fallback.
  const urlAuthBase = buildAuthenticatedSiteUrl(normalizedSiteUrl, auth);
  return wordpressFetch(`${urlAuthBase}${path}`, {
    ...init,
    headers: (() => {
      const next = new Headers(init.headers);
      next.delete('Authorization');
      if (init.body && !next.has('Content-Type')) {
        next.set('Content-Type', 'application/json');
      }
      return next;
    })(),
  });
}

export async function verifyWordPressCredentials(
  siteUrl: string,
  auth: WordPressAuth
): Promise<{ ok: true; userId: number; name: string } | { ok: false; error: string }> {
  const result = await wordpressAuthenticatedFetch(siteUrl, auth, '/wp-json/wp/v2/users/me');

  if (result.ok) {
    const userId = typeof result.payload.id === 'number' ? result.payload.id : null;
    const name =
      typeof result.payload.name === 'string'
        ? result.payload.name
        : typeof result.payload.slug === 'string'
          ? result.payload.slug
          : auth.username;

    if (!userId) {
      return { ok: false, error: 'WordPress authenticated but returned an unexpected user payload.' };
    }

    return { ok: true, userId, name };
  }

  return {
    ok: false,
    error: formatWordPressAuthError(result.payload, result.status),
  };
}

export function formatWordPressAuthError(
  payload: Record<string, unknown>,
  status: number
): string {
  const code = typeof payload.code === 'string' ? payload.code : '';
  const message = typeof payload.message === 'string' ? payload.message : '';

  if (status === 401 || code === 'rest_not_logged_in' || code === 'rest_cannot_create') {
    return [
      'WordPress did not accept these credentials for the REST API.',
      'Use your WordPress username (login), not display name, plus an Application Password from Users → Profile → Application Passwords.',
      'Do not use your normal login password.',
      'If an Application Password is already correct, your host may be stripping Authorization headers — contact hosting support for LiteSpeed/CGI Authorization pass-through.',
    ].join(' ');
  }

  if (status === 403) {
    return (
      message ||
      'WordPress rejected the request. Verify this user role can create posts (Administrator or Editor).'
    );
  }

  return message || 'WordPress authentication failed. Please try again.';
}

export function formatWordPressPublishError(
  payload: Record<string, unknown>,
  status: number
): string {
  const code = typeof payload.code === 'string' ? payload.code : '';
  const message = typeof payload.message === 'string' ? payload.message : '';

  if (status === 401 || code === 'rest_cannot_create' || code === 'rest_not_logged_in') {
    return formatWordPressAuthError(payload, status);
  }

  if (status === 403) {
    return (
      message ||
      'WordPress rejected the request. Verify the user has permission to create posts.'
    );
  }

  return message || 'WordPress publishing failed. Please try again.';
}

export function isWordPressJsonError(payload: unknown): payload is WordPressJsonError {
  return Boolean(payload && typeof payload === 'object');
}
