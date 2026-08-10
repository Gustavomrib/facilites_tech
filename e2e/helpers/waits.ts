import { expect, type Page } from '@playwright/test';

/**
 * The app has two sequential bootstrap phases behind the "Carregando..."
 * splash: AuthContext's silent-refresh (AuthContext.tsx) and then
 * AppDataContext's initial reloadAll() (AppDataContext.tsx). Waiting for a
 * concrete dashboard widget — rather than the absence of the splash text —
 * avoids a race between the two phases.
 */
export async function waitForDashboard(page: Page): Promise<void> {
  await expect(page.getByText('Caixa Disponível')).toBeVisible({ timeout: 15_000 });
}

export async function waitForLoginScreen(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible({ timeout: 15_000 });
}

/**
 * Navigates to "/" and waits for the dashboard, retrying on failure.
 *
 * The one transient failure mode this guards against: AuthContext's bootstrap
 * silent-refresh (POST /auth/refresh) is throttled to 10 req/60s
 * (auth.controller.ts) — a real limit sized for a real single user's browser,
 * but a suite that navigates many fresh pages back-to-back in a tight window
 * can legitimately exhaust it, landing on /login even though the test's own
 * register/login call already succeeded. That's suite request volume, not an
 * app bug, so the fix belongs here (retry the flaky boundary) rather than in
 * the app's auth code. This grows with the suite's test count — more tests
 * sharing one worker means more cumulative refresh calls before a trailing
 * test gets its turn — so the delay budget here and playwright.config.ts's
 * test timeout both carry deliberate margin above whatever was last measured,
 * not just enough to cover it exactly.
 */
export async function gotoAndWaitForDashboard(page: Page): Promise<void> {
  const delaysMs = [10_000, 20_000, 20_000, 20_000];
  await page.goto('/');
  for (let attempt = 0; ; attempt++) {
    try {
      await waitForDashboard(page);
      return;
    } catch (err) {
      const onLogin = await page.getByRole('button', { name: 'Entrar' }).isVisible().catch(() => false);
      if (!onLogin || attempt >= delaysMs.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
      await page.reload();
    }
  }
}
