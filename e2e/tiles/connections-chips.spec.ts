/**
 * Case:   TC-TILES-10 — „Conexiuni": etichete mici, „×" doar la mouse sau la focalizare
 * Source: docs/testing/cases/TC-TILES-10.md, „Last green" 2026-10-03
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The person carries `TC-E2E-TILES-10` (records.ts); the tags are the
 *     case's own, prefixed `tc-e2e-tiles-10` so a hand run and the spec never
 *     share one.
 *   - „Drawn" is read as the „×" wrapper's computed opacity — Playwright counts
 *     a transparent element as visible.
 *   - Step 3 reaches the „×" with `focus()`, the same focus Tab gives, since
 *     how many Tab presses lead there depends on the rest of the page.
 */

import { test, expect, type Locator } from "../helpers/test";
import { editConnections } from "../helpers/tiles";
import {
  E2E_MARKER, createNaturalPerson, removeGroupLeftovers, removeLeftovers, removeRecord,
} from "../helpers/records";

const MARK = `${E2E_MARKER}TILES-10`;
const TAGS = ["tc-e2e-tiles-10 arendă", "tc-e2e-tiles-10 moștenire", "tc-e2e-tiles-10 litigiu"];

async function opacity(remove: Locator): Promise<number> {
  return Number(await remove.evaluate((b) => getComputedStyle(b.parentElement as HTMLElement).opacity));
}

async function boxes(chips: Locator): Promise<string> {
  const all = await chips.evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  }));
  return JSON.stringify(all);
}

test.describe("TC-TILES-10 — etichete mici, „×” doar la mouse sau la focalizare", () => {
  test("trei etichete: niciun „×” în repaus, „×” la mouse și la focalizare, fără mișcare, și eliminarea", async ({ page }) => {
    test.slow();
    // A run that died before its `finally` leaves its records; they would be a second match here.
    await removeLeftovers(page.request, MARK);
    const person = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    try {
      const refs = (await (await page.request.get(`/api/people/${person}/entity-references`)).json()) as { principalObjectId: string };
      for (const tag of TAGS) {
        const res = await page.request.post(`/api/metadata/${refs.principalObjectId}/tags`, { data: { tag } });
        expect(res.ok()).toBeTruthy();
      }

      // Step 1 — three chips, no „×" drawn. 41.95 rewritten in place — was „padding 4–8 px every side": 2 px above and
      // below, 6 a side, the text 12 px (Adrian: „from size 12 to size 10, and the bubble should be smaller as well").
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto(`/natural-persons/${person}?tab=metadata`);
      const con = page.getByRole("region", { name: "Etichete și grupuri", exact: true });
      const chips = con.locator("[data-tag-chip]");
      await expect(chips).toHaveText(TAGS, { timeout: 30_000 });
      // Slice 41.40 — at rest the tile is calm: the chips, and no tag box, no „+", no „×", no „Leagă".
      await expect(con.locator("[data-tag-input]")).toHaveCount(0);
      await expect(con.getByRole("button", { name: /^\+ / })).toHaveCount(0);
      await expect(con.getByRole("button", { name: /^Elimină / })).toHaveCount(0);
      await expect(con.getByRole("button", { name: /^Leagă/ })).toHaveCount(0);
      // The pen opens it in edit: everything back.
      await editConnections(page);
      await expect(con.locator("[data-tag-input]")).toBeVisible();
      await expect(con.getByRole("button", { name: "+ Adaugă în grup", exact: true })).toBeVisible();
      // In view first, so the hovers below never scroll and every box is read from one place.
      await chips.nth(1).scrollIntoViewIfNeeded();
      await page.mouse.move(2, 2);
      const removes = TAGS.map((t) => con.getByRole("button", { name: `Elimină eticheta ${t}`, exact: true }));
      for (const r of removes) await expect.poll(() => opacity(r)).toBe(0);
      for (const pad of await chips.evaluateAll((els) => els.map((e) => {
        const s = getComputedStyle(e);
        return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft, s.fontSize].map((v) => parseFloat(v));
      }))) {
        expect(pad).toEqual([2, 6, 2, 6, 12]);
      }
      const atRest = await boxes(chips);

      // Step 2 — the mouse on „moștenire": its „×" over the top-right corner, the others not; nothing moved.
      await chips.nth(1).hover();
      await expect.poll(() => opacity(removes[1])).toBe(1);
      expect(await opacity(removes[0])).toBe(0);
      expect(await opacity(removes[2])).toBe(0);
      const x = await removes[1].boundingBox();
      const c = await chips.nth(1).boundingBox();
      expect(x!.x + x!.width).toBeGreaterThan(c!.x + c!.width - 4);
      expect(x!.y).toBeLessThan(c!.y + 4);
      expect(await boxes(chips)).toBe(atRest);

      // Step 3 — away, then focus on that „×": drawn while focused; nothing moved.
      await page.mouse.move(2, 2);
      await expect.poll(() => opacity(removes[1])).toBe(0);
      await removes[1].focus();
      await expect.poll(() => opacity(removes[1])).toBe(1);
      expect(await boxes(chips)).toBe(atRest);

      // Step 4 — the click removes „moștenire"; the other two stay. 41.97: held until „Salvează", which writes it.
      await chips.nth(1).hover();
      await removes[1].click();
      await expect(chips).toHaveText([TAGS[0], TAGS[2]], { timeout: 15_000 });
      await con.locator('[data-tile-save="connections"]').click();
      await expect(con.locator('[data-tile-edit-bar="connections"]')).toHaveCount(0, { timeout: 15_000 });
      await page.reload();
      await expect(page.getByRole("region", { name: "Etichete și grupuri", exact: true }).locator("[data-tag-chip]")).toHaveText([TAGS[0], TAGS[2]], { timeout: 30_000 });
    } finally {
      await removeRecord(page.request, "person", person);
    }
  });
});

// Slice 41.39 — Adrian: „once I click on the groups dropdown the tile freezes: if I click out of the drop The drop down
// doesn't come back to closed, it stays open; Also I cannot resize the tile". On an invented person and an invented group
// of persons with a 400-character description: the picker closes on a press outside and on Esc, its box never wider than
// the tile, and the tile steps from 3 units to 2 with the picker open and again once closed; Home gives the width back.
test.describe("TC-TILES-10 (41.39) — alegerea grupului se închide, dala se îngustează", () => {
  test("clic în afară, Esc, 3 → 2 unități cu alegerea deschisă și închisă", async ({ page }) => {
    test.slow();
    const MARK39 = `${MARK}-GRUP`;
    await removeLeftovers(page.request, MARK39);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const person = await createNaturalPerson(page.request, { lastName: MARK39, firstName: "Ion" });
    const g = await page.request.post("/api/groups", { data: { targetType: "PHYSICAL_PERSON", description: `${MARK39} ${"descriere lungă ".repeat(25).trim()}` } });
    expect(g.ok(), await g.text()).toBeTruthy();
    const groupId = ((await g.json()) as { group?: { id: string }; id?: string }).group?.id ?? ((await g.json()) as { id?: string }).id;
    try {
      await page.goto(`/natural-persons/${person}?tab=metadata`);
      const con = page.getByRole("region", { name: "Etichete și grupuri", exact: true });
      await expect(con).toBeVisible({ timeout: 30_000 });
      await editConnections(page); // 41.40: the pickers are in edit
      const plus = con.getByRole("button", { name: "Adaugă în grup", exact: false }).first();
      const picker = con.locator("[data-groups-picker]");
      // A press outside closes it.
      await plus.click();
      await expect(picker).toBeVisible({ timeout: 15_000 });
      const [pb, cb] = await Promise.all([picker.boundingBox(), con.boundingBox()]);
      expect(pb!.x + pb!.width, "the box inside the tile").toBeLessThanOrEqual(cb!.x + cb!.width + 0.5);
      await page.mouse.click(5, 5);
      await expect(picker).toHaveCount(0);
      // Esc closes it, the focus back on „+".
      await plus.click();
      await expect(picker).toBeVisible();
      await picker.focus();
      await page.keyboard.press("Escape");
      await expect(picker).toHaveCount(0);
      // 3 → 2 units with the picker open, then with it closed.
      const edge = page.locator('[data-tile-handle="connections"]');
      await expect(edge).toBeAttached({ timeout: 30_000 });
      const before = Number(await edge.getAttribute("aria-valuenow"));
      await plus.click();
      await expect(picker).toBeVisible();
      await edge.focus();
      await page.keyboard.press("ArrowLeft");
      await expect.poll(async () => Number(await edge.getAttribute("aria-valuenow"))).toBe(before - 1);
      await page.keyboard.press("Home");
      await expect.poll(async () => Number(await edge.getAttribute("aria-valuenow"))).toBe(before);
      // The keyboard on the edge is no press outside — the picker is still open; Esc closes it.
      await expect(picker).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(picker).toHaveCount(0);
      await edge.focus();
      await page.keyboard.press("ArrowLeft");
      await expect.poll(async () => Number(await edge.getAttribute("aria-valuenow"))).toBe(before - 1);
      await page.keyboard.press("Home");
      await expect.poll(async () => Number(await edge.getAttribute("aria-valuenow"))).toBe(before);
      // 41.40: „Gata" put the tile back at rest — no „+" any more. 41.97: „Renunță" does it now; „Gata" is gone.
      await expect(con.locator("[data-tile-done]")).toHaveCount(0);
      await con.locator('[data-tile-cancel="connections"]').click();
      await expect(con.locator('[data-tile-edit-bar="connections"]')).toHaveCount(0);
      await expect(con.getByRole("button", { name: /^\+ / })).toHaveCount(0);
    } finally {
      if (groupId) await page.request.delete(`/api/groups/${encodeURIComponent(groupId)}`);
      await removeRecord(page.request, "person", person);
    }
  });
});

// Slice 41.95 — Adrian: „The Groups section: • should not display the numbers of items in the group … the system should
// display the remove button in the top right corner of the rectangle - in the same way it does that for the tags … the
// description of the group will only display a maximum of three rows and …; it will display the entire description when
// the mouse hovers over the description … The Stamps section: [the same, two rows] … The “Add to Group” or “Apply stamp”
// buttons should look like the Add button for tags, They should be a white button". On an invented person, an invented
// group and an invented stamp, each with a long description.
test.describe("TC-TILES-10 (41.95) — grupuri și ștampile: codul singur, „×” pe colțul lui, descrierea tăiată", () => {
  test("codul fără număr, „×” pe dreptunghi la mouse, trei rânduri (două) și bula, butoanele albe", async ({ page }) => {
    test.slow();
    const M = `${MARK}-RAND`;
    await removeLeftovers(page.request, M);
    await page.setViewportSize({ width: 1366, height: 900 });
    const person = await createNaturalPerson(page.request, { lastName: M, firstName: "Ion" });
    const long = `${M} ${"o descriere destul de lungă ca să treacă de câteva rânduri ".repeat(6).trim()}`;
    // A stamp's short description is at most 200 characters (lib/stamps/validation.ts) — still several lines.
    const longStamp = long.slice(0, 190).trim();
    let groupId: string | undefined;
    let stampId: string | undefined;
    try {
      const po = ((await (await page.request.get(`/api/people/${person}/entity-references`)).json()) as { principalObjectId: string }).principalObjectId;
      const g = await page.request.post("/api/groups", { data: { targetType: "PHYSICAL_PERSON", description: long } });
      expect(g.status()).toBe(201);
      groupId = ((await g.json()) as { id: string }).id;
      expect((await page.request.post(`/api/metadata/${po}/groups`, { data: { groupId } })).ok()).toBeTruthy();
      const s = await page.request.post("/api/stamps", { data: { shortDescription: longStamp, notes: "" } });
      expect(s.status()).toBe(201);
      stampId = ((await s.json()) as { id: string }).id;
      expect((await page.request.post(`/api/metadata/${po}/stamps`, { data: { stampId } })).ok()).toBeTruthy();

      await page.goto(`/natural-persons/${person}?tab=metadata`);
      const con = await editConnections(page);
      for (const [kind, lines, name] of [["group", 3, /^Elimină din grup /], ["stamp", 2, /^Elimină ștampila /]] as const) {
        const row = con.locator(`[data-${kind}-row]`).first();
        await expect(row).toBeVisible({ timeout: 30_000 });
        const chip = row.locator("[data-code-chip]");
        const rect = chip.locator("> span").first();
        // The code alone, no count, no tooltip.
        await expect(rect).toHaveText(/^[A-Z0-9-]+$/);
        expect(await rect.getAttribute("title")).toBeNull();
        await expect(row.locator("[data-group-member-count]")).toHaveCount(0);
        // The „×" is the rectangle's: hidden at rest, drawn on its corner under the pointer; none at the row's right.
        const remove = row.getByRole("button", { name });
        await expect(remove).toHaveCount(1);
        await page.mouse.move(2, 2);
        await expect.poll(() => opacity(remove)).toBe(0);
        await rect.hover();
        await expect.poll(() => opacity(remove)).toBe(1);
        const [xb, cb, rb] = await Promise.all([remove.boundingBox(), rect.boundingBox(), row.boundingBox()]);
        expect(xb!.x + xb!.width, "on the rectangle's right corner").toBeGreaterThan(cb!.x + cb!.width - 4);
        expect(xb!.x, "not at the row's right").toBeLessThan(cb!.x + cb!.width + 16);
        expect(xb!.y).toBeLessThan(cb!.y + 4);
        // The description: to the tile's inner edge, cut after `lines` lines, whole in the bubble under the pointer.
        const desc = row.locator("[data-row-description]");
        const d = await desc.evaluate((el) => {
          const lh = parseFloat(getComputedStyle(el).lineHeight);
          return { lines: Math.round(el.getBoundingClientRect().height / lh), cut: el.scrollHeight > el.clientHeight + 0.5, right: el.getBoundingClientRect().right };
        });
        expect(d).toMatchObject({ lines, cut: true });
        expect(rb!.x + rb!.width - d.right, "to the row's edge").toBeLessThanOrEqual(2);
        await expect(desc).toHaveAttribute("href", kind === "group" ? /\/admin\/groups\// : /\/admin\/stamps\//);
        await desc.hover();
        await expect(page.getByRole("tooltip").filter({ hasText: kind === "group" ? long : longStamp })).toBeVisible();
        await page.mouse.move(2, 2);
      }
      // The two add buttons: white, bordered — the secondary face.
      for (const label of ["+ Adaugă în grup", "+ Aplică ștampilă"]) {
        const b = con.getByRole("button", { name: label, exact: true });
        await expect(b).toBeVisible();
        await expect(b).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
        await expect(b).toHaveCSS("border-top-style", "solid");
      }
    } finally {
      if (groupId) await page.request.delete(`/api/groups/${encodeURIComponent(groupId)}`);
      if (stampId) await page.request.delete(`/api/stamps/${encodeURIComponent(stampId)}`);
      await removeRecord(page.request, "person", person);
    }
  });
});

// Slice 41.97 — Adrian: „Remove the “Done” buttons from the “Tags and groups” and the new “Other references” tile; just
// use the Save and Cancel buttons at the bottom In the same way the “Classification” tile is using". On invented records:
// a person with a stamp, a group to join, a second person to refer to.
test.describe("TC-TILES-10 (41.97) — „Salvează” / „Renunță” în loc de „Gata”", () => {
  test("„Renunță” nu scrie nimic; „Salvează” scrie eticheta, grupul și scoaterea ștampilei; la fel „Alte referințe”; Esc", async ({ page }) => {
    test.slow();
    const M = `${MARK}-SALV`;
    const TAG = `${M.toLowerCase()}-eticheta`;
    await removeLeftovers(page.request, M);
    await page.setViewportSize({ width: 1366, height: 900 });
    const person = await createNaturalPerson(page.request, { lastName: M, firstName: "Ion" });
    const other = await createNaturalPerson(page.request, { lastName: `${M} Doi`, firstName: "Maria" });
    let groupId: string | undefined;
    let stampId: string | undefined;
    try {
      const po = ((await (await page.request.get(`/api/people/${person}/entity-references`)).json()) as { principalObjectId: string }).principalObjectId;
      const g = await page.request.post("/api/groups", { data: { targetType: "PHYSICAL_PERSON", description: `${M} Grup` } });
      expect(g.status()).toBe(201);
      groupId = ((await g.json()) as { id: string }).id;
      const s = await page.request.post("/api/stamps", { data: { shortDescription: `${M} Ștampilă`, notes: "" } });
      expect(s.status()).toBe(201);
      stampId = ((await s.json()) as { id: string }).id;
      expect((await page.request.post(`/api/metadata/${po}/stamps`, { data: { stampId } })).ok()).toBeTruthy();
      const otherCode = ((await (await page.request.get(`/api/people/${other}`)).json()) as { person: { code: string } }).person.code;
      const url = `/natural-persons/${person}?tab=metadata`;
      const region = () => page.getByRole("region", { name: "Etichete și grupuri", exact: true });

      async function hold() {
        const con = await editConnections(page);
        // No „Gata"; no X while in edit (41.91); „Salvează" disabled until something is held.
        await expect(con.locator("[data-tile-done]")).toHaveCount(0);
        await expect(con.locator("[data-tile-close]")).toHaveCount(0);
        await expect(con.locator('[data-tile-save="connections"]')).toBeDisabled();
        await con.locator("[data-tag-input]").fill(TAG);
        await con.locator("[data-tag-input]").press("Enter");
        await expect(con.locator('[data-tag-chip][data-held="add"]')).toContainText(TAG);
        await con.getByRole("button", { name: "+ Adaugă în grup", exact: true }).click();
        await con.locator("[data-groups-picker]").selectOption(groupId!);
        await expect(con.locator('[data-group-row][data-held="add"]')).toHaveCount(1);
        await expect(con.locator('[data-tile-save="connections"]')).toBeEnabled();
        return con;
      }

      // Step 1 — a tag and a group held, „Renunță": nothing written.
      await page.goto(url);
      let con = await hold();
      await con.locator('[data-tile-cancel="connections"]').click();
      await expect(con.locator('[data-tile-edit-bar="connections"]')).toHaveCount(0);
      let refs = (await (await page.request.get(`/api/people/${person}/entity-references`)).json()) as { groups: unknown[]; stamps: unknown[] };
      expect(refs.groups).toHaveLength(0);
      await page.reload();
      await expect(region().locator("[data-tag-chip]")).toHaveCount(0, { timeout: 30_000 });
      await expect(region().locator("[data-group-row]")).toHaveCount(0);

      // Step 2 — the same again, the stamp removed, „Salvează": after a reload the tag and the group are there, the stamp gone.
      con = await hold();
      const stampRow = con.locator("[data-stamp-row]").first();
      await stampRow.locator("[data-code-chip]").hover();
      await stampRow.getByRole("button", { name: /^Elimină ștampila / }).click();
      await expect(con.locator("[data-stamp-row]")).toHaveCount(0);
      await con.locator('[data-tile-save="connections"]').click();
      await expect(con.locator('[data-tile-edit-bar="connections"]')).toHaveCount(0, { timeout: 30_000 });
      await page.reload();
      await expect(region().locator("[data-tag-chip]")).toHaveText([TAG], { timeout: 30_000 });
      await expect(region().locator("[data-group-row]")).toHaveCount(1);
      await expect(region().locator("[data-stamp-row]")).toHaveCount(0);
      refs = (await (await page.request.get(`/api/people/${person}/entity-references`)).json()) as { groups: unknown[]; stamps: unknown[] };
      expect(refs.groups).toHaveLength(1);
      expect(refs.stamps).toHaveLength(0);

      // Step 3 — Esc is „Renunță": a second tag held, Esc, nothing of it left.
      con = await editConnections(page);
      await con.locator("[data-tag-input]").fill(`${TAG}-doi`);
      await con.locator("[data-tag-input]").press("Enter");
      await expect(con.locator('[data-tag-chip][data-held="add"]')).toHaveCount(1);
      await con.locator("[data-tag-input]").press("Escape");
      await expect(con.locator('[data-tile-edit-bar="connections"]')).toHaveCount(0);
      await expect(region().locator("[data-tag-chip]")).toHaveText([TAG]);

      // Step 4 — „Alte referințe": a reference held, „Salvează"; after a reload it is there, by name.
      const other4 = page.getByRole("region", { name: "Alte referințe", exact: true });
      await other4.locator('[data-tile-edit="otherReferences"]').click();
      await expect(other4.locator("[data-tile-done]")).toHaveCount(0);
      await other4.getByRole("button", { name: "+ Adaugă trimitere", exact: true }).click();
      await other4.getByPlaceholder("Codul entității").fill(otherCode);
      await other4.getByRole("button", { name: "Leagă", exact: true }).click();
      await expect(other4.locator('[data-reference-row][data-held="add"]')).toContainText(otherCode);
      await other4.locator('[data-tile-save="otherReferences"]').click();
      await expect(other4.locator('[data-tile-edit-bar="otherReferences"]')).toHaveCount(0, { timeout: 30_000 });
      await page.reload();
      await expect(page.getByRole("region", { name: "Alte referințe", exact: true }).locator("[data-reference-row]")).toContainText(`${M} Doi`, { timeout: 30_000 });
    } finally {
      // The persons first: a group with a member cannot be deleted.
      await removeRecord(page.request, "person", person);
      await removeRecord(page.request, "person", other);
      if (groupId) await page.request.delete(`/api/groups/${encodeURIComponent(groupId)}`);
      await removeGroupLeftovers(page.request, M);
      if (stampId) await page.request.delete(`/api/stamps/${encodeURIComponent(stampId)}`);
    }
  });
});
