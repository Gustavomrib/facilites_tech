import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { createTestUser, type TestUser } from './helpers/users';
import { registerUserViaApi, loginUserViaApi, completeOnboardingViaApi } from './helpers/api';
import { gotoAndWaitForDashboard } from './helpers/waits';

interface CompanySession {
  user: TestUser;
}

async function provisionOnboardedCompany(request: APIRequestContext, prefix: string): Promise<CompanySession> {
  const user = createTestUser(prefix);
  const { accessToken } = await registerUserViaApi(request, user);
  await completeOnboardingViaApi(request, accessToken);
  return { user };
}

type Fixtures = {
  /** A fresh, not-yet-registered test user's credentials. */
  newUser: TestUser;
  /**
   * Registers `newUser` and completes onboarding via direct API calls, then
   * navigates `page` to "/" and waits for the dashboard. Gets its own fresh
   * company every time — safe for tests that mutate auth state (logout,
   * re-login), at the cost of one extra /auth/register call per test.
   */
  onboardedPage: void;
  /**
   * A dedicated, already-onboarded company shared by every test that lands
   * on the same worker process. Cuts /auth/register calls from one-per-test
   * to one-per-worker, which matters because the endpoint is rate-limited
   * (see docs/E2E_TESTING.md). Only use this for tests that read or add
   * data — never for tests that log out or otherwise invalidate the shared
   * session, since that would break every other test sharing this worker.
   */
  sharedOnboardedPage: void;
};

type WorkerFixtures = {
  sharedCompany: CompanySession;
};

export const test = base.extend<Fixtures, WorkerFixtures>({
  newUser: async (_fixtures, use) => {
    await use(createTestUser());
  },

  onboardedPage: async ({ page, newUser }, use) => {
    const { accessToken } = await registerUserViaApi(page.request, newUser);
    await completeOnboardingViaApi(page.request, accessToken);
    await gotoAndWaitForDashboard(page);
    await use();
  },

  sharedCompany: [
    async ({ playwright }, use) => {
      const request = await playwright.request.newContext();
      const session = await provisionOnboardedCompany(request, 'smoke');
      await request.dispose();
      await use(session);
    },
    // Default fixture-setup timeout (30s) is shorter than the 429 retry backoff in
    // registerUserViaApi can take in the worst case (up to ~50s across 5 attempts) —
    // give it enough room to actually clear the throttle window instead of racing it.
    { scope: 'worker', timeout: 90_000 },
  ],

  sharedOnboardedPage: async ({ page, sharedCompany }, use) => {
    // Fresh login per test, not a reused cookie snapshot — see loginUserViaApi's
    // doc comment for why sharing one static refresh-token cookie across tests
    // doesn't work with a rotating-refresh-token backend.
    await loginUserViaApi(page.request, sharedCompany.user);
    await gotoAndWaitForDashboard(page);
    await use();
  },
});

export { expect };
