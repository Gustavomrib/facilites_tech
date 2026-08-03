import { getAccessToken, notifyAuthFailure, setAccessToken } from '../auth/tokenStore';

const API_BASE = import.meta.env.VITE_API_BASE;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Login/register/refresh itself: skip attaching a token and skip the 401-retry dance. */
  skipAuth?: boolean;
}

// A 401 can arrive on several in-flight requests at once (e.g. dashboard + products +
// customers firing together after the access token expired), and the session-bootstrap
// call on app load can also overlap with one of those (e.g. React StrictMode's
// double-effect-invocation in dev). Sharing one in-flight refresh promise across BOTH
// call sites means only a single POST /auth/refresh is ever made concurrently — critical
// here because the backend rotates+revokes the refresh token on every use, so two
// concurrent refreshes with the same cookie would make the second one look like a
// replay attack and revoke the whole session.
let refreshPromise: Promise<string | null> | null = null;

/** Exported so AuthContext's session-bootstrap call shares this same dedup guard. */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function performRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { accessToken: string };
    setAccessToken(body.accessToken);
    return body.accessToken;
  } catch {
    return null;
  }
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join('; ');
    if (typeof body.message === 'string') return body.message;
  } catch {
    // response had no JSON body
  }
  return `Erro inesperado (${res.status})`;
}

async function doFetch(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAccessToken();
  if (token && !options.skipAuth) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include', // required for the httpOnly refresh cookie
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

/** Central HTTP client: attaches the in-memory access token and retries a 401 exactly once. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await doFetch(path, options);

  if (res.status === 401 && !options.skipAuth) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      notifyAuthFailure();
      throw new ApiError(401, 'Sessão expirada. Faça login novamente.');
    }
    res = await doFetch(path, options); // single retry, using the freshly refreshed token
    if (res.status === 401) {
      notifyAuthFailure();
      throw new ApiError(401, 'Sessão expirada. Faça login novamente.');
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, await extractErrorMessage(res));
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
