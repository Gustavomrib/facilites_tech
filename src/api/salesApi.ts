import { apiRequest } from './httpClient';
import type { BackendPaymentMethod, BackendSale } from './backendTypes';

export interface CreateSalePayload {
  date: string;
  description: string;
  quantity: number;
  unitPrice: number;
  paymentMethod: BackendPaymentMethod;
  productId?: string;
  customerId?: string;
}

export function createSale(payload: CreateSalePayload): Promise<BackendSale> {
  return apiRequest<BackendSale>('/sales', { method: 'POST', body: payload });
}

export function listSales(from?: string, to?: string): Promise<BackendSale[]> {
  return apiRequest<BackendSale[]>('/sales', { query: { from, to } });
}
