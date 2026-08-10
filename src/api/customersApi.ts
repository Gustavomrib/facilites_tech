import { apiRequest } from './httpClient';
import type { BackendCustomer } from './backendTypes';

export function listCustomers(search?: string): Promise<BackendCustomer[]> {
  return apiRequest<BackendCustomer[]>('/customers', { query: { search } });
}

export function createCustomer(payload: { name: string; phone?: string }): Promise<BackendCustomer> {
  return apiRequest<BackendCustomer>('/customers', { method: 'POST', body: payload });
}
