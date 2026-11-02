/**
 * 41.43: two tiles now — the compact description and „Elementele ștampilei", „Tip element" over two lists (first describe).
 *
 * Slice #38.13 — applying a stamp (Administrare → Ștampile → „Aplică"): four
 * named tiles — „Descrierea ștampilei", „Tip element", „Elemente disponibile
 * pentru ștampilare", „Elemente deja ștampilate" — on the forms' packing and
 * drag (#38.12's `TileUnitRow`), stored under the stamp screen's own key. „Tip
 * element" is the tile's title and names its select; no label stands over it.
 * By default the first two where they stood, „Elemente deja ștampilate" under
 * the first and „Elemente disponibile…" under the second. jsdom has no layout:
 * the placement is checked on the rule the hook runs, the flow held as it holds it.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "fs";
import { join } from "path";

import { StampApplicator } from "@/app/admin/stamps/_components/stamp-applicator";
import { GROUP_SCREEN, STAMP_REGISTRY, STAMP_SCREEN } from "@/lib/ui/screen-tiles";
import { parseStoredTiles } from "@/lib/ui/tiles";
import { placeWithStored, tilePositionsKey } from "@/lib/ui/tile-positions";
import { columnsIn } from "@/lib/ui/tile-packing";
import { UNIT_GAP_REM, UNIT_REM } from "@/lib/ui/field-widths";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join("|")}` : key,
}));
jest.mock("@/components/help/help-hint", () => ({ HelpHint: () => null }));
jest.mock("@/components/forms/growing-text", () => ({
  GrowingText: (props: { "aria-label"?: string }) => <textarea aria-label={props["aria-label"]} />,
}));

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const DETAIL = {
  id: "s1",
  code: "STMP-AAA",
  shortDescription: "TC-STAMP-02 Ștampilă de test",
  notes: null,
  targetType: "PHYSICAL_PERSON" as const,
  members: [{ memberId: "ion", displayLabel: "Ion TC-STAMP-02" }],
  candidates: [
    { id: "ana", displayLabel: "Ana TC-STAMP-02" },
    { id: "dan", displayLabel: "Dan TC-STAMP-02" },
  ],
};

function renderApplicator() {
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, redirected: false, json: async () => DETAIL })) as unknown as typeof fetch;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StampApplicator stampId="s1" initialDetail={DETAIL} />
    </QueryClientProvider>,
  );
}

// 41.43 — inverted in place. Until 41.43 the screen had four tiles of 4 units: „Descrierea ștampilei", „Tip element"
// (its title naming the select, no label over it), „Elemente deja ștampilate" and „Elemente disponibile…". Now two, as a
// group's (41.42): the description, compact at 2 units, and „Elementele ștampilei" — „Tip element" over the two lists.
describe("the stamp screen's two tiles (41.43)", () => {
  it("two regions named by their titles, in reading order; the records tile holds both lists, each with its count", async () => {
    const { container } = renderApplicator();
    const description = screen.getByRole("region", { name: "applicator.descriptionTile" });
    const records = screen.getByRole("region", { name: "applicator.records" });
    // 41.44: and „Cum lucrezi cu ștampilele" after them.
    const workflows = screen.getByRole("region", { name: "title" });
    expect([description, records, workflows].map((e) => e.dataset.tile)).toEqual([...STAMP_SCREEN.tiles]);
    expect(STAMP_SCREEN.tiles).toEqual(["description", "records", "workflows"]);
    const row = container.querySelector<HTMLElement>("[data-tile-row]")!;
    expect(row.dataset.tileScreen).toBe("admin-stamp");
    const stamped = await within(records).findByRole("region", { name: "applicator.stamped" });
    const available = within(records).getByRole("region", { name: "applicator.available" });
    expect([...records.querySelectorAll<HTMLElement>("[data-two-list]")].map((e) => e.dataset.twoList)).toEqual(["stamped", "available"]);
    expect(stamped.querySelector("[data-two-list-count]")?.textContent).toBe("1");
    expect(available.querySelector("[data-two-list-count]")?.textContent).toBe("2");
    expect(description.querySelector("[data-stamp-identity-line]")?.textContent).toBe("STMP-AAA · TC-STAMP-02 Ștampilă de test");
    expect(description.lastElementChild?.lastElementChild?.matches("[data-stamp-save]")).toBe(true);
  });

  it("„Tip element” stands over both lists, a label naming the select, with the type note", () => {
    renderApplicator();
    const records = screen.getByRole("region", { name: "applicator.records" });
    const head = records.querySelector<HTMLElement>("[data-two-list-head]")!;
    expect(within(head).getByRole("combobox", { name: "applicator.targetTypeLabel" })).toBeInstanceOf(HTMLSelectElement);
    expect(head.textContent).toContain("applicator.typeNote");
    expect(screen.queryByRole("region", { name: "applicator.targetTypeLabel" })).toBeNull();
  });

  it("a double-click stamps a candidate, marked pending; the buttons carry the catalogue's icons", async () => {
    renderApplicator();
    const records = screen.getByRole("region", { name: "applicator.records" });
    const ana = await waitFor(() => {
      const el = records.querySelector<HTMLElement>('[data-two-list="available"] [data-two-list-row="ana"]');
      if (!el) throw new Error("not yet");
      return el;
    });
    fireEvent.doubleClick(ana);
    const moved = records.querySelector<HTMLElement>('[data-two-list="stamped"] [data-two-list-row="ana"]')!;
    expect(moved.hasAttribute("data-pending")).toBe(true);
    expect(screen.getByRole("button", { name: "applicator.saveStamps" })).not.toBeDisabled();
    expect(records.querySelector("[data-two-list-include] svg")?.getAttribute("class")).toContain("lucide-stamp");
    expect(records.querySelector("[data-two-list-take-out] svg")?.getAttribute("class")).toContain("lucide-eraser");
  });

  it("the titles, in both languages — the screen's word „element” in Romanian, Adrian's English", () => {
    const ro = JSON.parse(read("messages", "ro-RO.json")).stamp.applicator;
    const en = JSON.parse(read("messages", "en-GB.json")).stamp.applicator;
    expect([ro.descriptionTile, ro.records, ro.targetTypeLabel, ro.available, ro.stamped]).toEqual([
      "Descrierea ștampilei",
      "Elementele ștampilei",
      "Tip element",
      "Elemente disponibile pentru ștampilare",
      "Elemente deja ștampilate",
    ]);
    expect([en.descriptionTile, en.records, en.targetTypeLabel, en.available, en.stamped]).toEqual([
      "Stamp description",
      "Stamped objects",
      "Object type",
      "Objects available to stamp",
      "Objects already stamped",
    ]);
    expect([ro.applyStamp, ro.removeStamp]).toEqual(["‹ Aplică ștampila ({count})", "Elimină ștampila › ({count})"]);
  });
});

describe("the default placement (41.43; #38.13's rule)", () => {
  const remPx = 16;
  const unit = UNIT_REM * remPx;
  const gap = UNIT_GAP_REM * remPx;
  const boxes = [
    { id: "description", units: STAMP_SCREEN.tileUnits!.description, height: 240 },
    { id: "records", units: STAMP_SCREEN.tileUnits!.records, height: 560 },
  ];
  const at = (units: number, stored = {}) => {
    const own = Math.max(columnsIn(units * unit + (units - 1) * gap, unit, gap), STAMP_SCREEN.units);
    const flow = Math.min(own, STAMP_SCREEN.flowUnits);
    return Object.fromEntries(placeWithStored(boxes, stored, own, gap, flow).placed.map((p) => [p.id, [p.col, p.top]]));
  };

  it("1366 px (8 units): the records under the description; 1920 and 2560: at its right", () => {
    expect([STAMP_SCREEN.units, STAMP_SCREEN.flowUnits]).toEqual([7, 9]);
    expect(at(8)).toEqual({ description: [0, 0], records: [0, 240 + gap] });
    expect(at(12)).toEqual({ description: [0, 0], records: [2, 0] });
    expect(at(17)).toEqual({ description: [0, 0], records: [2, 0] });
  });

  it("places stored under the old names are not read; a choice under them reads as „records”", () => {
    expect(at(12, { stamped: { col: 8, top: 0 }, type: { col: 4, top: 0 } })).toEqual({ description: [0, 0], records: [2, 0] });
    expect(parseStoredTiles(JSON.stringify(["description", "stamped"]), STAMP_REGISTRY)).toEqual(["description", "records"]);
  });
});

describe("positions under the stamp screen's own key (#38.13)", () => {
  it("ga40-tile-positions-admin-stamp-v1, not the group screen's", () => {
    expect(tilePositionsKey(STAMP_SCREEN.entity)).toBe("ga40-tile-positions-admin-stamp-v1");
    expect(STAMP_SCREEN.entity).not.toBe(GROUP_SCREEN.entity);
  });

  it("#38.12's row and reset, not a copy", () => {
    expect(read("src", "app", "admin", "stamps", "_components", "stamp-applicator.tsx")).toContain("<TileUnitRow screen={STAMP_SCREEN}>");
    const page = read("src", "app", "admin", "stamps", "[id]", "page.tsx");
    // Inverted by 41.41 — was: „<TilePositionsReset entity={STAMP_SCREEN.entity} />" at the header's top right.
    // „Implicit" is now in „Panouri" (useTileChoice's reset forgets the places too).
    expect(page).not.toContain("TilePositionsReset");
    expect(read("src", "app", "admin", "stamps", "_components", "stamp-applicator.tsx")).toContain("<AdminTilesBar");
  });
});
