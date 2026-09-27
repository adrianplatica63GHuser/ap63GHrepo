/**
 * Case:   TC-AUTH-01 — Conectare și tabloul de bord
 * Source: docs/testing/cases/TC-AUTH-01.md, „Last green" — (never driven; see below)
 *
 * ⚠️ **THE ONE CASE PROMOTED WITHOUT BEING DRIVEN, AND ON PURPOSE.** Claude may
 * not type a password into a field, so steps 2–4 of this case will never be
 * driven by hand. `e2e/auth.setup.ts` performs them on every run, from
 * `E2E_EMAIL` / `E2E_PASSWORD` in `.env` — through the real `/login` form,
 * pressing the real „Conectare" button — and every spec, this one included,
 * starts from the session it saved. So this spec asserts only what the case
 * asserts AFTER login (steps 5–8), and its green run is the case's proof. The
 * exception is written into docs/testing/TEST-CATALOGUE.md and into
 * PROMOTED_WITHOUT_DRIVING in src/lib/testing/catalogue-map.ts, so it does not
 * become a precedent by accident.
 *
 * Steps 1–4 (the form, typing, „Se conectează…"): not here. auth.setup.ts
 * fills `#identity` / `#password` and would fail the whole run if login
 * failed, which is the assertion those steps carry.
 *
 * Nothing is created, so nothing is removed.
 *
 * ── Step 9: sign out and back in, in the same tab (Slice #37.01) ──────────
 * Adrian, 2026-09-26: after „Ieșire" and a sign-in in the same tab, both
 * administration sections were gone. The second describe below does exactly
 * that, in a context of its OWN — not the saved session every other spec
 * shares — and with Supabase's `/auth/v1/logout` answered here rather than
 * sent: the app's „Ieșire" calls `signOut()`, whose default scope is GLOBAL,
 * and a real one would revoke the account's every session — the saved one
 * the specs after this one run on, and Adrian's own browser's. The browser
 * still drops its session exactly as it would (supabase-js removes it on any
 * successful logout answer), which is all the case is about.
 *
 * The reverse — the superuser signs out and a `user` signs in — runs only
 * when `auth.setup.ts` could save the `user` account's session (E2E_USER_EMAIL,
 * TC-AUTH-02), and skips with that reason otherwise.
 */

import fs from "fs";
import { test, expect, type Page } from "@playwright/test";
import { sidebar } from "../helpers/sidebar";
import { USER_STATE } from "../helpers/auth-state";
import { fillLoginForm } from "../helpers/login-form";

test.describe("TC-AUTH-01 — Conectare și tabloul de bord", () => {
  test("după conectare: tabloul de bord, bara laterală și numele contului", async ({ page }) => {
    // Step 5 — the address is `/` and the login form is gone.
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: "Conectare", exact: true })).toHaveCount(0);

    // Step 6 — „Tablou de bord", and under it „Ce necesită atenția dumneavoastră azi".
    await expect(page.getByRole("heading", { name: "Tablou de bord" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Ce necesită atenția dumneavoastră azi")).toBeVisible();

    // Step 7 — the sidebar's sections, scoped to the sidebar (helpers/sidebar.ts).
    const nav = sidebar(page);
    for (const section of [
      "Persoane Fizice",
      "Persoane Juridice",
      "Proprietăți — Listă",
      "Proprietăți — Hartă",
      "Acte",
      "Admin-Operațiuni",
      "Admin-Configurare",
    ]) {
      await expect(nav.getByText(section, { exact: true })).toBeVisible();
    }
    // Step 7's „RECENTE" list is NOT asserted: it renders only once a record
    // has been opened in this browser (`recently-viewed-panel.tsx` returns null
    // on an empty history, which lives in localStorage), and the session
    // auth.setup.ts saves has opened nothing. The case file says so.

    // Step 8 — at the TOP of the sidebar: „Autentificat ca", and the account's
    // name. The name is whatever the account is called, so the spec asserts
    // that one follows, not which.
    await expect(page.getByText("Autentificat ca")).toHaveText(/^Autentificat ca \S+/);
  });
});

// ── Step 9 ───────────────────────────────────────────────────────────────────

const ADMIN_SECTIONS = ["Admin-Operațiuni", "Admin-Configurare"] as const;

/** The <nav> that holds the daily sections — present for every role. */
function mainNav(page: Page) {
  return page.locator("nav").filter({ hasText: /Proprietăți — Listă/ });
}

/** Fill the real form on the page that is already open, and wait for „/". */
async function signInHere(page: Page, email: string, password: string): Promise<void> {
  await fillLoginForm(page, email, password);
  await page.click('button[type="submit"]');
  // router.push("/") is a pushState navigation: no "load" event (auth.setup.ts).
  await page.waitForURL(/\/$/, { timeout: 20_000, waitUntil: "commit" });
  await expect(page.getByRole("heading", { name: "Tablou de bord" })).toBeVisible({ timeout: 30_000 });
}

async function signOutHere(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Ieșire", exact: true }).click();
  await page.waitForURL(/\/login$/, { timeout: 20_000, waitUntil: "commit" });
  await expect(page.getByRole("button", { name: "Conectare", exact: true })).toBeVisible({ timeout: 30_000 });
}

test.describe("TC-AUTH-01 — ieșire și conectare din nou, în aceeași filă", () => {
  // A context of its own: no saved session, and Romanian from the first page.
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page, baseURL }) => {
    await page.context().addCookies([
      { name: "NEXT_LOCALE", value: "ro-RO", domain: new URL(baseURL!).hostname, path: "/" },
    ]);
    // Never a real, global sign-out — see the header.
    await page.context().route("**/auth/v1/logout**", (route) =>
      route.fulfill({ status: 204, body: "" }),
    );
  });

  test("administratorul iese și intră din nou: ambele secțiuni de administrare, fără reîncărcare", async ({ page }) => {
    const email = process.env.E2E_EMAIL!;
    const password = process.env.E2E_PASSWORD!;

    await page.goto("/login");
    await signInHere(page, email, password);
    for (const section of ADMIN_SECTIONS) {
      await expect(mainNav(page).getByText(section, { exact: true })).toBeVisible();
    }

    await signOutHere(page);
    // The same document from here on: no goto, no reload.
    await signInHere(page, email, password);
    for (const section of ADMIN_SECTIONS) {
      await expect(mainNav(page).getByText(section, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("Autentificat ca")).toHaveText(/^Autentificat ca \S+/);
  });

  test("după administrator, un cont „user” nu vede nicio secțiune de administrare", async ({ page }) => {
    test.skip(
      !fs.existsSync(USER_STATE),
      "No `user` account signs in: E2E_USER_EMAIL / E2E_USER_PASSWORD are not in .env, or auth.setup.ts skipped them.",
    );

    await page.goto("/login");
    await signInHere(page, process.env.E2E_EMAIL!, process.env.E2E_PASSWORD!);
    for (const section of ADMIN_SECTIONS) {
      await expect(mainNav(page).getByText(section, { exact: true })).toBeVisible();
    }

    await signOutHere(page);
    await signInHere(page, process.env.E2E_USER_EMAIL!, process.env.E2E_USER_PASSWORD!);
    await expect(mainNav(page).getByText("Acte", { exact: true })).toBeVisible();
    for (const section of ADMIN_SECTIONS) {
      await expect(mainNav(page).getByText(section, { exact: true })).toHaveCount(0);
    }
  });
});
