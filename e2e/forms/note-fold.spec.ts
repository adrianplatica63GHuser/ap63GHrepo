/**
 * Case:   TC-FOLD-01 — „Note” și MRZ lungi se strâng la cinci rânduri, cu „Arată mai mult…”
 * Source: docs/testing/cases/TC-FOLD-01.md, „Last green" 2026-10-01
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim. The heights are the case's, at 1920 px: 110 px
 * folded, 250, 310 and 150 px open.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-FOLD-01`, not `TC-FOLD-01` (records.ts), and
 *     are created by POSTing the bodies the case names, as its „Before you
 *     start" says; they are removed through the DELETE routes at the end.
 *   - Slice #37.40's pictures, not a step of the case: the Document's „Note
 *     extinse" and the Natural Person's MRZ, folded and open, at 1366 and 1920
 *     px, into `playwright-report/note-fold/`. The sidebar's „Recente" list is
 *     painted over.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { removeLeftovers, removeRecord } from "../helpers/records";

const MARK = "TC-E2E-FOLD-01";
const SHOTS = "playwright-report/note-fold";
const NOTE = Array.from({ length: 12 }, (_, i) => `Rândul ${i + 1} al notei de test.`).join("\n");
const PARA =
  "Un singur paragraf lung, fără niciun rând nou, scris ca să se rupă pe ecran pe mai multe rânduri decât cinci. "
    .repeat(9)
    .trim();
const MRZ = [
  "IDROUTCFOLDNTEST<<PERSOANA<<<<<<<<<<",
  "XX000000<0ROU0001019M3001017<<<<<<4",
  "TC<FOLD<01<<<<<<<<<<<<<<<<<<<<<<<<<<",
  "RAND<PATRU<<<<<<<<<<<<<<<<<<<<<<<<<<",
  "RAND<CINCI<<<<<<<<<<<<<<<<<<<<<<<<<<",
  "RAND<SASE<<<<<<<<<<<<<<<<<<<<<<<<<<<",
  "RAND<SAPTE<<<<<<<<<<<<<<<<<<<<<<<<<<",
].join("\n");

const recent = (page: Page) =>
  page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) });

/**
 * The box named `name` that the case means: the one under which a link shows.
 * A Property and a Natural Person each draw TWO „Note" boxes — their own and
 * the address block's — and the case's is the one with the long value, so
 * the only one of the two with a link. The empty one is `foldsWithoutLink`.
 */
function fold(page: Page, name: string) {
  const named = page.locator("[data-fold-box]").filter({ has: page.getByRole("textbox", { name, exact: true }) });
  const wrap = named.filter({ has: page.getByRole("button") });
  return {
    box: wrap.getByRole("textbox"),
    more: wrap.getByRole("button", { name: "Arată mai mult…" }),
    less: wrap.getByRole("button", { name: "Arată mai puțin…" }),
    links: named.getByRole("button"),
  };
}

async function height(box: Locator): Promise<number> {
  return Math.round((await box.boundingBox())?.height ?? 0);
}

/** Folded at 110 px with „Arată mai mult…"; open at `openPx` with „Arată mai puțin…"; folded again. */
async function expectFolds(page: Page, name: string, openPx: number, shot?: string): Promise<void> {
  const f = fold(page, name);
  await expect(f.more).toBeVisible({ timeout: 30_000 });
  await expect(f.more).toHaveAttribute("aria-expanded", "false");
  await expect(f.box).toHaveAttribute("data-folded", "true");
  expect(await height(f.box)).toBe(110);
  if (shot) await photograph(page, f.box, `${shot}-folded`);
  await f.more.click();
  await expect(f.less).toHaveAttribute("aria-expanded", "true");
  await expect(f.box).toHaveAttribute("data-folded", "false");
  expect(await height(f.box)).toBe(openPx);
  if (shot) await photograph(page, f.box, `${shot}-open`);
  await f.less.click();
  await expect(f.more).toBeVisible();
  expect(await height(f.box)).toBe(110);
}

async function photograph(page: Page, box: Locator, name: string): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    await box.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png`, mask: [recent(page)] });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
}

test.describe("TC-FOLD-01 — „Note” și MRZ lungi se strâng la cinci rânduri, cu „Arată mai mult…”", () => {
  test("Note extinse, Note și MRZ: cinci rânduri, „Arată mai mult…”, totul, „Arată mai puțin…”", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });

    const types = (await (await page.request.get("/api/admin/value-lists/document-types")).json()) as {
      items: { id: string; key: string }[];
    };
    const cvc = types.items.find((t) => t.key === "CONTRACT_VANZARE");
    expect(cvc, "the Contract de Vânzare type").toBeTruthy();
    const post = async (url: string, data: unknown) => {
      const res = await page.request.post(url, { data });
      expect(res.ok(), `POST ${url}: ${res.status()}`).toBeTruthy();
      return res.json();
    };
    const ids: { kind: "document" | "property" | "person"; id: string }[] = [];
    try {
      const doc = await post("/api/documents", {
        documentTypeId: cvc!.id,
        title: `${MARK} Act cu note lungi`,
        notes: NOTE,
        provenance: "MANUAL",
      });
      ids.push({ kind: "document", id: doc.id ?? doc.document.id });
      const prop = await post("/api/properties", { nickname: `${MARK} Teren cu notă lungă`, notes: PARA, provenance: "MANUAL" });
      ids.push({ kind: "property", id: prop.property.id });
      const person = await post("/api/people", { lastName: MARK, firstName: "Persoana", idMrzRaw: MRZ, provenance: "MANUAL" });
      ids.push({ kind: "person", id: person.person.id });

      // Steps 1–3 — „Note extinse": five lines, all twelve, five again.
      await page.goto(`/documents/${ids[0].id}`);
      await expectFolds(page, "Note extinse", 250, "document-note-extinse");

      // Steps 4–5 — the Property's „Note": one paragraph, no line break, folds as well.
      await page.goto(`/properties/${ids[1].id}`);
      await expectFolds(page, "Note", 310);

      // Steps 6–7 — the MRZ: five of seven lines; the empty „Note" has no link.
      await page.goto(`/natural-persons/${ids[2].id}`);
      await expectFolds(page, "MRZ (text brut)", 150, "natural-person-mrz");
      // Its own „Note" and the address block's are both empty: no link under either.
      await expect(fold(page, "Note").links).toHaveCount(0);
    } finally {
      // The case's own cleanup, through the routes „Șterge" → „Da" calls.
      for (const { kind, id } of ids) await removeRecord(page.request, kind, id);
    }
  });
});
