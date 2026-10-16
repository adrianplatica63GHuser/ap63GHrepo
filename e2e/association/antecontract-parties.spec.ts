/**
 * Case:   TC-ASSOC-14 — Promitentul vânzător și promitentul cumpărător în „Părți" pe un Antecontract
 * Source: docs/testing/cases/TC-ASSOC-14.md, „Last green" 2026-10-15
 *
 * A translation of the case file, step for step (Slice #39.57). The antecontract follows the sale contract's
 * rule for „Părți" (src/lib/documents/sale-parties.ts): the links whose role holds a share are its parties, in
 * „Părți"; the notary stays on „Legături", with the line that says where the parties are.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The three people and the antecontract are made through the POST routes the „Adaugă" forms send, and the
 *     three links through the route „Asociere persoană" sends (POST /api/documents/[id]/persons, one person and
 *     one role at a time), the roles found by name among the antecontract's own (valid-person-roles).
 *   - A `finally` removes all four records through the DELETE routes „Șterge" calls, which drop the links too.
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createDocumentOfType, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { hideTile, lineRow, showTile, tileBox } from "../helpers/tiles";

const MARK = `${E2E_MARKER}ASSOC-14`;
const SELLER = `Andrei ${MARK} Vanzator`;
const BUYER = `Elena ${MARK} Cumparator`;
const NOTARY = `Mihai ${MARK} Notar`;
const ANTECONTRACT = `${MARK} Antecontract de test`;

const partiesOf = (page: Page) => page.locator('[data-tile="parties"]').filter({ visible: true });

test.describe("TC-ASSOC-14 — Promitentul vânzător și promitentul cumpărător în „Părți” pe un Antecontract", () => {
  test("părțile în „Părți”, sub rolul lor, cu „Cotă”; notarul pe „Legături”; „Părți” debifată le întoarce pe „Legături”", async ({ page }) => {
    test.setTimeout(240_000);
    await removeLeftovers(page.request, MARK);
    const sellerId = await createNaturalPerson(page.request, { lastName: `${MARK} Vanzator`, firstName: "Andrei" });
    const buyerId = await createNaturalPerson(page.request, { lastName: `${MARK} Cumparator`, firstName: "Elena" });
    const notaryId = await createNaturalPerson(page.request, { lastName: `${MARK} Notar`, firstName: "Mihai" });
    const documentId = await createDocumentOfType(page.request, "ANTECONTRACT", ANTECONTRACT);

    try {
      // Step 1 — the three links, each with its role, as „Asociere persoană” sends them.
      const rolesRes = await page.request.get(`/api/documents/${documentId}/valid-person-roles`);
      expect(rolesRes.ok(), `valid-person-roles ${rolesRes.status()}`).toBeTruthy();
      const body = (await rolesRes.json()) as { items?: { id: string; name: string }[] } | { id: string; name: string }[];
      const roles = Array.isArray(body) ? body : (body.items ?? []);
      const roleId = (name: string) => {
        const r = roles.find((x) => x.name === name);
        expect(r, `the antecontract offers no role „${name}”: ${roles.map((x) => x.name).join(", ")}`).toBeTruthy();
        return r!.id;
      };
      for (const [personId, role] of [[sellerId, "Promitent vânzător"], [buyerId, "Promitent cumpărător"], [notaryId, "Notar"]] as const) {
        const res = await page.request.post(`/api/documents/${documentId}/persons`, { data: { personIds: [personId], personRoleId: roleId(role) } });
        expect(res.ok(), `POST persons ${role} ${res.status()}`).toBeTruthy();
      }

      // Step 2 — „Părți”, ticked: the promising seller's group, then the promising buyer's; each one line with „Cotă”.
      await page.goto(`/documents/${documentId}`);
      await expect(page.getByRole("heading", { name: ANTECONTRACT })).toBeVisible({ timeout: 30_000 });
      await expect(tileBox(page, "Părți")).toBeChecked({ timeout: 30_000 });
      const parties = partiesOf(page);
      await expect(parties.locator("[data-party-group-heading]")).toHaveText(["Promitent vânzător", "Promitent cumpărător"], { timeout: 30_000 });
      for (const [person, role] of [[SELLER, "Promitent vânzător"], [BUYER, "Promitent cumpărător"]] as const) {
        const row = lineRow(parties, person);
        await expect(row).toHaveCount(1, { timeout: 15_000 });
        await expect(row.locator("[data-row-content]")).toHaveText(`${person} (${role})`);
        await expect(row.getByRole("button", { name: "Cotă", exact: true })).toHaveCount(1);
      }
      await expect(parties.locator("[data-row-content]")).toHaveCount(2);

      // Step 3 — „Legături”: the notary only, without „Cotă”, and the line naming the two parties.
      const links = await showTile(page, "Legături");
      await expect(links.locator("[data-parties-elsewhere]")).toHaveText("Părțile actului (2) sunt în fișa „Părți”.", { timeout: 30_000 });
      const persons = links.locator("[data-row-content]").filter({ hasText: MARK });
      await expect(persons).toHaveText([`${NOTARY} (Notar)`], { timeout: 15_000 });
      await expect(lineRow(links, NOTARY).getByRole("button", { name: "Cotă", exact: true })).toHaveCount(0);

      // Step 4 — „Părți” unticked: the parties back on „Legături”, the line gone.
      await hideTile(page, "Părți");
      await expect(links.locator("[data-row-content]").filter({ hasText: MARK })).toHaveCount(3, { timeout: 15_000 });
      await expect(links.locator("[data-parties-elsewhere]")).toHaveCount(0);

      // Step 5 — ticked again: as in steps 2 and 3.
      await showTile(page, "Părți");
      await expect(partiesOf(page).locator("[data-row-content]")).toHaveCount(2, { timeout: 15_000 });
      await expect(links.locator("[data-row-content]").filter({ hasText: MARK })).toHaveText([`${NOTARY} (Notar)`], { timeout: 15_000 });
    } finally {
      await removeRecord(page.request, "document", documentId);
      await removeRecord(page.request, "person", notaryId);
      await removeRecord(page.request, "person", buyerId);
      await removeRecord(page.request, "person", sellerId);
    }
  });
});
