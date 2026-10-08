/**
 * Case:   TC-AUTH-02 — Contul care era „user" are toată aplicația, ca administratorul
 * Source: docs/testing/cases/TC-AUTH-02.md, „Last green" — (never driven: Adrian's sign-in)
 *
 * PARKED — outside Playwright's match (`*.spec.ts`) until two unchanged hand runs
 * confirm the case, which waits for Adrian to sign in as `test-user`.
 *
 * Slice #38.21 rewrote it. Until then it asserted that a `user` was refused —
 * the sidebar without administration, `/admin/*` sending it to `/`, and a 403
 * for one write per guarded family of routes. Since #38.21 every account with
 * an `app_users` row has the whole application (`hasFullAccess`,
 * src/lib/auth/current-role.ts), so each of those refusals would now be an
 * allowed write; the spec follows the case's new steps instead, and writes
 * nothing.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - Step 1's sign-in is `auth.setup.ts`'s, from `.env`; the spec asserts what
 *     follows it.
 */

import fs from "fs";
import { test, expect } from "@playwright/test";
import { USER_STATE } from "../helpers/auth-state";
import { openFromSidebar, sidebar } from "../helpers/sidebar";

const SIX = ["Tablou de bord", "Domeniu", "Instrumente", "Import", "Administrare", "Setări"]; // #38.42: the six drawn

test.use({ storageState: fs.existsSync(USER_STATE) ? USER_STATE : undefined });

test.describe("TC-AUTH-02 — Contul care era „user\" are toată aplicația, ca administratorul", () => {
  test.skip(!fs.existsSync(USER_STATE), "No `user` account: E2E_USER_EMAIL / E2E_USER_PASSWORD are not in .env.");

  test("șase secțiuni, Utilizatori & Acces, Date de referință, Etichete", async ({ page }) => {
    // Step 1 — the dashboard, signed in as the account that was a `user`.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Tablou de bord" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Autentificat ca")).toHaveText(/^Autentificat ca \S+/);

    // Step 2 — all six sections drawn (#38.42).
    const rows = sidebar(page).locator(":scope > *");
    await expect(rows).toHaveCount(SIX.length);
    expect((await rows.allInnerTexts()).map((t) => t.trim().split("\n")[0])).toEqual(SIX);

    // Step 3 — „Administrare" → „Utilizatori & Acces", no role on the screen.
    await openFromSidebar(page, "Utilizatori & Acces", "Administrare");
    await expect(page).toHaveURL(/\/admin\/users$/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Cereri în așteptare/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Istoric", exact: true })).toBeVisible();
    await expect(page.getByText(/\b(superuser|rol)\b/i)).toHaveCount(0);

    // Step 4 — an administration address typed by hand opens.
    await page.goto("/admin/value-lists");
    await expect(page).toHaveURL(/\/admin\/value-lists$/);
    await expect(page.getByRole("heading", { name: "Date de referință" })).toBeVisible({ timeout: 30_000 });

    // Step 5 — „Administrare" → „Etichete".
    await openFromSidebar(page, "Etichete", "Administrare");
    await expect(page).toHaveURL(/\/admin\/tags$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Etichete" })).toBeVisible({ timeout: 30_000 });
  });
});
