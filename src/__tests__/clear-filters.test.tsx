/**
 * Slice 40.49 — „Șterge filtrele" on the toolbar, right of the sort button.
 *
 * Adrian, 2026-10-24: „At the right of the sorting button there should be a "remove filters" button - that is enabled
 * only if at least one filter is in use and disabled otherwise". Always drawn; a press clears every filter and goes
 * back to page 1, the search and the order kept. On Acte a filter is also „Tip document:" narrowed, „Expiră curând"
 * and „Câmp specific" (Ask first 1). The filter bar's own „Șterge filtrele" went (Ask first 3). The browser half is
 * TC-LAYOUT-09 step 9.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { ClearFiltersButton } from "@/components/list/filter-bar";
import { bodyBesideTiles } from "@/components/tiles/preview-tiles";
import ro from "../../messages/ro-RO.json";
import en from "../../messages/en-GB.json";

jest.mock("next-intl", () => {
  const messages = jest.requireActual("../../messages/ro-RO.json");
  return {
    useTranslations: (ns: string) => (key: string, values?: Record<string, string>) => {
      const raw = `${ns}.${key}`.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], messages);
      return String(raw ?? key).replace(/\{(\w+)\}/g, (_, k: string) => values?.[k] ?? "");
    },
  };
});

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");

describe("the button", () => {
  it("enabled with a filter on: a press clears", () => {
    const onClear = jest.fn();
    render(<ClearFiltersButton active onClear={onClear} />);
    const b = screen.getByRole("button", { name: "Șterge filtrele" });
    expect(b).toBeEnabled();
    expect(b).toHaveAttribute("data-clear-filters", "");
    expect(b.querySelector("svg")?.getAttribute("class")).toContain("lucide-funnel-x");
    fireEvent.click(b);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("disabled with none, and it says why", () => {
    render(<ClearFiltersButton active={false} onClear={jest.fn()} />);
    const b = screen.getByRole("button", { name: "Șterge filtrele" });
    expect(b).toBeDisabled();
    expect(document.getElementById(b.getAttribute("aria-describedby") ?? "")?.textContent).toBe("Niciun filtru nu este activ.");
    expect(en.shared.filterBar.clearAllNone).toBe("No filter is on.");
    expect(ro.shared.filterBar.clearAll).toBe("Șterge filtrele");
  });

  it("the filter bar has no „Șterge filtrele” of its own any more", () => {
    const bar = read("src", "components", "list", "filter-bar.tsx");
    const body = bar.slice(bar.indexOf("export function FilterBar"), bar.indexOf("export function ClearFiltersButton"));
    expect(body).not.toMatch(/label=\{t\("clearAll"\)\}/);
  });
});

describe("on the four lists", () => {
  it.each(["natural-persons", "judicial-persons", "properties"])("%s: right after the sort button; on while a column filter is", (dir) => {
    const src = read("src", "app", dir, "list-view.tsx");
    const sort = src.indexOf("<ListSortButton");
    const clear = src.indexOf("<ClearFiltersButton");
    expect(clear).toBeGreaterThan(sort);
    expect(src.slice(sort, clear).match(/<[A-Z]\w+/g)).toEqual(["<ListSortButton"]);
    expect(src).toContain("<ClearFiltersButton active={Object.keys(filters).length > 0} onClear={() => { changeFilters({}); setEditingFilter(null); }} />");
  });

  it("Acte: inside the group, after the sort button; its own three count and are cleared, types back to all", () => {
    const src = read("src", "app", "documents", "list-view.tsx");
    const group = src.slice(src.indexOf('data-filter-fixed=""'), src.indexOf('className="ml-auto flex shrink-0 items-center gap-2"'));
    expect(group.indexOf("<ClearFiltersButton active={anyFilter} onClear={clearAllFilters} />")).toBeGreaterThan(group.indexOf("<ListSortButton"));
    expect(src).toContain('const anyFilter = Object.keys(filters).length > 0 || expiringSoon || customFieldKey !== "" || typesNarrowedNow;');
    const fn = src.slice(src.indexOf("function clearAllFilters()"), src.indexOf("\n  }\n", src.indexOf("function clearAllFilters()")));
    for (const s of ["changeFilters({});", "setExpiringSoon(false);", 'setCustomFieldKey("");', 'setCustomFieldValue("");', '"documentTypeIds"', "router.push(ownListAddress("]) expect([s, fn.includes(s)]).toEqual([s, true]);
    // Never the search or the order.
    expect(fn).not.toMatch(/setSearchInput|setListOrder|LIST_PARAM\.search|ORDER_PARAM/);
  });
});

describe("an open tile stays beside the list when the columns leave room (40.49)", () => {
  it("the body's cap: the room beside the tiles when the columns fit in it, the whole row when not", () => {
    expect(bodyBesideTiles("calc(30rem + 2px)").maxWidth).toBe("max(calc(100% - 41rem), min(100%, calc((calc(30rem + 2px) - (100% - 41rem)) * 1000)))");
  });

  it.each(["natural-persons", "judicial-persons", "properties", "documents"])("%s hands its columns' width to the tiles", (dir) => {
    expect(read("src", "app", dir, "list-view.tsx")).toMatch(/columnsEdge=\{columnsEdge\((columns|COLUMNS), fit\.gutter\)\}/);
  });
});
