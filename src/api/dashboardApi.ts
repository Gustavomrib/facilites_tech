import { apiRequest } from './httpClient';
import type { BackendDashboardSummary } from './backendTypes';

export function getDashboardSummary(): Promise<BackendDashboardSummary> {
  return apiRequest<BackendDashboardSummary>('/dashboard/summary');
}
