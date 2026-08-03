export interface TestUser {
  companyName: string;
  name: string;
  email: string;
  password: string;
}

/**
 * Meets both the frontend's client-side rule (Onboarding.tsx: min 8 chars,
 * upper+lower+digit) and the backend's RegisterDto validation — kept as a
 * literal so a change to either rule surfaces as a visible test failure
 * rather than a silently-different generated password.
 */
const TEST_PASSWORD = 'Teste123!';

export function createTestUser(prefix = 'e2e'): TestUser {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  return {
    companyName: `Loja E2E ${unique}`,
    name: 'QA Tester',
    email: `${prefix}.${unique}@example.com`,
    password: TEST_PASSWORD,
  };
}
