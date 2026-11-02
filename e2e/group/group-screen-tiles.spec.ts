/**
 * Case:   TC-GRP-04 — Ecranul unui grup: identitatea compactă și membrii în două liste (41.42; trei fișe până atunci)
 * Source: docs/testing/cases/TC-GRP-04.md, „Last green" 2026-10-05
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The group and the properties carry `TC-E2E-GRP-04` (records.ts).
 *   - Playwright's mouse drags; the hand run dispatched pointer events from a
 *     script (FU-290). Each reading is polled until it holds.
 *   - The places are read relative to the row, in px, as the hand run read them;
 *     the expected ones are computed from the tiles' own sizes, not written down.
 */

import { test, expect, type Page } from "../helpers/test";
import { expectPanouriRoundTrip, tileBox, tilesMenuButton } from "../helpers/tiles";
import { E2E_MARKER, createNaturalPerson, createProperty, removeGroupLeftovers, removeLeftovers, removeRecord, removeStampLeftovers } from "../helpers/records";

const MARK = `${E2E_MARKER}GRP-04`;
const KEY = "ga40-tile-positions-admin-group-v1";
const GAP = 16;

type Box = { x: number; y: number; w: number; h: number };

/** Every tile of the row, relative to the row. */
async function boxes(page: Page): Promise<Record<string, Box>> {
  return page.evaluate(() => {
    const row = document.querySelector<HTMLElement>("[data-tile-row]")!.getBoundingClientRect();
    const out: Record<string, Box> = {};
    for (const e of document.querySelectorAll<HTMLElement>("[data-tile-row] [data-tile]")) {
      const r = e.getBoundingClientRect();
      out[e.dataset.tile!] = { x: Math.round(r.left - row.left), y: Math.round(r.top - row.top), w: Math.round(r.width), h: Math.round(r.height) };
    }
    return out;
  });
}

test.describe("TC-GRP-04 — ecranul unui grup: identitatea și membrii, două liste într-o fișă (41.42)", () => {
  test("1366 și 1920: identitatea compactă, membrii sub ea sau alături; incluși cu bifă și buton, cu dublu clic, unul scos; salvat", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await removeGroupLeftovers(page.request, MARK);
    const ids: string[] = [];
    let groupId = "";
    try {
      const g = await page.request.post("/api/groups", { data: { targetType: "PROPERTY", description: `${MARK} Grup de test` } });
      expect(g.status()).toBe(201);
      groupId = ((await g.json()) as { id: string }).id;
      for (const n of ["A", "B", "C"]) ids.push(await createProperty(page.request, { nickname: `${MARK} Teren ${n}` }));
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto(`/admin/groups/${groupId}`);
      await page.evaluate((k) => localStorage.removeItem(k), KEY);
      await page.reload();
      const region = (name: string) => page.getByRole("region", { name, exact: true });
      const identity = region("Identitatea grupului");
      const members = region("Membrii grupului");
      const inGroup = members.getByRole("region", { name: "Deja în grup", exact: true });
      const available = members.getByRole("region", { name: "Membri disponibili pentru includere", exact: true });
      const row = (list: typeof inGroup, n: string) => list.getByRole("listitem").filter({ hasText: `${MARK} Teren ${n}` });

      // Step 1 — 1366: the identity 2 units, its code and target on one line; the members 7 units, under it; „Panouri".
      await expect(identity).toBeVisible({ timeout: 30_000 });
      await expect(identity.locator("[data-group-identity-line]")).toHaveText(/^GRP-\d+ · Proprietate$/);
      await expect(identity.getByRole("button", { name: "Salvează grupul" })).toBeDisabled();
      await expect(tilesMenuButton(page)).toBeVisible({ timeout: 30_000 });
      await expect(inGroup.getByText("Niciun element în acest grup încă")).toBeVisible({ timeout: 30_000 });
      await expect.poll(async () => { const b = await boxes(page); return [b.identity?.w, b.members?.w]; }, { timeout: 20_000 }).toEqual([254, 929]);
      await expect.poll(async () => { const b = await boxes(page); return { x: b.members.x, y: b.members.y }; }, { timeout: 20_000 })
        .toEqual({ x: 0, y: (await boxes(page)).identity.h + GAP });
      // „Deja în grup" on the left, the available members on the right, at 3 units each (≈391 px).
      const [l, r] = await Promise.all([inGroup.boundingBox(), available.boundingBox()]);
      if (!l || !r) throw new Error("a list is not on the page");
      expect(l.x).toBeLessThan(r.x);
      expect(Math.min(l.width, r.width)).toBeGreaterThanOrEqual(363);

      // Step 2 — 1920: the members at the identity's right, tops level.
      await page.setViewportSize({ width: 1920, height: 1000 });
      await expect.poll(async () => { const b = await boxes(page); return { x: b.members.x, y: b.members.y }; }, { timeout: 20_000 }).toEqual({ x: 254 + GAP, y: 0 });

      // Step 3 — „Caută…", A and B ticked, „‹ Include (2)": both on the left, „în așteptare".
      await available.getByPlaceholder("Caută…").fill(MARK);
      await expect(row(available, "C")).toBeVisible({ timeout: 15_000 });
      const include = members.getByRole("button", { name: /^‹ Include \(\d+\)$/ });
      await expect(include).toHaveText("‹ Include (0)");
      await expect(include).toBeDisabled();
      for (const n of ["A", "B"]) await row(available, n).getByRole("checkbox").check();
      await expect(include).toHaveText("‹ Include (2)");
      await include.click();
      for (const n of ["A", "B"]) await expect(row(inGroup, n)).toContainText("în așteptare");
      await expect(identity.getByText("Modificări nesalvate")).toBeVisible();

      // Step 4 — a double-click on C moves it left.
      await row(available, "C").dblclick();
      await expect(row(inGroup, "C")).toContainText("în așteptare");
      await expect(inGroup.locator("[data-two-list-count]")).toHaveText("3");

      // Step 5 — A ticked on the left, „Scoate › (1)": back on the right.
      await row(inGroup, "A").getByRole("checkbox").check();
      await members.getByRole("button", { name: "Scoate › (1)", exact: true }).click();
      await expect(row(available, "A")).toBeVisible();
      await expect(row(inGroup, "A")).toHaveCount(0);

      // Step 6 — „Salvează grupul": B and C are members, numbered; nothing pending; after a reload the same.
      await identity.getByRole("button", { name: "Salvează grupul" }).click();
      await expect(identity.getByText("Modificări nesalvate")).toHaveCount(0, { timeout: 15_000 });
      await expect(inGroup.getByText("în așteptare")).toHaveCount(0);
      await page.reload();
      await expect(inGroup.locator("[data-two-list-count]")).toHaveText("2", { timeout: 30_000 });
      for (const n of ["B", "C"]) await expect(row(inGroup, n)).toContainText(/\[0[12]\]/);
      await expect(row(inGroup, "A")).toHaveCount(0);
    } finally {
      await page.evaluate((k) => localStorage.removeItem(k), KEY).catch(() => undefined);
      if (groupId) await page.request.delete(`/api/groups/${groupId}`);
      for (const id of ids) await removeRecord(page.request, "property", id);
    }
  });
});

// Slice 41.41 — Adrian: „For Groups stamps and tags I would like to have tiles, and I would like to implement the feature
// panels functionality as for the principal objects tiles". On Grupuri, on one group's screen and on Etichete: „Panouri"
// hides a tile, a reload keeps it hidden, „Implicit" brings it back.
test.describe("TC-GRP-04 (41.41) — „Panouri” pe Grupuri, pe ecranul unui grup și pe Etichete", () => {
  test("ascunsă, păstrată la reîncărcare, adusă înapoi de „Implicit”", async ({ page }) => {
    test.slow();
    const MARK41 = `${MARK}-PANOURI`;
    await removeGroupLeftovers(page.request, MARK41);
    await page.setViewportSize({ width: 1920, height: 1080 });
    let groupId: string | undefined;
    try {
      await page.goto("/admin/groups");
      await expectPanouriRoundTrip(page, "Ce este un Grup?", "about");
      // 41.44: „Cum lucrezi cu grupurile", beside it, names the buttons by their labels; „Panouri" hides it too.
      const workflows = page.getByRole("region", { name: "Cum lucrezi cu grupurile", exact: true });
      await expect(workflows).toContainText("„‹ Include”");
      await expect(workflows.locator("[data-workflow-step]")).toHaveCount(5);
      await expectPanouriRoundTrip(page, "Cum lucrezi cu grupurile", "workflows");
      const g = await page.request.post("/api/groups", { data: { targetType: "PROPERTY", description: `${MARK41} Grup` } });
      expect(g.ok(), await g.text()).toBeTruthy();
      const body = (await g.json()) as { id?: string; group?: { id: string } };
      groupId = body.group?.id ?? body.id;
      await page.goto(`/admin/groups/${groupId}`);
      await expectPanouriRoundTrip(page, "Identitatea grupului", "identity");
      await expect(page.getByRole("region", { name: "Cum lucrezi cu grupurile", exact: true })).toBeVisible();
      await expectPanouriRoundTrip(page, "Cum lucrezi cu grupurile", "workflows");
      await page.goto("/admin/tags");
      await expectPanouriRoundTrip(page, "Etichete", "note");
    } finally {
      if (groupId) await page.request.delete(`/api/groups/${groupId}`);
    }
  });
});

// Slice 41.45 — a group or a stamp opened from a record shows only its identity tile, for that visit; from the lists,
// the stored choice. And a „Vezi și" reference to a natural person opens that person, not the old /persons/{id}.
test.describe("TC-GRP-04 (41.45) — deschis dintr-o fișă: doar identitatea; „Vezi și” ajunge la persoană", () => {
  test("grupul și ștampila unei persoane, din „Etichete și grupuri”; apoi din liste; apoi „Vezi și”", async ({ page }) => {
    // Six screens and seven records: more than test.slow()'s 90 s (the first run finished its steps and ran out in the cleanup).
    test.setTimeout(240_000);
    const M = `${MARK}-FROM`;
    await removeGroupLeftovers(page.request, M);
    await removeStampLeftovers(page.request, M);
    await removeLeftovers(page.request, M);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const people: string[] = [];
    let groupId = "";
    let stampId = "";
    try {
      for (const n of ["Unu", "Doi"]) people.push(await createNaturalPerson(page.request, { lastName: `${M} ${n}`, firstName: "Ion" }));
      const po = async (id: string) => ((await (await page.request.get(`/api/people/${id}/entity-references`)).json()) as { principalObjectId: string }).principalObjectId;
      const [one, two] = [await po(people[0]), people[1]];
      const g = await page.request.post("/api/groups", { data: { targetType: "PHYSICAL_PERSON", description: `${M} Grup` } });
      expect(g.status()).toBe(201);
      groupId = ((await g.json()) as { id: string }).id;
      expect((await page.request.post(`/api/metadata/${one}/groups`, { data: { groupId } })).ok()).toBeTruthy();
      const s = await page.request.post("/api/stamps", { data: { shortDescription: `${M} Ștampilă`, notes: "" } });
      expect(s.status()).toBe(201);
      stampId = ((await s.json()) as { id: string }).id;
      expect((await page.request.post(`/api/metadata/${one}/stamps`, { data: { stampId } })).ok()).toBeTruthy();
      const twoCode = ((await (await page.request.get(`/api/people/${two}`)).json()) as { person: { code: string } }).person.code;
      expect((await page.request.post(`/api/metadata/${one}/cross-refs`, { data: { targetCode: twoCode } })).ok()).toBeTruthy();
      // Nothing stored for either screen's tiles, so their stored choice is every tile.
      await page.goto(`/natural-persons/${people[0]}`);
      await page.evaluate(() => { localStorage.removeItem("ga40-tiles-admin-group-v1"); localStorage.removeItem("ga40-tiles-admin-stamp-v1"); });
      const connections = page.locator('[data-tile="connections"]');

      // Step 1 — the group's link: its screen with „Identitatea grupului" only; „Panouri" lists the others unticked.
      await connections.locator('a[href*="/admin/groups/"]').first().click();
      await expect(page).toHaveURL(/\/admin\/groups\/[0-9a-f-]+\?.*tiles=identity/, { timeout: 30_000 });
      await expect(page.getByRole("region", { name: "Identitatea grupului", exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-tile="members"]')).toBeHidden();
      await expect(page.locator('[data-tile="workflows"]')).toBeHidden();
      await expect(tileBox(page, "Identitatea grupului")).toBeChecked();
      await expect(tileBox(page, "Membrii grupului")).not.toBeChecked();
      await expect(tileBox(page, "Cum lucrezi cu grupurile")).not.toBeChecked();
      expect(await page.evaluate(() => localStorage.getItem("ga40-tiles-admin-group-v1"))).toBeNull();

      // Step 2 — the same group from the list: its stored choice, every tile.
      await page.goto(`/admin/groups/${groupId}`);
      await expect(page.getByRole("region", { name: "Membrii grupului", exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("region", { name: "Cum lucrezi cu grupurile", exact: true })).toBeVisible();

      // Step 3 — the stamp's link: „Descrierea ștampilei" only.
      await page.goto(`/natural-persons/${people[0]}`);
      await connections.locator('a[href*="/admin/stamps/"]').first().click();
      await expect(page).toHaveURL(/\/admin\/stamps\/[0-9a-f-]+\?.*tiles=description/, { timeout: 30_000 });
      await expect(page.getByRole("region", { name: "Descrierea ștampilei", exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-tile="records"]')).toBeHidden();
      await expect(tileBox(page, "Elementele ștampilei")).not.toBeChecked();
      expect(await page.evaluate(() => localStorage.getItem("ga40-tiles-admin-stamp-v1"))).toBeNull();
      await page.goto(`/admin/stamps/${stampId}`);
      await expect(page.getByRole("region", { name: "Elementele ștampilei", exact: true })).toBeVisible({ timeout: 30_000 });

      // Step 4 — „Vezi și": the other person, on the natural persons' screen.
      await page.goto(`/natural-persons/${people[0]}`);
      const peer = connections.locator(`a[href*="/natural-persons/${people[1]}"]`);
      await expect(peer).toBeVisible({ timeout: 30_000 });
      await peer.click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${people[1]}`), { timeout: 30_000 });
      await expect(page.locator("[data-record-header] h1")).toContainText(`${M} Doi`, { timeout: 30_000 });
    } finally {
      if (groupId) await page.request.delete(`/api/groups/${groupId}`);
      if (stampId) await page.request.delete(`/api/stamps/${stampId}`);
      for (const id of people) await removeRecord(page.request, "person", id);
    }
  });
});
