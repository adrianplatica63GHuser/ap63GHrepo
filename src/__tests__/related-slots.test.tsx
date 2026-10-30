/**
 * Slice 41.09 — „Legături": the names take the room.
 *
 * Adrian, 2026-10-29: „I see some wasted space on the link style between the name of the object and the buttons … give
 * more space to the name of the object so it fills the empty room". The room was a slot no row filled — „Cotă" on a
 * person's and a property's „Legături", „Relația" where no row has one — kept empty on every row. A tile now keeps the
 * slots its rows fill, one set for every group, so the buttons still line up (#37.65); the name is the row's flexible
 * part up to its tag (Ask first 1). „Părți" and the read-only „Legături" are the same tile (Ask first 3). The units do
 * not change (Ask first 2).
 */
import { render } from "@testing-library/react";

import { RelatedTile, usedSlots, type RelatedRow } from "@/components/tiles/related-tile";
import { LIST_UNITS, RELATED_READONLY_SLOTS, RELATED_SLOTS, RELATED_UNITS, unitsRem } from "@/lib/ui/field-widths";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
jest.mock("@/components/providers/unsaved-changes-provider", () => ({
  useUnsavedChanges: () => ({ guardedNavigate: jest.fn() }),
}));

const row = (key: string, kind: RelatedRow["kind"], buttons: RelatedRow["buttons"], role?: string): RelatedRow => ({
  key,
  kind,
  radioLabel: key,
  content: key,
  title: key,
  href: `/x/${key}`,
  buttons,
  role,
  dissociate: jest.fn(async () => {}),
});

const slotsOf = (li: Element) => [...li.querySelectorAll("[data-slot]")].map((s) => s.getAttribute("data-slot"));

describe("usedSlots", () => {
  it("keeps the list's order, and only the slots a row fills", () => {
    expect(usedSlots(RELATED_SLOTS, [{ preview: "p" }, { relation: "r", preview: "p" }])).toEqual(["relation", "preview"]);
    expect(usedSlots(RELATED_SLOTS, [{ preview: "p" }])).toEqual(["preview"]);
    expect(usedSlots(RELATED_SLOTS, [{ share: "s" }, { preview: "p" }])).toEqual(["share", "preview"]);
    expect(usedSlots(RELATED_SLOTS, [{ share: null, relation: undefined, preview: false }])).toEqual([]);
    expect(usedSlots(RELATED_READONLY_SLOTS, [{ relation: "r" }])).toEqual(["relation"]);
  });
});

describe("the tile", () => {
  const draw = (rows: RelatedRow[], readOnly = false) =>
    render(<RelatedTile readOnly={readOnly} label="Legături" rows={rows} loading={false} associate={[]} />).container;

  it("a person's or a property's „Legături” — nothing holds a share — draws no „Cotă” slot on any row", () => {
    const c = draw([
      row("Ion", "natural", { preview: "p" }, "Soț"),
      row("Firma", "judicial", { preview: "p" }, "Societate"),
      row("Act", "document", { relation: "r", preview: "p" }),
    ]);
    const lis = [...c.querySelectorAll("[data-one-line-row]")];
    expect(lis).toHaveLength(3);
    for (const li of lis) expect(slotsOf(li)).toEqual(["relation", "preview"]);
  });

  it("one row with a share keeps „Cotă” on every row, across the groups, so the buttons line up", () => {
    const c = draw([row("Ion", "natural", { share: "s", preview: "p" }), row("Teren", "property", { preview: "p" })]);
    for (const li of c.querySelectorAll("[data-one-line-row]")) expect(slotsOf(li)).toEqual(["share", "preview"]);
  });

  it("read-only, beside a list: „Relația” only where a row has one", () => {
    expect(slotsOf(draw([row("Ion", "natural", { share: "s", preview: "p" })], true).querySelector("[data-one-line-row]")!)).toEqual([]);
    const c = draw([row("Ion", "natural", { preview: "p" }), row("Act", "document", { relation: "r" })], true);
    for (const li of c.querySelectorAll("[data-one-line-row]")) expect(slotsOf(li)).toEqual(["relation"]);
  });

  it("the name is the flexible part up to its tag; the tag stays at the content's right edge", () => {
    const c = draw([row("Ion", "natural", { preview: "p" }, "Soț")]);
    const name = c.querySelector("[data-row-content] [data-row-name]")!;
    expect(name.className).toBe("min-w-0 flex-1 truncate");
    expect(name.nextElementSibling?.getAttribute("data-row-role")).toBe("");
  });
});

describe("the units (Ask first 2)", () => {
  it("„Legături” stays 4 units — 524 px at the 119-px unit — on every record", () => {
    expect(RELATED_UNITS).toBe(4);
    expect(unitsRem(4) * 16).toBe(524);
    for (const k of ["naturalPerson", "judicialPerson", "property", "document"] as const) expect(LIST_UNITS[k].related).toBe(4);
  });
});
