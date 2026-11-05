/**
 * Case:   TC-INHER-02 — „Arbore de moștenire” pe persoană: trei generații în fișă, panoul restrâns din listă și deschis din arbore, o rudă adăugată și scoasă
 * Source: docs/testing/cases/TC-INHER-02.md, „Last green" 2026-10-12
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The four persons and the first two ties are created through the routes the screens call, with
 *     `TC-E2E-INHER-02` names, and removed in `finally` (their ties go with them).
 *   - The screen is opened by its address, as the list's „Deschide" opens it — no `?tree=`.
 *   - The picture is the tile alone, at 1366 px: only the test family is in it.
 *
 * Slice 41.71 adds a second test: the tile as wide as its family — two persons 254 px at level 2, more 389 px at
 * level 1 — over its own invented persons.
 *
 * Slice 41.87 adds a third: „Deschide arborele întreg" opens the whole tree OVER the person's screen, grown out of the
 * tile (`?tree=whole`), and „Restrânge", a search followed by „Restrânge", and Back each take it back into the tile.
 * The lengths are the map's settings as they stand (3 s + 3 s, the return 4 s by default), so the waits allow 20 s.
 */

import { showTile } from "../helpers/tiles";
import { test, expect, type APIRequestContext, type Page } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}INHER-02`;
const ROLES = "/api/admin/value-lists/person-roles";

async function roleId(request: APIRequestContext, name: string): Promise<string> {
  const items = ((await (await request.get(ROLES)).json()) as { items: { id: string; name: string; kinship: string | null }[] }).items;
  const role = items.find((r) => r.name === name && r.kinship !== null);
  expect(role, `the role „${name}” with a kinship (migration_106)`).toBeTruthy();
  return role!.id;
}

const tile = (page: Page) => page.getByRole("region", { name: "Arbore de moștenire", exact: true });
const node = (page: Page, id: string) => tile(page).locator(`[data-tree-node="${id}"]`);

test.describe("TC-INHER-02 — arborele persoanei", () => {
  test("trei generații; C restrâns din listă, deschis din arbore; o rudă adăugată prin C, apoi scoasă", async ({ page }) => {
    test.setTimeout(240_000);
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const ids: string[] = [];
    try {
      const make = async (firstName: string, gender: "MALE" | "FEMALE", dateOfBirth: string) => {
        const id = await createNaturalPerson(page.request, { lastName: MARK, firstName, gender, dateOfBirth });
        ids.push(id);
        return id;
      };
      const ion = await make("Ion", "MALE", "1940-02-02");
      const elena = await make("Elena", "FEMALE", "1965-05-05");
      const radu = await make("Radu", "MALE", "1990-09-09");
      const dan = await make("Dan", "MALE", "1968-08-08");
      const tie = async (holder: string, role: string, other: string) => {
        const res = await page.request.post(`/api/people/${other}/references`, { data: { personIds: [holder], relationshipRoleId: role } });
        expect(res.ok(), `POST references failed (${res.status()})`).toBeTruthy();
      };
      await tie(ion, await roleId(page.request, "Tată"), elena);
      await tie(elena, await roleId(page.request, "Mamă"), radu);

      // Step 1 — Elena's screen, as from the list: the tile, three generations, C collapsed; the drawing square.
      await page.goto(`/natural-persons/${elena}`);
      await expect(tile(page)).toBeVisible({ timeout: 30_000 });
      await expect(node(page, radu)).toBeAttached({ timeout: 30_000 });
      const gen = async (id: string) => Number(await node(page, id).getAttribute("data-generation"));
      expect([await gen(ion), await gen(elena), await gen(radu)]).toEqual([0, 1, 2]);
      await expect(node(page, dan)).toHaveCount(0);
      await expect(tile(page).locator('[data-tree-panel="collapsed"]')).toBeVisible();
      const box = (await tile(page).locator("[data-tree-tile-canvas]").boundingBox())!;
      expect(Math.abs(box.width - box.height), `the drawing ${box.width} × ${box.height}`).toBeLessThanOrEqual(2);
      // Slice 40.06: the tile's title is every tile's — in capitals, the size and the colour of „Identitate"'s.
      const look = (h: ReturnType<Page["locator"]>) =>
        h.evaluate((el) => { const s = getComputedStyle(el); return [s.textTransform, s.fontSize, s.fontWeight, s.color]; });
      const treeTitle = tile(page).locator("[data-tile-title] h2");
      await expect(treeTitle).toHaveText("Arbore de moștenire");
      const identityTitle = page.locator('[data-tile="identity"] [data-tile-title] h2').first();
      expect(await look(treeTitle)).toEqual(await look(identityTitle));
      expect((await look(treeTitle))[0]).toBe("uppercase");
      await expect(tile(page).locator("[data-tile-subtitle]")).toHaveCount(1);

      // Step 1a (Slice 41.72, which replaced 40.34's one button „Adaugă sau scoate o rudă") — two icon buttons,
      // „Adaugă o rudă" then „Scoate o rudă", each named and tooltipped so, „Asociază persoană"'s kind — its height
      // and colour — at the tile's left, neither pressed.
      const addBtn = tile(page).locator("[data-tree-add]");
      const removeBtn = tile(page).locator("[data-tree-remove]");
      await expect(tile(page).locator("[data-tree-expand]")).toHaveCount(0);
      await expect(addBtn).toHaveText("");
      await expect(addBtn).toHaveAccessibleName("Adaugă o rudă");
      await expect(removeBtn).toHaveAccessibleName("Scoate o rudă");
      await expect(addBtn).toHaveAttribute("aria-pressed", "false");
      await expect(removeBtn).toHaveAttribute("aria-pressed", "false");
      // 41.80 — each button draws two icons as „Asociază persoană" does, the same size: the person first, then the chain
      // or the bin (41.72 drew one composed icon, a small chain or bin at the person's lower right).
      const icons = (b: ReturnType<Page["locator"]>) =>
        b.locator("svg").evaluateAll((els) =>
          els.map((e) => {
            const r = e.getBoundingClientRect();
            const c = e.getAttribute("class") ?? "";
            return { icon: /lucide-user\b/.test(c) ? "person" : /lucide-link\b/.test(c) ? "chain" : /lucide-trash/.test(c) ? "bin" : c, w: Math.round(r.width), h: Math.round(r.height) };
          }),
        );
      const [addIcons, removeIcons] = [await icons(addBtn), await icons(removeBtn)];
      expect(addIcons.map((i) => i.icon)).toEqual(["person", "chain"]);
      expect(removeIcons.map((i) => i.icon)).toEqual(["person", "bin"]);
      const sizes = new Set([...addIcons, ...removeIcons].map((i) => `${i.w}×${i.h}`));
      expect(sizes.size, `icon sizes ${[...sizes].join(", ")}`).toBe(1);
      await showTile(page, "Legături");
      const associate = page.locator('[data-tile="related"]').getByRole("button", { name: "Asociază persoană", exact: true });
      const looks = (l: ReturnType<Page["locator"]>) =>
        l.evaluate((e) => ({ h: Math.round(e.getBoundingClientRect().height), bg: getComputedStyle(e).backgroundColor }));
      expect(await looks(addBtn)).toEqual(await looks(associate));
      expect(await looks(removeBtn)).toEqual(await looks(associate));
      const [ab, rb, tb] = [(await addBtn.boundingBox())!, (await removeBtn.boundingBox())!, (await tile(page).boundingBox())!];
      expect(ab.x - tb.x).toBeLessThanOrEqual(16);
      expect(rb.x).toBeGreaterThan(ab.x + ab.width - 1);
      expect(Math.abs(rb.y - ab.y)).toBeLessThanOrEqual(1);

      // Step 1b (41.72) — each opens only its half; both together; each collapses, by its own ChevronUp and by its
      // button pressed again.
      const addHalf = tile(page).locator('[data-tree-half="add"]');
      const removeHalf = tile(page).locator('[data-tree-half="remove"]');
      await addBtn.click();
      await expect(addHalf).toBeVisible();
      await expect(addHalf.getByRole("searchbox", { name: "Ruda" })).toBeVisible();
      await expect(addHalf).toContainText(`O rudă nouă a lui Elena ${MARK}`);
      await expect(removeHalf).toHaveCount(0);
      await expect(tile(page).locator("[data-tree-ties]")).toHaveCount(0);
      await expect(addBtn).toHaveAttribute("aria-pressed", "true");
      await addBtn.click();
      await expect(addHalf).toHaveCount(0);
      await removeBtn.click();
      await expect(removeHalf).toContainText("Legăturile de familie ale persoanei");
      await expect(removeHalf.locator("[data-tree-ties]")).toContainText(`Ion ${MARK}`);
      await expect(tile(page).getByRole("searchbox", { name: "Ruda" })).toHaveCount(0);
      await addBtn.click();
      await expect(addHalf).toBeVisible();
      await expect(removeHalf).toBeVisible();
      const [rh, ah] = [(await removeHalf.boundingBox())!, (await addHalf.boundingBox())!];
      expect(rh.y).toBeLessThan(ah.y); // the ties above, the new relative below
      await removeHalf.locator('[data-tree-collapse="remove"]').click();
      await expect(removeHalf).toHaveCount(0);
      await addHalf.locator('[data-tree-collapse="add"]').click();
      await expect(addHalf).toHaveCount(0);
      await expect(tile(page).locator('[data-tree-panel="collapsed"]')).toBeVisible();

      // Step 2 — from the whole tree, Elena's name: her screen with C expanded.
      await page.goto("/inheritance-tree");
      const frame = page.getByRole("dialog", { name: "Arbori de moștenire" });
      await frame.getByRole("searchbox", { name: "Caută o persoană…" }).fill(`Elena ${MARK}`);
      await frame.getByRole("button", { name: "Caută", exact: true }).click();
      await frame.locator("[data-tree-card]").getByRole("link", { name: `Elena ${MARK}`, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${elena}\\?tree=open$`), { timeout: 30_000 });
      const panel = tile(page).locator('[data-tree-panel="expanded"]');
      await expect(panel).toBeVisible({ timeout: 30_000 });
      // 41.72 (Ask first 4): `?tree=open` opens the add half alone; the ties half is opened by its own button.
      await expect(panel.locator('[data-tree-half="add"]')).toBeVisible();
      await expect(panel.locator('[data-tree-half="remove"]')).toHaveCount(0);
      await tile(page).locator("[data-tree-remove]").click();
      await expect(panel.locator("[data-tree-ties]")).toContainText(`Ion ${MARK}`);

      // Step 3 — „Ruda": Dan; „Ce este pentru …": „Frate"; „Adaugă legătura" — Dan in the tile, beside Elena.
      await panel.getByRole("searchbox", { name: "Ruda" }).fill(`Dan ${MARK}`);
      // A pick closes the list and names the relative (`[data-tree-chosen]`), so the radio is clicked, not checked.
      await panel.getByRole("radio", { name: `Dan ${MARK}` }).click({ timeout: 15_000 });
      await expect(panel.locator("[data-tree-chosen]")).toHaveText(`Dan ${MARK}`);
      await panel.getByRole("combobox", { name: `Ce este pentru Elena ${MARK}` }).selectOption({ label: "Frate" });
      await panel.getByRole("button", { name: "Adaugă legătura", exact: true }).click();
      await expect(node(page, dan)).toBeAttached({ timeout: 30_000 });
      expect(await gen(dan)).toBe(await gen(elena));
      await expect(panel.locator(`[data-tree-tie="${dan}"]`)).toContainText("Frate");
      await page.mouse.move(5, 5);
      await tile(page).screenshot({ path: "playwright-report/inheritance-tree/person-tile-1366.png" });

      // Step 4 — „Scoate legătura cu Dan …", „Scoate": Dan gone from the tile.
      await panel.getByRole("button", { name: `Scoate legătura cu Dan ${MARK}`, exact: true }).click();
      await panel.getByRole("button", { name: "Scoate", exact: true }).click();
      await expect(node(page, dan)).toHaveCount(0, { timeout: 30_000 });
      await expect(panel.locator(`[data-tree-tie="${dan}"]`)).toHaveCount(0);
    } finally {
      for (const id of ids) await removeRecord(page.request, "person", id);
    }
  });

  // Slice 41.71 — Adrian: „if there are only two persons featured the tile should open with a width of two units …
  // at zoom level 2 of 3; … more than two … three units … zoom level one of three".
  test("41.71 — the tile as wide as its family: two persons 2 units at level 2, more 3 units at level 1; 41.79 — a width stored before 41.71 forgotten, the person centred", async ({ page }) => {
    test.setTimeout(180_000);
    const mark = `${MARK}-W`;
    await removeLeftovers(page.request, mark);
    await page.setViewportSize({ width: 1366, height: 900 });
    const ids: string[] = [];
    try {
      const make = async (firstName: string, gender: "MALE" | "FEMALE", dateOfBirth: string) => {
        const id = await createNaturalPerson(page.request, { lastName: mark, firstName, gender, dateOfBirth });
        ids.push(id);
        return id;
      };
      const tie = async (holder: string, role: string, other: string) => {
        const res = await page.request.post(`/api/people/${other}/references`, { data: { personIds: [holder], relationshipRoleId: role } });
        expect(res.ok(), `POST references failed (${res.status()})`).toBeTruthy();
      };
      const father = await roleId(page.request, "Tată");
      const mother = await roleId(page.request, "Mamă");
      // Two persons: Andrei and his father Petru.
      const petru = await make("Petru", "MALE", "1950-01-01");
      const andrei = await make("Andrei", "MALE", "1980-03-03");
      await tie(petru, father, andrei);
      // Four: Maria, her father Vasile and her two sons.
      const vasile = await make("Vasile", "MALE", "1935-04-04");
      const maria = await make("Maria", "FEMALE", "1962-06-06");
      const sorin = await make("Sorin", "MALE", "1988-07-07");
      const mihai = await make("Mihai", "MALE", "1991-10-10");
      await tie(vasile, father, maria);
      await tie(maria, mother, sorin);
      await tie(maria, mother, mihai);

      const opened = async (id: string, others: string[]) => {
        await page.goto(`/natural-persons/${id}`);
        await expect(tile(page)).toBeVisible({ timeout: 30_000 });
        for (const o of others) await expect(node(page, o)).toBeAttached({ timeout: 30_000 });
      };
      const width = async () => Math.round((await tile(page).boundingBox())!.width);
      const level = () => tile(page).locator("[data-tree-level]");
      // 41.79 (Ask first 3): the screen's own person's box in the middle of the drawing's square, within 5 % of it.
      const centred = async (id: string) => {
        const sq = (await tile(page).locator("[data-tree-tile-canvas]").boundingBox())!;
        const n = (await node(page, id).boundingBox())!;
        const dx = Math.abs(n.x + n.width / 2 - (sq.x + sq.width / 2)) / sq.width;
        const dy = Math.abs(n.y + n.height / 2 - (sq.y + sq.height / 2)) / sq.height;
        return dx <= 0.05 && dy <= 0.05 ? "centred" : JSON.stringify({ dx, dy });
      };

      await opened(andrei, [petru]);
      await expect.poll(width, { timeout: 20_000 }).toBe(254);
      await expect(level()).toHaveAttribute("data-tree-level", "2");
      const twoBox = (await tile(page).locator("[data-tree-tile-canvas]").boundingBox())!;
      expect(Math.abs(twoBox.width - twoBox.height), `the drawing ${twoBox.width} × ${twoBox.height}`).toBeLessThanOrEqual(2);
      await expect.poll(() => centred(andrei), { timeout: 10_000 }).toBe("centred");

      // 41.79 (Ask first 1) — Adrian's Chrome held this width, dragged before 41.71, and it held the tile at 2 units
      // for every person. Stored again here, under the same key, it is forgotten: Maria still opens 3 units wide.
      await page.evaluate(() =>
        localStorage.setItem("ga40-tile-positions-natural-person-v1", JSON.stringify({ inheritanceTree: { col: 2, top: 0, units: 2 } })),
      );
      await opened(maria, [vasile, sorin, mihai]);
      await expect.poll(width, { timeout: 20_000 }).toBe(389);
      await expect(level()).toHaveAttribute("data-tree-level", "1");
      const manyBox = (await tile(page).locator("[data-tree-tile-canvas]").boundingBox())!;
      expect(Math.abs(manyBox.width - manyBox.height), `the drawing ${manyBox.width} × ${manyBox.height}`).toBeLessThanOrEqual(2);
      await expect.poll(() => centred(maria), { timeout: 10_000 }).toBe("centred");
    } finally {
      for (const id of ids) await removeRecord(page.request, "person", id);
    }
  });
  // Slice 41.87 — Adrian: „when I want to expand the Inheritance tree tile to the „full screen" (or when I want to collapse
  // it to the current tile) the animation should happen similarly to what is currently happening for the Map tile".
  test("41.87 — the whole tree grows out of the tile over the person's screen; „Restrânge”, a search, Back take it back", async ({ page }) => {
    test.setTimeout(240_000);
    const mark = `${MARK}-X`;
    await removeLeftovers(page.request, mark);
    await page.setViewportSize({ width: 1366, height: 900 });
    const ids: string[] = [];
    try {
      const make = async (firstName: string, gender: "MALE" | "FEMALE", dateOfBirth: string) => {
        const id = await createNaturalPerson(page.request, { lastName: mark, firstName, gender, dateOfBirth });
        ids.push(id);
        return id;
      };
      const tie = async (holder: string, role: string, other: string) => {
        const res = await page.request.post(`/api/people/${other}/references`, { data: { personIds: [holder], relationshipRoleId: role } });
        expect(res.ok(), `POST references failed (${res.status()})`).toBeTruthy();
      };
      const ion = await make("Ion", "MALE", "1940-02-02");
      const elena = await make("Elena", "FEMALE", "1965-05-05");
      const radu = await make("Radu", "MALE", "1990-09-09");
      await tie(ion, await roleId(page.request, "Tată"), elena);
      await tie(elena, await roleId(page.request, "Mamă"), radu);

      await page.goto(`/natural-persons/${elena}`);
      await expect(node(page, radu)).toBeAttached({ timeout: 30_000 });
      const button = tile(page).locator("[data-tree-whole]");
      await expect(button).toHaveAccessibleName("Deschide arborele întreg");
      const tileView = async () => {
        const b = (await node(page, elena).boundingBox())!;
        return [Math.round(b.x), Math.round(b.y), Math.round(b.width)];
      };
      const before = await tileView();
      const dialog = page.getByRole("dialog", { name: "Arbori de moștenire" });
      const panel = dialog.locator("[data-tree-panel-box]");
      const body = dialog.locator("[data-tree-panel-body]");
      const opened = async () => {
        await button.click();
        await expect(page).toHaveURL(new RegExp(`/natural-persons/${elena}\\?tree=whole$`));
        await expect(dialog).toHaveAttribute("data-expand", "done", { timeout: 20_000 });
      };

      // Step 1 — open from the tile: the overlay ends at inset-4, Elena in the middle and her card open; her screen
      // is still under it (the tile is there, the address the person's own).
      await opened();
      const box = (await panel.boundingBox())!;
      expect([Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)]).toEqual([16, 16, 1366 - 32, 900 - 32]);
      await expect(dialog.locator("[data-tree-card]")).toContainText(`Elena ${mark}`);
      const centred = async () => {
        const b = (await body.boundingBox())!;
        const n = (await body.locator(`[data-tree-node="${elena}"]`).boundingBox())!;
        // The node's own origin is its box's middle at the near level (a card centred on it).
        const dx = Math.abs(n.x + n.width / 2 - (b.x + b.width / 2)) / b.width;
        const dy = Math.abs(n.y + n.height / 2 - (b.y + b.height / 2)) / b.height;
        return dx <= 0.05 && dy <= 0.05 ? "centred" : JSON.stringify({ dx, dy });
      };
      await expect.poll(centred, { timeout: 10_000 }).toBe("centred");
      await expect(tile(page)).toBeAttached();

      // Step 2 — „Restrânge": no return (nothing moved), the overlay goes, the tile shows its view of before, focus on
      // „Deschide arborele întreg", the address without the mark.
      await dialog.getByRole("button", { name: "Restrânge", exact: true }).click();
      await expect(dialog).toHaveAttribute("data-collapse-return", "skipped");
      await expect(dialog).toHaveCount(0, { timeout: 20_000 });
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${elena}$`));
      await expect(button).toBeFocused();
      expect(await tileView()).toEqual(before);

      // Step 3 — open, search another person, „Restrânge": the return plays first.
      await opened();
      await dialog.getByRole("searchbox", { name: "Caută o persoană…" }).fill(`Ion ${mark}`);
      await dialog.getByRole("button", { name: "Caută", exact: true }).click();
      await expect(dialog.locator("[data-tree-card]")).toContainText(`Ion ${mark}`);
      await dialog.getByRole("button", { name: "Restrânge", exact: true }).click();
      await expect(dialog).toHaveAttribute("data-collapse-return", "flies");
      await expect(dialog).toHaveCount(0, { timeout: 25_000 });
      await expect(button).toBeFocused();

      // Step 4 — open, then the browser's Back: the way back, and the address loses its mark.
      await opened();
      await page.goBack();
      await expect(dialog).toHaveCount(0, { timeout: 20_000 });
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${elena}$`));
      await expect(tile(page)).toBeVisible();
    } finally {
      for (const id of ids) await removeRecord(page.request, "person", id);
    }
  });
});
