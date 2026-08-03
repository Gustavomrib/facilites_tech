import { apiRequest, refreshAccessToken } from './httpClient';
import type { BackendSession } from './backendTypes';

export interface RegisterPayload {
  companyName: string;
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export function register(payload: RegisterPayload): Promise<BackendSession> {
  return apiRequest<BackendSession>('/auth/register', { method: 'POST', body: payload, skipAuth: true });
}

export function login(payload: LoginPayload): Promise<BackendSession> {
  return apiRequest<BackendSession>('/auth/login', { method: 'POST', body: payload, skipAuth: true });
}

/**
 * Attempts to resume a session from the httpOnly refresh cookie. Returns null if there
 * is none (or it's expired). Goes through the same deduped refresh call the HTTP client
 * uses internally, so this can never race a concurrent 401-triggered refresh.
 */
export async function refresh(): Promise<{ accessToken: string } | null> {
  const accessToken = await refreshAccessToken();
  return accessToken ? { accessToken } : null;
}

export function logout(): Promise<void> {
  return apiRequest<void>('/auth/logout', { method: 'POST' });
}
