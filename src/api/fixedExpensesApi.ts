import { apiRequest } from './httpClient';
import type { BackendFixedExpense, BackendRecurrence } from './backendTypes';

export function listFixedExpenses(): Promise<BackendFixedExpense[]> {
  return apiRequest<BackendFixedExpense[]>('/fixed-expenses');
}

export function createFixedExpense(payload: {
  name: string;
  amount: number;
  recurrence: BackendRecurrence;
}): Promise<BackendFixedExpense> {
  return apiRequest<BackendFixedExpense>('/fixed-expenses', { method: 'POST', body: payload });
}

export function deactivateFixedExpense(id: string): Promise<BackendFixedExpense> {
  return apiRequest<BackendFixedExpense>(`/fixed-expenses/${id}`, { method: 'DELETE' });
}
