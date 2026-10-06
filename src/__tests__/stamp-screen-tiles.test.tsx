/**
 * Slice #38.13 — applying a stamp (Administrare → Ștampile → „Aplică"): four
 * named tiles — „Descrierea ștampilei", „Tip element", „Elemente disponibile
 * pentru ștampilare", „Elemente deja ștampilate" — on the forms' packing and
 * drag (#38.12's `TileUnitRow`), stored under the stamp screen's own key. „Tip
 * element" is the tile's title and names its select; no label stands over it.
 * By default the first two where they stood, „Elemente deja ștampilate" under
 * the first and „Elemente disponibile…" under the second. jsdom has no layout:
 * the placement is checked on the rule the hook runs, the flow held as it holds it.
 */
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "fs";
import { join } from "path";

import { StampApplicator } from "@/app/admin/stamps/_components/stamp-applicator";
import { GROUP_SCREEN, STAMP_SCREEN } from "@/lib/ui/screen-tiles";
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

describe("the stamp screen's four tiles (#38.13)", () => {
  it("four regions named by their titles, tiles of the screen's row in reading order; the lists keep their counts", async () => {
    const { container } = renderApplicator();
    const stamped = await screen.findByRole("region", { name: "applicator.stamped" });
    const available = screen.getByRole("region", { name: "applicator.available" });
    const description = screen.getByRole("region", { name: "applicator.descriptionTile" });
    const type = screen.getByRole("region", { name: "applicator.targetTypeLabel" });
    expect([description, type, stamped, available].map((e) => e.dataset.tile)).toEqual([...STAMP_SCREEN.tiles]);
    const row = container.querySelector<HTMLElement>("[data-tile-row]")!;
    expect(row.dataset.tileScreen).toBe("admin-stamp");
    expect([...row.querySelectorAll<HTMLElement>("[data-tile]")].map((e) => e.dataset.tile)).toEqual(["description", "type", "stamped", "available"]);
    expect(stamped.querySelector("span.text-xs")?.textContent).toBe("1");
    expect(available.querySelector("span.text-xs")?.textContent).toBe("2");
    expect(description.textContent).toContain("STMP-AAA");
  });

  it("„Tip element” is the tile's title and names the select; no label over it", () => {
    const { container } = renderApplicator();
    expect(screen.getByRole("combobox", { name: "applicator.targetTypeLabel" })).toBeInstanceOf(HTMLSelectElement);
    expect(container.querySelector("label[for='stamp-target-type']")).toBeNull();
    expect(screen.getByRole("region", { name: "applicator.targetTypeLabel" }).textContent).toContain("applicator.typeNote");
  });

  it("the titles, in both languages — the screen's word „element” in Romanian, Adrian's English", () => {
    const ro = JSON.parse(read("messages", "ro-RO.json")).stamp.applicator;
    const en = JSON.parse(read("messages", "en-GB.json")).stamp.applicator;
    expect([ro.descriptionTile, ro.targetTypeLabel, ro.available, ro.stamped]).toEqual([
      "Descrierea ștampilei",
      "Tip element",
      "Elemente disponibile pentru ștampilare",
      "Elemente deja ștampilate",
    ]);
    expect([en.descriptionTile, en.targetTypeLabel, en.available, en.stamped]).toEqual([
      "Stamp description",
      "Object type",
      "Objects available to stamp",
      "Objects already stamped",
    ]);
  });
});

describe("the default placement (#38.13)", () => {
  const remPx = 16;
  const unit = UNIT_REM * remPx;
  const gap = UNIT_GAP_REM * remPx;
  // The heights measured on a synthetic stamp in the browser pane (TC-STAMP-02, run 1).
  const boxes = [
    { id: "description", units: 3, height: 309 },
    { id: "type", units: 3, height: 141 },
    { id: "stamped", units: 3, height: 187 },
    { id: "available", units: 3, height: 511 },
  ];
  const at = (units: number) => {
    const own = columnsIn(units * unit + (units - 1) * gap, unit, gap);
    const flow = Math.min(own, STAMP_SCREEN.flowUnits);
    return Object.fromEntries(placeWithStored(boxes, {}, own, gap, flow).placed.map((p) => [p.id, [p.col, p.top]]));
  };

  it.each([6, 10, 14])("a row of %i units: the first two where they stood, „deja ștampilate” under the first, „disponibile” under the second", (units) => {
    expect(at(units)).toEqual({
      description: [0, 0],
      type: [3, 0],
      stamped: [0, 309 + gap],
      available: [3, 141 + gap],
    });
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
    expect(page).toMatch(/<header className="[^"]*justify-between[^"]*">\s*<h1[\s\S]*<\/h1>\s*<TilePositionsReset entity=\{STAMP_SCREEN\.entity\} \/>/);
  });
});
