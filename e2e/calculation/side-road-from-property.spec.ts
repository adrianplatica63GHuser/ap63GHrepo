/**
 * Case:   TC-CALC-02 — „Calcul drum lateral" de la o proprietate din arhivă: trei proprietari, 99,99%, drum de 4 m, create
 * Source: docs/testing/cases/TC-CALC-02.md, „Last green" 2026-10-18
 *
 * A translation of the case file, step for step (Slice #39.79). Every Romanian string below is quoted from it
 * verbatim.
 *
 * 2026-10-18 (Adrian): an owner is found by code and by words in any order (steps 4), the screen keeps what was typed
 * while another screen is open (step 7), and „Resetează" empties it (step 8).
 *
 * No real maps: step 1 is a form, and steps 2 to 4 are reached without the map — the road is laid with the two
 * select boxes under the prompt, the keyboard's way to the same two clicks (#38.24). The preview map is TC-CALC-01's.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records are made through the API before step 1, each marked `TC-E2E-CALC-02`, and every one of them — the
 *     three properties, the three persons, the four properties the calculation creates, its group and its run — is
 *     removed in `finally`, which runs after a red step too.
 *   - The corners are TC-PROP-03's Stereo 70 corners converted to WGS84 here (transdatRO, the app's own conversion),
 *     with their numbers 16–19, as a property imported from that file holds them.
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createCompany, createNaturalPerson, createProperty, removeGroupLeftovers, removeLeftovers } from "../helpers/records";
import { stereo70ToWgs84 } from "../../src/lib/geo/transdatRO";
import { OWNER_COLORS } from "../../src/lib/calculation/owner-colors";

const MARK = `${E2E_MARKER}CALC-02`;
const GROUP = `${MARK} Grup`;
const ROAD = `${MARK} Drum`;

/** TC-PROP-03's corners (TC-CALC-01's parcel), North / East, three decimals. */
const S70: [number, number, number][] = [
  [16, 318693.706, 573578.558],
  [17, 318675.77, 573554.698],
  [18, 318659.521, 573567.196],
  [19, 318677.456, 573591.056],
];
const wgs = ([n, north, east]: [number, number, number]) => ({ ...stereo70ToWgs84(north, east), originalIndex: n });
const FOUR = S70.map(wgs);
/** A fifth corner on the 19–16 side, nudged out: a five-corner property the calculation refuses. */
const FIVE = [...FOUR, wgs([20, 318686.0, 573587.0])];

const start = (page: Page) => page.locator('[data-calc-start]');
const problems = (page: Page) => page.locator('[data-panel="input-problems"]');
const divide = (page: Page) => page.getByRole("button", { name: "Împarte proprietatea", exact: true });
const reset = (page: Page) => start(page).getByRole("button", { name: "Resetează", exact: true });
const roadStatus = (page: Page) => page.locator('[data-panel="road-step"] p[role="status"]');

async function search(page: Page, box: string, term: string) {
  const input = start(page).getByRole("combobox", { name: box, exact: true });
  await input.fill(term);
  return page.locator(`[data-calc-search] ul[role="listbox"]`);
}

test.describe("TC-CALC-02 — calculul de la o proprietate și proprietarii ei", () => {
  test("proprietatea căutată, patru colțuri; proprietarii căutați, cu cote și culori; verificările; împărțirea, drumul, crearea, legăturile, re-rularea", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await removeLeftovers(page.request, MARK);
    await removeGroupLeftovers(page.request, MARK);

    const parcelId = await createProperty(page.request, { nickname: `${MARK} Teren`, corners: FOUR });
    await createProperty(page.request, { nickname: `${MARK} Cinci colțuri`, corners: FIVE });
    await createProperty(page.request, { nickname: `${MARK} Fără colțuri` });
    const ana = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ana" });
    const bogdan = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Bogdan" });
    const firma = await createCompany(page.request, { name: `${MARK} Firma SRL` });
    const people = new Map<string, string>();
    const codes = new Map<string, string>();
    for (const id of [ana, bogdan, firma]) {
      const p = ((await (await page.request.get(`/api/people/${id}`)).json()) as { person: { displayName: string; code: string } }).person;
      people.set(id, p.displayName);
      codes.set(id, p.code);
    }
    // 2026-10-18: Ana by her code, Bogdan by his name's words reversed and in lower case, the company by its name
    const owner = new Map<string, string>([
      [ana, codes.get(ana)!],
      [bogdan, people.get(bogdan)!.split(/\s+/).reverse().join(" ").toLowerCase()],
      [firma, people.get(firma)!],
    ]);
    const share = (name: string) => start(page).getByRole("textbox", { name: `Cota-parte a lui ${name}`, exact: true });
    const width = start(page).getByRole("textbox", { name: "Lățime drum", exact: true });
    /** Steps 3, 4, 5 and 6 at once, as they end: the property, the three owners, 33,33 each, a 4 m road. */
    const fillAll = async () => {
      const found = await search(page, "Caută proprietatea", `${MARK} Teren`);
      await found.locator("li").filter({ hasText: `${MARK} Teren` }).getByRole("button").click();
      await expect(start(page).locator("[data-calc-property]")).toContainText("4 colțuri", { timeout: 30_000 });
      for (const id of [ana, bogdan, firma]) {
        const hits = await search(page, "Caută un proprietar", owner.get(id)!);
        await hits.locator(`[data-calc-hit="${id}"]`).click({ timeout: 30_000 });
      }
      for (const id of [ana, bogdan, firma]) await share(people.get(id)!).fill("33,33");
      await width.fill("4");
      await expect(divide(page)).toBeEnabled();
    };
    let runId: string | null = null;

    try {
      // Step 1 — the page: „Calcul drum lateral".
      await page.goto("/admin/calculation");
      await expect(page.getByRole("heading", { name: "Calcul drum lateral", exact: true, level: 1 })).toBeVisible({ timeout: 30_000 });
      await expect(divide(page)).toBeDisabled();

      // Step 2 — the property without corners is greyed out; the one with five is refused.
      let list = await search(page, "Caută proprietatea", MARK);
      const none = list.locator("li").filter({ hasText: `${MARK} Fără colțuri` });
      await expect(none).toHaveCount(1, { timeout: 30_000 });
      await expect(none.getByRole("button")).toBeDisabled();
      await expect(none).toContainText("fără colțuri");
      await list.locator("li").filter({ hasText: `${MARK} Cinci colțuri` }).getByRole("button").click();
      await expect(problems(page)).toContainText("Proprietatea are 5 colțuri; trebuie să aibă exact 4.", { timeout: 30_000 });
      await expect(divide(page)).toBeDisabled();

      // Step 3 — the four-corner property: chosen, its four corners counted, the refusal gone.
      list = await search(page, "Caută proprietatea", `${MARK} Teren`);
      await list.locator("li").filter({ hasText: `${MARK} Teren` }).getByRole("button").click();
      await expect(start(page).locator("[data-calc-property]")).toContainText("4 colțuri", { timeout: 30_000 });
      await expect(problems(page)).toHaveCount(0);

      // Step 4 — three owners, found by search — Ana by her code, Bogdan by his name's words reversed, in lower case —
      // each with a badge in its own colour.
      for (const id of [ana, bogdan, firma]) {
        list = await search(page, "Caută un proprietar", owner.get(id)!);
        await list.locator(`[data-calc-hit="${id}"]`).click({ timeout: 30_000 });
      }
      const owners = start(page).locator("[data-calc-owner]");
      await expect(owners).toHaveCount(3);
      expect(await start(page).locator("[data-owner-badge]").evaluateAll((els) => els.map((e) => e.getAttribute("data-owner-badge")))).toEqual(OWNER_COLORS.slice(0, 3));
      // Nothing is refused yet: a share not typed, and no width, are not complaints.
      await expect(problems(page)).toHaveCount(0);

      // Step 5 — 98%, then a third decimal: each refused, the button off.
      await share(people.get(ana)!).fill("33,33");
      await share(people.get(bogdan)!).fill("33,33");
      await share(people.get(firma)!).fill("31,34");
      await expect(problems(page)).toContainText("Cotele-părți însumează 98,00%; trebuie să fie 100% sau 99,99%.");
      await share(people.get(firma)!).fill("33,333");
      await expect(problems(page)).toContainText(`Cota-parte a lui ${people.get(firma)!} („33,333”) nu se poate citi`);
      await share(people.get(firma)!).fill("33,33");
      await expect(divide(page)).toBeDisabled();

      // Step 6 — a 15 m road is refused; 4 m, and nothing is.
      await width.fill("15");
      await expect(problems(page)).toContainText("Lățimea drumului este 15 m; trebuie să fie peste 0 și sub 15 m.");
      await width.fill("4");
      await expect(problems(page)).toHaveCount(0);
      await expect(divide(page)).toBeEnabled();

      // Step 7 — another screen and back: everything typed is still there.
      await page.goto("/natural-persons");
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
      await page.goto("/admin/calculation");
      await expect(start(page).locator("[data-calc-property]")).toContainText(`${MARK} Teren`, { timeout: 30_000 });
      await expect(start(page).locator("[data-calc-owner]")).toHaveCount(3);
      for (const id of [ana, bogdan]) await expect(share(people.get(id)!)).toHaveValue("33,33");
      await expect(share(people.get(firma)!)).toHaveValue("33,33");
      await expect(width).toHaveValue("4");
      await expect(divide(page)).toBeEnabled();

      // Step 8 — „Resetează", right of „Împarte proprietatea": the screen is empty, and stays empty after a visit
      // elsewhere; then everything is chosen again.
      const buttons = await start(page).locator("[data-calc-divide], [data-calc-reset]").evaluateAll((els) => els.map((e) => [e.hasAttribute("data-calc-reset"), Math.round(e.getBoundingClientRect().left)] as const));
      expect(buttons.map(([isReset]) => isReset)).toEqual([false, true]);
      expect(buttons[1][1]).toBeGreaterThan(buttons[0][1]);
      await reset(page).click();
      await expect(start(page).locator("[data-calc-property]")).toHaveCount(0);
      await expect(start(page).locator("[data-calc-owner]")).toHaveCount(0);
      await expect(width).toHaveValue("");
      await expect(divide(page)).toBeDisabled();
      await page.goto("/properties");
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
      await page.goto("/admin/calculation");
      await expect(start(page)).toBeVisible({ timeout: 30_000 });
      await expect(start(page).locator("[data-calc-owner]")).toHaveCount(0);
      await expect(width).toHaveValue("");
      await fillAll();

      // Step 9 — „Împarte proprietatea": today's screen, the parcel and its three owners.
      await divide(page).click();
      await expect(page.getByText("Pasul 3 — drumul", { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-calc-summary]')).toContainText("3 proprietari, drum de 4 m");
      const table = page.locator('[data-panel="calculation"] table[data-width-table]');
      await expect(table.locator("tbody tr")).toHaveCount(3);
      const figure = (label: string) => page.locator('[data-panel="calculation"] div.rounded-md').filter({ has: page.getByText(label, { exact: true }) }).last();
      await expect(figure("Suprafața parcelei")).toContainText("611,87 m²");
      await expect(figure("Lățime drum")).toContainText("4,0 m");
      await expect(page.getByText(/^Cotele însumează 99,99%: ultima felie din ordine/)).toBeVisible();

      // Step 10 — the road from corner 18 along 18–19, by the two select boxes.
      await page.getByRole("combobox", { name: "Colțul drumului" }).selectOption({ label: "18" });
      await page.getByRole("combobox", { name: "Latura drumului" }).selectOption({ label: "18–19" });
      await expect(roadStatus(page)).toContainText("Drumul pornește din colțul 18, pe latura 18–19.", { timeout: 30_000 });

      // Step 11 — the group named after the property by default; „Creează proprietățile".
      const description = page.getByRole("textbox", { name: "Descrierea grupului" });
      await expect(description).toHaveValue(/^Diviz — PROP\d+$/);
      await description.fill(GROUP);
      await page.getByRole("textbox", { name: "Poreclă drum" }).fill(ROAD);
      await page.getByRole("button", { name: "Creează proprietățile", exact: true }).click();
      const done = page.locator('[data-panel="committed"]');
      await expect(done).toBeVisible({ timeout: 60_000 });
      runId = (await done.locator('a[href^="/admin/calculation/history/"]').getAttribute("href"))!.split("/").pop()!;
      const created = (await done.locator("ul a").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""))).map((h) => h.split("/").pop()!);
      expect(created).toHaveLength(4);

      // Step 12 — each owner's property names its owner, as „Proprietar"; the road names nobody; the parcel is untouched.
      const linked: string[] = [];
      for (const id of created) {
        const items = ((await (await page.request.get(`/api/properties/${id}/persons`)).json()) as { items: { id: string; roleName: string | null }[] }).items;
        for (const it of items) {
          expect(it.roleName).toBe("Proprietar");
          linked.push(it.id);
        }
      }
      expect(linked.sort()).toEqual([ana, bogdan, firma].sort());
      const parcel = (await (await page.request.get(`/api/properties/${parcelId}`)).json()) as { corners?: unknown[] };
      expect(JSON.stringify(parcel).match(/"originalIndex":\d+/g)?.length).toBe(4);

      // Step 13 — the run names the property, and re-runs: the same road, the same figures, no „Modifică datele".
      await page.goto(`/admin/calculation/history/${runId}`);
      const run = page.locator('[data-panel="calculation-run"]');
      await expect(run.locator("[data-divided-property]")).toContainText(/Proprietatea împărțită: PROP\d+/, { timeout: 30_000 });
      await run.getByRole("button", { name: "Re-rulează cu acești parametri" }).click();
      await expect(roadStatus(page)).toContainText("Drumul pornește din colțul 18, pe latura 18–19.", { timeout: 30_000 });
      await expect(figure("Suprafața parcelei")).toContainText("611,87 m²");
      await expect(page.getByRole("button", { name: "Modifică datele", exact: true })).toHaveCount(0);
    } finally {
      if (runId) {
        const r = await page.request.delete(`/api/calculation/runs/${runId}`);
        expect([200, 404]).toContain(r.status());
      }
      await removeGroupLeftovers(page.request, MARK);
      await removeLeftovers(page.request, MARK);
    }
  });
});
