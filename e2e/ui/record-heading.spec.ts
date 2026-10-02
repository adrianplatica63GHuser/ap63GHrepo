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
 *   - Slice #37.49's pictures, not steps of the case: the top of each of the
 *     four records and of the long-named act, at 1366 and 1920 px, into
 *     `playwright-report/record-heading/`. The sidebar's „Recente" list is
 *     painted over.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
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

type Measured = { icon: string; ariaHidden: string | null; first: boolean; fontSize: number; iconH: number; iconW: number; gap: number; dy: number; sameColour: boolean };

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
      sameColour: getComputedStyle(svg).color === getComputedStyle(h).color,
    };
  });
}

/** Steps 1–4's „the same size, gap and hiding". */
function expectIcon(m: Measured, icon: string): void {
  expect(m.icon).toBe(icon);
  expect(m.first).toBe(true);
  expect(m.ariaHidden).toBe("true");
  expect(Math.abs(m.iconH - m.fontSize)).toBeLessThanOrEqual(2);
  expect(m.gap / m.fontSize).toBeGreaterThanOrEqual(0.5);
  expect(m.gap / m.fontSize).toBeLessThanOrEqual(0.6);
  expect(Math.abs(m.dy)).toBeLessThanOrEqual(1);
  expect(m.sameColour).toBe(true);
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
      expectIcon(await measure(heading), "lucide-user");
      await photograph(page, "natural-person");

      // Step 2 — the Judicial Person: `lucide-building2`.
      heading = await openHeading(page, `/judicial-persons/${companyId}`, COMPANY);
      expectIcon(await measure(heading), "lucide-building2");
      await photograph(page, "judicial-person");

      // Step 3 — the Property: `lucide-map`.
      heading = await openHeading(page, `/properties/${propertyId}`, PROPERTY);
      expectIcon(await measure(heading), "lucide-map");
      await photograph(page, "property");

      // Step 4 — the Document `TC-ICON-07 Act`: whole, `lucide-file-text`.
      heading = await openHeading(page, `/documents/${documentId}`, DOCUMENT);
      expectIcon(await measure(heading), "lucide-file-text");
      expect(await heading.locator("span").evaluate((s) => s.scrollWidth > s.clientWidth)).toBe(false);
      await photograph(page, "document");

      // Step 5 — the long name: named in full, titled in full, „…" on screen, the icon whole,
      // „Neprocesat" then the version controls after it, inside the header.
      heading = await openHeading(page, `/documents/${longId}`, LONG);
      await expect(heading).toHaveAttribute("title", LONG);
      for (const width of [1366, 1920]) {
        // Step 6 is the same reading at 1920 × 1080.
        await page.setViewportSize({ width, height: width === 1366 ? 900 : 1080 });
        const m = await measure(heading);
        expectIcon(m, "lucide-file-text");
        expect(Math.abs(m.iconW - m.fontSize)).toBeLessThanOrEqual(2);
        const layout = await heading.evaluate((h) => {
          const name = h.querySelector("span") as HTMLElement;
          const header = h.parentElement as HTMLElement;
          const pill = header.querySelector("span.rounded-full") as HTMLElement;
          const nav = header.lastElementChild as HTMLElement;
          const nr = name.getBoundingClientRect();
          const pr = pill.getBoundingClientRect();
          const vr = nav.getBoundingClientRect();
          return {
            truncated: name.scrollWidth > name.clientWidth,
            overflow: getComputedStyle(name).textOverflow,
            pill: pill.textContent ?? "",
            pillAfterName: pr.left >= nr.right,
            navAfterPill: vr.left >= pr.right,
            navInside: vr.right <= header.getBoundingClientRect().right + 0.5,
          };
        });
        expect(layout.truncated).toBe(true);
        expect(layout.overflow).toBe("ellipsis");
        expect(layout.pill).toContain("Neprocesat");
        expect(layout.pillAfterName).toBe(true);
        expect(layout.navAfterPill).toBe(true);
        expect(layout.navInside).toBe(true);
      }
      await photograph(page, "document-long-name");
    } finally {
      // At the end — leaving things as they were found.
      for (const [kind, id] of made.reverse()) await removeRecord(page.request, kind, id);
    }
  });
});
