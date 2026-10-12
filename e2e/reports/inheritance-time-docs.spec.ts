/**
 * Case:   TC-INHER-03 — „Arbori de moștenire” în timp: actele fiecărei persoane, „Acte comune” și anul care estompează
 * Source: docs/testing/cases/TC-INHER-03.md, „Last green" 2026-10-12
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The two persons, their tie, the document and the two links to it are created through the routes the screens
 *     call — „Asociază persoană" posts to /api/people/<id>/references, „Asociază" on the document to
 *     /api/documents/<id>/persons — with `TC-E2E-INHER-03` names, and removed in `finally`.
 *   - The tree is opened on Ion (`?focus=`, as the person tile's „Deschide arborele întreg" does), which puts it at
 *     the near level, where the badges are drawn.
 *   - The tree draws the archive's real families beside the test one. The pictures paint over every node and every
 *     shared count that is not the test family's (Playwright's `mask`). capture-and-personal-data.md.
 *   - The slider is set with `fill`, which is what a drag ends in.
 */

import { test, expect, type APIRequestContext, type Page } from "../helpers/test";
import { E2E_MARKER, createDocumentOfType, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}INHER-03`;
const SHOTS = "playwright-report/inheritance-tree";
const ROLES = "/api/admin/value-lists/person-roles";

async function roleId(request: APIRequestContext, name: string): Promise<string> {
  const items = ((await (await request.get(ROLES)).json()) as { items: { id: string; name: string; kinship: string | null }[] }).items;
  const role = items.find((r) => r.name === name && r.kinship !== null);
  expect(role, `the role „${name}” with a kinship (migration_106)`).toBeTruthy();
  return role!.id;
}

/** `holder` holds `role` towards `other` — as „Asociază persoană" on `other`'s screen, ticking `holder`. */
async function tie(request: APIRequestContext, holder: string, role: string, other: string): Promise<void> {
  const res = await request.post(`/api/people/${other}/references`, { data: { personIds: [holder], relationshipRoleId: role } });
  expect(res.ok(), `POST references failed (${res.status()})`).toBeTruthy();
}

const node = (page: Page, id: string) => page.locator(`[data-tree-node="${id}"]`);

test.describe("TC-INHER-03 — arborele în timp și actele din spatele lui", () => {
  test("fiecare insignă citește 1; „Acte comune” pune 1 pe linie; anul dinaintea Anei o estompează", async ({ page }) => {
    test.setTimeout(240_000);
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const ids: string[] = [];
    let doc: string | null = null;
    try {
      const ion = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion", gender: "MALE", dateOfBirth: "1955-06-10" });
      ids.push(ion);
      const ana = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ana", gender: "FEMALE", dateOfBirth: "1982-01-15" });
      ids.push(ana);
      await tie(page.request, ion, await roleId(page.request, "Tată"), ana);
      doc = await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} Act`, { nrDocument: "123/2001", dateDocument: "2001-05-02" });
      const linked = await page.request.post(`/api/documents/${doc}/persons`, { data: { personIds: [ion, ana] } });
      expect(linked.ok(), `POST persons failed (${linked.status()})`).toBeTruthy();
      const pair = [ion, ana].sort().join("|");
      const others = [
        `[data-tree-node]${ids.map((id) => `:not([data-tree-node="${id}"])`).join("")}`,
        `[data-tree-shared]:not([data-tree-shared="${pair}"])`,
      ].join(", ");

      // Step 1 — the tree on Ion, near: a badge on Ion and one on Ana, each „1".
      await page.goto(`/inheritance-tree?focus=${ion}`);
      const frame = page.getByRole("dialog", { name: "Arbori de moștenire" });
      await expect(frame.getByRole("heading", { name: "Arbori de moștenire", exact: true })).toBeVisible({ timeout: 30_000 });
      const canvas = frame.locator("[data-tree-level]");
      await expect(canvas).toHaveAttribute("data-tree-level", "3", { timeout: 30_000 });
      await frame.locator("[data-tree-card]").getByRole("button", { name: "Închide", exact: true }).click();
      await expect(node(page, ion).locator("[data-tree-docs-count]")).toHaveText("1");
      await expect(node(page, ana).locator("[data-tree-docs-count]")).toHaveText("1");

      // Step 2 — Ion's badge: the list of his documents, one — the contract.
      await node(page, ion).getByRole("button", { name: "Un act", exact: true }).click();
      const list = frame.locator("[data-tree-docs]");
      await expect(list).toContainText(`Actele pe care apare Ion ${MARK}`);
      await expect(list.locator("[data-tree-doc]")).toHaveCount(1);
      await expect(list.locator(`[data-tree-doc="${doc}"]`)).toContainText("nr. 123/2001 · din 02.05.2001");
      await page.mouse.move(5, 450);
      await page.screenshot({ path: `${SHOTS}/documents-off-1366.png`, mask: [page.locator(others)] });
      await list.getByRole("button", { name: "Închide", exact: true }).click();
      await expect(list).toBeHidden();

      // Step 3 — „Acte comune" is off; on, the line between Ion and Ana reads „1", which lists the contract.
      const sw = frame.getByRole("switch", { name: "Acte comune" });
      await expect(sw).not.toBeChecked();
      await expect(frame.locator("[data-tree-shared]")).toHaveCount(0);
      await frame.getByText("Acte comune", { exact: true }).click();
      await expect(sw).toBeChecked();
      const line = frame.locator(`[data-tree-shared="${pair}"]`);
      await expect(line.locator("[data-tree-shared-count]")).toHaveText("1");
      await page.mouse.move(5, 450);
      await page.screenshot({ path: `${SHOTS}/documents-on-1366.png`, mask: [page.locator(others)] });
      await line.click();
      await expect(list).toContainText(`Acte comune: Ion ${MARK} și Ana ${MARK}`);
      await expect(list.locator(`[data-tree-doc="${doc}"]`)).toBeVisible();
      await list.getByRole("button", { name: "Închide", exact: true }).click();

      // Step 4 — „Anul" before Ana's birth year: Ana fades, Ion does not.
      const slider = frame.getByRole("slider", { name: "Anul" });
      await expect(frame.locator("[data-tree-year]")).toHaveText("azi");
      await expect(node(page, ana)).not.toHaveAttribute("data-tree-faded", "");
      await slider.fill("1970");
      await expect(frame.locator("[data-tree-year]")).toHaveText("1970");
      await expect(node(page, ana)).toHaveAttribute("data-tree-faded", "");
      await expect(node(page, ion)).not.toHaveAttribute("data-tree-faded", "");
      await page.mouse.move(5, 450);
      await page.screenshot({ path: `${SHOTS}/year-1970-1366.png`, mask: [page.locator(others)] });

      // Step 5 — the contract, from Ion's list, opens its screen.
      await node(page, ion).getByRole("button", { name: "Un act", exact: true }).click();
      await list.locator(`[data-tree-doc="${doc}"]`).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${doc}$`), { timeout: 30_000 });
    } finally {
      if (doc) await removeRecord(page.request, "document", doc);
      for (const id of ids) await removeRecord(page.request, "person", id);
    }
  });
});
