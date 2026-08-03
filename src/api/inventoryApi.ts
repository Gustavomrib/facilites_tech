import { apiRequest } from './httpClient';
import type { BackendProduct } from './backendTypes';

export function getLowStock(): Promise<BackendProduct[]> {
  return apiRequest<BackendProduct[]>('/inventory/low-stock');
}

export function adjustStock(productId: string, delta: number, reason: string): Promise<BackendProduct> {
  return apiRequest<BackendProduct>(`/inventory/${productId}/adjust`, {
    method: 'POST',
    body: { delta, reason },
  });
}
