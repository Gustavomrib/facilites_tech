import type { APIRequestContext } from '@playwright/test';
import type { TestUser } from './users';

/**
 * Backend origin, INCLUDING the /api prefix — matches VITE_API_BASE
 * (see .env.example). Overridable so CI/staging can point this suite at a
 * different backend without touching test code.
 */
export const API_BASE = process.env.E2E_API_BASE ?? 'http://localhost:3000/api';

interface RegisterResult {
  accessToken: string;
}

/**
 * /auth/register is throttled to 5 req/60s per IP (backend/src/auth/auth.controller.ts).
 * Worker-scoped fixtures (see fixtures.ts's sharedCompany) are meant to keep this suite
 * well under that, but Playwright can still recycle a worker process (e.g. after a
 * failure elsewhere in the run), which re-runs the fixture and its register call. A
 * short retry-with-backoff here is the same thing any real client of a rate-limited
 * endpoint needs to do — not a workaround for a suite bug.
 */
async function postWithRetryOn429(
  request: APIRequestContext,
  url: string,
  data: unknown,
  maxAttempts = 5,
) {
  // Flat 15s delays (60s total across 5 attempts) — the throttle window itself is
  // 60s (auth.controller.ts), so a shorter backoff can exhaust its retries while
  // still inside the SAME window and never actually see it clear. playwright.config.ts's
  // global test timeout and fixtures.ts's sharedCompany fixture timeout are both sized
  // to give this room to run to completion.
  let lastRes;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastRes = await request.post(url, { data });
    if (lastRes.status() !== 429) return lastRes;
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 15_000));
    }
  }
  return lastRes!;
}

/**
 * Registers a company + owner user directly against the real backend.
 * Call with `page.request` (not the bare `request` fixture) so the
 * Set-Cookie for the httpOnly refresh token lands in the same browser
 * context the test's `page` will later navigate — that's what lets the
 * app's normal silent-refresh bootstrap pick up the session on page.goto().
 */
export async function registerUserViaApi(
  request: APIRequestContext,
  user: TestUser,
): Promise<RegisterResult> {
  const res = await postWithRetryOn429(request, `${API_BASE}/auth/register`, {
    companyName: user.companyName,
    name: user.name,
    email: user.email,
    password: user.password,
  });
  if (!res.ok()) {
    throw new Error(`Test setup failed: POST /auth/register -> ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as RegisterResult;
  return body;
}

/**
 * Logs in an already-registered user directly against the real backend.
 * Call with `page.request` so the resulting Set-Cookie (a freshly-issued
 * refresh token) lands in that test's own browser context.
 *
 * Deliberately NOT a cookie snapshot reused across tests: the refresh token
 * rotates (and the previous one is revoked) on every use — see
 * tokens.service.ts's reuse-detection. Sharing one static Set-Cookie across
 * multiple independent browser contexts means whichever test's page
 * bootstrap refreshes first "burns" it, and every other test presenting that
 * same now-revoked cookie gets flagged as a replay and logged out. Each test
 * calling this itself gets its own independent token family instead.
 */
export async function loginUserViaApi(
  request: APIRequestContext,
  credentials: Pick<TestUser, 'email' | 'password'>,
): Promise<RegisterResult> {
  // Built explicitly (not passed through as-is): callers often have a full TestUser
  // on hand (with companyName/name too), and LoginDto's forbidNonWhitelisted rejects
  // any extra fields with a 400 — Pick<> only narrows the type, it doesn't strip
  // properties from the actual object at runtime.
  const res = await postWithRetryOn429(request, `${API_BASE}/auth/login`, {
    email: credentials.email,
    password: credentials.password,
  });
  if (!res.ok()) {
    throw new Error(`Test setup failed: POST /auth/login -> ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as RegisterResult;
  return body;
}

/**
 * Completes onboarding server-side (skips driving the 4-step wizard UI) so
 * smoke tests can reach the authenticated app quickly. The onboarding wizard
 * itself is covered separately by the UI-driven registration test in
 * e2e/auth.spec.ts.
 */
export async function completeOnboardingViaApi(
  request: APIRequestContext,
  accessToken: string,
): Promise<void> {
  const res = await request.patch(`${API_BASE}/companies/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      offering: 'BOTH',
      tracksInventory: true,
      dashboardPeriod: 'DAY',
      reportFrequency: 'NONE',
      reportByEmail: false,
      onboardingCompleted: true,
    },
  });
  if (!res.ok()) {
    throw new Error(`Test setup failed: PATCH /companies/me -> ${res.status()} ${await res.text()}`);
  }
}
