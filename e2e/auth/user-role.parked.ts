/**
 * Case:   TC-AUTH-02 — Un cont „user" lucrează zilnic și nu poate administra
 * Source: docs/testing/cases/TC-AUTH-02.md, „Last green" — (not yet driven)
 *
 * ⚠️ **PARKED — NOT RUN, BY THE CATALOGUE'S RULE.** (Slice #36.20) Its case is
 * `draft`: it waits for an account whose role is `user`, which is Adrian's to
 * create (the case's „What Adrian is asked for"). The name `.parked.ts` keeps
 * it out of Playwright's `*.spec.ts` match and out of the coverage guard, and
 * inside `tsc`. TO PROMOTE: drive TC-AUTH-02 twice unchanged (→ `confirmed`),
 * rename this to `user-role.spec.ts`, put the path in the catalogue's `Spec`
 * column, update the `Source:` date above.
 *
 * It runs as the `user` account — `test.use({ storageState: USER_STATE })`,
 * saved by `auth.setup.ts` from E2E_USER_EMAIL — inside the one `chromium`
 * project, and skips itself when that account is not configured.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - Step 1's sign-in is `auth.setup.ts`'s, from `.env`; the spec asserts what
 *     follows it.
 *   - The writes in the case's matrix are the spec's alone: a person cannot
 *     send them. Each is marked `TC-E2E-AUTH-02`, and each has its undo, run
 *     as the superuser through a second request context, for the day one of
 *     them wrongly succeeds.
 *   - The sidebar is found as the <nav> that holds „Proprietăți — Listă", not by
 *     „Admin-Operațiuni" as helpers/sidebar.ts does — that section is exactly
 *     what a `user` does not have.
 */

import fs from "fs";
import { randomUUID } from "crypto";
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { SUPERUSER_STATE, USER_STATE } from "../helpers/auth-state";
import { E2E_MARKER } from "../helpers/records";

const MARK = `${E2E_MARKER}AUTH-02`;

test.use({ storageState: fs.existsSync(USER_STATE) ? USER_STATE : undefined });

test.describe("TC-AUTH-02 — Un cont „user\" lucrează zilnic și nu poate administra", () => {
  test.skip(!fs.existsSync(USER_STATE), "No `user` account: E2E_USER_EMAIL / E2E_USER_PASSWORD are not in .env.");

  test("ecranele zilnice se deschid; administrarea nu se deschide", async ({ page }) => {
    test.slow();

    // Step 1 — the dashboard, signed in as the `user`.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Tablou de bord" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Autentificat ca")).toHaveText(/^Autentificat ca \S+/);

    // Step 2 — the sidebar: the daily sections, and no administration.
    const nav = page.locator("nav").filter({ hasText: /Proprietăți — Listă/ });
    for (const section of ["Persoane Fizice", "Persoane Juridice", "Proprietăți — Listă", "Proprietăți — Hartă", "Acte"]) {
      await expect(nav.getByText(section, { exact: true })).toBeVisible();
    }
    await expect(nav.getByText("Admin-Operațiuni", { exact: true })).toHaveCount(0);
    await expect(nav.getByText("Admin-Configurare", { exact: true })).toHaveCount(0);
    const quickSearch = page.getByPlaceholder("Nume, cod…");
    await expect(quickSearch).toBeVisible();

    // Steps 3–4 — an admin address typed by hand lands on the dashboard.
    for (const address of ["/admin/value-lists", "/admin/users"]) {
      await page.goto(address);
      await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Tablou de bord" })).toBeVisible({ timeout: 30_000 });
    }

    // Step 5 — the three lists open, each with its „Adaugă…".
    for (const [label, heading, add] of [
      ["Proprietăți — Listă", "Proprietăți", "Adaugă proprietate"],
      ["Persoane Fizice", "Persoană fizică", "Adaugă persoană"],
      ["Acte", "Acte", "Adaugă act"],
    ] as const) {
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(add, { exact: true }).first()).toBeVisible();
    }

    // Step 6 — the quick search reaches Căutare globală, not the dashboard.
    await quickSearch.fill("PROP");
    await quickSearch.press("Enter");
    await expect(page).toHaveURL(/\/admin\/global-search\?search=PROP$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Căutare globală" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/^\d+ rezultat/).first()).toBeVisible({ timeout: 30_000 });
  });

  test("scrierile din /api/admin răspund 403 și nu schimbă nimic", async ({ page, baseURL }) => {
    test.slow();
    const admin: APIRequestContext = await playwrightRequest.newContext({ baseURL, storageState: SUPERUSER_STATE });
    const valueName = `${MARK} Relație`;
    const helpBefore = await admin.get("/api/admin/help-content/dashboard");
    expect(helpBefore.ok(), `GET help-content/dashboard as superuser failed (${helpBefore.status()})`).toBeTruthy();
    const helpSnapshot = ((await helpBefore.json()) as { item?: Record<string, string | null> | null }).item ?? null;

    try {
      // A value in a closed list.
      const value = await page.request.post("/api/admin/value-lists/property-property-roles", {
        data: { name: valueName, description: MARK },
      });
      expect(value.status()).toBe(403);

      // A role pair — ids that exist nowhere, so even a wrong success writes nothing.
      const pair = await page.request.post("/api/admin/doc-type-person-roles", {
        data: { documentTypeId: randomUUID(), personRoleId: randomUUID() },
      });
      expect(pair.status()).toBe(403);

      // Help text.
      const help = await page.request.put("/api/admin/help-content/dashboard", {
        data: { howToRo: `${MARK} — nu trebuie să ajungă aici` },
      });
      expect(help.status()).toBe(403);

      // …and nothing changed.
      const list = (await (await admin.get("/api/admin/value-lists/property-property-roles")).json()) as { items: { name: string }[] };
      expect(list.items.filter((i) => i.name === valueName)).toHaveLength(0);
      const helpAfter = ((await (await admin.get("/api/admin/help-content/dashboard")).json()) as { item?: unknown }).item ?? null;
      expect(helpAfter).toEqual(helpSnapshot);
    } finally {
      // The undo for a write that wrongly succeeded, as the superuser.
      const list = (await (await admin.get("/api/admin/value-lists/property-property-roles")).json()) as { items: { id: string; name: string }[] };
      for (const i of list.items.filter((x) => x.name === valueName)) {
        await admin.delete(`/api/admin/value-lists/property-property-roles/${i.id}`);
      }
      const now = ((await (await admin.get("/api/admin/help-content/dashboard")).json()) as { item?: Record<string, string | null> | null }).item ?? null;
      if (JSON.stringify(now) !== JSON.stringify(helpSnapshot) && helpSnapshot) {
        await admin.put("/api/admin/help-content/dashboard", {
          data: {
            backgroundEn: helpSnapshot.backgroundEn ?? null,
            backgroundRo: helpSnapshot.backgroundRo ?? null,
            howToEn: helpSnapshot.howToEn ?? null,
            howToRo: helpSnapshot.howToRo ?? null,
          },
        });
      }
      await admin.dispose();
    }
  });
});
