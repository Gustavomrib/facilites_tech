import { test, expect } from './fixtures';
import { waitForDashboard, waitForLoginScreen } from './helpers/waits';

/**
 * Auth E2E: register, login (success/failure), protected-route redirect,
 * session survival across a reload, logout, and the no-localStorage/
 * sessionStorage guarantee for the access token.
 *
 * Every test here runs against the real backend (no mocked responses) — see
 * docs/E2E_TESTING.md for what needs to be running first.
 */

test.describe('protected routes', () => {
  test('redirects an unauthenticated visitor from a protected route to /login', async ({ page }) => {
    await page.goto('/financas');
    await expect(page).toHaveURL(/\/login$/);
    await waitForLoginScreen(page);
  });
});

test.describe('register', () => {
  test('creates an account through the onboarding wizard and advances past the signup step', async ({
    page,
    newUser,
  }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Não tem conta? Criar agora' }).click();
    await expect(page).toHaveURL(/\/onboarding$/);

    await page.getByPlaceholder('Ex: Mercadinho da Esquina').fill(newUser.companyName);
    await page.getByPlaceholder('Ex: Maria Silva').fill(newUser.name);
    await page.getByPlaceholder('seuemail@exemplo.com').fill(newUser.email);
    const senhaInput = page.getByPlaceholder('Mín. 8 caracteres, com maiúscula, minúscula e número');
    await senhaInput.fill(newUser.password);

    // Password visibility toggle: starts masked, reveals on click, re-masks on
    // a second click — and never disturbs the typed value or form submission.
    await expect(senhaInput).toHaveAttribute('type', 'password');
    const toggleSenha = page.getByRole('button', { name: 'Mostrar senha' });
    await toggleSenha.click();
    await expect(senhaInput).toHaveAttribute('type', 'text');
    await expect(senhaInput).toHaveValue(newUser.password);
    await page.getByRole('button', { name: 'Ocultar senha' }).click();
    await expect(senhaInput).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Avançar' }).click();

    // Reaching step 2 with the account fields gone confirms /auth/register
    // succeeded and the session is live — the wizard has no other way past step 1.
    await expect(page.getByText('Passo 2 de 4')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Modelo de negócio' })).toBeVisible();
  });
});

test.describe('login', () => {
  test('shows an error and stays on /login for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('seuemail@exemplo.com').fill('nobody-e2e@example.com');
    await page.getByPlaceholder('••••••••').fill('WrongPassword123');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText('Invalid credentials')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('logs in with valid credentials and reaches the dashboard', async ({ page, newUser, onboardedPage }) => {
    void onboardedPage; // registers `newUser` + completes onboarding, lands on "/"

    // Log out first so this test exercises the real login form, not the
    // session the fixture already established.
    // A real in-app click, not page.goto(path): goto() is a full browser
    // navigation that remounts the app and re-triggers AuthContext's bootstrap
    // silent-refresh — unnecessary here, and it's what was pushing this suite
    // over its auth-throttle budget.
    await page.getByRole('button', { name: 'Configurações' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Sair da Conta' }).click();
    await waitForLoginScreen(page);

    await page.getByPlaceholder('seuemail@exemplo.com').fill(newUser.email);
    await page.getByPlaceholder('••••••••').fill(newUser.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await waitForDashboard(page);
  });
});

test.describe('logout', () => {
  test('clears the session and protected routes redirect to /login again', async ({ page, onboardedPage }) => {
    void onboardedPage;

    // A real in-app click, not page.goto(path): goto() is a full browser
    // navigation that remounts the app and re-triggers AuthContext's bootstrap
    // silent-refresh — unnecessary here, and it's what was pushing this suite
    // over its auth-throttle budget.
    await page.getByRole('button', { name: 'Configurações' }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Sair da Conta' }).click();
    await waitForLoginScreen(page);

    await page.goto('/estoque');
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('session persistence', () => {
  test('survives a full page reload (silent refresh via the httpOnly cookie)', async ({
    page,
    sharedOnboardedPage,
  }) => {
    void sharedOnboardedPage;

    await page.reload();
    await waitForDashboard(page);
    await expect(page).not.toHaveURL(/\/login$/);
  });
});

test.describe('token storage', () => {
  test('never persists the access/refresh token in localStorage or sessionStorage', async ({
    page,
    sharedOnboardedPage,
  }) => {
    void sharedOnboardedPage;

    await page.reload();
    await waitForDashboard(page);

    const storageDump = await page.evaluate(() => ({
      local: Object.entries(window.localStorage),
      session: Object.entries(window.sessionStorage),
    }));

    // A JWT is three base64url segments joined by dots — check every stored
    // key/value pair rather than asserting the storages are empty, since the
    // app legitimately keeps an unrelated dark-mode preference in
    // localStorage (src/lib/theme.ts) that has nothing to do with auth.
    const jwtLike = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
    const authLikeKey = /token|jwt|refresh|access/i;

    for (const [key, value] of [...storageDump.local, ...storageDump.session]) {
      expect(authLikeKey.test(key), `unexpected auth-like storage key: "${key}"`).toBe(false);
      expect(jwtLike.test(value), `JWT-shaped value found in storage under "${key}"`).toBe(false);
    }
  });
});
