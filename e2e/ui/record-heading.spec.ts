/**
 * Case:   TC-ICON-07 — Pictograma înregistrării înaintea numelui: persoană fizică, persoană juridică, proprietate, act
 * Source: docs/testing/cases/TC-ICON-07.md, „Last green" 2026-10-02
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim; an icon is read as the case reads it, the Lucide
 * class on the heading's first <svg>.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-ICON-07` (records.ts): `Persoană TC-E2E-ICON-07`,
 *     `TC-E2E-ICON-07 Firmă`, `TC-E2E-ICON-07 Teren`, `TC-E2E-ICON-07 Act` and
 *     the long-named act, whose name is the case's with the marker swapped.
 *   - The hand run read the sizes with a script on the page; here they are
 *     Playwright's bounding boxes of the same elements.
 *   - Step 7 (40.38) compares each list's icon with the Natural Person's, opened again at 1920, by the same reading.
 *   - Slice 41.47: each icon's colour is read in light and, with the page's `dark` class put on for the reading only,
 *     in dark — the theme's own switch is TC-SET's.
 *   - Slice 41.63: step 3b reads „Asociază persoană fizică"'s person icon on the property's „Legături" — on a primary
 *     (navy) button it takes the button's own colour, not the kind's.
 *   - Slice #37.49's pictures, not steps of the case: the top of each of the
 *     four records and of the long-named act, at 1366 and 1920 px, into
 *     `playwright-report/record-heading/`. The sidebar's „Recente" list is
 *     painted over.
 */

import { test, expect, type Locator, type Page } from "../helpers/test";
import {
  E2E_MARKER,
  createCompany,
  createNaturalPerson,
  createProperty,
  createSaleContract,
  removeLeftovers,
  removeRecord,
  type RecordKind,
} from "../helpers/records";
import { hideTile, showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}ICON-07`;
const PERSON = `Persoană ${MARK}`;
const COMPANY = `${MARK} Firmă`;
const PROPERTY = `${MARK} Teren`;
const DOCUMENT = `${MARK} Act`;
const LONG =
  `${MARK} Act cu un nume atât de lung încât nu încape pe un singur rând al antetului, ` +
  "nici pe un ecran de 1920 de pixeli, și se termină cu puncte de suspensie";
const SHOTS = "playwright-report/record-heading";

const recent = (page: Page) =>
  page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) });

async function photograph(page: Page, name: string): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `${SHOTS}/${name}-${width}.png`,
      clip: { x: 0, y: 0, width, height: 240 },
      mask: [recent(page)],
    });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

type Measured = { icon: string; ariaHidden: string | null; first: boolean; fontSize: number; iconH: number; iconW: number; gap: number; dy: number; colour: string; dark: string; nameColour: string };

/** Slice 41.47: each kind's line colour — Adrian's in light, the same hue lighter in dark (globals.css). */
type Kind = "natural" | "judicial" | "property" | "document";
const KIND_COLOUR: Record<Kind, { light: string; dark: string }> = {
  natural: { light: "rgb(90, 39, 129)", dark: "rgb(179, 130, 217)" }, // #5A2781 / #B382D9
  judicial: { light: "rgb(18, 52, 86)", dark: "rgb(112, 168, 225)" }, // #123456 / #70A8E1
  property: { light: "rgb(0, 168, 76)", dark: "rgb(0, 204, 92)" }, // #00A84C / #00CC5C
  document: { light: "rgb(0, 138, 242)", dark: "rgb(31, 159, 255)" }, // #008AF2 / #1F9FFF
};

/** The case's „icon", its size and its gap, read from the heading. */
async function measure(heading: Locator): Promise<Measured> {
  return heading.evaluate((h) => {
    const svg = h.querySelector("svg") as SVGElement;
    const name = h.querySelector("span") as HTMLElement;
    const ir = svg.getBoundingClientRect();
    const nr = name.getBoundingClientRect();
    return {
      icon: (svg.getAttribute("class") ?? "").split(" ").find((c) => c.startsWith("lucide-")) ?? "",
      ariaHidden: svg.getAttribute("aria-hidden"),
      first: h.firstElementChild === svg,
      fontSize: parseFloat(getComputedStyle(h).fontSize),
      iconH: ir.height,
      iconW: ir.width,
      gap: nr.left - ir.right,
      dy: (ir.top + ir.bottom) / 2 - (nr.top + nr.bottom) / 2,
      // 41.47: the icon's line in its kind's colour, read in light and, with the page's `dark` class put on for the
      // reading, in dark; the name beside it keeps the heading's own colour. (It read `sameColour`: the icon's colour
      // the heading's — #37.49's „the same colour as the words".)
      colour: getComputedStyle(svg).color,
      dark: (() => {
        const root = document.documentElement;
        const had = root.classList.contains("dark");
        root.classList.add("dark");
        const c = getComputedStyle(svg).color;
        if (!had) root.classList.remove("dark");
        return c;
      })(),
      nameColour: getComputedStyle(name).color === getComputedStyle(h).color ? "heading" : getComputedStyle(name).color,
    };
  });
}

/** Steps 1–4's „the same size, gap and hiding". */
function expectIcon(m: Measured, icon: string, kind: Kind): void {
  expect(m.icon).toBe(icon);
  expect(m.first).toBe(true);
  expect(m.ariaHidden).toBe("true");
  expect(Math.abs(m.iconH - m.fontSize)).toBeLessThanOrEqual(2);
  expect(m.gap / m.fontSize).toBeGreaterThanOrEqual(0.5);
  expect(m.gap / m.fontSize).toBeLessThanOrEqual(0.6);
  expect(Math.abs(m.dy)).toBeLessThanOrEqual(1);
  expect([m.colour, m.dark, m.nameColour]).toEqual([KIND_COLOUR[kind].light, KIND_COLOUR[kind].dark, "heading"]);
}

/** Step 7 (40.38): the four lists, their titles and their many-records icons. */
const LIST_TITLES = [
  ["/natural-persons", "Persoane fizice", "lucide-people-group", "natural"],
  ["/judicial-persons", "Persoane juridice", "lucide-buildings", "judicial"],
  ["/properties", "Proprietăți", "lucide-map-pins", "property"],
  ["/documents", "Acte", "lucide-pages", "document"],
] as const;

/** Where the heading's icon starts, from the page's left edge, and its gap to the words. */
async function place(heading: Locator): Promise<{ left: number; gap: number }> {
  return heading.evaluate((h) => {
    const ir = (h.querySelector("svg") as SVGElement).getBoundingClientRect();
    const nr = (h.querySelector("span") as HTMLElement).getBoundingClientRect();
    return { left: ir.left, gap: nr.left - ir.right };
  });
}

async function openHeading(page: Page, url: string, name: string): Promise<Locator> {
  await page.goto(url);
  const heading = page.getByRole("heading", { level: 1, name, exact: true });
  await expect(heading).toBeVisible({ timeout: 30_000 });
  return heading;
}

test.describe("TC-ICON-07 — pictograma înregistrării înaintea numelui", () => {
  test("persoană fizică, persoană juridică, proprietate, act, și un nume lung", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const made: [RecordKind, string][] = [];
    try {
      const personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Persoană" });
      made.push(["person", personId]);
      const companyId = await createCompany(page.request, { name: COMPANY });
      made.push(["company", companyId]);
      const propertyId = await createProperty(page.request, { nickname: PROPERTY });
      made.push(["property", propertyId]);
      const documentId = await createSaleContract(page.request, DOCUMENT);
      made.push(["document", documentId]);
      const longId = await createSaleContract(page.request, LONG);
      made.push(["document", longId]);

      // Step 1 — the Natural Person: `lucide-user`, hidden, as tall as the letters, two spaces.
      let heading = await openHeading(page, `/natural-persons/${personId}`, PERSON);
      expectIcon(await measure(heading), "lucide-user", "natural");
      await photograph(page, "natural-person");

      // Step 2 — the Judicial Person: `lucide-building2`.
      heading = await openHeading(page, `/judicial-persons/${companyId}`, COMPANY);
      expectIcon(await measure(heading), "lucide-building2", "judicial");
      await photograph(page, "judicial-person");

      // Step 3 — the Property: `lucide-map`.
      heading = await openHeading(page, `/properties/${propertyId}`, PROPERTY);
      expectIcon(await measure(heading), "lucide-map", "property");
      await photograph(page, "property");

      // Slice 41.63, step 3b — on the property's „Legături", „Asociază persoană fizică" is a primary (navy) button: its
      // person icon draws in the button's own colour, not #5A2781, light and dark, while the heading's map above keeps
      // #00A84C (step 3).
      const links = await showTile(page, "Legături");
      const associate = links.locator('[data-associate="natural"]').first();
      await expect(associate).toBeVisible({ timeout: 30_000 });
      const onNavy = await associate.evaluate((b) => {
        const svg = b.querySelector('svg[data-kind-icon="natural"]') as SVGElement;
        const read = () => ({ icon: getComputedStyle(svg).color, button: getComputedStyle(b).color });
        const light = read();
        const root = document.documentElement;
        const had = root.classList.contains("dark");
        root.classList.add("dark");
        const dark = read();
        if (!had) root.classList.remove("dark");
        return { light, dark };
      });
      expect(onNavy.light.icon).toBe(onNavy.light.button);
      expect(onNavy.dark.icon).toBe(onNavy.dark.button);
      expect([onNavy.light.icon, onNavy.dark.icon]).not.toContain(KIND_COLOUR.natural.light);
      expect(onNavy.dark.icon).not.toBe(KIND_COLOUR.natural.dark);
      await hideTile(page, "Legături"); // as it was found

      // Step 4 — the Document `TC-ICON-07 Act`: whole, `lucide-file-text`.
      heading = await openHeading(page, `/documents/${documentId}`, DOCUMENT);
      expectIcon(await measure(heading), "lucide-file-text", "document");
      expect(await heading.locator("span").evaluate((s) => s.scrollWidth > s.clientWidth)).toBe(false);
      await photograph(page, "document");

      // Step 5 — the long name: named in full, titled in full, „…" on screen, the icon whole, „Neprocesat" after it,
      // inside the header. (41.47: it read „…then the version controls after it" — 41.08 moved them to the page bar,
      // so the pill is the header's last element; found stale by 41.47's run, the first since.)
      heading = await openHeading(page, `/documents/${longId}`, LONG);
      await expect(heading).toHaveAttribute("title", LONG);
      for (const width of [1366, 1920]) {
        // Step 6 is the same reading at 1920 × 1080.
        await page.setViewportSize({ width, height: width === 1366 ? 900 : 1080 });
        const m = await measure(heading);
        expectIcon(m, "lucide-file-text", "document");
        expect(Math.abs(m.iconW - m.fontSize)).toBeLessThanOrEqual(2);
        const layout = await heading.evaluate((h) => {
          const name = h.querySelector("span") as HTMLElement;
          const header = h.parentElement as HTMLElement;
          const pill = header.querySelector("span.rounded-full") as HTMLElement;
          const nr = name.getBoundingClientRect();
          const pr = pill.getBoundingClientRect();
          return {
            truncated: name.scrollWidth > name.clientWidth,
            overflow: getComputedStyle(name).textOverflow,
            pill: pill.textContent ?? "",
            pillAfterName: pr.left >= nr.right,
            // Nothing drawn after the pill in the header (a portal's empty anchor, if any, has no width).
            pillLast: [...header.children].slice([...header.children].indexOf(pill) + 1).every((e) => e.getBoundingClientRect().width === 0),
            pillInside: pr.right <= header.getBoundingClientRect().right + 0.5,
          };
        });
        expect(layout.truncated).toBe(true);
        expect(layout.overflow).toBe("ellipsis");
        expect(layout.pill).toContain("Neprocesat");
        expect(layout.pillAfterName).toBe(true);
        expect(layout.pillLast).toBe(true);
        expect(layout.pillInside).toBe(true);
      }
      await photograph(page, "document-long-name");

      // Step 7 (40.38) — the four lists: a many-records icon before the title, 1.25 × a record's (30 px ± 1), its left
      // edge and its gap to the title a record screen's within 1 px; the heading still named by the title alone.
      await page.setViewportSize({ width: 1920, height: 1080 });
      const record = await openHeading(page, `/natural-persons/${personId}`, PERSON);
      const at = await place(record);
      for (const [url, title, icon, kind] of LIST_TITLES) {
        const heading = await openHeading(page, url, title);
        const m = await measure(heading);
        expect(m.icon).toBe(icon);
        expect(m.first).toBe(true);
        expect(m.ariaHidden).toBe("true");
        expect(Math.abs(m.iconH - 30)).toBeLessThanOrEqual(1);
        expect(Math.abs(m.iconW - 30)).toBeLessThanOrEqual(1);
        expect(Math.abs(m.dy)).toBeLessThanOrEqual(1);
        // 41.47: the plural icon in its kind's colour too (it read `expect(m.sameColour).toBe(true)`).
        expect([m.colour, m.dark, m.nameColour]).toEqual([KIND_COLOUR[kind].light, KIND_COLOUR[kind].dark, "heading"]);
        const p = await place(heading);
        expect(Math.abs(p.left - at.left)).toBeLessThanOrEqual(1);
        expect(Math.abs(m.gap - at.gap)).toBeLessThanOrEqual(1);
      }
      await page.setViewportSize({ width: 1366, height: 900 });
    } finally {
      // At the end — leaving things as they were found.
      for (const [kind, id] of made.reverse()) await removeRecord(page.request, kind, id);
    }
  });
});
