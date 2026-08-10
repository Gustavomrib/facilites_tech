import { apiRequest } from './httpClient';

/** Currently always rejects with 501 — the backend does not send real e-mails yet. */
export function sendReportNow(): Promise<void> {
  return apiRequest<void>('/reports/send-now', { method: 'POST' });
}
