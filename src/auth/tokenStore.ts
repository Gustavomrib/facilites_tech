// In-memory only — never persisted to localStorage/sessionStorage. Lost on full page
// reload by design; session survival across reloads happens via the httpOnly refresh
// cookie (see AuthContext's bootstrap step), never via a stored access token.
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

type AuthFailureHandler = () => void;
let onAuthFailure: AuthFailureHandler | null = null;

/** Registered by AuthContext so the HTTP client can flip global auth state to "signed out". */
export function setOnAuthFailure(handler: AuthFailureHandler | null): void {
  onAuthFailure = handler;
}

export function notifyAuthFailure(): void {
  accessToken = null;
  onAuthFailure?.();
}
