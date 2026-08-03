# E2E Testing (Playwright)

End-to-end tests for the auth flow (in-memory access token + httpOnly refresh
cookie + silent refresh) and the core app flows (dashboard, products, sales,
fiado, reports). Tests run against the **real backend** — nothing is mocked.

Runs automatically on every PR and against staging — see `docs/CI_CD.md`.

## 1. Prerequisites

Two things must be running before `npm run test:e2e`:

1. **Backend + Postgres**, reachable at the URL in `E2E_API_BASE`
   (default `http://localhost:3000/api`, matching `.env.example`'s
   `VITE_API_BASE`).
2. **Nothing else** — the frontend dev server is started automatically by
   Playwright's `webServer` config (`playwright.config.ts`), on port 5173
   by default, matching `backend/.env`'s `CORS_ORIGIN`.

### Starting the backend

```bash
cd backend
cp .env.example .env        # first time only; fill in real secrets
docker compose up -d postgres
npx prisma migrate deploy   # or `npm run prisma:migrate` in dev
npm run start:dev           # or `npm run build && npm run start:prod`
```

Confirm it's up: `curl http://localhost:3000/api/health/ready` (or open
`http://localhost:3000/docs` for Swagger).

## 2. Running the suite

```bash
npm run test:e2e:install   # one-time: downloads the Chromium binary
npm run test:e2e           # headless run
npm run test:e2e:ui        # interactive UI mode — best for authoring/debugging
npm run test:e2e:headed    # headed browser, same test set
npm run test:e2e:report    # opens the HTML report from the last run
```

Env overrides:

| Variable | Default | Purpose |
|---|---|---|
| `PLAYWRIGHT_BASE_URL` | `http://localhost:5173` | Frontend origin under test |
| `PLAYWRIGHT_PORT` | `5173` | Port Playwright's `webServer` starts Vite on |
| `E2E_API_BASE` | `http://localhost:3000/api` | Backend origin the test helpers call directly |
| `PLAYWRIGHT_SKIP_WEBSERVER` | unset | Set to skip auto-starting Vite (use when the frontend is already running elsewhere) |

## 3. How the suite is organized

- `e2e/auth.spec.ts` — register (via the onboarding wizard), login
  success/failure, protected-route redirect, session survival across a
  reload, logout, and the no-localStorage/sessionStorage guarantee for the
  access token.
- `e2e/smoke.spec.ts` — dashboard load, create/edit a product, a cash sale,
  a fiado (store-credit) sale tied to a new customer, and the honest 501 for
  "send report now".
- `e2e/fixtures.ts` — two ways to get an authenticated session:
  - `onboardedPage`: registers a **fresh** company for that one test. Use
    for anything that logs out or otherwise changes the session (cheap in
    test count, expensive in `/auth/register` calls).
  - `sharedOnboardedPage`: registers **one** company per Playwright worker
    and reuses it for every test that worker runs. Use for anything that
    only reads or adds data. Never use this for a test that logs out —
    that would break every other test sharing the worker.
- `e2e/helpers/api.ts` — calls `/auth/register` and `/companies/me` directly
  against the backend to set up state fast, bypassing the UI wizard for
  tests that aren't specifically about the wizard itself.

## 4. Why login/register is rate-limited — and what that means for you

`backend/src/auth/auth.controller.ts` throttles `/auth/register` and
`/auth/login` to **5 requests per 60 seconds**, and `/auth/refresh` to 10.
That's correct production behavior (brute-force/spam protection), but it
means:

- Running the full suite with high worker parallelism can produce **429s**
  that look like flaky failures but are actually the rate limiter doing its
  job.
- `playwright.config.ts` caps `workers` to 2 under `CI=true` for this
  reason. Locally, if you hit 429s, re-run with `npx playwright test
  --workers=1`.
- If your team wants full-parallelism CI runs, the real fix is a
  **higher throttle limit in a non-production config** (e.g. a
  `NODE_ENV=test` override in `backend/src/config`), not loosening the
  tests. Don't relax production rate limits just to make CI faster.

**Known residual flake, distinct from the above**: even with the throttle
retry logic (`e2e/helpers/waits.ts`'s `gotoAndWaitForDashboard`) and a
generous `--workers=1` test timeout, the *last* test in `smoke.spec.ts` has
occasionally hung on a `page.waitForEvent('dialog')` for several minutes
before Playwright's own timeout force-closes the browser — after the
network trace shows the actual request/response it was waiting on already
completed in under a second. The test passes in under 4s every time it's
run standalone (`npx playwright test -g "<test name>"`), so this isn't a
bug in the feature or the test's logic — it reproduces only as the tail
test of a long (6–7 minute), single-worker, single-browser-process run,
which points at some form of resource/event-loop accumulation in that one
long-lived process rather than anything app-specific. If it recurs: rerun
just that test standalone to confirm the feature is fine, and consider
splitting this file so no single browser process runs 15+ dialog-driven
tests back to back.

## 5. Debugging a failure

Every run captures, on failure only: a trace (`trace: 'retain-on-failure'`),
a screenshot, and a video. `npm run test:e2e:report` opens the HTML report
with all three. `npx playwright show-trace <path>.zip` opens a single trace
directly.

## 6. What this suite intentionally does NOT do

- It does not reset the database between runs. Every test provisions its own
  company via a timestamp+random email (`e2e/helpers/users.ts`), so reruns
  never collide — but test data accumulates. Point this suite at a database
  you're fine littering (a local/staging DB), never production.
- It does not stand up Postgres or the backend for you. Orchestrating a
  multi-service stack (migrations included) is out of scope for
  Playwright's `webServer`; see §1.
