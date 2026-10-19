/**
 * Slice #39.89 — „Grupuri" and „Ștampile": the standard gap, a scrolling list, a search.
 *
 * Adrian, 2026-10-18: „for the groups the gap is too small; The groups should also have a scroll bar because the tile
 * is too tall; and the groups should have searched by code or words in the description next please perform the same
 * treatment for the stamps". The browser half is TC-GRP-01 and TC-STAMP-01 step 8.
 */
import fs from "fs";
import path from "path";
import { filterByWords, foldSearch, searchWords } from "@/lib/search/fold-words";
import * as calculation from "@/lib/calculation/search-words";
import { PANEL_BORDER_REM, REFERENCE_CARD_PADDING_REM, REFERENCE_GAP_REM } from "@/lib/ui/field-widths";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const SHARED = code(read("src", "components", "list", "admin-list.tsx"));
const GROUPS = code(read("src", "app", "admin", "groups", "_components", "groups-list-view.tsx"));
const STAMPS = code(read("src", "app", "admin", "stamps", "_components", "stamps-list-view.tsx"));
const ro = JSON.parse(read("messages", "ro-RO.json"));
const en = JSON.parse(read("messages", "en-GB.json"));

type G = { code: string; description: string };
const LIST: G[] = [
  { code: "GRP-010", description: "Parcele din Tarla 3 — Bragadiru" },
  { code: "GRP-001", description: "Dosare succesorale. Certificate de moștenitor" },
  { code: "GRP-0010", description: "Grup pentru GRP-001" },
  { code: "GRP-020", description: "Urbanism și construire" },
];
const find = (q: string) => filterByWords(LIST, q, (g) => g.code, (g) => g.description).map((g) => g.code);

describe("the search (Ask first 2): the code, or every word of the description, in any order, folded", () => {
  it("finds a code typed in any case", () => {
    expect(find("grp-020")).toEqual(["GRP-020"]);
  });

  it("puts an exact code first, before a row that only contains it", () => {
    expect(find("GRP-001")).toEqual(["GRP-001", "GRP-0010"]);
  });

  it("finds every word of the description, in any order, with or without diacritics", () => {
    expect(find("mostenitor dosare")).toEqual(["GRP-001"]);
    expect(find("Bragadiru tarla")).toEqual(["GRP-010"]);
    expect(find("urbanism moștenitor")).toEqual([]);
  });

  it("keeps every row, in its order, while nothing is typed", () => {
    expect(find("   ")).toEqual(LIST.map((g) => g.code));
  });

  it("folds as the calculation's searches do — the same functions, moved out of the database module", () => {
    expect(calculation.foldSearch).toBe(foldSearch);
    expect(calculation.searchWords).toBe(searchWords);
    expect(read("src", "lib", "search", "fold-words.ts")).not.toContain("drizzle");
  });
});

describe("the two lists share one piece (What this covers 2)", () => {
  it.each([
    ["Grupuri", GROUPS, "(g) => g.code, (g) => g.description"],
    ["Ștampile", STAMPS, "(s) => s.code, (s) => s.shortDescription"],
  ])("%s: the panel, the toolbar, the frame, the header and the search", (_what, src, keys) => {
    expect(src).toContain("className={ADMIN_LIST_PANEL}");
    expect(src).toContain("<AdminListToolbar");
    expect(src).toContain('<div className={ADMIN_LIST_FRAME} data-admin-list-frame="">');
    expect(src).toContain("<thead className={ADMIN_LIST_HEAD}>");
    expect(src).toContain(`filterByWords(query.data, search, ${keys})`);
    expect(src).toContain('t("countFiltered", { shown: shown.length, total: query.data.length })');
    expect(src).toContain('explanation={t("listSearchPlaceholder")}');
    expect(src).not.toContain("TABLE_FRAME");
  });
});

describe("the gap, the scroll (Ask first 1, 4)", () => {
  it("is Reference Data's standard: the 1-px border and p-5, 21 px", () => {
    expect(SHARED).toContain("rounded-md border border-card-rim bg-card p-5");
    expect((PANEL_BORDER_REM + REFERENCE_CARD_PADDING_REM) * 16).toBe(21);
    expect(REFERENCE_GAP_REM * 16).toBe(21);
  });

  it("the list stops at two thirds of the window and scrolls inside, its header row on top", () => {
    expect(SHARED).toContain('"w-full max-h-[66vh] overflow-auto');
    expect(SHARED).toContain('"sticky top-0 z-10');
  });

  it("the description takes what the frame leaves, so a scroll bar never pushes the buttons out sideways", () => {
    expect(SHARED).toContain('className: "w-full table-fixed text-sm"');
    expect(SHARED).toContain("style={name === fill ? undefined : columnStyle(name)}");
  });
});

describe("the words (Ask first 3)", () => {
  it("name what the search reads, as the column headers do, and count „n din m”", () => {
    expect(ro.group.listSearchPlaceholder).toBe(`caută după ${ro.group.table.code} sau ${ro.group.table.description}`);
    expect(ro.stamp.listSearchPlaceholder).toBe(`caută după ${ro.stamp.fields.code} sau ${ro.stamp.fields.shortDescription}`);
    expect(ro.group.countFiltered).toBe("{shown} din {total}");
    expect(ro.stamp.countFiltered).toBe("{shown} din {total}");
    expect(en.group.countFiltered).toBe("{shown} of {total}");
    // The group editor's own member search keeps its key.
    expect(ro.group.searchPlaceholder).toBe("Caută…");
  });
});
