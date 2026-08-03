import { apiRequest } from './httpClient';
import type { BackendCompany } from './backendTypes';

export function getMyCompany(): Promise<BackendCompany> {
  return apiRequest<BackendCompany>('/companies/me');
}

export function updateMyCompany(patch: Partial<Record<string, unknown>>): Promise<BackendCompany> {
  return apiRequest<BackendCompany>('/companies/me', { method: 'PATCH', body: patch });
}
