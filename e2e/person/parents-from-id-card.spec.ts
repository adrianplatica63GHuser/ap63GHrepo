/**
 * Case:   TC-PERS-08 — „Adaugă nou" cu o carte de identitate: tatăl și mama create și legate ca „Tată" și „Mamă"
 * Source: docs/testing/cases/TC-PERS-08.md, „Last green" 2026-10-07
 *
 * A translation of the case file, step for step (Slice #38.29). Every Romanian
 * string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The names carry `TC-E2E-PERS-08` (e2e/helpers/records.ts), and every
 *     person they name is removed in `finally`.
 *   - Step 8's provenance and note are read from the routes the screen reads —
 *     Căutare globală's row and `/api/people/[id]` — rather than off the tab.
 *   - „Corelate" is ticked with `showTile`, in this browser's own profile.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, removeLeftovers } from "../helpers/records";
import { openFromSidebar } from "../helpers/sidebar";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}PERS-08`;
const HOLDER = `Andrei ${MARK}`;
const FATHER = `Ion ${MARK}`;
const MOTHER_SURNAME = `${MARK}-MAMA`;
const MOTHER = `Maria ${MOTHER_SURNAME}`;

/** The related tile's rows, as their text. */
async function relatedRows(page: Page): Promise<string[]> {
  const tile = await showTile(page, "Corelate");
  const rows = tile.locator("[data-related-group] li[data-one-line-row] [data-row-content]");
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  return (await rows.allInnerTexts()).map((s) => s.trim());
}

async function personIdNamed(page: Page, name: string): Promise<string> {
  const res = await page.request.get(`/api/admin/global-search?search=${encodeURIComponent(name)}`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { results: { entityId: string; displayName: string; provenance: string | null }[] };
  const row = body.results.find((r) => r.displayName === name);
  expect(row, `no person named ${name}`).toBeTruthy();
  return row!.entityId;
}

test.describe("TC-PERS-08 — părinții din cartea de identitate, la „Adaugă nou”", () => {
  test("tatăl și mama create după titular, legați ca „Tată” și „Mamă”, cu proveniența și nota lor", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1366, height: 900 });
    await removeLeftovers(page.request, MARK);
    try {
      // Step 1 — the form; no fold yet.
      await page.goto("/");
      await openFromSidebar(page, "Persoane Fizice");
      await page.getByRole("link", { name: "Adaugă persoană" }).click();
      await expect(page).toHaveURL(/\/natural-persons\/new$/, { timeout: 30_000 });
      await page.getByLabel(/^Nume(\s|$)/).fill(MARK);
      await page.getByLabel(/^Prenume(\s|$)/).fill("Andrei");
      await page.getByLabel(/^Gen(\s|$)/).selectOption("MALE");
      const fold = page.locator("[data-parents-fold]");
      await expect(fold).toHaveCount(0);

      // Step 2 — „Carte de identitate": the fold, both unticked, the holder's surname.
      await page.getByLabel(/^Tip document(\s|$)/).selectOption("ID_CARD");
      await expect(fold.getByRole("heading", { name: "Părinții titularului" })).toBeVisible();
      const father = fold.getByRole("checkbox", { name: "Creează și tatăl" });
      const mother = fold.getByRole("checkbox", { name: "Creează și mama" });
      await expect(father).not.toBeChecked();
      await expect(mother).not.toBeChecked();
      await expect(fold.getByLabel("Numele tatălui")).toHaveValue(MARK);
      await expect(fold.getByLabel("Numele mamei")).toHaveValue(MARK);

      // Step 3 — both ticked and named; the mother's surname replaced.
      await father.check();
      await fold.getByLabel("Prenumele tatălui").fill("Ion");
      await mother.check();
      await fold.getByLabel("Prenumele mamei").fill("Maria");
      await fold.getByLabel("Numele mamei").fill(MOTHER_SURNAME);
      await expect(fold.locator('[data-parent="FATHER"]')).toContainText("Numele titularului, presupus — verificați-l");
      await expect(fold.locator('[data-parent="MOTHER"]')).not.toContainText("Numele titularului, presupus");

      // Step 4 — saved: the father's dialog, by name only, a new person.
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Tatăl titularului" })).toBeVisible({ timeout: 30_000 });
      await expect(dialog).toContainText("Părintele 1 din 2");
      await expect(dialog).toContainText("Fără CNP, potrivirea se face doar după nume");
      await expect(dialog).toContainText("Persoană nouă");

      // Step 5 — created; the mother's dialog.
      await dialog.getByRole("button", { name: "Creează și leagă", exact: true }).click();
      await expect(dialog.getByRole("heading", { name: "Mama titularului" })).toBeVisible({ timeout: 30_000 });
      await expect(dialog).toContainText("Părintele 2 din 2");

      // Step 6 — created; the list.
      await dialog.getByRole("button", { name: "Creează și leagă", exact: true }).click();
      await expect(page).toHaveURL(/\/natural-persons$/, { timeout: 30_000 });

      // Step 7 — the holder's „Corelate": „Tată" and „Mamă".
      const holderId = await personIdNamed(page, HOLDER);
      await page.goto(`/natural-persons/${holderId}`);
      await expect(page.getByRole("heading", { name: HOLDER })).toBeVisible({ timeout: 30_000 });
      expect((await relatedRows(page)).sort()).toEqual([`${FATHER} (Tată)`, `${MOTHER} (Mamă)`].sort());

      // Step 8 — the father's: „Fiu"; its provenance and its note.
      const fatherId = await personIdNamed(page, FATHER);
      await page.goto(`/natural-persons/${fatherId}`);
      await expect(page.getByRole("heading", { name: FATHER })).toBeVisible({ timeout: 30_000 });
      expect(await relatedRows(page)).toEqual([`${HOLDER} (Fiu)`]);
      const search = (await (await page.request.get(`/api/admin/global-search?search=${encodeURIComponent(FATHER)}`)).json()) as {
        results: { displayName: string; provenance: string | null }[];
      };
      expect(search.results.find((r) => r.displayName === FATHER)?.provenance).toBe("RELATIVE_ID_CARD");
      const person = (await (await page.request.get(`/api/people/${fatherId}`)).json()) as {
        person: { notes: string | null };
        natural: { gender: string | null };
      };
      expect(person.natural.gender).toBe("MALE");
      expect(person.person.notes).toMatch(new RegExp(`^Creat din cartea de identitate a lui ${MARK} Andrei \\(PPERS\\d+\\)$`));
    } finally {
      // At the end — the three persons.
      await removeLeftovers(page.request, MARK);
    }
  });
});
