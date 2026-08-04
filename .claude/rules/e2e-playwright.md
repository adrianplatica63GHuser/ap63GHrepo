---
paths:
  - "e2e/**"
  - "playwright.config.ts"
---

# Playwright end-to-end suite

<!-- Harvested from the slice log. -->

- **Keep `workers: 1` and `fullyParallel: false` in `playwright.config.ts`.** Every spec shares one fixed fixture row — the "E2E Proprietate Test" property, whose uuid is cached in the gitignored `e2e/.auth/e2e-ids.json`. Parallel workers would have several specs appending versions to the same property row at once. Any new spec inherits this constraint; do not opt a spec back into parallelism.

- **Write RELATIVE assertions, never absolute ones.** The shared fixture row accumulates version history across every run, so assert `startVersion + 1` rather than a fixed version number. An absolute expectation passes once and then rots.

- **`e2e/auth.setup.ts` is the setup project: it logs in through the real `/login` form, pins `NEXT_LOCALE=ro-RO`, and creates or reuses the fixed property.** The `chromium` project then runs every spec from that saved session. Do not add per-spec login steps; extend the setup project instead.

- **Locators match the ROMANIAN strings in `messages/ro-RO.json`.** Shared locators live in `e2e/helpers/version-nav.ts`. Renaming a Romanian UI string breaks these tests by design — that is the point, not a defect. Adding a key is safe; renaming one means updating the locators in the same slice.

- **Fix a broken locator at the SOURCE when the UI genuinely lost the thing being asserted.** When a compact chip replaced the full ◀ / "v N" / ▶ strip, `src/components/version-nav-controls.tsx` gained a visually-hidden (`sr-only`) "v N" span rather than the spec being loosened — no visible change, and it closed a real accessibility gap. Prefer restoring the accessible name over weakening the assertion.

- **Running the suite needs local setup that CI does not have:** a running `npm run dev`, `E2E_EMAIL` and `E2E_PASSWORD` in `.env`, and a one-off `npx playwright install chromium`. Then `npm run e2e` or `npm run e2e:ui`.

- **The suite is deliberately NOT in CI.** CI has no Postgres, no dev server, no seeded user and no browser binaries, and `playwright.config.ts` has no `webServer` block. Do not wire it into the CI workflow as a side effect of another slice — that is its own slice.

- **Jest must keep excluding `e2e/`** via `testPathIgnorePatterns`.

- **`.dockerignore` must keep excluding `e2e`, `playwright.config.ts`, `playwright-report` and `test-results`,** so the live Supabase session cookie in `e2e/.auth/` never enters the build context.

- **Read `e2e/README.md` before touching the suite** — it is the full operating guide.
