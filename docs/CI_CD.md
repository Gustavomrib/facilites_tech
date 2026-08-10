# CI/CD

Three GitHub Actions workflows exist. This doc covers the two added for
full-stack + staging validation; `backend-ci.yml` (backend lint/unit/build/
jest-e2e) is pre-existing and unchanged.

| Workflow | File | Trigger | What it proves |
|---|---|---|---|
| Backend CI | `.github/workflows/backend-ci.yml` | push to `main`, PRs touching `backend/**` | Backend lints, unit-tests, builds, and its own supertest-based e2e pass |
| **E2E PR gate** | `.github/workflows/e2e-pr.yml` | PRs touching frontend/backend/e2e paths, manual | Frontend build/typecheck, then the full Playwright suite against a real Postgres + real Nest backend + real Vite frontend |
| **Staging smoke** | `.github/workflows/staging-smoke.yml` | manual, daily 07:00 UTC | The non-destructive subset of the same suite against an already-deployed staging environment |

## `e2e-pr.yml`

Two jobs:

1. **`frontend-build`** — `npm ci && npm run build` (root). This is the
   `tsc -b && vite build` check — a broken type or a build-time error fails
   here, fast, before any service is provisioned.
2. **`e2e`** (needs job 1) — provisions a Postgres 16 service, then:
   `prisma generate` → `prisma migrate deploy` → backend `npm run build` →
   starts `node dist/main.js` in the background → polls
   `GET /api/health/ready` until it responds → runs
   `npm run test:e2e` (Playwright, against the auto-started Vite dev server
   per `playwright.config.ts`'s `webServer`) → uploads `playwright-report/`
   and `test-results/` as a build artifact **unconditionally** (`if: always()`),
   so a failing run still leaves traces/screenshots/video attached to the
   PR check.

No repository secrets are required — the Postgres credentials and JWT/cookie
secrets are dummy values scoped to that one ephemeral job (see the `env:`
block in the workflow file). Don't reuse them anywhere real.

### Reproducing it locally

```bash
docker compose -f backend/docker-compose.yml up -d postgres
cd backend && cp .env.example .env && npx prisma migrate deploy && npm run build && npm run start:dev
# in another shell, from the repo root:
VITE_API_BASE=http://localhost:3000/api npm run test:e2e
```

## `staging-smoke.yml`

Assumes staging is already deployed and running — it does not touch
Postgres or start a backend. It runs:

- `e2e/smoke.spec.ts` in full (dashboard, create/edit product, cash sale,
  fiado sale, honest 501 on `reports/send-now`)
- `e2e/auth.spec.ts`, filtered to only `session persistence` and
  `token storage` (session survives reload; no JWT-shaped value or
  auth-like key in `localStorage`/`sessionStorage`)

It deliberately **skips** the tests that register or log out through the UI
— staging's `/auth/register` and `/auth/login` are rate-limited in
production just like locally (see `docs/E2E_TESTING.md` §4), and this
workflow shouldn't be the thing that trips that limiter for real users.

### Required configuration

Create a `staging` GitHub Environment (Settings → Environments) and add two
**variables** (not secrets — they're just URLs) on it:

| Name | Example | Used for |
|---|---|---|
| `STAGING_BASE_URL` | `https://staging.example.com` | Frontend origin Playwright navigates to |
| `STAGING_API_BASE` | `https://staging-api.example.com/api` | Backend origin the test helpers call directly |

Using a GitHub Environment (rather than plain repo variables) lets you
attach required reviewers/wait timers to staging runs later, without
touching this workflow file.

A manual run can override either value via the `base_url` / `api_base`
workflow-dispatch inputs, e.g. to smoke-test a preview deployment instead of
the environment default.

**Not yet handled:** if staging sits behind HTTP basic auth or a
gateway-level auth header, this workflow has no way to inject it —
`playwright.config.ts` would need an `httpCredentials` / extra-headers entry
wired to a new secret. Out of scope for this change (kept minimal); see
Next steps.

## Environment variables reference

| Variable | Where | Meaning |
|---|---|---|
| `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `COOKIE_SECRET`, `CORS_ORIGIN`, `PORT`, `NODE_ENV` | backend runtime (`backend/.env.example`) | Standard Nest/Prisma/auth config — see that file's comments |
| `VITE_API_BASE` | frontend build/dev (`.env.example`) | Backend `/api` origin the SPA calls |
| `E2E_API_BASE` | Playwright helpers (`e2e/helpers/api.ts`) | Backend `/api` origin the test setup calls directly |
| `PLAYWRIGHT_BASE_URL` / `PLAYWRIGHT_PORT` | `playwright.config.ts` | Frontend origin/port under test |
| `PLAYWRIGHT_SKIP_WEBSERVER` | `playwright.config.ts` | Set when the frontend is already running elsewhere (staging) |
| `STAGING_BASE_URL` / `STAGING_API_BASE` | GitHub Environment `staging` (variables) | Staging URLs for `staging-smoke.yml` |

See `docs/E2E_TESTING.md` for running the suite locally and
`docs/STAGING_CHECKLIST.md` for the manual checks automation can't cover.
