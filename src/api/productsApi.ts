import { apiRequest } from './httpClient';
import type { BackendProduct, BackendProductType } from './backendTypes';

export interface UpsertProductPayload {
  name: string;
  sku?: string;
  category?: string;
  type?: BackendProductType;
  quantity?: number;
  minQuantity?: number;
  salePrice: number;
  cost?: number;
}

export function listProducts(): Promise<BackendProduct[]> {
  return apiRequest<BackendProduct[]>('/products');
}

export function createProduct(payload: UpsertProductPayload): Promise<BackendProduct> {
  return apiRequest<BackendProduct>('/products', { method: 'POST', body: payload });
}

export function updateProduct(id: string, payload: Partial<UpsertProductPayload>): Promise<BackendProduct> {
  return apiRequest<BackendProduct>(`/products/${id}`, { method: 'PATCH', body: payload });
}
