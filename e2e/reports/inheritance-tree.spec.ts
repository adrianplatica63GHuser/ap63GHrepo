/**
 * Case:   TC-INHER-01 — „Arbori de moștenire”: cinci persoane pe trei generații, rotița schimbă nivelul, numele deschide persoana
 * Source: docs/testing/cases/TC-INHER-01.md, „Last green" 2026-10-11
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The five persons and their ties are created through the routes the screens call — the person's „Asociază
 *     persoană" posts to /api/people/<id>/references, the ticked person holding the role — with
 *     `TC-E2E-INHER-01` names, and removed in `finally`.
 *   - The tree draws the archive's real families beside the test one. The pictures paint over every node that is
 *     not the test family's (Playwright's `mask`, drawn in the page before the capture), and the sidebar is under
 *     the frame. capture-and-personal-data.md.
 *   - A generation is read from the node's `data-generation`, the level from the canvas' `data-tree-level`.
 */

import { test, expect, type APIRequestContext, type Page } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}INHER-01`;
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

test.describe("TC-INHER-01 — arborele întreg", () => {
  test("cinci persoane pe trei generații; rotița schimbă nivelul; numele deschide ecranul persoanei", async ({ page }) => {
    // Five persons and five ties through the routes, the tree, three pictures and a person's screen: measured over
    // 90 s on a cold runner server (20261011T233612Z-31299, twice), so the test has four minutes.
    test.setTimeout(240_000);
    const t0 = Date.now();
    const lap = (step: string) => console.log(`[TC-INHER-01] ${step} at ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const ids: string[] = [];
    try {
      const [tata, mama, sot] = [await roleId(page.request, "Tată"), await roleId(page.request, "Mamă"), await roleId(page.request, "Soț")];
      const make = async (firstName: string, gender: "MALE" | "FEMALE", dateOfBirth: string) => {
        const id = await createNaturalPerson(page.request, { lastName: MARK, firstName, gender, dateOfBirth });
        ids.push(id);
        return id;
      };
      const gheorghe = await make("Gheorghe", "MALE", "1930-04-02");
      const ion = await make("Ion", "MALE", "1955-06-10");
      const maria = await make("Maria", "FEMALE", "1957-09-21");
      const ana = await make("Ana", "FEMALE", "1982-01-15");
      const mihai = await make("Mihai", "MALE", "1980-11-03");
      await tie(page.request, gheorghe, tata, ion);
      await tie(page.request, ion, sot, maria);
      await tie(page.request, ion, tata, ana);
      await tie(page.request, maria, mama, ana);
      await tie(page.request, mihai, sot, ana);

      lap("Step 1");
      // Step 1 — „Rapoarte" → „Arbori de moștenire": the whole page, the five on three generations.
      await page.goto("/");
      const nav = page.locator("nav[data-sidebar-nav]");
      const reports = nav.getByRole("button", { name: "Rapoarte", exact: true });
      if ((await reports.getAttribute("aria-expanded")) !== "true") await reports.click();
      await nav.getByRole("link", { name: "Arbori de moștenire", exact: true }).click();
      await expect(page).toHaveURL(/\/inheritance-tree$/, { timeout: 30_000 });
      // The dialog's own element has no box (its panel is fixed), so its heading is what reads visible.
      const frame = page.getByRole("dialog", { name: "Arbori de moștenire" });
      await expect(frame.getByRole("heading", { name: "Arbori de moștenire", exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(node(page, ana)).toBeAttached({ timeout: 30_000 });
      const gen = async (id: string) => Number(await node(page, id).getAttribute("data-generation"));
      const cluster = async (id: string) => node(page, id).getAttribute("data-cluster");
      const [g0, g1, g2, g3, g4] = await Promise.all([gen(gheorghe), gen(ion), gen(maria), gen(ana), gen(mihai)]);
      expect([g1 - g0, g2 - g0, g3 - g0, g4 - g0]).toEqual([1, 1, 2, 2]);
      expect(new Set(await Promise.all(ids.map(cluster))).size).toBe(1);

      lap("Step 2");
      // Step 2 — „Caută o persoană…": the tree centred on Ana, near enough to read (level 3), the side card open.
      await frame.getByRole("searchbox", { name: "Caută o persoană…" }).fill(`Ana ${MARK}`);
      await frame.getByRole("button", { name: "Caută", exact: true }).click();
      const canvas = frame.locator("[data-tree-level]");
      await expect(canvas).toHaveAttribute("data-tree-level", "3");
      const card = frame.locator("[data-tree-card]");
      await expect(card).toContainText(`Ana ${MARK}`);
      await expect(card).toContainText("15.01.1982");
      const others = `[data-tree-node]${ids.map((id) => `:not([data-tree-node="${id}"])`).join("")}`;
      await page.mouse.move(5, 450);
      await page.screenshot({ path: `${SHOTS}/level-3-1366.png`, mask: [page.locator(others)] });
      await card.getByRole("button", { name: "Închide", exact: true }).click();

      lap("Step 3");
      // Step 3 — the wheel, away from the tree's centre: level 2, then level 1; and back.
      const box = (await canvas.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      for (const want of ["2", "1"]) {
        for (let i = 0; i < 12 && (await canvas.getAttribute("data-tree-level")) !== want; i++) await page.mouse.wheel(0, 120);
        await expect(canvas).toHaveAttribute("data-tree-level", want);
        await page.screenshot({ path: `${SHOTS}/level-${want}-1366.png`, mask: [page.locator(others)] });
      }
      for (let i = 0; i < 40 && (await canvas.getAttribute("data-tree-level")) !== "3"; i++) await page.mouse.wheel(0, -120);
      await expect(canvas).toHaveAttribute("data-tree-level", "3");

      lap("Step 4");
      // Step 4 — hover Ion: his card, with his date of birth and his three ties.
      await frame.getByRole("searchbox", { name: "Caută o persoană…" }).fill(`Ion ${MARK}`);
      await frame.getByRole("button", { name: "Caută", exact: true }).click();
      await frame.locator("[data-tree-card]").getByRole("button", { name: "Închide", exact: true }).click();
      // The node, not its card's <rect>: the text lines over the rect's centre would take the pointer from it.
      await node(page, ion).hover({ timeout: 15_000 });
      const hover = frame.locator("[data-tree-hover]");
      await expect(hover).toContainText(`Ion ${MARK}`);
      await expect(hover).toContainText("10.06.1955");
      await expect(hover).toContainText("3 legături de familie");

      lap("Step 5");
      // Step 5 — no CNP, no identity card, no address: the route sends none of them.
      const data = (await (await page.request.get("/api/inheritance-tree")).json()) as { persons: Record<string, unknown>[] };
      const keys = new Set(data.persons.flatMap((p) => Object.keys(p)));
      expect([...keys].sort()).toEqual(["dateOfBirth", "displayName", "firstName", "gender", "id", "lastName", "nickname"]);

      lap("Step 6");
      // Step 6 — Ana's name opens her screen.
      await frame.getByRole("searchbox", { name: "Caută o persoană…" }).fill(`Ana ${MARK}`);
      await frame.getByRole("button", { name: "Caută", exact: true }).click();
      await frame.locator("[data-tree-card]").getByRole("link", { name: `Ana ${MARK}`, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${ana}$`), { timeout: 30_000 });
      lap("done");
    } finally {
      for (const id of ids) await removeRecord(page.request, "person", id);
    }
  });
});
