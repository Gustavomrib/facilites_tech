# Staging Readiness Checklist — Auth & Session

Manual + automated checks before promoting the in-memory-token / httpOnly-
refresh-cookie auth model to staging (or any shared environment).

## Backend configuration

- [ ] `backend/.env` on staging has **real, unique** secrets for
      `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `COOKIE_SECRET` — not
      the `.env.example` placeholders.
- [ ] `NODE_ENV=production` on staging. This flips two things that matter
      for auth specifically: `AllExceptionsFilter` stops echoing raw
      exception messages for unexpected (5xx, non-HttpException) errors, and
      `AuthController.setRefreshCookie` sets `secure: true` on the refresh
      cookie (`backend/src/auth/auth.controller.ts`) — the cookie will not
      be sent over plain HTTP once this is on, so staging must be served
      over HTTPS.
- [ ] `CORS_ORIGIN` exactly matches the staging frontend's origin (scheme +
      host + port). A mismatch here fails silently in the browser as a CORS
      error, not an auth error — easy to misdiagnose.
- [ ] The refresh cookie's `sameSite: 'strict'` (hardcoded in
      `auth.controller.ts`) is compatible with how staging is accessed — if
      frontend and backend end up on different top-level domains, `strict`
      will block the cookie on cross-site navigations. Confirm they share a
      site, or revisit this setting deliberately (don't silently loosen it).
- [ ] Confirm the throttle limits on `/auth/register`, `/auth/login`,
      `/auth/refresh` are intentional for staging traffic (shared by a QA
      team hitting it repeatedly, that's easy to exhaust). See
      `docs/E2E_TESTING.md` §4 for how this affects test runs specifically.

## Frontend configuration

- [ ] `VITE_API_BASE` for the staging build points at the staging backend's
      `/api` path, over HTTPS.
- [ ] Build is the production Vite build (`npm run build`), not `vite dev`
      — confirm no dev-only behavior (e.g. verbose console logging of
      requests/tokens) ships.

## Auth behavior — automated (run `npm run test:e2e` against staging)

Point `PLAYWRIGHT_BASE_URL` / `E2E_API_BASE` at the staging URLs and run the
suite (see `docs/E2E_TESTING.md`). At minimum these must pass:

- [ ] Register → onboarding wizard reaches step 2 (`auth.spec.ts`)
- [ ] Login success and failure (`auth.spec.ts`)
- [ ] Protected routes redirect to `/login` when unauthenticated
      (`auth.spec.ts`)
- [ ] Session survives a full page reload (`auth.spec.ts`)
- [ ] Logout clears the session and protected routes redirect again
      (`auth.spec.ts`)
- [ ] No JWT-shaped value or auth-like key ever appears in `localStorage` /
      `sessionStorage` (`auth.spec.ts`) — this is the whole point of the
      in-memory-token design; a regression here silently reintroduces
      XSS-exfiltrable tokens.
- [ ] Dashboard load, create/edit product, cash sale, fiado sale, and the
      honest 501 on "send report now" (`smoke.spec.ts`)

## Auth behavior — manual spot checks (things the automated suite can't see)

- [ ] Open DevTools → Application → Cookies on the staging frontend origin
      after logging in. Confirm the refresh-token cookie shows `HttpOnly`
      and `Secure` and is **not** readable via `document.cookie` in the
      console.
- [ ] Leave a logged-in tab open past the access-token's expiry
      (`JWT_ACCESS_EXPIRES_IN`, default 15m) and perform an action — confirm
      the silent refresh kicks in transparently (no forced logout, no
      visible error) rather than just waiting for the access token to
      expire naturally during a real test run.
- [ ] Log in on two tabs, log out on one — confirm the other tab's next API
      call gets a 401, silent-refreshes and fails (revoked cookie), and
      lands on `/login` rather than hanging or looping.
- [ ] Confirm closing the browser fully and reopening it does **not**
      restore the session if "remember me" isn't a feature — i.e. the
      refresh cookie's lifetime (`JWT_REFRESH_EXPIRES_IN`) matches the
      intended session length, and expired cookies fail closed.

## Known gaps to flag, not silently work around

- [ ] `POST /reports/send-now` returns 501 by design (no email provider
      wired up yet — see `backend/src/reports/reports.controller.ts`). This
      is intentionally surfaced to the user via `alert()`, not swallowed.
      Confirm whoever owns the report feature knows this is still a stub
      before staging is shown to anyone expecting real email delivery.
