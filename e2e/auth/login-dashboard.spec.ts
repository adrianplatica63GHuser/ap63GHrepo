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
 */

import { test, expect } from "@playwright/test";
import { sidebar } from "../helpers/sidebar";

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
