import { apiRequest } from './httpClient';
import type { BackendAccount, BackendAccountType } from './backendTypes';

const basePathFor = (type: BackendAccountType) =>
  type === 'PAYABLE' ? '/accounts-payable' : '/accounts-receivable';

export function listAccounts(type: BackendAccountType): Promise<BackendAccount[]> {
  return apiRequest<BackendAccount[]>(basePathFor(type));
}

export function listOverdue(type: BackendAccountType): Promise<BackendAccount[]> {
  return apiRequest<BackendAccount[]>(`${basePathFor(type)}/overdue`);
}

export function listDueSoon(type: BackendAccountType, days = 3): Promise<BackendAccount[]> {
  return apiRequest<BackendAccount[]>(`${basePathFor(type)}/due-soon`, { query: { days } });
}

/** Only PAYABLE accounts can be created directly — RECEIVABLE ones always come from a sale. */
export function createPayable(payload: {
  description: string;
  amount: number;
  dueDate: string;
}): Promise<BackendAccount> {
  return apiRequest<BackendAccount>('/accounts-payable', { method: 'POST', body: payload });
}

export function settleAccount(
  type: BackendAccountType,
  id: string,
  paidAt?: string,
): Promise<BackendAccount> {
  return apiRequest<BackendAccount>(`${basePathFor(type)}/${id}/settle`, {
    method: 'PATCH',
    body: { paidAt },
  });
}
