import { defineConfig, devices } from '@playwright/test';

// Frontend (Vite) origin under test. The backend origin is configured
// separately via E2E_API_BASE (see e2e/helpers/api.ts) because the SPA talks
// to it directly over fetch() — Playwright's webServer only manages the
// frontend dev server here (see docs/E2E_TESTING.md for why the backend,
// which needs Postgres + migrations, is started out-of-band).
const PORT = process.env.PLAYWRIGHT_PORT ?? '5173';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Default (30s) is too short for onboardedPage: registerUserViaApi's 429 retry
  // backoff (e2e/helpers/api.ts) can take up to 60s to cross the auth throttle's own
  // 60s window, and gotoAndWaitForDashboard's own retry (helpers/waits.ts) adds up
  // to ~85s more in the worst case for tests running late in a long sequential suite
  // (later tests inherit more of the run's cumulative refresh-throttle usage — this
  // grows with the suite's test count, not a fixed number). sharedCompany's fixture
  // timeout (fixtures.ts) is sized to match.
  timeout: 240_000,
  // Auth endpoints are rate-limited server-side (5 register/login attempts per
  // 60s, see backend/src/auth/auth.controller.ts). Too many workers means too
  // many concurrent /auth/register calls and spurious 429s — see docs/E2E_TESTING.md.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT} --strictPort`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
