/**
 * Case:   TC-ASSOC-15 — „Legături" se încarcă pe fișa unei persoane, a unei firme, a unei proprietăți și a unui act
 * Source: docs/testing/cases/TC-ASSOC-15.md, „Last green" 2026-10-21
 *
 * Slice 40.16. Adrian, 2026-10-21: „when I opened a principal object form: the links tile cannot load its items;
 * Failed to load!". The archive's own records, read and never written: a natural person from the list's first page
 * with links of every kind — natural and juridical persons, properties, documents — and, from its links, a company, a
 * property and a document. On each form „Legături" shows a group of rows for every kind the record's routes answer,
 * and no error line. Each route the tile reads must answer 200.
 *
 * Only boxes, kinds and counts are read — no name. The property's form loads no map (e2e/README.md: maps are blocked),
 * no Street View and no address look-up.
 */

import { test, expect, type APIRequestContext, type Page } from "../helpers/test";
import { showTile } from "../helpers/tiles";

type Kind = "natural" | "judicial" | "property" | "document";
type Item = { id: string; type?: string };

async function items(request: APIRequestContext, url: string): Promise<Item[]> {
  const res = await request.get(url);
  expect(res.status(), `GET ${url}`).toBe(200);
  return ((await res.json()) as { items: Item[] }).items;
}

const personKind = (i: Item): Kind => (i.type === "JUDICIAL" ? "judicial" : "natural");

/** The kinds a person's or a company's routes answer rows for. */
async function personKinds(request: APIRequestContext, id: string) {
  const refs = await items(request, `/api/people/${id}/references`);
  const props = await items(request, `/api/people/${id}/properties`);
  const docs = await items(request, `/api/people/${id}/documents`);
  const kinds = new Set<Kind>(refs.map(personKind));
  if (props.length) kinds.add("property");
  if (docs.length) kinds.add("document");
  return { kinds, refs, props, docs };
}

/** „Legături" on the open form: its groups, and no error line under them. */
async function readTile(page: Page) {
  const tile = await showTile(page, "Legături");
  await expect(tile.getByText("Se încarcă…", { exact: true })).toHaveCount(0, { timeout: 30_000 });
  await expect(tile.locator("[data-related-group]").first()).toBeVisible({ timeout: 30_000 });
  const groups = await tile.locator("[data-related-group]").evaluateAll((gs) =>
    gs.map((g) => ({ kind: (g as HTMLElement).dataset.relatedGroup as Kind, rows: g.querySelectorAll("[data-row-content]").length })),
  );
  return { groups, errors: await tile.locator("[data-related-load-failed], [role=alert]").count() };
}

test.describe("TC-ASSOC-15 — „Legături” se încarcă pe cele patru fișe", () => {
  test("persoană, firmă, proprietate, act: un grup pentru fiecare fel de legătură, nicio eroare", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Step 1 — a natural person with links of every kind, from the list's first page.
    await page.goto("/natural-persons");
    const links = page.locator("main [data-list-frame] tbody tr").getByRole("link", { name: "Deschide", exact: true });
    await expect(links.first()).toBeVisible({ timeout: 30_000 });
    const ids = (await links.evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""))).map((h) => h.split("/").pop()!).filter(Boolean);
    let person: { id: string; kinds: Set<Kind>; refs: Item[]; props: Item[]; docs: Item[] } | null = null;
    for (const id of ids) {
      const k = await personKinds(page.request, id);
      if (k.kinds.size === 4) {
        person = { id, ...k };
        break;
      }
    }
    expect(person, "a person on the list's first page with natural and juridical persons, properties and documents").not.toBeNull();
    const p = person!;

    // Step 2 — the person's form: four groups, each with rows; no error.
    await page.goto(`/natural-persons/${p.id}`);
    const onPerson = await readTile(page);
    expect({ kinds: onPerson.groups.map((g) => g.kind), empty: onPerson.groups.filter((g) => g.rows === 0).length, errors: onPerson.errors })
      .toEqual({ kinds: ["natural", "judicial", "property", "document"], empty: 0, errors: 0 });

    // Step 3 — a company the person is linked to: a group for every kind its routes answer.
    const companyId = p.refs.find((r) => r.type === "JUDICIAL")!.id;
    const company = await personKinds(page.request, companyId);
    await page.goto(`/judicial-persons/${companyId}`);
    const onCompany = await readTile(page);
    expect({ kinds: new Set(onCompany.groups.map((g) => g.kind)), errors: onCompany.errors }).toEqual({ kinds: company.kinds, errors: 0 });

    // Step 4 — a property the person is linked to (its map blocked).
    const propertyId = p.props[0].id;
    const propKinds = new Set<Kind>((await items(page.request, `/api/properties/${propertyId}/persons`)).map(personKind));
    if ((await items(page.request, `/api/properties/${propertyId}/references`)).length) propKinds.add("property");
    if ((await items(page.request, `/api/properties/${propertyId}/documents`)).length) propKinds.add("document");
    await page.goto(`/properties/${propertyId}`);
    const onProperty = await readTile(page);
    expect({ kinds: new Set(onProperty.groups.map((g) => g.kind)), errors: onProperty.errors }).toEqual({ kinds: propKinds, errors: 0 });

    // Step 5 — a document the person is linked to. Its persons split between „Părți” and „Legături” (#38.33), so the
    // routes say which kinds may show; every group drawn is one of them, and the person's own kind is among them.
    let documentId: string | null = null;
    for (const d of p.docs) {
      const answered = await Promise.all(["persons", "properties", "references"].map((k) => items(page.request, `/api/documents/${d.id}/${k}`)));
      if (answered[1].length + answered[2].length > 0) {
        documentId = d.id;
        break;
      }
    }
    expect(documentId, "a document of the person's with a property or another document linked").not.toBeNull();
    await page.goto(`/documents/${documentId}`);
    const onDocument = await readTile(page);
    expect(onDocument.errors).toBe(0);
    expect(onDocument.groups.length).toBeGreaterThan(0);
    expect(onDocument.groups.every((g) => g.rows > 0)).toBe(true);
  });
});
